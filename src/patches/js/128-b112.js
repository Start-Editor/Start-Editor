/* ── [B112] 底部信息条：书包上移 + 鼠标/时间/作品/用户/角色 一行数据 ──
   依赖：ReduxStore / VM（拿不到时全部字段降级，不抛错）、B97 预编译缓存
   维护：8 个字段一行常驻；鼠标 X/Y 逐帧、其余 500ms 签名短路刷新；
        作品大小优先读 __blPrecompiled.status().bytes（零成本），缺失时
        12s 节流回退到 vm.saveProjectSb3 的字节长度。
   位置：状态条挂 body 直属、fixed 到底部；书包由 CSS 留白自动上移，
        不插入 React 树、不改任何原生模块，B107 同帧补挂 + 1.2s 兜底自愈。
   ========================================================================== */
(function () {
    'use strict';
    if (window.__blHud) return;

    var ID = 'bl-hud-bar';
    var HOST = '[class*="gui_page-wrapper_"]';
    var KEYS = ['x', 'y', 'time', 'sprites', 'size', 'name', 'user', 'target'];
    var ZH = { x: '鼠标X', y: '鼠标Y', time: '时间', sprites: '角色数',
               size: '作品大小', name: '作品名', user: '用户', target: '当前角色' };
    var EN = { x: 'Mouse X', y: 'Mouse Y', time: 'Time', sprites: 'Sprites',
               size: 'Size', name: 'Project', user: 'User', target: 'Target' };

    var mx = 0, my = 0, sx = 0, sy = 0, mouseRaf = 0;
    var chips = {}, lastSig = '', lastMouseSig = '', lastHostState = '';
    var sizeCache = 0, sizeBusy = false, sizeLast = 0, boundVm = null;

    function en() {
        try {
            var st = store();
            var loc = st && st.scratchGui && st.scratchGui.locales &&
                      st.scratchGui.locales.locale;
            if (loc) return /^en/i.test(String(loc));
            if (/(?:^|[?&])locale=en/i.test(window.location.search)) return true;
            var l = String(document.documentElement &&
                           document.documentElement.lang || '');
            if (l) return /^en/i.test(l);
            return /^en/i.test(String(navigator.language || ''));
        } catch (e) { return false; }
    }
    function T(a, b) { return en() ? b : a; }
    function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
    function fmtSize(n) {
        n = Number(n) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(2) + ' MB';
    }
    function store() {
        try {
            return (window.ReduxStore && window.ReduxStore.getState) ?
                   window.ReduxStore.getState() : null;
        } catch (e) { return null; }
    }
    function vmObj() {
        try {
            var st = store();
            var v = (st && st.scratchGui && st.scratchGui.vm) || window.vm;
            return (v && v.runtime) ? v : null;
        } catch (e) { return null; }
    }
    function raf(f) {
        if (window.requestAnimationFrame) {
            try { return window.requestAnimationFrame(f); } catch (e) {}
        }
        return window.setTimeout(f, 16);
    }

    /* ---------------- 八个字段 ---------------- */
    function timeStr() {
        var d = new Date();
        return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }
    function spriteCount() {
        var v = vmObj();
        if (v && v.runtime && v.runtime.targets) {
            var a = v.runtime.targets, n = 0;
            for (var i = 0; i < a.length; i++) if (a[i] && !a[i].isStage) n++;
            return n;
        }
        var st = store(), sp = st && st.scratchGui && st.scratchGui.targets &&
                              st.scratchGui.targets.sprites;
        return sp ? Object.keys(sp).length : 0;
    }
    function projectName() {
        var st = store();
        var t = st && st.scratchGui && st.scratchGui.projectTitle;
        if (typeof t === 'string' && t.trim()) return t.trim().slice(0, 60);
        try {
            var el = document.querySelector(
                '#title-field, [data-mw-item="project-title"] input, input[id="title-field"]');
            if (el) {
                var s = String(el.value || el.textContent || '').trim();
                if (s) return s.slice(0, 60);
            }
        } catch (e) {}
        return T('未命名项目', 'Untitled');
    }
    function userName() {
        var picks = [];
        try { picks.push(window.localStorage.getItem('bl:se-username')); } catch (e) {}
        try { picks.push(window.localStorage.getItem('tw:username-override')); } catch (e) {}
        try {
            var m = window.location.search.match(/[?&]username=([^&]*)/);
            if (m) picks.push(decodeURIComponent(m[1]));
        } catch (e) {}
        var st = store();
        try {
            var u = st && st.session && st.session.session && st.session.session.user;
            if (u && u.username) picks.push(u.username);
        } catch (e) {}
        try {
            var g = st && st.scratchGui;
            if (g && g.tw && g.tw.username) picks.push(g.tw.username);
            if (g && g.rotur && g.rotur.username) picks.push(g.rotur.username);
        } catch (e) {}
        for (var i = 0; i < picks.length; i++) {
            if (picks[i] && String(picks[i]).trim())
                return String(picks[i]).trim().slice(0, 32);
        }
        return T('游客', 'Guest');
    }
    function currentTarget() {
        var v = vmObj();
        try {
            if (v && v.editingTarget && v.editingTarget.getName) {
                var n = v.editingTarget.getName();
                if (n) return String(n).slice(0, 60);
            }
        } catch (e) {}
        var st = store(), ts = st && st.scratchGui && st.scratchGui.targets;
        if (ts) {
            var sp = ts.sprites && ts.sprites[ts.editingTarget];
            if (sp && sp.name) return String(sp.name).slice(0, 60);
            if (ts.stage && ts.stage.name) return String(ts.stage.name).slice(0, 60);
        }
        return '—';
    }
    function askSize() {
        var now = Date.now();
        if (sizeBusy || document.hidden || now - sizeLast < 12000) return;
        var v = vmObj();
        if (!v || typeof v.saveProjectSb3 !== 'function') return;
        sizeLast = now; sizeBusy = true;
        try {
            Promise.resolve(v.saveProjectSb3('arraybuffer')).then(function (buf) {
                var n = buf && (buf.byteLength || buf.length);
                if (n > 0) { sizeCache = n; refresh(); }
            })['catch'](function () {}).then(function () { sizeBusy = false; });
        } catch (e) { sizeBusy = false; }
    }
    function projectSize() {
        try {
            var P = window.__blPrecompiled;
            if (P && typeof P.status === 'function') {
                var s = P.status();
                if (s && s.bytes > 0) { sizeCache = s.bytes; return fmtSize(s.bytes); }
            }
        } catch (e) {}
        askSize();
        return sizeCache > 0 ? fmtSize(sizeCache) : T('计算中…', '…');
    }
    function values() {
        return {
            time: timeStr(), sprites: String(spriteCount()), size: projectSize(),
            name: projectName(), user: userName(), target: currentTarget()
        };
    }

    /* ---------------- DOM ---------------- */
    function buildBar() {
        var bar = document.createElement('div');
        bar.id = ID;
        bar.className = 'bl-hud-bar';
        bar.setAttribute('role', 'status');
        bar.setAttribute('aria-label', T('编辑器状态', 'Editor status'));
        chips = {};
        var L = en() ? EN : ZH;
        for (var i = 0; i < KEYS.length; i++) {
            var k = KEYS[i];
            var it = document.createElement('div');
            it.className = 'bl-hud-i';
            it.setAttribute('data-k', k);
            var kk = document.createElement('span');
            kk.className = 'bl-hud-k'; kk.textContent = L[k];
            var vv = document.createElement('span');
            vv.className = 'bl-hud-v'; vv.textContent = '—';
            it.appendChild(kk); it.appendChild(vv);
            bar.appendChild(it);
            chips[k] = { k: kk, v: vv, i: it };
        }
        return bar;
    }
    function ensureBar() {
        var bar = document.getElementById(ID);
        if (!bar) { bar = buildBar(); }
        else if (!chips.x) {
            /* 外部重建过节点：重建引用（极端兜底） */
            chips = {};
            var items = bar.querySelectorAll ? bar.querySelectorAll('.bl-hud-i') : [];
            for (var j = 0; j < items.length; j++) {
                var it = items[j], k = it.getAttribute && it.getAttribute('data-k');
                if (!k || chips[k]) continue;
                chips[k] = {
                    i: it,
                    k: it.querySelector ? it.querySelector('.bl-hud-k') : null,
                    v: it.querySelector ? it.querySelector('.bl-hud-v') : null
                };
            }
            if (!chips.x) { bar = buildBar(); }
        }
        if (bar.parentNode !== document.body) {
            if (bar.parentNode && bar.parentNode.removeChild)
                bar.parentNode.removeChild(bar);
            document.body.appendChild(bar);
        }
        return bar;
    }
    function paintStat() {
        var lang = en() ? 'en' : 'zh';
        var v = values();
        var sig = lang + '|' + v.time + '|' + v.sprites + '|' + v.size + '|' +
                  v.name + '|' + v.user + '|' + v.target;
        if (sig === lastSig) return;
        lastSig = sig;
        var L = lang === 'en' ? EN : ZH;
        for (var i = 0; i < KEYS.length; i++) {
            var k = KEYS[i], c = chips[k];
            if (!c) continue;
            if (c.k && c.k.textContent !== L[k]) c.k.textContent = L[k];
            if (k !== 'x' && k !== 'y' && c.v && c.v.textContent !== v[k])
                c.v.textContent = v[k];
        }
        var t = T('当前时间：', 'Time: ') + new Date().toLocaleString();
        if (chips.time && chips.time.i) chips.time.i.title = t;
        if (chips.name && chips.name.i) chips.name.i.title = v.name;
        if (chips.user && chips.user.i) chips.user.i.title = v.user;
        if (chips.target && chips.target.i) chips.target.i.title = v.target;
    }
    function computeStage() {
        sx = 0; sy = 0;
        try {
            var v = vmObj();
            var m = v && v.runtime && v.runtime.ioDevices &&
                    v.runtime.ioDevices.mouse;
            if (m && m.getScratchX && m.getScratchY) {
                sx = Math.round(m.getScratchX());
                sy = Math.round(m.getScratchY());
            }
        } catch (e) {}
    }
    function paintMouse() {
        computeStage();
        var lang = en() ? 'en' : 'zh';
        var sig = mx + '|' + my + '|' + sx + '|' + sy + '|' + lang;
        if (sig === lastMouseSig) return;
        lastMouseSig = sig;
        var title = T('舞台坐标', 'Stage') + ': ' + sx + ', ' + sy;
        if (chips.x) {
            if (chips.x.v && chips.x.v.textContent !== String(mx))
                chips.x.v.textContent = String(mx);
            if (chips.x.i) chips.x.i.title = title;
        }
        if (chips.y) {
            if (chips.y.v && chips.y.v.textContent !== String(my))
                chips.y.v.textContent = String(my);
            if (chips.y.i) chips.y.i.title = title;
        }
    }
    function refresh() { paintStat(); paintMouse(); }

    /* ---------------- 挂载 / 自愈 ---------------- */
    function apply() {
        var host = null;
        try { host = document.querySelector(HOST); } catch (e) {}
        bindVm();                 /* 同帧绑定，签名短路，不依赖 1.2s 巡检 */
        var bar = ensureBar();
        var st = host ? 'on' : 'off';
        if (st !== lastHostState) {
            lastHostState = st;
            var r = document.documentElement;
            if (host) {
                r.classList.add('bl-hud-on');
                r.classList.remove('bl-hud-off');
                bar.style.display = '';
            } else {
                r.classList.remove('bl-hud-on');
                r.classList.add('bl-hud-off');
                bar.style.display = 'none';
            }
        }
        refresh();
    }

    /* VM 事件：角色/工程一变立刻重算（只置签名失效，下一次 tick 合并） */
    function bindVm() {
        var v = vmObj();
        if (!v || v === boundVm || typeof v.on !== 'function') return;
        boundVm = v;
        var evs = ['targetsUpdate', 'PROJECT_CHANGED', 'workspaceUpdate', 'PROJECT_LOADED'];
        for (var i = 0; i < evs.length; i++) {
            try { v.on(evs[i], refresh); } catch (e) {}
        }
    }

    try {
        document.addEventListener('mousemove', function (e) {
            mx = Math.round(e.clientX || 0);
            my = Math.round(e.clientY || 0);
            if (!mouseRaf) {
                mouseRaf = raf(function () { mouseRaf = 0; paintMouse(); });
            }
        }, { passive: true });
    } catch (e) {
        try { document.addEventListener('mousemove', function (e2) {
            mx = Math.round(e2.clientX || 0); my = Math.round(e2.clientY || 0);
        }); } catch (e2b) {}
    }
    var evs2 = ['storage', 'bl:se-username', 'bl:star-ai-change',
                'bl:glass-change', 'mw:theme-applied', 'visibilitychange', 'resize'];
    for (var q = 0; q < evs2.length; q++) {
        try { window.addEventListener(evs2[q], refresh); } catch (e3) {}
    }
    try { document.addEventListener('bl:se-username', refresh); } catch (e4) {}
    try { document.addEventListener('DOMContentLoaded', apply); } catch (e5) {}
    try { window.addEventListener('load', apply); } catch (e6) {}

    /* 同帧补挂总线 + 低频兜底（apply 全短路，静息零 DOM 写入） */
    try {
        if (window.__blSync && window.__blSync.register)
            window.__blSync.register('B112-hud', apply, false);
    } catch (e7) {}
    window.setInterval(function () {
        if (document.hidden) return;
        bindVm();
        apply();
    }, 1200);
    apply();

    /* ---------------- 对外接口（调试 / 冒烟） ---------------- */
    window.__blHud = {
        apply: apply,
        refresh: refresh,
        fmtSize: fmtSize,
        values: values,
        status: function () {
            return {
                host: !!document.querySelector(HOST),
                bar: !!document.getElementById(ID),
                sig: lastSig, mouseSig: lastMouseSig,
                mouse: mx + ',' + my, size: sizeCache,
                en: en(), chips: Object.keys(chips).length
            };
        }
    };
})();
