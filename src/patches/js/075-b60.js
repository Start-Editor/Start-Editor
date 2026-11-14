/* ── [B60] 三键动画标记 ───────────────────────────────────────────────
   依赖：B47 / B42
   维护：最小化动画预设与设置数据自愈
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * 三键动画标记 + 设置数据自愈
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blRound7) return;
    window.__blRound7 = true;

    /* 点「最小化」时给窗口打标记，popOut 会改用「最小化动画」预设；
       点「关闭 / 最大化」清掉标记，避免上一次的类型串到下一次。
       捕获阶段执行，早于各窗口自己的点击处理，不阻断原生行为。 */
    document.addEventListener('click', function (e) {
        var t = e && e.target;
        if (!t || !t.closest) return;
        var btn = t.closest('.addon-window-btn-minimize, .addon-window-btn-close, .addon-window-btn-maximize');
        if (!btn) return;
        var win = btn.closest('.addon-window');
        if (!win) return;
        try {
            if (btn.classList.contains('addon-window-btn-minimize')) {
                win.setAttribute('data-bl-close-anim', 'minimize');
            } else {
                win.removeAttribute('data-bl-close-anim');
            }
        } catch (err) { /* ignore */ }
    }, true);

    /* 旧的 / 被别的脚本写坏的毛玻璃配置只有 enabled 一个字段时，
       毛玻璃设置组件一渲染就会因 undefined.toFixed 整页崩溃。
       启动时补齐一次，并监听后续写入。 */
    var FROST = 'bl:frosted-glass';
    function healFrost() {
        try {
            var raw = window.localStorage.getItem(FROST);
            if (!raw) return;
            var o = JSON.parse(raw);
            if (!o || typeof o !== 'object') return;
            var changed = false;
            if (typeof o.blurRadius !== 'number') { o.blurRadius = 12; changed = true; }
            if (typeof o.opacity !== 'number') { o.opacity = 0.25; changed = true; }
            if (typeof o.themeBoost !== 'number') { o.themeBoost = 0.15; changed = true; }
            if (changed) window.localStorage.setItem(FROST, JSON.stringify(o));
        } catch (e) { /* ignore */ }
    }
    healFrost();
    window.addEventListener('storage', function (e) {
        if (e && e.key === FROST) healFrost();
    });
    window.setInterval(healFrost, 1500);
})();
