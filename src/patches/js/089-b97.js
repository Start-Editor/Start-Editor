/* ── [B97] 作品预编译缓存 · 放下积木即后台生成三种格式 ─────────────────
   依赖：VM / B94 STAR / B73 __blFormatIO
   维护：把「点击保存后再序列化」提前到每次积木变更的空闲期
   ------------------------------------------------------------------
   用户说的「预编译」在这里落到可观测的耗时上：点保存到电脑之后真正
   花时间的是 vm.saveProjectSb3() 的整包序列化 + STAR/RJ 二次打包。
   本块在每次放下积木（BLOCK_DRAG_END）、积木字段修改、角色/造型变更
   （PROJECT_CHANGED / workspaceUpdate / targetsUpdate）之后，于空闲期
   把作品序列化成 SB3 / STAR / RJ 三份字节并缓存；点保存时直接取缓存，
   通常零等待。

   一致性保证：
     · gen（变更代号）递增即把缓存判脏，绝不交付过期作品；
     · 捕获期间发生的变更记 dirty，捕获结束立刻再排一轮；
     · 正在捕获时点保存，复用同一个 Promise，不重复序列化；
     · 作品载入期（__blProjectLoading）只判脏不预编译，避免加载抖动；
     · 大作品连续拖动用防抖合并，BLOCK_DRAG_END 用 260ms，其余 850ms。
   ========================================================================== */
