
(function () {
    'use strict';
    if (window.__blGenie) return;
    window.__blGenie = true;

    /* ==================================================================
       设置读写：只认 genie / scale，其余旧值统一归到神灯效果
       ================================================================== */
    function normalize(v) { return v === 'scale' ? 'scale' : 'genie'; }
    function getMin() {
        try {
            if (window.__blSettings) {
                var a = window.__blSettings.get('winAnimation');
                if (a && a.minimize) return normalize(a.minimize);
            }
        } catch (e) { /* ignore */ }
        try {
            var raw = window.localStorage.getItem('bl:win-animation');
            var o = raw ? JSON.parse(raw) : null;
            if (o && o.minimize) return normalize(o.minimize);
        } catch (e2) { /* ignore */ }
        return 'genie';
    }
    function setMin(v) {
        v = normalize(v);
        try {
            if (window.__blSettings) {
                window.__blSettings.set('winAnimation', { minimize: v });
                return;
            }
        } catch (e) { /* ignore */ }
        try {
            var raw = window.localStorage.getItem('bl:win-animation');
            var o = raw ? JSON.parse(raw) : {};
            if (!o || typeof o !== 'object') o = {};
            o.minimize = v;
            window.localStorage.setItem('bl:win-animation', JSON.stringify(o));
        } catch (e2) { /* ignore */ }
    }

    function isZh() {
        try {
            var l = (document.documentElement.lang || '').toLowerCase();
            if (l.indexOf('zh') === 0) return true;
            if (l.indexOf('en') === 0) return false;
        } catch (e) { /* ignore */ }
        try { return /最小化动画|入场动画/.test(document.body.innerText || ''); }
        catch (e2) { return false; }
    }
    function labels() {
        return isZh() ? ['神灯效果', '缩放效果'] : ['Genie effect', 'Scale effect'];
    }
    function reduceMotion() {
        try {
            return !!(window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (e) { return false; }
    }

    /* ==================================================================
       设置页：把「最小化动画」下拉改成只有两项
       ================================================================== */
    var MIN_LABEL = /最小化动画|^\s*Minimize\b/i;

    function labelOf(sel) {
        try {
            var p = sel.previousElementSibling;
            if (p) return String(p.textContent || '').trim();
            var row = sel.parentElement;
            if (row) {
                var pp = row.previousElementSibling;
                if (pp) return String(pp.textContent || '').trim();
                var txt = String(row.textContent || '');
                for (var i = 0; i < sel.options.length; i++) {
                    txt = txt.split(String(sel.options[i].textContent || '')).join('');
                }
                return txt.trim();
            }
        } catch (e) { /* ignore */ }
        return '';
    }
    function isMinSelect(sel) {
        if (!sel || !sel.options) return false;
        if (MIN_LABEL.test(labelOf(sel))) return true;
        /* 兜底：设置页里连续三个动画下拉，第三个是最小化 */
        try {
            if (sel.options.length >= 5) {
                var vals = [];
                for (var q = 0; q < sel.options.length; q++) vals.push(sel.options[q].value);
                if (vals.indexOf('slideUp') < 0 || vals.indexOf('fade') < 0) return false;
                var sibs = [], p = sel.parentElement;
                if (!p || !p.parentElement) return false;
                var all = p.parentElement.querySelectorAll('select');
                for (var z = 0; z < all.length; z++) sibs.push(all[z]);
                var idx = -1;
                for (var y = 0; y < sibs.length; y++) if (sibs[y] === sel) idx = y;
                return idx >= 2 && !MIN_LABEL.test(labelOf(sibs[idx - 1] || {})) &&
                       !MIN_LABEL.test(labelOf(sibs[idx - 2] || {}));
            }
        } catch (e) { /* ignore */ }
        return false;
    }
    function syncSelect(sel) {
        var L = labels();
        var want = ['genie', 'scale'];
        var ok = sel.options.length === 2 &&
                 sel.options[0].value === want[0] && sel.options[1].value === want[1] &&
                 String(sel.options[0].textContent).trim() === L[0] &&
                 String(sel.options[1].textContent).trim() === L[1];
        if (!ok) {
            try {
                while (sel.options.length) sel.remove(0);
                for (var i = 0; i < want.length; i++) {
                    var o = document.createElement('option');
                    o.value = want[i];
                    o.textContent = L[i];
                    sel.appendChild(o);
                }
            } catch (e) { return; }
        }
        var cur = getMin();
        try { if (sel.value !== cur) sel.value = cur; } catch (e2) { /* ignore */ }
        if (!sel.__blMinBound) {
            sel.__blMinBound = true;
            /* 不阻止事件：React 的 onChange 照常跑，我们补写并校正存档，
               避免受控组件在下一次 render 里把值改回去。 */
            sel.addEventListener('change', function () {
                var v = normalize(sel.value);
                setMin(v);
                try { setTimeout(function () { setMin(v); }, 0); } catch (e3) {}
                try { setTimeout(function () { setMin(v); }, 80); } catch (e4) {}
                try { setTimeout(function () { setMin(v); }, 260); } catch (e5) {}
            }, false);
        }
    }
    function fixDoc(doc) {
        if (!doc || !doc.querySelectorAll) return;
        var sels = doc.querySelectorAll('select');
        for (var i = 0; i < sels.length; i++) {
            try { if (isMinSelect(sels[i])) syncSelect(sels[i]); } catch (e) { /* ignore */ }
        }
    }
    function watch(doc) {
        if (!doc || doc.__blGenieWatched) return;
        doc.__blGenieWatched = true;
        try {
            var MO = (doc.defaultView && doc.defaultView.MutationObserver) ||
                     window.MutationObserver;
            if (MO) {
                new MO(function () { fixDoc(doc); })
                    .observe(doc.documentElement || doc.body,
                             { childList: true, subtree: true, characterData: true });
            }
        } catch (e) { /* ignore */ }
        fixDoc(doc);
    }
    function scan() {
        watch(document);
        try {
            var fs = document.querySelectorAll('iframe');
            for (var i = 0; i < fs.length; i++) {
                try { if (fs[i].contentDocument) watch(fs[i].contentDocument); }
                catch (e) { /* 跨域忽略 */ }
            }
        } catch (e2) { /* ignore */ }
        fixDoc(document);
    }
    scan();
    try {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', scan);
        }
    } catch (e3) { /* ignore */ }
    try { setInterval(scan, 600); } catch (e4) { /* ignore */ }

    /* ==================================================================
       Dock 锚点：最小化托盘项 > DOCK 图标 > 视口底部中央
       ================================================================== */
    function dockAnchor() {
        var el = null;
        try {
            var trays = document.querySelectorAll('.bl-dock-item.bl-dock-tray');
            if (trays.length) el = trays[trays.length - 1];
        } catch (e) { /* ignore */ }
        if (!el) {
            try {
                var items = document.querySelectorAll('.bl-dock-item');
                if (items.length) el = items[items.length - 1];
            } catch (e2) { /* ignore */ }
        }
        if (!el) {
            try { el = document.querySelector('.bl-dock-inner'); } catch (e3) {}
        }
        var r = null;
        try { r = el && el.getBoundingClientRect && el.getBoundingClientRect(); }
        catch (e4) { /* ignore */ }
        if (r && r.width > 0) {
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: el };
        }
        return {
            x: (window.innerWidth || 1200) / 2,
            y: (window.innerHeight || 800) - 28,
            el: null
        };
    }

    function pct(n) { return (Math.round(n * 10) / 10) + '%'; }
    /* 12 点 polygon：顶边两点（T 控制宽度）、两侧在 26% 高度处向外、
       底部 6 点连成下凹弧（B 控制宽度）。B→0 且 T→2 时收敛为一个点。
       点数每帧一致，Chrome 才能在 WAAPI 里对 clip-path 做平滑插值。 */
    function funnel(T, B) {
        /* bend：0 = 完整矩形，1 = 底边收成一点。
           每个底部点的系数从 1 递减到 0.96/0.72/0.42/0.14，
           B=50 时全部为 1 → 右边是一条直线，窗口毫无形变。 */
        var bend = 1 - Math.max(0, Math.min(1, B / 50));
        var c0 = 1 - 0.04 * bend, c1 = 1 - 0.28 * bend;
        var c2 = 1 - 0.58 * bend, c3 = 1 - 0.86 * bend;
        var pts = [
            pct(50 - T) + ' 0%', pct(50 + T) + ' 0%',
            '100% 26%',
            pct(50 + B * c0) + ' 58%',
            pct(50 + B * c1) + ' 82%',
            pct(50 + B * c2) + ' 94%',
            pct(50 + B * c3) + ' 100%',
            pct(50 - B * c3) + ' 100%',
            pct(50 - B * c2) + ' 94%',
            pct(50 - B * c1) + ' 82%',
            pct(50 - B * c0) + ' 58%',
            '0% 26%'
        ];
        return 'polygon(' + pts.join(', ') + ')';
    }

    /* 平滑坡道：把 t 映射到 [a,b] 区间的 smoothstep。
       三阶段（牵引 / 卷曲 / 收束）都由它驱动，数值连续可导，
       段间不会出现速度的突然跳变 —— 这是「流畅」的关键。 */
    function smooth(a, b, t) {
        var x = Math.max(0, Math.min(1, (t - a) / (b - a)));
        return x * x * (3 - 2 * x);
    }
    function r1(n) { return Math.round(n * 100) / 100; }

    /* 神灯：按连续函数采样 14 帧。
       原来手写 8 帧 + linear 会在每个转折点产生速度突变；
       现在密度翻倍、曲线连续，肉眼看到的是一条顺滑的卷吸过程。
       另外不再使用 filter:blur() —— 逐帧重算大面积模糊是掉帧主因，
       末段的消散改由 opacity + 收敛到点来表达。 */
    var GENIE_STEPS = 14;
    function genieFrames(rect, a) {
        var dx = a.x - (rect.left + rect.width / 2);
        var dy = a.y - rect.bottom;               /* 原点在窗口底边中央 */
        /* 弧线幅度不依赖 dx：Dock 恰好在窗口正下方（dx≈0）时也要有拱，
           否则路径退化成直线，就不像被「卷」进去了。 */
        var arc = (dx < 0 ? -1 : 1) * Math.min(rect.width * 0.16, 110);
        var out = [];
        for (var i = 0; i < GENIE_STEPS; i++) {
            var t = i / (GENIE_STEPS - 1);
            var pull  = smooth(0, 0.30, t);      /* 阶段 1：边缘牵引 */
            var swirl = smooth(0.18, 0.86, t);   /* 阶段 2：螺旋卷曲 */
            var end   = smooth(0.80, 1, t);      /* 阶段 3：收束入坞 */

            /* 顶边前 16% 完全不动，之后才慢慢收 → 喇叭口 */
            var T = 50 * (1 - 0.96 * smooth(0.16, 1, t));
            /* 三个单调递减因子相乘 → 底边持续收窄成一个点 */
            var B = 50 * (1 - 0.22 * pull) * (1 - 0.80 * swirl) * (1 - end);
            var S = 1 - 0.98 * smooth(0.04, 1, t);
            var sk = -24 * swirl;
            var ro = -8 * swirl;
            var op = 1 - smooth(0.72, 1, t);

            var tx = dx * Math.pow(t, 1.7) + Math.sin(t * Math.PI) * arc;
            var ty = dy * Math.pow(t, 1.32);
            out.push({
                offset: r1(t),
                clipPath: funnel(T, B),
                transform: 'translate(' + r1(tx) + 'px,' + r1(ty) + 'px) ' +
                           'scale(' + r1(S) + ') skewX(' + r1(sk) +
                           'deg) rotate(' + r1(ro) + 'deg)',
                opacity: r1(op)
            });
        }
        return out;
    }

    /* 缩放效果：极简 2 帧、纯等比、纯直线，全程保持清晰不淡出，
       终点才消失。不设 clipPath / skew / rotate / filter，
       与神灯的「形变卷吸」在视觉上完全分开。 */
    function zoomFrames(rect, a) {
        var dx = a.x - (rect.left + rect.width / 2);
        var dy = a.y - rect.bottom;
        return [
            { offset: 0,
              transform: 'translate(0px,0px) scale(1)', opacity: 1 },
            { offset: 1,
              transform: 'translate(' + Math.round(dx) + 'px,' +
                         Math.round(dy) + 'px) scale(0.03)', opacity: 0 }
        ];
    }

    /* Dock 反馈：神灯是高亮 + 弹动，缩放只短促高亮一下。
       两种模式连「入坞确认」的手感都不一样。 */
    function dockFeedback(a, mode) {
        /* 托盘图标是点击时由 dockMinimize 同步加的，动画结束时再取
           最后一项才精确（动画开始那一刻它可能还不存在）。 */
        var el = null;
        try {
            var t = document.querySelectorAll('.bl-dock-item.bl-dock-tray');
            if (t.length) el = t[t.length - 1];
        } catch (e) { /* ignore */ }
        if (!el) el = a && a.el;
        if (!el || !el.classList) return;
        var quick = mode === 'scale';
        var cls = quick ? 'bl-genie-hit-quick' : 'bl-genie-hit';
        var ms = quick ? 240 : 460;
        try {
            el.classList.remove('bl-genie-hit');
            el.classList.remove('bl-genie-hit-quick');
            void el.offsetWidth;                 /* 强制重排，连点也能重播 */
            el.classList.add(cls);
            setTimeout(function () {
                try { el.classList.remove(cls); } catch (e2) {}
            }, ms);
        } catch (e3) { /* ignore */ }
    }

    /* ==================================================================
       暴露给 popOut 的入口
       返回时长（ms）；动画结束自行调用 fin（popOut 的 fin 有幂等保护）
       ================================================================== */

    /* ==================================================================
       最小化动画统一入口
       ------------------------------------------------------------------
       ⚠ 必须注册在 **window 的捕获阶段**：DOM 事件流是
         window(capture) → document(capture) → ... → target → 冒泡。
       initNativeDockMin、B60 标记、以及各窗口自己的按钮监听都在
       document / 目标上，所以这里一定最先执行，能在窗口被隐藏之前
       加上「隐藏锁」。不调用 preventDefault / stopPropagation ——
       原有最小化逻辑（记位置、加托盘图标、加隐藏类）照常跑完。
       ================================================================== */
    var WIN_SEL = '.addon-window, .tb-win, .vy-win, .grad-win, ' +
                  '.bl-us-window, .bl-pack-win, .bl-site-win';

    function findMinButton(e) {
        var t = e && e.target;
        if (!t || !t.closest) return null;
        var b = t.closest('.addon-window-btn-minimize');
        if (b) return b;
        /* 兜底：某些自定义窗口的最小化键不带原版类名 */
        b = t.closest('.vy-min, .grad-min, .bl-us-min, [data-k="min"], ' +
                      '[title="最小化"], [aria-label="最小化"]');
        return b || null;
    }
    function findWindow(btn) {
        try { return btn.closest(WIN_SEL); } catch (e) { return null; }
    }
    function alreadyDocked(win) {
        try { if (win.classList.contains('bl-win-docked')) return true; }
        catch (e) { /* ignore */ }
        try { if (win.classList.contains('tb-hidden')) return true; }
        catch (e2) { /* ignore */ }
        try {
            if (win.__blDockId && window.__blDockMin &&
                window.__blDockMin.has && window.__blDockMin.has(win.__blDockId)) return true;
        } catch (e3) { /* ignore */ }
        return false;
    }
    function lockVisible(win) {
        var d = 'block';
        try {
            var cs = window.getComputedStyle(win);
            if (cs && cs.display && cs.display !== 'none') d = cs.display;
        } catch (e) { /* ignore */ }
        try {
            win.style.setProperty('--bl-genie-display', d);
            win.classList.add('bl-genie-lock');
            return true;
        } catch (e2) { return false; }
    }
    function unlock(win) {
        try { win.classList.remove('bl-genie-lock'); } catch (e) { /* ignore */ }
        try { win.style.removeProperty('--bl-genie-display'); } catch (e2) { /* ignore */ }
    }

    function onMinClick(e) {
        var btn = findMinButton(e);
        if (!btn) return;
        var win = findWindow(btn);
        if (!win || !win.classList || win.__blGenieBusy) return;
        /* 这次点击是「从 DOCK 恢复」，不是收起，不播动画 */
        if (alreadyDocked(win)) return;
        if (!lockVisible(win)) return;

        var released = false;
        function release() {
            if (released) return;
            released = true;
            unlock(win);
        }
        /* 延后一帧：让 dockMinimize / minimizeWin 先把托盘图标加好，
           动画的 Dock 锚点才指向刚出现的那个图标。 */
        setTimeout(function () {
            if (win.isConnected === false) { release(); return; }
            var dur = 0;
            try {
                dur = window.__blMinimizeAnim(win, release) || 0;
            } catch (eMin) {
                release();
                return;
            }
            /* 硬兜底：WAAPI 不可用 / 动画被取消 / 任何异常，
               都必须在至多 dur+200ms 内解锁，窗口绝不能关不掉。 */
            setTimeout(release,
                (typeof dur === 'number' && dur > 0 ? dur : 440) + 200);
        }, 0);
    }
    try {
        /* 真实浏览器里 document.defaultView === window；嵌入环境拿不到时
           退到 document 捕获，且任何异常都不该中断整个 IIFE。 */
        (document.defaultView || window).addEventListener('click', onMinClick, true);
    } catch (eReg) {
        try { document.addEventListener('click', onMinClick, true); }
        catch (eReg2) { /* ignore */ }
    }

    window.__blMinimizeAnim = function (el, fin) {
        /* 同一窗口只播一次：popOut 万一也走到这里不会重播 */
        if (el && el.__blGenieBusy) return 1;
        if (el) el.__blGenieBusy = true;
        var done = false;
        function finish() {
            if (done) return;
            done = true;
            if (el) el.__blGenieBusy = false;
            try { fin(); } catch (e) { /* ignore */ }
        }
        if (!el || !el.animate || reduceMotion()) { finish(); return 1; }

        var mode = getMin();
        /* 神灯 440ms（原 640）：形变过程更紧凑；缩放 200ms：更利落。
           两者仍保持 2.2 倍时长差，一眼能分出来。 */
        var dur = mode === 'scale' ? 200 : 440;
        var rect = null;
        try { rect = el.getBoundingClientRect(); } catch (e) { /* ignore */ }
        if (!rect || rect.width < 2 || rect.height < 2) { finish(); return 1; }
        var a = dockAnchor();

        var frames = mode === 'scale' ? zoomFrames(rect, a) : genieFrames(rect, a);
        var anim = null;
        try {
            /* transform-origin 放底边中央：缩放围绕它，终点 translate 正好
               把底边中央送到 Dock 图标，漏斗尖端精确入坞。 */
            el.style.transformOrigin = '50% 100%';
            el.style.willChange = 'transform, clip-path, opacity';
            el.classList.add('bl-genie-running');
            anim = el.animate(frames, {
                duration: dur,
                /* 神灯：帧由连续函数采样，段间 linear 即可顺滑推进。
                   缩放：只有 2 帧，用强 ease-in —— 起步慢、后段猛地吸入，
                   与神灯的匀速卷吸形成明显节奏差。 */
                easing: mode === 'scale' ? 'cubic-bezier(.66,.02,.9,.6)' : 'linear',
                fill: 'forwards'
            });
        } catch (e2) {
            try { el.classList.remove('bl-genie-running'); } catch (e3) {}
            finish();
            return 1;
        }

        function cleanup() {
            dockFeedback(a, mode);
            el.__blGenieBusy = false;
            /* 先调 fin（同步摘节点 / 隐藏窗口），再清掉 fill:forwards，
               这样窗口不会在消失前闪回原形。 */
            finish();
            setTimeout(function () {
                try { if (anim) anim.cancel(); } catch (e4) {}
                try { el.classList.remove('bl-genie-running'); } catch (e5) {}
                try { el.style.removeProperty('transform-origin'); } catch (e6) {}
                try { el.style.removeProperty('will-change'); } catch (e7) {}
            }, 0);
        }
        if (anim) {
            anim.onfinish = cleanup;
            anim.oncancel = finish;
        } else {
            cleanup();
            return 1;
        }
        return dur;
    };

    /* [B107] 同帧补挂：首帧扫描不再等各自的定时巡检 */
    if (window.__blSync) window.__blSync.register('B68-genie', function () {
        try { scan(); } catch (eB68) { /* ignore */ }
    }, true);
    })();
