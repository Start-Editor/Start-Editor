/* ── [B33] DOCK 栏 ───────────────────────────────────────────────
   依赖：B41 / B48
   维护：图标、玻璃层、右键菜单、隐藏时迁移到左侧栏
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
   DOCK 栏 —— StartEditor
   --------------------------------------------------------------------------
   两件事：

   1) 积木区右下角的毛玻璃 DOCK，带鱼眼放大
      · 按指针到各图标【基准中心】的距离算缩放，正下方最大，
        邻居随之放大、越远越小，形成水面波纹般连续的凸起弧度
      · 放大后按缩放步长重新排布，邻居是被"挤开"的，不是被盖住
      · transform-origin: bottom center —— 以底部为基准向上生长，
        视觉稳定；放大后的命中面积同步变大（符合费茨定律）
      · rAF 逐帧向目标插值，不是事件驱动的瞬间跳变
      · 悬浮名称跟着图标一起动（横向同步位移、纵向同步上浮、轻微放大）

   2) 最小化托盘
      · 窗口点最小化后收进 DOCK：节点保留、只是不显示，位置尺寸先记下来
      · DOCK 里多出一个图标，点它就从最小化前的原位置原样弹回来
      · 这样"最小化"才真的把窗口收走，而不是在屏幕上留一截

   素材海洋与素材背包已从编辑器移除，DOCK 里只留唱片机入口与最小化托盘。
   ========================================================================== */
