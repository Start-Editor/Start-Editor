
/* ── [B82] 工程文件工作区 ─────────────────────────────────────────────────
   依赖：B00（__blInflateB64 同步解压）/ B52 自定义标签体系 / VM.saveProjectSb3
   维护：查看当前作品「打包成 .sb3 后」zip 里的全部文件

   · 真的调用 vm.saveProjectSb3('arraybuffer') 生成 zip，不凭 VM 结构猜清单；
     所以文件名、压缩方式、压缩后大小都和「保存到电脑」得到的 sb3 完全一致。
   · 自解析 ZIP 中央目录（不依赖 JSZip 全局，它没暴露到 window），
     只读取目录拿元数据；点开预览 / 下载时才解压单个文件。
   · 从 project.json 建立 md5ext → 角色 / 造型 / 声音 的归属映射，
     列表里能看出「这一张图是哪个角色的哪个造型」。
   · 复用 li.bl-py-tab / .bl-py-active / .bl-py-panel 三个名字，
     B52 的互斥体系零改动；面板不可见时不打包，静息零开销。
   ─────────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';
    if (window.__blProjectFilesBooted) return;
    window.__blProjectFilesBooted = true;

    /* ── 双语 ─────────────────────────────────────────────────────────── */
    var TXT = {
        zh: {
            tab: '工程文件', title: '工程文件 · SB3 内容',
            refresh: '重新打包', download: '下载 .sb3', expand: '全部展开', collapse: '全部折叠',
            search: '搜索文件名或角色…',
            packing: '正在打包当前作品为 SB3…', noVM: '编辑器还没准备好，稍后再试',
            badZip: '无法解析 SB3 压缩包', noInflater: '解压器不可用，请刷新页面',
            files: '个文件', raw: '原始', packed: '打包后', saved: '节省',
            grpJson: '工程数据', grpCostume: '造型资源', grpSound: '声音资源', grpOther: '其它文件',
            binary: '二进制文件 · 下载后查看', textCut: '（内容较长，已截断）',
            previewErr: '读取失败：', stage: '舞台', ownerSep: ' · ',
            unassigned: '未归类', store: 'STORE', deflate: 'DEFLATE',
            dlOne: '下载', empty: '还没有打包结果，点「重新打包」生成',
            ok: '已生成', jsonHint: '全部积木、角色、变量与列表都在这个文件里',
            tooMany: '文件较多，已展开前 40 项'
        },
        en: {
            tab: 'Project Files', title: 'Project Files · SB3 contents',
            refresh: 'Repackage', download: 'Download .sb3', expand: 'Expand all', collapse: 'Collapse all',
            search: 'Find file or sprite…',
            packing: 'Packaging project as SB3…', noVM: 'Editor is not ready yet',
            badZip: 'Could not parse the SB3 archive', noInflater: 'Inflater unavailable, please reload',
            files: 'files', raw: 'raw', packed: 'packed', saved: 'saved',
            grpJson: 'Project data', grpCostume: 'Costumes', grpSound: 'Sounds', grpOther: 'Other files',
            binary: 'Binary file · download to inspect', textCut: '(truncated)',
            previewErr: 'Read failed: ', stage: 'Stage', ownerSep: ' · ',
            unassigned: 'Unassigned', store: 'STORE', deflate: 'DEFLATE',
            dlOne: 'Save', empty: 'No package yet — click Repackage',
            ok: 'ready', jsonHint: 'All blocks, sprites, variables and lists live here',
            tooMany: 'Many files — expanded the first 40'
        }
    };
    function lang() {
        var l = '';
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            l = st && st.scratchGui && st.scratchGui.locales && st.scratchGui.locales.locale;
        } catch (e) { /* ignore */ }
        if (!l) l = document.documentElement.lang || '';
        return /^en/i.test(l) ? 'en' : 'zh';
    }
    function L(k) { return (TXT[lang()] || TXT.zh)[k] || TXT.zh[k] || k; }
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function mk(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }
    function fmtSize(n) {
        if (!isFinite(n)) return '—';
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(2) + ' MB';
    }
    function extOf(name) {
        var i = String(name).lastIndexOf('.');
        return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
    }
    function mimeOf(name) {
        var m = {
            json: 'application/json', svg: 'image/svg+xml', png: 'image/png',
            jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp',
            webp: 'image/webp', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg',
            ttf: 'font/ttf', otf: 'font/otf'
        };
        return m[extOf(name)] || 'application/octet-stream';
    }

    /* ── ZIP：只读中央目录，按需解压单个条目 ─────────────────────────────
       SB3 是标准 zip：project.json 用 DEFLATE，二进制资源多用 STORE。
       JSZip 没有暴露到 window，所以自己解析；解压复用 B00 的同步
       __blInflateB64（raw deflate，与 zip 的 method 8 完全一致）。         */
    function u8ToB64(u8) {
        var CH = 0x8000, parts = [], i;
        for (i = 0; i < u8.length; i += CH) {
            parts.push(String.fromCharCode.apply(null, u8.subarray(i, i + CH)));
        }
        return btoa(parts.join(''));
    }
    function inflateRaw(u8, expected) {
        if (typeof window.__blInflateB64 !== 'function') throw new Error(L('noInflater'));
        return window.__blInflateB64(u8ToB64(u8), expected | 0);
    }
    function decodeName(bytes) {
        if (typeof TextDecoder === 'function') {
            try { return new TextDecoder('utf-8').decode(bytes); } catch (e) { /* ignore */ }
        }
        var out = '', i;
        for (i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
        return out;
    }
    function readU64(dv, p) {
        return dv.getUint32(p, true) + dv.getUint32(p + 4, true) * 4294967296;
    }
    function parseZip(buf) {
        var ab = buf, dv = new DataView(ab), u8 = new Uint8Array(ab), n = ab.byteLength;
        var eocd = -1, min = Math.max(0, n - 65558), p;
        for (p = n - 22; p >= min; p--) {
            if (p >= 0 && p + 22 <= n && dv.getUint32(p, true) === 0x06054b50) { eocd = p; break; }
        }
        if (eocd < 0) throw new Error(L('badZip'));
        var cdOff = dv.getUint32(eocd + 16, true);
        var cdSize = dv.getUint32(eocd + 12, true);
        if (cdOff === 0xffffffff || cdSize === 0xffffffff) throw new Error('ZIP64 not supported');
        var stop = Math.min(n, cdOff + cdSize);
        var entries = [], q = cdOff;
        /* 不用 totalEntries：它可能是 0xFFFF（ZIP64）或与实际不符，
           以「中央目录区间 + 签名」为界更稳。 */
        while (q + 46 <= stop && q + 46 <= n && entries.length < 30000) {
            if (dv.getUint32(q, true) !== 0x02014b50) break;
            var flags = dv.getUint16(q + 8, true);
            var method = dv.getUint16(q + 10, true);
            var crc = dv.getUint32(q + 16, true);
            var csize = dv.getUint32(q + 20, true);
            var usize = dv.getUint32(q + 24, true);
            var nameLen = dv.getUint16(q + 28, true);
            var extraLen = dv.getUint16(q + 30, true);
            var cmtLen = dv.getUint16(q + 32, true);
            var lho = dv.getUint32(q + 42, true);
            var name = decodeName(u8.subarray(q + 46, q + 46 + nameLen));
            if (csize === 0xffffffff || usize === 0xffffffff || lho === 0xffffffff) {
                var ex = q + 46 + nameLen, exEnd = ex + extraLen, d;
                while (ex + 4 <= exEnd) {
                    var hid = dv.getUint16(ex, true), hsz = dv.getUint16(ex + 2, true);
                    d = ex + 4;
                    if (hid === 0x0001) {
                        if (usize === 0xffffffff && d + 8 <= exEnd) { usize = readU64(dv, d); d += 8; }
                        if (csize === 0xffffffff && d + 8 <= exEnd) { csize = readU64(dv, d); d += 8; }
                        if (lho === 0xffffffff && d + 8 <= exEnd) lho = readU64(dv, d);
                        break;
                    }
                    ex += 4 + hsz;
                }
            }
            entries.push({
                name: name, flags: flags, method: method, crc: crc,
                csize: csize, usize: usize, lho: lho
            });
            q += 46 + nameLen + extraLen + cmtLen;
        }
        if (!entries.length) throw new Error(L('badZip'));
        return { ab: ab, dv: dv, u8: u8, entries: entries };
    }
    function readEntry(z, e) {
        var dv = z.dv, p = e.lho;
        if (p + 30 > z.u8.length || dv.getUint32(p, true) !== 0x04034b50)
            throw new Error('bad local header');
        var nl = dv.getUint16(p + 26, true), xl = dv.getUint16(p + 28, true);
        var start = p + 30 + nl + xl;
        var raw = z.u8.subarray(start, start + e.csize);
        if (e.method === 0) return raw.slice();
        if (e.method === 8) return inflateRaw(raw, e.usize);
        throw new Error('compression method ' + e.method);
    }

    /* ── 归属：project.json → md5ext 属于哪个角色/造型/声音 ─────────────── */
    function buildOwner(z) {
        var map = Object.create(null), info = { json: '', targets: 0, costumes: 0, sounds: 0 };
        var pj = null, i;
        for (i = 0; i < z.entries.length; i++) {
            if (z.entries[i].name === 'project.json') { pj = z.entries[i]; break; }
        }
        if (!pj) return { map: map, info: info };
        var txt;
        try { txt = new TextDecoder('utf-8').decode(readEntry(z, pj)); }
        catch (e) { return { map: map, info: info }; }
        info.json = txt;
        try {
            var d = JSON.parse(txt), ts = d.targets || [];
            info.targets = ts.length;
            ts.forEach(function (t) {
                var tn = t.name || '', who = t.isStage ? L('stage') : tn;
                (t.costumes || []).forEach(function (c) {
                    var k = c.md5ext || ((c.assetId || '') + '.' + (c.dataFormat || 'svg'));
                    if (!k) return;
                    map[k] = { owner: who, item: c.name || '', kind: 'costume' };
                    info.costumes++;
                });
                (t.sounds || []).forEach(function (c) {
                    var k = c.md5ext || ((c.assetId || '') + '.' + (c.dataFormat || 'wav'));
                    if (!k) return;
                    map[k] = { owner: who, item: c.name || '', kind: 'sound' };
                    info.sounds++;
                });
            });
        } catch (e) { /* project.json 结构异常不影响列文件 */ }
        return { map: map, info: info };
    }
    function kindOf(name, owner) {
        if (name === 'project.json') return 'json';
        if (owner) return owner.kind;
        var e = extOf(name);
        if (/^(svg|png|jpg|jpeg|gif|bmp|webp)$/.test(e)) return 'costume';
        if (/^(wav|mp3|ogg|m4a)$/.test(e)) return 'sound';
        return 'other';
    }
    function groupsOf(c) {
        var g = { json: [], costume: [], sound: [], other: [] };
        c.z.entries.forEach(function (e) {
            var o = c.owner.map[e.name];
            g[kindOf(e.name, o)].push({ e: e, o: o });
        });
        Object.keys(g).forEach(function (k) {
            g[k].sort(function (a, b) { return a.e.name.localeCompare(b.e.name); });
        });
        return g;
    }

    /* ── VM / 打包 ─────────────────────────────────────────────────────── */
    function getVM() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            var g = st && st.scratchGui;
            return (g && g.vm) || (st && st.vm) || window.vm || null;
        } catch (e) { return null; }
    }
    function projectTitle() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            var t = st && st.scratchGui &&
                (st.scratchGui.projectTitle || st.scratchGui.projectName);
            if (t) return String(t).replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
        } catch (e) { /* ignore */ }
        return 'project';
    }
    function saveBlob(blob, name) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = name; a.style.display = 'none';
        (document.body || document.documentElement).appendChild(a);
        a.click();
        window.setTimeout(function () {
            try { a.parentNode.removeChild(a); URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        }, 1500);
    }
    function bytesBlob(u8, name) { return new Blob([u8], { type: mimeOf(name) }); }

    var cache = null, dirty = true, busy = false;
    var panel = null, hostEl = null, tabEl = null;
    var barEl = null, listEl = null, statEl = null, searchEl = null;
    var flat = [], filter = '', lastLang = '';

    function setStatus(msg, isErr) {
        if (!statEl) return;
        statEl.textContent = msg;
        statEl.classList.toggle('is-err', !!isErr);
    }
    function updateStat() {
        if (!statEl || !cache) return;
        var raw = 0, packed = 0;
        cache.z.entries.forEach(function (e) { raw += e.usize; packed += e.csize; });
        var r = raw > 0 ? Math.max(0, Math.round((1 - packed / raw) * 100)) : 0;
        statEl.classList.remove('is-err');
        statEl.innerHTML = '<b>' + cache.z.entries.length + '</b> ' + esc(L('files')) +
            ' · ' + esc(L('raw')) + ' <b>' + fmtSize(raw) + '</b>' +
            ' · ' + esc(L('packed')) + ' <b>' + fmtSize(packed) + '</b>' +
            ' · ' + esc(L('saved')) + ' <b>' + r + '%</b> · ' + esc(L('ok'));
    }
    function pack(force) {
        if (!force && cache && !dirty) { updateStat(); return Promise.resolve(cache); }
        if (busy) return Promise.resolve(cache);
        var vm = getVM();
        if (!vm || typeof vm.saveProjectSb3 !== 'function') {
            setStatus(L('noVM'), true);
            return Promise.reject(new Error(L('noVM')));
        }
        busy = true;
        setStatus(L('packing'));
        return Promise.resolve(vm.saveProjectSb3('arraybuffer')).then(function (buf) {
            return (buf && typeof buf.arrayBuffer === 'function' && !(buf instanceof ArrayBuffer))
                ? buf.arrayBuffer() : buf;
        }).then(function (buf) {
            var ab = (buf instanceof ArrayBuffer) ? buf
                : (buf && buf.buffer instanceof ArrayBuffer)
                    ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
                    : null;
            if (!ab) throw new Error(L('badZip'));
            var z = parseZip(ab);
            cache = { z: z, owner: buildOwner(z), at: Date.now(), bytes: ab.byteLength };
            dirty = false; busy = false;
            render(); updateStat();
            return cache;
        })['catch'](function (err) {
            busy = false;
            setStatus(L('previewErr') + (err && err.message || String(err)), true);
            throw err;
        });
    }
    function markDirty() { dirty = true; }
    function bindDirty() {
        var vm = getVM();
        if (!vm || typeof vm.on !== 'function' || vm.__blPfBound) return;
        try {
            vm.on('targetsUpdate', markDirty);
            vm.on('workspaceUpdate', markDirty);
            vm.on('PROJECT_CHANGED', markDirty);
            vm.__blPfBound = true;
        } catch (e) { /* ignore */ }
    }

    /* ── 渲染 ─────────────────────────────────────────────────────────── */
    function match(it) {
        if (!filter) return true;
        var o = it.o || {};
        return (it.e.name + ' ' + (o.owner || '') + ' ' + (o.item || ''))
            .toLowerCase().indexOf(filter) >= 0;
    }
    function rowHTML(it, idx) {
        var e = it.e, o = it.o, ext = extOf(e.name) || '?';
        var ratio = e.usize > 0 ? Math.max(0, Math.round((1 - e.csize / e.usize) * 100)) : 0;
        var owner = o ? esc(o.owner + (o.item ? L('ownerSep') + o.item : '')) : '';
        return '<div class="bl-pf-row" data-i="' + idx + '">' +
            '<span class="bl-pf-caret">▶</span>' +
            '<span class="bl-pf-ico">' + esc(ext.slice(0, 4).toUpperCase()) + '</span>' +
            '<span class="bl-pf-name" title="' + esc(e.name) + '">' + esc(e.name) + '</span>' +
            '<span class="bl-pf-owner" title="' + owner + '">' +
                (owner || '<span style="opacity:.45">—</span>') + '</span>' +
            '<span class="bl-pf-num">' + fmtSize(e.usize) + '</span>' +
            '<span class="bl-pf-num">' + fmtSize(e.csize) + '</span>' +
            '<span class="bl-pf-num bl-pf-ratio">' + (e.usize ? ratio + '%' : '—') + '</span>' +
            '<span class="bl-pf-tag' + (e.method === 8 ? ' is-deflate' : '') + '">' +
                esc(e.method === 8 ? L('deflate') : L('store')) + '</span>' +
            '<button class="bl-pf-dl" data-dl="' + idx + '">' + esc(L('dlOne')) + '</button>' +
        '</div>';
    }
    function paintRows(rows) {
        listEl.innerHTML = '';
        var i = 0;
        function step() {
            var buf = [], end = Math.min(rows.length, i + 40), j;
            for (; i < end; i++) buf.push(rows[i]);
            if (buf.length) listEl.insertAdjacentHTML('beforeend', buf.join(''));
            if (i < rows.length) window.setTimeout(step, 0);
        }
        step();
    }
    function render() {
        if (!listEl) return;
        flat = [];
        if (!cache) {
            listEl.innerHTML = '<div class="bl-pf-empty">' + esc(L('empty')) + '</div>';
            return;
        }
        var g = groupsOf(cache);
        var keys = ['json', 'costume', 'sound', 'other'];
        var titles = {
            json: L('grpJson'), costume: L('grpCostume'),
            sound: L('grpSound'), other: L('grpOther')
        };
        var rows = [], shown = 0;
        keys.forEach(function (k) {
            var items = g[k].filter(match);
            if (!items.length) return;
            rows.push('<div class="bl-pf-group">' + esc(titles[k]) + ' · ' + items.length + '</div>');
            items.forEach(function (it) {
                rows.push(rowHTML(it, flat.length));
                flat.push(it); shown++;
            });
        });
        if (!shown) {
            listEl.innerHTML = '<div class="bl-pf-empty">' + esc(L('empty')) + '</div>';
            return;
        }
        /* 每条都是完整的一行，分帧追加不会切断标签；大作品也不会锁住主线程 */
        paintRows(rows);
    }
    function detailHTML(it) {
        var e = it.e, name = e.name, ext = extOf(name), bytes, i;
        try { bytes = readEntry(cache.z, e); }
        catch (err) {
            return '<div class="bl-pf-note">' +
                esc(L('previewErr') + (err && err.message || String(err))) + '</div>';
        }
        if (name === 'project.json' || ext === 'json') {
            var txt = new TextDecoder('utf-8').decode(bytes);
            try { txt = JSON.stringify(JSON.parse(txt), null, 2); } catch (e2) { /* 原样展示 */ }
            var cutJ = txt.length > 120000;
            if (cutJ) txt = txt.slice(0, 120000);
            return '<pre>' + esc(txt) + (cutJ ? '\n\n' + esc(L('textCut')) : '') + '</pre>';
        }
        if (/^(svg|xml|txt|md|css|js|html)$/.test(ext)) {
            var t = new TextDecoder('utf-8').decode(bytes), cutT = t.length > 60000;
            return '<pre>' + esc(cutT ? t.slice(0, 60000) : t) +
                (cutT ? '\n\n' + esc(L('textCut')) : '') + '</pre>';
        }
        if (/^(png|jpg|jpeg|gif|bmp|webp)$/.test(ext) && bytes.length <= 4 * 1024 * 1024) {
            return '<img alt="' + esc(name) + '" src="data:' + mimeOf(name) +
                ';base64,' + u8ToB64(bytes) + '">';
        }
        if (/^(wav|mp3|ogg)$/.test(ext) && bytes.length <= 8 * 1024 * 1024) {
            return '<audio controls src="data:' + mimeOf(name) +
                ';base64,' + u8ToB64(bytes) + '"></audio>';
        }
        var hex = '', lim = Math.min(bytes.length, 512), h;
        for (i = 0; i < lim; i++) {
            h = bytes[i].toString(16);
            hex += (h.length < 2 ? '0' : '') + h + ((i + 1) % 16 === 0 ? '\n' : ' ');
        }
        return '<div class="bl-pf-note">' + esc(L('binary')) + '</div><pre>' +
            esc(hex) + (bytes.length > lim ? '\n…' : '') + '</pre>';
    }
    function toggleRow(row, force) {
        var open = (typeof force === 'boolean') ? force : !row.classList.contains('is-open');
        if (open === row.classList.contains('is-open')) return;
        var next = row.nextElementSibling;
        row.classList.toggle('is-open', open);
        if (open) {
            var d = document.createElement('div');
            d.className = 'bl-pf-detail';
            var it = flat[+row.getAttribute('data-i')];
            d.innerHTML = it ? detailHTML(it) : '';
            row.parentNode.insertBefore(d, next);
        } else if (next && next.classList.contains('bl-pf-detail')) {
            next.parentNode.removeChild(next);
        }
    }

    /* ── 面板骨架（复用 B52 认得的三个名字）───────────────────────────── */
    var ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
        'stroke-linejoin="round"><path d="M3 7.5V5.5A1.5 1.5 0 0 1 4.5 4h5l2 2h8' +
        'A1.5 1.5 0 0 1 21 7.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>' +
        '<path d="M3 10h18"/><path d="M8 13.5h3"/></svg>';

    function button(text, cls, fn, title) {
        var b = mk('button', cls || '', text);
        if (title) b.title = title;
        b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
        return b;
    }
    function buildPanel() {
        panel = mk('div', 'bl-py-panel bl-pf-panel');

        barEl = mk('div', 'bl-pf-bar');
        barEl.appendChild(button(L('refresh'), 'bl-pf-primary', function () {
            pack(true)['catch'](function () { /* 状态栏已提示 */ });
        }));
        barEl.appendChild(button(L('download'), '', function () {
            if (!cache) { pack(true); return; }
            saveBlob(new Blob([cache.z.u8], { type: 'application/x.scratch.sb3' }),
                projectTitle() + '.sb3');
        }));
        barEl.appendChild(button(L('expand'), '', function () {
            var rows = listEl.querySelectorAll('.bl-pf-row'), i;
            var lim = Math.min(rows.length, 40);
            for (i = 0; i < lim; i++) toggleRow(rows[i], true);
            if (rows.length > lim) setStatus(L('tooMany'));
        }));
        barEl.appendChild(button(L('collapse'), '', function () {
            var rows = listEl.querySelectorAll('.bl-pf-row'), i;
            for (i = 0; i < rows.length; i++) toggleRow(rows[i], false);
        }));
        searchEl = document.createElement('input');
        searchEl.className = 'bl-pf-search';
        searchEl.type = 'search';
        searchEl.placeholder = L('search');
        searchEl.addEventListener('input', function () {
            filter = String(searchEl.value || '').trim().toLowerCase();
            render();
        });
        barEl.appendChild(searchEl);
        panel.appendChild(barEl);

        statEl = mk('div', 'bl-pf-stat');
        panel.appendChild(statEl);

        listEl = mk('div', 'bl-pf-list');
        listEl.innerHTML = '<div class="bl-pf-empty">' + esc(L('empty')) + '</div>';
        listEl.addEventListener('click', function (ev) {
            var t = ev.target;
            var dl = t && t.closest && t.closest('[data-dl]');
            if (dl) {
                ev.stopPropagation();
                var it = flat[+dl.getAttribute('data-dl')];
                if (!it || !cache) return;
                try {
                    saveBlob(bytesBlob(readEntry(cache.z, it.e), it.e.name), it.e.name);
                } catch (e) {
                    setStatus(L('previewErr') + (e.message || e), true);
                }
                return;
            }
            var row = t && t.closest && t.closest('.bl-pf-row');
            if (row) toggleRow(row);
        });
        panel.appendChild(listEl);
        return panel;
    }
    function refreshLabels() {
        if (!barEl) return;
        var texts = [L('refresh'), L('download'), L('expand'), L('collapse')];
        Array.prototype.forEach.call(barEl.querySelectorAll(':scope > button'), function (b, i) {
            if (texts[i]) b.textContent = texts[i];
        });
        if (searchEl) searchEl.placeholder = L('search');
        if (tabEl) {
            tabEl.title = L('title');
            var sp = tabEl.querySelector('span');
            if (sp) sp.textContent = L('tab');
        }
        lastLang = lang();
    }
    function show(on) {
        if (!hostEl || !panel || !tabEl) return;
        if (on) {
            hostEl.classList.add('bl-py-active');
            tabEl.classList.add('is-on');
            refreshLabels();
            bindDirty();
            if (!cache || dirty || Date.now() - (cache.at || 0) > 30000) {
                pack(false)['catch'](function () { /* 状态栏已提示 */ });
            } else {
                updateStat();
            }
        } else {
            hostEl.classList.remove('bl-py-active');
            tabEl.classList.remove('is-on');
        }
    }
    function mount() {
        var ul = document.querySelector('ul[class*="gui_tab-list_"]');
        if (!ul) return false;
        if (tabEl && tabEl.parentNode) return true;
        hostEl = ul.parentElement;
        if (!hostEl) return false;
        if (!hostEl.querySelector('[class*="gui_tab-panel_"]') && hostEl.parentElement &&
            hostEl.parentElement.querySelector('[class*="gui_tab-panel_"]')) {
            hostEl = hostEl.parentElement;
        }
        if (!panel) buildPanel();
        tabEl = document.createElement('li');
        tabEl.className = 'gui_tab_27Unf bl-py-tab bl-pf-tab';
        tabEl.setAttribute('role', 'tab');
        tabEl.title = L('title');
        tabEl.innerHTML = ICON + '<span>' + esc(L('tab')) + '</span>';
        tabEl.addEventListener('click', function (e) { e.stopPropagation(); show(true); });
        ul.appendChild(tabEl);
        ul.addEventListener('click', function (e) {
            if (tabEl && (e.target === tabEl || tabEl.contains(e.target))) return;
            show(false);
        }, true);
        if (panel.parentNode !== hostEl) hostEl.appendChild(panel);
        return true;
    }
    function boot() {
        var tries = 0;
        var timer = window.setInterval(function () {
            try {
                if (mount()) { window.clearInterval(timer); return; }
            } catch (e) { /* ignore */ }
            if (++tries > 120) window.clearInterval(timer);
        }, 600);
        try { mount(); } catch (e) { /* ignore */ }

        /* React 重绘可能换掉标签栏 / 语言切换：低频校准，静息零 DOM 操作 */
        window.setInterval(function () {
            try {
                mount(); bindDirty();
                if (lang() !== lastLang && hostEl && hostEl.classList.contains('bl-py-active')) {
                    refreshLabels(); render(); updateStat();
                }
            } catch (e) { /* ignore */ }
        }, 1600);
    }

    window.__blProjectFiles = {
        refresh: function () { return pack(true); },
        entries: function () {
            return cache ? cache.z.entries.map(function (e) { return e.name; }) : [];
        },
        download: function () {
            if (!cache) return null;
            saveBlob(new Blob([cache.z.u8], { type: 'application/x.scratch.sb3' }),
                projectTitle() + '.sb3');
            return true;
        },
        /* 纯函数，供静态冒烟使用 */
        _test: {
            parseZip: parseZip, readEntry: readEntry, buildOwner: buildOwner,
            groupsOf: groupsOf, fmtSize: fmtSize, kindOf: kindOf
        }
    };
    boot();
    if (window.__blSync) window.__blSync.register('B82-project-files', mount);
})();

