
(function () {
    'use strict';
    if (window.__blHeroThemes) return;
    window.__blHeroThemes = true;

    var CUR = 'sea';
    var KEYS = ['sea', 'art', 'star', 'grid', 'mint', 'indigo', 'mono'];
    var LAYOUT = { sea: 'feature', art: 'canvas', star: 'spotlight', grid: 'split',
                   mint: 'compact', indigo: 'rail', mono: 'blueprint' };
    /* 巨大版本号与胶囊代号：与 B98 时间线卡的 vPrefix / 构建编号呼应，
       但大卡只放最醒目的一截，避免把「· 构建 3」整串塞进 94px 字号。 */
    var NUM = { sea: '1.0.5', art: '1.0.4', star: '1.0.3', grid: '#03',
                mint: '— 02', indigo: 'No. 01', mono: '[1.0.1]' };
    var PRODUCT = { sea: 'StartEditor', art: 'Start Editor', star: 'START EDITOR',
                    grid: 'STAR / BUILD', mint: 'STAR / BUILD', indigo: 'STAR / BUILD',
                    mono: 'START EDITOR' };
    var BADGE = {
        sea: ['SEA', 'SEA'], art: ['ART', 'ART'], star: ['STAR', 'STAR'],
        grid: ['构建 3', 'BUILD 3'], mint: ['构建 2', 'BUILD 2'],
        indigo: ['构建 1', 'BUILD 1'], mono: ['bate', 'bate']
    };
    var picked = '';

    function isZh() {
        try { return /^zh/i.test(document.documentElement.lang || ''); }
        catch (e) { return true; }
    }
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function themeName(zh) {
        var raw = '';
        try { raw = localStorage.getItem('bilup.appTheme') || localStorage.getItem('tw:theme') || ''; }
        catch (e) { /* ignore */ }
        if (/dark|deepsea/i.test(raw)) return zh ? '暗色' : 'Dark';
        if (/sakura/i.test(raw)) return zh ? '樱花' : 'Sakura';
        if (/mint/i.test(raw)) return zh ? '薄荷' : 'Mint';
        return zh ? '亮色' : 'Light';
    }
    function platform() {
        var ua = navigator.userAgent || '';
        var os = /Windows/.test(ua) ? 'Windows' :
            (/Mac OS/.test(ua) ? 'macOS' : (/Android/.test(ua) ? 'Android' : 'Desktop'));
        var br = /Edg\//.test(ua) ? 'Edge' : (/Chrome\//.test(ua) ? 'Chrome' :
            (/Firefox\//.test(ua) ? 'Firefox' : 'Browser'));
        return os + ' · ' + br;
    }

    /* 全部文案从时间线卡读取：小标 / 宣传语 / 短评 / 日期 / 更新条目，
       所以中英文切换、以后往 BL_VERSION_HISTORY 里加条目都自动跟随，
       不存在两份文案不同步的问题。 */
    function entryData(panel, key) {
        var e = panel && panel.querySelector('.bl-ver-entry[data-ver-theme="' + key + '"]');
        if (!e) return null;
        function q(sel) {
            var n = e.querySelector(sel);
            return n ? String(n.textContent || '').trim() : '';
        }
        var lis = e.querySelectorAll('.bl-ver-items li'), items = [];
        for (var i = 0; i < lis.length && items.length < 3; i++) {
            var t = String(lis[i].textContent || '').trim();
            if (t) items.push(t);
        }
        return {
            key: key, current: e.classList.contains('is-current'),
            code: q('.bl-ver-eyebrow'), slogan: q('.bl-ver-slogan'),
            note: q('.bl-ver-note'), date: q('.bl-ver-date'),
            version: q('.bl-ver-v'), title: q('.bl-ver-title'),
            items: items, count: lis.length
        };
    }
    function metaLines(d, zh) {
        if (!d) return [];
        if (d.key === CUR) {
            return [(zh ? '主题：' : 'Theme: ') + themeName(zh),
                    (zh ? '平台：' : 'Platform: ') + platform()];
        }
        return [(zh ? '发布：' : 'Released: ') + (d.date || ''),
                (zh ? '共 ' + d.count + ' 条更新' : d.count + ' changelog entries')];
    }
    function heroHtml(d, zh) {
        var key = d.key, b = BADGE[key] || [key, key];
        var items = d.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
        var meta = metaLines(d, zh).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('');
        return '<div class="bl-os-hero-kicker">' + esc(d.code || LAYOUT[key].toUpperCase()) + '</div>' +
               '<div class="bl-os-hero-num">' + esc(NUM[key] || d.version) + '</div>' +
               '<div class="bl-os-hero-product">' + esc(PRODUCT[key] || 'StartEditor') + '</div>' +
               '<div class="bl-os-hero-slogan">' + esc(d.slogan) + '</div>' +
               '<div class="bl-os-hero-badge">' + esc(zh ? b[0] : b[1]) + '</div>' +
               '<div class="bl-os-hero-note">' + esc(d.note) + '</div>' +
               '<ul class="bl-os-hero-items">' + items + '</ul>' +
               '<div class="bl-os-hero-meta">' + meta + '</div>';
    }
    function backChip(card, zh) {
        var n = card.querySelector('.bl-os-hero-back');
        if (!n) {
            n = document.createElement('button');
            n.type = 'button';
            n.className = 'bl-os-hero-back';
            card.appendChild(n);
        }
        var t = zh ? '↩ 返回当前版本' : '↩ Back to current';
        if (n.textContent !== t) n.textContent = t;
        n.setAttribute('aria-label', t);
    }

    function render() {
        var panels = document.querySelectorAll('.bl-ver-history');
        var zh = isZh();
        for (var i = 0; i < panels.length; i++) {
            var panel = panels[i];
            var key = picked || CUR;
            var d = entryData(panel, key) || entryData(panel, CUR);
            if (!d) continue;                 /* 面板还没建好，等下一轮 */
            key = d.key;
            var meta = metaLines(d, zh).join('~');
            var sig = key + '|' + (zh ? 'zh' : 'en') + '|' + d.code + '|' + d.slogan + '|' +
                      d.note + '|' + d.date + '|' + d.version + '|' + d.count + '|' +
                      d.items.join('~') + '|' + meta;
            var cards = panel.querySelectorAll('.bl-os-hero');
            for (var j = 0; j < cards.length; j++) {
                var card = cards[j];
                var txt = card.querySelector('.bl-os-hero-txt');
                if (!txt) continue;
                if (card.getAttribute('data-hero-sig') === sig &&
                    txt.getAttribute('data-hero-sig') === sig) continue;
                card.setAttribute('data-hero-theme', key);
                card.setAttribute('data-hero-layout', LAYOUT[key] || 'feature');
                card.setAttribute('data-hero-current', key === CUR ? '1' : '0');
                card.setAttribute('data-hero-sig', sig);
                txt.setAttribute('data-hero-sig', sig);
                txt.innerHTML = heroHtml(d, zh);
                backChip(card, zh);
                try {
                    txt.classList.remove('bl-hero-swap');
                    void txt.offsetWidth;      /* 强制重排，让入场动画重播 */
                    txt.classList.add('bl-hero-swap');
                } catch (eSw) { /* ignore */ }
            }
            /* 选中态只在实际变化时写，避免 MutationObserver 自激 */
            var entries = panel.querySelectorAll('.bl-ver-entry[data-ver-theme]');
            for (var k = 0; k < entries.length; k++) {
                var want = !!picked && entries[k].getAttribute('data-ver-theme') === picked;
                var has = entries[k].classList.contains('bl-ver-picked');
                if (want !== has) entries[k].classList.toggle('bl-ver-picked', want);
            }
            var hint = panel.querySelector('.bl-ver-sec-hint');
            if (hint && !hint.getAttribute('data-bl-hero-hint')) {
                hint.setAttribute('data-bl-hero-hint', '1');
                hint.setAttribute('title', zh
                    ? '点击下面任意版本卡，顶部封面会切换成该版本的皮肤'
                    : 'Click a release card below to switch the cover above');
            }
        }
    }

    /* 交互：点时间线卡切换；点大卡本体 / 返回胶囊 / Esc 回到当前版本 */
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('.bl-os-hero-back')) { picked = ''; render(); return; }
        var hero = t.closest('.bl-os-hero[data-hero-current="0"]');
        if (hero && !t.closest('button')) { picked = ''; render(); return; }
        var en = t.closest('.bl-ver-entry[data-ver-theme]');
        if (!en) return;
        var k = en.getAttribute('data-ver-theme');
        picked = (k === CUR || picked === k) ? '' : k;
        render();
    }, true);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && picked) { picked = ''; render(); }
    }, true);

    var pending = false;
    function soon() {
        if (pending) return;
        pending = true;
        setTimeout(function () {
            pending = false;
            try { render(); } catch (e) { /* ignore */ }
        }, 0);
    }
    var mo = null, moHost = null;
    function watch() {
        if (!window.MutationObserver) return;
        var host = document.querySelector('[class*="settings-modal_body_"]');
        if (!host || host === moHost) return;
        moHost = host;
        try { if (mo) mo.disconnect(); } catch (e) { /* ignore */ }
        try {
            mo = new MutationObserver(soon);
            mo.observe(host, { childList: true, subtree: true,
                               attributes: true, attributeFilter: ['class', 'lang'] });
        } catch (e2) { mo = null; }
    }
    function loop() {
        try { watch(); render(); } catch (e) { /* ignore */ }
        setTimeout(loop, 400);
    }
    window.addEventListener('resize', soon, { passive: true });
    setTimeout(loop, 300);
    render();

    window.__blHeroTheme = {
        set: function (k) { picked = KEYS.indexOf(k) >= 0 ? k : ''; render(); },
        reset: function () { picked = ''; render(); },
        get: function () { return picked || CUR; },
        keys: KEYS.slice()
    };

    /* [B107] 同帧补挂：首帧扫描不再等各自的定时巡检 */
    if (window.__blSync) window.__blSync.register('B76-hero-themes', function () {
        try { watch(); render(); } catch (eB76) { /* ignore */ }
    }, true);
    })();
