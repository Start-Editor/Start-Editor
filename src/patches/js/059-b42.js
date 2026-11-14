/* ── [B42] 弹窗外观运行时 ───────────────────────────────────────────────
   依赖：B41
   维护：圆角/阴影/透明度/预设的应用层
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * __blWinAppearanceRuntime —— 弹窗外观运行时应用
 * 读取 bl:win-appearance，把阴影/圆角/透明度/背景透明度下发到 .addon-window。
 * 玻璃（毛玻璃/液态玻璃）开启时：阴影并入玻璃的内描边与外阴影一起输出，
 * 圆角 / 透明度 / 背景透明度照常生效 —— 三者不再被玻璃状态整段吞掉。
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blWinAppearanceRuntime) return;
    var STYLE_ID = 'bl-win-appearance-style';

    function read() {
        try { return window.__blSettings ? window.__blSettings.get('winAppearance') : null; } catch (e) { return null; }
    }
    function glass() {
        try { return window.__blSettings ? window.__blSettings.isGlassEnabled() : false; } catch (e) { return false; }
    }
    function hexToRgb(hex) {
        hex = String(hex || '').replace('#', '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        var n = parseInt(hex, 16);
        if (isNaN(n)) return null;
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function rgba(hex, a) {
        var c = hexToRgb(hex) || { r: 255, g: 255, b: 255 };
        return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
    }

    function build() {
        var app = read() || {};
        var gl = glass();
        var css = '';

        /* ⚠ 阴影 / 圆角 / 透明度必须无条件下发。
           上一版为了「别盖掉玻璃」在 glass() 为真时整段跳过这三条，
           结果毛玻璃或液态玻璃一开，「弹窗外观」页三个滑杆全部失效 ——
           这正是「外观又失效了」的根因（玻璃默认开着，所以必现）。

           本表带 html:root 前缀（0,2,1 + !important），会压过两张玻璃表
           对 .addon-window 写的 box-shadow。因此玻璃开启时不再「让出」，
           而是把玻璃的内描边 / 底部暗边 / 基础外阴影并进同一条声明，
           再把外观滑杆的阴影追加在末尾 —— 两个效果同时可见、互不覆盖。

           ⚠ 刻意不写 inset 0 1px 0 顶部亮线：上一轮刚按需求把液态玻璃
           右上角的光影去掉，整条顶部亮线会让右上角重新发亮。
           整圈内描边属于玻璃轮廓，走 --bl-glass-line 跟随主题。 */
        var sh = Math.max(0, Math.min(40, app.shadow || 0));
        var amp = sh / 40;
        var appShadow =
            '0 ' + (2 + amp * 14).toFixed(1) + 'px ' +
            (6 + amp * 34).toFixed(1) + 'px rgba(0,0,0,' +
            (0.10 + amp * 0.16).toFixed(3) + '),' +
            '0 2px 8px rgba(0,0,0,' + (0.04 + amp * 0.06).toFixed(3) + ')';
        var glassEdge = gl
            ? 'inset 0 -1px 0 rgba(0,0,0,0.08),' +
              'inset 0 0 0 1px var(--bl-glass-line, rgba(255,255,255,0.16)),' +
              '0 2px 6px rgba(0,0,0,0.06),0 14px 34px rgba(0,0,0,0.14),'
            : '';
        css += '.addon-window{box-shadow:' + glassEdge + appShadow + ' !important;}';

        /* 圆角：玻璃表不写 border-radius，无冲突，始终生效 */
        var rd = Math.max(0, Math.min(28, app.radius || 0));
        css += '.addon-window{border-radius:' + rd + 'px !important;}';

        /* 弹窗透明度：玻璃表不写 opacity，无冲突，始终生效 */
        var op = Math.max(40, Math.min(100, app.opacity || 100));
        css += '.addon-window{opacity:' + (op / 100).toFixed(2) + ' !important;}';

        /* 背景透明度：::before 铺一层主题底色做遮罩。 */
        var bgOp = Math.max(0, Math.min(100, app.bgOpacity == null ? 100 : app.bgOpacity));
        css += '.addon-window{isolation:isolate;}';
        css += '.addon-window::before{content:"";position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:0;background:var(--ui-modal-background,#ffffff);opacity:' + (1 - bgOp / 100).toFixed(2) + ' !important;}';
        css += '.addon-window > *{position:relative;z-index:1;}';

        return css;
    }

    /* 把每条规则提到 html:root 下：特异性从 (0,2,0) 升到 (0,3,1)。
       以前靠「每 150ms 把 <style> 移到 head 末尾」压过原生 macos / 玻璃表，
       两张表互相踢 → 整份 CSSOM 反复重建，MAC 规则最多所以最卡。
       现在顺序不再决定胜负，<style> 只在内容真变化时才动一次。 */
    function boost(css) {
        return css.replace(/([^{}]+)\{/g, function (m, sel) {
            var parts = sel.split(',');
            for (var i = 0; i < parts.length; i++) {
                parts[i] = 'html:root ' + parts[i].trim();
            }
            return parts.join(',') + '{';
        });
    }

    function rawSig() {
        var a = '', b = '', c = '';
        try { a = localStorage.getItem('bl:win-appearance') || ''; } catch (e) {}
        try { b = localStorage.getItem('bl:frosted-glass') || ''; } catch (e) {}
        try { c = localStorage.getItem('bl:liquid-glass') || ''; } catch (e) {}
        return a + '|' + b + '|' + c;
    }

    function apply() {
        var el = document.getElementById(STYLE_ID);
        var css = boost(build());
        if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            document.head.appendChild(el);
        }
        if (el.textContent !== css) el.textContent = css;
        /* 归位不再只放在「内容变化」分支里：玻璃表运行中追加到 head 末尾时，
           本表内容没变也会被反盖（外观设置看起来「不及时/不生效」）。
           apply 只在签名变化时被调用，这里做一次幂等归位几乎零成本。 */
        try {
            if (el.parentNode && el.parentNode.lastChild !== el) el.parentNode.appendChild(el);
        } catch (e) { /* ignore */ }
    }

    /* 只比原始存储串：不解析 JSON、不做浅合并、不调 get()。
       没变化就直接 return —— 连 build() 和 qSA 都不跑。 */
    var lastKey = null;
    function tick(force) {
        var key = rawSig();
        if (!force && key === lastKey) {
            /* 表被外部脚本摘掉时自愈：一次 getElementById，不重建 CSSOM */
            if (!document.getElementById(STYLE_ID)) apply();
            return;
        }
        lastKey = key;
        apply();
    }
    function onChange() { tick(); }

    var WATCH_KEYS = {
        'bl:win-appearance': 1, 'bl:frosted-glass': 1, 'bl:liquid-glass': 1
    };
    window.addEventListener('storage', function (e) {
        if (e && WATCH_KEYS[e.key]) onChange();
    });
    /* 同页即时通道：localStorage.setItem 被 B55 hook 后立刻派发，
       不依赖 150ms 轮询，也不依赖 StorageEvent 能否跨 iframe 送达。 */
    window.addEventListener('bl:win-appearance-change', onChange);
    window.addEventListener('bl:glass-change', onChange);
    /* 低频兜底仅覆盖极端时序，带签名短路，静息时零 DOM 操作。 */
    setInterval(tick, 1500);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { tick(true); });
    else tick(true);

    window.__blWinAppearanceRuntime = { apply: apply, tick: tick };
})();
