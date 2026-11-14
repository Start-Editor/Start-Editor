
/* 清理历史上已经写到 DOCK 容器上的液态标记与 soften inline 底色。
   低频 + 签名短路：没有残留时一个 DOM 写操作都不做。 */
(function () {
    'use strict';
    if (window.__blDockGlassGuard) return;
    window.__blDockGlassGuard = true;
    var last = '';
    function clean() {
        var docks = document.querySelectorAll('.bl-dock');
        if (!docks.length) return;
        var sig = String(docks.length);
        for (var d = 0; d < docks.length; d++) {
            var els = [docks[d],
                       docks[d].querySelector('.bl-dock-zone'),
                       docks[d].querySelector('.bl-dock-inner')];
            for (var i = 0; i < els.length; i++) {
                var e = els[i];
                if (!e) continue;
                sig += '|' + (e.hasAttribute('data-bl-lg') ? '1' : '0') +
                       (e.hasAttribute('data-bl-lg-soft') ? '1' : '0') +
                       (e.getAttribute('data-bl-lg-skip') ? '1' : '0');
            }
        }
        if (sig === last) return;
        last = sig;
        for (var d2 = 0; d2 < docks.length; d2++) {
            var list = [docks[d2],
                        docks[d2].querySelector('.bl-dock-zone'),
                        docks[d2].querySelector('.bl-dock-inner')];
            for (var j = 0; j < list.length; j++) {
                var el = list[j];
                if (!el) continue;
                if (!el.getAttribute('data-bl-lg-skip')) el.setAttribute('data-bl-lg-skip', '1');
                if (!el.getAttribute('data-bl-fc-skip')) el.setAttribute('data-bl-fc-skip', '1');
                el.removeAttribute('data-bl-lg');
                el.removeAttribute('data-bl-lg-native');
                if (el.hasAttribute('data-bl-lg-soft')) {
                    el.removeAttribute('data-bl-lg-soft');
                    try { el.style.removeProperty('background-color'); } catch (e0) { /* ignore */ }
                }
            }
        }
    }
    try { clean(); } catch (e) { /* ignore */ }
    window.setInterval(function () { try { clean(); } catch (e2) { /* ignore */ } }, 1500);

    /* [B107] 同帧补挂：首帧扫描不再等各自的定时巡检 */
    if (window.__blSync) window.__blSync.register('B71-dock-clean', function () {
        try { clean(); } catch (eB71) { /* ignore */ }
    }, true);
    })();
