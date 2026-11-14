/* ── [B34] 液态玻璃 ───────────────────────────────────────────────
   依赖：B41 / B29
   维护：开关只在「玻璃效果」页；与 B55 的即时生效链路配套
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
 * 液态玻璃（Liquid Glass）
 * --------------------------------------------------------------------------
 * 把毛玻璃那层"平铺的模糊"换成真正带折射的玻璃：边缘按曲面法线偏折背后的
 * 画面，并叠一层镜面高光，观感接近 iOS 26 的液态玻璃。
 *
 * 算法取自 Scratch 的液态玻璃扩展（放大镜版），改为作用在界面浮层上：
 *   1) 一维折射表   —— 由玻璃厚度 / 边框宽度 / 折射率 / 边框曲面算出
 *   2) 二维位移贴图 —— 只在圆角边框环带内写值，中心保持中性(128,128)
 *   3) 镜面高光层   —— 沿给定光照角在环带内生成亮度
 *   4) 放大位移贴图 —— 由中心向外的径向位移，制造凸透镜的放大
 * 四者拼成一个 SVG filter，用 backdrop-filter: url(#id) 挂到元素上。
 *
 * ⚠ 两个必须这么写的地方（都是踩过坑才确定的）：
 *
 * 一、贴图分辨率必须降采样。
 *     第一版按元素原尺寸生成位移贴图，880×560 的窗口要编码三张 PNG dataURL，
 *     首帧解码就把主线程卡住，拖动窗口时帧率掉到个位数。位移场本身是平滑的，
 *     所以改成按最长边 256 生成、再由 feImage 拉伸回元素尺寸 —— 观感不变，
 *     dataURL 体积降到约 1/12。
 *
 * 二、feImage 必须和元素边界框对齐。
 *     filter 默认 region 是 objectBoundingBox 的 -10%..120%，
 *     feImage 的 x/y 又是相对这个 region 的。直接写 x="0" 会把贴图挪到
 *     元素左上角之外 10% 处，折射环带和元素的圆角完全错位。
 *     元素在 region 里的相对位置：起点 0.1/1.2 = 8.333%，尺寸 1/1.2 = 83.333%。
 *     用这两组百分比才能对齐。
 *
 * 位移量按元素尺寸取比例，而不是写死像素：原版是 120px 的小控件，
 * 写死的 scale 挪到几百像素的窗口上等于没有效果。
 * ========================================================================== */

