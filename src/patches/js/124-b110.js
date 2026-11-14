
/* ── [B110] 插件设置页：右侧分类导航栏 ──────────────────────────────────────
   插件设置页是 srcdoc / blob 内嵌的 iframe（B79 + webpack chunk 里的
   handleClickAddonSettings）。srcdoc 继承父文档 origin，父页面可直接读写
   contentDocument（毛玻璃注入器 Pe() 已经这么做了），所以这里不碰 bundle、
   不碰内嵌源码，只在 iframe load 的捕获阶段往它的文档里挂一条导航栏。

   导航两类目标：
     分组：最新 / 其他 / 危险（折叠的分组会先展开再滚过去）
     类型：推荐 / 新上架 / 外观 / 测试 / 危险 / 已启用
   点类型是「聚焦」：只高亮该类插件、淡化其余并跳到第一个，不改动任何
   插件开关、不重排 DOM、不干扰搜索；再点一次取消。

   观感走 iframe 自己的主题变量，纯色无渐变；玻璃开启时半透明+模糊。
   全程 load 捕获 + 局部 MutationObserver + 滚动 rAF，静息零写入。
   ─────────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';
    if (window.__blAddonNav) return;

    var CSS = [
        '.bl-anav{position:absolute;right:10px;top:88px;z-index:60;width:152px;',
        'max-height:calc(100% - 106px);overflow-y:auto;overflow-x:hidden;',
        'background:var(--ui-primary,#fff)!important;color:var(--text-primary,#575e75)!important;',
        'border:1px solid var(--ui-black-transparent,rgba(0,0,0,.14))!important;',
        'border-radius:10px;box-shadow:0 4px 14px var(--ui-black-transparent,rgba(0,0,0,.12));',
        'font:12px/1.45 "Helvetica Neue",Helvetica,Arial,"WenQuanYi Micro Hei",sans-serif;',
        'animation:blAnavIn .16s ease-out;}',
        '.bl-anav.is-fixed{position:fixed!important;}',
        '.bl-anav *{box-sizing:border-box;}',
        '@keyframes blAnavIn{from{opacity:0}to{opacity:1}}',
        '@media (prefers-reduced-motion:reduce){.bl-anav{animation:none}}',
        '.bl-anav-glass{background:var(--looks-transparent,rgba(255,255,255,.72))!important;',
        'backdrop-filter:blur(var(--bl-anav-blur,10px)) saturate(150%);',
        '-webkit-backdrop-filter:blur(var(--bl-anav-blur,10px)) saturate(150%);}',
        '.bl-anav-head{display:flex;align-items:center;gap:6px;padding:8px 9px;',
        'border-bottom:1px solid var(--ui-black-transparent,rgba(0,0,0,.12));}',
        '.bl-anav-head-t{flex:1 1 auto;min-width:0;font-weight:700;white-space:nowrap;',
        'overflow:hidden;text-overflow:ellipsis;}',
        '.bl-anav-fold{flex:0 0 auto;width:20px;height:20px;padding:0;border:none;',
        'border-radius:5px;background:var(--ui-black-transparent,rgba(0,0,0,.07));',
        'color:inherit;cursor:pointer;font-size:13px;line-height:1;}',
        '.bl-anav-fold:hover{background:var(--looks-secondary,#9966ff);color:#fff;}',
        '.bl-anav-label{padding:7px 9px 3px;font-size:11px;opacity:.62;}',
        '.bl-anav-item{display:flex;align-items:center;gap:6px;width:100%;padding:5px 9px;',
        'border:none;background:transparent;color:inherit;text-align:left;cursor:pointer;',
        'font:inherit;border-radius:0;}',
        '.bl-anav-item:hover{background:var(--ui-black-transparent,rgba(0,0,0,.07));}',
        '.bl-anav-item.is-current{background:var(--looks-transparent,rgba(153,102,255,.16));',
        'font-weight:700;}',
        '.bl-anav-item.is-on{background:var(--looks-secondary,#9966ff);color:#fff;}',
        '.bl-anav-item-t{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;',
        'text-overflow:ellipsis;}',
        '.bl-anav-n{flex:0 0 auto;min-width:18px;padding:0 4px;border-radius:5px;',
        'background:var(--ui-black-transparent,rgba(0,0,0,.09));text-align:center;',
        'font-size:10px;font-variant-numeric:tabular-nums;}',
        '.bl-anav-item.is-on .bl-anav-n{background:rgba(255,255,255,.28);}',
        '.bl-anav-sep{height:1px;margin:6px 9px;background:var(--ui-black-transparent,rgba(0,0,0,.12));}',
        '.bl-anav.is-collapsed{width:34px;}',
        '.bl-anav.is-collapsed .bl-anav-body,.bl-anav.is-collapsed .bl-anav-head-t{display:none;}',
        '.bl-anav.is-collapsed .bl-anav-head{border-bottom:none;justify-content:center;padding:7px 0;}',
        '.bl-anav.is-narrow{width:126px;}',
        '[class*="settings_addons_"].bl-anav-shift{padding-right:176px!important;}',
        '[class*="settings_addons_"].bl-anav-shift.bl-anav-shift-narrow{padding-right:146px!important;}',
        '[class*="settings_addon_"].bl-anav-dim{opacity:.32!important;}',
        '[class*="settings_addon_"].bl-anav-hit{outline:2px solid var(--looks-secondary,#9966ff)!important;',
        'outline-offset:2px;border-radius:6px;}'
    ].join('');

    var ZH = {
        title: '\u5feb\u901f\u5bfc\u822a', groups: '\u5206\u7ec4', types: '\u7c7b\u578b', all: '\u5168\u90e8\u63d2\u4ef6',
        gNew: '\u6700\u65b0', gOthers: '\u5176\u4ed6', gDanger: '\u5371\u9669',
        tRecommended: '\u63a8\u8350', tNew: '\u65b0\u4e0a\u67b6', tTheme: '\u5916\u89c2',
        tBeta: '\u6d4b\u8bd5', tDanger: '\u5371\u9669', tEnabled: '\u5df2\u542f\u7528',
        fold: '\u6536\u8d77', expand: '\u5c55\u5f00'
    };
    var EN = {
        title: 'Navigate', groups: 'Groups', types: 'Types', all: 'All addons',
        gNew: 'New', gOthers: 'Others', gDanger: 'Danger',
        tRecommended: 'Recommended', tNew: 'New', tTheme: 'Theme',
        tBeta: 'Beta', tDanger: 'Danger', tEnabled: 'Enabled',
        fold: 'Collapse', expand: 'Expand'
    };

    var GROUP = '[class*="addon-group_"]';
    var GNAME = '[class*="addon-group-name_"]';
    var GICON = '[class*="addon-group-expand-icon_"]';
    var CARD = '[class*="settings_addon_"]';
    var SCROLLER = '[class*="settings_addons_"]';
    var CONTAINER = '[class*="settings_container_"]';
    var SWITCH_ON = '[role="checkbox"][aria-checked="true"]';
    var GROUPS = ['new', 'others', 'danger'];
    var TAGS = ['recommended', 'new', 'theme', 'beta', 'danger', 'enabled'];
    var FROST = 'bl:frosted-glass';

    var states = [];
    var glassSig = '';
    var scanTimer = 0;

    function arr(node, sel) {
        if (!node || !node.querySelectorAll) return [];
        try { return Array.prototype.slice.call(node.querySelectorAll(sel)); }
        catch (e) { return []; }
    }
    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function tr(doc) {
        var l = '';
        try { l = (doc && doc.documentElement && doc.documentElement.lang) || ''; } catch (e) {}
        return /^zh/i.test(l) ? ZH : EN;
    }
    function txtOf(node) {
        try { return (node && node.textContent) || ''; } catch (e) { return ''; }
    }
    function groupKey(g, i) {
        var t = txtOf(g && g.querySelector ? g.querySelector(GNAME) : null);
        if (/\u6700\u65b0|\u5168\u65b0|New/i.test(t)) return 'new';
        if (/\u5371\u9669|Danger/i.test(t)) return 'danger';
        if (/\u5176\u4ed6|\u5176\u5b83|Others/i.test(t)) return 'others';
        return GROUPS[i] || 'others';
    }
    function tagSel(key) { return '[class*="tag-' + key + '_"]'; }
    function cardHit(card, key) {
        if (!key) return false;
        if (key === 'enabled') return !!(card.querySelector && card.querySelector(SWITCH_ON));
        return !!(card.querySelector && card.querySelector(tagSel(key)));
    }

    function cardCounts(doc, scroller) {
        var out = { groups: { 'new': 0, 'others': 0, 'danger': 0 }, tags: {}, all: 0 };
        var k, i;
        for (k = 0; k < TAGS.length; k++) out.tags[TAGS[k]] = 0;
        var groups = arr(scroller, GROUP);
        var cards = arr(scroller, CARD);
        out.all = cards.length;
        for (i = 0; i < groups.length; i++) {
            var key = groupKey(groups[i], i);
            if (out.groups[key] !== undefined) out.groups[key] = arr(groups[i], CARD).length;
        }
        for (i = 0; i < cards.length; i++) {
            for (k = 0; k < TAGS.length; k++) {
                if (cardHit(cards[i], TAGS[k])) out.tags[TAGS[k]]++;
            }
        }
        return out;
    }

    function destroy(st) {
        try { if (st.mo) st.mo.disconnect(); } catch (e) {}
        try { if (st.scroller && st.onScroll) st.scroller.removeEventListener('scroll', st.onScroll); } catch (e) {}
        try { if (st.win && st.onResize) st.win.removeEventListener('resize', st.onResize); } catch (e) {}
        try { if (st.panel && st.panel.parentNode) st.panel.parentNode.removeChild(st.panel); } catch (e) {}
        try { if (st.scroller) {
            st.scroller.classList.remove('bl-anav-shift');
            st.scroller.classList.remove('bl-anav-shift-narrow');
            var cs = arr(st.scroller, CARD);
            for (var i = 0; i < cs.length; i++) {
                cs[i].classList.remove('bl-anav-dim'); cs[i].classList.remove('bl-anav-hit');
            }
        } } catch (e) {}
        var idx = states.indexOf(st);
        if (idx >= 0) states.splice(idx, 1);
    }

    function glassInfo() {
        try {
            var raw = window.localStorage.getItem(FROST);
            if (!raw) return { on: false, blur: 10 };
            var o = JSON.parse(raw);
            if (!o || !o.enabled) return { on: false, blur: 10 };
            var b = typeof o.blurRadius === 'number' ? o.blurRadius : 12;
            return { on: true, blur: Math.max(2, Math.min(40, Math.round(b))) };
        } catch (e) { return { on: false, blur: 10 }; }
    }
    function applyGlass(st, g) {
        if (!st || !st.panel) return;
        st.panel.style.setProperty('--bl-anav-blur', g.blur + 'px');
        st.panel.classList[g.on ? 'add' : 'remove']('bl-anav-glass');
    }
    function syncGlass(force) {
        var g = glassInfo();
        var sig = (g.on ? '1' : '0') + ':' + g.blur;
        if (!force && sig === glassSig) return;
        glassSig = sig;
        for (var i = 0; i < states.length; i++) applyGlass(states[i], g);
    }

    function scrollToEl(st, el) {
        var sc = st.scroller;
        if (!sc || !el || !el.getBoundingClientRect || !sc.getBoundingClientRect) return;
        try {
            var top = sc.scrollTop + (el.getBoundingClientRect().top - sc.getBoundingClientRect().top) - 10;
            top = Math.max(0, top);
            if (sc.scrollTo) sc.scrollTo({ top: top, behavior: 'smooth' });
            else sc.scrollTop = top;
        } catch (e) { /* ignore */ }
    }
    function firstHit(st) {
        var cards = arr(st.scroller, CARD);
        for (var i = 0; i < cards.length; i++) if (cardHit(cards[i], st.focus)) return cards[i];
        return null;
    }
    function applyFocus(st) {
        var cards = arr(st.scroller, CARD), key = st.focus, i;
        for (i = 0; i < cards.length; i++) {
            var hit = key ? cardHit(cards[i], key) : false;
            if (cards[i].classList) {
                cards[i].classList[key ? 'toggle' : 'remove']('bl-anav-hit', !!hit);
                cards[i].classList[key ? 'toggle' : 'remove']('bl-anav-dim', !hit);
            }
        }
        var items = arr(st.panel, '.bl-anav-item[data-kind="tag"]');
        for (i = 0; i < items.length; i++) {
            items[i].classList.toggle('is-on', items[i].getAttribute('data-key') === key);
        }
    }
    function markCurrent(st) {
        var sc = st.scroller;
        if (!sc || !sc.getBoundingClientRect) return;
        var top = sc.getBoundingClientRect().top + 16;
        var gs = arr(sc, GROUP), cur = '', i;
        for (i = 0; i < gs.length; i++) {
            if (gs[i].getBoundingClientRect && gs[i].getBoundingClientRect().top <= top) cur = groupKey(gs[i], i);
        }
        var items = arr(st.panel, '.bl-anav-item[data-kind="group"]');
        for (i = 0; i < items.length; i++) {
            items[i].classList.toggle('is-current', items[i].getAttribute('data-key') === cur);
        }
    }
    function refresh(st) {
        if (!st || !st.panel || !st.scroller) return;
        /* React 重绘可能换掉容器或抹掉我们追加的节点/类名：只补缺失，
           位置正确时零写入 */
        try {
            var liveHost = st.d.querySelector(CONTAINER) || st.d.body;
            if (liveHost !== st.host) st.host = liveHost;
            if (!st.d.getElementById('bl-addon-nav-css')) {
                var s2 = st.d.createElement('style');
                s2.id = 'bl-addon-nav-css';
                s2.textContent = CSS;
                (st.d.head || st.d.body).appendChild(s2);
            }
            if (st.panel.parentNode !== st.host) st.host.appendChild(st.panel);
            if (!st.scroller.classList.contains('bl-anav-shift')) st.scroller.classList.add('bl-anav-shift');
            if (st.narrow && !st.scroller.classList.contains('bl-anav-shift-narrow')) {
                st.scroller.classList.add('bl-anav-shift-narrow');
            }
        } catch (e) { /* ignore */ }
        var c = cardCounts(st.d, st.scroller);
        var sig = JSON.stringify(c);
        if (sig !== st.countSig) {
            st.countSig = sig;
            st.counts = c;
            var items = arr(st.panel, '.bl-anav-item');
            for (var i = 0; i < items.length; i++) {
                var kind = items[i].getAttribute('data-kind');
                var key = items[i].getAttribute('data-key');
                var n = items[i].querySelector('.bl-anav-n');
                if (!n) continue;
                var v = kind === 'all' ? c.all
                    : kind === 'group' ? (c.groups[key] || 0)
                    : (c.tags[key] || 0);
                if (n.textContent !== String(v)) n.textContent = String(v);
            }
        }
        if (st.focus) applyFocus(st);
        markCurrent(st);
    }
    function adapt(st) {
        var narrow = false;
        try { narrow = (st.d.documentElement.clientWidth || 900) < 820; } catch (e) {}
        st.narrow = narrow;
        if (st.panel) st.panel.classList.toggle('is-narrow', narrow);
        if (st.scroller) st.scroller.classList.toggle('bl-anav-shift-narrow', narrow);
    }

    function onNavClick(st, ev) {
        var t = ev && ev.target;
        if (!t || !t.closest) return;
        if (t.closest('.bl-anav-fold')) {
            var collapsed = st.panel.classList.toggle('is-collapsed');
            var f = st.panel.querySelector('.bl-anav-fold');
            if (f) {
                f.textContent = collapsed ? '\u203a' : '\u2039';
                f.setAttribute('title', collapsed ? tr(st.d).expand : tr(st.d).fold);
                f.setAttribute('aria-label', collapsed ? tr(st.d).expand : tr(st.d).fold);
            }
            return;
        }
        var it = t.closest('.bl-anav-item');
        if (!it) return;
        var kind = it.getAttribute('data-kind');
        var key = it.getAttribute('data-key');
        if (kind === 'all') {
            st.focus = '';
            applyFocus(st);
            try { if (st.scroller.scrollTo) st.scroller.scrollTo({ top: 0, behavior: 'smooth' }); else st.scroller.scrollTop = 0; }
            catch (e) {}
            return;
        }
        if (kind === 'group') {
            st.focus = '';
            applyFocus(st);
            var gs = arr(st.scroller, GROUP), i, target = null, gkey = '';
            for (i = 0; i < gs.length; i++) {
                gkey = groupKey(gs[i], i);
                if (gkey === key) { target = gs[i]; break; }
            }
            if (!target) return;
            /* 折叠的分组先展开（标题按钮是原生 React 事件） */
            var icon = target.querySelector ? target.querySelector(GICON) : null;
            var name = target.querySelector ? target.querySelector(GNAME) : null;
            if (icon && icon.getAttribute && icon.getAttribute('data-open') !== 'true' && name && name.click) {
                try { name.click(); } catch (e) {}
                window.setTimeout(function () { scrollToEl(st, target); }, 70);
            } else {
                scrollToEl(st, target);
            }
            return;
        }
        if (kind === 'tag') {
            st.focus = (st.focus === key) ? '' : key;
            applyFocus(st);
            if (st.focus) {
                var first = firstHit(st);
                if (first) scrollToEl(st, first);
            }
        }
    }

    function build(st) {
        var d = st.d, T = tr(d);
        var style = d.getElementById('bl-addon-nav-css');
        if (!style) {
            style = d.createElement('style');
            style.id = 'bl-addon-nav-css';
            style.textContent = CSS;
            try { (d.head || d.body).appendChild(style); } catch (e) { return false; }
        }
        var host = d.querySelector(CONTAINER) || d.body;
        st.host = host;
        var p = d.createElement('div');
        p.className = 'bl-anav';
        p.setAttribute('data-bl-addon-nav', '1');
        if (host === d.body) p.className += ' is-fixed';
        var h = '';
        h += '<div class="bl-anav-head"><span class="bl-anav-head-t">' + esc(T.title) + '</span>' +
             '<button type="button" class="bl-anav-fold" title="' + esc(T.fold) +
             '" aria-label="' + esc(T.fold) + '">\u2039</button></div>';
        h += '<div class="bl-anav-body">';
        h += '<div class="bl-anav-label">' + esc(T.groups) + '</div>';
        var gk = ['new', 'others', 'danger'];
        var gl = [T.gNew, T.gOthers, T.gDanger];
        for (var i = 0; i < gk.length; i++) {
            h += '<button type="button" class="bl-anav-item" data-kind="group" data-key="' + gk[i] +
                 '"><span class="bl-anav-item-t">' + esc(gl[i]) + '</span><span class="bl-anav-n">0</span></button>';
        }
        h += '<div class="bl-anav-sep"></div>';
        h += '<div class="bl-anav-label">' + esc(T.types) + '</div>';
        var tk = TAGS.slice();
        var tl = [T.tRecommended, T.tNew, T.tTheme, T.tBeta, T.tDanger, T.tEnabled];
        for (i = 0; i < tk.length; i++) {
            h += '<button type="button" class="bl-anav-item" data-kind="tag" data-key="' + tk[i] +
                 '"><span class="bl-anav-item-t">' + esc(tl[i]) + '</span><span class="bl-anav-n">0</span></button>';
        }
        h += '<div class="bl-anav-sep"></div>';
        h += '<button type="button" class="bl-anav-item" data-kind="all" data-key="all">' +
             '<span class="bl-anav-item-t">' + esc(T.all) + '</span><span class="bl-anav-n">0</span></button>';
        h += '</div>';
        p.innerHTML = h;
        try { host.appendChild(p); } catch (e) { return false; }
        st.panel = p;
        st.focus = '';
        st.countSig = '';
        st.scroller.classList.add('bl-anav-shift');

        p.addEventListener('click', function (ev) { onNavClick(st, ev); });
        st.onScroll = function () {
            if (st.raf) return;
            st.raf = (st.win && st.win.requestAnimationFrame)
                ? st.win.requestAnimationFrame(function () { st.raf = 0; markCurrent(st); })
                : window.setTimeout(function () { st.raf = 0; markCurrent(st); }, 60);
        };
        st.scroller.addEventListener('scroll', st.onScroll, { passive: true });
        st.onResize = function () { adapt(st); markCurrent(st); };
        if (st.win) { try { st.win.addEventListener('resize', st.onResize); } catch (e) {} }

        /* React 搜索 / 切换开关会重渲染卡片：只观察 childList，不观察
           attributes —— 我们自己加的 hit/dim 类不会反过来触发它。 */
        if (window.MutationObserver) {
            try {
                st.mo = new window.MutationObserver(function () {
                    if (st.moTimer) clearTimeout(st.moTimer);
                    st.moTimer = window.setTimeout(function () { st.moTimer = 0; refresh(st); }, 180);
                });
                st.mo.observe(st.scroller, { childList: true, subtree: true });
            } catch (e) { st.mo = null; }
        }
        adapt(st);
        syncGlass(true);
        applyGlass(st, glassInfo());
        refresh(st);
        return true;
    }

    function isAddonDoc(d) {
        if (!d || !d.body || !d.getElementById) return false;
        var t = '';
        try { t = d.title || ''; } catch (e) { return false; }
        if (!/addon|\u63d2\u4ef6|\u9644\u52a0\u5143\u4ef6/i.test(t)) return false;
        return !!d.getElementById('app');
    }

    function mount(frame) {
        if (!frame || frame.__blAddonNavDone) return false;
        var d = null;
        try { d = frame.contentDocument; } catch (e) { return false; }
        if (!isAddonDoc(d)) return false;
        frame.__blAddonNavDone = true;
        var i;
        for (i = states.length - 1; i >= 0; i--) if (states[i].frame === frame) destroy(states[i]);
        var st = {
            frame: frame, d: d, win: null, scroller: null, panel: null,
            mo: null, moTimer: 0, raf: 0, focus: '', countSig: '', narrow: false
        };
        try { st.win = frame.contentWindow || d.defaultView; } catch (e) {}
        states.push(st);

        function ready() {
            var sc = d.querySelector(SCROLLER);
            if (!sc) return false;
            st.scroller = sc;
            return build(st);
        }
        if (ready()) return true;
        var tries = 0;
        var mo = null;
        var tick = function () {
            if (ready()) {
                if (mo) { try { mo.disconnect(); } catch (e) {} }
                return;
            }
            tries++;
            if (tries < 60) window.setTimeout(tick, 120);
        };
        if (window.MutationObserver) {
            try {
                mo = new window.MutationObserver(function () { if (ready()) mo.disconnect(); });
                mo.observe(d.body, { childList: true, subtree: true });
            } catch (e) { mo = null; }
        }
        window.setTimeout(tick, 100);
        return true;
    }

    function onLoad(e) {
        var f = e && e.target;
        if (!f || f.tagName !== 'IFRAME') return;
        /* srcdoc 重建后需要重新挂：清掉幂等标记 */
        try {
            var st = null;
            for (var i = 0; i < states.length; i++) if (states[i].frame === f) { st = states[i]; break; }
            if (st) {
                destroy(st);
                f.__blAddonNavDone = false;
            }
        } catch (e) {}
        mount(f);
    }

    function scan() {
        var fs = arr(document, 'iframe');
        var i;
        for (i = 0; i < fs.length; i++) {
            if (!fs[i].__blAddonNavDone) mount(fs[i]);
        }
        /* React 换语言 / 换主题会整体换掉 iframe 里的滚动容器，此时原有
           MO 与 scroll 监听都失效：低频巡检发现后重建一次，不反复重挂。 */
        for (i = states.length - 1; i >= 0; i--) {
            var s = states[i], live = null;
            if (!s.panel) continue;
            try { live = s.d.querySelector(SCROLLER); } catch (e) {}
            if (live && live !== s.scroller) {
                var f = s.frame;
                destroy(s);
                f.__blAddonNavDone = false;
                mount(f);
            }
        }
        syncGlass(false);
    }

    document.addEventListener('load', onLoad, true);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
    else scan();
    /* 低频兜底：窗口比本块先打开、或 srcdoc 重建漏掉 load 时能补上；
       已挂载的 iframe 直接跳过，静息零 DOM 操作。 */
    window.setInterval(function () {
        if (document.hidden) return;
        scan();
    }, 1500);
    try {
        window.addEventListener('storage', function (e) {
            if (e && e.key === FROST) syncGlass(true);
        });
    } catch (e) {}

    window.__blAddonNav = {
        attach: mount,
        scan: scan,
        status: function () {
            return states.map(function (s) {
                return {
                    mounted: !!s.panel, groups: s.counts ? s.counts.groups : null,
                    tags: s.counts ? s.counts.tags : null, all: s.counts ? s.counts.all : 0,
                    focus: s.focus, collapsed: !!(s.panel && s.panel.classList.contains('is-collapsed')),
                    narrow: s.narrow, glass: !!(s.panel && s.panel.classList.contains('bl-anav-glass'))
                };
            });
        },
        click: function (idx, kind, key) {
            var s = states[idx];
            if (!s) return false;
            onNavClick(s, { target: { closest: function (sel) {
                if (sel === '.bl-anav-fold') return null;
                if (sel === '.bl-anav-item') return { getAttribute: function (k) {
                    return k === 'data-kind' ? kind : k === 'data-key' ? key : null;
                } };
                return null;
            } } });
            return true;
        }
    };
})();
