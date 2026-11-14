
/* ── [B83] 除「代码」外全部工作区：不显示舞台 ────────────────────────────
   依赖：B77 的标签判定口径 / B52 的 active class
   维护：只要不是「代码」标签，就给 <html> 加 bl-no-stage，
         CSS 隐藏右侧 stage-and-target-wrapper（舞台 + 角色栏）并让
         editor-wrapper 吃满整行。造型界面会与 bl-paint-wide 叠加，
         后者继续负责画布内部的放宽规则，两者不冲突。

   为什么不用「只在造型界面加类」：声音、项目、评测、音乐、工程文件
   这几个工作区同样不需要舞台；逐个改各自模块会散成五份判定。
   这里一处统一判定，且 class 只写在 html 上，React 重绘冲不掉。
   ─────────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';
    if (window.__blNoStage) return;
    window.__blNoStage = true;

    var CLS = 'bl-no-stage';
    /* B52 互斥体系里四个自定义工作区的 active class；它们挂在 host 元素上，
       不是 html —— 所以既查 documentElement，也查全文档。 */
    var CUSTOM = ['bl-proj-active', 'bl-py-active', 'ms-active', 'bl-eval-active'];
    var pending = 0, lastWant = null;

    function hasCustom() {
        var h = document.documentElement, i;
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
    var RE_CODE = /^(代码|Code|Blocks|积木)/i;
    var RE_OTHER = /^(造型|背景|声音|Costumes|Backdrops|Sounds)/i;

    function isCode() {
        /* ① 任一自定义工作区开着 —— 一定不是代码 */
        if (hasCustom()) return false;
        /* ② 造型 / 声音编辑器可见（比原生 selected 态更可靠） */
        if (visible('[class*="paint-editor_editor-container_"]')) return false;
        if (visible('[class*="sound-editor_"]')) return false;
        /* ③ 原生标签文本 */
        var t = selectedText();
        if (!t) return true;                 /* 拿不到时保守：显示舞台，绝不误隐藏 */
        if (RE_CODE.test(t)) return true;
        if (RE_OTHER.test(t)) return false;
        return true;                         /* 未知标签同样保守 */
    }
    function apply() {
        var want = !isCode();
        /* 签名短路：静息时一次 DOM 操作都不做 */
        if (lastWant === want &&
            document.documentElement.classList.contains(CLS) === want) return;
        lastWant = want;
        document.documentElement.classList.toggle(CLS, want);
    }
    function schedule() {
        if (pending) return;
        pending = window.requestAnimationFrame(function () { pending = 0; apply(); });
    }

    /* 点击捕获：切标签的同一帧就预判，不等观察器，避免舞台闪一下。
       预判错了也没关系 —— 下面的观察器 / 轮询会按真实 DOM 校准。 */
    document.addEventListener('click', function (e) {
        var t = e.target;
        var li = t && t.closest && t.closest('li');
        if (!li) return;
        var cl = String(li.className || '');
        if (/bl-(py|proj|eval)-tab|ms-tab/.test(cl) && !/bl-dock-nav/.test(cl)) {
            document.documentElement.classList.add(CLS);
            lastWant = true;
            schedule();
            return;
        }
        var txt = String(li.textContent || '').trim();
        if (RE_CODE.test(txt)) {
            document.documentElement.classList.remove(CLS);
            lastWant = false;
        } else if (RE_OTHER.test(txt)) {
            document.documentElement.classList.add(CLS);
            lastWant = true;
        }
        schedule();
    }, true);

    /* 观察具体元素（不是全文档）：B01 性能总线会冻结 documentElement
       的 subtree 订阅，启动期 / 加载作品期尤其容易漏；对标签栏这个
       具体节点观察是透传的。另加低频轮询兜底。 */
    var watched = null, mo = null;
    function watch() {
        try {
            var ul = document.querySelector('ul[class*="gui_tab-list_"]');
            if (ul && ul !== watched) {
                if (mo) { try { mo.disconnect(); } catch (e) { /* ignore */ } }
                mo = new MutationObserver(schedule);
                mo.observe(ul, {
                    childList: true, subtree: true,
                    attributes: true, attributeFilter: ['class']
                });
                watched = ul;
            }
        } catch (e) { /* ignore */ }
    }
    try {
        var moHtml = new MutationObserver(schedule);
        moHtml.observe(document.documentElement, {
            attributes: true, attributeFilter: ['class']
        });
    } catch (e) { /* ignore */ }

    window.addEventListener('resize', schedule);
    document.addEventListener('DOMContentLoaded', function () { watch(); apply(); });
    window.setInterval(function () {
        try { watch(); apply(); } catch (e) { /* ignore */ }
    }, 900);
    try { watch(); apply(); } catch (e) { /* ignore */ }

    window.__blNoStageApply = apply;
})();

