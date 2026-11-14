/* ── [B71] 角色栏运行时 ───────────────────────────────────────────────
   依赖：VM / B70 / B52
   维护：分组、右键菜单 7 项、主题变量跟随、多选与移动
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * 角色栏样式（BILUP 原版 / 文件夹样式）
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blSpritePane) return;

    var KEY = 'bl:sprite-pane-style';
    /* 图二顶部三键：滑块（全部展开/折叠）、列表排序、新建文件夹 */
    var ICO_EXPAND = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
    var ICO_SORT = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/><path d="m4 21 2-3h-4z" fill="currentColor" stroke="none"/></svg>';
    var ICO_NEW = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5m-2.5-2.5h5"/></svg>';
    var ICO_ARROW = '<svg class="bl-sp-a" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
    /* 图二：细线描边的文件夹轮廓，没有底色方块 */
    var ICO_FOLDER_LINE = '<svg class="bl-sp-folder-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
    var ICO_SPRITE_FALLBACK = '<svg viewBox="0 0 30 30" width="30" height="30" fill="none"><rect width="30" height="30" rx="7" fill="#101010"/><path d="M9 15h12" stroke="#888" stroke-width="1.6" stroke-linecap="round"/></svg>';

    function isZh() {
        try {
            var l = (document.documentElement.lang || '').toLowerCase();
            if (l.indexOf('zh') === 0) return true;
            if (l.indexOf('en') === 0) return false;
        } catch (e) { /* ignore */ }
        return !/Settings|Backdrops|Choose an Extension/.test(document.body.innerText || '');
    }
    function T(zh, en) { return isZh() ? zh : en; }
    function esc(x) {
        return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function get() {
        try { return localStorage.getItem(KEY) === 'folder' ? 'folder' : 'original'; }
        catch (e) { return 'original'; }
    }
    function set(v) {
        v = v === 'folder' ? 'folder' : 'original';
        try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ }
        apply(); syncCard();
    }
    function VM() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            return (st && st.scratchGui && st.scratchGui.vm) || null;
        } catch (e) { return null; }
    }


    /* ==================================================================
       第 31 轮 · 文件夹视图右键菜单
       复用原版 react-contextmenu 的 DOM / CSS（与 DOCK、角色栏原版菜单
       同一套），因此主题色、hover、分隔线、以及工作区右键弹窗动画
       全部自动跟随。
       ================================================================== */
    var SP_MENU_CLS = 'react-contextmenu context-menu_context-menu_2SJM- react-contextmenu--visible';
    var SP_ITEM_CLS = 'react-contextmenu-item context-menu_menu-item_3cioN';
    var SP_BORDER_CLS = 'context-menu_menu-item-bordered_29CJG';
    var SP_DANGER_CLS = 'context-menu_menu-item-danger_1tJg0';
    var SP_DISABLED_CLS = 'react-contextmenu-item--disabled';
    var spMenuEl = null, spMoveMenuEl = null, spMenuCtx = null;
    var multiSelect = false;
    var spSelected = Object.create(null);

    function spLangZh() {
        try { return !/^en/i.test(document.documentElement.lang || ''); }
        catch (e) { return true; }
    }
    function spT(zh, en) { return spLangZh() ? zh : en; }
    function spEsc2(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function spSelCount() {
        var n = 0;
        for (var k in spSelected) if (spSelected[k]) n++;
        return n;
    }
    function spCloseMove() {
        if (spMoveMenuEl && spMoveMenuEl.parentNode) spMoveMenuEl.parentNode.removeChild(spMoveMenuEl);
        spMoveMenuEl = null;
    }
    function spCloseMenu() {
        spCloseMove();
        if (spMenuEl && spMenuEl.parentNode) spMenuEl.parentNode.removeChild(spMenuEl);
        spMenuEl = null; spMenuCtx = null;
    }
    function spDefaultGroup() { return T('未分组', 'Ungrouped'); }

    /* 右键目标（或当前多选集合）对应的角色 id 列表 */
    function spTargetIds(ctx) {
        var ids = [], k;
        for (k in spSelected) if (spSelected[k]) ids.push(k);
        if (ids.length) return ids;
        if (!ctx) return [];
        if (ctx.kind === 'item') return ctx.id ? [ctx.id] : [];
        if (ctx.kind === 'folder') {
            var g = groupsOf();
            var arr = g.groups[ctx.g] || [];
            for (var i = 0; i < arr.length; i++) ids.push(arr[i].id);
        }
        return ids;
    }
    function spTargetName(id) {
        var v = VM();
        try {
            var t = v && v.runtime && v.runtime.getTargetById(id);
            return t ? (t.getName() || '') : '';
        } catch (e) { return ''; }
    }
    function spBare(name) {
        var ix = String(name || '').indexOf('//');
        return ix >= 0 ? String(name).slice(ix + 2).trim() : String(name || '').trim();
    }

    /* ---- 七项功能 ---- */
    function spDelFolder(ctx) {
        var ids = spTargetIds(ctx), g = ctx && ctx.g;
        if (!ids.length) return;
        if (!window.confirm(spT('确定删除文件夹「', 'Delete folder "') + g +
                spT('」及其中的 ', '" and its ') + ids.length + spT(' 个角色？', ' sprites?'))) return;
        var vm = VM();
        if (!vm) return;
        for (var i = 0; i < ids.length; i++) { try { vm.deleteSprite(ids[i]); } catch (e) { /* ignore */ } }
        spSelected = Object.create(null);
        render();
    }
    function spDeleteSprite(ctx) {
        var ids = spTargetIds(ctx), vm = VM();
        if (!vm) return;
        for (var i = 0; i < ids.length; i++) { try { vm.deleteSprite(ids[i]); } catch (e) { /* ignore */ } }
        spSelected = Object.create(null);
        render();
    }
    function spDuplicate(ctx) {
        var ids = spTargetIds(ctx), vm = VM();
        if (!vm || !vm.duplicateSprite) return;
        for (var i = 0; i < ids.length; i++) {
            try { vm.duplicateSprite(ids[i]); } catch (e) { /* ignore */ }
        }
        /* duplicateSprite 内部有异步素材加载，稍后补两次重绘 */
        window.setTimeout(render, 260);
        window.setTimeout(render, 700);
    }
    function spRename(ctx) {
        var vm = VM();
        if (!vm || !vm.renameSprite) return;
        if (ctx.kind === 'folder') {
            var old = prompt(spT('重命名文件夹', 'Rename folder'), ctx.g || '');
            if (old == null) return;
            var ng = String(old).trim().replace(/\//g, '');
            if (!ng) return;
            var g = groupsOf(), arr = g.groups[ctx.g] || [];
            for (var i = 0; i < arr.length; i++) {
                var bare = spBare(arr[i].raw);
                try { vm.renameSprite(arr[i].id, ng + '//' + bare); } catch (e) { /* ignore */ }
            }
            /* 折叠状态跟着新名字走 */
            try {
                if (collapsed[ctx.g] === false) { collapsed[ng] = false; delete collapsed[ctx.g]; }
                else if (collapsed[ctx.g] === true) { collapsed[ng] = true; delete collapsed[ctx.g]; }
            } catch (e2) { /* ignore */ }
        } else {
            var ids = spTargetIds(ctx);
            if (!ids.length) return;
            var cur = spBare(spTargetName(ids[0]));
            var nn = prompt(spT('重命名角色', 'Rename sprite'), cur);
            if (nn == null) return;
            nn = String(nn).trim().replace(/\//g, '');
            if (!nn) return;
            var raw = spTargetName(ids[0]), ix = String(raw).indexOf('//');
            var prefix = ix >= 0 ? String(raw).slice(0, ix).trim() + '//' : '';
            for (var j = 0; j < ids.length; j++) {
                var bare = j === 0 ? nn : spBare(spTargetName(ids[j]));
                try { vm.renameSprite(ids[j], prefix + bare); } catch (e3) { /* ignore */ }
            }
        }
        render();
    }
    function spToggleMulti() {
        multiSelect = !multiSelect;
        spSelected = Object.create(null);
        render();
    }

    /* ---- 移动：二级菜单列出所有文件夹 ---- */
    function spDoMove(g, ctx) {
        var ids = spTargetIds(ctx), vm = VM();
        if (!vm || !vm.renameSprite) return;
        var def = spDefaultGroup();
        for (var i = 0; i < ids.length; i++) {
            var bare = spBare(spTargetName(ids[i]));
            var nm = (g === def) ? bare : (g + '//' + bare);
            try { vm.renameSprite(ids[i], nm); } catch (e) { /* ignore */ }
        }
        spCloseMenu();
        render();
    }
    function spMoveTo(ctx, x, y) {
        spCloseMove();
        var m = document.createElement('nav');
        m.className = SP_MENU_CLS + ' bl-sp-menu bl-sp-move-menu';
        m.setAttribute('role', 'menu');
        m.setAttribute('tabindex', '-1');
        m.style.position = 'fixed';
        m.style.pointerEvents = 'auto';
        var g = groupsOf(), i;
        for (i = 0; i < g.order.length; i++) {
            (function (name) {
                var it = spMakeItem(name, false, function () { spDoMove(name, ctx); }, {});
                m.appendChild(it);
            })(g.order[i]);
        }
        var hasDef = g.order.indexOf(spDefaultGroup()) >= 0;
        if (!hasDef) {
            (function (name) {
                m.appendChild(spMakeItem(name, false, function () { spDoMove(name, ctx); },
                    { bordered: true }));
            })(spDefaultGroup());
        }
        m.appendChild(spMakeItem(spT('＋ 新建文件夹…', '+ New folder…'), false, function () {
            var nn = prompt(spT('新文件夹名称', 'New folder name'), '');
            if (nn == null) { spCloseMenu(); return; }
            nn = String(nn).trim().replace(/\//g, '');
            if (nn) spDoMove(nn, ctx);
            else spCloseMenu();
        }, { bordered: true }));
        document.body.appendChild(m);
        var r = m.getBoundingClientRect();
        var left = x, top = y;
        if (left + r.width > window.innerWidth) left = Math.max(0, window.innerWidth - r.width);
        if (top + r.height > window.innerHeight) top = Math.max(0, top - r.height);
        m.style.left = Math.max(0, left) + 'px';
        m.style.top = Math.max(0, top) + 'px';
        spMoveMenuEl = m;
    }

    /* ---- 菜单 DOM ---- */
    function spMakeItem(label, disabled, fn, opts) {
        opts = opts || {};
        var it = document.createElement('div');
        var cls = SP_ITEM_CLS;
        if (opts.bordered) cls += ' ' + SP_BORDER_CLS;
        if (opts.danger) cls += ' ' + SP_DANGER_CLS;
        if (disabled) cls += ' ' + SP_DISABLED_CLS;
        it.className = cls;
        it.setAttribute('role', 'menuitem');
        it.setAttribute('tabindex', '-1');
        it.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        var sp = document.createElement('span');
        sp.textContent = label;
        it.appendChild(sp);
        if (!disabled) it.addEventListener('click', function (e) {
            e.stopPropagation();
            try { fn && fn(); } finally { spCloseMenu(); }
        });
        return it;
    }
    function spOpenMenu(x, y, ctx) {
        spCloseMenu();
        try { window.dispatchEvent(new CustomEvent('REACT_CONTEXTMENU_HIDE')); }
        catch (e0) { /* ignore */ }
        spMenuCtx = ctx;
        var isFolder = ctx.kind === 'folder';
        var m = document.createElement('nav');
        m.className = SP_MENU_CLS + ' bl-sp-menu';
        m.setAttribute('role', 'menu');
        m.setAttribute('tabindex', '-1');
        m.style.position = 'fixed';
        m.style.pointerEvents = 'auto';

        m.appendChild(spMakeItem(spT('删除文件夹', 'Delete folder'), !isFolder,
            function () { spDelFolder(ctx); }, { danger: true }));
        m.appendChild(spMakeItem(spT('删除角色', 'Delete sprite'), isFolder,
            function () { spDeleteSprite(ctx); }, { danger: true }));
        m.appendChild(spMakeItem(spT('复制角色', 'Duplicate sprite'), isFolder,
            function () { spDuplicate(ctx); }));
        m.appendChild(spMakeItem(spT('重命名', 'Rename'), false,
            function () { spRename(ctx); }, { bordered: true }));
        m.appendChild(spMakeItem(spT('删除', 'Delete'), false,
            function () { spDeleteSprite(ctx); }));
        m.appendChild(spMakeItem(spT('多选', 'Multi-select') + (multiSelect ? ' ✓' : ''), false,
            function () { spToggleMulti(); }));
        m.appendChild(spMakeItem(spT('移动', 'Move'), false,
            function () {
                /* 主菜单关闭会连带清掉二级菜单，这里延后一帧再开 */
                var cx = x, cy = y, c = ctx;
                window.setTimeout(function () { spMoveTo(c, cx + 20, cy + 8); }, 0);
            }, { bordered: true }));

        document.body.appendChild(m);
        var r = m.getBoundingClientRect();
        var left = x, top = y;
        if (left + r.width > window.innerWidth) left = Math.max(0, window.innerWidth - r.width);
        if (top + r.height > window.innerHeight) top = Math.max(0, top - r.height);
        m.style.left = Math.max(0, left) + 'px';
        m.style.top = Math.max(0, top) + 'px';
        spMenuEl = m;
    }

    /* ---- 事件 ---- */
    function onSpContext(e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var v = t.closest('#blSpriteFolderView');
        if (!v) return;
        e.preventDefault();
        e.stopPropagation();
        spCloseMenu();
        var f = t.closest('.bl-sp-row.bl-sp-folder');
        var it = t.closest('.bl-sp-row.bl-sp-item');
        if (f) {
            spOpenMenu(e.clientX, e.clientY, { kind: 'folder', g: f.getAttribute('data-g') || '' });
        } else if (it) {
            spOpenMenu(e.clientX, e.clientY, {
                kind: 'item', id: it.getAttribute('data-id') || '',
                raw: it.getAttribute('title') || '',
                name: ((it.querySelector('.bl-sp-n') || {}).innerText || '').trim()
            });
        }
    }
    function onSpOutside(e) {
        if (!spMenuEl && !spMoveMenuEl) return;
        var t = e.target;
        if (t && t.closest && (t.closest('.bl-sp-menu') || t.closest('.bl-sp-move-menu'))) return;
        spCloseMenu();
    }
    function onSpKey(e) {
        if (!spMenuEl && !spMoveMenuEl) return;
        if (e.key === 'Escape') { e.preventDefault(); spCloseMenu(); }
    }

    /* ==================================================================
       第 31 轮 · 舞台尺寸固定三档（hidden / small / full）
       TurboWarp 在自定义舞台尺寸偏大时会开放第 4 档 large；
       CSS 已把第 4 个按钮隐藏，这里把 large 状态归一回 full，
       保证状态与按钮始终只有三档。
       ================================================================== */
    var STAGE3 = ['hidden', 'small', 'full'];
    function stage3Guard() {
        try {
            var store = window.ReduxStore;
            if (!store || !store.getState) return;
            var st = store.getState();
            var mode = st && st.scratchGui && st.scratchGui.stageSize && st.scratchGui.stageSize.stageSize;
            if (mode && STAGE3.indexOf(mode) < 0) {
                store.dispatch({ type: 'scratch-gui/StageSize/SET_STAGE_SIZE', stageSize: 'full' });
            }
        } catch (e) { /* ignore */ }
    }
    function installStage3() {
        if (window.__blStage3) return;
        try {
            var store = window.ReduxStore;
            if (!store || !store.subscribe) return;
            window.__blStage3 = true;
            store.subscribe(stage3Guard);
            stage3Guard();
        } catch (e) { /* ignore */ }
    }

    var collapsed = Object.create(null);
    var sortByName = false;
    var view = null, hostEl = null;

    function findHost() {
        var h = document.querySelector('[class*="sprite-selector_scroll-wrapper"]');
        if (!h) return null;
        if (h !== hostEl) {
            hostEl = h;
            h.style.position = 'relative';
        }
        return h;
    }

    function buildView(host) {
        /* 唯一节点原则：页面里永远只有一个 #blSpriteFolderView，
           且 render 写入的必然就是 getElementById 拿到的那个。
           之前允许闭包里保留无 id 的旧节点，导致「状态变了但 DOM 没变」。 */
        var stale = document.querySelectorAll('#blSpriteFolderView');
        var dom = stale.length ? stale[0] : null;
        for (var i = 1; i < stale.length; i++) {
            if (stale[i].parentNode) stale[i].parentNode.removeChild(stale[i]);
        }
        if (!dom) {
            dom = document.createElement('div');
            dom.className = 'bl-sp-view';
            dom.id = 'blSpriteFolderView';
        }
        if (dom.parentNode !== host) host.appendChild(dom);
        view = dom;
        return view;
    }

    /* 文档级捕获委托：view 节点可能被 React 重绘换掉，绑在闭包节点上会失效。
       这里只认「当前 DOM 中 #blSpriteFolderView 内」的点击，与重建无关。 */
    function onSpClick(e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var v = t.closest('#blSpriteFolderView');
        if (!v) return;
        e.stopPropagation();

        /* 必须是「行」本身：不能让 <html> 上的模式类混进来 */
        var f = t.closest('.bl-sp-row.bl-sp-folder');
        if (f) {
            var g = f.getAttribute('data-g');
            /* 未记录过 = 默认折叠，所以首次点击必须展开；
               用 !collapsed[g] 会把 undefined 取反成 true（仍然折叠）。 */
            collapsed[g] = (collapsed[g] === false) ? true : false;
            render();
            return;
        }
        var it = t.closest('.bl-sp-row.bl-sp-item');
        if (it) {
            var id = it.getAttribute('data-id');
            if (multiSelect) {
                if (spSelected[id]) delete spSelected[id];
                else spSelected[id] = 1;
                render();
                return;
            }
            var nm = (it.querySelector('.bl-sp-n') || {}).innerText || '';
            selectSprite(id, String(nm).trim());
            render();
            return;
        }
        var b = t.closest('.bl-sp-bar button');
        if (b) {
            var act = b.getAttribute('data-a');
            if (act === 'expand') {
                var anyOpen = false;
                try {
                    var gs = groupsOf();
                    for (var i = 0; i < gs.order.length; i++) if (collapsed[gs.order[i]] === false) { anyOpen = true; break; }
                } catch (e2) { /* ignore */ }
                /* 只要有展开的就全折叠，否则全展开 */
                try {
                    var g2 = groupsOf();
                    for (var j = 0; j < g2.order.length; j++) collapsed[g2.order[j]] = anyOpen ? true : false;
                } catch (e3) { /* ignore */ }
            } else if (act === 'sort') {
                sortByName = !sortByName;
            } else if (act === 'new') {
                var name = window.prompt(T('新文件夹名称', 'New folder name'), '');
                if (name) {
                    name = String(name).trim().replace(/\//g, '');
                    var vm2 = VM();
                    if (vm2 && vm2.editingTarget && vm2.editingTarget.isSprite &&
                        vm2.editingTarget.isSprite() && vm2.renameSprite) {
                        var cur = vm2.editingTarget.getName() || '';
                        var bare = cur.indexOf('//') >= 0 ? cur.slice(cur.indexOf('//') + 2) : cur;
                        try { vm2.renameSprite(vm2.editingTarget.id, name + '//' + bare); }
                        catch (e4) { /* ignore */ }
                    }
                }
            }
            render();
        }
    }
    function installClick() {
        if (window.__blSpClick) return;
        window.__blSpClick = true;
        document.addEventListener('click', onSpClick, true);
        document.addEventListener('contextmenu', onSpContext, true);
        document.addEventListener('pointerdown', onSpOutside, true);
        document.addEventListener('keydown', onSpKey, true);
        window.addEventListener('resize', spCloseMenu);
        installStage3();
    }

    /* 选中角色：优先复用原生 sprite-selector-item 的点击（React 全链路处理，
       与图一原版行为完全一致），找不到再退回 VM.setEditingTarget。 */
    function selectSprite(id, name) {
        /* 先同步 VM（保证 render 立刻能读到新的 editingTarget） */
        var vm = VM();
        if (vm && id) { try { vm.setEditingTarget(id); } catch (e0) { /* ignore */ } }
        /* 再点原生项，让 React / Redux 的高亮与侧栏状态一起跟上 */
        try {
            var roots = document.querySelectorAll('[class*="sprite-selector-item_sprite-selector-item"]');
            for (var i = 0; i < roots.length; i++) {
                var n = roots[i].querySelector('[class*="sprite-name"]');
                var k = n ? String(n.innerText || n.textContent || '').trim() : '';
                if (name && k === name) { roots[i].click(); break; }
            }
        } catch (e) { /* ignore */ }
    }

    /* 复用原生 sprite-selector-item 里的造型缩略图（dataURL）。
       原生列表只是被浮层盖住，React 仍在渲染，所以能直接取到真实造型图。
       键用「显示名」（去掉 // 前缀），与原生 item 的 sprite-name 一致。 */
    function thumbMap() {
        var map = Object.create(null);
        try {
            var roots = document.querySelectorAll('[class*="sprite-selector-item_sprite-selector-item"]');
            for (var i = 0; i < roots.length; i++) {
                var e = roots[i];
                var n = e.querySelector('[class*="sprite-name"]');
                var im = e.querySelector('img[class*="sprite-image"]');
                if (!n || !im || !im.src) continue;
                var k = (n.innerText || n.textContent || '').trim();
                if (k && !map[k]) map[k] = im.src;
            }
        } catch (e) { /* ignore */ }
        return map;
    }
    /* 文件夹行现在用细线图标 ICO_FOLDER_LINE，这里只负责角色造型缩略图 */
    function thumbTag(name) {
        var m = thumbMap(), src = m[name];
        if (src) return '<img class="bl-sp-thumb" alt="" src="' + esc(src) + '">';
        return '<span class="bl-sp-thumb">' + ICO_SPRITE_FALLBACK + '</span>';
    }

    function groupsOf() {
        /* 图二：视图里只有文件夹行。带 // 的按前缀分组，普通命名的角色
           统一收进默认文件夹，不再平铺成顶层角色行。 */
        var v = VM(), groups = Object.create(null), order = [];
        var def = T('未分组', 'Ungrouped');
        if (v && v.runtime && v.runtime.targets) {
            var list = v.runtime.targets;
            for (var i = 0; i < list.length; i++) {
                var t = list[i];
                if (!t || !t.isSprite || !t.isSprite()) continue;
                var nm = '';
                try { nm = t.getName() || ''; } catch (e) { /* ignore */ }
                var ix = nm.indexOf('//');
                var g = ix >= 0 ? (nm.slice(0, ix).trim() || def) : def;
                var item = { id: t.id, name: ix >= 0 ? nm.slice(ix + 2).trim() : nm, raw: nm };
                if (!groups[g]) { groups[g] = []; order.push(g); }
                groups[g].push(item);
            }
        }
        if (sortByName) {
            order.sort(function (a, b) { return a.localeCompare(b); });
            for (var k = 0; k < order.length; k++) {
                groups[order[k]].sort(function (a, b) { return a.name.localeCompare(b.name); });
            }
        }
        return { groups: groups, order: order, flat: [] };
    }

    function render() {
        installClick();
        var host = findHost();
        if (!host) return;
        var vw = buildView(host);
        var g = groupsOf();
        var vm = VM(), sel = '';
        try { sel = vm && vm.editingTarget ? vm.editingTarget.id : ''; } catch (e) { /* ignore */ }
        /* 图二：顶部只留三枚方形工具键，右侧留白，不塞提示文字 */
        var html = '<div class="bl-sp-bar">' +
            '<button type="button" data-a="expand" title="' + esc(T('全部展开 / 折叠', 'Expand / collapse all')) + '">' + ICO_EXPAND + '</button>' +
            '<button type="button" data-a="sort" class="' + (sortByName ? 'is-on' : '') + '" title="' + esc(T('按名称排序', 'Sort by name')) + '">' + ICO_SORT + '</button>' +
            '<button type="button" data-a="new" class="is-accent" title="' + esc(T('新建文件夹（重命名当前角色）', 'New folder (rename current sprite)')) + '">' + ICO_NEW + '</button>' +
            (multiSelect ? '<span class="bl-sp-multi-tip">' + esc(spT('已选 ', '') + spSelCount() + spT(' 项', ' selected')) + '</span>' : '') +
            '</div><div class="bl-sp-list">';

        /* 平铺行（普通命名的角色）—— 图二的 角色1 / 角色2 / 角色3 / 角色4 */
        for (var f = 0; f < g.flat.length; f++) {
            var it = g.flat[f];
            html += '<div class="bl-sp-row bl-sp-item' + (it.id === sel ? ' is-sel' : '') +
                '" data-id="' + esc(it.id) + '" title="' + esc(it.raw) + '">' +
                thumbTag(it.name, false) +
                '<span class="bl-sp-n">' + esc(it.name) + '</span></div>';
        }

        /* 文件夹行：默认全部折叠，只显示一行图标 + 名称 + 分隔线（图二） */
        for (var i = 0; i < g.order.length; i++) {
            var name = g.order[i], arr = g.groups[name];
            var open = collapsed[name] === false;   /* 未记录过 = 折叠 */
            html += '<div class="bl-sp-row bl-sp-folder' + (open ? ' is-open' : '') +
                '" data-g="' + esc(name) + '">' +
                ICO_FOLDER_LINE +
                '<span class="bl-sp-n">' + esc(name) + '</span>' +
                '<span class="bl-sp-c">' + arr.length + '</span>' + ICO_ARROW + '</div>';
            if (open) {
                for (var j = 0; j < arr.length; j++) {
                    html += '<div class="bl-sp-row bl-sp-item bl-sp-child' + (arr[j].id === sel ? ' is-sel' : '') +
                        (spSelected[arr[j].id] ? ' is-multi' : '') +
                        '" data-id="' + esc(arr[j].id) + '" title="' + esc(arr[j].raw) + '">' +
                        thumbTag(arr[j].name, false) +
                        '<span class="bl-sp-n">' + esc(arr[j].name) + '</span></div>';
                }
            }
        }
        if (!g.flat.length && !g.order.length) {
            html += '<div class="bl-sp-empty">' + esc(T('还没有角色', 'No sprites yet')) + '</div>';
        }
        html += '</div>';
        /* 幂等：自动校准会频繁调用 render，状态没变就不要重写 innerHTML，
           否则子行的入场动画会被反复重放、折叠看起来像「点了没反应」。
           签名每次即时计算（不缓存整段 html），并强制修复被外部清空的节点。 */
        var ids = [], kk;
        for (kk = 0; kk < g.order.length; kk++) {
            var ar = g.groups[g.order[kk]];
            for (var q = 0; q < ar.length; q++) ids.push(ar[q].id + ':' + ar[q].name);
        }
        var selKeys = [], sk;
        for (sk in spSelected) if (spSelected[sk]) selKeys.push(sk);
        var sig = JSON.stringify([collapsed, sortByName, g.order, ids, sel, multiSelect, selKeys]);
        if (vw.__blSpSig !== sig || !vw.children.length) {
            vw.innerHTML = html;
            vw.__blSpSig = sig;
        }
    }

    function apply() {
        var on = get() === 'folder';
        if (on) document.documentElement.classList.add('bl-sp-mode-folder');
        else {
            document.documentElement.classList.remove('bl-sp-mode-folder');
            /* 原版模式下把浮层彻底摘掉：图一必须 100% 是原生 sprite-selector */
            try {
                if (view && view.parentNode) view.parentNode.removeChild(view);
                view = null; hostEl = null;
            } catch (eSp) { /* ignore */ }
        }
        if (on) render();
        else if (view) view.innerHTML = '';
    }

    /* ---------- 设置 → 常规 的卡片 ---------- */
    var CARD_ID = 'blSpritePaneCard';
    function generalBody() {
        var body = document.querySelector('[class*="settings-modal_body_"]');
        if (!body) return null;
        var items = [].slice.call(document.querySelectorAll('[class*="modal-sidebar_item_"]'));
        if (!items.length) return null;
        var general = null, selected = null;
        for (var i = 0; i < items.length; i++) {
            var t = (items[i].innerText || '').trim();
            if (t === '常规' || t === 'General') general = items[i];
            if (/itemSelected|is-on/.test(String(items[i].className))) selected = items[i];
        }
        if (!general) return null;
        if (selected && selected !== general) return null;
        return body;
    }
    function cardHTML() {
        var cur = get();
        return '<div class="bl-sp-card-h">' + esc(T('角色栏样式', 'Sprite pane style')) + '</div>' +
            '<div class="bl-sp-card-d">' + esc(T('BILUP 原版：原生卡片式角色栏（选中才有缩略图、名称条与删除角标）。文件夹样式：深色一列文件夹，默认全部折叠，点开才看角色；「文件夹名//角色名」自动分组，无前缀的角色归入「未分组」，可折叠 / 排序 / 新建文件夹。',
                'BILUP: native card-style sprite pane (thumbnail, name bar and delete badge appear on the selected sprite). Folders: dark list of folders, all collapsed by default; "Folder//Sprite" names are grouped and plain sprites go to "Ungrouped". Collapsible / sortable.')) + '</div>' +
            '<div class="bl-sp-seg">' +
            '<button type="button" data-v="original" class="' + (cur === 'original' ? 'is-on' : '') + '">BILUP ' + esc(T('原版', 'Classic')) + '</button>' +
            '<button type="button" data-v="folder" class="' + (cur === 'folder' ? 'is-on' : '') + '">' + esc(T('文件夹样式', 'Folders')) + '</button>' +
            '</div>';
    }
    function syncCard() {
        var c = document.getElementById(CARD_ID);
        if (c) c.innerHTML = cardHTML();
    }
    function mountCard() {
        var body = generalBody();
        if (!body) return;
        var c = document.getElementById(CARD_ID);
        if (c && c.parentNode === body) return;
        if (c && c.parentNode) c.parentNode.removeChild(c);
        c = document.createElement('div');
        c.className = 'bl-sp-card';
        c.id = CARD_ID;
        c.innerHTML = cardHTML();
        c.addEventListener('click', function (e) {
            var b = e.target && e.target.closest ? e.target.closest('button[data-v]') : null;
            if (b) set(b.getAttribute('data-v'));
        });
        body.insertBefore(c, body.firstChild);
    }

    /* VM 目标变化 / 作品加载后刷新文件夹视图 */
    function bindVM() {
        var v = VM();
        if (!v || v.__blSpBound) return;
        v.__blSpBound = true;
        try {
            v.on('targetsUpdate', function () { if (get() === 'folder') render(); });
            v.runtime.on('PROJECT_LOADED', function () { if (get() === 'folder') render(); });
        } catch (e) { /* ignore */ }
    }

    var mo = null;
    function tick() {
        try {
            bindVM();
            mountCard();
            if (get() === 'folder' && !document.getElementById('blSpriteFolderView')) apply();
        } catch (e) { /* ignore */ }
    }
    try {
        mo = new MutationObserver(function () {
            if (mo.__t) return;
            mo.__t = setTimeout(function () { mo.__t = 0; tick(); }, 60);
        });
        mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) { /* ignore */
        setInterval(tick, 400);
    }
    window.addEventListener('storage', function (e) {
        if (e && e.key === KEY) { apply(); syncCard(); }
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
    else tick();

    window.__blSpritePane = {
        get: get, set: set, apply: apply, render: render,
        groups: groupsOf, installClick: installClick,
        menu: function () { return {
            open: !!spMenuEl, moveOpen: !!spMoveMenuEl,
            multiSelect: multiSelect, selectedCount: spSelCount(),
            labels: spMenuEl ? [].slice.call(spMenuEl.querySelectorAll('.react-contextmenu-item'))
                .map(function (e) { return (e.innerText || '').trim(); }) : []
        }; },
        stage3: stage3Guard,
        state: function () { return {
            sortByName: sortByName,
            collapsed: JSON.parse(JSON.stringify(collapsed)),
            viewNode: view,
            domNode: document.getElementById('blSpriteFolderView')
        }; }
    };
})();
