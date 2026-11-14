/* ── [B01] 运行时性能优化总线 ───────────────────────────────────────────────
   依赖：无（须在所有其它脚本之前）
   维护：Observer 合并 / qSA 记忆化 / 冻结窗口都在这里
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * __blPerf —— 运行时性能优化层（必须在所有其它脚本之前执行）
 *
 * 问题：本文件注入了 40+ 个 MutationObserver，其中 20+ 个监听
 *       document.body / documentElement 的 childList+subtree，回调里各自
 *       querySelectorAll 扫全文档。拖拽积木 / 加载作品重绘时，每批 DOM
 *       变动都会把它们全部唤醒，产生数万次重复查询，抢占主线程。
 *
 * 对策：
 *   1) 宽泛观察合并为一条总线，单原生 MO + rAF 合并分发；
 *      「关键变动」立即分发，「画布内部高频变动」250ms 校准一次。
 *   2) querySelectorAll 帧内记忆化，DOM 写操作即时失效。
 *   3) 启动期 / 作品加载期冻结后台扫描，解冻时全量校准一次。
 *   4) 兜底轮询统一 >=500ms，页面隐藏时跳过。
 *
 * 精确观察（具体节点 / attributes / characterData）完全走原生，不改语义。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blPerf) return;

    var NativeMO = window.MutationObserver;
    var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function (f) { return setTimeout(f, 16); };
    var P = window.__blPerf = {
        frozen: true,                 /* 启动期冻结；UI 就绪后解冻 */
        ready: false,
        legacy: false,                /* 调试用：true = 关闭节流/缓存，做 A/B 对照 */
        subs: [],                     /* 宽泛观察者 */
        pending: [],                  /* 待分发的关键 records */
        pendingCritical: false,       /* 本帧是否含结构性变动 */
        pendingNoise: false,          /* 本帧是否含画布高频变动 */
        runtimeRunning: false,        /* 作品正在运行：让出主线程给 VM */
        lastCalib: 0,
        stats: { qsaCalls: 0, qsaHits: 0, moCallbacks: 0, moSkipped: 0,
                 timerSkips: 0, fullCalib: 0 }
    };

    /* ---- 帧内 querySelectorAll 记忆化 ---- */
    var uidMap = new WeakMap(), uidSeq = 0, cache = new Map(), dirty = false;
    function uid(o) {
        var v = uidMap.get(o);
        if (!v) { v = ++uidSeq; uidMap.set(o, v); }
        return v;
    }
    /* 启动期（UI 未就绪）完全不介入：React/Blockly 首屏构建会调用几十万次
       appendChild，多一层 hook 反而拖慢启动。 */
    function invalidate() {
        if (!P.ready || P.legacy) return;
        dirty = true; cache.clear();
    }
    function wrapQsa(proto, key) {
        var native = proto[key];
        if (!native) return;
        proto[key] = function (sel) {
            if (!P.ready || P.legacy) return native.apply(this, arguments);
            P.stats.qsaCalls++;
            if (!dirty) {
                var k = uid(this) + '|' + sel;
                var hit = cache.get(k);
                if (hit !== undefined) { P.stats.qsaHits++; return hit; }
            }
            var r = native.apply(this, arguments);
            if (dirty) { dirty = false; cache.clear(); }
            cache.set(uid(this) + '|' + sel, r);
            return r;
        };
    }
    try {
        wrapQsa(Document.prototype, 'querySelectorAll');
        wrapQsa(Element.prototype, 'querySelectorAll');
        wrapQsa(DocumentFragment.prototype, 'querySelectorAll');
    } catch (e) { /* 环境不支持则跳过缓存，功能不受影响 */ }

    /* 任何 DOM 写都让缓存失效，保证同一任务里「写后再查」拿到新结果 */
    ['appendChild', 'insertBefore', 'removeChild', 'replaceChild'].forEach(function (m) {
        var n = Node.prototype[m];
        if (!n) return;
        Node.prototype[m] = function () {
            invalidate();
            /* Blockly.Css.inject 在主题重铺时会试图摘掉一个已经不在
               当前父节点下的 <style>（参数甚至可能是 undefined），
               原生 removeChild 直接抛 TypeError，控制台刷
               "Error updating block colors"。这类调用本来就无事可做，
               在这里拦掉即可，不影响正常的 removeChild 语义。 */
            if (m === 'removeChild') {
                var child = arguments[0];
                if (!child || typeof child.nodeType !== 'number' || child.parentNode !== this) {
                    return child || null;
                }
            }
            return n.apply(this, arguments);
        };
    });
    ['setAttribute', 'removeAttribute', 'removeAttributeNode', 'setAttributeNode'].forEach(function (m) {
        var n = Element.prototype[m];
        if (!n) return;
        Element.prototype[m] = function () { invalidate(); return n.apply(this, arguments); };
    });
    try {
        ['add', 'remove', 'toggle', 'replace'].forEach(function (m) {
            var n = DOMTokenList.prototype[m];
            if (!n) return;
            DOMTokenList.prototype[m] = function () { invalidate(); return n.apply(this, arguments); };
        });
    } catch (e) { /* ignore */ }

    /* ---- 变动分类（增量、O(1) 级别）----
       旧版在 flush 时对每批 records 里的每个节点跑 matches/querySelector，
       反而比省下的查询更贵。改成：收到 record 时立刻用「标签名 + className
       字符串」判一次，结果累计成布尔；非关键变动根本不进 pending 队列。 */
    var HOT_CLASS = /addon-window|modal_|settings-modal_|gui_tab_|menu_|bl-eval|bl-proj|ms-panel|bl-py|dock|win-/;
    var HOT_TAG = { IFRAME: 1, STYLE: 1, LINK: 1, SELECT: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, OPTION: 1 };
    function isCriticalRecord(r) {
        if (r.type === 'attributes') {
            var t = r.target;
            if (t === document.documentElement || t === document.body) return true;
            if (t && t.nodeType === 1) {
                var c = typeof t.className === 'string' ? t.className : '';
                if (HOT_CLASS.test(c)) return true;
            }
            return false;                        /* 画布内部 style/class 不关键 */
        }
        if (r.type !== 'childList') return false;
        var lists = [r.addedNodes, r.removedNodes];
        for (var L = 0; L < 2; L++) {
            var ns = lists[L];
            if (!ns) continue;
            for (var j = 0; j < ns.length; j++) {
                var n = ns[j];
                if (n.nodeType !== 1) continue;
                if (HOT_TAG[n.tagName]) return true;
                var c2 = typeof n.className === 'string' ? n.className : '';
                if (c2 && HOT_CLASS.test(c2)) return true;
            }
        }
        return false;
    }

    var flushRaf = 0;
    function deliver(recs) {
        for (var i = 0; i < P.subs.length; i++) {
            var sub = P.subs[i];
            if (!sub.active) continue;
            P.stats.moCallbacks++;
            try { sub.cb(recs, sub.inst); } catch (e) { /* 单个观察者异常不影响其它 */ }
        }
    }
    function flush() {
        flushRaf = 0;
        var rs = P.pending, key = P.pendingCritical, noise = P.pendingNoise;
        P.pending = []; P.pendingCritical = false; P.pendingNoise = false;
        if (!rs.length && !noise) return;
        if (P.frozen) return;                     /* 冻结期丢弃，解冻时统一校准 */
        if (P.legacy) { deliver(rs); return; }    /* A/B 对照：完全不节流 */
        var now = Date.now();
        if (key) {                               /* 结构性变动：立即分发 */
            P.lastCalib = now;
            deliver(rs);
        } else if (P.runtimeRunning) {
            /* 第 35 轮：作品运行时，舞台/监视器/造型每帧都在改 DOM，
               这些全是画布噪声。此时把 34 个全文档订阅整体挂起，
               主线程全部让给 VM 执行与渲染；运行结束由调度器统一校准一次。
               用户此时打开设置/窗口属于 critical，上面那条分支仍会立即响应。 */
            P.stats.moSkipped += P.subs.length;
        } else if ((now - P.lastCalib) >= 250) { /* 画布高频变动：250ms 校准一次 */
            P.lastCalib = now;
            deliver([]);
        } else {
            P.stats.moSkipped += P.subs.length;
        }
    }
    var bus = null, busStarted = false;
    function busCb(recs) {
        if (P.frozen) return;
        var critical = false, noise = false;
        for (var i = 0; i < recs.length; i++) {
            var r = recs[i];
            if (isCriticalRecord(r)) { P.pending.push(r); critical = true; }
            else noise = true;
        }
        if (critical) P.pendingCritical = true;
        if (noise) P.pendingNoise = true;
        if (!flushRaf) flushRaf = raf(flush);
    }
    /* 关键：启动期不建立全文档观察。React/Blockly 首屏构建会产生海量
       records，以前 20+ 个 observer 各收一遍；现在统一延后到 UI 就绪。 */
    function startBus() {
        if (busStarted || !NativeMO) return;
        busStarted = true;
        bus = new NativeMO(busCb);
        P.bus = bus;
        try {
            bus.observe(document.documentElement, {
                childList: true, subtree: true, attributes: true, characterData: false,
                attributeFilter: ['class', 'style', 'data-theme', 'src', 'href', 'value', 'checked']
            });
        } catch (e) { /* ignore */ }
    }

    /* ---- 包装 MutationObserver ---- */
    function Wrapped(cb) {
        this._cb = cb;
        this._broad = false;
        this._native = null;          /* 精确观察才创建原生实例，宽泛观察走总线 */
        this.active = true;
        this.inst = this;
    }
    function nativeFor(w) {
        if (w._native) return w._native;
        w._native = new NativeMO(function (recs, inst) {
            P.stats.moCallbacks++;
            try { w._cb(recs, inst); } catch (e) { /* ignore */ }
        });
        return w._native;
    }
    Wrapped.prototype = Object.create(NativeMO.prototype);
    Wrapped.prototype.constructor = Wrapped;
    Wrapped.prototype.observe = function (target, options) {
        var o = options || {};
        var isDoc = (target === document.body || target === document.documentElement ||
                     target === document || target === document.head);
        /* 所有「全文档 + subtree」观察都进总线，无论是否带 attributes。
           总线用超集 options 观察，回调收到的 records 是超集，语义不变。 */
        var broad = isDoc && o.subtree;
        if (broad) {
            this._broad = true;
            this.cb = this._cb;
            if (P.subs.indexOf(this) < 0) P.subs.push(this);
            return;
        }
        /* 精确观察：完全透传原生，保持同步语义 */
        try { nativeFor(this).observe(target, o); } catch (e) { /* ignore */ }
    };
    Wrapped.prototype.disconnect = function () {
        this.active = false;
        try { if (this._native) this._native.disconnect(); } catch (e) {}
        var i = P.subs.indexOf(this); if (i >= 0) P.subs.splice(i, 1);
    };
    Wrapped.prototype.takeRecords = function () {
        try { return this._native ? this._native.takeRecords() : []; } catch (e) { return []; }
    };
    if (NativeMO) window.MutationObserver = Wrapped;

    /* ---- 冻结 / 解冻 ---- */
    function calibrateAll() {
        P.stats.fullCalib++;
        P.pending.length = 0;
        P.pendingCritical = false; P.pendingNoise = false;
        P.lastCalib = Date.now();
        deliver([]);                 /* 空批次 = 让所有订阅者做一次全量校准 */
    }
    P.freeze = function () { P.frozen = true; };
    /* defer=true：作品加载完成后用，校准放下一帧，让 loadProject 的
       Promise 尽快 resolve，不把 30+ 个订阅者的全量扫描算进加载耗时。 */
    P.unfreeze = function (defer) {
        if (!P.frozen) return;
        P.frozen = false;
        startBus();
        if (defer) {
            try { raf(function () { calibrateAll(); }); } catch (e) { calibrateAll(); }
            return;
        }
        /* 启动期：立即校准一次，再在首帧后补一次（覆盖 React 同帧补挂） */
        try { calibrateAll(); } catch (e) {}
        try { raf(function () { calibrateAll(); }); } catch (e2) {}
    };
    /* 作品加载期间的临时冻结（可嵌套计数） */
    var freezeDepth = 0;
    P.hold = function () { if (P.legacy) return; freezeDepth++; P.frozen = true; };
    P.release = function () {
        if (P.legacy) return;
        freezeDepth = Math.max(0, freezeDepth - 1);
        if (!freezeDepth && P.ready) P.unfreeze(true);
    };

    /* ---- 中央 UI-ready 探测：一个 50ms 定时器取代各自为政的启动轮询 ---- */
    function ready() {
        return !!(document.querySelector('ul[class*="gui_tab-list_"]') &&
                  document.querySelector('.blocklySvg'));
    }
    var probe = window.setInterval(function () {
        if (!ready()) return;
        window.clearInterval(probe);
        P.ready = true;
        P.unfreeze();
        try { window.dispatchEvent(new CustomEvent('bl:ui-ready')); } catch (e) {}
    }, 50);
    if (ready()) { window.clearInterval(probe); P.ready = true; P.unfreeze(); }

    /* ---- 兜底轮询：统一 >=500ms、隐藏页跳过 ---- */
    var nativeSI = window.setInterval;
    window.setInterval = function (fn, delay) {
        if (typeof fn === 'function' && typeof delay === 'number' &&
            delay >= 150 && delay <= 2500) {
            var d = delay < 500 ? 500 : delay;
            return nativeSI(function () {
                if (document.visibilityState === 'hidden') { P.stats.timerSkips++; return; }
                if (P.frozen && P.ready) { P.stats.timerSkips++; return; }  /* 作品加载期间 */
                fn();
            }, d);
        }
        return nativeSI(fn, delay);
    };
})();
