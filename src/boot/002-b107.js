/* ── [B107] 同步注入总线 v3（低负载版） ───────────────────────────────
   依赖：B00 / B01（须在两者之后、所有 webpack chunk 与其它自定义块之前）
   维护：新增 UI（左侧标签 / 设置分区 / DOCK / 卡片 / 按钮 / 装饰增强）与
        原版 DOM 同帧出现，不再「原版已就绪、新选项慢半拍」。
   v3 性能修复（重点）：
     ① 取消 v2 的「MutationObserver 回调内同步全量 tick」——hook 自身改
        DOM 会再触发 MO，微任务级闸门拦不住，形成无限连锁全量扫描，
        这是拖拽积木时整页卡死的主因；
     ② 所有 MO 变更合并到「一次 requestAnimationFrame」——rAF 在浏览器
        绘制之前执行，仍是同帧可见，且天然每帧最多一次；
     ③ 普通变更（Blockly 拖拽每帧插入大量节点）额外做 120ms 节流，
        只跑结构 hook + 轻量 globals；装饰类 low hook 不参与；
     ④ 关键容器（标签栏 / 设置侧栏 / 积木区 / 舞台 / 版本面板）插入
        属于低频事件，立即同帧跑一次全量（含 low），一次就够；
     ⑤ 关键容器按来源分级：React 原生容器才可能触发全量，bl- 自定义
        容器多为装饰模块自身写入，只跑 high-only，从源头掐断连锁；
        isCriticalNode 不再对每个 addedNode 做全子树 querySelector：
        先看 className 正则，只在可能含子容器时查，且每批最多查 8 个，
        大批插入（拖拽）直接当普通变更，零额外查询开销；
     ⑥ 全量扫描加 400ms 冷却：冷却期内关键容器插入改为「同帧
        high-only」，仍保证新增选项同帧出现，但不重复跑装饰扫描；
        running 抑制同步连锁，异常 hook 隔离照旧。
   约定：只调用各模块已幂等的 mount / ensure / tick；各模块原有定时巡检
        全部保留作自愈，本总线不替代、不改动它们。
   说明：独立 MutationObserver，不走 B01 冻结通道；补挂路径不用
        setTimeout / setInterval，避免把补挂推到下一帧之后。 */
