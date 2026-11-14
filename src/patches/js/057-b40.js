/* ── [B40] save.js · 保存到此电脑 ─────────────────────────────────────────────
   依赖：VM / B94 STAR / B73 __blFormatIO / B97 预编译缓存
   维护：点「保存到电脑 / 保存到此电脑」→ 三选一弹窗 SB3 · STAR · RJ
   ------------------------------------------------------------------
   [1.0.5 SEA] 本轮变更：
     · 原版 SimpleDialog 只有「确定 / 取消」两个按钮，无法放三个格式，
       改成同风格的三选一弹窗（卡片 + 数字键 1/2/3 + Esc 取消）；
     · 新增「保存为 .rj」；SB3 / STAR / RJ 三个都走 [B97] 预编译缓存，
       放下积木时后台已生成好字节，点保存通常零等待；
     · 菜单文案兼容「保存到此电脑」等别名，命中判定改为包含匹配。
   ========================================================================== */
(function () {
    'use strict';

    var SAVE_MARKS = [
        '保存到电脑', '保存到此电脑', '立即保存', '保存作品到电脑',
        '保存项目到电脑', '另存到电脑', '下载到电脑',
        'Save to computer', 'Save to this computer', 'Save to your computer',
        'Download to computer', 'Download to this computer'
    ];

    function isZh() {
        try {
            var l = (document.documentElement.lang || '').toLowerCase();
            if (l.indexOf('zh') === 0) return true;
            if (l.indexOf('en') === 0) return false;
        } catch (e) { /* ignore */ }
        try { return /保存到电脑|保存到此电脑|文件/.test(document.body.innerText || ''); } catch (e2) { return true; }
    }
    function T(zh, en) { return isZh() ? zh : en; }

    /* ---------------- 基础 ---------------- */
    function vmObj() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            var v = (st && st.scratchGui && st.scratchGui.vm) || window.vm;
            return (v && typeof v.saveProjectSb3 === 'function') ? v : null;
        } catch (e) { return null; }
    }
    function projectTitle() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            var t = st && st.scratchGui && st.scratchGui.projectState &&
                st.scratchGui.projectState.projectTitle;
            if (t) return String(t);
        } catch (e) { /* ignore */ }
        return '';
    }
    function safeName(s) {
        var t = String(s === null || s === undefined ? '' : s).replace(/[\\/:*?"<>|]/g, '_');
        t = t.replace(/^\s+|\s+$/g, '');
        return t || 'project';
    }
    function toU8(d) {
        if (!d) return null;
        if (d instanceof Uint8Array) return d;
        if (typeof ArrayBuffer !== 'undefined' && d instanceof ArrayBuffer) return new Uint8Array(d);
        if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(d)) {
            return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
        }
        return null;
    }
    function download(u8, name) {
        var blob = new Blob([u8], { type: 'application/octet-stream' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        window.setTimeout(function () {
            if (a.parentNode) a.parentNode.removeChild(a);
            try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        }, 4000);
    }
    function toast(text) {
        try {
            var el = document.createElement('div');
            el.className = 'bl-sv-toast';
            el.textContent = text;
            document.body.appendChild(el);
            window.setTimeout(function () {
                el.style.opacity = '0';
                window.setTimeout(function () {
                    if (el.parentNode) el.parentNode.removeChild(el);
                }, 320);
            }, 2400);
        } catch (e) { /* ignore */ }
    }
    function addStyle() {
        if (document.getElementById('bl-sv-style')) return;
        var s = document.createElement('style');
        s.id = 'bl-sv-style';
        s.textContent =
            '.bl-sv-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);' +
            'z-index:2147483000;padding:9px 16px;border-radius:10px;' +
            'background:rgba(28,32,40,.72);color:#fff;font-size:13px;line-height:1.4;' +
            'border:1px solid rgba(255,255,255,.14);' +
            'backdrop-filter:blur(12px) saturate(150%);' +
            '-webkit-backdrop-filter:blur(12px) saturate(150%);' +
            'box-shadow:0 6px 24px rgba(0,0,0,.28);pointer-events:none;' +
            'transition:opacity .3s ease;max-width:78vw}' +
            /* 三选一弹窗：沿用原版 modal 的圆角/遮罩语言，但三种格式需要三张卡 */
            '.bl-sv-mask{position:fixed;inset:0;z-index:1000000;display:flex;' +
            'align-items:center;justify-content:center;padding:20px;' +
            'background:rgba(20,28,42,.42);backdrop-filter:blur(7px) saturate(130%);' +
            '-webkit-backdrop-filter:blur(7px) saturate(130%);' +
            'animation:blSvFade .18s ease both}' +
            '@keyframes blSvFade{from{opacity:0}to{opacity:1}}' +
            '.bl-sv-dlg{width:min(560px,94vw);padding:22px 24px 18px;border-radius:18px;' +
            'background:var(--ui-primary,#fff);color:var(--text-primary,#2d3748);' +
            'border:1px solid var(--ui-black-transparent,rgba(0,0,0,.09));' +
            'box-shadow:0 22px 64px rgba(0,0,0,.24);' +
            'animation:blSvPop .24s cubic-bezier(.22,.9,.3,1) both}' +
            '@keyframes blSvPop{from{opacity:0;transform:translateY(12px) scale(.97)}' +
            'to{opacity:1;transform:none}}' +
            '.bl-sv-eyebrow{font-size:10px;letter-spacing:.18em;font-weight:800;' +
            'color:var(--looks-secondary,#4c97ff);opacity:.85}' +
            '.bl-sv-dlg h3{margin:6px 0 5px;font-size:19px;font-weight:800}' +
            '.bl-sv-dlg > p{margin:0 0 16px;font-size:12px;opacity:.66;line-height:1.6}' +
            '.bl-sv-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}' +
            '.bl-sv-card{position:relative;display:flex;flex-direction:column;gap:6px;' +
            'text-align:left;padding:14px 13px 13px;border-radius:14px;cursor:pointer;' +
            'font-family:inherit;color:var(--text-primary,#2d3748);' +
            'background:var(--ui-secondary,#f7f9fc);' +
            'border:1px solid var(--ui-black-transparent,rgba(0,0,0,.10));' +
            'transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}' +
            '.bl-sv-card:hover,.bl-sv-card:focus-visible{transform:translateY(-3px);' +
            'border-color:var(--looks-secondary,#4c97ff);outline:none;' +
            'box-shadow:0 10px 24px rgba(0,0,0,.13)}' +
            '.bl-sv-ico{width:34px;height:34px;display:flex;align-items:center;' +
            'justify-content:center;border-radius:10px;color:#fff;' +
            'background:linear-gradient(135deg,var(--looks-secondary,#4c97ff),#8a7cf7)}' +
            '.bl-sv-ico svg{width:19px;height:19px}' +
            '.bl-sv-t{font-size:14px;font-weight:800;letter-spacing:.02em}' +
            '.bl-sv-d{font-size:11px;opacity:.66;line-height:1.5;min-height:32px}' +
            '.bl-sv-key{position:absolute;top:9px;right:10px;font-size:10px;' +
            'font-weight:800;opacity:.42;border:1px solid currentColor;' +
            'border-radius:5px;padding:1px 5px}' +
            '.bl-sv-foot{display:flex;align-items:center;justify-content:space-between;' +
            'gap:12px;margin-top:16px;padding-top:12px;font-size:11px;opacity:.72;' +
            'border-top:1px solid var(--ui-black-transparent,rgba(0,0,0,.07))}' +
            '.bl-sv-ready{color:var(--looks-secondary,#4c97ff);font-weight:700}' +
            '.bl-sv-cancel{border:none;background:transparent;cursor:pointer;' +
            'font-family:inherit;font-size:11.5px;color:var(--text-primary,#2d3748);opacity:.7}' +
            '.bl-sv-cancel:hover{opacity:1}' +
            '@media(max-width:520px){.bl-sv-cards{grid-template-columns:1fr}}' +
            '@media(prefers-reduced-motion:reduce){.bl-sv-mask,.bl-sv-dlg{animation:none}' +
            '.bl-sv-card:hover{transform:none}}';
        (document.head || document.documentElement).appendChild(s);
    }

    /* ---------------- 取作品字节：优先命中预编译缓存 ---------------- */
    function getBundle() {
        var P = window.__blPrecompiled;
        if (P && typeof P.get === 'function') return P.get();
        var v = vmObj();
        if (!v) return Promise.reject(new Error('编辑器还没准备好'));
        return Promise.resolve(v.saveProjectSb3('arraybuffer')).then(function (buf) {
            var u8 = toU8(buf);
            if (!u8 || !u8.length) throw new Error('拿不到作品数据');
            return { sb3: u8, star: null, rj: null, hit: false, ms: 0 };
        });
    }
    function buildStar(u8) {
        var IO = window.__blStarIO;
        if (!IO || typeof IO.pack !== 'function') throw new Error('STAR 打包器未就绪');
        var packed = IO.pack(u8);
        /* 输出自检：还原 → 解出 project.json → 必须含 targets */
        var files = IO.readAll(IO.restore(packed)), pj = null;
        for (var i = 0; i < files.length; i++) {
            if (files[i].name === 'project.json') {
                pj = JSON.parse(new TextDecoder('utf-8').decode(files[i].data));
                break;
            }
        }
        if (!pj || !pj.targets || !pj.targets.length) throw new Error('输出自检未读到角色');
        return packed;
    }
    function buildRj(u8) {
        var F = window.__blFormatIO;
        if (!F || typeof F.sb3ToRj !== 'function') throw new Error('RJ 打包器未就绪');
        var zip = F.write(F.sb3ToRj(F.readAll(u8)));
        /* 输出自检：重新解包并拼回标准 sb3，必须读得到角色 */
        var pj = F.j(F.get(F.rjToSb3(F.readAll(zip)), 'project.json'));
        if (!pj || !pj.targets || !pj.targets.length) throw new Error('输出自检未读到角色');
        return zip;
    }

    /* ---------------- 三种格式统一下载 ---------------- */
    function saveAs(fmt) {
        var name = safeName(projectTitle()), t0 = Date.now();
        getBundle().then(function (b) {
            var u8 = b.sb3;
            if (!u8 || !u8.length) throw new Error('作品数据为空');
            var bytes, ext, label;
            if (fmt === 'star') {
                bytes = b.star || buildStar(u8);
                ext = 'star'; label = '.STAR';
            } else if (fmt === 'rj') {
                bytes = b.rj || buildRj(u8);
                ext = 'rj'; label = '.RJ';
            } else {
                bytes = u8; ext = 'sb3'; label = '.SB3';
            }
            if (!bytes || !bytes.length) throw new Error('打包结果为空');
            download(bytes, name + '.' + ext);
            var ms = Date.now() - t0;
            var cut = (fmt === 'star' && u8.length)
                ? '，小 ' + Math.max(0, Math.round((1 - bytes.length / u8.length) * 100)) + '%' : '';
            toast('已保存：' + name + '.' + ext + '（' + (bytes.length / 1024).toFixed(0) +
                ' KB' + cut + '，' + ms + 'ms' + (b.hit ? '，预编译命中' : '') + '）');
        }).catch(function (err) {
            var msg = (err && err.message) || err;
            /* 只有非 SB3 打包失败才回退标准 SB3，避免静默产出坏文件 */
            if (fmt !== 'sb3') {
                toast(labelOf(fmt) + ' 打包失败，已改为标准 .SB3：' + msg);
                saveAs('sb3');
            } else {
                toast('保存失败：' + msg);
            }
        });
    }
    function labelOf(f) { return f === 'star' ? '.STAR' : f === 'rj' ? '.RJ' : '.SB3'; }
    function saveSb3() { saveAs('sb3'); }
    function saveStar() { saveAs('star'); }
    function saveRj() { saveAs('rj'); }

    /* ---------------- 三选一格式弹窗 ----------------
       原版 SimpleDialog 只支持 alert / confirm / prompt，按钮固定两个，
       放不下三种格式。这里用同一套主题变量自绘三张卡片，键盘 1/2/3
       直接选，Esc / 取消 = 不下载；点空白处不关闭。 */
    var ICONS = {
        sb3: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h11l5 5v11H4z"/><path d="M15 4v5h5"/><path d="M8 13h8M8 17h6"/></svg>',
        star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 6.2L21 9l-5 4.3 1.5 6.7L12 16.8 6.5 20 8 13.3 3 9l6.6-.8z"/></svg>',
        rj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 11h18M8 15h3"/></svg>'
    };
    function askFormat() {
        var P = window.__blPrecompiled;
        var st = null;
        try { st = P && P.status ? P.status() : null; } catch (e) {}
        var ready = st && st.clean && st.hasStar !== undefined;
        var readyText = st && st.clean
            ? T('⚡ 已预编译 · 点选即下载，序列化零等待', '⚡ Precompiled — instant download, zero serialization wait')
            : T('⏳ 正在后台预编译… 点选时会自动取最新作品', '⏳ Precompiling in background — the latest project is used on click');

        var cards = [
            { f: 'sb3', t: 'SB3', zh: '标准格式 · 兼容其它编辑器，体积最大', en: 'Standard format · compatible with other editors, largest' },
            { f: 'star', t: 'STAR', zh: '分片加速包 · 体积更小，START EDITOR 可直接打开', en: 'Sharded archive · smaller, opens directly in START EDITOR' },
            { f: 'rj', t: 'RJ', zh: 'RemixWarp 工程 · 角色与积木分文件存储', en: 'RemixWarp project · targets and blocks stored separately' }
        ];
        var h = '<div class="bl-sv-dlg" role="dialog" aria-modal="true">' +
            '<div class="bl-sv-eyebrow">START EDITOR · EXPORT</div>' +
            '<h3>' + esc(T('打包为哪种格式？', 'Package as which format?')) + '</h3>' +
            '<p>' + esc(T('选择一种格式下载到电脑；三种格式的字节已在后台预编译，通常无需等待。',
                          'Pick one format to download. All three variants are precompiled in the background, so there is usually no wait.')) + '</p>' +
            '<div class="bl-sv-cards">';
        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            h += '<button type="button" class="bl-sv-card" data-f="' + c.f + '">' +
                 '<span class="bl-sv-key">' + (i + 1) + '</span>' +
                 '<span class="bl-sv-ico">' + ICONS[c.f] + '</span>' +
                 '<span class="bl-sv-t">' + c.t + '</span>' +
                 '<span class="bl-sv-d">' + esc(isZh() ? c.zh : c.en) + '</span>' +
                 '</button>';
        }
        h += '</div><div class="bl-sv-foot"><span class="bl-sv-ready">' + esc(readyText) + '</span>' +
             '<button type="button" class="bl-sv-cancel" data-a="cancel">' +
             esc(T('取消 (Esc)', 'Cancel (Esc)')) + '</button></div></div>';
        var mask = document.createElement('div');
        mask.className = 'bl-sv-mask';
        mask.innerHTML = h;
        try { document.body.appendChild(mask); }
        catch (e) { nativeFallback(); return; }

        function close() {
            document.removeEventListener('keydown', onKey, true);
            if (mask.parentNode) mask.parentNode.removeChild(mask);
        }
        function choose(f) { close(); saveAs(f); }
        function onKey(e) {
            if (e.key === 'Escape') { e.preventDefault(); close(); return; }
            if (e.key === '1') { e.preventDefault(); choose('sb3'); }
            else if (e.key === '2') { e.preventDefault(); choose('star'); }
            else if (e.key === '3') { e.preventDefault(); choose('rj'); }
        }
        mask.addEventListener('click', function (e) {
            var b = e.target && e.target.closest && e.target.closest('[data-f]');
            if (b) { choose(b.getAttribute('data-f')); return; }
            var c = e.target && e.target.closest && e.target.closest('[data-a="cancel"]');
            if (c) close();
        });
        document.addEventListener('keydown', onKey, true);
        try {
            var first = mask.querySelector('.bl-sv-card');
            if (first) first.focus();
        } catch (e2) {}
        if (ready) { /* 仅用于未来 UI 扩展；当前只显示状态文案 */ }
    }
    function nativeFallback() {
        /* DOM 完全不可用时的兜底：仍让用户用 1/2/3 选，绝不静默只存 SB3 */
        try {
            var a = window.prompt(T(
                '打包为哪种格式？\n1 = SB3（标准）\n2 = STAR（更小）\n3 = RJ（分文件工程）',
                'Package as which format?\n1 = SB3 (standard)\n2 = STAR (smaller)\n3 = RJ (split project)'), '1');
            if (a === '2') saveAs('star');
            else if (a === '3') saveAs('rj');
            else if (a === '1') saveAs('sb3');
        } catch (e) { saveAs('sb3'); }
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ---------------- 拦截「保存到此电脑」 ---------------- */
    function ownText(n) {
        var s = '';
        for (var i = 0; i < n.childNodes.length; i++) {
            if (n.childNodes[i].nodeType === 3) s += n.childNodes[i].nodeValue;
        }
        return s.replace(/\s+/g, ' ').trim();
    }
    function hitMark(t) {
        var n = t, i;
        for (i = 0; i < 6 && n; i++) {
            var txt = ownText(n) || String(n.textContent || '').trim();
            if (txt && txt.length < 40) {
                for (var k = 0; k < SAVE_MARKS.length; k++) {
                    if (txt === SAVE_MARKS[k] || txt.indexOf(SAVE_MARKS[k]) >= 0) return n;
                }
            }
            n = n.parentElement;
        }
        return null;
    }
    /* 菜单被我们拦下后不会自己关闭：关闭动作挂在被拦掉的那个 onClick 上。
       补一次对菜单条按钮的点击，让它自己收起来。 */
    function closeMenu(n) {
        var done = false;
        try {
            var bar = n && n.closest ? n.closest('[class*="menu-bar_menu-bar-item"]') : null;
            if (bar) {
                bar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                done = true;
            }
        } catch (e) { /* ignore */ }
        if (done) return;
        try {
            document.dispatchEvent(new KeyboardEvent('keydown',
                { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
        } catch (e2) { /* ignore */ }
    }
    function onCaptureClick(e) {
        if (e.button !== undefined && e.button !== 0) return;
        var n = hitMark(e.target);
        if (!n) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        closeMenu(n);
        askFormat();
    }

    /* 打开作品文件框：.rj 由 [B39] 兼容层接管，.star 由 [B94] 接管，
       标准 .sb3 不受影响。 */
    function watchFileInput() {
        function patch(x) {
            if (!x || x.__blSvAccept) return;
            var a = x.getAttribute('accept') || '';
            if (a.indexOf('.sb3') < 0) return;          /* 只改「打开作品」那一个 */
            var add = '';
            if (a.indexOf('.rj') < 0) add += ',.rj';
            if (a.indexOf('.star') < 0) add += ',.star';
            if (!add) { x.__blSvAccept = 1; return; }
            x.setAttribute('accept', a + add);
            x.__blSvAccept = 1;
        }
        try {
            var mo = new MutationObserver(function (ms) {
                for (var i = 0; i < ms.length; i++) {
                    var adds = ms[i].addedNodes || [];
                    for (var j = 0; j < adds.length; j++) {
                        var n = adds[j];
                        if (!n || n.nodeType !== 1) continue;
                        if (n.tagName === 'INPUT') patch(n);
                        var ins = n.querySelectorAll ? n.querySelectorAll('input[type=file]') : [];
                        for (var k = 0; k < ins.length; k++) patch(ins[k]);
                    }
                }
            });
            mo.observe(document.body || document.documentElement,
                { childList: true, subtree: true });
        } catch (e) { /* ignore */ }
    }

    function install() {
        try { addStyle(); } catch (e) { /* ignore */ }
        window.addEventListener('click', onCaptureClick, true);
        try { watchFileInput(); } catch (e2) { /* ignore */ }
        return true;
    }
    try { install(); } catch (e) { /* ignore */ }

    window.__blSave = {
        save: saveSb3,
        saveSb3: saveSb3,
        saveStar: saveStar,
        saveRj: saveRj,
        saveAs: saveAs,
        askFormat: askFormat,
        getBundle: getBundle,
        marks: SAVE_MARKS
    };
})();
