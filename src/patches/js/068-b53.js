/* ── [B53] 下拉 / 弹窗按钮修复 ───────────────────────────────────────────────
   依赖：B41
   维护：option 纯文本化、三键恢复 — □ ×
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * 设置页下拉 / 弹窗按钮 修复补丁
 *  1) __blOpt(id, fallback)：把词条 id 转成当前语言的纯字符串
 *  2) 把已渲染成 [object Object] 的 <option> 还原成文本（含 iframe/srcdoc）
 *  3) 纠正旧版把 最小化/最大化 按钮写成 × 的残留
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blOptionFix) return;
    window.__blOptionFix = true;

    var ZH = {"bl.menu.bilme": "Bilme 商城", "bl.bilme.title": "Bilme 商城", "bl.bilme.searchPlaceholder": "搜索主题...", "bl.bilme.sortBy": "排序方式", "bl.bilme.newest": "最新", "bl.bilme.likes": "最受欢迎", "bl.bilme.name": "名称", "bl.bilme.allPlatforms": "所有平台", "bl.bilme.bilup": "Bilup", "bl.bilme.allColors": "所有颜色", "bl.bilme.red": "红色", "bl.bilme.orange": "橙色", "bl.bilme.yellow": "黄色", "bl.bilme.green": "绿色", "bl.bilme.blue": "蓝色", "bl.bilme.purple": "紫色", "bl.bilme.login": "登录", "bl.bilme.logout": "登出", "bl.bilme.createTheme": "创建主题", "bl.bilme.noThemes": "未找到主题", "bl.bilme.loading": "加载主题中...", "bl.bilme.error": "加载主题失败", "bl.bilme.likesCount": "{count} 个赞", "bl.bilme.downloadsCount": "{count} 次下载", "bl.bilme.applyTheme": "应用", "bl.bilme.openInBilme": "在 Bilme 中打开", "bl.dock.pageTitle": "Dock 栏", "bl.dock.hidden": "隐藏 Dock 栏", "bl.musicbox.pageTitle": "八音盒", "bl.winapp.pageTitle": "弹窗外观", "bl.winanim.pageTitle": "弹窗动画", "bl.winanim.enter": "入场动画", "bl.winanim.exit": "出场动画", "bl.winanim.minimize": "最小化动画", "bl.winanim.fade": "淡入淡出", "bl.winanim.scale": "缩放", "bl.winanim.slideUp": "上滑", "bl.winanim.slideDown": "下滑", "bl.winanim.slideLeft": "左滑", "bl.winanim.slideRight": "右滑", "bl.winanim.none": "无", "bl.winapp.shadow": "阴影", "bl.winapp.radius": "圆角", "bl.winapp.opacity": "弹窗透明度", "bl.winapp.bgOpacity": "背景透明度", "bl.winbtn.pageTitle": "弹窗按钮", "bl.winbtn.layout": "按钮位置", "bl.winbtn.layoutAuto": "右侧（默认）", "bl.winbtn.layoutLeft": "左侧", "bl.winbtn.style": "按钮样式", "bl.winbtn.styleRounded": "圆角", "bl.winbtn.styleSquare": "方形", "bl.winbtn.styleCircle": "圆形", "bl.winbtn.styleMac": "MAC", "bl.winbtn.styleWin": "WIN", "bl.winbtn.styleMist": "MIST", "bl.winbtn.titlePos": "标题位置", "bl.winbtn.titleLeft": "左", "bl.winbtn.titleCenter": "中", "bl.winbtn.titleRight": "右", "bl.winbtn.icons": "按钮图标", "bl.winbtn.iconMin": "最小化图标", "bl.winbtn.iconMax": "最大化图标", "bl.winbtn.iconClose": "关闭图标", "bl.winbtn.import": "导入", "bl.winbtn.clear": "清除", "bl.winbtn.preview": "预览", "bl.winbtn.previewBody": "内容", "bl.musicbox.mode": "模式", "bl.musicbox.modePopup": "弹窗（可拖动）", "bl.musicbox.modeFixed": "固定弹窗", "bl.musicbox.reverb": "混响", "bl.musicbox.echo": "回响", "bl.musicbox.denoise": "降噪", "bl.musicbox.treble": "高音", "bl.musicbox.bass": "低音", "bl.musicbox.customSpectrum": "自定义音谱颜色", "bl.musicbox.spectrumColor": "音谱颜色", "bl.frostedGlass.pageTitle": "玻璃效果", "bl.frostedGlass.enabled": "启用毛玻璃效果", "bl.frostedGlass.blurRadius": "模糊强度", "bl.frostedGlass.opacity": "透明度", "bl.frostedGlass.themeBoost": "深浅差异", "bl.frostedGlass.target.window": "窗口", "bl.frostedGlass.target.alert": "弹窗通知", "bl.frostedGlass.target.menuBarMenu": "顶部菜单栏下拉菜单"};
    var EN = {"bl.dock.pageTitle": "Dock", "bl.dock.hidden": "Hide Dock", "bl.musicbox.pageTitle": "Music Box", "bl.winapp.pageTitle": "Popup Appearance", "bl.winanim.pageTitle": "Popup Animation", "bl.winanim.enter": "Enter", "bl.winanim.exit": "Exit", "bl.winanim.minimize": "Minimize", "bl.winanim.fade": "Fade", "bl.winanim.scale": "Scale", "bl.winanim.slideUp": "Slide up", "bl.winanim.slideDown": "Slide down", "bl.winanim.slideLeft": "Slide left", "bl.winanim.slideRight": "Slide right", "bl.winanim.none": "None", "bl.winapp.shadow": "Shadow", "bl.winapp.radius": "Corner Radius", "bl.winapp.opacity": "Opacity", "bl.winapp.bgOpacity": "Background Opacity", "bl.winbtn.pageTitle": "Window Buttons", "bl.winbtn.layout": "Button position", "bl.winbtn.layoutAuto": "Right (default)", "bl.winbtn.layoutLeft": "Left", "bl.winbtn.style": "Button style", "bl.winbtn.styleRounded": "Rounded", "bl.winbtn.styleSquare": "Square", "bl.winbtn.styleCircle": "Circle", "bl.winbtn.styleMac": "MAC", "bl.winbtn.styleWin": "WIN", "bl.winbtn.styleMist": "MIST", "bl.winbtn.titlePos": "Title position", "bl.winbtn.titleLeft": "Left", "bl.winbtn.titleCenter": "Center", "bl.winbtn.titleRight": "Right", "bl.winbtn.icons": "Button icons", "bl.winbtn.iconMin": "Minimize icon", "bl.winbtn.iconMax": "Maximize icon", "bl.winbtn.iconClose": "Close icon", "bl.winbtn.import": "Import", "bl.winbtn.clear": "Clear", "bl.winbtn.preview": "Preview", "bl.winbtn.previewBody": "Content", "bl.musicbox.mode": "Mode", "bl.musicbox.modePopup": "Popup (draggable)", "bl.musicbox.modeFixed": "Fixed Popup", "bl.musicbox.reverb": "Reverb", "bl.musicbox.echo": "Echo", "bl.musicbox.denoise": "Denoise", "bl.musicbox.treble": "Treble", "bl.musicbox.bass": "Bass", "bl.musicbox.customSpectrum": "Custom spectrum color", "bl.musicbox.spectrumColor": "Spectrum color", "bl.frostedGlass.pageTitle": "Glass Effect", "bl.frostedGlass.enabled": "Enable Frosted Glass", "bl.frostedGlass.blurRadius": "Blur Intensity", "bl.frostedGlass.opacity": "Opacity", "bl.frostedGlass.themeBoost": "Dark/Light Difference", "bl.frostedGlass.target.window": "Window", "bl.frostedGlass.target.alert": "Popup Notification", "bl.frostedGlass.target.menuBarMenu": "Menu Bar Dropdown"};

    function isZh() {
        try {
            var l = (document.documentElement.lang || '').toLowerCase();
            if (l.indexOf('zh') === 0) return true;
            if (l.indexOf('en') === 0) return false;
        } catch (e) { /* ignore */ }
        try { return /弹窗按钮|按钮位置|标题位置/.test(document.body.innerText || ''); }
        catch (e2) { return false; }
    }

    /* 返回的一定是字符串 —— <option> 里放 React 组件会渲染成 [object Object]。
       源码里动画选项的 defaultMessage 被写死成中文，英文界面按 en 词条还原。 */
    window.__blOpt = function (id, fallback) {
        var f = String(fallback == null ? '' : fallback);
        if (!id) return f;
        var t = isZh() ? ZH : EN;
        return Object.prototype.hasOwnProperty.call(t, id) ? t[id] : f;
    };

    /* 按「分组标题 + option value」兜底（React 内部 props 读不到时用） */
    var ANIM = {
        fade: '淡入淡出', scale: '缩放', slideUp: '上滑', slideDown: '下滑',
        slideLeft: '左滑', slideRight: '右滑', none: '无'
    };
    var MAPS = {
        '按钮位置': { auto: '右侧（默认）', left: '左侧' },
        'Button position': { auto: '右侧（默认）', left: '左侧' },
        '按钮样式': { mac: 'MAC', win: 'WIN', mist: 'MIST' },
        'Button style': { mac: 'MAC', win: 'WIN', mist: 'MIST' },
        '标题位置': { left: '左', center: '中', right: '右' },
        'Title position': { left: '左', center: '中', right: '右' },
        '模式': { popup: '弹窗（可拖动）', fixed: '固定弹窗' },
        'Mode': { popup: '弹窗（可拖动）', fixed: '固定弹窗' },
        '入场动画': ANIM, 'Enter': ANIM,
        '出场动画': ANIM, 'Exit': ANIM,
        /* 最小化动画只有两个选项（见 [B79]） */
        '最小化动画': { genie: '神灯效果', scale: '缩放效果' },
        'Minimize': { genie: 'Genie effect', scale: 'Scale effect' }
    };

    /* React 16/17/18 都会把 props 挂在 DOM 节点上，取回原本的词条 id */
    function fromReact(opt) {
        var keys = Object.keys(opt);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (k.indexOf('__reactProps') !== 0 &&
                k.indexOf('__reactInternalInstance') !== 0 &&
                k.indexOf('__reactEventHandlers') !== 0) continue;
            var inst = opt[k];
            var props = (inst && (inst.memoizedProps || inst)) || {};
            var ch = props.children;
            if (ch && typeof ch === 'object' && ch.props) {
                return { id: ch.props.id, msg: ch.props.defaultMessage };
            }
        }
        return null;
    }

    function fixOption(o) {
        if (String(o.textContent).indexOf('[object Object]') < 0) return;
        var r = fromReact(o), text = '';
        if (r && r.id) text = window.__blOpt(r.id, r.msg || '');
        if (!text && r && r.msg) text = r.msg;
        if (!text) {
            var sel = o.parentElement, label = '';
            if (sel && sel.previousElementSibling) label = (sel.previousElementSibling.textContent || '').trim();
            var map = MAPS[label];
            if (map && map[o.value]) text = map[o.value];
        }
        if (!text) text = o.value;
        o.textContent = text;
    }

    function fixRoot(root) {
        if (!root || !root.querySelectorAll) return;
        var opts = root.querySelectorAll('option');
        for (var i = 0; i < opts.length; i++) fixOption(opts[i]);
    }

    /* 旧版把三个按钮全写成 ×：把 min / max 纠正回横线 / 方框 */
    var ICON_SVG = {
        min: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        max: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>'
    };
    function fixButtons(root) {
        if (!root || !root.querySelectorAll) return;
        var kinds = ['minimize', 'maximize'], keys = ['min', 'max'];
        for (var i = 0; i < kinds.length; i++) {
            var list = root.querySelectorAll('.addon-window-btn-' + kinds[i]);
            for (var j = 0; j < list.length; j++) {
                var b = list[j];
                if (b.__blIcon || b.querySelector('img')) continue;
                var h = b.innerHTML || '';
                /* 只纠正旧版那个 width="12" height="12" 的叉占位 */
                if (h.indexOf('M18 6 6 18') >= 0 && h.indexOf('width="12"') >= 0) {
                    b.innerHTML = ICON_SVG[keys[i]];
                }
            }
        }
    }

    var seen = [];
    function attach(doc) {
        if (!doc || seen.indexOf(doc) >= 0) return;
        seen.push(doc);
        try {
            fixRoot(doc);
            fixButtons(doc);
            if (window.MutationObserver) {
                new MutationObserver(function () {
                    fixRoot(doc);
                    fixButtons(doc);
                }).observe(doc.documentElement || doc.body, { childList: true, subtree: true, characterData: true });
            }
        } catch (e) { /* ignore */ }
    }

    /* srcdoc / iframe 里的设置页同样覆盖 */
    function watchFrames() {
        var fs = document.querySelectorAll('iframe');
        for (var i = 0; i < fs.length; i++) {
            var f = fs[i];
            if (f.__blOptFixed) continue;
            try {
                var d = f.contentDocument;
                if (!d) continue;
                f.__blOptFixed = true;
                try { f.contentWindow.__blOpt = window.__blOpt; } catch (e) { /* ignore */ }
                attach(d);
            } catch (e2) { /* 跨域，忽略 */ }
        }
    }

    if (document.body) {
        attach(document);
        watchFrames();
        if (window.MutationObserver) {
            new MutationObserver(watchFrames).observe(document.body, { childList: true, subtree: true });
        }
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            attach(document); watchFrames();
            if (window.MutationObserver) {
                new MutationObserver(watchFrames).observe(document.body, { childList: true, subtree: true });
            }
        });
    }
    window.addEventListener('load', watchFrames);
    setInterval(function () { watchFrames(); fixRoot(document); fixButtons(document); }, 1500);
})();
