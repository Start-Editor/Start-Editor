
/* ── [B74] 设置页 hero 卡片注入 ─────────────────────────────────────
   参考图的顶部大卡：版本号 / 设备名 / 右侧设备图。
   这里用当前版本、主题与平台信息生成；React 重绘换掉 body 子节点时
   由 MutationObserver 补挂，不改动任何原生设置项 DOM。
   ───────────────────────────────────────────────────────────── */
(function () {
    'use strict';
    var CLS = 'bl-os-hero';
    var EN = /(?:^|[?&])locale=en/i.test(location.search);

    function version() {
        try {
            var el = document.querySelector('[class*="version"]');
            if (el && (el.textContent || '').indexOf('1.0.5') >= 0) return '1.0.5 SEA';
        } catch (e) { /* ignore */ }
        return '1.0.5 SEA';
    }
    function themeName() {
        try {
            var raw = localStorage.getItem('bilup.appTheme') || localStorage.getItem('tw:theme') || '';
            if (/dark|deepsea/i.test(raw)) return EN ? 'Dark' : '暗色';
            if (/sakura/i.test(raw)) return EN ? 'Sakura' : '樱花';
            if (/mint/i.test(raw)) return EN ? 'Mint' : '薄荷';
        } catch (e) { /* ignore */ }
        return EN ? 'Light' : '亮色';
    }
    function platform() {
        var ua = navigator.userAgent || '';
        var os = /Windows/.test(ua) ? 'Windows' :
            (/Mac OS/.test(ua) ? 'macOS' : (/Android/.test(ua) ? 'Android' : 'Desktop'));
        var br = /Edg\//.test(ua) ? 'Edge' : (/Chrome\//.test(ua) ? 'Chrome' :
            (/Firefox\//.test(ua) ? 'Firefox' : 'Browser'));
        return os + ' · ' + br;
    }
    function deviceSvg() {
        return '<svg class="bl-os-hero-dev" viewBox="0 0 156 112" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<defs><linearGradient id="blOsDev" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#8fa9d8"/><stop offset="1" stop-color="#c9d8f2"/></linearGradient>' +
          '<linearGradient id="blOsScr" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#1d3358"/><stop offset="1" stop-color="#3d6bb0"/></linearGradient></defs>' +
          '<rect x="6" y="4" width="144" height="104" rx="13" fill="url(#blOsDev)"/>' +
          '<rect x="11" y="9" width="134" height="94" rx="9" fill="url(#blOsScr)"/>' +
          '<circle cx="78" cy="6" r="1.8" fill="#30415e"/>' +
          '<path d="M22 26h44v9H22zM22 42h30v9H22zM22 58h38v9H22zM22 74h24v9H22z" fill="#9fc0ff" opacity=".72"/>' +
          '<rect x="76" y="26" width="58" height="57" rx="5" fill="#ffffff" opacity=".10"/>' +
          '<path d="M84 74l14-18 11 12 9-8 12 14z" fill="#bfe0ff" opacity=".85"/>' +
          '<circle cx="126" cy="38" r="6" fill="#ffe6a6" opacity=".9"/>' +
          '</svg>';
    }
    function cardHtml() {
        var t = EN ? {
            slogan: 'All enhancements enabled · Stable build',
            theme: 'Theme', platform: 'Platform'
        } : {
            slogan: '已启用全部增强 · 正式版',
            theme: '主题', platform: '平台'
        };
        /* 把 '1.0.5 SEA' 拆成「巨大主版本号 + 胶囊里的代号」，
           对应参考图里的大 16 与底部「正式版」胶囊。 */
        var parts = String(version() || '').trim().split(/\s+/);
        var num = parts[0] || '1.0.5';
        var codename = parts.slice(1).join(' ') || 'STABLE';
        return '<div class="bl-os-hero-fx" aria-hidden="true">' +
                   '<span class="bl-os-hero-liquid"></span>' +
                   '<span class="bl-os-hero-glow"></span>' +
                   '<span class="bl-os-hero-shine"></span>' +
               '</div>' +
               '<div class="bl-os-hero-in"><div class="bl-os-hero-txt">' +
                   '<div class="bl-os-hero-num">' + num + '</div>' +
                   '<div class="bl-os-hero-product">StartEditor</div>' +
                   '<div class="bl-os-hero-slogan">' + t.slogan + '</div>' +
                   '<div class="bl-os-hero-badge">' + codename + '</div>' +
                   '<div class="bl-os-hero-meta">' +
                       '<span>' + t.theme + '：' + themeName() + '</span>' +
                       '<span>' + t.platform + '：' + platform() + '</span>' +
                   '</div>' +
               '</div></div>';
    }

    /* 设置窗口的右侧内容区。版本历史页用的是同一个节点，
       两边保持一致，避免不同弹窗里出现多个 body 时插错地方。 */
    function settingsBody() {
        var c = document.querySelector('[class*="modal-sidebar_content_"]');
        if (c) {
            var b = c.querySelector('[class*="settings-modal_body_"]');
            if (b) return b;
        }
        return document.querySelector('[class*="settings-modal_body_"]');
    }

    /* 是否处在「版本」分类：优先看版本历史页加的 .bl-ver-mode，
       再退一步看侧栏选中项的文字（中英双语）。 */
    function isVersionPage(body) {
        if (body && body.classList.contains('bl-ver-mode')) return true;
        try {
            var sel = document.querySelector('[class*="modal-sidebar_itemSelected_"]');
            var t = sel ? String(sel.textContent || '').trim() : '';
            return /版本号|^Version\b/i.test(t);
        } catch (e) { return false; }
    }

    function versionPanel(body) {
        return body ? body.querySelector('.bl-ver-history') : null;
    }

    /* 关键改动：大卡只在版本页出现，且插进历史面板内部最前。
       旧版无条件挂在 body 上，于是常规 / 外观 / 高级每个分类顶部
       都顶着一张版本大卡 —— 用户要的是「只显示在版本里」。 */
    /* 关键：大卡一旦挂进历史面板就常驻，绝不再主动删除。

       旧版在这里用 isVersionPage() 做瞬时判断，false 就把卡 remove 掉。
       但版本页脚本是通过 toggle .bl-ver-mode 来控制页面的，两边存在
       竞态：点开「版本号」的一瞬间 bl-ver-mode 还没加上、侧栏选中态
       也还没更新，ensure 就把大卡删了并移除 bl-ver-has-os —— 页面
       回退成旧的蓝白小 hero，直到 1.5s 轮询才补回来。这就是用户看到的
       「有时会变成老版本样子」。

       现在显示 / 隐藏完全交给面板自身的 .bl-ver-history.is-on：
       非版本分类时面板是 display:none，大卡自然跟着隐藏，零竞态。 */
    /* 当前是不是「玻璃效果」分类：侧栏选中项文字（中英双语）+ 内容区
       独有文案 + 液态注入段三重判断，React 重绘换节点也不会漏。 */
    function syncGlassPageClass() {
        var body = settingsBody();
        if (!body) return;
        var on = false;
        try {
            var sel = document.querySelector('[class*="modal-sidebar_itemSelected_"]');
            var t = sel ? String(sel.textContent || '').trim() : '';
            if (/玻璃效果|Glass/i.test(t)) on = true;
            if (!on && /启用毛玻璃效果|Enable Frosted Glass/.test(body.textContent || '')) on = true;
            if (!on && body.querySelector('[data-bl-lg-sec]')) on = true;
        } catch (e) { /* ignore */ }
        body.classList.toggle('bl-set-stack', on);
    }

    function ensure() {
        syncGlassPageClass();
        var body = settingsBody();
        if (!body) return;
        /* React 重绘偶尔会同时留下新旧两个 .bl-ver-history（旧节点没清、
           新节点已插入）。旧版只给第一个补卡，若显示的恰好是另一个，
           那一帧就是没有大卡的老版 hero。这里给全部面板都补上。 */
        var panels = body.querySelectorAll('.bl-ver-history');
        if (!panels.length) return;   /* 面板还没建好，等下一次观察 / 轮询 */
        for (var pi = 0; pi < panels.length; pi++) {
            var panel = panels[pi];
            var card = panel.querySelector('.' + CLS);
            if (!card) {
                card = document.createElement('div');
                card.className = CLS;
                card.innerHTML = cardHtml();
            }
            if (card.parentNode !== panel || panel.firstChild !== card) {
                panel.insertBefore(card, panel.firstChild);
            }
            panel.classList.add('bl-ver-has-os');
        }

        /* 清掉早期版本误挂在 body 直接子级的旧卡（正常路径不会命中） */
        try {
            for (var i = body.children.length - 1; i >= 0; i--) {
                if (body.children[i].classList &&
                    body.children[i].classList.contains(CLS)) {
                    body.removeChild(body.children[i]);
                }
            }
        } catch (e) { /* ignore */ }
    }

    /* 切换分类时重播内容区入场动画。
       React 往往复用同一批 DOM 节点，光靠 CSS animation 不会重新播放，
       所以 remove → 读一次布局 → add，强制刷新动画时间线。 */
    var animTimer = 0;
    function replayAnimation() {
        var body = settingsBody();
        if (!body) return;
        body.classList.remove('bl-set-anim');
        void body.offsetWidth;                 /* 强制重排，让动画能重播 */
        body.classList.add('bl-set-anim');
        if (animTimer) window.clearTimeout(animTimer);
        animTimer = window.setTimeout(function () {
            animTimer = 0;
            try { body.classList.remove('bl-set-anim'); } catch (e) { /* ignore */ }
        }, 620);
    }

    /* ── 补挂调度 ──────────────────────────────────────────────────
       ensure() 幂等（节点位置正确时不写 DOM），所以可以安全地重复调。
       setTimeout(0) 只用来合并同一帧里的多次回调，不引入可见延迟。 */
    var syncPending = false, syncing = false;
    function ensureSoon() {
        if (syncPending || syncing) return;
        syncPending = true;
        window.setTimeout(function () {
            syncPending = false;
            syncing = true;
            try { ensure(); watchBody(); }
            catch (e) { /* ignore */ }
            finally { syncing = false; }
        }, 0);
    }

    /* 关键：观察具体的 settingsBody 节点，而不是 document.documentElement。
       B01 性能总线把「document/body + subtree」的观察收进自己的总线，
       启动期与作品加载期会冻结不分发；而对普通元素的观察完全透传原生
       MutationObserver。改用精确观察后，React 换掉面板子节点的那一帧
       就能立刻补挂大卡，不再有几百毫秒甚至更长的老版空窗。 */
    var moBody = null, bodyMO = null;
    function watchBody() {
        if (!window.MutationObserver) return;
        var body = settingsBody();
        if (!body || body === document.body || body === document.documentElement) return;
        if (body === moBody) return;
        moBody = body;
        try { if (bodyMO) bodyMO.disconnect(); } catch (e) { /* ignore */ }
        try {
            bodyMO = new MutationObserver(function () { ensureSoon(); });
            bodyMO.observe(body, { childList: true, subtree: true });
        } catch (e2) { bodyMO = null; }
    }

    /* 捕获阶段委托：菜单项被 React 换掉也不会丢点击。
       这里同步跑一次 ensure()，点击「版本号」的同一时刻就把大卡补上；
       若 React 尚未渲染出面板，随后的精确观察会接着补。 */
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var it = t.closest('[class*="modal-sidebar_item_"]');
        if (it) {
            replayAnimation();
            syncGlassPageClass();
            try { ensure(); watchBody(); } catch (err) { /* ignore */ }
        }
    }, true);

    /* 文档级观察保留：负责发现整个 body 被 React 换掉的情况（精确观察
       挂在旧 body 上收不到）。它走 B01 总线，冻结期可能被跳过，但点击
       补挂 + 精确观察 + 轮询三条通道已覆盖，不影响结果。 */
    if (window.MutationObserver) {
        var docPending = 0;
        var docMO = new MutationObserver(function () {
            if (docPending) return;
            docPending = window.setTimeout(function () { docPending = 0; ensureSoon(); }, 0);
        });
        try { docMO.observe(document.documentElement, { childList: true, subtree: true }); }
        catch (e) { /* ignore */ }
    }

    ensure();
    watchBody();
    /* 低频兜底：设置弹窗从隐藏到显示时不一定有 DOM 变动，也用来在
       body 被替换后重新 attach 精确观察。B01 会把 150–2500ms 的
       setInterval 抬到 >=500ms，这只做补齐。 */
    window.setInterval(function () {
        if (settingsBody()) { ensure(); watchBody(); }
    }, 700);
    if (window.__blSync) window.__blSync.register('B74-hero', ensure);
})();
