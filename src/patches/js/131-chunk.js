
(function () {
    'use strict';
    if (window.__blXq) return;

    var RE = /^(?:\u8be6\u60c5|\u9879\u76ee\u8be6\u60c5|\u9805\u76ee\u8a73\u60c5|Details?)$/i;
    var LISTSEL = 'ul[class*="gui_tab-list_"], [role="tablist"], ' +
                  '[class*="modal-sidebar"] ul, [class*="sidebar"] ul';
    var ITEM = /^(?:LI|A|BUTTON|DIV)$/;
    var docs = [];
    var lastBusy = 0;
    var writes = 0;

    function flat(v) { return String(v == null ? '' : v).replace(/\s+/g, '').trim(); }
    function hit(el) {
        if (!el || el.nodeType !== 1 || !ITEM.test(el.tagName || '')) return false;
        if (el.getAttribute && el.getAttribute('data-bl-xq-keep') === '1') return false;
        if (RE.test(flat(el.textContent))) return true;
        return RE.test(flat((el.getAttribute && el.getAttribute('title')) || '')) ||
               RE.test(flat((el.getAttribute && el.getAttribute('aria-label')) || ''));
    }
    function scrubDoc(doc) {
        if (!doc || !doc.querySelectorAll) return 0;
        var lists, n = 0;
        try { lists = doc.querySelectorAll(LISTSEL); } catch (e0) { return 0; }
        for (var i = 0; i < lists.length; i++) {
            var kids = lists[i].children || [];
            for (var j = 0; j < kids.length; j++) {
                var el = kids[j], subHit = false;
                /* 先扫一层 wrapper：若「详情」是其中的子项，只隐藏子项，
                   不要把整个 wrapper 一起隐掉，避免连带别的标签 */
                var sub = el.children || [];
                for (var k = 0; k < sub.length; k++) {
                    var e2 = sub[k];
                    if (!ITEM.test(e2.tagName || '')) continue;
                    if (hit(e2)) {
                        subHit = true;
                        if (e2.getAttribute('data-bl-xq') !== '1') {
                            e2.setAttribute('data-bl-xq', '1'); writes++; n++;
                        }
                    } else if (e2.hasAttribute && e2.hasAttribute('data-bl-xq')) {
                        e2.removeAttribute('data-bl-xq'); writes++; n++;
                    }
                }
                if (subHit) {
                    if (el.hasAttribute && el.hasAttribute('data-bl-xq')) {
                        el.removeAttribute('data-bl-xq'); writes++; n++;
                    }
                    continue;
                }
                if (hit(el)) {
                    if (el.getAttribute('data-bl-xq') !== '1') {
                        el.setAttribute('data-bl-xq', '1'); writes++; n++;
                    }
                } else if (el.hasAttribute && el.hasAttribute('data-bl-xq')) {
                    el.removeAttribute('data-bl-xq'); writes++; n++;
                }
            }
        }
        return n;
    }
    function scrubAll() {
        var n = scrubDoc(document);
        for (var i = 0; i < docs.length; i++) {
            try { n += scrubDoc(docs[i]); } catch (e1) {}
        }
        return n;
    }
    /* rAF 合并：拖拽积木时 Blockly 每帧插几十个节点，MO 回调同步全量
       会重演之前的连锁卡顿；合并成每帧最多一次，且 rAF 在绘制前执行，
       仍是同帧、不会「慢半拍」或闪现。 */
    var pending = false;
    function requestScrub() {
        if (pending) return;
        pending = true;
        var raf = window.requestAnimationFrame ||
                  function (f) { return window.setTimeout(f, 16); };
        try { raf(function () { pending = false; scrubAll(); }); }
        catch (eR) { pending = false; scrubAll(); }
    }
    function watchDoc(doc) {
        if (!doc) return;
        for (var i = 0; i < docs.length; i++) if (docs[i] === doc) return;
        docs.push(doc);
        try {
            var mo = new MutationObserver(function (recs) {
                for (var r = 0; r < recs.length; r++) {
                    if (recs[r].type === 'childList' &&
                        recs[r].addedNodes && recs[r].addedNodes.length) {
                        requestScrub();  /* 合并到本帧绘制前 */
                        return;
                    }
                }
            });
            mo.observe(doc.documentElement || doc, { childList: true, subtree: true });
        } catch (e2) {}
    }
    function onLoadCapture(e) {
        var f = e && e.target;
        if (!f || !f.contentDocument) return;
        try {
            var d = f.contentDocument;
            if (!d || !d.querySelectorAll) return;
            watchDoc(d);
            scrubDoc(d);
        } catch (e3) {}
    }

    try {
        var moMain = new MutationObserver(function (recs) {
            for (var r = 0; r < recs.length; r++) {
                if (recs[r].type === 'childList' &&
                    recs[r].addedNodes && recs[r].addedNodes.length) {
                    requestScrub();      /* 合并到本帧绘制前，同帧且不连锁 */
                    return;
                }
            }
        });
        moMain.observe(document.documentElement || document,
                       { childList: true, subtree: true });
    } catch (e4) {}
    try { document.addEventListener('load', onLoadCapture, true); } catch (e5) {}
    try { document.addEventListener('DOMContentLoaded', scrubAll); } catch (e6) {}
    try { window.addEventListener('load', scrubAll); } catch (e7) {}

    /* 同帧补挂总线：注册即同步跑一次；后续 tick 120ms 节流，静息零写入 */
    try {
        if (window.__blSync && window.__blSync.register) {
            window.__blSync.register('B113-xq', function () {
                var t = Date.now();
                if (t - lastBusy < 120) return;
                lastBusy = t;
                scrubAll();
            }, false);
        }
    } catch (e8) {}
    window.setInterval(function () {
        if (document.hidden) return;
        scrubAll();
    }, 1500);
    scrubAll();

    window.__blXq = {
        scrub: scrubAll,
        flush: function () { pending = false; return scrubAll(); },
        watch: watchDoc,
        status: function () {
            return { docs: docs.length, writes: writes,
                     hidden: document.querySelectorAll('[data-bl-xq="1"]').length };
        }
    };
})();
