/* ── [B50] 加载性能标记 ───────────────────────────────────────────────
   依赖：B1
   维护：打点供工具箱「性能」面板读取
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * __blPerfMarks —— 加载性能标记（第11条）
 * 记录 DOM 解析 / 资源表就绪 / 加载动画隐藏 等关键耗时，挂到 window.__blPerfMarks。
 * 同时给加载动画加 GPU 合成层，减少主线程重排。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blPerfMarks) return;
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var marks = { start: 0 };
    function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
    function mark(name) { marks[name] = Math.round(now() - t0); }
    window.__blPerfMarks = marks;
    window.__blPerfMark = mark;

    try {
        var st = document.createElement('style');
        st.textContent = '.bl-loading,.bl-loading-bg,.bl-loading-core,.bl-loading-bar,.bl-loading-logo{transform:translateZ(0);backface-visibility:hidden;}' +
            '.bl-loading-bg span{will-change:transform;}.bl-loading-bar i{will-change:transform,opacity;}';
        document.head.appendChild(st);
    } catch (e) { /* ignore */ }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mark('domContentLoaded'); });
    else mark('domContentLoaded');

    if (window.__RES__) mark('resReady');

    function hideCheck() {
        var el = document.getElementById('blLoading');
        if (!el || !el.parentNode) { mark('loadingHidden'); return true; }
        return false;
    }
    if (!hideCheck()) {
        window.addEventListener('bl:ui-ready', hideCheck, { once: true });
        /* 兜底保留，但走统一调度（>=500ms），不再用 200ms 空转 */
        var poll = setInterval(function () {
            if (hideCheck()) clearInterval(poll);
        }, 600);
    }
})();
