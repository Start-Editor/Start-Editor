/* ── [B62] 三键快速反馈兜底 ───────────────────────────────────────────────
   依赖：B61
   维护：220ms 后自动摘掉 bl-fast-btn
   ───────────────────────────────────────────────────────────── */

(function () {
    'use strict';
    if (window.__blRound8Btn) return;
    window.__blRound8Btn = true;
    document.addEventListener('click', function (e) {
        /* 只在捕获阶段打标记，不接管点击本身：
           窗口自己的关闭 / 最小化逻辑照常执行。 */
        var t = e && e.target;
        if (!t || !t.closest) return;
        var btn = t.closest('.addon-window-btn-close, .addon-window-btn-minimize');
        if (!btn) return;
        var win = btn.closest('.addon-window');
        if (!win) return;
        try {
            win.classList.add('bl-fast-btn');
            /* 由调用方负责在动画结束时摘掉类；这里只做兜底，避免窗口
               复用（最小化后恢复）时一直带着这个类。 */
            window.setTimeout(function () {
                try { win.classList.remove('bl-fast-btn'); } catch (err) { /* ignore */ }
            }, 220);
        } catch (err2) { /* ignore */ }
    }, true);
})();
