
/* ── [B75] 运行时自适应帧率调度器 ──────────────────────────────────
   依赖：B01 性能总线 / VM frameLoop / B73 工具箱性能模式
   维护：作品运行帧率、滞回控制、运行态降噪、指标暴露
   ───────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    /* 设计要点
       ------------------------------------------------------------------
       TurboWarp 系的 frameLoop 构造时 setFramerate(30)，作品动画与
       sequencer 调度都被钉在 30Hz；显示器却是 60Hz，一半的帧空转。
       直接写死 60 会在重负载作品上掉帧，也会让「无等待 forever 循环」
       这类依赖帧时序的作品跑快一倍 —— 所以这里用一个滞回反馈控制器：

         · 每帧测 runtime._step 的真实耗时（不是 rAF 间隔，那个恒 16.7ms）
         · 连续「忙」→ 回落到 30Hz，保证不掉帧
         · 连续「闲」→ 升回 60Hz，动画更顺、循环每秒执行更多
         · 切换最小间隔 2s，避免抖动；切档时不动任何作品数据
         · 用户可在工具箱「性能模式」里锁定档位，锁定时控制器只观测不干预

       配套的运行态降噪在 B01：作品跑起来后，34 个全文档订阅不再被
       舞台/监视器的每帧 DOM 变动唤醒，主线程全部让给 VM。 */

    var CFG_KEY = 'bl:runtime-fps';       /* 'auto' | '30' | '60' | '0'(锁定自适应) */
    var BUSY_UP = 22;                     /* ms：单帧 step 明显超预算才视为忙 */
    var BUSY_DOWN = 10;                   /* ms：低于此值视为有余量 */
    var DROP_MS = 32;                     /* rAF 间隔超过此值 = 掉帧（真正的拥塞信号） */
    var MIN_HOLD = 2000;                  /* 两次切档最小间隔 ms */
    var LOW_HOLD = 6000;                  /* 降到 30Hz 后至少保持这么久，避免来回切 */
    var SAMPLE_MAX = 64;

    var vm = null, runtime = null;
    var running = false;
    var locked = 0;                       /* 0=自适应 / 30 / 60 */
    var curFps = 30, targetFps = 60;
    var samples = [];
    var lastSwitch = 0, lastEval = 0, lowAt = 0;
    var dropCount = 0, rafWatchId = 0, rafLast = 0;
    var stats = { steps: 0, switches: 0, upgrades: 0, downgrades: 0,
                  avgStepMs: 0, runningFrames: 0, drops: 0, noiseSaved: 0 };
    var origStep = null, origGreenFlag = null, origStopAll = null;

    function readCfg() {
        try {
            var raw = localStorage.getItem(CFG_KEY);
            if (raw) {
                var v = parseInt(raw, 10);
                if (v === 30 || v === 60) { locked = v; return; }
                if (raw === '30' || raw === '60') { locked = parseInt(raw, 10); return; }
            }
        } catch (e) { /* ignore */ }
        locked = 0;
    }

    function getVM() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            return st && st.scratchGui && st.scratchGui.vm;
        } catch (e) { return null; }
    }

    function applyFps(fps, why, force) {
        if (!vm || typeof vm.setFramerate !== 'function') return false;
        if (curFps === fps) return false;
        var now = Date.now();
        /* 升档与手动锁定要限频（避免抖动）；掉帧保护是紧急路径，必须能立刻降。 */
        if (!force && now - lastSwitch < MIN_HOLD && lastSwitch) return false;
        try {
            vm.setFramerate(fps);            /* 内部会 _restart()，所以必须限频 */
            curFps = fps;
            lastSwitch = now;
            stats.switches++;
            if (fps > 30) stats.upgrades++; else stats.downgrades++;
            if (window.console && console.info) {
                // 不刷屏：只在 debug 开关下输出
                if (window.__blRuntimePerfDebug) console.info('[RuntimePerf] ' + why + ' → ' + fps + 'Hz');
            }
            return true;
        } catch (e) { return false; }
    }

    /* 逐帧测真实 step 耗时。_step 已被别的 addon 包过几层，这里只包最外层。 */
    function wrapStep() {
        if (!runtime || origStep || typeof runtime._step !== 'function') return;
        origStep = runtime._step;
        runtime._step = function () {
            var t0 = performance.now();
            var r;
            try { r = origStep.apply(this, arguments); }
            finally {
                var dt = performance.now() - t0;
                stats.steps++;
                if (running) {
                    stats.runningFrames++;
                    samples.push(dt);
                    if (samples.length > SAMPLE_MAX) samples.shift();
                }
            }
            return r;
        };
        runtime.__blStepWrapped = true;
    }

    /* 拥塞判据用「rAF 掉帧」而不是单帧 step 耗时：
       step 在无等待 forever 循环里恒等于 0.75×预算（30Hz=25ms / 60Hz=12.5ms），
       拿它当负载信号会把 60Hz 误判成忙、来回切档。真正该保护的是画面不掉帧。 */
    function rafWatch(ts) {
        if (!running) { rafWatchId = 0; return; }
        if (rafLast) {
            var dt = ts - rafLast;
            if (dt > DROP_MS) { dropCount++; stats.drops++; }
        }
        rafLast = ts;
        evaluate();
        rafWatchId = requestAnimationFrame(rafWatch);
    }

    function evaluate() {
        var now = Date.now();
        if (now - lastEval < 150) return;
        lastEval = now;
        var avg = 0;
        for (var i = 0; i < samples.length; i++) avg += samples[i];
        stats.avgStepMs = samples.length ? +(avg / samples.length).toFixed(2) : 0;
        if (locked) return;                /* 用户锁定档位：只观测，不干预 */

        /* 降档：以「实际掉帧」为充分信号。
           渲染慢、GPU 忙这类瓶颈不一定反映在 step 耗时上，所以不再要求
           avgStepMs 超阈值；连续掉帧就直接回落到 30Hz 保画面。 */
        if (dropCount >= 2 && curFps > 30) {
            dropCount = 0;
            if (applyFps(30, '出现掉帧', true)) lowAt = now;
        } else if (curFps < 60 && dropCount === 0 &&
                   stats.avgStepMs < BUSY_DOWN && now - lowAt > LOW_HOLD) {
            /* 升档：无掉帧、step 有余量、且距上次降档足够久 */
            applyFps(60, '主线程有余量');
        }
        /* 每 3 秒清空一次掉帧窗口，防止历史掉帧永久压住档位 */
        if (now - (window.__blDropWindowAt || 0) > 3000) {
            window.__blDropWindowAt = now;
            dropCount = 0;
        }
    }

    /* 运行态：置 B01 标志 + 启动帧率采样；结束时统一校准一次 */
    function setRunning(on) {
        if (running === on) return;
        running = on;
        var P = window.__blPerf;
        if (P) P.runtimeRunning = on;
        if (on) {
            samples = []; dropCount = 0; rafLast = 0;
            stats.runningFrames = 0;
            if (!locked) {
                /* 起步就给 60Hz；只有真正掉帧才由滞回控制器回落 */
                applyFps(60, '作品启动');
            }
            if (!rafWatchId) rafWatchId = requestAnimationFrame(rafWatch);
        } else {
            /* 运行结束：补一次全量校准，把运行期挂起的 DOM 订阅对齐回来 */
            if (P && typeof P.unfreeze === 'function') {
                try { P.unfreeze(true); } catch (e) { /* ignore */ }
            }
            /* 不在这里切回 30Hz：停止状态没有线程，切档只会触发 frameLoop
               _restart()，还会用 MIN_HOLD 锁住下一次 greenFlag 的升档，
               表现为「连着跑两个作品，第二个反而只有 30Hz」。 */
        }
        try { window.dispatchEvent(new CustomEvent('bl:runtime-state', { detail: { running: on } })); }
        catch (e) { /* ignore */ }
    }

    function bindVM() {
        vm = getVM();
        if (!vm || vm.__blRuntimePerfBound) return false;
        runtime = vm.runtime;
        if (!runtime) return false;
        vm.__blRuntimePerfBound = true;
        wrapStep();

        /* 双保险：实例方法 + runtime 事件，任一路径启动作品都能切状态 */
        if (typeof vm.greenFlag === 'function') {
            origGreenFlag = vm.greenFlag;
            vm.greenFlag = function () {
                setRunning(true);
                return origGreenFlag.apply(this, arguments);
            };
        }
        if (typeof vm.stopAll === 'function') {
            origStopAll = vm.stopAll;
            vm.stopAll = function () {
                var r = origStopAll.apply(this, arguments);
                setRunning(false);
                return r;
            };
        }
        ['PROJECT_RUN_START', 'PROJECT_RUN_STOP'].forEach(function (ev) {
            try {
                runtime.on(ev, function () { setRunning(ev === 'PROJECT_RUN_START'); });
            } catch (e) { /* ignore */ }
        });
        /* VM 可能已经处于运行态（热重载 / iframe） */
        try { if (runtime.threads && runtime.threads.length) setRunning(true); } catch (e) { /* ignore */ }
        return true;
    }

    readCfg();
    /* VM 由 React 异步挂载，低频探测直到就绪；就绪后不再轮询 */
    var tries = 0;
    var probe = window.setInterval(function () {
        tries++;
        if (bindVM() || tries > 120) window.clearInterval(probe);
    }, 250);

    /* 外部接口：工具箱性能模式、设置页、帧率面板都从这里读写 */
    window.__blRuntimePerf = {
        lock: function (fps) {
            fps = parseInt(fps, 10) || 0;
            locked = (fps === 30 || fps === 60) ? fps : 0;
            if (locked) applyFps(locked, '手动锁定', true);
            return locked;
        },
        setMode: function (v) {
            try {
                localStorage.setItem(CFG_KEY, String(v));
                readCfg();
                if (locked) applyFps(locked, '配置', true);
                return locked;
            } catch (e) { return -1; }
        },
        running: function () { return running; },
        fps: function () { return curFps; },
        target: function () { return locked || targetFps; },
        stats: function () { return JSON.parse(JSON.stringify(stats)); },
        /* 供工具箱「帧率」「性能」面板取实时值 */
        sample: function () {
            return { running: running, fps: curFps, locked: locked,
                     avgStepMs: stats.avgStepMs, vmSteps: stats.steps,
                     switches: stats.switches, runningFrames: stats.runningFrames };
        }
    };
})();
