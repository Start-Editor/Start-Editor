/* ── [B38] studio.js · 工作区增强 ───────────────────────────────────────────────
   依赖：ScratchBlocks / VM
   维护：右键菜单、积木导出、置顶、搜索都挂在这里
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
   studio.js —— StartEditor 工作区增强
   --------------------------------------------------------------------------
   1) 置顶：积木右键「置顶」→ 积木栏多出「置顶」分类，里面的积木可直接拖出用。
   2) 积木右键菜单：置顶 / 下载积木 SVG / 下载积木 PNG / 复制积木图片。
   3) 教程：分步导览，走到对应步骤时会真的把相关弹窗打开做演示。

   与 inject.js / dock.js / vinyl.js / music.js / star.js 物理隔离，
   任一出错不影响其它部分。
   ========================================================================== */
(function () {
    'use strict';

    var PIN_KEY = 'bilup.pinnedBlocks';
    var TUT_KEY = 'bilup.tutorialDone';

    /* ---------------------------------------------------------------- *
     * 基础
     * ---------------------------------------------------------------- */

    function SB() { return window.ScratchBlocks || null; }
    function vm() { return window.vm || null; }
    function ws() {
        var s = SB();
        if (!s || typeof s.getMainWorkspace !== 'function') return null;
        try { return s.getMainWorkspace(); } catch (e) { return null; }
    }
    function topHost() {
        try { return (window.__blTopLayer && window.__blTopLayer()) || document.body; }
        catch (e) { return document.body; }
    }
    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function toast(msg) {
        var t = document.getElementById('bl-studio-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'bl-studio-toast';
            t.className = 'bl-studio-toast';
            try { topHost().appendChild(t); } catch (e) { document.body.appendChild(t); }
        }
        t.textContent = msg;
        t.classList.add('is-on');
        window.clearTimeout(toast._t);
        toast._t = window.setTimeout(function () { t.classList.remove('is-on'); }, 2200);
    }
    function popIn(el) {
        try { if (window.__blPop && window.__blPop.in) window.__blPop.in(el); } catch (e) { /* ignore */ }
    }
    function popOut(el, done) {
        try { if (window.__blPop && window.__blPop.out) { window.__blPop.out(el, done); return; } } catch (e) { /* ignore */ }
        done();
    }
    function front() {
        try { if (typeof window.__blUnifyFront === 'function') window.__blUnifyFront(); } catch (e) { /* ignore */ }
    }

    function icoX() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
            ' stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/>' +
            '<line x1="18" y1="6" x2="6" y2="18"/></svg>';
    }
    function icoMin() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
            ' stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    }
    function icoMax() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
            ' stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>';
    }
    function icoRestore() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
            ' stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="4" y="8" width="10" height="10" rx="1.5"/>' +
            '<path d="M10 8V6.5A1.5 1.5 0 0 1 11.5 5H19a1.5 1.5 0 0 1 1.5 1.5V14a1.5 1.5 0 0 1-1.5 1.5H17"/></svg>';
    }

    function winShell(cls, title, withMax, extraCls) {
        var w = document.createElement('div');
        w.className = 'addon-window ' + cls + (extraCls ? ' ' + extraCls : '');
        /* 原生 .addon-window 本身不带 position，而顶层宿主是 fixed 铺满视口的容器。
           窗口若停在默认的 static，后面写在 style 上的 left/top 会【完全失效】，
           元素老老实实从宿主左上角开始排 —— 表现就是"窗口跑到屏幕左上角"。
           这里在创建时就钉死，任何一个调用点漏写都不会再出问题。
           pointer-events 同理：宿主整层是 none 且会继承，不声明就点不动。 */
        w.style.position = 'fixed';
        w.style.pointerEvents = 'auto';
        w.innerHTML =
            '<div class="addon-window-header">' +
            '<span class="addon-window-title">' + esc(title) + '</span>' +
            '<div class="addon-window-controls">' +
            '<button type="button" class="addon-window-btn addon-window-btn-minimize sw-min"' +
            ' title="最小化" aria-label="最小化">' + icoMin() + '</button>' +
            (withMax ? '<button type="button" class="addon-window-btn addon-window-btn-maximize sw-max"' +
                ' title="最大化" aria-label="最大化">' + icoMax() + '</button>' : '') +
            '<button type="button" class="addon-window-btn addon-window-btn-close sw-close"' +
            ' title="关闭" aria-label="关闭">' + icoX() + '</button>' +
            '</div></div>' +
            '<div class="addon-window-content ' + cls + '-body"></div>';
        return w;
    }

    /* 顶层宿主是 pointer-events:none（否则整层会挡住编辑器），而 none 会继承，
       窗口必须自己声明 auto —— 否则画得出来却点不动，看着像一张贴图。 */
    function mountWin(w) {
        try { topHost().appendChild(w); } catch (e) { document.body.appendChild(w); }
        w.style.position = 'fixed';
        popIn(w);
        front();
        return w;
    }

    function bindChrome(w, onClose) {
        w.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            if (t.closest('.sw-min')) {
                if (!w.getAttribute('data-bl-id')) w.setAttribute('data-bl-id', 'st' + Date.now());
                var id = w.getAttribute('data-bl-id');
                var ttl = w.querySelector('.addon-window-title');
                var d = window.__blDockMin;
                if (d && d.min) {
                    d.min(w, { id: id, label: (ttl && ttl.textContent) || '窗口' });
                } else {
                    w.style.display = 'none';
                }
                return;
            }
            if (t.closest('.sw-max')) {
                var max = w.classList.toggle('bl-window-maximized');
                var btn = w.querySelector('.sw-max');
                if (btn) btn.innerHTML = max ? icoRestore() : icoMax();
                if (max) {
                    w.__blRect = { l: w.style.left, t: w.style.top, w: w.style.width, h: w.style.height };
                    w.style.left = '0px'; w.style.top = '0px';
                    w.style.width = '100vw'; w.style.height = '100vh';
                } else if (w.__blRect) {
                    var r = w.__blRect;
                    w.style.left = r.l; w.style.top = r.t;
                    w.style.width = r.w; w.style.height = r.h;
                    w.__blRect = null;
                }
                return;
            }
            if (t.closest('.sw-close')) {
                popOut(w, function () {
                    if (typeof onClose === 'function') onClose();
                    else if (w.parentNode) w.parentNode.removeChild(w);
                });
            }
        }, true);
    }

    function centerWin(w, ww, hh) {
        var vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
        w.style.width = ww + 'px';
        w.style.height = hh + 'px';
        w.style.left = Math.max(8, Math.round((vw - ww) / 2)) + 'px';
        w.style.top = Math.max(8, Math.round((vh - hh) / 2)) + 'px';
    }

    /* ---------------------------------------------------------------- *
     * 置顶
     * ---------------------------------------------------------------- */

    var pins = [];
    var lastToolbox = null;
    var tbWrapped = false;

    function pinsLoad() {
        try {
            var v = JSON.parse(window.localStorage.getItem(PIN_KEY) || '[]');
            var arr = Array.isArray(v) ? v : [];
            var seen = {}, out = [];
            for (var i = 0; i < arr.length; i++) {
                if (!arr[i] || typeof arr[i].xml !== 'string') continue;
                var nx = normXmlText(arr[i].xml);
                if (!nx || seen[nx]) continue;      /* 旧版重复置顶的记录顺手去重 */
                seen[nx] = 1;
                out.push({
                    id: arr[i].id || ('pin' + Date.now() + i),
                    xml: nx, name: arr[i].name || '积木'
                });
            }
            pins = out;
            /* 旧存档写回归一化格式，重开后右键才能正确识别「不再置顶」 */
            try { window.localStorage.setItem(PIN_KEY, JSON.stringify(pins)); } catch (e2) {}
        } catch (e) { pins = []; }
    }
    function pinsSave() {
        try { window.localStorage.setItem(PIN_KEY, JSON.stringify(pins)); } catch (e) { /* ignore */ }
    }

    /* 归一化签名：Xml.blockToDom 会带上随机生成的 id（以及 x/y 坐标）。
       重新打开编辑器、从置顶分类拖出来的积木 id 必然不同，旧版用整段
       XML 字符串精确比对，于是 pinHas 永远为 false、右键只显示「置顶」，
       越点越多、永远取消不掉。签名里去掉 id/x/y 后两边才能对上。 */
    function normXmlText(txt) {
        if (!txt) return '';
        try {
            var d = new DOMParser().parseFromString(txt, 'text/xml');
            if (d.getElementsByTagName('parsererror').length) {
                return String(txt).replace(/\s+/g, ' ').trim();
            }
            var all = d.getElementsByTagName('*');
            for (var i = 0; i < all.length; i++) {
                all[i].removeAttribute('id');
                all[i].removeAttribute('x');
                all[i].removeAttribute('y');
            }
            return new XMLSerializer().serializeToString(d.documentElement);
        } catch (e) { return String(txt).replace(/\s+/g, ' ').trim(); }
    }
    function pinTypeOf(txt) {
        try {
            var d = new DOMParser().parseFromString(txt, 'text/xml');
            var b = d.getElementsByTagName('block')[0] || d.documentElement;
            return b ? (b.getAttribute('type') || '') : '';
        } catch (e) { return ''; }
    }
    /* 失效积木：type 没在 Blockly 注册表里，渲染出来就是默认的
       #FF0000 红色块。注册表就绪（>100 项）时才做这个判定。 */
    function pinIsValid(txt) {
        if (!txt || txt.indexOf('<block') < 0) return false;
        var s = SB(), type = pinTypeOf(txt);
        if (!type) return false;
        if (!s || !s.Blocks || Object.keys(s.Blocks).length < 100) return true;
        return !!s.Blocks[type];
    }
    function purgeInvalidPins() {
        var out = [], removed = 0;
        for (var i = 0; i < pins.length; i++) {
            if (pinIsValid(pins[i].xml)) out.push(pins[i]);
            else removed++;
        }
        if (removed) {
            pins = out;
            pinsSave();
            /* 不能在 inject 里同步再调 updateToolbox，会递归；延后一帧刷新 */
            window.setTimeout(function () { try { pinsApply(); } catch (e) {} }, 0);
        }
        return removed;
    }

    function blockLabel(b) {
        try {
            var t = '';
            var root = b.getSvgRoot && b.getSvgRoot();
            if (root && root.textContent) t = root.textContent.replace(/\s+/g, ' ').trim();
            if (!t) t = b.type || '';
            return t.slice(0, 26) || (b.type || '积木');
        } catch (e) { return (b && b.type) || '积木'; }
    }

    function blockXmlOf(b) {
        var s = SB();
        if (!s || !b) return null;
        try {
            var dom = s.Xml.blockToDom(b);
            var txt = s.Xml.domToText(dom);
            return (txt && txt.indexOf('<block') >= 0) ? normXmlText(txt) : null;
        } catch (e) { return null; }
    }

    function pinAdd(b) {
        var x = blockXmlOf(b);
        if (!x) return 0;
        for (var i = 0; i < pins.length; i++) if (pins[i].xml === x) return -1;
        pins.push({
            id: 'pin' + Date.now() + Math.floor(Math.random() * 997),
            xml: x, name: blockLabel(b)
        });
        pinsSave();
        pinsApply();
        return 1;
    }
    function pinHas(b) {
        var x = blockXmlOf(b);
        if (!x) return false;
        for (var i = 0; i < pins.length; i++) if (pins[i].xml === x) return true;
        return false;
    }
    function pinRemoveByXml(b) {
        var x = blockXmlOf(b);
        if (!x) return false;
        var i;
        for (i = 0; i < pins.length; i++) {
            if (pins[i].xml === x) { pins.splice(i, 1); pinsSave(); pinsApply(); return true; }
        }
        /* 兜底：旧版存档字段顺序 / 命名空间不一致时，按根积木类型 + 名称
           取消第一个匹配项，保证「重新打开后也能取消置顶」。 */
        var t = pinTypeOf(x), nm = blockLabel(b);
        if (t) {
            for (i = 0; i < pins.length; i++) {
                if (pinTypeOf(pins[i].xml) === t && (!nm || pins[i].name === nm)) {
                    pins.splice(i, 1); pinsSave(); pinsApply(); return true;
                }
            }
        }
        return false;
    }

    var PIN_ICON = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
        'stroke="#575E75" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/></svg>');

    /* 当前积木栏的完整 XML。
       新版 Blockly 的 Toolbox 只留 categoryMenu_，没有可回读的 XML 树；
       但 options.languageTree 会被 updateToolbox 一起换掉，
       序列化它就是此刻真正生效的那份分类表（含动态的变量 / 自制积木分类）。
       拿不到时退回 updateToolbox 拦截下来的底稿。 */
    function baseToolbox() {
        var w = ws();
        if (w && w.options && w.options.languageTree) {
            try {
                var s = new XMLSerializer().serializeToString(w.options.languageTree);
                if (s && s.indexOf('<xml') >= 0) return s;
            } catch (e) { /* ignore */ }
        }
        return lastToolbox;
    }

    /* 把「置顶」分类塞进积木栏，并固定排在全部分类的最顶上。
       三种输入都支持：XML 字符串、XML Document、Element —— 新版
       ScratchBlocks 的 updateToolbox 会直接传解析好的节点，只认字符串
       会把整条注入链漏掉。幂等：先摘掉所有同名 / 同 id 的旧分类。 */
    function pinsNormalize(root, doc) {
        if (!root) return false;
        try { if (root.getElementsByTagName('parsererror').length) return false; }
        catch (e0) { /* ignore */ }
        var olds = root.getElementsByTagName('category');
        for (var k = olds.length - 1; k >= 0; k--) {
            var nm = olds[k].getAttribute('name') || '';
            var id = olds[k].getAttribute('id') || '';
            /* 中英界面、旧存档、历史注入都可能留一份，按 name / id 一起清 */
            if (nm === '\u7f6e\u9876' || nm === 'Pinned' || id === 'blPinned') {
                if (olds[k].parentNode) olds[k].parentNode.removeChild(olds[k]);
            }
        }
        var cat = doc.createElement('category');
        cat.setAttribute('name', '\u7f6e\u9876');
        /* id 必须有：这一版分类行类名是 scratchCategoryId-<id>，缺了会变成
           scratchCategoryId-null，点上去切不过分类，表现就是「点了没反应」。 */
        cat.setAttribute('id', 'blPinned');
        /* 两个都要给：Blockly 的 Category.setColour 会对 secondaryColour
           调 .match()，缺了直接抛错、整块分类表挂掉 */
        cat.setAttribute('colour', '#FFAB19');
        cat.setAttribute('secondaryColour', '#CF8B17');
        cat.setAttribute('iconURI', PIN_ICON);
        if (!pins.length) {
            var lb = doc.createElement('label');
            lb.setAttribute('text', '\u6682\u65e0\u7f6e\u9876\u79ef\u6728');
            cat.appendChild(lb);
        } else {
            purgeInvalidPins();
            for (var i = 0; i < pins.length; i++) {
                var sub = new DOMParser().parseFromString(pins[i].xml, 'text/xml');
                if (sub && sub.documentElement && !sub.getElementsByTagName('parsererror').length) {
                    var node = doc.importNode(sub.documentElement, true);
                    node.setAttribute('data-bl-pin-id', pins[i].id || '');
                    cat.appendChild(node);
                }
            }
        }
        /* 第一个「元素」子节点之前：连 <sep>、顶层 <block>、空白文本
           都排在「置顶」后面。分类菜单严格按子元素顺序渲染，这就是显示顺序。 */
        root.insertBefore(cat, root.firstElementChild || root.firstChild);
        return true;
    }
    function pinsInject(xml) {
        try {
            if (typeof xml === 'string') {
                var doc = new DOMParser().parseFromString(xml, 'text/xml');
                if (!pinsNormalize(doc.documentElement, doc)) return xml;
                return new XMLSerializer().serializeToString(doc.documentElement);
            }
            if (xml && (xml.nodeType === 9 || xml.nodeType === 1)) {
                var d = (xml.nodeType === 9) ? xml : (xml.ownerDocument || xml);
                var r = (xml.nodeType === 9) ? xml.documentElement : xml;
                pinsNormalize(r, d);
                return xml;                 /* 保持入参类型，原生调用照常收 */
            }
            return xml;
        } catch (e) { return xml; }
    }

    function wrapToolbox() {
        var s = SB();
        if (!s || !s.WorkspaceSvg || !s.WorkspaceSvg.prototype.updateToolbox) return false;
        if (tbWrapped) return true;
        var raw = s.WorkspaceSvg.prototype.updateToolbox;
        s.WorkspaceSvg.prototype.updateToolbox = function (xml) {
            try {
                if (typeof xml === 'string') lastToolbox = xml;
                else if (xml && (xml.nodeType === 9 || xml.nodeType === 1)) {
                    try {
                        lastToolbox = new XMLSerializer().serializeToString(
                            xml.nodeType === 9 ? xml.documentElement : xml);
                    } catch (eL) { /* 底稿拿不到不影响注入 */ }
                }
                xml = pinsInject(xml);
            } catch (e0) { /* 注入失败也不阻断原生分类表 */ }
            return raw.call(this, xml);
        };
        tbWrapped = true;
        return true;
    }

    var pinsApplied = false;
    function pinsApply() {
        var w = ws();
        if (!w) return false;
        var base = baseToolbox();
        if (!base) return false;
        try { w.updateToolbox(pinsInject(base)); pinsApplied = true; return true; }
        catch (e) { return false; }
    }
    /* 只放一次：编辑器还没准备好时反复重铺分类表没有意义，
       之后靠 updateToolbox 拦截 + 置顶列表变化各补一次即可。 */
    var pinsAppliedWs = null;
    function pinsApplyOnce() {
        var w = ws();
        if (!w) return;
        /* 切作品 / 切语言会换 Blockly 实例，只认「曾经成功过」会把新
           工作区漏掉。按实例记，换了就重新铺一次。 */
        if (pinsApplied && pinsAppliedWs === w) return;
        if (pinsApply()) pinsAppliedWs = w;
    }

    /* ---------------------------------------------------------------- *
     * 「置顶」保序（DOM 层双保险）
     * ---------------------------------------------------------------- */
    /* 找到真正装分类行的菜单容器：向上最多 4 层，取「含 >=2 个分类行」
       的最近祖先。只认 parentNode 时，某些皮肤里会落进只包一行的
       wrapper，看不见别的分类，保序就形同虚设。 */
    /* 找到真正装整排分类的菜单容器：向上最多 4 层，取「含 >=2 个分类行」
       的最近祖先。分类行常被一层 wrapper 包住，只数直接子节点会落进
       只包一行的 wrapper，看不见别的分类，保序就形同虚设。 */
    function pinsBox(row) {
        var n = row.parentNode, i = 0;
        while (n && i++ < 4) {
            var c = 0;
            try {
                if (n.querySelectorAll) {
                    c = n.querySelectorAll('[class*="scratchCategoryId-"]').length;
                } else {
                    var kids = n.children || [];
                    for (var j = 0; j < kids.length; j++) {
                        var cn = kids[j].getAttribute ? (kids[j].getAttribute('class') || '') : '';
                        if (cn.indexOf('scratchCategoryId-') >= 0) c++;
                    }
                }
            } catch (eC) { /* ignore */ }
            if (c >= 2) return n;
            n = n.parentNode;
        }
        return row.parentNode;
    }
    var hoistScrolled = null, hoistOrdered = null;
    try {
        if (typeof WeakSet === 'function') {
            hoistScrolled = new WeakSet();
            hoistOrdered = new WeakSet();
        }
    } catch (eW) { /* ignore */ }

    /* 位置正确时零 DOM 写入 —— 判断本身就是短路，不会和分类栏更新打架。 */
    function pinsHoistDom() {
        try {
            var row = document.querySelector('[class*="scratchCategoryId-blPinned"]');
            if (!row || !row.parentNode) return;
            var box = pinsBox(row);
            /* 要移动的是「置顶」在容器下的顶层块（行本身或包它的 wrapper） */
            var top = row, hop = 0;
            while (top.parentNode && top.parentNode !== box && hop++ < 4) top = top.parentNode;
            if (top.parentNode !== box) return;
            var firstTop = null, kids = box.children, i, cn, k;
            for (i = 0; i < kids.length; i++) {
                k = kids[i];
                cn = k.getAttribute ? (k.getAttribute('class') || '') : '';
                if (cn.indexOf('scratchCategoryId-') >= 0) { firstTop = k; break; }
                try {
                    if (k.querySelectorAll && k.querySelectorAll('[class*="scratchCategoryId-"]').length) {
                        firstTop = k; break;
                    }
                } catch (eQ) { /* ignore */ }
            }
            if (firstTop && firstTop !== top) box.insertBefore(top, firstTop);
            /* flex / grid 容器里 CSS 若给分类行写过 order，视觉顺序会盖掉
               DOM 顺序；只写一次 inline，稳稳压到最前。 */
            if (hoistOrdered && !hoistOrdered.has(row)) {
                try {
                    var disp = window.getComputedStyle ?
                        (window.getComputedStyle(box).display || '') : '';
                    if (disp.indexOf('flex') >= 0 || disp.indexOf('grid') >= 0) {
                        row.style.order = '-9999';
                    }
                    hoistOrdered.add(row);
                } catch (eO) { /* ignore */ }
            }
            /* 分类栏可滚动时若停在中间，第一行看不见，看起来就像「没在最顶」。
               每个容器只归零一次，之后用户想滚到哪都行。 */
            if (hoistScrolled && !hoistScrolled.has(box)) {
                hoistScrolled.add(box);
                try {
                    var sc = box;
                    for (var q = 0; q < 2 && sc; q++, sc = sc.parentNode) {
                        if (sc.scrollTop > 0 && sc.scrollHeight > sc.clientHeight + 4) {
                            sc.scrollTop = 0; break;
                        }
                    }
                } catch (eS) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }
    }

    var hoistObs = null, hoistObserved = null;
    function pinsHoistWatch() {
        try {
            var row = document.querySelector('[class*="scratchCategoryId-blPinned"]');
            if (!row || !row.parentNode) return;
            var box = pinsBox(row);
            if (hoistObserved === box && box.isConnected !== false && hoistObs) {
                pinsHoistDom();
                return;
            }
            if (hoistObs) { try { hoistObs.disconnect(); } catch (e0) {} }
            hoistObserved = box;
            hoistObs = new MutationObserver(function () {
                if (!hoistObserved || hoistObserved.isConnected === false) {
                    hoistObserved = null;
                    try { pinsHoistWatch(); } catch (e1) {}
                    return;
                }
                pinsHoistDom();
            });
            /* 只观察分类菜单容器，不挂全文档；拖拽积木的变化在 workspace
               SVG 里，不会触发它。subtree 用于抓嵌套一层的分类行重排。 */
            try { hoistObs.observe(box, { childList: true, subtree: true }); }
            catch (e2) { hoistObs = null; }
            pinsHoistDom();
        } catch (e3) { /* ignore */ }
    }
    /* 接上同帧补挂总线：分类栏被 React 整体换掉后不再等 1s 轮询，
       也没有「4 分钟后停摆」的窗口。总线自带每帧合并 / 120ms 节流，
       这里全是短路查询，不会重演拖拽期的扫描风暴。 */
    if (window.__blSync && typeof window.__blSync.register === 'function') {
        try { window.__blSync.register('B38-pins-hoist', pinsHoistWatch); }
        catch (eR) { /* ignore */ }
    }

    /* ---------------------------------------------------------------- *
     * 积木图片导出（SVG / PNG / 复制）
     * ---------------------------------------------------------------- */

    var tmpHost = null, tmpWs = null;

    function stripIds(node) {
        try {
            if (node.nodeType === 1) node.removeAttribute('id');
            var kids = node.childNodes;
            for (var i = 0; i < kids.length; i++) stripIds(kids[i]);
        } catch (e) { /* ignore */ }
    }

    function tmpWorkspace() {
        var s = SB(), w0 = ws();
        if (!s || !w0) return null;
        if (tmpWs) return tmpWs;
        try {
            var host = document.createElement('div');
            host.setAttribute('aria-hidden', 'true');
            host.style.cssText = 'position:fixed;left:-6000px;top:0;width:900px;height:700px;' +
                'opacity:0;pointer-events:none;overflow:hidden;z-index:1;';
            document.body.appendChild(host);
            var o = {};
            var src = w0.options || {};
            for (var k in src) {
                if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
                if (k === 'parentWorkspace') continue;
                var v = src[k];
                if (v && v.nodeType) continue;
                if (typeof v === 'function') continue;
                o[k] = v;
            }
            var w = new s.WorkspaceSvg(o);
            var g = w.createDom();
            var NS = 'http://www.w3.org/2000/svg';
            var svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.appendChild(g);
            host.appendChild(svg);
            tmpHost = host;
            tmpWs = w;
            return w;
        } catch (e) { return null; }
    }

    /* 单独取 Blockly 的 <g> 拼不出完整图：文字样式在 CSS 里，
       滤镜 / 渐变在 <defs> 里。所以把积木搬进一个离屏工作区，
       用它的整张 SVG 再按积木包围盒裁 viewBox —— 拿到的一定是完整可渲染的图。 */
    function blockSvg(block, opts) {
        var s = SB();
        if (!s || !block) return null;
        var w = tmpWorkspace();
        if (!w) return null;
        try {
            /* ⚠ Xml.blockToDom 只往"下"序列化：当前块 + next 链 + 各 input
               里的子块。右键点在「重复执行」上时，上面的「当绿旗被点击」
               根本不在 dom 里，导出的图就缺了帽子那一截。
               先 getRootBlock() 回到这条脚本最顶上那块，整组（包括 C 形
               积木内部包着的子积木）就一次性全进图。
               单块没有相连积木时 root 就是自己，行为与旧版完全一致。 */
            var src = block;
            var whole = !(opts && opts.single === true);
            if (whole) {
                try {
                    var rt = block.getRootBlock && block.getRootBlock();
                    if (rt && rt !== block && rt.getSvgRoot && rt.getSvgRoot()) src = rt;
                } catch (eRoot) { /* ignore */ }
            }
            var dom = s.Xml.blockToDom(src);
            stripIds(dom);
            /* 数真积木（<block>），不含 <shadow> 数值块，用于文件名与提示 */
            var blockCount = 1;
            try {
                var domText = new XMLSerializer().serializeToString(dom);
                var mm = domText.match(/<block(?=[\s>])/g);
                if (mm && mm.length) blockCount = mm.length;
            } catch (eCnt) { /* ignore */ }
            var cont = document.createElement('xml');
            cont.appendChild(dom);
            w.clear();
            s.Xml.domToWorkspace(cont, w);
            var tops = w.getTopBlocks();
            var b = tops && tops.length ? tops[0] : null;
            if (!b) return null;
            var root = b.getSvgRoot();
            if (!root) return null;
            var bb = null;
            try { bb = root.getBBox(); } catch (e) { bb = null; }
            if (!bb || !bb.width || !bb.height) return null;
            var parent = w.getParentSvg();
            if (!parent) return null;
            var clone = parent.cloneNode(true);
            /* ⚠ 按位置再筛一遍（必须放在按类名摘除之前）。
               按类名摘除只能挡住已知的那几个零件，不同版本类名未必一致；
               而且摘除会改变 clone 的子节点数量，之后再按索引比对就会错位。
               所以先在这里、clone 与 parent 子节点还一一对应时，
               把落在积木包围盒之外的顶层元素整块删掉 —— 导出图里只剩积木本体。 */
            try {
                var PAD = 60;
                var sks = [], dks = [], qi;
                for (qi = 0; qi < parent.childNodes.length; qi++) {
                    if (parent.childNodes[qi].nodeType === 1) sks.push(parent.childNodes[qi]);
                }
                for (qi = 0; qi < clone.childNodes.length; qi++) {
                    if (clone.childNodes[qi].nodeType === 1) dks.push(clone.childNodes[qi]);
                }
                for (qi = 0; qi < sks.length && qi < dks.length; qi++) {
                    var sb = null;
                    try { sb = sks[qi].getBBox ? sks[qi].getBBox() : null; } catch (e9) { sb = null; }
                    if (!sb || (!sb.width && !sb.height)) continue;   /* 量不到就先留着 */
                    var away = (sb.x + sb.width < bb.x - PAD) ||
                               (sb.x > bb.x + bb.width + PAD) ||
                               (sb.y + sb.height < bb.y - PAD) ||
                               (sb.y > bb.y + bb.height + PAD);
                    if (away && dks[qi].parentNode) {
                        dks[qi].parentNode.removeChild(dks[qi]);
                    }
                }
            } catch (e10) { /* ignore */ }
            /* 去掉整块背景，导出透明底的图 */
            try {
                var bgs = clone.querySelectorAll('rect, image');
                for (var i = 0; i < bgs.length; i++) {
                    var cl = bgs[i].getAttribute('class') || '';
                    if (cl.indexOf('ackground') >= 0 || cl.indexOf('grid') >= 0) {
                        if (bgs[i].parentNode) bgs[i].parentNode.removeChild(bgs[i]);
                    }
                }
            } catch (e2) { /* ignore */ }
            /* ⚠ 工作区整张 SVG 里还挂着界面零件，不是积木的一部分：
                 .blocklyZoom   —— 缩放控件的三个放大镜图标（放大/缩小/复位）
                 .blocklyTrashcan / .blocklyFlyout / .blocklyBubbleCanvas / .blocklyScrollbar

               它们平时在视图外（y 比积木低），所以小积木导出看不出来；
               一旦导出的是高积木（C 形积木带内部脚本），viewBox 变高，
               这几个放大镜就落进画面里 —— 也就是"复制出来多两个放大镜"。
               这里按类名整组摘掉，导出图里只剩积木本体。 */
            try {
                var junks = clone.querySelectorAll(
                    '[class*=blocklyZoom],[class*=blocklyTrashcan],[class*=blocklyFlyout],' +
                    '[class*=blocklyBubbleCanvas],[class*=blocklyScrollbar]');
                for (var j = 0; j < junks.length; j++) {
                    if (junks[j].parentNode) junks[j].parentNode.removeChild(junks[j]);
                }
            } catch (e4) { /* ignore */ }
            var pad = 10;
            var vx = Math.round(bb.x - pad), vy = Math.round(bb.y - pad);
            var vw = Math.ceil(bb.width + pad * 2), vh = Math.ceil(bb.height + pad * 2);
            var NS = 'http://www.w3.org/2000/svg';
            clone.setAttribute('xmlns', NS);
            clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
            clone.setAttribute('viewBox', vx + ' ' + vy + ' ' + vw + ' ' + vh);
            clone.setAttribute('width', String(vw));
            clone.setAttribute('height', String(vh));
            var st = document.createElementNS(NS, 'style');
            st.textContent =
                '.blocklyText,.blocks-Text{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;' +
                'font-size:12pt;font-weight:500;fill:#fff;}' +
                'text{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;}' +
                /* 数值输入框是白底，文字必须保持深色。旧样式把 .blocklyText
                   一律刷成白色，导出的「重复执行 10 次 / 移动 10 步」里
                   数字就变成白底白字，看起来像空框。 */
                '.blocklyEditableText > .blocklyText{fill:#575e75 !important;}';
            clone.insertBefore(st, clone.firstChild);
            var txt = new XMLSerializer().serializeToString(clone);
            w.clear();
            return {
                text: txt, w: vw, h: vh,
                name: (src.type || 'block'),
                count: blockCount,
                whole: whole
            };
        } catch (e3) { return null; }
    }

    function download(name, url) {
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        window.setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 400);
    }

    function svgToPng(svgText, w, h, cb) {
        var img = new Image();
        img.onload = function () {
            try {
                var scale = 2;
                var cv = document.createElement('canvas');
                cv.width = Math.max(1, w * scale);
                cv.height = Math.max(1, h * scale);
                var cx = cv.getContext('2d');
                cx.scale(scale, scale);
                cx.drawImage(img, 0, 0, w, h);
                if (cv.toBlob) cv.toBlob(function (b) { cb(b); }, 'image/png');
                else cb(null);
            } catch (e) { cb(null); }
        };
        img.onerror = function () { cb(null); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    }

    function copyImage(blob, count) {
        var suffix = (count && count > 1) ? '（整组 ' + count + ' 块）' : '';
        var done = function () { toast('积木图片已复制到剪贴板' + suffix); };
        var fail = function () { toast('复制失败，可改用「下载积木 PNG」'); };
        try {
            if (blob && navigator.clipboard && window.ClipboardItem) {
                navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
                    .then(done, fail);
                return;
            }
        } catch (e) { /* ignore */ }
        fail();
    }

    /* ---------------------------------------------------------------- *
     * 积木右键菜单
     * ---------------------------------------------------------------- */

    /* 对外暴露，方便验证与二次开发：
         __blBlockExport.blockSvg(block, {single:true}) 可只导单块 */
    try {
        window.__blBlockExport = {
            blockSvg: blockSvg,
            svgToPng: svgToPng,
            copyImage: copyImage,
            download: download
        };
    } catch (eExport) { /* ignore */ }

    function mi(text, cb) { return { text: text, enabled: true, callback: cb }; }

    /* 从右键事件的 DOM 目标反查积木。
       ContextMenu.currentBlock 是在 show() 内部才赋值的，而这里包住的就是
       show 本身 —— 进来时它必然还是空的，只能自己从事件目标往上找 data-id。 */
    function blockFromEvent(e) {
        var n = e && (e.target || e.srcElement);
        var w = ws();
        if (!n || !w) return null;
        var all = [], hop = 0;
        while (n && hop++ < 14) {
            if (n.getAttribute) {
                var id = n.getAttribute('data-id');
                if (id) {
                    try {
                        var b = w.getBlockById(id);
                        if (b) all.push(b);
                    } catch (err) { /* ignore */ }
                }
            }
            n = n.parentNode;
        }
        if (!all.length) return null;
        /* 命中的往往是最内层的影子块（比如「移动__步」里的 10），
           影子块不能置顶，所以往上找到最外层那块真积木。 */
        var real = [];
        for (var i = 0; i < all.length; i++) {
            if (!(all[i].isShadow && all[i].isShadow())) real.push(all[i]);
        }
        return real.length ? real[real.length - 1] : null;
    }

    function wrapCtxMenu() {
        var s = SB();
        if (!s || !s.ContextMenu || typeof s.ContextMenu.show !== 'function') return false;
        if (s.ContextMenu.__blWrapped) return true;
        var raw = s.ContextMenu.show;
        s.ContextMenu.show = function (e, opts, rtl) {
            try {
                var blk = s.ContextMenu.currentBlock || blockFromEvent(e);
                if (blk && opts && typeof opts.push === 'function') {
                    var self = blk;
                    opts.push({ separator: true });
                    if (pinHas(self)) {
                        opts.push(mi('不再置顶', function () {
                            if (pinRemoveByXml(self)) toast('已取消置顶');
                        }));
                    } else {
                        opts.push(mi('置顶', function () {
                            var r = pinAdd(self);
                            toast(r === 1 ? '已加入「置顶」分类' : (r === -1 ? '这块积木已经置顶过了' : '置顶失败'));
                        }));
                    }
                    opts.push(mi('下载积木 SVG', function () {
                        window.setTimeout(function () {
                            var d = blockSvg(self);
                            if (!d) { toast('导出失败'); return; }
                            download('blocks-' + d.name + '-' + d.count + '.svg',
                                'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(d.text));
                            toast('已下载整组积木 SVG（' + d.count + ' 块，' + d.w + '×' + d.h + '）');
                        }, 0);
                    }));
                    opts.push(mi('下载积木 PNG', function () {
                        window.setTimeout(function () {
                            var d = blockSvg(self);
                            if (!d) { toast('导出失败'); return; }
                            svgToPng(d.text, d.w, d.h, function (b) {
                                if (!b) { toast('PNG 生成失败'); return; }
                                var url = URL.createObjectURL(b);
                                download('blocks-' + d.name + '-' + d.count + '.png', url);
                                window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
                                toast('已下载整组积木 PNG（' + d.count + ' 块，' + d.w + '×' + d.h + '）');
                            });
                        }, 0);
                    }));
                    opts.push(mi('复制积木图片', function () {
                        window.setTimeout(function () {
                            var d = blockSvg(self);
                            if (!d) { toast('导出失败'); return; }
                            svgToPng(d.text, d.w, d.h, function (b) { copyImage(b, d.count); });
                        }, 0);
                    }));
                }
            } catch (err) { /* ignore */ }
            return raw.call(this, e, opts, rtl);
        };
        s.ContextMenu.__blWrapped = true;
        return true;
    }

    /* ---------------------------------------------------------------- *
     * 教程
     * ---------------------------------------------------------------- */

    var TUT = [
        {
            t: '欢迎来到 StartEditor',
            c: '跟着这份简短的导览，认识几个能明显提效的功能。走完随时可以关掉。',
            demo: null
        },
        {
            t: '置顶',
            c: '在积木上点右键 →「置顶」，这块积木就会进积木栏的「置顶」分类，' +
               '以后从分类里直接拖出来用，不用再翻。',
            demo: function () { pinsApply(); toast('已刷新「置顶」分类'); }
        },
        {
            t: '积木右键菜单',
            c: '积木上点右键，除了置顶，还能把整条相连的积木组导出成 SVG / PNG 图片，' +
               '或直接复制到剪贴板，方便放进文档或分享给别人。',
            demo: null
        },
        {
            t: '八音盒',
            c: 'DOCK 栏里的「唱片机」可以导入音乐、调混响和音量，' +
               '唱片会跟着转，底部有随音乐起伏的光谱。',
            demo: function () { try { if (window.__blVinyl) window.__blVinyl.open(); } catch (e) { /* ignore */ } }
        },
        {
            t: '音乐制作',
            c: '左侧标签栏的「音乐」是一个多轨编辑器：可以生成编曲、改乐器、' +
               '在钢琴卷帘里写音符，导出 MIDI 或直接放进角色里。',
            demo: function () { try { if (window.__blMusic) window.__blMusic.show(true); } catch (e) { /* ignore */ } }
        },
        {
            t: 'STAR 助手',
            c: 'DOCK 栏里的 STAR 能直接操纵编辑器：拖积木、搭作品、加角色、' +
               '加载拓展、打开造型器。关掉「观察过程」它就转到后台干，不打扰你。',
            demo: function () { try { if (window.__blStar) window.__blStar.open(); } catch (e) { /* ignore */ } }
        },
        {
            t: '开始吧',
            c: '就这样，剩下的自己摸索。随时可以从 DOCK 栏的「教程」再打开这份导览。',
            demo: null
        }
    ];

    var tutWin = null, tutIdx = 0;

    function tutRender() {
        if (!tutWin) return;
        var s = TUT[tutIdx];
        var body = tutWin.querySelector('.addon-window-content');
        if (!body) return;
        var dots = '';
        for (var i = 0; i < TUT.length; i++) {
            dots += '<i class="bl-tut-dot' + (i === tutIdx ? ' is-on' : '') + '"></i>';
        }
        body.innerHTML =
            '<div class="bl-tut-ico">' +
            '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"' +
            ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M12 3l2.2 5.6 6 .4-4.7 3.8 1.6 5.8L12 15.7l-5.1 2.9 1.6-5.8L3.8 9l6-.4z"/>' +
            '</svg></div>' +
            '<div class="bl-tut-title">' + esc(s.t) + '</div>' +
            '<div class="bl-tut-text">' + esc(s.c) + '</div>' +
            '<div class="bl-tut-dots">' + dots + '</div>' +
            '<div class="bl-tut-foot">' +
            '<button type="button" class="bl-tut-btn" data-t="skip">跳过教程</button>' +
            '<span class="bl-tut-gap"></span>' +
            '<span class="bl-tut-step">' + (tutIdx + 1) + ' / ' + TUT.length + '</span>' +
            '<button type="button" class="bl-tut-btn is-primary" data-t="next">' +
            (tutIdx === TUT.length - 1 ? '完成' : '下一步 →') + '</button>' +
            '</div>';
        if (s.demo) {
            window.setTimeout(function () { try { s.demo(); } catch (e) { /* ignore */ } }, 260);
        }
    }

    function tutOpen() {
        if (tutWin && tutWin.parentNode) { front(); return; }
        tutIdx = 0;
        var w = winShell('bl-tut', 'StartEditor 教程', false);
        bindChrome(w, function () {
            if (w.parentNode) w.parentNode.removeChild(w);
            if (tutWin === w) tutWin = null;
            try { window.localStorage.setItem(TUT_KEY, '1'); } catch (e) { /* ignore */ }
        });
        w.addEventListener('click', function (e) {
            var b = e.target && e.target.closest ? e.target.closest('[data-t]') : null;
            if (!b) return;
            var t = b.getAttribute('data-t');
            if (t === 'next') {
                if (tutIdx >= TUT.length - 1) {
                    popOut(w, function () {
                        if (w.parentNode) w.parentNode.removeChild(w);
                        tutWin = null;
                        try { window.localStorage.setItem(TUT_KEY, '1'); } catch (e2) { /* ignore */ }
                    });
                    return;
                }
                tutIdx++;
                tutRender();
            } else if (t === 'skip') {
                popOut(w, function () {
                    if (w.parentNode) w.parentNode.removeChild(w);
                    tutWin = null;
                    try { window.localStorage.setItem(TUT_KEY, '1'); } catch (e3) { /* ignore */ }
                });
            }
        });
        try { topHost().appendChild(w); } catch (e) { document.body.appendChild(w); }
        centerWin(w, 430, 330);
        w.style.maxWidth = '94vw';
        tutWin = w;
        tutRender();
        popIn(w);
        front();
    }

    /* ---------------------------------------------------------------- *
     * 启动
     * ---------------------------------------------------------------- */

    var readyTries = 0;
    function bootTick() {
        var s = SB();
        if (s) {
            wrapToolbox();
            wrapCtxMenu();
        }
        if (ws()) {
            pinsApplyOnce();
        }
        pinsHoistWatch();      /* 「置顶」被运行时重排也能回到最顶 */
        readyTries++;
        /* 保序心跳不设过期：分类栏可能在运行几十分钟后才被 React 换掉，
           停摆后就没有兜底了。前 4 分钟 1s，之后降到 2s，成本只是一次短路查询。 */
        window.setTimeout(bootTick, readyTries > 240 ? 2000 : 1000);
    }

    /* ScratchBlocks 一被赋值就立刻包住 updateToolbox。
       轮询来不及：编辑器挂载时会立刻下发一次分类 XML，
       晚一步就记不到底稿，「置顶」分类就永远加不进去。 */
    function hookSB() {
        try {
            var val = window.ScratchBlocks;
            Object.defineProperty(window, 'ScratchBlocks', {
                configurable: true,
                get: function () { return val; },
                set: function (v) {
                    val = v;
                    try { wrapToolbox(); wrapCtxMenu(); } catch (e) { /* ignore */ }
                }
            });
        } catch (e) { /* ignore */ }
    }

    try {
        window.__blPins = {
            list: function () { return pins.slice(); },
            norm: normXmlText,
            has: pinHas,
            add: pinAdd,
            remove: pinRemoveByXml,
            purge: purgeInvalidPins,
            hoist: pinsHoistDom
        };
    } catch (ePins) { /* ignore */ }

    function boot() {
        pinsLoad();
        hookSB();
        wrapToolbox();
        wrapCtxMenu();
        bootTick();
        /* 第一次打开自动走一遍导览；看完写标记，之后只在 DOCK 点「教程」才出现。 */
        var done = false;
        try { done = window.localStorage.getItem(TUT_KEY) === '1'; } catch (e) { done = false; }
        if (!done) {
            var tries2 = 0;
            var t2 = window.setInterval(function () {
                tries2++;
                if (ws() || tries2 > 12) {
                    window.clearInterval(t2);
                    window.setTimeout(function () { try { tutOpen(); } catch (e2) { /* ignore */ } }, 900);
                }
            }, 1000);
        }
    }

    window.__blStudio = {
        openTutorial: tutOpen,
        pins: function () { return pins; },
        pinAdd: pinAdd,
        pinsApply: pinsApply,
        blockSvg: blockSvg,
        toolboxCaptured: function () { return !!lastToolbox; },
        version: '1.0.5 SEA'
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();

