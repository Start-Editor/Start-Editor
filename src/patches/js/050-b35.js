/* ── [B35] 八音盒（Vinyl Player） ───────────────────────────────────────────────
   依赖：B41 / B48
   维护：可拖动 / 固定两种模式；在线音乐弹窗已删除
   ───────────────────────────────────────────────────────────── */

/* ============================================================================
 * 唱片机（Vinyl Player）
 *
 * DOCK 栏里的一个音乐播放器。点击后在右下角弹出一个固定位置的弹窗，
 * 用来在编辑作品时放点背景音乐。
 *
 * 设计上几个要点：
 *
 * 一、音频链路
 *     一个全局 <audio> 元素 + 一个 MediaElementSource。
 *     createMediaElementSource 对同一个元素只能调用一次，切歌只换 src，
 *     不重建节点 —— 否则第二首开始就没声音了。
 *
 *         srcNode ─┬─→ gDry ─────────────┐
 *                  └─→ convolver → gWet ─┴─→ master ─→ destination
 *                                                  └─→ analyser（旁路，只分析不出声）
 *
 *     混响用 ConvolverNode，脉冲响应是现场合成的（噪声 × 指数衰减），
 *     不依赖任何外部音频文件，离线可用。
 *
 * 二、不可拖动
 *     窗口带 bl-win-nodrag 标记，inject.js 的 initWindows 见到它就跳过拖动。
 *     位置用 right/bottom 固定，不用 left/top，所以也不用跟着窗口尺寸重算。
 *
 * 三、唱片旋转
 *     CSS animation + animation-play-state，暂停时停在当前角度而不是跳回 0。
 *     唱片图案刻意做成不对称（偏心标签、不等间距纹路），否则转起来看不出来。
 *
 * 四、底部光感
 *     AnalyserNode 的频域数据画成柱状，叠一条随平均能量起伏的柔光带。
 *     窗口关闭时停掉 rAF，不留后台空转。
 * ========================================================================== */

