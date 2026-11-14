

/* ── [B108] 主题色 / 顶部栏宽度 / 文案兜底 ───────────────────────── */
(function () {
    'use strict';
    if (window.__blTheme108) return;
    window.__blTheme108 = true;

    var KEY = 'bl:se-paint-top-w';
    var MIN_W = 240;                 /* 最窄：仍能看见名称行与几枚工具 */
    var SEL = '[class*="paint-editor_editor-container-top_"]';

    function zh() {
        try { return !/^en/i.test(document.documentElement.lang || ''); }
        catch (e) { return true; }
    }
    function saved() {
        try { var v = parseInt(localStorage.getItem(KEY) || '', 10); return isFinite(v) ? v : 0; }
        catch (e) { return 0; }
    }
    function store(v) { try { localStorage.setItem(KEY, String(v)); } catch (e) {} }

    function attach(host) {
        if (!host || host.__blTopResize) return;
        host.__blTopResize = true;
        host.setAttribute('data-bl-top-resize', '1');
        var handle = document.createElement('div');
        handle.className = 'bl-top-resize';
        handle.title = zh() ? '拖动调整顶部栏宽度 · 双击复原' : 'Drag to resize the top bar · double-click to reset';
        host.appendChild(handle);

        var w = saved();
        if (w >= MIN_W) host.style.width = w + 'px';

        var dragging = false, startX = 0, startW = 0, raf = 0, nextW = 0, gen = 0;
        function applyWidth() {
            raf = 0;
            host.style.width = nextW + 'px';
        }
        handle.addEventListener('pointerdown', function (e) {
            if (e.button !== 0) return;
            e.preventDefault(); e.stopPropagation();
            dragging = true;
            startX = e.clientX;
            startW = host.getBoundingClientRect().width || host.offsetWidth || MIN_W;
            handle.classList.add('is-active');
            host.classList.add('bl-top-resizing');
            try { handle.setPointerCapture(e.pointerId); } catch (err) {}
        });
        handle.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            var parent = host.parentElement;
            var maxW = Math.max(MIN_W, (parent ? parent.clientWidth : window.innerWidth) - 16);
            nextW = Math.max(MIN_W, Math.min(maxW, Math.round(startW + (e.clientX - startX))));
            gen++;
            if (!raf) raf = requestAnimationFrame(applyWidth);
        });
        function end() {
            if (!dragging) return;
            dragging = false;
            if (raf) { cancelAnimationFrame(raf); raf = 0; }
            host.style.width = nextW + 'px';
            store(nextW);
            handle.classList.remove('is-active');
            host.classList.remove('bl-top-resizing');
            try { window.dispatchEvent(new Event('resize')); } catch (err) {}
        }
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
        window.addEventListener('pointerup', end);
        handle.addEventListener('dblclick', function (e) {
            e.preventDefault(); e.stopPropagation();
            host.style.removeProperty('width');
            try { localStorage.removeItem(KEY); } catch (err) {}
            try { window.dispatchEvent(new Event('resize')); } catch (err2) {}
        });
    }

    function tick() {
        /* 按钮文案兜底：React 重绘后仍叫「主题色」 */
        var btn = document.querySelector('.tw-theme-btn');
        if (btn) {
            var sp = btn.querySelector('span');
            if (sp && sp.textContent === '主题') sp.textContent = '主题色';
            if (btn.getAttribute('aria-label') === '切换主题') btn.setAttribute('aria-label', '切换主题色');
        }
        var head = document.querySelector('.tw-panel-head');
        if (head && head.textContent === '主题') head.textContent = '主题色';
        try {
            var hosts = document.querySelectorAll(SEL);
            for (var i = 0; i < hosts.length; i++) attach(hosts[i]);
        } catch (e) { /* ignore */ }
    }

    if (window.__blSync && typeof window.__blSync.register === 'function') {
        window.__blSync.register('theme108-topbar', tick);
    } else {
        document.addEventListener('DOMContentLoaded', tick);
        window.setInterval(tick, 900);
    }
    tick();
})();