(function () {
    'use strict';
    if (window.__blSync) return;
    var hooks = [], pending = false, running = false;
    var ticks = 0, criticalTicks = 0, plainTicks = 0, skipped = 0;
    var frameCritical = false, frameHigh = false, plainPending = false;
    var lastPlain = 0, lastCritical = -1e9, raf = 0, chain = 0;
    var highStreak = 0;
    var PLAIN_GAP = 120;     /* 普通变更（拖拽）节流间隔 */
    var CRIT_GAP = 400;      /* 全量（含装饰扫描）冷却，防自身写入连锁 */
    var HIGH_MAX = 12;       /* 连续同帧 high-only 上限，极端情况下降级 */
    var now = function () {
        return (window.performance && window.performance.now) ?
            window.performance.now() : Date.now();
    };
    var qm = (typeof queueMicrotask === 'function') ? queueMicrotask :
        function (f) { Promise.resolve().then(f); };

    /* 结构补挂：只挑已有全局入口里「轻量、幂等、带签名短路」的那几个。
       样式运行时（外观 / 按钮 / 玻璃）有各自即时事件通道，不在这里跑。 */
    var globals = [
        function () { var f = window.__blVerMount; if (typeof f === 'function') f(); },
        function () { var f = window.__blNoStageApply; if (typeof f === 'function') f(); },
        function () { var o = window.__blStarAISettings; if (o && typeof o.tick === 'function') o.tick(); },
        function () { var f = window.__blSettingsHealTick; if (typeof f === 'function') f(false); },
        function () { var o = window.__blStagePopCtl; if (o && typeof o.tick === 'function') o.tick(); },
        function () { var o = window.__blSnapEnhance; if (o && typeof o.sync === 'function') o.sync(); },
        function () { var o = window.__blUniWindow; if (o && typeof o.sync === 'function') o.sync(); }
    ];

    function tick(reason, critical) {
        if (running) return;
        running = true; ticks++;
        if (critical) criticalTicks++; else plainTicks++;
        var i;
        for (i = 0; i < hooks.length; i++) {
            var h = hooks[i];
            if (h.low && !critical) continue;   /* 普通批不跑装饰扫描 */
            try { h.f(); } catch (e) { /* 单模块失败不影响其它 */ }
        }
        for (i = 0; i < globals.length; i++) {
            try { globals[i](); } catch (e2) { /* ignore */ }
        }
        running = false;
    }

    /* 每帧最多一次：rAF 回调在绘制前，补挂与原版 DOM 同一帧可见。
       后台标签 / 老内核退化为微任务合并，chain 上限防连锁。 */
    function frame() {
        raf = 0; pending = false; chain = 0;
        var t = now();
        if (frameCritical) {
            frameCritical = false; frameHigh = false; plainPending = false;
            highStreak = 0; lastPlain = t; lastCritical = t;
            tick('frame-critical', true);
            return;
        }
        /* 冷却期内的关键容器：同帧只跑结构 hook + globals，
           不跑装饰扫描；连续太久则降级到 120ms 节流。 */
        if (frameHigh) {
            frameHigh = false; plainPending = false;
            highStreak++;
            if (highStreak <= HIGH_MAX) {
                lastPlain = t;
                tick('frame-high', false);
                return;
            }
            highStreak = 0;
            plainPending = true;
        }
        if (plainPending) {
            plainPending = false;
            if (t - lastPlain >= PLAIN_GAP) {
                lastPlain = t;
                tick('frame-plain', false);
            } else {
                skipped++;   /* 拖拽高频期：整帧零扫描 */
            }
        }
    }
    function scheduleFrame() {
        if (pending || running) return;
        pending = true;
        if (typeof window.requestAnimationFrame === 'function' && !document.hidden) {
            try { raf = window.requestAnimationFrame(frame); return; }
            catch (e) { /* 落到微任务兜底 */ }
        }
        if (++chain > 8) { chain = 0; pending = false; return; }
        qm(frame);
    }

    var CRITICAL = /gui_tab-list|gui_tab-panel|modal-sidebar|modal_modal|gui_blocks-wrapper|stage-and-target-wrapper|addon-window|bl-dock-host|bl-ver-history|gui_stage|gui_target/i;
    /* 只有当节点本身可能是「装着关键子容器的外层」时才向下查，且限量 */
    var MAY_WRAP = /gui_|modal_|addon|bl-|page|container|wrapper|body|root/i;
    var CRITICAL_Q = '[class*="gui_tab-list_"],[class*="modal-sidebar_"],[class*="gui_blocks-wrapper_"]';
    function isCriticalNode(n) {
        if (!n || n.nodeType !== 1) return false;
        var c = n.className || '';
        if (typeof c !== 'string') c = (c && c.baseVal) || '';
        if (CRITICAL.test(c)) return true;
        if (!MAY_WRAP.test(c) || !n.querySelector) return false;
        try { return !!n.querySelector(CRITICAL_Q); } catch (e) { return false; }
    }
    /* 返回等级：2 = React 原生关键容器（可全量）；1 = bl- 自定义容器
       （多为总线/装饰模块自身写入，只跑 high-only）；0 = 普通变更。 */
    var OWN = /^bl-|\sbl-|addon-window/i;
    function scanAdded(ns) {
        var level = 0, checked = 0, len = ns.length, cls;
        /* 大批插入（积木拖拽 / 列表渲染）直接按普通批处理，零子树查询 */
        if (len > 40) return 0;
        for (var j = 0; j < len; j++) {
            var n = ns[j];
            if (!n || n.nodeType !== 1) continue;
            cls = String(n.className || '');
            if (CRITICAL.test(cls)) {
                if (OWN.test(cls)) { if (level < 1) level = 1; continue; }
                level = 2; break;
            }
            if (checked < 8 && isCriticalNode(n)) {
                checked++;
                if (OWN.test(cls)) { if (level < 1) level = 1; continue; }
                level = 2; break;
            }
        }
        return level;
    }

    function schedule(level) {
        /* HTML 解析期模块还没加载：hooks 与全局入口都不在，直接空转返回，
           不为每个 script / style 节点排一次帧任务。 */
        if (!hooks.length && typeof window.__blVerMount !== 'function' &&
            !window.__blStarAISettings) return;
        if (running) return;                    /* 抑制总线自身写入连锁 */
        if (level >= 2) {
            if (now() - lastCritical < CRIT_GAP) frameHigh = true;
            else frameCritical = true;
        } else if (level === 1) frameHigh = true;
        else plainPending = true;
        scheduleFrame();
    }

    var api = {
        register: function (name, fn, low) {
            if (typeof fn !== 'function') return;
            for (var i = 0; i < hooks.length; i++) if (hooks[i].n === name) return;
            hooks.push({ n: name, f: fn, low: !!low });
            /* 注册即同步全量：若 React 已把原版 DOM 挂好（语言切换重挂载、
               模块后加载），所有新增选项在本次 script 执行完之前就补齐，
               与「同帧出现」等价，且这条路径完全同步、不会连锁。 */
            tick('register', true);
            lastPlain = now();
        },
        tick: function (r) { tick(r || 'manual', true); },
        flush: function () { tick('flush', true); },
        schedule: function (c) { schedule(c === true ? 2 : (c ? 1 : 0)); },
        status: function () {
            var low = 0, i;
            for (i = 0; i < hooks.length; i++) if (hooks[i].low) low++;
            return { hooks: hooks.length, low: low, globals: globals.length,
                     ticks: ticks, criticalTicks: criticalTicks,
                     plainTicks: plainTicks, skipped: skipped,
                     highStreak: highStreak };
        }
    };
    window.__blSync = api;

    try {
        var mo = new MutationObserver(function (records) {
            for (var i = 0; i < records.length; i++) {
                var r = records[i], ns, j;
                if (r.type === 'childList') {
                    ns = r.addedNodes;
                    var lv = (ns && ns.length) ? scanAdded(ns) : 0;
                    if (lv) { schedule(lv); return; }
                    for (j = 0; j < (ns ? ns.length : 0); j++)
                        if (ns[j].nodeType === 1) { schedule(0); return; }
                    if (r.removedNodes && r.removedNodes.length) { schedule(0); return; }
                } else { schedule(0); return; }
            }
        });
        mo.observe(document.documentElement, { childList: true, subtree: true });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch (e) { /* 老内核：退化为事件驱动 */ }

    /* 低频事件：同步全量，保证首屏与重挂载零延迟 */
    document.addEventListener('DOMContentLoaded', function () { tick('dcl', true); });
    window.addEventListener('load', function () { tick('load', true); });
    window.addEventListener('bl:ui-ready', function () { tick('ready', true); });
    window.addEventListener('bl:sync-tick', function () { tick('manual', true); });
    window.addEventListener('popstate', function () { tick('popstate', true); });
    window.addEventListener('hashchange', function () { tick('hashchange', true); });
    /* 高频事件只排帧任务，走 120ms 节流，不直接全量扫描 */
    document.addEventListener('click', function () { schedule(0); }, true);
    window.addEventListener('storage', function () { schedule(0); });
    tick('boot', true);
    lastPlain = now();
})();
