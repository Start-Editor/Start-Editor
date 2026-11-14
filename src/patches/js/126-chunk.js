
(function () {
    'use strict';
    if (window.__blDock103) return;
    window.__blDock103 = true;

    var CLS = 'bl-dock-hidden';
    /* B52 互斥体系里自定义工作区的 active class（挂在 host 上，不是 html） */
    var CUSTOM = ['bl-proj-active', 'bl-py-active', 'ms-active', 'bl-eval-active'];
    var RE_CODE = /^(代码|Code|Blocks|积木)/i;
    var RE_OTHER = /^(造型|背景|声音|Costumes|Backdrops|Sounds|项目|音乐|工程文件|Project|Music|Files)/i;
    var last = null, pending = 0;

    function root() { return document.documentElement; }
    function hasCustom() {
        var h = root(), i;
        for (i = 0; i < CUSTOM.length; i++) {
            if (h.classList.contains(CUSTOM[i])) return true;
            try { if (document.querySelector('.' + CUSTOM[i])) return true; } catch (e) { /* ignore */ }
        }
        return false;
    }
    function visible(sel) {
        try {
            var ns = document.querySelectorAll(sel), i, n;
            for (i = 0; i < ns.length; i++) {
                n = ns[i];
                if (n.getClientRects && n.getClientRects().length &&
                    getComputedStyle(n).display !== 'none' && n.offsetWidth > 120) return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }
    function selectedText() {
        try {
            var li = document.querySelector('[class*="gui_tab-list_"] > li[class*="is-selected"]') ||
                     document.querySelector('[class*="gui_tab-list_"] > li[class*="selected"]');
            return li ? String(li.textContent || '').trim() : '';
        } catch (e) { return ''; }
    }
    /* 与 B83 同一套四条信号，且优先复用它已经算好的 bl-no-stage */
    function inCode() {
        var h = root();
        /* 首次教程是全屏导览，演示 DOCK 那条需要它可见 */
        if (h.classList.contains('bl-tour-on')) return true;
        if (h.classList.contains('bl-no-stage')) return false;
        if (hasCustom()) return false;
        if (visible('[class*="paint-editor_editor-container_"]')) return false;
        if (visible('[class*="sound-editor_"]')) return false;
        var t = selectedText();
        if (!t) return true;                 /* 拿不到标签时保守显示 */
        if (RE_CODE.test(t)) return true;
        if (RE_OTHER.test(t)) return false;
        return true;                         /* 未知标签同样保守 */
    }
    var syncPending = 0;
    function syncHost() {
        if (syncPending) return;
        syncPending = 1;
        var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
        raf.call(window, function () {
            /* 切回积木区时 React 可能刚把 blocks-wrapper 挂回来。
               派发一次 resize 让 B33 的宿主 rect 同步立刻执行，不等
               700ms 巡检，避免 DOCK 短暂漂到舞台下方。 */
            try {
                if (typeof Event === 'function') window.dispatchEvent(new Event('resize'));
            } catch (e) { /* ignore */ }
            window.setTimeout(function () {
                syncPending = 0;
                try {
                    if (typeof Event === 'function') window.dispatchEvent(new Event('resize'));
                } catch (e2) { /* ignore */ }
            }, 140);
        });
    }
    function setWant(want) {
        var h = root();
        var wasHidden = (last === true);
        /* 签名短路：静息时一次 DOM 写入都不做 */
        if (last === want && h.classList.contains(CLS) === want) return;
        last = want;
        h.classList.toggle(CLS, want);
        if (wasHidden && !want) syncHost();   /* 隐藏 → 显示：立刻校正宿主位置 */
    }
    function apply() { setWant(!inCode()); }
    function schedule() {
        if (pending) return;
        var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
        /* 双帧校准：第一帧等 React 把选中态写进 DOM，第二帧再按真实 DOM
           重算，避免预判被「还没更新的旧标签」立刻撤销。 */
        pending = raf.call(window, function () {
            pending = raf.call(window, function () { pending = 0; apply(); });
        });
    }

    /* 点击捕获阶段按标签文本预判，不等 React 重绘，切工作区不闪一下 */
    document.addEventListener('click', function (e) {
        var t = e.target, li = t && t.closest && t.closest('li');
        if (!li) return;
        var txt = String(li.textContent || '').trim();
        if (!txt) return;
        if (RE_CODE.test(txt)) setWant(false);
        else if (RE_OTHER.test(txt)) setWant(true);
        schedule();                          /* 下一帧按真实 DOM 校准 */
    }, true);

    /* 同帧补挂总线（结构 hook）+ 低频兜底 */
    if (window.__blSync) window.__blSync.register('B111-dock103', apply);
    window.setInterval(function () { if (!document.hidden) apply(); }, 900);
    apply();

    window.__blDock103Runtime = {
        apply: apply, inCode: inCode,
        state: function () { return last; }
    };
})();
