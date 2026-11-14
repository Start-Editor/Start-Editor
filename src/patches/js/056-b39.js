/* ── [B39] RJ 作品兼容层 ───────────────────────────────────────────────
   依赖：VM
   维护：RemixWarp-RJ-Project 的作品修正
   ───────────────────────────────────────────────────────────── */

/* ==================================================================
 * RJ 作品兼容层（RemixWarp-RJ-Project）
 *
 * RemixWarp 导出的 .rj 不是 sb3：它是一个 zip，里面没有 project.json，
 * 而是把工程拆成 manifest.json + targets/N.json + blocks/N.json +
 * assets/素材文件。直接交给 vm.loadProject 会当成 sb3 解析失败。
 *
 * 这里的做法是"先认格式，再决定怎么加载"：
 *   是 sb3（zip 里有 project.json）   -> 原样交给 vm，行为完全不变
 *   是 rj （zip 里有 manifest.json 且 magic 对得上）-> 现场拼出一份
 *      标准 sb3（project.json + 按 md5ext 平铺的素材），再走 sb3 的加载方式
 *   两者都不是                        -> 原样交给 vm，交给它自己的报错流程
 *
 * 之所以要重新压成 sb3 zip，而不是直接把 project.json 对象喂给 vm：
 * loadProject 收到纯对象时不会附带素材包，造型和声音会因为取不到文件而
 * 变成空白。压成 zip 走的就是普通 sb3 那条路，素材、积木、变量全都一样。
 *
 * 单独一个 script 标签，与 inject.js 物理隔离：这里出错最多是 RJ 不能导入，
 * 不会连累编辑器其它功能。
 * ================================================================== */
