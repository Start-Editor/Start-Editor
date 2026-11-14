
(function () {
    'use strict';
    if (window.__blStagePop) return;
    window.__blStagePop = true;

    /* ── [B100 v2] 舞台 / 角色栏分别弹窗化 ─────────────────────────────
       与旧版的区别：旧版把 gui_stage-and-target-wrapper 整块搬进「一枚」
       .bl-sp-win；现在舞台与角色栏各自一枚独立 .addon-window：
         · 两窗都用编辑器原生窗口结构（addon-window / header / title /
           controls / btn / content），自动接入原生拖动、贴靠、统一置顶、
           DOCK 最小化、MAC/WIN 按钮、玻璃与主题皮肤 —— 与设置、工具箱、
           自定义主题色等可拖动弹窗同一套外观，不再自带 40px 标题栏和
           自绘文字按钮。
         · 舞台窗口用 CSS zoom + 反算占位等比充满；角色栏窗口用 flex 铺满，
           网格自适应，窗口改多大都充满。
         · 关闭任一窗口的 × 都关掉整个功能，把两个节点按注释锚点放回原位。
       存档沿用 bl:stage-pop；旧版单窗口的 left/top/width/height 自动迁移
       为舞台窗口的位置尺寸。
       ─────────────────────────────────────────────────────────────────── */

    var KEY = 'bl:stage-pop';
    var SEL_WRAP = '[class*="gui_stage-and-target-wrapper_"]';
    var SEL_BODY = '[class*="settings-modal_body_"]';
    var MIN_W = 300, MIN_H = 220;
    var DEF = {
        stage:   { left: null, top: null, width: 620, height: 520 },
        sprites: { left: null, top: null, width: 330, height: 430 }
    };

    var wins = { stage: null, sprites: null };
    var bodies = { stage: null, sprites: null };
    var wrapper = null, spritePane = null;
    var phWrap = null, phPane = null;
    var lastOn = null, fitSig = '', raf = 0, rz = null, saveT = 0;
    var moWin = null, moSettings = null, zStage = 1;

    var ICO_MIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>';
    var ICO_MAX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><rect x="4" y="5" width="16" height="14" rx="2"/></svg>';
    var ICO_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    var HANDLES =
        '<div class="bl-dw-rz bl-dw-rz-n" data-d="n"></div>' +
        '<div class="bl-dw-rz bl-dw-rz-ne" data-d="ne"></div>' +
        '<div class="bl-dw-rz bl-dw-rz-e" data-d="e"></div>' +
        '<div class="bl-dw-rz bl-dw-rz-se" data-d="se"></div>' +
        '<div class="bl-dw-rz bl-dw-rz-s" data-d="s"></div>' +
        '<div class="bl-dw-rz bl-dw-rz-sw" data-d="sw"></div>' +
        '<div class="bl-dw-rz bl-dw-rz-w" data-d="w"></div>' +
        '<div class="bl-dw-rz bl-dw-rz-nw" data-d="nw"></div>';

    /* ---------------- 存档 ---------------- */
    function copy(o) {
        var d = {};
        for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) d[k] = o[k];
        return d;
    }
    function read() {
        var c = { enabled: false, stage: copy(DEF.stage), sprites: copy(DEF.sprites) };
        try {
            var o = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (!o || typeof o !== 'object') return c;
            if (typeof o.enabled === 'boolean') c.enabled = o.enabled;
            /* 旧版单窗口存档：left/top/width/height → 舞台窗口 */
            var legacy = null;
            if (typeof o.left === 'number' || typeof o.top === 'number' ||
                typeof o.width === 'number' || typeof o.height === 'number') {
                legacy = { left: o.left, top: o.top, width: o.width, height: o.height };
            }
            ['stage', 'sprites'].forEach(function (kind) {
                var src = o[kind];
                if (kind === 'stage' && !src && legacy) src = legacy;
                if (!src || typeof src !== 'object') return;
                ['left', 'top', 'width', 'height'].forEach(function (f) {
                    if (typeof src[f] === 'number' && isFinite(src[f])) c[kind][f] = src[f];
                });
            });
        } catch (e) { /* ignore */ }
        return c;
    }
    function write(o) {
        try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
        try { document.dispatchEvent(new CustomEvent('bl:stage-pop-change')); } catch (e2) {}
    }
    function setEnabled(v) { var c = read(); c.enabled = !!v; write(c); tick(); }
    function zh() {
        try {
            var l = String(document.documentElement.lang || navigator.language || '');
            if (/(?:^|[?&])locale=en/i.test(location.search)) return false;
            if (/^en/i.test(l)) return false;
        } catch (e) { /* ignore */ }
        return true;
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function kindTitle(kind) {
        var zz = zh();
        if (kind === 'stage') return zz ? '舞台' : 'Stage';
        return zz ? '角色栏' : 'Sprites';
    }

    /* ---------------- 默认位置：两窗并排，不互相压住 ---------------- */
    function defaultRect(kind) {
        var d = DEF[kind];
        var W = Math.min(d.width, Math.max(MIN_W, window.innerWidth - 60));
        var H = Math.min(d.height, Math.max(MIN_H, window.innerHeight - 140));
        var left = kind === 'stage'
            ? clamp(Math.round(window.innerWidth - W - (window.innerWidth > 1080 ? 366 : 20)),
                    8, Math.max(8, window.innerWidth - W - 8))
            : clamp(Math.round(window.innerWidth - W - 24),
                    8, Math.max(8, window.innerWidth - W - 8));
        var top = clamp(70, 8, Math.max(8, window.innerHeight - H - 8));
        return { width: W, height: H, left: left, top: top };
    }

    /* ---------------- 窗口 DOM：全部用原生类名 ---------------- */
    function build(kind) {
        var w = wins[kind];
        if (w && w.isConnected) return w;
        var c = read(), r = defaultRect(kind), d = c[kind];
        var L = typeof d.left === 'number' ? d.left : r.left;
        var T = typeof d.top === 'number' ? d.top : r.top;
        var W = d.width || r.width, H = d.height || r.height;
        var zz = zh();

        var el = document.createElement('div');
        el.className = 'addon-window bl-us-window bl-dw-win bl-dw-' + kind;
        el.id = 'bl-dw-' + kind;
        el.setAttribute('data-bl-dw', kind);
        el.style.zIndex = '8001';
        el.innerHTML =
            '<div class="addon-window-header bl-dw-head">' +
              '<span class="addon-window-title bl-dw-title">' + kindTitle(kind) + '</span>' +
              (kind === 'stage'
                  ? '<span class="bl-dw-scale" data-bl-dw-scale>1.00×</span>' : '') +
              '<div class="addon-window-controls bl-dw-controls">' +
                '<button type="button" class="addon-window-btn addon-window-btn-minimize bl-dw-min" ' +
                  'title="' + (zz ? '最小化（收进 DOCK）' : 'Minimize to Dock') + '">' + ICO_MIN + '</button>' +
                '<button type="button" class="addon-window-btn addon-window-btn-maximize bl-dw-max" ' +
                  'title="' + (zz ? '最大化' : 'Maximize') + '">' + ICO_MAX + '</button>' +
                '<button type="button" class="addon-window-btn addon-window-btn-close bl-dw-close" ' +
                  'title="' + (zz ? '关闭并恢复嵌入布局' : 'Close and restore docking') + '">' +
                  ICO_CLOSE + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="addon-window-content bl-dw-body"></div>' + HANDLES;

        bodies[kind] = el.querySelector('.bl-dw-body');
        document.body.appendChild(el);
        wins[kind] = el;
        applyRect(el, kind, L, T, W, H, false);
        bindWin(el, kind);
        return el;
    }
    function setTexts() {
        var zz = zh();
        ['stage', 'sprites'].forEach(function (kind) {
            var el = wins[kind];
            if (!el) return;
            var t = el.querySelector('.bl-dw-title');
            if (t) t.textContent = kindTitle(kind);
            var mn = el.querySelector('.bl-dw-min');
            if (mn) mn.title = zz ? '最小化（收进 DOCK）' : 'Minimize to Dock';
            var mx = el.querySelector('.bl-dw-max');
            if (mx) mx.title = el.classList.contains('bl-dw-maximized')
                ? (zz ? '还原' : 'Restore') : (zz ? '最大化' : 'Maximize');
            var cl = el.querySelector('.bl-dw-close');
            if (cl) cl.title = zz ? '关闭并恢复嵌入布局' : 'Close and restore docking';
        });
    }
    function applyRect(el, kind, L, T, W, H, persist) {
        if (!el) return;
        W = clamp(W, MIN_W, Math.max(MIN_W, window.innerWidth - 12));
        H = clamp(H, MIN_H, Math.max(MIN_H, window.innerHeight - 12));
        L = clamp(L, 0, Math.max(0, window.innerWidth - W));
        T = clamp(T, 0, Math.max(0, window.innerHeight - H));
        el.style.left = L + 'px'; el.style.top = T + 'px';
        el.style.width = W + 'px'; el.style.height = H + 'px';
        fitAll(true);
        if (persist) {
            var c = read();
            c[kind] = { left: L, top: T, width: W, height: H };
            write(c);
        }
    }

    /* ---------------- 最大化 / 还原（与其它原版窗口三键一致） ---------------- */
    function toggleMax(el, kind) {
        var btn = el.querySelector('.bl-dw-max');
        var on = el.classList.contains('bl-dw-maximized');
        var zz = zh();
        if (!on) {
            el.__blDwPrev = {
                l: parseFloat(el.style.left) || 0,
                t: parseFloat(el.style.top) || 0,
                w: parseFloat(el.style.width) || DEF[kind].width,
                h: parseFloat(el.style.height) || DEF[kind].height
            };
            /* 留 8px 边：真 100vw×100vh 会被 isMaximized() 判定后禁止拖动 */
            applyRect(el, kind, 8, 8,
                      window.innerWidth - 16, window.innerHeight - 16, false);
            el.classList.add('bl-dw-maximized');
            if (btn) {
                btn.classList.add('addon-window-btn-restore');
                btn.classList.remove('addon-window-btn-maximize');
                btn.title = zz ? '还原' : 'Restore';
            }
        } else {
            var p = el.__blDwPrev || defaultRect(kind);
            el.classList.remove('bl-dw-maximized');
            applyRect(el, kind, p.l, p.t, p.w, p.h, false);
            if (btn) {
                btn.classList.remove('addon-window-btn-restore');
                btn.classList.add('addon-window-btn-maximize');
                btn.title = zz ? '最大化' : 'Maximize';
            }
            saveRect();
        }
        fitAll(true);
    }

    /* ---------------- 自适应：窗口多大，舞台就多大 ---------------- */
    function fitAll(force) {
        var b = bodies.stage;
        if (!b || !wrapper || !wins.stage || !wins.stage.isConnected) return;
        if (wins.stage.classList.contains('bl-win-docked') ||
            wins.stage.classList.contains('bl-dw-off')) return;
        var bw = b.clientWidth, bh = b.clientHeight;
        if (bw < 40 || bh < 40) return;

        var st = wrapper.querySelector('[class*="stage_stage_"]') ||
                 wrapper.querySelector('canvas');
        var sw = 480, sh = 360;
        if (st) {
            var ow = st.offsetWidth || 0, oh = st.offsetHeight || 0;
            if (ow > 60 && oh > 40) { sw = ow; sh = oh; }
            else if (st.getBoundingClientRect) {
                var q = st.getBoundingClientRect();
                var a = q.width / (zStage || 1), bb = q.height / (zStage || 1);
                if (a > 60 && bb > 40) { sw = a; sh = bb; }
            }
        }
        var sig = Math.round(bw) + 'x' + Math.round(bh) + '|' +
                  Math.round(sw) + 'x' + Math.round(sh);
        if (!force && sig === fitSig) return;
        fitSig = sig;

        /* 角色栏已独立成窗，这里不再为它预留 112px 高度 */
        var natW = sw + 24, natH = sh + 44 + 24;
        var nz = Math.min(bw / natW, bh / natH);
        nz = clamp(nz, 0.40, 3.00);
        zStage = Math.round(nz * 1000) / 1000;
        if (wins.stage.style.getPropertyValue('--bl-dw-z') !== String(zStage)) {
            wins.stage.style.setProperty('--bl-dw-z', String(zStage));
        }
        var wpx = Math.round(bw / zStage) + 'px', hpx = Math.round(bh / zStage) + 'px';
        if (wrapper.style.getPropertyValue('width') !== wpx) {
            wrapper.style.setProperty('width', wpx, 'important');
        }
        if (wrapper.style.getPropertyValue('height') !== hpx) {
            wrapper.style.setProperty('height', hpx, 'important');
        }
        var badge = wins.stage.querySelector('[data-bl-dw-scale]');
        if (badge) badge.textContent = zStage.toFixed(2) + '×';
    }
    function fitSoon() {
        if (raf) return;
        raf = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })
            .call(window, function () { raf = 0; fitAll(false); });
    }

    /* ---------------- 找角色栏节点（多层兜底） ---------------- */
    function findPane(wrap) {
        if (!wrap) return null;
        var q = wrap.querySelector('[class*="gui_target-wrapper_"]');
        if (q) return q;
        q = wrap.querySelector('[class*="target-pane"]');
        if (q) return q;
        q = wrap.querySelector('[class*="sprite-selector_"]');
        if (q) {
            var n = q;
            while (n.parentNode && n.parentNode !== wrap) n = n.parentNode;
            return n.parentNode === wrap ? n : q;
        }
        var kids = wrap.children ? [].slice.call(wrap.children) : [];
        for (var i = 0; i < kids.length; i++) {
            var cn = String(kids[i].className || '');
            if (/target|sprite|selector/i.test(cn)) return kids[i];
        }
        return kids.length > 1 ? kids[kids.length - 1] : null;
    }

    /* ---------------- 搬入两个窗口 ---------------- */
    function ensure() {
        var wrap = document.querySelector(SEL_WRAP);
        if (!wrap || !bodies.stage || !bodies.sprites) return;

        var pane = findPane(wrap);

        if (wrap !== wrapper || wrap.parentNode !== bodies.stage) {
            /* React 换了新节点：清掉窗口里残留的旧 wrapper */
            var olds = bodies.stage.querySelectorAll(SEL_WRAP);
            for (var i = 0; i < olds.length; i++) {
                if (olds[i] !== wrap && olds[i].parentNode === bodies.stage) {
                    bodies.stage.removeChild(olds[i]);
                }
            }
            if (wrap.parentNode !== bodies.stage) {
                if (!phWrap || !phWrap.parentNode) {
                    phWrap = document.createComment('bl-dw-wrap-anchor');
                    if (wrap.parentNode) wrap.parentNode.insertBefore(phWrap, wrap);
                }
                bodies.stage.appendChild(wrap);
            }
            wrapper = wrap;
            fitSig = '';
        }

        if (pane && (pane !== spritePane || pane.parentNode !== bodies.sprites)) {
            if (!phPane || !phPane.parentNode) {
                phPane = document.createComment('bl-dw-pane-anchor');
                if (pane.parentNode) pane.parentNode.insertBefore(phPane, pane);
            }
            bodies.sprites.appendChild(pane);
            spritePane = pane;
        }

        fitAll(true);
        try { window.dispatchEvent(new Event('resize')); } catch (e) { /* ignore */ }
    }

    /* ---------------- 放回原来的 flex 布局 ---------------- */
    function cleanInline(n) {
        if (!n || !n.style) return;
        ['width', 'height', 'zoom'].forEach(function (p) {
            try { n.style.removeProperty(p); } catch (e) {}
        });
    }
    function restore() {
        if (spritePane) {
            try {
                if (phPane && phPane.parentNode) {
                    phPane.parentNode.insertBefore(spritePane, phPane);
                    phPane.parentNode.removeChild(phPane);
                } else if (wrapper) {
                    wrapper.appendChild(spritePane);
                }
            } catch (e) { /* ignore */ }
            cleanInline(spritePane);
        }
        if (wrapper) {
            try {
                if (phWrap && phWrap.parentNode) {
                    phWrap.parentNode.insertBefore(wrapper, phWrap);
                    phWrap.parentNode.removeChild(phWrap);
                } else {
                    var flex = document.querySelector('[class*="gui_flex-wrapper_"]');
                    if (flex && flex !== wrapper) flex.appendChild(wrapper);
                }
            } catch (e2) { /* ignore */ }
            cleanInline(wrapper);
        }
        phPane = null; phWrap = null; spritePane = null; wrapper = null;
        fitSig = '';
        try { window.dispatchEvent(new Event('resize')); } catch (e3) { /* ignore */ }
    }
    function forgetDock(el) {
        if (!el) return;
        try {
            var t = window.__blDockTray;
            if (t && t.remove && el.__blDockId) t.remove(el.__blDockId);
        } catch (e) { /* ignore */ }
        try { el.__blDockId = null; } catch (e2) {}
        try { el.classList.remove('bl-win-docked'); } catch (e3) {}
    }

    /* ---------------- 8 方向缩放（两个窗口共用） ---------------- */
    function onRzDown(e) {
        var h = e.target && e.target.closest ? e.target.closest('.bl-dw-rz') : null;
        if (!h || e.button !== 0) return;
        var el = h.closest ? h.closest('.bl-dw-win') : null;
        if (!el) return;
        if (el.classList.contains('bl-dw-maximized')) return;
        e.preventDefault(); e.stopPropagation();
        var r = el.getBoundingClientRect();
        rz = { win: el, d: h.getAttribute('data-d') || 'se',
               x: e.clientX, y: e.clientY,
               left: r.left, top: r.top, w: r.width, h: r.height };
        el.classList.add('bl-dw-resizing');
        try { if (h.setPointerCapture && e.pointerId != null) h.setPointerCapture(e.pointerId); }
        catch (e2) { /* ignore */ }
    }
    function onRzMove(e) {
        if (!rz || !rz.win) return;
        var dx = e.clientX - rz.x, dy = e.clientY - rz.y;
        var L = rz.left, T = rz.top, W = rz.w, H = rz.h, d = rz.d;
        if (d.indexOf('e') >= 0) W = Math.max(MIN_W, rz.w + dx);
        if (d.indexOf('s') >= 0) H = Math.max(MIN_H, rz.h + dy);
        if (d.indexOf('w') >= 0) { W = Math.max(MIN_W, rz.w - dx); L = rz.left + (rz.w - W); }
        if (d.indexOf('n') >= 0) { H = Math.max(MIN_H, rz.h - dy); T = rz.top + (rz.h - H); }
        W = Math.min(W, window.innerWidth - 12);
        H = Math.min(H, window.innerHeight - 12);
        L = clamp(L, 0, Math.max(0, window.innerWidth - W));
        T = clamp(T, 0, Math.max(0, window.innerHeight - H));
        rz.win.style.left = L + 'px'; rz.win.style.top = T + 'px';
        rz.win.style.width = W + 'px'; rz.win.style.height = H + 'px';
        fitSoon();
    }
    function onRzEnd() {
        if (!rz) return;
        var el = rz.win;
        rz = null;
        if (el) el.classList.remove('bl-dw-resizing');
        saveRect();
        fitAll(true);
    }
    function saveRect() {
        var c = read();
        ['stage', 'sprites'].forEach(function (kind) {
            var el = wins[kind];
            if (!el) return;
            /* 最大化是临时状态，不写进存档：刷新后仍回到普通尺寸 */
            if (el.classList.contains('bl-dw-maximized')) return;
            c[kind] = {
                left: parseFloat(el.style.left) || 0,
                top: parseFloat(el.style.top) || 0,
                width: parseFloat(el.style.width) || DEF[kind].width,
                height: parseFloat(el.style.height) || DEF[kind].height
            };
        });
        write(c);
    }
    function bindWin(el, kind) {
        el.addEventListener('pointerdown', onRzDown, true);
        /* 关闭任一窗口 = 关掉整个功能并把两块 DOM 放回原位 */
        el.addEventListener('click', function (e) {
            if (!e.target || !e.target.closest) return;
            if (e.target.closest('.bl-dw-close')) {
                e.preventDefault(); e.stopPropagation();
                setEnabled(false);
                return;
            }
            if (e.target.closest('.bl-dw-max')) {
                e.preventDefault(); e.stopPropagation();
                toggleMax(el, kind);
            }
        }, true);
        el.querySelector('.bl-dw-head').addEventListener('dblclick', function () {
            if (el.classList.contains('bl-dw-maximized')) { toggleMax(el, kind); return; }
            var r = defaultRect(kind);
            applyRect(el, kind, r.left, r.top, r.width, r.height, true);
        });
        /* 原生拖动运行时直接改 inline left/top，用 style 观察把它们记下来 */
        if (window.MutationObserver) {
            var mo = new MutationObserver(function () {
                if (saveT) return;
                saveT = setTimeout(function () { saveT = 0; saveRect(); }, 320);
                fitSoon();
            });
            mo.observe(el, { attributes: true, attributeFilter: ['style'] });
            el.__blDwMo = mo;
        }
    }
    document.addEventListener('pointermove', onRzMove);
    document.addEventListener('pointerup', onRzEnd);
    document.addEventListener('pointercancel', onRzEnd);

    /* ---------------- 设置 → 常规：开关卡片 ---------------- */
    function isGeneral() {
        var b = document.querySelector(SEL_BODY);
        if (!b) return false;
        if (b.classList.contains('bl-starai-mode') || b.classList.contains('bl-ver-mode')) return false;
        if (document.documentElement.classList.contains('bl-ver-mode')) return false;
        var sels = document.querySelectorAll('[class*="modal-sidebar_itemSelected_"]');
        var seen = false;
        for (var i = 0; i < sels.length; i++) {
            var t = String(sels[i].textContent || '').trim();
            seen = true;
            if (/^(常规|General)/i.test(t)) return true;
        }
        return !seen;
    }
    function cardHtml(zz) {
        return '<div class="bl-sp-card" data-bl-sp-card="1" data-bl-sp-lang="' + (zz ? 'zh' : 'en') + '">' +
            '<h3>' + (zz ? '舞台、角色栏分别弹窗化' : 'Stage & sprites as separate windows') + '</h3>' +
            '<p>' + (zz
                ? '开启后舞台与角色栏拆成两枚独立的可拖动弹窗，样式与编辑器其它弹窗一致；各自可拖动、八方向缩放、最小化进 DOCK。舞台随窗口大小等比充满，角色栏网格自适应铺满。点任一窗口的关闭按钮即恢复原来的嵌入布局。'
                : 'Detach the stage and the sprite pane into two separate draggable windows that look like every other editor window. Each can be moved, resized from 8 handles and minimized to the Dock. The stage scales to fit; the sprite grid reflows to fill. Close either window to restore the docked layout.') + '</p>' +
            '<label class="bl-sp-row"><input type="checkbox" data-bl-sp-toggle>' +
            '<span>' + (zz ? '启用弹窗化' : 'Enable floating windows') + '</span>' +
            '<span class="bl-sp-hint">' + (zz ? '两窗独立拖动 · 拖边缘缩放' : 'Two windows · drag edges') + '</span>' +
            '<button type="button" class="bl-sp-reset2" data-bl-sp-reset>' +
            (zz ? '恢复默认大小' : 'Reset size') + '</button></label></div>';
    }
    function mountCard() {
        var b = document.querySelector(SEL_BODY);
        if (!b) return;
        var zz = zh();
        var card = b.querySelector('[data-bl-sp-card]');
        if (card && card.getAttribute('data-bl-sp-lang') === (zz ? 'zh' : 'en')) {
            b.classList.toggle('bl-sp-general', isGeneral());
            var box = card.querySelector('[data-bl-sp-toggle]');
            if (box && document.activeElement !== box) box.checked = read().enabled;
            return;
        }
        if (card) card.parentNode.removeChild(card);
        var tmp = document.createElement('div');
        tmp.innerHTML = cardHtml(zz);
        var node = tmp.firstChild;
        b.appendChild(node);
        node.querySelector('[data-bl-sp-toggle]').checked = read().enabled;
        b.classList.toggle('bl-sp-general', isGeneral());
    }

    /* ---------------- 主循环 ---------------- */
    function tick() {
        var on = read().enabled;
        var htmlCls = document.documentElement.classList;
        if (on) {
            htmlCls.add('bl-stage-pop');
            build('stage'); build('sprites');
            setTexts();
            ['stage', 'sprites'].forEach(function (kind) {
                wins[kind].classList.remove('bl-dw-off');
            });
            /* 不无条件 forgetDock：最小化后由 DOCK 图标恢复 */
            ensure();
            fitAll(false);
        } else {
            htmlCls.remove('bl-stage-pop');
            ['stage', 'sprites'].forEach(function (kind) {
                if (!wins[kind]) return;
                forgetDock(wins[kind]);
                wins[kind].classList.add('bl-dw-off');
            });
            restore();
        }
        if (on !== lastOn) { lastOn = on; fitSig = ''; }
        try { mountCard(); } catch (e) { /* ignore */ }
    }
    function schedule() {
        if (raf) return;
        raf = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })
            .call(window, function () { raf = 0; tick(); });
    }

    document.addEventListener('change', function (e) {
        var t = e.target;
        if (t && t.getAttribute && t.hasAttribute('data-bl-sp-toggle')) {
            setEnabled(!!t.checked);
        }
    }, true);
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.closest && t.closest('[data-bl-sp-reset]')) {
            ['stage', 'sprites'].forEach(function (kind) {
                var r = defaultRect(kind);
                applyRect(wins[kind], kind, r.left, r.top, r.width, r.height, false);
            });
            saveRect();
        }
        if (t && t.closest && t.closest('[class*="modal-sidebar_item_"]')) schedule();
    }, true);
    document.addEventListener('bl:stage-pop-change', function () { fitSig = ''; schedule(); });
    window.addEventListener('storage', function (e) {
        if (e && e.key === KEY) { fitSig = ''; schedule(); }
    });
    window.addEventListener('resize', function () { fitSig = ''; fitSoon(); });

    function watch() {
        if (!window.MutationObserver) return;
        var sb = document.querySelector(SEL_BODY);
        if (sb && moSettings && moSettings.__host !== sb) {
            try { moSettings.disconnect(); } catch (e) {}
            moSettings = null;
        }
        if (sb && !moSettings) {
            moSettings = new MutationObserver(function () { schedule(); });
            moSettings.__host = sb;
            try { moSettings.observe(sb, { childList: true, subtree: true,
                                           attributes: true, attributeFilter: ['class'] }); }
            catch (e) { moSettings = null; }
        }
        if (bodies.stage && !moWin) {
            moWin = new MutationObserver(function () { fitSig = ''; fitSoon(); });
            try { moWin.observe(bodies.stage, { childList: true, subtree: true }); }
            catch (e2) { moWin = null; }
        }
    }
    setInterval(function () {
        try { watch(); tick(); } catch (e) { /* ignore */ }
    }, 600);
    if (document.body) { tick(); watch(); }
    else document.addEventListener('DOMContentLoaded', function () { tick(); watch(); });

    /* 同帧补挂：设置窗口一打开，卡片就和原生分区同时出现 */
    if (window.__blSync) {
        try { window.__blSync.register('B100-stage-pop', function () { try { mountCard(); tick(); } catch (e) {} }, true); }
        catch (e) {}
    }

    window.__blStagePopCtl = {
        read: read, write: write, tick: tick, fit: fitAll,
        setEnabled: setEnabled,
        status: function () {
            function rect(el) {
                return el ? { l: el.style.left, t: el.style.top,
                              w: el.style.width, h: el.style.height } : null;
            }
            return {
                enabled: read().enabled,
                split: true,
                stage: { attached: !!(wins.stage && wins.stage.isConnected), rect: rect(wins.stage) },
                sprites: { attached: !!(wins.sprites && wins.sprites.isConnected),
                           rect: rect(wins.sprites),
                           pane: !!(spritePane && spritePane.parentNode === bodies.sprites) },
                wrapperAttached: !!(wrapper && wrapper.parentNode === bodies.stage),
                z: zStage
            };
        }
    };
})();
