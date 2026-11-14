
(function () {
    'use strict';
    if (window.__blTourV2) return;
    window.__blTourV2 = true;

    /* 原版 6 步教程用这个 key 判断「是否首次」。在解析本脚本时同步写 1，
       此时 DOMContentLoaded 还没触发（本块位于 body 末尾），原版 boot 的
       「第一次打开自动走一遍导览」分支就会被跳过。 */
    var OLD_KEY = 'bilup.tutorialDone';
    var NEW_KEY = 'bl:se-tour-v2';
    try { window.localStorage.setItem(OLD_KEY, '1'); } catch (e0) { /* ignore */ }

    function zh() {
        try {
            var l = String(document.documentElement.lang || navigator.language || '');
            if (/(?:^|[?&])locale=en/i.test(location.search)) return false;
            if (/^en/i.test(l)) return false;
        } catch (e) { /* ignore */ }
        return true;
    }
    function T(z, a, b) { return z ? a : b; }
    function esc(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ================================================================== *
     * 用户名：与编辑器用户同步
     *   ① Bilup 官方覆盖键 tw:username-override
     *   ② Redux：rotur / tw 两个 username 字段
     *   ③ STAR AI 的「对你的称呼」
     *   ④ URL ?username= 参数（编辑器启动时会读）
     *   ⑤ 广播 bl:se-username，供其它模块对齐
     * ================================================================== */
    function syncUsername(name) {
        name = String(name || '').trim().slice(0, 24);
        if (!name) return '';
        try { window.localStorage.setItem('tw:username-override', name); } catch (e) {}
        try { window.localStorage.setItem('bl:se-username', name); } catch (e2) {}
        try {
            var raw = window.localStorage.getItem('bl.star.ai');
            var o = raw ? JSON.parse(raw) : {};
            if (!o || typeof o !== 'object') o = {};
            o.callName = name;
            window.localStorage.setItem('bl.star.ai', JSON.stringify(o));
            document.dispatchEvent(new CustomEvent('bl:star-ai-change'));
        } catch (e3) {}
        try {
            var st = window.ReduxStore;
            if (st && typeof st.dispatch === 'function') {
                st.dispatch({ type: 'scratch-gui/rotur/SET_USERNAME_OVERRIDE', username: name });
                st.dispatch({ type: 'tw/SET_USERNAME', username: name });
            }
        } catch (e4) {}
        try {
            var u = new URL(window.location.href);
            u.searchParams.set('username', name);
            window.history.replaceState(null, '', u.toString());
        } catch (e5) {}
        try {
            window.dispatchEvent(new CustomEvent('bl:se-username', { detail: { name: name } }));
        } catch (e6) {}
        return name;
    }

    /* ================================================================== *
     * 功能清单：StartEditor 对比原版 Bilup 的新功能
     * 每条带一个 open()，介绍到该条时自动打开对应弹窗 / 工作区。
     * ================================================================== */
    var FEATURES = [
        { t: ['造型编辑器重做', 'Costume editor rebuilt'],
          d: ['对比原版 Bilup：画布铺满，绘画工具改单列可上下滚动，顶部两行工具并成一行可横向滚动；每个工具右下角标快捷键，画布缩放有动画，右下角缩略图固定显示完整造型、不跟随缩放范围。',
              'Versus stock Bilup: full-bleed canvas, one scrollable tool column, a single scrollable top toolbar, shortcut badges on every tool, animated canvas zoom, and a thumbnail that always shows the whole costume.'],
          open: function () { clickTab(['造型', 'Costumes']); } },
        { t: ['舞台、角色栏弹窗化', 'Stage & sprite pane as a window'],
          d: ['常规设置里打开开关，舞台和角色栏就变成可拖动、八方向可缩放的原版弹窗；改大小后舞台按比例自动充满，位置尺寸会记住。',
              'Turn it on in General: the stage and sprite pane become a draggable, 8-handle resizable window, and the stage auto-fits as you resize.'],
          open: function () {
              try { if (window.__blStagePopCtl) window.__blStagePopCtl.setEnabled(true); } catch (e) {}
              openSettings();
          } },
        { t: ['神灯 / 缩放最小化动画', 'Genie / Scale minimize'],
          d: ['外观 → 弹窗动画 → 最小化动画只有两档：神灯效果是非均匀卷吸、弧线入坞；缩放效果是等比直线飞入。两者时长、帧数、缓动和入坞反馈都不同。',
              'Appearance → Window animation → Minimize has exactly two options: a non-uniform, curved Genie suck-in and a straight, eased Scale. Different duration, frames and Dock feedback.'],
          open: function () { openSettings(); clickSidebar(['外观', 'Appearance']); } },
        { t: ['毛玻璃与液态玻璃', 'Frosted & liquid glass'],
          d: ['两种玻璃互斥但都即时生效；液态玻璃右上角不打光影，弹窗外观的阴影/圆角/透明度与玻璃合并而不是互相盖掉，DOCK 图标也跟随玻璃与主题。',
              'Two instant, mutually exclusive glass styles; no specular highlight in the top-right corner, window appearance merges with glass, and Dock icons follow glass + theme.'],
          open: function () { openSettings(); clickSidebar(['玻璃效果', 'Glass']); } },
        { t: ['按钮样式与左右位置', 'Window buttons & position'],
          d: ['MAC / WIN / MIST 三态圆角与红黄绿按钮，MAC 下按钮和标题的左右位置都能改；八音盒关闭按钮在 MAC 样式下也正常显示。',
              'MAC / WIN / MIST button styles; both button side and title alignment work under MAC, and the music-box close button is restored.'],
          open: function () { openSettings(); clickSidebar(['常规', 'General']); } },
        { t: ['DOCK 栏与快速定位', 'Dock & snap positions'],
          d: ['DOCK 始终高于所有弹窗，图标有立体凝胶质感并跟随玻璃；名字不会再变全黑。把窗口拖到右上角会弹出带动画的快速定位框，共 13 个定位点。',
              'Dock always sits above every window, glass-aware 3D icons, fixed name labels, and an animated snap panel with 13 positions when dragging a window to the top-right.'],
          open: function () { openSnapPanel(); } },
        { t: ['版本历史卡与大卡', 'Version cards'],
          d: ['七个版本各有独立配色、背景、动画、宣传语与排版；点历史卡，顶部的大版本封面整套换皮肤，Esc 或点「返回当前版本」回到 SEA。',
              'Seven version cards each with its own palette, background, animation, slogan and layout; clicking one also re-skins the big hero card.'],
          open: function () { openSettings(); clickSidebar(['版本号', 'Version']); } },
        { t: ['自定义主题色', 'Custom palette'],
          d: ['主题面板里点「自定义主题色」：深色/浅色基调 + 八个核心色，带 WCAG 对比度徽标、HEX 直接编辑，还能「按强调色生成整套」，改动即时作用于全编辑器。',
              'Theme → Custom palette: dark/light foundation, eight core colors with WCAG badges, editable HEX, "Generate from accent", applied live across the editor.'],
          open: function () { openCustomPalette(); } },
        { t: ['STAR AI：只聊天与教学', 'STAR AI: chat & teach only'],
          d: ['设置 → 常规 → STAR AI 可设总开关、称呼、温度、内置三个免费模型和 STT 快捷启动；它不会编程作品、不生成积木，也不会点击编辑器，只用文字讲 Start Editor 的用法。',
              'Settings → General → STAR AI: enable switch, your name, temperature, three built-in free models and the STT shortcut. It never programs, generates blocks or clicks the editor.'],
          open: function () {
              try { if (window.__blStar && window.__blStar.open) window.__blStar.open(); } catch (e) {}
              openSettings();
              try { if (window.__blStarAISettings && window.__blStarAISettings.open) window.__blStarAISettings.open(); } catch (e2) {}
          } },
        { t: ['保存到电脑三选一', 'Save as SB3 / STAR / RJ'],
          d: ['点「保存到此电脑」弹出 SB3、STAR、RJ 三张卡片，可按 1/2/3 直选；STAR 把积木拆成多个分片、体积更小。放下一个积木就在后台预编译三种字节，点保存基本零等待。',
              'Save to this computer opens three cards (keys 1/2/3). STAR splits blocks into shards for a smaller file; dropping a block precompiles all three formats in the background.'],
          open: function () {
              try { if (window.__blSave && window.__blSave.askFormat) window.__blSave.askFormat(); }
              catch (e) {}
          } },
        { t: ['工具箱 · 作品格式转换', 'Toolbox · format converter'],
          d: ['工具箱新增「作品格式转换」，STAR.sb3 / .STAR / .rj 任意两向互转，输出前自检能否读出角色；另有作品比较、帧率、性能模式、录制舞台、屏幕滤镜等工具。',
              'The toolbox gained Project Format Converter: any-to-any STAR.sb3 / .STAR / .rj with an output self-check, plus diff, FPS, perf mode, recorder and screen filter.'],
          open: function () {
              try {
                  if (window.__blToolbox && window.__blToolbox.open) window.__blToolbox.open();
                  if (window.__blToolbox && window.__blToolbox.openTool) window.__blToolbox.openTool('convert');
              } catch (e) {}
          } },
        { t: ['项目面板与加载动画', 'Project panel'],
          d: ['写项目界面重做：一行 3 个作品卡片、搜索排序、导入导出；保存/切换/导入并行序列化并乐观写库，常规作品 3 秒内完成，带分阶段加载动画和真实耗时回显。',
              'Three project cards per row, search and sorting; save / switch / import serialize in parallel with optimistic writes, a staged loading animation and real elapsed time.'],
          open: function () {
              try { if (window.__blProjects && window.__blProjects.show) window.__blProjects.show(true); }
              catch (e) {}
          } },
        { t: ['工程文件工作区', 'Project files workspace'],
          d: ['左侧「工程文件」会真的打包一次 SB3 并自解析 ZIP，列出里面每个文件、所属角色与造型、原始与压缩体积，可预览 project.json、SVG、图片、音频并单独下载。',
              'The Project Files tab packs a real SB3, parses the ZIP and lists every asset with owner, raw/compressed size, plus preview and single-file download.'],
          open: function () { clickTab(['工程文件', 'Project files']); } },
        { t: ['音乐工坊与在线素材库', 'Music studio & online library'],
          d: ['音乐编辑器可多轨编排、导入音频、导出 MIDI/WAV；在线素材库从网络取 Scratch 官方声音，没网络就明确显示「请联网」，本地编曲导出照常可用。',
              'Multi-track studio with audio import and MIDI/WAV export; the online library fetches Scratch sounds and clearly says "Please connect to the internet" when offline.'],
          open: function () {
              try { if (window.__blOnlineMusic && window.__blOnlineMusic.open) window.__blOnlineMusic.open(); }
              catch (e) {}
              clickTab(['音乐', 'Music']);
          } },
        { t: ['工作区与舞台布局', 'Workspaces & stage layout'],
          d: ['除「代码」外，造型、背景、声音、项目、音乐、工程文件这些工作区都不显示舞台，把整块空间让给当前工作；切语言也不会再跳到播放器首页。',
              'Only the Code tab keeps the stage; every other workspace hides it for more room, and changing language no longer drops into the player home.'],
          open: function () { clickTab(['项目', 'Project']); } },
        { t: ['稳定性与细节修复', 'Stability & details'],
          d: ['扩展沙盒询问久未点击不再让作品加载失败；STAR 打包不会拆坏数组 primitive；造型滚动、DOCK 显示、玻璃图层偏移、弹窗外观失效等问题都已修复。扩展库卡片换成 StartEditor LOGO，tw 扩展标题改为 turbowarp 积木。',
              'Sandbox prompts no longer time out into load failure; STAR packing preserves array primitives; costume scroll, Dock layout, glass offsets and appearance regressions are fixed. The extension card now uses the StartEditor LOGO.'],
          open: function () { clickText(['添加扩展', 'Add Extension', 'Extensions']); } }
    ];

    /* ---------------- 打开对应弹窗的通用工具 ---------------- */
    function clickText(names, root) {
        var host = root || document;
        var list = host.querySelectorAll('button, [role="button"], li, [class*="menu-bar_item"], [class*="tab_"]');
        for (var i = 0; i < list.length; i++) {
            var txt = String(list[i].textContent || '').trim();
            var ar = String(list[i].getAttribute('aria-label') || '') + ' ' +
                     String(list[i].getAttribute('title') || '');
            for (var j = 0; j < names.length; j++) {
                if (txt.indexOf(names[j]) >= 0 || ar.indexOf(names[j]) >= 0) {
                    try { list[i].click(); return list[i]; } catch (e) { return null; }
                }
            }
        }
        return null;
    }
    function clickTab(names) {
        var el = clickText(names);
        if (!el) return null;
        return el;
    }
    function openSettings() {
        try {
            var st = window.ReduxStore;
            if (st && typeof st.dispatch === 'function') {
                st.dispatch({ type: 'scratch-gui/modals/OPEN_MODAL', modal: 'settingsModal' });
                return true;
            }
        } catch (e) {}
        return !!clickText(['设置', 'Settings']);
    }
    function clickSidebar(names) {
        window.setTimeout(function () {
            var list = document.querySelectorAll('[class*="modal-sidebar_item_"], [data-bl-star-ai], [data-bl-ver]');
            for (var i = 0; i < list.length; i++) {
                var txt = String(list[i].textContent || '').trim();
                for (var j = 0; j < names.length; j++) {
                    if (txt.indexOf(names[j]) >= 0) {
                        try { list[i].click(); } catch (e) {}
                        return;
                    }
                }
            }
        }, 260);
    }
    function openCustomPalette() {
        var btn = document.querySelector('.tw-theme-btn');
        if (btn) {
            try { btn.click(); } catch (e) {}
            window.setTimeout(function () {
                var c = document.querySelector('[data-action="custom"]');
                if (c) { try { c.click(); } catch (e2) {} }
                else demoWindow(T(zh(), '自定义主题色', 'Custom palette'),
                    T(zh(), '八个核心色 + 深浅基调 + 对比度徽标',
                      'Eight core colors, dark/light base and WCAG badges'));
            }, 280);
        } else {
            demoWindow(T(zh(), '自定义主题色', 'Custom palette'),
                T(zh(), '八个核心色 + 深浅基调 + 对比度徽标',
                  'Eight core colors, dark/light base and WCAG badges'));
        }
    }
    function openSnapPanel() {
        var p = document.querySelector('.bl-snap');
        if (p) {
            try { p.classList.add('is-open'); } catch (e) {}
            markSpot(p);
        } else {
            demoWindow(T(zh(), '快速定位', 'Quick snap'),
                T(zh(), '13 个定位点 · 拖窗口到右上角唤出',
                  '13 zones · drag a window to the top-right corner'));
        }
    }

    /* ================================================================== *
     * UI：遮罩四块挖洞 + 教程卡
     * ================================================================== */
    var overlay = null, card = null, dims = [], demos = [], recent = [], spotEl = null;
    var mo = null, stage = '', tourDone = false, idx = 0, timer = 0, holeRaf = 0;
    var savedStagePop = null, openedDuringTour = [];

    function make(cls, parent) {
        var n = document.createElement('div');
        n.className = cls;
        if (parent) parent.appendChild(n);
        return n;
    }
    function ensureUI() {
        if (overlay && overlay.parentNode) return;
        overlay = make('bl-tour-overlay', document.body);
        overlay.setAttribute('data-bl-tour', '1');
        for (var i = 0; i < 4; i++) dims.push(make('bl-tour-dim', overlay));
        card = make('bl-tour-card', document.body);
        card.setAttribute('data-bl-tour', '1');
        try { document.documentElement.classList.add('bl-tour-on'); } catch (e) {}
        setHole(null);
        window.requestAnimationFrame(function () { card.classList.add('is-in'); });
    }
    function setHole(r) {
        if (!dims.length) return;
        var W = window.innerWidth, H = window.innerHeight;
        var t = 0, b = 0, l = 0, rr = 0;
        if (r) {
            t = Math.max(0, Math.min(H, r.top - 10));
            b = Math.max(0, Math.min(H, r.bottom + 10));
            l = Math.max(0, Math.min(W, r.left - 10));
            rr = Math.max(0, Math.min(W, r.right + 10));
            if (b <= t || rr <= l) r = null;
        }
        if (!r) { t = 0; b = H; l = 0; rr = W; }
        function box(i, x, y, w, h) {
            var s = dims[i].style;
            s.left = x + 'px'; s.top = y + 'px';
            s.width = Math.max(0, w) + 'px'; s.height = Math.max(0, h) + 'px';
            s.display = (w > 0 && h > 0) ? 'block' : 'none';
        }
        if (!r) { box(0, 0, 0, W, H); box(1, 0, 0, 0, 0); box(2, 0, 0, 0, 0); box(3, 0, 0, 0, 0); }
        else {
            box(0, 0, 0, W, t);                       /* 上 */
            box(1, 0, b, W, H - b);                  /* 下 */
            box(2, 0, t, l, b - t);                  /* 左 */
            box(3, rr, t, W - rr, b - t);            /* 右 */
        }
    }
    function markSpot(el) {
        if (spotEl && spotEl !== el) {
            try { spotEl.classList.remove('bl-tour-spot'); } catch (e) {}
        }
        spotEl = el || null;
        if (spotEl) {
            try { spotEl.classList.add('bl-tour-spot'); } catch (e2) {}
            pulseHole();
        } else setHole(null);
    }
    function pulseHole() {
        var n = 0;
        function step() {
            if (!spotEl || !spotEl.isConnected) { setHole(null); return; }
            try { setHole(spotEl.getBoundingClientRect()); } catch (e) { setHole(null); }
            if (++n < 8) window.setTimeout(step, 120);
        }
        step();
    }
    function demoWindow(title, body) {
        var d = make('addon-window bl-tour-demo', document.body);
        d.setAttribute('data-bl-tour', '1');
        d.innerHTML = '<div class="addon-window-header"><span class="addon-window-title">' +
            esc(title) + '</span></div><div class="bl-tour-demo-body">' + esc(body) + '</div>';
        var w = Math.min(360, window.innerWidth - 60);
        d.style.left = Math.round((window.innerWidth - w) / 2) + 'px';
        d.style.top = Math.round(Math.max(40, window.innerHeight * 0.22)) + 'px';
        demos.push(d);
        openedDuringTour.push(d);
        markSpot(d);
        return d;
    }
    function observeWindows() {
        if (mo || !window.MutationObserver) return;
        mo = new MutationObserver(function (recs) {
            for (var i = 0; i < recs.length; i++) {
                var ns = recs[i].addedNodes || [];
                for (var j = 0; j < ns.length; j++) {
                    var n = ns[j];
                    if (!n || n.nodeType !== 1 || n.hasAttribute('data-bl-tour')) continue;
                    var hit = n.matches && (n.matches('.addon-window') ||
                        n.matches('[class*="settings-modal_"]') ||
                        n.matches('[class*="modal_modal_"]') ||
                        n.matches('.tw-panel') || n.matches('.bl-proj-panel'));
                    var inner = !hit && n.querySelector ? n.querySelector(
                        '.addon-window, [class*="settings-modal_"], .tw-panel') : null;
                    var el = hit ? n : inner;
                    if (el && recent.indexOf(el) < 0) recent.unshift(el);
                }
            }
            if (recent.length > 16) recent.length = 16;
        });
        try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    }
    function pickWindow() {
        for (var i = 0; i < recent.length; i++) {
            var el = recent[i];
            if (!el || !el.isConnected) continue;
            var r = null;
            try { r = el.getBoundingClientRect(); } catch (e) {}
            if (r && r.width > 120 && r.height > 80) {
                if (openedDuringTour.indexOf(el) < 0) openedDuringTour.push(el);
                return el;
            }
        }
        return null;
    }

    /* ---------------- 阶段渲染 ---------------- */
    function setCard(html, center) {
        card.innerHTML = html;
        card.classList.toggle('is-center', !!center);
        card.classList.toggle('is-bottom', !center);
        card.classList.remove('is-in');
        window.requestAnimationFrame(function () { card.classList.add('is-in'); });
    }
    function stageChoose() {
        stage = 'choose';
        var z = zh();
        setCard(
            '<div class="bl-tour-eyebrow">START EDITOR · 1.0.5 SEA</div>' +
            '<h2>' + esc(T(z, '先认识一下你', 'Before we start')) + '</h2>' +
            '<p>' + esc(T(z, '你更接近哪一种？选「Scratch高手」会直接跳过新手教程。',
                          'Which fits you better? Pick "Scratch pro" to skip the beginner tour.')) + '</p>' +
            '<div class="bl-tour-row">' +
            '<button type="button" class="bl-tour-btn" data-tour="pro">' +
            esc(T(z, 'Scratch高手', 'Scratch pro')) + '</button>' +
            '<button type="button" class="bl-tour-btn is-primary" data-tour="new">' +
            esc(T(z, 'Scratch小白', 'Scratch beginner')) + '</button></div>', true);
    }
    function stageName() {
        stage = 'name';
        var z = zh();
        setCard(
            '<div class="bl-tour-eyebrow">START EDITOR · ' + esc(T(z, '第 1 步', 'STEP 1')) + '</div>' +
            '<h2>' + esc(T(z, '怎么称呼你？', 'What should we call you?')) + '</h2>' +
            '<p>' + esc(T(z, '这个名字会同步给编辑器的用户名，STAR 也会这样称呼你。',
                          'This name syncs to the editor username, and STAR will address you by it.')) + '</p>' +
            '<input type="text" class="bl-tour-input" data-tour="name" maxlength="24" ' +
            'placeholder="' + esc(T(z, '输入用户名', 'Your name')) + '">' +
            '<div class="bl-tour-row">' +
            '<button type="button" class="bl-tour-btn is-primary" data-tour="name-ok">' +
            esc(T(z, '就叫我这个', 'Use this name')) + '</button></div>', true);
        window.setTimeout(function () {
            var i = card.querySelector('[data-tour="name"]');
            if (i) { try { i.focus(); } catch (e) {} }
        }, 220);
    }
    function stageFeatures() {
        stage = 'features';
        observeWindows();
        idx = 0;
        showFeature();
    }
    function showFeature() {
        if (tourDone || stage !== 'features') return;
        if (idx >= FEATURES.length) { stageFinal(); return; }
        var z = zh(), f = FEATURES[idx];
        var pct = Math.round(idx / FEATURES.length * 100);
        setCard(
            '<div class="bl-tour-meta"><span>START EDITOR · ' +
            esc(T(z, '对比原版 Bilup 的新功能', 'New vs. stock Bilup')) + '</span>' +
            '<span style="margin-left:auto">' + (idx + 1) + ' / ' + FEATURES.length + '</span>' +
            '<button type="button" class="bl-tour-skip" data-tour="skip">' +
            esc(T(z, '跳过介绍', 'Skip')) + '</button></div>' +
            '<div class="bl-tour-bar"><i style="width:' + pct + '%"></i></div>' +
            '<h2>' + esc(f.t[z ? 0 : 1]) + '</h2>' +
            '<p>' + esc(f.d[z ? 0 : 1]) + '</p>', false);
        /* 上一条的演示弹窗收起，再打开这一条对应的弹窗 */
        clearSpot();
        recent.length = 0;
        try { f.open(); } catch (e) { /* 单条失败不影响导览 */ }
        window.setTimeout(function () {
            var el = pickWindow();
            if (el) markSpot(el);
            else demoWindow(f.t[z ? 0 : 1], f.d[z ? 0 : 1]);
        }, 420);
        idx++;
        timer = window.setTimeout(showFeature, 2600);
    }
    function clearSpot() {
        if (spotEl) {
            try { spotEl.classList.remove('bl-tour-spot'); } catch (e) {}
            /* 教程自己造的演示窗口直接移除；原生窗口只摘标记，不强行删除 */
            var di = demos.indexOf(spotEl);
            if (di >= 0) {
                try { if (spotEl.parentNode) spotEl.parentNode.removeChild(spotEl); } catch (e2) {}
                demos.splice(di, 1);
            }
            spotEl = null;
        }
        setHole(null);
    }
    function stageFinal() {
        stage = 'final';
        window.clearTimeout(timer);
        clearSpot();
        setHole(null);
        var z = zh();
        setCard(
            '<div class="bl-tour-eyebrow">START EDITOR · ' + esc(T(z, '导览结束', 'TOUR COMPLETE')) + '</div>' +
            '<h2>' + esc('接下来自己去探索Start Editor吧awa！') + '</h2>' +
            '<p>' + esc(T(z, '所有设置都在「设置 → 常规 / 外观」，工具都收在 DOCK 和工具箱里。',
                          'Everything lives in Settings → General / Appearance, the Dock and the Toolbox.')) + '</p>' +
            '<div class="bl-tour-row">' +
            '<button type="button" class="bl-tour-btn is-primary" data-tour="finish">' +
            esc(T(z, '开始探索', 'Start exploring')) + '</button></div>', true);
    }
    function cleanup() {
        tourDone = true;
        window.clearTimeout(timer);
        clearSpot();
        for (var i = 0; i < demos.length; i++) {
            try { if (demos[i].parentNode) demos[i].parentNode.removeChild(demos[i]); } catch (e) {}
        }
        demos = [];
        /* 收起教程期间打开的原生窗口 / 设置弹窗，交还一个干净的桌面 */
        try {
            var st = window.ReduxStore;
            if (st && typeof st.dispatch === 'function') {
                st.dispatch({ type: 'scratch-gui/modals/CLOSE_MODAL', modal: 'settingsModal' });
            }
        } catch (e2) {}
        /* 只收教程期间自己打开过的窗口，绝不动用户原本开着的窗口 */
        for (var j = 0; j < openedDuringTour.length; j++) {
            var w = openedDuringTour[j];
            if (!w || !w.isConnected || w.hasAttribute('data-bl-tour')) continue;
            var c = w.querySelector('.addon-window-btn-close, .sw-close, .grad-close, .tb-close');
            if (c) { try { c.click(); } catch (e3) {} }
        }
        openedDuringTour = [];
        var snaps = document.querySelectorAll('.bl-snap.is-open');
        for (var k = 0; k < snaps.length; k++) {
            try { snaps[k].classList.remove('is-open'); } catch (e8) {}
        }
        try { clickText(['代码', 'Code']); } catch (e9) {}
        if (savedStagePop !== null) {
            try {
                if (window.__blStagePopCtl && window.__blStagePopCtl.setEnabled) {
                    window.__blStagePopCtl.setEnabled(savedStagePop);
                }
            } catch (e4) {}
            savedStagePop = null;
        }
        try { if (mo) { mo.disconnect(); mo = null; } } catch (e5) {}
        try { document.documentElement.classList.remove('bl-tour-on'); } catch (e6) {}
        if (card && card.parentNode) card.parentNode.removeChild(card);
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        card = null; overlay = null; dims = [];
        try { window.localStorage.setItem(NEW_KEY, '1'); } catch (e7) {}
    }
    function skipAll() {
        /* Scratch 高手：直接跳过新手教程，不写任何用户名 */
        cleanup();
    }

    /* ---------------- 交互 ---------------- */
    document.addEventListener('click', function (e) {
        if (!card || !e.target || !e.target.closest) return;
        var b = e.target.closest('[data-tour]');
        if (!b || !card.contains(b)) return;
        var k = b.getAttribute('data-tour');
        if (k === 'pro') { skipAll(); return; }
        if (k === 'new') { stageName(); return; }
        if (k === 'name-ok') {
            var i = card.querySelector('[data-tour="name"]');
            var name = i ? i.value : '';
            if (!String(name).trim()) { try { i.focus(); } catch (e2) {} return; }
            syncUsername(name);
            stageFeatures();
            return;
        }
        if (k === 'skip') { stageFinal(); return; }
        if (k === 'finish') { cleanup(); return; }
    }, true);
    document.addEventListener('keydown', function (e) {
        if (!card || !card.parentNode) return;
        if (e.key === 'Enter' && stage === 'name') {
            var b = card.querySelector('[data-tour="name-ok"]');
            if (b) { e.preventDefault(); b.click(); }
        } else if (e.key === 'Escape') {
            if (stage === 'final') cleanup();
            else if (stage === 'features') stageFinal();
            else skipAll();
        }
    }, true);
    window.addEventListener('resize', function () {
        if (!overlay) return;
        if (holeRaf) return;
        holeRaf = window.requestAnimationFrame(function () {
            holeRaf = 0;
            if (spotEl && spotEl.isConnected) {
                try { setHole(spotEl.getBoundingClientRect()); } catch (e) { setHole(null); }
            } else setHole(null);
        });
    });

    /* ---------------- 启动 / 接管 ---------------- */
    function start() {
        if (tourDone || (overlay && overlay.parentNode)) return;
        try { savedStagePop = window.__blStagePopCtl ?
                !!window.__blStagePopCtl.status().enabled : null; } catch (e) {}
        ensureUI();
        stageChoose();
    }
    function autoStart() {
        var done = false;
        try { done = window.localStorage.getItem(NEW_KEY) === '1'; } catch (e) {}
        if (done) return;
        /* 等编辑器主体挂载，最多等 14 秒；挂载后 600ms 再弹，避免和加载遮罩抢 */
        var tries = 0;
        var t = window.setInterval(function () {
            tries++;
            var ready = document.querySelector('[class*="gui_menu-bar"], [class*="menu-bar_menu-bar_"], .bl-dock');
            if (ready || tries > 28) {
                window.clearInterval(t);
                window.setTimeout(function () {
                    try { if (!window.localStorage.getItem(NEW_KEY)) start(); }
                    catch (e2) { start(); }
                }, 700);
            }
        }, 500);
    }
    /* 菜单里的「显示教程」也走新流程；原版 6 步窗口一旦出现立即移除 */
    function takeover() {
        try {
            if (window.__blStudio) {
                window.__blStudio.openTutorial = function () {
                    tourDone = false;
                    try { window.localStorage.removeItem(NEW_KEY); } catch (e) {}
                    start();
                };
            }
        } catch (e) {}
        try {
            var kill = new MutationObserver(function () {
                var old = document.querySelectorAll('.bl-tut');
                for (var i = 0; i < old.length; i++) {
                    if (old[i].parentNode && !old[i].hasAttribute('data-bl-tour')) {
                        try { old[i].parentNode.removeChild(old[i]); } catch (e2) {}
                        if (!overlay) { tourDone = false; start(); }
                    }
                }
                /* 旧存档可能还把「教程」pin 在 DOCK 上：数据层已删入口，
                   这里再兜底摘掉运行时残留节点 */
                var dockTut = document.querySelectorAll('.bl-dock-item[data-dock="tutorial"]');
                for (var j = 0; j < dockTut.length; j++) {
                    try { if (dockTut[j].parentNode) dockTut[j].parentNode.removeChild(dockTut[j]); }
                    catch (e3) {}
                }
            });
            kill.observe(document.body, { childList: true, subtree: true });
        } catch (e4) {}
    }
    takeover();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            window.setTimeout(autoStart, 60);
        });
    } else window.setTimeout(autoStart, 60);

    window.__blTourV2 = {
        start: function () { tourDone = false; start(); },
        skip: skipAll,
        finish: cleanup,
        syncUsername: syncUsername,
        features: FEATURES,
        state: function () {
            return { stage: stage, index: idx, total: FEATURES.length,
                     done: tourDone, open: !!(overlay && overlay.parentNode) };
        }
    };
})();
