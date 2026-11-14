/* ── [B48] 窗口样式引擎 ───────────────────────────────────────────────
   依赖：B41
   维护：按钮样式 → 窗口预设的映射，切换时主动刷新
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * __blWinPresetRuntime —— 窗口样式引擎（由「按钮样式」MAC / WIN / MIST 驱动）
 * mistwarp（默认）/ macos（红黄绿圆点，左侧）/ windows10（直角）
 * 读取 mw:style-window-style，注入等效 CSS（不依赖外部 macos.css/windows10.css）。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blWinPresetRuntime) return;

    var KEY = 'mw:style-window-style';
    var LEGACY_ID = 'bl-win-preset-style';

    function read() {
        try { var v = localStorage.getItem(KEY); return v || 'mistwarp'; } catch (e) { return 'mistwarp'; }
    }

    /* 按钮样式 CSS 现在由 [B66] 唯一注入（它同时生成 MAC 圆点 / WIN 直角 /
       按钮左右 order / 标题对齐）。这里把旧的第二张表彻底摘掉：
       两张表谁排在 head 末尾曾决定同权重 !important 规则谁赢，是
       「有时生效错误」的直接来源。 */
    function dropLegacy() {
        var old = document.getElementById(LEGACY_ID);
        if (old && old.parentNode) {
            try { old.parentNode.removeChild(old); } catch (e) { /* ignore */ }
        }
    }
    function apply() {
        dropLegacy();
        try {
            if (window.__blWinButtonsRuntime) window.__blWinButtonsRuntime.tick();
        } catch (e) { /* ignore */ }
    }
    /* 不再有 last 缓存和 900ms 慢轮询：任何一次写入都立刻转发给 [B66]。 */
    function tick() { apply(); }

    window.addEventListener('storage', function (e) {
        if (e && e.key === KEY) tick();
    });
    setInterval(dropLegacy, 1000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
    else tick();

    /* 供设置页调用的 bridge：写 preset 的同时把按钮样式的唯一来源
       bl:win-buttons.btnStyle 一并对齐，避免两者各自跑一半。 */
    window.__blSetWindowPreset = function (v) {
        var b = v === 'macos' ? 'mac' : (v === 'windows10' ? 'win' : 'mist');
        try {
            if (window.__blSettings) window.__blSettings.set('winButtons', { btnStyle: b });
        } catch (e) { /* ignore */ }
        try { localStorage.setItem(KEY, v); } catch (e2) { /* ignore */ }
        tick();
    };

    window.__blWinPresetRuntime = { apply: apply, tick: tick, read: read };
})();
