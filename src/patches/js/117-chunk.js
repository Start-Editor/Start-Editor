
(function () {
    'use strict';
    if (window.__blUniWindow) return;
    window.__blUniWindow = true;

    var ZH = function () {
        try { return /^zh/i.test(document.documentElement.lang || ''); }
        catch (e) { return true; }
    };
    function T(zh, en) { return ZH() ? zh : en; }

    /* ---------------- 1. 菜单：退出液态位移滤镜 ---------------- */
    var MENU_SEL = '[class*="menu_menu_"], [class*="context-menu_menu"], ' +
                   '.blocklyContextMenu, .goog-menu, .sa-context-menu, .sa-folder-context-menu';
    function cleanMenus() {
        var list;
        try { list = document.querySelectorAll(MENU_SEL); } catch (e) { return; }
        for (var i = 0; i < list.length; i++) {
            var n = list[i];
            if (n.getAttribute('data-bl-lg-skip')) continue;
            n.setAttribute('data-bl-lg-skip', '1');
            n.setAttribute('data-bl-fc-skip', '1');
            /* 清历史残留：url(#bl-lg-*) 位移滤镜会让整块玻璃图层偏移 */
            try {
                var bf = n.style.getPropertyValue('backdrop-filter') ||
                         n.style.getPropertyValue('-webkit-backdrop-filter');
                if (/url\(#bl-lg-/.test(String(bf || ''))) {
                    n.style.removeProperty('backdrop-filter');
                    n.style.removeProperty('-webkit-backdrop-filter');
                }
            } catch (e2) { /* ignore */ }
            n.removeAttribute('data-bl-lg');
            n.removeAttribute('data-bl-lg-native');
            /* soften 写的是 inline !important，把原色写回再删标记 */
            var soft = n.getAttribute('data-bl-lg-soft');
            if (soft) {
                try {
                    if (soft && soft !== 'rgba(0, 0, 0, 0)') {
                        n.style.setProperty('background-color', soft, 'important');
                    } else {
                        n.style.removeProperty('background-color');
                    }
                } catch (e3) { /* ignore */ }
                n.removeAttribute('data-bl-lg-soft');
            }
        }
    }

    /* ---------------- 2. 原版可拖动窗口适配器 ---------------- */
    var MIN_SVG = '<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    var CLOSE_SVG = '<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/>' +
                    '<line x1="18" y1="6" x2="6" y2="18"/></svg>';

    /* 每条规则：选择器、标题、显示判定、关闭动作、是否写初始位置 */
    var RULES = [
        {
            sel: '.bl-sv-dlg',
            title: function () { return T('保存到电脑', 'Save to computer'); },
            shown: function (n) { return !!n.closest('.bl-sv-mask'); },
            pos: true, w: 520,
            close: function (n) {
                var m = n.closest('.bl-sv-mask');
                if (m && m.parentNode) m.parentNode.removeChild(m);
                else if (n.parentNode) n.parentNode.removeChild(n);
            }
        },
        {
            sel: '.bl-snap',
            title: function () { return T('贴靠位置', 'Snap layout'); },
            shown: function (n) { return n.classList.contains('is-open'); },
            pos: true, w: 300,
            close: function (n) {
                n.classList.remove('is-open');
                var zs = n.querySelectorAll('.bl-snap-zone.is-active');
                for (var i = 0; i < zs.length; i++) zs[i].classList.remove('is-active');
                try {
                    var pv = document.querySelector('.bl-snap-preview.is-open');
                    if (pv) pv.classList.remove('is-open');
                } catch (e) { /* ignore */ }
            }
        },
        {
            sel: '.bl-search-box',
            title: function () { return T('搜索', 'Search'); },
            shown: function (n) { return n.classList.contains('is-open'); },
            pos: false,
            close: function (n) { n.classList.remove('is-open'); }
        },
        {
            sel: '.tw-panel',
            title: function () { return T('主题', 'Themes'); },
            shown: function (n) { return n.classList.contains('is-open'); },
            pos: false,
            close: function (n) {
                n.classList.remove('is-open');
                n.classList.remove('is-closing');
            }
        },
        {
            sel: '.blp-confirm .blp-ask-card',
            title: function () { return T('确认', 'Confirm'); },
            shown: function (n) { return !!n.closest('.blp-confirm'); },
            pos: true, w: 340,
            close: function (n) {
                var b = n.querySelector('[data-a="cancel"], .blp-ask-row .blp-btn');
                if (b && b.click) { b.click(); return; }
                var m = n.closest('.blp-confirm');
                if (m) m.style.display = 'none';
            }
        }
    ];

    /* ---------------- 2b. 固定浮层：原样保留，绝不窗口化 ----------------
       这些浮层由各自模块定位（主题面板跟随「主题」按钮、搜索框/贴靠面板
       在顶层宿主、保存与确认框是居中模态卡片），本来就没有顶部栏，也不该
       被统一置顶 / DOCK 最小化接管。早期版本一刀切补 addon-window 壳，
       会把主题面板钉死、淡入动画和原生定位全部压掉。这里按出身分流：
       固定浮层只还原、不注入；原生 .addon-window 窗口完全不在此列。 */
    var FIXED_SEL = '.tw-panel, .bl-search-box, .bl-snap, .bl-sv-dlg, .blp-confirm .blp-ask-card';
    var TOP_LAYER_FIXED = { '.tw-panel': 1, '.bl-search-box': 1, '.bl-snap': 1 };
    function isFixedFloat(node) {
        if (!node || !node.matches) return false;
        try { return node.matches(FIXED_SEL); } catch (e) { return false; }
    }
    function restoreFixed(node, rule) {
        if (!node) return;
        var touched = false, i;
        if (node.getAttribute('data-bl-uni')) {
            var head = null, content = null;
            for (i = 0; i < node.children.length; i++) {
                var c = node.children[i];
                if (c.classList && c.classList.contains('bl-uni-head')) head = c;
                if (c.classList && c.classList.contains('bl-uni-content')) content = c;
            }
            /* 把原有内容整体搬回根节点，节点引用保持不变 */
            if (content) {
                while (content.firstChild) node.appendChild(content.firstChild);
                if (content.parentNode) content.parentNode.removeChild(content);
            }
            if (head && head.parentNode) head.parentNode.removeChild(head);
            var kill = ['addon-window', 'bl-uni-win', 'bl-uni-shown'];
            for (i = 0; i < kill.length; i++) {
                try { node.classList.remove(kill[i]); } catch (e0) {}
            }
            node.removeAttribute('data-bl-uni');
            node.removeAttribute('data-bl-uni-shown');
            if (node.__blUniRule) { try { delete node.__blUniRule; } catch (e1) {} }
            /* pos:true 的规则写过 left/top/width；pos:false 的没写，
               原生 positionPanel() 写的 left/top 必须保留。 */
            if (rule && rule.pos) {
                try {
                    node.style.removeProperty('left');
                    node.style.removeProperty('top');
                    node.style.removeProperty('width');
                } catch (e2) {}
            }
            touched = true;
        }
        /* 早期版本把顶层宿主里的浮层搬到了 body，搬回去恢复原生层级 */
        if (rule && TOP_LAYER_FIXED[rule.sel] && node.parentNode === document.body) {
            var host = document.getElementById('bl-top-layer') ||
                       document.querySelector('.bl-top-layer');
            if (host) {
                try { host.appendChild(node); touched = true; } catch (e3) {}
            }
        }
        if (touched) node.setAttribute('data-bl-fixed-float', '1');
    }

    function makeHeader(rule, node) {
        var head = document.createElement('div');
        head.className = 'addon-window-header bl-uni-head';
        var t = document.createElement('span');
        t.className = 'addon-window-title bl-uni-title';
        t.textContent = rule.title();
        var ctr = document.createElement('div');
        ctr.className = 'addon-window-controls bl-uni-controls';
        var min = document.createElement('button');
        min.type = 'button';
        min.className = 'addon-window-btn addon-window-btn-minimize bl-uni-btn bl-uni-min';
        min.setAttribute('title', T('最小化', 'Minimize'));
        min.setAttribute('aria-label', T('最小化', 'Minimize'));
        min.innerHTML = MIN_SVG;
        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'addon-window-btn addon-window-btn-close bl-uni-btn bl-uni-close';
        close.setAttribute('title', T('关闭', 'Close'));
        close.setAttribute('aria-label', T('关闭', 'Close'));
        close.innerHTML = CLOSE_SVG;
        close.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            try { rule.close(node); } catch (err) { /* ignore */ }
        }, true);
        ctr.appendChild(min);
        ctr.appendChild(close);
        head.appendChild(t);
        head.appendChild(ctr);
        return head;
    }

    function upgrade(node, rule) {
        if (!node || node.getAttribute('data-bl-uni')) return;
        /* 双保险：外部直接调 upgrade() 也不碰固定浮层 */
        if (isFixedFloat(node)) { restoreFixed(node, rule); return; }
        var rect = { left: 0, top: 0, width: 0, height: 0 };
        try {
            var r = node.getBoundingClientRect();
            rect = { left: r.left, top: r.top, width: r.width, height: r.height };
        } catch (e) { /* ignore */ }
        var W = window.innerWidth || 1280, H = window.innerHeight || 800;

        /* 先把原有内容整体挪进 content，节点引用保持不变 */
        var content = document.createElement('div');
        content.className = 'addon-window-content bl-uni-content';
        while (node.firstChild) content.appendChild(node.firstChild);
        node.appendChild(makeHeader(rule, node));
        node.appendChild(content);

        node.setAttribute('data-bl-uni', '1');
        /* 不打 data-bl-lg-skip：窗口要继续跟随毛玻璃 / 液态玻璃效果，
           现在它有标准 header + content 结构，玻璃表能正确识别载体。 */
        node.classList.add('addon-window');
        node.classList.add('bl-uni-win');

        /* 顶层宿主里的浮层移到 body 直属，才能接上统一置顶与 DOCK 最小化 */
        try {
            if (node.closest('#bl-top-layer') && node.parentNode !== document.body) {
                document.body.appendChild(node);
            }
            /* 贴靠预览框原本也在宿主内（宿主 999998 自成层叠上下文），
               不一起搬出来就会盖在已升级为 8001 体系的窗口上面。 */
            if (rule.sel === '.bl-snap') {
                var pv = document.querySelector('.bl-snap-preview');
                if (pv && pv.parentNode !== document.body) document.body.appendChild(pv);
            }
        } catch (e2) { /* ignore */ }

        if (rule.pos) {
            var w = rule.w || Math.max(240, Math.round(rect.width || 320));
            var left = (rect.width > 40) ? Math.round(rect.left)
                                         : Math.max(12, Math.round((W - w) / 2));
            var top = (rect.height > 40) ? Math.round(rect.top)
                                         : Math.max(12, Math.round((H - 280) / 2));
            if (rule.sel === '.bl-snap') {
                left = Math.max(12, W - w - 16);
                top = 16;
            }
            node.style.left = left + 'px';
            node.style.top = top + 'px';
            node.style.width = w + 'px';
            node.style.removeProperty('right');
            node.style.removeProperty('bottom');
        } else {
            /* 搜索框 / 主题轮盘由各自的 positionPanel() 写 left/top，
               这里只把 right 清掉，避免和拖动写入的坐标打架。 */
            node.style.removeProperty('right');
            node.style.removeProperty('bottom');
        }
        node.__blUniRule = rule;
        syncShown(node, rule);
    }

    var shownMap = (typeof WeakMap === 'function') ? new WeakMap() : null;
    function syncShown(node, rule) {
        var on = false;
        try { on = !!rule.shown(node); } catch (e) { on = false; }
        var prev = shownMap ? shownMap.get(node) : node.getAttribute('data-bl-uni-shown');
        if (prev === on) return;
        if (shownMap) shownMap.set(node, on);
        else node.setAttribute('data-bl-uni-shown', on ? '1' : '0');
        if (on) node.classList.add('bl-uni-shown');
        else node.classList.remove('bl-uni-shown');
    }

    /* ---------------- 3. 文案朴素化（去 emoji / 宣传语） ---------------- */
    var TEXT_PAIRS = [
        ['⚡ 已预编译 · 点选即下载，序列化零等待', '已就绪'],
        ['⏳ 正在后台预编译… 点选时会自动取最新作品', '正在准备'],
        ['⚡ Precompiled — instant download, zero serialization wait', 'Ready'],
        ['⏳ Precompiling in background — the latest project is used on click', 'Preparing'],
        ['拖到格子松手贴靠', '选择位置后松手'],
        ['Drop on a tile to snap', 'Choose a position'],
        ['移出面板 / Esc 取消', 'Esc 取消'],
        ['Move out or Esc to cancel', 'Esc to cancel']
    ];
    function plainText() {
        var roots;
        try {
            roots = document.querySelectorAll(
                '.bl-sv-ready, .bl-snap-head-sub, .bl-snap-foot span, .bl-snap-head-t, .blp-head p');
        } catch (e) { return; }
        for (var i = 0; i < roots.length; i++) {
            var n = roots[i];
            var t = n.textContent || '';
            var changed = t;
            for (var k = 0; k < TEXT_PAIRS.length; k++) {
                if (changed.indexOf(TEXT_PAIRS[k][0]) >= 0) {
                    changed = changed.split(TEXT_PAIRS[k][0]).join(TEXT_PAIRS[k][1]);
                }
            }
            /* 兜底：任何残留的装饰性 emoji 一律去掉 */
            changed = changed.replace(/[\u26A1\u23F3\u2601\uD83D\uDCE6\u2728\u2B50\uD83C\uDF1F]/g, '').trim();
            if (changed !== t) n.textContent = changed;
        }
    }

    /* ---------------- 4. 调度：观察 + 低频巡检，签名短路 ---------------- */
    function sync() {
        try { cleanMenus(); } catch (e) { /* ignore */ }
        for (var i = 0; i < RULES.length; i++) {
            var rule = RULES[i], list;
            try { list = document.querySelectorAll(rule.sel); } catch (e2) { continue; }
            for (var j = 0; j < list.length; j++) {
                var node = list[j];
                if (isFixedFloat(node)) { restoreFixed(node, rule); continue; }
                if (!node.getAttribute('data-bl-uni')) upgrade(node, rule);
                else syncShown(node, node.__blUniRule || rule);
            }
        }
        try { plainText(); } catch (e3) { /* ignore */ }
    }

    var pending = false, mo = null;
    function schedule() {
        if (pending) return;
        pending = true;
        window.setTimeout(function () { pending = false; sync(); }, 0);
    }
    try {
        if (window.MutationObserver) {
            mo = new MutationObserver(schedule);
            mo.observe(document.body, { childList: true, subtree: true,
                attributes: true, attributeFilter: ['class', 'style'] });
        }
        window.addEventListener('bl:glass-change', schedule);
        window.addEventListener('mw:theme-applied', schedule);
        window.addEventListener('resize', schedule, { passive: true });
    } catch (e) { /* ignore */ }
    window.setInterval(function () { try { sync(); } catch (e2) { /* ignore */ } }, 600);
    sync();

    window.__blUniWindow = {
        sync: sync, rules: RULES, cleanMenus: cleanMenus, plainText: plainText,
        upgrade: upgrade
    };
})();
