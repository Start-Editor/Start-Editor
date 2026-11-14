/* ── [B13] 单 bundle 索引读取层 ───────────────────────────────────────────────
   依赖：B0 / B9 的 textContent
   维护：按换行分段建索引，⚠ 不要往 B9 里加任何字符；3 个模板用惰性 getter
   ───────────────────────────────────────────────────────────── */

/* 单 bundle 索引：105 段压缩源码合并存储后的读取层。
   用 indexOf 流式建索引，不一次性切出 105 个大字符串。 */
(function () {
    var el = document.getElementById('bl-embedded-bundle');
    var txt = el ? (el.textContent || '') : '';
    var idx = Object.create(null), pos = 0, n = txt.length;
    /* 跳过开头可能存在的换行，否则第一段 key 会被解析成空串 */
    while (pos < n && (txt.charCodeAt(pos) === 10 || txt.charCodeAt(pos) === 13)) pos++;
    while (pos < n) {
        var a = txt.indexOf('\n', pos); if (a < 0) break;
        var b = txt.indexOf('\n', a + 1); if (b < 0) break;
        var c = txt.indexOf('\n', b + 1); if (c < 0) c = n;
        idx[txt.slice(pos, a)] = { len: parseInt(txt.slice(a + 1, b), 10), s: b + 1, e: c };
        pos = c + 1;
    }
    window.__BL_BUNDLE__ = { text: txt, index: idx };
    window.__blBundleRaw = function (key) {
        var it = idx[key];
        return it ? txt.slice(it.s, it.e) : null;
    };
    /* 3 个内嵌 HTML 模板：占位节点挂惰性 textContent，
       让 embedSource / warmPackager / __blDecText 保持原样。 */
    var ids = ['bilup-site-source', 'bilup-addon-settings-source', 'bilup-packager-source'];
    for (var q = 0; q < ids.length; q++) {
        (function (id) {
            var node = document.getElementById(id);
            if (!node) return;
            var cache = null;
            try {
                Object.defineProperty(node, 'textContent', {
                    configurable: true, enumerable: true,
                    get: function () {
                        if (cache !== null) return cache;
                        var it = idx[id], raw = window.__blBundleRaw(id);
                        if (!it || !raw || !window.__blInflateB64) return (cache = '');
                        try {
                            cache = new TextDecoder('utf-8').decode(
                                window.__blInflateB64(raw, it.len));
                        } catch (e) { cache = ''; }
                        return cache;
                    },
                    set: function (v) { cache = v; }
                });
            } catch (e) { /* ignore */ }
        })(ids[q]);
    }
})();