window.__blLiquidGlass = (function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var STORE = 'bl:liquid-glass';
    var STYLE_ID = 'bl-liquid-glass-style';
    var SVG_ID = 'bl-liquid-glass-filters';

    /* 贴图最长边上限。见文件头说明一。 */
    var MAP_MAX = 256;
    /* 互锁：两种玻璃效果同一时刻只能开一个。
       液态玻璃自带模糊与底色，不需要毛玻璃垫底，可以独立生效。 */
    var FROST_STORE = 'bl:frosted-glass';
    /* 同时生效的浮层上限：backdrop-filter 带位移的代价与面积成正比，
       开太多窗口会拖垮帧率，所以只给面积最小的若干个上滤镜。
       ⚠ 截断必须是稳定的：一旦超过上限就变成"页面上一部分有液态、一部分没有"，
       观感上就是玻璃效果残缺。所以上限放宽到日常根本用不满的量，
       真的超了时，放弃的也是面积最大（最不显眼）的那几个。 */
    var MAX_TARGETS = 24;
    /* 单元素面积上限（px²）。超过这个尺寸的大窗口不再上液态。 */
    var MAX_AREA = 1400000;

    var Surface = {
        convex: function (x) { return Math.sqrt(Math.max(0, 1 - (1 - x) * (1 - x))); }
    };

    function defaults() {
        return { enabled: false, refraction: 55, magnify: 30, blur: 6 };
    }

    function clamp(v, lo, hi, fb) {
        v = Number(v);
        if (!isFinite(v)) return fb;
        return v < lo ? lo : (v > hi ? hi : v);
    }

    function read() {
        var d = defaults();
        try {
            var raw = window.localStorage.getItem(STORE);
            if (!raw) return d;
            var o = JSON.parse(raw);
            if (!o || typeof o !== 'object') return d;
            return {
                enabled: !!o.enabled,
                refraction: clamp(o.refraction, 0, 100, d.refraction),
                magnify: clamp(o.magnify, 0, 100, d.magnify),
                blur: clamp(o.blur, 0, 24, d.blur)
            };
        } catch (e) { return d; }
    }

    function write(cfg) {
        try { window.localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
        emitGlass();
    }

    /* 合并派发：同一轮同步代码里可能连写两次（先写液态、再关毛玻璃），
       用 setTimeout(0) 攒成一次，监听方读到的永远是最终状态，
       不会把刚打开的玻璃按中间态回退掉。 */
    var glassEmitPending = false;
    function emitGlass() {
        /* 优先走 B55 的全局出口：它和 localStorage.setItem hook 共用同一个
           pending，因此「设置页写毛玻璃」「液态 UI 写配置」「互斥裁决写回」
           三条路径在同一轮里也只派发一次，监听方永远读到最终态。 */
        if (window.__blGlassEmit) {
            try { window.__blGlassEmit(); return; } catch (e0) { /* 落到兜底 */ }
        }
        if (glassEmitPending) return;
        glassEmitPending = true;
        try {
            window.setTimeout(function () {
                glassEmitPending = false;
                try {
                    if (typeof CustomEvent === 'function') {
                        window.dispatchEvent(new CustomEvent('bl:glass-change'));
                    } else {
                        var ev = document.createEvent('Event');
                        ev.initEvent('bl:glass-change', false, false);
                        window.dispatchEvent(ev);
                    }
                } catch (e) { /* ignore */ }
            }, 0);
        } catch (e2) { glassEmitPending = false; }
    }

    var cfg = read();
    var DEFAULTS = defaults();

    /* ---------------- 算法：一维折射表 ---------------- */
    function displacement1D(thickness, bezel, fn, refractiveIndex, samples) {
        var eta = 1 / refractiveIndex;
        var out = [];
        for (var i = 0; i < samples; i++) {
            var x = i / samples;
            var y = fn(x);
            var dx = x < 1 ? 0.0001 : -0.0001;
            var derivative = (fn(x + dx) - y) / dx;
            var magnitude = Math.sqrt(derivative * derivative + 1);
            var nx = -derivative / magnitude;
            var ny = -1 / magnitude;
            var k = 1 - eta * eta * (1 - ny * ny);
            if (k < 0) { out.push(0); continue; }
            var ks = Math.sqrt(k);
            var ry = eta - (eta * ny + ks) * ny;
            if (ry === 0) { out.push(0); continue; }
            out.push((-(eta * ny + ks) * nx) * ((y * bezel + thickness) / ry));
        }
        return out;
    }

    function makeImageData(w, h) {
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        return c.getContext('2d').createImageData(w, h);
    }

    function toUrl(img) {
        var c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d').putImageData(img, 0, 0);
        return c.toDataURL('image/png');
    }

    /* ---------------- 距离场：圆角矩形 ----------------
       ⚠ 原版只处理四个"角方块"（x<r 或 x>w-r  且  y<r 或 y>h-r），
       对放大镜那种 r=size/2 的圆形控件来说等价于全覆盖，
       但挪到几百像素的窗口上就只剩四个角有折射 —— 这正是
       "边缘仍然没有液态玻璃"的根因。
       所以这里改用圆角矩形的带符号距离场，整条周长（含直边）都参与。 */
    function sdRoundRect(vx, vy, hw, hh, r) {
        var qx = Math.abs(vx) - hw + r;
        var qy = Math.abs(vy) - hh + r;
        var mx = qx > 0 ? qx : 0;
        var my = qy > 0 ? qy : 0;
        var outside = Math.sqrt(mx * mx + my * my);
        var inside = Math.min(Math.max(qx, qy), 0);
        return inside + outside - r;   /* <0 在内部，0 在边界 */
    }

    /* 返回该点的外法线（单位向量）与到边界的距离 */
    function roundRectNormal(vx, vy, hw, hh, r, out) {
        var qx = Math.abs(vx) - hw + r;
        var qy = Math.abs(vy) - hh + r;
        if (qx > 0 || qy > 0) {
            /* 圆角弧区：法线由圆心指向该点 */
            var ax = qx > 0 ? qx : 0;
            var ay = qy > 0 ? qy : 0;
            var len = Math.sqrt(ax * ax + ay * ay) || 1;
            out.x = (ax / len) * (vx < 0 ? -1 : 1);
            out.y = (ay / len) * (vy < 0 ? -1 : 1);
        } else {
            /* 直边区：法线走离得更近的那条边 */
            if (qx > qy) { out.x = vx < 0 ? -1 : 1; out.y = 0; }
            else { out.x = 0; out.y = vy < 0 ? -1 : 1; }
        }
    }

    /* ---------------- 算法：二维位移贴图（整圈边缘环带） ---------------- */
    function displacement2D(w, h, radius, bezel, map1D, maxDisp) {
        var img = makeImageData(w, h);
        new Uint32Array(img.data.buffer).fill(0xff008080);   /* 中性：不透明、RG 各 128 */
        var hw = w / 2, hh = h / 2;
        var n = { x: 0, y: 0 };
        /* 采样步长：贴图会被拉伸回元素尺寸，逐像素与步进采样无肉眼差别 */
        var step = Math.max(1, Math.floor(Math.min(w, h) / 220));
        for (var y = 0; y < h; y += step) {
            var vy = y - hh;
            for (var x = 0; x < w; x += step) {
                var vx = x - hw;
                var d = sdRoundRect(vx, vy, hw, hh, radius);
                if (d > 0) continue;                 /* 在元素外 */
                var side = -d;
                if (side > bezel) continue;          /* 离边太远，属于中心区 */
                roundRectNormal(vx, vy, hw, hh, radius, n);
                var bi = Math.min(map1D.length - 1, Math.max(0, ((side / bezel) * map1D.length) | 0));
                var dist = map1D[bi] || 0;
                var opacity = Math.max(0, Math.min(1, side));  /* 最外 1px 淡出，避免硬边 */
                for (var sy = 0; sy < step && y + sy < h; sy++) {
                    for (var sx = 0; sx < step && x + sx < w; sx++) {
                        var idx = ((y + sy) * w + (x + sx)) * 4;
                        img.data[idx] = 128 + ((-n.x * dist) / maxDisp) * 127 * opacity;
                        img.data[idx + 1] = 128 + ((-n.y * dist) / maxDisp) * 127 * opacity;
                    }
                }
            }
        }
        return img;
    }
    /* ---------------- 算法：镜面高光（整圈边缘环带） ---------------- */
    function specularLayer(w, h, radius, bezel, angle) {
        var img = makeImageData(w, h);
        new Uint32Array(img.data.buffer).fill(0x00000000);
        var vx0 = Math.cos(angle), vy0 = Math.sin(angle);
        var hw = w / 2, hh = h / 2;
        var n = { x: 0, y: 0 };
        var step = Math.max(1, Math.floor(Math.min(w, h) / 220));
        for (var y = 0; y < h; y += step) {
            var vy = y - hh;
            for (var x = 0; x < w; x += step) {
                var vx = x - hw;
                var d = sdRoundRect(vx, vy, hw, hh, radius);
                if (d > 0) continue;
                var side = -d;
                if (side > bezel) continue;
                roundRectNormal(vx, vy, hw, hh, radius, n);
                /* 与光照方向的贴合度决定亮度；越靠外越亮 */
                var dot = Math.abs(n.x * vx0 + n.y * vy0);
                var t = Math.max(0, Math.min(1, 1 - side / bezel));
                var coef = dot * Math.sqrt(Math.max(0, 1 - t * t));
                var color = 255 * coef;
                var alpha = color * coef * Math.max(0, Math.min(1, side));
                /* 右上角不做镜面高光：abs(dot) 原本让上边缘整段发亮，
                   在右上角叠出一条多余的亮边。用象限平滑权重把这一角
                   衰减到 0，左上 / 右下 / 左下三边与圆角过渡不受影响。 */
                var trX = Math.max(0, Math.min(1, (vx / hw - 0.04) / 0.58));
                var trY = Math.max(0, Math.min(1, (-vy / hh - 0.04) / 0.58));
                alpha *= 1 - trX * trY;
                for (var sy = 0; sy < step && y + sy < h; sy++) {
                    for (var sx = 0; sx < step && x + sx < w; sx++) {
                        var idx = ((y + sy) * w + (x + sx)) * 4;
                        img.data[idx] = color;
                        img.data[idx + 1] = color;
                        img.data[idx + 2] = color;
                        img.data[idx + 3] = alpha;
                    }
                }
            }
        }
        return img;
    }
    /* ---------------- 算法：放大（由中心向外的径向位移） ---------------- */
    function magnifyMap(w, h) {
        var img = makeImageData(w, h);
        var ratio = Math.max(w / 2, h / 2) || 1;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var idx = (y * w + x) * 4;
                img.data[idx] = 128 - ((x - w / 2) / ratio) * 127;
                img.data[idx + 1] = 128 - ((y - h / 2) / ratio) * 127;
                img.data[idx + 2] = 0;
                img.data[idx + 3] = 255;
            }
        }
        return img;
    }

    /* ---------------- 滤镜管理 ---------------- */
    var built = Object.create(null);

    function svgHost() {
        var s = document.getElementById(SVG_ID);
        if (!s) {
            s = document.createElementNS(SVG_NS, 'svg');
            s.id = SVG_ID;
            s.setAttribute('aria-hidden', 'true');
            s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
            (document.body || document.documentElement).appendChild(s);
        }
        return s;
    }

    function clearFilters() {
        var s = document.getElementById(SVG_ID);
        if (s && s.parentNode) s.parentNode.removeChild(s);
        built = Object.create(null);
    }

    /* 贴图尺寸：把元素等比压到最长边 MAP_MAX，再由 feImage 拉回去 */
    function mapSize(w, h) {
        var m = Math.max(w, h);
        if (m <= MAP_MAX) return { w: w, h: h, sx: 1 };
        var s = MAP_MAX / m;
        return { w: Math.max(8, Math.round(w * s)), h: Math.max(8, Math.round(h * s)), sx: s };
    }

    function buildFilter(key, w, h, c, ownBlurPx) {
        var id = 'bl-lg-' + key;
        if (document.getElementById(id)) return id;

        var msz = mapSize(w, h);
        var mw = msz.w, mh = msz.h;
        var k = msz.sx;

        var base = Math.min(w, h);
        /* 位移量按元素尺寸取比例：小控件和大窗口要有相近的观感强度 */
        var refractScale = base * 0.18 * (c.refraction / 100);
        var magScale = base * 0.20 * (c.magnify / 100);
        /* 元素本来的模糊要保住（DOCK 自带 18px），取较大者，别越开越清晰。
           作用在降采样后的坐标上，所以同步缩放。 */
        var blur = Math.max(c.blur, ownBlurPx || 0) * k;

        var radius = Math.max(8, Math.min(28, base * 0.14)) * k;
        var bezel = Math.max(6, Math.min(46, base * 0.09)) * k;
        var thickness = Math.max(40, Math.min(240, base * 0.35)) * k;

        var map1D = displacement1D(thickness, bezel, Surface.convex, 1.5, 96);
        var maxDisp = 0;
        for (var i = 0; i < map1D.length; i++) {
            var a = Math.abs(map1D[i]);
            if (a > maxDisp) maxDisp = a;
        }
        if (maxDisp <= 0) maxDisp = 1;

        /* 放大与折射合进同一张贴图：两者都是位移，只是系数不同，
           按总幅度归一化后一次 feDisplacementMap 就能还原。
           少一张 feImage + 一遍重采样，是拖动时最大的一笔开销。 */
        var magMap = magScale > 0.5 ? magnifyMap(mw, mh) : null;
        var dispMap = refractScale > 0.5 ? displacement2D(mw, mh, radius, bezel, map1D, maxDisp) : null;
        var total = refractScale + magScale;
        var combined = null;
        if (magMap && dispMap) {
            for (var q = 0; q < magMap.data.length; q += 4) {
                var mx = (magMap.data[q] - 128) / 127 * magScale;
                var my = (magMap.data[q + 1] - 128) / 127 * magScale;
                var dx = (dispMap.data[q] - 128) / 127 * refractScale;
                var dy = (dispMap.data[q + 1] - 128) / 127 * refractScale;
                magMap.data[q] = 128 + ((mx + dx) / total) * 127;
                magMap.data[q + 1] = 128 + ((my + dy) / total) * 127;
            }
            combined = magMap;
        } else {
            combined = dispMap || magMap;
            total = dispMap ? refractScale : magScale;
        }

        var specUrl = toUrl(specularLayer(mw, mh, radius, bezel, Math.PI / 3));

        /* 滤镜区域必须比元素大一圈。
           默认是 -10%..120%，而位移会把元素外的像素拉进来；
           区域不够就会在四周留下一圈没被折射的死边（甚至发黑），
           这正是"边缘仍然没有液态玻璃"的第二个来源。
           这里按最大位移量动态外扩，位移越大外扩越多。 */
        var pad = Math.min(0.35, Math.max(0.10,
            (refractScale + magScale) / Math.max(1, Math.min(w, h)) + 0.06));
        var rx = (-pad * 100).toFixed(3) + '%';
        var rw = ((1 + pad * 2) * 100).toFixed(3) + '%';
        /* 元素在滤镜区域里的相对位置 —— 见文件头说明二 */
        var px = ((pad / (1 + pad * 2)) * 100).toFixed(3) + '%';
        var pw = ((1 / (1 + pad * 2)) * 100).toFixed(3) + '%';

        var f = document.createElementNS(SVG_NS, 'filter');
        f.id = id;
        f.setAttribute('color-interpolation-filters', 'sRGB');
        f.setAttribute('filterUnits', 'objectBoundingBox');
        f.setAttribute('x', rx); f.setAttribute('y', rx);
        f.setAttribute('width', rw); f.setAttribute('height', rw);

        var html = '';
        var src = 'SourceGraphic';
        if (blur > 0.2) {
            html += '<feGaussianBlur in="' + src + '" stdDeviation="' + blur.toFixed(2) +
                '" result="bl_blur"/>';
            src = 'bl_blur';
        }
        if (combined && total > 0.5) {
            /* preserveAspectRatio=none：feImage 默认 xMidYMid meet 会把按
               bucket 尺寸生成的贴图等比居中，元素真实宽高比一旦与 bucket
               不同就会留白，镜面高光环带与折射图整体偏离窗口边界 ——
               这正是「有的弹窗玻璃图层偏移」的根因。强制拉伸到边界框。 */
            html += '<feImage href="' + toUrl(combined) + '" x="' + px + '" y="' + px +
                '" width="' + pw + '" height="' + pw +
                '" preserveAspectRatio="none" result="bl_disp"/>';
            html += '<feDisplacementMap in="' + src + '" in2="bl_disp" scale="' +
                total.toFixed(2) +
                '" xChannelSelector="R" yChannelSelector="G" result="bl_dispd"/>';
            src = 'bl_dispd';
        }
        html += '<feColorMatrix in="' + src + '" type="saturate" values="1.35" result="bl_sat"/>';
        html += '<feImage href="' + specUrl + '" x="' + px + '" y="' + px +
            '" width="' + pw + '" height="' + pw +
            '" preserveAspectRatio="none" result="bl_spec"/>';
        html += '<feComposite in="bl_sat" in2="bl_spec" operator="in" result="bl_sc"/>';
        html += '<feComponentTransfer in="bl_spec" result="bl_sf">' +
            '<feFuncA type="linear" slope="0.72"/></feComponentTransfer>';
        html += '<feBlend in="bl_sc" in2="' + src + '" mode="normal" result="bl_ws"/>';
        html += '<feBlend in="bl_sf" in2="bl_ws" mode="normal"/>';

        f.innerHTML = html;
        svgHost().appendChild(f);
        built[key] = true;
        return id;
    }

    /* ---------------- 玻璃载体识别 ----------------
       ⚠ 这是"一半有液态、一半没有"的主因。

       滤镜必须挂在那个真正"长得像玻璃"的元素上 —— 有背景、有圆角、
       有（或本该有）毛玻璃的那个。选择器命中的往往只是外层容器：
       比如 .bl-dock 是 152x78 的定位容器（含感应区 padding 与放大余量），
       而真正可见的圆角玻璃是它里面偏下的 .bl-dock-inner（约 112x58）。
       把滤镜挂在 .bl-dock 上，位移环带就画在了可见玻璃之外，
       可见部分落在贴图的中性区 —— 于是看着"玻璃还在，但完全没有折射"。

       所以这里向内找真正的载体：优先元素自己，否则取最浅的那个
       满足"有 backdrop-filter，或有半透明背景 + 圆角"的后代。 */
    function alphaOf(color) {
        var m = /rgba?\(([^)]+)\)/.exec(String(color || ''));
        if (!m) return 0;
        var a = m[1].split(',');
        if (a.length < 4) return String(color).indexOf('rgba') < 0 ? 1 : 0;
        var v = parseFloat(a[3]);
        return isFinite(v) ? v : 0;
    }

    function isGlassLike(el) {
        if (!el || !el.getBoundingClientRect) return false;
        var cs;
        try { cs = getComputedStyle(el); } catch (e) { return false; }
        if (cs.backdropFilter && cs.backdropFilter !== 'none') return true;
        var a = alphaOf(cs.backgroundColor);
        if (a <= 0.02) return false;
        var r = parseFloat(cs.borderTopLeftRadius);
        return isFinite(r) && r >= 4;
    }

    /* 读取元素原有的模糊量：替换成液态滤镜后不能反而变清晰。
       两个来源都要看：
         · 毛玻璃的 blurRadius —— 从配置读，不能靠 computed style，
           因为上一轮 paint() 已经把 backdrop-filter 写成了 url(...)，
           computed 里再也读不到 blur，第二次刷新就会把毛玻璃的模糊弄丢。
         · 元素 CSS 自带的 blur（比如 DOCK 的 18px）。 */
    function frostBlur() {
        try {
            var raw = window.localStorage.getItem(FROST_STORE);
            if (!raw) return 0;
            var o = JSON.parse(raw);
            if (!o || !o.enabled) return 0;
            return (typeof o.blurRadius === 'number') ? o.blurRadius : 12;
        } catch (e) { return 0; }
    }

    function ownBlur(el) {
        var v = 0;
        try {
            var cs = getComputedStyle(el).backdropFilter || '';
            var m = /blur\(\s*([\d.]+)px/.exec(cs);
            if (m) v = parseFloat(m[1]);
        } catch (e) { /* ignore */ }
        return Math.max(v, frostBlur());
    }

    function glassCarrier(el) {
        /* DOCK 家族绝不作为玻璃载体：它的玻璃在 ::before 上。 */
        if (el && el.getAttribute && el.getAttribute('data-bl-lg-skip')) return null;
        if (el && el.classList && /(^|\s)bl-dock/.test(String(el.className || ''))) return null;
        if (isGlassLike(el)) return el;
        var level = [el];
        for (var d = 0; d < 3; d++) {
            var next = [];
            for (var i = 0; i < level.length; i++) {
                var ch = level[i].children;
                for (var j = 0; j < ch.length; j++) {
                    /* 被保护的浮层（DOCK 悬浮名称）不许当玻璃载体：
                       继续找别的载体，找不到就回退到 el 自身 ——
                       这样既保住 DOCK 玻璃条，又不会把 tip 改浅。 */
                    if (isGlassLike(ch[j]) &&
                        !(ch[j].getAttribute && ch[j].getAttribute('data-bl-lg-skip'))) return ch[j];
                    next.push(ch[j]);
                }
            }
            if (!next.length) break;
            level = next;
        }
        return el;
    }

    /* ---------------- 作用目标 ---------------- *
     * 注意：编辑器自己的对话框（ReactModal 那一套）不在这份名单里。
     * 它们由编辑器自带的毛玻璃插件负责，我们只管自己新加的浮层。
     * 之前名单里有 [class*="modal-content"]，把原生的"扩展权限询问"
     * 之类对话框也拉了进来 —— 一旦给它们打上 data-bl-lg，
     * 那条 0.2 透明度的底色规则就会把不透明的对话框变成几乎全透明，
     * 深色文字压在深色背景上，看上去就像"窗口凭空消失了"。 */
    var SELECTORS = [
        '.addon-window',
        '[class*="menu_menu"]',
        '[class*="context-menu_menu"]',
        '.blocklyContextMenu',
        '.goog-menu',
        '.bl-search-box',
        '.tw-panel',
        '.bl-snap',
        /* ⚠ 不要把 .bl-dock / .bl-dock-inner 列进目标：
           它们是纯定位容器，真正的玻璃层是 .bl-dock-inner::before
           （伪元素，glassCarrier 在 DOM children 里找不到），
           旧版回退到 el 自身 → 整块容器被染成第二层矩形。
           ::before 由补充样式表直接接管，不需要在这里注册。 */
        '[class*="modal_modal-content"]',
        '[class*="modal-window"]'
    ];

    /* 编辑器自己的对话框：ReactModal 那套结构。
       识别出来后一律不碰 —— 它们的配色归编辑器管，
       我们一插手（尤其是那条 0.2 透明底色）就会把内容弄没。 */
    function isNativeDialog(el) {
        if (!el || !el.classList) return false;
        var cl = String(el.className || '');
        /* 自建窗口（addon-window）优先按自建浮层处理，不判为原生对话框。
           否则「高级设置」这类窗口会因 class 里带了 modal-window 而被误判，
           走 0.82 的保守底，内容区几乎不透光、只剩标题栏有玻璃。 */
        if (cl.indexOf('addon-window') >= 0) return false;
        if (el.id === 'securitymanagermodal') return true;
        if (/(^|\s)modal-window(\s|$)/.test(cl)) return true;
        if (cl.indexOf('modal_modal-content') >= 0) return true;
        if (cl.indexOf('modal-window-content') >= 0) return true;
        try {
            if (el.closest && el.closest('[class*="ReactModal"]')) return true;
        } catch (e) { /* ignore */ }
        return false;
    }

    function targets() {
        var raw = [];
        var seen = [];
        for (var s = 0; s < SELECTORS.length; s++) {
            var nodes = document.querySelectorAll(SELECTORS[s]);
            for (var i = 0; i < nodes.length; i++) {
                var el = nodes[i];
                if (!el || !el.getBoundingClientRect) continue;
                if (el.className && String(el.className).indexOf('menu-item') >= 0) continue;
                if (el.getAttribute && el.getAttribute('data-bl-lg-skip')) continue;

                /* 先解析出真正的玻璃载体，再按载体去重 */
                var host = glassCarrier(el);
                if (!host) continue;
                if (host.getAttribute && host.getAttribute('data-bl-lg-skip')) continue;
                /* 兜底：任何情况下都别给 DOCK 定位容器打标记 */
                if (host.classList && /(^|\s)bl-dock/.test(String(host.className || ''))) continue;
                var native = isNativeDialog(host);

                var dup = false;
                for (var j = 0; j < seen.length; j++) {
                    if (seen[j] === host || seen[j].contains(host)) { dup = true; break; }
                    /* 已收录的容器包着本次载体 —— 以更具体的为准 */
                    if (host.contains(seen[j])) { seen[j] = host; raw[j].el = host; dup = true; break; }
                }
                if (dup) continue;

                var r = host.getBoundingClientRect();
                if (r.width < 40 || r.height < 24) continue;
                if (r.width > 2400 || r.height > 1600) continue;
                seen.push(host);
                raw.push({ el: host, w: Math.round(r.width), h: Math.round(r.height), native: native });
            }
        }
        /* 面积升序：真要截断时，放弃的是面积最大、最不显眼的那个 */
        raw.sort(function (a, b) { return (a.w * a.h) - (b.w * b.h); });
        var out = [];
        for (var n = 0; n < raw.length && out.length < MAX_TARGETS; n++) {
            if (raw[n].w * raw[n].h > MAX_AREA) break;
            out.push(raw[n]);
        }
        return out;
    }

    function bucket(v) { return Math.max(16, Math.round(v / 16) * 16); }

    /* 曾经做过"拖动/滚动时降级成普通模糊"的优化，但用户看到的是
       "一拖窗口玻璃就变回毛玻璃"，观感割裂，所以整个降级机制去掉了 ——
       液态玻璃在任何时候都保持液态。拖动开销改从滤镜本身省：
       见 buildFilter 里的贴图合并。

       必须 important：毛玻璃主题与窗口皮肤给 backdrop-filter 都加了
       important，普通内联样式压不过。 */
    function paint(el, key) {
        var v = 'url(#bl-lg-' + key + ')';
        /* 值没变就别写：每 260ms 一次的全量刷新若都重新赋值，
           会白白触发样式重算。 */
        if (el.style.getPropertyValue('backdrop-filter') === v) return;
        el.style.setProperty('backdrop-filter', v, 'important');
        el.style.setProperty('-webkit-backdrop-filter', v, 'important');
    }

    /* ---------------------------------------------------------------- *
     * 让玻璃铺满整个弹窗
     *
     * backdrop-filter 画在窗口根上，但窗口里那些不透明的分区会把玻璃整片盖住
     * —— 实测弹窗里的内容区常常是一整块实色，几乎等于整个窗口内部，
     * 于是只在边框留下一圈玻璃，看着像"液态玻璃没覆盖全"。
     *
     * 所以逐个把不透明后代改成"同色 + 半透明"：保留原来的色相和明暗，
     * 只是让它透出底下的玻璃，文字对比度基本不变。
     * ---------------------------------------------------------------- */
    var SOFT_SKIP = { INPUT: 1, TEXTAREA: 1, SELECT: 1, BUTTON: 1, IMG: 1,
                      SVG: 1, CANVAS: 1, VIDEO: 1, OPTION: 1 };

    function rgbOf(color) {
        var m = /rgba?\(([^)]+)\)/.exec(String(color || ''));
        if (!m) return null;
        var v = m[1].split(',');
        if (v.length < 3) return null;
        return v[0].trim() + ', ' + v[1].trim() + ', ' + v[2].trim();
    }

    function soften(host) {
        if (!host || !host.querySelectorAll) return;
        /* 暗色主题下，某些分区（如设置窗口的内容区 box_box_2jjDp）的背景是
           写死的浅色，不跟随主题，切到暗色后仍是刺眼的白。
           soften 原本是"同色压半透明"，遇到这种"不跟随主题的浅色"，
           在暗色下要主动换成暗色半透明底，否则内容区会一直白着。 */
        var dark = isDarkTheme();
        var nodes = host.querySelectorAll('*');
        var n = Math.min(nodes.length, 300);
        for (var i = 0; i < n; i++) {
            var e = nodes[i];
            if (e.getAttribute('data-bl-lg-soft')) continue;
            /* 受保护浮层（DOCK 悬浮名称）不许被压成半透明：
               soften 写的是 inline !important，会压过样式表里的 !important，
               一旦命中就又变成「没背景 + 黑字」。 */
            if (e.getAttribute('data-bl-lg-skip') || e.getAttribute('data-bl-fc-skip')) continue;
            if (SOFT_SKIP[e.tagName]) continue;
            var cs;
            try { cs = getComputedStyle(e); } catch (err) { continue; }
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            if (cs.backgroundImage && cs.backgroundImage !== 'none') continue;
            if (alphaOf(cs.backgroundColor) < 0.9) continue;
            var r = e.getBoundingClientRect();
            if (r.width * r.height < 2500) continue;
            var rgb = rgbOf(cs.backgroundColor);
            if (!rgb) continue;
            if (dark) {
                /* 亮度 > 128 视为浅色：暗色主题下压成暗底，避免内容区发白 */
                var p = rgb.split(',');
                var lum = 0.2126 * (+p[0]) + 0.7152 * (+p[1]) + 0.0722 * (+p[2]);
                if (lum > 128) rgb = '17, 17, 17';
            }
            e.setAttribute('data-bl-lg-soft', cs.backgroundColor);
            e.style.setProperty('background-color', 'rgba(' + rgb + ', 0.55)', 'important');
        }
    }

    function unsoften() {
        var nodes = document.querySelectorAll('[data-bl-lg-soft]');
        for (var i = 0; i < nodes.length; i++) {
            var e = nodes[i];
            var old = e.getAttribute('data-bl-lg-soft');
            e.removeAttribute('data-bl-lg-soft');
            if (old && old !== 'rgba(0, 0, 0, 0)') {
                e.style.setProperty('background-color', old, 'important');
            } else {
                e.style.removeProperty('background-color');
            }
        }
    }

    /* 主题切换时的专用清理：soften 缓存里存的是"切换前主题"的颜色，
       直接 unsoften() 会把元素恢复成旧主题色（亮色），压在新暗色主题上
       就成了"内容区一片白、只有标题栏跟随暗色"的 BUG。
       所以这里只清标记 + 移除内联覆盖，让元素回到编辑器当前主题 CSS 的
       自然颜色，再由下一轮 soften() 按新主题重新取色压半透明。 */
    function clearSoft() {
        var nodes = document.querySelectorAll('[data-bl-lg-soft]');
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].removeAttribute('data-bl-lg-soft');
            nodes[i].style.removeProperty('background-color');
        }
    }

    function repaintAll() {
        var nodes = document.querySelectorAll('[data-bl-lg]');
        for (var i = 0; i < nodes.length; i++) {
            paint(nodes[i], nodes[i].getAttribute('data-bl-lg'));
        }
    }

    function apply() {
        var list = targets();
        var keep = Object.create(null);
        for (var i = 0; i < list.length; i++) {
            var el = list[i].el;
            var bw = bucket(list[i].w), bh = bucket(list[i].h);
            /* 元素原有的模糊量也算进 key：换成液态滤镜后不能反而变清晰 */
            var ob = Math.round(ownBlur(list[i].el));
            var key = bw + 'x' + bh + '-' + Math.round(cfg.refraction) + '-' +
                Math.round(cfg.magnify) + '-' + Math.round(cfg.blur) + '-' + ob;
            var id = null;
            try { id = buildFilter(key, bw, bh, cfg, ob); } catch (e) { id = null; }
            if (!id) continue;
            keep[key] = true;
            el.setAttribute('data-bl-lg', key);
            if (list[i].native) {
                el.setAttribute('data-bl-lg-native', '1');
            } else {
                el.removeAttribute('data-bl-lg-native');
            }
            paint(el, key);
            /* 原生对话框内部结构复杂，不强改其分区透明度（soften），
               只挂滤镜 + 用 tintCss 里接近实色的底，保证可读性 */
            if (!list[i].native) soften(el);
        }
        /* 不再生效的元素要清掉，否则关掉开关后残留滤镜。
           ⚠ 这里比较的必须是 key（data-bl-lg 的属性值），不是滤镜 id：
           两者只差一个前缀，一旦混用，刚设上的属性会被这一段立刻删掉，
           表现为"开关打开了却完全没效果"。 */
        var old = document.querySelectorAll('[data-bl-lg]');
        for (var k = 0; k < old.length; k++) {
            var node = old[k];
            var kid = node.getAttribute('data-bl-lg');
            if (keep[kid]) continue;
            node.removeAttribute('data-bl-lg');
            node.removeAttribute('data-bl-lg-native');
            node.style.removeProperty('backdrop-filter');
            node.style.removeProperty('-webkit-backdrop-filter');
        }
    }

    function reset() {
        unsoften();
        var nodes = document.querySelectorAll('[data-bl-lg]');
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].removeAttribute('data-bl-lg');
            nodes[i].style.removeProperty('backdrop-filter');
            nodes[i].style.removeProperty('-webkit-backdrop-filter');
        }
        clearFilters();
    }

    /* 液态玻璃自带模糊与底色，不依赖毛玻璃。
       但元素若完全不透明，折射就看不见 —— 不只是元素本身，
       它内部那些不透明的分区（标题栏、内容区、卡片）会把玻璃盖住，
       所以这几层也要一起压成半透明，否则看着像"只有边框一圈有玻璃"。 */

    /* 权威暗色判断。旧版只看 --color-scheme 这个 CSS 变量，
       但编辑器切主题时并不总是把它设成 dark（主题走的是 Redux 里的
       scratchGui.theme.theme.gui），于是暗色模式下这里仍读到 light，
       弹窗底被漂成白底，而文字还是暗色主题的浅色字 —— 浅字压白底，
       内容直接"消失"，这就是暗色模式的 BUG。
       所以按编辑器的同一套口径判断，并逐层兜底。 */
    function isDarkTheme() {
        try {
            var store = window.ReduxStore;
            if (store && typeof store.getState === 'function') {
                var st = store.getState();
                var th = st && st.scratchGui && st.scratchGui.theme && st.scratchGui.theme.theme;
                if (th && th.gui) {
                    if (th.gui === 'dark' || th.gui === 'midnight') return true;
                    if (th.gui === 'light') return false;
                }
            }
        } catch (e) { /* ignore */ }
        try {
            var dt = document.documentElement.getAttribute('data-theme');
            if (dt === 'dark') return true;
            if (dt === 'light') return false;
        } catch (e) { /* ignore */ }
        try {
            var v = getComputedStyle(document.documentElement).getPropertyValue('--color-scheme');
            var s = String(v).trim();
            if (s === 'dark') return true;
            if (s === 'light') return false;
        } catch (e) { /* ignore */ }
        try {
            return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        } catch (e) { return false; }
    }

    /* 上次同步时的明暗状态，用于检测主题切换（切换时 soften 缓存要失效） */
    var lastDark = null;

    function tintCss() {
        var dark = isDarkTheme();
        var t = dark ? '0, 0, 0' : '255, 255, 255';
        var line = 'rgba(' + t + ', ' + (dark ? 0.22 : 0.14) + ')';

        /* 第 34 轮：从「一层平铺模糊」改成真正的三层玻璃。
           ① 载体：三层背景渐变（斜向高光 / 左上光晕 / 右下暗角）
              + 双内描边 + 三段外阴影，把玻璃从背景里抬起来；
           ② 分区：比载体淡一档，只留顶部 1px 高光，不再叠模糊；
           ③ 卡片：再淡一档，带一圈内描边，形成可读的层级差。
           亮色模式提高高光不透明度，暗色模式提高暗角与外阴影，
           两种主题下都能看出厚度而不是一片灰。 */
        /* 顶部高光只保留左段：椭圆垂直半径固定 1px（就是原来那条
           inset 0 1px 0 亮线），从左上角向右延伸、42% 处渐隐。
           右上角因此完全没有亮线、亮斑或光晕，其余厚度层次照旧。 */
        function leftTopLine(a) {
            return 'radial-gradient(140% 1px at 0% 0%, ' +
                'rgba(255,255,255,' + a + ') 0%, ' +
                'rgba(255,255,255,0) 42%)';
        }
        var carrier =
            'background-image:' +
            leftTopLine(dark ? 0.20 : 0.78) + ',' +
            'linear-gradient(135deg, rgba(255,255,255,' + (dark ? 0.13 : 0.34) +
                ') 0%, rgba(255,255,255,0) 34%),' +
            /* 光晕收窄到 95% 宽：原先 130% 的尾部会扫到右上角 */
            'radial-gradient(95% 75% at -5% -10%, rgba(255,255,255,' +
                (dark ? 0.10 : 0.26) + '), rgba(255,255,255,0) 55%),' +
            'radial-gradient(110% 95% at 105% 110%, rgba(0,0,0,' +
                (dark ? 0.26 : 0.10) + '), rgba(0,0,0,0) 55%) !important;' +
            /* 整条 inset 顶部亮线移除，改由上面的左段短线承担 */
            'box-shadow:' +
            'inset 0 -1px 0 rgba(0,0,0,' + (dark ? 0.30 : 0.08) + '),' +
            'inset 0 0 0 1px rgba(255,255,255,' + (dark ? 0.06 : 0.28) + '),' +
            '0 1px 2px rgba(0,0,0,' + (dark ? 0.28 : 0.06) + '),' +
            '0 10px 28px rgba(0,0,0,' + (dark ? 0.32 : 0.12) + '),' +
            '0 32px 80px rgba(0,0,0,' + (dark ? 0.20 : 0.08) + ') !important;';
        /* 分区：原 180deg 是整面从上到下亮，右上角必然被照到；
           改成 135deg 左上斜向 + 左段短线，右上保持中性。 */
        var section =
            'background-image:' +
            leftTopLine(dark ? 0.10 : 0.32) + ',' +
            'linear-gradient(135deg, rgba(255,255,255,' +
                (dark ? 0.07 : 0.18) + '), rgba(255,255,255,0) 42%) !important;' +
            'box-shadow:none !important;';
        /* 内部卡片：去掉整条顶部亮线，只留左段；整圈内描边是轮廓，保留。 */
        var card =
            'background-image:' + leftTopLine(dark ? 0.07 : 0.22) + ' !important;' +
            'box-shadow:inset 0 0 0 1px rgba(255,255,255,' +
                (dark ? 0.04 : 0.14) + ') !important;';

        return '' +
            '[data-bl-lg]{' +
            'background-color:var(--bl-glass-body,rgba(' + t + ',0.20)) !important;' +
            'border-color:' + line + ' !important;' +
            carrier + '}\n' +
            '[data-bl-lg-native]{' +
            'background-color:rgba(' + t + ',0.82) !important;' +
            'border-color:' + line + ' !important;' +
            carrier + '}\n' +
            /* 层次 ②：直接子分区，半透明，让底下的玻璃透上来 */
            '[data-bl-lg] > [class*="header"],' +
            '[data-bl-lg] > [class*="content"],' +
            '[data-bl-lg] > [class*="head"],' +
            '[data-bl-lg] > [class*="foot"],' +
            '[data-bl-lg] > [class*="body"]{' +
            'background-color:var(--bl-glass-inner,rgba(' + t + ',0.10)) !important;' +
            section + '}\n' +
            /* 层次 ③：内部卡片与侧栏，比分区再淡一档 */
            '[data-bl-lg] [class*="-side"],' +
            '[data-bl-lg] [class*="-card"],' +
            '[data-bl-lg] [class*="searchbar"],' +
            '[data-bl-lg] [class*="-list"],' +
            '[data-bl-lg] [class*="-logs"],' +
            '[data-bl-lg] [class*="editor"]{' +
            'background-color:var(--bl-glass-inner,rgba(' + t + ',0.08)) !important;' +
            card + '}';
    }

    var BASE_STYLE_ID = 'bl-liquid-glass-base';

    function installBase() {
        if (document.getElementById(BASE_STYLE_ID)) return;
        var st = document.createElement('style');
        st.id = BASE_STYLE_ID;
        st.textContent = '[data-bl-lg-sec].bl-lg-off{opacity:.45;}';
        (document.head || document.documentElement).appendChild(st);
    }

    function sync() {
        installBase();
        /* 主题切换检测：soften() 缓存的是"切换前主题"的底色，
           主题一变这些半透明白/半透明黑就不再正确，必须先清掉缓存，
           否则内容区会卡在旧主题色 —— 暗色下"内容区一片白、只有标题栏
           跟随暗色"的 BUG 就是这么来的。 */
        var darkNow = isDarkTheme();
        if (lastDark !== null && lastDark !== darkNow) clearSoft();
        lastDark = darkNow;
        /* ⚠ 互斥绝不放在这里。
           sync() 由 MutationObserver 在**每次 DOM 变化**时调用（弹窗、
           拖积木、React 重绘都会触发）。旧版在这里判断「毛玻璃开着就把
           液态关掉并写回 localStorage」，于是用户刚勾上液态，下一条
           DOM 变化就把它关回去 —— 表现就是「毛玻璃 / 液态玻璃有时失效」，
           且是否复现取决于 DOM 变化与写入的先后，纯随机。
           现在互斥只在配置真正变化时由 reconcileGlass() 裁决一次。 */
        var el = document.getElementById(STYLE_ID);
        if (!cfg.enabled) {
            if (el && el.parentNode) el.parentNode.removeChild(el);
            reset();
            syncEnabledUI();
            try { syncGlassLock(); } catch (e) { /* ignore */ }
            return;
        }
        apply();
        var css = tintCss();
        if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            (document.head || document.documentElement).appendChild(el);
        }
        if (el.textContent !== css) el.textContent = css;
    }

    /* ---------------- 设置面板里的开关与滑杆 ----------------
       样式完全复用原生：不自己写 class，而是把设置页里已有节点的
       className 抄过来（CSS Modules 带 hash，写死会失效）。
       这样开关、滑杆、数值、两端标签都和毛玻璃那几行一模一样。 */

    var uiBox = null;
    var uiSeq = 0;

    /* 只认「玻璃效果」页独有的开关文案。旧版含宽泛的「玻璃效果」，
       而设置窗口侧栏里就有这个菜单项，于是匹配到含侧栏的大容器，
       液态玻璃开关被注入到「弹窗外观」等别的分类里。 */
    var PAGE_MARKS = ['启用毛玻璃效果', 'Enable Frosted Glass'];

    function uiHost() {
        var boxes = document.querySelectorAll('[class*="settings-modal_body_"]');
        for (var i = 0; i < boxes.length; i++) {
            var t = boxes[i].textContent || '';
            for (var k = 0; k < PAGE_MARKS.length; k++) {
                if (t.indexOf(PAGE_MARKS[k]) >= 0) return boxes[i];
            }
        }
        return null;
    }

    /* 两种玻璃互斥：开液态就必须把毛玻璃关掉，反之亦然。
       存储要写、页面上的复选框也要同步点掉 —— 只改存储的话
       React 的勾选框还亮着，界面上就成了"两个都开着"。 */
    function setFrosted(on) {
        try {
            var raw = window.localStorage.getItem(FROST_STORE);
            var o = raw ? JSON.parse(raw) : {};
            if (!o || typeof o !== 'object') o = {};
            o.enabled = !!on;
            if (typeof o.blurRadius !== 'number') o.blurRadius = 12;
            if (typeof o.opacity !== 'number') o.opacity = 0.25;
            if (typeof o.themeBoost !== 'number') o.themeBoost = 0.15;
            window.localStorage.setItem(FROST_STORE, JSON.stringify(o));
            emitGlass();
        } catch (e) { /* ignore */ }
    }

    function frostedCheckbox() {
        var host = uiHost();
        if (!host) return null;
        var boxes = host.querySelectorAll('input[type="checkbox"]');
        for (var i = 0; i < boxes.length; i++) {
            if (!boxes[i].getAttribute('data-f')) return boxes[i];
        }
        return null;
    }

    var locking = false;

    /* ---------------------------------------------------------------- *
     * 两种玻璃互斥，且各自独立生效
     *
     * 液态玻璃自带底色与整体模糊，只额外做边缘折射与镜面高光，
     * 不依赖毛玻璃垫底，可以单独开启。
     * 同一时刻只能开一个：开液态会自动关毛玻璃，开毛玻璃会自动关液态。
     * ---------------------------------------------------------------- */
    function frostedOn() {
        try {
            var o = JSON.parse(window.localStorage.getItem(FROST_STORE) || '{}');
            return !!(o && o.enabled);
        } catch (e) { return false; }
    }

    function liquidSection() {
        return document.querySelector('[data-bl-lg-sec]');
    }

    function liquidCheckbox() {
        var sec = liquidSection();
        return sec ? sec.querySelector('input[type="checkbox"][data-f="enabled"]') : null;
    }

    /* 两种玻璃互斥：液态玻璃只要开着，就保证毛玻璃是关的。
       液态玻璃自带底色与模糊，不依赖毛玻璃垫底，可独立生效。 */
    function ensureFrost() {
        if (cfg.enabled && frostedOn()) {
            setFrosted(false);
        }
    }

    function frostedRow() {
        var cb = frostedCheckbox();
        if (!cb) return null;
        var n = cb;
        for (var i = 0; i < 7 && n; i++) {
            if (n.className && String(n.className).indexOf('settings-modal_setting') >= 0) return n;
            n = n.parentNode;
        }
        return null;
    }

    /* 开关的可用状态：
         · 毛玻璃 —— 恒为可用
         · 液态玻璃 —— 恒为可用，两者互斥（任一开启自动关另一个），
                       不再依赖毛玻璃，可独立开关。
                       液态未启用时，三条滑杆仍禁用（没启用就调不了参数） */
    function syncGlassLock() {
        var sec = liquidSection();
        if (sec) {
            if (sec.getAttribute('data-bl-locked') === '1') {
                sec.setAttribute('data-bl-locked', '0');
            }
            var box = liquidCheckbox();
            if (box) {
                if (box.disabled) box.disabled = false;
                if (box.checked !== !!cfg.enabled) box.checked = !!cfg.enabled;
            }
            var rs = sec.querySelectorAll('input[type="range"]');
            var d2 = !cfg.enabled;
            for (var k = 0; k < rs.length; k++) {
                if (rs[k].disabled !== d2) rs[k].disabled = d2;
            }
        }

        /* 毛玻璃那行不锁定：它由用户自己控制 */
        var fr = frostedRow();
        if (fr && fr.getAttribute('data-bl-locked')) fr.removeAttribute('data-bl-locked');
        var fc = frostedCheckbox();
        if (fc && fc.disabled) fc.disabled = false;
    }

    /* ---------------------------------------------------------------- *
     * iOS 风格开关
     *
     * 原生复选框换成 iOS 那种胶囊开关：关 = 灰、开 = 绿、滑块带过渡。
     * 做法是保留原生 input（值、事件、React 受控都不变），只在它后面
     * 插一个 .bl-ios 视觉元素，再把 input 本身藏起来。
     *
     * 藏起来的 input 仍在 <label> 里，所以点文字、点开关都能切换，
     * 原生交互一点没变；不在 label 里的（React 直接绑 onClick 的那种）
     * 给开关补一个 click 转发。
     * ---------------------------------------------------------------- */
    /* iOS 开关已经完全由 CSS 实现（见 inject.css），元素渲染的第一帧就是最终样子。
       这里只做一件事：给不该改的复选框打上跳过标记，作为 CSS `svg input` 之外的
       第二道保险（例如某些实现把复选框放在 foreignObject 之外的容器里）。 */
    function markSkip() {
        try {
            var boxes = document.querySelectorAll('input[type="checkbox"]');
            for (var i = 0; i < boxes.length; i++) {
                var cb = boxes[i];
                if (cb.getAttribute('data-bl-ios')) continue;
                cb.setAttribute('data-bl-ios', '1');
                if (cb.closest && cb.closest('svg')) cb.classList.add('bl-ios-skip');
            }
        } catch (e) { /* ignore */ }
    }

    /* 全局覆盖：设置页每个分类都是 React 按需渲染的，切分类就换一批节点，
       所以不能只在挂载时做一次 —— 用观察器 + 低频兜底持续扫描整个文档。 */
    var iosTimer = null;

    function markAll() {
        markSkip();
    }

    function installSkipMarks() {
        markAll();
        try {
            var mo = new MutationObserver(function () {
                if (iosTimer) return;
                iosTimer = window.setTimeout(function () {
                    iosTimer = null;
                    markAll();
                }, 80);
            });
            mo.observe(document.body || document.documentElement,
                { childList: true, subtree: true });
        } catch (e) {
            window.setInterval(markAll, 1500);
        }
        window.setInterval(markAll, 2500);
        return true;
    }

    /* 原生按钮类名：从样式表里找，避免写死 hash。 */
    var btnCls = null;

    function nativeBtnCls() {
        if (btnCls !== null) return btnCls;
        btnCls = '';
        try {
            var sss = document.styleSheets;
            for (var i = 0; i < sss.length; i++) {
                var rules;
                try { rules = sss[i].cssRules; } catch (e) { continue; }
                if (!rules) continue;
                for (var j = 0; j < rules.length; j++) {
                    var sel = rules[j].selectorText;
                    if (!sel) continue;
                    var m = /\.(settings-modal_button_[A-Za-z0-9_-]+)/.exec(sel);
                    if (m) { btnCls = m[1]; return btnCls; }
                }
            }
        } catch (e) { /* ignore */ }
        return btnCls;
    }

    function pick(host, part) {
        /* 类名带 CSS Modules hash，但同一个构建里所有设置分类共用一套。
           从整个文档找，就不必为了「让滑杆渲染出来」去点开毛玻璃 ——
           那个自动点击正是把毛玻璃设置组件点崩、进而带崩整个页面的元凶。 */
        var n = host.querySelector('[class*="settings-modal_' + part + '"]');
        if (!n) n = document.querySelector('[class*="settings-modal_' + part + '"]');
        return n ? n.className : '';
    }

    /* 原生类名只在毛玻璃开着时才有完整的一套（滑杆、数值、两端标签）。
       现在两种玻璃互斥，毛玻璃很可能是关的 —— 那就先把毛玻璃打开，
       等 React 把滑杆渲染出来、类名抄完，再把它关回去。
       类名一旦抄到就缓存，整个会话只做这一次。 */
    var nativeCls = null;

    function captureCls(host) {
        /* 不要求页面上有原生滑杆：毛玻璃关着时它本来就不渲染。
           抄到多少用多少，缺的字段由 buildUI 回落到自带 CSS 类。 */
        var slider = host.querySelector('input[type="range"]') ||
                     document.querySelector('input[type="range"][class*="gcSlider"]');
        nativeCls = {
            setting: pick(host, 'setting_') || 'bl-lg-setting',
            label: pick(host, 'label_') || 'bl-lg-label',
            checkbox: pick(host, 'checkbox_') || '',
            header: pick(host, 'settingHeader_') || 'bl-lg-header',
            value: pick(host, 'settingValue_') || 'bl-lg-value',
            range: pick(host, 'rangeLabels_') || 'bl-lg-rangeLabels',
            slider: slider ? slider.className : 'bl-lg-range'
        };
        return !!nativeCls.setting;
    }

    function buildUI(host, c) {
        if (!c || !c.setting) return false;

        var wrap = document.createElement('div');
        wrap.setAttribute('data-role', 'lg');
        wrap.setAttribute('data-bl-lg-sec', '1');

        var head = document.createElement('div');
        if (c.header) head.className = c.header;
        var hs = document.createElement('span');
        hs.textContent = '液态玻璃';
        head.appendChild(hs);
        wrap.appendChild(head);

        /* 开关行 */
        var s1 = document.createElement('div');
        s1.className = c.setting;
        var l1 = document.createElement('div');
        if (c.label) l1.className = c.label;
        var lab = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        if (c.checkbox) cb.className = c.checkbox;
        cb.checked = !!cfg.enabled;
        cb.setAttribute('data-f', 'enabled');
        var cs = document.createElement('span');
        cs.textContent = '启用液态玻璃（边缘折射 + 镜面高光）';
        lab.appendChild(cb); lab.appendChild(cs);
        l1.appendChild(lab); s1.appendChild(l1);
        wrap.appendChild(s1);

        /* 滑杆行：未启用时禁用，避免"没开却能调"的错觉 */
        function sliderRow(name, field, value, min, max, step, unit) {
            var row = document.createElement('div');
            row.className = c.setting;
            row.setAttribute('data-row', field);
            var lab2 = document.createElement('div');
            if (c.label) lab2.className = c.label;
            var t1 = document.createElement('span');
            t1.textContent = name;
            var t2 = document.createElement('span');
            if (c.value) t2.className = c.value;
            t2.setAttribute('data-val', field);
            t2.textContent = unit ? (value + unit) : String(value);
            lab2.appendChild(t1); lab2.appendChild(t2);
            row.appendChild(lab2);
            var rg = document.createElement('input');
            rg.type = 'range';
            rg.className = c.slider ? (c.slider + (c.slider.indexOf('bl-lg-range') >= 0 ? '' : ' bl-lg-range')) : 'bl-lg-range';
            rg.min = String(min); rg.max = String(max); rg.step = String(step);
            rg.value = String(value);
            rg.setAttribute('data-f', field);
            rg.disabled = !cfg.enabled;
            if (field === 'blur') rg.setAttribute('data-unit', 'px');
            row.appendChild(rg);
            var rl = document.createElement('div');
            if (c.range) rl.className = c.range;
            var a = document.createElement('span'); a.textContent = min + (unit || '');
            var b2 = document.createElement('span'); b2.textContent = max + (unit || '');
            rl.appendChild(a); rl.appendChild(b2);
            row.appendChild(rl);
            return row;
        }

        wrap.appendChild(sliderRow('折射度', 'refraction', cfg.refraction, 0, 100, 1, ''));
        wrap.appendChild(sliderRow('放大度', 'magnify', cfg.magnify, 0, 100, 1, ''));
        wrap.appendChild(sliderRow('模糊度', 'blur', cfg.blur, 0, 24, 1, 'px'));

        /* 底部按钮：用原生按钮的类名，外观与设置页其它按钮一致 */
        var brow = document.createElement('div');
        brow.className = c.setting + ' bl-lg-btnrow';
        var btn = document.createElement('button');
        btn.type = 'button';
        var bc = nativeBtnCls();
        if (bc) btn.className = bc;
        else btn.className = 'bl-lg-btn';
        btn.setAttribute('data-act', 'reset');
        btn.textContent = '恢复默认参数';
        brow.appendChild(btn);
        wrap.appendChild(brow);

        wrap.addEventListener('change', onChange);
        wrap.addEventListener('input', onInput);
        wrap.addEventListener('click', onClick);
        /* 必须插进 settings-modal_body：那才是原生设置行的父容器。
           直接插到 modal-sidebar_content 会少一层内距，滑杆会比原生长一截。 */
        var body = host.querySelector('[class*="settings-modal_body"]') || host;
        body.appendChild(wrap);
        return true;
    }

    /* 启用状态变化时同步滑杆的可用状态与视觉 */
    function syncEnabledUI() {
        var sec = document.querySelector('[data-bl-lg-sec]');
        if (!sec) return;
        /* 开关本身永远保持正常颜色可点，只有滑杆在未启用时禁用（原生灰色）。
           不再整段压 45% 透明度 —— 否则"毛玻璃没开"时液态开关看起来像锁定。 */
        var rs = sec.querySelectorAll('input[type="range"]');
        for (var i = 0; i < rs.length; i++) rs[i].disabled = !cfg.enabled;
        try { syncGlassLock(); } catch (e) { /* ignore */ }
    }

    /* 实时生效：数值一变就重算滤镜。
       重算要重新编码贴图，所以做 110ms 防抖 —— 拖动滑杆时不会每像素都重建，
       但松手前后看不出延迟。 */
    var liveTimer = null;

    function rebuildSoon() {
        if (liveTimer) window.clearTimeout(liveTimer);
        liveTimer = window.setTimeout(function () {
            liveTimer = null;
            try {
                clearFilters();
                reset();
                sync();
            } catch (e) { /* ignore */ }
        }, 110);
    }

    function onInput(e) {
        var t = e.target;
        if (!t || t.type !== 'range') return;
        var f = t.getAttribute('data-f');
        if (!f || t.disabled) return;
        cfg[f] = Number(t.value);
        var box = t.parentNode.querySelector('[data-val="' + f + '"]');
        if (box) box.textContent = t.value + (t.getAttribute('data-unit') || '');
        rebuildSoon();
    }

    function onClick(e) {
        var t = e.target;
        if (!t || !t.getAttribute) return;
        if (t.getAttribute('data-act') !== 'reset') return;
        cfg.refraction = DEFAULTS.refraction;
        cfg.magnify = DEFAULTS.magnify;
        cfg.blur = DEFAULTS.blur;
        write(cfg);
        clearFilters();
        reset();
        sync();
        /* 滑杆与数值标签一起回到默认，否则界面和生效值对不上 */
        var sec = document.querySelector('[data-bl-lg-sec]');
        if (sec) {
            var rs = sec.querySelectorAll('input[type="range"]');
            for (var i = 0; i < rs.length; i++) {
                var f = rs[i].getAttribute('data-f');
                if (!f || !(f in DEFAULTS)) continue;
                rs[i].value = String(DEFAULTS[f]);
                var box = rs[i].parentNode.querySelector('[data-val="' + f + '"]');
                if (box) box.textContent = rs[i].value + (rs[i].getAttribute('data-unit') || '');
            }
        }
    }

    function onChange(e) {
        var t = e.target;
        if (!t || !t.getAttribute) return;
        var f = t.getAttribute('data-f');
        if (!f) return;
        if (f === 'enabled') {
            cfg.enabled = !!t.checked;
            lastWinner = cfg.enabled ? 'liquid' : '';
            /* 只写配置，绝不自动 .click() 原生复选框：
               frostedCheckbox() 在 React 重绘后可能定位到别的开关，
               点错会让「开关关掉后迅速自动开启」，React 受控组件还会把
               旧状态写回 localStorage。原生复选框由它自己的 React 管。 */
            ensureFrost();
            syncEnabledUI();
        } else {
            cfg[f] = Number(t.value);
            var box = t.parentNode.querySelector('[data-val="' + f + '"]');
            if (box) box.textContent = t.value + (t.getAttribute('data-unit') || '');
        }
        write(cfg);
        clearFilters();
        reset();
        sync();
    }

    function mountUI() {
        var host = uiHost();
        if (!host) {
            /* 不在「玻璃效果」页（用户切到了弹窗外观等分类）：
               把串页的液态玻璃设置整段摘掉，别赖在别的分类里。 */
            var stray = document.querySelector('[data-bl-lg-sec]');
            if (stray && stray.parentNode) stray.parentNode.removeChild(stray);
            return false;
        }
        /* ⚠ 不能只看容器上的 data-bl-lg-ui 标记。
           设置页是 React 按需渲染的：切分类时它会复用同一个内容容器节点，
           只把子节点换掉 —— 我们插进去的整段被抹掉，而标记仍留在容器上。
           于是"已经挂载过"的判断成立，永远不再重建，表现就是
           「切到别的分类再切回来，液态玻璃开关没了」。
           判据必须是"这一节现在真的还在 DOM 里"。 */
        if (host.querySelector('[data-bl-lg-sec]')) {
            syncEnabledUI();
            return true;
        }

        /* ⚠ 绝不自动点击设置页里的任何复选框。
           旧版为了抄滑杆类名会临时点开毛玻璃，再点回去：
             · 毛玻璃配置不完整时一点就整页 React 崩溃；
             · 若判定容器串到 Dock 栏等分类，点到的就是「隐藏 Dock 栏」，
               表现即「开关关掉后迅速自动开启」。 */
        if (!nativeCls && !captureCls(host)) return false;
        if (!buildUI(host, nativeCls)) return false;
        host.setAttribute('data-bl-lg-ui', '1');
        syncEnabledUI();
        return true;
    }

    /* ---------------- 更新调度 ----------------
       不用定时全量轮询：DOM 变化时才动，且节流。 */

    var pending = false;

    /* 响应要快，但不能被高频 DOM 变化拖垮。

       之前是 260ms 定时防抖，新弹窗会先以毛玻璃的样子出现、过一会才跳变成液态。
       现在改成"下一帧就跑"，但两次之间至少隔 MIN_GAP —— 因为观察的是整个
       document，Blockly 拖一个积木都会成片地改 DOM，不限流的话每帧都要
       全量 querySelectorAll + getBoundingClientRect，反而卡。

       被限流掉的那次不能丢，否则窗口停在旧状态，所以补一个尾部执行。 */
    var MIN_GAP = 120;
    var lastRun = 0;
    var tailTimer = null;
    var queued = false;
    var dirty = false;

    /* ⚠ 不能写成 "if (pending) return" —— 排队期间来的调度会被静默丢掉。
       窗口插入往往正好落在上一次 sync 的排队期间，一丢就再也补不上，
       只能等 2.5s 的兜底轮询，表现就是"过了一秒多才变成液态"。
       所以排队期间的变化记成 dirty，本轮跑完立刻再跑一次。 */
    function runNow() {
        if (queued) { dirty = true; return; }
        queued = true;
        window.requestAnimationFrame(function () {
            queued = false;
            lastRun = Date.now();
            try { sync(); } catch (e) { /* ignore */ }
            if (dirty) { dirty = false; runNow(); }
        });
    }

    function schedule() {
        var now = Date.now();
        if (now - lastRun >= MIN_GAP) { runNow(); return; }
        if (tailTimer) return;
        tailTimer = window.setTimeout(function () {
            tailTimer = null;
            runNow();
        }, MIN_GAP - (now - lastRun));
    }

    var uiPending = false;

    function scheduleUI() {
        if (uiPending) return;
        uiPending = true;
        window.setTimeout(function () {
            uiPending = false;
            try { mountUI(); } catch (e) { /* ignore */ }
        }, 60);
    }

    /* ── 玻璃状态统一裁决 ─────────────────────────────────────────────
       两个开关都在 localStorage 里，但只有一处决定「谁赢」：
         · 用户刚主动打开液态  → lastWinner='liquid'，关掉毛玻璃
         · 毛玻璃从关变开      → lastWinner='frost'，关掉液态
       裁决只在配置变化（storage / 轮询上升沿 / 即时事件）时跑一次，
       不再由任意 DOM 变化触发，也不互相来回写导致乒乓。 */
    var lastWinner = '';
    var lastFrost = false;
    var mutexBusy = false;

    function reconcileGlass(frostNow) {
        if (mutexBusy) return;
        mutexBusy = true;
        try {
            var liq = read();
            if (frostNow && liq.enabled) {
                /* lastWinner 是模块内局部变量：刷新页面、外部脚本直写、
                   其它标签页同步、或旧存档「两个都开过」都会让它丢失。
                   旧版在非 'liquid' 时一律关掉液态 → 用户刚开启的液态玻璃
                   被自己写回关掉，正是「有时无法生效」的主因之一。
                   现在只有明确「用户主动开了毛玻璃」才关液态；
                   其余情况（含 lastWinner='liquid' 与未知）一律关毛玻璃、
                   保留液态，互斥依然成立。 */
                if (lastWinner === 'frost') {
                    liq.enabled = false;
                    write(liq);
                    cfg = liq;
                    syncEnabledUI();
                } else {
                    setFrosted(false);
                }
            }
        } catch (e) { /* ignore */ }
        finally { mutexBusy = false; }
    }

    /* 即时通道：任何一处写入玻璃配置后，同一个事件循环内重建两边。
       B01 在启动期 / 作品加载期会冻结全文档 MutationObserver 总线，
       轮询也会被跳过；这条通道不经过它们，所以「加载作品后玻璃失效」
       不会再出现。 */
    var glassBusy = false, glassReplay = false;
    function onGlassChange() {
        /* 旧版 busy 时直接 return：任何同步派发撞上这一帧就被永久吞掉。
           改成记一个回放标记，finally 里延后补跑一次，绝不丢状态。 */
        if (glassBusy) { glassReplay = true; return; }
        glassBusy = true;
        try {
            var n = read();
            var changed = (n.enabled !== cfg.enabled ||
                           n.refraction !== cfg.refraction ||
                           n.magnify !== cfg.magnify ||
                           n.blur !== cfg.blur);
            if (changed) { cfg = n; clearFilters(); reset(); }
            reconcileGlass(frostedOn());
            sync();
            syncEnabledUI();
            try { syncGlassLock(); } catch (e) { /* ignore */ }
            try { if (window.__blGlassSync) window.__blGlassSync(); } catch (e2) { /* ignore */ }
        } catch (e3) { /* ignore */ }
        finally {
            glassBusy = false;
            if (glassReplay) {
                glassReplay = false;
                try { window.setTimeout(onGlassChange, 0); } catch (e4) { /* ignore */ }
            }
        }
    }

    function install() {
        /* 跳过标记与液态玻璃是否开启无关，无条件装 */
        installSkipMarks();
        lastFrost = frostedOn();
        try { window.addEventListener('bl:glass-change', onGlassChange); } catch (e) { /* ignore */ }
        if (cfg.enabled) ensureFrost();
        sync();
        scheduleUI();
        try {
            var mo = new MutationObserver(function () { schedule(); scheduleUI(); });
            mo.observe(document.body || document.documentElement,
                { childList: true, subtree: true, attributes: true,
                  attributeFilter: ['data-theme', 'class', 'style'] });
        } catch (e) {
            window.setInterval(schedule, 1200);
        }
        window.addEventListener('resize', schedule, false);
        /* 兜底：改 localStorage 不产生 DOM 变化（例如另一个标签页改的、
           或外部脚本直接写），MutationObserver 收不到通知。
           加一个存储事件 + 低频轮询，保证任何路径下都能生效。
           单次开销只是十几个选择器加 getBoundingClientRect，约 1~2ms。 */
        window.addEventListener('storage', function (e) {
            if (!e) return;
            if (e.key === STORE) {
                cfg = read();
                clearFilters();
                reset();
            } else if (e.key === FROST_STORE) {
                /* 毛玻璃开关变化（可能来自其它标签页）：只在它「变开」时
                   记录一次操作者，再由统一裁决决定谁赢。 */
                var fo = frostedOn();
                if (fo && !lastFrost) lastWinner = 'frost';
                lastFrost = fo;
                cfg = read();
                clearFilters();
                reset();
                syncEnabledUI();
                reconcileGlass(fo);
            } else { return; }
            schedule();
            try { syncGlassLock(); } catch (err) { /* ignore */ }
            /* 其它标签页的真实 storage 事件不经过本页的 setItem hook，
               旧版这里只 reset 不 sync()，液态效果要等 2500ms 轮询
               （且启动 / 加载期总线会跳过轮询）。补一发合并事件，
               让 onGlassChange 完整跑 reconcile → sync → UI → 毛玻璃表。 */
            emitGlass();
        }, false);
        window.setInterval(function () {
            try {
                var n = read();
                if (n.enabled !== cfg.enabled || n.refraction !== cfg.refraction ||
                    n.magnify !== cfg.magnify || n.blur !== cfg.blur) {
                    cfg = n;
                    clearFilters();
                    reset();
                }
                /* 毛玻璃的开关状态不产生 DOM 变化，只能轮询兜底 */
                var fo = frostedOn();
                if (fo !== lastFrost) {
                    if (fo && !lastFrost) lastWinner = 'frost';
                    lastFrost = fo;
                    cfg = read();
                    clearFilters();
                    reset();
                    syncEnabledUI();
                    reconcileGlass(fo);
                }
                schedule();
                syncGlassLock();
            } catch (e) { /* ignore */ }
        }, 2500);
        return true;
    }

    return {
        install: install,
        cfg: function () { return cfg; },
        set: function (patch) {
            for (var k in patch) {
                if (Object.prototype.hasOwnProperty.call(patch, k)) cfg[k] = patch[k];
            }
            write(cfg);
            ensureFrost();
            syncEnabledUI();
            clearFilters();
            reset();
            sync();
        }
    };
})();

/* 启动：与 inject.js 相互独立，任一失败不影响另一方 */
try {
    window.__blLiquidGlass.install();
} catch (e) { /* ignore */ }