(function () {
    'use strict';
    if (window.__blVinyl) return;

    var STORE = 'bl:vinyl';
    /* 曲目内容存 IndexedDB（音频文件通常几 MB，localStorage 存不下），
       localStorage 只放一张轻量清单；浏览器不给 IndexedDB 时再退回
       小文件 base64。清单与内容用同一个 id 对应。 */
    var TRACK_STORE = 'bl:vinyl-tracks';
    var DATA_STORE = 'bl:vinyl-tracks-data';
    var DB_NAME = 'bl:vinyl-media';
    var DB_STORE = 'files';
    var MAX_DATAURL = 900 * 1024;      /* 退化路径只收 900KB 以内的小文件 */
    var cfg = { volume: 70, reverb: 25, mode: 'loop', spectrum: true, echo: 0, denoise: 0, treble: 0, bass: 0, winMode: 'popup', spectrumColor: '', customSpectrum: false, cur: -1 };
    var tracks = [];          /* { id, name, url, size, type, saved, pending } */
    var cur = -1;
    var win = null;
    var bodyEl = null;
    var discEl = null;
    var vizEl = null, vizCtx = null;
    var listEl = null, titleEl = null, timeEl = null, fillEl = null;

    var actx = null, audioEl = null, srcNode = null;
    var gDry = null, gWet = null, conv = null, master = null, analyser = null;
    var gEcho = null, echoDelay = null, echoFeedback = null;
    var fltHigh = null, eqTreble = null, eqBass = null;
    var freq = null;
    var raf = 0;
    var seeking = false;
    var seekRatio = -1;        /* 拖动中的预览位置 0..1，-1 表示无 */
    var pendingSeek = -1;      /* 元数据未就绪时暂存的跳转位置 */
    var vizW = 0, vizH = 0;

    /* ---------------- 存储 ---------------- */

    function loadCfg() {
        try {
            var o = JSON.parse(window.localStorage.getItem(STORE) || '{}');
            if (o && typeof o === 'object') {
                if (typeof o.volume === 'number') cfg.volume = Math.max(0, Math.min(100, o.volume));
                if (typeof o.reverb === 'number') cfg.reverb = Math.max(0, Math.min(100, o.reverb));
                if (o.mode === 'order' || o.mode === 'loop' || o.mode === 'shuffle') cfg.mode = o.mode;
                if (typeof o.spectrum === 'boolean') cfg.spectrum = o.spectrum;
                if (typeof o.cur === 'number' && isFinite(o.cur)) cfg.cur = o.cur;
            }
        } catch (e) { /* ignore */ }
    }

    function saveCfg() {
        try { window.localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
    }

    function syncCur() {
        cfg.cur = cur;
        try { saveCfg(); } catch (e) { /* ignore */ }
    }

    /* ---------------- 曲目持久化 ----------------
       导入时拿到的是 File，blob URL 只在本次页面有效（刷新就失效），
       所以真正要存的是文件本体。清单单独存，读档时按 id 把本体取回来
       再生成新的 blob URL。任何一步不可用都不能影响本次播放。 */

    var dbPromise = null, dbFailAt = 0;
    var IDB_OPEN_TIMEOUT = 6000;      /* file:// / 冷启动 / 多标签页 blocked 可能更久 */
    var IDB_RETRY_COOL = 12000;       /* 失败后冷却，避免每首歌都重新 open 再等 6s */

    function newId() {
        return 'vt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function idb() {
        if (dbPromise) return dbPromise;          /* 含「迟到成功」留下的句柄，优先 */
        var nowMs = Date.now();
        if (dbFailAt && (nowMs - dbFailAt) < IDB_RETRY_COOL) {
            return Promise.reject(new Error('IndexedDB 冷却中'));
        }
        if (!window.indexedDB) {
            dbFailAt = nowMs;
            return Promise.reject(new Error('IndexedDB 不可用'));
        }
        var p = new Promise(function (res, rej) {
            var req = null, done = false, timer = 0;
            function finishOk(db) {
                if (done) return;
                done = true;
                if (timer) clearTimeout(timer);
                res(db);
            }
            function finishFail(e) {
                if (done) return;
                done = true;
                if (timer) clearTimeout(timer);
                rej(e || new Error('IndexedDB 打开失败'));
            }
            /* 超时只让「本次调用」走降级，绝不吞掉迟到的 onsuccess：
               浏览器稍后真的把库打开时，把句柄留给后续调用，
               否则会变成「每首歌都重新 open → 又超时 → 全部走降级」。 */
            timer = window.setTimeout(function () {
                if (req && req.readyState === 'done' && req.result) { finishOk(req.result); return; }
                finishFail(new Error('IndexedDB 打开超时'));
            }, IDB_OPEN_TIMEOUT);
            try { req = window.indexedDB.open(DB_NAME, 1); }
            catch (e) { finishFail(e); return; }
            req.onupgradeneeded = function () {
                var d = req.result;
                try {
                    if (!d.objectStoreNames.contains(DB_STORE)) {
                        d.createObjectStore(DB_STORE, { keyPath: 'id' });
                    }
                } catch (e0) { /* ignore */ }
            };
            req.onsuccess = function () {
                if (done) {
                    /* 已判超时但库其实开好了：修好共享句柄，下一次直接命中 */
                    if (req.result) dbPromise = Promise.resolve(req.result);
                    dbFailAt = 0;
                    return;
                }
                finishOk(req.result);
            };
            req.onerror = function () { finishFail(req.error || new Error('IndexedDB 打开失败')); };
            req.onblocked = function () {
                /* 另一个标签页持有旧连接时 Chrome 会先 blocked，之后仍可能
                   success；这里只把等待窗口延长一次，不当场判失败。 */
                if (timer) clearTimeout(timer);
                timer = window.setTimeout(function () {
                    if (req && req.readyState === 'done' && req.result) finishOk(req.result);
                    else finishFail(new Error('IndexedDB 被阻塞'));
                }, IDB_OPEN_TIMEOUT);
            };
        });
        dbPromise = p;
        /* 微任务里清空失败句柄 + 记冷却，保证 dbPromise 已赋值 */
        p.catch(function () {
            if (dbPromise === p) dbPromise = null;
            dbFailAt = Date.now();
        });
        return p;
    }

    function idbRun(mode, fn) {
        return idb().then(function (db) {
            return new Promise(function (res, rej) {
                var tx;
                try { tx = db.transaction(DB_STORE, mode); }
                catch (e) { rej(e); return; }
                var req = null;
                try { req = fn(tx.objectStore(DB_STORE)); }
                catch (e) { rej(e); return; }
                if (req) {
                    req.onsuccess = function () { res(req.result); };
                    req.onerror = function () { rej(req.error || new Error('IndexedDB 请求失败')); };
                }
                tx.oncomplete = function () { if (!req) res(true); };
                tx.onerror = tx.onabort = function () { rej(tx.error || new Error('IndexedDB 事务失败')); };
            });
        });
    }

    function idbPut(rec, blob) {
        return idbRun('readwrite', function (st) {
            st.put({ id: rec.id, name: rec.name, type: rec.type, size: rec.size, blob: blob });
            return null;
        });
    }
    function idbGet(id) { return idbRun('readonly', function (st) { return st.get(id); }); }
    function idbDel(id) {
        return idbRun('readwrite', function (st) { st['delete'](id); return null; });
    }

    function findTrack(id) {
        for (var i = 0; i < tracks.length; i++) if (tracks[i].id === id) return tracks[i];
        return null;
    }

    /* 只有已落盘的曲目才写进清单；会话中临时可用的曲目不写，
       这样刷新后不会出现「列表里有一首但点开没声音」的空条目。 */
    function saveMeta() {
        try {
            var arr = [], i;
            for (i = 0; i < tracks.length; i++) {
                var t = tracks[i];
                if (!t.saved) continue;
                arr.push({ id: t.id, name: t.name, size: t.size, type: t.type });
            }
            window.localStorage.setItem(TRACK_STORE, JSON.stringify(arr));
        } catch (e) { /* ignore */ }
    }

    function readDataMap() {
        try {
            var o = JSON.parse(window.localStorage.getItem(DATA_STORE) || '{}');
            return (o && typeof o === 'object') ? o : {};
        } catch (e) { return {}; }
    }

    function markSaved(id, ok) {
        var t = findTrack(id);
        /* 异步写盘期间用户可能已删除该曲：dead 标记让所有迟到回调都不许
           把它写回清单或状态栏，避免「删了又长回来」 */
        if (!t || t.dead) { saveMeta(); return; }
        t.pending = false;
        t.saved = !!ok;
        saveMeta();
        updateSaveState();
    }

    function fallbackPut(rec, blob) {
        if (blob && blob.size > MAX_DATAURL) { markSaved(rec.id, false); return; }
        try {
            var fr = new FileReader();
            fr.onload = function () {
                var t = findTrack(rec.id);
                if (!t || t.dead) return;
                try {
                    var map = readDataMap();
                    map[rec.id] = String(fr.result);
                    window.localStorage.setItem(DATA_STORE, JSON.stringify(map));
                    markSaved(rec.id, true);
                } catch (e) { markSaved(rec.id, false); }
            };
            fr.onerror = function () { markSaved(rec.id, false); };
            fr.readAsDataURL(blob);
        } catch (e) { markSaved(rec.id, false); }
    }

    function persistTrack(t, file) {
        var rec = { id: t.id, name: t.name, type: file.type || '', size: file.size || 0 };
        t.pending = true;
        t.saved = false;
        idbPut(rec, file).then(function () {
            var now = findTrack(t.id);
            if (!now || now.dead) { idbDel(rec.id).catch(function () { /* ignore */ }); return; }
            markSaved(t.id, true);
        }).catch(function () { fallbackPut(rec, file); });
    }

    function deletePersisted(id) {
        try {
            var map = readDataMap();
            if (Object.prototype.hasOwnProperty.call(map, id)) {
                delete map[id];
                window.localStorage.setItem(DATA_STORE, JSON.stringify(map));
            }
        } catch (e) { /* ignore */ }
        try { idbDel(id).catch(function () { /* ignore */ }); } catch (e) { /* ignore */ }
        saveMeta();
    }

    function objectUrl(blob) {
        try { return window.URL.createObjectURL(blob); } catch (e) { return null; }
    }
    function revokeUrl(u) {
        try { if (u && String(u).indexOf('blob:') === 0) window.URL.revokeObjectURL(u); }
        catch (e) { /* ignore */ }
    }

    function restored(m, url) {
        if (!url) return null;
        return {
            id: m.id, name: m.name || 'track', url: url,
            size: m.size || 0, type: m.type || '', saved: true, pending: false
        };
    }

    function clampCur(v, n) {
        v = parseInt(v, 10);
        if (!isFinite(v) || n <= 0) return n > 0 ? 0 : -1;
        if (v < 0 || v >= n) return 0;
        return v;
    }

    /* 启动时把清单里的曲目取回来。若恢复完成前用户已经导入了新文件，
       恢复项按清单顺序插到前面、会话项保持原顺序，并同步修正 cur。 */
    /* 启动时把清单里的曲目取回来。若恢复失败（IDB 慢 / 被阻塞 / 隐私模式），
       清单条目绝不删除、也不静默丢弃：进 restorePending，按退避重试，
       仍失败时状态栏显示「点此重试」，用户随时能手动再拉一次。 */
    var restorePending = [];      /* 未能恢复的清单条目 */
    var restoreTries = 0, restoreTimer = 0, restoreBusy = false;

    function restoreOne(m, map) {
        /* base64 降级数据是同步可读的，先命中就不必等 IDB */
        if (map[m.id]) return Promise.resolve(restored(m, map[m.id]));
        return idbGet(m.id).then(function (rec) {
            if (rec && rec.blob) return restored(m, objectUrl(rec.blob));
            return map[m.id] ? restored(m, map[m.id]) : null;
        }).catch(function () {
            return map[m.id] ? restored(m, map[m.id]) : null;
        });
    }

    function restoreTracks() {
        if (restoreBusy) return;
        var meta = [];
        try {
            var a = JSON.parse(window.localStorage.getItem(TRACK_STORE) || '[]');
            if (Array.isArray(a)) meta = a;
        } catch (e) { /* ignore */ }
        if (!meta.length) { restorePending = []; restoreTries = 0; updateSaveState(); return; }
        restoreBusy = true;
        updateSaveState();
        var map = readDataMap(), have = {}, jobs = [], ids = [], i;
        for (i = 0; i < tracks.length; i++) have[tracks[i].id] = 1;
        for (i = 0; i < meta.length; i++) {
            (function (m) {
                if (!m || !m.id || have[m.id]) return;
                ids.push(m);
                jobs.push(restoreOne(m, map));
            })(meta[i]);
        }
        Promise.all(jobs).then(function (list) {
            restoreBusy = false;
            var add = [], miss = [], k;
            for (k = 0; k < list.length; k++) {
                if (list[k]) add.push(list[k]);
                else miss.push(ids[k]);
            }
            if (add.length) {
                var before = tracks.length, oldCur = cur;
                tracks = add.concat(tracks);
                cur = before > 0 && oldCur >= 0
                    ? clampCur(oldCur + add.length, tracks.length)
                    : clampCur(cfg.cur, tracks.length);
                syncCur();
                renderList();
                renderTitle();
            }
            restorePending = miss;
            if (miss.length) {
                /* 清单不动：下次刷新、自动重试、手动重试都还能读到 */
                restoreTries++;
                if (restoreTries <= 3) {
                    var delay = [0, 1500, 5000][restoreTries] || 12000;
                    if (restoreTimer) clearTimeout(restoreTimer);
                    restoreTimer = window.setTimeout(function () { restoreTracks(); }, delay);
                }
            } else {
                restoreTries = 0;
            }
            updateSaveState();
        }).catch(function () {
            restoreBusy = false;
            updateSaveState();
        });
    }

    function retryRestore() {
        restoreTries = 0;
        if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = 0; }
        restoreTracks();
    }

    function updateSaveState() {
        var el = win ? win.querySelector('.vy-save-state') : null;
        if (!el) return;
        var n = tracks.length, saved = 0, pending = 0, i, txt;
        for (i = 0; i < n; i++) {
            if (tracks[i].saved) saved++;
            else if (tracks[i].pending) pending++;
        }
        var retry = !!restorePending.length;
        if (retry) txt = restoreBusy
            ? '\u6b63\u5728\u6062\u590d ' + restorePending.length + ' \u9996\u2026'
            : restorePending.length + ' \u9996\u6062\u590d\u5931\u8d25 \u00b7 \u70b9\u6b64\u91cd\u8bd5';
        else if (!n) txt = '\u5bfc\u5165\u7684\u97f3\u4e50\u4f1a\u81ea\u52a8\u4fdd\u5b58\uff0c\u91cd\u5f00\u7f16\u8f91\u5668\u4ecd\u5728';
        else if (pending) txt = '\u6b63\u5728\u4fdd\u5b58 ' + pending + ' \u9996\u2026';
        else if (saved === n) txt = '\u5df2\u4fdd\u5b58 ' + n + ' \u9996 \u00b7 \u91cd\u5f00\u4ecd\u5728';
        else if (!saved) txt = n + ' \u9996\u4ec5\u672c\u6b21\u6709\u6548\uff08\u6d4f\u89c8\u5668\u5b58\u50a8\u4e0d\u8db3\uff09';
        else txt = '\u5df2\u4fdd\u5b58 ' + saved + ' \u9996 \u00b7 ' + (n - saved) + ' \u9996\u4ec5\u672c\u6b21\u6709\u6548';
        if (el.textContent !== txt) el.textContent = txt;
        if (retry) el.classList.add('is-retry'); else el.classList.remove('is-retry');
        el.setAttribute('title', retry ? '\u70b9\u51fb\u91cd\u65b0\u6062\u590d\u5df2\u4fdd\u5b58\u7684\u97f3\u4e50' : '');
    }

    /* 音效 / 模式 / 音谱颜色从「八音盒」设置读取（bl:musicbox）。
       设置页改动后经 storage 事件 + 低频轮询同步到这里。 */
    function syncMusicboxSettings() {
        var mb = null;
        try { mb = window.__blSettings ? window.__blSettings.get('musicbox') : null; } catch (e) { mb = null; }
        if (!mb) return;
        var dirty = false;
        if (typeof mb.reverb === 'number') { var rv = Math.max(0, Math.min(100, mb.reverb)); if (rv !== cfg.reverb) { cfg.reverb = rv; dirty = true; } }
        if (typeof mb.echo === 'number') { var ec = Math.max(0, Math.min(100, mb.echo)); if (ec !== cfg.echo) { cfg.echo = ec; dirty = true; } }
        if (typeof mb.denoise === 'number') { var dn = Math.max(0, Math.min(100, mb.denoise)); if (dn !== cfg.denoise) { cfg.denoise = dn; dirty = true; } }
        if (typeof mb.treble === 'number') { var tr = Math.max(-12, Math.min(12, mb.treble)); if (tr !== cfg.treble) { cfg.treble = tr; dirty = true; } }
        if (typeof mb.bass === 'number') { var ba = Math.max(-12, Math.min(12, mb.bass)); if (ba !== cfg.bass) { cfg.bass = ba; dirty = true; } }
        if (mb.mode === 'popup' || mb.mode === 'fixed') { if (mb.mode !== cfg.winMode) { cfg.winMode = mb.mode; dirty = true; syncWinChrome(); } }
        if (typeof mb.customSpectrum === 'boolean') { if (mb.customSpectrum !== cfg.customSpectrum) { cfg.customSpectrum = mb.customSpectrum; dirty = true; } }
        if (typeof mb.spectrumColor === 'string') { if (mb.spectrumColor !== cfg.spectrumColor) { cfg.spectrumColor = mb.spectrumColor; dirty = true; } }
        if (dirty) applyAudioChain();
    }

    /* ---------------- 音频 ---------------- */

    /* 现场合成一段脉冲响应：白噪声 × 指数衰减。
       不引入外部音频文件，离线可用，且长度/衰减可控。 */
    function makeIR(sec, decay) {
        var rate = actx.sampleRate;
        var n = Math.max(1, Math.floor(rate * sec));
        var buf = actx.createBuffer(2, n, rate);
        for (var c = 0; c < 2; c++) {
            var d = buf.getChannelData(c);
            for (var i = 0; i < n; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
            }
        }
        return buf;
    }

    function ensureAudio() {
        if (actx) return true;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        try { actx = new AC(); } catch (e) { return false; }

        master = actx.createGain();
        master.gain.value = cfg.volume / 100;

        analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        freq = new Uint8Array(analyser.frequencyBinCount);

        gDry = actx.createGain();
        gWet = actx.createGain();
        conv = actx.createConvolver();
        conv.buffer = makeIR(2.4, 2.8);
        conv.normalize = true;

        /* 回响（Echo）：延迟 + 反馈环 */
        gEcho = actx.createGain();
        echoDelay = actx.createDelay(2.0);
        echoDelay.delayTime.value = 0.28;
        echoFeedback = actx.createGain();
        echoFeedback.gain.value = 0.0;

        /* 降噪（高通滤波） / 高音（高架） / 低音（低架） */
        fltHigh = actx.createBiquadFilter();
        fltHigh.type = 'highpass';
        fltHigh.frequency.value = 20;
        eqTreble = actx.createBiquadFilter();
        eqTreble.type = 'highshelf';
        eqTreble.frequency.value = 6000;
        eqBass = actx.createBiquadFilter();
        eqBass.type = 'lowshelf';
        eqBass.frequency.value = 250;

        /* 前置 EQ 链：srcNode → fltHigh → eqTreble → eqBass */
        fltHigh.connect(eqTreble);
        eqTreble.connect(eqBass);

        /* 干声 / 混响湿声 / 回响湿声 三路汇入 master */
        gDry.connect(master);
        conv.connect(gWet);
        gWet.connect(master);
        echoDelay.connect(gEcho);
        gEcho.connect(master);
        /* 回响反馈环：delay 输出回到自身输入（经 feedback 增益） */
        echoDelay.connect(echoFeedback);
        echoFeedback.connect(echoDelay);

        master.connect(actx.destination);
        /* analyser 是旁路：连上即可取数据，不需要再往 destination 传 */
        master.connect(analyser);

        applyAudioChain();

        audioEl = document.createElement('audio');
        audioEl.preload = 'auto';
        try {
            srcNode = actx.createMediaElementSource(audioEl);
            srcNode.connect(fltHigh);
            eqBass.connect(gDry);
            eqBass.connect(conv);
            eqBass.connect(echoDelay);
        } catch (e) {
            /* 跨域或浏览器限制时降级：直接走元素自身的播放，
               没有混响和频谱，但至少有声 */
            srcNode = null;
        }

        audioEl.addEventListener('play', function () { setPlaying(true); });
        audioEl.addEventListener('pause', function () { setPlaying(false); });
        audioEl.addEventListener('ended', onEnded);
        audioEl.addEventListener('timeupdate', syncProgress);
        audioEl.addEventListener('loadedmetadata', function () {
            onLoadedMeta();
            syncProgress();
        });
        audioEl.addEventListener('error', function () { setPlaying(false); });
        return true;
    }

    /* 统一把 cfg 里的音效参数下发到音频节点（干/湿/回响/EQ）。 */
    function applyAudioChain() {
        /* 混响（干湿比） */
        if (gDry && gWet) {
            var w = cfg.reverb / 100;
            gDry.gain.value = 1 - w * 0.55;
            gWet.gain.value = w * 0.85;
        }
        /* 回响（feedback 强度） */
        if (gEcho && echoFeedback) {
            var ew = cfg.echo / 100;
            gEcho.gain.value = ew;
            echoFeedback.gain.value = ew * 0.55;
        }
        /* 降噪（高通截止频率：0..100 → 20..400 Hz） */
        if (fltHigh) {
            fltHigh.frequency.value = 20 + (cfg.denoise / 100) * 380;
        }
        /* 高音 / 低音（±12 dB 增益） */
        if (eqTreble) eqTreble.gain.value = cfg.treble;
        if (eqBass) eqBass.gain.value = cfg.bass;
    }

    function applyVolume() {
        if (master) master.gain.value = cfg.volume / 100;
    }

    /* ---------------- 播放控制 ---------------- */

    function playAt(i) {
        if (!tracks.length) return;
        if (typeof i === 'number' && i >= 0) cur = i;
        if (cur < 0) cur = 0;
        if (cur >= tracks.length) cur = 0;
        if (!ensureAudio()) return;
        try {
            if (actx.state === 'suspended') actx.resume();
        } catch (e) { /* ignore */ }
        try {
            /* 跨域直链要先声明 anonymous，否则 Web Audio 会把它判成"污染"资源
               而输出静音（不报错，就是没声音）。加载失败时静默停止。 */
            var u0 = String(tracks[cur].url || '');
            audioEl.crossOrigin = /^https?:/i.test(u0) ? 'anonymous' : null;
            audioEl.src = u0;
            audioEl.currentTime = 0;
            var p = audioEl.play();
            if (p && p.catch) p.catch(function () { setPlaying(false); });
        } catch (e) { setPlaying(false); return; }
        syncCur();
        renderList();
        renderTitle();
    }

    function togglePlay() {
        if (!tracks.length) { pickFiles(); return; }
        if (!ensureAudio()) return;
        try {
            if (actx.state === 'suspended') actx.resume();
        } catch (e) { /* ignore */ }
        if (audioEl.paused) {
            if (!audioEl.src) { playAt(cur < 0 ? 0 : cur); return; }
            var p = audioEl.play();
            if (p && p.catch) p.catch(function () { /* ignore */ });
        } else {
            audioEl.pause();
        }
    }

    function step(d) {
        if (!tracks.length) return;
        var n = cur + d;
        if (n < 0) n = tracks.length - 1;
        if (n >= tracks.length) n = 0;
        playAt(n);
    }

    function onEnded() {
        if (cfg.mode === 'shuffle') {
            playAt(randIdx());
            return;
        }
        if (cfg.mode === 'loop') {
            /* 单曲循环：重新播放当前曲，而不是跳到下一首 */
            try {
                if (audioEl) { audioEl.currentTime = 0; audioEl.play(); }
                else playAt(cur);
            } catch (e) { playAt(cur); }
            return;
        }
        /* 顺序：播到最后一首就停 */
        if (cur < tracks.length - 1) step(1);
        else setPlaying(false);
    }

    function randIdx() {
        if (tracks.length <= 1) return 0;
        var n = cur;
        var guard = 0;
        while (n === cur && guard < 32) {
            n = Math.floor(Math.random() * tracks.length);
            guard++;
        }
        return n;
    }

    function setPlaying(on) {
        var was = win && win.classList.contains('is-playing');
        if (win) {
            if (on) win.classList.add('is-playing');
            else win.classList.remove('is-playing');
        }
        var b = win ? win.querySelector('.vy-play-i') : null;
        if (b) b.innerHTML = on ? pauseIcon() : playIcon();
        if (on && !raf) startViz();
        if (was !== on) renderList();
    }

    function isPlaying() {
        return !!(audioEl && !audioEl.paused);
    }

    /* 元数据到位后补一次之前未生效的跳转（拖动时 duration 还是 NaN 的情况） */
    function onLoadedMeta() {
        if (pendingSeek < 0 || !audioEl) return;
        var x = pendingSeek;
        pendingSeek = -1;
        var d = audioEl.duration;
        if (isFinite(d) && d > 0) {
            try { audioEl.currentTime = x * d; } catch (e) { /* ignore */ }
        }
    }

    /* ---------------- 导入 ---------------- */

    function pickFiles() {
        var inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'audio/*';
        inp.multiple = true;
        inp.style.display = 'none';
        inp.addEventListener('change', function () {
            var fs = inp.files;
            if (fs && fs.length) {
                var added = 0;
                for (var i = 0; i < fs.length; i++) {
                    var f = fs[i];
                    var url = objectUrl(f);
                    if (!url) continue;
                    var t = {
                        id: newId(),
                        name: f.name || ('track-' + (tracks.length + 1)),
                        url: url,
                        size: f.size || 0,
                        type: f.type || '',
                        saved: false,
                        pending: true
                    };
                    tracks.push(t);
                    persistTrack(t, f);
                    added++;
                }
                if (added) {
                    if (cur < 0) cur = 0;
                    syncCur();
                    renderList();
                    renderTitle();
                }
            }
            try { if (inp.parentNode) inp.parentNode.removeChild(inp); } catch (e) { /* ignore */ }
        });
        document.body.appendChild(inp);
        inp.click();
    }

    /* ---------------- 删除 ---------------- */

    function clearSource() {
        try {
            if (audioEl) {
                audioEl.pause();
                audioEl.removeAttribute('src');
                audioEl.load();
            }
        } catch (e) { /* ignore */ }
    }

    function stopPlayback() {
        clearSource();
        setPlaying(false);
        if (fillEl) fillEl.style.width = '0%';
        if (timeEl) timeEl.textContent = '0:00 / 0:00';
    }

    /* 删掉一条曲目：撤掉 blob URL、删掉 IndexedDB / localStorage 里的本体，
       再重写清单。dead 标记让所有正在进行的异步写盘回调都不许把它写回来。 */
    function removeAt(i) {
        if (i < 0 || i >= tracks.length) return;
        var wasCur = (i === cur), wasPlaying = isPlaying();
        var t = tracks[i];
        t.dead = true;
        tracks.splice(i, 1);
        revokeUrl(t.url);
        deletePersisted(t.id);
        /* 若它还在「恢复失败」队列里，一并摘掉，别让重试又把它捞回来 */
        for (var q = restorePending.length - 1; q >= 0; q--) {
            if (restorePending[q] && restorePending[q].id === t.id) restorePending.splice(q, 1);
        }
        if (!tracks.length) {
            cur = -1;
            syncCur();
            stopPlayback();
            renderList();
            renderTitle();
            updateSaveState();
            return;
        }
        var nc;
        if (wasCur) nc = Math.min(i, tracks.length - 1);
        else if (i < cur) nc = cur - 1;
        else nc = cur;
        cur = clampCur(nc, tracks.length);
        syncCur();
        if (wasCur) clearSource();       /* 旧 src 已指向被撤销的 blob，必须让播放器忘掉 */
        if (wasCur && wasPlaying) playAt(cur);
        else { renderList(); renderTitle(); }
        updateSaveState();
    }

    /* ---------------- 进度 ---------------- */

    function fmt(t) {
        if (!isFinite(t) || t < 0) t = 0;
        var m = Math.floor(t / 60), s = Math.floor(t % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function syncProgress() {
        if (!audioEl || !fillEl) return;
        /* 拖动中：进度条显示的是"将要跳到的位置"，不能被播放进度覆盖 */
        if (seeking) return;
        var d = audioEl.duration;
        var p = audioEl.currentTime;
        var pc = (isFinite(d) && d > 0) ? (p / d * 100) : 0;
        if (pc < 0) pc = 0;
        if (pc > 100) pc = 100;
        if (!seeking) fillEl.style.width = pc.toFixed(2) + '%';
        if (timeEl) timeEl.textContent = fmt(p) + ' / ' + fmt(d);
    }

    /* 时间条：拖动时只预览，松手才真正跳转
       之前是 pointerdown / pointermove 直接写 currentTime —— 拖动过程中
       每移动一像素就解码一次，低配机器上会明显卡顿；而且用户还没确认
       位置就已经跳了，手感很差。现在改成：拖动只更新显示，松手才 seek。 */
    function ratioAt(clientX) {
        if (!bodyEl) return -1;
        var track = bodyEl.querySelector('.vy-bar');
        if (!track) return -1;
        var r = track.getBoundingClientRect();
        var x = (clientX - r.left) / Math.max(1, r.width);
        if (x < 0) x = 0;
        if (x > 1) x = 1;
        return x;
    }

    function previewAt(clientX) {
        var x = ratioAt(clientX);
        if (x < 0) return;
        seekRatio = x;
        if (fillEl) fillEl.style.width = (x * 100).toFixed(2) + '%';
        if (timeEl) {
            var d = (audioEl && isFinite(audioEl.duration)) ? audioEl.duration : 0;
            timeEl.textContent = fmt(x * d) + ' / ' + fmt(d);
        }
    }

    function commitSeek() {
        var x = seekRatio;
        seekRatio = -1;
        if (x < 0) return;
        if (!audioEl) return;
        var d = audioEl.duration;
        if (isFinite(d) && d > 0) {
            try { audioEl.currentTime = x * d; } catch (e) { /* ignore */ }
            return;
        }
        /* 元数据还没到，先存着，loadedmetadata 之后再跳一次 */
        pendingSeek = x;
    }

    /* ---------------- 频谱（底部光感） ---------------- */

    /* 频谱只在"有东西可看"时才持续跑。
       打开窗口但没播放、或者暂停之后，画面是静止的，没必要一直占着 rAF
       —— 那是在后台空转。所以静默时画够几帧（让光带落下来）就自己停。 */
    var idleFrames = 0;

    function startViz() {
        if (raf) return;
        idleFrames = 0;
        var loop = function () {
            raf = window.requestAnimationFrame(loop);
            drawViz();
            if (isPlaying()) { idleFrames = 0; return; }
            idleFrames++;
            if (idleFrames > 40) stopViz();
        };
        raf = window.requestAnimationFrame(loop);
    }

    /* 停的时候不清空画板：让最后一帧（平静的底光）留在那儿，
       比突然变成一块空白自然。真正要彻底擦掉的是"关掉音谱"那条路径。 */
    function stopViz() {
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
    }

    /* 把十六进制颜色拆成 RGB，生成同色系的深→亮渐变三色 */
    function hexToRgb(h) {
        h = String(h || '').replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var n = parseInt(h, 16);
        if (isNaN(n)) return null;
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function spectrumTones(hex) {
        var c = hexToRgb(hex) || { r: 120, g: 200, b: 210 };
        var lerp = function (a, b, t) { return Math.round(a + (b - a) * t); };
        var c1 = { r: lerp(c.r, 0, 0.45), g: lerp(c.g, 0, 0.45), b: lerp(c.b, 0, 0.45) };
        var c3 = { r: Math.min(255, c.r + 60), g: Math.min(255, c.g + 60), b: Math.min(255, c.b + 60) };
        return [
            'rgba(' + c1.r + ',' + c1.g + ',' + c1.b + ',0.55)',
            'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.85)',
            'rgba(' + c3.r + ',' + c3.g + ',' + c3.b + ',0.95)'
        ];
    }

    function drawViz() {
        if (!vizEl || !vizCtx) return;
        var w = vizW || vizEl.clientWidth || 400;
        var h = vizH || vizEl.clientHeight || 64;
        vizCtx.clearRect(0, 0, w, h);
        /* 弹窗内音谱常驻：开关现在管的是"整个编辑器底部"的音谱 */

        var n = 56;                    /* 柱子数量 */
        var gap = 2;
        var bw = (w - gap * (n - 1)) / n;
        var grad = vizCtx.createLinearGradient(0, h, 0, 0);
        /* 自定义音谱色：从设置读（不启用则用默认青紫粉渐变） */
        if (cfg.customSpectrum && cfg.spectrumColor) {
            var sc = spectrumTones(cfg.spectrumColor);
            grad.addColorStop(0, sc[0]);
            grad.addColorStop(0.55, sc[1]);
            grad.addColorStop(1, sc[2]);
        } else {
            grad.addColorStop(0, 'rgba(120, 200, 210, 0.55)');
            grad.addColorStop(0.55, 'rgba(150, 130, 230, 0.85)');
            grad.addColorStop(1, 'rgba(255, 150, 190, 0.95)');
        }

        var data = null;
        var avg = 0;
        if (analyser && isPlaying()) {
            analyser.getByteFrequencyData(freq);
            data = freq;
        }

        var bins = data ? data.length : 0;
        vizCtx.save();
        vizCtx.shadowBlur = 10;
        vizCtx.shadowColor = 'rgba(150, 170, 255, 0.55)';
        vizCtx.fillStyle = grad;
        for (var i = 0; i < n; i++) {
            var v = 0;
            if (data && bins) {
                /* 低频段信息更集中，用非线性取样让柱子分布更均匀 */
                var t = i / n;
                var idx = Math.floor(Math.pow(t, 1.6) * (bins * 0.72));
                if (idx >= bins) idx = bins - 1;
                v = data[idx] / 255;
                /* 相邻两格平均一下，避免单格抖动 */
                var i2 = idx + 1 < bins ? data[idx + 1] / 255 : v;
                v = (v + i2) / 2;
            }
            avg += v;
            var bh = Math.max(3, v * h * 0.92);
            var x = i * (bw + gap);
            var y = h - bh;
            var r = Math.min(bw / 2, 2);
            vizCtx.beginPath();
            if (vizCtx.roundRect) {
                vizCtx.roundRect(x, y, bw, bh, [r, r, 0, 0]);
            } else {
                vizCtx.rect(x, y, bw, bh);
            }
            vizCtx.fill();
        }
        vizCtx.restore();

        avg = n ? avg / n : 0;

        /* 顶部柔光带：随平均能量起伏，是"光感"的主要来源 */
        var glow = vizCtx.createLinearGradient(0, 0, 0, h);
        glow.addColorStop(0, 'rgba(255, 190, 220, ' + (0.05 + avg * 0.5).toFixed(3) + ')');
        glow.addColorStop(0.5, 'rgba(160, 190, 255, ' + (0.03 + avg * 0.28).toFixed(3) + ')');
        glow.addColorStop(1, 'rgba(120, 200, 210, 0)');
        vizCtx.fillStyle = glow;
        vizCtx.fillRect(0, 0, w, h);

        /* 底部一条亮线，跟着能量变亮 */
        vizCtx.fillStyle = 'rgba(255, 255, 255, ' + (0.10 + avg * 0.55).toFixed(3) + ')';
        vizCtx.fillRect(0, h - 1.5, w, 1.5);
    }

    /* ---------------- 图标 ---------------- */

    function playIcon() {
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }
    function pauseIcon() {
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
    }
    function prevIcon() {
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM20 6v12L9 12z"/></svg>';
    }
    function nextIcon() {
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM4 6v12l11-6z"/></svg>';
    }

    /* 唱片：标签与唱盘同心并印有 STAR。
       转动的可辨识度来自高光扇区、那道划痕和 STAR 这几个字 ——
       完全对称的同心圆转起来是看不出在转的。 */
    function discSVG() {
        return '<svg viewBox="0 0 120 120" class="vy-disc-svg" aria-hidden="true">' +
            '<defs>' +
            '<radialGradient id="vyDisc" cx="40%" cy="34%" r="72%">' +
            '<stop offset="0%" stop-color="#4a5060"/>' +
            '<stop offset="60%" stop-color="#22262f"/>' +
            '<stop offset="100%" stop-color="#101318"/>' +
            '</radialGradient>' +
            '<linearGradient id="vySheen" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>' +
            '<stop offset="45%" stop-color="rgba(255,255,255,0.02)"/>' +
            '<stop offset="100%" stop-color="rgba(255,255,255,0.10)"/>' +
            '</linearGradient>' +
            '</defs>' +
            '<circle cx="60" cy="60" r="57" fill="url(#vyDisc)"/>' +
            /* 不等间距的同心纹路 */
            '<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>' +
            '<circle cx="60" cy="60" r="47" fill="none" stroke="rgba(255,255,255,0.055)" stroke-width="1"/>' +
            '<circle cx="60" cy="60" r="41" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>' +
            '<circle cx="60" cy="60" r="34" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>' +
            '<circle cx="60" cy="60" r="28" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="1"/>' +
            /* 一道斜向高光扇区（不对称） */
            '<path d="M60 60 L60 8 A52 52 0 0 1 96 20 Z" fill="url(#vySheen)" opacity="0.5"/>' +
            /* 一道细划痕，偏在一侧 */
            '<path d="M28 84 Q52 74 78 88" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>' +
            /* 标签居中（与唱盘同心），上面印 STAR。
               标签居中后转动的可辨识度靠别处保留的不对称细节：
               右上的高光扇区、偏在一侧的划痕，以及 STAR 这几个字本身
               —— 文字转起来比同心圆明显得多。 */
            '<circle cx="60" cy="60" r="21" fill="#c94f7c"/>' +
            '<circle cx="60" cy="60" r="21" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>' +
            '<circle cx="60" cy="60" r="18.5" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.8"/>' +
            /* STAR 放在中心孔上方，避开中间的孔 */
            '<text x="60" y="47" text-anchor="middle" font-size="11" font-weight="700"' +
            ' letter-spacing="1.2" fill="#ffffff"' +
            ' font-family="Helvetica Neue, Helvetica, Arial, sans-serif">STAR</text>' +
            /* 中心孔（正中心，这样转起来轴心不晃） */
            '<circle cx="60" cy="60" r="4.2" fill="#0b0c10"/>' +
            '<circle cx="60" cy="60" r="4.2" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="0.8"/>' +
            '</svg>';
    }

    /* ---------------- 渲染 ---------------- */

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderTitle() {
        if (!titleEl) return;
        if (cur >= 0 && tracks[cur]) {
            titleEl.textContent = tracks[cur].name;
            titleEl.classList.remove('is-empty');
        } else {
            titleEl.textContent = '还没有音乐';
            titleEl.classList.add('is-empty');
        }
    }

    function renderList() {
        if (!listEl) { updateSaveState(); return; }
        if (!tracks.length) {
            listEl.innerHTML = '<div class="vy-empty">点下面的「导入音乐」添加音频文件</div>';
            updateSaveState();
            return;
        }
        var h = '';
        for (var i = 0; i < tracks.length; i++) {
            var on = (i === cur) ? ' is-on' : '';
            var st = (i === cur && isPlaying()) ? '<span class="vy-eq"><i></i><i></i><i></i></span>' : '';
            h += '<div class="vy-item' + on + '" data-i="' + i + '">' +
                '<span class="vy-item-n">' + (i + 1) + '</span>' +
                '<span class="vy-item-t">' + esc(tracks[i].name) + '</span>' + st +
                '<button type="button" class="vy-del" data-i="' + i + '" title="删除" ' +
                'aria-label="删除 ' + esc(tracks[i].name) + '">&times;</button>' +
                '</div>';
        }
        listEl.innerHTML = h;
        updateSaveState();
    }

    function syncModeUI() {
        if (!win) return;
        var bs = win.querySelectorAll('.vy-mode');
        for (var i = 0; i < bs.length; i++) {
            var m = bs[i].getAttribute('data-mode');
            if (m === cfg.mode) bs[i].classList.add('is-on');
            else bs[i].classList.remove('is-on');
        }
    }

    /* 弹窗内的音谱常驻：不再随开关塌陷（开关现在管的是"整个编辑器底部"）。 */
    function syncSpectrumUI() {
        if (!win) return;
        var c = win.querySelector('.vy-spec-cb');
        if (c) c.checked = !!cfg.spectrum;
        /* 全局底部音谱由 inject.js 提供；这里只负责把开关状态同步过去 */
        if (window.__blGlobalViz) window.__blGlobalViz.set(!!cfg.spectrum);
    }

    /* 在线音乐入口与逻辑已删除；八音盒只保留本地导入与播放控制。 */

    /* ---------------- 弹窗 ---------------- */

    function buildWin() {
        if (win) return win;
        var host = window.__blTopLayer ? window.__blTopLayer() : document.body;
        var w = document.createElement('div');
        /* 模式决定是否可拖动：固定弹窗（fixed）不可拖，弹窗（popup）可拖 */
        w.className = cfg.winMode === 'fixed'
            ? 'addon-window vy-win bl-win-nodrag'
            : 'addon-window vy-win vy-win-popup';
        w.innerHTML =
            '<div class="addon-window-header">' +
            '<span class="addon-window-title">八音盒</span>' +
            '<div class="addon-window-controls">' +
            '<button type="button" class="addon-window-btn addon-window-btn-minimize vy-min" title="最小化" aria-label="最小化">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<line x1="5" y1="12" x2="19" y2="12"/></svg></button>' +
            '<button type="button" class="addon-window-btn addon-window-btn-maximize vy-max" title="最大化" aria-label="最大化">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<rect x="5" y="5" width="14" height="14" rx="2"/></svg></button>' +
            '<button type="button" class="addon-window-btn addon-window-btn-close vy-close" title="关闭" aria-label="关闭">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>' +
            '</div></div>' +
            '<div class="addon-window-content vy-content">' +
            '<div class="vy-body">' +
            '<div class="vy-left">' +
            '<div class="vy-disc">' + discSVG() + '<div class="vy-disc-hole"></div></div>' +
            '</div>' +
            '<div class="vy-right">' +
            '<div class="vy-title is-empty">还没有音乐</div>' +
            '<div class="vy-list"></div>' +
            '<div class="vy-bar"><div class="vy-bar-fill"></div></div>' +
            '<div class="vy-time">0:00 / 0:00</div>' +
            '<div class="vy-ctrl">' +
            '<button type="button" class="vy-btn vy-prev" title="上一首" aria-label="上一首">' + prevIcon() + '</button>' +
            '<button type="button" class="vy-btn vy-play" title="播放 / 暂停" aria-label="播放或暂停">' +
            '<span class="vy-play-i">' + playIcon() + '</span></button>' +
            '<button type="button" class="vy-btn vy-next" title="下一首" aria-label="下一首">' + nextIcon() + '</button>' +
            '</div>' +
            '<div class="vy-modes">' +
            '<button type="button" class="vy-mode" data-mode="order">顺序</button>' +
            '<button type="button" class="vy-mode" data-mode="loop">循环</button>' +
            '<button type="button" class="vy-mode" data-mode="shuffle">随机</button>' +
            '</div>' +
            '<div class="vy-row">' +
            '<label class="vy-row-l" for="vy-vol">音量</label>' +
            '<input id="vy-vol" class="vy-range" type="range" min="0" max="100" step="1">' +
            '<span class="vy-row-v" data-for="volume">70</span>' +
            '</div>' +
            '<div class="vy-row vy-spec-row">' +
            '<label class="vy-row-l" for="vy-spec">底部音谱</label>' +
            '<input id="vy-spec" class="vy-spec-cb" type="checkbox">' +
            '</div>' +
            '<div class="vy-actions">' +
            '<button type="button" class="vy-import">导入音乐</button>' +
            '</div>' +
            '<div class="vy-save-state"></div>' +
            '</div>' +
                        '</div>' +
            '<canvas class="vy-viz"></canvas>' +
            '</div>';

        host.appendChild(w);
        win = w;
        bodyEl = w.querySelector('.vy-body');
        titleEl = w.querySelector('.vy-title');
        listEl = w.querySelector('.vy-list');
        timeEl = w.querySelector('.vy-time');
        fillEl = w.querySelector('.vy-bar-fill');
        discEl = w.querySelector('.vy-disc');
        vizEl = w.querySelector('.vy-viz');
        try { vizCtx = vizEl.getContext('2d'); } catch (e) { vizCtx = null; }

        sizeViz();
        bindWin(w);
        renderList();
        renderTitle();
        syncModeUI();
        syncSpectrumUI();
        syncSliders();
        updateSaveState();
        return w;
    }

    /* canvas 的位图尺寸与 CSS 尺寸是两回事：
       不乘 devicePixelRatio 会糊，乘了又必须把绘图坐标系换回 CSS 像素，
       否则所有按 w/h 算的布局都会超出画布。 */
    function sizeViz() {
        if (!vizEl || !vizCtx) return;
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var w = vizEl.clientWidth || 400;
        var h = vizEl.clientHeight || 64;
        vizEl.width = Math.max(1, Math.round(w * dpr));
        vizEl.height = Math.max(1, Math.round(h * dpr));
        vizCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        /* 记录逻辑尺寸，绘图时按它算，不要用位图尺寸 */
        vizW = w; vizH = h;
    }

    function syncSliders() {
        if (!win) return;
        var v = win.querySelector('#vy-vol');
        if (v) v.value = String(cfg.volume);
        var lv = win.querySelector('[data-for="volume"]');
        if (lv) lv.textContent = String(cfg.volume);
    }

    function bindWin(w) {
        if (w.__vyBound) return;
        w.__vyBound = true;
        w.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            if (t.closest('.vy-close')) { close(); return; }
            if (t.closest('.vy-min')) { minimizeWin(); return; }
            if (t.closest('.vy-max')) { toggleMaxWin(); return; }
            if (t.closest('.vy-import')) { pickFiles(); return; }
            if (t.closest('.vy-play')) { togglePlay(); return; }
            if (t.closest('.vy-prev')) { step(-1); return; }
            if (t.closest('.vy-next')) { step(1); return; }
            /* 恢复失败时状态栏就是重试按钮 */
            if (t.closest('.vy-save-state.is-retry')) { retryRestore(); return; }
            var dl = t.closest('.vy-del');
            if (dl) {
                var di = parseInt(dl.getAttribute('data-i'), 10);
                if (!isNaN(di)) removeAt(di);
                return;
            }
            var md = t.closest('.vy-mode');
            if (md) {
                cfg.mode = md.getAttribute('data-mode') || 'loop';
                saveCfg(); syncModeUI(); return;
            }
            var it = t.closest('.vy-item');
            if (it) {
                var i = parseInt(it.getAttribute('data-i'), 10);
                if (!isNaN(i)) playAt(i);
                return;
            }
        });
        /* 右键曲目也能删：删除入口不只靠那颗小 ×，长曲名 / 触屏都好找 */
        w.addEventListener('contextmenu', function (e) {
            var it = e.target && e.target.closest ? e.target.closest('.vy-item') : null;
            if (!it) return;
            e.preventDefault();
            var ri = parseInt(it.getAttribute('data-i'), 10);
            if (!isNaN(ri)) removeAt(ri);
        });

        var bar = w.querySelector('.vy-bar');
        if (bar) {
            bar.addEventListener('pointerdown', function (e) {
                seeking = true;
                previewAt(e.clientX);
                var mv = function (ev) { previewAt(ev.clientX); };
                var up = function () {
                    /* 松手确认 —— 此时才真正跳转 */
                    commitSeek();
                    seeking = false;
                    syncProgress();
                    window.removeEventListener('pointermove', mv, true);
                    window.removeEventListener('pointerup', up, true);
                };
                window.addEventListener('pointermove', mv, true);
                window.addEventListener('pointerup', up, true);
                e.preventDefault();
            });
        }

        var rev = w.querySelector('#vy-rev');
        if (rev) rev.addEventListener('input', function () {
            cfg.reverb = parseInt(rev.value, 10) || 0;
            applyReverb(); saveCfg(); syncSliders();
        });
        var vol = w.querySelector('#vy-vol');
        if (vol) vol.addEventListener('input', function () {
            cfg.volume = parseInt(vol.value, 10) || 0;
            applyVolume(); saveCfg(); syncSliders();
        });
        var sp = w.querySelector('.vy-spec-cb');
        if (sp) sp.addEventListener('change', function () {
            cfg.spectrum = !!sp.checked;
            saveCfg(); syncSpectrumUI();
        });

        window.addEventListener('resize', function () {
            if (!win) return;
            sizeViz();
        });

        /* 与音乐界面同一个道理：频谱画布若在窗口还隐藏时被测量，
           拿到的就是 0（代码里退成 400×64），之后没有 window resize
           就再也不会纠正 —— 只有"打开一次书包"这类布局变化才碰巧修好。
           现在直接观察画布自身尺寸，一有尺寸或尺寸变了就重新测量。 */
        try {
            if (window.ResizeObserver && vizEl) {
                var ro = new window.ResizeObserver(function () {
                    if (!vizEl) return;
                    if (!vizEl.clientWidth || !vizEl.clientHeight) return;
                    sizeViz();
                });
                ro.observe(vizEl);
            }
        } catch (e) { /* ignore */ }
    }

    /* ---------------- 对外接口 ----------------
       全局底部音谱（inject.js）需要同一份频域数据，
       共用这一个 AnalyserNode 即可，不必再建一条分析链。 */
    window.__blVinylAnalyser = function () {
        return analyser || null;
    };
    window.__blVinylAudio = function () {
        return audioEl || null;
    };

    /* ---------------- 开 / 关 ---------------- */

    /* 关闭动画是 fill:forwards，会在元素上留下 opacity:0。
       重新打开前必须把动画和内联样式一起清干净，否则窗口会
       "出现一下又消失" —— 动画播完就退回那个残留的 0。 */
    function resetWinStyle(w) {
        try {
            if (w.getAnimations) {
                var as = w.getAnimations();
                for (var i = 0; i < as.length; i++) as[i].cancel();
            }
        } catch (e) { /* ignore */ }
        w.style.opacity = '';
        w.style.transform = '';
    }

    function open() {
        buildWin();
        syncWinChrome();
        resetWinStyle(win);
        /* 弹窗模式：首次打开时给一个初始位置（可拖动）；固定模式走 CSS 右下角 */
        if (cfg.winMode !== 'fixed' && !win.__blPosSet) {
            win.__blPosSet = true;
            win.style.left = Math.max(80, Math.round((window.innerWidth - 720) / 2)) + 'px';
            win.style.top = '80px';
        }
        win.style.display = '';
        /* 与其它弹窗共用同一套出现动画（见 inject.js 的 popIn） */
        if (window.__blPop && window.__blPop.in) window.__blPop.in(win);
        else { win.style.opacity = '1'; }
        startViz();
        syncSpectrumUI();
        /* 启动期恢复可能还没跑完（IDB 慢 / 被阻塞）。窗口一打开就把最新
           状态刷出来，并补一次不重复的恢复；不让用户看到空列表干等。 */
        updateSaveState();
        if (restorePending.length && !restoreBusy) retryRestore();
    }

    /* 最小化：藏起窗口但不停播放；再点 DOCK 里的八音盒（toggle）即可恢复。
       走 toggle 而不是 close，是因为 close 会停掉可视化与播放状态同步。 */
    function minimizeWin() {
        if (!win) return;
        stopViz();
        win.style.display = 'none';
    }

    function toggleMaxWin() {
        if (!win) return;
        if (win.classList.contains('is-max')) {
            win.classList.remove('is-max');
            var r = win.__blMaxRestore || {};
            win.style.width = r.width || '';
            win.style.height = r.height || '';
            win.style.left = r.left || '';
            win.style.top = r.top || '';
            win.style.maxWidth = r.maxWidth || '';
        } else {
            win.__blMaxRestore = {
                width: win.style.width, height: win.style.height,
                left: win.style.left, top: win.style.top,
                maxWidth: win.style.maxWidth
            };
            win.classList.add('is-max');
            win.style.setProperty('left', '0px', 'important');
            win.style.setProperty('top', '0px', 'important');
            win.style.setProperty('width', '100vw', 'important');
            win.style.setProperty('height', '100vh', 'important');
            win.style.setProperty('max-width', 'none', 'important');
        }
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    }

    /* 设置页切换「弹窗（可拖动） / 固定弹窗」时，已打开的窗口也要跟着变：
       旧代码只改 cfg.winMode，窗口 className 和位置一直停在首次构建的状态。 */
    function syncWinChrome() {
        if (!win) return;
        var popup = cfg.winMode !== 'fixed';
        win.classList.toggle('bl-win-nodrag', !popup);
        win.classList.toggle('vy-win-popup', popup);
        if (popup) {
            if (!win.__blPosSet) {
                win.__blPosSet = true;
                win.style.left = Math.max(80, Math.round((window.innerWidth - 720) / 2)) + 'px';
                win.style.top = '80px';
            }
            win.style.right = '';
            win.style.bottom = '';
        } else {
            win.classList.remove('is-max');
            win.style.left = ''; win.style.top = '';
            win.style.width = ''; win.style.height = '';
            win.style.maxWidth = '';
        }
    }

    function close() {
        if (!win) return;
        stopViz();
        var w = win;
        var done = function () {
            if (w && w.parentNode) w.style.display = 'none';
            /* 顺手把残留清掉，下次打开不必只依赖"打开时清理"这一条路径 */
            resetWinStyle(w);
        };
        if (window.__blPop && window.__blPop.out) window.__blPop.out(w, done);
        else done();
    }

    function toggle() {
        if (win && win.parentNode && win.style.display !== 'none') close();
        else open();
    }

    function isOpen() {
        return !!(win && win.parentNode && win.style.display !== 'none');
    }

    /* ---------------- 启动 ---------------- */

    loadCfg();
    syncMusicboxSettings();
    restoreTracks();

    /* 监听「八音盒」设置变化（同页轮询 + 跨页 storage） */
    setInterval(syncMusicboxSettings, 800);
    try {
        window.addEventListener('storage', function (e) {
            if (e && e.key === 'bl:musicbox') syncMusicboxSettings();
        });
    } catch (e) { /* ignore */ }

    window.__blVinyl = {
        open: open,
        close: close,
        toggle: toggle,
        isOpen: isOpen,
        /* 全局底部音谱靠这个判断"该不该醒"：
           它自己不问播放状态就只能靠静默计数猜，安静段落会误判成停止。 */
        isPlaying: isPlaying,
        tracks: function () {
            return tracks.map(function (t) {
                return { id: t.id, name: t.name, url: t.url, saved: t.saved, pending: t.pending };
            });
        },
        removeAt: removeAt,
        retryRestore: retryRestore,
        status: function () {
            return {
                tracks: tracks.length,
                saved: tracks.filter(function (t) { return !!t.saved; }).length,
                pendingRestore: restorePending.length,
                busy: restoreBusy
            };
        }
    };
})();