(function () {
    'use strict';

    var dockEl = null, dockItems = [], dockCur = [], dockTgt = [], dockRaf = 0;
    /* 每个图标的基准中心（相对 .bl-dock 左缘，不含 transform）。
       悬浮名称要"跟着图标弹"，就必须以它为原点再加当前动画位移，
       直接用 getBoundingClientRect 会把缩放后的尺寸也算进去，越算越大。 */
    var dockBaseC = [], dockTipIdx = -1;
    var trayEntries = [];          /* 最小化后收进 DOCK 的窗口 */
    var DOCK_R = 108;        /* 影响半径（px） */
    var DOCK_MAX = 1.9;      /* 指针正下方的最大缩放 */
    var DOCK_LERP = 0.28;    /* 每帧向目标靠近的比例，越小越柔 */
    var dockTipEl = null;

    /* 固定入口。素材海洋 / 素材背包已删除，这里只留唱片机与 STAR。
       两者本体分别在 vinyl.js / star.js 里，模块互相独立，任一出错不影响其它。 */
    var DOCK_BTNS = [
        {
            act: 'vinyl', label: '八音盒',
            svg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/>' +
                 '<path d="M12 3a9 9 0 0 1 8.5 6"/>'
        },
        {
            act: 'star', label: 'STAR',
            svg: '<circle cx="12" cy="12" r="9"/>' +
                 '<path d="M12 4.2l2 4.9 5.3.3-4.1 3.4 1.4 5.1L12 14.9l-4.6 3 1.4-5.1-4.1-3.4 5.3-.3z"/>'
        },
        {
            act: 'toolbox', label: '工具箱',
            svg: '<path d="M4 7h16M4 12h16M4 17h10"/>' +
                 '<circle cx="18" cy="17" r="2"/>'
        }
    ];

    function dockIcon(svg) {
        return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"' +
            ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + svg + '</svg>';
    }

    var TRAY_SVG = '<rect x="3" y="5" width="18" height="14" rx="2"/>' +
                   '<path d="M3 10h18"/><path d="M7 14h6"/>';

    /* ---------------- 最小化托盘 ----------------
       点最小化后窗口不再缩成标题条，而是收进 DOCK：
       · 窗口本身隐藏（不删除、不销毁），位置尺寸记下来
       · DOCK 里多出一个图标，点它就从原位置弹回来
       这样"最小化"才真的把窗口收走，而不是在屏幕上留一截。 */

    function dockTrayBtn(id) {
        if (!dockEl) return null;
        return dockEl.querySelector('.bl-dock-item[data-tray="' + id + '"]');
    }

    /* 图标数量会变，鱼眼的基准量必须整表重建 ——
       否则新图标读不到 offsetLeft/offsetWidth，缩放与位移全乱。 */
    function dockReindex() {
        if (!dockEl) return;
        dockItems = [].slice.call(dockEl.querySelectorAll('.bl-dock-item'));
        dockCur = []; dockTgt = []; dockBaseC = [];
        for (var i = 0; i < dockItems.length; i++) {
            dockCur.push({ s: 1, dx: 0 });
            dockTgt.push({ s: 1, dx: 0 });
            dockBaseC.push(0);
        }
        dockTipIdx = -1;
        dockSetTargets(null);
        dockPaint();
    }

    function dockTrayAdd(o) {
        if (!o || !o.id) return false;
        if (!dockEl && !buildDock()) return false;
        /* STAR 主窗口收进 DOCK 时复用它自己的固定按钮 ——
           否则屏幕上会出现两个 STAR 图标，一个是入口、一个是窗口，
           点哪个都能还原，但看着像多出来一个按钮。 */
        if (o.id === 'star' || o.id === 'tb-toolbox') {
            var key = o.id === 'star' ? 'star' : 'toolbox';
            var fx = dockEl.querySelector('.bl-dock-item[data-dock="' + key + '"]');
            if (fx) {
                fx.setAttribute('data-tray', o.id);
                fx.classList.add('is-docked');
                syncTrayEntry(o);
                return true;
            }
        }
        if (dockTrayBtn(o.id)) { syncTrayEntry(o); return true; }
        var inner = dockEl.querySelector('.bl-dock-inner');
        if (!inner) return false;
        if (!dockEl.querySelector('.bl-dock-sep')) {
            var sep = document.createElement('span');
            sep.className = 'bl-dock-sep';
            inner.appendChild(sep);
        }
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'bl-dock-item bl-dock-tray';
        b.setAttribute('data-dock', 'tray');
        b.setAttribute('data-tray', o.id);
        b.setAttribute('data-label', o.label || '窗口');
        b.setAttribute('aria-label', o.label || '窗口');
        b.innerHTML = dockIcon(o.svg || TRAY_SVG) + '<span class="bl-dock-badge"></span>';
        inner.appendChild(b);
        trayEntries.push(o);
        dockReindex();
        return true;
    }

    function syncTrayEntry(o) {
        for (var i = 0; i < trayEntries.length; i++) {
            if (trayEntries[i].id === o.id) { trayEntries[i] = o; return; }
        }
        trayEntries.push(o);
    }

    function dockTrayRemove(id) {
        /* STAR 主窗口收起时挂的是固定按钮本身，这里只摘标记，
           绝不能走下面的 removeChild —— 那会把 DOCK 的入口按钮一起删掉。 */
        if ((id === 'star' || id === 'tb-toolbox') && dockEl) {
            var key = id === 'star' ? 'star' : 'toolbox';
            var fx = dockEl.querySelector('.bl-dock-item[data-dock="' + key + '"]');
            if (fx) {
                fx.removeAttribute('data-tray');
                fx.classList.remove('is-docked');
            }
        }
        var el = dockTrayBtn(id);
        if (el && el.parentNode) el.parentNode.removeChild(el);
        var rest = [];
        for (var i = 0; i < trayEntries.length; i++) {
            if (trayEntries[i].id !== id) rest.push(trayEntries[i]);
        }
        trayEntries = rest;
        if (dockEl && !trayEntries.length) {
            var sep = dockEl.querySelector('.bl-dock-sep');
            if (sep && sep.parentNode) sep.parentNode.removeChild(sep);
        }
        dockReindex();
    }

    function dockTrayRestore(id) {
        for (var i = 0; i < trayEntries.length; i++) {
            if (trayEntries[i].id === id) {
                try { trayEntries[i].onRestore(); } catch (e) { /* ignore */ }
                return true;
            }
        }
        return false;
    }

    /* 其它模块（inject.js / us.js）通过它把窗口收进 DOCK */
    window.__blDockTray = {
        add: dockTrayAdd,
        remove: dockTrayRemove,
        has: function (id) { return !!dockTrayBtn(id); },
        restore: dockTrayRestore
    };

    /* ---------------- DOCK 最高层宿主 ----------------
       DOCK 不再挂在 .gui_blocks-wrapper 里，否则被夹在积木区的祖先链中，
       z-index 再高也压不过 body 下的弹窗。宿主是 body 直属 fixed 层，
       尺寸同步成积木区 rect，DOCK 的相对定位视觉位置一格不变。          */
    var DOCK_Z = 2147483646;
    var dockHostEl = null, dockAnchorEl = null, dockHostRO = null;
    var dockHostKey = '';

    /* 积木区 rect 是否真的可用。
       ⚠ 只看 >40px 是不够的：启动期 / React 重绘瞬间常读到 0 尺寸或几十
       像素的残影，把它写进宿主，DOCK 的 bottom/right 就会相对那一小条区域
       定位 —— 图标跑到舞台顶部、玻璃条被裁，就是这么来的。
       另外播放器 / 舞台全屏模式下 blocks-wrapper 可能 display:none 但仍在
       DOM 里，getBoundingClientRect 会给出一个过时的有效值，必须挡掉。 */
    function dockAnchorRect(anchor) {
        if (!anchor || !anchor.getBoundingClientRect) return null;
        try {
            var cs = window.getComputedStyle ? window.getComputedStyle(anchor) : null;
            if (cs && (cs.display === 'none' || cs.visibility === 'hidden' ||
                       (parseFloat(cs.opacity) || 0) < 0.05)) return null;
            if (anchor.getClientRects && anchor.getClientRects().length === 0) return null;
            var r = anchor.getBoundingClientRect();
            if (!r || !(r.width > 120 && r.height > 100)) return null;
            var vw = window.innerWidth || 0, vh = window.innerHeight || 0;
            if (r.right < 8 || r.bottom < 8 || r.left > vw - 8 || r.top > vh - 8) return null;
            if (r.width > vw * 3 || r.height > vh * 3) return null;
            return { left: r.left, top: r.top, width: r.width, height: r.height };
        } catch (e) { return null; }   /* 积木区被 React 换掉的瞬间 */
    }

    function syncDockHost(anchor) {
        if (!dockHostEl) return;
        var rect = dockAnchorRect(anchor);
        var ok = !!rect;
        /* 状态位也进 key：有效→无效 / 无效→有效 都必须写一次，
           否则会残留上一次的错误 inline 尺寸，永远自愈不了。 */
        var key = ok
            ? '1|' + Math.round(rect.left) + ',' + Math.round(rect.top) + ',' +
                     Math.round(rect.width) + ',' + Math.round(rect.height)
            : '0|';
        if (key === dockHostKey) return;      /* 状态与尺寸都没变就不写 */
        dockHostKey = key;
        var st = dockHostEl.style;
        if (ok) {
            st.left = rect.left + 'px';
            st.top = rect.top + 'px';
            st.width = rect.width + 'px';
            st.height = rect.height + 'px';
            if (dockHostEl.getAttribute('data-bl-rect-ok') !== '1')
                dockHostEl.setAttribute('data-bl-rect-ok', '1');
        } else {
            /* 绝不硬写整屏像素值：清掉 inline，交给 CSS
               .bl-dock-host:not([data-bl-rect-ok]) 的 100vw/100vh 兜底。
               这样即使曾经写错过，下一轮巡检也能自动回到正确位置。 */
            st.left = ''; st.top = ''; st.width = ''; st.height = '';
            dockHostEl.removeAttribute('data-bl-rect-ok');
        }
        /* 兜底：宿主万一被别的样式降级，这里再抬回来 */
        if (st.zIndex !== String(DOCK_Z)) st.zIndex = String(DOCK_Z);
    }

    function currentDockAnchor() {
        var a = document.querySelector('[class*="gui_blocks-wrapper"]');
        if (a && a !== dockAnchorEl) {
            dockAnchorEl = a;
            if (dockHostRO) { try { dockHostRO.disconnect(); } catch (e0) {} dockHostRO = null; }
            if (window.ResizeObserver) {
                try {
                    dockHostRO = new window.ResizeObserver(function () {
                        /* 重绘后旧 anchor 可能已被摘除且 display:none，
                           统一走可见性校验，避免把残影 rect 写回宿主 */
                        syncDockHost(currentDockAnchor());
                    });
                    dockHostRO.observe(a);
                } catch (e1) { dockHostRO = null; }
            }
        }
        return a;
    }

    function installDockHostSync() {
        window.addEventListener('resize', function () {
            syncDockHost(currentDockAnchor());
        });
        /* React 可能整体换掉 blocks-wrapper；低频巡检只做一次身份比对 + 尺寸比对，
           尺寸不变时一个 style 都不写，几乎零开销。 */
        window.setInterval(function () {
            if (!dockHostEl) return;
            if (dockHostEl.parentNode !== document.body) {
                document.body.appendChild(dockHostEl);
                dockHostKey = '';
            }
            syncDockHost(currentDockAnchor());
        }, 700);
    }

    /* 统一置顶管理器每次抬完窗口后调用：与 CRIT_Z(2147483646) 同值时，
       靠「body 末尾」保证 DOCK 仍在所有关键弹窗之上；右键菜单同理。 */
    function keepDockTop() {
        if (dockHostEl && dockHostEl.parentNode === document.body &&
            dockHostEl.nextElementSibling) {
            document.body.appendChild(dockHostEl);
        }
        /* typeof 保险：菜单变量由同一 IIFE 稍后声明，若将来拆分作用域也不会抛错 */
        if (typeof dockMenuEl !== 'undefined' && dockMenuEl &&
            dockMenuEl.parentNode === document.body &&
            dockMenuEl.nextElementSibling) {
            document.body.appendChild(dockMenuEl);
        }
    }
    try { window.__blDockTop = keepDockTop; } catch (e2) { /* ignore */ }

    var dockHostSyncInstalled = false;

    function buildDock() {
        var anchor = document.querySelector('[class*="gui_blocks-wrapper"]');
        if (!anchor) return false;
        if (dockEl && dockEl.parentNode) return true;

        var host = document.querySelector('.bl-dock-host');
        if (!host) {
            host = document.createElement('div');
            host.className = 'bl-dock-host';
            document.body.appendChild(host);
        } else if (host.parentNode !== document.body) {
            document.body.appendChild(host);
        }
        dockHostEl = host;
        dockAnchorEl = null;   /* 交给 currentDockAnchor 首次绑定 ResizeObserver */

        dockEl = document.createElement('div');
        dockEl.className = 'bl-dock';
        /* 液态玻璃 / 可读性守卫一律跳过 DOCK 容器本身 */
        dockEl.setAttribute('data-bl-lg-skip', '1');
        dockEl.setAttribute('data-bl-fc-skip', '1');
        dockEl.innerHTML =
            '<div class="bl-dock-zone" data-bl-lg-skip="1" data-bl-fc-skip="1">' +
            '<div class="bl-dock-inner" data-bl-lg-skip="1" data-bl-fc-skip="1">' +
            (function () {
                var h = '', i;
                for (i = 0; i < DOCK_BTNS.length; i++) {
                    /* data-label 必须写：悬浮名称读的就是它，
                       只读 aria-label 的话固定按钮会一直显示空名字。 */
                    h += '<button type="button" class="bl-dock-item" data-dock="' + DOCK_BTNS[i].act + '"' +
                        ' data-label="' + DOCK_BTNS[i].label + '"' +
                        ' aria-label="' + DOCK_BTNS[i].label + '">' + dockIcon(DOCK_BTNS[i].svg) +
                        '<span class="bl-dock-badge"></span></button>';
                }
                return h;
            })() +
            '</div></div>' +
            /* 双 skip：① 液态玻璃不许把它当玻璃载体改底色；
                        ② 可读性守卫不许自动改它的字色。 */
            '<div class="bl-dock-tip" data-bl-lg-skip="1" data-bl-fc-skip="1"></div>';

        host.appendChild(dockEl);
        syncDockHost(anchor);
        currentDockAnchor();                /* 绑定 ResizeObserver */
        if (!dockHostSyncInstalled) {
            dockHostSyncInstalled = true;
            installDockHostSync();
        }

        dockTipEl = dockEl.querySelector('.bl-dock-tip');
        dockItems = [].slice.call(dockEl.querySelectorAll('.bl-dock-item'));
        dockCur = []; dockTgt = []; dockBaseC = [];
        for (var i = 0; i < dockItems.length; i++) {
            dockCur.push({ s: 1, dx: 0 });
            dockTgt.push({ s: 1, dx: 0 });
            dockBaseC.push(0);
        }
        dockTipIdx = -1;

        var zone = dockEl.querySelector('.bl-dock-zone');
        zone.addEventListener('pointermove', dockMove);
        zone.addEventListener('pointerleave', dockLeave);
        zone.addEventListener('pointerdown', dockBring);
        dockEl.addEventListener('click', dockClick);
        dockEl.addEventListener('contextmenu', function (e) {
            var b = e.target && e.target.closest ? e.target.closest('.bl-dock-item') : null;
            if (!b) return;
            e.preventDefault();
            e.stopPropagation();
            showDockMenu(b, e.clientX, e.clientY);
        });
        /* 原版菜单的关闭行为（点外部 / 右键别处 / Esc / ↑↓ / Enter / resize）
           统一在这里幂等安装，DOCK 被 React 重绘重建时不会重复注册 */
        installDockMenuHandlers();
        dockSetTargets(null);
        dockPaint();
        /* 恢复固定项的自定义图标 */
        try {
            var pins = dockPinsRead();
            for (var k in pins.icons) {
                var it = dockEl.querySelector('.bl-dock-item[data-dock="' + k + '"]') ||
                         dockEl.querySelector('.bl-dock-item[data-tray="' + k + '"]');
                if (it && pins.icons[k]) applyDockCustomIcon(it, pins.icons[k]);
            }
        } catch (e) { /* ignore */ }
        return true;
    }

    /* 指针位置 → 每个图标的目标缩放与横向位移。
       所有基准量都取【布局值】（offsetLeft / offsetWidth），
       它们不含 transform，避免"读了放大后的宽度再放大"的自反馈抖动。 */
    function dockSetTargets(px) {
        if (!dockEl) return;
        var inner = dockEl.querySelector('.bl-dock-inner');
        if (!inner) return;
        var n = dockItems.length, i;
        var innerLeft = inner.offsetLeft || 0;      /* 与 item.offsetLeft 同一坐标系 */
        var bw = [], bc = [];                        /* 基准宽度 / 基准中心（相对 inner 左缘） */
        for (i = 0; i < n; i++) {
            var w = dockItems[i].offsetWidth || 44;
            bw.push(w);
            bc.push((dockItems[i].offsetLeft || 0) + w / 2 - innerLeft);
        }
        /* 1) 距离衰减：指针正下方最大，向两侧平滑收敛（smoothstep 边缘导数归零） */
        var vpLeft = inner.getBoundingClientRect().left;
        var s = [];
        for (i = 0; i < n; i++) {
            var sc = 1;
            if (px !== null) {
                var d = Math.abs((px - vpLeft) - bc[i]);
                var t = d >= DOCK_R ? 0 : 1 - (d / DOCK_R);
                t = t * t * (3 - 2 * t);
                sc = 1 + (DOCK_MAX - 1) * t;
            }
            s.push(sc);
        }
        /* 2) 按缩放后的"步长"重新排布 —— 邻居被挤开而不是被盖住。
              步长带上 gap，放大时间距同比变宽，图标不会贴在一起。
              整组按【基准重心】对齐：静止时位移恒为 0（不会一进一出就跳），
              放大时两侧对称外推，形成连续的波纹。 */
        var GAP = 4;
        var stride = [], total = 0;
        for (i = 0; i < n; i++) { stride.push((bw[i] + GAP) * s[i]); total += stride[i]; }
        var nc = [], x = 0;
        for (i = 0; i < n; i++) { nc.push(x + bw[i] * s[i] / 2); x += stride[i]; }
        var baseC = 0, newC = 0;
        for (i = 0; i < n; i++) { baseC += bc[i]; newC += nc[i]; }
        var shift = (baseC - newC) / (n || 1);
        for (i = 0; i < n; i++) dockTgt[i] = { s: s[i], dx: nc[i] + shift - bc[i] };

        /* 3) 悬浮名称：这里只决定"显示哪个、写什么字"，
               "停在哪、怎么弹"交给 dockPaint —— 名称要跟着图标一起动，
               只在指针事件里定位的话，鱼眼放大时名字会钉在原地不动。 */
        /* 基准中心必须走 offset 链算，不能用上面那个 bc[]：
           bc 是"相对 inner"的坐标，但减的 innerLeft 却是"相对 zone"的，
           两套坐标系混在一起会整体偏一个 zone 的内边距（图标看着没事，
           因为位移只取相对差；名称要的是绝对位置，一偏就看得出来）。
           offsetLeft 不读 transform，正好拿它拼出未缩放的布局中心。 */
        var zoneEl = dockEl.querySelector('.bl-dock-zone');
        var off = (inner.offsetLeft || 0) + (zoneEl ? zoneEl.offsetLeft || 0 : 0);
        for (i = 0; i < n; i++) dockBaseC[i] = off + (dockItems[i].offsetLeft || 0) + bw[i] / 2;

        if (dockTipEl) {
            var best = -1, bs = 1.05;
            for (i = 0; i < n; i++) if (s[i] > bs) { bs = s[i]; best = i; }
            dockTipIdx = (best >= 0 && px !== null) ? best : -1;
            if (dockTipIdx >= 0) {
                var it = dockItems[dockTipIdx];
                /* 标签写在 data-label 上；托盘图标是别的模块塞进来的，
                   万一没写就退回 aria-label，名字不至于空着。 */
                var lb = it.getAttribute('data-label') || it.getAttribute('aria-label') || '';
                if (dockTipEl.textContent !== lb) dockTipEl.textContent = lb;
                dockTipEl.classList.add('is-on');
            } else {
                dockTipEl.classList.remove('is-on');
            }
        }
    }

    function dockMove(e) { dockSetTargets(e.clientX); dockKick(); }
    function dockLeave() { dockSetTargets(null); dockKick(); }
    function dockBring() {
        var host = dockEl && dockEl.parentNode;
        if (!host) return;
        var mx = 20, i;
        for (i = 0; i < host.children.length; i++) {
            var z = parseInt(host.children[i].style.zIndex || '0', 10);
            if (host.children[i] !== dockEl && z > mx) mx = z;
        }
        dockEl.style.zIndex = String(mx + 1);
    }

    function dockKick() {
        if (dockRaf) return;
        dockRaf = window.requestAnimationFrame(dockTick);
    }

    function dockTick() {
        dockRaf = 0;
        var moving = false, i;
        for (i = 0; i < dockCur.length; i++) {
            var tgt = dockTgt[i] || { s: 1, dx: 0 };
            var c = dockCur[i] || { s: 1, dx: 0 };
            /* 缩放和位移一起插值：以前只插了缩放，位移是每帧硬跳的，
               名称跟着走就会一顿一顿。 */
            c.s = c.s + (tgt.s - c.s) * DOCK_LERP;
            c.dx = c.dx + (tgt.dx - c.dx) * DOCK_LERP;
            if (Math.abs(tgt.s - c.s) > 0.002 || Math.abs(tgt.dx - c.dx) > 0.3) moving = true;
            dockCur[i] = c;
        }
        dockPaint();
        if (moving) dockKick();
    }

    function dockPaint() {
        var i;
        for (i = 0; i < dockItems.length; i++) {
            var c = dockCur[i] || { s: 1, dx: 0 };
            var s = c.s, dx = c.dx;
            var lift = (s - 1) * -7;   /* 以底部为基准向上生长，再稍微抬起一点 */
            dockItems[i].style.transform = 'translateX(' + dx.toFixed(2) + 'px) translateY(' +
                lift.toFixed(2) + 'px) scale(' + s.toFixed(3) + ')';
        }
        /* 名称跟着当前最大的那个图标一起动：
           横向 = 基准中心 + 当前位移，纵向 = 图标抬多少它也抬多少，
           再叠一点轻微放大，整体像被图标"顶"起来。 */
        if (!dockTipEl) return;
        if (dockTipIdx < 0 || dockTipIdx >= dockItems.length) {
            dockTipEl.style.transform = '';
            return;
        }
        var tc = dockCur[dockTipIdx] || { s: 1, dx: 0 };
        var tlift = (tc.s - 1) * -7;
        var tscale = 1 + (tc.s - 1) * 0.28;
        dockTipEl.style.left = (dockBaseC[dockTipIdx] + tc.dx).toFixed(2) + 'px';
        dockTipEl.style.transform = 'translate(-50%, calc(-12px + ' + tlift.toFixed(2) +
            'px)) scale(' + tscale.toFixed(3) + ')';
    }

    function dockClick(e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var b = t.closest('[data-dock]');
        if (!b) return;
        var act = b.getAttribute('data-dock');
        if (act === 'tray') {
            dockTrayRestore(b.getAttribute('data-tray') || '');
            return;
        }
        if (act === 'vinyl') {
            /* 窗口已经收在托盘里：点原来的入口按钮就是把它放回来，
               而不是"再开一个"（那会让窗口凭空消失一次再出现）。 */
            if (dockTrayBtn('vinyl')) { dockTrayRestore('vinyl'); return; }
            try { if (window.__blVinyl) window.__blVinyl.toggle(); } catch (err) { /* ignore */ }
            return;
        }
        if (act === 'star') {
            if (dockTrayBtn('star')) { dockTrayRestore('star'); return; }
            try { if (window.__blStar) window.__blStar.toggle(); } catch (err2) { /* ignore */ }
            return;
        }
        if (act === 'tutorial') {
            try { if (window.__blStudio) window.__blStudio.openTutorial(); } catch (err3) { /* ignore */ }
            return;
        }
        if (act === 'toolbox') {
            try { if (window.__blToolbox) window.__blToolbox.toggle(); } catch (err4) { /* ignore */ }
            return;
        }
    }

    /* ---------------- 右键菜单 / 固定 / 图标 ---------------- */

    var FIXED_ACTS = ['vinyl', 'star', 'toolbox'];
    var dockMenuEl = null;
    var dockMenuTarget = null;

    function dockPinsRead() {
        try {
            var o = window.__blSettings ? window.__blSettings.get('dockPins') : null;
            if (o) return { pinned: Array.isArray(o.pinned) ? o.pinned : [], icons: o.icons || {} };
        } catch (e) { /* ignore */ }
        return { pinned: [], icons: {} };
    }
    function dockPinsSave(patch) {
        try { if (window.__blSettings) window.__blSettings.set('dockPins', patch); } catch (e) { /* ignore */ }
    }

    function dockIsPinned(id) {
        if (FIXED_ACTS.indexOf(id) >= 0) return true;
        var p = dockPinsRead();
        return p.pinned.indexOf(id) >= 0;
    }

    /* ---- 原版右键菜单类名（scratch-gui / react-contextmenu） ----
       生成与原生菜单完全相同的节点与类名，视觉全部交给编辑器自带 CSS。 */
    var CTX_MENU = 'react-contextmenu context-menu_context-menu_2SJM- react-contextmenu--visible';
    var CTX_ITEM = 'react-contextmenu-item context-menu_menu-item_3cioN';
    var CTX_BORDER = 'context-menu_menu-item-bordered_29CJG';
    var CTX_DANGER = 'context-menu_menu-item-danger_1tJg0';
    var CTX_DISABLED = 'react-contextmenu-item--disabled';
    var CTX_ACTIVE = 'react-contextmenu-item--active';
    var dockMenuIdx = -1;

    var DOCK_MENU_TEXT = {
        zh: { pinPos: '固定位置', front: '移到最前', pin: '固定',
              unpin: '取消固定', icon: '设定选项图标' },
        en: { pinPos: 'Pin position', front: 'Move to front', pin: 'Pin',
              unpin: 'Unpin', icon: 'Set icon' }
    };
    function dockMenuLang() {
        try { return /^zh/i.test(document.documentElement.lang || '') ? 'zh' : 'en'; }
        catch (e) { return 'zh'; }
    }
    function escDockText(v) {
        return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* 原版菜单项键盘导航：↑↓ 移动光标，Enter / Space 触发，Esc 关闭 */
    function dockMenuItems() {
        if (!dockMenuEl) return [];
        return [].slice.call(dockMenuEl.querySelectorAll('.react-contextmenu-item'))
            .filter(function (e) { return !e.classList.contains(CTX_DISABLED); });
    }
    function dockMenuSetActive(idx) {
        var its = dockMenuItems();
        for (var i = 0; i < its.length; i++) {
            if (i === idx) its[i].classList.add(CTX_ACTIVE);
            else its[i].classList.remove(CTX_ACTIVE);
        }
    }
    function dockMenuKey(e) {
        if (!dockMenuEl) return;
        if (e.key === 'Escape') { e.preventDefault(); closeDockMenu(); return; }
        var its = dockMenuItems();
        if (!its.length) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            var d = e.key === 'ArrowDown' ? 1 : -1;
            dockMenuIdx = dockMenuIdx < 0 ? (d > 0 ? 0 : its.length - 1)
                : (dockMenuIdx + d + its.length) % its.length;
            dockMenuSetActive(dockMenuIdx);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            var it = its[dockMenuIdx] || its[0];
            if (it) it.click();
        }
    }

    /* 事件只装一次。buildDock 会在 React 重绘后重建 DOCK，重复注册会累积。 */
    function installDockMenuHandlers() {
        if (window.__blDockMenuHandlers) return;
        window.__blDockMenuHandlers = true;
        function outside(e) {
            return !(e.target && e.target.closest && e.target.closest('.bl-dock-menu'));
        }
        document.addEventListener('pointerdown', function (e) {
            if (dockMenuEl && outside(e)) closeDockMenu();
        }, true);
        /* 右键别处：原版 react-contextmenu 也会立刻收起当前菜单 */
        document.addEventListener('contextmenu', function (e) {
            if (dockMenuEl && outside(e)) closeDockMenu();
        }, true);
        document.addEventListener('keydown', dockMenuKey, true);
        window.addEventListener('resize', function () { closeDockMenu(); });
        window.addEventListener('scroll', function () { closeDockMenu(); }, true);
    }

    function dockMenuItem(label, disabled, fn, opts) {
        opts = opts || {};
        var it = document.createElement('div');
        var cls = CTX_ITEM;
        if (opts.bordered) cls += ' ' + CTX_BORDER;   /* 原版：下一项顶部一条分隔线 */
        if (opts.danger) cls += ' ' + CTX_DANGER;
        if (disabled) cls += ' ' + CTX_DISABLED;
        it.className = cls;
        it.setAttribute('role', 'menuitem');
        it.setAttribute('tabindex', '-1');
        it.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        /* 原版菜单项文字包在 <span> 里 */
        var sp = document.createElement('span');
        sp.textContent = label;
        it.appendChild(sp);
        if (!disabled) {
            it.addEventListener('click', function (e) {
                e.stopPropagation();
                try { fn && fn(); } finally { closeDockMenu(); }
            });
        }
        return it;
    }

    function closeDockMenu() {
        if (dockMenuEl && dockMenuEl.parentNode) dockMenuEl.parentNode.removeChild(dockMenuEl);
        dockMenuEl = null;
        dockMenuTarget = null;
    }

    /* 移到最前：平移动画。固定入口（STAR/八音盒/帮助）不参与重排。 */
    function dockBringAnim(item) {
        try {
            if (!item || !item.animate) return;
            var r = item.getBoundingClientRect();
            item.animate([
                { transform: 'translateY(0)' },
                { transform: 'translateY(-6px)', offset: 0.4 },
                { transform: 'translateY(0)' }
            ], { duration: 260, easing: 'ease-out' });
        } catch (e) { /* ignore */ }
    }

    function dockMoveToFront(item) {
        if (!item) return;
        var inner = item.parentNode;
        if (!inner) return;
        /* 找到第一个固定入口之后的插入点：移到除固定入口外的最前 */
        var kids = [].slice.call(inner.children);
        var firstDynamic = -1;
        for (var i = 0; i < kids.length; i++) {
            var act = kids[i].getAttribute('data-dock');
            var isFixed = act && FIXED_ACTS.indexOf(act) >= 0;
            if (!isFixed) { firstDynamic = i; break; }
        }
        if (firstDynamic < 0) { inner.appendChild(item); }
        else { inner.insertBefore(item, kids[firstDynamic]); }
        dockReindex();
        dockBringAnim(item);
    }

    function dockFixItem(item) {
        var id = item.getAttribute('data-dock') || item.getAttribute('data-tray');
        if (!id || FIXED_ACTS.indexOf(id) >= 0) return;
        var p = dockPinsRead();
        if (p.pinned.indexOf(id) < 0) {
            p.pinned.push(id);
            dockPinsSave({ pinned: p.pinned });
        }
        /* 把托盘项标记为固定（保留在 DOCK，不随还原消失） */
        item.classList.add('is-dock-pinned');
        item.setAttribute('data-pinned', '1');
        dockReindex();
    }

    function dockUnfixItem(item) {
        var id = item.getAttribute('data-dock') || item.getAttribute('data-tray');
        if (!id || FIXED_ACTS.indexOf(id) >= 0) return;
        var p = dockPinsRead();
        var idx = p.pinned.indexOf(id);
        if (idx >= 0) { p.pinned.splice(idx, 1); dockPinsSave({ pinned: p.pinned }); }
        item.classList.remove('is-dock-pinned');
        item.removeAttribute('data-pinned');
    }

    /* 设定图标：导入图片 → 居中裁剪成方形 → 存 dataURL */
    function dockSetIcon(item) {
        var inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.addEventListener('change', function () {
            var f = inp.files && inp.files[0];
            if (!f) return;
            var rd = new FileReader();
            rd.onload = function () {
                var img = new Image();
                img.onload = function () {
                    var side = Math.min(img.naturalWidth, img.naturalHeight);
                    var sx = (img.naturalWidth - side) / 2;
                    var sy = (img.naturalHeight - side) / 2;
                    var cv = document.createElement('canvas');
                    cv.width = 64; cv.height = 64;
                    var ctx = cv.getContext('2d');
                    ctx.drawImage(img, sx, sy, side, side, 0, 0, 64, 64);
                    var dataUrl = cv.toDataURL('image/png');
                    var id = item.getAttribute('data-dock') || item.getAttribute('data-tray');
                    if (!id) return;
                    var p = dockPinsRead();
                    p.icons[id] = dataUrl;
                    dockPinsSave({ icons: p.icons });
                    applyDockCustomIcon(item, dataUrl);
                };
                img.src = rd.result;
            };
            rd.readAsDataURL(f);
        });
        inp.click();
    }

    function applyDockCustomIcon(item, dataUrl) {
        if (!item || !dataUrl) return;
        var old = item.querySelector('.bl-dock-custom-icon');
        if (old) old.remove();
        item.innerHTML = '';
        var im = document.createElement('img');
        im.className = 'bl-dock-custom-icon';
        im.src = dataUrl;
        im.alt = '';
        item.appendChild(im);
    }

    function showDockMenu(item, x, y) {
        closeDockMenu();
        /* 原版 react-contextmenu 在 SHOW 时会先隐藏其它已打开的菜单 */
        try { window.dispatchEvent(new CustomEvent('REACT_CONTEXTMENU_HIDE')); }
        catch (e0) { /* ignore */ }
        dockMenuTarget = item;
        dockMenuIdx = -1;
        var id = item.getAttribute('data-dock') || item.getAttribute('data-tray') || '';
        var isFixedEntry = FIXED_ACTS.indexOf(id) >= 0;
        var isPinned = dockIsPinned(id);
        var t = DOCK_MENU_TEXT[dockMenuLang()];

        /* 与角色栏右键菜单完全相同的容器 */
        dockMenuEl = document.createElement('nav');
        dockMenuEl.className = CTX_MENU + ' bl-dock-menu';  /* 后者仅作关闭检测标记 */
        dockMenuEl.setAttribute('role', 'menu');
        dockMenuEl.setAttribute('tabindex', '-1');
        dockMenuEl.style.position = 'fixed';
        dockMenuEl.style.opacity = '0';
        dockMenuEl.style.pointerEvents = 'auto';

        dockMenuEl.appendChild(dockMenuItem(t.pinPos, false, function () { dockMoveToFront(dockMenuTarget); }));
        dockMenuEl.appendChild(dockMenuItem(t.front, false, function () { dockMoveToFront(dockMenuTarget); }));
        dockMenuEl.appendChild(dockMenuItem(t.pin, isFixedEntry, function () { dockFixItem(dockMenuTarget); }, { bordered: true }));
        dockMenuEl.appendChild(dockMenuItem(t.unpin, !isPinned || isFixedEntry, function () { dockUnfixItem(dockMenuTarget); }));
        dockMenuEl.appendChild(dockMenuItem(t.icon, false, function () { dockSetIcon(dockMenuTarget); }, { bordered: true }));

        /* 菜单挂在 body 末尾，与 DOCK 同层且在宿主之后 → 永远盖在 DOCK 之上；
           不这么做的话菜单仍是原生 .react-contextmenu 的 10000，会被弹窗压住。 */
        dockMenuEl.style.zIndex = String(DOCK_Z);
        document.body.appendChild(dockMenuEl);
        /* 定位：与原版 react-contextmenu 一样做视口翻转，不写死 8px 边距 */
        var r = dockMenuEl.getBoundingClientRect();
        var left = x, top = y;
        if (left + r.width > window.innerWidth) left = Math.max(0, window.innerWidth - r.width);
        if (top + r.height > window.innerHeight) top = Math.max(0, top - r.height);
        dockMenuEl.style.left = Math.max(0, left) + 'px';
        dockMenuEl.style.top = Math.max(0, top) + 'px';
        /* 原版 CSS 已声明 transition: opacity .2s ease，这里只负责从 0 到 1 */
        requestAnimationFrame(function () { if (dockMenuEl) dockMenuEl.style.opacity = '1'; });
        try { dockMenuEl.focus({ preventScroll: true }); } catch (e1) { /* ignore */ }
    }

    /* 挂载与启动 */

    /* 设置 → 外观 → Dock 栏：关闭后三个入口移到左侧工作区导航 */
    function dockHidden() {
        try { return window.localStorage.getItem('bl:dock-hidden') === 'true'; } catch (e) { return false; }
    }

    var dockNavItems = null;

    function dockNavClick(act) {
        if (act === 'vinyl') {
            if (dockTrayBtn('vinyl')) { dockTrayRestore('vinyl'); return; }
            try { if (window.__blVinyl) window.__blVinyl.toggle(); } catch (e) { /* ignore */ }
        } else if (act === 'star') {
            if (dockTrayBtn('star')) { dockTrayRestore('star'); return; }
            try { if (window.__blStar) window.__blStar.toggle(); } catch (e2) { /* ignore */ }
        } else if (act === 'tutorial') {
            try { if (window.__blStudio) window.__blStudio.openTutorial(); } catch (e3) { /* ignore */ }
        } else if (act === 'toolbox') {
            try { if (window.__blToolbox) window.__blToolbox.toggle(); } catch (e4) { /* ignore */ }
        }
    }

    function dockNavRemove() {
        if (!dockNavItems) return;
        var arr = dockNavItems.slice();
        /* 立刻置空：切换回「隐藏」时 dockNavBuild 才能重新创建 */
        dockNavItems = null;
        for (var i = 0; i < arr.length; i++) {
            (function (li, idx) {
                if (!li || !li.parentNode) return;
                li.classList.remove('bl-dock-nav-in');
                li.style.animationDelay = (idx * 40) + 'ms';
                li.classList.add('bl-dock-nav-out');
                window.setTimeout(function () {
                    if (li.parentNode) li.parentNode.removeChild(li);
                }, 230 + idx * 40);
            })(arr[i], i);
        }
    }

    function dockNavBuild() {
        var ul = document.querySelector('ul[class*="gui_tab-list_"]');
        if (!ul) return false;
        if (dockNavItems) return true;
        /* 上一次离场动画没走完就切回来：先清掉残留，避免叠出两份 */
        var stale = ul.querySelectorAll('li.bl-dock-nav-out');
        for (var q = 0; q < stale.length; q++) {
            if (stale[q].parentNode) stale[q].parentNode.removeChild(stale[q]);
        }
        dockNavItems = [];
        for (var i = 0; i < DOCK_BTNS.length; i++) {
            var it = DOCK_BTNS[i];
            var li = document.createElement('li');
            li.className = 'gui_tab_27Unf bl-py-tab bl-dock-nav bl-dock-nav-in';
            li.style.animationDelay = (i * 65) + 'ms';   /* 依次滑入，像从 DOCK 飞过来 */
            li.setAttribute('role', 'tab');
            li.setAttribute('data-dock-nav', it.act);
            li.setAttribute('title', it.label);
            li.innerHTML = dockIcon(it.svg) + '<span>' + it.label + '</span>';
            li.addEventListener('click', (function (act) {
                return function (e) { e.stopPropagation(); dockNavClick(act); };
            })(it.act));
            ul.appendChild(li);
            dockNavItems.push(li);
        }
        return true;
    }

    var dockLastApplied = null;
    var dockLastEl = null;
    function applyDockMode(force) {
        var hidden = dockHidden();
        /* storage 事件与 150ms 轮询会同时到达。重复应用会重播动画、
           反复增删左侧入口；只有状态或宿主真的变了才执行。 */
        if (!force && dockLastApplied === hidden &&
            dockLastEl === dockEl && dockEl && dockEl.parentNode) return;
        dockLastApplied = hidden;
        dockLastEl = dockEl;
        if (hidden) {
            if (dockEl) {
                dockEl.classList.remove('bl-dock-entering');
                dockEl.classList.add('bl-dock-leaving');
                /* 淡出结束后再移出布局；回调里复查，避免用户中途又打开 DOCK */
                window.setTimeout(function () {
                    if (dockEl && dockHidden()) {
                        dockEl.style.display = 'none';
                        dockEl.classList.remove('bl-dock-leaving');
                    }
                }, 230);
            }
            dockNavBuild();
        } else {
            if (dockEl) {
                dockEl.classList.remove('bl-dock-leaving');
                dockEl.style.display = '';
                void dockEl.offsetWidth;              /* 强制重排，让入场动画从首帧开始 */
                dockEl.classList.add('bl-dock-entering');
                window.setTimeout(function () {
                    if (dockEl) dockEl.classList.remove('bl-dock-entering');
                }, 320);
            }
            dockNavRemove();
        }
    }

    function mount() {
        var ok = buildDock();
        applyDockMode();
        return ok;
    }

    function boot() {
        var tries = 0;
        var lastHidden = dockHidden();
        var t = setInterval(function () {
            tries++;
            var ok = mount();
            var h = dockHidden();
            if (h !== lastHidden) { lastHidden = h; applyDockMode(); }
            if (ok || tries > 90) clearInterval(t);
        }, 320);
        /* 积木栏是 React 渲染的，节点可能被替换 —— 被换掉后 DOCK 会一起消失。
           这里盯住宿主，发现 DOCK 掉了就重建（dockEl 已失效时 buildDock 会重挂）。 */
        window.addEventListener('resize', function () {
            if (dockEl && !dockEl.parentNode) {
                dockEl = null;
                buildDock();
                applyDockMode();
            }
            if (dockHidden()) dockNavBuild();
        });
        /* 设置面板在另一标签页改动时经 storage 事件同步；
           同一标签页内改动不派发给自己，用低频轮询兜底。 */
        window.addEventListener('storage', function (e) {
            if (e && e.key === 'bl:dock-hidden') applyDockMode();
        });
        setInterval(function () {
            var h = dockHidden();
            if (h !== lastHidden) { lastHidden = h; applyDockMode(); }
        }, 150);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    if (window.__blSync) window.__blSync.register('B33-dock', mount);
})();

