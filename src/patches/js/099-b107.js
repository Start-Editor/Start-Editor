
(function () {
    'use strict';
    if (window.__blPaintPlus) return;
    window.__blPaintPlus = true;

    /* ── 界面判定 ──────────────────────────────────────────────────── */
    function modeSelector() {
        return document.querySelector('[class*="paint-editor_mode-selector_"]');
    }
    function paperCanvas() {
        return document.querySelector('canvas[class*="paper-canvas_"]');
    }
    function paintVisible() {
        var n = document.querySelector('[class*="paint-editor_editor-container_"]');
        if (!n) return false;
        try {
            return n.getClientRects().length > 0 &&
                   window.getComputedStyle(n).display !== 'none' &&
                   n.offsetWidth > 200;
        } catch (e) { return false; }
    }

    /* ── ① 工具右下角快捷键角标 ───────────────────────────────────────
       scratch-paint 的工具组件把 keybinding 拼进 title：
         Vo(formatMessage(descriptor), keybinding) → "画笔 (B)"
       所以直接从 title 提取最可靠，中英文界面都通用。
       原生没有 keybinding 的工具（三角形 / 箭头 / 形状…）按序分配
       未占用的字母，并且真的绑定 keydown → click。                  */
    var FALLBACK = ['G', 'D', 'H', 'J', 'K', 'M', 'N',
                    'P', 'Q', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    var KEY_RE = /\(([A-Za-z0-9])\)\s*$/;

    function markTools() {
        var sel = modeSelector();
        if (!sel) return;
        var items = sel.children, used = Object.create(null), i, m;
        for (i = 0; i < items.length; i++) {
            m = KEY_RE.exec(items[i].getAttribute && items[i].getAttribute('title') || '');
            if (m) used[m[1].toUpperCase()] = 1;
        }
        var fi = 0;
        for (i = 0; i < items.length; i++) {
            var b = items[i];
            if (!b || b.nodeType !== 1) continue;
            var title = (b.getAttribute && b.getAttribute('title')) || '';
            m = KEY_RE.exec(title);
            var key = m ? m[1].toUpperCase() : '';
            var native = !!m;
            if (!key) {
                while (fi < FALLBACK.length && used[FALLBACK[fi]]) fi++;
                key = FALLBACK[fi++] || '';
            }
            if (!key) continue;
            if (b.__blKeyBadge) {
                if (b.__blKeyBadge.textContent !== key) b.__blKeyBadge.textContent = key;
            } else {
                try {
                    b.style.position = 'relative';
                    var badge = document.createElement('i');
                    badge.className = 'bl-paint-key';
                    badge.textContent = key;
                    b.appendChild(badge);
                    b.__blKeyBadge = badge;
                } catch (e) { continue; }
            }
            b.__blKey = key;
            b.__blKeyNative = native;
        }
    }
    function keyOwner(k) {
        var sel = modeSelector();
        if (!sel) return null;
        var items = sel.children;
        for (var i = 0; i < items.length; i++) {
            if (items[i].__blKey === k) return items[i];
        }
        return null;
    }
    document.addEventListener('keydown', function (e) {
        if (!paintVisible() || e.ctrlKey || e.metaKey || e.altKey) return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
                  t.tagName === 'SELECT' || t.isContentEditable)) return;
        var k = String(e.key || '').toUpperCase();
        if (!/^[A-Z0-9]$/.test(k)) return;
        var b = keyOwner(k);
        /* 原生已有 keybinding 的键交给 scratch-paint 自己处理，
           这里只接管我们补出来的 fallback 键，避免双重触发。 */
        if (!b || b.__blKeyNative) return;
        e.preventDefault();
        e.stopPropagation();
        try { b.click(); } catch (err) { /* ignore */ }
    }, true);

    /* ── ② 画布缩放动画 ──────────────────────────────────────────────
       paper.js 的 view.zoom 是瞬时跳变的。这里在原生处理之前（捕获阶段）
       先把 canvas 设成「差一点点」的 scale，再在下一帧用 0.22s 过渡
       回到 1 —— 画面就平滑地放大/缩小到新的缩放级别，而不是硬跳。
       只动 CSS transform，不碰 paper 的矩阵；pointerdown 立刻归位，
       所以绘制时的鼠标坐标不会有一丝偏差。                          */
    var raf1 = 0, raf2 = 0;
    function reduceMotion() {
        try { return !!(window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
        catch (e) { return false; }
    }
    function pulse(dir) {
        if (reduceMotion()) return;
        var c = paperCanvas();
        if (!c) return;
        var from = dir > 0 ? 0.95 : (dir < 0 ? 1.05 : 1.0);
        try {
            c.style.transition = 'none';
            c.style.transform = 'scale(' + from + ')';
            void c.offsetWidth;                 /* 强制重排，让起始值生效 */
        } catch (e) { return; }
        try { if (raf1) cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); }
        catch (e2) { /* ignore */ }
        raf1 = requestAnimationFrame(function () {
            raf2 = requestAnimationFrame(function () {
                try {
                    c.style.transition = 'transform .22s cubic-bezier(.2,.8,.25,1)';
                    c.style.transform = 'scale(1)';
                } catch (e3) { /* ignore */ }
            });
        });
    }
    function resetTransform() {
        var c = paperCanvas();
        if (!c || !c.style || !c.style.transform) return;
        try {
            c.style.transition = 'none';
            c.style.transform = 'scale(1)';
        } catch (e) { /* ignore */ }
    }
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var z = t.closest('[class*="paint-editor_zoom-controls_"]');
        if (!z) return;
        var btn = t.closest('[role="button"], button, [class*="button-group-button"]') || t;
        var hint = (btn.getAttribute && (btn.getAttribute('title') || '') || '') + ' ';
        try {
            var img = btn.querySelector && btn.querySelector('img');
            if (img) hint += img.getAttribute('alt') || '';
        } catch (e2) { /* ignore */ }
        hint = hint.toLowerCase();
        var dir = 0;
        if (/zoom in|放大/.test(hint)) dir = 1;
        else if (/zoom out|缩小/.test(hint)) dir = -1;
        else if (/zoom reset|重置/.test(hint)) dir = 0;
        pulse(dir);
    }, true);
    var wheelAt = 0;
    document.addEventListener('wheel', function (e) {
        if (!paintVisible()) return;
        var t = e.target;
        if (!t || !t.closest ||
            !t.closest('[class*="paint-editor_canvas-container_"], [class*="paint-editor_editor-container_"]')) return;
        var now = Date.now();
        if (now - wheelAt < 90) return;        /* 滚轮连发节流 */
        wheelAt = now;
        pulse(e.deltaY < 0 ? 1 : -1);
    }, true);
    /* 用户一按下画笔就立刻取消视觉变换，坐标零误差 */
    document.addEventListener('pointerdown', function (e) {
        var t = e.target;
        if (t && t.closest &&
            t.closest('[class*="paint-editor_canvas-container_"]')) resetTransform();
    }, true);

    /* ── 重绘兜底：React 换掉工具节点后补挂角标 ────────────────────── */
    var mo = null, moHost = null;
    function watchHost() {
        if (!window.MutationObserver) return;
        var host = document.querySelector('[class*="paint-editor_editor-container_"]');
        if (!host || host === moHost || host === document.body ||
            host === document.documentElement) return;
        moHost = host;
        try { if (mo) mo.disconnect(); } catch (e) { /* ignore */ }
        try {
            mo = new MutationObserver(function () { markTools(); });
            mo.observe(host, { childList: true, subtree: true });
        } catch (e2) { mo = null; }
    }
    setInterval(function () {
        if (document.hidden) return;          /* 后台标签不空转 */
        watchHost();
        markTools();
    }, 600);
    window.addEventListener('resize', function () { markTools(); });
    setTimeout(markTools, 200);
    setTimeout(markTools, 900);
    markTools();
    watchHost();

    /* [B107] 同帧补挂：首帧扫描不再等各自的定时巡检 */
    if (window.__blSync) window.__blSync.register('B69-paint-plus', function () {
        try { markTools(); watchHost(); } catch (eB69) { /* ignore */ }
    }, true);
    })();
