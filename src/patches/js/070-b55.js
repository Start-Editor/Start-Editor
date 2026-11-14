/* ── [B55] 设置写入即时生效 ───────────────────────────────────────────────
   依赖：B41 / B34 / B42
   维护：同页 storage 广播 + 各运行时 tick
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * 设置写入即时生效（Live Settings）
 * --------------------------------------------------------------------------
 * 同一文档里 localStorage.setItem 不会派发 storage 事件，各个运行时只能靠
 * 700~900ms 轮询兜底 —— 这正是「拖动没反应」「毛玻璃要等一下才生效」
 * 「隐藏 DOCK 要等一下才切」的共同来源。
 *
 * 这里统一 hook setItem / removeItem：命中关心的 key 就立刻
 *   1) 手动派发一个 StorageEvent，唤醒所有 window.addEventListener('storage')
 *      的模块（DOCK 迁移、液态玻璃互锁、窗口外观运行时…）；
 *   2) 主动调用已暴露的 sync / tick（毛玻璃补充样式表、按钮、预设…）；
 *   3) 下一帧再补一次，覆盖「React 刚重渲染完」的时序。
 * 轮询全部保留，只作为兜底。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blLiveSettings) return;
    window.__blLiveSettings = true;

    var WATCH = {
        'bl:frosted-glass': 1,
        'bl:liquid-glass': 1,
        'bl:win-appearance': 1,
        'bl:win-buttons': 1,
        'bl:win-animation': 1,
        'bl:musicbox': 1,
        'bl:dock-hidden': 1,
        'bl:dock-pins': 1,
        'mw:style-window-style': 1
    };

    function fireStorage(key, val) {
        try {
            if (typeof StorageEvent === 'function') {
                window.dispatchEvent(new StorageEvent('storage', {
                    key: key,
                    newValue: val == null ? null : String(val),
                    oldValue: null,
                    url: location.href,
                    storageArea: window.localStorage
                }));
            }
        } catch (e) { /* ignore */ }
    }

    function call(objPath) {
        try {
            var o = window, i;
            for (i = 0; i < objPath.length - 1; i++) {
                o = o[objPath[i]];
                if (!o) return;
            }
            var fn = o[objPath[objPath.length - 1]];
            if (typeof fn === 'function') fn();
        } catch (e) { /* ignore */ }
    }

    function tickAll() {
        /* 毛玻璃补充样式表（菜单 / 搜索框 / 新增窗口内容区） */
        call(['__blGlassSync']);
        /* 窗口外观 / 按钮。
           ⚠ __blWinPresetRuntime.tick 只是 dropLegacy + 转发按钮运行时，
           以前和按钮 tick 一起调，一次写入会把按钮 tick 跑两遍；去掉。 */
        call(['__blWinAppearanceRuntime', 'tick']);
        call(['__blWinButtonsRuntime', 'tick']);
        /* 液态玻璃暴露的 set 会写回存储，不能调；它的 storage 监听已由 fireStorage 唤醒 */
    }

    /* 写入 → 运行时之间加一条明确通道。StorageEvent 在 iframe / 某些
       沙盒里可能收不到，而直接 call 又依赖对象路径没被改名；双保险。 */
    var EVENT_BY_KEY = {
        'bl:win-appearance': 'bl:win-appearance-change',
        'bl:win-buttons': 'bl:win-buttons-change',
        'bl:win-animation': 'bl:win-animation-change',
        'bl:frosted-glass': 'bl:glass-change',
        'bl:liquid-glass': 'bl:glass-change',
        'mw:style-window-style': 'bl:window-preset'
    };

    /* ==================================================================
       玻璃事件的唯一出口（本轮新增）
       为什么要「合并到宏任务末尾」而不是同步派发：
         · 互斥裁决一轮里会连写两次（先写液态 / 再关毛玻璃），同步派发会让
           监听方读到中间态，把刚打开的玻璃按旧状态回退；
         · 液态模块的 onGlassChange 有 glassBusy 防回环，同步派发正好撞上
           时会被直接 return 丢弃，且之后再没有补发 → 永久失效；
         · 写入可能来自设置页 / 液态 UI / B55 hook / 其它标签页多个入口，
           统一出口 + pending 保证一个事件循环只派发一次，读到最终态。
       B01 不代理 setTimeout，也不受性能总线冻结影响（这是关键点：
       MutationObserver 总线和轮询在启动期 / 加载作品期会被冻结）。
       ================================================================== */
    var glassEmitPending = false;
    function emitGlassChange() {
        if (glassEmitPending) return;
        glassEmitPending = true;
        try {
            window.setTimeout(function () {
                glassEmitPending = false;
                try {
                    if (typeof CustomEvent === 'function') {
                        window.dispatchEvent(new CustomEvent('bl:glass-change'));
                    } else {
                        var ev = document.createEvent('Event');
                        ev.initEvent('bl:glass-change', false, false);
                        window.dispatchEvent(ev);
                    }
                } catch (e) { /* ignore */ }
            }, 0);
        } catch (e2) { glassEmitPending = false; }
    }
    /* 供液态玻璃模块复用同一个 pending，避免两个模块各派一次 */
    try { window.__blGlassEmit = emitGlassChange; } catch (e3) { /* ignore */ }

    function fireChange(key) {
        var name = EVENT_BY_KEY[key];
        if (!name) return;
        if (name === 'bl:glass-change') { emitGlassChange(); return; }
        try { window.dispatchEvent(new Event(name)); } catch (e) { /* ignore */ }
    }

    /* 滑杆拖动会连续写存储：同帧合并成「同步一次 + rAF 补一次」，
       既保证 0ms 响应，又不会每个 input 事件跑一整套 tick。 */
    var framePending = false;
    function onKey(key, val) {
        if (!Object.prototype.hasOwnProperty.call(WATCH, key)) return;
        fireStorage(key, val);
        fireChange(key);
        if (framePending) return;
        framePending = true;
        tickAll();
        try {
            requestAnimationFrame(function () {
                framePending = false;
                tickAll();
            });
        } catch (e) { framePending = false; /* ignore */ }
    }

    try {
        var origSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, val) {
            var r = origSet.apply(this, arguments);
            try { onKey(String(key), String(val)); } catch (e) { /* ignore */ }
            return r;
        };
        var origRemove = Storage.prototype.removeItem;
        Storage.prototype.removeItem = function (key) {
            var r = origRemove.apply(this, arguments);
            try { onKey(String(key), null); } catch (e) { /* ignore */ }
            return r;
        };
    } catch (e) { /* Storage 被沙盒禁用时，轮询仍是兜底 */ }

    /* iframe / srcdoc 里的设置页通过 postMessage 把改动送回父窗口，
       父窗口写入备份键时再补一次刷新（自定义设置页在主文档，这里是双保险）。 */
    window.addEventListener('message', function (e) {
        var d = e && e.data;
        if (!d || (typeof d.__blAddonSaveOne !== 'string' && !d.__blAddonSave)) return;
        try { tickAll(); } catch (e2) { /* ignore */ }
    });
})();
