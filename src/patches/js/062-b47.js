/* ── [B47] 弹窗按钮运行时 ───────────────────────────────────────────────
   依赖：B41 / B48
   维护：MAC / WIN / MIST 三态与三键图标
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * __blWinButtonsRuntime —— 弹窗按钮运行时应用
 * 读取 bl:win-buttons，把按钮位置/样式/标题位置/自定义图标下发到真实 .addon-window。
 * 通过 MutationObserver 监听新窗口 + 轮询兜底，CSS 覆盖 + 图标 DOM 替换。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blWinButtonsRuntime) return;

    var STYLE_ID = 'bl-win-buttons-style';

    function read() {
        try { return window.__blSettings ? window.__blSettings.get('winButtons') : null; } catch (e) { return null; }
    }

    /* MAC 全套圆点规则。原生 window-style=macos 也会注入一套，两者配色一致；
       这里自带一份，是为了 preset 尚未同步时按钮样式也一定生效（不再依赖
       第二张表的时序）。 */
    function macCss() {
        return '.addon-window .addon-window-btn{width:12px !important;height:12px !important;' +
                   'border-radius:50% !important;padding:0 !important;}' +
               '.addon-window .addon-window-controls{gap:8px !important;}' +
               '.addon-window .addon-window-btn svg,.addon-window .addon-window-btn img{' +
                   'opacity:0 !important;pointer-events:none !important;}' +
               /* .vy-close 是八音盒的历史类名，缺 addon-window-btn-close；
                  这里兜底上色，避免 MAC 下变成一个透明圆点。 */
               '.addon-window .addon-window-btn-close,.addon-window .addon-window-btn.vy-close{' +
                   'background:#FF5F57 !important;color:#FF5F57 !important;}' +
               '.addon-window .addon-window-btn-minimize{background:#FEBC2E !important;color:#FEBC2E !important;}' +
               '.addon-window .addon-window-btn-maximize,.addon-window .addon-window-btn-restore{' +
                   'background:#28C840 !important;color:#28C840 !important;}' +
               '.addon-window .addon-window-btn:hover{filter:brightness(.9) !important;}';
    }

    /* 把每条规则提到 html:root 下：特异性从 (0,2,0) 升到 (0,3,1)。
       以前靠「每 150ms 把 <style> 移到 head 末尾」压过原生 macos / 玻璃表，
       两张表互相踢 → 整份 CSSOM 反复重建，MAC 规则最多所以最卡。
       现在顺序不再决定胜负，<style> 只在内容真变化时才动一次。 */
    function boost(css) {
        return css.replace(/([^{}]+)\{/g, function (m, sel) {
            var parts = sel.split(',');
            for (var i = 0; i < parts.length; i++) {
                parts[i] = 'html:root ' + parts[i].trim();
            }
            return parts.join(',') + '{';
        });
    }

    function rawSig() {
        try { return localStorage.getItem('bl:win-buttons') || ''; } catch (e) { return ''; }
    }

    function build() {
        var c = read() || {};
        var layout = c.layout || 'auto';
        var btnStyle = c.btnStyle || 'mist';
        /* 旧存档 rounded/square/circle -> MIST/WIN/MAC */
        if (btnStyle === 'rounded') btnStyle = 'mist';
        else if (btnStyle === 'square') btnStyle = 'win';
        else if (btnStyle === 'circle') btnStyle = 'mac';
        var titlePos = c.titlePos || 'left';
        var css = '';

        /* ── ① 按钮左右位置 ──────────────────────────────────────────
           原生 window-style=macos 写死 .addon-window-controls{order:1
           !important} / .addon-window-title{order:2 !important}，旧版
           [B48] 又写 .addon-window .addon-window-header{row-reverse}，
           两者都压过这里原来的 0,1,0 无 !important 规则 —— 所以 MAC 下
           「按钮位置」怎么调都不动。
           现在统一用 0,2,0 + !important 的 order 控制左右，且不再用
           row-reverse（它会连带把红黄绿三点的内部顺序也反过来）。 */
        var onLeft = (layout === 'left');
        css += '.addon-window .addon-window-header{flex-direction:row !important;}';
        css += '.addon-window .addon-window-controls{order:' + (onLeft ? 1 : 2) +
               ' !important;justify-content:' + (onLeft ? 'flex-start' : 'flex-end') +
               ' !important;}';
        css += '.addon-window .addon-window-title{order:' + (onLeft ? 2 : 1) +
               ' !important;flex:1 1 auto !important;}';

        /* ── ② 按钮样式（唯一来源：bl:win-buttons.btnStyle） ─────────── */
        var r = btnStyle === 'mac' ? '50%' : (btnStyle === 'win' ? '0px' : '6px');
        css += '.addon-window .addon-window-btn{border-radius:' + r + ' !important;}';
        if (btnStyle === 'mac') {
            css += macCss();
        } else if (btnStyle === 'win') {
            css += '.addon-window .addon-window-header{background:var(--ui-tertiary,#e6e9f0) !important;}';
        }

        /* ── ③ 标题对齐 ────────────────────────────────────────────── */
        var ta = titlePos === 'center' ? 'center' : (titlePos === 'right' ? 'right' : 'left');
        css += '.addon-window .addon-window-title{text-align:' + ta + ' !important;}';

        return css;
    }

    function applyCss(css) {
        var el = document.getElementById(STYLE_ID);
        if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            document.head.appendChild(el);
        }
        if (el.textContent !== css) el.textContent = css;
        /* 特异性已由 boost 保证，不再需要「每 tick 归位」；
           applyCss 只在签名变化时调用，这里做一次幂等归位即可。 */
        try {
            if (el.parentNode && el.parentNode.lastChild !== el) el.parentNode.appendChild(el);
        } catch (e) { /* ignore */ }
    }

    /* 原版三键：最小化=横线，最大化=方框，关闭=×。
       ⚠ 没有自定义图标时绝不改写按钮 DOM —— 旧版在这里一律塞 × 的占位
       SVG，才把顶部栏三个键全变成了叉。 */
    var DEFAULT_ICONS = {
        min:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        max:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>',
        close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
    };

    /* 只接受图片 dataURL：坏的设置值（对象/[object Object]）一律忽略 */
    function safeIcon(v) {
        return (typeof v === 'string' && v.indexOf('data:image') === 0) ? v : '';
    }
    function safeScale(v) {
        return (typeof v === 'number' && isFinite(v) && v > 0) ? v : 100;
    }

    function applyIcon(btn, url, scale, kind) {
        if (!btn) return;
        url = safeIcon(url);
        var s = safeScale(scale);
        /* 签名要连缩放一起比：旧版只比 url，改了缩放条（或清除后
           再导入同一张图）会直接 return，真实窗口的三键纹丝不动。 */
        var sig = url + '|' + s;
        /* 从未自定义过：完全不碰 DOM，保留窗口系统自己画的三枚按钮
           （macOS 预设是纯色圆点，没有 svg，不能被覆写）。 */
        if (!url && !btn.__blIcon) { btn.__blIconSig = sig; return; }
        /* 不能只信签名：设置窗口由 React 重绘时可能复用同一个 button
           节点、把 innerHTML 重设回原生 svg，而签名还停在旧值上就会短路，
           表现为「自定义图标导入后过一会儿又不跟随了」。 */
        var domOk;
        if (url) {
            var cur = btn.querySelector('img');
            domOk = !!cur && cur.getAttribute('src') === url;
        } else {
            domOk = !!btn.querySelector('svg') && !btn.querySelector('img');
        }
        if (btn.__blIconSig === sig && domOk) return;
        btn.__blIconSig = sig;
        if (!url) {
            /* 用户清除了自定义图标：按类型恢复对应原生图标 */
            btn.__blIcon = '';
            btn.innerHTML = DEFAULT_ICONS[kind] || DEFAULT_ICONS.close;
            return;
        }
        btn.__blIcon = url;
        var img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.style.cssText = 'width:' + (12 * s / 100).toFixed(1) + 'px;height:' + (12 * s / 100).toFixed(1) + 'px;object-fit:contain;display:block;pointer-events:none;';
        btn.innerHTML = '';
        btn.appendChild(img);
    }

    function applyToWindow(win) {
        if (!win) return;
        var c = read() || {};
        var btns = {
            min: win.querySelector('.addon-window-btn-minimize') ||
                 win.querySelector('.vy-min, .grad-min, [data-pract="min"], [data-k="min"]'),
            max: win.querySelector('.addon-window-btn-maximize') ||
                 win.querySelector('.vy-max, .grad-max, [data-pract="max"], [data-k="max"]'),
            /* 八音盒历史类名是 .vy-close（缺 -close 后缀），补上兜底，
               否则自定义图标清除逻辑永远碰不到它。 */
            close: win.querySelector('.addon-window-btn-close') ||
                   win.querySelector('.vy-close, .sw-close, [data-pract="close"], [data-k="close"]')
        };
        /* 自定义顶部栏按钮已删除：三键一律恢复原生 — □ × */
        if (btns.min)   applyIcon(btns.min,   '', 100, 'min');
        if (btns.max)   applyIcon(btns.max,   '', 100, 'max');
        if (btns.close) applyIcon(btns.close, '', 100, 'close');
    }

    function applyAllIcons() {
        var wins = document.querySelectorAll('.addon-window');
        for (var i = 0; i < wins.length; i++) applyToWindow(wins[i]);
    }

    /* 签名短路：配置没变就一个 DOM 操作、一次 qSA 都不做。
       旧版每 150ms 无条件 build() + 全文档 qSA + 移动 <style>，
       在 MAC（规则最多）下会持续重建 CSSOM，是卡顿主因。 */
    var lastSig = null, lastCss = null;
    function tick(force) {
        var sig = rawSig();
        if (!force && sig === lastSig) {
            if (!document.getElementById(STYLE_ID)) {
                lastCss = null;
                applyCss(boost(build()));
            }
            return;
        }
        lastSig = sig;
        var css = boost(build());
        if (css !== lastCss) { lastCss = css; applyCss(css); }
        /* 图标只在配置真变化时全量对齐一次；窗口新增另由 observer 处理 */
        applyAllIcons();
    }
    function onChange() { tick(); }

    /* 监听新窗口插入：WeakSet 去重，React 反复重绘不会重复扫同一窗口 */
    var seen = (typeof WeakSet === 'function') ? new WeakSet() : null;
    function handleWin(w) {
        if (!w) return;
        if (seen) { if (seen.has(w)) return; seen.add(w); }
        applyToWindow(w);
    }
    var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
            var added = muts[i].addedNodes;
            if (!added) continue;
            for (var j = 0; j < added.length; j++) {
                var n = added[j];
                if (!n || n.nodeType !== 1) continue;
                if (n.classList && n.classList.contains('addon-window')) { handleWin(n); continue; }
                if (!n.querySelectorAll) continue;
                var wins = n.querySelectorAll('.addon-window');
                for (var k = 0; k < wins.length; k++) handleWin(wins[k]);
            }
        }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('storage', function (e) {
        if (e && (e.key === 'bl:win-buttons' || e.key === 'mw:style-window-style')) onChange();
    });
    window.addEventListener('bl:win-buttons-change', onChange);
    window.addEventListener('bl:window-preset', onChange);
    /* 低频兜底，带签名短路：静息时零成本 */
    setInterval(tick, 1500);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { tick(true); });
    else tick(true);

    window.__blWinButtonsRuntime = { tick: tick, applyToWindow: applyToWindow };
})();
