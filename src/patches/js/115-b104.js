
(function () {
    'use strict';
    if (window.__blSnapEnhance) return;
    window.__blSnapEnhance = true;

    var FROST = 'bl:frosted-glass';
    var LIQUID = 'bl:liquid-glass';
    var CLS = 'bl-snap-glass-on';
    var CLS_L = 'bl-snap-liquid-on';
    var VARS = ['--bl-snap-body', '--bl-snap-inner', '--bl-snap-line',
                '--bl-snap-blur', '--bl-snap-sheen', '--bl-snap-shadow',
                '--bl-snap-preview-bg'];

    var LABELS = {
        left:   ['左半', 'Left half'],       top:   ['上半', 'Top half'],
        bottom: ['下半', 'Bottom half'],    right: ['右半', 'Right half'],
        tl:     ['左上', 'Top left'],       tr:    ['右上', 'Top right'],
        bl:     ['左下', 'Bottom left'],    br:    ['右下', 'Bottom right'],
        thirdL: ['左 1/3', 'Left third'],   thirdC:['中 1/3', 'Middle third'],
        thirdR: ['右 1/3', 'Right third'],  full:  ['铺满', 'Fill screen'],
        center: ['居中还原', 'Center & restore']
    };
    var COUNT = 13;

    function isZh() {
        try { return /^zh/i.test(document.documentElement.lang || ''); }
        catch (e) { return true; }
    }
    function raw(k) {
        try { return window.localStorage.getItem(k) || ''; } catch (e) { return ''; }
    }
    function obj(k) {
        try { return JSON.parse(raw(k) || 'null'); } catch (e) { return null; }
    }
    function rgba(t, a) { return 'rgba(' + t + ',' + a + ')'; }
    /* 与 B87 / 毛玻璃补充表 glassIsDark() 同源：先看 --color-scheme，
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

    var lastSig = '';
    function tick(force) {
        var root = document.documentElement;
        if (!root) return;
        var st = state(), dk = dark();
        var fRaw = raw(FROST), lRaw = raw(LIQUID);
        var sig = (st ? st.kind : 'off') + '|' + (dk ? 1 : 0) + '|' + fRaw + '|' + lRaw;
        if (!force && sig === lastSig) return;
        lastSig = sig;

        function setVars(v) {
            for (var i = 0; i < VARS.length; i++) {
                try {
                    if (v && v[VARS[i]]) root.style.setProperty(VARS[i], v[VARS[i]]);
                    else root.style.removeProperty(VARS[i]);
                } catch (e) { /* ignore */ }
            }
        }
        if (!st) {
            root.classList.remove(CLS);
            root.classList.remove(CLS_L);
            setVars(null);
            return;
        }
        root.classList.add(CLS);
        if (st.kind === 'liquid') root.classList.add(CLS_L);
        else root.classList.remove(CLS_L);

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
            p = dk ? 0.30 : 0.22;
            blur = Math.max(2, Math.round(
                typeof st.cfg.blur === 'number' ? st.cfg.blur : 6));
        }

        /* 优先复用毛玻璃补充表发布的同源变量；液态互斥时表被移除，按同比例自算 */
        var cs;
        try { cs = getComputedStyle(root); } catch (e) { cs = null; }
        function pick(name, fb) {
            var v = '';
            try { v = cs ? String(cs.getPropertyValue(name)).trim() : ''; } catch (e2) { /* ignore */ }
            return /^rgba?\(/.test(v) ? v : fb;
        }
        var body = pick('--bl-glass-body', rgba(t, (p * 0.55).toFixed(3)));
        var inner = pick('--bl-glass-inner', rgba(t, (p * 0.40).toFixed(3)));
        var line = pick('--bl-glass-line', rgba(t, dk ? 0.22 : 0.14));
        var blurCss = 'blur(' + blur + 'px) saturate(150%)';
        /* 模糊半径参与阴影扩散：拖动滑杆时定位框的厚度跟着变 */
        var near = 2 + Math.round(blur * 0.25);
        var far = 10 + Math.round(blur * 1.2);
        var shadow = 'inset 0 1px 0 ' + rgba('255,255,255', dk ? 0.20 : 0.34) +
            ', inset ' + (dk ? '0 -1px 0 rgba(0,0,0,.30)' : '0 -1px 0 rgba(0,0,0,.08)') +
            ', 0 ' + near + 'px ' + (near + 4) + 'px rgba(0,0,0,' + (dk ? 0.20 : 0.08) + ')' +
            ', 0 ' + Math.round(far * 0.7) + 'px ' + far + 'px rgba(0,0,0,' +
            (dk ? 0.30 : 0.14) + ')';
        /* 右上角无光影：只从左上角起 42% 渐隐 */
        var sheen = 'radial-gradient(140% 1px at 0% 0%, rgba(255,255,255,' +
            (dk ? 0.20 : 0.30) + ') 0%, rgba(255,255,255,0) 42%), ' +
            'linear-gradient(135deg, rgba(255,255,255,' + (dk ? 0.14 : 0.20) +
            ') 0%, rgba(255,255,255,0) 42%)';
        var v = {};
        v[VARS[0]] = body;
        v[VARS[1]] = inner;
        v[VARS[2]] = line;
        v[VARS[3]] = blurCss;
        v[VARS[4]] = sheen;
        v[VARS[5]] = shadow;
        v[VARS[6]] = rgba(t, dk ? 0.10 : 0.16);
        setVars(v);
    }

    /* ---------- DOM 装饰：标题 / 提示 / 双语标签 / 序号 ---------- */
    var decoSig = '';
    function decorate() {
        var panel = document.querySelector('.bl-snap');
        if (!panel) return;
        var zh = isZh();
        var zones = panel.querySelectorAll('.bl-snap-grid .bl-snap-zone');
        var sig = (zh ? 'zh' : 'en') + '|' + zones.length + '|' + panel.getAttribute('data-snap-deco');
        if (sig === decoSig) return;

        /* [B104] 窗口化后标题/提示属于内容区，不能插到 addon-window 根下
           （那样会排在 header 之前，破坏窗口布局）。 */
        var box = panel.querySelector('.bl-uni-content') || panel;
        if (!panel.querySelector('.bl-snap-head')) {
            var head = document.createElement('div');
            head.className = 'bl-snap-head';
            box.insertBefore(head, box.firstChild);
        }
        if (!panel.querySelector('.bl-snap-foot')) {
            var foot = document.createElement('div');
            foot.className = 'bl-snap-foot';
            box.appendChild(foot);
        }
        var h = panel.querySelector('.bl-snap-head');
        var f = panel.querySelector('.bl-snap-foot');
        var headHtml = '<span class="bl-snap-head-dot"></span>' +
            '<span class="bl-snap-head-t">' + (zh ? '快速定位' : 'Snap layout') + '</span>' +
            '<span class="bl-snap-head-sub">' +
            (zh ? '拖到格子松手贴靠' : 'Drop on a tile to snap') + '</span>';
        if (h.innerHTML !== headHtml) h.innerHTML = headHtml;
        var footHtml = '<span>' + (zh ? '移出面板 / Esc 取消' : 'Move out or Esc to cancel') + '</span>' +
            '<span><b>' + COUNT + '</b> ' + (zh ? '个定位点' : 'positions') + '</span>';
        if (f.innerHTML !== footHtml) f.innerHTML = footHtml;

        for (var i = 0; i < zones.length; i++) {
            var z = zones[i];
            var id = z.getAttribute('data-zone');
            var pair = LABELS[id];
            var label = pair ? pair[zh ? 0 : 1] : (pair ? pair[0] : id);
            if (z.textContent !== label) z.textContent = label;
            var tip = zh
                ? (label + ' · 拖到这里松手即可贴靠')
                : (label + ' · drop here to snap');
            if (z.getAttribute('title') !== tip) z.setAttribute('title', tip);
            /* 错开入场：由 CSS animation-delay 读取，纯数字变量 */
            if (z.style.getPropertyValue('--bl-snap-i') !== String(i)) {
                z.style.setProperty('--bl-snap-i', String(i));
            }
        }
        panel.setAttribute('data-snap-deco', '1');
        decoSig = (zh ? 'zh' : 'en') + '|' + zones.length + '|1';
    }

    /* ---------- 每次打开都重播弹出动画 ---------- */
    var lastOpen = false;
    function checkOpen() {
        var panel = document.querySelector('.bl-snap');
        var open = !!(panel && panel.classList.contains('is-open'));
        if (open !== lastOpen) {
            lastOpen = open;
            if (open && panel) {
                try {
                    panel.classList.remove('bl-snap-pop');
                    void panel.offsetWidth;
                    panel.classList.add('bl-snap-pop');
                } catch (e) { /* ignore */ }
                tick(true);
            }
        }
        return open;
    }

    /* ---------- 调度：精确观察宿主，签名短路，静息零写入 ---------- */
    var pending = false, mo = null, moHost = null;
    function sync() {
        try { decorate(); checkOpen(); tick(); } catch (e) { /* ignore */ }
    }
    function schedule() {
        if (pending) return;
        pending = true;
        window.setTimeout(function () { pending = false; sync(); }, 0);
    }
    function attach() {
        if (!window.MutationObserver) return;
        var host = document.getElementById('bl-top-layer');
        if (!host || host === moHost) return;
        moHost = host;
        try { if (mo) mo.disconnect(); } catch (e) { /* ignore */ }
        try {
            /* 打开状态同步检测：必须在浏览器绘制前完成，否则动画类
               晚一帧才补上会先闪一下最终态。其余装饰走合并调度。 */
            mo = new MutationObserver(function () { checkOpen(); schedule(); });
            mo.observe(host, { childList: true, subtree: true,
                               attributes: true, attributeFilter: ['class'] });
        } catch (e2) { mo = null; }
    }
    try {
        window.addEventListener('bl:glass-change', function () { tick(); decorate(); });
        window.addEventListener('bl:win-appearance-change', function () { tick(); });
        window.addEventListener('mw:theme-applied', function () { tick(); decorate(); });
        window.addEventListener('storage', function (e) {
            if (e && (e.key === FROST || e.key === LIQUID || /theme/i.test(e.key || ''))) {
                tick(); decorate();
            }
        });
        window.addEventListener('resize', schedule, { passive: true });
    } catch (e) { /* ignore */ }

    /* 低频兜底：宿主由别的脚本晚创建、主题由样式表切换、外部直写存档 */
    window.setInterval(function () {
        try { attach(); sync(); } catch (e2) { /* ignore */ }
    }, 700);
    attach();
    sync();

    window.__blSnapEnhance = {
        tick: tick, decorate: decorate, sync: sync, state: state,
        labels: LABELS, count: COUNT,
        force: function () { tick(true); decoSig = ''; decorate(); return checkOpen(); }
    };
})();
