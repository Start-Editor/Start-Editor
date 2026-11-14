/* ── [B41] __blSettings 统一设置存储 ───────────────────────────────────────────────
   依赖：localStorage
   维护：所有设置读写的唯一入口；改动会广播 storage 事件
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * __blSettings —— 弹窗外观 / 动画 / 按钮 / 八音盒 / Dock 固定的统一设置存储
 * --------------------------------------------------------------------------
 * 这一批需求（弹窗外观、弹窗动画、八音盒、Dock 右键菜单）都需要持久化设置，
 * 统一收敛到这里，避免各写各的 localStorage key 出现不一致。
 *
 * 所有值都走 JSON 存取，读不到就回退默认值。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blSettings) return;

    var K = {
        winAppearance: 'bl:win-appearance',
        winAnimation: 'bl:win-animation',
        winButtons: 'bl:win-buttons',
        musicbox: 'bl:musicbox',
        dockPins: 'bl:dock-pins'
    };

    function read(key, fallback) {
        try {
            var raw = window.localStorage.getItem(key);
            if (raw == null) return fallback;
            var o = JSON.parse(raw);
            return (o && typeof o === 'object') ? o : fallback;
        } catch (e) { return fallback; }
    }
    function write(key, obj) {
        try { window.localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* ignore */ }
    }
    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    /* 各配置的默认值 */
    var DEFAULTS = {
        /* 弹窗外观：阴影 / 圆角 / 透明度 / 颜色 / 背景 / 背景透明度 */
        winAppearance: {
            shadow: 12,           /* 阴影强度 0..40（px 换算） */
            radius: 12,           /* 圆角 0..28 px */
            opacity: 100,         /* 弹窗整体透明度 40..100（%） */
            bgMode: 'auto',       /* 背景 'auto' 自动 | 'custom' 自定义 */
            bgOpacity: 100        /* 背景透明度 0..100 */
        },
        /* 弹窗动画：入场 / 出场 沿用预设；最小化只有 genie / scale 两种 */
        winAnimation: {
            enter: 'fade',        /* fade | scale | slide-up | slide-left | none */
            exit: 'fade',         /* 同上 */
            minimize: 'genie'     /* genie 神灯效果 | scale 缩放效果 */
        },
        /* 弹窗按钮：位置 / 样式 / 图标 */
        winButtons: {
            layout: 'auto',       /* 'auto' 自动 | 'custom' 自定义位置 */
            positions: { min: 'left', max: 'left', close: 'left' }, /* 各按钮顺序占位 */
            /* 自定义顶部栏图标功能已删除，不再保留默认字段 */
            btnStyle: 'mist',     /* 按钮样式 mac | win | mist */
            titlePos: 'left'      /* 标题位置 left | center | right */
        },
        /* 八音盒：模式 / 音效 / 音谱颜色 / 位置 */
        musicbox: {
            mode: 'popup',        /* 'popup' 弹窗 | 'fixed' 固定弹窗 */
            reverb: 25,           /* 混响（原在窗口内，现移到设置） */
            echo: 0,              /* 回响 */
            denoise: 0,           /* 降噪 */
            treble: 0,            /* 高音 */
            bass: 0,              /* 低音 */
            spectrumColor: '',    /* 音谱颜色，空=跟随主题 */
            customSpectrum: false,/* 是否启用自定义音谱色 */
            pos: { right: 20, bottom: 20 } /* 固定弹窗预设位置 */
        },
        /* Dock 固定项 / 图标 */
        dockPins: {
            pinned: [],           /* 固定的 act 列表，如 ['vinyl','star'] */
            icons: {}             /* { act: dataURL } */
        }
    };

    function get(which) {
        var d = DEFAULTS[which] || {};
        var cur = read(K[which], {});
        /* 浅合并：缺的字段用默认补上 */
        var out = {};
        for (var k in d) out[k] = (cur && cur[k] !== undefined) ? cur[k] : d[k];
        return out;
    }
    function set(which, patch) {
        var cur = get(which);
        for (var k in patch) cur[k] = patch[k];
        write(K[which], cur);
        return clone(cur);
    }

    /* 玻璃效果是否开启（毛玻璃 或 液态玻璃 任一开启即视为开启） */
    function isGlassEnabled() {
        try {
            var f = JSON.parse(window.localStorage.getItem('bl:frosted-glass') || 'null');
            if (f && f.enabled) return true;
        } catch (e) { /* ignore */ }
        try {
            var l = JSON.parse(window.localStorage.getItem('bl:liquid-glass') || 'null');
            if (l && l.enabled) return true;
        } catch (e2) { /* ignore */ }
        return false;
    }

    window.__blSettings = {
        keys: K,
        get: get,
        set: set,
        isGlassEnabled: isGlassEnabled,
        defaults: DEFAULTS
    };
})();
