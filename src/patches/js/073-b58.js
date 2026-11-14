/* ── [B58] __blProjectMeta 作品存储 ───────────────────────────────────────────────
   依赖：IndexedDB / VM
   维护：元信息弹窗、IDB 批量预取、loadSb3、加载失败恢复
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * __blProjectMeta —— 项目面板共用：元信息弹窗 + 作品文件存储 + 加载
 * --------------------------------------------------------------------------
 * 修复「保存后加载失败 / 切换后台加载失败」：
 *   · saveProjectSb3() 返回 Promise<ArrayBuffer>，旧代码同步当成 ArrayBuffer，
 *     存进去的是空数据 → 加载必然失败。
 *   · loadProject() 返回值统一用 Promise 包装，同步异常也能进 catch。
 *   · sb3 的 base64 塞 localStorage 极易超 5MB 被静默吞掉；现在文件进
 *     IndexedDB，localStorage 只留很小的元数据（名称/版本/封面/时间/大小）。
 *   · 兼容旧数据：IndexedDB 里找不到时回退读旧记录的 data 字段。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blProjectMeta) return;

    var DB_NAME = 'bl-project-files-v1';
    var OS = 'files';

    function vm() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            return (st && st.scratchGui && st.scratchGui.vm) || null;
        } catch (e) { return null; }
    }
    function projectName() {
        try {
            var v = vm();
            if (v && v.runtime) {
                var st = v.runtime.getTargetForStage && v.runtime.getTargetForStage();
                var nm = st && st.getName && st.getName();
                if (nm) return nm;
            }
        } catch (e) { /* ignore */ }
        return '未命名项目';
    }
    function captureThumb() {
        try {
            var v = vm();
            var cv = v && v.renderer && v.renderer.canvas;
            if (!cv || !cv.width) return '';
            var c2 = document.createElement('canvas');
            var tw = 160, th = Math.max(1, Math.round(160 * cv.height / cv.width));
            c2.width = tw; c2.height = th;
            c2.getContext('2d').drawImage(cv, 0, 0, tw, th);
            return c2.toDataURL('image/png');
        } catch (e) { return ''; }
    }

    /* ---- IndexedDB：作品文件（sb3 二进制） ---- */
    /* ---- 作品字节内存 LRU ----
       刚保存 / 刚读过的作品直接复用，省掉一次 IndexedDB get 往返。
       上限 8 项 / 32MB，避免大作品把内存吃满。 */
    var fileCache = new Map(), cacheBytes = 0;
    /* 项目列表常有 10~20 个作品；真正的约束是 32MB 字节上限，
       项数放宽到 24，避免批量预取刚灌完就被 LRU 淘汰掉尾部。 */
    var CACHE_MAX_ITEMS = 24, CACHE_MAX_BYTES = 32 * 1024 * 1024;
    function cachePut(id, bytes) {
        if (!bytes || !bytes.length) return;
        if (fileCache.has(id)) { cacheBytes -= fileCache.get(id).length; fileCache.delete(id); }
        fileCache.set(id, bytes); cacheBytes += bytes.length;
        while (fileCache.size > CACHE_MAX_ITEMS || cacheBytes > CACHE_MAX_BYTES) {
            var k = fileCache.keys().next().value;
            if (k === undefined) break;
            cacheBytes -= fileCache.get(k).length;
            fileCache.delete(k);
        }
    }
    function cacheDrop(id) {
        if (fileCache.has(id)) { cacheBytes -= fileCache.get(id).length; fileCache.delete(id); }
    }
    function idle(fn) {
        if (window.requestIdleCallback) {
            try { window.requestIdleCallback(fn, { timeout: 2000 }); return; } catch (e) {}
        }
        window.setTimeout(fn, 0);
    }
    /* 项目面板打开时，在空闲期把列表里的作品预取进内存；
       用户点「加载」时通常已经读完，零 IDB 往返。 */
    function prefetch(ids) {
        if (!ids || !ids.length) return Promise.resolve();
        var budget = 24 * 1024 * 1024;
        /* 先挑出未缓存的，避免重复读 */
        var todo = [];
        for (var i = 0; i < ids.length && cacheBytes <= budget; i++) {
            if (!fileCache.has(ids[i])) todo.push(ids[i]);
        }
        if (!todo.length) return Promise.resolve();
        return new Promise(function (done) {
          idle(function () {
            db().then(function (d) {
                return new Promise(function (res) {
                    /* 单个 readonly 事务批量 get：N 个作品只开 1 次事务，
                       比旧版 N 个 idle 回调 + N 次事务快一个数量级。 */
                    var tx = d.transaction(OS, 'readonly');
                    var store = tx.objectStore(OS), got = [];
                    for (var k = 0; k < todo.length; k++) {
                        (function (id) {
                            var rq = store.get(id);
                            rq.onsuccess = function () {
                                var v = rq.result;
                                var out = v ? (v instanceof Uint8Array ? v : new Uint8Array(v)) : null;
                                if (out) got.push([id, out]);
                            };
                        })(todo[k]);
                    }
                    tx.oncomplete = function () {
                        for (var q = 0; q < got.length && cacheBytes <= budget; q++) {
                            cachePut(got[q][0], got[q][1]);
                        }
                        res();
                    };
                    tx.onerror = function () { res(); };
                    tx.onabort = function () { res(); };
                });
            }).then(done, function () {
                /* IndexedDB 不可用时退回原来的串行 localStorage 兜底 */
                var n = 0;
                function step() {
                    if (n >= todo.length || cacheBytes > budget) { done(); return; }
                    getFile(todo[n++]).then(function () { idle(step); }, function () { idle(step); });
                }
                idle(step);
            });
          });
        });
    }

    /* 连接缓存：旧版每次 getFile/putFile 都 indexedDB.open 一遍，
       大作品加载时白白多一次开库往返。失败时清缓存，下次可重试。 */
    var dbPromise = null;
    function db() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(function (res, rej) {
            if (!window.indexedDB) { dbPromise = null; rej(new Error('IndexedDB 不可用')); return; }
            var req;
            try { req = indexedDB.open(DB_NAME, 1); }
            catch (e) { dbPromise = null; rej(e); return; }
            req.onupgradeneeded = function () {
                var d = req.result;
                if (!d.objectStoreNames.contains(OS)) d.createObjectStore(OS);
            };
            req.onsuccess = function () { res(req.result); };
            req.onerror = function () { dbPromise = null; rej(req.error || new Error('打开作品库失败')); };
            req.onblocked = function () { dbPromise = null; };
        });
        return dbPromise;
    }
    function toB64(bytes) {
        var CH = 0x8000, parts = [];
        for (var i = 0; i < bytes.length; i += CH) {
            parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CH)));
        }
        return btoa(parts.join(''));
    }
    function fromB64(b64) {
        var bin = atob(b64), out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }
    function putFile(id, bytes) {
        var arr = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
        /* 存一份精确长度的拷贝，避免 Uint8Array 带 byteOffset */
        /* slice() 是原生精确长度拷贝，比 new + set 少一次 JS 层遍历 */
        var copy = arr.slice ? arr.slice() : new Uint8Array(arr);
        return db().then(function (d) {
            return new Promise(function (res, rej) {
                var tx = d.transaction(OS, 'readwrite');
                tx.objectStore(OS).put(copy, id);
                tx.oncomplete = function () { cachePut(id, copy); res(); };
                tx.onerror = function () { rej(tx.error || new Error('写入失败')); };
                tx.onabort = function () { rej(tx.error || new Error('写入被中止')); };
            });
        }).catch(function () {
            /* 兜底：某些 file:// 环境禁用了 IndexedDB */
            try {
                window.localStorage.setItem('bl:file:' + id, toB64(copy));
                cachePut(id, copy);
                return;
            } catch (e) {
                throw new Error('作品过大且本地存储不可用，无法保存');
            }
        });
    }
    function getFile(id) {
        if (fileCache.has(id)) return Promise.resolve(fileCache.get(id));
        return db().then(function (d) {
            return new Promise(function (res, rej) {
                var tx = d.transaction(OS, 'readonly');
                var rq = tx.objectStore(OS).get(id);
                rq.onsuccess = function () {
                    var v = rq.result;
                    /* IDB 结构化克隆已经返回独立副本，不再 new Uint8Array(v) 全量拷贝。
                       8MB 作品可省一次 8MB 内存复制。 */
                    var out = v ? (v instanceof Uint8Array ? v : new Uint8Array(v)) : null;
                    if (out) cachePut(id, out);
                    res(out);
                };
                rq.onerror = function () { rej(rq.error); };
            });
        }).catch(function () {
            try {
                var raw = window.localStorage.getItem('bl:file:' + id);
                var out = raw ? fromB64(raw) : null;
                if (out) cachePut(id, out);
                return out;
            } catch (e) { return null; }
        });
    }
    function delFile(id) {
        cacheDrop(id);
        return db().then(function (d) {
            return new Promise(function (res) {
                var tx = d.transaction(OS, 'readwrite');
                tx.objectStore(OS).delete(id);
                tx.oncomplete = function () { res(); };
                tx.onerror = function () { res(); };
            });
        }).catch(function () {
            try { window.localStorage.removeItem('bl:file:' + id); } catch (e) { /* ignore */ }
        }).then(function () {
            try { window.localStorage.removeItem('bl:file:' + id); } catch (e) { /* ignore */ }
        });
    }

    /* ---- sb3 保存 / 加载：统一 Promise ---- */
    function captureSb3() {
        var v = vm();
        if (!v) return Promise.reject(new Error('编辑器尚未就绪'));
        return Promise.resolve().then(function () {
            return v.saveProjectSb3('arraybuffer');
        }).then(function (buf) {
            if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
            if (buf && buf.buffer) {
                /* 已经占满整个 buffer 时直接复用，避免再切一次全量拷贝 */
                return (buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength)
                    ? new Uint8Array(buf.buffer)
                    : new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
            }
            if (buf instanceof Uint8Array) return buf;
            if (typeof buf === 'string') {
                var s = unescape(encodeURIComponent(buf)), a = new Uint8Array(s.length);
                for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
                return a;
            }
            throw new Error('无法识别的作品数据格式');
        });
    }
    function loadSb3(bytes) {
        var v = vm();
        if (!v) return Promise.reject(new Error('编辑器尚未就绪'));
        var arr = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
        if (!arr.length) return Promise.reject(new Error('作品数据为空，可能保存时出错了'));
        var buf = (arr.byteOffset === 0 && arr.byteLength === arr.buffer.byteLength)
            ? arr.buffer                      /* 省掉一次整包 slice */
            : (arr.buffer.slice
                ? arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)
                : arr.buffer);
        /* 加载作品会触发成片 DOM 重绘；这段时间冻结后台全文档扫描，
           加载完再统一校准一次，避免几万次重复 querySelectorAll 抢主线程。 */
        var perf = window.__blPerf;
        if (perf && perf.hold) perf.hold();
        /* 加载期同时挂起主题模块的全量补色：几千块积木不再被反复重排，
           加载完统一补一次即可。 */
        window.__blProjectLoading = true;
        var done = function () {
            window.__blProjectLoading = false;
            window.__blProjectLoadDoneAt = Date.now();
            if (perf && perf.release) perf.release();
            var repaint = window.__blThemeRepaintNow;
            if (!repaint) return;
            var run = function () { try { repaint(true); } catch (e0) { /* ignore */ } };
            /* 下一帧再补：等 VM 把角色与积木的 DOM 全部落定 */
            if (window.requestAnimationFrame) window.requestAnimationFrame(run);
            else window.setTimeout(run, 0);
        };
        return Promise.resolve().then(function () {
            return v.loadProject(buf);          /* 可能是 Promise，也可能不是 */
        }).then(function (r) { done(); return r; }, function (e) { done(); throw e; });
    }
    function loadSnapshot(item) {
        return getFile(item.id).then(function (bytes) {
            if (!bytes && item.data) {           /* 兼容旧版 base64 记录 */
                try { bytes = fromB64(item.data); cachePut(item.id, bytes); } catch (e) { bytes = null; }
            }
            if (!bytes || !bytes.length) {
                throw new Error('作品数据缺失或已损坏，请重新保存一次');
            }
            return loadSb3(bytes);
        });
    }

    /* ---- 列表读写（localStorage 只存元数据） ---- */
    function readStore(store) {
        try { var a = JSON.parse(localStorage.getItem(store) || '[]'); return Array.isArray(a) ? a : []; }
        catch (e) { return []; }
    }
    function writeStore(store, a) {
        try { localStorage.setItem(store, JSON.stringify(a)); } catch (e) { /* ignore */ }
    }

    function autoSnapshot(store, name) {
        return captureSb3().then(function (bytes) {
            var cover = captureThumb();
            var meta = {
                id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                name: name || projectName(), version: '自动快照', time: Date.now(),
                size: bytes.length, cover: cover, thumb: cover
            };
            return putFile(meta.id, bytes).then(function () {
                var a = readStore(store);
                a.unshift(meta);
                if (a.length > 20) a = a.slice(0, 20);
                writeStore(store, a);
                return meta;
            });
        });
    }

    /* ---- 元信息弹窗：名称 / 版本 / 封面（可不设） ---- */
    function open(opts) {
        opts = opts || {};
        var store = opts.store || 'bl:projects';
        var defName = opts.defaultName || projectName();
        var cover = (opts.cover === undefined) ? captureThumb() : (opts.cover || '');

        return new Promise(function (resolve) {
            var mask = document.createElement('div');
            mask.className = 'bl-meta-mask';
            mask.innerHTML =
                '<div class="bl-meta-dlg" role="dialog" aria-modal="true">' +
                    '<h3>' + escHtml(opts.title || '保存作品') + '</h3>' +
                    '<p class="bl-meta-sub">填写作品信息，封面可以不设置；确认后保存到当前列表。</p>' +
                    '<div class="bl-meta-field"><label for="bl-meta-name">名称</label>' +
                        '<input type="text" id="bl-meta-name" maxlength="60" value="' + escAttr(defName) + '"></div>' +
                    '<div class="bl-meta-field"><label for="bl-meta-ver">版本</label>' +
                        '<input type="text" id="bl-meta-ver" maxlength="30" value="1.0" placeholder="例如 1.0 / beta2">' +
                        '<div class="bl-meta-hint">可留空</div></div>' +
                    '<div class="bl-meta-field"><label>封面（可不设置）</label>' +
                        '<div class="bl-meta-cover">' +
                            '<div class="bl-meta-preview" id="bl-meta-prev"></div>' +
                            '<div class="bl-meta-cover-btns">' +
                                '<button type="button" class="bl-meta-btn" data-act="stage">使用舞台截图</button>' +
                                '<label class="bl-meta-btn" style="text-align:left;display:block;cursor:pointer">上传图片…' +
                                    '<input type="file" accept="image/*" id="bl-meta-file" style="display:none"></label>' +
                                '<button type="button" class="bl-meta-btn" data-act="none">不设置封面</button>' +
                            '</div>' +
                        '</div></div>' +
                    '<div class="bl-meta-foot">' +
                        '<button type="button" class="bl-meta-cancel" data-act="cancel">取消</button>' +
                        '<button type="button" class="bl-meta-ok" data-act="ok">确认保存</button>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(mask);

            var prev = mask.querySelector('#bl-meta-prev');
            function renderCover() {
                if (!cover) {
                    prev.innerHTML = '<span>不设置封面</span>';
                } else {
                    prev.innerHTML = '<img src="' + escAttr(cover) + '" alt="封面预览">';
                }
            }
            renderCover();

            function close(val) {
                if (mask.parentNode) mask.parentNode.removeChild(mask);
                document.removeEventListener('keydown', onKey, true);
                resolve(val);
            }
            function onKey(e) { if (e.key === 'Escape') close(null); }

            mask.addEventListener('click', function (e) {
                var t = e.target;
                if (!t) return;
                if (t === mask) { close(null); return; }
                var act = t.getAttribute && t.getAttribute('data-act');
                if (!act && t.closest) {
                    var b = t.closest('[data-act]');
                    act = b ? b.getAttribute('data-act') : null;
                }
                if (act === 'cancel') { close(null); return; }
                if (act === 'stage') { cover = captureThumb(); renderCover(); return; }
                if (act === 'none') { cover = ''; renderCover(); return; }
                if (act === 'ok') {
                    var name = (mask.querySelector('#bl-meta-name').value || '').trim() || projectName();
                    var ver = (mask.querySelector('#bl-meta-ver').value || '').trim();
                    close({
                        id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                        name: name,
                        version: ver || '未标注',
                        cover: cover,
                        thumb: cover,
                        time: Date.now(),
                        size: 0,
                        store: store
                    });
                }
            });
            var fileInput = mask.querySelector('#bl-meta-file');
            fileInput.addEventListener('change', function () {
                var f = fileInput.files && fileInput.files[0];
                if (!f) return;
                var r = new FileReader();
                r.onload = function () {
                    /* 压一下尺寸，封面存进 localStorage 才不会占太多空间 */
                    var img = new Image();
                    img.onload = function () {
                        try {
                            var c = document.createElement('canvas');
                            var w = 160, h = Math.max(1, Math.round(160 * img.height / img.width));
                            c.width = w; c.height = h;
                            c.getContext('2d').drawImage(img, 0, 0, w, h);
                            cover = c.toDataURL('image/jpeg', 0.72);
                        } catch (e) { cover = String(r.result); }
                        renderCover();
                    };
                    img.onerror = function () { cover = String(r.result); renderCover(); };
                    img.src = String(r.result);
                };
                r.readAsDataURL(f);
            });
            document.addEventListener('keydown', onKey, true);
            try { mask.querySelector('#bl-meta-name').focus(); } catch (e) { /* ignore */ }
        });
    }

    function escHtml(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    function escAttr(v) {
        return escHtml(v).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ---- 列表视觉增强：版本徽标 + 后台封面 ---- */
    function enhanceLists() {
        try {
            var ps = readStore('bl:projects');
            var cards = document.querySelectorAll('.bl-proj-card');
            for (var i = 0; i < cards.length; i++) {
                var item = ps[i];
                if (!item) continue;
                var nm = cards[i].querySelector('.bl-proj-name');
                if (nm && item.version && !nm.querySelector('.bl-ver-chip')) {
                    var chip = document.createElement('span');
                    chip.className = 'bl-ver-chip';
                    chip.textContent = item.version;
                    nm.appendChild(chip);
                }
            }
        } catch (e) { /* ignore */ }
    }

    /* 面板切分类会重建列表 DOM，观察 + 低频兜底补挂 */
    var enhTimer = null;
    function scheduleEnhance() {
        if (enhTimer) return;
        enhTimer = window.setTimeout(function () {
            enhTimer = null;
            enhanceLists();
        }, 80);
    }
    try {
        new MutationObserver(scheduleEnhance).observe(document.body || document.documentElement,
            { childList: true, subtree: true });
    } catch (e) { /* ignore */ }
    window.setInterval(enhanceLists, 1200);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enhanceLists);
    } else {
        enhanceLists();
    }

    window.__blProjectMeta = {
        open: open,
        captureSb3: captureSb3,
        loadSb3: loadSb3,
        loadSnapshot: loadSnapshot,
        putFile: putFile,
        getFile: getFile,
        delFile: delFile,
        prefetch: prefetch,
        autoSnapshot: autoSnapshot,
        enhanceLists: enhanceLists,
        captureThumb: captureThumb,
        projectName: projectName
    };
})();
