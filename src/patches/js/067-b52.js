/* ── [B52] 自定义标签修复补丁 ───────────────────────────────────────────────
   依赖：原生 tab-list
   维护：项目 / JSON / 音乐 / 评测的互斥、收起、重绘补挂
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * 左侧自定义标签修复补丁（项目 / JSON / 音乐 通用）
 *  - 面板严格对齐「工作区」矩形，不越界盖住左侧标签栏
 *  - 点原生标签 / 切换到别的自定义标签时，收起不该显示的面板
 *  - React 重渲染把手动插入的标签移除时，自动补挂回来
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blTabFix) return;
    window.__blTabFix = true;

    var ACTIVE = ['bl-proj-active', 'bl-py-active', 'ms-active', 'bl-eval-active'];
    /* DOCK 收起时挂到左侧的三个入口（.bl-dock-nav）也是 bl-py-tab，
       但它们由 DOCK 模块自己增删；这里一旦把它们记住并补挂，
       DOCK 重新显示后左侧按钮就永远不消失。必须排除。 */
    var TABSEL = 'li.bl-proj-tab, li.bl-py-tab:not(.bl-dock-nav), li.ms-tab, li.bl-eval-tab';
    var PANELSEL = '.bl-proj-panel';
    var ul = null, host = null;
    var rememberedTabs = [], rememberedPanels = [];
    var raf = 0;

    function find() {
        var u = document.querySelector('ul[class*="gui_tab-list_"]');
        if (!u) return false;
        var h = u.parentElement;
        if (h && !h.querySelector('[class*="gui_tab-panel_"]') && h.parentElement &&
            h.parentElement.querySelector('[class*="gui_tab-panel_"]')) h = h.parentElement;
        ul = u; host = h;
        return !!(ul && host);
    }

    function activeFor(tab) {
        if (tab.classList.contains('bl-eval-tab')) return 'bl-eval-active';
        if (tab.classList.contains('bl-proj-tab')) return 'bl-proj-active';
        if (tab.classList.contains('ms-tab')) return 'ms-active';
        if (tab.classList.contains('bl-py-tab') && !tab.classList.contains('bl-dock-nav')) return 'bl-py-active';
        return null;                       /* DOCK 导航：不当面板处理 */
    }
    function isMine(tab, cls) {
        if (!cls) return false;
        if (cls === 'bl-eval-active') return tab.classList.contains('bl-eval-tab');
        if (cls === 'bl-proj-active') return tab.classList.contains('bl-proj-tab');
        if (cls === 'ms-active') return tab.classList.contains('ms-tab');
        if (cls === 'bl-py-active') return tab.classList.contains('bl-py-tab') &&
            !tab.classList.contains('bl-dock-nav') &&
            !tab.classList.contains('bl-proj-tab');
        return false;
    }

    /* keep = 本次要打开的面板对应的 active class；null 表示全部收起 */
    function closeAll(keep) {
        if (host) {
            for (var i = 0; i < ACTIVE.length; i++) {
                /* 统一在正确的 host 上加 / 摘，保证任意时刻最多一个 active */
                if (keep === ACTIVE[i]) host.classList.add(ACTIVE[i]);
                else host.classList.remove(ACTIVE[i]);
            }
        }
        var tabs = document.querySelectorAll(TABSEL);
        for (var j = 0; j < tabs.length; j++) {
            if (keep && isMine(tabs[j], keep)) continue;
            tabs[j].classList.remove('is-on');
        }
        var panels = document.querySelectorAll(PANELSEL);
        for (var k = 0; k < panels.length; k++) {
            var p = panels[k];
            if (keep === 'bl-proj-active' && p.classList.contains('bl-proj-panel')) continue;
            p.style.display = 'none';
        }
        /* 音乐面板改过的舞台宽度 / html 上的类，一并还原 */
        if (keep !== 'ms-active') {
            try { document.documentElement.classList.remove('ms-music-on'); } catch (e) {}
            if (host) { try { host.style.minWidth = ''; host.style.maxWidth = ''; } catch (e2) {} }
        }
        /* 评测面板是 position:fixed 挂在 body 下，不随 host class 隐藏，
           切到任何别的工作区都要显式收起，否则会叠在别人上面。 */
        if (keep !== 'bl-eval-active') {
            try { if (window.__blEval) window.__blEval.close(); } catch (e3) {}
            var ep = document.querySelector('.bl-eval-panel');
            if (ep) ep.classList.remove('is-open');
        }
    }

    /* 面板左边缘 = 标签栏宽度；标签栏本身抬到面板之上 */
    var lastTabW = 0;
    function layout() {
        if (!find()) return;
        try {
            ul.style.position = 'relative';
            ul.style.zIndex = '10';
            var w = Math.round(ul.getBoundingClientRect().width) || 66;
            if (w === lastTabW) return;         /* 宽度没变就不写，避免强制重排 */
            lastTabW = w;
            host.style.setProperty('--bl-tabbar-w', w + 'px');
            document.documentElement.style.setProperty('--bl-tabbar-w', w + 'px');
            var panels = document.querySelectorAll(PANELSEL);
            for (var i = 0; i < panels.length; i++) panels[i].style.left = w + 'px';
        } catch (e) { /* ignore */ }
    }

    /* React 重渲染后，手动插入的标签 / 面板若被移除则补回去 */
    function ensure() {
        if (!find()) return;
        var tabs = document.querySelectorAll(TABSEL);
        for (var i = 0; i < tabs.length; i++) {
            if (rememberedTabs.indexOf(tabs[i]) < 0) rememberedTabs.push(tabs[i]);
        }
        var panels = document.querySelectorAll(PANELSEL);
        for (var j = 0; j < panels.length; j++) {
            if (rememberedPanels.indexOf(panels[j]) < 0) rememberedPanels.push(panels[j]);
        }
        for (var a = 0; a < rememberedTabs.length; a++) {
            var t = rememberedTabs[a];
            if (t.classList && t.classList.contains('bl-dock-nav')) continue;
            if (t.parentNode !== ul) ul.appendChild(t);
        }
        for (var b = 0; b < rememberedPanels.length; b++) {
            if (rememberedPanels[b].parentNode !== host) host.appendChild(rememberedPanels[b]);
        }
        layout();
    }

    /* 捕获阶段：先收起旧的面板，再让各模块自己的 click 处理打开/关闭 */
    function onClick(e) {
        var t = e.target && e.target.closest ? e.target.closest('li') : null;
        if (t && t.matches && t.matches(TABSEL)) {
            closeAll(activeFor(t));
        } else {
            closeAll(null);                /* 点 Code / Backdrops / Sounds 等原生标签 */
        }
    }

    function boot() {
        if (booted) { ensure(); return true; }
        if (!find()) return false;
        booted = true;
        ul.addEventListener('click', onClick, true);
        ensure();
        if (window.MutationObserver) {
            new MutationObserver(function () {
                if (raf) return;
                raf = requestAnimationFrame(function () { raf = 0; ensure(); });
            }).observe(document.body, { childList: true, subtree: true });
        }
        window.addEventListener('resize', layout);
        if (window.ResizeObserver) {
            try { new ResizeObserver(layout).observe(ul); } catch (e) {}
        }
        /* 宽度变化已由 ResizeObserver 覆盖，这里只做低频补挂兜底 */
        setInterval(ensure, 2500);
        return true;
    }

    var booted = false;
    var tries = 0;
    var timer = setInterval(function () {
        tries++;
        if (boot() || tries > 120) clearInterval(timer);
    }, 250);
    if (window.__blSync) window.__blSync.register('B52-tabfix', boot);
})();
