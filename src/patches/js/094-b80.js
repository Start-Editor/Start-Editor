
(function () {
    'use strict';
    if (window.__blPaintWide) return;
    window.__blPaintWide = true;

    var CLS = 'bl-paint-wide';
    var box = null, imgEl = null, boxHost = null;
    var lastURL = '', applied = false, raf = 0, refreshTimer = 0;
    /* 「最后一张确认能显示的图」：编辑造型时资源串每轮都变，
       新串先异步探测，只有 onload 成功才替换，期间一直显示 bestURL，
       所以画布永远有内容 —— 不会像之前那样一编辑就空白。 */
    var bestURL = '', smallCanvas = null;
    /* 探测并发治理：拖动素材时 onUpdateImage 防抖写回多版资源串，
       Image 解码完成顺序 ≠ 发起顺序。seq / appliedSeq 保证「迟到旧帧」
       不能覆盖已显示的新帧；inFlight 按 URL 去重，替代只存一个 pending。
       lastFailed 避免同一个无效串被轮询反复探测。 */
    var seq = 0, appliedSeq = 0, inFlight = Object.create(null), lastFailed = '';
    /* 编辑活跃窗口：按住拖动 / 连续绘制 → now+900ms。窗口内轮询加密，
       并在 pointerup 后补刷，覆盖 onUpdateImage 的防抖写回延迟。 */
    var editUntil = 0, moveTimer = 0, endScheduled = false;

    /* ── 界面判定 ──────────────────────────────────────────────────── */
    function paintVisible() {
        var nodes = document.querySelectorAll('[class*="paint-editor_editor-container_"]');
        for (var q = 0; q < nodes.length; q++) {
            var n = nodes[q];
            try {
                if (n.getClientRects && n.getClientRects().length &&
                    getComputedStyle(n).display !== 'none' && n.offsetWidth > 200) return n;
            } catch (e) { /* ignore */ }
        }
        return null;
    }
    function selectedTabText() {
        try {
            var t = document.querySelector('[class*="gui_tab-list_"] > li[class*="is-selected"]');
            return t ? String(t.textContent || '').trim() : '';
        } catch (e) { return ''; }
    }
    function isPaintTab() {
        return !!paintVisible() || /造型|背景|Costumes|Backdrops/i.test(selectedTabText());
    }

    /* ── 当前造型的三层数据来源 ────────────────────────────────────── */
    /* ① paper 画布：实时反映正在画的笔迹。先缩到 320×200 再编码，
       原画布可能上千像素，直接 toDataURL 会拖慢绘制帧率。 */
    function paperURL() {
        try {
            var c = document.querySelector('canvas[class*="paper-canvas_"]');
            if (!c || !c.width || !c.height) return '';
            var W = 320, H = 200;
            if (!smallCanvas) {
                smallCanvas = document.createElement('canvas');
                smallCanvas.width = W; smallCanvas.height = H;
            }
            var ctx = smallCanvas.getContext('2d');
            var s = Math.min(W / c.width, H / c.height);
            var w = c.width * s, h = c.height * s;
            ctx.clearRect(0, 0, W, H);
            ctx.drawImage(c, (W - w) / 2, (H - h) / 2, w, h);
            return smallCanvas.toDataURL('image/png');
        } catch (e) { return ''; }     /* canvas 被外部图片污染时回退 */
    }
    /* 编辑中间态 VM 的 asset 可能暂时没数据，encodeDataURI() 会吐出
       "data:...,undefined" 这类看似有值实则无效的串，必须挡掉。 */
    function validURI(u) {
        if (!u || typeof u !== 'string' || u.length < 64) return false;
        var c = u.indexOf(',');
        return c > 4 && u.slice(0, 5) === 'data:' && u.length > c + 8;
    }
    /* ② VM 里当前编辑目标的当前造型 */
    function vmURL() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            var g = st && st.scratchGui;
            var vm = (g && g.vm) || (st && st.vm) || window.vm;
            if (!vm || !vm.runtime) return '';
            var t = vm.editingTarget ||
                    (vm.runtime.getEditingTarget && vm.runtime.getEditingTarget());
            if (!t) return '';
            var cs = (t.getCostumes && t.getCostumes()) ||
                     (t.sprite && t.sprite.costumes) || [];
            var c = cs[t.currentCostume] || cs[0];
            if (!c) return '';
            var id = c.assetId || (c.asset && c.asset.assetId) || '';
            var storage = vm.runtime.storage;
            var a = id && storage && storage.get && storage.get(id);
            var u = '';
            if (a && typeof a.encodeDataURI === 'function') u = a.encodeDataURI();
            else if (a && a.data) u = 'data:' + (a.dataFormat || 'image/svg+xml') + ';base64,' + a.data;
            return validURI(u) ? u : '';
        } catch (e) { return ''; }
    }
    /* ③ 造型列表里「选中项」的 img（前两者都拿不到时兜底）
       注意：sprite-selector-item_* 是角色列表的类名，不是造型列表；
       旧版在取不到时还会抓页面上第一个 img —— 那会显示别的角色/造型，
       正是「移动素材后缩略图显示错误」的一种表现。现在只认造型区选中项，
       宁可保留 bestURL，也绝不显示无关图片。 */
    function domURL() {
        try {
            var scope = document.querySelector('[class*="selector_wrapper_"]') ||
                        document.querySelector('[class*="asset-panel_"]');
            if (!scope) return '';
            var sels = scope.querySelectorAll('[class*="is-selected"]');
            for (var z = 0; z < sels.length; z++) {
                var im = sels[z].querySelector && sels[z].querySelector('img');
                if (im && im.src && validURI(im.src)) return im.src;
            }
        } catch (e) { /* ignore */ }
        return '';
    }
    function currentCostumeURL() {
        /* 顺序很重要：paper canvas 的像素是 view.zoom / pan 变换后的
           「当前可见范围」，zoom 进去后就只剩局部。VM 资源与造型列表
           里的 img 都是完整造型原图，与画布缩放无关 —— 所以优先用它们，
           paper canvas 只在前两者都失效时兜底。
           编辑/移动素材由 onUpdateImage 防抖写回 VM，靠下面的
           「编辑活跃窗口 + 延迟补刷 + 精确签名」保证最终画面跟上，
           不改回 paper 优先，避免缩略图重新跟随缩放范围。 */
        return vmURL() || domURL() || paperURL();
    }
    /* 精确比较：不再用「长度 + 64 点稀疏采样」的弱签名。
       移动素材改写的是 SVG path 的 d 坐标，大多落在串的中后段，
       采样点很容易全部错过、长度又不变 → 旧签名判定「没变化」直接 return，
       缩略图就一直停在移动前的画面。全串比较只多几十微秒，
       却保证任何一处坐标变化都能触发刷新。 */
    function sameURL(v) { return v === lastURL; }

    /* ── 异步探测替换：绝不把「还没加载好 / 无效」的串设成 src ─────── */
    function setPreview(url) {
        if (!validURI(url)) return;
        if (url === bestURL || url === lastFailed) return;
        if (inFlight[url]) return;            /* 同一串只探测一次 */
        var mySeq = ++seq;
        inFlight[url] = true;
        var probe = new Image();
        try {
            probe.onload = function () {
                delete inFlight[url];
                /* 保留「不要求必须是当前这一张」的不空白特性：
                   编辑时资源串每轮都变，任何成功加载的都能成为候选画面。
                   但必须过序号闸 —— 解码慢的旧帧不能覆盖已显示的新帧，
                   否则移动素材后缩略图会停回移动前的造型。 */
                if (mySeq <= appliedSeq) return;
                appliedSeq = mySeq;
                bestURL = url;
                if (imgEl) imgEl.src = url;
            };
            probe.onerror = function () {
                delete inFlight[url];
                lastFailed = url;              /* 同一个坏串不再反复探测 */
                /* 什么都不做：imgEl 仍显示 bestURL，绝不空白 */
            };
            probe.src = url;
        } catch (e) {
            delete inFlight[url];
        }
    }

    /* ── 预览节点：复用同一个，挂进造型画布容器 ────────────────────── */
    function mountBox() {
        if (!box) {
            box = document.createElement('div');
            box.className = 'bl-paint-preview';
            imgEl = document.createElement('img');
            imgEl.alt = '';
            box.appendChild(imgEl);
        }
        var host = null;
        try {
            host = document.querySelector('[class*="paint-editor_canvas-container_"]');
        } catch (e) { /* ignore */ }
        var want = host || document.body || document.documentElement;
        if (box.parentNode !== want) want.appendChild(box);
        boxHost = host;
        if (box.classList && box.classList.toggle) box.classList.toggle('is-fallback', !host);
        return box;
    }

    /* ── 刷新调度 ──────────────────────────────────────────────────── */
    function refresh(force) {
        if (!document.documentElement.classList.contains(CLS)) return;
        mountBox();
        var url;
        try { url = currentCostumeURL(); } catch (e) { return; }
        if (!url) return;                 /* 拿不到就保留 bestURL，绝不空白 */
        if (!force && sameURL(url)) return;  /* 精确比较，任何坐标变化都刷新 */
        lastURL = url;
        setPreview(url);
    }
    function refreshSoon(force) {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(function () { refreshTimer = 0; refresh(force); }, 120);
    }

    /* ── 同步开/关（幂等） ─────────────────────────────────────────── */
    function sync(force) {
        var on = isPaintTab();
        if (on !== applied) {
            applied = on;
            document.documentElement.classList.toggle(CLS, on);
            if (on) {
                lastURL = '';
                mountBox();
                refreshSoon(true);
                setTimeout(function () { refresh(true); }, 320);
                setTimeout(function () { refresh(true); }, 900);
            }
        } else if (on && force) {
            refresh(true);
        }
    }
    function syncSoon() {
        if (raf) return;
        raf = requestAnimationFrame(function () { raf = 0; sync(false); });
    }

    /* 捕获阶段预判：React 挂载 paint editor 前就已切到宽画布布局 */
    document.addEventListener('click', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('li') : null;
        if (!t) return;
        var ul = t.parentElement;
        if (!ul || !/gui_tab-list/.test(ul.className || '')) return;
        var txt = String(t.textContent || '') + ' ' + (t.getAttribute('title') || '');
        var want = /造型|背景|Costumes|Backdrops/i.test(txt);
        if (want !== applied) {
            applied = want;
            document.documentElement.classList.toggle(CLS, want);
            if (want) {
                lastURL = '';
                mountBox();
                refreshSoon(true);
                setTimeout(function () { refresh(true); }, 320);
                setTimeout(function () { refresh(true); }, 900);
            }
        }
        setTimeout(function () { sync(false); }, 0);
        setTimeout(function () { sync(false); }, 60);
        setTimeout(function () { sync(true); }, 180);
    }, true);

    /* ── 编辑活跃窗口：拖动素材 / 连续绘制期间 ──────────────────────
       scratch-paint 的 onUpdateImage 有防抖，pointerup 那一刻 VM 里往往
       还是移动前的旧 asset。只在 pointerup 后 120ms 刷一次就会一直停在
       旧画面 —— 这是「移动一下素材，缩略图显示错误」的直接原因之一。 */
    function markEdit() { editUntil = Date.now() + 900; }
    function scheduleEndRefresh() {
        markEdit();
        if (endScheduled) return;
        endScheduled = true;
        refreshSoon(false);
        /* 覆盖防抖写回：分别在 ~420ms 与 ~900ms 强制重取，不依赖签名 */
        setTimeout(function () { refresh(true); }, 420);
        setTimeout(function () { endScheduled = false; refresh(true); }, 900);
    }
    document.addEventListener('pointerdown', function (e) {
        if (applied && e.target && e.target.closest &&
            e.target.closest('[class*="paint-editor_"]')) markEdit();
    }, true);
    document.addEventListener('pointermove', function (e) {
        if (!applied || !(e.buttons || e.pointerType === 'touch')) return;
        if (!(e.target && e.target.closest &&
              e.target.closest('[class*="paint-editor_"]'))) return;
        markEdit();
        if (moveTimer) return;
        moveTimer = setTimeout(function () { moveTimer = 0; refresh(false); }, 80);
    }, true);
    /* 画完一笔后刷新，并补两次延迟强制刷新 */
    ['pointerup', 'mouseup', 'touchend'].forEach(function (ev) {
        document.addEventListener(ev, function (e) {
            if (applied && e.target && e.target.closest &&
                e.target.closest('[class*="paint-editor_"]')) scheduleEndRefresh();
        }, true);
    });
    document.addEventListener('keyup', function (e) {
        if (applied && (e.key === 'Enter' || e.key === 'Escape' ||
            (e.ctrlKey || e.metaKey))) { markEdit(); refreshSoon(false); }
    }, true);
    window.addEventListener('resize', function () { if (applied) refreshSoon(false); });

    /* 精确观察具体容器，绕开性能总线的启动期冻结 */
    var moHost = null, mo = null;
    function watchHost() {
        if (!window.MutationObserver) return;
        var host = document.querySelector('[class*="gui_flex-wrapper_"]');
        if (!host || host === document.body || host === document.documentElement ||
            host === moHost) return;
        moHost = host;
        try { if (mo) mo.disconnect(); } catch (e) { /* ignore */ }
        try {
            mo = new MutationObserver(function () { syncSoon(); });
            mo.observe(host, { childList: true, subtree: true,
                               attributes: true, attributeFilter: ['class'] });
        } catch (e2) { mo = null; }
    }

    /* [B80] 单列工具栏的高度兜底：max-height:100% 在父级 height:auto
       时不一定被解析成确定值，这里按 topAlignRow 的实测高度写像素，
       写之前先比对，避免每轮触发重排。 */
    function syncOneCol() {
        if (!applied) return;
        try {
            var row = document.querySelector('[class*="paint-editor_top-align-row_"]');
            var sel = document.querySelector('[class*="paint-editor_mode-selector_"]');
            if (!row || !sel) return;
            var h = row.clientHeight - 2;
            if (h > 40 && sel.__blOneColH !== h) {
                sel.__blOneColH = h;
                sel.style.maxHeight = h + 'px';
            }
        } catch (eOne) { /* ignore */ }
    }

    /* 自适应兜底：对齐开/关，并让造型缩略图跟随持续绘制。
       编辑活跃期 150ms 一次（追上 asset 防抖写回），静息 400ms 一次；
       refresh 内有精确签名 + bestURL 去重，静息时零 DOM 写入。 */
    function loop() {
        try {
            watchHost();
            sync(false);
            syncOneCol();
            if (applied) refresh(false);
        } catch (eLoop) { /* ignore */ }
        setTimeout(loop, Date.now() < editUntil ? 150 : 400);
    }
    setTimeout(loop, 400);

    sync(false);
    watchHost();
    setTimeout(syncOneCol, 220);
    window.addEventListener('resize', function () {
        if (applied) setTimeout(syncOneCol, 60);
    });

    /* [B107] 同帧补挂：首帧扫描不再等各自的定时巡检 */
    if (window.__blSync) window.__blSync.register('B66-thumb', function () {
        try { watchHost(); sync(false); syncOneCol(); if (applied) refresh(false); } catch (eB66) { /* ignore */ }
    }, true);
    })();
