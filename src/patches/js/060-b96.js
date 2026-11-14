/* ── [B96] 项目面板（重做）· 保存 / 导入 / 切换 ──────────────────────────
   依赖：B58 __blProjectMeta / B52 互斥体系 / B94 STAR / B39 RJ
   维护：左侧「项目」标签；工作区互斥由 B52 管
   ------------------------------------------------------------------
   本轮重做：
     · 排版：一行 3 个作品卡片，大缩略图 + 版本徽标 + 悬停操作，
       头部统计、搜索、排序、导入/保存工具条，空态与无结果态
     · 速度：保存时「元信息弹窗」与「作品序列化」并行；写库乐观更新；
       切换前预取走内存缓存；列表用 DocumentFragment 一次性挂载；
       用真实 performance.now() 计时，目标 < 3s
     · 动画：切换 / 保存 / 导入都有分阶段加载动画（读取 → 载入 → 整理），
       至少显示 380ms，完成后淡出并回显耗时
   ========================================================================== */
(function () {
    'use strict';
    if (window.__blProjects) return;

    var STORE = 'bl:projects';
    var tabEl = null, panel = null, hostEl = null, gridEl = null;
    var overlay = null, confirmBox = null, footStat = null;
    var searchText = '', sortBy = 'time', rafPending = 0;
    var now = function () {
        return (window.performance && performance.now) ? performance.now() : Date.now();
    };

    function vm() {
        try {
            var st = window.ReduxStore && window.ReduxStore.getState();
            return (st && st.scratchGui && st.scratchGui.vm) || null;
        } catch (e) { return null; }
    }
    function isZh() {
        try {
            var l = (document.documentElement.lang || '').toLowerCase();
            if (l.indexOf('zh') === 0) return true;
            if (l.indexOf('en') === 0) return false;
        } catch (e) {}
        try { return /项目|保存/.test(document.body.innerText || ''); } catch (e2) { return true; }
    }
    function T(zh, en) { return isZh() ? zh : en; }
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }
    function fmtSize(n) {
        n = Number(n) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(2) + ' MB';
    }
    function fmtTime(t) {
        var d = new Date(Number(t) || Date.now());
        function p(x) { return (x < 10 ? '0' : '') + x; }
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
               ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    function load() {
        try { var a = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(a) ? a : []; }
        catch (e) { return []; }
    }
    function save(a) {
        try { localStorage.setItem(STORE, JSON.stringify(a)); } catch (e) { /* 超容量 */ }
    }
    function projectName() {
        try {
            var v = vm();
            if (v && v.runtime) {
                var st = v.runtime.getTargetForStage && v.runtime.getTargetForStage();
                var nm = st && st.getName && st.getName();
                if (nm) return nm;
            }
        } catch (e) {}
        return T('未命名项目', 'Untitled project');
    }
    function captureThumb() {
        try {
            var v = vm(), cv = v && v.renderer && v.renderer.canvas;
            if (!cv || !cv.width) return '';
            var c2 = document.createElement('canvas');
            var tw = 240, th = Math.max(1, Math.round(tw * cv.height / cv.width));
            c2.width = tw; c2.height = th;
            c2.getContext('2d').drawImage(cv, 0, 0, tw, th);
            return c2.toDataURL('image/jpeg', 0.76);
        } catch (e) { return ''; }
    }
    function download(u8, name) {
        try {
            var url = URL.createObjectURL(new Blob([u8], { type: 'application/octet-stream' }));
            var a = document.createElement('a');
            a.href = url; a.download = name; a.style.display = 'none';
            document.body.appendChild(a); a.click();
            setTimeout(function () {
                if (a.parentNode) a.parentNode.removeChild(a);
                URL.revokeObjectURL(url);
            }, 2000);
        } catch (e) { /* ignore */ }
    }
    function M() { return window.__blProjectMeta || null; }

    /* ---------------- 加载动画 ---------------- */
    var busy = { on: false, t0: 0, timers: [], stage: 0 };
    function stages() {
        return [T('读取作品数据', 'Reading project'),
                T('载入编辑器', 'Loading into editor'),
                T('整理界面', 'Refreshing workspace')];
    }
    function busyStart(title, sub) {
        if (!overlay) return;
        busy.on = true; busy.t0 = now(); busy.stage = 0;
        busy.timers.forEach(clearTimeout); busy.timers = [];
        var s = stages();
        overlay.innerHTML =
            '<div class="blp-busy-card">' +
                '<div class="blp-ring"><i></i></div>' +
                '<div class="blp-busy-t">' + esc(title) + '</div>' +
                '<div class="blp-busy-s">' + esc(sub || '') + '</div>' +
                '<div class="blp-bar"><i></i></div>' +
                '<div class="blp-busy-stage">' + esc(s[0]) + '</div>' +
            '</div>';
        overlay.style.display = 'flex';
        overlay.classList.remove('blp-done');
        busySet(0, 8);
        /* 阶段按时间推进，真实完成时 busyEnd 直接拉满 */
        busy.timers.push(setTimeout(function () { if (busy.on) busySet(1, 46); }, 260));
        busy.timers.push(setTimeout(function () { if (busy.on) busySet(2, 78); }, 900));
    }
    function busySet(stage, pct) {
        if (!overlay) return;
        busy.stage = stage;
        var bar = overlay.querySelector('.blp-bar > i');
        var lab = overlay.querySelector('.blp-busy-stage');
        if (bar) bar.style.width = pct + '%';
        if (lab) lab.textContent = stages()[stage] || '';
    }
    function busyEnd(label, ms) {
        if (!overlay) return;
        busy.on = false;
        busy.timers.forEach(clearTimeout); busy.timers = [];
        var bar = overlay.querySelector('.blp-bar > i');
        var lab = overlay.querySelector('.blp-busy-stage');
        var t = overlay.querySelector('.blp-busy-t');
        var sub = overlay.querySelector('.blp-busy-s');
        if (bar) bar.style.width = '100%';
        if (lab) lab.textContent = T('完成', 'Done');
        if (t) t.textContent = label;
        if (sub) sub.textContent = (ms != null ? ((ms / 1000).toFixed(2) + ' s') : '');
        overlay.classList.add('blp-done');
        var finish = function () {
            overlay.style.display = 'none';
            overlay.classList.remove('blp-done');
        };
        busy.timers.push(setTimeout(finish, 420));
        var footR = footStat && footStat.querySelector('.blp-foot-r');
        if (footR && ms != null) {
            footR.textContent = T('上次操作', 'Last action') + '：' + label + ' · ' +
                (ms / 1000).toFixed(2) + ' s';
        }
    }
    function minShow() {
        var left = 380 - (now() - busy.t0);
        return new Promise(function (res) { setTimeout(res, left > 0 ? left : 0); });
    }

    /* ---------------- 面板内确认（替代阻塞的原生 confirm） ---------------- */
    function ask(question, onYes) {
        if (!confirmBox) { onYes(); return; }
        confirmBox.innerHTML =
            '<div class="blp-ask-card">' +
                '<div class="blp-ask-ico">?</div>' +
                '<div class="blp-ask-t">' + esc(question) + '</div>' +
                '<div class="blp-ask-s">' + esc(T('当前未保存的改动将丢失', 'Unsaved changes will be lost')) + '</div>' +
                '<div class="blp-ask-row">' +
                    '<button type="button" class="blp-btn" data-a="no">' + esc(T('取消', 'Cancel')) + '</button>' +
                    '<button type="button" class="blp-btn primary" data-a="yes">' + esc(T('切换', 'Switch')) + '</button>' +
                '</div>' +
            '</div>';
        confirmBox.style.display = 'flex';
        confirmBox.onclick = function (e) {
            var b = e.target && e.target.closest && e.target.closest('[data-a]');
            if (!b) { if (e.target === confirmBox) close(); return; }
            var yes = b.getAttribute('data-a') === 'yes';
            close();
            if (yes) onYes();
        };
        function close() { confirmBox.style.display = 'none'; confirmBox.onclick = null; }
    }

    /* ---------------- 保存：弹窗与序列化并行 + 乐观写库 ---------------- */
    function doSave() {
        var meta = M();
        if (!meta) { toast(T('组件尚未就绪，请稍后再试', 'Editor is not ready')); return; }
        var t0 = now();
        busyStart(T('正在保存项目', 'Saving project'), projectName());
        /* 并行：用户填名称/封面时，作品已经在后台序列化好了 */
        var bytesP = meta.captureSb3();
        var dlgP = meta.open({ store: STORE, defaultName: projectName(), title: T('保存当前项目', 'Save current project') });
        Promise.all([dlgP, bytesP]).then(function (r) {
            var m = r[0], bytes = r[1];
            if (!m) { busyEnd(T('已取消', 'Cancelled'), now() - t0); return; }
            m.size = bytes.length;
            /* 乐观更新：先把元数据写进列表并立刻重绘，不等待 IDB 事务 */
            var list = load();
            list.unshift(m);
            if (list.length > 30) list = list.slice(0, 30);
            save(list);
            render();
            busySet(1, 70);
            meta.putFile(m.id, bytes).then(function () {
                var ms = now() - t0;
                busyEnd(T('保存完成', 'Saved'), ms);
                toast(T('已保存', 'Saved') + ' · ' + (ms / 1000).toFixed(2) + ' s');
                try { meta.enhanceLists(); } catch (e) {}
            }, function (e) {
                /* 写库失败：回滚列表，避免留下打不开的卡片 */
                save(load().filter(function (x) { return x.id !== m.id; }));
                render();
                busyEnd(T('保存失败', 'Save failed'), now() - t0);
                toast(T('保存失败：', 'Save failed: ') + ((e && e.message) || e));
            });
        }).catch(function (e) {
            busyEnd(T('保存失败', 'Save failed'), now() - t0);
            toast(T('保存失败：', 'Save failed: ') + ((e && e.message) || e));
        });
    }

    /* ---------------- 切换项目：预取缓存 + 分阶段动画 ---------------- */
    function doLoad(item) {
        var meta = M();
        if (!meta) { toast(T('组件尚未就绪，请稍后再试', 'Editor is not ready')); return; }
        ask(T('切换到「' + item.name + '」？', 'Switch to "' + item.name + '"?'), function () {
            var t0 = now();
            busyStart(T('正在切换项目', 'Switching project'), item.name);
            /* 面板打开时已预取；这里再兜一次，命中内存缓存即零往返 */
            var prefetch = meta.getFile(item.id);
            Promise.resolve(prefetch).then(function () {
                busySet(1, 52);
                return meta.loadSnapshot(item);
            }).then(function () {
                busySet(2, 92);
                return Promise.all([minShow(), new Promise(function (r) {
                    if (window.requestAnimationFrame) requestAnimationFrame(function () { r(); });
                    else setTimeout(r, 0);
                })]);
            }).then(function () {
                var ms = now() - t0;
                busyEnd(T('切换完成', 'Switched'), ms);
                /* 等「完成」这一帧画出来再收起面板 */
                setTimeout(function () {
                    show(false);
                    toast(T('切换完成', 'Switched') + ' · ' + (ms / 1000).toFixed(2) + ' s');
                    try {
                        if (window.requestIdleCallback)
                            requestIdleCallback(function () { meta.enhanceLists(); }, { timeout: 400 });
                        else meta.enhanceLists();
                    } catch (e) {}
                }, 430);
            }).catch(function (e) {
                busyEnd(T('加载失败', 'Load failed'), now() - t0);
                toast(T('加载失败：', 'Load failed: ') + ((e && e.message) || e));
            });
        });
    }

    /* ---------------- 导入作品 ---------------- */
    function bytesToSb3(u8) {
        var IO = window.__blStarIO;
        if (IO && typeof IO.isStar === 'function' && IO.isStar(u8)) return Promise.resolve(IO.restore(u8));
        /* RJ：用同步 zip 读 + B39 暴露的 build 拼回标准 sb3 */
        if (IO && typeof IO.readAll === 'function') {
            try {
                var files = IO.readAll(u8), map = {}, hasMan = false;
                for (var i = 0; i < files.length; i++) {
                    map[files[i].name] = files[i].data;
                    if (files[i].name === 'manifest.json') hasMan = true;
                }
                if (hasMan && window.__blRJ && typeof window.__blRJ.build === 'function') {
                    var res = window.__blRJ.build(map);
                    return Promise.resolve(res.zip);
                }
            } catch (e) { /* 不是 RJ，按 sb3 原样 */ }
        }
        return Promise.resolve(u8);
    }
    function doImport() {
        var meta = M();
        if (!meta) { toast(T('组件尚未就绪，请稍后再试', 'Editor is not ready')); return; }
        var fi = document.createElement('input');
        fi.type = 'file';
        fi.accept = '.sb3,.rj,.star,.zip,application/zip';
        fi.style.display = 'none';
        document.body.appendChild(fi);
        fi.addEventListener('change', function () {
            var f = fi.files && fi.files[0];
            if (f) importFile(f, meta);
            setTimeout(function () { if (fi.parentNode) fi.parentNode.removeChild(fi); }, 0);
        });
        fi.click();
    }
    function importFile(f, meta) {
        var t0 = now();
        busyStart(T('正在导入作品', 'Importing project'), f.name);
        var read = f.arrayBuffer ? f.arrayBuffer().then(function (b) { return new Uint8Array(b); })
            : new Promise(function (res, rej) {
                var r = new FileReader();
                r.onload = function () { res(new Uint8Array(r.result)); };
                r.onerror = function () { rej(new Error('read failed')); };
                r.readAsArrayBuffer(f);
            });
        read.then(function (u8) {
            busySet(1, 46);
            return bytesToSb3(u8);
        }).then(function (sb3) {
            busySet(2, 78);
            return meta.loadSb3(sb3).then(function () { return sb3; });
        }).then(function (sb3) {
            /* 同步写进列表（乐观），文件写库后台完成 */
            var m = {
                id: 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                name: String(f.name || 'import').replace(/\.(sb3|rj|star|zip)$/i, ''),
                version: T('导入', 'Imported'), time: Date.now(), size: sb3.length,
                cover: captureThumb(), thumb: captureThumb(), store: STORE
            };
            var list = load(); list.unshift(m);
            if (list.length > 30) list = list.slice(0, 30);
            save(list); render();
            meta.putFile(m.id, sb3).catch(function () {});
            return minShow();
        }).then(function () {
            var ms = now() - t0;
            busyEnd(T('导入完成', 'Imported'), ms);
            setTimeout(function () {
                show(false);
                toast(T('导入完成', 'Imported') + ' · ' + (ms / 1000).toFixed(2) + ' s');
            }, 430);
        }).catch(function (e) {
            busyEnd(T('导入失败', 'Import failed'), now() - t0);
            toast(T('导入失败：', 'Import failed: ') + ((e && e.message) || e));
        });
    }

    function doExport(item) {
        var meta = M();
        if (!meta) return;
        meta.getFile(item.id).then(function (bytes) {
            if (!bytes && item.data) {
                try { bytes = new Uint8Array(atob(item.data).split('').map(function (c) { return c.charCodeAt(0); })); }
                catch (e) { bytes = null; }
            }
            if (!bytes) { toast(T('作品数据缺失', 'Project data missing')); return; }
            download(bytes, String(item.name || 'project').replace(/[\\/:*?"<>|]/g, '_') + '.sb3');
            toast(T('已导出', 'Exported') + ' · ' + fmtSize(bytes.length));
        });
    }
    function doDelete(item) {
        var list = load().filter(function (x) { return x.id !== item.id; });
        save(list); render();
        try { if (M()) M().delFile(item.id); } catch (e) {}
        toast(T('已删除', 'Deleted'));
    }

    /* ---------------- 小提示 ---------------- */
    function toast(text) {
        var t = panel && panel.querySelector('.blp-toast');
        if (!t) return;
        t.textContent = text;
        t.classList.add('on');
        clearTimeout(t.__timer);
        t.__timer = setTimeout(function () { t.classList.remove('on'); }, 2400);
    }

    /* ---------------- 列表渲染：一次性 Fragment，3 列网格 ---------------- */
    function render() {
        if (!gridEl) return;
        var list = load();
        var q = searchText.trim().toLowerCase();
        var arr = list.filter(function (x) {
            if (!q) return true;
            return (String(x.name || '') + ' ' + String(x.version || '')).toLowerCase().indexOf(q) >= 0;
        });
        if (sortBy === 'name') arr.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
        else if (sortBy === 'size') arr.sort(function (a, b) { return (b.size || 0) - (a.size || 0); });
        else arr.sort(function (a, b) { return (b.time || 0) - (a.time || 0); });

        var frag = document.createDocumentFragment();
        if (!list.length) {
            frag.appendChild(el('div', 'blp-empty',
                '<div class="blp-empty-ico"><i></i></div>' +
                '<div class="blp-empty-t">' + esc(T('还没有保存的项目', 'No saved projects yet')) + '</div>' +
                '<div class="blp-empty-s">' + esc(T('点上方「保存当前项目」，作品会带舞台封面存到这里', 'Click Save current project above — a stage thumbnail will be stored with it')) + '</div>'));
        } else if (!arr.length) {
            frag.appendChild(el('div', 'blp-empty',
                '<div class="blp-empty-t">' + esc(T('没有匹配的作品', 'No matching projects')) + '</div>' +
                '<div class="blp-empty-s">' + esc(T('换个关键词试试', 'Try another keyword')) + '</div>'));
        } else {
            for (var i = 0; i < arr.length; i++) frag.appendChild(card(arr[i], i));
        }
        gridEl.innerHTML = '';
        gridEl.appendChild(frag);
        var stat = panel && panel.querySelector('.blp-stat');
        if (stat) {
            var total = list.reduce(function (s, x) { return s + (Number(x.size) || 0); }, 0);
            stat.innerHTML =
                '<span class="blp-chip"><b>' + list.length + '</b> ' + esc(T('个项目', 'projects')) + '</span>' +
                '<span class="blp-chip"><b>' + esc(fmtSize(total)) + '</b> ' + esc(T('已占用', 'used')) + '</span>' +
                '<span class="blp-chip"><b>' + arr.length + '</b> ' + esc(T('当前显示', 'shown')) + '</span>';
        }
        /* 空闲期预取前 9 个，点「切换」时通常已命中内存缓存 */
        try {
            if (M() && M().prefetch) M().prefetch(list.slice(0, 9).map(function (x) { return x.id; }));
        } catch (e) {}
    }
    function card(item, idx) {
        var c = el('div', 'bl-proj-card');
        c.setAttribute('data-blp', item.id);
        c.style.animationDelay = Math.min(idx, 12) * 28 + 'ms';
        var thumb = item.thumb || item.cover || '';
        c.innerHTML =
            '<div class="blp-thumb">' +
                (thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy">'
                       : '<div class="blp-thumb-none"><span>' + esc(T('无预览', 'No preview')) + '</span></div>') +
                '<span class="blp-badge">' + esc(item.version || '1.0') + '</span>' +
                '<span class="blp-fmt">SB3</span>' +
                '<div class="blp-actions">' +
                    '<button type="button" class="blp-act primary" data-a="load">' + esc(T('切换', 'Switch')) + '</button>' +
                    '<button type="button" class="blp-act" data-a="export">' + esc(T('导出', 'Export')) + '</button>' +
                    '<button type="button" class="blp-act danger" data-a="del">' + esc(T('删除', 'Delete')) + '</button>' +
                '</div>' +
            '</div>' +
            '<div class="blp-info">' +
                '<div class="blp-title" title="' + esc(item.name) + '">' + esc(item.name || T('未命名', 'Untitled')) + '</div>' +
                '<div class="blp-meta"><span>' + esc(fmtTime(item.time)) + '</span><i></i><span>' + esc(fmtSize(item.size)) + '</span></div>' +
            '</div>';
        c.addEventListener('click', function (e) {
            var b = e.target && e.target.closest && e.target.closest('[data-a]');
            if (b) {
                var a = b.getAttribute('data-a');
                if (a === 'load') doLoad(item);
                else if (a === 'export') doExport(item);
                else if (a === 'del') doDelete(item);
                return;
            }
            doLoad(item);
        });
        return c;
    }
    function scheduleRender() {
        if (rafPending) return;
        rafPending = 1;
        if (window.requestAnimationFrame) requestAnimationFrame(function () { rafPending = 0; render(); });
        else setTimeout(function () { rafPending = 0; render(); }, 0);
    }

    /* ---------------- 面板骨架 ---------------- */
    var ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
        '<path d="M3 10h18"/></svg>';

    function buildPanel() {
        panel = el('div', 'bl-proj-panel');
        var head = el('div', 'blp-head',
            '<div class="blp-head-l">' +
                '<div class="blp-eyebrow">START EDITOR · PROJECTS</div>' +
                '<h2>' + esc(T('我的项目', 'My Projects')) + '</h2>' +
                '<p>' + esc(T('带舞台封面的本地作品库 · 切换、导入与导出都在这里', 'Local project library with stage covers — switch, import and export here')) + '</p>' +
            '</div>' +
            '<div class="blp-head-r"><div class="blp-stat"></div></div>');
        panel.appendChild(head);

        var tools = el('div', 'blp-tools');
        var saveBtn = el('button', 'blp-btn primary blp-save',
            '<span class="blp-ico">＋</span>' + esc(T('保存当前项目', 'Save current project')));
        saveBtn.type = 'button';
        saveBtn.addEventListener('click', doSave);
        var importBtn = el('button', 'blp-btn',
            '<span class="blp-ico">↥</span>' + esc(T('导入作品', 'Import')));
        importBtn.type = 'button';
        importBtn.addEventListener('click', doImport);
        var search = el('input', 'blp-search');
        search.type = 'search';
        search.placeholder = T('搜索名称或版本…', 'Search name or version…');
        search.addEventListener('input', function () { searchText = search.value; scheduleRender(); });
        var sort = el('select', 'blp-sort');
        sort.innerHTML = '<option value="time">' + esc(T('最近保存', 'Recently saved')) + '</option>' +
            '<option value="name">' + esc(T('名称 A→Z', 'Name A→Z')) + '</option>' +
            '<option value="size">' + esc(T('体积从大到小', 'Largest first')) + '</option>';
        sort.addEventListener('change', function () { sortBy = sort.value; scheduleRender(); });
        tools.appendChild(saveBtn); tools.appendChild(importBtn);
        tools.appendChild(el('div', 'blp-grow'));
        tools.appendChild(sort); tools.appendChild(search);
        panel.appendChild(tools);

        var body = el('div', 'blp-body');
        gridEl = el('div', 'blp-grid');
        body.appendChild(gridEl);
        panel.appendChild(body);

        footStat = el('div', 'blp-foot',
            '<span class="blp-foot-l">' + esc(T('提示：作品文件存在 IndexedDB，列表只存元信息；切换前会自动预取', 'Tip: project files live in IndexedDB, the list stores metadata only; recent projects are prefetched')) + '</span>' +
            '<span class="blp-foot-r">' + esc(T('准备就绪', 'Ready')) + '</span>');
        panel.appendChild(footStat);

        overlay = el('div', 'blp-overlay');
        overlay.style.display = 'none';
        panel.appendChild(overlay);
        confirmBox = el('div', 'blp-confirm');
        confirmBox.style.display = 'none';
        panel.appendChild(confirmBox);
        panel.appendChild(el('div', 'blp-toast'));

        render();
    }

    function show(on) {
        if (!hostEl || !panel || !tabEl) return;
        if (on) {
            hostEl.classList.add('bl-proj-active');
            tabEl.classList.add('is-on');
            panel.style.display = '';
            scheduleRender();
        } else {
            hostEl.classList.remove('bl-proj-active');
            tabEl.classList.remove('is-on');
            panel.style.display = 'none';
        }
    }
    function mount() {
        var ul = document.querySelector('ul[class*="gui_tab-list_"]');
        if (!ul) return false;
        if (tabEl && tabEl.parentNode) return true;
        hostEl = ul.parentElement;
        if (!hostEl) return false;
        if (!hostEl.querySelector('[class*="gui_tab-panel_"]') && hostEl.parentElement &&
            hostEl.parentElement.querySelector('[class*="gui_tab-panel_"]')) hostEl = hostEl.parentElement;
        if (!panel) buildPanel();
        panel.style.display = 'none';
        (hostEl.appendChild ? hostEl : hostEl.parentElement).appendChild(panel);
        tabEl = document.createElement('li');
        tabEl.className = 'gui_tab_27Unf bl-py-tab bl-proj-tab';
        tabEl.setAttribute('role', 'tab');
        tabEl.innerHTML = ICON + '<span>' + esc(T('项目', 'Projects')) + '</span>';
        tabEl.addEventListener('click', function (e) {
            e.stopPropagation();
            show(true);            /* 幂等打开，与 B52 互斥体系一致 */
        });
        ul.appendChild(tabEl);
        return true;
    }
    var bootTimer = null;
    function boot() {
        var tries = 0;
        bootTimer = setInterval(function () {
            tries++;
            if (mount() || tries > 90) clearInterval(bootTimer);
        }, 320);
        window.addEventListener('resize', function () {
            if (tabEl && !tabEl.parentNode) { tabEl = null; mount(); }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    window.__blProjects = {
        save: doSave, import: doImport, list: load, vm: vm,
        captureThumb: captureThumb, close: function () { show(false); },
        show: show, render: render, grid: function () { return gridEl; }
    };
    if (window.__blSync) window.__blSync.register('B96-projects', mount);
})();
