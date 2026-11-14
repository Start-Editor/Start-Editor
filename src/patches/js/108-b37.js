
(function () {
    'use strict';
    if (window.__blStarAISettings) return;
    window.__blStarAISettings = true;

    var KEY = 'bl.star.ai';
    var DEF = { enabled: true, callName: '', temperature: 0.7,
                freeId: 'gpt35', canOperate: false };
    /* 依旧是 [B37] 内置的那三个免费模型，id 与 FREE_LIST 一致 */
    var MODELS = [
        ['gpt35', 'StepFun（内置免费）', 'StepFun (built-in free)'],
        ['dsv3',  'DEEPSEEK V3（内置免费）', 'DEEPSEEK V3 (built-in free)'],
        ['dsr1',  'DEEPSEEK R1（内置免费）', 'DEEPSEEK R1 (built-in free)']
    ];

    var active = false, modal = null, lastSig = '', raf = 0;

    function read() {
        var d = {};
        for (var k in DEF) if (Object.prototype.hasOwnProperty.call(DEF, k)) d[k] = DEF[k];
        try {
            var raw = window.localStorage.getItem(KEY);
            if (!raw) return d;
            var o = JSON.parse(raw);
            if (!o || typeof o !== 'object') return d;
            if (typeof o.enabled === 'boolean') d.enabled = o.enabled;
            if (typeof o.callName === 'string') d.callName = o.callName.slice(0, 16);
            if (typeof o.temperature === 'number' && isFinite(o.temperature)) {
                d.temperature = Math.max(0, Math.min(2, o.temperature));
            }
            for (var i = 0; i < MODELS.length; i++) {
                if (o.freeId === MODELS[i][0]) d.freeId = o.freeId;
            }
            d.canOperate = false; /* 只读：忽略历史存档里的操作授权 */
        } catch (e) { /* ignore */ }
        return d;
    }
    function write(o) {
        try { window.localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
        /* [B37] 监听这个事件，同一个事件循环内对齐模型与提示词 */
        try { document.dispatchEvent(new CustomEvent('bl:star-ai-change')); } catch (e2) {}
    }
    function zh() {
        try {
            var l = String(document.documentElement.lang || navigator.language || '');
            if (/(?:^|[?&])locale=en/i.test(location.search)) return false;
            if (/^en/i.test(l)) return false;
        } catch (e) { /* ignore */ }
        return true;
    }
    function esc(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function body() {
        return document.querySelector('[class*="settings-modal_body_"]');
    }
    function group() {
        var gs = document.querySelectorAll('[class*="modal-sidebar_group_"]');
        for (var i = 0; i < gs.length; i++) {
            var h = gs[i].querySelector('[class*="modal-sidebar_groupHeader_"]');
            var t = h ? String(h.textContent || '').trim() : '';
            if (t === '常规' || t === 'General') return gs[i];
        }
        return null;
    }
    function insertAfter(node, ref) {
        if (!node || !ref || !ref.parentNode) return false;
        if (ref.nextSibling) ref.parentNode.insertBefore(node, ref.nextSibling);
        else ref.parentNode.appendChild(node);
        return true;
    }
    function mountNav() {
        var g = group();
        if (!g) return null;
        var own = g.querySelector('[data-bl-star-ai]');
        if (own && own.isConnected) return own;
        var anchor = g.querySelector('[data-bl-ver]') ||
                     g.querySelector('[class*="modal-sidebar_item_"]');
        if (!anchor) return null;
        var it = anchor.cloneNode(true);
        it.removeAttribute('data-bl-ver');
        it.setAttribute('data-bl-star-ai', '1');
        it.setAttribute('type', 'button');
        it.setAttribute('title', 'STAR AI');
        it.setAttribute('aria-label', 'STAR AI');
        var m = String(it.className).match(/modal-sidebar_itemSelected_[A-Za-z0-9_-]+/);
        if (m) it.className = it.className.replace(m[0], '').replace(/\s+/g, ' ').trim();
        var lb = it.querySelector('[class*="modal-sidebar_label_"]');
        if (lb) lb.textContent = 'STAR AI'; else it.textContent = 'STAR AI';
        var sv = it.querySelector('svg');
        if (sv) {
            sv.setAttribute('viewBox', '0 0 24 24');
            sv.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1.8" ' +
                'stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>' +
                '<path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></g>';
        }
        insertAfter(it, anchor);
        return it;
    }
    function cardsHtml(z) {
        var lang = z ? 'zh' : 'en';
        var opts = '';
        for (var i = 0; i < MODELS.length; i++) {
            opts += '<option value="' + MODELS[i][0] + '">' + esc(z ? MODELS[i][1] : MODELS[i][2]) + '</option>';
        }
        var h = '';
        /* ① 总开关 */
        h += '<div class="bl-sa-card" data-bl-starai="1" data-bl-sa-lang="' + lang + '">' +
             '<h3>' + (z ? '是否开启 STAR AI 功能' : 'Enable STAR AI') + '</h3>' +
             '<p class="bl-sa-d">' + (z
                ? 'STAR 现在只聊天与教学，不会编程作品或点击编辑器。关闭后 DOCK 上的 STAR 入口隐藏、STT 快捷启动停用，AI 不再响应；开启后下面几项才可设置。'
                : 'STAR only chats and teaches now — it will not program projects or click the editor. When off, the Dock STAR entry is hidden, STT is disabled and AI will not respond.') + '</p>' +
             '<label class="bl-sa-row"><span>' + (z ? '启用' : 'Enabled') + '</span>' +
             '<input type="checkbox" class="bl-sa-chk" data-k="enabled"></label></div>';
        /* ② 称呼 */
        h += '<div class="bl-sa-card" data-bl-starai="1" data-bl-sa-dep="1" data-bl-sa-lang="' + lang + '">' +
             '<h3>' + (z ? 'STAR 对你的称呼' : 'What STAR calls you') + '</h3>' +
             '<p class="bl-sa-d">' + (z
                ? '写进系统提示词，STAR 每次开口都会这样称呼你；留空则不指定。'
                : 'Injected into the system prompt; STAR will address you this way. Leave empty for none.') + '</p>' +
             '<input type="text" class="bl-sa-text" data-k="callName" maxlength="16" ' +
             'placeholder="' + (z ? '例如：小明' : 'e.g. Alex') + '"></div>';
        /* ③ 温度 */
        h += '<div class="bl-sa-card" data-bl-starai="1" data-bl-sa-dep="1" data-bl-sa-lang="' + lang + '">' +
             '<h3>' + (z ? 'STAR 的温度' : 'STAR temperature') + '</h3>' +
             '<p class="bl-sa-d">' + (z
                ? '越高回答越发散；用于通用接口的请求体，免费接口写进系统预设。'
                : 'Higher means more varied answers; sent as temperature for custom APIs and folded into the preset for free APIs.') + '</p>' +
             '<label class="bl-sa-row"><input type="range" min="0" max="1" step="0.05" ' +
             'data-k="temperature"><span class="bl-sa-val" data-v="temperature">0.70</span></label></div>';
        /* ④ API：依旧内置三个免费模型 */
        h += '<div class="bl-sa-card" data-bl-starai="1" data-bl-sa-dep="1" data-bl-sa-lang="' + lang + '">' +
             '<h3>' + (z ? 'STAR AI 的 API' : 'STAR AI API') + '</h3>' +
             '<p class="bl-sa-d">' + (z
                ? '依旧是编辑器内置的三个免费模型，不需要填地址或密钥。'
                : 'Still the three built-in free models — no URL or key needed.') + '</p>' +
             '<select class="bl-sa-sel" data-k="freeId">' + opts + '</select></div>';
        /* ⑤ 能力范围：恒只读，不再提供「允许操作编辑器」开关 */
        h += '<div class="bl-sa-card" data-bl-starai="1" data-bl-sa-dep="1" data-bl-sa-lang="' + lang + '">' +
             '<h3>' + (z ? 'STAR 的能力范围' : 'STAR capability') + '</h3>' +
             '<p class="bl-sa-d">' + (z
                ? 'STAR 只陪你聊天、用文字教学提示 Start Editor 的用法；不会替你编程作品、生成积木，也不会点击或操作编辑器。此项固定只读，不提供开关。'
                : 'STAR only chats and teaches Start Editor in plain text. It will not program projects, generate blocks, or click / operate the editor. Fixed read-only, no toggle.') + '</p>' +
             '<span class="bl-sa-kbd">' + (z ? '只读 · 聊天 / 教学' : 'READ-ONLY · CHAT / TEACH') + '</span></div>';
        /* ⑥ 快捷启动键 */
        h += '<div class="bl-sa-card" data-bl-starai="1" data-bl-sa-dep="1" data-bl-sa-lang="' + lang + '">' +
             '<h3>' + (z ? '快捷启动键' : 'Shortcut') + '</h3>' +
             '<p class="bl-sa-d">' + (z
                ? '在编辑器里依次按 S、T、T（1.2 秒内），即可打开 / 收起 STAR AI；输入框内不触发。'
                : 'Press S, T, T within 1.2s in the editor to toggle STAR AI; ignored while typing.') + '</p>' +
             '<span class="bl-sa-kbd">STT</span></div>';
        return h;
    }
    function mountCards(b, z) {
        var lang = z ? 'zh' : 'en';
        var cards = b.querySelectorAll('[data-bl-starai]');
        if (cards.length && cards[0].getAttribute('data-bl-sa-lang') === lang) return;
        for (var i = 0; i < cards.length; i++) {
            if (cards[i].parentNode) cards[i].parentNode.removeChild(cards[i]);
        }
        var tmp = document.createElement('div');
        tmp.innerHTML = cardsHtml(z);
        while (tmp.firstChild) b.appendChild(tmp.firstChild);
    }
    function syncValues(b) {
        var c = read(), z = zh();
        var els = b.querySelectorAll('[data-bl-starai] [data-k]');
        for (var i = 0; i < els.length; i++) {
            var el = els[i], k = el.getAttribute('data-k');
            if (document.activeElement !== el) {
                if (el.type === 'checkbox') el.checked = !!c[k];
                else el.value = String(c[k]);
            }
            el.disabled = (k !== 'enabled') && !c.enabled;
        }
        var v = b.querySelector('[data-v="temperature"]');
        if (v) v.textContent = Number(c.temperature).toFixed(2);
        try {
            document.documentElement.classList.toggle('bl-sa-locked', !c.enabled);
            document.documentElement.classList.toggle('bl-star-ai-off', !c.enabled);
        } catch (e) { /* ignore */ }
    }
    function setActive(on) {
        active = !!on;
        var b = body();
        if (b) b.classList.toggle('bl-starai-mode', active);
        var it = document.querySelector('[data-bl-star-ai]');
        if (it) it.classList.toggle('is-on', active);
        try { document.documentElement.classList.toggle('bl-sa-active', active); } catch (e) {}
        if (active) {
            /* 与「版本号」页互斥 */
            try { if (window.__blVerSetActive) window.__blVerSetActive(false); } catch (e) {}
            if (b) syncValues(b);
        }
        lastSig = '';
    }
    function onCtl(e) {
        var el = e.target;
        if (!el || !el.getAttribute) return;
        var k = el.getAttribute('data-k');
        if (!k || !el.closest || !el.closest('[data-bl-starai]')) return;
        if (e.type === 'input' && k === 'temperature') {
            var v = body() && body().querySelector('[data-v="temperature"]');
            if (v) v.textContent = Number(el.value).toFixed(2);
            return;
        }
        var c = read();
        if (el.type === 'checkbox') c[k] = !!el.checked;
        else if (k === 'temperature') c[k] = Number(el.value);
        else c[k] = String(el.value);
        write(c);
        var b = body();
        if (b) syncValues(b);
    }
    function tick() {
        var b = body();
        /* 总开关对 DOCK / STT 的影响不依赖设置窗口是否打开：窗口没渲染时
           也要同步，否则关掉 STAR AI 后刷新页面，入口要等打开设置才消失。 */
        try {
            var c0 = read();
            document.documentElement.classList.toggle('bl-sa-active', active);
            document.documentElement.classList.toggle('bl-star-ai-off', !c0.enabled);
            document.documentElement.classList.toggle('bl-sa-locked', !c0.enabled);
        } catch (e0) {}
        if (modal && !modal.isConnected) { setActive(false); modal = null; }
        if (!b) return;
        try { modal = b.closest('[class*="modal_"]') || b.parentElement || b; } catch (e) {}
        mountNav();
        mountCards(b, zh());
        if (b.classList.contains('bl-starai-mode') !== active) {
            b.classList.toggle('bl-starai-mode', active);
        }
        var c = read();
        var sig = JSON.stringify(c) + '|' + (zh() ? 'zh' : 'en') + '|' + active +
                  '|' + b.querySelectorAll('[data-bl-starai]').length;
        if (sig !== lastSig) { lastSig = sig; syncValues(b); }
    }
    function schedule() {
        if (raf) return;
        raf = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })
            .call(window, function () { raf = 0; tick(); });
    }

    document.addEventListener('click', function (e) {
        var t = e && e.target;
        if (!t || !t.closest) return;
        if (t.closest('[data-bl-star-ai]')) { setActive(true); schedule(); return; }
        if (t.closest('[data-bl-ver]')) { setActive(false); schedule(); return; }
        if (t.closest('[class*="modal-sidebar_item_"]')) { setActive(false); schedule(); }
    }, true);
    document.addEventListener('change', onCtl, true);
    document.addEventListener('input', onCtl, true);
    document.addEventListener('bl:star-ai-change', function () { lastSig = ''; schedule(); });
    window.addEventListener('storage', function (e) {
        if (e && e.key === KEY) { lastSig = ''; schedule(); }
    });
    /* 观察具体的设置内容区（不是 documentElement），绕开性能总线的冻结 */
    try {
        var mo = new MutationObserver(function () { schedule(); });
        var host = document.querySelector('[class*="modal-sidebar_content_"]');
        if (host) mo.observe(host, { childList: true, subtree: true,
                                     attributes: true, attributeFilter: ['class'] });
    } catch (e) { /* ignore */ }
    setInterval(function () { try { tick(); } catch (e2) { /* ignore */ } }, 800);
    tick();

    window.__blStarAISettings = {
        read: read, write: write, open: function () { setActive(true); tick(); },
        close: function () { setActive(false); tick(); }, tick: tick
    };
})();
