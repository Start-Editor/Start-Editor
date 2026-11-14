
/* [B28] 启动期自动新建工程
   某些入口打开后停在空启动屏，这里等菜单栏渲染出来，
   自动点「文件 → 新建」。已进入编辑态（blocklySvg 存在）就不介入。 */
(function () {
    'use strict';

    /** 取元素纯文本，去掉首尾空白 */
    function text(el) {
        return (el.textContent || '').trim();
    }

    /** 在 scope 内找第一个「没有子元素且文本命中」的叶子节点 */
    function findLeaf(scope, predicate) {
        var all = (scope || document).querySelectorAll('button, a, li, span, div, p');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (el.children.length === 0 && predicate(text(el))) return el;
        }
        return null;
    }

    /** 优先在菜单栏里找，找不到再退到整个文档 */
    function pick(scope, predicate) {
        return findLeaf(scope, predicate) || (scope ? findLeaf(null, predicate) : null);
    }

    var isFile = function (t) { return t === '文件' || t === 'File'; };
    var isNew  = function (t) { return t === '新建' || t === 'New'; };

    var startedAt = Date.now();
    var BOOT_TIMEOUT = 30000;   // 等菜单栏出现
    var MENU_TIMEOUT = 8000;    // 等「新建」出现
    var TICK = 60;

    var boot = window.setInterval(function () {
        if (Date.now() - startedAt > BOOT_TIMEOUT) {
            window.clearInterval(boot);
            return;
        }
        if (document.querySelector('.blocklySvg')) {   // 已经在编辑，不必干预
            window.clearInterval(boot);
            return;
        }

        var menuBar = document.querySelector('[class*="menu-bar_menu-bar"]');
        var fileButton = pick(menuBar, isFile);
        if (!fileButton) return;

        window.clearInterval(boot);
        fileButton.click();

        var clickedAt = Date.now();
        var waitNew = window.setInterval(function () {
            if (Date.now() - clickedAt > MENU_TIMEOUT) {
                window.clearInterval(waitNew);
                try { fileButton.click(); } catch (err) { /* ignore */ }
                return;
            }
            var newItem = pick(menuBar, isNew);
            if (newItem) {
                window.clearInterval(waitNew);
                newItem.click();
            }
        }, TICK);
    }, TICK);
})();
