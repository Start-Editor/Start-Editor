
/* 宿主自愈：低频核对一次「标记 ↔ inline 尺寸」是否一致。
   正常路径由 B33 的 700ms 巡检负责，这段只处理外部脚本 / 旧存档
   把 data-bl-rect-ok 与 inline 尺寸写歪的极端情况，静息零 DOM 操作。 */
(function () {
    'use strict';
    if (window.__blDockRectGuard) return;
    window.__blDockRectGuard = true;
    var last = '';
    function guard() {
        var h = document.querySelector('.bl-dock-host');
        if (!h) return;
        var ok = h.getAttribute('data-bl-rect-ok') === '1';
        var st = h.style;
        var has = !!(st.left || st.top || st.width || st.height);
        var key = ok + '|' + has + '|' + st.left + '|' + st.top + '|' + st.width + '|' + st.height;
        if (key === last) return;
        last = key;
        /* 标记说有效却没有尺寸，或说无效却留着尺寸 —— 都清掉回整屏，
           下一轮 B33 巡检会按真实 anchor 重新写入。 */
        if ((ok && !has) || (!ok && has)) {
            st.left = ''; st.top = ''; st.width = ''; st.height = '';
            h.removeAttribute('data-bl-rect-ok');
            try { window.__blDockTop && window.__blDockTop(); } catch (e) { /* ignore */ }
        }
    }
    window.setInterval(function () { try { guard(); } catch (e) { /* ignore */ } }, 1200);
    try { guard(); } catch (e) { /* ignore */ }
})();
