
/* [B05] 加载页 · 收起与兜底
   __blLoadingDone 是加载页唯一的退出入口：点击、Esc/Enter/Space、
   15 秒超时都汇到 go()。幂等，重复调用不会重复移除节点。 */
(function () {
    'use strict';
    var loadingEl = document.getElementById('blLoading');
    if (!loadingEl) return;

    var done = false;
    function go() {
        if (done) return;
        done = true;
        loadingEl.classList.add('is-ready');
        loadingEl.classList.add('is-done');
        window.setTimeout(function () {
            if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
        }, 460);
    }

    window.__blLoadingDone = go;
    loadingEl.addEventListener('click', go);
    window.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') go();
    });
    window.setTimeout(go, 15000);
})();
