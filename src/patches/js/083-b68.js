/* ── [B68] 第 12 轮运行时补丁 ───────────────────────────────────────────────
   依赖：B41 / B42
   维护：描边色入口删除后的遗留兜底
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * 第十二轮运行时补丁
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blRound12) return;
    window.__blRound12 = true;

    var REDUCE = false;
    try { REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    /* ---- 1. 侧栏分组「收回」动画 ----
       展开：放行，新插入的项由 CSS 入场动画接管。
       收回：拦截 click，先给现有项播退场，190ms 后再触发原点击。 */
    var HEADER = '[class*="modal-sidebar_groupHeaderButton"]';
    var ITEM = '[class*="modal-sidebar_item_"]';
    document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest(HEADER) : null;
        if (!btn || btn.__blSkip) return;
        if (btn.getAttribute('aria-expanded') !== 'true') return;  /* 展开 */
        var group = btn.closest('[class*="modal-sidebar_group_"]');
        var items = group ? group.querySelectorAll(ITEM) : [];
        if (!items.length || REDUCE) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        for (var i = 0; i < items.length; i++) items[i].classList.add('bl-sidebar-out');
        window.setTimeout(function () {
            /* [B106] 这 190ms 里 React 可能重绘把 header 整片换掉：旧节点
               已脱离文档，click() 打上去折叠不会生效，而 .bl-sidebar-out
               会永远留在旧节点上（animation-fill-mode:both 把 opacity:0 /
               max-height:0 钉死），下次展开整组选项都看不见。 */
            var target = btn;
            if (!target.isConnected) {
                var hs = document.querySelectorAll('[class*="modal-sidebar_groupHeaderButton"]');
                var label = String(btn.textContent || '').trim();
                for (var h = 0; h < hs.length; h++) {
                    if (hs[h].getAttribute('aria-expanded') === 'true' &&
                        String(hs[h].textContent || '').trim() === label) {
                        target = hs[h]; break;
                    }
                }
            }
            if (target.isConnected) {
                target.__blSkip = true;
                try { target.click(); } catch (e) { /* ignore */ }
                window.setTimeout(function () { target.__blSkip = false; }, 0);
            }
            /* 折叠交给 React 后，无论节点是否复用都摘掉退场类残留 */
            window.setTimeout(function () {
                var out = document.querySelectorAll('.bl-sidebar-out');
                for (var k = 0; k < out.length; k++) out[k].classList.remove('bl-sidebar-out');
            }, 60);
        }, 190);
    }, true);

    /* ---- 2. 按钮样式（MAC / WIN / MIST）<-> 窗口样式引擎双向同步 ----
       预设下拉已删除，三种窗口样式由「按钮样式」一个下拉统一驱动。

       ⚠ 旧版只有 preset → 下拉 单向，而 mw:style-window-style 没有任何
       写入端（__blSetWindowPreset 定义了却从未被调用）。结果：用户选 MAC
       写入 bl:win-buttons.btnStyle 后，300ms 轮询 / MutationObserver 仍按
       mistwarp 把下拉改回 mist 并 dispatch change，把用户选择覆盖 ——
       这就是「有时生效错误」，能否保住全看时序。
       现在：下拉 change 立刻回写 preset 形成闭环；启动时以 btnStyle 存档
       为准做一次正向对齐；用户刚操作过的一段时间内不反向覆盖。 */
    var PRESET_KEY = 'mw:style-window-style';
    function presetToStyle(p) {
        return p === 'macos' ? 'mac' : (p === 'windows10' ? 'win' : 'mist');
    }
    function styleToPreset(b) {
        if (b === 'mac') return 'macos';
        if (b === 'win') return 'windows10';
        return 'mistwarp';
    }
    function currentBtnStyle() {
        var b = 'mist';
        try {
            var c = window.__blSettings && window.__blSettings.get('winButtons');
            if (c && c.btnStyle) b = c.btnStyle;
        } catch (e) {
            try {
                var raw = JSON.parse(localStorage.getItem('bl:win-buttons') || '{}');
                if (raw && raw.btnStyle) b = raw.btnStyle;
            } catch (e2) { /* ignore */ }
        }
        if (b === 'rounded') return 'mist';
        if (b === 'square') return 'win';
        if (b === 'circle') return 'mac';
        return b;
    }
    function styleSelects() {
        return [].slice.call(document.querySelectorAll('select')).filter(function (s) {
            var vs = [].slice.call(s.options).map(function (o) { return o.value; });
            return vs.indexOf('mac') >= 0 && vs.indexOf('win') >= 0 && vs.indexOf('mist') >= 0;
        });
    }
    /* 启动正向对齐：历史存档里 btnStyle=mac 而 preset 还是 mistwarp 时，
       以用户的按钮样式为准，别在开页第一帧就把 MAC 冲掉。 */
    function alignPresetFromButtons() {
        var want = styleToPreset(currentBtnStyle());
        try {
            if (localStorage.getItem(PRESET_KEY) !== want) {
                localStorage.setItem(PRESET_KEY, want);
            }
        } catch (e) { /* ignore */ }
    }

    var userSetAt = 0;
    function syncPreset() {
        /* 用户刚改过下拉：此刻 preset 已由 onStyleChange 同步，没必要也没
           资格反向覆盖，直接跳过，避免 change 回环把选择打回 MIST。 */
        if (Date.now() - userSetAt < 1500) return;
        var p;
        try { p = localStorage.getItem(PRESET_KEY) || 'mistwarp'; } catch (e) { p = 'mistwarp'; }
        var v = presetToStyle(p);
        var sels = styleSelects();
        for (var i = 0; i < sels.length; i++) {
            if (sels[i].value !== v) {
                sels[i].value = v;
                try {
                    var ev = new Event('change', { bubbles: true });
                    ev.__blSynthetic = true;
                    sels[i].dispatchEvent(ev);
                } catch (e2) {}
            }
        }
    }
    /* 捕获阶段：用户一改「按钮样式」就立刻回写 preset，闭环成立。 */
    function onStyleChange(e) {
        /* syncPreset 反向对齐下拉时会派发合成 change；不忽略的话会再写
           preset → 又触发 B55 → 又 tick，形成回环把下拉反复改回旧值。 */
        if (e && e.__blSynthetic) return;
        var t = e && e.target;
        if (!t || t.tagName !== 'SELECT' || !t.options) return;
        var vs = [].slice.call(t.options).map(function (o) { return o.value; });
        if (vs.indexOf('mac') < 0 || vs.indexOf('win') < 0 || vs.indexOf('mist') < 0) return;
        userSetAt = Date.now();
        var want = styleToPreset(t.value);
        try {
            if (localStorage.getItem(PRESET_KEY) !== want) localStorage.setItem(PRESET_KEY, want);
        } catch (err) { /* ignore */ }
    }

    alignPresetFromButtons();          /* 必须在注册监听之前，避免自触发 */
    document.addEventListener('change', onStyleChange, true);
    window.addEventListener('storage', function (e) {
        if (!e || e.key === PRESET_KEY) syncPreset();
    });
    window.addEventListener('bl:window-preset', syncPreset);
    var lastPreset = null;
    setInterval(function () {
        var p;
        try { p = localStorage.getItem(PRESET_KEY) || 'mistwarp'; } catch (e) { return; }
        if (p !== lastPreset) { lastPreset = p; syncPreset(); }
    }, 300);
    if (document.body) {
        /* styleSelects() 会全文档扫 <select> 并遍历 options；拖积木时
           DOM 变动风暴会让旧版每批 records 都扫一次。rAF 合并成每帧最多
           一次，且只在确实可能有下拉节点出现时才扫。 */
        var presetRafPending = false;
        new MutationObserver(function (muts) {
            if (presetRafPending) return;
            var maybeSelect = false;
            for (var i = 0; i < muts.length && !maybeSelect; i++) {
                var add = muts[i].addedNodes || [];
                for (var j = 0; j < add.length; j++) {
                    var n = add[j];
                    if (!n || n.nodeType !== 1) continue;
                    if (n.tagName === 'SELECT' ||
                        (n.querySelector && n.querySelector('select'))) { maybeSelect = true; break; }
                }
            }
            if (!maybeSelect) return;
            presetRafPending = true;
            requestAnimationFrame(function () {
                presetRafPending = false;
                if (!styleSelects().length) return;
                syncPreset();
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    /* ---- 3. 自定义顶部栏按钮已删除：清掉历史残留的图标配置 ----
       只清 icon* / scale*，保留按钮位置、样式、标题位置等其它设置。 */
    try {
        var raw = localStorage.getItem('bl:win-buttons');
        if (raw) {
            var c = JSON.parse(raw);
            var changed = false;
            ['iconMin','iconMax','iconClose','scaleMin','scaleMax','scaleClose'].forEach(function (k) {
                if (k in c) { delete c[k]; changed = true; }
            });
            if (changed) localStorage.setItem('bl:win-buttons', JSON.stringify(c));
        }
    } catch (e) { /* ignore */

    }
})();
