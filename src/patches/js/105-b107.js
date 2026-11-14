
/* 玻璃状态 → <html> class + 一组 CSS 变量。
   取值优先复用毛玻璃补充表发布的 --bl-glass-*（与弹窗逐字同源），
   液态玻璃开启 / 表尚未注入时按同一套比例自算。 */
(function () {
    'use strict';
    if (window.__blDockGlassSync) return;
    window.__blDockGlassSync = true;

    var CLS = 'bl-dock-glass-on';
    var VARS = [
        '--bl-dock-glass-body', '--bl-dock-glass-inner',
        '--bl-dock-glass-hi', '--bl-dock-glass-shade',
        '--bl-dock-glass-line', '--bl-dock-glass-shadow'
    ];
    var FROST = 'bl:frosted-glass';
    var LIQUID = 'bl:liquid-glass';
    var last = '';

    function raw(k) {
        try { return window.localStorage.getItem(k) || ''; } catch (e) { return ''; }
    }
    function obj(k) {
        try { return JSON.parse(raw(k) || 'null'); } catch (e) { return null; }
    }
    function rgba(t, a) { return 'rgba(' + t + ',' + a + ')'; }

    /* 与毛玻璃补充表 glassIsDark() 同源：先看 --color-scheme，
       再看 --text-primary 亮度兜底（自定义主题可能不写 color-scheme）。 */
    function dark() {
        var cs;
        try { cs = getComputedStyle(document.documentElement); } catch (e) { return false; }
        try {
            var v = String(cs.getPropertyValue('--color-scheme')).trim();
            if (v === 'dark') return true;
            if (v === 'light') return false;
        } catch (e2) { /* ignore */ }
        try {
            var c = String(cs.getPropertyValue('--text-primary'));
            var m = /(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(c);
            if (m) return (0.2126 * (+m[1]) + 0.7152 * (+m[2]) + 0.0722 * (+m[3])) > 150;
        } catch (e3) { /* ignore */ }
        return false;
    }

    function state() {
        var f = obj(FROST), l = obj(LIQUID);
        if (f && f.enabled) return { kind: 'frost', cfg: f };
        if (l && l.enabled) return { kind: 'liquid', cfg: l };
        return null;
    }

    function setVars(root, v) {
        for (var i = 0; i < VARS.length; i++) {
            try {
                if (v && v[VARS[i]]) root.style.setProperty(VARS[i], v[VARS[i]]);
                else root.style.removeProperty(VARS[i]);
            } catch (e) { /* ignore */ }
        }
    }

    function tick(force) {
        var root = document.documentElement;
        if (!root) return;
        var st = state();
        var dk = dark();
        var fRaw = raw(FROST), lRaw = raw(LIQUID);

        /* 签名含主题与两份原始配置，滑杆/主题变化都会重算；
           静息时一次 DOM 写入都不做。 */
        var sig = (st ? st.kind : 'off') + '|' + (dk ? 1 : 0) + '|' + fRaw + '|' + lRaw;
        if (!force && sig === last) return;
        last = sig;

        if (!st) {
            root.classList.remove(CLS);
            root.classList.remove('bl-dock-liquid-on');
            setVars(root, null);
            return;
        }
        root.classList.add(CLS);
        /* 只在液态玻璃下覆盖 DOCK 胶囊：毛玻璃有自己的 GLASS_DEPTH 层次 */
        if (st.kind === 'liquid') root.classList.add('bl-dock-liquid-on');
        else root.classList.remove('bl-dock-liquid-on');

        var t = dk ? '0, 0, 0' : '255, 255, 255';
        var p, blur;
        if (st.kind === 'frost') {
            var op = typeof st.cfg.opacity === 'number' ? st.cfg.opacity : 0.25;
            var bo = typeof st.cfg.themeBoost === 'number' ? st.cfg.themeBoost : 0.15;
            p = dk ? Math.min(0.72, op + bo) : op;
            p = Math.max(0.05, Math.min(0.72, p));
            blur = Math.max(2, Math.round(
                typeof st.cfg.blurRadius === 'number' ? st.cfg.blurRadius : 12));
        } else {
            /* 液态没有 opacity 档位，取与毛玻璃默认相当的观感，
               让图标不至于过实、也不至于透得看不见轮廓。 */
            p = dk ? 0.30 : 0.22;
            blur = Math.max(2, Math.round(
                typeof st.cfg.blur === 'number' ? st.cfg.blur : 6));
        }

        /* 优先复用补充表的同源变量；表被移除（液态互斥关毛玻璃）时自算。 */
        var cs;
        try { cs = getComputedStyle(root); } catch (e) { cs = null; }
        function pick(name, fb) {
            var v = '';
            try { v = cs ? String(cs.getPropertyValue(name)).trim() : ''; } catch (e2) { /* ignore */ }
            return /^rgba?\(/.test(v) ? v : fb;
        }
        /* 图标只有 44px，用弹窗「面板档」而不是更淡的「窗体档」：
           太透会连轮廓都看不清。仍与弹窗同源，只是取更实的那一阶。 */
        var body = pick('--bl-glass-panel', rgba(t, (p * 0.80).toFixed(3)));
        var inner = pick('--bl-glass-inner', rgba(t, (p * 0.40).toFixed(3)));
        var line = pick('--bl-glass-line', rgba(t, dk ? 0.22 : 0.14));
        var hi = rgba('255, 255, 255', dk ? 0.20 : 0.34);
        var shade = rgba('0, 0, 0', dk ? 0.34 : 0.10);

        /* 模糊半径参与阴影扩散：调毛玻璃滑杆时，图标层次跟着一起变，
           而不是只有胶囊变、图标纹丝不动。 */
        var near = 2 + Math.round(blur * 0.25);
        var far = 8 + Math.round(blur * 1.1);
        var shadow = '0 ' + near + 'px ' + (near + 4) + 'px rgba(0,0,0,' +
            (dk ? 0.20 : 0.08) + '), 0 ' + Math.round(far * 0.7) + 'px ' +
            far + 'px rgba(0,0,0,' + (dk ? 0.30 : 0.14) + ')';

        var v = {};
        v[VARS[0]] = body;
        v[VARS[1]] = inner;
        v[VARS[2]] = hi;
        v[VARS[3]] = shade;
        v[VARS[4]] = line;
        v[VARS[5]] = shadow;
        setVars(root, v);
    }

    try {
        window.addEventListener('bl:glass-change', function () { tick(); });
        window.addEventListener('bl:win-appearance-change', function () { tick(); });
        window.addEventListener('storage', function (e) {
            if (e && (e.key === FROST || e.key === LIQUID)) tick();
        });
    } catch (e) { /* ignore */ }

    /* 主题由样式表切换时不会派发事件，靠低频签名轮询兜底。 */
    window.setInterval(function () { try { tick(); } catch (e2) { /* ignore */ } }, 1200);
    try { tick(true); } catch (e3) { /* ignore */ }

    /* [B107] 同帧补挂：首帧扫描不再等各自的定时巡检 */
    if (window.__blSync) window.__blSync.register('B72-glass-state', function () {
        try { tick(); } catch (eB72) { /* ignore */ }
    }, true);
    })();
