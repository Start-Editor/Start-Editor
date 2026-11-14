
/* ==========================================================================
   [B92] 在线音乐素材库 —— 配合回退后的「音乐工坊」
   --------------------------------------------------------------------------
   · 音乐工坊（[B92] 之前的那个 script）保持学习 Gandi 之前的原样，本块不改它
   · 本块只往 .ms-bar 注入「☁ 在线素材库」按钮与联网状态提示
   · 素材索引与音频文件都从网络按需拉取，不打包进单文件
   · 无网络 / 索引拉取失败 / 音频下载失败 → 明确显示「请联网」
   · 索引多源顺序重试；支持自定义镜像地址；online / offline 实时切换
   ========================================================================== */
(function () {
    'use strict';

    var TAG = '[B92]';
    var CUSTOM_KEY = 'bl.onlineMusic.indexUrl';
    var INDEX_URLS = [
        'https://cdn.jsdelivr.net/gh/scratchfoundation/scratch-gui@develop/src/lib/libraries/sounds.json',
        'https://raw.githubusercontent.com/scratchfoundation/scratch-gui/develop/src/lib/libraries/sounds.json',
        'https://cdn.jsdelivr.net/gh/LLK/scratch-gui@develop/src/lib/libraries/sounds.json',
        'https://gitee.com/dot-2/scratch-gui/raw/master/src/lib/libraries/sounds.json'
    ];
    var ASSET_HOSTS = [
        'https://cdn.assets.scratch.mit.edu/internalapi/asset/',
        'https://assets.scratch.mit.edu/'
    ];

    var S = {
        el: null, open: false, loading: false,
        items: null, source: '', tried: [],
        audio: null, playing: null,
        query: '', tag: '',
        bar: null, btn: null, net: null,
        lastBar: null
    };

    /* ---------------- 小工具 ---------------- */
    function isZh() {
        var l = '';
        try { l = document.documentElement.lang || ''; } catch (e) { /* ignore */ }
        if (!l) { try { l = navigator.language || ''; } catch (e2) { /* ignore */ } }
        return /^zh/i.test(l);
    }
    function L(zh, en) { return isZh() ? zh : en; }
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function offlineNow() {
        try { return navigator.onLine === false; } catch (e) { return false; }
    }
    function readCustom() {
        try { return window.localStorage.getItem(CUSTOM_KEY) || ''; } catch (e) { return ''; }
    }
    function writeCustom(v) {
        try { window.localStorage.setItem(CUSTOM_KEY, String(v || '')); } catch (e) { /* ignore */ }
    }
    function toast(msg) {
        var old = document.getElementById('bom-toast');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var d = document.createElement('div');
        d.id = 'bom-toast'; d.className = 'bom-toast';
        d.textContent = msg;
        document.body.appendChild(d);
        window.setTimeout(function () { d.classList.add('out'); }, 2200);
        window.setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2600);
    }
    function fetchAny(url, ms, binary) {
        return new Promise(function (resolve, reject) {
            var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
            var done = false;
            var timer = window.setTimeout(function () {
                if (done) return;
                done = true;
                try { if (ctl) ctl.abort(); } catch (e) { /* ignore */ }
                reject(new Error('timeout'));
            }, ms || 7000);
            var opt = { cache: 'no-store', mode: 'cors' };
            if (ctl) opt.signal = ctl.signal;
            fetch(url, opt).then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return binary ? r.arrayBuffer() : r.text();
            }).then(function (d) {
                if (done) return;
                done = true; window.clearTimeout(timer); resolve(d);
            }, function (e) {
                if (done) return;
                done = true; window.clearTimeout(timer); reject(e);
            });
        });
    }

    /* ---------------- 样式 ---------------- */
    var CSS = [
        '.bom-open{position:relative;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}',
        '.bom-dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:#39b56a;box-shadow:0 0 0 2px rgba(57,181,106,.18)}',
        '.bom-dot.busy{background:#e8a33d;box-shadow:0 0 0 2px rgba(232,163,61,.2)}',
        '.bom-dot.off{background:#9aa4b2;box-shadow:none}',
        '.bom-net{display:none;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:11px;',
        '  line-height:18px;color:#b23b3b;background:rgba(214,80,80,.12);white-space:nowrap}',
        '.bom-net.show{display:inline-block}',
        '.bom-drawer{position:fixed;right:22px;top:82px;width:390px;max-width:calc(100vw - 32px);',
        '  max-height:calc(100vh - 120px);display:none;flex-direction:column;z-index:1000000;',
        '  border-radius:16px;overflow:hidden;color:var(--text-primary,#333);',
        '  background:var(--ui-primary,#f4f8ff);border:1px solid var(--ui-black-transparent,rgba(0,0,0,.1));',
        '  box-shadow:0 18px 54px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.55);',
        '  font-family:inherit;font-size:13px}',
        '.bom-drawer.on{display:flex}',
        '.bom-head{display:flex;align-items:center;gap:8px;padding:12px 14px;',
        '  border-bottom:1px solid var(--ui-black-transparent,rgba(0,0,0,.09));flex:0 0 auto}',
        '.bom-title{font-weight:700;font-size:14px;flex:1;min-width:0;overflow:hidden;',
        '  text-overflow:ellipsis;white-space:nowrap}',
        '.bom-x{border:0;background:transparent;cursor:pointer;font-size:19px;line-height:1;',
        '  color:inherit;opacity:.62;padding:2px 6px;border-radius:6px}',
        '.bom-x:hover{opacity:1;background:var(--ui-black-transparent,rgba(0,0,0,.07))}',
        '.bom-tools{display:flex;gap:6px;padding:10px 12px;flex:0 0 auto;flex-wrap:wrap;',
        '  border-bottom:1px solid var(--ui-black-transparent,rgba(0,0,0,.07))}',
        '.bom-search{flex:1;min-width:120px;box-sizing:border-box;padding:6px 9px;border-radius:8px;',
        '  border:1px solid var(--ui-black-transparent,rgba(0,0,0,.16));background:var(--ui-white,#fff);',
        '  color:inherit;font:inherit;outline:none}',
        '.bom-mini{border:1px solid var(--ui-black-transparent,rgba(0,0,0,.16));',
        '  background:var(--ui-white,#fff);color:inherit;border-radius:8px;padding:6px 9px;',
        '  cursor:pointer;font:inherit;white-space:nowrap}',
        '.bom-mini:hover{filter:brightness(.96)}',
        '.bom-tags{display:flex;gap:5px;padding:8px 12px 2px;flex-wrap:wrap;flex:0 0 auto;max-height:70px;overflow:auto}',
        '.bom-chip{border:1px solid var(--ui-black-transparent,rgba(0,0,0,.14));background:transparent;',
        '  color:inherit;border-radius:12px;padding:3px 9px;font-size:11px;cursor:pointer}',
        '.bom-chip.on{background:var(--looks-secondary,#4c97ff);color:#fff;border-color:transparent}',
        '.bom-body{flex:1 1 auto;overflow:auto;padding:10px 12px 14px;min-height:120px}',
        '.bom-src{font-size:11px;opacity:.6;padding:0 12px 8px;word-break:break-all;flex:0 0 auto}',
        '.bom-offline{height:100%;min-height:190px;display:flex;flex-direction:column;',
        '  align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px}',
        '.bom-cloud{font-size:38px;line-height:1;opacity:.55}',
        '.bom-big{font-size:20px;font-weight:700;letter-spacing:2px}',
        '.bom-sub{font-size:11px;opacity:.66;line-height:1.5}',
        '.bom-retry{margin-top:4px;border:0;border-radius:9px;padding:8px 18px;cursor:pointer;',
        '  background:var(--looks-secondary,#4c97ff);color:#fff;font:inherit;font-weight:600}',
        '.bom-custom{display:flex;gap:5px;margin-top:8px;width:100%;max-width:320px}',
        '.bom-custom input{flex:1;min-width:0;box-sizing:border-box;padding:6px 8px;border-radius:8px;',
        '  border:1px solid var(--ui-black-transparent,rgba(0,0,0,.16));background:var(--ui-white,#fff);',
        '  color:inherit;font:inherit;font-size:11px;outline:none}',
        '.bom-custom button{white-space:nowrap}',
        '.bom-loading{display:flex;align-items:center;justify-content:center;gap:9px;padding:40px 0;opacity:.7}',
        '.bom-spin{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;',
        '  border-right-color:transparent;animation:bom-spin .8s linear infinite}',
        '@keyframes bom-spin{to{transform:rotate(360deg)}}',
        '.bom-list{display:flex;flex-direction:column;gap:6px}',
        '.bom-item{display:flex;align-items:center;gap:8px;padding:8px 9px;border-radius:10px;',
        '  background:var(--ui-white,rgba(255,255,255,.75));',
        '  border:1px solid var(--ui-black-transparent,rgba(0,0,0,.07))}',
        '.bom-ico{width:26px;height:26px;border-radius:7px;flex:0 0 auto;display:flex;',
        '  align-items:center;justify-content:center;font-size:13px;',
        '  background:rgba(76,151,255,.14);color:var(--looks-secondary,#4c97ff)}',
        '.bom-meta{flex:1;min-width:0}',
        '.bom-name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.bom-info{font-size:10px;opacity:.62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.bom-act{border:1px solid var(--ui-black-transparent,rgba(0,0,0,.15));background:transparent;',
        '  color:inherit;border-radius:7px;padding:5px 8px;font-size:11px;cursor:pointer;white-space:nowrap}',
        '.bom-act:hover{background:rgba(76,151,255,.12)}',
        '.bom-act.pri{background:var(--looks-secondary,#4c97ff);color:#fff;border-color:transparent}',
        '.bom-act:disabled{opacity:.5;cursor:default}',
        '.bom-empty{padding:30px 10px;text-align:center;opacity:.6}',
        '.bom-toast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:1000001;',
        '  padding:9px 16px;border-radius:10px;background:rgba(28,32,40,.92);color:#fff;',
        '  font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.28);transition:opacity .32s}',
        '.bom-toast.out{opacity:0}',
        '@media (max-width:700px){.bom-drawer{right:8px;top:70px;width:calc(100vw - 16px)}}',
        '@media (prefers-reduced-motion:reduce){.bom-spin{animation:none}}'
    ].join('\n');

    function injectCss() {
        if (document.getElementById('bom-style')) return;
        var st = document.createElement('style');
        st.id = 'bom-style';
        st.textContent = CSS;
        document.head.appendChild(st);
    }

    /* ---------------- 素材库抽屉 ---------------- */
    function buildDrawer() {
        if (S.el) return S.el;
        var el = document.createElement('div');
        el.className = 'bom-drawer';
        el.setAttribute('data-bom-drawer', '1');
        el.innerHTML =
            '<div class="bom-head">' +
            '<div class="bom-title">☁ ' + esc(L('在线音乐素材库', 'Online Sound Library')) + '</div>' +
            '<button type="button" class="bom-x" data-bom="close" title="' +
                esc(L('关闭', 'Close')) + '">×</button>' +
            '</div>' +
            '<div class="bom-tools" data-bom="tools" style="display:none">' +
            '<input type="text" class="bom-search" data-bom="search" placeholder="' +
                esc(L('搜索素材…', 'Search sounds…')) + '" />' +
            '<button type="button" class="bom-mini" data-bom="refresh">' +
                esc(L('刷新', 'Refresh')) + '</button>' +
            '</div>' +
            '<div class="bom-tags" data-bom="tags" style="display:none"></div>' +
            '<div class="bom-body" data-bom="body"></div>' +
            '<div class="bom-src" data-bom="src"></div>';
        document.body.appendChild(el);
        S.el = el;

        el.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            var b = t.closest('[data-bom]');
            if (!b) return;
            var act = b.getAttribute('data-bom');
            if (act === 'close') { closeDrawer(); return; }
            if (act === 'refresh') { loadIndex(true); return; }
            if (act === 'retry') { loadIndex(true); return; }
            if (act === 'custom') {
                var inp = el.querySelector('.bom-custom input');
                var v = inp ? String(inp.value || '').trim() : '';
                if (v) { writeCustom(v); loadIndex(true); }
                else toast(L('请填写索引地址', 'Enter an index URL'));
                return;
            }
            if (act === 'chip') {
                S.tag = b.getAttribute('data-tag') || '';
                renderList();
                return;
            }
            if (act === 'preview') { preview(getItem(b.getAttribute('data-id')), b); return; }
            if (act === 'import') { importItem(getItem(b.getAttribute('data-id')), b); return; }
        });
        el.addEventListener('input', function (e) {
            if (e.target && e.target.getAttribute && e.target.getAttribute('data-bom') === 'search') {
                S.query = String(e.target.value || '').toLowerCase();
                renderList();
            }
        });
        return el;
    }
    function body() { return S.el ? S.el.querySelector('[data-bom="body"]') : null; }
    function tools() { return S.el ? S.el.querySelector('[data-bom="tools"]') : null; }
    function tagsBox() { return S.el ? S.el.querySelector('[data-bom="tags"]') : null; }
    function srcLine() { return S.el ? S.el.querySelector('[data-bom="src"]') : null; }

    function getItem(id) {
        if (!S.items) return null;
        for (var i = 0; i < S.items.length; i++) if (S.items[i].id === id) return S.items[i];
        return null;
    }

    function openDrawer() {
        buildDrawer();
        S.open = true;
        S.el.classList.add('on');
        if (offlineNow()) renderOffline();
        else if (S.items && S.items.length) renderList();
        else loadIndex(false);
    }
    function closeDrawer() {
        S.open = false;
        if (S.el) S.el.classList.remove('on');
        stopPreview();
    }

    function setTools(on) {
        var t = tools(), g = tagsBox();
        if (t) t.style.display = on ? 'flex' : 'none';
        if (g) g.style.display = on ? 'flex' : 'none';
    }

    function renderLoading() {
        setTools(false);
        var b = body();
        if (!b) return;
        b.innerHTML = '<div class="bom-loading"><span class="bom-spin"></span>' +
            esc(L('正在连接在线素材库…', 'Connecting to the online library…')) + '</div>';
        var s = srcLine(); if (s) s.textContent = L('正在尝试：', 'Trying: ') + (S.tried[S.tried.length - 1] || '…');
        updateDot();
    }

    function renderOffline() {
        setTools(false);
        var b = body();
        if (!b) return;
        var custom = readCustom();
        b.innerHTML =
            '<div class="bom-offline">' +
            '<div class="bom-cloud">☁</div>' +
            '<div class="bom-big">' + esc(L('请联网', 'Please connect to the internet')) + '</div>' +
            '<div class="bom-sub">' +
                esc(L('在线音乐素材库需要网络连接才能加载素材', 'The online sound library needs an internet connection')) +
            '</div>' +
            '<button type="button" class="bom-retry" data-bom="retry">' +
                esc(L('重试', 'Retry')) + '</button>' +
            '<div class="bom-custom">' +
                '<input type="text" value="' + esc(custom) + '" placeholder="' +
                    esc(L('自定义索引地址（可选）', 'Custom index URL (optional)')) + '" />' +
                '<button type="button" class="bom-mini" data-bom="custom">' +
                    esc(L('使用此源', 'Use')) + '</button>' +
            '</div>' +
            '</div>';
        var s = srcLine();
        if (s) {
            s.textContent = offlineNow()
                ? L('当前处于离线状态', 'You are offline')
                : (S.tried.length
                    ? L('已尝试 ', 'Tried ') + S.tried.length + L(' 个源均不可用', ' source(s), all unavailable')
                    : L('在线素材库暂不可用', 'Online library unavailable'));
        }
        updateNet(true);
        updateDot();
    }

    function renderList() {
        setTools(true);
        var b = body();
        if (!b || !S.items) return;
        /* 标签 chips */
        var counts = Object.create(null), i, j;
        for (i = 0; i < S.items.length; i++) {
            var tg = S.items[i].tags;
            for (j = 0; j < tg.length && j < 3; j++) {
                var k = tg[j].toLowerCase();
                if (k) counts[k] = (counts[k] || 0) + 1;
            }
        }
        var keys = Object.keys(counts).sort(function (a, c) { return counts[c] - counts[a]; }).slice(0, 10);
        var g = tagsBox();
        if (g) {
            var gh = '<button type="button" class="bom-chip' + (S.tag ? '' : ' on') +
                '" data-bom="chip" data-tag="">' + esc(L('全部', 'All')) + '</button>';
            for (i = 0; i < keys.length; i++) {
                gh += '<button type="button" class="bom-chip' + (S.tag === keys[i] ? ' on' : '') +
                    '" data-bom="chip" data-tag="' + esc(keys[i]) + '">' + esc(keys[i]) + '</button>';
            }
            g.innerHTML = gh;
        }
        /* 过滤 */
        var q = S.query, out = [];
        for (i = 0; i < S.items.length; i++) {
            var it = S.items[i];
            if (S.tag && it.tags.join(' ').toLowerCase().indexOf(S.tag) < 0) continue;
            if (q && (it.name + ' ' + it.tags.join(' ')).toLowerCase().indexOf(q) < 0) continue;
            out.push(it);
        }
        if (!out.length) {
            b.innerHTML = '<div class="bom-empty">' + esc(L('没有匹配的素材', 'No matching sounds')) + '</div>';
        } else {
            var h = '<div class="bom-list">';
            for (i = 0; i < out.length; i++) {
                var o = out[i];
                h += '<div class="bom-item">' +
                    '<div class="bom-ico">♪</div>' +
                    '<div class="bom-meta">' +
                        '<div class="bom-name" title="' + esc(o.name) + '">' + esc(o.name) + '</div>' +
                        '<div class="bom-info">' + esc(o.dur) + ' · ' + esc(o.tags.slice(0, 3).join(' / ') || o.format) + '</div>' +
                    '</div>' +
                    '<button type="button" class="bom-act" data-bom="preview" data-id="' + esc(o.id) + '">' +
                        esc(L('试听', 'Play')) + '</button>' +
                    '<button type="button" class="bom-act pri" data-bom="import" data-id="' + esc(o.id) + '">' +
                        esc(L('导入', 'Import')) + '</button>' +
                    '</div>';
            }
            b.innerHTML = h + '</div>';
        }
        var s = srcLine();
        if (s) s.textContent = L('在线素材 ', 'Online sounds: ') + out.length + ' / ' + S.items.length +
            (S.source ? ' · ' + S.source.replace(/^https?:\/\//, '').slice(0, 46) : '');
        updateNet(false);
        updateDot();
    }

    /* ---------------- 索引 ---------------- */
    function normalize(o) {
        if (!o || typeof o !== 'object') return null;
        var md5 = o.md5ext || o.md5 || o.file || '';
        if (typeof md5 !== 'string') return null;
        md5 = md5.replace(/^\/+/, '');
        if (!/^[0-9a-f]{16,}\.[a-z0-9]{2,4}$/i.test(md5)) return null;
        var tags = [];
        if (Array.isArray(o.tags)) tags = o.tags.map(function (x) { return String(x); });
        else if (typeof o.tags === 'string') tags = o.tags.split(/[,\s]+/).filter(Boolean);
        var rate = Number(o.rate) || 0, cnt = Number(o.sampleCount) || 0;
        return {
            id: md5,
            name: String(o.name || md5.split('.')[0]),
            md5: md5,
            tags: tags,
            rate: rate,
            count: cnt,
            format: String(o.format || md5.split('.').pop() || 'wav'),
            dur: (rate > 0 && cnt > 0) ? (cnt / rate).toFixed(1) + 's' : '—'
        };
    }
    function assetUrls(md5) {
        return [
            ASSET_HOSTS[0] + md5 + '/get/',
            ASSET_HOSTS[1] + md5
        ];
    }
    function loadIndex(force) {
        if (S.loading) return;
        if (!force && S.items && S.items.length) { renderList(); return; }
        if (offlineNow()) { renderOffline(); return; }
        S.loading = true;
        S.tried = [];
        renderLoading();
        var urls = INDEX_URLS.slice();
        var custom = readCustom();
        if (custom) urls.unshift(custom);
        var i = 0;
        function next() {
            if (i >= urls.length) {
                S.loading = false;
                if (S.open) renderOffline();
                return;
            }
            var u = urls[i++];
            S.tried.push(u);
            var s0 = srcLine();
            if (s0) s0.textContent = L('正在尝试：', 'Trying: ') + u.replace(/^https?:\/\//, '').slice(0, 60);
            fetchAny(u, 7000, false).then(function (txt) {
                var arr;
                try { arr = JSON.parse(txt); } catch (e) { throw new Error('bad json'); }
                if (!Array.isArray(arr)) throw new Error('not array');
                var items = [], k;
                for (k = 0; k < arr.length; k++) {
                    var n = normalize(arr[k]);
                    if (n) items.push(n);
                }
                if (!items.length) throw new Error('empty');
                S.items = items;
                S.source = u;
                S.loading = false;
                if (S.open) renderList();
                else updateDot();
            }, function () { window.setTimeout(next, 0); });
        }
        next();
    }

    /* ---------------- 试听 / 导入 ---------------- */
    function stopPreview() {
        if (S.audio) {
            try { S.audio.pause(); } catch (e) { /* ignore */ }
            try { S.audio.src = ''; } catch (e2) { /* ignore */ }
            S.audio = null;
        }
        if (S.playing && S.el) {
            var old = S.el.querySelector('.bom-act.previewing');
            if (old) { old.classList.remove('previewing'); old.textContent = L('试听', 'Play'); }
        }
        S.playing = null;
    }
    function preview(item, btn) {
        if (!item) return;
        if (offlineNow()) { toast(L('请联网', 'Please connect to the internet')); return; }
        if (S.playing === item.id) { stopPreview(); return; }
        stopPreview();
        var a = new Audio();
        var urls = assetUrls(item.md5), k = 0;
        function tryPlay() {
            if (k >= urls.length) {
                toast(L('请联网', 'Please connect to the internet'));
                stopPreview();
                return;
            }
            a.src = urls[k++];
            var p = a.play();
            if (p && typeof p.catch === 'function') {
                p.catch(function () { tryPlay(); });
            }
        }
        S.audio = a;
        S.playing = item.id;
        btn.classList.add('previewing');
        btn.textContent = L('停止', 'Stop');
        a.addEventListener('ended', function () { stopPreview(); });
        tryPlay();
    }

    function decodeBuffer(ab) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return Promise.reject(new Error('no AudioContext'));
        var ctx;
        try { ctx = new C(); } catch (e) { return Promise.reject(e); }
        return new Promise(function (res, rej) {
            try {
                var p = ctx.decodeAudioData(ab.slice(0), function (b) { res(b); },
                    function (err) { rej(err || new Error('decode')); });
                if (p && typeof p.then === 'function') p.then(res, rej);
            } catch (e2) { rej(e2); }
        });
    }
    function addToStudio(buf, item) {
        var api = window.__blMusic;
        if (!api || typeof api.addClip !== 'function') {
            toast(L('请先打开「音乐」工作区', 'Open the Music workspace first'));
            return false;
        }
        var tracks = (typeof api.tracks === 'function' ? api.tracks() : []) || [];
        var at = null, i;
        for (i = 0; i < tracks.length; i++) {
            if (tracks[i] && tracks[i].kind === 'audio') { at = tracks[i]; break; }
        }
        if (!at && typeof api.addTrack === 'function') {
            try { at = api.addTrack(L('在线素材', 'Online'), 'audio'); } catch (e) { at = null; }
        }
        if (!at) { toast(L('没有可用的音轨', 'No audio track available')); return false; }
        var clips = (typeof api.clips === 'function' ? api.clips() : []) || [];
        var end = 0;
        for (i = 0; i < clips.length; i++) {
            if (clips[i] && clips[i].tid === at.id) {
                end = Math.max(end, (Number(clips[i].start) || 0) + (Number(clips[i].dur) || 0));
            }
        }
        api.addClip(buf, item.name, at.id, end);
        if (typeof api.show === 'function') { try { api.show(true); } catch (e2) { /* ignore */ } }
        toast(L('已导入：', 'Imported: ') + item.name);
        return true;
    }
    function importItem(item, btn) {
        if (!item) return;
        if (offlineNow()) { toast(L('请联网', 'Please connect to the internet')); return; }
        var urls = assetUrls(item.md5), k = 0;
        btn.disabled = true;
        var old = btn.textContent;
        btn.textContent = '…';
        function next() {
            if (k >= urls.length) {
                btn.disabled = false; btn.textContent = old;
                toast(L('请联网', 'Please connect to the internet'));
                return;
            }
            var u = urls[k++];
            fetchAny(u, 14000, true).then(function (ab) {
                decodeBuffer(ab).then(function (buf) {
                    btn.disabled = false; btn.textContent = old;
                    addToStudio(buf, item);
                }, function () { next(); });
            }, function () { next(); });
        }
        next();
    }

    /* ---------------- 工具条按钮 / 状态 ---------------- */
    var lastDot = '', lastNet = null;
    function updateDot() {
        if (!S.btn) return;
        var off = offlineNow();
        var cls = off ? 'off' : (S.loading ? 'busy' : 'on');
        var txt = '☁ ' + (off ? L('请联网', 'Offline') : L('在线素材库', 'Library'));
        var key = cls + '|' + txt;
        if (key === lastDot) return;      /* 签名短路，静息零 DOM 写入 */
        lastDot = key;
        var d = S.btn.querySelector('.bom-dot');
        if (d) d.className = 'bom-dot ' + cls;
        var t = S.btn.querySelector('.bom-txt');
        if (t) t.textContent = txt;
    }
    function updateNet(off) {
        if (!S.net) return;
        var txt = L('请联网', 'Please connect to the internet');
        var key = (off ? '1' : '0') + '|' + txt;
        if (key === lastNet) return;
        lastNet = key;
        if (off) {
            S.net.textContent = txt;
            S.net.classList.add('show');
        } else {
            S.net.classList.remove('show');
        }
    }
    function ensureButton() {
        var bars = document.querySelectorAll('.ms-panel .ms-bar, .ms-bar');
        if (!bars.length) return false;
        var bar = bars[0];
        if (bar === S.lastBar && bar.querySelector('[data-bom-open]')) {
            updateDot();                 /* 切语言 / 联网状态变化时只改文字，不重建节点 */
            if (offlineNow()) updateNet(true);
            return true;
        }
        S.lastBar = bar;
        S.bar = bar;
        if (!S.btn) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'ms-btn bom-open';
            b.setAttribute('data-bom-open', '1');
            b.innerHTML = '<span class="bom-dot on"></span><span class="bom-txt">☁ ' +
                esc(L('在线素材库', 'Library')) + '</span>';
            b.addEventListener('click', function (e) {
                e.preventDefault(); e.stopPropagation();
                openDrawer();
            });
            S.btn = b;
        }
        if (S.btn.parentNode !== bar) bar.appendChild(S.btn);
        if (!S.net) {
            var n = document.createElement('span');
            n.className = 'bom-net';
            S.net = n;
        }
        if (S.net.parentNode !== bar) bar.appendChild(S.net);
        updateDot();
        if (offlineNow()) updateNet(true);
        return true;
    }

    /* ---------------- 事件 ---------------- */
    function bindGlobal() {
        window.addEventListener('offline', function () {
            updateDot();
            if (S.net) updateNet(true);
            if (S.open) { S.loading = false; renderOffline(); }
        });
        window.addEventListener('online', function () {
            updateDot();
            if (S.net) updateNet(false);
            if (S.open) loadIndex(true);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && S.open) { closeDrawer(); }
        }, true);
        document.addEventListener('click', function (e) {
            if (!S.open || !S.el) return;
            var t = e.target;
            if (S.el.contains(t)) return;
            if (t && t.closest && t.closest('[data-bom-open]')) return;
            closeDrawer();
        }, true);
    }

    /* ---------------- 启动 ---------------- */
    injectCss();
    buildDrawer();
    bindGlobal();
    try { ensureButton(); } catch (e) { /* ignore */ }
    /* 低频巡检：音乐面板是 React 动态挂载的，被换掉后自动补挂。
       签名短路，静息时每轮只有一次 querySelectorAll，不写 DOM。 */
    window.setInterval(function () {
        try { ensureButton(); } catch (e2) { /* ignore */ }
    }, 1200);

    window.__blOnlineMusic = {
        open: openDrawer,
        close: closeDrawer,
        reload: function () { loadIndex(true); },
        items: function () { return S.items ? S.items.slice() : []; },
        source: function () { return S.source; }
    };
    if (window.__blSync) window.__blSync.register('B92-online-music', ensureButton);
})();
