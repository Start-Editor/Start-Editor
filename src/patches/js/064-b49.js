/* ── [B49] macOS 拖动性能 ───────────────────────────────────────────────
   依赖：B1
   维护：减少窗口拖动 / 缩放时的合成层开销
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * macOS 性能优化 —— 减少窗口拖动/缩放时的合成层开销
 * 1. 拖动期间只改 transform（GPU 合成），结束后再落 left/top
 * 2. 非拖动状态不保留 will-change（避免长期占用合成层内存）
 * 3. 限制 MutationObserver 触发频率（合并重排）
 * 通过在 window 上挂一个轻量节流器，供窗口系统复用。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blPerf) return;
    window.__blPerf = {
        rafThrottle: function (fn, ctx) {
            var raf = null, last = null;
            return function () {
                var args = arguments;
                if (raf) return;
                raf = requestAnimationFrame(function () {
                    raf = null;
                    fn.apply(ctx, args);
                });
            };
        }
    };
})();
