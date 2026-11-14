/* ── [B00] DEFLATE 同步解码器 ───────────────────────────────────────────────
   依赖：无（必须最先执行）
   维护：只在更换压缩格式时动；bits() 是解压热路径，改动要做 A/B
   ───────────────────────────────────────────────────────────── */

/* bl-inflate：极简 raw DEFLATE 同步解码器（zlib wbits=-15 / 默认策略）。
   用于把内嵌的 gzip 压缩源码在运行时同步解压，避免启动期 HTML 解析器
   扫描 30MB 带大量 < & 的脚本文本。实现参考 zlib puff.c 的查表解码法。 */
(function () {
    'use strict';
    if (typeof window !== 'undefined' && window.__blInflateB64) return;

    var LBASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
    var LEXT  = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
    var DBASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
    var DEXT  = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
    var CLEN  = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

    function Bits(data) { this.d = data; this.p = 0; this.cur = 0; this.n = 0; }
    Bits.prototype.bit = function () {
        if (this.n === 0) { this.cur = this.d[this.p++]; this.n = 8; }
        var v = this.cur & 1; this.cur >>>= 1; this.n--; return v;
    };
    /* 按字节批量取位：k 位最多 ceil(k/8)+1 次循环，替代 k 次 bit() 调用。
       DEFLATE 哈夫曼解码里 k=5~13 极频繁，这一处是解压热路径。 */
    Bits.prototype.bits = function (k) {
        var v = 0, got = 0;
        while (k > 0) {
            if (this.n === 0) { this.cur = this.d[this.p++]; this.n = 8; }
            var take = this.n < k ? this.n : k;
            var mask = (1 << take) - 1;
            v |= (this.cur & mask) << got;
            this.cur >>>= take;
            this.n -= take;
            k -= take;
            got += take;
        }
        return v;
    };
    Bits.prototype.align = function () { this.n = 0; };

    function huff(lens) {
        var count = new Uint16Array(16), i;
        for (i = 0; i < lens.length; i++) if (lens[i]) count[lens[i]]++;
        var offs = new Uint16Array(16), sum = 0;
        for (i = 1; i <= 15; i++) { offs[i] = sum; sum += count[i]; }
        var sym = new Uint16Array(sum);
        for (i = 0; i < lens.length; i++) if (lens[i]) sym[offs[lens[i]]++] = i;
        return { count: count, symbol: sym };
    }
    function decode(r, h) {
        var code = 0, first = 0, index = 0;
        for (var len = 1; len <= 15; len++) {
            code |= r.bit();
            var cnt = h.count[len];
            if (code - first < cnt) return h.symbol[index + (code - first)];
            index += cnt;
            first = (first + cnt) << 1;
            code <<= 1;
        }
        throw new Error('bl-inflate: invalid huffman code');
    }

    var FIXL = null, FIXD = null;
    function fixed() {
        if (FIXL) return;
        var l = new Uint8Array(288), i;
        for (i = 0; i < 144; i++) l[i] = 8;
        for (; i < 256; i++) l[i] = 9;
        for (; i < 280; i++) l[i] = 7;
        for (; i < 288; i++) l[i] = 8;
        var d = new Uint8Array(30);
        for (i = 0; i < 30; i++) d[i] = 5;
        FIXL = huff(l); FIXD = huff(d);
    }
    function dynamic(r) {
        var hlit = r.bits(5) + 257, hdist = r.bits(5) + 1, hclen = r.bits(4) + 4;
        var cl = new Uint8Array(19), i;
        for (i = 0; i < hclen; i++) cl[CLEN[i]] = r.bits(3);
        var ch = huff(cl);
        var lens = new Uint8Array(hlit + hdist), n = 0;
        while (n < lens.length) {
            var sym = decode(r, ch), rep = 0, val = 0;
            if (sym < 16) lens[n++] = sym;
            else if (sym === 16) {
                if (!n) throw new Error('bl-inflate: repeat without previous');
                val = lens[n - 1]; rep = 3 + r.bits(2);
                while (rep-- && n < lens.length) lens[n++] = val;
            } else if (sym === 17) {
                rep = 3 + r.bits(3);
                while (rep-- && n < lens.length) lens[n++] = 0;
            } else {
                rep = 11 + r.bits(7);
                while (rep-- && n < lens.length) lens[n++] = 0;
            }
        }
        return [huff(lens.subarray(0, hlit)), huff(lens.subarray(hlit))];
    }

    function inflate(data, expected) {
        var r = new Bits(data);
        var out = new Uint8Array(expected > 0 ? expected : 1024), op = 0;
        function need(k) {
            if (op + k <= out.length) return;
            var cap = Math.max(out.length * 2, op + k, 1024);
            var n = new Uint8Array(cap); n.set(out.subarray(0, op)); out = n;
        }
        var last = 0, lh, dh;
        do {
            last = r.bit();
            var type = r.bits(2);
            if (type === 0) {
                r.align();
                var len = r.bits(16), nlen = r.bits(16);
                if (((~len) & 0xffff) !== nlen) throw new Error('bl-inflate: stored length mismatch');
                need(len);
                for (var q = 0; q < len; q++) out[op++] = r.d[r.p++];
            } else if (type === 1 || type === 2) {
                if (type === 1) { fixed(); lh = FIXL; dh = FIXD; }
                else { var hd = dynamic(r); lh = hd[0]; dh = hd[1]; }
                for (;;) {
                    var sym = decode(r, lh);
                    if (sym < 256) { need(1); out[op++] = sym; }
                    else if (sym === 256) break;
                    else {
                        sym -= 257;
                        if (sym >= 29) throw new Error('bl-inflate: bad length symbol');
                        var length = LBASE[sym] + r.bits(LEXT[sym]);
                        var ds = decode(r, dh);
                        if (ds >= 30) throw new Error('bl-inflate: bad distance symbol');
                        var dist = DBASE[ds] + r.bits(DEXT[ds]);
                        if (dist > op) throw new Error('bl-inflate: distance too far');
                        need(length);
                        for (var k = 0; k < length; k++) { out[op] = out[op - dist]; op++; }
                    }
                }
            } else throw new Error('bl-inflate: reserved block type');
        } while (!last);
        if (expected > 0 && op !== expected)
            throw new Error('bl-inflate: length mismatch ' + op + '/' + expected);
        return out.subarray(0, op);
    }

    /* [B115] base85 紧凑编码：4 字节 → 5 个安全 ASCII 字符，比标准 base64
       的 3→4 少 6.25% 体积。'~' 前缀区分内嵌数据；运行时其它模块生成的
       标准 base64（作品 zip / STAR / RJ 解压）仍走原 atob 路径，行为不变。 */
    var A85 = "!#$%()*+,-.0123456789:;=?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{|}";
    var D85 = null;
    function dec85(str) {
        if (!D85) {
            D85 = new Uint8Array(128);
            for (var q = 0; q < 128; q++) D85[q] = 255;
            for (var q2 = 0; q2 < 85; q2++) D85[A85.charCodeAt(q2)] = q2;
        }
        var n = str.length, full = (n / 5) | 0, rem = n - full * 5;
        var out = new Uint8Array(full * 4 + (rem ? rem - 1 : 0));
        var op = 0, i = 0, k, v;
        while (i + 5 <= n) {
            v = 0;
            for (k = 0; k < 5; k++) v = v * 85 + D85[str.charCodeAt(i + k)];
            out[op++] = (v >>> 24) & 255; out[op++] = (v >>> 16) & 255;
            out[op++] = (v >>> 8) & 255;  out[op++] = v & 255;
            i += 5;
        }
        if (rem >= 2) {
            v = 0;
            for (k = 0; k < 5; k++) v = v * 85 + (k < rem ? D85[str.charCodeAt(i + k)] : 84);
            out[op++] = (v >>> 24) & 255;
            if (rem >= 3) out[op++] = (v >>> 16) & 255;
            if (rem >= 4) out[op++] = (v >>> 8) & 255;
        }
        return out;
    }
    function inflateB64(b64, len) {
        var u8;
        if (b64.charCodeAt(0) === 126) u8 = dec85(b64.substring(1));
        else {
            var bin = atob(b64);
            u8 = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        }
        return inflate(u8, len | 0);
    }
    var textCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
    function decText(node) {
        var raw = (node && node.textContent) || '';
        if (!raw) return '';
        if (node.getAttribute && node.getAttribute('data-bl-enc') === 'z') {
            if (textCache && textCache.has(node)) return textCache.get(node);
            var out = new TextDecoder('utf-8').decode(
                inflateB64(raw, +(node.getAttribute('data-bl-len') || 0)));
            if (textCache) textCache.set(node, out);
            return out;
        }
        return raw;
    }

    var root = (typeof window !== 'undefined') ? window : globalThis;
    root.__blInflateB64 = inflateB64;
    root.__blDecText = decText;
})();

