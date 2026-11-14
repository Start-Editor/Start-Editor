
(function () {
    'use strict';
    if (window.__blForceEditor) return;
    window.__blForceEditor = true;

    var TYPE = 'scratch-gui/mode/SET_PLAYER';
    var attached = [];          /* 已处理过的 store（语言切换会重建） */

    function isPlayerState(st) {
        try {
            var m = st && st.scratchGui && st.scratchGui.mode;
            return !!(m && m.isPlayerOnly === true);
        } catch (e) { return false; }
    }

    function attach(store) {
        if (!store || typeof store.getState !== 'function' ||
            typeof store.dispatch !== 'function') return;
        for (var q = 0; q < attached.length; q++) {
            if (attached[q] === store) return;
        }
        attached.push(store);

        /* ── B. 预防层：把「进入播放器」的 action 当场改成回编辑器 ────
           根组件重挂载后，react-redux 的 connect 会重新读取
           store.dispatch，因此这里包装后能拦住新一轮的路由判定。
           只改这一个 action 的字段，thunk（函数）与所有其它 action
           原样交给原 dispatch，返回值也保留。 */
        var orig = store.dispatch;
        if (!orig.__blForceEditor) {
            var wrapped = function (action) {
                if (action && action.type === TYPE && action.isPlayerOnly === true) {
                    action = { type: TYPE, isPlayerOnly: false };
                }
                return orig.call(store, action);
            };
            wrapped.__blForceEditor = true;
            try { store.dispatch = wrapped; } catch (e) { /* 只读则跳过，靠 C 兜底 */ }
        }

        /* ── C. 纠正层：state 已经是播放器 → 立刻回到编辑器 ────────── */
        function tick() {
            try {
                if (isPlayerState(store.getState())) {
                    store.dispatch({ type: TYPE, isPlayerOnly: false });
                }
            } catch (e) { /* ignore */ }
        }
        tick();                                     /* 接上的第一帧就纠正 */
        if (typeof store.subscribe === 'function') {
            try { store.subscribe(tick); } catch (e) { /* ignore */ }
        }

        /* 事件兜底：语言菜单点击、URL/历史变化（路由会重新解析） */
        function later() {
            try { setTimeout(tick, 0); } catch (e) { /* ignore */ }
            try { setTimeout(tick, 80); } catch (e) { /* ignore */ }
            try { setTimeout(tick, 260); } catch (e) { /* ignore */ }
        }
        document.addEventListener('click', function (e) {
            var t = e.target;
            if (t && t.closest && t.closest('[class*="language-menu-item"], [class*="settings-menu_"]')) later();
        }, true);
        window.addEventListener('popstate', later);
        window.addEventListener('hashchange', later);
        window.addEventListener('focus', tick);
        try { setInterval(tick, 400); } catch (e) { /* ignore */ }
    }

    /* ── A. 抓住 store 的每次赋值（含语言切换后的重建） ────────────── */
    var current = window.ReduxStore;
    if (current) attach(current);

    try {
        var desc = Object.getOwnPropertyDescriptor(window, 'ReduxStore');
        if (!desc || desc.configurable !== false) {
            var value = window.ReduxStore;
            Object.defineProperty(window, 'ReduxStore', {
                configurable: true,
                enumerable: true,
                get: function () { return value; },
                set: function (v) {
                    value = v;
                    if (v) { try { attach(v); } catch (e) { /* ignore */ } }
                }
            });
        }
    } catch (e) { /* defineProperty 不可用时走轮询 */ }

    /* 兜底：setter 没抓到（属性不可配置 / 赋值发生在 define 之前）时，
       低频轮询也能把新 store 接上并纠正。 */
    try {
        setInterval(function () {
            var st = window.ReduxStore;
            if (st) { try { attach(st); } catch (e) { /* ignore */ } }
        }, 600);
    } catch (e) { /* ignore */ }
})();
