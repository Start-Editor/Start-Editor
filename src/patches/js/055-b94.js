/* ── [B94] STAR 作品格式 · 打包 / 还原 / 加载接管 ─────────────────────
   依赖：B00 同步 DEFLATE 解码器 / VM
   维护：1.0.5 SEA 恢复「保存到电脑」的 .STAR 打包询问；同时把格式
         开放给工具箱「作品格式转换」与「打开作品」文件框。
   ------------------------------------------------------------------
   .STAR 是一个 zip：
     · star.json            清单（magic / 分片表 / 短键字典）
     · project.base.json    去掉 blocks 后的 project.json
     · blocks/tN/cM.json    按角色分片、短键压缩后的积木
     · 其余素材按原名平铺
     · EOCD comment 写 magic，用于 O(尾部) 识别
   还原时把分片并回标准 sb3 再交给 vm.loadProject —— 这样造型/声音/
   变量/监视器走的完全是原生 sb3 通路，不会像旧版那样把
   variable_primitive 数组拆成「缺 opcode 的对象」而触发 sb3 校验失败。
   ================================================================== */
(function () {
    'use strict';
    if (window.__blStarIO) return;

    var MAGIC = 'STAR-1.0.5-SEA';
    var TE = (typeof TextEncoder === 'function') ? new TextEncoder() : null;
    var TD = (typeof TextDecoder === 'function') ? new TextDecoder('utf-8') : null;
    function enc(s) {
        if (TE) return TE.encode(String(s));
        var t = String(s), a = new Uint8Array(t.length);
        for (var i = 0; i < t.length; i++) a[i] = t.charCodeAt(i) & 255;
        return a;
    }
    function dec(u) {
        if (TD) return TD.decode(u);
        var s = '';
        for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
        return s;
    }
    function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
    function jparse(u) { return u ? JSON.parse(dec(u)) : null; }
    function u16(v) { return [v & 255, (v >> 8) & 255]; }
    function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
    function rd16(u, p) { return (u[p] | (u[p + 1] << 8)) & 0xFFFF; }
    function rd32(u, p) { return ((u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0); }
    function toU8(d) {
        if (!d) return null;
        if (d instanceof Uint8Array) return d;
        if (typeof ArrayBuffer !== 'undefined' && d instanceof ArrayBuffer) return new Uint8Array(d);
        if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(d))
            return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
        return null;
    }
    function toB64(u8) {
        var CH = 0x8000, parts = [];
        for (var i = 0; i < u8.length; i += CH)
            parts.push(String.fromCharCode.apply(null, u8.subarray(i, i + CH)));
        return btoa(parts.join(''));
    }

    /* ---------------- zip 读（同步，复用 B00 解码器） ---------------- */
    function findEOCD(u) {
        var lo = Math.max(0, u.length - 22 - 65535), i;
        for (i = u.length - 22; i >= lo; i--)
            if (u[i] === 0x50 && u[i + 1] === 0x4B && u[i + 2] === 0x05 && u[i + 3] === 0x06) return i;
        return -1;
    }
    function entries(u8) {
        var e = findEOCD(u8);
        if (e < 0) throw new Error('不是 zip 文件');
        var n = rd16(u8, e + 10), p = rd32(u8, e + 16), out = [], k;
        for (k = 0; k < n; k++) {
            if (p + 46 > u8.length || rd32(u8, p) !== 0x02014B50) break;
            var nameLen = rd16(u8, p + 28), extraLen = rd16(u8, p + 30), commentLen = rd16(u8, p + 32);
            var name = dec(u8.subarray(p + 46, p + 46 + nameLen));
            out.push({ name: name, method: rd16(u8, p + 10), csize: rd32(u8, p + 20),
                       usize: rd32(u8, p + 24), lho: rd32(u8, p + 42) });
            p += 46 + nameLen + extraLen + commentLen;
        }
        return { u8: u8, out: out };
    }
    function readEntry(z, e) {
        var p = e.lho, nl = rd16(z.u8, p + 26), el = rd16(z.u8, p + 28);
        var start = p + 30 + nl + el, data = z.u8.subarray(start, start + e.csize);
        if (e.method === 0) return data;
        if (e.method === 8) {
            if (!window.__blInflateB64) throw new Error('内置解压器不可用');
            var out = window.__blInflateB64(toB64(data), e.usize);
            return (out instanceof Uint8Array) ? out : new Uint8Array(out);
        }
        throw new Error('不支持的 ZIP 压缩方式 #' + e.method);
    }
    function readAll(u8) {
        var z = entries(u8), files = [], i;
        for (i = 0; i < z.out.length; i++) {
            var e = z.out[i];
            if (e.name.charAt(e.name.length - 1) === '/') continue;
            files.push({ name: e.name, data: readEntry(z, e) });
        }
        return files;
    }
    function pick(files, name) {
        for (var i = 0; i < files.length; i++) if (files[i].name === name) return files[i].data;
        return null;
    }

    /* ---------------- zip 写（STORE + EOCD comment） ---------------- */
    var CRC = null;
    function crc32(u8) {
        if (!CRC) {
            var t = new Uint32Array(256), c, i, k;
            for (i = 0; i < 256; i++) {
                c = i;
                for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                t[i] = c >>> 0;
            }
            CRC = t;
        }
        var tb = CRC, v = 0xFFFFFFFF;
        for (var j = 0; j < u8.length; j++) v = tb[(v ^ u8[j]) & 255] ^ (v >>> 8);
        return (v ^ 0xFFFFFFFF) >>> 0;
    }
    function writeZip(files, comment) {
        var d = new Date();
        var dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
        var dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
        var body = [], central = [], off = 0, i, j;
        for (i = 0; i < files.length; i++) {
            var nb = enc(files[i].name), data = files[i].data, crc = crc32(data);
            var h = [0x50, 0x4B, 0x03, 0x04].concat(u16(20), u16(0x0800), u16(0),
                u16(dt), u16(dd), u32(crc), u32(data.length), u32(data.length),
                u16(nb.length), u16(0));
            body.push(new Uint8Array(h), nb, data);
            var c = [0x50, 0x4B, 0x01, 0x02].concat(u16(20), u16(20), u16(0x0800), u16(0),
                u16(dt), u16(dd), u32(crc), u32(data.length), u32(data.length),
                u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off));
            central.push(new Uint8Array(c), nb);
            off += h.length + nb.length + data.length;
        }
        var cdSize = 0;
        for (j = 0; j < central.length; j++) cdSize += central[j].length;
        var cm = enc(comment || '');
        var e = [0x50, 0x4B, 0x05, 0x06].concat(u16(0), u16(0),
            u16(files.length), u16(files.length), u32(cdSize), u32(off), u16(cm.length));
        var all = body.concat(central, [new Uint8Array(e), cm]), q = 0;
        var res = new Uint8Array(off + cdSize + e.length + cm.length);
        for (j = 0; j < all.length; j++) { res.set(all[j], q); q += all[j].length; }
        return res;
    }

    /* ---------------- 短键：只对纯积木对象生效 ----------------
       数组（variable/list primitive）、标量、null 一律原样，绝不遍历。
       这正是旧版 .STAR 把 [12,"x","id"] 拆成 {0:12,1:"x"} 导致
       sb3 schema 报 "missingProperty: opcode" 的地方。 */
    var KEYMAP = {
        opcode: '$o', inputs: '$i', fields: '$f', next: '$n', parent: '$p',
        topLevel: '$t', shadow: '$s', x: '$x', y: '$y', mutation: '$m', comment: '$c'
    };
    var REVMAP = {};
    for (var kk in KEYMAP) if (hasOwn(KEYMAP, kk)) REVMAP[KEYMAP[kk]] = kk;
    function isBlockObject(v) { return v && typeof v === 'object' && !isArr(v); }
    function slimBlock(b) {
        var o = {}, k;
        for (k in b) {
            if (!hasOwn(b, k)) continue;
            var v = b[k];
            /* 可重算的默认值不写；显式非 null 的 parent 必须留 */
            if (v === null && (k === 'parent' || k === 'next')) continue;
            if (v === false && (k === 'topLevel' || k === 'shadow')) continue;
            if ((k === 'inputs' || k === 'fields') && v && typeof v === 'object' &&
                !isArr(v) && !Object.keys(v).length) continue;
            if ((k === 'x' || k === 'y') && v === 0) continue;
            o[hasOwn(KEYMAP, k) ? KEYMAP[k] : k] = v;
        }
        return o;
    }
    function fatBlock(b) {
        var o = {}, k;
        for (k in b) if (hasOwn(b, k)) o[hasOwn(REVMAP, k) ? REVMAP[k] : k] = b[k];
        if (!hasOwn(o, 'next')) o.next = null;
        if (!hasOwn(o, 'parent')) o.parent = null;
        if (!hasOwn(o, 'inputs')) o.inputs = {};
        if (!hasOwn(o, 'fields')) o.fields = {};
        if (!hasOwn(o, 'topLevel')) o.topLevel = false;
        if (!hasOwn(o, 'shadow')) o.shadow = false;
        return o;
    }

    /* ---------------- 打包：标准 sb3 → .STAR ---------------- */
    function pack(u8) {
        var files = readAll(u8);
        var pjText = pick(files, 'project.json');
        if (!pjText) throw new Error('输入不是标准 SB3（缺少 project.json）');
        var pj = JSON.parse(dec(pjText));
        if (!isArr(pj.targets)) throw new Error('project.json 结构不正确');
        /* 48KB 一片：单个 JSON.parse 不会形成长任务，大作品会真正拆成
           多个 blocks/tN/cM.json，而不是只换了个文件名。 */
        var out = [], shards = [], SHARD_LIMIT = 48 * 1024, ti, id;

        for (ti = 0; ti < pj.targets.length; ti++) {
            var t = pj.targets[ti], blocks = t.blocks || {};
            delete t.blocks;                       /* base 里不再带大 blocks */
            var ids = Object.keys(blocks), chunk = {}, used = 0, ci = 0;
            function flush() {
                if (!Object.keys(chunk).length) return;
                var name = 'blocks/t' + ti + '/c' + ci + '.json';
                out.push({ name: name, data: enc(JSON.stringify({ blocks: chunk })) });
                shards.push({ t: ti, name: name, count: Object.keys(chunk).length });
                chunk = {}; used = 0; ci++;
            }
            for (var q = 0; q < ids.length; q++) {
                id = ids[q];
                var raw = blocks[id];
                /* 数组 primitive / 标量 / null：原样保真，不瘦身、不短键 */
                var v = isBlockObject(raw) ? slimBlock(raw) : raw;
                var size = JSON.stringify(v).length + id.length + 6;
                if (used && used + size > SHARD_LIMIT) flush();
                chunk[id] = v; used += size;
            }
            flush();
        }

        var man = {
            magic: MAGIC, version: 2, generator: 'StartEditor 1.0.5 SEA',
            targets: pj.targets.length, shards: shards, keys: KEYMAP,
            note: '分片积木 + 短键 + 去默认值；由 START EDITOR 还原为标准 SB3'
        };
        out.unshift({ name: 'star.json', data: enc(JSON.stringify(man)) });
        out.unshift({ name: 'project.base.json', data: enc(JSON.stringify(pj)) });
        for (var f = 0; f < files.length; f++) {
            if (files[f].name === 'project.json') continue;
            out.push({ name: files[f].name, data: files[f].data });
        }
        return writeZip(out, MAGIC);
    }

    /* ---------------- 还原：.STAR → 标准 sb3 ---------------- */
    function restore(u8) {
        var files = readAll(u8);
        var man = jparse(pick(files, 'star.json'));
        if (!man || !/^STAR/i.test(String(man.magic || '')))
            throw new Error('不是 STAR 作品');
        var base = jparse(pick(files, 'project.base.json'));
        if (!base || !isArr(base.targets)) throw new Error('STAR 清单缺少工程数据');
        var per = [], i, j;
        for (i = 0; i < base.targets.length; i++) per.push({});
        var shards = isArr(man.shards) ? man.shards : [];
        for (i = 0; i < shards.length; i++) {
            var sh = jparse(pick(files, shards[i].name));
            if (!sh || !sh.blocks) continue;
            var tIdx = Number(shards[i].t) || 0;
            if (!per[tIdx]) per[tIdx] = {};
            for (var bid in sh.blocks) {
                if (!hasOwn(sh.blocks, bid)) continue;
                per[tIdx][bid] = sh.blocks[bid];
            }
        }
        /* 只把纯积木对象还原；数组 primitive 保持数组，绝不被补字段 */
        for (i = 0; i < per.length; i++) {
            var bs = per[i], rb = {};
            for (var key in bs) {
                if (!hasOwn(bs, key)) continue;
                var e = bs[key];
                rb[key] = isBlockObject(e) ? fatBlock(e) : e;
            }
            /* 按引用关系补缺失的 parent（显式非 null 的原样保留） */
            for (key in rb) {
                if (!hasOwn(rb, key)) continue;
                var b = rb[key];
                if (!isBlockObject(b)) continue;
                var refs = [];
                if (b.next) refs.push(b.next);
                var ins = (isBlockObject(b.inputs)) ? b.inputs : {};
                for (var n in ins) {
                    if (!hasOwn(ins, n)) continue;
                    var iv = ins[n];
                    if (isArr(iv) && iv.length > 1 && typeof iv[1] === 'string') refs.push(iv[1]);
                    if (isArr(iv) && iv.length > 2 && typeof iv[2] === 'string') refs.push(iv[2]);
                }
                for (j = 0; j < refs.length; j++) {
                    var child = rb[refs[j]];
                    if (isBlockObject(child) && child.parent == null) child.parent = key;
                }
            }
            base.targets[i].blocks = rb;
        }
        var out = [{ name: 'project.json', data: enc(JSON.stringify(base)) }];
        for (i = 0; i < files.length; i++) {
            var nm = files[i].name;
            if (nm === 'star.json' || nm === 'project.base.json' ||
                nm.indexOf('blocks/t') === 0) continue;
            out.push({ name: nm, data: files[i].data });
        }
        /* 回退包不带 magic：万一再次被喂进 restore 也不会死循环 */
        return writeZip(out, '');
    }

    function commentOf(u8) {
        var e = findEOCD(u8);
        if (e < 0) return '';
        var n = rd16(u8, e + 20);
        try { return dec(u8.subarray(e + 22, e + 22 + n)); } catch (err) { return ''; }
    }
    /* 只认以 STAR 开头的 magic comment；普通 sb3 的随意 comment
       不会被误判成 STAR 作品（避免把正常作品交给还原器）。 */
    function isStar(u8) { return /^STAR/i.test(commentOf(u8)); }

    function installOn(vm) {
        if (!vm || typeof vm.loadProject !== 'function' || vm.__blStarPatched) return false;
        var orig = vm.loadProject;
        try {
            vm.loadProject = function (input) {
                var args = [], i;
                for (i = 0; i < arguments.length; i++) args.push(arguments[i]);
                var u8 = toU8(input);
                if (u8 && u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4B && isStar(u8)) {
                    try {
                        args[0] = restore(u8);
                        toast('检测到 STAR 作品，已还原为标准 SB3 载入');
                    } catch (err) {
                        console.warn('[STAR] 还原失败，按原文件交给编辑器：' + ((err && err.message) || err));
                        toast('STAR 作品读取失败：' + ((err && err.message) || err));
                    }
                }
                return orig.apply(this, args);
            };
            vm.__blStarPatched = true;
        } catch (e) { return false; }
        return true;
    }
    function getVMs() {
        var a = [];
        try { if (window.vm) a.push(window.vm); } catch (e) {}
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            if (st && st.scratchGui && st.scratchGui.vm) a.push(st.scratchGui.vm);
        } catch (e2) {}
        return a;
    }
    function toast(text) {
        try {
            var el = document.createElement('div');
            el.className = 'bl-star-toast';
            el.textContent = text;
            document.body.appendChild(el);
            setTimeout(function () {
                el.style.opacity = '0';
                setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
            }, 2600);
        } catch (e) {}
    }
    function addStyle() {
        if (document.getElementById('bl-star-style')) return;
        var s = document.createElement('style');
        s.id = 'bl-star-style';
        s.textContent = '.bl-star-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);' +
            'z-index:2147483000;padding:9px 16px;border-radius:10px;' +
            'background:rgba(28,32,40,.86);color:#fff;font-size:13px;line-height:1.4;' +
            'box-shadow:0 6px 24px rgba(0,0,0,.28);pointer-events:none;' +
            'transition:opacity .3s ease;max-width:78vw}';
        (document.head || document.documentElement).appendChild(s);
    }
    try { addStyle(); } catch (e) {}
    var tries = 0;
    var timer = setInterval(function () {
        var vms = getVMs(), i;
        for (i = 0; i < vms.length; i++) installOn(vms[i]);
        if (++tries > 400) clearInterval(timer);
    }, 400);

    window.__blStarIO = {
        magic: MAGIC,
        isStar: isStar,
        pack: pack,
        restore: restore,
        readAll: readAll,
        writeZip: writeZip,
        ready: function () {
            var vms = getVMs(), i;
            for (i = 0; i < vms.length; i++) if (vms[i].__blStarPatched) return true;
            return false;
        }
    };
})();
