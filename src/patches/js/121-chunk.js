
(function () {
    'use strict';
    if (window.__blSettingsHeal) return;
    window.__blSettingsHeal = true;

    var ITEM  = '[class*="modal-sidebar_item_"]';
    var GROUP = '[class*="modal-sidebar_group_"]';
    var BODY  = '[class*="settings-modal_body_"]';
    var seen  = new WeakMap();
    var raf   = 0;

    function now() { return Date.now(); }
    function qs(sel, root) { return (root || document).querySelector(sel); }
    function qsa(sel, root) {
        return [].slice.call((root || document).querySelectorAll(sel));
    }
    /* ① 退场类残留自愈。首次运行无条件清一次：脚本初始化时不可能有
       正在播放的折叠动画，页面上的 .bl-sidebar-out 全是历史残留。
       之后新出现的类留 420ms 把 190ms 动画播完再摘。 */
    function healOut(first) {
        var out = qsa('.bl-sidebar-out');
        for (var i = 0; i < out.length; i++) {
            var el = out[i];
            if (first) { el.classList.remove('bl-sidebar-out'); continue; }
            var t = seen.get(el);
            if (!t) { seen.set(el, now()); continue; }
            if (now() - t > 420) {
                el.classList.remove('bl-sidebar-out');
                seen.delete(el);
            }
        }
    }

    /* ② 三个互斥状态自愈：窗口一关就把 html 上的状态撤掉；
       窗口开着时把 body 上与选中态不符的类清掉，并同步模块内变量，
       避免 B56 / B93 下一轮 tick 又把它加回来。 */
    function healModes() {
        var html = document.documentElement;
        var body = qs(BODY);
        var star = qs('[data-bl-star-ai]');
        var ver  = qs('[data-bl-ver]');

        if (!body) {
            if (html.classList.contains('bl-sa-active')) {
                html.classList.remove('bl-sa-active');
                try {
                    if (window.__blStarAISettings && window.__blStarAISettings.close) {
                        window.__blStarAISettings.close();
                    }
                } catch (e) { /* ignore */ }
            }
            if (ver && ver.classList.contains('is-on')) {
                try { if (window.__blVerSetActive) window.__blVerSetActive(false); }
                catch (e2) { /* ignore */ }
            }
            return;
        }

        /* 版本页：body 类必须与「历史面板确实在显示」一致 */
        var hp = qs('.bl-ver-history.is-on', body);
        if (body.classList.contains('bl-ver-mode') && !hp) {
            body.classList.remove('bl-ver-mode');
            try { if (window.__blVerSetActive) window.__blVerSetActive(false); }
            catch (e3) { /* ignore */ }
        }
        /* STAR AI：body 类必须与 html 状态一致 */
        if (body.classList.contains('bl-starai-mode') &&
            !html.classList.contains('bl-sa-active')) {
            body.classList.remove('bl-starai-mode');
        }
        /* React 换掉侧栏节点后把选中态补回，避免卡片与原生内容同时显示。
           只在 body 也处于 starai-mode 时才补：光有 html 残留类而 body
           不在该模式，说明用户其实在别的分区，补 is-on 会重新激活
           「隐藏所有内容」规则。窗口关闭路径已在上面处理。 */
        if (html.classList.contains('bl-sa-active')) {
            if (star && body.classList.contains('bl-starai-mode') &&
                !star.classList.contains('is-on')) star.classList.add('is-on');
        } else if (star && star.classList.contains('is-on')) {
            star.classList.remove('is-on');
        }
    }

    /* ③ 「版本号 / STAR AI」是克隆注入项，React 重绘侧栏会把它们一起
       删掉，而 B56(400ms 节流) 与 B93(800ms 巡检) 的补挂有窗口期 ——
       这就是截图里「常规」分组只剩三项的原因。这里按分组展开与否
       主动触发原模块补挂，并保序（STAR AI 紧跟版本号）。 */
    function healNav() {
        var host = qs('[class*="modal-sidebar_items_"]') || document;
        var gs = qsa(GROUP, host), general = null;
        for (var i = 0; i < gs.length; i++) {
            var h = qs('[class*="modal-sidebar_groupHeader_"]', gs[i]);
            var t = h ? String(h.textContent || '').trim() : '';
            if (t === '常规' || t === 'General') { general = gs[i]; break; }
        }
        if (!general) return;
        /* 折叠状态下原生 items 由 React 卸载，此时不补挂，展开后自然会补。
           只认原生项：退场残留节点和注入项都不算「分组已展开」的证据。 */
        var native = qsa(ITEM, general).filter(function (n) {
            return !n.classList.contains('bl-sidebar-out') &&
                   n.getAttribute('data-bl-ver') === null &&
                   n.getAttribute('data-bl-star-ai') === null;
        });
        if (!native.length) return;

        var ver  = qs('[data-bl-ver]', general);
        var star = qs('[data-bl-star-ai]', general);
        if (!ver) {
            try { if (window.__blVerMount) window.__blVerMount(); } catch (e) {}
        }
        if (!star) {
            try {
                if (window.__blStarAISettings && window.__blStarAISettings.tick) {
                    window.__blStarAISettings.tick();
                }
            } catch (e2) {}
        }
        ver  = qs('[data-bl-ver]', general);
        star = qs('[data-bl-star-ai]', general);
        if (ver && star && ver.nextSibling !== star && ver.parentNode) {
            try { ver.parentNode.insertBefore(star, ver.nextSibling); } catch (e3) {}
        }
    }

    function tick(first) {
        try { healOut(first); } catch (e) {}
        try { healModes(); }    catch (e2) {}
        try { healNav(); }      catch (e3) {}
    }
    function schedule() {
        if (raf) return;
        var r = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
        raf = r.call(window, function () { raf = 0; tick(false); });
    }

    /* 分组展开 / 切分类后立刻修，不等巡检 */
    document.addEventListener('click', function (e) {
        var t = e && e.target;
        if (t && t.closest && (t.closest('[class*="modal-sidebar_groupHeaderButton"]') ||
                               t.closest(ITEM))) schedule();
    }, true);
    document.addEventListener('bl:star-ai-change', schedule);
    window.addEventListener('storage', schedule);
    /* 只观察设置侧栏这一小块，避开加载期全文档观察的性能开销 */
    try {
        if (window.MutationObserver) {
            var mo = new MutationObserver(schedule);
            var host = qs('[class*="modal-sidebar_content_"]');
            if (host) mo.observe(host, { childList: true, subtree: true,
                                         attributes: true, attributeFilter: ['class', 'aria-expanded'] });
            else mo.observe(document.documentElement, { childList: true, subtree: true });
        }
    } catch (e) { /* ignore */ }

    tick(true);                                    /* 清历史残留 */
    window.setInterval(function () { tick(false); }, 350);  /* 低频自愈 */
    window.__blSettingsHealTick = tick;
})();
