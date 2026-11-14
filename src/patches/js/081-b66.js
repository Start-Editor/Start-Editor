/* ── [B66] 分隔条运行时兜底 ───────────────────────────────────────────────
   依赖：B65
   维护：双重保险，避免 React 重绘恢复拖动
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * 舞台 / 角色栏边缘拖动调整大小 —— 运行时兜底
 * 源码里已把 enableStageResize 关掉并移除分隔条节点；这里再封三层：
 *   存储值、捕获阶段事件、React/插件重插节点。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blNoStageResize) return;
    window.__blNoStageResize = true;

    var KEY = 'mw:enable-stage-resize';
    /* 1) 老版本残留的开启状态一律纠正；storage 被别处改回时也纠正回来 */
    try { if (localStorage.getItem(KEY) !== 'false') localStorage.setItem(KEY, 'false'); } catch (e) {}
    window.addEventListener('storage', function (e) {
        if (e.key === KEY && e.newValue !== 'false') {
            try { localStorage.setItem(KEY, 'false'); } catch (er) {}
        }
    });

    /* 2) 捕获阶段拦掉一切针对分隔条的按下 / 触摸 / 双击 */
    function hit(t) {
        if (!t || !t.closest) return false;
        return !!t.closest('[class*="gui_stage-pane-resizer"], [role="separator"][aria-orientation="vertical"]');
    }
    ['pointerdown', 'mousedown', 'touchstart', 'dblclick'].forEach(function (ev) {
        document.addEventListener(ev, function (e) {
            if (!hit(e.target)) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();
        }, true);
    });

    /* 3) hide-stage 等插件会把 r.style.display 改回 flex，
          React 重绘也可能重新挂节点；统一隐藏并摘掉键盘焦点 */
    function sweep() {
        var list = document.querySelectorAll('[class*="gui_stage-pane-resizer"]');
        for (var i = 0; i < list.length; i++) {
            var el = list[i];
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
            el.setAttribute('aria-hidden', 'true');
            if (el.hasAttribute('tabindex')) el.removeAttribute('tabindex');
        }
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
