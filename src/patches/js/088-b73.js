/* ── [B73] 工具箱运行时 + 全局收口 ───────────────────────────────────────────────
   依赖：B41 / B48 / B42
   维护：7 个工具弹窗、图层统一、右键菜单动画、主题变量直连、版本历史
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * DOCK「工具箱」 toolbox.js
 * --------------------------------------------------------------------------
 * 七个工具全部是独立弹窗：作品比较 / 帧率 / 性能模式 / 录制舞台 /
 * 屏幕滤镜 / 性能 / 作品格式转换。命名空间 tb-，不复用编辑器的 addon-window 体系。
 *
 * 设计要点：
 *  · 窗口自己管理拖动、最小化（收进 DOCK 托盘）、最大化、关闭与清理，
 *    不依赖任何先把窗口注册进 initWindows 的时序。
 *  · 所有状态写 localStorage，刷新后自动恢复（性能模式 / 滤镜）。
 *  · 任何一步失败都只给出界面提示，不向控制台抛异常。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blToolbox) return;

    /* ---------------- 语言 ---------------- */
    function isZh() {
        try {
            var l = (document.documentElement.lang || '').toLowerCase();
            if (l.indexOf('zh') === 0) return true;
            if (l.indexOf('en') === 0) return false;
        } catch (e) { /* ignore */ }
        try { return /工具箱|保存当前项目|还没有保存的项目/.test(document.body.innerText || ''); }
        catch (e2) { return false; }
    }
    function T(zh, en) { return isZh() ? zh : en; }

    /* ---------------- 小工具 ---------------- */
    function esc(x) {
        return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }
    function icon(path, size) {
        return '<svg class="tb-head-ico" viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) +
            '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
    }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function fmtTime(ms) {
        var s = Math.floor(ms / 1000);
        return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
    }
    function fmtBytes(n) {
        if (!n || n < 0) return '—';
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(2) + ' MB';
    }
    function num(n, d) { return (Math.round(n * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toFixed(d || 0); }
    function lsGet(key, def) {
        try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
        catch (e) { return def; }
    }
    function lsSet(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
    }
    function download(blob, name) {
        try {
            var u = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = u; a.download = name; document.body.appendChild(a); a.click();
            setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(u); }, 1500);
        } catch (e) { /* ignore */ }
    }
    function getVM() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            return (st && st.scratchGui && st.scratchGui.vm) || null;
        } catch (e) { return null; }
    }
    function stageCanvas() {
        /* 常规路径：VM renderer 的画布 */
        try {
            var v = getVM();
            if (v && v.renderer && v.renderer.canvas && v.renderer.canvas.width) return v.renderer.canvas;
        } catch (e) { /* ignore */ }
        /* 回退：某些构建把画布挂在 DOM 而不暴露 renderer（或 renderer 尚未初始化） */
        try {
            var list = document.querySelectorAll('canvas'), best = null, area = 0;
            for (var i = 0; i < list.length; i++) {
                var c = list[i], r = c.getBoundingClientRect();
                var cls = String(c.className || '') + ' ' + String(c.parentElement && c.parentElement.className || '');
                if (/stage/i.test(cls) && c.width && c.height) return c;
                var a = r.width * r.height;
                if (a > area && c.width && c.height) { best = c; area = a; }
            }
            if (best && area > 10000) return best;
        } catch (e2) { /* ignore */ }
        return null;
    }
    var nativeRAF = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null;
    var nativeCAF = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : null;

    /* ---------------- 通用窗口管理 ---------------- */
    var Wins = Object.create(null);
    /* zTop 已废弃：层级交给 __blUnifyFront（OVER_HOST_Z=999999）。 */
    var cascade = 0;
    var LAYER = null;

    function filterLayer() {
        if (LAYER && LAYER.parentNode) return LAYER;
        LAYER = el('div', 'tb-layer');
        LAYER.id = 'tbFilterLayer';
        document.body.appendChild(LAYER);
        return LAYER;
    }

    var ICO = {
        min: '<line x1="5" y1="12" x2="19" y2="12"/>',
        max: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
        close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'
    };

    /* 第 32 轮：工具箱窗口和原版弹窗共用同一套图层管理。
       点谁谁到最前 —— unifyFront 会把该窗口抬到 OVER_HOST_Z，
       同时把其它越到宿主之上的原版单元降回 8001+ 原生区间。
       旧实现自增 200000+ 反而低于原版弹窗的 999999，且被
       isForeignZ 判定为「外来高值」直接跳过，永远置不了顶。 */
    function bring(w) {
        if (!w) return;
        try {
            if (window.__blUnifyFront) { window.__blUnifyFront(w); return; }
        } catch (e) { /* ignore */ }
        /* 退化路径（统一置顶尚未安装时）：仍待在原生区间，不用极高值 */
        var max = 8000, i, z, list;
        try {
            list = document.querySelectorAll('.addon-window, [class*="modal-window"]');
            for (i = 0; i < list.length; i++) {
                if (list[i] === w) continue;
                z = parseInt(list[i].style.zIndex, 10);
                if (!isNaN(z) && z > max && z <= 999999) max = z;
            }
        } catch (e2) { /* ignore */ }
        w.style.zIndex = String(Math.min(max + 1, 999999));
    }

    function tray() { return window.__blDockTray || null; }

    function restoreWin(id) {
        var w = Wins[id];
        if (!w) return;
        var t = tray();
        if (t && t.remove) { try { t.remove('tb-' + id); } catch (e) { /* ignore */ } }
        w.classList.remove('tb-hidden', 'tb-mini');
        bring(w);
    }

    function minimizeWin(id, w, title, ico) {
        var t = tray();
        var ok = false;
        if (t && t.add) {
            try {
                ok = t.add({
                    id: 'tb-' + id,
                    label: title,
                    svg: ico || '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
                    onRestore: function () { restoreWin(id); }
                });
            } catch (e) { ok = false; }
        }
        if (ok) w.classList.add('tb-hidden');
        else w.classList.add('tb-mini');       /* DOCK 被隐藏时的降级 */
    }

    function closeWin(id) {
        var w = Wins[id];
        if (!w) return;
        var t = tray();
        if (t && t.remove) { try { t.remove('tb-' + id); } catch (e) { /* ignore */ } }
        (w.__tbClean || []).forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
        w.classList.add('tb-closing');
        var node = w;
        var drop = function () { if (node.parentNode) node.parentNode.removeChild(node); };
        var P = window.__blPop;
        if (P && P.out) { try { P.out(node, drop); } catch (e) { setTimeout(drop, 150); } }
        else setTimeout(drop, 150);
        delete Wins[id];
    }

    /* ---------- 与原版一致的最大化动画 / 8 方向缩放 ---------- */
    function tbReduceMotion() {
        try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
        catch (e) { return false; }
    }
    function tbRect(w) {
        var r = w.getBoundingClientRect();
        return { l: r.left + 'px', t: r.top + 'px', w: r.width + 'px', h: r.height + 'px' };
    }
    function tbApplyRect(w, r) {
        w.style.left = r.l; w.style.top = r.t;
        w.style.width = r.w; w.style.height = r.h;
    }
    function px(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
    function tbAnimateRect(w, from, to, done) {
        var finish = function () {
            try { w.classList.remove('tb-anim'); } catch (e) { /* ignore */ }
            w.__tbAnimating = false;
            tbApplyRect(w, to);
            if (done) done();
        };
        if (tbReduceMotion()) { finish(); return; }
        w.__tbAnimating = true;
        w.classList.add('tb-anim');
        /* 入场动画残留类带 90ms 尺寸过渡，会抢我们写的 inline 值 */
        try { w.classList.remove('bl-pop-anim'); } catch (e) { /* ignore */ }
        var a = { l: px(from.l), t: px(from.t), w: px(from.w), h: px(from.h) };
        var z = { l: px(to.l), t: px(to.t), w: px(to.w), h: px(to.h) };
        var DUR = 220, t0 = 0;
        function frame(now) {
            if (!t0) t0 = now;
            var k = Math.min(1, (now - t0) / DUR);
            var e = 1 - Math.pow(1 - k, 3);       /* easeOutCubic */
            w.style.left   = (a.l + (z.l - a.l) * e).toFixed(1) + 'px';
            w.style.top    = (a.t + (z.t - a.t) * e).toFixed(1) + 'px';
            w.style.width  = (a.w + (z.w - a.w) * e).toFixed(1) + 'px';
            w.style.height = (a.h + (z.h - a.h) * e).toFixed(1) + 'px';
            if (k < 1) setTimeout(function () { frame(performance.now()); }, 16);
            else finish();
        }
        frame(performance.now());
    }

    function tbToggleMax(w) {
        if (w.__tbAnimating) return;   /* 220ms 动画期间忽略连点，避免读到中间态 */
        /* 入场动画残留的 bl-pop-anim 带 90ms 尺寸过渡，会和最大化过渡抢 */
        try { w.classList.remove('bl-pop-anim'); } catch (e) { /* ignore */ }
        var vw = window.innerWidth, vh = window.innerHeight;
        if (w.classList.contains('is-max')) {
            var back = w.__tbRect || { l: '80px', t: '80px', w: '520px', h: '400px' };
            var from = tbRect(w);
            w.classList.remove('is-max');
            tbAnimateRect(w, from, back, null);
        } else {
            var cur = tbRect(w);
            w.__tbRect = { l: cur.l, t: cur.t, w: cur.w, h: cur.h };
            var full = { l: '0px', t: '0px', w: vw + 'px', h: vh + 'px' };
            tbAnimateRect(w, cur, full, function () { w.classList.add('is-max'); });
        }
    }

    function openWin(id, title, opt) {
        opt = opt || {};
        var w0 = Wins[id];
        if (w0) {
            restoreWin(id);
            try { if (w0.animate) w0.animate([{ transform: 'scale(.98)' }, { transform: 'none' }], { duration: 140 }); }
            catch (e) { /* ignore */ }
            return w0;
        }
        var vw = window.innerWidth, vh = window.innerHeight;
        /* 先按视口夹一次，避免小机型/缩放后窗口比屏幕还大导致错位 */
        var W = Math.min(opt.w || 520, vw - 20);
        var H = Math.min(opt.h || 400, vh - 20);
        var left = Math.max(10, Math.round((vw - W) / 2) + (cascade % 5) * 22 - 44);
        var top = Math.max(10, Math.round((vh - H) / 2) + (cascade % 5) * 18 - 36);
        cascade++;
        /* 带上原版窗口类名：外观 / 按钮 / 预设 / 玻璃 / 动画的所有
           运行时样式表都按 .addon-window 选中，这一行让七个工具窗
           与编辑器原生弹窗共用同一套视觉与设置。 */
        var w = el('div', 'tb-win addon-window');
        w.setAttribute('data-tb', id);
        w.style.width = W + 'px'; w.style.height = H + 'px';
        w.style.left = Math.min(left, vw - W - 10) + 'px';
        w.style.top = Math.min(top, vh - H - 10) + 'px';
        bring(w);

        var head = el('div', 'tb-head addon-window-header');
        head.innerHTML = icon(opt.ico || '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>', 18) +
            '<div class="tb-head-t addon-window-title">' + esc(title) + '</div>';
        var btns = el('div', 'tb-head-btns addon-window-controls');
        ['min', 'max', 'close'].forEach(function (k) {
            var nativeCls = k === 'min' ? 'minimize' : (k === 'max' ? 'maximize' : 'close');
            var b = el('button', 'tb-hbtn addon-window-btn addon-window-btn-' + nativeCls +
                (k === 'close' ? ' tb-close' : ''),
                '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" ' +
                'stroke-linecap="round" stroke-linejoin="round">' + ICO[k] + '</svg>');
            b.type = 'button';
            b.setAttribute('title', k === 'min' ? T('最小化', 'Minimize') : k === 'max' ? T('最大化', 'Maximize') : T('关闭', 'Close'));
            b.addEventListener('click', function (e) {
                e.stopPropagation();
                if (k === 'close') { closeWin(id); return; }
                if (k === 'min') { minimizeWin(id, w, title, opt.trayIco); return; }
                tbToggleMax(w);
            });
            btns.appendChild(b);
        });
        head.appendChild(btns);
        w.appendChild(head);

        var body = el('div', 'tb-body addon-window-content');
        w.appendChild(body);
        /* 8 方向缩放手柄（原版窗口有，工具箱补齐） */
        ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].forEach(function (d) {
            w.appendChild(el('div', 'resize-handle resize-' + d));
        });
        w.__tbClean = [];
        document.body.appendChild(w);
        Wins[id] = w;

        /* 标题栏拖动；避开三键，坐标用 fixed 直接写 */
        var drag = null;
        head.addEventListener('pointerdown', function (e) {
            if (e.target.closest && e.target.closest('.tb-hbtn')) return;
            if (w.classList.contains('is-max')) return;
            var r = w.getBoundingClientRect();
            drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
            bring(w);
            try { head.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            e.preventDefault();
        });
        head.addEventListener('pointermove', function (e) {
            if (!drag || e.pointerId !== drag.id) return;
            var x = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - drag.dx));
            var y = Math.max(0, Math.min(window.innerHeight - 42, e.clientY - drag.dy));
            w.style.left = x + 'px'; w.style.top = y + 'px';
        });
        ['pointerup', 'pointercancel'].forEach(function (ev) {
            head.addEventListener(ev, function () { drag = null; });
        });
        /* 双击标题栏：还原 / 最大化 */
        head.addEventListener('dblclick', function (e) {
            if (e.target.closest && e.target.closest('.tb-hbtn')) return;
            head.querySelector('[title="' + T('最大化', 'Maximize') + '"]') &&
                head.querySelector('[title="' + T('最大化', 'Maximize') + '"]').click();
        });
        w.addEventListener('pointerdown', function () { bring(w); }, true);

        /* 8 方向缩放：与原版窗口的手柄行为一致，最大化/小屏时禁用 */
        (function () {
            var dirs = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
            dirs.forEach(function (d) {
                var h = w.querySelector('.resize-' + d);
                if (!h) return;
                h.addEventListener('pointerdown', function (e) {
                    if (w.classList.contains('is-max') || window.innerWidth <= 900) return;
                    if (e.button !== 0) return;
                    e.stopPropagation(); e.preventDefault();
                    var r = w.getBoundingClientRect();
                    var st = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, w: r.width, h: r.height };
                    try { h.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
                    var move = function (ev) {
                        var dx = ev.clientX - st.x, dy = ev.clientY - st.y;
                        var L = st.l, T = st.t, W = st.w, H = st.h;
                        if (d.indexOf('e') >= 0) W = Math.max(300, st.w + dx);
                        if (d.indexOf('s') >= 0) H = Math.max(180, st.h + dy);
                        if (d.indexOf('w') >= 0) { W = Math.max(300, st.w - dx); L = st.l + st.w - W; }
                        if (d.indexOf('n') >= 0) { H = Math.max(180, st.h - dy); T = st.t + st.h - H; }
                        W = Math.min(W, window.innerWidth - 12);
                        H = Math.min(H, window.innerHeight - 12);
                        w.style.left = L + 'px'; w.style.top = T + 'px';
                        w.style.width = W + 'px'; w.style.height = H + 'px';
                        if (w.__tbRect) w.__tbRect = { l: L + 'px', t: T + 'px', w: W + 'px', h: H + 'px' };
                    };
                    var end = function () {
                        h.removeEventListener('pointermove', move);
                        h.removeEventListener('pointerup', end);
                        h.removeEventListener('pointercancel', end);
                    };
                    h.addEventListener('pointermove', move);
                    h.addEventListener('pointerup', end);
                    h.addEventListener('pointercancel', end);
                });
            });
        })();

        try { if (opt.build) opt.build(body, w); }
        catch (e) { body.appendChild(el('div', 'tb-note', esc(T('界面初始化失败：', 'Init failed: ') + (e && e.message ? e.message : e)))); }
        return w;
    }

    /* ---------------- 全局帧率采样（供性能模式 / 性能面板共用） ---------------- */
    var G = { fps: 0, frameMs: 16.7, busy: 0, raf: 0, last: 0, longMs: 0, longWin: [], workerCount: 0 };
    (function hookWorkers() {
        try {
            if (window.Worker && !window.Worker.__tbHooked) {
                var OW = window.Worker;
                function W() { var a = arguments; try { return new OW(a[0], a[1]); } finally { G.workerCount++; } }
                W.prototype = OW.prototype; W.__tbHooked = true;
                window.Worker = W;
            }
        } catch (e) { /* ignore */ }
    })();
    try {
        if (window.PerformanceObserver) {
            var po = new PerformanceObserver(function (l) {
                var now = performance.now();
                l.getEntries().forEach(function (x) { G.longWin.push({ t: now, d: x.duration }); });
            });
            po.observe({ entryTypes: ['longtask'] });
        }
    } catch (e) { /* ignore */ }

    function globalTick(ts) {
        if (G.last) {
            var dt = ts - G.last;
            if (dt > 0 && dt < 500) {
                G.frameMs = G.frameMs * .88 + dt * .12;
                G.fps = 1000 / G.frameMs;
            }
        }
        G.last = ts;
        var now = performance.now();
        G.longWin = G.longWin.filter(function (x) { return now - x.t < 1000; });
        G.longMs = G.longWin.reduce(function (a, b) { return a + b.d; }, 0) || 0;
        /* 帧间隔超过 16.7ms 的部分也算主线程忙 */
        var frameBusy = Math.min(1, Math.max(0, (G.frameMs - 16.7) / 100));
        G.busy = Math.min(1, Math.max(frameBusy, Math.min(1, G.longMs / 1000) * .85));
        G.raf = (window.requestAnimationFrame || nativeRAF)(globalTick);
    }
    if (nativeRAF) nativeRAF(globalTick);

    /* ---------------- 工具 1：作品比较 ---------------- */
    var ZIP = {
        toB64: function (u8) {
            var CH = 0x8000, parts = [];
            for (var i = 0; i < u8.length; i += CH)
                parts.push(String.fromCharCode.apply(null, u8.subarray(i, i + CH)));
            return btoa(parts.join(''));
        },
        entries: function (u8) {
            var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
            var eocd = -1, lo = Math.max(0, u8.length - 65557);
            for (var i = u8.length - 22; i >= lo; i--) {
                if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
            }
            if (eocd < 0) throw new Error(T('不是有效的 .sb3 / zip 文件', 'Not a valid .sb3 / zip file'));
            var n = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), out = [];
            for (var k = 0; k < n; k++) {
                if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) break;
                var nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
                out.push({
                    name: new TextDecoder('utf-8').decode(u8.subarray(p + 46, p + 46 + nlen)),
                    method: dv.getUint16(p + 10, true),
                    csize: dv.getUint32(p + 20, true),
                    usize: dv.getUint32(p + 24, true),
                    lho: dv.getUint32(p + 42, true)
                });
                p += 46 + nlen + elen + clen;
            }
            return { u8: u8, dv: dv, out: out };
        },
        read: function (z, name) {
            var e = null;
            for (var i = 0; i < z.out.length; i++) if (z.out[i].name === name) { e = z.out[i]; break; }
            if (!e) return null;
            var p = e.lho, nlen = z.dv.getUint16(p + 26, true), elen = z.dv.getUint16(p + 28, true);
            var start = p + 30 + nlen + elen, data = z.u8.subarray(start, start + e.csize);
            if (e.method === 0) return data;
            if (e.method === 8) {
                if (!window.__blInflateB64) throw new Error(T('内置解压器不可用', 'Built-in inflate unavailable'));
                return window.__blInflateB64(ZIP.toB64(data), e.usize);
            }
            throw new Error(T('不支持的 ZIP 压缩方式', 'Unsupported ZIP compression') + ' #' + e.method);
        }
    };

    function parseSb3(bytes) {
        var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        var z = ZIP.entries(u8);
        var j = ZIP.read(z, 'project.json');
        if (!j) throw new Error(T('压缩包里没有 project.json', 'No project.json in archive'));
        var pj;
        try { pj = JSON.parse(new TextDecoder('utf-8').decode(j)); }
        catch (e) { throw new Error(T('project.json 无法解析', 'Cannot parse project.json')); }
        return pj;
    }

    function summarize(pj) {
        var ts = pj.targets || [], t = {
            targets: ts.length, sprites: 0, blocks: 0, variables: 0, lists: 0,
            broadcasts: 0, costumes: 0, sounds: 0, comments: 0,
            extensions: (pj.extensions || []).length, monitors: (pj.monitors || []).length
        };
        var op = {}, per = Object.create(null), ext = (pj.extensions || []).slice().sort();
        ts.forEach(function (tg) {
            var bs = tg.blocks || {}, ops = Object.create(null), c = 0;
            Object.keys(bs).forEach(function (id) {
                var b = bs[id];
                if (!b || typeof b !== 'object' || !b.opcode) return;
                c++; ops[b.opcode] = (ops[b.opcode] || 0) + 1;
                op[b.opcode] = (op[b.opcode] || 0) + 1;
            });
            per[tg.name] = { blocks: c, ops: ops, isStage: !!tg.isStage };
            t.blocks += c;
            t.sprites += tg.isStage ? 0 : 1;
            t.variables += Object.keys(tg.variables || {}).length;
            t.lists += Object.keys(tg.lists || {}).length;
            t.broadcasts += Object.keys(tg.broadcasts || {}).length;
            t.costumes += (tg.costumes || []).length;
            t.sounds += (tg.sounds || []).length;
            t.comments += Object.keys(tg.comments || {}).length;
        });
        t.broadcasts = (function () {
            var st = ts.filter(function (x) { return x.isStage; })[0];
            return st ? Object.keys(st.broadcasts || {}).length : 0;
        })();
        return { total: t, op: op, per: per, ext: ext, raw: pj };
    }

    function diffSummary(a, b) {
        var keys = [
            ['targets', T('目标总数', 'Targets')], ['sprites', T('角色数', 'Sprites')],
            ['blocks', T('积木数', 'Blocks')], ['variables', T('变量', 'Variables')],
            ['lists', T('列表', 'Lists')], ['broadcasts', T('广播', 'Broadcasts')],
            ['costumes', T('造型', 'Costumes')], ['sounds', T('声音', 'Sounds')],
            ['comments', T('注释', 'Comments')], ['extensions', T('扩展', 'Extensions')],
            ['monitors', T('监视器', 'Monitors')]
        ];
        var rows = keys.map(function (k) {
            return { k: k[1], a: a.total[k[0]], b: b.total[k[0]], d: b.total[k[0]] - a.total[k[0]] };
        });
        var na = Object.keys(a.per), nb = Object.keys(b.per);
        var added = nb.filter(function (n) { return na.indexOf(n) < 0; });
        var removed = na.filter(function (n) { return nb.indexOf(n) < 0; });
        var changed = na.filter(function (n) { return nb.indexOf(n) >= 0 && a.per[n].blocks !== b.per[n].blocks; })
            .map(function (n) { return { name: n, a: a.per[n].blocks, b: b.per[n].blocks, d: b.per[n].blocks - a.per[n].blocks }; });
        var allOp = Object.create(null);
        Object.keys(a.op).concat(Object.keys(b.op)).forEach(function (o) { allOp[o] = 1; });
        var opDiff = Object.keys(allOp).map(function (o) {
            return { op: o, a: a.op[o] || 0, b: b.op[o] || 0, d: (b.op[o] || 0) - (a.op[o] || 0) };
        }).filter(function (x) { return x.d !== 0; }).sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); }).slice(0, 14);
        var extAdd = b.ext.filter(function (x) { return a.ext.indexOf(x) < 0; });
        var extDel = a.ext.filter(function (x) { return b.ext.indexOf(x) < 0; });
        return { rows: rows, added: added, removed: removed, changed: changed, opDiff: opDiff, extAdd: extAdd, extDel: extDel };
    }

    function compareBytes(a, b) {
        var A = summarize(parseSb3(a)), B = summarize(parseSb3(b));
        return { a: A, b: B, diff: diffSummary(A, B) };
    }

    function projectList() {
        try {
            var l = JSON.parse(localStorage.getItem('bl:projects') || '[]');
            return Array.isArray(l) ? l : [];
        } catch (e) { return []; }
    }
    function bytesFromSource(src, fileBytes) {
        if (src === 'current') {
            var M = window.__blProjectMeta;
            if (!M) return Promise.reject(new Error(T('编辑器尚未就绪', 'Editor not ready')));
            return Promise.resolve(M.captureSb3());
        }
        if (src === 'file') {
            return fileBytes ? Promise.resolve(fileBytes)
                : Promise.reject(new Error(T('请先选择一个 .sb3 文件', 'Pick a .sb3 file first')));
        }
        if (src.indexOf('saved:') === 0) {
            var M2 = window.__blProjectMeta, id = src.slice(6);
            if (!M2) return Promise.reject(new Error(T('编辑器尚未就绪', 'Editor not ready')));
            return Promise.resolve(M2.getFile(id)).then(function (v) {
                if (!v || !v.length) throw new Error(T('作品数据缺失', 'Project data missing'));
                return v;
            });
        }
        return Promise.reject(new Error(T('未知来源', 'Unknown source')));
    }

    function buildCompare(body, win) {
        var side = { a: { src: 'current', file: null }, b: { src: 'file', file: null } };
        body.appendChild(el('div', 'tb-h', esc(T('作品比较', 'Project Compare'))));
        body.appendChild(el('div', 'tb-sub', esc(T(
            '比较两份 .sb3 的积木、角色、变量、造型、扩展等结构差异。不会改动当前作品。',
            'Compare block / sprite / variable / costume / extension structure of two .sb3 files. Nothing is modified.'))));

        function sideUI(k, label) {
            var box = el('div', 'tb-file');
            box.appendChild(el('span', 'tb-label', esc(label)));
            var sel = el('select', 'tb-select');
            sel.innerHTML = '<option value="current">' + esc(T('当前项目', 'Current project')) + '</option>' +
                '<option value="file">' + esc(T('本地 .sb3 文件', 'Local .sb3 file')) + '</option>' +
                (function () {
                    var l = projectList(), h = '';
                    for (var i = 0; i < l.length; i++)
                        h += '<option value="saved:' + esc(l[i].id) + '">' + esc(l[i].name || l[i].id) + '</option>';
                    return h ? '<optgroup label="' + esc(T('已保存的作品', 'Saved projects')) + '">' + h + '</optgroup>' : '';
                })();
            sel.value = side[k].src;
            var fi = el('input'); fi.type = 'file'; fi.accept = '.sb3,.sb2,.zip,application/zip';
            fi.style.display = 'none';
            var nameEl = el('span', 'tb-file-n', esc(T('未选择文件', 'No file chosen')));
            var pick = el('button', 'tb-btn', esc(T('选择文件', 'Choose file')));
            pick.type = 'button';
            pick.addEventListener('click', function () { fi.click(); });
            fi.addEventListener('change', function () {
                var f = fi.files && fi.files[0];
                if (!f) return;
                nameEl.textContent = f.name + ' · ' + fmtBytes(f.size);
                if (f.arrayBuffer) f.arrayBuffer().then(function (buf) { side[k].file = new Uint8Array(buf); })
                    .catch(function () { nameEl.textContent = T('读取失败', 'Read failed'); });
                else {
                    var r = new FileReader();
                    r.onload = function () { side[k].file = new Uint8Array(r.result); };
                    r.readAsArrayBuffer(f);
                }
                sel.value = 'file'; side[k].src = 'file';
            });
            sel.addEventListener('change', function () {
                side[k].src = sel.value;
                if (sel.value === 'file' && !side[k].file) fi.click();
            });
            box.appendChild(sel); box.appendChild(pick); box.appendChild(fi); box.appendChild(nameEl);
            body.appendChild(box);
        }
        sideUI('a', 'A');
        sideUI('b', 'B');

        var row = el('div', 'tb-row');
        var go = el('button', 'tb-btn primary', esc(T('开始比较', 'Compare'))); go.type = 'button';
        var exp = el('button', 'tb-btn', esc(T('导出报告', 'Export report'))); exp.type = 'button'; exp.disabled = true;
        row.appendChild(go); row.appendChild(exp); body.appendChild(row);
        var out = el('div'); out.style.marginTop = '10px'; body.appendChild(out);
        var lastReport = '';

        go.addEventListener('click', function () {
            out.innerHTML = '<div class="tb-note">' + esc(T('正在解析…', 'Parsing…')) + '</div>';
            Promise.all([bytesFromSource(side.a.src, side.a.file), bytesFromSource(side.b.src, side.b.file)])
                .then(function (r) {
                    var c = compareBytes(r[0], r[1]), d = c.diff;
                    var h = '<div class="tb-sec">' + esc(T('总体对比', 'Overview')) + '</div>' +
                        '<table class="tb-table"><thead><tr><th>' + esc(T('指标', 'Metric')) +
                        '</th><th>A</th><th>B</th><th>Δ</th></tr></thead><tbody>';
                    d.rows.forEach(function (x) {
                        var cls = x.d > 0 ? 'tb-diff-add' : x.d < 0 ? 'tb-diff-del' : 'tb-diff-same';
                        h += '<tr><td>' + esc(x.k) + '</td><td class="num">' + x.a + '</td><td class="num">' + x.b +
                            '</td><td class="num ' + cls + '">' + (x.d > 0 ? '+' : '') + x.d + '</td></tr>';
                    });
                    h += '</tbody></table>';
                    h += '<div class="tb-sec">' + esc(T('角色变化', 'Sprite changes')) + '</div><div class="tb-list">';
                    if (d.added.length) h += '<div class="tb-diff-add">+ ' + esc(T('新增：', 'Added: ')) + esc(d.added.join('、')) + '</div>';
                    if (d.removed.length) h += '<div class="tb-diff-del">− ' + esc(T('移除：', 'Removed: ')) + esc(d.removed.join('、')) + '</div>';
                    d.changed.forEach(function (x) {
                        h += '<div>' + esc(x.name) + '：' + x.a + ' → ' + x.b +
                            ' <span class="' + (x.d > 0 ? 'tb-diff-add' : 'tb-diff-del') + '">(' + (x.d > 0 ? '+' : '') + x.d + ')</span></div>';
                    });
                    if (!d.added.length && !d.removed.length && !d.changed.length)
                        h += '<div class="tb-diff-same">' + esc(T('角色与积木数量一致', 'Same sprites and block counts')) + '</div>';
                    h += '</div>';
                    h += '<div class="tb-sec">' + esc(T('积木类型差异（Top 14）', 'Opcode differences (Top 14)')) + '</div><div class="tb-list">';
                    if (d.opDiff.length) d.opDiff.forEach(function (x) {
                        h += '<div><code>' + esc(x.op) + '</code>：' + x.a + ' → ' + x.b +
                            ' <span class="' + (x.d > 0 ? 'tb-diff-add' : 'tb-diff-del') + '">(' + (x.d > 0 ? '+' : '') + x.d + ')</span></div>';
                    });
                    else h += '<div class="tb-diff-same">' + esc(T('积木类型与数量完全一致', 'Identical opcode distribution')) + '</div>';
                    h += '</div>';
                    if (d.extAdd.length || d.extDel.length) {
                        h += '<div class="tb-sec">' + esc(T('扩展差异', 'Extension differences')) + '</div><div class="tb-list">' +
                            (d.extAdd.length ? '<div class="tb-diff-add">+ ' + esc(d.extAdd.join('、')) + '</div>' : '') +
                            (d.extDel.length ? '<div class="tb-diff-del">− ' + esc(d.extDel.join('、')) + '</div>' : '') + '</div>';
                    }
                    out.innerHTML = h;
                    lastReport = [
                        T('作品比较报告', 'Project compare report'),
                        'A blocks=' + c.a.total.blocks + ' sprites=' + c.a.total.sprites + ' costumes=' + c.a.total.costumes,
                        'B blocks=' + c.b.total.blocks + ' sprites=' + c.b.total.sprites + ' costumes=' + c.b.total.costumes,
                        ''
                    ].concat(d.rows.map(function (x) { return x.k + '\t' + x.a + '\t' + x.b + '\t' + (x.d > 0 ? '+' : '') + x.d; }))
                        .concat(['', T('新增角色', 'Added sprites') + ': ' + d.added.join(', '),
                            T('移除角色', 'Removed sprites') + ': ' + d.removed.join(', '), ''])
                        .concat(d.opDiff.map(function (x) { return x.op + '\t' + x.a + '\t' + x.b + '\t' + (x.d > 0 ? '+' : '') + x.d; }))
                        .join('\n');
                    exp.disabled = false;
                })
                .catch(function (e) {
                    out.innerHTML = '<div class="tb-note">' + esc(T('比较失败：', 'Compare failed: ') + (e && e.message ? e.message : e)) + '</div>';
                    exp.disabled = true;
                });
        });
        exp.addEventListener('click', function () {
            if (!lastReport) return;
            download(new Blob([lastReport], { type: 'text/plain;charset=utf-8' }), 'project-compare.txt');
        });
    }

    /* ---------------- 工具 2：帧率 ---------------- */
    function drawSpark(cv, values, color) {
        try {
            var ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
            ctx.clearRect(0, 0, w, h);
            if (!values.length) return;
            var max = 70, n = values.length, step = Math.max(1, Math.floor(n / Math.max(1, w)));
            ctx.beginPath(); ctx.strokeStyle = color || '#4c97ff'; ctx.lineWidth = 1.5;
            var started = false;
            for (var x = 0, i = 0; i < n; i += step, x++) {
                var v = Math.max(0, Math.min(max, values[i]));
                var y = h - (v / max) * (h - 6) - 3;
                if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.fillStyle = 'rgba(127,127,127,.25)'; ctx.fillRect(0, h - (60 / max) * (h - 6) - 3, w, 1);
        } catch (e) { /* ignore */ }
    }

    function buildFps(body, win) {
        body.appendChild(el('div', 'tb-h', esc(T('帧率监视器', 'Frame Rate Monitor'))));
        body.appendChild(el('div', 'tb-sub', esc(T(
            '实时采样 requestAnimationFrame。点「开始录制」记录整段帧率序列，可导出 CSV。性能模式会直接影响这里的读数。',
            'Samples requestAnimationFrame live. Record a full FPS trace and export CSV. Performance mode affects these readings.'))));
        var big = el('div', 'tb-big', '— <small>FPS</small>'); body.appendChild(big);
        var stats = el('div', 'tb-stats'); body.appendChild(stats);
        function stat(k, v) { return '<div class="tb-stat"><div class="tb-stat-v">' + v + '</div><div class="tb-stat-k">' + esc(k) + '</div></div>'; }
        function renderStats(s) {
            stats.innerHTML = stat(T('平均帧', 'Avg'), num(s.avg, 1)) + stat(T('最高帧', 'Max'), num(s.max, 1)) +
                stat(T('最低帧', 'Min'), num(s.min, 1)) + stat(T('帧数', 'Frames'), s.n) +
                stat(T('长帧 >32ms', 'Long >32ms'), s.long) + stat(T('采样时长', 'Duration'), fmtTime(s.dur));
        }
        renderStats({ avg: 0, max: 0, min: 0, n: 0, long: 0, dur: 0 });

        var cv = el('canvas', 'tb-canvas'); cv.width = 460; cv.height = 86; body.appendChild(cv);
        var row = el('div', 'tb-row');
        var rec = el('button', 'tb-btn primary', esc(T('开始录制', 'Start recording'))); rec.type = 'button';
        var clr = el('button', 'tb-btn', esc(T('清空', 'Clear'))); clr.type = 'button';
        var csv = el('button', 'tb-btn', esc(T('导出 CSV', 'Export CSV'))); csv.type = 'button'; csv.disabled = true;
        var state = el('span', 'tb-badge', esc(T('待机', 'Idle')));
        row.appendChild(rec); row.appendChild(clr); row.appendChild(csv); row.appendChild(el('span', 'tb-grow')); row.appendChild(state);
        body.appendChild(row);

        var samples = [], live = [], recording = false, t0 = 0, last = 0, raf = 0, lastPaint = 0, stopped = null;
        function statsOf(arr) {
            if (!arr.length) return { avg: 0, max: 0, min: 0, n: 0, long: 0, dur: 0 };
            var dts = arr.map(function (x) { return x.dt; }), sum = 0, mn = Infinity, mx = 0, lng = 0;
            dts.forEach(function (d) { sum += d; if (d < mn) mn = d; if (d > mx) mx = d; if (d > 32) lng++; });
            return {
                avg: 1000 / (sum / dts.length), max: 1000 / mn, min: 1000 / mx,
                n: dts.length, long: lng, dur: arr[arr.length - 1].t - arr[0].t
            };
        }
        function paint(force) {
            var now = performance.now();
            if (!force && now - lastPaint < 180) return;
            lastPaint = now;
            var s = statsOf(recording ? samples : (stopped || live));
            big.innerHTML = (s.n ? num(s.avg, 1) : '—') + ' <small>FPS</small>';
            renderStats(s);
            drawSpark(cv, (recording ? samples : (stopped || live)).slice(-460).map(function (x) { return 1000 / x.dt; }));
        }
        function tick(ts) {
            if (last) {
                var dt = ts - last;
                if (dt > 0 && dt < 500) {
                    var item = { t: ts, dt: dt, fps: 1000 / dt };
                    live.push(item); if (live.length > 900) live.shift();
                    if (recording) { samples.push(item); if (samples.length > 36000) samples.shift(); }
                }
            }
            last = ts;
            paint(false);
            raf = (window.requestAnimationFrame || nativeRAF)(tick);
        }
        raf = (window.requestAnimationFrame || nativeRAF)(tick);
        win.__tbClean.push(function () {
            try { (window.cancelAnimationFrame || nativeCAF)(raf); } catch (e) { /* ignore */ }
            try { if (nativeCAF) nativeCAF(raf); } catch (e2) { /* ignore */ }
        });

        rec.addEventListener('click', function () {
            if (!recording) {
                samples = []; stopped = null; recording = true; t0 = performance.now();
                rec.textContent = T('停止录制', 'Stop recording'); rec.classList.remove('primary'); rec.classList.add('danger');
                state.textContent = T('录制中', 'Recording'); state.className = 'tb-badge on';
                csv.disabled = true;
            } else {
                recording = false; stopped = samples.slice();
                rec.textContent = T('开始录制', 'Start recording'); rec.classList.add('primary'); rec.classList.remove('danger');
                state.textContent = T('已录制 ' + fmtTime(performance.now() - t0), 'Recorded ' + fmtTime(performance.now() - t0));
                state.className = 'tb-badge';
                csv.disabled = false;
                paint(true);
            }
        });
        clr.addEventListener('click', function () {
            samples = []; live = []; stopped = null; csv.disabled = true; paint(true);
            state.textContent = T('待机', 'Idle'); state.className = 'tb-badge';
        });
        csv.addEventListener('click', function () {
            var a = stopped || samples;
            if (!a.length) return;
            var txt = 'time_ms,frame_ms,fps\n' + a.map(function (x) {
                return num(x.t, 1) + ',' + num(x.dt, 2) + ',' + num(x.fps, 2);
            }).join('\n');
            download(new Blob([txt], { type: 'text/csv;charset=utf-8' }), 'fps-trace.csv');
        });
    }

    /* ---------------- 工具 3：性能模式 ---------------- */
    var MODE_KEY = 'bl:toolbox-perf-mode';
    var modeState = lsGet(MODE_KEY, { mode: 'normal', cap: 30 });
    if (!modeState || !modeState.mode) modeState = { mode: 'normal', cap: 30 };

    function applyMode(m, cap, silent) {
        modeState = { mode: m, cap: cap || 30 };
        lsSet(MODE_KEY, modeState);
        /* 先无条件还原，避免反复包裹 */
        if (nativeRAF) window.requestAnimationFrame = nativeRAF;
        if (nativeCAF) window.cancelAnimationFrame = nativeCAF;
        document.documentElement.classList.remove('tb-eco');
        if (m === 'eco') {
            document.documentElement.classList.add('tb-eco');
            var interval = 1000 / Math.max(10, Math.min(60, modeState.cap));
            var pending = Object.create(null), nextId = 1;
            /* 关键：节流状态按「回调函数」共享，而不是按每次 rAF 调用。
               动画循环每次都传同一个 cb；若每个新 id 都从 last=0 开始，
               就会每个原生帧都放行一次，节流完全失效。 */
            var lastByCb = new WeakMap();
            window.requestAnimationFrame = function (cb) {
                var myId = nextId++, last = (typeof cb === 'function' && lastByCb.get(cb)) || 0;
                pending[myId] = true;
                function step(ts) {
                    if (!pending[myId]) return;
                    if (!last || ts - last >= interval - 1) {
                        last = ts;
                        if (typeof cb === 'function') lastByCb.set(cb, ts);
                        pending[myId] = false;
                        try { cb(ts); } catch (e) { /* ignore */ }
                    } else if (nativeRAF) nativeRAF(step);
                }
                if (nativeRAF) nativeRAF(step);
                else setTimeout(function () { cb(performance.now()); }, interval);
                return myId;
            };
            window.cancelAnimationFrame = function (id) { delete pending[id]; };
        } else if (m === 'turbo') {
            /* TURBO：解除节流、恢复装饰动效，只锁定满帧调度 */
            try {
                /* [B108] 不再调用 vm.setTurboMode：三档只控制最高频率、
                   性能调度、作品更新与运算速度，不改变编译器 / VM 运行模式。 */
                if (window.__blRuntimePerf) window.__blRuntimePerf.lock(60);
            } catch (e) { /* ignore */ }
        } else {
            try {
                /* [B108] 同上：普通 / 省电也不碰 setTurboMode */
                if (window.__blRuntimePerf) {
                    window.__blRuntimePerf.lock(m === 'eco' ? 30 : 0);  /* 0 = 交还自适应 */
                }
            } catch (e2) { /* ignore */ }
        }
        if (!silent) {
            document.dispatchEvent(new CustomEvent('tb:mode', { detail: modeState }));
        }
    }

    function buildMode(body, win) {
        body.appendChild(el('div', 'tb-h', esc(T('性能模式', 'Performance Mode'))));
        body.appendChild(el('div', 'tb-sub', esc(T(
            '三档只控制最高频率、性能调度、作品更新与运算速度，不改变编译器功能：TURBO 满帧、普通自适应、省电限帧并关闭装饰动画。设置会持久保存。',
            'These modes only cap frequency, scheduling, project updates and execution speed — they never change the compiler: TURBO full rate, Normal adaptive, Eco capped with decorative effects off. Persisted.'))));
        var defs = [
            { id: 'turbo', n: 'TURBO', d: T('满帧运行 · 关闭节流 · 优先响应', 'Uncapped FPS · no throttling · responsive') },
            { id: 'normal', n: T('普通', 'Normal'), d: T('编辑器默认调度，平衡观感与开销', 'Default scheduler, balanced') },
            { id: 'eco', n: T('省电', 'Eco'), d: T('限制帧率 · 关闭毛玻璃与装饰动画', 'Capped FPS · no blur/decorative animations') }
        ];
        var grid = el('div', 'tb-modes'); body.appendChild(grid);
        var cards = {};
        defs.forEach(function (d) {
            var b = el('button', 'tb-mode' + (modeState.mode === d.id ? ' is-on' : ''),
                '<div class="tb-mode-n">' + esc(d.n) + '</div><div class="tb-mode-d">' + esc(d.d) + '</div>');
            b.type = 'button';
            b.addEventListener('click', function () {
                applyMode(d.id, capInput.value, false);
                Object.keys(cards).forEach(function (k) { cards[k].classList.toggle('is-on', k === d.id); });
                refresh();
            });
            cards[d.id] = b; grid.appendChild(b);
        });
        var row = el('div', 'tb-row');
        row.appendChild(el('span', 'tb-label', esc(T('省电帧率上限', 'Eco FPS cap'))));
        var capInput = el('input', 'tb-input'); capInput.type = 'range'; capInput.min = '15'; capInput.max = '45';
        capInput.value = String(modeState.cap || 30); capInput.style.maxWidth = '180px';
        var capVal = el('span', 'tb-badge', capInput.value + ' FPS');
        capInput.addEventListener('input', function () {
            capVal.textContent = capInput.value + ' FPS';
            if (modeState.mode === 'eco') applyMode('eco', capInput.value, true);
        });
        row.appendChild(capInput); row.appendChild(capVal); body.appendChild(row);

        var live = el('div', 'tb-stats'); body.appendChild(live);
        var note = el('div', 'tb-note'); body.appendChild(note);
        function refresh() {
            live.innerHTML =
                '<div class="tb-stat"><div class="tb-stat-v">' + num(G.fps, 1) + '</div><div class="tb-stat-k">' + esc(T('当前帧率', 'Live FPS')) + '</div></div>' +
                '<div class="tb-stat"><div class="tb-stat-v">' + esc(modeState.mode === 'turbo' ? 'TURBO' : modeState.mode === 'eco' ? T('省电', 'Eco') : T('普通', 'Normal')) +
                '</div><div class="tb-stat-k">' + esc(T('当前模式', 'Mode')) + '</div></div>' +
                '<div class="tb-stat"><div class="tb-stat-v">' + (modeState.mode === 'eco' ? modeState.cap : '∞') +
                '</div><div class="tb-stat-k">' + esc(T('帧率上限', 'FPS cap')) + '</div></div>';
            note.textContent = T(
                '提示：省电模式通过改写 requestAnimationFrame 调度生效，切到帧率工具可直接看到读数变化；TURBO / 普通使用浏览器原生调度。',
                'Note: Eco rewrites requestAnimationFrame scheduling — open the FPS tool to see the reading change; TURBO / Normal use the native scheduler.');
        }
        refresh();
        var t = setInterval(refresh, 700);
        win.__tbClean.push(function () { clearInterval(t); });
    }

    /* ---------------- 工具 4：录制舞台 ---------------- */
    var audioHooked = false, audioCaps = [];
    function hookAudio() {
        if (audioHooked) return;
        audioHooked = true;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (AC) {
                function Wrapped() {
                    var c = arguments.length ? new AC(arguments[0], arguments[1]) : new AC();
                    try { c.__tbCap = c.createMediaStreamDestination(); audioCaps.push(c.__tbCap); } catch (e) { /* ignore */ }
                    return c;
                }
                Wrapped.prototype = AC.prototype; Wrapped.__tbHooked = true;
                if (window.AudioContext) window.AudioContext = Wrapped;
                if (window.webkitAudioContext) window.webkitAudioContext = Wrapped;
            }
            if (window.AudioNode && window.AudioNode.prototype.connect) {
                var orig = window.AudioNode.prototype.connect;
                window.AudioNode.prototype.connect = function (dest) {
                    var r = orig.apply(this, arguments);
                    try {
                        if (dest && this.context && dest === this.context.destination &&
                            this.context.__tbCap && !this.__tbCapDone) {
                            orig.call(this, this.context.__tbCap);
                            this.__tbCapDone = true;
                        }
                    } catch (e) { /* 绝不干扰原音频链路 */ }
                    return r;
                };
            }
        } catch (e) { /* ignore */ }
    }
    function findAudioCap() {
        /* 编辑器可能在注入前就创建了 AudioContext，尽量从 VM 里找回来 */
        try {
            var vm = getVM(), ae = vm && vm.runtime && vm.runtime.audioEngine;
            var c = ae && (ae.audioContext || ae._audioContext || ae.context || ae.ctx);
            if (c && c.createMediaStreamDestination) {
                if (!c.__tbCap) { c.__tbCap = c.createMediaStreamDestination(); audioCaps.push(c.__tbCap); }
                /* inputNode 是所有音效的总线；编辑器可能在 hook 之前就已把链路连好，
                   主动接一次才能拿到实际播放的音频。 */
                if (ae.inputNode && !ae.__tbCapLinked && ae.inputNode.connect) {
                    try { ae.inputNode.connect(c.__tbCap); ae.__tbCapLinked = true; } catch (e) { /* ignore */ }
                }
                return c.__tbCap;
            }
        } catch (e) { /* ignore */ }
        return audioCaps.length ? audioCaps[audioCaps.length - 1] : null;
    }

    function buildRecord(body, win) {
        body.appendChild(el('div', 'tb-h', esc(T('录制舞台', 'Stage Recorder'))));
        body.appendChild(el('div', 'tb-sub', esc(T(
            '把舞台画面录成 WebM。分辨率采用等比缩放后重新绘制，录音依赖浏览器音频输出捕获（若编辑器未暴露音频上下文会提示无声）。',
            'Record the stage to WebM. Resolution is applied by redrawing into an offscreen canvas. Audio capture needs an exposed AudioContext.'))));
        var row = el('div', 'tb-row');
        row.appendChild(el('span', 'tb-label', esc(T('帧率', 'FPS'))));
        var fpsSel = el('select', 'tb-select');
        [10, 15, 24, 30, 60].forEach(function (f) { fpsSel.innerHTML += '<option value="' + f + '"' + (f === 30 ? ' selected' : '') + '>' + f + ' FPS</option>'; });
        row.appendChild(fpsSel);
        row.appendChild(el('span', 'tb-label', esc(T('分辨率', 'Resolution'))));
        var resSel = el('select', 'tb-select');
        [['0', T('舞台原始尺寸', 'Original stage')], ['480', '480 × 360'], ['720', '720 × 540'],
         ['960', '960 × 720'], ['1280', '1280 × 960']].forEach(function (r) {
            resSel.innerHTML += '<option value="' + r[0] + '">' + esc(r[1]) + '</option>';
        });
        row.appendChild(resSel); body.appendChild(row);

        var row2 = el('div', 'tb-row');
        var lab = el('label', 'tb-check');
        var snd = el('input'); snd.type = 'checkbox';
        lab.appendChild(snd); lab.appendChild(document.createTextNode(' ' + T('录制声音', 'Record audio')));
        row2.appendChild(lab);
        var start = el('button', 'tb-btn primary', esc(T('开始录制', 'Start'))); start.type = 'button';
        var stop = el('button', 'tb-btn danger', esc(T('停止', 'Stop'))); stop.type = 'button'; stop.disabled = true;
        var dl = el('button', 'tb-btn', esc(T('下载视频', 'Download video'))); dl.type = 'button'; dl.disabled = true;
        var st = el('span', 'tb-badge', esc(T('待机', 'Idle')));
        row2.appendChild(start); row2.appendChild(stop); row2.appendChild(dl);
        row2.appendChild(el('span', 'tb-grow')); row2.appendChild(st); body.appendChild(row2);
        var note = el('div', 'tb-note'); body.appendChild(note);
        note.textContent = T('提示：录制期间请保持此弹窗打开，舞台画面会按设定帧率持续采样。',
            'Keep this window open while recording; the stage is sampled at the chosen FPS.');

        var rec = null, stream = null, raf = 0, chunks = [], blob = null, t0 = 0, timer = 0, off = null, offCtx = null, src = null;
        function setStatus(txt, on) { st.textContent = txt; st.className = 'tb-badge' + (on ? ' on' : ''); }
        function cleanupLoop() {
            if (raf) {
                try { if (nativeCAF) nativeCAF(raf); else (window.cancelAnimationFrame)(raf); }
                catch (e) { /* ignore */ }
                raf = 0;
            }
            if (timer) { clearInterval(timer); timer = 0; }
        }
        win.__tbClean.push(function () {
            cleanupLoop();
            if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) { /* ignore */ } }
            if (stream) {
                try {
                    stream.getVideoTracks().forEach(function (t) { t.stop(); });
                } catch (e) { /* ignore */ }
            }
        });

        function draw() {
            if (!src || !offCtx) return;
            try { offCtx.drawImage(src, 0, 0, off.width, off.height); }
            catch (e) { /* ignore */ }
            raf = nativeRAF ? nativeRAF(draw) : (window.requestAnimationFrame)(draw);
        }

        start.addEventListener('click', function () {
            if (rec && rec.state === 'recording') return;
            src = stageCanvas();
            if (!src) { note.textContent = T('未找到舞台画布，请等编辑器就绪后重试。', 'Stage canvas not found — wait until the editor is ready.'); return; }
            if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
                note.textContent = T('当前浏览器不支持 MediaRecorder / captureStream，无法录制。', 'MediaRecorder / captureStream is unavailable in this browser.');
                return;
            }
            try {
                var W, H;
                var pick = parseInt(resSel.value, 10);
                if (pick) { W = pick; H = Math.round(pick * 3 / 4); }
                else { W = src.width || 480; H = src.height || 360; }
                off = document.createElement('canvas'); off.width = W; off.height = H;
                offCtx = off.getContext('2d');
                offCtx.drawImage(src, 0, 0, W, H);
                stream = off.captureStream(parseInt(fpsSel.value, 10));
                var audioNote = '';
                if (snd.checked) {
                    hookAudio();
                    var cap = findAudioCap();
                    if (cap && cap.stream && cap.stream.getAudioTracks().length) {
                        cap.stream.getAudioTracks().forEach(function (t) {
                            try { stream.addTrack(t); } catch (e) { /* ignore */ }
                        });
                    } else {
                        audioNote = T('（未检测到编辑器音频输出，本次录制可能无声）', '(No editor audio output detected; this recording may be silent)');
                    }
                }
                var mime = '';
                ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9',
                 'video/webm;codecs=vp8', 'video/webm'].some(function (m) {
                    if (window.MediaRecorder.isTypeSupported(m)) { mime = m; return true; } return false;
                });
                chunks = []; blob = null; dl.disabled = true;
                rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
                rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
                rec.onerror = function () { setStatus(T('录制出错', 'Record error'), false); };
                rec.onstop = function () {
                    if (chunks.length) {
                        blob = new Blob(chunks, { type: 'video/webm' });
                        dl.disabled = false;
                        setStatus(T('完成 · ' + fmtBytes(blob.size), 'Done · ' + fmtBytes(blob.size)), false);
                        note.textContent = T('录制完成，点「下载视频」保存 WebM。', 'Recording finished — click Download video to save the WebM.') + ' ' + audioNote;
                    } else setStatus(T('无数据', 'No data'), false);
                };
                rec.start(250);
                t0 = performance.now();
                start.disabled = true; stop.disabled = false;
                setStatus('● 00:00', true);
                timer = setInterval(function () { setStatus('● ' + fmtTime(performance.now() - t0), true); }, 500);
                draw();
                note.textContent = T('正在录制… 分辨率 ' + W + '×' + H + '，' + fpsSel.value + ' FPS。',
                    'Recording… ' + W + '×' + H + ' at ' + fpsSel.value + ' FPS.') + ' ' + audioNote;
            } catch (e) {
                note.textContent = T('无法开始录制：', 'Cannot start: ') + (e && e.message ? e.message : e);
                cleanupLoop(); rec = null;
            }
        });
        stop.addEventListener('click', function () {
            cleanupLoop();
            if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) { /* ignore */ } }
            rec = null; start.disabled = false; stop.disabled = true;
            /* 只停视频轨；音频轨可能来自共享的 capture 节点，留着给下次用 */
            if (stream) { try { stream.getVideoTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* ignore */ } }
        });
        dl.addEventListener('click', function () {
            if (!blob) return;
            var d = new Date(), name = 'stage-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
                '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.webm';
            download(blob, name);
        });
    }

    /* ---------------- 工具 5：屏幕滤镜 ---------------- */
    var FILTER_KEY = 'bl:toolbox-filter';
    var fState = lsGet(FILTER_KEY, { preset: 'none', level: 60 });
    if (!fState || !fState.preset) fState = { preset: 'none', level: 60 };
    var PRESETS = [
        { id: 'none', zh: '无', en: 'None', f: function () { return 'none'; } },
        { id: 'eye', zh: '护眼', en: 'Eye care', f: function (l) { return 'sepia(' + num(.42 * l, 2) + ') saturate(' + num(.82 + .18 * (1 - l), 2) + ') brightness(' + num(1 - .06 * l, 2) + ') hue-rotate(' + num(-9 * l, 1) + 'deg)'; }, warm: true },
        { id: 'sat', zh: '高饱和', en: 'Vivid', f: function (l) { return 'saturate(' + num(1 + 1.1 * l, 2) + ') contrast(' + num(1 + .08 * l, 2) + ')'; } },
        { id: 'cool', zh: '冷色', en: 'Cool', f: function (l) { return 'hue-rotate(' + num(18 * l, 1) + 'deg) saturate(' + num(1 + .15 * l, 2) + ')'; } },
        { id: 'warm', zh: '暖色', en: 'Warm', f: function (l) { return 'sepia(' + num(.35 * l, 2) + ') hue-rotate(' + num(-14 * l, 1) + 'deg) saturate(' + num(1 + .12 * l, 2) + ')'; }, warm: true },
        { id: 'gray', zh: '灰度', en: 'Grayscale', f: function (l) { return 'grayscale(' + num(l, 2) + ')'; } },
        { id: 'dark', zh: '暗色', en: 'Dim', f: function (l) { return 'brightness(' + num(1 - .45 * l, 2) + ') contrast(' + num(1 + .05 * l, 2) + ')'; } },
        { id: 'contrast', zh: '高对比', en: 'High contrast', f: function (l) { return 'contrast(' + num(1 + .6 * l, 2) + ') saturate(' + num(1 + .1 * l, 2) + ')'; } },
        { id: 'invert', zh: '反色', en: 'Invert', f: function (l) { return 'invert(' + num(l, 2) + ')'; } }
    ];
    function applyFilter() {
        var layer = filterLayer(), p = null;
        for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === fState.preset) { p = PRESETS[i]; break; }
        if (!p) { p = PRESETS[0]; fState.preset = 'none'; }
        var l = Math.max(0, Math.min(1, (Number(fState.level) || 0) / 100));
        var css = p.f(l);
        layer.style.backdropFilter = css;
        layer.style.webkitBackdropFilter = css;
        layer.style.backgroundColor = p.warm ? 'rgba(255,178,90,' + num(.13 * l, 3) + ')' : 'transparent';
        layer.style.mixBlendMode = p.warm ? 'multiply' : 'normal';
        lsSet(FILTER_KEY, fState);
    }

    function buildFilter(body, win) {
        body.appendChild(el('div', 'tb-h', esc(T('屏幕滤镜', 'Screen Filter'))));
        body.appendChild(el('div', 'tb-sub', esc(T(
            '用全屏 backdrop-filter 叠加层作用于编辑器界面，不改动任何 DOM、不影响工具窗口本身，刷新后自动恢复。',
            'A full-screen backdrop-filter overlay over the editor UI. No DOM changes, tool windows stay unaffected, persisted.'))));
        var pills = el('div', 'tb-pills'); body.appendChild(pills);
        var btns = {};
        PRESETS.forEach(function (p) {
            var b = el('button', 'tb-pill' + (fState.preset === p.id ? ' is-on' : ''), esc(isZh() ? p.zh : p.en));
            b.type = 'button';
            b.addEventListener('click', function () {
                fState.preset = p.id;
                Object.keys(btns).forEach(function (k) { btns[k].classList.toggle('is-on', k === p.id); });
                applyFilter(); refresh();
            });
            btns[p.id] = b; pills.appendChild(b);
        });
        body.appendChild(el('div', 'tb-preview', esc(T('效果预览 · 渐变色块', 'Preview · gradient swatch'))));
        var row = el('div', 'tb-row');
        row.appendChild(el('span', 'tb-label', esc(T('强度', 'Intensity'))));
        var rg = el('input', 'tb-input'); rg.type = 'range'; rg.min = '0'; rg.max = '100'; rg.value = String(fState.level);
        var val = el('span', 'tb-badge', fState.level + '%');
        rg.addEventListener('input', function () {
            fState.level = parseInt(rg.value, 10); val.textContent = fState.level + '%';
            applyFilter(); refresh();
        });
        row.appendChild(rg); row.appendChild(val); body.appendChild(row);
        var note = el('div', 'tb-note'); body.appendChild(note);
        function refresh() {
            var p = PRESETS.filter(function (x) { return x.id === fState.preset; })[0] || PRESETS[0];
            note.textContent = T('当前：', 'Current: ') + (isZh() ? p.zh : p.en) + ' · ' + fState.level + '% · ' +
                T('工具箱弹窗与 DOCK 菜单不受滤镜影响，方便随时调回。', 'Toolbox windows and DOCK menus are excluded so you can always change it back.');
        }
        refresh();
        applyFilter();
    }

    /* ---------------- 工具 6：性能 ---------------- */
    function gpuInfo() {
        try {
            var c = document.createElement('canvas');
            var gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
            if (!gl) return { vendor: T('不可用', 'Unavailable'), renderer: T('WebGL 未启用', 'WebGL disabled') };
            var ex = gl.getExtension('WEBGL_debug_renderer_info');
            return {
                vendor: ex ? gl.getParameter(ex.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
                renderer: ex ? gl.getParameter(ex.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
            };
        } catch (e) { return { vendor: '—', renderer: T('检测失败', 'Detection failed') }; }
    }

    function buildPerf(body, win) {
        body.appendChild(el('div', 'tb-h', esc(T('性能监视器', 'Performance Monitor'))));
        body.appendChild(el('div', 'tb-sub', esc(T(
            'CPU 占用为主线程忙碌度估算（长任务 + 帧间隔），并非系统级读数；内存来自 performance.memory，GPU 来自 WebGL 渲染器信息。',
            'CPU load is an estimated main-thread busy ratio (long tasks + frame intervals), not a system-wide reading. Memory from performance.memory, GPU from WebGL.'))));
        var cpuBox = el('div', 'tb-sec', esc(T('主线程负载（估算）', 'Main-thread load (estimated)'))); body.appendChild(cpuBox);
        var cpuVal = el('div', 'tb-big', '0<small>%</small>'); body.appendChild(cpuVal);
        var cpuBar = el('div', 'tb-bar'); cpuBar.innerHTML = '<i></i>'; body.appendChild(cpuBar);
        var cpuCv = el('canvas', 'tb-canvas'); cpuCv.width = 460; cpuCv.height = 70; body.appendChild(cpuCv);

        var memSec = el('div', 'tb-sec', esc(T('内存 / 线程 / GPU', 'Memory / Threads / GPU'))); body.appendChild(memSec);
        var kv = el('div'); body.appendChild(kv);
        var memBar = el('div', 'tb-bar'); memBar.innerHTML = '<i></i>'; memBar.style.marginTop = '8px'; body.appendChild(memBar);
        var gpu = gpuInfo();
        var trend = [];

        function refresh() {
            var busy = Math.round(G.busy * 100);
            cpuVal.innerHTML = busy + '<small>%</small>';
            var bar = cpuBar.querySelector('i'); bar.style.width = busy + '%';
            cpuBar.classList.toggle('warn', busy > 70);
            trend.push(busy); if (trend.length > 300) trend.shift();
            drawSpark(cpuCv, trend, busy > 70 ? '#ffb53e' : '#4c97ff');

            var m = window.performance && window.performance.memory;
            var used = m ? m.usedJSHeapSize : 0, limit = m ? m.jsHeapSizeLimit : 0;
            if (m) memBar.querySelector('i').style.width = Math.min(100, used / limit * 100) + '%';
            kv.innerHTML =
                '<div class="tb-kv"><span>' + esc(T('JS 堆已用', 'JS heap used')) + '</span><span>' + (m ? fmtBytes(used) : 'N/A') + '</span></div>' +
                '<div class="tb-kv"><span>' + esc(T('JS 堆上限', 'JS heap limit')) + '</span><span>' + (m ? fmtBytes(limit) : 'N/A') + '</span></div>' +
                '<div class="tb-kv"><span>' + esc(T('逻辑线程', 'Logical cores')) + '</span><span>' + (navigator.hardwareConcurrency || 'N/A') + '</span></div>' +
                '<div class="tb-kv"><span>' + esc(T('JS 主线程', 'JS main thread')) + '</span><span>1</span></div>' +
                '<div class="tb-kv"><span>' + esc(T('已创建 Worker', 'Workers created')) + '</span><span>' + G.workerCount + '</span></div>' +
                '<div class="tb-kv"><span>' + esc(T('当前帧率', 'Live FPS')) + '</span><span>' + num(G.fps, 1) + '</span></div>' +
                '<div class="tb-kv"><span>' + esc(T('DOM 节点', 'DOM nodes')) + '</span><span>' + document.getElementsByTagName('*').length + '</span></div>' +
                '<div class="tb-kv"><span>' + esc(T('GPU 厂商', 'GPU vendor')) + '</span><span>' + esc(gpu.vendor) + '</span></div>' +
                '<div class="tb-kv"><span>' + esc(T('GPU 渲染器', 'GPU renderer')) + '</span><span>' + esc(gpu.renderer) + '</span></div>';
        }
        refresh();
        var t = setInterval(refresh, 700);
        win.__tbClean.push(function () { clearInterval(t); });
    }

    /* ---------------- 工具 7：作品格式转换 ----------------
       STAR.sb3（标准 .sb3）/ .STAR（分片加速包）/ .rj（RemixWarp RJ）三格式互转。

       · 完全自包含：zip 读复用本文件的 ZIP（同步内置解压器），
         zip 写自带 CRC32 / STORE 实现，不依赖 DecompressionStream；
       · RJ 结构严格对齐 [B39] 兼容层：
         manifest.json + targets/N.json + blocks/N.json + assets/素材，
         所以转出来的 .rj 能被编辑器直接打开，转回来的 .sb3 与编辑器
         载入 RJ 时拼出的 sb3 结构一致（可以来回导、数据不丢）；
       · .STAR 分片加速包由 [B94] 还原成标准 sb3 后参与互转；
       · 转换只发生在内存里，不会改动当前打开的作品。
       ---------------------------------------------------- */
    var RJ_MAGIC = 'RemixWarp-RJ-Project';
    var CV_PRIM = {
        math_number: [4, 'NUM'], math_positive_number: [5, 'NUM'],
        math_whole_number: [6, 'NUM'], math_integer: [7, 'NUM'],
        math_angle: [8, 'NUM'], colour_picker: [9, 'COLOUR'],
        text: [10, 'TEXT'], event_broadcast_menu: [11, 'BROADCAST_OPTION'],
        data_variable: [12, 'VARIABLE'], data_listcontents: [13, 'LIST']
    };

    function cvEnc(s) { return new TextEncoder().encode(String(s)); }
    function cvDec(u8) { return new TextDecoder('utf-8').decode(u8); }
    function cvJ(u8) { try { return u8 ? JSON.parse(cvDec(u8)) : null; } catch (e) { return null; } }
    function cvToU8(d) {
        if (!d) return null;
        if (d instanceof Uint8Array) return d;
        if (typeof ArrayBuffer !== 'undefined' && d instanceof ArrayBuffer) return new Uint8Array(d);
        if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(d))
            return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
        return null;
    }
    function cvGet(files, name) {
        for (var i = 0; i < files.length; i++) if (files[i].name === name) return files[i].data;
        return null;
    }
    function cvReadAll(u8) {
        var z = ZIP.entries(u8), out = [], i;
        for (i = 0; i < z.out.length; i++) {
            var n = z.out[i].name;
            if (n.charAt(n.length - 1) === '/') continue;
            var d = ZIP.read(z, n);
            if (d) out.push({ name: n, data: d });
        }
        return out;
    }
    function cvHas(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function cvArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

    /* 有的 rj 把全部文件压在「作品名/」一层目录里，统一剥掉 */
    function cvNormalize(files) {
        if (!files.length) return files;
        var prefix = null, i;
        for (i = 0; i < files.length; i++) {
            var slash = files[i].name.indexOf('/');
            if (slash < 0) return files;
            var head = files[i].name.slice(0, slash + 1);
            if (prefix === null) prefix = head;
            else if (prefix !== head) return files;
        }
        var out = [];
        for (i = 0; i < files.length; i++)
            out.push({ name: files[i].name.slice(prefix.length), data: files[i].data });
        return out;
    }
    function cvIndex(files, dir, allowRoot) {
        var map = {}, re = new RegExp('^' + dir + '/(\\d+)\\.json$'), i, m;
        for (i = 0; i < files.length; i++) {
            m = re.exec(files[i].name);
            if (m) map[parseInt(m[1], 10)] = files[i].data;
        }
        if (!Object.keys(map).length && allowRoot) {
            re = /^(\d+)\.json$/;
            for (i = 0; i < files.length; i++) {
                m = re.exec(files[i].name);
                if (m) map[parseInt(m[1], 10)] = files[i].data;
            }
        }
        return map;
    }
    function cvPrimOf(all, blk) {
        var info = CV_PRIM[blk && blk.opcode];
        if (!info) return null;
        var f = blk.fields && blk.fields[info[1]];
        var a = [info[0], f ? f.value : ''];
        if (info[0] >= 11 && f && f.id != null) a.push(f.id);
        return a;
    }
    /* prebuilt 是 VM 内部积木对象，转成 sb3 紧凑格式 */
    function cvFromPrebuilt(pj) {
        var all = (pj && pj.blocks) || {}, out = {}, id;
        for (id in all) {
            if (!cvHas(all, id)) continue;
            var b = all[id];
            if (!b || typeof b !== 'object') continue;
            var nb = { opcode: b.opcode, next: b.next == null ? null : b.next,
                       parent: b.parent == null ? null : b.parent,
                       inputs: {}, fields: {}, topLevel: !!b.topLevel, shadow: !!b.shadow };
            if (b.topLevel) { nb.x = b.x == null ? 0 : Number(b.x); nb.y = b.y == null ? 0 : Number(b.y); }
            if (b.mutation) nb.mutation = b.mutation;
            if (b.comment) nb.comment = b.comment;
            var ins = b.inputs || {}, n, d;
            for (n in ins) {
                if (!cvHas(ins, n)) continue;
                d = ins[n]; if (!d) continue;
                if (cvArr(d)) { nb.inputs[n] = d; continue; }
                var bid = d.block, sid = d.shadow;
                if (bid && sid && bid === sid) nb.inputs[n] = [1, bid];
                else if (bid && sid) {
                    var pr = cvPrimOf(all, all[sid]);
                    nb.inputs[n] = pr ? [3, bid, pr] : [3, bid, sid];
                } else if (bid) nb.inputs[n] = [2, bid];
                else if (sid) nb.inputs[n] = [1, sid];
            }
            var fs = b.fields || {};
            for (n in fs) {
                if (!cvHas(fs, n)) continue;
                d = fs[n]; if (!d) continue;
                if (cvArr(d)) { nb.fields[n] = d; continue; }
                nb.fields[n] = d.id == null ? [d.value, null] : [d.value, d.id];
            }
            out[id] = nb;
        }
        return out;
    }
    function cvFill(t, idx) {
        if (!t.variables) t.variables = {};
        if (!t.lists) t.lists = {};
        if (!t.broadcasts) t.broadcasts = {};
        if (!t.costumes) t.costumes = [];
        if (!t.sounds) t.sounds = [];
        if (t.currentCostume == null) t.currentCostume = 0;
        if (t.volume == null) t.volume = 100;
        if (t.layerOrder == null) t.layerOrder = idx;
        if (t.isStage) {
            if (t.tempo == null) t.tempo = 60;
            if (t.videoTransparency == null) t.videoTransparency = 50;
            if (!t.videoState) t.videoState = 'on';
            if (t.textToSpeechLanguage === undefined) t.textToSpeechLanguage = null;
        } else {
            if (t.visible === undefined) t.visible = true;
            if (t.x == null) t.x = 0;
            if (t.y == null) t.y = 0;
            if (t.size == null) t.size = 100;
            if (t.direction == null) t.direction = 90;
            if (t.draggable === undefined) t.draggable = false;
            if (!t.rotationStyle) t.rotationStyle = 'all around';
        }
        return t;
    }

    /* ---------- 最小 zip 写（STORE，sb3 / rj 读取端都认） ---------- */
    var CV_CRC = null;
    function cvCrc(u8) {
        if (!CV_CRC) {
            var t = new Uint32Array(256), c, i, k;
            for (i = 0; i < 256; i++) {
                c = i;
                for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                t[i] = c >>> 0;
            }
            CV_CRC = t;
        }
        var tb = CV_CRC, v = 0xFFFFFFFF;
        for (var j = 0; j < u8.length; j++) v = tb[(v ^ u8[j]) & 0xFF] ^ (v >>> 8);
        return (v ^ 0xFFFFFFFF) >>> 0;
    }
    function cv16(v) { return [v & 255, (v >> 8) & 255]; }
    function cv32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
    function cvWrite(files) {
        var d = new Date();
        var dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
        var dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
        var body = [], central = [], off = 0, i, j;
        for (i = 0; i < files.length; i++) {
            var nb = cvEnc(files[i].name), data = files[i].data, crc = cvCrc(data);
            var h = [0x50, 0x4B, 0x03, 0x04].concat(cv16(20), cv16(0x0800), cv16(0),
                cv16(dt), cv16(dd), cv32(crc), cv32(data.length), cv32(data.length),
                cv16(nb.length), cv16(0));
            body.push(new Uint8Array(h), nb, data);
            var c = [0x50, 0x4B, 0x01, 0x02].concat(cv16(20), cv16(20), cv16(0x0800), cv16(0),
                cv16(dt), cv16(dd), cv32(crc), cv32(data.length), cv32(data.length),
                cv16(nb.length), cv16(0), cv16(0), cv16(0), cv16(0), cv32(0), cv32(off));
            central.push(new Uint8Array(c), nb);
            off += h.length + nb.length + data.length;
        }
        var cdSize = 0;
        for (j = 0; j < central.length; j++) cdSize += central[j].length;
        var e = [0x50, 0x4B, 0x05, 0x06].concat(cv16(0), cv16(0),
            cv16(files.length), cv16(files.length), cv32(cdSize), cv32(off), cv16(0));
        var all = body.concat(central, [new Uint8Array(e)]), q = 0;
        var res = new Uint8Array(off + cdSize + e.length);
        for (j = 0; j < all.length; j++) { res.set(all[j], q); q += all[j].length; }
        return res;
    }

    /* ---------- 格式识别 ---------- */
    function cvComment(u8) {
        var lo = Math.max(0, u8.length - 65557), i;
        for (i = u8.length - 22; i >= lo; i--) {
            if (u8[i] === 0x50 && u8[i + 1] === 0x4B && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) {
                var n = (u8[i + 20] | (u8[i + 21] << 8)) & 0xFFFF;
                try { return cvDec(u8.subarray(i + 22, i + 22 + n)); } catch (e) { return ''; }
            }
        }
        return '';
    }
    function cvDetect(files, u8, name) {
        if (cvGet(files, 'project.json')) return 'sb3';
        var man = cvJ(cvGet(files, 'manifest.json'));
        if (man && (man.magic === RJ_MAGIC || man.format === 'rj')) return 'rj';
        if (/\.star$/i.test(String(name || '')) || /STAR/i.test(cvComment(u8))) return 'star';
        return 'unknown';
    }

        /* ---------- RJ 规范 v2：tables/ 五表 + 完整路径索引 ----------
       RemixWarp 当前加载器会逐一检查 tables/targets.json 等表，
       旧版只写 targets/N.json + blocks/N.json，打开时直接报
       「.rj 文件缺少 tables/targets.json」。
       读端同时兼容新旧两种包；0/1/2.json 在 targets/、blocks/、
       blocks/prebuilt/ 三个目录里同名，必须按完整路径取，绝不按
       文件名猜（按名字找会把 prebuilt 的 256 块当成角色元数据）。
       ------------------------------------------------------------ */
    var RJV2_OP = {
        4: 'math_number', 5: 'math_positive_number', 6: 'math_whole_number',
        7: 'math_integer', 8: 'math_angle', 9: 'colour_picker',
        10: 'text', 11: 'event_broadcast_menu', 12: 'data_variable',
        13: 'data_listcontents'
    };
    var RJV2_FIELD = {
        4: 'NUM', 5: 'NUM', 6: 'NUM', 7: 'NUM', 8: 'NUM',
        9: 'COLOUR', 10: 'TEXT', 11: 'BROADCAST_OPTION',
        12: 'VARIABLE', 13: 'LIST'
    };
    var RJV2_TABLE_ONLY = {
        index: 1, targetIndex: 1, targetName: 1, isBackdrop: 1,
        file: 1, targetFile: 1, blocksFile: 1,
        costumeCount: 1, soundCount: 1, variableCount: 1, listCount: 1,
        broadcastCount: 1, blockCount: 1, commentCount: 1
    };
    var rjv2Last = { missing: [], assetCount: 0, hasTables: false, targets: 0, blocks: 0 };

    function rjv2B64(s) {
        var x = atob(s), u = new Uint8Array(x.length), i;
        for (i = 0; i < x.length; i++) u[i] = x.charCodeAt(i);
        return u;
    }
    var RJV2_PNG = rjv2B64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC');
    var RJV2_WAV = rjv2B64('UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA');
    var RJV2_SVG = cvEnc('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><rect width="1" height="1" fill="#ffffff"/></svg>');
    function rjv2Placeholder(c) {
        var f = String((c && (c.dataFormat || c.md5ext || '')).toLowerCase());
        if (/\.(wav|mp3|ogg|m4a|adpcm)$/.test(f) || /^(wav|mp3|ogg|m4a|adpcm)$/.test(f)) return RJV2_WAV;
        if (/\.(png|jpg|jpeg|bmp|gif)$/.test(f) || /^(png|jpg|jpeg|bmp|gif)$/.test(f)) return RJV2_PNG;
        return RJV2_SVG;
    }
    function rjv2Base(n) { var i = String(n).lastIndexOf('/'); return i < 0 ? String(n) : String(n).slice(i + 1); }
    function rjv2Table(files, name) {
        return cvJ(cvGet(files, 'tables/' + name + '.json') || cvGet(files, name + '.json'));
    }
    function rjv2AssetMap(files, man) {
        var byBase = {}, byPath = {}, i, p, d;
        for (i = 0; i < files.length; i++) {
            p = files[i].name;
            if (/(^|\/)assets\/[^/]+$/.test(p)) {
                byPath[p] = files[i].data;
                byBase[rjv2Base(p)] = files[i].data;
            }
        }
        /* 清单登记过的路径也收进来：有的包把素材放在别的目录 */
        if (man && man.files && cvArr(man.files.assets)) {
            for (i = 0; i < man.files.assets.length; i++) {
                p = man.files.assets[i]; d = cvGet(files, p);
                if (d) { byPath[p] = d; byBase[rjv2Base(p)] = d; }
            }
        }
        return { byBase: byBase, byPath: byPath };
    }
    function rjv2FindAsset(map, files, c) {
        if (!c) return null;
        var d = null;
        if (c.file) d = map.byPath[c.file] || cvGet(files, c.file);
        if (!d && c.md5ext) d = map.byBase[c.md5ext] || cvGet(files, c.md5ext);
        if (!d && c.assetId) d = map.byBase[c.assetId + '.' + (c.dataFormat || '')];
        return d || null;
    }

    /* 紧凑 SB3 积木 -> VM 展开格式（prebuilt）。ID 保持不变，
       内联影子 primitive 生成确定性 shadow block，引用不会断。 */
    function rjv2Shadow(arr, name, owner, extra, taken) {
        var type = arr[0], val = arr[1], vid = arr[2];
        var sid = owner + '~' + name, n = 1;
        while (taken[sid] || extra[sid]) sid = owner + '~' + name + '_' + (n++);
        var field = RJV2_FIELD[type] || 'NUM';
        var sb = {
            id: sid, opcode: RJV2_OP[type] || 'math_number',
            inputs: {}, fields: {}, next: null, parent: owner,
            topLevel: false, shadow: true
        };
        sb.fields[field] = { name: field, value: val,
                             id: (type >= 11 && vid != null) ? vid : null };
        extra[sid] = sb;
        return sid;
    }
    function rjv2ToPrebuilt(blocks, comments, idx) {
        var out = {}, extra = {}, taken = {}, id, k, d;
        for (id in blocks) if (cvHas(blocks, id)) taken[id] = 1;
        for (id in blocks) {
            if (!cvHas(blocks, id)) continue;
            var b = blocks[id];
            if (!b || typeof b !== 'object' || cvArr(b)) { out[id] = b; continue; }
            var n = {
                id: id, opcode: b.opcode, inputs: {}, fields: {},
                next: b.next == null ? null : b.next,
                parent: b.parent == null ? null : b.parent,
                topLevel: !!b.topLevel, shadow: !!b.shadow
            };
            if (b.topLevel) { n.x = b.x == null ? 0 : Number(b.x); n.y = b.y == null ? 0 : Number(b.y); }
            if (b.mutation) n.mutation = b.mutation;
            if (b.comment) n.comment = b.comment;
            var ins = b.inputs || {};
            for (k in ins) {
                if (!cvHas(ins, k)) continue;
                d = ins[k];
                if (!cvArr(d)) { n.inputs[k] = d; continue; }
                var type = d[0], sid;
                if (type === 1) n.inputs[k] = { name: k, block: d[1], shadow: d[1] };
                else if (type === 2) n.inputs[k] = { name: k, block: d[1], shadow: null };
                else if (type === 3) {
                    var sh = d[2];
                    if (cvArr(sh)) sid = rjv2Shadow(sh, k, id, extra, taken);
                    else sid = (typeof sh === 'string' ? sh : null);
                    n.inputs[k] = { name: k, block: d[1], shadow: sid };
                } else if (type >= 4 && type <= 13) {
                    sid = rjv2Shadow(d, k, id, extra, taken);
                    n.inputs[k] = { name: k, block: sid, shadow: sid };
                } else n.inputs[k] = { name: k, block: null, shadow: null };
            }
            var fs = b.fields || {};
            for (k in fs) {
                if (!cvHas(fs, k)) continue;
                d = fs[k];
                if (cvArr(d)) n.fields[k] = { name: k, value: d[0], id: (d[1] == null ? null : d[1]) };
                else if (d && typeof d === 'object') n.fields[k] = d;
            }
            out[id] = n;
        }
        for (k in extra) if (cvHas(extra, k)) out[k] = extra[k];
        return { index: idx, version: 1, blockCount: Object.keys(out).length,
                 blocks: out, comments: comments || {} };
    }
    function rjv2ItemToTarget(it, idx) {
        var t = {}, k;
        for (k in it) if (cvHas(it, k) && !RJV2_TABLE_ONLY[k] && k !== 'stageCount' && k !== 'spriteCount' && k !== 'count')
            t[k] = it[k];
        if (t.name == null) t.name = it.isStage ? 'Stage' : ('角色' + idx);
        t.isStage = !!it.isStage;
        if (t.layerOrder == null) t.layerOrder = idx;
        return t;
    }
    function rjv2CleanItem(it) {
        var c = {}, k;
        for (k in it) if (cvHas(it, k) && !RJV2_TABLE_ONLY[k] && k !== 'count') c[k] = it[k];
        return c;
    }
    function rjv2Count(o) { return o ? Object.keys(o).length : 0; }

    /* ---------- STAR.sb3 → .rj（复刻 RemixWarp 当前导出结构） ---------- */
    function cvSb3ToRj(files) {
        var pj = cvJ(cvGet(files, 'project.json'));
        if (!pj || !cvArr(pj.targets))
            throw new Error(T('project.json 无法解析', 'Cannot parse project.json'));
        var targets = pj.targets, out = [], used = {}, assets = [], i, j;
        var monitors = cvArr(pj.monitors) ? pj.monitors : [];
        var extensions = cvArr(pj.extensions) ? pj.extensions : [];

        /* 素材并集：以 costumes/sounds 的 md5ext 为准，不依赖清单数组 */
        function addAsset(c) {
            var nm = c && c.md5ext;
            if (!nm || used[nm]) return;
            var d = cvGet(files, nm) || cvGet(files, 'assets/' + nm);
            if (!d && c.assetId) d = cvGet(files, c.assetId + '.' + (c.dataFormat || '')) ||
                                      cvGet(files, 'assets/' + c.assetId + '.' + (c.dataFormat || ''));
            if (!d) return;
            used[nm] = 1;
            assets.push({ name: nm, data: d });
        }
        for (i = 0; i < targets.length; i++) {
            var cs0 = targets[i].costumes || [], ss0 = targets[i].sounds || [];
            for (j = 0; j < cs0.length; j++) addAsset(cs0[j]);
            for (j = 0; j < ss0.length; j++) addAsset(ss0[j]);
        }

        var meta = {};
        if (pj.meta && typeof pj.meta === 'object')
            for (var mk in pj.meta) if (cvHas(pj.meta, mk)) meta[mk] = pj.meta[mk];
        if (!meta.semver) meta.semver = '3.0.0';
        if (!meta.vm) meta.vm = '0.2.0';
        if (!meta.agent) meta.agent = '';
        /* RemixWarp 的导出带 platform/name，读端（B39 / 转换器）会自己摘掉，
           这里保留是为了和真实 .rj 结构一致。 */
        if (!meta.platform) meta.platform = { name: 'remixwarp', url: 'https://remixwarp.pages.dev/' };
        var title = meta.name || '作品';
        var costumeCount = 0, backdropCount = 0, soundCount = 0;
        var variableCount = 0, listCount = 0, broadcastCount = 0, blockCount = 0;
        for (i = 0; i < targets.length; i++) {
            var t0 = targets[i];
            var cN = (t0.costumes || []).length;
            if (t0.isStage) backdropCount += cN; else costumeCount += cN;
            soundCount += (t0.sounds || []).length;
            variableCount += rjv2Count(t0.variables);
            listCount += rjv2Count(t0.lists);
            broadcastCount += rjv2Count(t0.broadcasts);
            blockCount += rjv2Count(t0.blocks);
        }
        var man = {
            magic: RJ_MAGIC, format: 'rj', formatVersion: 1, sb3Version: 3,
            app: 'TurboWarp', createdAt: new Date().toISOString(), title: title,
            targetCount: targets.length, costumeCount: costumeCount,
            backdropCount: backdropCount, soundCount: soundCount,
            variableCount: variableCount, listCount: listCount,
            broadcastCount: broadcastCount, blockCount: blockCount,
            monitorCount: monitors.length, assetCount: assets.length,
            monitors: monitors,
            project: { extensions: extensions, meta: meta },
            files: { targets: [], blocks: [], assets: [], prebuilt: [] },
            fastloadVersion: 1
        };

        var tItems = [], vItems = [], cItems = [], sItems = [];
        for (i = 0; i < targets.length; i++) {
            var t = targets[i], isStage = !!t.isStage;
            var cs = t.costumes || [], ss = t.sounds || [];
            var vv = t.variables || {}, ll = t.lists || {}, bb = t.broadcasts || {};
            var bks = t.blocks || {}, cms = t.comments || {};
            var targetFile = 'targets/' + i + '.json', blocksFile = 'blocks/' + i + '.json';
            var item = {
                index: i, name: t.name, isStage: isStage,
                currentCostume: t.currentCostume == null ? 0 : t.currentCostume,
                volume: t.volume == null ? 100 : t.volume,
                layerOrder: t.layerOrder == null ? i : t.layerOrder,
                costumeCount: cs.length, soundCount: ss.length,
                variableCount: rjv2Count(vv), listCount: rjv2Count(ll),
                broadcastCount: rjv2Count(bb), blockCount: rjv2Count(bks),
                commentCount: rjv2Count(cms),
                targetFile: targetFile, blocksFile: blocksFile
            };
            if (isStage) {
                item.tempo = t.tempo == null ? 60 : t.tempo;
                item.videoTransparency = t.videoTransparency == null ? 50 : t.videoTransparency;
                item.videoState = t.videoState || 'on';
                item.textToSpeechLanguage = t.textToSpeechLanguage === undefined ? null : t.textToSpeechLanguage;
            } else {
                item.visible = t.visible === undefined ? true : t.visible;
                item.x = t.x == null ? 0 : t.x; item.y = t.y == null ? 0 : t.y;
                item.size = t.size == null ? 100 : t.size;
                item.direction = t.direction == null ? 90 : t.direction;
                item.draggable = t.draggable === undefined ? false : t.draggable;
                item.rotationStyle = t.rotationStyle || 'all around';
            }
            tItems.push(item);

            var pushVars = function (map, kind) {
                for (var id in map) {
                    if (!cvHas(map, id)) continue;
                    var v = map[id], one = {
                        id: id, kind: kind, targetIndex: i, targetName: t.name,
                        isCloud: false, isLocal: kind === 'broadcast' ? false : !isStage
                    };
                    if (kind === 'broadcast') { one.name = String(v); one.value = String(v); }
                    else if (kind === 'list') { one.name = v[0]; one.value = cvArr(v[1]) ? v[1] : []; one.length = one.value.length; }
                    else { one.name = v[0]; one.value = v[1]; one.isCloud = !!v[2]; }
                    vItems.push(one);
                }
            };
            pushVars(vv, 'variable'); pushVars(ll, 'list'); pushVars(bb, 'broadcast');

            for (j = 0; j < cs.length; j++) {
                var ci = rjv2CleanItem(cs[j]);
                ci.index = j; ci.targetIndex = i; ci.targetName = t.name; ci.isBackdrop = isStage;
                ci.file = 'assets/' + (cs[j].md5ext || (cs[j].assetId + '.' + (cs[j].dataFormat || '')));
                cItems.push(ci);
            }
            for (j = 0; j < ss.length; j++) {
                var si = rjv2CleanItem(ss[j]);
                si.index = j; si.targetIndex = i; si.targetName = t.name;
                si.file = 'assets/' + (ss[j].md5ext || (ss[j].assetId + '.' + (ss[j].dataFormat || '')));
                sItems.push(si);
            }

            var tCopy = JSON.parse(JSON.stringify(t));
            delete tCopy.blocks; delete tCopy.comments;
            out.push({ name: targetFile, data: cvEnc(JSON.stringify({ target: tCopy })) });
            out.push({ name: blocksFile, data: cvEnc(JSON.stringify({
                index: i, version: 1, blockCount: rjv2Count(bks), blocks: bks, comments: cms
            })) });
            out.push({ name: 'blocks/prebuilt/' + i + '.json', data: cvEnc(JSON.stringify(
                rjv2ToPrebuilt(bks, cms, i)
            )) });
            man.files.targets.push(targetFile);
            man.files.blocks.push(blocksFile);
            man.files.prebuilt.push('blocks/prebuilt/' + i + '.json');
        }
        for (i = 0; i < assets.length; i++) {
            var an = 'assets/' + assets[i].name;
            out.push({ name: an, data: assets[i].data });
            man.files.assets.push(an);
        }

        /* 目录先落盘：tables/ 五表是 RemixWarp 加载器硬性检查的入口 */
        out.unshift({ name: 'manifest.json', data: cvEnc(JSON.stringify(man)) });
        out.unshift({ name: 'tables/targets.json', data: cvEnc(JSON.stringify({
            count: tItems.length, stageCount: tItems.filter(function (x) { return x.isStage; }).length,
            spriteCount: tItems.filter(function (x) { return !x.isStage; }).length, items: tItems
        })) });
        out.unshift({ name: 'tables/variables.json', data: cvEnc(JSON.stringify({
            count: vItems.length, variableCount: vItems.filter(function (x) { return x.kind === 'variable'; }).length,
            listCount: vItems.filter(function (x) { return x.kind === 'list'; }).length,
            broadcastCount: vItems.filter(function (x) { return x.kind === 'broadcast'; }).length,
            items: vItems
        })) });
        out.unshift({ name: 'tables/costumes.json', data: cvEnc(JSON.stringify({
            count: cItems.length, backdropCount: cItems.filter(function (x) { return x.isBackdrop; }).length,
            costumeCount: cItems.filter(function (x) { return !x.isBackdrop; }).length, items: cItems
        })) });
        out.unshift({ name: 'tables/sounds.json', data: cvEnc(JSON.stringify({ count: sItems.length, items: sItems })) });
        out.unshift({ name: 'tables/monitors.json', data: cvEnc(JSON.stringify({ count: monitors.length, items: monitors })) });

        rjv2Last = { missing: [], assetCount: assets.length, hasTables: true,
                     targets: targets.length, blocks: blockCount };
        return out;
    }

    /* ---------- .rj → STAR.sb3（新旧结构都认） ---------- */
    function cvRjToSb3(files) {
        files = cvNormalize(files);
        var man = cvJ(cvGet(files, 'manifest.json'));
        if (!man) throw new Error(T('缺少 manifest.json', 'Missing manifest.json'));
        if (man.magic !== RJ_MAGIC && man.format !== 'rj')
            throw new Error(T('不是 RJ 作品', 'Not an RJ project'));

        var tt = rjv2Table(files, 'targets');
        var hasTables = !!(tt && cvArr(tt.items) && tt.items.length);
        var list = [], i, j, m, order;
        if (hasTables) {
            for (i = 0; i < tt.items.length; i++) {
                var it = tt.items[i] || {};
                var ix = typeof it.index === 'number' ? it.index : i;
                list.push({ idx: ix, item: it,
                    targetFile: it.targetFile || ('targets/' + ix + '.json'),
                    blocksFile: it.blocksFile || ('blocks/' + ix + '.json') });
            }
            list.sort(function (a, b) { return a.idx - b.idx; });
        } else {
            /* 旧格式：只按 targets/N.json 精确路径找，allowRoot 关掉，
               否则根目录的 blocks 文件会被误认成角色。 */
            var tmap = cvIndex(files, 'targets', false);
            order = Object.keys(tmap).map(function (x) { return parseInt(x, 10); })
                .sort(function (a, b) { return a - b; });
            for (i = 0; i < order.length; i++)
                list.push({ idx: order[i], item: null,
                    targetFile: 'targets/' + order[i] + '.json',
                    blocksFile: 'blocks/' + order[i] + '.json' });
            if (!list.length) {
                /* 极老的 RJ 把角色摊平在根目录：只认真正的 target 对象 */
                for (i = 0; i < files.length; i++) {
                    m = /^(\d+)\.json$/.exec(files[i].name);
                    if (!m) continue;
                    var rt = cvJ(files[i].data);
                    var ro = rt && rt.target ? rt.target : rt;
                    if (ro && typeof ro === 'object' && !cvArr(ro) &&
                        (cvHas(ro, 'name') || cvHas(ro, 'isStage')) && !cvHas(ro, 'blocks'))
                        list.push({ idx: parseInt(m[1], 10), item: null,
                            targetFile: files[i].name,
                            blocksFile: 'blocks/' + m[1] + '.json' });
                }
                list.sort(function (a, b) { return a.idx - b.idx; });
            }
        }

        var vt = rjv2Table(files, 'variables');
        var ct = rjv2Table(files, 'costumes');
        var st = rjv2Table(files, 'sounds');
        var mt = rjv2Table(files, 'monitors');
        var targets = [], totalBlocks = 0;

        for (i = 0; i < list.length; i++) {
            var e = list[i], idx = e.idx;
            var tj = cvJ(cvGet(files, e.targetFile));
            var t = tj && tj.target ? tj.target : tj;
            if (!t || typeof t !== 'object' || cvArr(t) || cvHas(t, 'blocks') && !cvHas(t, 'name'))
                t = e.item ? rjv2ItemToTarget(e.item, idx) : {};
            t = JSON.parse(JSON.stringify(t));

            /* 变量 / 列表 / 广播：target 文件缺的，按 tables 的 targetIndex 补齐 */
            if (vt && cvArr(vt.items)) {
                for (j = 0; j < vt.items.length; j++) {
                    var vi = vt.items[j];
                    if (!vi || vi.targetIndex !== idx || !vi.id) continue;
                    if (!t.variables) t.variables = {};
                    if (!t.lists) t.lists = {};
                    if (!t.broadcasts) t.broadcasts = {};
                    if (vi.kind === 'variable' && !cvHas(t.variables, vi.id))
                        t.variables[vi.id] = [vi.name, vi.value, !!vi.isCloud];
                    else if (vi.kind === 'list' && !cvHas(t.lists, vi.id))
                        t.lists[vi.id] = [vi.name, cvArr(vi.value) ? vi.value : []];
                    else if (vi.kind === 'broadcast' && !cvHas(t.broadcasts, vi.id))
                        t.broadcasts[vi.id] = vi.name || vi.value;
                }
            }
            /* 造型 / 声音：target 文件缺的，按 tables 的 targetIndex + index 顺序补齐 */
            if ((!cvArr(t.costumes) || !t.costumes.length) && ct && cvArr(ct.items)) {
                var cRows = ct.items.filter(function (x) { return x && x.targetIndex === idx; })
                    .sort(function (a, b) { return (a.index || 0) - (b.index || 0); });
                t.costumes = [];
                for (j = 0; j < cRows.length; j++) t.costumes.push(rjv2CleanItem(cRows[j]));
            }
            if ((!cvArr(t.sounds) || !t.sounds.length) && st && cvArr(st.items)) {
                var sRows = st.items.filter(function (x) { return x && x.targetIndex === idx; })
                    .sort(function (a, b) { return (a.index || 0) - (b.index || 0); });
                t.sounds = [];
                for (j = 0; j < sRows.length; j++) t.sounds.push(rjv2CleanItem(sRows[j]));
            }

            /* 积木：blocks/N.json 为准，缺了才用 prebuilt 转回紧凑格式；
               两者 ID 体系不同，绝不混用。 */
            var bj = cvJ(cvGet(files, e.blocksFile) || cvGet(files, 'blocks/' + idx + '.json'));
            var pre = cvJ(cvGet(files, 'blocks/prebuilt/' + idx + '.json'));
            /* 有的包把三个目录的 N.json 平铺在根目录：只在两侧都缺时兜底，
               且必须确认它不是角色文件（含 name/isStage 的一律不碰）。 */
            if ((!bj || !bj.blocks) && (!pre || !pre.blocks)) {
                var rootJ = cvJ(cvGet(files, idx + '.json'));
                if (rootJ && rootJ.blocks && !cvHas(rootJ, 'name') && !cvHas(rootJ, 'isStage')) {
                    var rid = Object.keys(rootJ.blocks)[0];
                    var rb = rid ? rootJ.blocks[rid] : null;
                    var ins0 = rb && rb.inputs ? rb.inputs : null;
                    var firstIn = ins0 && Object.keys(ins0).length ? ins0[Object.keys(ins0)[0]] : null;
                    if (firstIn && !cvArr(firstIn)) pre = rootJ;   /* 对象式 = VM 展开 */
                    else bj = rootJ;                                /* 数组式 = 紧凑 SB3 */
                }
            }
            var nB = bj && bj.blocks ? rjv2Count(bj.blocks) : 0;
            var nP = pre && pre.blocks ? rjv2Count(pre.blocks) : 0;
            if (nB > 0) { t.blocks = bj.blocks; t.comments = bj.comments || {}; }
            else if (nP > 0) { t.blocks = cvFromPrebuilt(pre); t.comments = pre.comments || {}; }
            else { t.blocks = {}; t.comments = {}; }
            totalBlocks += rjv2Count(t.blocks);
            targets.push(cvFill(t, idx));
        }
        if (!targets.length) throw new Error(T('没有找到任何角色', 'No targets found'));

        var meta = man.project && man.project.meta && typeof man.project.meta === 'object'
            ? JSON.parse(JSON.stringify(man.project.meta)) : {};
        if (!meta.semver) meta.semver = '3.0.0';
        if (!meta.vm) meta.vm = '0.2.0';
        if (!meta.agent) meta.agent = '';
        /* 这两个字段是 RemixWarp 自己的标记，带进 StartEditor 会让 loadProject 卡住 */
        delete meta.platform; delete meta.name;

        var monitors = cvArr(man.monitors) ? man.monitors : [];
        if (!monitors.length && mt && cvArr(mt.items)) monitors = mt.items;
        if (!monitors.length) {
            var mj = cvJ(cvGet(files, 'monitors.json'));
            if (mj && cvArr(mj.items)) monitors = mj.items;
        }
        var proj = {
            targets: targets, monitors: monitors,
            extensions: (man.project && cvArr(man.project.extensions)) ? man.project.extensions : [],
            meta: meta
        };

        /* 素材：完整路径 + basename 双索引，缺的用占位补齐并列出清单，
           不再让整个作品加载失败。 */
        var amap = rjv2AssetMap(files, man);
        var out = [{ name: 'project.json', data: cvEnc(JSON.stringify(proj)) }];
        var used = {}, missing = [];
        function addAsset(c) {
            var nm = c && c.md5ext;
            if (!nm || used[nm]) return;
            var d = rjv2FindAsset(amap, files, c);
            if (!d && c.assetId) {
                var alt = c.assetId + '.' + (c.dataFormat || '');
                d = amap.byBase[alt] || cvGet(files, alt) || null;
            }
            if (!d) {
                d = rjv2Placeholder(c);
                missing.push(nm);
            }
            used[nm] = 1;
            out.push({ name: nm, data: d });
        }
        for (i = 0; i < targets.length; i++) {
            var cs2 = targets[i].costumes || [], ss2 = targets[i].sounds || [];
            for (j = 0; j < cs2.length; j++) addAsset(cs2[j]);
            for (j = 0; j < ss2.length; j++) addAsset(ss2[j]);
        }
        rjv2Last = { missing: missing, assetCount: out.length - 1, hasTables: hasTables,
                     targets: targets.length, blocks: totalBlocks };
        return out;
    }
    function cvOutName(name, ext) {
        var base = String(name || 'project').replace(/\.(sb3|rj|star|zip)$/i, '');
        return (base || 'project') + '.' + ext;
    }
    function cvCurrentSb3() {
        var vm = getVM();
        if (vm && typeof vm.saveProjectSb3 === 'function')
            return Promise.resolve(vm.saveProjectSb3('arraybuffer')).then(function (b) {
                var u = cvToU8(b);
                if (!u) throw new Error(T('拿不到当前作品数据', 'Cannot read current project'));
                return u;
            });
        var M = window.__blProjectMeta;
        if (M && typeof M.captureSb3 === 'function')
            return Promise.resolve(M.captureSb3()).then(function (b) {
                var u = cvToU8(b);
                if (!u) throw new Error(T('拿不到当前作品数据', 'Cannot read current project'));
                return u;
            });
        return Promise.reject(new Error(T('编辑器还没准备好，请先选择文件', 'Editor not ready — pick a file first')));
    }

    /* 转换 + 输出自检：保证交付的文件一定能被解析。
       三种格式统一走「先归一成标准 sb3，再按需输出」：
         STAR（分片加速包） --[B94 restore]--> sb3
         RJ（manifest+分文件） --[cvRjToSb3]--> sb3
         sb3 --[cvSb3ToRj]--> RJ   /   --[B94 pack]--> STAR
       这样任意两向都能互转，且输出前一定会重新读一遍自检。 */
    function cvConvert(u8, want, name) {
        /* 先剥掉「作品名/」这层统一前缀再识别：否则带前缀的 rj 会因为
           找不到根目录的 manifest.json 被误判成未知格式。普通 sb3 的
           project.json 在根目录，normalize 遇到无斜杠文件名会原样返回。 */
        var files = cvNormalize(cvReadAll(u8));
        var shown = cvDetect(files, u8, name);
        if (shown === 'unknown') throw new Error(T(
            '无法识别：压缩包里既没有 SB3 的 project.json、RJ 的 manifest.json，也不是 STAR 作品。',
            'Unrecognized: no SB3 project.json, no RJ manifest.json, and not a STAR archive.'));

        var from = shown, work = u8, normalized = false;
        if (from === 'star') {
            var IO = window.__blStarIO;
            if (!IO || typeof IO.restore !== 'function')
                throw new Error(T('STAR 还原器未就绪', 'STAR runtime is not ready'));
            work = IO.restore(u8);             /* 还原为标准 sb3 */
            files = cvReadAll(work);
            from = 'sb3';
            normalized = true;
        }
        var to = want === 'auto' ? (from === 'sb3' ? 'rj' : 'sb3') : want;
        if (to !== 'sb3' && to !== 'rj' && to !== 'star')
            throw new Error(T('未知目标格式', 'Unknown target format'));

        /* 旧 .rj 缺 tables/ 五表时，即使目标也是 .rj 也要重写一遍：
           原样导出拿到的仍是加载器报「缺少 tables/targets.json」的那个包。 */
        var legacyRj = (from === 'rj' && to === 'rj' && !cvGet(files, 'tables/targets.json'));
        /* 真正同格式且没做过归一：原样导出，字节都不动 */
        if (to === from && !normalized && !legacyRj) {
            var samePj = cvJ(cvGet(files, 'project.json'));
            return { bytes: u8, from: shown, to: to, same: true, fileCount: files.length,
                     total: samePj ? summarize(samePj).total : null, missing: [] };
        }

        var sb3U8, out, zip, miss0 = [];
        if (from === 'sb3') sb3U8 = work;
        else {
            out = cvRjToSb3(files);
            miss0 = rjv2Last.missing.slice();
            sb3U8 = cvWrite(out);
        }
        if (to === 'rj') {
            out = cvSb3ToRj(cvReadAll(sb3U8));
            zip = cvWrite(out);
        } else if (to === 'star') {
            var IO2 = window.__blStarIO;
            if (!IO2 || typeof IO2.pack !== 'function')
                throw new Error(T('STAR 打包器未就绪', 'STAR packer is not ready'));
            zip = IO2.pack(sb3U8);
        } else {
            zip = sb3U8;
        }

        /* 输出自检：不管转成哪种，都要能重新解出带角色的 project.json */
        var chk = zip;
        if (to === 'star') chk = window.__blStarIO.restore(zip);
        var chkFiles = cvReadAll(chk), pj = null;
        if (to === 'rj') {
            var man = cvJ(cvGet(chkFiles, 'manifest.json'));
            if (!man || (man.magic !== RJ_MAGIC && man.format !== 'rj'))
                throw new Error(T('输出自检失败：RJ 清单不对', 'Self-check failed: bad RJ manifest'));
            pj = cvJ(cvGet(cvRjToSb3(chkFiles), 'project.json'));
        } else {
            pj = cvJ(cvGet(chkFiles, 'project.json'));
        }
        if (!pj || !cvArr(pj.targets) || !pj.targets.length)
            throw new Error(T('输出自检失败：没有读到角色', 'Self-check failed: no targets'));
        return { bytes: zip, from: shown, to: to, same: false,
                 fileCount: chkFiles.length, total: summarize(pj).total,
                 missing: miss0 };
    }

    function buildConvert(body, win) {
        var state = { bytes: null, name: '', want: 'auto' }, last = null;
        body.appendChild(el('div', 'tb-h', esc(T('作品格式转换', 'Project Format Converter'))));
        body.appendChild(el('div', 'tb-sub', esc(T(
            'STAR.sb3、.STAR 与 .rj 三格式互转。STAR.sb3 是 StartEditor 保存的标准 .sb3；.STAR 是分片加速包（体积更小，START EDITOR 可直接打开）；.rj 是 RemixWarp RJ 工程（tables/ 五表 + manifest + targets/ + blocks/ + assets/）。转换只在内存里进行，不会改动当前作品。',
            'Three-way STAR.sb3 / .STAR / .rj conversion. STAR.sb3 is the standard .sb3 saved by StartEditor; .STAR is the sharded compact archive (smaller, opens directly in START EDITOR); .rj is a RemixWarp RJ project (five tables/ + manifest + targets/ + blocks/ + assets/). Conversion happens in memory only — your open project is untouched.'))));

        var drop = el('div', 'tb-file');
        drop.style.flexDirection = 'column';
        drop.style.alignItems = 'stretch';
        drop.style.cursor = 'pointer';
        drop.style.textAlign = 'center';
        drop.style.padding = '14px 10px';
        var file = el('input'); file.type = 'file';
        file.accept = '.sb3,.rj,.star,.zip,application/zip';
        file.style.display = 'none';
        var nameEl = el('div', 'tb-file-n', esc(T('拖入文件，或点「选择文件」；不选则默认转换当前作品',
            'Drop a file or click Choose file; otherwise the current project is used')));
        nameEl.style.whiteSpace = 'normal';
        var infoEl = el('div'); infoEl.style.cssText = 'font-size:11px;opacity:.66;margin-top:4px';
        var row0 = el('div', 'tb-row'); row0.style.justifyContent = 'center';
        var pick = el('button', 'tb-btn', esc(T('选择文件', 'Choose file'))); pick.type = 'button';
        var cur = el('button', 'tb-btn', esc(T('使用当前作品', 'Use current project'))); cur.type = 'button';
        row0.appendChild(pick); row0.appendChild(cur);
        drop.appendChild(nameEl); drop.appendChild(infoEl); drop.appendChild(row0); drop.appendChild(file);
        body.appendChild(drop);

        function showFile(f) {
            state.name = f.name;
            nameEl.textContent = f.name + ' · ' + fmtBytes(f.size);
            var read = f.arrayBuffer ? f.arrayBuffer().then(function (b) { return new Uint8Array(b); })
                : new Promise(function (res, rej) {
                    var r = new FileReader();
                    r.onload = function () { res(new Uint8Array(r.result)); };
                    r.onerror = function () { rej(new Error('read failed')); };
                    r.readAsArrayBuffer(f);
                });
            read.then(function (u8) {
                state.bytes = u8;
                try {
                    var f2 = cvDetect(cvReadAll(u8), u8, f.name);
                    infoEl.textContent = f2 === 'sb3' ? T('识别：STAR.sb3（标准 SB3）', 'Detected: STAR.sb3 (standard SB3)')
                        : f2 === 'rj' ? T('识别：.rj（RemixWarp RJ）', 'Detected: .rj (RemixWarp RJ)')
                        : f2 === 'star' ? T('识别：.STAR 分片加速包', 'Detected: .STAR sharded archive')
                        : T('识别：未知格式', 'Detected: unknown format');
                } catch (e) { infoEl.textContent = T('读取压缩包失败', 'Cannot read archive'); }
            }, function () {
                state.bytes = null;
                nameEl.textContent = T('读取失败', 'Read failed');
            });
        }
        pick.addEventListener('click', function () { file.click(); });
        file.addEventListener('change', function () {
            var f = file.files && file.files[0];
            if (f) showFile(f);
        });
        cur.addEventListener('click', function () {
            state.bytes = null; state.name = '';
            nameEl.textContent = T('来源：当前打开的作品', 'Source: current open project');
            infoEl.textContent = T('点「转换并下载」即可导出', 'Click Convert & download');
        });
        drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.style.opacity = '.6'; });
        drop.addEventListener('dragleave', function () { drop.style.opacity = ''; });
        drop.addEventListener('drop', function (e) {
            e.preventDefault(); drop.style.opacity = '';
            var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (f) showFile(f);
        });

        var lab = el('div', 'tb-label', esc(T('目标格式', 'Target format')));
        lab.style.marginTop = '12px'; body.appendChild(lab);
        var pills = el('div', 'tb-pills'); body.appendChild(pills);
        var WANTS = [
            { id: 'auto', zh: '自动互转（推荐）', en: 'Auto (recommended)' },
            { id: 'sb3', zh: '输出 STAR.sb3', en: 'Output STAR.sb3' },
            { id: 'star', zh: '输出 .STAR', en: 'Output .STAR' },
            { id: 'rj', zh: '输出 .rj', en: 'Output .rj' }
        ];
        var pillEls = [];
        WANTS.forEach(function (w) {
            var b = el('button', 'tb-pill' + (state.want === w.id ? ' is-on' : ''), esc(isZh() ? w.zh : w.en));
            b.type = 'button';
            b.addEventListener('click', function () {
                state.want = w.id;
                for (var i = 0; i < pillEls.length; i++) pillEls[i].classList.toggle('is-on', pillEls[i] === b);
            });
            pillEls.push(b); pills.appendChild(b);
        });

        var row = el('div', 'tb-row'); row.style.marginTop = '12px';
        var go = el('button', 'tb-btn primary', esc(T('转换并下载', 'Convert & download'))); go.type = 'button';
        var again = el('button', 'tb-btn', esc(T('再次下载', 'Download again'))); again.type = 'button'; again.disabled = true;
        row.appendChild(go); row.appendChild(again); body.appendChild(row);
        var out = el('div'); out.style.marginTop = '10px'; body.appendChild(out);

        function fmtName(f) {
            return f === 'sb3' ? 'STAR.sb3' : f === 'rj' ? '.rj' : f === 'star' ? '.STAR' : '?';
        }
        function showResult(r) {
            var t = r.total || {};
            var rows = [
                [T('输入格式', 'Input'), fmtName(r.from)],
                [T('输出格式', 'Output'), fmtName(r.to) + (r.same ? T('（同格式，原样导出）', ' (same format, untouched)') : '')],
                [T('角色 / 积木', 'Targets / Blocks'), (t.targets == null ? '—' : t.targets) + ' / ' + (t.blocks == null ? '—' : t.blocks)],
                [T('造型 / 声音', 'Costumes / Sounds'), (t.costumes == null ? '—' : t.costumes) + ' / ' + (t.sounds == null ? '—' : t.sounds)],
                [T('包内文件', 'Files in archive'), r.fileCount],
                [T('输出体积', 'Output size'), fmtBytes(r.bytes.length)]
            ];
            if (r.missing && r.missing.length) {
                rows.push([T('缺失素材（已占位）', 'Missing assets (placeholder)'),
                    r.missing.slice(0, 3).join(', ') +
                    (r.missing.length > 3 ? ' … +' + (r.missing.length - 3) : '')]);
            }
            var h = '<div class="tb-sec">' + esc(T('转换结果', 'Conversion result')) + '</div><table class="tb-table"><tbody>';
            for (var i = 0; i < rows.length; i++)
                h += '<tr><td>' + esc(rows[i][0]) + '</td><td class="num">' + esc(rows[i][1]) + '</td></tr>';
            h += '</tbody></table><div class="tb-note tb-diff-add">' +
                esc(T('✓ 已通过输出自检，文件可直接用编辑器打开 / 下载完成。',
                      '✓ Self-check passed. The file can be opened in the editor; download started.')) + '</div>';
            out.innerHTML = h;
        }
        function showError(e) {
            out.innerHTML = '<div class="tb-note tb-diff-del">' +
                esc(T('转换失败：', 'Conversion failed: ') + ((e && e.message) || e)) + '</div>';
        }
        function doDownload(r) {
            var ext = r.to === 'sb3' ? 'sb3' : r.to === 'rj' ? 'rj' : r.to === 'star' ? 'star' : 'zip';
            download(new Blob([r.bytes], { type: 'application/octet-stream' }),
                     cvOutName(state.name || 'project', ext));
        }
        go.addEventListener('click', function () {
            out.innerHTML = '<div class="tb-note">' + esc(T('正在转换…', 'Converting…')) + '</div>';
            again.disabled = true; last = null;
            Promise.resolve(state.bytes || cvCurrentSb3()).then(function (u8) {
                var r = cvConvert(u8, state.want, state.name || 'project.sb3');
                last = r; showResult(r); doDownload(r); again.disabled = false;
            }).catch(showError);
        });
        again.addEventListener('click', function () { if (last) doDownload(last); });

        body.appendChild(el('div', 'tb-note', esc(T(
            '说明：RJ 的 manifest.magic 固定为 RemixWarp-RJ-Project，转出的 .rj 可被编辑器直接打开；.STAR 由 [B94] 打包与还原，转出后可直接用「打开作品」载入。三种格式任意互转，转换不写入当前作品。',
            'Note: RJ manifest.magic is fixed to RemixWarp-RJ-Project, so the output .rj opens directly in the editor. .STAR is packed/restored by the built-in STAR runtime and can be opened via File → Load. Any of the three formats converts to any other; the open project is never modified.'))));
        /* 窗口关闭时清掉拖放状态，避免重复 build 时残留旧节点 */
        win.__tbClean.push(function () { state.bytes = null; last = null; });
    }

    /* ---------------- 工具箱主面板 ---------------- */
    var TOOLS = [
        { id: 'compare', zh: '作品比较', en: 'Project Compare', dzh: '对比两份 sb3 的结构差异', den: 'Diff two .sb3 projects',
          ico: '<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 12h6"/><path d="m12 9 3 3-3 3"/>', w: 660, h: 520, build: buildCompare },
        { id: 'fps', zh: '帧率', en: 'Frame Rate', dzh: '录制帧率 · 平均/最高/最低', den: 'Record FPS · avg / max / min',
          ico: '<path d="M3 15h3l2-7 4 12 3-9 2 4h4"/>', w: 540, h: 440, build: buildFps },
        { id: 'mode', zh: '性能模式', en: 'Perf Mode', dzh: 'TURBO / 普通 / 省电', den: 'TURBO / Normal / Eco',
          ico: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', w: 540, h: 380, build: buildMode },
        { id: 'record', zh: '录制舞台', en: 'Stage Recorder', dzh: '帧率 · 分辨率 · 声音', den: 'FPS · resolution · audio',
          ico: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>', w: 560, h: 360, build: buildRecord },
        { id: 'filter', zh: '屏幕滤镜', en: 'Screen Filter', dzh: '护眼 / 高饱和 / 灰度…', den: 'Eye care / Vivid / Grayscale…',
          ico: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18"/><path d="M7 9h.01M10 7h.01M7 15h.01"/>', w: 540, h: 350, build: buildFilter },
        { id: 'perf', zh: '性能', en: 'Performance', dzh: 'CPU / 线程 / GPU / 内存', den: 'CPU / threads / GPU / memory',
          ico: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 14l3-4 3 3 4-6"/>', w: 540, h: 500, build: buildPerf },
        { id: 'convert', zh: '作品格式转换', en: 'Project Format Converter',
          dzh: 'STAR.sb3 / .STAR / .rj 互转', den: 'STAR.sb3 / .STAR / .rj convert',
          ico: '<path d="M4 7h13l-3-3M17 4l3 3-3 3"/><path d="M20 17H7l3 3M7 20l-3-3 3-3"/>',
          w: 640, h: 520, build: buildConvert }
    ];

    function buildToolbox(body, win) {
        body.appendChild(el('div', 'tb-h', esc(T('工具箱', 'Toolbox'))));
        body.appendChild(el('div', 'tb-sub', esc(T(
            '七个独立工具，点卡片打开各自弹窗；弹窗可拖动、最小化收进 DOCK、最大化与关闭。',
            'Seven standalone tools — click a card to open its window. Windows are draggable, minimizable to DOCK, maximizable and closable.'))));
        var badges = el('div', 'tb-row'); body.appendChild(badges);
        function refreshBadges() {
            var m = modeState.mode, p = PRESETS.filter(function (x) { return x.id === fState.preset; })[0];
            badges.innerHTML = '<span class="tb-label">' + esc(T('当前状态', 'Current')) + '</span>' +
                '<span class="tb-badge' + (m === 'turbo' ? ' on' : '') + '">' + esc(m === 'turbo' ? 'TURBO' : m === 'eco' ? T('省电', 'Eco') : T('普通', 'Normal')) + '</span>' +
                '<span class="tb-badge' + (fState.preset !== 'none' ? ' on' : '') + '">' + esc(isZh() ? (p ? p.zh : '无') : (p ? p.en : 'None')) + '</span>' +
                '<span class="tb-badge">' + num(G.fps, 1) + ' FPS</span>';
        }
        refreshBadges();
        var bt = setInterval(refreshBadges, 900);
        win.__tbClean.push(function () { clearInterval(bt); });

        var grid = el('div', 'tb-grid'); body.appendChild(grid);
        TOOLS.forEach(function (t) {
            var c = el('button', 'tb-tool',
                '<svg class="tb-tool-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                'stroke-linecap="round" stroke-linejoin="round">' + t.ico + '</svg>' +
                '<div class="tb-tool-n">' + esc(isZh() ? t.zh : t.en) + '</div>' +
                '<div class="tb-tool-d">' + esc(isZh() ? t.dzh : t.den) + '</div>');
            c.type = 'button';
            c.addEventListener('click', function () { openTool(t.id); });
            grid.appendChild(c);
        });
        body.appendChild(el('div', 'tb-note', esc(T(
            '性能模式与屏幕滤镜会持久保存；帧率录制、作品比较、舞台录制与格式转换的数据只在本次会话内有效。',
            'Perf mode and screen filter persist across reloads. FPS traces, comparisons, recordings and conversions are session-only.'))));
    }

    var MAIN = {
        id: 'toolbox', zh: '工具箱', en: 'Toolbox', w: 560, h: 460,
        ico: '<path d="M4 7h16M4 12h16M4 17h10"/><circle cx="18" cy="17" r="2"/>',
        build: buildToolbox
    };

    function openTool(id) {
        var t = null;
        for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === id) { t = TOOLS[i]; break; }
        if (!t) return;
        openWin(t.id, isZh() ? t.zh : t.en, { w: t.w, h: t.h, ico: t.ico, build: t.build });
    }

    function openMain() {
        var t = tray();
        if (t && t.has && t.has('tb-toolbox')) { t.restore('tb-toolbox'); return; }
        openWin('toolbox', isZh() ? MAIN.zh : MAIN.en, {
            w: MAIN.w, h: MAIN.h, ico: MAIN.ico, build: MAIN.build,
            trayIco: '<path d="M4 7h16M4 12h16M4 17h10"/>'
        });
    }
    function toggleMain() {
        var w = Wins.toolbox;
        if (!w) { openMain(); return; }
        if (w.classList.contains('tb-hidden') || w.classList.contains('tb-mini')) { restoreWin('toolbox'); return; }
        closeWin('toolbox');
    }

    /* ---------------- 启动：恢复持久设置 ---------------- */
    applyMode(modeState.mode, modeState.cap, true);
    applyFilter();

    /* ---------------- 对外接口 ---------------- */
    window.__blToolbox = {
        open: openMain,
        toggle: toggleMain,
        close: closeWin,
        openTool: openTool,
        restore: restoreWin,
        compareBytes: compareBytes,
        parseSb3: parseSb3,
        getMode: function () { return { mode: modeState.mode, cap: modeState.cap }; },
        setMode: function (m, cap) { applyMode(m, cap || 30, false); },
        getFilter: function () { return { preset: fState.preset, level: fState.level }; },
        setFilter: function (p, l) { fState = { preset: p, level: l == null ? 60 : l }; applyFilter(); },
        getFps: function () { return G.fps; },
        wins: Wins
    };
    /* 供 [B40] 保存为 .rj / [B97] 预编译复用，避免再写一份 RJ 打包代码。
       工具箱窗口没打开时这些函数同样可用。 */
    window.__blFormatIO = {
        readAll: cvReadAll,
        write: cvWrite,
        get: cvGet,
        j: cvJ,
        detect: cvDetect,
        convert: cvConvert,
        sb3ToRj: cvSb3ToRj,
        rjToSb3: cvRjToSb3
    };
    /* RJ v2 内核出口：[B39] 打开作品、[B96] 项目导入、[B40]/[B97]
       保存与预编译全部走同一套读法，不再各写一份。 */
    window.__blRJv2 = {
        sb3ToRj: cvSb3ToRj,
        rjToSb3: cvRjToSb3,
        buildFromFiles: function (files) {
            var arr = [], k;
            if (cvArr(files)) arr = files;
            else for (k in files)
                if (Object.prototype.hasOwnProperty.call(files, k))
                    arr.push({ name: k, data: files[k] });
            var out = cvRjToSb3(arr);
            return { project: cvJ(cvGet(out, 'project.json')), zip: cvWrite(out),
                     assetCount: out.length - 1, missing: rjv2Last.missing.slice() };
        },
        last: function () { return rjv2Last; }
    };
})();

