
(function () {
    'use strict';
    if (window.__blV116) return;
    window.__blV116 = { ready: true };

    var EVAL_RE = /^(项目评测|评测|Evaluate|Project evaluation)$/i;
    var snap = null, snapMo = null, pending = 0, writes = 0;

    function label(el) {
        try {
            return String(el.getAttribute('aria-label') || el.getAttribute('title') ||
                          el.textContent || '').trim();
        } catch (e) { return ''; }
    }
    function scrubEval() {
        var w = 0;
        var list = document.querySelectorAll(
            'li.bl-eval-tab, .bl-eval-panel, [class*="gui_tab-list_"] > li, .bl-dock-nav');
        for (var i = 0; i < list.length; i++) {
            var el = list[i], hit = false;
            try {
                hit = el.classList.contains('bl-eval-tab') ||
                      el.classList.contains('bl-eval-panel') ||
                      EVAL_RE.test(label(el));
            } catch (e) { hit = false; }
            if (hit && !el.hasAttribute('data-bl-noeval')) {
                el.setAttribute('data-bl-noeval', '1'); w++;
            } else if (!hit && el.hasAttribute('data-bl-noeval')) {
                el.removeAttribute('data-bl-noeval'); w++;
            }
        }
        /* 旧版「评测」工作区的 active 类残留会让原生 tab-panel 被
           visibility:hidden 整页空白，这里无条件清掉。 */
        try {
            var h = document.documentElement;
            if (h.classList.contains('bl-eval-active')) {
                h.classList.remove('bl-eval-active'); w++;
            }
        } catch (e2) {}
        writes += w;
        return w;
    }

    function syncSnap() {
        var on = !!(snap && snap.classList && snap.classList.contains('is-open'));
        try { document.documentElement.classList.toggle('bl-snap-top', on); } catch (e) {}
    }
    function bindSnap() {
        var p = null;
        try { p = document.querySelector('.bl-snap'); } catch (e) {}
        if (p === snap && snapMo) return;
        if (snapMo) { try { snapMo.disconnect(); } catch (e2) {} snapMo = null; }
        snap = p;
        if (!p) { syncSnap(); return; }
        if (window.MutationObserver) {
            snapMo = new MutationObserver(syncSnap);
            try { snapMo.observe(p, { attributes: true, attributeFilter: ['class'] }); }
            catch (e3) { snapMo = null; }
            /* 面板可能被 React 换掉；宿主 childList 用低频巡检补绑，不进全局总线 */
        }
        syncSnap();
    }

    function tick() {
        try { scrubEval(); } catch (e) {}
        try { bindSnap(); } catch (e2) {}
        /* 旧版单窗口（B100 v1）节点：新页面不会再生成，仅防未刷新时残留 */
        try {
            var old = document.getElementById('bl-stage-pop-win');
            if (old && old.parentNode && !document.getElementById('bl-dw-stage')) {
                var w = old.querySelector('[class*="gui_stage-and-target-wrapper_"]');
                if (w) {
                    var flex = document.querySelector('[class*="gui_flex-wrapper_"]');
                    if (flex) flex.appendChild(w);
                }
                old.parentNode.removeChild(old);
            }
        } catch (e3) {}
    }
    function schedule() {
        if (pending) return;
        pending = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })
            .call(window, function () { pending = 0; tick(); });
    }

    if (document.body) tick();
    else document.addEventListener('DOMContentLoaded', tick);
    document.addEventListener('bl:ui-ready', tick);
    if (window.MutationObserver && document.body) {
        /* 只看 body 直属子节点的增删：观察整棵子树会在拖拽积木时每帧
           触发一次全量扫描，重演之前那次卡顿。内部变化交给 1.2s 巡检
           与 B107 同帧总线兜底。 */
        try {
            var mo = new MutationObserver(schedule);
            mo.observe(document.body, { childList: true });
        } catch (e) {}
    }
    if (window.__blSync) {
        try { window.__blSync.register('B116-cleanup', tick, true); } catch (e) {}
    }
    window.setInterval(function () {
        if (document.hidden) return;
        tick();
    }, 1200);

    window.__blV116 = Object.assign(window.__blV116 || {}, {
        scrub: scrubEval, tick: tick,
        status: function () {
            return { writes: writes,
                     evalHidden: document.querySelectorAll('[data-bl-noeval="1"]').length,
                     snapTop: document.documentElement.classList.contains('bl-snap-top'),
                     snapFound: !!snap };
        }
    });
})();
