

/* ==========================================================================
   音乐工坊 (Music Studio) —— StartEditor
   --------------------------------------------------------------------------
   左侧导航栏多一个「音乐」标签，点它把工作区换成多轨 DAW：

     轨道头（音量 / 静音 / 独奏）+ 主声轨
     时间轴标尺（按 BPM 分小节）+ 可拖动、可裁剪的音频片段块
     播放指针随播放推进，点标尺可跳转
     混音后导出成角色（带这个声音）或下载 WAV

   混音走 OfflineAudioContext：参数变了才重渲，结果按签名缓存。
   播放和导出用的是同一份渲染结果，所以"听到的"和"导出的"必然一致。
   ========================================================================== */
(function () {
    'use strict';

    var panel = null, hostEl = null, tabEl = null;

    /* ---------------- 工程数据 ---------------- */

    var tracks = [];        /* {id,name,vol,mute,solo,kind,inst,rev} */
    var clips = [];         /* {id,tid,start,off,dur,buf|notes,name,gain,fin,fout,peaks,peakW} */
    var masterVol = 100;
    var bpm = 120;
    var projName = '我的音乐';
    var selId = null;

    var pxPerSec = 64;      /* 时间轴缩放：每秒多少像素 */
    var snap = true;
    var nextTid = 1, nextCid = 1;

    /* 钢琴卷帘：编辑某个乐轨(notes 片段)的窗口状态 */
    var pr = null;
    var prPx = 110;         /* 钢琴卷帘内部横向缩放：每秒多少像素 */
    var prStep = 4;         /* 吸附分母：4 = 1/4 拍 */
    var prVel = 100;        /* 新音符力度 */
    var prAudition = true;  /* 创建音符时试听 */
    var prRowH = 14;        /* 每个半音的行高 */
    var synCap = 8;         /* 每个音最多用几条谐波：音符多时自动降低，避免渲染几十秒 */
    var PR_LO = 36, PR_HI = 72;   /* 默认显示范围：C2 .. C5 */
    var prLo = PR_LO, prHi = PR_HI;   /* 当前片段的实际范围，打开时按音符自适应 */

    var playing = false;
    var ac = null, srcNode = null, playCtxAt = 0, playOffset = 0, raf = 0;
    var rendered = null, rendKey = '', rendering = false;
    var pendMix = [];       /* 渲染中收到的请求排在这里，渲完统一回调 */

    var drag = null;        /* 拖动状态 */
    var lastPd = null;      /* 上一次泳道按下的位置，用来自己判双击 */
    var lastPr = null;      /* 钢琴卷帘里上一次按下的位置（双击删音符用） */
    var tlEl = null, headsEl = null, rulerEl = null, rulerCx = null;
    var lanesEl = null, headListEl = null, playheadEl = null;
    var waveKey = '';

    var MUSIC_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>' +
        '</svg>';

    var LANE_H = 82;
    var RULER_H = 30;
    var HEAD_W = 206;

    /* ---------------- 小工具 ---------------- */

    function $(s, r) { return (r || document).querySelector(s); }
    function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function fmtT(t) {
        if (!isFinite(t) || t < 0) t = 0;
        var m = Math.floor(t / 60), s = t - m * 60;
        return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
    }
    /* 播放位置按「小节:拍.毫秒」显示，和常见 DAW 一致，例如 2:3.392 */
    function fmtPos(t) {
        if (!isFinite(t) || t < 0) t = 0;
        var bs = beatSec(), brs = barSec();
        var nb = Math.floor(t / brs);
        var inBar = t - nb * brs;
        var nbeat = Math.floor(inBar / bs);
        var ms = Math.floor((inBar - nbeat * bs) * 1000);
        var v = String(ms);
        while (v.length < 3) v = '0' + v;
        return (nb + 1) + ':' + (nbeat + 1) + '.' + v;
    }
    function fmtSize(n) {
        n = Number(n) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(2) + ' MB';
    }
    function status(msg, bad) {
        var el = $('.ms-info', panel);
        if (!el) return;
        el.textContent = msg;
        el.classList.toggle('is-bad', !!bad);
    }
    function beatSec() { return 60 / clamp(bpm, 20, 400); }
    function barSec() { return beatSec() * 4; }

    function trackById(id) {
        for (var i = 0; i < tracks.length; i++) if (tracks[i].id === id) return tracks[i];
        return null;
    }
    function clipById(id) {
        for (var i = 0; i < clips.length; i++) if (clips[i].id === id) return clips[i];
        return null;
    }

    function projectDur() {
        var d = 0, i;
        for (i = 0; i < clips.length; i++) {
            var e = clips[i].start + clips[i].dur;
            if (e > d) d = e;
        }
        return d;
    }

    function contentW() {
        var tlW = tlEl ? tlEl.clientWidth : 600;
        return Math.max(tlW, projectDur() * pxPerSec + pxPerSec * 8);
    }

    /* ---------------- 音频上下文 ---------------- */

    function liveCtx() {
        if (!ac) {
            var C = window.AudioContext || window.webkitAudioContext;
            if (!C) return null;
            try { ac = new C(); } catch (e) { return null; }
        }
        if (ac.state === 'suspended' && ac.resume) {
            try { ac.resume(); } catch (e) { /* ignore */ }
        }
        return ac;
    }

    /* ---------------- 混音渲染 ---------------- */

    function mixKey() {
        var parts = [masterVol, bpm, 'v'];
        var i;
        for (i = 0; i < tracks.length; i++) {
            var t = tracks[i];
            parts.push('t' + t.id + ':' + t.vol + ':' + (t.mute ? 1 : 0) + ':' + (t.solo ? 1 : 0) +
                       ':' + (t.rev || 0) + ':' + (t.kind === 'inst' ? t.inst : 'a'));
        }
        for (i = 0; i < clips.length; i++) {
            var c = clips[i];
            var nk = '';
            if (c.notes) {
                var k2;
                for (k2 = 0; k2 < c.notes.length; k2++) {
                    var nn = c.notes[k2];
                    nk += nn.p + ',' + nn.t.toFixed(3) + ',' + nn.d.toFixed(3) + ',' + (nn.v || 100) + ';';
                }
            }
            parts.push('c' + c.id + ':' + c.tid + ':' + c.start.toFixed(4) + ':' +
                       c.off.toFixed(4) + ':' + c.dur.toFixed(4) + ':' +
                       c.gain + ':' + c.fin + ':' + c.fout + ':' + nk);
        }
        return parts.join('|');
    }

    function flushMix(out, err) {
        var q = pendMix.slice();
        pendMix = [];
        var i;
        for (i = 0; i < q.length; i++) {
            try { q[i](out, err); } catch (e) { /* ignore */ }
        }
    }

    function renderMix(cb) {
        var dur = projectDur();
        if (dur <= 0.01) { cb(null, '还没有音频片段'); return; }
        var key = mixKey();
        if (rendered && rendKey === key) { cb(rendered); return; }
        /* 渲染中：把请求排进队列。
           原来是直接回「正在渲染，请稍候」，结果点播放时正好在预渲染就永远不播了 */
        if (rendering) {
            if (cb && pendMix.length < 8) pendMix.push(cb);
            return;
        }

        var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!OAC) { cb(null, '浏览器不支持离线渲染'); return; }

        var sr = 44100;
        var oc;
        try { oc = new OAC(2, Math.max(1, Math.ceil(dur * sr)), sr); }
        catch (e) { cb(null, '渲染失败：' + (e && e.message ? e.message : '未知')); return; }

        rendering = true;
        status('正在渲染…（' + Math.max(1, Math.round(dur)) + ' 秒音频）');
        /* 兜底：万一离线渲染卡住，别把 rendering 永久置为 true，否则之后全部请求都会被挡 */
        var guard = setTimeout(function () {
            if (rendering) { rendering = false; status('渲染超时，请再试一次', true); }
        }, 30000);

        var master = oc.createGain();
        master.gain.value = clamp(masterVol / 100, 0, 4);
        /* 多个振荡器叠加容易过载，主输出挂一个压缩器兜底 */
        var comp = null;
        try {
            comp = oc.createDynamicsCompressor();
            comp.threshold.value = -12;
            comp.knee.value = 12;
            comp.ratio.value = 6;
            master.connect(comp);
            comp.connect(oc.destination);
        } catch (ec) { master.connect(oc.destination); }

        /* 分音数按音符总量分档：离线渲染的开销 ≈ 振荡器数 × 时长，
           8 条乐器轨全开时按 8 条谐波算要十几秒，降档后音质损失很小 */
        var nCount = 0, i2;
        for (i2 = 0; i2 < clips.length; i2++) if (clips[i2].notes) nCount += clips[i2].notes.length;
        synCap = nCount > 300 ? 3 : (nCount > 150 ? 4 : (nCount > 60 ? 6 : 8));

        var anySolo = false, i, j;
        for (i = 0; i < tracks.length; i++) if (tracks[i].solo) anySolo = true;

        var revBus = null, anyRev = false;
        for (i = 0; i < tracks.length; i++) {
            if ((tracks[i].rev || 0) > 0 && !tracks[i].mute && !(anySolo && !tracks[i].solo)) anyRev = true;
        }
        if (anyRev) revBus = makeRevBus(oc, master);

        for (i = 0; i < tracks.length; i++) {
            var t = tracks[i];
            if (t.mute || (anySolo && !t.solo)) continue;
            var tg = oc.createGain();
            tg.gain.value = clamp(t.vol / 100, 0, 4);
            tg.connect(master);
            /* 混响走发送：干声保持原样，额外送一份到共享卷积器 */
            var rv = clamp((t.rev || 0) / 100, 0, 1);
            if (rv > 0.001 && revBus) {
                var sd = oc.createGain();
                sd.gain.value = rv * 0.85;
                tg.connect(sd);
                sd.connect(revBus);
            }
            for (j = 0; j < clips.length; j++) {
                var c = clips[j];
                if (c.tid !== t.id) continue;

                /* 乐轨：用振荡器把音符排进去 */
                if (c.notes && c.notes.length) {
                    var ng = oc.createGain();
                    ng.gain.value = clamp((c.gain == null ? 100 : c.gain) / 100, 0, 4);
                    ng.connect(tg);
                    scheduleClipNotes(oc, ng, c.notes, t.inst, Math.max(0, c.start), 0.42);
                    continue;
                }

                if (!c.buf) continue;
                var src = oc.createBufferSource();
                src.buffer = c.buf;
                var cg = oc.createGain();
                cg.connect(tg);
                src.connect(cg);
                var g0 = clamp((c.gain == null ? 100 : c.gain) / 100, 0, 4);
                var t0 = Math.max(0, c.start);
                var fi = clamp((c.fin || 0) / 1000, 0, c.dur);
                var fo = clamp((c.fout || 0) / 1000, 0, c.dur - fi);
                cg.gain.setValueAtTime(fi > 0 ? 0 : g0, t0);
                if (fi > 0) cg.gain.linearRampToValueAtTime(g0, t0 + fi);
                if (fo > 0) {
                    cg.gain.setValueAtTime(g0, t0 + c.dur - fo);
                    cg.gain.linearRampToValueAtTime(0, t0 + c.dur);
                } else {
                    cg.gain.setValueAtTime(g0, Math.max(t0, t0 + c.dur - 0.0001));
                }
                try { src.start(t0, clamp(c.off, 0, c.buf.duration), c.dur); }
                catch (e2) { /* ignore */ }
            }
        }

        var done = function (out) {
            clearTimeout(guard);
            rendering = false;
            rendered = out;
            rendKey = mixKey();
            cb(out);
            flushMix(out, null);
        };
        var fail = function (e3) {
            clearTimeout(guard);
            rendering = false;
            var msg = '渲染失败：' + (e3 && e3.message ? e3.message : '未知');
            cb(null, msg);
            flushMix(null, msg);
        };
        try {
            var pr = oc.startRendering();
            if (pr && typeof pr.then === 'function') pr.then(done).catch(fail);
            else oc.oncomplete = function (ev) { done(ev.renderedBuffer); };
        } catch (e4) { fail(e4); }
    }

    /* ---------------- 播放 ---------------- */

    function playheadTime() {
        if (!playing) return playOffset;
        return playOffset + (ac.currentTime - playCtxAt);
    }

    function startPlay(from) {
        /* 正在后台渲染时点播放：请求会排队，这里先给一句反馈，别让人以为点了没反应 */
        if (rendering) status('渲染完成后立即播放…');
        renderMix(function (out, err) {
            if (!out) {
                if (err === '正在渲染，请稍候') { status('渲染完成后立即播放…'); return; }
                status(err || '播放失败', true);
                return;
            }
            status('播放中 · ' + fmtT(out.duration));
            var c = liveCtx();
            if (!c) { status('浏览器不支持音频播放', true); return; }
            stopNode();
            srcNode = c.createBufferSource();
            srcNode.buffer = out;
            srcNode.connect(c.destination);
            playOffset = clamp(from, 0, out.duration);
            playCtxAt = c.currentTime + 0.02;
            try { srcNode.start(playCtxAt, playOffset); } catch (e) { /* ignore */ }
            playing = true;
            setPlayBtn(true);
            var self = srcNode;
            srcNode.onended = function () {
                if (self === srcNode) { playing = false; setPlayBtn(false); }
            };
            tick();
        });
    }

    function stopNode() {
        if (srcNode) {
            try { srcNode.onended = null; } catch (e) { /* ignore */ }
            try { srcNode.stop(); } catch (e2) { /* ignore */ }
            try { srcNode.disconnect(); } catch (e3) { /* ignore */ }
            srcNode = null;
        }
    }

    function stopPlay() {
        stopNode();
        playing = false;
        setPlayBtn(false);
        if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
        if (ac && playing === false) playOffset = 0;
        movePlayhead(0);
    }

    function setPlayBtn(on) {
        var b = $('.ms-btn[data-act="play"]', panel);
        if (b) b.textContent = on ? '暂停' : '播放';
    }

    function tick() {
        raf = 0;
        if (!playing) return;
        var t = playheadTime();
        var d = rendered ? rendered.duration : projectDur();
        if (t >= d) {
            playing = false;
            setPlayBtn(false);
            stopNode();
            playOffset = 0;
            movePlayhead(0);
            return;
        }
        movePlayhead(t);
        raf = window.requestAnimationFrame(tick);
    }

    function movePlayhead(t) {
        if (playheadEl) playheadEl.style.left = (t * pxPerSec) + 'px';
        var el = $('.ms-clock', panel);
        if (el) el.textContent = fmtT(t) + ' / ' + fmtT(projectDur());
        var pe = $('.ms-pos', panel);
        if (pe) pe.textContent = fmtPos(t);
    }

    /* ---------------- 波形峰值 ---------------- */

    function computePeaks(c, w) {
        if (!c.buf || typeof c.buf.getChannelData !== 'function') return null;
        if (c.peaks && c.peakW === w) return c.peaks;
        var b = c.buf, n = b.numberOfChannels, len = b.length;
        var per = Math.max(1, Math.floor(len / Math.max(1, w)));
        var out = new Float32Array(Math.max(1, w) * 2);
        var ch0 = b.getChannelData(0);
        var ch1 = n > 1 ? b.getChannelData(1) : null;
        var k = 0, i, j;
        for (i = 0; i < len && k < w * 2; i += per) {
            var mn = 1, mx = -1;
            var end = Math.min(len, i + per);
            for (j = i; j < end; j++) {
                var v = ch0[j];
                if (v < mn) mn = v;
                if (v > mx) mx = v;
                if (ch1) {
                    var v2 = ch1[j];
                    if (v2 < mn) mn = v2;
                    if (v2 > mx) mx = v2;
                }
            }
            out[k++] = mn; out[k++] = mx;
        }
        for (; k < w * 2; k++) out[k] = 0;
        c.peaks = out;
        c.peakW = w;
        return out;
    }

    /* 乐轨没有波形，改成画迷你音符条（同样能一眼看出旋律走向） */
    function drawNoteBars(g, w, h, c) {
        var ns = c.notes || [], i;
        if (!ns.length) return;
        var lo = 999, hi = -999;
        for (i = 0; i < ns.length; i++) {
            if (ns[i].p < lo) lo = ns[i].p;
            if (ns[i].p > hi) hi = ns[i].p;
        }
        var span = Math.max(8, hi - lo + 1);
        var rowH = h / span;
        var dur = Math.max(0.001, c.dur);
        for (i = 0; i < ns.length; i++) {
            var n = ns[i];
            var x = (n.t / dur) * w;
            var ww = Math.max(2, (n.d / dur) * w);
            var y = h - ((n.p - lo + 1) * rowH);
            g.fillStyle = 'rgba(255,255,255,0.88)';
            g.fillRect(x, y + 0.5, Math.max(1.5, Math.min(ww, w - x)), Math.max(1.5, rowH - 1));
        }
    }

    function drawClipWave(cv2, c) {
        var w = cv2.clientWidth, h = cv2.clientHeight;
        if (!w || !h) return;
        if (cv2.width !== w) cv2.width = w;
        if (cv2.height !== h) cv2.height = h;
        var g = cv2.getContext('2d');
        if (!g) return;
        g.clearRect(0, 0, w, h);
        if (c.notes) { drawNoteBars(g, w, h, c); return; }
        var pk = computePeaks(c, w);
        if (!pk) return;
        var mid = h / 2, i, n = w;
        g.beginPath();
        for (i = 0; i < n; i++) {
            var mn = pk[i * 2], mx = pk[i * 2 + 1];
            var y0 = mid - mx * mid * 0.92;
            var y1 = mid - mn * mid * 0.92;
            if (y1 - y0 < 1) y1 = y0 + 1;
            g.moveTo(i + 0.5, y0);
            g.lineTo(i + 0.5, y1);
        }
        g.strokeStyle = 'rgba(255,255,255,0.85)';
        g.lineWidth = 1;
        g.stroke();
    }

    /* ---------------- 标尺 ---------------- */

    function drawRuler() {
        if (!rulerEl || !rulerCx) return;
        var w = contentW(), h = RULER_H;
        if (rulerEl.width !== w) rulerEl.width = w;
        if (rulerEl.height !== h) rulerEl.height = h;
        rulerEl.style.width = w + 'px';
        var g = rulerCx;
        g.clearRect(0, 0, w, h);
        g.fillStyle = 'rgba(0,0,0,0.02)';
        g.fillRect(0, 0, w, h);

        var bs = beatSec(), bar = bs * 4;
        var beatPx = bs * pxPerSec;
        var step = 1, drawBeat = true;
        if (beatPx < 5) { step = 4; drawBeat = false; }
        else if (beatPx < 11) { step = 2; drawBeat = false; }
        else if (beatPx < 22) { step = 1; drawBeat = false; }

        var i, x, t;
        g.font = '10px system-ui, sans-serif';
        g.textBaseline = 'top';

        if (drawBeat) {
            g.strokeStyle = 'rgba(0,0,0,0.18)';
            g.beginPath();
            for (i = 0; ; i++) {
                t = i * bs; x = t * pxPerSec;
                if (x > w) break;
                if (i % 4 === 0) continue;
                g.moveTo(Math.round(x) + 0.5, h - 8);
                g.lineTo(Math.round(x) + 0.5, h);
            }
            g.stroke();
        }

        g.strokeStyle = 'rgba(0,0,0,0.42)';
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.beginPath();
        for (i = 0; ; i++) {
            t = i * bar * step; x = t * pxPerSec;
            if (x > w) break;
            g.moveTo(Math.round(x) + 0.5, 0);
            g.lineTo(Math.round(x) + 0.5, h);
        }
        g.stroke();
        for (i = 0; ; i++) {
            t = i * bar * step; x = t * pxPerSec;
            if (x > w) break;
            g.fillText(String(i * step + 1), Math.round(x) + 4, 4);
        }
    }

    /* ---------------- 乐理与合成 ---------------- */

    var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    var WAVES = [
        { k: 'sine', n: '正弦' }, { k: 'triangle', n: '三角' },
        { k: 'sawtooth', n: '锯齿' }, { k: 'square', n: '方波' }
    ];

    /* 乐器库：每种乐器用「谐波列 + ADSR 包络 + 失谐 + 滤波」描述，
       合成时按谐波逐条叠加，比单一波形更像真乐器。
       h = 各次谐波相对音量；a = 起音；dk = 衰减到持续音的时间；
       s = 持续音量比例；r = 释音；det = 失谐音分；cut = 低通倍数；
       vib = 颤音音分；nv = 气声噪声比例；gm = MIDI 音色号 */
    /* 乐器库。合成走采样级引擎（见 synthNote），字段含义：
       h   各次谐波相对音量
       a   起音；dk 衰减到持续音的时间；s 持续音量比例；r 释音
       hd  高次谐波额外衰减（越大高频掉得越快，这是"不像电子琴"的关键）
       uni 齐奏弦数（钢琴一个键三根弦，微失谐才有厚度）
       det 失谐音分；vib 颤音音分；ham 锤击/拨片瞬态；nv 气声/弓噪
       ks  Karplus-Strong 拨弦模型；gm MIDI 音色号 */
    var INSTRUMENTS = [
        { id: 'piano', n: '标准钢琴', cat: '键盘', kind: 'syn', gm: 0,
          h: [1, .52, .34, .22, .15, .10, .065, .04], a: .003, dk: 1.45, s: .05, r: .60,
          det: 1.7, uni: 3, hd: .78, ham: .40, vib: 0, nv: 0 },
        { id: 'bpiano', n: '明亮钢琴', cat: '键盘', kind: 'syn', gm: 0,
          h: [1, .66, .50, .38, .28, .19, .13, .08], a: .002, dk: 1.05, s: .08, r: .55,
          det: 1.5, uni: 3, hd: .55, ham: .50, vib: 0, nv: 0 },
        { id: 'epiano', n: '电钢琴', cat: '键盘', kind: 'syn', gm: 4,
          h: [1, .26, .44, .05, .13, .02], a: .004, dk: 1.55, s: .26, r: .85,
          det: .9, uni: 2, hd: .62, ham: .22, vib: 2, nv: 0 },
        { id: 'organ', n: '管风琴', cat: '键盘', kind: 'syn', gm: 19,
          h: [1, .72, .52, .37, .26, .18, .13, .09], a: .02, dk: .10, s: .95, r: .12,
          det: 1.2, uni: 2, hd: .3, ham: 0, vib: 0, nv: 0 },
        { id: 'mbox', n: '八音盒', cat: '键盘', kind: 'syn', gm: 10,
          h: [1, .04, .5, .02, .28, .01, .15, .01], a: .001, dk: 2.10, s: .02, r: 1.05,
          det: .3, uni: 1, hd: .5, ham: .40, vib: 0, nv: 0 },
        { id: 'glock', n: '钟琴', cat: '键盘', kind: 'syn', gm: 9,
          h: [1, .02, .44, .01, .23, .01, .11], a: .001, dk: 1.35, s: .03, r: 1.15,
          det: .3, uni: 1, hd: .45, ham: .34, vib: 0, nv: 0 },
        { id: 'nguitar', n: '尼龙吉他', cat: '拨弦', kind: 'syn', gm: 24,
          h: [1], a: .002, dk: 1.2, s: .04, r: .35, det: 0, uni: 1, hd: .8,
          ham: .50, vib: 0, nv: .03, ks: { t: 1.5, b: .55 } },
        { id: 'aguitar', n: '钢弦吉他', cat: '拨弦', kind: 'syn', gm: 25,
          h: [1], a: .002, dk: 1.0, s: .05, r: .40, det: 0, uni: 1, hd: .8,
          ham: .62, vib: 0, nv: .04, ks: { t: 2.3, b: .33 } },
        { id: 'abass', n: '原声贝斯', cat: '贝斯', kind: 'syn', gm: 32,
          h: [1], a: .004, dk: .9, s: .10, r: .30, det: 0, uni: 1, hd: .8,
          ham: .46, vib: 0, nv: .03, ks: { t: 1.9, b: .62 } },
        { id: 'ebass', n: '拨弹电贝斯', cat: '贝斯', kind: 'syn', gm: 33,
          h: [1], a: .002, dk: .8, s: .12, r: .25, det: 0, uni: 1, hd: .8,
          ham: .54, vib: 0, nv: .03, ks: { t: 1.3, b: .34 } },
        { id: 'violin', n: '小提琴', cat: '弦乐', kind: 'syn', gm: 40,
          h: [1, .62, .48, .31, .23, .15, .10, .06], a: .075, dk: .34, s: .74, r: .30,
          det: 1.4, uni: 2, hd: .72, ham: .10, vib: 6, nv: .11 },
        { id: 'viola', n: '中提琴', cat: '弦乐', kind: 'syn', gm: 41,
          h: [1, .55, .41, .25, .17, .11, .07], a: .085, dk: .34, s: .72, r: .32,
          det: 1.3, uni: 2, hd: .78, ham: .10, vib: 6, nv: .11 },
        { id: 'cello', n: '大提琴', cat: '弦乐', kind: 'syn', gm: 42,
          h: [1, .50, .35, .21, .14, .09, .06], a: .090, dk: .40, s: .70, r: .42,
          det: 1.1, uni: 2, hd: .82, ham: .10, vib: 6, nv: .10 },
        { id: 'strings', n: '弦乐合奏', cat: '弦乐', kind: 'syn', gm: 48,
          h: [1, .58, .43, .27, .19, .13, .09, .06], a: .18, dk: .45, s: .68, r: .65,
          det: 3.5, uni: 2, hd: .70, ham: .06, vib: 5, nv: .12 },
        { id: 'choir', n: '人声', cat: '人声', kind: 'syn', gm: 52,
          h: [1, .50, .43, .31, .25, .17, .11, .07], a: .16, dk: .55, s: .64, r: .52,
          det: 3.0, uni: 2, hd: .66, ham: .05, vib: 7, nv: .16 },
        { id: 'flute', n: '长笛', cat: '管乐', kind: 'syn', gm: 73,
          h: [1, .15, .07, .035], a: .060, dk: .26, s: .82, r: .22,
          det: .7, uni: 1, hd: .6, ham: .06, vib: 4, nv: .32 },
        { id: 'trumpet', n: '小号', cat: '管乐', kind: 'syn', gm: 56,
          h: [1, .80, .63, .51, .39, .27, .17, .11], a: .028, dk: .26, s: .62, r: .22,
          det: .9, uni: 1, hd: .55, ham: .16, vib: 3, nv: .05 },
        { id: 'lead', n: '合成主音', cat: '合成', kind: 'syn', gm: 80,
          h: [1, .60, .46, .31, .21, .15, .10, .06], a: .012, dk: .42, s: .52, r: .22,
          det: 2.5, uni: 2, hd: .6, ham: .08, vib: 6, nv: 0 },
        { id: 'pad', n: '铺底垫', cat: '合成', kind: 'syn', gm: 89,
          h: [1, .40, .31, .23, .17, .11, .08], a: .40, dk: .65, s: .62, r: 1.25,
          det: 5, uni: 2, hd: .55, ham: 0, vib: 2, nv: .05 },
        { id: 'drums', n: '标准鼓组', cat: '打击', kind: 'drum', gm: 0,
          h: [1], a: .002, dk: .3, s: .05, r: .2, det: 0, uni: 1, hd: 1, ham: 0, vib: 0, nv: 0 }
    ];

    function instById(id) {
        var i;
        for (i = 0; i < INSTRUMENTS.length; i++) if (INSTRUMENTS[i].id === id) return INSTRUMENTS[i];
        /* 旧数据存的是波形名，映射回最接近的乐器，避免换了版本直接没声音 */
        var map = { sine: 'piano', triangle: 'flute', sawtooth: 'lead', square: 'ebass' };
        if (map[id]) return instById(map[id]);
        return INSTRUMENTS[0];
    }

    /* 白噪声缓冲：鼓和气声都用它，按 ctx 缓存，别每次重建 */
    function noiseBuf(ctx) {
        if (ctx.__blNoise) return ctx.__blNoise;
        var sr = ctx.sampleRate, n = Math.floor(sr * 1.2), b, i;
        try { b = ctx.createBuffer(1, n, sr); } catch (e) { return null; }
        var d = b.getChannelData(0);
        for (i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        try { ctx.__blNoise = b; } catch (e2) { /* ignore */ }
        return b;
    }

    function schedTone(ctx, dest, type, f0, f1, sweep, t0, peak, dec) {
        try {
            var o = ctx.createOscillator(), g = ctx.createGain();
            o.type = type || 'sine';
            o.frequency.setValueAtTime(clamp(f0, 20, 18000), t0);
            if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(clamp(f1, 20, 18000), t0 + sweep);
            g.gain.setValueAtTime(Math.max(0.0002, peak), t0);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.02, dec));
            o.connect(g); g.connect(dest);
            o.start(t0); o.stop(t0 + Math.max(0.02, dec) + 0.06);
        } catch (e) { /* ignore */ }
    }

    function schedNoise(ctx, dest, nb, t0, peak, dec, type, freq, q) {
        if (!nb) return;
        try {
            var s = ctx.createBufferSource(); s.buffer = nb;
            var f = ctx.createBiquadFilter();
            f.type = type || 'highpass';
            f.frequency.value = clamp(freq || 4000, 60, 18000);
            f.Q.value = q == null ? 0.8 : q;
            var g = ctx.createGain();
            g.gain.setValueAtTime(Math.max(0.0002, peak), t0);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.01, dec));
            s.connect(f); f.connect(g); g.connect(dest);
            s.start(t0, Math.random() * 0.4, Math.max(0.02, dec) + 0.03);
        } catch (e) { /* ignore */ }
    }

    /* 鼓组：音高决定鼓件，走通用 MIDI 的打击键位 */
    var DRUM_MAP = {
        35: 'kick', 36: 'kick', 37: 'stick', 38: 'snare', 40: 'snare',
        41: 'tom3', 43: 'tom2', 45: 'tom1', 47: 'tom0',
        42: 'hat', 44: 'hatp', 46: 'ohat',
        49: 'crash', 52: 'china', 51: 'ride', 57: 'crash2', 53: 'bell', 54: 'bell', 56: 'bell'
    };
    var DRUM_F = { tom0: 330, tom1: 250, tom2: 190, tom3: 150 };

    function schedDrum(ctx, dest, m, t0, v) {
        var kind = DRUM_MAP[m] || 'tom1';
        var nb = noiseBuf(ctx);
        var peak = clamp(v, 0, 2) * 0.55;
        if (kind === 'kick') {
            schedTone(ctx, dest, 'sine', 165, 46, 0.13, t0, peak, 0.34);
            schedNoise(ctx, dest, nb, t0, peak * 0.22, 0.02, 'lowpass', 2600, 0.7);
            return;
        }
        if (kind === 'snare') {
            schedNoise(ctx, dest, nb, t0, peak * 0.9, 0.18, 'highpass', 1500, 0.8);
            schedTone(ctx, dest, 'triangle', 190, 170, 0.08, t0, peak * 0.35, 0.1);
            return;
        }
        if (kind === 'hat') { schedNoise(ctx, dest, nb, t0, peak * 0.5, 0.05, 'highpass', 8200, 0.9); return; }
        if (kind === 'hatp') { schedNoise(ctx, dest, nb, t0, peak * 0.42, 0.08, 'highpass', 6200, 0.9); return; }
        if (kind === 'ohat') { schedNoise(ctx, dest, nb, t0, peak * 0.46, 0.34, 'highpass', 7000, 0.9); return; }
        if (kind === 'stick') { schedNoise(ctx, dest, nb, t0, peak * 0.6, 0.05, 'highpass', 3200, 0.9); return; }
        if (kind === 'crash') { schedNoise(ctx, dest, nb, t0, peak * 0.55, 1.25, 'highpass', 4800, 0.7); return; }
        if (kind === 'crash2') { schedNoise(ctx, dest, nb, t0, peak * 0.5, 0.95, 'highpass', 5600, 0.7); return; }
        if (kind === 'china') { schedNoise(ctx, dest, nb, t0, peak * 0.5, 1.1, 'highpass', 6000, 0.7); return; }
        if (kind === 'ride') {
            schedNoise(ctx, dest, nb, t0, peak * 0.32, 0.9, 'bandpass', 4200, 1.4);
            schedTone(ctx, dest, 'sine', 3200, 3200, 0.01, t0, peak * 0.08, 0.5);
            return;
        }
        if (kind === 'bell') {
            schedTone(ctx, dest, 'sine', 1180, 1180, 0.01, t0, peak * 0.3, 0.5);
            schedTone(ctx, dest, 'sine', 1790, 1790, 0.01, t0, peak * 0.18, 0.4);
            return;
        }
        var f0 = DRUM_F[kind] || 200;
        schedTone(ctx, dest, 'sine', f0, f0 * 0.42, 0.3, t0, peak * 0.85, 0.38);
    }

    /* ==================================================================
       采样级乐器合成
       ------------------------------------------------------------------
       原来用「每音符 × 每谐波 = 一个振荡器节点」，几百个音符就是几千个
       节点，既慢又因为所有分音共用一条包络而显得像电子琴。
       这里改成直接用 JS 把波形算进 Float32Array：
         · 高次谐波各自独立衰减（真乐器就是这样的，这是"电子琴味"的
           主要来源：所有分音一起涨落，听着像合成器）
         · 多弦齐奏：同一音高几根弦带微失谐 + 不同初始相位
         · 瞬态噪声：钢琴锤击、吉他拨片、起弓、吹气
         · 拨弦类走 Karplus-Strong 物理建模
         · 音区相关：低音分音多、衰减慢；高音分音少、衰减快
       算完按 (乐器, 音高, 时长, 力度) 缓存，编曲里大量重复音符实际
       只需合成几十次。
       ================================================================== */

    var SIN_N = 2048, SIN_TAB = null;
    function sinTab() {
        if (SIN_TAB) return SIN_TAB;
        var i;
        SIN_TAB = new Float32Array(SIN_N);
        for (i = 0; i < SIN_N; i++) SIN_TAB[i] = Math.sin(i / SIN_N * 6.283185307);
        return SIN_TAB;
    }
    /* 查表正弦：相位 0~1，线性插值。合成里每样本要调几十次，Math.sin 太慢 */
    function tsin(ph) {
        var t = sinTab(), x = ph * SIN_N, i = x | 0, f = x - i;
        var a = t[i & (SIN_N - 1)];
        return a + (t[(i + 1) & (SIN_N - 1)] - a) * f;
    }

    var rndS = 1;
    function rnd() {
        rndS = (rndS * 1103515245 + 12345) & 0x7fffffff;
        return (rndS / 1073741823.5) - 1;
    }

    /* 二阶带通（RBJ），逐样本。噪声成分要靠它塑形：
       锤击是低频为主的闷响，气声是围绕基频的宽带嘶声 */
    function bpCoef(sr, fc, q) {
        var w = 6.2831853 * clamp(fc, 30, sr / 2.2) / sr;
        var cw = Math.cos(w), sw = Math.sin(w);
        var al = sw / (2 * Math.max(0.2, q));
        var a0 = 1 + al;
        return { b0: al / a0, b2: -al / a0, n1: 2 * cw / a0, n2: -(1 - al) / a0 };
    }
    /* st = [x1, x2, y1, y2] */
    function bpTick(c, x, st) {
        var y = c.b0 * x + c.b2 * st[1] + c.n1 * st[2] + c.n2 * st[3];
        st[1] = st[0]; st[0] = x;
        st[3] = st[2]; st[2] = y;
        return y;
    }

    /* 合成一个音符，返回 Float32Array（单声道，已含尾音） */
    function synthNote(sr, freq, dur, vel, ins, vseed) {
        var atk = Math.max(0.0012, ins.a == null ? 0.005 : ins.a);
        var rel = Math.max(0.05, ins.r == null ? 0.25 : ins.r);
        var sus = ins.s == null ? 0.3 : clamp(ins.s, 0, 1);
        var dkT = Math.max(0.05, ins.dk == null ? 0.3 : ins.dk);
        var hsp = ins.hd == null ? 0.85 : ins.hd;

        /* 音区：相对中央 C 的八度数。低音分音多、衰减慢，高音相反 */
        var oct = Math.log(freq / 261.6256) / 0.693147;
        var pLen = clamp(1.8 - oct * 0.32, 0.28, 2.6);
        var pRoll = clamp(1.05 - oct * 0.15, 0.42, 1.3);

        var peak = clamp(vel, 0, 2);
        var hold = Math.max(0.04, dur);
        var tail = rel * 1.4 + 0.10;
        var n = Math.max(8, Math.ceil((hold + tail) * sr));
        var out = new Float32Array(n);
        var s, i, u;

        rndS = (Math.floor(vseed * 9973) + 7) & 0x7fffffff;

        var nAtt = Math.max(1, Math.floor(atk * sr));
        var nHold = Math.max(1, Math.floor(hold * sr));
        var invAtk = 1 / nAtt;

        /* 瞬态：锤击 / 拨片 / 起弓。短噪声经带通后叠在起音处 */
        var ham = ins.ham || 0;
        if (ham > 0) {
            var hc = bpCoef(sr, clamp(freq * 3.2, 120, 9000), 1.1);
            var hs = [0, 0, 0, 0];
            var hn = Math.min(n, Math.floor(sr * 0.10));
            var hdec = Math.exp(-1 / (0.013 * sr));
            var hv = 1;
            for (s = 0; s < hn; s++) {
                hv *= hdec;
                out[s] += bpTick(hc, rnd(), hs) * hv * ham * peak * 0.55;
            }
        }

        var ks = ins.ks;
        if (ks) {
            /* Karplus-Strong：一段噪声在延迟线里循环并逐圈低通衰减。
               这是弦振动的物理模型，吉他/贝斯的拨弦感全靠它 */
            var N = Math.max(2, Math.round(sr / freq));
            var lb = new Float32Array(N), li;
            var br = ks.b == null ? 0.5 : ks.b;
            var prev = 0;
            for (li = 0; li < N; li++) {
                prev = prev * (1 - br) + rnd() * br;
                lb[li] = prev;
            }
            /* 每圈循环增益：由目标衰减时间反推，低音自然衰减更慢 */
            var T = Math.max(0.15, (ks.t || 1.6) * pLen);
            var g = Math.exp(-N / (sr * T));
            var pi = 0, kenv = 1;
            var krel = Math.exp(-1 / (Math.max(0.04, rel) * sr));
            var kAtk = Math.max(1, Math.floor(sr * 0.004));
            for (s = 0; s < n; s++) {
                var cur = lb[pi], nx2 = lb[(pi + 1) % N];
                lb[pi] = (cur + nx2) * 0.5 * g;
                var ae = s < kAtk ? s / kAtk : 1;
                out[s] += cur * kenv * ae * peak * 0.62;
                pi++; if (pi >= N) pi = 0;
                if (s > nHold) kenv *= krel;
            }
            return finalize(out, n, peak);
        }

        var H = ins.h && ins.h.length ? ins.h : [1];
        var nh = Math.min(H.length, Math.max(2, Math.floor(17000 / freq)));
        if (synCap && nh > synCap) nh = synCap;
        var uni = clamp(ins.uni || 1, 1, 4);
        var det = ins.det || 0;

        var amp = [], inc = [], ph = [], dec = [], decMul = [];
        var tot = 0;
        for (i = 0; i < nh; i++) {
            var tau = (dkT / (1 + hsp * i)) * pLen / 3.0;
            if (tau < 0.006) tau = 0.006;
            dec.push(1);
            /* 指数衰减改成每样本乘常数，循环里一次 exp 都不用算 */
            decMul.push(Math.exp(-1 / (tau * sr)));
            var a = H[i] * Math.pow(pRoll, i);
            amp.push(a);
            for (u = 0; u < uni; u++) {
                var cents = uni === 1 ? 0 : det * (u - (uni - 1) / 2) * 2 / Math.max(1, uni - 1);
                var f = freq * (i + 1) * Math.pow(2, cents / 1200);
                if (f > 19000) f = 19000;
                inc.push(f / sr);
                ph.push((vseed * (i + 1) * 0.618 + u * 0.37 + i * 0.11) % 1);
                tot += a * a;
            }
        }
        if (tot <= 0) tot = 1;
        /* 各分音初相随机，是能量叠加而非幅度叠加，所以按 RMS 归一 */
        var norm = 0.72 / Math.sqrt(tot);

        var vib = ins.vib || 0, vibPh = 0, vibInc = 5.3 / sr;
        var vibAmt = vib > 0 ? vib / 1200 * 0.693 : 0;
        var relMul = Math.exp(-1 / (Math.max(0.02, rel / 2.6) * sr));
        var relFac = 1;

        for (s = 0; s < n; s++) {
            var vm = 1;
            if (vibAmt) {
                vm = 1 + vibAmt * tsin(vibPh);
                vibPh += vibInc; if (vibPh >= 1) vibPh -= 1;
            }
            var ae = s < nAtt ? s * invAtk : 1;
            if (s > nHold) relFac *= relMul;
            var acc = 0, k = 0;
            for (i = 0; i < nh; i++) {
                var d = dec[i];
                if (s >= nAtt) d *= decMul[i];
                dec[i] = d;
                var e = (sus + (1 - sus) * d) * ae * relFac;
                var pv = 0;
                for (u = 0; u < uni; u++) {
                    pv += tsin(ph[k]);
                    var nx = ph[k] + inc[k] * vm;
                    ph[k] = nx - Math.floor(nx);
                    k++;
                }
                acc += amp[i] * e * pv;
            }
            out[s] += acc * norm * peak;
        }

        /* 持续气声 / 弓噪：跟着包络走，管乐和弦乐才有"呼吸" */
        var nv = ins.nv || 0;
        if (nv > 0) {
            var nc = bpCoef(sr, clamp(freq * 2.4, 200, 11000), 0.9);
            var ns = [0, 0, 0, 0];
            var nRel = Math.exp(-1 / (Math.max(0.03, rel) * sr));
            var nv2 = 1, nA2 = Math.max(1, Math.floor(atk * 1.4 * sr));
            for (s = 0; s < n; s++) {
                var en;
                if (s < nA2) en = s / nA2;
                else if (s > nHold) { nv2 *= nRel; en = nv2; }
                else en = 1;
                out[s] += bpTick(nc, rnd(), ns) * en * nv * peak * 0.30;
            }
        }

        return finalize(out, n, peak);
    }

    /* 收尾：先统一响度再软限幅。
       各乐器的分音数、持续特性差很多 —— 长笛的气声、管风琴的长 sustain
       天生 RMS 就高，不拉平的话混音里会明显盖过钢琴。 */
    function finalize(out, n, peak) {
        var s, v, e2 = 0;
        for (s = 0; s < n; s++) e2 += out[s] * out[s];
        var rms = Math.sqrt(e2 / n);
        if (rms > 0.0001) {
            var gn = clamp(0.17 * (peak < 0.02 ? 0.02 : peak) / rms, 0.12, 3.2);
            for (s = 0; s < n; s++) out[s] *= gn;
        }
        for (s = 0; s < n; s++) {
            v = out[s];
            if (v > 0.9 || v < -0.9) out[s] = v / (1 + Math.abs(v) * 0.35);
        }
        return out;
    }

    /* 波形缓存：编曲里同一个音高、同样长短的音符很多，合成一次就够 */
    function noteBuf(ctx, ins, m, dur, vel) {
        var key = ins.id + '|' + m + '|' + Math.round(Math.max(0.05, dur) * 16) +
                  '|' + Math.round(clamp(vel, 0, 2) * 12);
        var cache = ctx.__blNB || (ctx.__blNB = {});
        var b = cache[key];
        if (b) return b;
        var sr = ctx.sampleRate;
        var w;
        try { w = synthNote(sr, mtof(m), dur, vel, ins, ((m * 7 + 13) % 97) / 97); }
        catch (e) { return null; }
        if (!w || !w.length) return null;
        var nb;
        try { nb = ctx.createBuffer(1, w.length, sr); }
        catch (e2) { return null; }
        try { nb.getChannelData(0).set(w); } catch (e3) { return null; }
        cache[key] = nb;
        return nb;
    }

    function schedNoteBuf(ctx, dest, ins, m, t0, dur, vel, mul) {
        var b = noteBuf(ctx, ins, m, dur, vel);
        if (!b) return;
        try {
            var src = ctx.createBufferSource();
            src.buffer = b;
            var g = ctx.createGain();
            g.gain.value = clamp(mul == null ? 0.42 : mul, 0, 4);
            src.connect(g); g.connect(dest);
            src.start(Math.max(0, t0));
        } catch (e) { /* ignore */ }
    }

    function scheduleInstrument(ctx, dest, m, t0, dur, v, insId) {
        var ins = instById(insId);
        if (ins.kind === 'drum') { schedDrum(ctx, dest, m, t0, v); return; }
        schedNoteBuf(ctx, dest, ins, m, t0, dur, v, 1);
    }

    function scheduleClipNotes(ctx, dest, notes, insId, t0, mul) {
        var ins = instById(insId);
        var g = clamp(mul == null ? 0.42 : mul, 0, 4);
        var i, n;
        for (i = 0; i < notes.length; i++) {
            n = notes[i];
            if (!n) continue;
            var v = ((n.v == null ? 100 : n.v) / 100);
            if (ins.kind === 'drum') { schedDrum(ctx, dest, n.p, Math.max(0, t0 + n.t), v * 1); continue; }
            schedNoteBuf(ctx, dest, ins, n.p, Math.max(0, t0 + n.t), Math.max(0.05, n.d), v, g);
        }
    }

    /* MIDI 音高转频率：C2 记作 36，中央 C(C4) 是 60 */
    function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function mname(m) { return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
    function isBlack(m) {
        var p = ((m % 12) + 12) % 12;
        return p === 1 || p === 3 || p === 6 || p === 8 || p === 10;
    }
    function waveName(k) {
        var i;
        for (i = 0; i < WAVES.length; i++) if (WAVES[i].k === k) return WAVES[i].n;
        return '正弦';
    }

    /* 混响用的脉冲响应：白噪声 × 指数衰减，现场合成，不依赖外部音频文件 */
    function makeIR(ctx, sec, decay) {
        var sr = ctx.sampleRate;
        var n = Math.max(1, Math.floor(sr * sec));
        var b;
        try { b = ctx.createBuffer(2, n, sr); }
        catch (e) { return null; }
        var ch, i;
        for (ch = 0; ch < 2; ch++) {
            var d = b.getChannelData(ch);
            for (i = 0; i < n; i++) {
                var x = i / n;
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, decay);
            }
        }
        return b;
    }

    /* 混响用「发送」模型：整首共用一条卷积器，各轨按 rev 决定发送量。
       每轨各挂一条卷积器时，8 条轨就得跑 8 次卷积，实测渲染会慢好几倍。 */
    function makeRevBus(ctx, out) {
        var inp = ctx.createGain();
        var cv = null, ir = makeIR(ctx, 2.0, 2.6);
        if (ir) {
            try {
                cv = ctx.createConvolver();
                cv.buffer = ir;
                var wet = ctx.createGain();
                wet.gain.value = 0.9;
                inp.connect(cv); cv.connect(wet); wet.connect(out);
                return inp;
            } catch (e) { /* 退化成直通 */ }
        }
        inp.connect(out);
        return inp;
    }

    /* 轨道信号链：干声 + 混响湿声。rev=0 时直接直通，不挂卷积器（省开销） */
    function trackChain(ctx, rev, out) {
        var input = ctx.createGain();
        var r = clamp((rev || 0) / 100, 0, 1);
        if (r <= 0.001) { input.connect(out); return input; }
        var dry = ctx.createGain();
        dry.gain.value = 1 - r * 0.55;
        var wet = ctx.createGain();
        wet.gain.value = r * 0.85;
        var cv = ctx.createConvolver();
        var ir = makeIR(ctx, 0.9 + r * 1.6, 2.6);
        if (!ir) { input.connect(out); return input; }
        try { cv.buffer = ir; } catch (e) { input.connect(out); return input; }
        input.connect(dry); dry.connect(out);
        input.connect(cv); cv.connect(wet); wet.connect(out);
        return input;
    }

    /* 把一个乐轨的所有音符排进时间轴 */
    function scheduleNotes(ctx, dest, notes, wave, t0, mul) {
        var i;
        for (i = 0; i < notes.length; i++) {
            var n = notes[i];
            if (!n) continue;
            var st = t0 + n.t;
            var d = Math.max(0.04, n.d);
            var o, g;
            try {
                o = ctx.createOscillator();
                g = ctx.createGain();
            } catch (e) { return; }
            o.type = wave || 'sine';
            try { o.frequency.setValueAtTime(mtof(n.p), Math.max(0, st)); }
            catch (e2) { o.frequency.value = mtof(n.p); }
            var v = clamp((n.v == null ? 100 : n.v) / 100, 0, 2) * mul;
            var at = 0.006;
            var rl = Math.min(0.3, d * 0.6);
            try {
                g.gain.setValueAtTime(0, Math.max(0, st));
                g.gain.linearRampToValueAtTime(v, Math.max(0, st) + at);
                g.gain.setValueAtTime(v, Math.max(0, st) + Math.max(at, d - rl));
                g.gain.linearRampToValueAtTime(0.0001, Math.max(0, st) + d);
                o.connect(g); g.connect(dest);
                o.start(Math.max(0, st));
                o.stop(Math.max(0, st) + d + 0.02);
            } catch (e3) { /* ignore */ }
        }
    }

    /* ---------------- 界面构建 ---------------- */

    function trackColor(t) {
        var hues = [174, 200, 262, 320, 22, 48, 96, 300];
        return hues[(t.id - 1) % hues.length];
    }

    function instOptions(cur) {
        var s = '', i, lastCat = '';
        for (i = 0; i < INSTRUMENTS.length; i++) {
            var it = INSTRUMENTS[i];
            if (it.cat !== lastCat) {
                if (lastCat) s += '</optgroup>';
                s += '<optgroup label="' + esc(it.cat) + '">';
                lastCat = it.cat;
            }
            s += '<option value="' + it.id + '"' + (cur === it.id ? ' selected' : '') + '>' +
                 esc(it.n) + '</option>';
        }
        if (lastCat) s += '</optgroup>';
        return s;
    }

    function knobHtml(t) {
        var pct = clamp((t.vol || 0) / 150, 0, 1);
        return '<span class="ms-knob" data-knob="' + t.id + '" title="音量 ' + t.vol +
               '（上下拖动）" style="--kp:' + pct.toFixed(3) + '"></span>';
    }

    function headHtml(t, idx) {
        var inst = t.kind === 'inst';
        var rev = t.rev || 0;
        var h = '<div class="ms-head' + (inst ? ' is-inst' : '') + '" data-tid="' + t.id + '">' +
            '<div class="ms-head-top">' +
            '<span class="ms-dot" style="background:hsl(' + trackColor(t) + ',62%,52%)"></span>' +
            '<span class="ms-badge' + (inst ? ' is-inst' : '') + '">' + (inst ? '乐轨' : '音轨') + '</span>' +
            '<span class="ms-hname" data-ren="' + t.id + '" title="双击改名">' + esc(t.name) + '</span>' +
            '<button type="button" class="ms-mini' + (t.mute ? ' is-on' : '') + '" data-mute="' + t.id + '" title="静音">M</button>' +
            '<button type="button" class="ms-mini' + (t.solo ? ' is-on' : '') + '" data-solo="' + t.id + '" title="独奏">S</button>' +
            '<button type="button" class="ms-mini ms-del" data-del-t="' + t.id + '" title="删除轨道">×</button>' +
            '</div>';

        if (inst) {
            /* 乐器轨：音色 + 音量/混响并排 */
            h += '<div class="ms-head-mid">' +
                '<select class="ms-inst" data-inst="' + t.id + '" title="选择乐器">' + instOptions(t.inst) + '</select>' +
                '<span class="ms-hint">双击泳道加乐轨</span>' +
                '</div>' +
                '<div class="ms-head-bot">' +
                knobHtml(t) +
                '<span class="ms-k2" title="混响">混</span>' +
                '<input type="range" class="ms-vol ms-vol2" data-rev="' + t.id + '" min="0" max="100" value="' + rev + '" />' +
                '</div>';
        } else {
            h += '<div class="ms-head-bot">' +
                '<span class="ms-k2" title="音量">音</span>' +
                '<input type="range" class="ms-vol" data-vol="' + t.id + '" min="0" max="150" value="' + t.vol + '" />' +
                '<span class="ms-volnum">' + t.vol + '</span>' +
                '</div>' +
                '<div class="ms-head-bot">' +
                '<span class="ms-k2" title="混响">混</span>' +
                '<input type="range" class="ms-vol" data-rev="' + t.id + '" min="0" max="100" value="' + rev + '" />' +
                '<span class="ms-volnum">' + rev + '</span>' +
                '</div>';
        }
        return h + '</div>';
    }

    function buildPanel() {
        panel = document.createElement('div');
        panel.className = 'ms-panel';
        panel.innerHTML =
            '<div class="ms-bar">' +
            '<button type="button" class="ms-btn ms-primary" data-act="pick">导入音频…</button>' +
            '<input type="file" class="ms-file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" multiple hidden />' +
            '<button type="button" class="ms-btn" data-act="addinst">+ 乐轨</button>' +
            '<span class="ms-sep"></span>' +
            '<button type="button" class="ms-btn ms-play" data-act="play">播放</button>' +
            '<button type="button" class="ms-btn" data-act="stop">停止</button>' +
            '<span class="ms-sep"></span>' +
            '<button type="button" class="ms-btn" data-act="zoomin" title="放大">＋</button>' +
            '<button type="button" class="ms-btn" data-act="zoomout" title="缩小">－</button>' +
            '<button type="button" class="ms-btn is-on" data-act="snap" title="吸附到节拍">吸附</button>' +
            '<span class="ms-k">BPM</span>' +
            '<input type="number" class="ms-bpm" value="' + bpm + '" min="20" max="400" />' +
            '<span class="ms-sep"></span>' +
            '<span class="ms-k">名称</span>' +
            '<input type="text" class="ms-name" value="' + esc(projName) + '" />' +
            '<span class="ms-clock">0:00.0 / 0:00.0</span>' +
            '<span class="ms-pos" title="小节:拍.毫秒">1:1.000</span>' +
            '<span class="ms-info">导入音频开始制作</span>' +
            '</div>' +
            '<div class="ms-body">' +
            '<div class="ms-heads">' +
            '<div class="ms-headpad"></div>' +
            '<div class="ms-headlist"></div>' +
            '<div class="ms-master">' +
            '<span class="ms-mname">主声轨</span>' +
            '<input type="range" class="ms-vol" data-mvol="1" min="0" max="150" value="' + masterVol + '" />' +
            '<span class="ms-volnum">' + masterVol + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="ms-tl">' +
            '<canvas class="ms-ruler"></canvas>' +
            '<div class="ms-lanes"></div>' +
            '<div class="ms-playhead"></div>' +
            '<div class="ms-drop">把音频文件拖到这里，或点上面的「导入音频…」</div>' +
            '</div>' +
            '</div>' +
            '<div class="ms-clipbar">' +
            '<span class="ms-cbtip">选中片段后可调节</span>' +
            '</div>' +
            '<div class="ms-bot">' +
            '<button type="button" class="ms-btn ms-primary" data-act="arrange">生成编曲</button>' +
            '<button type="button" class="ms-btn" data-act="rearrange">重新生成</button>' +
            '<button type="button" class="ms-btn" data-act="midi">导出 MIDI</button>' +
            '<span class="ms-sep"></span>' +
            '<button type="button" class="ms-btn" data-act="sprite">导入到角色栏</button>' +
            '<button type="button" class="ms-btn" data-act="dl">下载 WAV</button>' +
            '</div>';

        tlEl = $('.ms-tl', panel);
        headsEl = $('.ms-heads', panel);
        rulerEl = $('.ms-ruler', panel);
        lanesEl = $('.ms-lanes', panel);
        headListEl = $('.ms-headlist', panel);
        playheadEl = $('.ms-playhead', panel);
        try { rulerCx = rulerEl.getContext('2d'); } catch (e) { rulerCx = null; }

        headListEl.style.height = 'auto';

        bindPanel();
        layout();
    }

    function clipBarHtml() {
        var c = selId ? clipById(selId) : null;
        if (!c) return '<span class="ms-cbtip">点选一个片段后可调节它的音量与淡入淡出</span>';

        /* 乐轨：没有波形，改显示音符数与"写音符"入口 */
        if (c.notes) {
            return '<span class="ms-cbtip2">乐轨</span>' +
                '<span class="ms-cbname">' + esc(c.name) + '</span>' +
                '<span class="ms-cbtip">' + c.notes.length + ' 个音符 · 双击片段继续写</span>' +
                '<span class="ms-k">音量</span>' +
                '<input type="range" class="ms-vol" data-cgain="' + c.id + '" min="0" max="150" value="' + c.gain + '" />' +
                '<span class="ms-volnum">' + c.gain + '</span>' +
                '<button type="button" class="ms-btn" data-openpr="' + c.id + '">写音符…</button>' +
                '<button type="button" class="ms-btn ms-danger" data-del-c="' + c.id + '">删除片段</button>';
        }

        return '<span class="ms-cbtip2">片段</span>' +
            '<span class="ms-cbname">' + esc(c.name) + '</span>' +
            '<span class="ms-k">音量</span>' +
            '<input type="range" class="ms-vol" data-cgain="' + c.id + '" min="0" max="150" value="' + c.gain + '" />' +
            '<span class="ms-volnum">' + c.gain + '</span>' +
            '<span class="ms-k">淡入</span>' +
            '<input type="range" class="ms-vol" data-cfin="' + c.id + '" min="0" max="2000" step="10" value="' + c.fin + '" />' +
            '<span class="ms-volnum">' + c.fin + 'ms</span>' +
            '<span class="ms-k">淡出</span>' +
            '<input type="range" class="ms-vol" data-cfout="' + c.id + '" min="0" max="2000" step="10" value="' + c.fout + '" />' +
            '<span class="ms-volnum">' + c.fout + 'ms</span>' +
            '<button type="button" class="ms-btn ms-danger" data-del-c="' + c.id + '">删除片段</button>';
    }

    function refreshClipBar() {
        var el = $('.ms-clipbar', panel);
        if (el) el.innerHTML = clipBarHtml();
    }

    /* ---------------- 布局 ---------------- */

    /* ⚠ 面板必须自己限高。
       .ms-panel 是 flex:1 1 auto，但它的父容器并没有确定高度 ——
       轨道一多（每条 82px），整块面板就跟着内容一起长高，
       底部的「片段属性条 / 导出区」被顶到屏幕外，点不到也看不见。
       这里按视口算出可用高度钉死 maxHeight，多出来的轨道交给
       .ms-tl 自己滚（它本来就是 overflow:auto）。
       底部那条 33px 的栏（书包栏）要在内容还短的时候量才准，所以只量一次。 */
    var bottomReserve = -1;

    function fitPanel() {
        if (!panel) return;
        var host = panel.parentElement || hostEl;
        if (!host) return;
        var r = host.getBoundingClientRect();
        if (bottomReserve < 0) {
            var v = Math.round(window.innerHeight - r.bottom);
            bottomReserve = (v >= 0 && v < 200) ? v : 0;
        }
        var h = Math.round(window.innerHeight - r.top - bottomReserve);
        panel.style.maxHeight = Math.max(260, h) + 'px';

        /* 宽度同理：泳道铺开后 min-content 会把整条祖先链一起撑宽，
           祖先跟着变宽，百分比也就跟着失效，只能按视口硬算。
           限住面板之后，时间轴吃到的就是视口内那点宽度，
           多出来的部分才真正变成可横向滚动的区域。 */
        var vw = document.documentElement.clientWidth || window.innerWidth || 0;
        var w = Math.round(vw - r.left - 8);
        panel.style.maxWidth = Math.max(320, w) + 'px';
    }

    function layout() {
        if (!panel || !lanesEl) return;
        fitPanel();

        /* 轨道头 */
        var html = '';
        var i;
        for (i = 0; i < tracks.length; i++) html += headHtml(tracks[i], i);
        headListEl.innerHTML = html;
        headListEl.style.height = (tracks.length * LANE_H) + 'px';

        /* 泳道 + 片段 */
        var cw = contentW();
        lanesEl.style.width = cw + 'px';
        var lh = '';
        for (i = 0; i < tracks.length; i++) {
            var t = tracks[i];
            lh += '<div class="ms-lane' + (t.kind === 'inst' ? ' is-inst' : '') + '" data-tid="' + t.id +
                '" style="height:' + LANE_H + 'px"></div>';
        }
        if (!tracks.length) {
            lh = '<div class="ms-empty">还没有轨道。点「+ 乐轨」写旋律，或把音频文件拖进来自动建音轨</div>';
        }
        lanesEl.innerHTML = lh;

        for (i = 0; i < clips.length; i++) placeClip(clips[i]);

        /* 泳道网格跟着标尺走：小节线、拍线的间距都由当前缩放和 BPM 决定 */
        if (lanesEl) {
            lanesEl.style.setProperty('--barpx', (barSec() * pxPerSec) + 'px');
            lanesEl.style.setProperty('--beatpx', (beatSec() * pxPerSec) + 'px');
        }

        /* 播放指针要盖住标尺 + 全部泳道，所以高度按内容算 */
        if (playheadEl) playheadEl.style.height = (RULER_H + tracks.length * LANE_H) + 'px';
        if (tlEl) tlEl.classList.toggle('has-clips', clips.length > 0);

        drawRuler();
        syncScroll();
        syncRangeFills();
        movePlayhead(playing ? playheadTime() : playOffset);
    }

    function syncRangeFills() {
        var list = $$('input[type="range"]', panel);
        var i;
        for (i = 0; i < list.length; i++) {
            var el = list[i];
            var min = parseFloat(el.min), max = parseFloat(el.max), v = parseFloat(el.value);
            if (isNaN(min)) min = 0;
            if (isNaN(max)) max = 100;
            if (isNaN(v)) v = min;
            var r = max > min ? clamp((v - min) / (max - min), 0, 1) : 0;
            try { el.style.setProperty('--p', (r * 100).toFixed(2) + '%'); } catch (e) { /* ignore */ }
        }
    }

    function clipElHTML(c) {
        return '<div class="ms-clip" data-cid="' + c.id + '">' +
            '<div class="ms-cliphd"><span class="ms-clipname"></span>' +
            '<button type="button" class="ms-clipx" data-del-c="' + c.id + '">×</button></div>' +
            '<canvas class="ms-clipwv"></canvas>' +
            '<span class="ms-grip ms-gl"></span><span class="ms-grip ms-gr"></span>' +
            '</div>';
    }

    function applyClipStyle(el, c) {
        var w = Math.max(12, c.dur * pxPerSec);
        el.style.left = (c.start * pxPerSec) + 'px';
        el.style.width = w + 'px';
        el.classList.toggle('is-sel', c.id === selId);
        var t = trackById(c.tid);
        el.style.setProperty('--ch', t ? trackColor(t) : 174);
        var nm = el.querySelector('.ms-clipname');
        if (nm) nm.textContent = c.name;
        var cv2 = el.querySelector('.ms-clipwv');
        if (cv2) drawClipWave(cv2, c);
    }

    function placeClip(c) {
        var lane = lanesEl.querySelector('.ms-lane[data-tid="' + c.tid + '"]');
        if (!lane) return;
        var el = lane.querySelector('.ms-clip[data-cid="' + c.id + '"]');
        if (!el) {
            lane.insertAdjacentHTML('beforeend', clipElHTML(c));
            el = lane.querySelector('.ms-clip[data-cid="' + c.id + '"]');
            if (!el) return;
        }
        applyClipStyle(el, c);
    }

    /* 片段能拖到的最大长度：音频看文件时长，乐轨看音符内容 */
    function clipMaxDur(c) {
        if (c.buf) return c.buf.duration;
        if (c.src && c.src.length) {
            var m = 0, i;
            for (i = 0; i < c.src.length; i++) {
                var e = c.src[i].t + c.src[i].d;
                if (e > m) m = e;
            }
            return Math.max(m, c.dur, barSec() * 2);
        }
        return Math.max(c.dur, barSec() * 2);
    }

    /* 原始音符备份。自动编曲生成的乐轨是直接塞 notes 的，
       裁剪前补一份，才能做到"裁掉的部分拖回来还在" */
    function ensureSrc(c) {
        if (!c.notes || c.src) return;
        var i, a = [];
        for (i = 0; i < c.notes.length; i++) {
            a.push({ p: c.notes[i].p, t: c.notes[i].t, d: c.notes[i].d, v: c.notes[i].v });
        }
        c.src = a;
    }

    /* 乐轨裁掉两端时按 src（未裁剪的原始音符）重建，所以拖回去还能恢复 */
    function rebuildNotes(c) {
        if (!c.src) return;
        var out = [], i, n, t, d;
        for (i = 0; i < c.src.length; i++) {
            n = c.src[i];
            t = n.t - c.off;
            d = n.d;
            if (t >= c.dur) continue;
            if (t + d > c.dur) d = c.dur - t;
            if (t < 0) { d += t; t = 0; }
            if (d <= 0.01) continue;
            out.push({ p: n.p, t: t, d: d, v: n.v });
        }
        c.notes = out;
    }

    /* 同一轨道上不允许片段重叠：以被拖的片段为锚，右边的往右让，
       左边的往左让；左边顶到 0 让不开时，反过来把锚点往右推 */
    function resolveOverlap(c) {
        var same = [], i, o;
        for (i = 0; i < clips.length; i++) {
            if (clips[i].tid === c.tid && clips[i].id !== c.id) same.push(clips[i]);
        }
        if (!same.length) return;

        var right = [], left = [];
        for (i = 0; i < same.length; i++) {
            if (same[i].start >= c.start) right.push(same[i]); else left.push(same[i]);
        }
        right.sort(function (a, b) { return a.start - b.start; });
        left.sort(function (a, b) { return b.start - a.start; });

        var edge = c.start + c.dur;
        for (i = 0; i < right.length; i++) {
            if (right[i].start < edge) right[i].start = edge;
            edge = right[i].start + right[i].dur;
        }
        edge = c.start;
        for (i = 0; i < left.length; i++) {
            o = left[i];
            if (o.start + o.dur > edge) o.start = edge - o.dur;
            if (o.start < 0) o.start = 0;
            edge = o.start;
        }
        var minStart = 0;
        for (i = 0; i < left.length; i++) minStart = Math.max(minStart, left[i].start + left[i].dur);
        if (c.start < minStart) c.start = minStart;

        for (i = 0; i < same.length; i++) updateClipEl(same[i]);
        updateClipEl(c);
    }

    /* 只改样式，不重建 DOM —— 拖动时每帧调用，重建会丢掉指针捕获 */
    function updateClipEl(c) {
        var el = lanesEl ? lanesEl.querySelector('.ms-clip[data-cid="' + c.id + '"]') : null;
        if (el) applyClipStyle(el, c);
    }

    function syncScroll() {
        if (!tlEl || !headListEl) return;
        headListEl.style.transform = 'translateY(' + (-tlEl.scrollTop) + 'px)';
    }

    function relayoutClips() {
        var i;
        for (i = 0; i < clips.length; i++) placeClip(clips[i]);
    }

    /* ---------------- 事件 ---------------- */

    function bindPanel() {
        panel.addEventListener('click', function (e) {
            var tg = e.target;
            if (!tg || !tg.closest) return;

            var b = tg.closest('[data-act]');
            if (b) {
                var act = b.getAttribute('data-act');
                if (act === 'pick') { $('.ms-file', panel).click(); }
                else if (act === 'addtrack') { addTrack(); }
                else if (act === 'addinst') { addTrack(null, 'inst'); }
                else if (act === 'play') {
                    if (playing) { playing = false; setPlayBtn(false); stopNode(); }
                    else startPlay(playOffset);
                }
                else if (act === 'stop') { stopPlay(); }
                else if (act === 'zoomin') { setZoom(pxPerSec * 1.35); }
                else if (act === 'zoomout') { setZoom(pxPerSec / 1.35); }
                else if (act === 'snap') { snap = !snap; b.classList.toggle('is-on', snap); }
                else if (act === 'sprite') { toSprite(); }
                else if (act === 'dl') { download(); }
                else if (act === 'arrange') { arrange(); }
                else if (act === 'rearrange') { arrange(); }
                else if (act === 'midi') { exportMidi(); }
                return;
            }

            var mt = tg.closest('[data-mute]');
            if (mt) {
                var t1 = trackById(+mt.getAttribute('data-mute'));
                if (t1) { t1.mute = !t1.mute; layout(); }
                return;
            }
            var so = tg.closest('[data-solo]');
            if (so) {
                var t2 = trackById(+so.getAttribute('data-solo'));
                if (t2) { t2.solo = !t2.solo; layout(); }
                return;
            }
            var dt = tg.closest('[data-del-t]');
            if (dt) { delTrack(+dt.getAttribute('data-del-t')); return; }
            var dc = tg.closest('[data-del-c]');
            if (dc) { delClip(+dc.getAttribute('data-del-c')); return; }
            var op = tg.closest('[data-openpr]');
            if (op) {
                var oc2 = clipById(+op.getAttribute('data-openpr'));
                if (oc2) openPianoRoll(oc2);
                return;
            }
        });

        panel.addEventListener('contextmenu', function (e) {
            var tg = e.target;
            if (!tg || !tg.closest) return;
            var host2 = tg.closest('[data-tid]');
            if (!host2) return;
            var id = parseInt(host2.getAttribute('data-tid'), 10);
            if (!trackById(id)) return;
            e.preventDefault();
            e.stopPropagation();
            openTrackMenu(id, e.clientX, e.clientY);
        });

        var f = $('.ms-file', panel);
        if (f) {
            f.addEventListener('change', function () {
                if (f.files && f.files.length) loadFiles(f.files);
                f.value = '';
            });
        }

        var nm = $('.ms-name', panel);
        if (nm) nm.addEventListener('input', function () {
            projName = nm.value.trim() || '我的音乐';
        });

        var bp = $('.ms-bpm', panel);
        if (bp) bp.addEventListener('input', function () {
            bpm = clamp(parseFloat(bp.value) || 120, 20, 400);
            drawRuler();
        });

        /* 音量圆点：按下即开始拖动，不能挂在 click 上 —— 那样要松手才进入拖动 */
        panel.addEventListener('pointerdown', function (e) {
            var tg = e.target;
            if (!tg || !tg.closest) return;
            var kb = tg.closest('[data-knob]');
            if (kb) startKnob(e, kb);
        });

        /* 轨道音色下拉 */
        panel.addEventListener('change', function (e) {
            var tg = e.target;
            if (!tg || !tg.getAttribute) return;
            if (tg.hasAttribute('data-inst')) {
                var t = trackById(+tg.getAttribute('data-inst'));
                if (t) { t.inst = tg.value; if (pr) pr.inst = tg.value; }
            }
        });

        /* 轨道头双击改名。
           泳道里的双击不挂 dblclick：片段拖动要用 setPointerCapture，
           之后浏览器不再稳定合成 dblclick（实测在片段上完全收不到），
           所以泳道的双击改成在 pointerdown 里自己判定（见下）。 */
        panel.addEventListener('dblclick', function (e) {
            var tg0 = e.target;
            var rn = tg0 && tg0.closest ? tg0.closest('[data-ren]') : null;
            if (!rn) return;
            var t = trackById(+rn.getAttribute('data-ren'));
            if (!t) return;
            var v = window.prompt('轨道名称', t.name);
            if (v != null && v.trim()) { t.name = v.trim(); layout(); }
        });

        /* 滑块 */
        panel.addEventListener('input', function (e) {
            var tg = e.target;
            if (!tg || !tg.getAttribute) return;
            if (tg.hasAttribute('data-vol')) {
                var t = trackById(+tg.getAttribute('data-vol'));
                if (t) {
                    t.vol = +tg.value;
                    var n = tg.parentNode.querySelector('.ms-volnum');
                    if (n) n.textContent = t.vol;
                }
            } else if (tg.hasAttribute('data-rev')) {
                var tr = trackById(+tg.getAttribute('data-rev'));
                if (tr) tr.rev = +tg.value;
            } else if (tg.hasAttribute('data-mvol')) {
                masterVol = +tg.value;
                var n2 = tg.parentNode.querySelector('.ms-volnum');
                if (n2) n2.textContent = masterVol;
            } else if (tg.hasAttribute('data-cgain')) {
                var c1 = clipById(+tg.getAttribute('data-cgain'));
                if (c1) {
                    c1.gain = +tg.value;
                    var n3 = tg.parentNode.querySelector('.ms-volnum');
                    if (n3) n3.textContent = c1.gain;
                }
            } else if (tg.hasAttribute('data-cfin')) {
                var c2 = clipById(+tg.getAttribute('data-cfin'));
                if (c2) {
                    c2.fin = +tg.value;
                    var n4 = tg.parentNode.querySelector('.ms-volnum');
                    if (n4) n4.textContent = c2.fin + 'ms';
                }
            } else if (tg.hasAttribute('data-cfout')) {
                var c3 = clipById(+tg.getAttribute('data-cfout'));
                if (c3) {
                    c3.fout = +tg.value;
                    var n5 = tg.parentNode.querySelector('.ms-volnum');
                    if (n5) n5.textContent = c3.fout + 'ms';
                }
            } else { return; }
        });

        /* 标尺：跳转播放头 */
        if (rulerEl) {
            rulerEl.addEventListener('pointerdown', function (e) {
                var r = rulerEl.getBoundingClientRect();
                var t = clamp((e.clientX - r.left) / pxPerSec, 0, Math.max(projectDur(), 0));
                if (snap) t = Math.round(t / beatSec()) * beatSec();
                playOffset = t;
                movePlayhead(t);
                if (playing) startPlay(t);
                try { rulerEl.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
                drag = { mode: 'seek', el: rulerEl };
            });
            rulerEl.addEventListener('pointermove', function (e) {
                if (!drag || drag.mode !== 'seek') return;
                var r = rulerEl.getBoundingClientRect();
                var t = clamp((e.clientX - r.left) / pxPerSec, 0, Math.max(projectDur(), 0));
                if (snap) t = Math.round(t / beatSec()) * beatSec();
                playOffset = t;
                movePlayhead(t);
            });
            rulerEl.addEventListener('pointerup', function () { drag = null; });
            rulerEl.addEventListener('pointercancel', function () { drag = null; });
        }

        /* 泳道：片段拖动与裁剪 */
        if (lanesEl) {
            lanesEl.addEventListener('pointerdown', function (e) {
                var el = e.target && e.target.closest ? e.target.closest('.ms-clip') : null;

                /* 双击判定：距上次按下 <420ms 且位置几乎没动 */
                var now = Date.now();
                var cid0 = el ? +el.getAttribute('data-cid') : 0;
                var isDbl = lastPd && lastPd.t && (now - lastPd.t) < 420 &&
                            lastPd.cid === cid0 && !lastPd.moved &&
                            Math.abs(e.clientX - lastPd.x) < 6 && Math.abs(e.clientY - lastPd.y) < 6;
                lastPd = { t: isDbl ? 0 : now, x: e.clientX, y: e.clientY, cid: cid0, moved: false };

                if (isDbl) {
                    if (el) {
                        var cc3 = clipById(cid0);
                        if (cc3 && cc3.notes) { openPianoRoll(cc3); drag = null; return; }
                        /* 音频片段双击：选中并提示 */
                        status('音频片段：拖动移动，拖两端裁剪；要写音符请建乐器轨');
                        return;
                    }
                    var ln3 = e.target && e.target.closest ? e.target.closest('.ms-lane') : null;
                    if (ln3) {
                        var tt3 = trackById(+ln3.getAttribute('data-tid'));
                        if (tt3 && tt3.kind === 'inst') {
                            var r3 = ln3.getBoundingClientRect();
                            drag = null;
                            createNoteClip(tt3.id, (e.clientX - r3.left + tlEl.scrollLeft) / pxPerSec);
                            return;
                        }
                    }
                }

                if (!el) { selId = null; refreshClipBar(); relayoutClips(); return; }
                var c = clipById(+el.getAttribute('data-cid'));
                if (!c) return;
                selId = c.id;
                refreshClipBar();

                var r = el.getBoundingClientRect();
                var x = e.clientX - r.left;
                var mode = 'move';
                if (x <= 7) mode = 'trimL';
                else if (x >= r.width - 7) mode = 'trimR';
                drag = {
                    mode: mode, cid: c.id, x0: e.clientX,
                    start0: c.start, off0: c.off, dur0: c.dur, tid0: c.tid
                };
                try { el.setPointerCapture(e.pointerId); } catch (er2) { /* ignore */ }
                relayoutClips();
                /* 不能在这里 preventDefault：它会连带屏蔽 click / dblclick，
                   泳道的双击建乐轨就永远不会触发。禁选中交给 CSS 的 user-select。 */
            });

            lanesEl.addEventListener('pointermove', function (e) {
                /* 按下后真拖动了就不算双击 */
                if (lastPd && (Math.abs(e.clientX - lastPd.x) > 4 || Math.abs(e.clientY - lastPd.y) > 4)) {
                    lastPd.moved = true;
                }
                if (!drag || !drag.cid) return;
                var c = clipById(drag.cid);
                if (!c) return;
                var dx = (e.clientX - drag.x0) / pxPerSec;
                if (drag.mode === 'move') {
                    var nt = Math.max(0, drag.start0 + dx);
                    if (snap) nt = Math.round(nt / beatSec()) * beatSec();
                    c.start = Math.max(0, nt);
                    /* 跨轨：换了轨道才需要重建泳道 */
                    var lanes = $$('.ms-lane', lanesEl);
                    var i, want = c.tid;
                    for (i = 0; i < lanes.length; i++) {
                        var lr = lanes[i].getBoundingClientRect();
                        if (e.clientY >= lr.top && e.clientY <= lr.bottom) {
                            want = +lanes[i].getAttribute('data-tid');
                            break;
                        }
                    }
                    if (want !== c.tid) { c.tid = want; layout(); }
                    else { resolveOverlap(c); updateClipEl(c); }
                } else if (drag.mode === 'trimL') {
                    if (drag.trimmed !== true) {
                        c.peaks = null;
                        ensureSrc(c);
                        drag.trimmed = true;
                    }
                    var d = clamp(dx, -drag.off0, drag.dur0 - 0.05);
                    c.off = Math.max(0, drag.off0 + d);
                    c.dur = Math.max(0.05, drag.dur0 - d);
                    c.start = Math.max(0, drag.start0 + d);
                    if (c.src) rebuildNotes(c);
                    updateClipEl(c);
                } else if (drag.mode === 'trimR') {
                    if (drag.trimmed !== true) { c.peaks = null; ensureSrc(c); drag.trimmed = true; }
                    c.dur = clamp(drag.dur0 + dx, 0.05, Math.max(0.05, clipMaxDur(c) - c.off));
                    if (c.src) rebuildNotes(c);
                    resolveOverlap(c);
                    updateClipEl(c);
                }
            });

            var up = function () {
                if (drag && drag.cid) {
                    var c = clipById(drag.cid);
                    if (c) { c.peaks = null; layout(); }
                }
                drag = null;
            };
            lanesEl.addEventListener('pointerup', up);
            lanesEl.addEventListener('pointercancel', up);
        }

        if (tlEl) {
            tlEl.addEventListener('scroll', syncScroll);
        }

        /* 拖文件进来 */
        var tl = $('.ms-tl', panel);
        if (tl) {
            tl.addEventListener('dragover', function (e) {
                e.preventDefault();
                tl.classList.add('is-over');
            });
            tl.addEventListener('dragleave', function () { tl.classList.remove('is-over'); });
            tl.addEventListener('drop', function (e) {
                e.preventDefault();
                tl.classList.remove('is-over');
                var dt = e.dataTransfer;
                if (dt && dt.files && dt.files.length) loadFiles(dt.files);
            });
        }
    }

    function setZoom(v) {
        pxPerSec = clamp(v, 8, 400);
        layout();
        relayoutClips();
    }

    /* ---------------- 轨道 / 片段操作 ---------------- */

    function addTrack(nm, kind, instId) {
        var inst = kind === 'inst';
        var ins = instById(instId || 'piano');
        var n = 0, i;
        for (i = 0; i < tracks.length; i++) {
            if ((tracks[i].kind === 'inst') === inst) n++;
        }
        var t = {
            id: nextTid++,
            name: nm || (inst ? ins.n : ('音轨' + (n + 1))),
            vol: 100, mute: false, solo: false,
            kind: inst ? 'inst' : 'audio',
            inst: ins.id,
            /* 乐器轨默认给一点混响，干声直接出来会显得很干 */
            rev: inst ? 12 : 0
        };
        tracks.push(t);
        status(inst ? '已加乐轨：双击泳道建乐段，双击乐段写音符' : '已加音轨：把音频拖进来');
        layout();
        return t;
    }

    function delTrack(id) {
        var i;
        for (i = clips.length - 1; i >= 0; i--) if (clips[i].tid === id) clips.splice(i, 1);
        for (i = 0; i < tracks.length; i++) {
            if (tracks[i].id === id) { tracks.splice(i, 1); break; }
        }
        if (selId && !clipById(selId)) selId = null;
        refreshClipBar();
        layout();
    }

    function delClip(id) {
        var i;
        for (i = 0; i < clips.length; i++) {
            if (clips[i].id === id) { clips.splice(i, 1); break; }
        }
        if (selId === id) selId = null;
        refreshClipBar();
        layout();
    }

    /* ---------------- 轨道右键菜单：铺满 / 删除 / 清空 / 复制粘贴 ---------------- */

    function clipsOfTrack(id) {
        var out = [], i;
        for (i = 0; i < clips.length; i++) if (clips[i].tid === id) out.push(clips[i]);
        out.sort(function (a, b) { return a.start - b.start; });
        return out;
    }

    function invalidate() {
        rendered = null;
        refreshClipBar();
        layout();
    }

    /* 铺满：把这条轨上第一段的内容重复排到工程末尾。
       音符片段直接把旋律按小节循环铺开；音频片段则复制若干份接在后面。 */
    function fillTrack(id) {
        var t = trackById(id);
        if (!t) return;
        var list = clipsOfTrack(id);
        if (!list.length) { status('这条轨道还没有内容可铺'); return; }
        var end = Math.max(projectDur(), barSec() * 4);
        var c = list[0];
        if (c.notes && c.notes.length) {
            var plen = 0, i, k;
            for (i = 0; i < c.notes.length; i++) {
                plen = Math.max(plen, c.notes[i].t + c.notes[i].d);
            }
            if (plen < 0.05) plen = Math.max(0.05, c.dur);
            var ns = [];
            var reps = Math.ceil(Math.max(0, end - c.start) / plen);
            if (reps < 1) reps = 1;
            if (reps > 400) reps = 400;
            for (k = 0; k < reps; k++) {
                for (i = 0; i < c.notes.length; i++) {
                    var n = c.notes[i];
                    ns.push({ p: n.p, t: n.t + k * plen, d: n.d, v: n.v });
                }
            }
            c.notes = ns;
            /* 铺满 = 整条轨从 0 铺到工程末尾。
               编曲出来的轨是错开进场的（鼓第 0 小节、钢琴第 1、弦乐第 2…），
               不把起点归零的话，每条轨本来就都结束在工程末尾，
               铺满会变成一次看不见的"什么都没发生"。 */
            c.start = 0;
            c.dur = Math.max(0.2, end);
            /* 铺满是"整条轨填满"，多余的片段去掉，避免互相压住 */
            for (i = clips.length - 1; i >= 0; i--) {
                if (clips[i].tid === id && clips[i].id !== c.id) clips.splice(i, 1);
            }
        } else {
            var step = Math.max(0.05, c.dur);
            c.start = 0;
            var pos = c.start + step;
            var guard = 0;
            while (pos < end - 0.01 && guard < 200) {
                clips.push({
                    id: nextCid++, tid: id, start: pos, off: 0, dur: c.dur,
                    buf: c.buf, name: c.name, gain: c.gain, fin: c.fin, fout: c.fout,
                    peaks: c.peaks, peakW: c.peakW
                });
                pos += step;
                guard++;
            }
        }
        invalidate();
        status('已铺满：' + t.name);
    }

    /* 清空：轨道留着，片段全删 */
    function clearTrack(id) {
        var t = trackById(id);
        if (!t) return;
        var i;
        for (i = clips.length - 1; i >= 0; i--) if (clips[i].tid === id) clips.splice(i, 1);
        if (selId && !clipById(selId)) selId = null;
        invalidate();
        status('已清空：' + t.name);
    }

    /* 复制粘贴：整条轨（含片段）复制一份，插在原轨下面 */
    function dupTrack(id) {
        var t = trackById(id);
        if (!t) return;
        var nt = {
            id: nextTid++, name: t.name + ' 副本', vol: t.vol, mute: t.mute, solo: t.solo,
            kind: t.kind, inst: t.inst, rev: t.rev
        };
        var idx = tracks.indexOf(t);
        tracks.splice(idx + 1, 0, nt);
        var list = clipsOfTrack(id), i, c;
        for (i = 0; i < list.length; i++) {
            c = list[i];
            clips.push({
                id: nextCid++, tid: nt.id, start: c.start, off: c.off, dur: c.dur,
                buf: c.buf, notes: c.notes ? c.notes.map(function (n) {
                    return { p: n.p, t: n.t, d: n.d, v: n.v };
                }) : null,
                name: c.name, gain: c.gain, fin: c.fin, fout: c.fout,
                peaks: c.peaks, peakW: c.peakW
            });
        }
        invalidate();
        status('已复制粘贴：' + nt.name);
    }

    var ctxMenuEl = null;

    function closeCtxMenu() {
        if (ctxMenuEl && ctxMenuEl.parentNode) ctxMenuEl.parentNode.removeChild(ctxMenuEl);
        ctxMenuEl = null;
    }

    function openTrackMenu(id, x, y) {
        closeCtxMenu();
        var t = trackById(id);
        if (!t) return;
        var host = null;
        try { host = (window.__blTopLayer && window.__blTopLayer()) || null; } catch (e) { host = null; }
        if (!host) host = document.body;

        var items = [
            { k: 'fill', t: '铺满' },
            { k: 'del', t: '删除' },
            { k: 'clear', t: '清空' },
            { k: 'dup', t: '复制粘贴' }
        ];
        var el = document.createElement('div');
        el.className = 'ms-ctx';
        var h = '<div class="ms-ctx-name">' + esc(t.name) + '</div>';
        for (var i = 0; i < items.length; i++) {
            h += '<button type="button" class="ms-ctx-item" data-k="' + items[i].k + '">' +
                 items[i].t + '</button>';
        }
        el.innerHTML = h;
        host.appendChild(el);

        /* 贴边时往回收，别顶出屏幕 */
        var vw = window.innerWidth || 0, vh = window.innerHeight || 0;
        var w = el.offsetWidth || 132, hh = el.offsetHeight || 150;
        el.style.left = Math.max(6, Math.min(x, vw - w - 6)) + 'px';
        el.style.top = Math.max(6, Math.min(y, vh - hh - 6)) + 'px';

        el.addEventListener('click', function (e) {
            var b = e.target && e.target.closest ? e.target.closest('.ms-ctx-item') : null;
            if (!b) return;
            var k = b.getAttribute('data-k');
            closeCtxMenu();
            if (k === 'fill') fillTrack(id);
            else if (k === 'del') delTrack(id);
            else if (k === 'clear') clearTrack(id);
            else if (k === 'dup') dupTrack(id);
        });
        ctxMenuEl = el;
        var out = function (e) {
            if (ctxMenuEl && ctxMenuEl.contains(e.target)) return;
            closeCtxMenu();
            document.removeEventListener('pointerdown', out, true);
        };
        document.addEventListener('pointerdown', out, true);
        window.setTimeout(function () { document.removeEventListener('pointerdown', out, true); }, 60000);
    }

    /* 音量圆点：上下拖动改音量。松手才让缓存失效，拖动过程中不重渲染 */
    function startKnob(e, el) {
        var id = parseInt(el.getAttribute('data-knob'), 10);
        var t = trackById(id);
        if (!t || !e.clientY) return;
        e.preventDefault();
        var y0 = e.clientY, v0 = t.vol, moved = false;
        var mv = function (ev) {
            var dy = y0 - ev.clientY;
            if (Math.abs(dy) > 1) moved = true;
            t.vol = clamp(Math.round(v0 + dy * 1.1), 0, 150);
            el.style.setProperty('--kp', (t.vol / 150).toFixed(3));
            el.setAttribute('title', '音量 ' + t.vol + '（上下拖动）');
        };
        var up = function () {
            document.removeEventListener('pointermove', mv);
            document.removeEventListener('pointerup', up);
            if (moved) { rendered = null; status('「' + t.name + '」音量 ' + t.vol); }
        };
        document.addEventListener('pointermove', mv);
        document.addEventListener('pointerup', up);
    }

    /* 导入音频时落到音轨上：没有音轨就自动建一条，
       绝不往乐轨里塞音频（乐轨是给合成器写音符用的） */
    function audioTarget() {
        var i, last = null;
        if (selId) {
            var c = clipById(selId);
            var t = c ? trackById(c.tid) : null;
            if (t && t.kind !== 'inst') return t;
        }
        for (i = 0; i < tracks.length; i++) if (tracks[i].kind !== 'inst') last = tracks[i];
        if (last) return last;
        return addTrack(null, 'audio');
    }

    /* 该轨道上最后一个片段的末尾 —— 新片段排在这里就不会压到别人 */
    function nextSlot(tid, dur) {
        var end = 0, i;
        for (i = 0; i < clips.length; i++) {
            if (clips[i].tid !== tid) continue;
            var e2 = clips[i].start + clips[i].dur;
            if (e2 > end) end = e2;
        }
        if (snap) end = Math.round(end / beatSec()) * beatSec();
        return Math.max(0, end);
    }

    function addClip(buf, nm, tid, start) {
        var c = {
            id: nextCid++,
            tid: tid,
            start: start,
            off: 0,
            dur: buf.duration,
            buf: buf,
            name: nm,
            gain: 100, fin: 0, fout: 0,
            peaks: null, peakW: 0
        };
        clips.push(c);
        resolveOverlap(c);
        selId = c.id;
        refreshClipBar();
        layout();
        return c;
    }

    /* ---------------- 导入 ---------------- */

    function decode(file, cb) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) { cb(null, '浏览器不支持音频解码'); return; }
        var ctx;
        try { ctx = new C(); } catch (e) { cb(null, '无法创建音频上下文'); return; }
        var fr = new FileReader();
        fr.onload = function () {
            var done = false;
            var fin = function (b, err) { if (!done) { done = true; cb(b, err); } };
            try {
                var p = ctx.decodeAudioData(fr.result, function (b) { fin(b); },
                    function (e2) { fin(null, '无法解码这个音频'); });
                if (p && typeof p.then === 'function') {
                    p.then(function (b) { fin(b); }, function () { fin(null, '无法解码这个音频'); });
                }
            } catch (e3) { fin(null, '无法解码这个音频'); }
        };
        fr.onerror = function () { cb(null, '读取文件失败'); };
        fr.readAsArrayBuffer(file);
    }

    function loadFiles(list) {
        var arr = Array.prototype.slice.call(list);
        var pending = arr.length;
        var ok = 0;
        var t = audioTarget();
        status('正在解码…');
        arr.forEach(function (file) {
            decode(file, function (b, err) {
                pending--;
                if (b) {
                    var base = String(file.name || '音频').replace(/\.[^.]+$/, '');
                    addClip(b, base, t.id, nextSlot(t.id, b.duration));
                    ok++;
                }
                if (pending <= 0) {
                    if (ok) status('已导入 ' + ok + ' 个片段 · 总长 ' + fmtT(projectDur()));
                    else status(err || '导入失败', true);
                }
            });
        });
    }

    /* ---------------- 钢琴卷帘 ---------------- */

    function prTopLayer() {
        var f = window.__blTopLayer;
        if (typeof f === 'function') {
            try { var el = f(); if (el && el.appendChild) return el; } catch (e) { /* ignore */ }
        }
        return document.body;
    }

    function prStepSec() {
        if (!prStep) return -1;                 /* 0 = 不吸附 */
        return beatSec() / prStep;
    }

    function prSnapT(t) {
        var s = prStepSec();
        if (s <= 0) return Math.max(0, t);
        return Math.max(0, Math.round(t / s) * s);
    }

    function prRows() { return prHi - prLo + 1; }

    /* 打开时把音域撑到能装下所有音符，两端各留 2 个半音，最少 24 行 */
    function fitRange(notes) {
        var lo = 999, hi = -999, i;
        for (i = 0; i < notes.length; i++) {
            if (notes[i].p < lo) lo = notes[i].p;
            if (notes[i].p > hi) hi = notes[i].p;
        }
        if (lo > hi) { prLo = PR_LO; prHi = PR_HI; return; }
        lo = clamp(lo - 2, 12, 108);
        hi = clamp(hi + 2, 12, 108);
        if (hi - lo + 1 < 24) {
            var mid = Math.round((lo + hi) / 2);
            lo = clamp(mid - 12, 12, 108);
            hi = clamp(lo + 23, 12, 108);
            lo = clamp(hi - 23, 12, 108);
        }
        prLo = lo;
        prHi = hi;
    }

    /* 琴键：每个半音一行，白键铺满整行，黑键用 ::after 叠在行上部，
       看起来就是白键连续、黑键压在上面 —— 和真钢琴的排列一致 */
    function prKeysHtml() {
        var h = '', m;
        for (m = prHi; m >= prLo; m--) {
            var bk = isBlack(m);
            var lab = (m % 12 === 0) ? mname(m) : '';
            h += '<div class="pr-key' + (bk ? ' is-bk' : ' is-wt') + '" data-m="' + m +
                 '" style="top:' + ((prHi - m) * prRowH) + 'px;height:' + prRowH + 'px">' +
                 (lab ? '<span class="pr-klab">' + lab + '</span>' : '') + '</div>';
        }
        return h;
    }

    function prHTML(c) {
        var i, opts = '';
        var steps = [[0, '不吸附'], [1, '1/1 拍'], [2, '1/2 拍'], [4, '1/4 拍'], [8, '1/8 拍']];
        for (i = 0; i < steps.length; i++) {
            opts += '<option value="' + steps[i][0] + '"' + (prStep === steps[i][0] ? ' selected' : '') +
                    '>' + steps[i][1] + '</option>';
        }
        var wopts = instOptions(pr.inst);
        return '<div class="addon-window-header">' +
            '<div class="addon-window-title">钢琴卷帘 · ' + esc(c.name) + '</div>' +
            '<div class="addon-window-controls">' +
            '<button type="button" class="addon-window-btn addon-window-btn-minimize" data-pract="min" title="最小化"></button>' +
            '<button type="button" class="addon-window-btn addon-window-btn-maximize" data-pract="max" title="最大化"></button>' +
            '<button type="button" class="addon-window-btn addon-window-btn-close" data-pract="close" title="关闭"></button>' +
            '</div></div>' +
            '<div class="addon-window-content">' +
            '<div class="pr-bar">' +
            '<span class="pr-k">乐器</span><select class="pr-sel" data-pr="inst">' + wopts + '</select>' +
            '<span class="pr-k">吸附</span><select class="pr-sel" data-pr="snap">' + opts + '</select>' +
            '<span class="pr-k">力度</span><input type="range" class="pr-vel" data-pr="vel" min="10" max="150" value="' + prVel + '" />' +
            '<span class="pr-vnum">' + prVel + '</span>' +
            '<button type="button" class="ms-btn' + (prAudition ? ' is-on' : '') + '" data-pract="aud" title="落音符时试听">试听</button>' +
            '<span class="pr-sep"></span>' +
            '<button type="button" class="ms-btn" data-pract="zo" title="缩小">－</button>' +
            '<button type="button" class="ms-btn" data-pract="zi" title="放大">＋</button>' +
            '<span class="pr-k">长度</span>' +
            '<input type="number" class="pr-len" data-pr="len" min="1" max="64" value="' + prBeats() + '" />' +
            '<span class="pr-k">拍</span>' +
            '</div>' +
            '<div class="pr-main">' +
            '<div class="pr-keys">' + prKeysHtml() + '</div>' +
            '<div class="pr-grid"><div class="pr-notes"></div></div>' +
            '</div>' +
            '<div class="pr-bot">' +
            '<span class="pr-tip">点空白写音符 · 拖音符改音高和位置 · 拖右端改长短 · 双击音符删除</span>' +
            '<span class="pr-cnt"></span>' +
            '<button type="button" class="ms-btn" data-pract="play">试听这段</button>' +
            '<button type="button" class="ms-btn" data-pract="clear">清空</button>' +
            '<button type="button" class="ms-btn" data-pract="cancel">取消</button>' +
            '<button type="button" class="ms-btn ms-primary" data-pract="ok">创建</button>' +
            '</div>' +
            '</div>';
    }

    function prBeats() {
        return Math.max(1, Math.round(pr.dur / beatSec()));
    }

    function prNoteHTML(n, i) {
        var x = n.t * prPx;
        var w = Math.max(8, n.d * prPx);
        var y = (prHi - n.p) * prRowH;
        return '<div class="pr-note' + (i === pr.sel ? ' is-sel' : '') + '" data-i="' + i + '"' +
            ' style="left:' + x.toFixed(1) + 'px;top:' + y + 'px;width:' + w.toFixed(1) + 'px;height:' + (prRowH - 1) + 'px"' +
            ' title="' + mname(n.p) + '"></div>';
    }

    function prRender() {
        if (!pr || !pr.notesEl) return;
        var h = '', i, vis = 0;
        for (i = 0; i < pr.notes.length; i++) {
            var n = pr.notes[i];
            if (!n) continue;
            if (n.p >= prLo && n.p <= prHi) { h += prNoteHTML(n, i); vis++; }
        }
        pr.notesEl.innerHTML = h;

        var w = Math.max(pr.dur * prPx + prPx, 200);
        pr.notesEl.style.width = w + 'px';
        pr.notesEl.style.height = (prRows() * prRowH) + 'px';
        pr.notesEl.style.setProperty('--rowh', prRowH + 'px');
        pr.notesEl.style.setProperty('--beatpx', (beatSec() * prPx) + 'px');
        pr.notesEl.style.setProperty('--barpx', (barSec() * prPx) + 'px');

        /* 键盘列要和音符区同高，否则纵向滚动到底后两面对不上 */
        var keys = $('.pr-keys', pr.win);
        if (keys) keys.style.height = (prRows() * prRowH) + 'px';

        var cnt = $('.pr-cnt', pr.win);
        if (cnt) cnt.textContent = pr.notes.length + ' 个音符';
    }

    function prAuditionNote(m) {
        var c = liveCtx();
        if (!c) return;
        synCap = 8;                 /* 实时试听音符少，用满谐波 */
        try {
            var g = c.createGain();
            g.gain.value = 0.5;
            g.connect(c.destination);
            scheduleInstrument(c, g, m, c.currentTime + 0.02, Math.max(0.4, beatSec()), 0.9, pr.inst);
        } catch (e) { /* ignore */ }
    }

    function prPlayAll() {
        if (!pr || !pr.notes.length) { return; }
        synCap = 8;
        var c = liveCtx();
        if (!c) return;
        try {
            var g = c.createGain();
            g.gain.value = 0.5;
            g.connect(c.destination);
            scheduleClipNotes(c, g, pr.notes, pr.inst, c.currentTime + 0.06, 0.6);
        } catch (e) { /* ignore */ }
    }

    function openPianoRoll(c) {
        if (!c || !c.notes) return;
        closePianoRoll(false);
        var t = trackById(c.tid);
        /* 把裁剪窗口并进原始音符：off 归零后，卷帘里看到的就是当前听到的 */
        ensureSrc(c);
        if (c.src && c.off > 0) {
            var k, sh = [];
            for (k = 0; k < c.src.length; k++) {
                sh.push({ p: c.src[k].p, t: Math.max(0, c.src[k].t - c.off), d: c.src[k].d, v: c.src[k].v });
            }
            c.src = sh;
            c.off = 0;
            rebuildNotes(c);
        }
        var i, cp = [];
        for (i = 0; i < c.notes.length; i++) {
            cp.push({ p: c.notes[i].p, t: c.notes[i].t, d: c.notes[i].d, v: c.notes[i].v == null ? 100 : c.notes[i].v });
        }
        pr = {
            cid: c.id, notes: cp, dur: c.dur, inst: instById(t && t.inst).id,
            win: null, notesEl: null, gridEl: null, sel: -1, drag: null
        };
        fitRange(cp);

        var win = document.createElement('div');
        win.className = 'addon-window ms-prwin';
        win.innerHTML = prHTML(c);
        pr.win = win;
        prTopLayer().appendChild(win);

        var vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
        var w = Math.min(980, Math.max(520, vw - 60));
        var h = Math.min(620, Math.max(380, vh - 90));
        win.style.position = 'fixed';
        win.style.left = Math.round((vw - w) / 2) + 'px';
        win.style.top = Math.round(Math.max(24, (vh - h) / 2 - 30)) + 'px';
        win.style.width = w + 'px';
        win.style.height = h + 'px';
        win.style.zIndex = '999999';

        pr.gridEl = $('.pr-grid', win);
        pr.notesEl = $('.pr-notes', win);
        prRender();
        bindPrWin();

        try { if (window.__blPop && window.__blPop.in) window.__blPop.in(win); } catch (e) { /* ignore */ }
        try { if (typeof window.__blUnifyFront === 'function') window.__blUnifyFront(); } catch (e2) { /* ignore */ }
    }

    function closePianoRoll(save) {
        if (!pr) return;
        var cid = pr.cid, notes = pr.notes, dur = pr.dur, win = pr.win;
        pr = null;
        if (save) {
            var c = clipById(cid);
            if (c) {
                var cp2 = [];
                for (var q = 0; q < notes.length; q++) {
                    cp2.push({ p: notes[q].p, t: notes[q].t, d: notes[q].d, v: notes[q].v });
                }
                c.notes = notes;
                c.src = cp2;
                c.off = 0;
                c.dur = dur;
                resolveOverlap(c);
                layout();
                refreshClipBar();   /* layout 不刷片段栏，不补这一句音符数会停在旧值 */
                status('乐轨已更新：' + notes.length + ' 个音符');
            }
        }
        if (win && win.parentNode) {
            var out = window.__blPop && window.__blPop.out ? window.__blPop.out : null;
            if (out) {
                try { out(win, function () { if (win.parentNode) win.parentNode.removeChild(win); }); }
                catch (e) { if (win.parentNode) win.parentNode.removeChild(win); }
            } else if (win.parentNode) win.parentNode.removeChild(win);
        }
    }

    function prAddNote(t, m) {
        var d = Math.max(0.05, beatSec());
        var st = prSnapT(t);
        /* 同一音高上时间重叠的音符先清掉：两个块叠在一起既没法点也没法听 */
        var k, keep = [];
        for (k = 0; k < pr.notes.length; k++) {
            var o = pr.notes[k];
            if (o.p === m && o.t < st + d && st < o.t + o.d) continue;
            keep.push(o);
        }
        if (keep.length !== pr.notes.length) pr.notes = keep;
        var n = { p: m, t: st, d: d, v: prVel };
        pr.notes.push(n);
        pr.sel = pr.notes.length - 1;
        if (prAudition) prAuditionNote(m);
        prRender();
        return pr.notes.length - 1;
    }

    function bindPrWin() {
        var win = pr.win, grid = pr.gridEl;

        win.addEventListener('click', function (e) {
            var b = e.target && e.target.closest ? e.target.closest('[data-pract]') : null;
            if (!b) return;
            e.stopPropagation();
            e.preventDefault();
            var a = b.getAttribute('data-pract');
            if (a === 'close') closePianoRoll(false);
            else if (a === 'cancel') closePianoRoll(false);
            else if (a === 'ok') closePianoRoll(true);
            else if (a === 'clear') { pr.notes = []; pr.sel = -1; prRender(); }
            else if (a === 'play') prPlayAll();
            else if (a === 'aud') { prAudition = !prAudition; b.classList.toggle('is-on', prAudition); }
            else if (a === 'zi') { prPx = clamp(prPx * 1.35, 20, 400); prRender(); }
            else if (a === 'zo') { prPx = clamp(prPx / 1.35, 20, 400); prRender(); }
            else if (a === 'min') {
                var T = window.__blDockTray;
                var rid = 'ms-pr';
                if (T && typeof T.add === 'function') {
                    T.add({
                        id: rid, label: '钢琴卷帘',
                        onRestore: function () {
                            win.style.display = '';
                            try { if (T.remove) T.remove(rid); } catch (er3) { /* ignore */ }
                            try { if (window.__blPop && window.__blPop.in) window.__blPop.in(win); } catch (er4) { /* ignore */ }
                        }
                    });
                    win.style.display = 'none';
                } else {
                    win.style.display = 'none';
                }
            } else if (a === 'max') {
                if (win.classList.toggle('is-max')) {
                    pr.rc = win.style.cssText ? { l: win.style.left, t: win.style.top, w: win.style.width, h: win.style.height } : null;
                    win.style.left = '0px'; win.style.top = '0px';
                    win.style.width = '100%'; win.style.height = '100%';
                } else if (pr.rc) {
                    win.style.left = pr.rc.l; win.style.top = pr.rc.t;
                    win.style.width = pr.rc.w; win.style.height = pr.rc.h;
                }
            }
        });

        win.addEventListener('input', function (e) {
            var tg = e.target;
            if (!tg || !tg.getAttribute) return;
            var k = tg.getAttribute('data-pr');
            if (k === 'vel') {
                prVel = +tg.value;
                var n1 = $('.pr-vnum', win); if (n1) n1.textContent = prVel;
                if (pr.sel >= 0 && pr.notes[pr.sel]) { pr.notes[pr.sel].v = prVel; }
            } else if (k === 'len') {
                var b = Math.max(1, Math.min(64, parseFloat(tg.value) || 1));
                pr.dur = b * beatSec();
                prRender();
            }
        });

        win.addEventListener('change', function (e) {
            var tg = e.target;
            if (!tg || !tg.getAttribute) return;
            var k = tg.getAttribute('data-pr');
            if (k === 'snap') { prStep = +tg.value; }
            else if (k === 'inst') {
                pr.inst = tg.value;
                var t = pr.cid ? (clipById(pr.cid) ? trackById(clipById(pr.cid).tid) : null) : null;
                if (t && t.kind === 'inst') t.inst = pr.inst;
                if (prAudition) prAuditionNote(60);
            }
        });

        var keysEl = $('.pr-keys', win);
        if (keysEl) {
            keysEl.addEventListener('pointerdown', function (e2) {
                var kk = e2.target && e2.target.closest ? e2.target.closest('.pr-key') : null;
                if (!kk || !pr) return;
                var mm = parseInt(kk.getAttribute('data-m'), 10);
                if (!isFinite(mm)) return;
                kk.classList.add('is-on');
                setTimeout(function () { kk.classList.remove('is-on'); }, 150);
                if (prAudition) prAuditionNote(mm);
            });
        }

        if (!grid) return;

        grid.addEventListener('pointerdown', function (e) {
            if (!pr) return;
            var r = grid.getBoundingClientRect();
            var x = e.clientX - r.left;
            var y = e.clientY - r.top;
            var nt = e.target && e.target.closest ? e.target.closest('.pr-note') : null;

            /* 双击删音符：grid 的 pointerdown 有 preventDefault，
               浏览器不会再合成 dblclick，只能自己判。 */
            var pnow = Date.now();
            var pkey = nt ? ('n' + nt.getAttribute('data-i')) : 'blank';
            var pDbl = lastPr && lastPr.t && (pnow - lastPr.t) < 420 && lastPr.key === pkey &&
                       Math.abs(e.clientX - lastPr.x) < 6 && Math.abs(e.clientY - lastPr.y) < 6;
            lastPr = { t: pDbl ? 0 : pnow, x: e.clientX, y: e.clientY, key: pkey };
            if (pDbl && nt) {
                var di = +nt.getAttribute('data-i');
                if (di >= 0 && di < pr.notes.length) {
                    pr.notes.splice(di, 1);
                    pr.sel = -1;
                    pr.drag = null;
                    prRender();
                }
                return;
            }

            if (nt) {
                var i = +nt.getAttribute('data-i');
                pr.sel = i;
                var n = pr.notes[i];
                if (!n) return;
                var nr = nt.getBoundingClientRect();
                var mode = (e.clientX - nr.left >= nr.width - 7) ? 'resize' : 'move';
                pr.drag = { mode: mode, i: i, x0: e.clientX, y0: e.clientY, t0: n.t, p0: n.p, d0: n.d };
                prRender();
                if (prAudition && mode === 'move') prAuditionNote(n.p);
            } else {
                var m = prHi - Math.floor(y / prRowH);
                if (m < prLo) m = prLo;
                if (m > prHi) m = prHi;
                var idx = prAddNote(x / prPx, m);
                pr.drag = { mode: 'resize', i: idx, x0: e.clientX, y0: e.clientY, t0: pr.notes[idx].t, p0: m, d0: pr.notes[idx].d };
            }
            try { grid.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
            e.preventDefault();
        });

        grid.addEventListener('pointermove', function (e) {
            if (!pr || !pr.drag) return;
            var d = pr.drag, n = pr.notes[d.i];
            if (!n) return;
            if (d.mode === 'move') {
                var dt = (e.clientX - d.x0) / prPx;
                var nt2 = prSnapT(d.t0 + dt);
                n.t = Math.max(0, nt2);
                var dy = Math.round((e.clientY - d.y0) / prRowH);
                n.p = clamp(d.p0 - dy, 0, 127);
                if (pr.audLast !== n.p) { pr.audLast = n.p; if (prAudition) prAuditionNote(n.p); }
                var el = pr.notesEl.querySelector('.pr-note[data-i="' + d.i + '"]');
                if (el) {
                    el.style.left = (n.t * prPx).toFixed(1) + 'px';
                    el.style.top = ((prHi - n.p) * prRowH) + 'px';
                    el.title = mname(n.p);
                }
            } else {
                var dd = (e.clientX - d.x0) / prPx;
                n.d = clamp(d.d0 + dd, 0.05, 32);
                var el2 = pr.notesEl.querySelector('.pr-note[data-i="' + d.i + '"]');
                if (el2) el2.style.width = Math.max(8, n.d * prPx).toFixed(1) + 'px';
            }
        });

        var up = function () { if (pr) { pr.drag = null; pr.audLast = -1; prRender(); } };
        grid.addEventListener('pointerup', up);
        grid.addEventListener('pointercancel', up);

        /* 删音符挂在 pointerdown 的双击判定里（见上），这里不再重复处理 */
    }

    /* 在乐器轨上新建一个乐轨，然后立刻打开钢琴卷帘 */
    function createNoteClip(tid, start) {
        var t = trackById(tid);
        if (!t || t.kind !== 'inst') { status('只有乐器轨能创建乐轨', true); return null; }
        var n = 0, i;
        for (i = 0; i < clips.length; i++) if (clips[i].tid === tid) n++;
        var st = Math.max(0, snap ? Math.round((start || 0) / beatSec()) * beatSec() : (start || 0));
        if (st < nextSlot(tid, barSec() * 2) && start == null) st = nextSlot(tid, barSec() * 2);
        var c = {
            id: nextCid++, tid: tid, start: st, off: 0,
            dur: barSec() * 2, buf: null, notes: [], src: [],
            name: '乐轨' + (n + 1), gain: 100, fin: 0, fout: 0,
            peaks: null, peakW: 0
        };
        clips.push(c);
        resolveOverlap(c);
        selId = c.id;
        refreshClipBar();
        layout();
        openPianoRoll(c);
        return c;
    }

    /* ---------------- 自动编曲 ---------------- */

    var KEYS = [0, 2, 4, 5, 7, 9, 11];
    /* 和弦进行：[根音偏移, 大调 M / 小调 m] */
    var PROGS = [
        [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']],
        [[9, 'm'], [5, 'M'], [0, 'M'], [7, 'M']],
        [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']],
        [[0, 'M'], [5, 'M'], [7, 'M'], [9, 'm']],
        [[2, 'm'], [7, 'M'], [0, 'M'], [5, 'M']]
    ];
    var MELPAT = [[0, 1, 2, 3, 2], [2, 1, 0, 1, 2], [0, 2, 1, 3, 1], [1, 2, 3, 2, 0]];
    var MELRH = [0, 1, 1.5, 2, 3];
    /* at = 从第几小节进，编出来各轨错开进场，时间轴上不会挤成一列 */
    var ARRANGE = [
        { i: 'choir', role: 'melody', at: 2, vol: 92, rev: 26 },
        { i: 'bpiano', role: 'chord', at: 1, vol: 74, rev: 18 },
        { i: 'drums', role: 'drum', at: 0, vol: 82, rev: 8 },
        { i: 'abass', role: 'bass', at: 0, vol: 96, rev: 6 },
        { i: 'violin', role: 'top', at: 2, vol: 66, rev: 30 },
        { i: 'viola', role: 'pad', at: 2, vol: 60, rev: 30 },
        { i: 'mbox', role: 'arp', at: 4, vol: 62, rev: 34 },
        { i: 'ebass', role: 'bass2', at: 1, vol: 78, rev: 8 }
    ];

    function triadOf(type) { return type === 'm' ? [0, 3, 7] : [0, 4, 7]; }

    function buildPart(role, prog, keyoff, bars, bs, brs, at) {
        var ns = [], b, k;
        function P(m, t, d, v) {
            ns.push({
                p: clamp(Math.round(m), 24, 100),
                t: Math.max(0, t), d: Math.max(0.06, d),
                v: clamp(Math.round(v), 20, 127)
            });
        }
        for (b = at; b < bars; b++) {
            var ch = prog[b % prog.length];
            var tt = triadOf(ch[1]);
            var ro = (ch[0] + keyoff) % 12;
            var t0 = (b - at) * brs;

            if (role === 'drum') {
                P(36, t0, 0.42, 112);
                P(36, t0 + 2 * bs, 0.42, 104);
                P(36, t0 + 2.75 * bs, 0.30, 88);
                P(38, t0 + bs, 0.34, 100);
                P(38, t0 + 3 * bs, 0.34, 100);
                for (k = 0; k < 8; k++) P(42, t0 + k * 0.5 * bs, 0.12, (k % 2) ? 58 : 84);
                P(46, t0 + 3.5 * bs, 0.30, 78);
                if ((b % 4) === 3) {
                    P(41, t0 + 3 * bs, 0.20, 92);
                    P(43, t0 + 3.25 * bs, 0.20, 92);
                    P(45, t0 + 3.5 * bs, 0.20, 96);
                }
                continue;
            }
            if (role === 'bass') {
                var r1 = 36 + ro;
                P(r1, t0, bs * 1.4, 104);
                P(r1, t0 + 2 * bs, bs * 1.4, 92);
                P(r1 + 7, t0 + 3 * bs, bs * 0.8, 84);
                continue;
            }
            if (role === 'bass2') {
                var r2 = 36 + ro;
                for (k = 0; k < 8; k += 2) P(r2 + (k === 6 ? 7 : 0), t0 + k * 0.5 * bs, bs * 0.42, k === 0 ? 104 : 86);
                continue;
            }
            if (role === 'chord') {
                var rc = 60 + ro, j;
                for (j = 0; j < tt.length; j++) {
                    P(rc + tt[j], t0, bs * 1.85, 84 - j * 4);
                    P(rc + tt[j], t0 + 2 * bs, bs * 1.85, 74 - j * 4);
                }
                continue;
            }
            if (role === 'top') {
                var rt = 72 + ro;
                P(rt + tt[2], t0, brs * 0.92, 80);
                P(rt + tt[1] + 12, t0 + 2 * bs, bs * 1.8, 66);
                continue;
            }
            if (role === 'pad') {
                var rp = 55 + ro;
                P(rp + tt[0], t0, brs * 0.94, 68);
                P(rp + tt[1], t0, brs * 0.94, 58);
                continue;
            }
            if (role === 'arp') {
                var ra = 84 + ro;
                for (k = 0; k < 8; k++) {
                    var idx = k % 4, oct = k >= 4 ? 12 : 0;
                    P(ra + tt[idx % tt.length] + oct, t0 + k * 0.5 * bs, bs * 0.45, k % 2 ? 58 : 70);
                }
                continue;
            }
            /* melody */
            var rm = 72 + ro;
            var pat = MELPAT[b % MELPAT.length];
            for (k = 0; k < MELRH.length; k++) {
                var dg = pat[k % pat.length];
                P(rm + tt[dg % tt.length] + (dg >= 3 ? 12 : 0), t0 + MELRH[k] * bs, bs * 0.85, 90 - k * 3);
            }
        }
        return ns;
    }

    function arrange() {
        var bs = beatSec(), brs = barSec(), bars = 8, i;
        var prog = PROGS[Math.floor(Math.random() * PROGS.length)];
        var keyoff = KEYS[Math.floor(Math.random() * KEYS.length)];
        tracks = [];
        clips = [];
        selId = null;
        nextTid = 1;
        nextCid = 1;
        for (i = 0; i < ARRANGE.length; i++) {
            var a = ARRANGE[i];
            var ins = instById(a.i);
            var at = Math.min(a.at, bars - 1);
            var t = {
                id: nextTid++, name: ins.n, vol: a.vol, mute: false, solo: false,
                kind: 'inst', inst: ins.id, rev: a.rev
            };
            tracks.push(t);
            var ns = buildPart(a.role, prog, keyoff, bars, bs, brs, at);
            if (!ns.length) continue;
            clips.push({
                id: nextCid++, tid: t.id, start: at * brs, off: 0,
                dur: (bars - at) * brs, buf: null, notes: ns,
                name: '片段' + (i + 1), gain: 100, fin: 0, fout: 0,
                peaks: null, peakW: 0
            });
        }
        rendered = null;
        pxPerSec = clamp(pxPerSec, 28, 110);
        layout();
        refreshClipBar();
        movePlayhead(0);
        status('已生成编曲：' + tracks.length + ' 条乐器轨 · ' + bars + ' 小节 · ' +
               NOTE_NAMES[keyoff] + ' 调 · ' + fmtT(projectDur()));
        /* 后台先渲一遍，点「播放」时就不用等 —— 渲染完会自动存进缓存 */
        setTimeout(function () { renderMix(function () { /* 预渲染，结果进缓存 */ }); }, 60);
    }

    /* ---------------- MIDI 导出 ---------------- */

    function vlq(v) {
        var out = [], x = v < 0 ? 0 : Math.floor(v);
        out.unshift(x & 0x7f);
        x >>= 7;
        while (x > 0) { out.unshift((x & 0x7f) | 0x80); x >>= 7; }
        return out;
    }

    function u32b(n) { return [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]; }

    function dlBlob(bytes, name, mime) {
        try {
            var bl = new Blob([bytes], { type: mime || 'application/octet-stream' });
            var u = URL.createObjectURL(bl);
            var a = document.createElement('a');
            a.href = u;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                if (a.parentNode) a.parentNode.removeChild(a);
                try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ }
            }, 400);
            return true;
        } catch (e) { return false; }
    }

    /* 生成标准 MIDI 文件（格式 0）的字节；没有音符轨时返回 null */
    function midiBytes() {
        var i, j, k, ev = [], tpq = 480, ch = 0, used = 0;
        for (i = 0; i < tracks.length; i++) {
            var t = tracks[i];
            if (t.kind !== 'inst') continue;
            var has = false;
            for (j = 0; j < clips.length; j++) {
                if (clips[j].tid === t.id && clips[j].notes && clips[j].notes.length) has = true;
            }
            if (!has) continue;
            var ins = instById(t.inst);
            var chan;
            if (ins.kind === 'drum') chan = 9;
            else {
                if (ch === 9) ch = 10;          /* 9 号通道留给鼓 */
                chan = ch;
                ch++;
                if (ch > 15) ch = 10;
            }
            used++;
            ev.push([0, [0xC0 | (chan & 15), ins.gm & 127]]);
            for (j = 0; j < clips.length; j++) {
                var c = clips[j];
                if (c.tid !== t.id || !c.notes) continue;
                for (k = 0; k < c.notes.length; k++) {
                    var n = c.notes[k];
                    var t1 = Math.round(((c.start + n.t) / beatSec()) * tpq);
                    var t2 = Math.round(((c.start + n.t + n.d) / beatSec()) * tpq);
                    if (t2 <= t1) t2 = t1 + 1;
                    var pp = clamp(Math.round(n.p), 0, 127);
                    var vv = clamp(Math.round(n.v == null ? 100 : n.v), 1, 127);
                    ev.push([t1, [0x90 | (chan & 15), pp, vv]]);
                    ev.push([t2, [0x80 | (chan & 15), pp, 0x40]]);
                }
            }
        }
        if (!used) return null;

        var uspb = Math.round(60000000 / clamp(bpm, 20, 400));
        ev.push([0, [0xFF, 0x51, 0x03, (uspb >> 16) & 255, (uspb >> 8) & 255, uspb & 255]]);
        ev.sort(function (a, b2) { return a[0] - b2[0]; });

        var data = [], last = 0;
        for (i = 0; i < ev.length; i++) {
            data = data.concat(vlq(Math.max(0, ev[i][0] - last)), ev[i][1]);
            last = ev[i][0];
        }
        data = data.concat(vlq(0), [0xFF, 0x2F, 0x00]);

        var bytes = [0x4D, 0x54, 0x68, 0x64].concat(u32b(6), [0, 0, 0, 1, (tpq >> 8) & 255, tpq & 255],
            [0x4D, 0x54, 0x72, 0x6B], u32b(data.length), data);
        var arr = new Uint8Array(bytes.length);
        for (i = 0; i < bytes.length; i++) arr[i] = bytes[i] & 255;
        return arr;
    }

    function exportMidi() {
        var arr = midiBytes();
        if (!arr) { status('没有可导出的乐轨 —— MIDI 只导出音符轨', true); return; }
        var nm = (projName || 'music').replace(/[\\/:*?"<>|]/g, '_') + '.mid';
        if (dlBlob(arr, nm, 'audio/midi')) status('已导出 MIDI：' + nm + ' · ' + arr.length + ' 字节');
        else status('导出失败', true);
    }

    /* ---------------- 导出 ---------------- */

    function getVM() {
        var vm = window.vm;
        if (vm && vm.runtime) return vm;
        try {
            var store = window.ReduxStore || window.__REDUX_STORE__ || null;
            if (store && store.getState) {
                var st = store.getState();
                if (st && st.scratchGui && st.scratchGui.vm) return st.scratchGui.vm;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function storeBytes(vm, type, fmt, bytes) {
        var st = vm && vm.runtime && vm.runtime.storage;
        if (!st) return null;
        try {
            if (st.builtinHelper && typeof st.builtinHelper._store === 'function') {
                return st.builtinHelper._store(type, fmt, bytes);
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    var NOTE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
        '<circle cx="60" cy="60" r="52" fill="#4c97ff" opacity="0.16"/>' +
        '<path d="M46 86V34l38-9v52" fill="none" stroke="#4c97ff" stroke-width="7" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="36" cy="88" r="11" fill="#4c97ff"/>' +
        '<circle cx="74" cy="79" r="11" fill="#4c97ff"/>' +
        '</svg>';

    function utf8(str) {
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
        var out = [], i, c;
        for (i = 0; i < str.length; i++) {
            c = str.charCodeAt(i);
            if (c < 0x80) out.push(c);
            else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
            else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        }
        return new Uint8Array(out);
    }

    function encodeWav(buf) {
        var nch = buf.numberOfChannels;
        var len = buf.length;
        var sr = buf.sampleRate;
        var bytes = 44 + len * nch * 2;
        var ab = new ArrayBuffer(bytes);
        var v = new DataView(ab);
        var p = 0, i, ch;

        function s32(x) { v.setUint32(p, x, true); p += 4; }
        function s16(x) { v.setUint16(p, x, true); p += 2; }
        function str(x) { for (var k = 0; k < x.length; k++) { v.setUint8(p, x.charCodeAt(k)); p++; } }

        str('RIFF'); s32(bytes - 8); str('WAVE');
        str('fmt '); s32(16); s16(1); s16(nch); s32(sr);
        s32(sr * nch * 2); s16(nch * 2); s16(16);
        str('data'); s32(len * nch * 2);

        var chans = [];
        for (ch = 0; ch < nch; ch++) chans.push(buf.getChannelData(ch));
        for (i = 0; i < len; i++) {
            for (ch = 0; ch < nch; ch++) {
                var x2 = clamp(chans[ch][i], -1, 1);
                v.setInt16(p, x2 < 0 ? x2 * 0x8000 : x2 * 0x7fff, true);
                p += 2;
            }
        }
        return new Blob([ab], { type: 'audio/wav' });
    }

    function toSprite() {
        renderMix(function (out, err) {
            if (!out) { status(err || '导出失败', true); return; }
            var vm = getVM();
            if (!vm) { status('编辑器尚未就绪，稍后再试', true); return; }
            var st = vm.runtime && vm.runtime.storage;
            if (!st || !st.AssetType) { status('无法访问素材存储', true); return; }
            var blob = encodeWav(out);
            var fr = new FileReader();
            fr.onload = function () {
                try {
                    var cId = storeBytes(vm, st.AssetType.ImageVector, 'svg', utf8(NOTE_SVG));
                    var sId = storeBytes(vm, st.AssetType.Sound, 'wav', new Uint8Array(fr.result));
                    if (!cId || !sId) { status('写入素材失败', true); return; }
                    var nm = projName || '我的音乐';
                    var json = {
                        name: nm, isStage: false,
                        costumes: [{
                            name: nm, dataFormat: 'svg', assetId: cId, md5ext: cId + '.svg',
                            rotationCenterX: 60, rotationCenterY: 60, bitmapResolution: 1
                        }],
                        sounds: [{
                            name: nm, assetId: sId, md5ext: sId + '.wav',
                            dataFormat: 'wav', format: '', rate: out.sampleRate, sampleCount: out.length
                        }],
                        blocks: {}, variables: {}, lists: {}, broadcasts: {}, comments: {},
                        currentCostume: 0, volume: 100, layerOrder: 0, tempo: 60,
                        visible: true, x: 0, y: 0, size: 100, direction: 90,
                        draggable: false, rotationStyle: 'all around',
                        videoTransparency: 50, videoState: 'on', textToSpeechLanguage: null
                    };
                    var p2 = vm.addSprite(json);
                    Promise.resolve(p2).then(function () {
                        status('已导入角色栏：' + nm);
                    }).catch(function () { status('导入失败，可重试一次', true); });
                } catch (e) {
                    status('导入失败：' + (e && e.message ? e.message : '未知错误'), true);
                }
            };
            fr.onerror = function () { status('导出失败', true); };
            fr.readAsArrayBuffer(blob);
        });
    }

    function download() {
        renderMix(function (out, err) {
            if (!out) { status(err || '导出失败', true); return; }
            var blob = encodeWav(out);
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = (projName || '我的音乐') + '.wav';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
            status('已下载 ' + fmtSize(blob.size));
        });
    }

    /* ---------------- 挂载 ---------------- */

    function show(on) {
        if (!hostEl || !panel || !tabEl) return;
        if (on) {
            hostEl.classList.add('ms-active');
            tabEl.classList.add('is-on');
            /* 舞台那一栏整列让出来：音乐编辑器吃掉这部分宽度，
               时间轴才有地方往右铺、往右划。
               挂在 html 上是因为舞台在另一棵子树里，.ms-active 够不到。 */
            try { document.documentElement.classList.add('ms-music-on'); } catch (e) { /* ignore */ }
            /* ⚠ 光把舞台藏掉还不够宽：flex 子项默认 min-width:auto，
               不会缩到 min-content 以下。泳道一铺到 1536px，整个 tabs
               容器就被顶到 1732px（比视口还宽），.ms-tl 自己跟着变宽，
               overflow:auto 反而永远没有可滚的距离 —— 往右划不动。
               放开 min-width 让它能缩回视口宽度，多出来的才变成滚动区。 */
            try {
                hostEl.style.minWidth = '0';
                hostEl.style.maxWidth = '100%';
            } catch (e) { /* ignore */ }
            window.setTimeout(function () { layout(); relayoutClips(); }, 30);
            window.setTimeout(function () { layout(); relayoutClips(); }, 220);
        } else {
            hostEl.classList.remove('ms-active');
            tabEl.classList.remove('is-on');
            try { document.documentElement.classList.remove('ms-music-on'); } catch (e) { /* ignore */ }
            try { hostEl.style.minWidth = ''; hostEl.style.maxWidth = ''; } catch (e) { /* ignore */ }
            if (playing) { playing = false; setPlayBtn(false); stopNode(); }
        }
    }

    function mount() {
        var ul = document.querySelector('ul[class*="gui_tab-list_"]');
        if (!ul) return false;
        if (tabEl && tabEl.parentNode) return true;

        hostEl = ul.parentElement;
        if (!hostEl) return false;
        if (!hostEl.querySelector('[class*="gui_tab-panel_"]') && hostEl.parentElement &&
            hostEl.parentElement.querySelector('[class*="gui_tab-panel_"]')) {
            hostEl = hostEl.parentElement;
        }

        if (!panel) buildPanel();
        /* 默认给一条乐轨：这个界面主要就是写旋律的，
           音轨在拖入音频时自动建（见 audioTarget） */
        if (!tracks.length) addTrack('乐轨1', 'inst');

        tabEl = document.createElement('li');
        tabEl.className = 'gui_tab_27Unf ms-tab';
        tabEl.setAttribute('role', 'tab');
        tabEl.innerHTML = MUSIC_ICON + '<span>音乐</span>';
        tabEl.addEventListener('click', function (e) {
            e.stopPropagation();
            show(true);
        });
        ul.appendChild(tabEl);

        ul.addEventListener('click', function (e) {
            if (tabEl && (e.target === tabEl || tabEl.contains(e.target))) return;
            show(false);
        }, true);

        if (panel.parentNode !== hostEl) hostEl.appendChild(panel);
        return true;
    }

    function boot() {
        var tries = 0;
        var timer = window.setInterval(function () {
            try {
                if (mount()) { window.clearInterval(timer); return; }
            } catch (e) { /* ignore */ }
            if (++tries > 120) window.clearInterval(timer);
        }, 600);
        try { mount(); } catch (e2) { /* ignore */ }

        window.addEventListener('resize', function () {
            if (!hostEl || !hostEl.classList.contains('ms-active')) return;
            fitPanel();
            drawRuler();
            relayoutClips();
        });

        /* 兜底：只要"当前该画的"和"已经画过的"对不上就补一次。
           面板挂载 / 布局 / 导入 谁先谁后都不重要，最多 600ms 内一定出现。 */
        window.setInterval(function () {
            if (!hostEl || !hostEl.classList.contains('ms-active')) return;
            if (!lanesEl || !clips.length) return;
            var key = pxPerSec + ':' + clips.length + ':' + projectDur().toFixed(3) +
                      ':' + (tlEl ? tlEl.clientWidth : 0);
            if (key !== waveKey) {
                waveKey = key;
                layout();
                relayoutClips();
            }
        }, 600);
    }

    /* 供外部（测试）使用 */
    window.__blMusic = {
        addTrack: addTrack,
        addClip: addClip,
        clips: function () { return clips; },
        tracks: function () { return tracks; },
        layout: layout,
        show: show,
        dolly: setZoom,
        renderMix: renderMix,
        arrange: arrange,
        midiBytes: midiBytes,
        insts: function () { return INSTRUMENTS; }
    };

    boot();
    if (window.__blSync) window.__blSync.register('B35-music', mount);
})();

