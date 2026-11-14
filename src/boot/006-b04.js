
/* [B04] 加载页 · 主题预判
   在编辑器界面出现之前，按存档把加载页切成对应的明暗，
   避免「先亮一下再跳成暗色」。主题黑名单与 THEMES 里的 dark 项保持一致。 */
(function () {
    'use strict';
    var loadingEl = document.getElementById('blLoading');
    if (!loadingEl) return;

    var isDark = false;
    try {
        var savedTheme = localStorage.getItem('bilup.appTheme');

        if (savedTheme === 'dark' || savedTheme === 'deepsea') {
            isDark = true;
        } else if (savedTheme === 'light' || savedTheme === 'sakura') {
            isDark = false;
        } else {
            var editorTheme = localStorage.getItem('tw:theme');
            if (editorTheme === 'dark') {
                isDark = true;
            } else if (editorTheme === 'light') {
                isDark = false;
            } else if (editorTheme) {
                var parsed = JSON.parse(editorTheme);
                if (parsed && parsed.gui) isDark = parsed.gui === 'dark';
            } else {
                isDark = window.matchMedia &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
        }
    } catch (err) {
        /* localStorage 不可用（隐私模式 / file: 限制）时保持默认亮色 */
    }

    if (isDark) loadingEl.setAttribute('data-theme', 'dark');
})();
