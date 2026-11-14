
(function () {
    'use strict';
    if (window.__blPaintScroll) return;
    window.__blPaintScroll = true;

    var SEL = '[class*="paint-editor_editor-container-top_"]';
    var box = null, saved = 0, drag = null, mo = null, moHost = null;

    function wide() {
        return document.documentElement &&
               document.documentElement.classList.contains('bl-paint-wide');
    }
    function maxScroll(n) { return Math.max(0, n.scrollWidth - n.clientWidth); }
    function isInteractive(t) {
        try {
            return !!(t && t.closest && t.closest(
                'button, input, select, textarea, label, a, [role="button"], ' +
                '[contenteditable], [class*="dropdown"], [class*="color-button"]'));
        } catch (e) { return !!t; }
    }
    function hint() {
        if (!box || !box.isConnected) return;
        var max = maxScroll(box), left = box.scrollLeft;
        box.classList.toggle('bl-ps-more-l', max > 2 && left > 2);
        box.classList.toggle('bl-ps-more-r', max > 2 && left < max - 2);
    }

    /* 竖向滚轮转成横向：只在确实可滚、且没到边界时接管，避免吞掉页面滚动 */
    function onWheel(e) {
        if (!wide() || !box || e.shiftKey) return;
        if (Math.abs(e.deltaX) > 0.5) return;      /* 触控板横向手势交原生 */
        var d = e.deltaY;
        if (!d) return;
        var max = maxScroll(box);
        if (max <= 1) return;
        if ((d > 0 && box.scrollLeft >= max - 1) ||
            (d < 0 && box.scrollLeft <= 1)) return;  /* 边界放行 */
        if (e.cancelable) e.preventDefault();
        box.scrollLeft = Math.max(0, Math.min(max, box.scrollLeft + d));
        hint();
    }

    /* 空白处按住拖动，像抓着工具条一样左右拉 */
    function onDown(e) {
        if (!box || e.button !== 0 || isInteractive(e.target)) return;
        if (maxScroll(box) <= 1) return;
        drag = { x: e.clientX, left: box.scrollLeft };
        box.classList.add('bl-ps-grabbing');
        try { box.setPointerCapture && e.pointerId != null &&
              box.setPointerCapture(e.pointerId); } catch (e2) { /* ignore */ }
    }
    function onMove(e) {
        if (!drag || !box) return;
        var max = maxScroll(box);
        box.scrollLeft = Math.max(0, Math.min(max, drag.left - (e.clientX - drag.x)));
        hint();
    }
    function onUp() {
        if (!drag) return;
        drag = null;
        if (box) box.classList.remove('bl-ps-grabbing');
    }

    function onKey(e) {
        if (!box) return;
        var max = maxScroll(box), step = e.shiftKey ? 260 : 90, to = null;
        switch (e.key) {
            case 'ArrowRight': to = box.scrollLeft + step; break;
            case 'ArrowLeft':  to = box.scrollLeft - step; break;
            case 'Home':       to = 0; break;
            case 'End':        to = max; break;
            default: return;
        }
        e.preventDefault();
        box.scrollLeft = Math.max(0, Math.min(max, to));
        hint();
    }
    function onScroll() {
        if (box) saved = box.scrollLeft;
        hint();
    }

    function detach() {
        if (!box) return;
        try {
            box.removeEventListener('wheel', onWheel);
            box.removeEventListener('pointerdown', onDown);
            box.removeEventListener('pointermove', onMove);
            box.removeEventListener('pointerup', onUp);
            box.removeEventListener('pointercancel', onUp);
            box.removeEventListener('keydown', onKey);
            box.removeEventListener('scroll', onScroll);
        } catch (e) { /* ignore */ }
        box = null;
    }
    function attach() {
        var n = document.querySelector(SEL);
        if (n === box) { hint(); return; }
        detach();
        if (!n) return;
        box = n;
        try {
            box.addEventListener('wheel', onWheel, { passive: false });
            box.addEventListener('pointerdown', onDown);
            box.addEventListener('pointermove', onMove);
            box.addEventListener('pointerup', onUp);
            box.addEventListener('pointercancel', onUp);
            box.addEventListener('keydown', onKey);
            box.addEventListener('scroll', onScroll, { passive: true });
            if (!box.hasAttribute('tabindex')) box.setAttribute('tabindex', '0');
        } catch (e) { /* ignore */ }
        if (saved > 0) { try { box.scrollLeft = saved; } catch (e2) {} }
        hint();
    }

    /* 只观察具体的 paint 容器，避开全文档观察在加载期被冻结 */
    function watchHost() {
        if (!window.MutationObserver) return;
        var host = document.querySelector('[class*="paint-editor_editor-container_"]');
        if (!host || host === moHost) return;
        moHost = host;
        try { if (mo) mo.disconnect(); } catch (e) { /* ignore */ }
        try {
            mo = new MutationObserver(function () { attach(); });
            mo.observe(host, { childList: true, subtree: true });
        } catch (e2) { mo = null; }
    }

    function loop() {
        try { watchHost(); attach(); } catch (e) { /* ignore */ }
        setTimeout(loop, 400);
    }
    window.addEventListener('resize', hint, { passive: true });
    setTimeout(loop, 300);
    attach();

    /* [B107] 同帧补挂：首帧扫描不再等各自的定时巡检 */
    if (window.__blSync) window.__blSync.register('B74-paint-scroll', function () {
        try { watchHost(); attach(); } catch (eB74) { /* ignore */ }
    }, true);
    })();