(function () {
    'use strict';
    if (window.__blPrecompiled) return;

    var gen = 0, clean = false, dirty = false, capturing = false;
    var sb3 = null, star = null, rj = null;
    var pending = null, pendingGen = -1, timer = 0, vmRef = null;

    function vmObj() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            var v = (st && st.scratchGui && st.scratchGui.vm) || window.vm;
            return (v && typeof v.saveProjectSb3 === 'function') ? v : null;
        } catch (e) { return null; }
    }
    function toU8(d) {
        if (!d) return null;
        if (d instanceof Uint8Array) return d;
        if (typeof ArrayBuffer !== 'undefined' && d instanceof ArrayBuffer) return new Uint8Array(d);
        if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(d))
            return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
        return null;
    }
    function idle(fn) {
        if (window.requestIdleCallback) {
            try { window.requestIdleCallback(fn, { timeout: 900 }); return; } catch (e) {}
        }
        window.setTimeout(fn, 48);
    }
    function now() {
        return (window.performance && performance.now) ? performance.now() : Date.now();
    }

    /* 三种格式一次生成：SB3 是 VM 序列化结果，STAR / RJ 在它之上再打包 */
    function buildVariants(u8, my) {
        if (my !== gen) return;
        try {
            var IO = window.__blStarIO;
            star = (IO && typeof IO.pack === 'function') ? IO.pack(u8) : null;
        } catch (e) { star = null; }
        try {
            var F = window.__blFormatIO;
            rj = (F && F.write && F.sb3ToRj && F.readAll)
                ? F.write(F.sb3ToRj(F.readAll(u8))) : null;
        } catch (e2) { rj = null; }
    }
    function afterCapture() {
        capturing = false;
        if (!dirty) return;
        dirty = false;
        gen++;
        clean = false; star = null; rj = null;
        window.clearTimeout(timer);
        timer = window.setTimeout(precompile, 260);
    }
    function capture() {
        var v = vmObj();
        if (!v) return Promise.reject(new Error('编辑器还没准备好'));
        capturing = true;
        var my = gen, t0 = now();
        return Promise.resolve().then(function () {
            return v.saveProjectSb3('arraybuffer');
        }).then(function (buf) {
            var u8 = toU8(buf);
            if (!u8 || !u8.length) throw new Error('拿不到作品数据');
            var hit = (my === gen);
            if (hit) { sb3 = u8; clean = true; buildVariants(u8, my); }
            return { sb3: u8, star: hit ? star : null, rj: hit ? rj : null,
                     hit: hit, ms: now() - t0, gen: gen };
        }).then(function (r) { afterCapture(); return r; },
                function (e) { afterCapture(); throw e; });
    }
    function startCapture() {
        var p = capture();
        pending = p; pendingGen = gen;
        p.then(function () {}, function () {}).then(function () {
            if (pending === p) { pending = null; pendingGen = -1; }
        });
        return p;
    }
    function precompile() {
        if (window.__blProjectLoading) { clean = false; return; }
        /* pending 必然对应一次正在进行的捕获；期间发生的变更由
           invalidate 记 dirty，afterCapture 会自己再排一轮，这里直接
           返回即可，避免同一轮启两次序列化。 */
        if (pending) return;
        idle(function () {
            if (window.__blProjectLoading || clean || pending || capturing) return;
            startCapture().then(function () {}, function () {});
        });
    }
    function invalidate(delay) {
        /* 载入期事件成片到达：只判脏，等 PROJECT_LOADED 后再预编译 */
        if (window.__blProjectLoading) { clean = false; return; }
        if (capturing) { dirty = true; return; }
        gen++;
        clean = false; star = null; rj = null;
        window.clearTimeout(timer);
        timer = window.setTimeout(precompile, delay);
    }

    /* ---------------- 事件源 ---------------- */
    var EVENTS = [
        { name: 'PROJECT_CHANGED', d: 850 },
        { name: 'BLOCK_DRAG_END', d: 260 },        /* 放下一个积木 */
        { name: 'BLOCK_DRAG_UPDATE', d: 1100 },
        { name: 'workspaceUpdate', d: 850 },
        { name: 'targetsUpdate', d: 850 },
        { name: 'PROJECT_LOADED', d: 1200 },
        { name: 'EXTENSION_ADDED', d: 850 },
        { name: 'EXTENSION_REMOVED', d: 850 }
    ];
    function attach(v) {
        if (!v || v.__blPreAttach || typeof v.on !== 'function') return false;
        for (var i = 0; i < EVENTS.length; i++) {
            (function (ev) {
                try { v.on(ev.name, function () { invalidate(ev.d); }); } catch (e) {}
            })(EVENTS[i]);
        }
        v.__blPreAttach = true;
        vmRef = v;
        return true;
    }
    /* DOM 兜底：字段数值输入、粘贴积木等不一定发 VM 事件 */
    function onDom(e) {
        var t = e.target;
        if (!t || !t.closest) return;
        try {
            if (t.closest('[class*="blockly"], [class*="gui_blocks-wrapper_"], .blocklySvg, [class*="scratchBlocks"]'))
                invalidate(900);
        } catch (err) { /* ignore */ }
    }
    document.addEventListener('pointerup', onDom, true);
    document.addEventListener('keyup', onDom, true);
    document.addEventListener('change', onDom, true);

    /* VM 可能在 React 重绘后换实例，低频巡检重新挂监听 */
    var tries = 0;
    var boot = window.setInterval(function () {
        var v = vmObj();
        if (v && v !== vmRef) attach(v);
        tries++;
        /* 载入结束、或某次捕获失败后，低频自动补一次，保证缓存最终就绪；
           precompile 内部有 clean / pending / 载入期多重短路，静息零成本。 */
        if (tries % 4 === 0 && !clean && !pending && !capturing &&
            !window.__blProjectLoading && vmObj()) precompile();
        if (tries > 300) window.clearInterval(boot);
    }, 500);

    /* ---------------- 对外接口 ---------------- */
    window.__blPrecompiled = {
        /* 点保存时调：clean 命中即零等待；否则复用在途捕获或现取一次 */
        get: function () {
            if (clean && sb3) {
                if (!star || !rj) buildVariants(sb3, gen);
                return Promise.resolve({ sb3: sb3, star: star, rj: rj, hit: true, ms: 0, gen: gen });
            }
            if (pending && pendingGen === gen) return pending;
            return startCapture();
        },
        invalidate: invalidate,
        status: function () {
            return { clean: clean, gen: gen, busy: !!pending,
                     bytes: sb3 ? sb3.length : 0,
                     hasStar: !!star, hasRj: !!rj,
                     vm: !!vmObj(), vmAttached: !!(vmRef && vmRef.__blPreAttach) };
        },
        /* 调试用：强制丢弃缓存 */
        drop: function () { invalidate(0); }
    };
})();
