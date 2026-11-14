/* ── [B69] 第 14 轮运行时兜底 ───────────────────────────────────────────────
   依赖：B35 / B41
   维护：在线音乐弹窗删除后的状态清理
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * 第十四轮运行时兜底
 * 1) 清掉 winAppearance / bl:vinyl 里已删除功能的历史字段
 * 2) 万一 React 或插件把描边色控件、网易云侧栏插回来，立即隐藏
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blRound14) return;
    window.__blRound14 = true;

    function clean(key, fields) {
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return;
            var o = JSON.parse(raw), changed = false;
            for (var i = 0; i < fields.length; i++) {
                if (Object.prototype.hasOwnProperty.call(o, fields[i])) { delete o[fields[i]]; changed = true; }
            }
            if (changed) localStorage.setItem(key, JSON.stringify(o));
        } catch (e) { /* ignore */ }
    }
    clean('bl:win-appearance', ['colorMode', 'color', 'gradient', 'followTheme']);
    clean('bl:vinyl', ['neBase']);
    clean('bl:win-buttons', ['iconMin', 'iconMax', 'iconClose',
                            'scaleMin', 'scaleMax', 'scaleClose']);
    /* 注意：mw:style-window-style 不能清 —— 第十三轮起它由
       「按钮样式 MAC / WIN / MIST」驱动，清掉会让样式回到默认。 */

    function sweep() {
        /* 描边色：按标签文本找 setting 行 */
        var labels = document.querySelectorAll('[class*="settings-modal_contentArea_"] [class*="label"]');
        for (var i = 0; i < labels.length; i++) {
            var txt = (labels[i].textContent || '').trim();
            if (txt === '描边色' || txt === 'Stroke Color' || txt === '渐变色 1' ||
                txt === '渐变色 2' || txt === 'Gradient color 1' || txt === 'Gradient color 2') {
                var row = labels[i].closest('[class*="setting_"]');
                if (row) row.style.setProperty('display', 'none', 'important');
            }
        }
        /* 网易云侧栏 */
        var sides = document.querySelectorAll('.vy-side, [class*="vy-ne-"]');
        for (var j = 0; j < sides.length; j++) sides[j].style.setProperty('display', 'none', 'important');
    }
    var raf = 0;
    function schedule() {
        if (raf) return;
        raf = requestAnimationFrame(function () { raf = 0; sweep(); });
    }
    function boot() {
        if (!document.body) { setTimeout(boot, 300); return; }
        sweep();
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
