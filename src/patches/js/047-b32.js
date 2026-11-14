/* ── [B32] 油猴插件运行器 ───────────────────────────────────────────────
   依赖：B41 设置存储
   维护：用户脚本沙箱与菜单入口
   ───────────────────────────────────────────────────────────── */

/* ================================================================== *
 * 油猴插件（UserScript）运行器
 *
 * 独立于主脚本：自己的 <script> 标签，出错不影响编辑器本体。
 * 对外只暴露 window.__blUserscript = { open, run, install }。
 * ================================================================== */
(function () {
    'use strict';

    var STORE = 'tw:userscripts';
    var LOG_MAX = 300;

    /* ---------------- 存储 ---------------- */

    var scripts = [];

    /* 运行会话表：id -> session。
       旧版删除脚本只从数组里 splice 掉并写回 localStorage，
       但脚本已经注入的样式、定时器、事件监听、观察器、DOM 节点全都还在，
       表现就是「列表里删了，油猴插件却仍然有效」，非刷新页面不停。
       这里给每个脚本记一笔帐，删除 / 停用 / 重跑时一次性撤销。 */
    var running = {};          /* id -> session */
    var lastRaw = null;        /* 上一次读到的存档原文，用于发现外部删除 */
    var reconcileQueued = false;

    function load() {
        try {
            var raw = window.localStorage.getItem(STORE);
            var arr = raw ? JSON.parse(raw) : [];
            scripts = Array.isArray(arr) ? arr : [];
        } catch (e) {
            scripts = [];
        }
        return scripts;
    }

    function save() {
        try {
            window.localStorage.setItem(STORE, JSON.stringify(scripts));
        } catch (e) { /* ignore */ }
        /* 同一个页面写 localStorage 不会派发 storage 事件。
           主动广播一次，让运行器立刻对齐，不用等刷新或等轮询。 */
        try {
            if (typeof CustomEvent === 'function') {
                window.dispatchEvent(new CustomEvent('bl:userscripts-change'));
            } else {
                var ev = document.createEvent('Event');
                ev.initEvent('bl:userscripts-change', false, false);
                window.dispatchEvent(ev);
            }
        } catch (e2) { /* ignore */ }
    }

    function uid() {
        return 'us-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }

    /* ---------------- 元数据块解析 ----------------

       油猴脚本头部形如（外层的斜杠在注释里，注意别写成会被 HTML 解析器
       误认的标记）：
         // ==UserScript==
         // @name     My Script
         // @grant    GM_addStyle
         // ==/UserScript==
       这里把 @key value 抽成对象；同一 key 多次出现收成数组。
       匹配用的通配符串不在源码里写字面量，改为运行时拼装，避免误触发
       HTML 解析器的特殊状态。
    */

    function parseMeta(code) {
        var m = /^\s*\/\/\s*==UserScript==\s*([\s\S]*?)\/\/\s*==\/UserScript==/m.exec(code || '');
        var out = { _keys: [], _lists: {} };
        if (!m) return out;
        var body = m[1];
        var re = /^\s*\/\/\s*@([A-Za-z0-9_-]+)(?:\s+(.*))?$/gm;
        var one;
        while ((one = re.exec(body))) {
            var k = one[1];
            var v = (one[2] || '').trim();
            if (!(k in out)) {
                out[k] = v;
                out._keys.push(k);
                out._lists[k] = [v];
            } else {
                out._lists[k].push(v);
            }
        }
        return out;
    }

    function scriptName(item) {
        var meta = parseMeta(item.code);
        return meta.name || item.name || '未命名脚本';
    }

    /* ---------------- 日志 ---------------- */

    var logBox = null;
    var logs = [];

    function log(level, text) {
        var line = { level: level, text: String(text), at: Date.now() };
        logs.push(line);
        if (logs.length > LOG_MAX) logs.shift();
        if (logBox) renderLog();
    }

    function timeStr(t) {
        var d = new Date(t);
        function p(n) { return n < 10 ? '0' + n : String(n); }
        return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function renderLog() {
        if (!logBox) return;
        var html = '';
        for (var i = 0; i < logs.length; i++) {
            html += '<div class="bl-us-log-line bl-us-log-' + logs[i].level + '">' +
                '<span class="bl-us-log-time">' + timeStr(logs[i].at) + '</span>' +
                '<span class="bl-us-log-text"></span></div>';
        }
        logBox.innerHTML = html;
        var texts = logBox.querySelectorAll('.bl-us-log-text');
        for (var j = 0; j < logs.length && j < texts.length; j++) {
            texts[j].textContent = logs[j].text;
        }
        logBox.scrollTop = logBox.scrollHeight;
    }

    /* ---------------- GM API ---------------- */

    function makeConsole(name) {
        function wrap(level) {
            return function () {
                var parts = [];
                for (var i = 0; i < arguments.length; i++) parts.push(fmtArg(arguments[i]));
                log(level, '[' + name + '] ' + parts.join(' '));
            };
        }
        function fmtArg(v) {
            if (v instanceof Error) return v.message;
            if (typeof v === 'object') {
                try { return JSON.stringify(v); } catch (e) { return String(v); }
            }
            return String(v);
        }
        return { log: wrap('info'), info: wrap('info'), warn: wrap('warn'), error: wrap('error'), debug: wrap('info') };
    }

    /* ================================================================ *
     * 会话：让「删除」真的等于「停止」
     * ---------------------------------------------------------------- *
     * 用户脚本用 new Function 在页面上下文里跑，它创建的定时器、监听、
     * 观察器、样式和节点都活在全局，删掉列表项并不会自动消失。
     * 办法：给每个脚本建一个 session，把常用的异步入口以「函数参数」
     * 的形式影子注入（不污染全局）；所有回调再包一层 alive 检查。
     * 删除时 s.alive = false，随后清定时器 / 摘监听 / 断观察器 /
     * 摘掉带标记的节点与样式、清掉该脚本的 GM 存储。
     * ================================================================ */

    function guardCall(sess, fn) {
        if (sess && !sess.alive) return;
        if (typeof fn === 'function') fn();
    }

    function wrapCb(fn, sess) {
        if (typeof fn !== 'function') return fn;
        return function () {
            /* 脚本已被删除 / 停用：回调直接作废，不再产生任何新副作用 */
            if (sess && !sess.alive) return;
            try {
                return fn.apply(this, arguments);
            } catch (e) {
                log('error', '脚本回调执行失败：' + (e && e.message ? e.message : String(e)));
            }
        };
    }

    function tagNode(node, sess) {
        if (!node || node.nodeType !== 1) return node;
        try { node.setAttribute('data-bl-us', sess.id); } catch (e) { /* ignore */ }
        /* 元素自己注册的监听同样要能撤销 */
        var origAdd = node.addEventListener;
        if (origAdd) {
            try {
                node.addEventListener = function (type, fn, opts) {
                    if (!sess.alive) return;
                    var w = wrapCb(fn, sess);
                    sess.listeners.push({ target: node, type: type, fn: w, opts: opts });
                    return origAdd.call(node, type, w, opts);
                };
            } catch (e2) { /* ignore */ }
        }
        return node;
    }

    function makeSession(id) {
        return { id: id, alive: true, code: '', timers: [], listeners: [], observers: [] };
    }

    /* 清掉脚本留在页面上的残留（样式 + 它创建的元素）。
       即使会话已经不存在（外部直接改了存档），这一步也要跑。
       注意：GM 存值不在这里清 —— 重跑 / 停用 / 启动都不该丢数据，
       只有「从存档里彻底删除」才调用 clearValues。 */
    function purgeArtifacts(id) {
        var all = document.querySelectorAll('[data-bl-us]');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (el.getAttribute('data-bl-us') === id && el.parentNode) {
                try { el.parentNode.removeChild(el); } catch (e) { /* ignore */ }
            }
        }
    }

    function clearValues(id) {
        try {
            var pre = 'us:' + id + ':';
            var kill = [];
            for (var j = 0; j < window.localStorage.length; j++) {
                var k = window.localStorage.key(j);
                if (k && k.indexOf(pre) === 0) kill.push(k);
            }
            for (j = 0; j < kill.length; j++) {
                try { window.localStorage.removeItem(kill[j]); } catch (e2) { /* ignore */ }
            }
        } catch (e3) { /* ignore */ }
    }

    function stopItem(id) {
        var sess = running[id];
        if (!sess) { purgeArtifacts(id); return false; }
        sess.alive = false;                 /* 先置死，包装回调立刻全部作废 */
        var i;
        for (i = 0; i < sess.timers.length; i++) {
            var t = sess.timers[i];
            try {
                if (t.kind === 'raf') window.cancelAnimationFrame(t.id);
                else if (t.kind === 'interval') window.clearInterval(t.id);
                else window.clearTimeout(t.id);
            } catch (e) { /* ignore */ }
        }
        sess.timers.length = 0;
        for (i = 0; i < sess.listeners.length; i++) {
            var l = sess.listeners[i];
            try { l.target.removeEventListener(l.type, l.fn, l.opts); } catch (e2) { /* ignore */ }
        }
        sess.listeners.length = 0;
        for (i = 0; i < sess.observers.length; i++) {
            try { sess.observers[i].disconnect(); } catch (e3) { /* ignore */ }
        }
        sess.observers.length = 0;
        delete running[id];
        purgeArtifacts(id);
        log('info', '已停止并清理：' + id);
        return true;
    }

    /* 影子全局：作为 new Function 的形参注入，只在该脚本的作用域内生效，
       不修改 window / document 原型，编辑器本体完全不受影响。 */
    function sandboxGlobals(sess) {
        var g = {};
        function timer(kind, fn, delay) {
            var w = wrapCb(fn, sess);
            var id = (kind === 'interval' ? window.setInterval : window.setTimeout)(w, delay);
            sess.timers.push({ kind: kind, id: id });
            return id;
        }
        g.setTimeout = function (fn, delay) { return timer('timeout', fn, delay); };
        g.setInterval = function (fn, delay) { return timer('interval', fn, delay); };
        g.clearTimeout = function (id) { try { window.clearTimeout(id); } catch (e) {} };
        g.clearInterval = function (id) { try { window.clearInterval(id); } catch (e) {} };
        if (window.requestAnimationFrame) {
            g.requestAnimationFrame = function (fn) {
                var id = window.requestAnimationFrame(wrapCb(fn, sess));
                sess.timers.push({ kind: 'raf', id: id });
                return id;
            };
            g.cancelAnimationFrame = function (id) {
                try { window.cancelAnimationFrame(id); } catch (e) {}
            };
        }
        g.addEventListener = function (type, fn, opts) {
            var w = wrapCb(fn, sess);
            sess.listeners.push({ target: window, type: type, fn: w, opts: opts });
            try { window.addEventListener(type, w, opts); } catch (e) { /* ignore */ }
        };
        g.removeEventListener = function (type, fn, opts) {
            try { window.removeEventListener(type, fn, opts); } catch (e) { /* ignore */ }
        };
        var MO = window.MutationObserver;
        if (MO) {
            /* 性能总线（B01）已经包过一层 MutationObserver，这里继续套一层，
               保持它的实例语义，只额外记一笔帐以便断开。 */
            function TrackedMO(cb) {
                var o = new MO(wrapCb(cb, sess));
                sess.observers.push(o);
                return o;
            }
            TrackedMO.prototype = MO.prototype;
            g.MutationObserver = TrackedMO;
        }
        var doc = document;
        g.document = new Proxy(doc, {
            get: function (t, k) {
                if (k === 'createElement' || k === 'createElementNS' ||
                    k === 'importNode' || k === 'adoptNode') {
                    return function () { return tagNode(t[k].apply(t, arguments), sess); };
                }
                if (k === 'addEventListener') {
                    return function (type, fn, opts) {
                        var w = wrapCb(fn, sess);
                        sess.listeners.push({ target: t, type: type, fn: w, opts: opts });
                        return t.addEventListener(type, w, opts);
                    };
                }
                var v = t[k];
                if (typeof v === 'function') return v.bind(t);
                return v;
            },
            set: function (t, k, v) { t[k] = v; return true; },
            has: function (t, k) { return k in t; }
        });
        return g;
    }

    /* unsafeWindow 仍然指向真实页面环境，但常用异步入口换成被跟踪的版本，
       这样通过 unsafeWindow.setInterval / unsafeWindow.document 起的效果也能撤销。 */
    function pageWindowFor(sess, g, t) {
        return new Proxy(t, {
            get: function (target, k) {
                if (Object.prototype.hasOwnProperty.call(g, k)) return g[k];
                var v = target[k];
                if (typeof v === 'function') return v.bind(target);
                return v;
            },
            set: function (target, k, v) { try { target[k] = v; } catch (e) {} return true; },
            has: function (target, k) { return k in target; }
        });
    }

    /* 存档与运行态对齐：外部（设置页 / 其它标签页 / 手动清 localStorage）
       删掉或停用脚本时，这里把对应会话停掉，列表也跟着刷新。 */
    function reconcile() {
        var raw = '';
        try { raw = window.localStorage.getItem(STORE) || ''; } catch (e) { /* ignore */ }
        lastRaw = raw;
        var list = load();
        var want = {}, byId = {}, i, it;
        for (i = 0; i < list.length; i++) {
            it = list[i];
            if (!it || !it.id) continue;
            byId[it.id] = it;
            if (it.enabled) want[it.id] = it;
        }
        var changed = false;
        for (var oldId in running) {
            if (!Object.prototype.hasOwnProperty.call(running, oldId)) continue;
            var w = want[oldId];
            /* 已删除 / 已停用 / 代码被改过 → 立刻停掉旧会话 */
            if (!w || running[oldId].code !== w.code) {
                stopItem(oldId);
                /* 只有存档里确实没有这条脚本了，才连 GM 存值一起清掉；
                   单纯「停用」要保留数据，重新启用还能接着用。 */
                if (!byId[oldId]) clearValues(oldId);
                changed = true;
            }
        }
        for (var newId in want) {
            if (!Object.prototype.hasOwnProperty.call(want, newId)) continue;
            if (!running[newId]) {
                try { runItem(want[newId]); } catch (e) { /* ignore */ }
                changed = true;
            }
        }
        try { renderList(); } catch (e2) { /* ignore */ }
        return changed;
    }

    function queueReconcile() {
        if (reconcileQueued) return;
        reconcileQueued = true;
        window.setTimeout(function () {
            reconcileQueued = false;
            try { reconcile(); } catch (e) { /* ignore */ }
        }, 0);
    }

    function buildApis(item, sess, pageWindow) {
        var meta = parseMeta(item.code);
        var granted = {};
        var list = meta._lists && meta._lists.grant ? meta._lists.grant : [];
        for (var i = 0; i < list.length; i++) granted[list[i]] = true;
        /* 没写 @grant 的脚本按油猴传统视为在页面上下文运行，这里一律给全，避免脚本报 undefined */
        var all = true;

        function storeKey(k) { return 'us:' + item.id + ':' + k; }

        var api = {
            GM_info: {
                script: {
                    name: meta.name || item.name || '',
                    namespace: meta.namespace || '',
                    description: meta.description || '',
                    version: meta.version || '',
                    includes: (meta._lists && meta._lists.include) || [],
                    matches: (meta._lists && meta._lists.match) || []
                },
                scriptHandler: 'StartEditor',
                version: '1.0'
            },
            GM_addStyle: function (css) {
                if (sess && !sess.alive) return null;
                var s = document.createElement('style');
                s.textContent = css;
                s.setAttribute('data-bl-us', item.id);
                (document.head || document.documentElement).appendChild(s);
                return s;
            },
            GM_setValue: function (k, v) {
                try { window.localStorage.setItem(storeKey(k), JSON.stringify(v)); } catch (e) { /* ignore */ }
            },
            GM_getValue: function (k, d) {
                try {
                    var raw = window.localStorage.getItem(storeKey(k));
                    if (raw === null) return typeof d === 'undefined' ? null : d;
                    return JSON.parse(raw);
                } catch (e) { return typeof d === 'undefined' ? null : d; }
            },
            GM_deleteValue: function (k) {
                try { window.localStorage.removeItem(storeKey(k)); } catch (e) { /* ignore */ }
            },
            GM_listValues: function () {
                var out = [];
                try {
                    var pre = 'us:' + item.id + ':';
                    for (var i = 0; i < window.localStorage.length; i++) {
                        var k = window.localStorage.key(i);
                        if (k && k.indexOf(pre) === 0) out.push(k.slice(pre.length));
                    }
                } catch (e) { /* ignore */ }
                return out;
            },
            GM_openInTab: function (url) {
                try { window.open(url, '_blank'); } catch (e) { /* ignore */ }
            },
            GM_notification: function (text) { log('info', String(text)); },
            GM_registerMenuCommand: function (name, fn) {
                log('info', '菜单命令已注册：' + name);
                if (typeof fn === 'function') {
                    try { guardCall(sess, fn); } catch (e) { log('error', '菜单命令执行失败：' + e.message); }
                }
            },
            GM_xmlhttpRequest: function (details) {
                if (sess && !sess.alive) return { abort: function () { } };
                var onloadCb = wrapCb(details.onload, sess);
                var onerrorCb = wrapCb(details.onerror, sess);
                /* 用 fetch 近似实现：onload 提供 responseText / status / response 等常用字段 */
                var opt = {
                    method: details.method || 'GET',
                    headers: details.headers || null,
                    body: details.data || details.body || null,
                    credentials: 'omit'
                };
                window.fetch(details.url, opt).then(function (res) {
                    return res.text().then(function (txt) {
                        var ctx = {
                            status: res.status,
                            statusText: res.statusText,
                            responseText: txt,
                            response: txt,
                            responseHeaders: res.headers ? String(res.headers) : '',
                            finalUrl: res.url || details.url
                        };
                        if (onloadCb) onloadCb(ctx);
                    });
                }).catch(function (err) {
                    if (onerrorCb) onerrorCb({ error: String(err) });
                    log('warn', '请求失败：' + details.url);
                });
                return { abort: function () { } };
            },
            GM_download: function (details) {
                if (sess && !sess.alive) return;
                var onloadCb = wrapCb(details.onload, sess);
                try {
                    var a = document.createElement('a');
                    a.href = details.url;
                    a.download = details.name || 'download';
                    a.click();
                    if (onloadCb) onloadCb();
                } catch (e) { /* ignore */ }
            },
            unsafeWindow: pageWindow || window,
            console: makeConsole(item.name || item.id)
        };

        /* @grant none 的脚本不注入 GM_*，这里为兼容性仍然提供，故 all 恒为 true */
        if (all) return api;
        var filtered = { unsafeWindow: window, console: api.console };
        for (var k2 in api) {
            if (Object.prototype.hasOwnProperty.call(api, k2) && granted[k2]) filtered[k2] = api[k2];
        }
        return filtered;
    }

    /* ---------------- 执行 ---------------- */

    function matchTarget(meta) {
        var href = window.location.href;
        var matches = (meta._lists && meta._lists.match) || [];
        var includes = (meta._lists && meta._lists.include) || [];
        var excludes = (meta._lists && meta._lists.exclude) || [];
        function hit(pattern) {
            if (!pattern) return false;
            if (pattern === '*' || pattern === '*://*/*') return true;
            if (pattern.indexOf('*') < 0) return href === pattern || href.indexOf(pattern) >= 0;
            var re = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
            try { return new RegExp(re).test(href); } catch (e) { return false; }
        }
        for (var i = 0; i < excludes.length; i++) { if (hit(excludes[i])) return false; }
        var rules = matches.concat(includes);
        if (!rules.length) return true;
        for (var j = 0; j < rules.length; j++) { if (hit(rules[j])) return true; }
        return false;
    }

    function runItem(item) {
        if (!item || !item.code) return false;
        var meta = parseMeta(item.code);
        if (!matchTarget(meta)) {
            log('warn', scriptName(item) + '：当前页面不匹配 @match/@include，已跳过');
            return false;
        }
        /* 重跑（▶ / 启动 / 代码改动）前先撤销上一轮，避免攒出多份
           定时器、监听和注入样式 —— 这也会让「删了还在跑」无法残留。 */
        stopItem(item.id);
        var sess = makeSession(item.id);
        sess.code = item.code;
        running[item.id] = sess;
        var sb = sandboxGlobals(sess);
        var api = buildApis(item, sess, pageWindowFor(sess, sb, window));
        var names = [];
        var args = [];
        var keys = Object.keys(api).concat(Object.keys(sb));
        for (var i = 0; i < keys.length; i++) {
            names.push(keys[i]);
            args.push(Object.prototype.hasOwnProperty.call(api, keys[i]) ? api[keys[i]] : sb[keys[i]]);
        }
        try {
            /* 用 new Function 而不是 eval：不污染当前作用域，参数显式传入 */
            var fn = new Function(names.join(','), '"use strict";' + item.code);
            fn.apply(window, args);
            if (!sess.alive) return false;   /* 执行期间脚本被删了 */
            log('info', scriptName(item) + '：已运行');
            return true;
        } catch (e) {
            stopItem(item.id);
            log('error', scriptName(item) + ' 运行出错：' + (e && e.message ? e.message : String(e)));
            return false;
        }
    }

    /* ---------------- 安装 ---------------- */

    function install(code, name) {
        code = String(code || '').trim();
        if (!code) return null;
        var meta = parseMeta(code);
        var item = {
            id: uid(),
            name: name || meta.name || '未命名脚本',
            code: code,
            enabled: true,
            at: Date.now()
        };
        scripts.push(item);
        save();
        log('info', '已安装：' + item.name);
        renderList();
        runItem(item);
        return item;
    }

    function removeItem(id) {
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].id === id) {
                /* 关键：先把已经跑起来的效果全撤掉，再改存档。
                   旧版只 splice + save，脚本的样式/定时器/监听仍然生效。 */
                stopItem(id);
                clearValues(id);
                log('info', '已移除：' + scriptName(scripts[i]));
                scripts.splice(i, 1);
                save();
                renderList();
                return true;
            }
        }
        /* 存档里已经没有、但会话或残留节点还在（外部删除）：也清干净 */
        stopItem(id);
        return false;
    }

    function toggleItem(id) {
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].id === id) {
                scripts[i].enabled = !scripts[i].enabled;
                save();
                renderList();
                if (scripts[i].enabled) runItem(scripts[i]);
                else stopItem(id);          /* 停用 = 立刻停止，不等刷新 */
                return true;
            }
        }
        return false;
    }

    /* ---------------- UI ---------------- */

    /* 顶层宿主：与 inject.js 的 blTopLayer() 共用同一个节点 */
    function topHost() {
        try {
            if (window.__blTopLayer) return window.__blTopLayer();
        } catch (e) { /* ignore */ }
        var h = document.getElementById('bl-top-layer');
        if (!h) {
            h = document.createElement('div');
            h.id = 'bl-top-layer';
            h.className = 'bl-top-layer';
            h.style.position = 'fixed';
            h.style.left = '0';
            h.style.top = '0';
            h.style.width = '100%';
            h.style.height = '100%';
            h.style.zIndex = '999998';
            h.style.pointerEvents = 'none';
            (document.documentElement || document.body).appendChild(h);
        }
        return h;
    }

    var win = null;
    /* 最大化 / 最小化前的尺寸位置，用于还原 */
    var savedRect = null;
    var listBox = null;
    var editor = null;
    var editingId = null;

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function buildWindow() {
        if (win) return win;
        win = document.createElement('div');
        win.className = 'addon-window bl-us-window';
        /* 结构与原生窗口完全一致（addon-window-header / -title / -controls / -btn / -content），
           尺寸位置也像原生那样写在 style 上，这样外观与拖动行为都跟原生弹窗一致。 */
        win.style.cssText = 'position: fixed; left: 96px; top: 96px; width: 760px; height: 520px;' +
            'max-width: 92vw; max-height: 86vh; z-index: 8200; display: flex; flex-direction: column; overflow: hidden;';
        win.innerHTML =
            '<div class="addon-window-header">' +
            '<span class="addon-window-title">油猴插件</span>' +
            '<div class="addon-window-controls">' +
            '<button type="button" class="addon-window-btn addon-window-btn-minimize bl-us-min" title="最小化" aria-label="最小化">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            '</button>' +
            '<button type="button" class="addon-window-btn addon-window-btn-maximize bl-us-max" title="最大化" aria-label="最大化">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<rect class="bl-us-max-i" x="5" y="5" width="14" height="14" rx="2"/></svg>' +
            '</button>' +
            '<button type="button" class="addon-window-btn addon-window-btn-close bl-us-close" title="关闭" aria-label="关闭">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>' +
            '</button></div></div>' +
            '<div class="addon-window-content bl-us-body">' +
            '<div class="bl-us-toolbar">' +
            '<button type="button" class="bl-us-btn bl-us-import">导入文件</button>' +
            '<button type="button" class="bl-us-btn bl-us-new">新建</button>' +
            '<button type="button" class="bl-us-btn bl-us-run">运行当前代码</button>' +
            '<button type="button" class="bl-us-btn bl-us-save">保存</button>' +
            '<input type="file" class="bl-us-file" accept=".js,.user.js,.txt" multiple hidden>' +
            '</div>' +
            '<div class="bl-us-main">' +
            '<div class="bl-us-side"><div class="bl-us-side-title">已安装</div><div class="bl-us-list"></div></div>' +
            '<div class="bl-us-right">' +
            '<textarea class="bl-us-code" spellcheck="false" placeholder="在此粘贴 UserScript 代码，或点「导入文件」选择 .user.js"></textarea>' +
            '<div class="bl-us-log-title">日志</div>' +
            '<div class="bl-us-log"></div>' +
            '</div>' +
            '</div>' +
            '</div>';

        /* 放进顶层宿主：宿主挂在 <html> 上且 z-index 极高，
           窗口就不会再被编辑器的面板 / 其它窗口压住。
           宿主不带 transform / filter，内部的 fixed 定位仍相对视口，位置不会偏。 */
        topHost().appendChild(win);
        popIn(win);

        win.querySelector('.bl-us-close').addEventListener('click', function () { closeWindow(); });
        win.querySelector('.bl-us-min').addEventListener('click', function () { setMinimized(true); });
        /* 从菜单重新打开时，DOCK 里的托盘图标要撤掉，否则会留下一个点了没反应的幽灵 */
        try {
            var dm0 = window.__blDockMin;
            if (dm0) { dm0.forget('us'); win.classList.remove('bl-win-docked'); }
        } catch (e) { /* ignore */ }
        win.querySelector('.bl-us-max').addEventListener('click', function () {
            setMaximized(!win.classList.contains('bl-window-maximized'));
        });
        win.querySelector('.bl-us-import').addEventListener('click', function () {
            win.querySelector('.bl-us-file').click();
        });
        win.querySelector('.bl-us-new').addEventListener('click', function () {
            editingId = null;
            editor.value = '// ==UserScript==\n// @name         我的脚本\n// @namespace    starteditor\n// @version      1.0\n// @match        *://*/*\n// @grant        GM_addStyle\n// ==/UserScript==\n\n(function () {\n    \'use strict\';\n    console.log(\'Hello StartEditor\');\n})();\n';
            editor.focus();
        });
        win.querySelector('.bl-us-run').addEventListener('click', function () {
            var code = editor.value;
            if (!code.trim()) { log('warn', '代码为空'); return; }
            var tmp = { id: editingId || uid(), name: '临时脚本', code: code, enabled: true, at: Date.now() };
            runItem(tmp);
        });
        win.querySelector('.bl-us-save').addEventListener('click', function () {
            var code = editor.value;
            if (!code.trim()) { log('warn', '代码为空，未保存'); return; }
            var meta = parseMeta(code);
            if (editingId) {
                for (var i = 0; i < scripts.length; i++) {
                    if (scripts[i].id === editingId) {
                        scripts[i].code = code;
                        scripts[i].name = meta.name || scripts[i].name;
                        save();
                        log('info', '已保存：' + scripts[i].name);
                        renderList();
                        return;
                    }
                }
            }
            install(code, meta.name);
        });

        var file = win.querySelector('.bl-us-file');
        file.addEventListener('change', function () {
            var files = file.files || [];
            for (var i = 0; i < files.length; i++) readFile(files[i]);
            file.value = '';
        });

        /* 拖拽文件进窗口也能导入 */
        win.addEventListener('dragover', function (e) { e.preventDefault(); });
        win.addEventListener('drop', function (e) {
            e.preventDefault();
            var fs = e.dataTransfer && e.dataTransfer.files;
            if (!fs) return;
            for (var i = 0; i < fs.length; i++) readFile(fs[i]);
        });

        /* 点击窗口（含内容区）也置顶：否则在编辑器其它区域操作过之后，
           窗口会落到别的浮层下面 */
        win.addEventListener('pointerdown', function () { bringFront(); }, true);

        listBox = win.querySelector('.bl-us-list');
        editor = win.querySelector('.bl-us-code');
        logBox = win.querySelector('.bl-us-log');
        renderList();
        renderLog();
        return win;
    }

    function readFile(f) {
        var r = new FileReader();
        r.onload = function () { install(String(r.result || ''), f.name.replace(/\.user\.js$|\.js$|\.txt$/i, '')); };
        r.onerror = function () { log('error', '读取失败：' + f.name); };
        r.readAsText(f);
    }

    function renderList() {
        if (!listBox) return;
        if (!scripts.length) {
            listBox.innerHTML = '<div class="bl-us-empty">还没有脚本</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < scripts.length; i++) {
            var it = scripts[i];
            html += '<div class="bl-us-item' + (it.enabled ? '' : ' is-off') + '" data-id="' + esc(it.id) + '">' +
                '<button type="button" class="bl-us-toggle" title="启用/停用">' + (it.enabled ? '●' : '○') + '</button>' +
                '<span class="bl-us-name"></span>' +
                '<button type="button" class="bl-us-run2" title="运行">▶</button>' +
                '<button type="button" class="bl-us-edit" title="编辑">✎</button>' +
                '<button type="button" class="bl-us-del" title="删除">×</button>' +
                '</div>';
        }
        listBox.innerHTML = html;
        var items = listBox.querySelectorAll('.bl-us-item');
        var names = listBox.querySelectorAll('.bl-us-name');
        for (var j = 0; j < scripts.length && j < names.length; j++) {
            names[j].textContent = scriptName(scripts[j]);
            names[j].title = scriptName(scripts[j]);
        }
        for (var k = 0; k < items.length; k++) bindItem(items[k]);
    }

    function bindItem(el) {
        var id = el.getAttribute('data-id');
        el.querySelector('.bl-us-toggle').addEventListener('click', function () { toggleItem(id); });
        el.querySelector('.bl-us-run2').addEventListener('click', function () {
            for (var i = 0; i < scripts.length; i++) if (scripts[i].id === id) runItem(scripts[i]);
        });
        el.querySelector('.bl-us-edit').addEventListener('click', function () {
            for (var i = 0; i < scripts.length; i++) {
                if (scripts[i].id === id) {
                    editingId = id;
                    editor.value = scripts[i].code;
                    editor.focus();
                }
            }
        });
        el.querySelector('.bl-us-del').addEventListener('click', function () {
            if (editingId === id) { editingId = null; editor.value = ''; }
            removeItem(id);
        });
    }

    /* ---------------------------------------------------------------- *
     * 图层（z-index）
     *
     * 原来写死 8200。编辑器里比它高的层不少（9000 / 9500 / 9999 / 10000 /
     * 20000 都有），所以窗口打开后会被菜单、弹层之类的盖住 —— 表现就是
     * "图层错乱"。这里改成打开与点击时动态置顶：取当前所有窗口的最大
     * z-index，并保证不低于 20000，这样它始终在最上层。
     * 上限做回绕，避免反复开关把数值撑到极大。
     * ---------------------------------------------------------------- */
    function bringFront() {
        if (!win) return;
        /* 宿主已在最上层，这里只在宿主内部做前后排序 */
        var max = 0;
        try {
            var host = win.parentNode;
            var all = host ? host.children : [];
            for (var i = 0; i < all.length; i++) {
                if (all[i] === win) continue;
                var z = parseInt(all[i].style.zIndex, 10);
                if (!isNaN(z) && z > max) max = z;
            }
        } catch (e) { /* ignore */ }
        var base = Math.max(max, 10);
        if (base > 900) base = 10;
        win.style.zIndex = String(base + 10);
    }

    function rememberRect() {
        if (savedRect || !win) return;
        var r = win.getBoundingClientRect();
        savedRect = { l: r.left, t: r.top, w: r.width, h: r.height };
    }

    function restoreRect() {
        if (!win || !savedRect) return;
        win.style.left = savedRect.l + 'px';
        win.style.top = savedRect.t + 'px';
        win.style.width = savedRect.w + 'px';
        win.style.height = savedRect.h + 'px';
    }

    /* 最小化：收成只剩标题栏，仍然可以拖动，再点一次还原。
       直接隐藏的话窗口就"消失"了，菜单里再点一次才能找回，体验更差。 */
    function setMinimized(on) {
        if (!win) return;
        if (on) {
            /* 收进 DOCK：窗口隐藏，DOCK 上出现图标，点图标放回原位。
               DOCK 不可用时（比如还没进编辑器）退回原来的"缩成标题栏"。 */
            var dm = window.__blDockMin;
            if (dm && dm.min && dm.min(win, {
                id: 'us', label: '油猴脚本',
                svg: '<path d="M4 17 10 11l4 4"/><path d="M12 4h8"/><path d="M20 4v8"/>'
            })) {
                win.style.display = 'none';
                return;
            }
            if (win.classList.contains('bl-window-maximized')) setMaximized(false);
            rememberRect();
            win.classList.add('bl-us-minimized');
            win.style.height = 'auto';
            win.style.width = Math.min(300, (savedRect && savedRect.w) || 300) + 'px';
        } else {
            win.classList.remove('bl-us-minimized');
            restoreRect();
            savedRect = null;
        }
    }

    /* 最大化：铺满视口。
       铺满后 inject.js 的 isMaximized() 会判定为最大化并禁止拖动，
       这与之前"全屏弹窗不能拖"的处理是一致的，不需要在这里重复实现。 */
    function setMaximized(on) {
        if (!win) return;
        var btn = win.querySelector('.bl-us-max');
        if (on) {
            if (win.classList.contains('bl-us-minimized')) setMinimized(false);
            rememberRect();
            win.classList.add('bl-window-maximized');
            win.style.transition = 'left .22s linear, top .22s linear, width .22s linear, height .22s linear';
            win.style.left = '0px';
            win.style.top = '0px';
            win.style.width = '100vw';
            win.style.height = '100vh';
            win.style.maxWidth = 'none';
            win.style.maxHeight = 'none';
            win.style.borderRadius = '0';
            if (btn) {
                btn.classList.add('addon-window-btn-restore');
                btn.classList.remove('addon-window-btn-maximize');
                btn.title = '还原';
                btn.setAttribute('aria-label', '还原');
                var g = btn.querySelector('.bl-us-max-i');
                if (g) {
                    g.setAttribute('x', '7'); g.setAttribute('y', '3');
                    g.setAttribute('width', '14'); g.setAttribute('height', '14');
                }
            }
        } else {
            win.classList.remove('bl-window-maximized');
            restoreRect();
            savedRect = null;
            win.style.maxWidth = '92vw';
            win.style.maxHeight = '86vh';
            win.style.borderRadius = '';
            if (btn) {
                btn.classList.remove('addon-window-btn-restore');
                btn.classList.add('addon-window-btn-maximize');
                btn.title = '最大化';
                btn.setAttribute('aria-label', '最大化');
                var g2 = btn.querySelector('.bl-us-max-i');
                if (g2) {
                    g2.setAttribute('x', '5'); g2.setAttribute('y', '5');
                    g2.setAttribute('width', '14'); g2.setAttribute('height', '14');
                }
            }
            window.setTimeout(function () { if (win) win.style.transition = ''; }, 260);
        }
    }

    /* 弹窗动画与其它弹窗统一：参数由 inject.js 提供，见 window.__blPop */
    function popIn(el) {
        try {
            if (window.__blPop) { window.__blPop.in(el); return; }
        } catch (e) { /* ignore */ }
    }

    function popOut(el, done) {
        try {
            if (window.__blPop) { window.__blPop.out(el, done); return; }
        } catch (e) { /* ignore */ }
        done();
    }

    function openWindow() {
        buildWindow();
        win.style.display = '';
        popIn(win);
        /* 每次打开都置顶，而不是沿用上次的固定值 */
        bringFront();
        return win;
    }

    function closeWindow() {
        if (!win) return;
        var w = win;
        /* display:none 之前先播关闭动画，否则直接消失没有过渡 */
        popOut(w, function () {
            if (w) w.style.display = 'none';
            /* 动画结束要把关闭态清掉，下次打开才是干净的打开态 */
            try { w.classList.remove('bl-pop'); } catch (e) { /* ignore */ }
        });
    }

    function isOpen() {
        if (!win) return false;
        if (win.classList.contains('bl-win-docked')) return false;
        return win.style.display !== 'none';
    }

    /* ---------------- 启动：对齐存档并自动运行已启用脚本 ---------------- */

    function boot() {
        /* 1) 同一页面 / 其它标签页 / 设置页 iframe 改动存档，立刻对齐 */
        try {
            window.addEventListener('storage', function (e) {
                /* key 为 null 表示 localStorage 被清空，同样要对齐 */
                if (!e || e.key === null || String(e.key) === STORE) queueReconcile();
            });
        } catch (e) { /* ignore */ }
        try { window.addEventListener('bl:userscripts-change', queueReconcile); } catch (e2) { /* ignore */ }

        /* 2) 兜底：某些入口直接改 localStorage 却不派发事件时，
              1.2s 内也能发现「脚本被删了」，把残留会话停掉。
              只在原文变化时跑，不会反复重绘列表。 */
        try {
            window.setInterval(function () {
                var raw = '';
                try { raw = window.localStorage.getItem(STORE) || ''; } catch (e3) { return; }
                if (raw !== lastRaw) queueReconcile();
            }, 1200);
        } catch (e4) { /* ignore */ }

        /* 3) 首次对齐：以存档为准，不盲目跑内存里的旧列表 */
        reconcile();
    }

    window.__blUserscript = {
        open: openWindow,
        close: closeWindow,
        isOpen: isOpen,
        install: install,
        run: runItem,
        stop: stopItem,
        sync: reconcile,
        list: function () { return scripts; },
        sessions: function () { return Object.keys(running); },
        log: log
    };

    /* 等 DOM 就绪再跑，避免抢主脚本的启动资源 */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
    } else {
        setTimeout(boot, 0);
    }
})();