(function () {
    'use strict';

    var TAG = '[RJ]';
    var MAGIC = 'RemixWarp-RJ-Project';

    function log(msg) { try { console.info(TAG + ' ' + msg); } catch (e) { /* ignore */ } }
    function warn(msg) { try { console.warn(TAG + ' ' + msg); } catch (e) { /* ignore */ } }

    /* ------------------------------------------------------------------
     * 小工具
     * ---------------------------------------------------------------- */
    var TE = (typeof TextEncoder === 'function') ? new TextEncoder() : null;
    var TD = (typeof TextDecoder === 'function') ? new TextDecoder('utf-8') : null;

    function encU8(str) {
        if (TE) return TE.encode(str);
        var s = String(str), a = new Array(s.length);
        for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xFF;
        return new Uint8Array(a);
    }
    function decU8(u8) {
        if (TD) return TD.decode(u8);
        var s = '';
        for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
        return s;
    }
    function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

    /* ------------------------------------------------------------------
     * CRC32（写 zip 要用）
     * ---------------------------------------------------------------- */
    var CRC_T = null;
    function crcTable() {
        if (CRC_T) return CRC_T;
        var t = new Uint32Array(256), c, i, k;
        for (i = 0; i < 256; i++) {
            c = i;
            for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c >>> 0;
        }
        CRC_T = t;
        return t;
    }
    function crc32(u8) {
        var t = crcTable(), c = 0xFFFFFFFF, i;
        for (i = 0; i < u8.length; i++) c = t[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function rdU16(u, p) { return (u[p] | (u[p + 1] << 8)) & 0xFFFF; }
    function rdU32(u, p) {
        return ((u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0);
    }
    function u16(v) { return [v & 0xFF, (v >> 8) & 0xFF]; }
    function u32(v) { return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF]; }

    /* ------------------------------------------------------------------
     * 最小 zip 读取：只认 EOCD + 中央目录，够用了
     * ---------------------------------------------------------------- */
    function findEOCD(u) {
        var start = Math.max(0, u.length - 22 - 65535), i;
        for (i = u.length - 22; i >= start; i--) {
            if (u[i] === 0x50 && u[i + 1] === 0x4B && u[i + 2] === 0x05 && u[i + 3] === 0x06) return i;
        }
        return -1;
    }

    /* zip 的方法 8 是裸 deflate（无 zlib 头），用 DecompressionStream 解 */
    function inflateRaw(u8) {
        return new Promise(function (res, rej) {
            if (typeof DecompressionStream !== 'function') {
                rej(new Error('当前浏览器不支持 DecompressionStream'));
                return;
            }
            try {
                var ds = new DecompressionStream('deflate-raw');
                var st = new Blob([u8.slice()]).stream().pipeThrough(ds);
                new Response(st).arrayBuffer().then(function (ab) {
                    res(new Uint8Array(ab));
                }, rej);
            } catch (e) { rej(e); }
        });
    }

    function zipRead(u8) {
        var eocd = findEOCD(u8);
        if (eocd < 0) return Promise.reject(new Error('不是 zip 文件'));
        var count = rdU16(u8, eocd + 10);
        var p = rdU32(u8, eocd + 16);
        var list = [], i;
        for (i = 0; i < count; i++) {
            if (p + 46 > u8.length) break;
            if (rdU32(u8, p) !== 0x02014B50) break;
            var method = rdU16(u8, p + 10);
            var csize = rdU32(u8, p + 20);
            var nameLen = rdU16(u8, p + 28);
            var extraLen = rdU16(u8, p + 30);
            var commentLen = rdU16(u8, p + 32);
            var lho = rdU32(u8, p + 42);
            var name = decU8(u8.subarray(p + 46, p + 46 + nameLen));
            p += 46 + nameLen + extraLen + commentLen;
            if (name.charAt(name.length - 1) === '/') continue;   /* 目录项 */
            var nl = rdU16(u8, lho + 26), el = rdU16(u8, lho + 28);
            var ds = lho + 30 + nl + el;
            list.push({ name: name, method: method, data: u8.subarray(ds, ds + csize) });
        }
        var out = {};
        var chain = Promise.resolve();
        list.forEach(function (it) {
            chain = chain.then(function () {
                if (it.method === 0) { out[it.name] = it.data; return null; }
                if (it.method === 8) {
                    return inflateRaw(it.data).then(function (d) { out[it.name] = d; });
                }
                warn('跳过不支持的压缩方式 ' + it.method + '：' + it.name);
                return null;
            });
        });
        return chain.then(function () { return out; });
    }

    /* ------------------------------------------------------------------
     * 最小 zip 写出：一律用"不压缩"方式存，sb3 的读取端完全认
     * ---------------------------------------------------------------- */
    function zipWrite(files) {
        var d = new Date();
        var dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
        var dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
        var body = [], central = [], off = 0, i, j;

        for (i = 0; i < files.length; i++) {
            var nb = encU8(files[i].name);
            var data = files[i].data;
            var crc = crc32(data);
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
        var e = [0x50, 0x4B, 0x05, 0x06].concat(u16(0), u16(0),
            u16(files.length), u16(files.length), u32(cdSize), u32(off), u16(0));

        var total = off + cdSize + e.length;
        var res = new Uint8Array(total), q = 0, all = body.concat(central, [new Uint8Array(e)]);
        for (j = 0; j < all.length; j++) { res.set(all[j], q); q += all[j].length; }
        return res;
    }

    /* ------------------------------------------------------------------
     * 变量名：有的 rj 会把所有文件压在一层目录里（作品名/manifest.json），
     * 统一剥掉这层前缀，后面按相对路径找
     * ---------------------------------------------------------------- */
    function normalize(files) {
        var keys = Object.keys(files), i;
        if (!keys.length) return files;
        var prefix = null;
        for (i = 0; i < keys.length; i++) {
            var slash = keys[i].indexOf('/');
            var head = slash < 0 ? null : keys[i].slice(0, slash + 1);
            if (head === null) return files;               /* 有散在根目录的文件 */
            if (prefix === null) prefix = head;
            else if (prefix !== head) return files;        /* 不止一层根 */
        }
        if (!prefix) return files;
        var out = {};
        for (i = 0; i < keys.length; i++) out[keys[i].slice(prefix.length)] = files[keys[i]];
        return out;
    }

    /* ------------------------------------------------------------------
     * prebuilt 积木（vm 内部对象格式）转 sb3 紧凑格式
     * 只在 blocks/N.json 缺失时才走这条路
     * ---------------------------------------------------------------- */
    var PRIM = {
        math_number: [4, 'NUM'],
        math_positive_number: [5, 'NUM'],
        math_whole_number: [6, 'NUM'],
        math_integer: [7, 'NUM'],
        math_angle: [8, 'NUM'],
        colour_picker: [9, 'COLOUR'],
        text: [10, 'TEXT'],
        event_broadcast_menu: [11, 'BROADCAST_OPTION'],
        data_variable: [12, 'VARIABLE'],
        data_listcontents: [13, 'LIST']
    };

    function primOf(blk) {
        var info = PRIM[blk && blk.opcode];
        if (!info) return null;
        var f = blk.fields && blk.fields[info[1]];
        var arr = [info[0], f ? f.value : ''];
        if (info[0] >= 11 && f && f.id != null) arr.push(f.id);
        return arr;
    }

    function fromPrebuilt(pj) {
        var all = (pj && pj.blocks) || {};
        var out = {}, id;
        for (id in all) {
            if (!hasOwn(all, id)) continue;
            var b = all[id];
            if (!b || typeof b !== 'object') continue;
            var nb = {
                opcode: b.opcode,
                next: (b.next == null ? null : b.next),
                parent: (b.parent == null ? null : b.parent),
                inputs: {},
                fields: {},
                topLevel: !!b.topLevel,
                shadow: !!b.shadow
            };
            if (b.topLevel) {
                nb.x = (b.x == null ? 0 : Number(b.x));
                nb.y = (b.y == null ? 0 : Number(b.y));
            }
            if (b.mutation) nb.mutation = b.mutation;
            if (b.comment) nb.comment = b.comment;

            var ins = b.inputs || {}, n, d;
            for (n in ins) {
                if (!hasOwn(ins, n)) continue;
                d = ins[n];
                if (!d) continue;
                if (isArr(d)) { nb.inputs[n] = d; continue; }   /* 已是紧凑格式 */
                var bid = d.block, sid = d.shadow;
                if (bid && sid && bid === sid) {
                    nb.inputs[n] = [1, bid];
                } else if (bid && sid) {
                    var pr = primOf(all[sid]);
                    nb.inputs[n] = pr ? [3, bid, pr] : [3, bid, sid];
                } else if (bid) {
                    nb.inputs[n] = [2, bid];
                } else if (sid) {
                    nb.inputs[n] = [1, sid];
                }
            }
            var fs = b.fields || {};
            for (n in fs) {
                if (!hasOwn(fs, n)) continue;
                d = fs[n];
                if (!d) continue;
                if (isArr(d)) { nb.fields[n] = d; continue; }
                nb.fields[n] = (d.id == null) ? [d.value, null] : [d.value, d.id];
            }
            out[id] = nb;
        }
        return out;
    }

    /* ------------------------------------------------------------------
     * 组装 sb3
     * ---------------------------------------------------------------- */
    function jparse(u8) { return JSON.parse(decU8(u8)); }
    function jtry(u8) {
        try { return jparse(u8); } catch (e) { return null; }
    }

    /* 角色文件：优先 targets/N.json；有些 rj 把这一层摊平了（根目录 N.json），
     * 那种也要认，否则一个角色都读不出来。只按 targets 目录找时不要碰根目录，
     * 免得把 blocks/N.json 之类的同名文件认错。 */
    function indexFiles(files, dir, allowRoot) {
        var keys = Object.keys(files), map = {}, i, re, m, n;
        re = new RegExp('^' + dir + '/(\\d+)\\.json$');
        for (i = 0; i < keys.length; i++) {
            m = re.exec(keys[i]);
            if (m) map[parseInt(m[1], 10)] = keys[i];
        }
        n = 0;
        for (var k in map) { if (hasOwn(map, k)) n++; }
        if (!n && allowRoot) {
            re = /^(\d+)\.json$/;
            for (i = 0; i < keys.length; i++) {
                m = re.exec(keys[i]);
                if (m) map[parseInt(m[1], 10)] = keys[i];
            }
        }
        return map;
    }

    function collectTargets(files) {
        var map = indexFiles(files, 'targets', true);
        var order = [], k;
        for (k in map) { if (hasOwn(map, k)) order.push(parseInt(k, 10)); }
        order.sort(function (a, b) { return a - b; });

        var targets = [], i, missBlocks = 0;
        for (i = 0; i < order.length; i++) {
            var idx = order[i];
            var tj = jtry(files[map[idx]]);
            var t = (tj && tj.target) ? tj.target : tj;
            if (!t || typeof t !== 'object') continue;

            var blocks = {}, comments = {};
            var bj = files['blocks/' + idx + '.json'] ? jtry(files['blocks/' + idx + '.json']) : null;
            var pj = files['blocks/prebuilt/' + idx + '.json'] ? jtry(files['blocks/prebuilt/' + idx + '.json']) : null;
            var nBlocks = bj && bj.blocks ? Object.keys(bj.blocks).length : 0;
            var nPre = pj && pj.blocks ? Object.keys(pj.blocks).length : 0;
            if (nBlocks > 0) {
                blocks = bj.blocks;
                comments = bj.comments || {};
            } else if (nPre > 0) {
                blocks = fromPrebuilt(pj);
                comments = pj.comments || {};
            } else {
                missBlocks++;
            }
            t.blocks = blocks;
            t.comments = comments || {};
            if (!t.variables) t.variables = {};
            if (!t.lists) t.lists = {};
            if (!t.broadcasts) t.broadcasts = {};
            if (!t.costumes) t.costumes = [];
            if (!t.sounds) t.sounds = [];
            if (t.currentCostume == null) t.currentCostume = 0;
            if (t.volume == null) t.volume = 100;
            if (t.layerOrder == null) t.layerOrder = idx;
            if (t.isStage) {
                if (t.tempo == null) t.tempo = 60;
                if (t.videoTransparency == null) t.videoTransparency = 50;
                if (!t.videoState) t.videoState = 'on';
                if (t.textToSpeechLanguage === undefined) t.textToSpeechLanguage = null;
            } else {
                if (t.visible === undefined) t.visible = true;
                if (t.x == null) t.x = 0;
                if (t.y == null) t.y = 0;
                if (t.size == null) t.size = 100;
                if (t.direction == null) t.direction = 90;
                if (t.draggable === undefined) t.draggable = false;
                if (!t.rotationStyle) t.rotationStyle = 'all around';
            }
            targets.push(t);
        }
        return targets;
    }

    function buildSb3(files) {
        /* 统一交给 RJ v2 内核：tables/ 五表、按完整路径索引、
           造型/声音从表补齐、缺素材占位，四条链路只走这一份实现。 */
        if (window.__blRJv2 && typeof window.__blRJv2.buildFromFiles === 'function') {
            var v2res = window.__blRJv2.buildFromFiles(files);
            if (v2res.missing && v2res.missing.length)
                warn('缺少 ' + v2res.missing.length + ' 个素材，已用占位补齐：' +
                     v2res.missing.slice(0, 3).join(', '));
            return v2res;
        }
        var man = files['manifest.json'] ? jtry(files['manifest.json']) : null;
        if (!man) throw new Error('缺少 manifest.json');
        if (man.magic !== MAGIC && man.format !== 'rj') throw new Error('不是 RJ 作品');

        var targets = collectTargets(files);
        if (!targets.length) throw new Error('没有找到任何角色');

        /* 清单里说有积木、实际一个都没读到 —— 通常是 blocks 目录缺了。
         * 静默放过去会让人以为是空作品，这里明确说一句。 */
        var nb = 0, ti;
        for (ti = 0; ti < targets.length; ti++) {
            nb += (targets[ti].blocks && Object.keys(targets[ti].blocks).length) || 0;
        }
        if (!nb && Number(man.blockCount) > 0) {
            warn('清单里写了 ' + man.blockCount + ' 块积木，但没读到任何 blocks 文件，' +
                 '角色会没有脚本');
        }

        var proj = {
            targets: targets,
            monitors: [],
            extensions: [],
            meta: { semver: '3.0.0', vm: '0.2.0', agent: '' }
        };
        var mp = man.project || {};
        if (isArr(mp.extensions)) proj.extensions = mp.extensions;
        if (mp.meta && typeof mp.meta === 'object') {
            var k;
            for (k in mp.meta) { if (hasOwn(mp.meta, k)) proj.meta[k] = mp.meta[k]; }
        }
        if (!proj.meta.semver) proj.meta.semver = '3.0.0';
        if (!proj.meta.vm) proj.meta.vm = '0.2.0';
        /* RJ 清单里的 meta.platform 写的是 remixwarp（还带一个外站地址）。
         * 原样带过去会让 loadProject 一直不返回 —— 现象是"导入 RJ 没反应"，
         * 既不报错也不刷控制台，很难查。对照测试确认：去掉这两个字段后，
         * 3 个角色连同积木、造型、声音全部正常载入。所以只留版本三件套。 */
        delete proj.meta.platform;
        delete proj.meta.name;
        if (!proj.meta.agent) proj.meta.agent = '';

        if (isArr(man.monitors)) proj.monitors = man.monitors;
        else if (files['monitors.json']) {
            var mj = jtry(files['monitors.json']);
            if (mj && isArr(mj.items)) proj.monitors = mj.items;
        }
        if (!isArr(proj.monitors)) proj.monitors = [];

        /* 素材：rj 放在 assets/ 下，sb3 平铺在 zip 根目录 */
        var assets = {}, keys = Object.keys(files), i;
        for (i = 0; i < keys.length; i++) {
            var am = /(^|\/)assets\/([^/]+)$/.exec(keys[i]);
            if (am) assets[am[2]] = files[keys[i]];
        }

        var out = [{ name: 'project.json', data: encU8(JSON.stringify(proj)) }];
        var used = {};

        function addAsset(c) {
            var nm = c && c.md5ext;
            if (!nm || used[nm]) return;
            var data = assets[nm];
            if (!data && c.assetId) {
                var alt = c.assetId + '.' + (c.dataFormat || '');
                if (assets[alt]) data = assets[alt];
            }
            if (!data) { warn('缺少素材文件 ' + nm + '，对应造型/声音可能显示不出来'); return; }
            used[nm] = 1;
            out.push({ name: nm, data: data });
        }

        for (i = 0; i < targets.length; i++) {
            var cs = targets[i].costumes || [], ss = targets[i].sounds || [], j;
            for (j = 0; j < cs.length; j++) addAsset(cs[j]);
            for (j = 0; j < ss.length; j++) addAsset(ss[j]);
        }

        return { project: proj, zip: zipWrite(out), assetCount: out.length - 1 };
    }

    /* ------------------------------------------------------------------
     * 提示条（就一个自动消失的小条，不引入新窗口）
     * ---------------------------------------------------------------- */
    function toast(text) {
        try {
            var el = document.createElement('div');
            el.className = 'bl-rj-toast';
            el.textContent = text;
            document.body.appendChild(el);
            setTimeout(function () {
                el.style.opacity = '0';
                setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
            }, 2600);
        } catch (e) { /* ignore */ }
    }
    function addStyle() {
        if (document.getElementById('bl-rj-style')) return;
        var s = document.createElement('style');
        s.id = 'bl-rj-style';
        s.textContent =
            '.bl-rj-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);' +
            'z-index:2147483000;padding:9px 16px;border-radius:10px;' +
            'background:rgba(28,32,40,.92);color:#fff;font-size:13px;line-height:1.4;' +
            'box-shadow:0 6px 24px rgba(0,0,0,.28);pointer-events:none;' +
            'transition:opacity .3s ease;max-width:78vw}';
        (document.head || document.documentElement).appendChild(s);
    }

    /* ------------------------------------------------------------------
     * 接管 vm.loadProject
     * ---------------------------------------------------------------- */
    function toU8(input) {
        if (input instanceof ArrayBuffer) return new Uint8Array(input);
        if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(input)) {
            return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        }
        return null;
    }

    function prepare(input) {
        var u8 = toU8(input);
        if (!u8) return Promise.resolve(input);
        if (u8.length < 4 || u8[0] !== 0x50 || u8[1] !== 0x4B) return Promise.resolve(input);
        return zipRead(u8).then(function (raw) {
            var files = normalize(raw);
            if (files['project.json']) return input;          /* 标准 sb3，原样 */
            if (!files['manifest.json']) return input;        /* 不是 rj，原样 */
            var man = jtry(files['manifest.json']);
            if (!man || (man.magic !== MAGIC && man.format !== 'rj')) return input;
            var res = buildSb3(files);
            log('RJ -> sb3：' + res.project.targets.length + ' 个角色，' +
                res.assetCount + ' 个素材');
            toast('检测到 RJ 作品，已按 sb3 方式载入' +
                  (res.missing && res.missing.length
                      ? '（缺少 ' + res.missing.length + ' 个素材，已用占位补齐）' : ''));
            return res.zip;
        }, function (e) {
            warn('zip 读取失败，按原样交给编辑器：' + ((e && e.message) || e));
            return input;
        }).then(function (next) { return next; }, function (e) {
            /* 走到这里说明"认出是 RJ 了但没拼出来"。不吞这个错：
             * 吞掉就会把一个拼坏的工程交给编辑器，报的是 sb3 的错误，
             * 跟 RJ 一点关系都看不出来，反而更难查。 */
            var msg = (e && e.message) || String(e);
            warn('RJ 转换失败：' + msg);
            toast('RJ 作品读取失败：' + msg);
            throw new Error('RJ 作品读取失败：' + msg);
        });
    }

    function installOn(vm) {
        if (!vm || typeof vm.loadProject !== 'function' || vm.__blRjPatched) return false;
        var orig = vm.loadProject;
        try {
            /* 编辑器调的是 loadProject(数据, {mwCanTrustProject:true})。
             * 只透传第一个参数会把第二个吃掉，那等于把"信任这个作品"的标记丢了，
             * 后面依赖它的逻辑（比如扩展权限）会走另一条分支。这里原样全传。 */
            vm.loadProject = function (input) {
                var self = this;
                var args = [], i;
                for (i = 0; i < arguments.length; i++) args.push(arguments[i]);
                return prepare(input).then(function (next) {
                    args[0] = next;
                    return orig.apply(self, args);
                });
            };
            vm.__blRjPatched = true;
        } catch (e) { return false; }
        return true;
    }

    function getVM() {
        var candidates = [];
        try { if (window.vm) candidates.push(window.vm); } catch (e) { /* ignore */ }
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            if (st && st.scratchGui && st.scratchGui.vm) candidates.push(st.scratchGui.vm);
        } catch (e) { /* ignore */ }
        return candidates;
    }

    var tries = 0;
    var timer = setInterval(function () {
        var vms = getVM(), i;
        for (i = 0; i < vms.length; i++) {
            if (installOn(vms[i])) { log('已接管 vm.loadProject'); }
        }
        if (++tries > 400) clearInterval(timer);
    }, 400);

    try { addStyle(); } catch (e) { /* ignore */ }

    /* 给调试/自检留的入口 */
    window.__blRJ = {
        read: zipRead,
        write: zipWrite,
        build: function (files) { return buildSb3(normalize(files)); },
        ready: function () {
            var vms = getVM(), i;
            for (i = 0; i < vms.length; i++) if (vms[i].__blRjPatched) return true;
            return false;
        }
    };
})();

