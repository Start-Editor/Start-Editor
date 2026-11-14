/* ── [B64] 壁纸看护 + 失效置顶积木 ───────────────────────────────────────────────
   依赖：B38 / B41
   维护：壁纸闪烁修复、注册表过滤红色失效块
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * 壁纸看护 + 失效置顶积木兜底
 * ========================================================================== */
(function () {
    'use strict';
    if (window.__blRound10) return;
    window.__blRound10 = true;

    /* ---- 0. 稳定层叠：把覆盖层规则挂在 <head> 末尾并保持最后 ----
       运行时注入的样式表会排到静态 <style> 之后，同权重下后写的赢，
       所以必须动态创建、并在 head 变化时把它挪回最后。 */
    var STYLE_ID = 'bl-wallpaper-stable-style';
    var stableCss =
        'html.bl-wallpaper-on svg.blocklySvg {' +
        '  background-color: rgba(255,255,255, var(--wallpaper-overlay-opacity, 0.7)) !important;' +
        '}' +
        'html.bl-wallpaper-on .blocklyMainBackground {' +
        '  fill-opacity: var(--wallpaper-overlay-opacity, 0.7) !important;' +
        '}';
    function keepStyleLast() {
        var el = document.getElementById(STYLE_ID);
        if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            el.textContent = stableCss;
        }
        var head = document.head;
        if (head && head.lastChild !== el) head.appendChild(el);
    }
    keepStyleLast();
    if (document.head) {
        new MutationObserver(function () {
            if (keepStyleLast._raf) return;
            keepStyleLast._raf = requestAnimationFrame(function () {
                keepStyleLast._raf = 0; keepStyleLast();
            });
        }).observe(document.head, { childList: true });
    }

    /* ---- 0.5 addon 壁纸（.sa-background-image）：React 重绘把节点摘掉后
       立刻把原节点原样插回，不重播淡入动画，避免「闪一下消失」。 ---- */
    var addonRaf = 0, lastImg = null;
    function rememberAddon() {
        var img = document.querySelector('.sa-background-image');
        if (!img) return;
        lastImg = img;
    }
    function guardAddon() {
        if (addonRaf) return;
        addonRaf = requestAnimationFrame(function () {
            addonRaf = 0;
            var cur = document.querySelector('.sa-background-image');
            /* 正常的淡出→淡入切换在同一帧内会补上新节点，不干预 */
            if (cur) { rememberAddon(); return; }
            if (!lastImg) return;
            var w = document.querySelector('[class*="gui_blocks-wrapper"]');
            if (!w) return;
            /* 用户主动禁用时 addon 会写这个 CSS 变量，此时不恢复 */
            var v = document.documentElement.style.getPropertyValue('--enable-workspace-background');
            if (v && v.indexOf('transparent') < 0) return;
            try {
                if (!lastImg.parentNode) w.appendChild(lastImg);
                /* 淡出过程被中断留下的 opacity:0 要还原，否则就是「消失」 */
                if (lastImg.style.opacity === '0' || parseFloat(lastImg.style.opacity) < 0.05) {
                    lastImg.style.opacity = '1';
                }
            } catch (e) { /* ignore */ }
        });
    }
    function bindAddonGuard() {
        if (!document.body) { setTimeout(bindAddonGuard, 400); return; }
        if (document.body.__blAddonGuard) return;
        document.body.__blAddonGuard = true;
        rememberAddon();
        new MutationObserver(function () {
            var img = document.querySelector('.sa-background-image');
            if (img) lastImg = img; else guardAddon();
        }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) bindAddonGuard(); else document.addEventListener('DOMContentLoaded', bindAddonGuard);

    /* ---- 0.8 svg 覆盖层看护 ----
       主题模块会用 inline !important 把 svg.blocklySvg 刷成不透明白，
       CSS 规则压不住。这里监控 svg 的 style 变化，发现偏离立刻改回，
       同一帧内完成，肉眼看不到「闪一下」。 */
    function ensureOverlay() {
        var st = window.__blWallpaperState;
        var g = document.querySelector('svg.blocklySvg');
        if (!g || !st || !st.active) return;
        var want = 'rgba(255, 255, 255, ' + (1 - (st.opacity || .3)) + ')';
        if (g.style.getPropertyValue('background-color') !== want ||
            g.style.getPropertyPriority('background-color') !== 'important') {
            g.style.setProperty('background-color', want, 'important');
        }
    }
    function bindSvgGuard() {
        var g = document.querySelector('svg.blocklySvg');
        if (!g) { setTimeout(bindSvgGuard, 400); return; }
        if (g.__blWpSvgGuard) return;
        g.__blWpSvgGuard = true;
        var raf = 0;
        new MutationObserver(function () {
            if (raf) return;
            raf = requestAnimationFrame(function () { raf = 0; ensureOverlay(); });
        }).observe(g, { attributes: true, attributeFilter: ['style'] });
        ensureOverlay();
    }
    if (document.body) bindSvgGuard(); else document.addEventListener('DOMContentLoaded', bindSvgGuard);
    setInterval(ensureOverlay, 800);

    /* ---- 1. 壁纸：别的模块误清 backgroundImage 时立刻恢复 ---- */
    var guardRaf = 0;
    function guard() {
        if (guardRaf) return;
        guardRaf = requestAnimationFrame(function () {
            guardRaf = 0;
            var st = window.__blWallpaperState;
            var w = document.querySelector("[class*='blocks-wrapper_']");
            if (!st || !st.active || !w) return;
            if (st.kind === 'video') {
                if (!w.querySelector('.bl-wallpaper-video') && typeof window.__blWallpaperReapply === 'function') {
                    window.__blWallpaperReapply();
                }
            } else if (st.bg && !w.style.backgroundImage) {
                w.style.backgroundImage = st.bg;
                w.style.backgroundSize = 'cover';
                w.style.backgroundPosition = 'center';
                w.style.backgroundRepeat = 'no-repeat';
            }
        });
    }
    function bindGuard() {
        var w = document.querySelector("[class*='blocks-wrapper_']");
        if (!w) { setTimeout(bindGuard, 400); return; }
        if (w.__blWpGuard) return;
        w.__blWpGuard = true;
        new MutationObserver(guard).observe(w, { attributes: true, attributeFilter: ['style'], childList: true });
    }
    if (document.body) bindGuard(); else document.addEventListener('DOMContentLoaded', bindGuard);

    /* ---- 2. 置顶分类里的红色失效积木：直接隐藏 ---- */
    function sweepRed() {
        try {
            var fl = document.querySelector('.blocklyFlyout');
            if (!fl) return;
            var gs = fl.querySelectorAll('g.blocklyDraggable');
            for (var i = 0; i < gs.length; i++) {
                var g = gs[i];
                var p = g.querySelector('path.blocklyPath');
                if (!p) continue;
                var fill = String(p.getAttribute('fill') || '').toUpperCase();
                if (fill.indexOf('#FF0000') < 0) continue;
                /* 只处理顶层积木，别把正常积木内部的子块误判 */
                var par = g.parentNode;
                if (par && par.closest && par.closest('g.blocklyDraggable')) continue;
                g.classList.add('bl-invalid-pin');
            }
        } catch (e) { /* ignore */ }
    }
    var sweepRaf = 0;
    function scheduleSweep() {
        if (sweepRaf) return;
        sweepRaf = requestAnimationFrame(function () { sweepRaf = 0; sweepRed(); });
    }
    function bindSweep() {
        if (!document.body) { setTimeout(bindSweep, 400); return; }
        if (document.body.__blPinSweep) return;
        document.body.__blPinSweep = true;
        new MutationObserver(scheduleSweep).observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) bindSweep(); else document.addEventListener('DOMContentLoaded', bindSweep);
})();
