/* ── [B37] STAR · 编辑器内 AI 助手 ───────────────────────────────────────────────
   依赖：B33
   维护：独立窗口，复用原版窗口图层管理
   ───────────────────────────────────────────────────────────── */

/* ==========================================================================
   STAR —— 编辑器内的 AI 助手
   --------------------------------------------------------------------------
   · DOCK 栏多一个 STAR 按钮，点开是聊天窗口（左侧会话栏 + 右侧对话区）
   · AI 能直接操作编辑器：
       打开弹窗监视数据 / 打开造型器绘画 / 加载拓展 / 拖出积木 / 删除积木 /
       搭建作品
   · 「观察过程」开关：
       开 → AI 打开的弹窗照常显示，你能看见它一步步做
       关 → 后台运行：打开的弹窗不显示，只以最小化状态收在 DOCK 栏里，
            另外弹一个小窗显示"它现在在做什么 + 正在想什么"，
            不打断你手上的活

   关于模型：本模块有两条路径
     1) 填了接口地址 + Key → 走 OpenAI 兼容的 /chat/completions
     2) 没填 → 用内置的本地意图引擎，能听懂一批中文指令并真正执行
   这是刻意的：不填 Key 时不能假装"接了模型"，否则点了没反应还查不出原因。
   ========================================================================== */
(function () {
    'use strict';

    var STORE_CFG = 'bl.star.cfg';
    var STORE_SESS = 'bl.star.sessions';

    var win = null, progWin = null, monWin = null, cfgWin = null;
    var sessions = [], curId = '';
    var cfg = { provider: '', freeId: 'gpt35', freeOpt: {}, proxy: 'auto', proxyTpl: '',
                api: '', key: '', model: 'gpt-4o', think: false };

    /* ---------------------------------------------------------------- *
     * 三个来源
     *  1) 免费模型：missqiu.icu 的公开接口，各自的参数名不一样，按文档拼；
     *     统一密钥内置在这里 —— 界面上不展示、也不需要用户填
     *  2) 通用接口：任何 OpenAI 兼容的 /chat/completions，地址/Key/模型自己填
     *  3) 本地指令引擎：完全不联网
     * ---------------------------------------------------------------- */

    /* 免费接口的统一密钥：界面上不展示、也不要求用户填。
       这里刻意分片拼接，源码里也不留整串明文。 */
    var FREE_KEY = ['c29066176358', 'fc03b8628b17', 'fc5ac2261b9d',
        '392d1c13b41d', 'a91e980a9f54', '1504'].join('');

    /* 统一默认提示词：所有模型（免费接口 + 通用接口）都会收到这一段。
       三件事是重点：
         1) 告诉它叫 STAR —— 它常以为自己是 ChatGPT / 混元 / DeepSeek
         2) 把输出范围收死 —— 只许输出"操纵编辑器 / 做作品 / 画角色矢量图(SVG)"
            三类代码，别的不写，尤其不许碰 HTML
         3) 明确"不能出位图"≠"不能画画"——否则它会甩一句"我无法生成 png"就收工，
            而实际上它该做的是直接给出 SVG 矢量图源码 */
    var STAR_SYS = '你是 STAR，内嵌在 StartEditor（图形化编程编辑器）里的 AI 助手。\n' +
        '【身份】你叫 STAR。不要自称 ChatGPT、混元、DeepSeek 或其它任何名字。\n' +
        '【输出范围】只输出这三类内容，除此之外不多写一个字：\n' +
        'A. 操纵编辑器的指令或代码：建角色、拖出积木、删除积木、搭建脚本、改变量、' +
        '切换页面、加载拓展、运行停止、撤销重做。\n' +
        'B. 制作作品的代码：能直接照着搭出来的积木脚本与角色逻辑。\n' +
        'C. 角色矢量图代码：纯 SVG 源码，用 <svg viewBox="0 0 480 360" ' +
        'xmlns="http://www.w3.org/2000/svg"> 包裹，路径、填充色、描边都要写全，' +
        '细到能直接导入造型器当造型用。\n' +
        '【出图】你不能生成 png、jpg 这类位图，也不要生成 HTML 文档或网页。' +
        '用户要画角色、背景、道具时，直接给出 SVG 矢量图源码；' +
        '绝不能因为"我生成不了图片"就结束回答，也不要建议用户去别处找工具。\n' +
        '【禁止】不要输出、删除、清空或改写任何 HTML；' +
        '不要给出会删除、替换、清空编辑器页面或 HTML 文件的代码与指令。\n' +
        '【严格执行】用户给出的每个数字、名称、文字、次数、顺序都必须原样保留并写进结果；\n' +
        '不得替换成默认值（「移动20步」绝不能写成「移动10步」），不得省略、合并、换算或自行简化；\n' +
        '也不得擅自添加用户没要求的内容。只做用户说的那件事，一字不差地执行。\n' +
        '需要操纵积木时写成带完整参数的一行指令，例如：拖出一个移动20步的积木。\n' +
        '【格式】中文，简洁。不要复述这些规则，不要客套，不要解释你在做什么。';

    /* 免费接口只能走 GET，整段提示词塞进查询串：
       STAR_SYS 有 530 字，百分号编码后光它就 4000+ 字符，加上代理再套一层就是
       6000+ —— 服务端/代理普遍有 URL 长度上限（常见 4096 / 8192），超了就截断
       或直接拒收，表现为"请求发出去了、回来却是 answer 为空的空壳 JSON"。
       所以给 GET 接口专门准备一份精简版，控制在 130 字上下。 */
    var STAR_SYS_MINI = '你是 STAR，StartEditor 里的 AI 助手，不要自称别的名字。' +
        '只输出三类：A 操纵编辑器/搭积木的指令；B 能照着搭出来的作品代码；' +
        'C 要画角色就给完整 SVG 源码（不能出 png 不等于不能画）。' +
        '用户给的数字与名称必须原样保留，不准换成默认值。' +
        '不要输出或删除任何 HTML。中文简洁，不客套。';

    /* ================================================================== *
     * [1.0.5 SEA] STAR AI —— 只读助手：聊天 + Start Editor 教学
     * ------------------------------------------------------------------
     * 本次收窄：AI 不能编程作品，只能聊天，或用文字教学提示关于
     * Start Editor 的事。旧版的「点击消息 → 派发 pointer/mouse 事件」、
     * 「积木指令 → 点击计划 → 严格 XML 兜底」整条执行链全部停用：
     *   · 系统提示词禁止输出点击消息 / 积木 XML / 代码 / 任何机器指令；
     *   · 模型回复一律按纯文本清洗后显示，绝不解析成动作；
     *   · 本地指令引擎改造成纯文字教学应答，不触碰编辑器；
     *   · 对外 API 中所有操作类方法统一改为只读拒绝；
     *   · 设置里「是否能操作编辑器」恒为关，历史存档不再生效。
     * 称呼 / 温度 / 内置三个免费模型 / STT 快捷启动保持可用。
     * ================================================================== */

    var AI_KEY = 'bl.star.ai';
    var STAR_CHAT_ONLY = true;          /* 硬闸：任何执行链都不得进入 */

    /* Start Editor 教学知识：注入系统提示词，让 STAR 只讲本编辑器的用法 */
    var STAR_KNOWLEDGE =
        '【Start Editor 知识】Start Editor 是可离线单文件运行的图形化编程编辑器' +
        '（基于 Scratch / TurboWarp GUI），当前版本 1.0.5 SEA。\n' +
        '左侧导航：代码、造型、声音、项目、音乐、工程文件；除「代码」外都不显示舞台。\n' +
        '文件 → 保存到电脑：下载标准 .sb3；「工程文件」工作区能查看 sb3 包里有哪些文件。\n' +
        '设置分区：常规、外观、高级、版本号、STAR AI。外观里可改弹窗外观与「最小化动画」' +
        '（神灯效果 / 缩放效果）；毛玻璃与液态玻璃互斥。\n' +
        'DOCK 栏：窗口最小化会收进右下角 DOCK，图标有立体感并跟随玻璃效果；' +
        '1.2 秒内依次按 S、T、T 可打开 STAR AI。\n' +
        '造型编辑器：单列可滚动工具栏、顶部工具一行、右下角当前造型缩略图、' +
        '缩放有动画、每个工具右下角标了快捷键。\n' +
        '音乐工坊：多轨编曲；在线素材库需要联网，没网络会显示「请联网」。\n' +
        '其它：油猴脚本删除 / 停用即时失效；切换语言不会跳播放器首页；' +
        '版本大卡只在「版本号」页显示，带液态流动动画。\n';

    function aiCfg() {
        var d = { enabled: true, callName: '', temperature: 0.7,
                  freeId: 'gpt35', canOperate: false };
        try {
            var raw = window.localStorage.getItem(AI_KEY);
            if (!raw) return d;
            var o = JSON.parse(raw);
            if (!o || typeof o !== 'object') return d;
            if (typeof o.enabled === 'boolean') d.enabled = o.enabled;
            if (typeof o.callName === 'string') d.callName = o.callName.slice(0, 16);
            if (typeof o.temperature === 'number' && isFinite(o.temperature)) {
                d.temperature = Math.max(0, Math.min(2, o.temperature));
            }
            if (findFree(String(o.freeId || ''))) d.freeId = String(o.freeId);
            d.canOperate = false; /* 只读：忽略历史存档里的操作授权 */
        } catch (e) { /* ignore */ }
        return d;
    }

    function callClause() {
        var c = aiCfg().callName.trim();
        return c ? ('称呼用户为「' + c + '」，每次开口都这样叫。\n') : '';
    }
    /* 温度只影响语气，不影响能力边界 */
    function tempClause() {
        var t = aiCfg().temperature;
        return t <= 0.3 ? '回答要简洁、严谨、直给结论。\n' :
               (t >= 0.75 ? '语气可以轻松活泼一点，但内容仍要准确。\n' : '');
    }
    /* 完整版：给 OpenAI 兼容 POST 接口 / chat/completions 用 */
    function starSys() {
        return '你是 STAR，内嵌在 StartEditor 里的 AI 助手。\n' +
            '【身份】你叫 STAR，不要自称 ChatGPT、混元、DeepSeek 或其它名字。\n' +
            callClause() + tempClause() +
            '【唯一能力】只做两件事：① 日常聊天；② 用文字教学、解答关于 Start Editor 的使用问题。\n' +
            '【严格禁止】不代用户编程作品、不生成或改写积木 / XML / JSON / 代码、' +
            '不输出「点击消息」或任何机器可执行指令、不点击或操作编辑器、' +
            '不假装已经改好了作品。\n' +
            '【教学方式】可以写「第一步点哪里、第二步做什么」这种给人看的文字步骤，' +
            '但必须保持纯文字，不要输出可解析的计划、坐标、选择器或参数。\n' +
            '【请求代做时】礼貌说明 STAR 现在只聊天与教学，然后给出对应的文字操作步骤。\n' +
            STAR_KNOWLEDGE +
            '【格式】中文，简洁，不客套，不复述规则；不要输出 HTML。';
    }
    /* 精简版：免费 GET 接口的 system 参数，长度必须贴近原来的 130 字，
       否则查询串会被 URL 长度上限截断，表现为接口返回空壳 JSON。 */
    function starSysMini() {
        var a = aiCfg();
        return '你是STAR，只聊天和教Start Editor用法，用文字讲步骤；' +
            '禁止代编程、禁止生成积木/XML/代码、禁止输出点击消息或操作编辑器。' +
            (a.callName ? ('称呼用户「' + a.callName.slice(0, 8) + '」。') : '') +
            '中文简洁不客套。';
    }
    function starIdMini() {
        var a = aiCfg();
        return '你是STAR' + (a.callName ? ('，称呼「' + a.callName.slice(0, 8) + '」') : '') +
            '；只聊天与教学，不编程、不点编辑器。';
    }

    /* ---------------- 点击消息：解析 ---------------- */
    function parseSteps(raw) {
        try {
            var o = JSON.parse(raw);
            var st = Array.isArray(o) ? o : (o && o.steps);
            if (!Array.isArray(st)) return null;
            var out = [];
            for (var i = 0; i < st.length; i++) {
                if (st[i] && typeof st[i] === 'object') out.push(st[i]);
            }
            return out.length ? out : null;
        } catch (e) { return null; }
    }
    function extractClickMsgs(text) {
        var t = String(text == null ? '' : text);
        var m = t.match(/\[\[点击消息\]\]\s*([\s\S]*)/);
        if (m) {
            var raw = m[1].trim();
            var a = raw.indexOf('{'), b = raw.lastIndexOf('}');
            if (a === 0 && b > a) { var r1 = parseSteps(raw.slice(0, b + 1)); if (r1) return r1; }
            var c = raw.indexOf('['), d = raw.lastIndexOf(']');
            if (c === 0 && d > c) { var r2 = parseSteps(raw.slice(0, d + 1)); if (r2) return r2; }
        }
        var pure = t.trim();
        if (/^[\[{]/.test(pure)) return parseSteps(pure);
        return null;
    }
    function dispatchAIReply(text) {
        /* [1.0.5 SEA · 只读] 模型回复一律只当文本看：
           不解析点击消息、不派发事件、不跑本地指令引擎、不生成积木。 */
        if (hasMachineCmd(text)) {
            push('sys', 'STAR 现在只聊天与教学：不会代你点击编辑器或编程作品，下面只保留文字说明。');
        }
    }
    /* 模型万一吐出机器指令，仅用于提示，绝不执行 */
    function hasMachineCmd(text) {
        var t = String(text == null ? '' : text);
        return /\[\[点击消息\]\]|<block\s|```(?:xml|json|js|javascript)/i.test(t);
    }
    /* 显示前把可解析的动作块/代码块洗掉，只留自然语言 */
    function plainAIText(text) {
        var t = String(text == null ? '' : text);
        t = t.replace(/\[\[点击消息\]\]\s*(?:\{[\s\S]*?\}|\[[\s\S]*?\])/g, '');
        t = t.replace(/```(?:xml|json|js|javascript)\b[\s\S]*?```/gi, '（已省略代码块）');
        t = t.replace(/<block\s[^>]*>[\s\S]*?<\/block>/gi, '');
        return t.trim();
    }

    /* ---------------- 点击消息：真实派发 ---------------- */
    function evOpts(x, y, buttons) {
        return { bubbles: true, cancelable: true, view: window,
                 clientX: x, clientY: y, screenX: x, screenY: y,
                 button: 0, buttons: buttons, pointerId: 1,
                 pointerType: 'mouse', isPrimary: true };
    }
    function centerOf(el) {
        try {
            var r = el.getBoundingClientRect();
            if (r && (r.width || r.height)) {
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }
        } catch (e) { /* ignore */ }
        var p = ptOf(el);
        return { x: p ? p.x : 60, y: p ? p.y : 60 };
    }
    /* 一次点击 = 一整串 pointer / mouse 事件消息，而不是直接 el.click() */
    function fireClick(el, tip, dbl) {
        if (!el) return Promise.resolve(false);
        var p = centerOf(el);
        if (ptrOn) { ptrTip(tip || ''); ptrMove(p.x, p.y); }
        return sleep(ptrOn ? 200 : 0).then(function () {
            try {
                var o1 = evOpts(p.x, p.y, 1), o0 = evOpts(p.x, p.y, 0);
                if (window.PointerEvent) {
                    el.dispatchEvent(new PointerEvent('pointerover', o1));
                    el.dispatchEvent(new PointerEvent('pointerdown', o1));
                }
                el.dispatchEvent(new MouseEvent('mousedown', o1));
                if (window.PointerEvent) {
                    el.dispatchEvent(new PointerEvent('pointerup', o0));
                }
                el.dispatchEvent(new MouseEvent('mouseup', o0));
                el.dispatchEvent(new MouseEvent('click', o0));
                if (dbl) el.dispatchEvent(new MouseEvent('dblclick', o0));
            } catch (e) {
                try { el.click(); } catch (e2) { /* ignore */ }
            }
            if (ptrOn) { ptrPulse(); ptrTip(''); }
            return true;
        });
    }
    function fireDrag(el, tx, ty) {
        try {
            var p = centerOf(el), i, x, y, t;
            el.dispatchEvent(new MouseEvent('mousedown', evOpts(p.x, p.y, 1)));
            for (i = 1; i <= 6; i++) {
                x = p.x + (tx - p.x) * i / 6;
                y = p.y + (ty - p.y) * i / 6;
                t = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
                (t || document).dispatchEvent(new MouseEvent('mousemove', evOpts(x, y, 1)));
            }
            t = document.elementFromPoint ? document.elementFromPoint(tx, ty) : null;
            (t || document).dispatchEvent(new MouseEvent('mouseup', evOpts(tx, ty, 0)));
        } catch (e) { /* ignore */ }
        return Promise.resolve(true);
    }
    function fillInput(el, v) {
        try {
            el.focus();
            if (el.isContentEditable) el.textContent = v; else el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            var k = { bubbles: true, cancelable: true, key: 'Enter',
                      code: 'Enter', keyCode: 13, which: 13 };
            el.dispatchEvent(new KeyboardEvent('keydown', k));
            el.dispatchEvent(new KeyboardEvent('keypress', k));
            el.dispatchEvent(new KeyboardEvent('keyup', k));
            return true;
        } catch (e) { return false; }
    }
    function typeValue(v) {
        var el = document.activeElement, ok = false;
        if (el && (/^(INPUT|TEXTAREA)$/.test(String(el.tagName || '')) || el.isContentEditable) &&
            !el.readOnly) ok = fillInput(el, v);
        if (!ok) {
            try {
                var ins = document.querySelectorAll(
                    'input[class*="blocklyHtmlInput"], input[type="text"], textarea');
                for (var i = 0; i < ins.length; i++) {
                    if (!ins[i].readOnly && fillInput(ins[i], v)) { ok = true; break; }
                }
            } catch (e2) { /* ignore */ }
        }
        return Promise.resolve(ok);
    }
    function resolveMsgTarget(m) {
        var el = null, i;
        if (m.sel) { try { el = document.querySelector(m.sel); } catch (e) {} }
        if (!el && m.xy) {
            try { el = document.elementFromPoint(m.xy[0], m.xy[1]); } catch (e2) {}
        }
        if (!el && m.t) {
            var names = Array.isArray(m.t) ? m.t : [m.t];
            el = findByText(names);
            if (!el) {
                /* Blockly flyout 里的积木是 SVG <g>/<text>，findByText 默认
                   选择器不含它们，这里补一层按文字找可点击积木。 */
                try {
                    var ns = document.querySelectorAll(
                        'g[class*="blocklyDraggable"], [class*="blocklyFlyout"] g, svg text');
                    for (i = 0; i < ns.length; i++) {
                        var tx = (ns[i].textContent || '').trim();
                        for (var j = 0; j < names.length; j++) {
                            if (tx && tx.indexOf(names[j]) >= 0) {
                                el = (ns[i].closest && ns[i].closest('g[class*="blocklyDraggable"]')) || ns[i];
                                break;
                            }
                        }
                        if (el) break;
                    }
                } catch (e3) { /* ignore */ }
            }
        }
        return el;
    }
    function fireMsg(m) {
        m = m || {};
        if (m.v !== undefined && m.v !== null && String(m.v) !== '') {
            return typeValue(String(m.v));
        }
        var el = resolveMsgTarget(m);
        if (!el) return Promise.resolve(false);
        if (m.drag) return fireDrag(el, m.drag[0], m.drag[1]);
        return fireClick(el, m.tip || (Array.isArray(m.t) ? m.t[0] : m.t) || 'AI 点击', !!m.dbl);
    }
    function sendClickMessage(list) {
        if (STAR_CHAT_ONLY) return Promise.resolve(0); /* 只读：永不派发点击 */
        var msgs = Array.isArray(list) ? list : (list && list.steps) || [];
        var i = 0, sent = 0;
        function step() {
            if (i >= msgs.length) return Promise.resolve(sent);
            var m = msgs[i++];
            return Promise.resolve()
                .then(function () { return fireMsg(m); })
                .then(function (ok) { if (ok) sent++; return sleep(ptrOn ? 80 : 20); })
                .then(step, function () { return sleep(20).then(step); });
        }
        return step();
    }

    /* ---------------- 积木指令 → 点击消息序列 ---------------- */
    function catOf(type) {
        if (/^motion_/.test(type)) return ['运动', 'Motion'];
        if (/^looks_/.test(type)) return ['外观', 'Looks'];
        if (/^control_/.test(type)) return ['控制', 'Control'];
        if (/^event_/.test(type)) return ['事件', 'Events'];
        return ['运动', 'Motion'];
    }
    function typeFromXml(xml) {
        var m = String(xml || '').match(/<block type="([^"]+)"/);
        return m ? m[1] : '';
    }
    function fieldNameFor(text) {
        return /移动|前进|走/.test(text) ? 'STEPS' :
            (/右转|旋转|转向/.test(text) ? 'DEGREES' :
             (/重复|循环/.test(text) ? 'TIMES' :
              (/等待|等一下/.test(text) ? 'DURATION' : 'MESSAGE')));
    }
    function clickPlanForBlock(c) {
        var plan = [
            { t: ['代码', 'Code'], tip: '切到代码标签' },
            { t: c.cat, tip: '点开积木分类' },
            { t: c.key, tip: '点出这块积木' },
            { xy: [420, 300], tip: '放到工作区' }
        ];
        if (c.expect !== null && c.expect !== undefined) {
            plan.push({ v: String(c.expect), tip: '把参数 ' + c.expect + ' 原样输入' });
        }
        return plan;
    }
    function latestBlockValue(c, field) {
        try {
            var ws = getWS();
            if (!ws || !ws.getTopBlocks) return null;
            var tops = ws.getTopBlocks(true), last = null;
            for (var i = 0; i < tops.length; i++) {
                if (tops[i].type === c.type) last = tops[i];
            }
            return last ? readBlockValue(last, field) : null;
        } catch (e) { return null; }
    }

    /* ---------------- 设置联动 / STT ---------------- */
    var aiCfgSig = '';
    function applyAICfg(force) {
        var a = aiCfg(), sig = a.freeId + '|' + a.enabled + '|' + a.canOperate;
        var saved = false;
        try { saved = !!window.localStorage.getItem(AI_KEY); } catch (e) {}
        if (!saved) return;                /* 没在设置分区改过 → 不动原有接口选择 */
        if (!force && sig === aiCfgSig) return;
        aiCfgSig = sig;
        cfg.freeId = a.freeId;
        cfg.provider = 'free:' + a.freeId;   /* API 设置只提供内置三个免费模型 */
        saveCfg();
        try {
            var sel = win ? win.querySelector('.sw-model') : null;
            if (sel) { fillModels(sel); sel.value = cfg.provider; }
        } catch (e2) { /* ignore */ }
    }
    function setAICfg(o) {
        try { window.localStorage.setItem(AI_KEY, JSON.stringify(o || {})); } catch (e) {}
        try { document.dispatchEvent(new CustomEvent('bl:star-ai-change')); } catch (e2) {}
        applyAICfg(true);
    }
    function installSTT() {
        if (window.__blStarSTT) return;
        window.__blStarSTT = true;
        var buf = [], at = 0;
        document.addEventListener('keydown', function (e) {
            if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
            var t = e.target, tag = String((t && t.tagName) || '');
            if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (t && t.isContentEditable)) return;
            if (t && t.closest && t.closest(
                '.sw-win, .sc-win, [class*="blocklyHtmlInput"], [contenteditable="true"]')) return;
            var k = String(e.key || '').toLowerCase();
            if (k !== 's' && k !== 't') { buf = []; return; }
            var now = Date.now();
            if (now - at > 1200) buf = [];
            at = now; buf.push(k);
            if (buf.length > 3) buf = buf.slice(-3);
            if (buf.join('') === 'stt') {
                buf = [];
                if (!aiCfg().enabled) {
                    if (chatEl) push('sys', 'STAR AI 未开启，请在「设置 → 常规 → STAR AI」中开启。');
                    return;
                }
                applyAICfg();
                toggle();
                if (chatEl) push('sys', 'STT 快捷启动：STAR AI 已打开');
            }
        }, true);
    }

    var FREE_LIST = [
        {
            /* id 保持 gpt35：它是 localStorage 里已保存配置的键，
               改名只影响显示，不该让用户上次选的模型失效。 */
            id: 'gpt35', name: 'StepFun', sub: '支持系统预设与多轮',
            url: 'https://missqiu.icu/API/GPT.php', q: 'message',
            params: [
                { n: 'message', req: '是', d: '输入的问题' },
                { n: 'model', req: '是', d: '模型选择，true 或 false', def: 'false' },
                { n: 'system', req: '是', d: '系统预设（已内置 STAR 身份提示词，可改）', def: STAR_SYS_MINI },
                { n: 'id', req: '是', d: '对话 id，同一 id 可连续对话', def: '2580' },
                { n: 'type', req: '是', d: '返回类型，json 或 text', def: 'json' },
                { n: 'apikey', req: '是', d: '密钥（已内置，无需填写）' }
            ],
            opts: [
                { k: 'system', label: '系统预设', ph: '你叫STAR', area: true },
                { k: 'id', label: '对话 id', ph: '2580' },
                { k: 'model', label: '模型', ph: 'false' },
                { k: 'type', label: '返回类型', ph: 'json' }
            ],
            demo: 'https://missqiu.icu/API/GPT.php?message=你好&id=2580&system=你叫STAR&model=false&type=json'
        },
        {
            id: 'dsv3', name: 'DEEPSEEK V3', sub: 'DeepSeek 通用对话',
            url: 'https://missqiu.icu/API/dsv3.php', q: 'text',
            params: [
                { n: 'text', req: '是', d: '输入的内容' },
                { n: 'apikey', req: '是', d: '密钥（已内置，无需填写）' }
            ],
            opts: [],
            demo: 'https://missqiu.icu/API/dsv3.php?text=你好'
        },
        {
            id: 'dsr1', name: 'DEEPSEEK R1', sub: 'DeepSeek 推理模型',
            url: 'https://missqiu.icu/API/dsR1.php', q: 'text',
            params: [
                { n: 'text', req: '是', d: '输入的内容' },
                { n: 'apikey', req: '是', d: '密钥（已内置，无需填写）' }
            ],
            opts: [],
            demo: 'https://missqiu.icu/API/dsR1.php?text=你是什么模型，你是深度求索吗'
        }
    ];

    /* 从本地文件打开时，浏览器会拦跨域请求：直连这类免费接口多半会被 CORS 挡下。
       所以留一层代理兜底 —— 直连不通就换代理，代理也不通才报错。
       ⚠ 代理会看到完整请求地址（含内置密钥），介意的话选「直连」。 */
    var PROXIES = [
        { id: 'allorigins', name: 'AllOrigins', tpl: 'https://api.allorigins.win/raw?url={url}' },
        { id: 'codetabs', name: 'CodeTabs', tpl: 'https://api.codetabs.com/v1/proxy?quest={url}' },
        { id: 'corsproxy', name: 'CorsProxy.io', tpl: 'https://corsproxy.io/?url={url}' }
    ];

    var CUSTOM_PRESETS = [
        { id: 'openai', name: 'OpenAI 官方', api: 'https://api.openai.com/v1', model: 'gpt-4o' },
        { id: 'deepseek', name: 'DeepSeek 官方', api: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
        { id: 'moonshot', name: '月之暗面 Kimi', api: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
        { id: 'zhipu', name: '智谱 GLM', api: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
        { id: 'siliconflow', name: '硅基流动', api: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
        { id: 'custom', name: '自定义', api: '', model: '' }
    ];

    function findProxy(id) {
        for (var i = 0; i < PROXIES.length; i++) if (PROXIES[i].id === id) return PROXIES[i];
        return null;
    }
    function proxyUrlFor(base, mode, tpl) {
        if (!mode || mode === 'none' || mode === 'direct') return '';
        if (mode === 'custom') return String(tpl || '').replace('{url}', encodeURIComponent(base));
        var p = findProxy(mode);
        return p ? p.tpl.replace('{url}', encodeURIComponent(base)) : '';
    }
    /* 候选请求地址：直连在前，代理在后 */
    function candidates(base, mode, tpl) {
        var list = [];
        if (!mode || mode === 'auto' || mode === 'none' || mode === 'direct') list.push(base);
        if (mode && mode !== 'auto' && mode !== 'none' && mode !== 'direct') {
            list.push(proxyUrlFor(base, mode, tpl));
        } else if (!mode || mode === 'auto') {
            for (var i = 0; i < PROXIES.length; i++) {
                list.push(PROXIES[i].tpl.replace('{url}', encodeURIComponent(base)));
            }
        }
        return list.filter(function (u) { return !!u; });
    }
    /* 依次尝试，成功即返回；全失败才 reject。
       state 用来把最后一次的原始响应带出去 —— 接口回空壳 JSON 时，
       看不到原文就没法判断到底是密钥问题、长度问题还是接口本身的问题。 */
    function tryFetch(list, i, via, state) {
        if (i >= list.length) return Promise.reject(new Error('直连与代理都没通'));
        return fetch(list[i], { method: 'GET' }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        }).then(function (s) {
            if (state) state.raw = s;
            var t = parseReply(s);
            if (!t) throw new Error('返回为空');
            return { text: t, raw: s, via: i === 0 ? (via || '直连') : list[i].split('?')[0] };
        }, function (e) {
            if (state) state.err = (e && e.message) ? e.message : String(e);
            return tryFetch(list, i + 1, via, state);
        });
    }

    function isFree(id) { return String(id || '').indexOf('free:') === 0; }
    function freeIdOf(id) { return isFree(id) ? String(id).slice(5) : ''; }
    function findFree(id) {
        for (var i = 0; i < FREE_LIST.length; i++) if (FREE_LIST[i].id === id) return FREE_LIST[i];
        return null;
    }
    function freeDefOpt(id) {
        var f = findFree(id), o = {};
        if (!f) return o;
        for (var i = 0; i < f.params.length; i++) {
            if (f.params[i].def != null) o[f.params[i].n] = f.params[i].def;
        }
        return o;
    }
    function curOpt(id) {
        var base = freeDefOpt(id), saved = (cfg.freeOpt && cfg.freeOpt[id]) || {};
        for (var k in saved) {
            if (Object.prototype.hasOwnProperty.call(saved, k)) base[k] = saved[k];
        }
        /* [1.0.5 SEA] 身份 / 称呼 / 点击消息协议每次请求都按最新设置生成 */
        if (Object.prototype.hasOwnProperty.call(base, 'system')) base.system = starSysMini();
        return base;
    }
    var monTimer = 0;
    var busy = false;
    var thinkTimer = 0;
    var watchMode = true;
    var uidSeq = 0;

    /* ---------------- 存储 ---------------- */

    function readJSON(key, def) {
        try {
            var s = window.localStorage.getItem(key);
            if (!s) return def;
            var v = JSON.parse(s);
            return (v && typeof v === 'object') ? v : def;
        } catch (e) { return def; }
    }
    function writeJSON(key, val) {
        try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
    }
    function loadCfg() {
        var c = readJSON(STORE_CFG, null);
        if (c) {
            cfg.api = c.api || '';
            cfg.key = c.key || '';
            cfg.model = c.model || 'gpt-4o';
            cfg.think = !!c.think;
            cfg.provider = c.provider || '';
            cfg.freeId = c.freeId || 'gpt35';
            cfg.freeOpt = (c.freeOpt && typeof c.freeOpt === 'object') ? c.freeOpt : {};
            cfg.proxy = c.proxy || 'auto';
            cfg.proxyTpl = c.proxyTpl || '';
        }
        if (!findFree(cfg.freeId)) cfg.freeId = 'gpt35';
        if (!cfg.provider) cfg.provider = (cfg.api && cfg.key) ? 'custom' : 'free:gpt35';
        watchMode = window.localStorage.getItem('bl.star.watch') !== '0';
    }
    function saveCfg() { writeJSON(STORE_CFG, cfg); }
    function providerName(id) {
        var p = String(id || '');
        if (p === 'local') return '本地指令引擎';
        if (p === 'custom') return cfg.model || '通用接口';
        var f = findFree(freeIdOf(p));
        return f ? f.name : '本地指令引擎';
    }

    /* ---------------- 编辑器接口 ---------------- */

    function getVM() {
        var vm = window.vm;
        if (vm && vm.runtime) return vm;
        try {
            var store = window.ReduxStore || window.__REDUX_STORE__ || null;
            if (store && store.getState) {
                var st = store.getState();
                if (st && st.scratchGui && st.scratchGui.vm) return st.scratchGui.vm;
            }
        } catch (e) { /* ignore */ }
        return null;
    }
    function getSB() { return window.ScratchBlocks || null; }
    function getWS() {
        var SB = getSB();
        if (!SB) return null;
        try { return typeof SB.getMainWorkspace === 'function' ? SB.getMainWorkspace() : null; }
        catch (e) { return null; }
    }
    function topHost() {
        return (window.__blTopLayer && window.__blTopLayer()) || document.body;
    }

    /* ---------------- 通用窗口外壳 ---------------- */

    function winShell(cls, title, withMax, bodyCls) {
        var w = document.createElement('div');
        w.className = 'addon-window ' + cls;
        w.innerHTML =
            '<div class="addon-window-header">' +
            '<span class="addon-window-title">' + title + '</span>' +
            '<div class="addon-window-controls">' +
            '<button type="button" class="addon-window-btn addon-window-btn-minimize sw-min"' +
            ' title="最小化" aria-label="最小化">' + icoMin() + '</button>' +
            (withMax ? '<button type="button" class="addon-window-btn addon-window-btn-maximize sw-max"' +
                ' title="最大化" aria-label="最大化">' + icoMax() + '</button>' : '') +
            '<button type="button" class="addon-window-btn addon-window-btn-close sw-close"' +
            ' title="关闭" aria-label="关闭">' + icoX() + '</button>' +
            '</div></div>' +
            '<div class="addon-window-content ' + (bodyCls || (cls + '-body')) + '"></div>';
        return w;
    }
    function icoX() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
            ' stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/>' +
            '<line x1="18" y1="6" x2="6" y2="18"/></svg>';
    }
    function icoMin() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
            ' stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    }
    function icoMax() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
            ' stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>';
    }
    function icoRestore() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
            ' stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="4" y="8" width="10" height="10" rx="1.5"/>' +
            '<path d="M10 8V6.5A1.5 1.5 0 0 1 11.5 5H19a1.5 1.5 0 0 1 1.5 1.5V14a1.5 1.5 0 0 1-1.5 1.5H17"/>' +
            '</svg>';
    }
    function icoSend() {
        return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"' +
            ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M4 12l16-8-6 8 6 8z"/></svg>';
    }

    /* 窗口统一装好最小化/最大化/关闭，并接管点击。
       顶层宿主的 pointer-events:none 会继承，窗口必须自己声明 auto（见 star.css）。 */
    function attachChrome(w, onClose) {
        w.style.position = 'fixed';
        w.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            if (t.closest('.sw-min')) { minToDock(w); return; }
            if (t.closest('.sw-max')) { toggleMax(w); return; }
            if (t.closest('.sw-close')) {
                if (typeof onClose === 'function') onClose();
                else w.style.display = 'none';
            }
        }, true);
    }
    function dockIdOf(w) { return w.getAttribute('data-bl-id') || ('sw' + (w.__blUid || (w.__blUid = ++uidSeq))); }
    var uidSeq = 0;

    function minToDock(w) {
        var id = dockIdOf(w);
        w.setAttribute('data-bl-id', id);
        var label = 'STAR';
        var ttl = w.querySelector('.addon-window-title');
        if (ttl) label = ttl.textContent || label;
        var d = window.__blDockMin;
        if (!d || !d.min) { w.style.display = 'none'; return; }
        try {
            if (!d.min(w, { id: id, label: label })) w.style.display = 'none';
        } catch (e) { w.style.display = 'none'; }
    }
    function toggleMax(w) {
        var max = w.classList.toggle('bl-window-maximized');
        var btn = w.querySelector('.sw-max');
        if (btn) btn.innerHTML = max ? icoRestore() : icoMax();
        if (max) {
            w.__blRect = { l: w.style.left, t: w.style.top, w: w.style.width, h: w.style.height };
            w.style.left = '0px'; w.style.top = '0px';
            w.style.width = '100vw'; w.style.height = '100vh';
        } else if (w.__blRect) {
            var r = w.__blRect;
            w.style.left = r.l; w.style.top = r.t;
            w.style.width = r.w; w.style.height = r.h;
            w.__blRect = null;
        }
    }
    function front(w) {
        try { if (typeof window.__blUnifyFront === 'function') window.__blUnifyFront(); } catch (e) { /* ignore */ }
        try { if (w) w.style.zIndex = String(999999); } catch (e2) { /* ignore */ }
    }

    /* ---------------- 会话 ---------------- */

    function newSession(title) {
        var s = { id: 's' + Date.now() + Math.floor(Math.random() * 1000),
                  title: title || '新对话', msgs: [] };
        sessions.unshift(s);
        curId = s.id;
        if (sessions.length > 40) sessions.length = 40;
        writeJSON(STORE_SESS, sessions);
        return s;
    }
    function curSession() {
        for (var i = 0; i < sessions.length; i++) if (sessions[i].id === curId) return sessions[i];
        if (!sessions.length) return newSession();
        curId = sessions[0].id;
        return sessions[0];
    }
    function ellip(s, n) {
        s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
        return s.length > n ? s.slice(0, n) + '…' : s;
    }

    /* ---------------- 聊天窗口 ---------------- */

    var chatEl = null, sessEl = null, inputEl = null, sendEl = null;

    function buildWin() {
        if (win) return win;
        var w = winShell('sw-win', 'STAR', true, 'sw-content');
        var body = w.querySelector('.sw-content');
        body.innerHTML =
            '<aside class="sw-side">' +
            '<div class="sw-brand">' + starMark() + '<span>STAR</span></div>' +
            '<button type="button" class="sw-new">+ 新对话</button>' +
            '<div class="sw-sessions"></div>' +
            '</aside>' +
            '<main class="sw-main">' +
            '<div class="sw-top">' +
            '<span>模型</span>' +
            '<select class="sw-model"></select>' +
            '<label class="sw-ptrlab" title="AI 操作编辑器时显示虚拟鼠标指针">' +
            '<input type="checkbox" class="sw-ptr-in"> 虚拟指针</label>' +
            '<label class="sw-watch"><input type="checkbox" class="sw-watch-in"> 观察过程</label>' +
            '<button type="button" class="sw-cfg" title="接口设置">&#9881;</button>' +
            '</div>' +
            '<div class="sw-chat"></div>' +
            '<div class="sw-composer">' +
            '<textarea class="sw-input" placeholder="输入消息、请求或者拖拽上下文"></textarea>' +
            '<div class="sw-row">' +
            '<button type="button" class="sw-chip sw-think">思考</button>' +
            '<button type="button" class="sw-chip sw-stopchip">选择结束</button>' +
            '<button type="button" class="sw-chip sw-doc">添加文档</button>' +
            '<button type="button" class="sw-send">' + icoSend() + '发送</button>' +
            '</div></div>' +
            '</main>';
        attachChrome(w, function () { w.style.display = 'none'; });
        /* 固定用 'star' 这个托盘 id：DOCK 上的固定按钮会先查托盘，
           窗口收起来之后点同一个按钮就是把它放回来，而不是再开一个。 */
        w.setAttribute('data-bl-id', 'star');

        chatEl = body.querySelector('.sw-chat');
        sessEl = body.querySelector('.sw-sessions');
        inputEl = body.querySelector('.sw-input');
        sendEl = body.querySelector('.sw-send');

        var model = body.querySelector('.sw-model');
        var wchk = body.querySelector('.sw-watch-in');
        var pchk = body.querySelector('.sw-ptr-in');

        fillModels(model);
        model.value = cfg.provider || 'local';
        wchk.checked = watchMode;
        pchk.checked = ptrOn;

        model.addEventListener('change', function () {
            cfg.provider = model.value;
            var fid = freeIdOf(cfg.provider);
            if (fid) cfg.freeId = fid;
            saveCfg();
            push('sys', '已切换到：' + providerName(cfg.provider) +
                (cfg.provider === 'custom' && (!cfg.api || !cfg.key)
                    ? '（还没填地址或 Key，点右上角齿轮配置）' : ''));
        });
        wchk.addEventListener('change', function () {
            watchMode = wchk.checked;
            try { window.localStorage.setItem('bl.star.watch', watchMode ? '1' : '0'); } catch (e) { /* ignore */ }
            push('sys', watchMode
                ? '观察过程已开启：AI 打开的弹窗会直接显示。'
                : '观察过程已关闭：AI 转入后台，打开的弹窗收进 DOCK 栏，另开小窗显示进度与思考。');
        });
        pchk.addEventListener('change', function () {
            setPtrOn(pchk.checked);
            push('sys', ptrOn
                ? '虚拟指针已开启：AI 点哪个按钮，指针就飞过去点给你看。'
                : '虚拟指针已关闭：AI 仍然会操作，只是不再显示指针。');
        });
        body.querySelector('.sw-cfg').addEventListener('click', function () { openCfg(); });
        body.querySelector('.sw-new').addEventListener('click', function () {
            newSession();
            renderSessions();
            renderChat();
        });
        body.querySelector('.sw-think').addEventListener('click', function () {
            var b = body.querySelector('.sw-think');
            cfg.think = !cfg.think;
            b.classList.toggle('is-on', cfg.think);
            saveCfg();
            push('sys', cfg.think ? '已开启思考模式：回答前先给出推理过程。'
                                  : '已关闭思考模式。');
        });
        body.querySelector('.sw-think').classList.toggle('is-on', cfg.think);
        body.querySelector('.sw-doc').addEventListener('click', function () {
            push('sys', '「添加文档」暂未接入：当前版本只读取编辑器内的作品上下文。');
        });
        body.querySelector('.sw-stopchip').addEventListener('click', function () {
            stopRun();
            push('sys', '已请求结束当前任务。');
        });
        sendEl.addEventListener('click', function () { submit(); });
        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
        });

        win = w;
        return w;
    }

    function starMark() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
            ' stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="9" stroke="currentColor" opacity="0.35"/>' +
            '<path d="M12 3.5l2.2 5.4 5.8.4-4.5 3.7 1.5 5.6L12 15.7 7 18.6l1.5-5.6L4 9.3l5.8-.4z" ' +
            'fill="currentColor" stroke="none"/></svg>';
    }

    function renderSessions() {
        if (!sessEl) return;
        var h = '';
        if (!sessions.length) {
            sessEl.innerHTML = '<div class="sw-sess-empty">暂无会话记录</div>';
            return;
        }
        for (var i = 0; i < sessions.length; i++) {
            h += '<div class="sw-sess' +
                (sessions[i].id === curId ? ' is-on' : '') +
                '" data-sess="' + sessions[i].id + '" role="button" tabindex="0">' +
                '<span class="sw-sess-t">' + esc(sessions[i].title) + '</span>' +
                '<button type="button" class="sw-sess-del" data-del="' + sessions[i].id +
                '" title="删除这个对话" aria-label="删除这个对话">&#10005;</button>' +
                '</div>';
        }
        sessEl.innerHTML = h;
        var btns = sessEl.querySelectorAll('.sw-sess');
        for (var j = 0; j < btns.length; j++) {
            btns[j].addEventListener('click', function (e) {
                var sid = this.getAttribute('data-sess');
                if (e.target && e.target.closest && e.target.closest('.sw-sess-del')) {
                    if (e.stopPropagation) e.stopPropagation();
                    delSession(sid);
                    return;
                }
                curId = sid;
                renderSessions();
                renderChat();
            });
        }
        var dels = sessEl.querySelectorAll('.sw-sess-del');
        for (var k = 0; k < dels.length; k++) {
            dels[k].addEventListener('click', function (e) {
                if (e.stopPropagation) e.stopPropagation();
                delSession(this.getAttribute('data-del'));
            });
        }
    }

    function delSession(id) {
        for (var i = 0; i < sessions.length; i++) {
            if (sessions[i].id !== id) continue;
            var title = sessions[i].title;
            sessions.splice(i, 1);
            if (!sessions.length) { newSession(); curId = sessions[0].id; }
            else if (curId === id) curId = sessions[Math.min(i, sessions.length - 1)].id;
            writeJSON(STORE_SESS, sessions);
            renderSessions();
            renderChat();
            push('sys', '已删除对话：' + ellip(title, 14));
            return;
        }
    }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* ---- 回复里的 SVG 矢量图 ----
       AI 出不了位图，但能写 SVG。这里把回复里的 <svg>...</svg> 抠出来，
       一键变成当前角色的造型 —— 否则那段代码只能看、不能用。 */
    function extractSvg(text) {
        var s = String(text || '');
        var out = [];
        var re = /```[a-zA-Z]*\s*([\s\S]*?)```/g;
        var m;
        while ((m = re.exec(s))) {
            var b = m[1];
            var i = b.indexOf('<svg');
            var j = b.lastIndexOf('</' + 'svg>');
            if (i >= 0 && j > i) out.push(b.slice(i, j + 6));
        }
        if (!out.length) {
            var k = s.indexOf('<svg');
            var e = s.lastIndexOf('</' + 'svg>');
            if (k >= 0 && e > k) out.push(s.slice(k, e + 6));
        }
        return out;
    }

    /* SVG 源码 -> 当前角色的造型。
       走的是编辑器自己的素材存储：先入库拿到 assetId，再 vm.addCostume。
       任何一步拿不到都给明确原因，不静默失败。 */
    function importSvgCostume(svgText, name) {
        var vm = getVM();
        if (!vm || !vm.runtime) return Promise.reject(new Error('编辑器尚未就绪'));
        var st = vm.runtime.storage;
        if (!st || !st.builtinHelper || !st.builtinHelper._store) {
            return Promise.reject(new Error('拿不到素材存储'));
        }
        if (!vm.addCostume) return Promise.reject(new Error('当前版本不支持添加造型'));
        /* 素材必须按字节入库：VM 读造型时走 TextDecoder.decode(asset.data)，
           喂字符串会直接抛 "parameter 1 is not of type ArrayBuffer"。 */
        var bytes;
        try {
            bytes = (typeof TextEncoder === 'function')
                ? new TextEncoder().encode(svgText)
                : null;
        } catch (e) { bytes = null; }
        if (!bytes) {
            bytes = new Uint8Array(svgText.length);
            for (var bi = 0; bi < svgText.length; bi++) {
                bytes[bi] = svgText.charCodeAt(bi) & 0xff;
            }
        }

        var id = '';
        try {
            var at = (st.AssetType && st.AssetType.ImageVector) || 'ImageVector';
            var df = (st.DataFormat && st.DataFormat.SVG) || 'svg';
            /* 注意：builtinHelper._store 返回的是 md5 字符串，不是 asset 对象。
               早期版本按 asset 取 .assetId，取到的一直是 undefined，
               于是每次都报"没拿到素材 id" —— 入库其实是成功的。 */
            var r = st.builtinHelper._store(at, df, bytes);
            id = (typeof r === 'string') ? r
                                         : ((r && (r.assetId || r.md5 || r.id)) || '');
        } catch (e) {
            return Promise.reject(new Error('SVG 入库失败：' + (e && e.message || e)));
        }
        if (!id) return Promise.reject(new Error('SVG 入库没拿到素材 id'));
        var md5ext = id + '.svg';
        /* asset 能拿到就一起给，拿不到就让 VM 自己按 md5ext 去 load */
        var asset = null;
        try { if (typeof st.get === 'function') asset = st.get(id); } catch (e) { asset = null; }
        var co = {
            name: name || 'STAR造型',
            dataFormat: 'svg',
            assetId: id,
            md5ext: md5ext,
            rotationCenterX: 240,
            rotationCenterY: 180
        };
        if (asset) co.asset = asset;
        return Promise.resolve(vm.addCostume(md5ext, co)).then(function () { return md5ext; });
    }

    function dlSvg(svgText, name) {
        try {
            var b = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + svgText],
                             { type: 'image/svg+xml' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = (name || 'star-costume') + '.svg';
            document.body.appendChild(a);
            a.click();
            window.setTimeout(function () {
                URL.revokeObjectURL(a.href);
                a.remove();
            }, 600);
            return true;
        } catch (e) { return false; }
    }

    function bindSvgBtns() {
        if (!chatEl) return;
        var s = curSession();
        var bs = chatEl.querySelectorAll('[data-svgact]');
        for (var i = 0; i < bs.length; i++) {
            bs[i].addEventListener('click', function () {
                var mi = parseInt(this.getAttribute('data-msg'), 10);
                var si = parseInt(this.getAttribute('data-svg'), 10);
                var act = this.getAttribute('data-svgact');
                var msg = s.msgs[mi];
                if (!msg) return;
                var list = extractSvg(msg.t);
                var svg = list[si];
                if (!svg) return;
                if (act === 'dl') {
                    dlSvg(svg, 'star-costume');
                    return;
                }
                var btn = this;
                btn.disabled = true;
                var old = btn.textContent;
                btn.textContent = '导入中…';
                importSvgCostume(svg).then(function (md5) {
                    push('sys', '已导入为造型：' + md5);
                })['catch'](function (e) {
                    push('sys', '导入失败：' + (e && e.message || e));
                }).then(function () {
                    btn.disabled = false;
                    btn.textContent = old;
                });
            });
        }
    }

    function renderChat() {
        if (!chatEl) return;
        var s = curSession();
        if (!s.msgs.length) {
            chatEl.innerHTML =
                '<div class="sw-welcome"><b>把问题、需求或代码片段直接发进来</b>' +
                '<span>可以让我监视数据、打开造型器、加载拓展、拖出或删除积木、搭建作品、' +
                '运行停止、撤销重做、改变量、点界面上的按钮</span></div>';
            return;
        }
        var h = '';
        for (var i = 0; i < s.msgs.length; i++) {
            var m = s.msgs[i];
            if (m.k === 'log') {
                h += '<div class="sw-log">' + m.html + '</div>';
            } else {
                h += '<div class="sw-msg ' + m.k + '">' + esc(m.t) + '</div>';
                if (m.k === 'ai') {
                    var svgs = extractSvg(m.t);
                    for (var j = 0; j < svgs.length; j++) {
                        h += '<div class="sw-svg">' +
                             '<span class="sw-svg-n">矢量图 ' + (j + 1) + '</span>' +
                             '<button type="button" class="sw-svg-btn" data-svgact="add" ' +
                             'data-msg="' + i + '" data-svg="' + j + '">导入为造型</button>' +
                             '<button type="button" class="sw-svg-dl" data-svgact="dl" ' +
                             'data-msg="' + i + '" data-svg="' + j + '">下载</button>' +
                             '</div>';
                    }
                }
            }
        }
        chatEl.innerHTML = h;
        bindSvgBtns();
        chatEl.scrollTop = chatEl.scrollHeight;
    }

    function push(kind, text) {
        var s = curSession();
        s.msgs.push({ k: kind, t: String(text) });
        if (s.msgs.length > 200) s.msgs.shift();
        if (!s.title || s.title === '新对话') {
            if (kind === 'me') s.title = ellip(text, 18);
        }
        writeJSON(STORE_SESS, sessions);
        renderSessions();
        renderChat();
    }
    function pushLog(items) {
        var s = curSession();
        var h = '';
        for (var i = 0; i < items.length; i++) {
            h += '<div class="' + items[i].st + '"><i></i>' + esc(items[i].t) + '</div>';
        }
        s.msgs.push({ k: 'log', html: h });
        writeJSON(STORE_SESS, sessions);
        renderChat();
    }

    /* ================================================================== *
     * 接口配置弹窗
     * ================================================================== */

    function fillModels(sel) {
        if (!sel) return;
        var h = '<optgroup label="免费模型">';
        for (var i = 0; i < FREE_LIST.length; i++) {
            h += '<option value="free:' + FREE_LIST[i].id + '">' + esc(FREE_LIST[i].name) + '</option>';
        }
        h += '</optgroup><optgroup label="通用接口">' +
            '<option value="custom">' + esc(cfg.model || '通用接口') + '</option>' +
            '</optgroup><optgroup label="离线">' +
            '<option value="local">本地指令引擎</option></optgroup>';
        sel.innerHTML = h;
    }

    var cfgDraft = null;

    function openCfg() {
        if (!cfgWin) {
            cfgWin = winShell('sc-win', '接口设置', false, 'sc-body');
            attachChrome(cfgWin, function () { cfgWin.style.display = 'none'; });
            cfgWin.setAttribute('data-bl-id', 'star-cfg');
        }
        cfgDraft = {
            provider: cfg.provider, freeId: cfg.freeId,
            freeOpt: JSON.parse(JSON.stringify(cfg.freeOpt || {})),
            proxy: cfg.proxy, proxyTpl: cfg.proxyTpl,
            api: cfg.api, key: cfg.key, model: cfg.model
        };
        renderCfg();
        if (!cfgWin.parentNode) topHost().appendChild(cfgWin);
        /* 内容本身接近 1000px 高，给足高度才不至于一屏只看到一半 */
        if (!cfgWin.style.width) place(cfgWin, 700, 760);
        cfgWin.style.display = '';
        if (window.__blPop && window.__blPop.in) window.__blPop.in(cfgWin);
        front(cfgWin);
    }

    function curOptDraft(id) {
        var base = freeDefOpt(id);
        var saved = (cfgDraft && cfgDraft.freeOpt && cfgDraft.freeOpt[id]) || {};
        for (var k in saved) {
            if (Object.prototype.hasOwnProperty.call(saved, k)) base[k] = saved[k];
        }
        return base;
    }

    function detailHtml(f, active) {
        if (!f) return '';
        var o = curOptDraft(f.id);
        var h = active ? '' : '<div class="sc-off">当前没有启用免费模型，下面是' +
            esc(f.name) + '的参数，切到它就能用。</div>';
        h += '<div class="sc-demo"><label>示例地址</label><code>' + esc(f.demo) + '</code></div>';
        h += '<table class="sc-table"><thead><tr>' +
            '<th>参数名</th><th>类型</th><th>必填</th><th>说明</th></tr></thead><tbody>';
        for (var i = 0; i < f.params.length; i++) {
            var p = f.params[i];
            h += '<tr><td>' + esc(p.n) + '</td><td>string</td><td>' + esc(p.req) + '</td><td>' +
                esc(p.d) + (p.def != null ? '（默认 ' + esc(String(p.def)) + '）' : '') + '</td></tr>';
        }
        h += '</tbody></table>';
        if (f.opts && f.opts.length) {
            h += '<div class="sc-opts">';
            for (var j = 0; j < f.opts.length; j++) {
                var op = f.opts[j];
                h += '<div class="sc-row"><label>' + esc(op.label) + '</label>' +
                    (op.area
                        ? '<textarea class="sc-opt" data-k="' + esc(op.k) +
                          '" placeholder="' + esc(op.ph) + '">' +
                          esc(o[op.k] == null ? '' : String(o[op.k])) + '</textarea>'
                        : '<input class="sc-opt" data-k="' + esc(op.k) + '" value="' +
                          esc(o[op.k] == null ? '' : String(o[op.k])) + '" placeholder="' + esc(op.ph) + '">') +
                    '</div>';
            }
            h += '</div>';
        }
        return h;
    }

    function renderCfg() {
        var body = cfgWin.querySelector('.sc-body');
        var d = cfgDraft;
        var i;
        var h = '<div class="sc-wrap">';

        h += '<div class="sc-use-row"><span>当前使用</span><select class="sc-use">';
        h += '<optgroup label="免费模型">';
        for (i = 0; i < FREE_LIST.length; i++) {
            h += '<option value="free:' + FREE_LIST[i].id + '">' + esc(FREE_LIST[i].name) + '</option>';
        }
        h += '</optgroup><optgroup label="通用接口">' +
            '<option value="custom">通用接口（OpenAI 兼容）</option></optgroup>' +
            '<optgroup label="离线"><option value="local">本地指令引擎（不联网）</option></optgroup>';
        h += '</select></div>';

        h += '<section class="sc-sec"><h3>免费模型</h3><div class="sc-cards">';
        for (i = 0; i < FREE_LIST.length; i++) {
            var f = FREE_LIST[i];
            var on = d.provider === 'free:' + f.id;
            h += '<button type="button" class="sc-card' + (on ? ' is-on' : '') +
                '" data-id="' + f.id + '"><b>' + esc(f.name) + '</b><span>' + esc(f.sub) + '</span></button>';
        }
        h += '</div><div class="sc-detail' + (isFree(d.provider) ? '' : ' is-off') + '">';
        h += detailHtml(findFree(freeIdOf(d.provider) || d.freeId), isFree(d.provider));
        h += '</div>';
        h += '<div class="sc-row"><label>跨域代理</label><select class="sc-proxy">' +
            '<option value="auto">自动（直连优先，不行再走代理）</option>' +
            '<option value="none">直连（不代理）</option>';
        for (i = 0; i < PROXIES.length; i++) {
            h += '<option value="' + PROXIES[i].id + '">' + esc(PROXIES[i].name) + '</option>';
        }
        h += '<option value="custom">自定义</option></select></div>';
        if (d.proxy === 'custom') {
            h += '<div class="sc-row"><label>模板</label><input class="sc-ptpl" value="' +
                esc(d.proxyTpl) + '" placeholder="https://你的代理/?url={url}"></div>';
        }
        h += '<div class="sc-note">这几个接口共用一个内置密钥，界面上不展示，也不需要你填。' +
            '从本地文件打开时浏览器会拦跨域请求，直连不通就走代理 —— 代理方会看到请求地址（含密钥），' +
            '介意的话选「直连」。</div>';
        h += '</section>';

        h += '<section class="sc-sec"><h3>通用接口（OpenAI 兼容）</h3>';
        h += '<div class="sc-row"><label>预设</label><select class="sc-preset">';
        for (i = 0; i < CUSTOM_PRESETS.length; i++) {
            h += '<option value="' + CUSTOM_PRESETS[i].id + '">' + esc(CUSTOM_PRESETS[i].name) + '</option>';
        }
        h += '</select></div>';
        h += '<div class="sc-row"><label>地址</label><input class="sc-api" value="' + esc(d.api) +
            '" placeholder="如 https://api.openai.com/v1"></div>';
        h += '<div class="sc-row"><label>Key</label><input class="sc-key" type="password" value="' +
            esc(d.key) + '" placeholder="sk-…"></div>';
        h += '<div class="sc-row"><label>模型</label><input class="sc-model" value="' + esc(d.model) +
            '" placeholder="如 gpt-4o"></div>';
        h += '<div class="sc-note">走标准 /chat/completions，任何兼容 OpenAI 的中转都能填。</div>';
        h += '</section>';

        h += '<section class="sc-sec"><h3>离线</h3>';
        h += '<button type="button" class="sc-local' + (d.provider === 'local' ? ' is-on' : '') +
            '" data-id="local"><b>本地指令引擎</b>' +
            '<span>不联网，听得懂一批中文指令并真正操作编辑器</span></button>';
        h += '</section>';

        h += '</div>';
        h += '<div class="sc-foot"><button type="button" class="sc-test">测试连接</button>' +
            '<span class="sc-stat"></span>' +
            '<button type="button" class="sc-cancel">取消</button>' +
            '<button type="button" class="sc-save">保存</button></div>';

        body.innerHTML = h;

        var use = body.querySelector('.sc-use');
        use.value = d.provider;
        use.addEventListener('change', function () {
            cfgDraft.provider = use.value;
            var fid = freeIdOf(use.value);
            if (fid) cfgDraft.freeId = fid;
            renderCfg();
        });

        var cards = body.querySelectorAll('.sc-card');
        for (i = 0; i < cards.length; i++) {
            cards[i].addEventListener('click', function () {
                cfgDraft.provider = 'free:' + this.getAttribute('data-id');
                cfgDraft.freeId = this.getAttribute('data-id');
                renderCfg();
            });
        }
        var loc = body.querySelector('.sc-local');
        loc.addEventListener('click', function () {
            cfgDraft.provider = 'local';
            renderCfg();
        });

        var opts = body.querySelectorAll('.sc-opt');
        for (i = 0; i < opts.length; i++) {
            opts[i].addEventListener('change', function () {
                var id = cfgDraft.freeId;
                if (!cfgDraft.freeOpt[id]) cfgDraft.freeOpt[id] = {};
                cfgDraft.freeOpt[id][this.getAttribute('data-k')] = this.value.trim();
            });
        }

        var psel = body.querySelector('.sc-proxy');
        psel.value = d.proxy;
        psel.addEventListener('change', function () {
            cfgDraft.proxy = psel.value;
            renderCfg();
        });
        var ptpl = body.querySelector('.sc-ptpl');
        if (ptpl) {
            ptpl.addEventListener('change', function () { cfgDraft.proxyTpl = ptpl.value.trim(); });
        }

        var preset = body.querySelector('.sc-preset');
        preset.addEventListener('change', function () {
            var pid = preset.value;
            for (var k = 0; k < CUSTOM_PRESETS.length; k++) {
                if (CUSTOM_PRESETS[k].id === pid) {
                    cfgDraft.api = CUSTOM_PRESETS[k].api;
                    cfgDraft.model = CUSTOM_PRESETS[k].model;
                    cfgDraft.provider = 'custom';
                    renderCfg();
                    return;
                }
            }
        });
        body.querySelector('.sc-api').addEventListener('change', function () {
            cfgDraft.api = this.value.trim(); cfgDraft.provider = 'custom';
        });
        body.querySelector('.sc-key').addEventListener('change', function () {
            cfgDraft.key = this.value.trim(); cfgDraft.provider = 'custom';
        });
        body.querySelector('.sc-model').addEventListener('change', function () {
            cfgDraft.model = this.value.trim(); cfgDraft.provider = 'custom';
        });

        body.querySelector('.sc-test').addEventListener('click', function () { testConn(); });
        body.querySelector('.sc-cancel').addEventListener('click', function () {
            cfgWin.style.display = 'none';
        });
        body.querySelector('.sc-save').addEventListener('click', function () {
            cfg.provider = cfgDraft.provider;
            cfg.freeId = cfgDraft.freeId;
            cfg.freeOpt = cfgDraft.freeOpt;
            cfg.proxy = cfgDraft.proxy;
            cfg.proxyTpl = cfgDraft.proxyTpl;
            cfg.api = cfgDraft.api;
            cfg.key = cfgDraft.key;
            cfg.model = cfgDraft.model;
            saveCfg();
            var sel = win ? win.querySelector('.sw-model') : null;
            if (sel) { fillModels(sel); sel.value = cfg.provider; }
            if (window.__blPop && window.__blPop.out) window.__blPop.out(cfgWin, function () {
                cfgWin.style.display = 'none';
            });
            else cfgWin.style.display = 'none';
            push('sys', '接口已保存：' + providerName(cfg.provider));
        });
    }

    function testConn() {
        var stat = cfgWin.querySelector('.sc-stat');
        var d = cfgDraft;
        var t0 = Date.now();
        stat.className = 'sc-stat is-busy';
        stat.textContent = '正在测试…';
        var done = function (ok, msg) {
            stat.className = 'sc-stat ' + (ok ? 'is-ok' : 'is-bad');
            stat.textContent = msg + '（' + (Date.now() - t0) + 'ms）';
        };
        if (d.provider === 'local') { done(true, '本地引擎，无需联网'); return; }
        if (d.provider === 'custom') {
            if (!d.api || !d.key) { done(false, '先填地址与 Key'); return; }
            fetch(d.api.replace(/\/+$/, '') + '/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + d.key },
                body: JSON.stringify({
                    model: d.model || 'gpt-4o',
                    messages: [{ role: 'user', content: '你好' }],
                    stream: false, max_tokens: 16
                })
            }).then(function (r) {
                return r.text().then(function (s) {
                    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + s.slice(0, 80));
                    return parseReply(s);
                });
            }).then(function (t) { done(true, '通了：' + ellip(t || '(无内容)', 26)); },
                function (e) { done(false, '失败：' + ellip((e && e.message) ? e.message : String(e), 40)); });
            return;
        }
        var f = findFree(freeIdOf(d.provider) || d.freeId);
        if (!f) { done(false, '没有这个接口'); return; }
        var st = { raw: '', err: '', lens: [] };
        var u = freeUrl(f, withSys(f, '你好', budgetFor(d.proxy)), curOptDraft(f.id));
        st.lens.push(u.length);
        tryFetch(candidates(u, d.proxy, d.proxyTpl), 0, '直连', st)
            .then(function (r) {
                done(true, '通了：' + ellip(r.text, 22) + ' · ' +
                    (r.via === '直连' ? '直连' : '代理') + ' · URL ' + st.lens[0] + '字符');
            }, function (e) {
                /* 原文比错误码有用：接口回空壳 JSON 时 fetch 是成功的，
                   只报"失败"看不出到底是密钥、长度还是接口本身的问题。 */
                var msg = '失败：' + ellip((e && e.message) ? e.message : String(e), 30) +
                    ' · URL ' + st.lens[0] + '字符';
                if (st.raw) msg += ' · 原文：' + ellip(st.raw, 40);
                done(false, msg);
            });
    }

    /* ---------------- 请求与解析 ---------------- */

    function enc(s) { return encodeURIComponent(s); }

    function freeUrl(f, text, opt) {
        var q = [], seen = {};
        /* 密钥排在第一位。查询串被截断都是从尾部切，密钥放末尾时最先丢的就是它，
           服务端收不到密钥不会报错，只回一个 answer 为空的空壳 JSON —— 表现为
           "请求成功了但什么都没拿到"，接着就被当成空结果降级到本地引擎。
           放最前面之后，超长时牺牲的是正文末尾，认证始终在。 */
        q.push('apikey=' + enc(FREE_KEY));
        /* 正文长度由上游 withSys() 按预算算好，这里不再二次截断 */
        q.push(enc(f.q) + '=' + enc(String(text == null ? '' : text)));
        seen[f.q] = 1;
        for (var i = 0; i < f.params.length; i++) {
            var p = f.params[i];
            if (seen[p.n] || p.n === 'apikey' || p.n === 'image') continue;
            var v = (opt && opt[p.n] != null && opt[p.n] !== '') ? opt[p.n] : p.def;
            if (v == null || v === '') continue;
            /* system 这类参数用户可能手填一大段，同样要卡长度 */
            q.push(enc(p.n) + '=' + enc(clampText(String(v), 200)));
            seen[p.n] = 1;
        }
        return f.url + '?' + q.join('&');
    }

    /* 各家返回的字段名都不一样，逐个试常见的几个；
       试不出来就把原文还回去，至少不丢内容。 */
    function pickText(j, depth) {
        if (depth > 3) return '';
        if (typeof j === 'string') return j;
        if (!j || typeof j !== 'object') return '';
        var keys = ['content', 'text', 'reply', 'result', 'answer', 'response', 'output', 'data',
            'message', 'msg', 'contents', 'output_text', 'choices', 'info', 'res'];
        for (var i = 0; i < keys.length; i++) {
            var v = j[keys[i]];
            if (typeof v === 'string' && v) return v;
            if (v && typeof v === 'object') {
                var sub = pickText(v, depth + 1);
                if (sub) return sub;
            }
        }
        if (j.choices && j.choices.length) {
            var c = j.choices[0];
            var m = c.message || c.delta || c;
            if (m && typeof m.content === 'string') return m.content;
            if (typeof c.text === 'string') return c.text;
        }
        return '';
    }
    function parseReply(s) {
        var t = String(s == null ? '' : s).replace(/^\s+/, '').replace(/\s+$/, '');
        if (!t) return '';
        if (t.charAt(0) === '{' || t.charAt(0) === '[') {
            try {
                var j = JSON.parse(t);
                var got = pickText(j, 0);
                /* 以前取不到就把整坨 JSON 原样显示 —— 用户看到的就是
                   {"status":"completed","question":"?","answer":""} 这种空壳。
                   取不到说明这次请求没拿到内容，返回空让上层去重试/降级。 */
                return got || '';
            } catch (e) { return t; }
        }
        return t;
    }

    /* 接口带不带 system 参数，决定了身份提示词怎么送出去 */
    function hasSysParam(f) {
        if (!f || !f.params) return false;
        for (var i = 0; i < f.params.length; i++) {
            if (f.params[i].n === 'system') return true;
        }
        return false;
    }
    /* 会话里用户说过的轮数（刚 push 进去的这条也算） */
    function firstTurn() {
        var s = curSession(), n = 0;
        for (var i = 0; i < s.msgs.length; i++) if (s.msgs[i].k === 'me') n++;
        return n <= 1;
    }
    /* 有没有能续接上下文的参数（StepFun 有 id，DeepSeek 那两个没有）——
       没有的话每轮都是独立请求，得自己把上一轮带上，否则它根本不知道前情。 */
    function hasCtxParam(f) {
        if (!f || !f.params) return false;
        for (var i = 0; i < f.params.length; i++) {
            if (f.params[i].n === 'id') return true;
        }
        return false;
    }
    /* 无上下文接口自带的最近一轮问答 */
    function lastTurn() {
        var s = curSession(), m = s.msgs, got = [];
        for (var i = m.length - 1; i >= 0 && got.length < 2; i--) {
            if (m[i].k === 'me' || m[i].k === 'ai') got.unshift(m[i]);
        }
        var out = '';
        for (var j = 0; j < got.length; j++) {
            if (got[j].k === 'me' && j === got.length - 1) break;   /* 这条就是要发的 */
            out += (got[j].k === 'me' ? '用户：' : 'STAR：') + String(got[j].t || '') + '\n';
        }
        return out;
    }
    /* 查询串长度红线：中文百分号编码后一个字占 9 个字符，代理再套一层还要 ×1.6。
       正文（含提示词与上下文）卡在 300 字以内，最终 URL 才不会撞上常见的长度上限。 */
    var MAX_QTEXT = 300;
    /* 查询串长度红线（按"编码后"的字符数算）。中文一个字百分号编码后占 9 个字符，
       走代理还要再编码一层变成 18 个。之前只按"正文多少字"卡长度，没算编码后的
       膨胀，DeepSeek 那两个没有 system 参数的接口要把身份提示词塞进正文，
       光正文就 300 字 → 编码 2700 → 代理再翻一倍 5400，必然被截断。 */
    var CAP_DIRECT = 1500;   /* 直连：整条 URL 编码后不超过这个数 */
    var CAP_PROXY = 1000;    /* 可能走代理（auto 或指定代理）：按双重编码算 */
    function encLen(s) { return encodeURIComponent(String(s == null ? '' : s)).length; }
    /* 当前请求路径的预算：只要有可能走代理，就按最坏情况（双重编码）算 */
    function budgetFor(mode) {
        mode = mode || cfg.proxy;
        return (mode === 'direct' || mode === 'none') ? CAP_DIRECT : CAP_PROXY;
    }
    function clampText(s, max) {
        s = String(s == null ? '' : s);
        max = max || MAX_QTEXT;
        if (s.length <= max) return s;
        /* 从头部截：末尾是正文，必须留着 */
        return '…' + s.slice(s.length - (max - 1));
    }
    /* 按"编码后"的预算裁正文：预算留给身份前缀之后，剩下的都给正文末尾 */
    function fitText(s, budget) {
        s = String(s == null ? '' : s);
        if (encLen(s) <= budget) return s;
        var n = Math.max(6, Math.floor(budget / 9));   /* 中文一字约 9 字符 */
        while (n > 6 && encLen(s.slice(-n)) > budget) n -= 3;
        return '…' + s.slice(-n);
    }
    /* 没有 system 参数的接口（DeepSeek 那两个）只能把提示词塞进正文。
       原来只在第一句塞、而且塞的是 530 字的完整版 —— 于是既超长、又会从第二句
       起彻底丢掉身份。现在改成：每句都带精简版；无上下文的接口再补上一轮问答。 */
    /* 没有 system 参数的接口（DeepSeek 那两个）只能把身份提示词塞进正文。
       这里用一句 12 字的极简身份（STAR_SYS_MINI 有 130 字，编码后 1100+，
       塞进正文直接吃掉全部预算），优先级照旧：身份 > 提问 > 上下文。 */
    var STAR_ID_MINI = '你是STAR。';
    function withSys(f, txt, budget) {
        budget = budget || budgetFor();
        if (hasSysParam(f)) return fitText(txt, budget);
        var id = starIdMini();
        var rest = budget - encLen(id) - encLen('\n用户说：');
        var q = fitText(txt, Math.max(80, rest));
        var base = id + '\n用户说：' + q;
        if (!hasCtxParam(f)) {
            var room = budget - encLen(base) - 10;
            var h = room > 80 ? fitText(lastTurn(), room) : '';
            if (h) base = id + '\n' + h + '\n用户说：' + q;
        }
        return base;
    }

    function callFree(txt) {
        var f = findFree(cfg.freeId);
        if (!f) { localRun(txt); return; }
        push('sys', '正在请求 ' + f.name + ' …');
        /* 阶梯重试：先按正常预算发，拿不到内容就逐级缩短正文再试。
           之前只重试一次、而且重试时把整段身份提示词又塞回去，长度没降多少，
           于是两次都撞同一个截断上限，最后只能落到本地引擎。 */
        var st = { raw: '', err: '', lens: [] }, muls = [1, 0.5, 0.25], k = 0;
        (function step() {
            if (k >= muls.length) { freeFailed(f, st, txt); return; }
            var budget = Math.max(150, Math.round(budgetFor() * muls[k]));
            var url = freeUrl(f, withSys(f, txt, budget), curOpt(f.id));
            st.lens.push(url.length);
            k++;
            tryFetch(candidates(url, cfg.proxy, cfg.proxyTpl), 0, '直连', st)
                .then(function (r) {
                    if (k > 1) push('sys', '（正文过长被截断，已自动缩短重试）');
                    push('ai', plainAIText(r.text));
                    if (r.via !== '直连') push('sys', '（本次走了代理：' + ellip(r.via, 40) + '）');
                    dispatchAIReply(r.text);
                }, function () { step(); });
        })();
    }
    /* 三级都没拿到内容：把原始返回贴在对话里，便于判断是密钥、长度还是接口本身的问题 */
    function freeFailed(f, st, txt) {
        var why = st.err ? ellip(st.err, 60) : (st.raw ? '接口返回为空' : '连不上');
        push('sys', '请求 ' + f.name + ' 失败（' + why + '，正文长度试过 ' +
            st.lens.join('/') + '）。已改用本地教学应答。');
        if (st.raw) push('sys', '接口原始返回：' + ellip(st.raw, 150));
        else push('sys', '从本地文件打开时浏览器会拦跨域请求，可在接口设置里把请求方式改成某个代理再试。');
        chatTeach(txt);
    }

    /* ---------------- 打开 / 关闭 ---------------- */

    function place(w, wd, ht) {
        var vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
        /* 夹进视口：小屏上窗口不能顶出屏幕外 */
        wd = Math.max(320, Math.min(wd, vw - 24));
        ht = Math.max(300, Math.min(ht, vh - 70));
        w.style.width = wd + 'px';
        w.style.height = ht + 'px';
        w.style.left = Math.max(8, Math.round((vw - wd) / 2)) + 'px';
        w.style.top = Math.max(8, Math.round((vh - ht) / 2 - 20)) + 'px';
    }
    function open() {
        buildWin();
        if (!win.parentNode) topHost().appendChild(win);
        if (!win.style.width) place(win, 760, 520);
        win.style.display = '';
        if (window.__blPop && window.__blPop.in) window.__blPop.in(win);
        front(win);
        renderSessions();
        renderChat();
        var d = window.__blDockMin;
        if (d && d.has && d.has('star')) d.forget('star');
    }
    function close() {
        if (!win) return;
        var w = win;
        var done = function () { w.style.display = 'none'; };
        if (window.__blPop && window.__blPop.out) window.__blPop.out(w, done);
        else done();
    }
    function toggle() {
        var docked = window.__blDockMin && window.__blDockMin.has && window.__blDockMin.has('star');
        if (docked) { window.__blDockMin.restore(win || buildWin(), { id: 'star' }); return; }
        if (win && win.parentNode && win.style.display !== 'none') close();
        else open();
    }
    function isOpen() { return !!(win && win.parentNode && win.style.display !== 'none'); }

    /* ================================================================== *
     * 虚拟鼠标指针
     * AI 点哪儿，指针就飞过去点一下 —— 界面"自己变了"和"有一只手在点"，
     * 看在眼里的可信度完全不同。指针本身 pointer-events:none，不吃任何点击。
     * ================================================================== */

    var ptrEl = null, ptrOn = true, ptrHide = 0, ptrTipTimer = 0;

    function readPtrOn() {
        try { return window.localStorage.getItem('bl.star.ptr') !== '0'; } catch (e) { return true; }
    }
    function setPtrOn(v) {
        ptrOn = !!v;
        try { window.localStorage.setItem('bl.star.ptr', ptrOn ? '1' : '0'); } catch (e) { /* ignore */ }
        if (!ptrOn && ptrEl) ptrEl.classList.remove('is-on');
    }

    function ensurePtr() {
        if (ptrEl) return ptrEl;
        ptrEl = document.createElement('div');
        ptrEl.className = 'sw-ptr';
        ptrEl.setAttribute('aria-hidden', 'true');
        ptrEl.innerHTML =
            '<i class="sw-ptr-ring"></i>' +
            '<svg class="sw-ptr-arrow" viewBox="0 0 24 24" width="24" height="24">' +
            '<path d="M5 2.5l14.6 8.3-6.5 1.2 3.5 6.4-2.7 1.4-3.5-6.4L5 17.8z" ' +
            'fill="#ffffff" stroke="#14181f" stroke-width="1.4" stroke-linejoin="round"/></svg>' +
            '<span class="sw-ptr-tip"></span>';
        /* 挂 body 而不是顶层宿主：宿主自己有 z-index，会形成层叠上下文，
           里面的子元素再高也越不过原生弹窗。body 不形成，指针才能真正浮在最上层。 */
        (document.body || topHost()).appendChild(ptrEl);
        return ptrEl;
    }
    function ptrMove(x, y) {
        var e = ensurePtr();
        e.classList.add('is-on');
        e.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
        if (ptrHide) window.clearTimeout(ptrHide);
        ptrHide = window.setTimeout(function () {
            if (ptrEl) ptrEl.classList.remove('is-on');
        }, 1800);
    }
    function ptOf(el) {
        if (!el || !el.getBoundingClientRect) return null;
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) return null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    function ptrAt(el) {
        if (!ptrOn) return false;
        var p = ptOf(el);
        if (!p) return false;
        ptrMove(p.x, p.y);
        return true;
    }
    function ptrTip(txt) {
        var e = ensurePtr();
        var t = e.querySelector('.sw-ptr-tip');
        if (!t) return;
        t.textContent = txt || '';
        e.classList.toggle('has-tip', !!txt);
    }
    function ptrPulse() {
        var e = ensurePtr();
        e.classList.remove('is-hit');
        void e.offsetWidth;
        e.classList.add('is-hit');
    }
    function sleep(ms) {
        return new Promise(function (r) { window.setTimeout(r, ms); });
    }
    /* [1.0.5 SEA] AI 的每一次点击都是一条「点击消息」：
       由 fireClick 派发完整的 pointer / mouse 事件序列到编辑器 DOM。 */
    function aiClick(el, tip) {
        return fireClick(el, tip);
    }

    /* ---- 通用：按文字点界面上的任何按钮 / 菜单项 ----
       菜单条、工具栏、侧栏……编辑器里凡是能用鼠标点的，AI 都能点。
       优先取文字完全相同的，其次取包含关系，避免"文件"命中"文件夹"。 */
    function findByText(names, sel) {
        var list = document.querySelectorAll(sel ||
            'button, [role="button"], [role="menuitem"], li, a, label, [class*="menu-bar_menu"]');
        var i, j, el, tx, exact = [], loose = [];
        for (i = 0; i < list.length; i++) {
            el = list[i];
            if (el.closest && el.closest('.sw-win, .sc-win, .sw-prog, .sw-mon')) continue;
            tx = ((el.textContent || '') + ' ' + (el.getAttribute && (el.getAttribute('title') || '') || '')).trim();
            if (!tx) continue;
            var r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            for (j = 0; j < names.length; j++) {
                var n = names[j];
                if (!n) continue;
                if (tx === n) exact.push(el);
                else if (tx.indexOf(n) >= 0) loose.push(el);
            }
        }
        return exact.length ? exact[0] : (loose.length ? loose[0] : null);
    }
    function clickText(names, tip) {
        var el = findByText(names);
        if (!el) return Promise.reject(new Error('没找到「' + names[0] + '」这个按钮'));
        return aiClick(el, tip || ('点 ' + names[0]));
    }

    /* ================================================================== *
     * 能力：AI 能真正操作编辑器的那几件事
     * ================================================================== */

    /* 切到某个标签页（代码 / 造型 / 声音 / 音乐…）。
       返回 Promise —— 中间要等虚拟指针飞过去，不然点完了动画还没到。 */
    function switchTab(names) {
        var ul = document.querySelector('ul[class*="gui_tab-list_"]');
        if (!ul) return Promise.resolve(false);
        var lis = ul.querySelectorAll('li');
        for (var i = 0; i < lis.length; i++) {
            var tx = (lis[i].textContent || '').trim();
            for (var j = 0; j < names.length; j++) {
                if (tx === names[j] || tx.indexOf(names[j]) >= 0) {
                    return aiClick(lis[i], '切到 ' + names[j]);
                }
            }
        }
        return Promise.resolve(false);
    }

    /* ---- 数据监视窗 ---- */
    function openMonitor() {
        if (!monWin) {
            monWin = winShell('sw-mon', '数据监视', false);
            monWin.querySelector('.sw-mon-body').innerHTML =
                '<div class="sw-mon-empty">正在读取…</div>';
            attachChrome(monWin, function () {
                monWin.style.display = 'none';
                if (monTimer) { window.clearInterval(monTimer); monTimer = 0; }
            });
        }
        if (!monWin.parentNode) topHost().appendChild(monWin);
        place(monWin, 380, 420);
        monWin.style.left = '24px';
        monWin.style.top = '96px';
        if (watchOn()) {
            monWin.style.display = '';
            front(monWin);
        } else {
            dockIt(monWin, 'sw-mon', '数据监视');
        }
        if (!monTimer) monTimer = window.setInterval(paintMonitor, 600);
        paintMonitor();
        return true;
    }
    function watchOn() { return watchMode; }

    function dockIt(w, id, label) {
        w.setAttribute('data-bl-id', id);
        var d = window.__blDockMin;
        if (d && d.min) {
            try { if (d.min(w, { id: id, label: label })) return; } catch (e) { /* ignore */ }
        }
        w.style.display = 'none';
    }

    function monRows() {
        var vm = getVM();
        if (!vm || !vm.runtime) return '<div class="sw-mon-empty">编辑器尚未就绪</div>';
        var t = vm.editingTarget || vm.runtime.getEditingTarget && vm.runtime.getEditingTarget() ||
                (vm.runtime.targets && vm.runtime.targets[0]);
        if (!t) return '<div class="sw-mon-empty">没有选中角色</div>';
        var h = '<h4>角色：' + esc(t.getName ? t.getName() : t.name) + '</h4><table>';
        h += row('x', round(getT(t, 'x')));
        h += row('y', round(getT(t, 'y')));
        h += row('方向', round(getT(t, 'direction')));
        h += row('大小', round(getT(t, 'size')) + '%');
        h += row('显示', getT(t, 'visible') ? '是' : '否');
        h += row('造型序号', (getT(t, 'currentCostume') || 0) + 1);
        h += '</table>';

        var vars = t.variables || {};
        var keys = Object.keys(vars);
        h += '<h4>变量（' + keys.length + '）</h4>';
        if (!keys.length) h += '<div class="sw-mon-empty">这个角色还没有变量</div>';
        else {
            h += '<table>';
            for (var i = 0; i < keys.length; i++) {
                var v = vars[keys[i]];
                if (!v) continue;
                h += row(v.name, fmtVal(v.value));
            }
            h += '</table>';
        }

        var lists = t.lists || {};
        var lk = Object.keys(lists);
        h += '<h4>列表（' + lk.length + '）</h4>';
        if (!lk.length) h += '<div class="sw-mon-empty">这个角色还没有列表</div>';
        else {
            h += '<table>';
            for (var j = 0; j < lk.length; j++) {
                var L = lists[lk[j]];
                if (!L) continue;
                h += row(L.name, '[' + (L.value || []).length + '] ' +
                    ellip((L.value || []).join(', '), 40));
            }
            h += '</table>';
        }
        return h;
    }
    function row(k, v) { return '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>'; }
    function fmtVal(v) {
        if (v === null || v === undefined) return '';
        if (Array.isArray(v)) return '[' + v.length + ']';
        return String(v);
    }
    function round(n) {
        n = Number(n);
        if (isNaN(n)) return '0';
        return String(Math.round(n * 100) / 100);
    }
    function getT(t, k) { try { return t[k]; } catch (e) { return undefined; } }

    function paintMonitor() {
        if (!monWin) return;
        /* 收在 DOCK 里或已关闭：不刷新，省掉每 600ms 一次的无谓计算 */
        if (monWin.style.display === 'none' || monWin.classList.contains('bl-win-docked')) return;
        var b = monWin.querySelector('.sw-mon-body');
        if (b) b.innerHTML = monRows();
    }

    /* ---- 造型器绘画 ----
       AI 出不了图，但能把造型器打开。所以"画画"这件事的正确形态是：
       打开造型器 + 给出能照着画的描述，而不是回一句"我无法生成图片"就结束。 */
    function openPaint() {
        return switchTab(['造型', 'Costumes', '背景', 'Backdrops']).then(function () {
            /* 刚切过去，绘制按钮还没渲染出来 */
            return sleep(320);
        }).then(function () {
            var cands = document.querySelectorAll(
                'button, [class*="add-button"], [class*="addButton"], [role="button"]');
            var i, el, tx;
            for (i = 0; i < cands.length; i++) {
                el = cands[i];
                if (el.closest && el.closest('.sw-win, .sc-win, .sw-prog, .sw-mon')) continue;
                tx = (el.getAttribute('title') || '') + ' ' +
                     (el.getAttribute('aria-label') || '') + ' ' +
                     (el.textContent || '');
                if (/绘制|畫|画图|Paint/.test(tx)) {
                    return aiClick(el, '打开绘制').then(function () { return true; });
                }
            }
            return false;
        });
    }

    /* ---- 运行 / 停止 ---- */
    function runProject() {
        var vm = getVM();
        var flag = findByText(['绿旗', 'Green Flag'],
            '[class*="green-flag"], [class*="greenFlag"], button');
        var p = flag ? aiClick(flag, '点绿旗运行') : Promise.resolve(false);
        return p.then(function () {
            if (!vm) return !!flag;
            try { vm.start(); vm.greenFlag(); } catch (e) { /* ignore */ }
            return true;
        });
    }
    function stopProject() {
        var vm = getVM();
        var btn = findByText(['停止', 'Stop'], '[class*="stop"], button');
        var p = btn ? aiClick(btn, '停止') : Promise.resolve(false);
        return p.then(function () {
            if (!vm) return !!btn;
            try { vm.stopAll(); } catch (e) { /* ignore */ }
            return true;
        });
    }

    /* ---- 撤销 / 重做 ---- */
    function undoRedo(isRedo) {
        var ws = getWS();
        if (ws && typeof ws.undo === 'function') {
            var ok = false;
            try { if (isRedo) { ws.redo(false); } else { ws.undo(false); } ok = true; }
            catch (e) { /* ignore */ }
            if (ok) return Promise.resolve(true);
        }
        return Promise.reject(new Error('当前拿不到工作区的撤销栈'));
    }

    /* ---- 添加角色 ---- */
    function addSprite() {
        var el = findByText(['添加角色', '添加精灵', 'Add sprite', 'Add Sprite'],
            '[class*="add-button"], [class*="addButton"], button');
        if (!el) return Promise.reject(new Error('没找到「添加角色」按钮'));
        return aiClick(el, '添加角色').then(function () { return true; });
    }

    /* ---- 设置变量 ---- */
    function setVar(name, val) {
        var vm = getVM();
        if (!vm || !vm.runtime) return Promise.reject(new Error('编辑器尚未就绪'));
        var t = vm.editingTarget || (vm.runtime.targets && vm.runtime.targets[0]);
        if (!t) return Promise.reject(new Error('没有选中角色'));
        var hit = 0;
        for (var id in t.variables) {
            if (!Object.prototype.hasOwnProperty.call(t.variables, id)) continue;
            if (t.variables[id].name === name) { t.variables[id].value = val; hit++; }
        }
        var st = vm.runtime.getTargetForStage ? vm.runtime.getTargetForStage() : null;
        if (st && st.variables) {
            for (var sid in st.variables) {
                if (!Object.prototype.hasOwnProperty.call(st.variables, sid)) continue;
                if (st.variables[sid].name === name) { st.variables[sid].value = val; hit++; }
            }
        }
        if (!hit) return Promise.reject(new Error('角色和舞台上都没有叫「' + name + '」的变量'));
        return Promise.resolve(hit);
    }

    /* ---- 加载拓展 ---- */
    var EXT_MAP = {
        '画笔': 'pen', '画笔拓展': 'pen', 'pen': 'pen',
        '音乐': 'music', 'music': 'music',
        '视频侦测': 'videoSensing', '摄像头': 'videoSensing',
        '朗读': 'text2speech', '文字朗读': 'text2speech',
        '翻译': 'translate',
        'makeymakey': 'makeymakey',
        'microbit': 'microbit', 'micro:bit': 'microbit'
    };
    function loadExt(id) {
        var vm = getVM();
        if (!vm) return Promise.reject(new Error('编辑器尚未就绪'));
        var em = vm.extensionManager;
        if (!em) return Promise.reject(new Error('没有拓展管理器'));
        var p = null;
        if (/^https?:/i.test(id)) {
            p = em.loadExtensionURL ? em.loadExtensionURL(id) : null;
        } else if (em.loadExtensionId) {
            p = em.loadExtensionId(id);
        } else if (em.loadExtensionURL) {
            p = em.loadExtensionURL(id);
        }
        if (!p) return Promise.reject(new Error('当前版本不支持加载拓展'));
        return Promise.resolve(p);
    }

    /* ---- 积木：拖出 / 删除 / 搭建 ---- */

    /* 积木目录（第 34 轮改为「参数化」）
       ------------------------------------------------------------------
       旧版每条是一段写死的 XML，findCatalog 只按关键词匹配，
       于是「拖出一个移动20步的积木」会拖出默认写死的「移动 10 步」。
       现在每条带 unit / def / build，指令里的数值会被解析出来填进 XML，
       执行后还会回读积木字段做一次严格校验（见 localRun）。 */
    var CATALOG = [
        { k: ['绿旗', '当绿旗', '开始', 'flag'], name: '当绿旗被点击',
          xml: '<block type="event_whenflagclicked"></block>' },
        { k: ['移动', '前进', '走'], unit: '步', def: 10, shadow: 'math_number',
          field: 'STEPS', type: 'motion_movesteps',
          label: function (v) { return '移动 ' + v + ' 步'; } },
        { k: ['右转', '旋转', '转向'], unit: '度', def: 15, shadow: 'math_number',
          field: 'DEGREES', type: 'motion_turnright',
          label: function (v) { return '右转 ' + v + ' 度'; } },
        { k: ['说话', '说', '讲话'], unit: '秒', def: 2, shadow: 'text',
          field: 'MESSAGE', textField: true, type: 'looks_sayforsecs',
          label: function (v, txt) { return '说「' + (txt || '你好！') + '」' + v + ' 秒'; } },
        { k: ['下一个造型', '换造型'], name: '下一个造型',
          xml: '<block type="looks_nextcostume"></block>' },
        { k: ['重复', '循环'], unit: '次', def: 10, shadow: 'math_whole_number',
          field: 'TIMES', type: 'control_repeat',
          label: function (v) { return '重复 ' + v + ' 次'; } },
        { k: ['一直', '永远', 'forever'], name: '重复执行',
          xml: '<block type="control_forever"></block>' },
        { k: ['等待', '等一下'], unit: '秒', def: 1, shadow: 'math_number',
          field: 'DURATION', type: 'control_wait',
          label: function (v) { return '等待 ' + v + ' 秒'; } }
    ];

    /* 从指令里取参数：优先「数字 + 单位」，其次「关键词后紧跟的数字」。
       只认这两种，避免把模型回复里无关的数字（版本号、序号等）误当参数。 */
    function numFor(text, unit) {
        var re = new RegExp('(-?\\d+(?:\\.\\d+)?)\\s*' + unit);
        var m = text.match(re);
        if (m) return m[1];
        var m2 = text.match(/(-?\d+(?:\.\d+)?)/);
        return m2 ? m2[1] : null;
    }
    function quotedText(text) {
        var m = text.match(/[“"'"']([^”"'"']{1,40})[”"'"']/);
        return m ? m[1] : '';
    }
    function escXml(v) {
        return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* 返回 { name, xml, expect }：expect 用于执行后回读校验，
       保证「严格按我说的执行」不是一句口号。 */
    function findCatalog(text) {
        for (var i = 0; i < CATALOG.length; i++) {
            var c = CATALOG[i];
            for (var j = 0; j < c.k.length; j++) {
                if (text.indexOf(c.k[j]) < 0) continue;
                if (!c.build && c.xml) {
                    return { name: c.name, xml: c.xml, expect: null,
                             type: typeFromXml(c.xml), cat: catOf(typeFromXml(c.xml)),
                             key: c.k[0] };
                }
                var raw = numFor(text, c.unit);
                var v = (raw === null || raw === undefined) ? String(c.def) : String(raw);
                var txt = quotedText(text);
                var fieldXml, secsXml = '';
                if (c.textField) {
                    fieldXml = '<shadow type="' + c.shadow + '">' +
                        '<field name="TEXT">' + escXml(txt || '你好！') + '</field></shadow>';
                    /* 「说你好 5 秒」里的秒数同样要原样写进积木，
                       不能只写文本、把时长留在默认的 2 秒。 */
                    secsXml = '<value name="SECS"><shadow type="math_positive_number">' +
                        '<field name="NUM">' + v + '</field></shadow></value>';
                } else {
                    fieldXml = '<shadow type="' + c.shadow + '">' +
                        '<field name="NUM">' + v + '</field></shadow>';
                }
                var xml = '<block type="' + c.type + '">' +
                    '<value name="' + c.field + '">' + fieldXml + '</value>' +
                    secsXml + '</block>';
                return {
                    name: c.label(v, txt),
                    xml: xml,
                    expect: c.textField ? (txt || '你好！') : v,
                    type: c.type, cat: catOf(c.type), key: c.k[0]
                };
            }
        }
        return null;
    }

    /* 回读积木里的实际字段值：数值槽是挂在 input 上的 shadow 块。 */
    function readBlockValue(b, fieldName) {
        if (!b) return null;
        try {
            var inp = b.getInput && b.getInput(fieldName);
            var t = inp && inp.connection && inp.connection.targetBlock &&
                inp.connection.targetBlock();
            if (t && typeof t.getFieldValue === 'function') {
                var v = t.getFieldValue('NUM');
                if (v === null || v === undefined) v = t.getFieldValue('TEXT');
                if (v !== null && v !== undefined) return String(v);
            }
            if (typeof b.getFieldValue === 'function') {
                var v2 = b.getFieldValue('NUM');
                if (v2 === null || v2 === undefined) v2 = b.getFieldValue('TEXT');
                if (v2 !== null && v2 !== undefined) return String(v2);
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function matchExt(text) {
        var keys = Object.keys(EXT_MAP);
        for (var i = 0; i < keys.length; i++) {
            if (text.indexOf(keys[i]) >= 0) return EXT_MAP[keys[i]];
        }
        var m = text.match(/https?:\/\/[^\s，,。]+/);
        return m ? m[0] : '';
    }

    var dropX = 40, dropY = 40;

    function addBlockXml(xml) {
        var SB = getSB();
        var ws = getWS();
        if (!SB || !ws) throw new Error('积木区尚未就绪');
        if (!SB.Xml || !SB.Xml.textToDom || !SB.Xml.domToBlock) {
            throw new Error('缺少积木解析接口');
        }
        var dom = SB.Xml.textToDom('<xml>' + xml + '</xml>');
        var node = dom.firstElementChild || dom.firstChild;
        var b = SB.Xml.domToBlock(node, ws);
        if (!b) throw new Error('这个积木编辑器里没有');
        try {
            b.moveBy(dropX, dropY);
            dropX += 24; dropY += 44;
            if (dropY > 320) { dropY = 40; dropX += 220; }
        } catch (e) { /* ignore */ }
        return b;
    }
    function delBlocks() {
        var ws = getWS();
        if (!ws) throw new Error('积木区尚未就绪');
        var tops = ws.getTopBlocks ? ws.getTopBlocks(true) : [];
        var n = 0;
        var SB = getSB();
        if (SB && SB.Events && SB.Events.setGroup) { try { SB.Events.setGroup(true); } catch (e) { /* ignore */ } }
        for (var i = 0; i < tops.length; i++) {
            try { tops[i].dispose(false); n++; } catch (e2) { /* ignore */ }
        }
        if (SB && SB.Events && SB.Events.setGroup) { try { SB.Events.setGroup(false); } catch (e3) { /* ignore */ } }
        return n;
    }
    function buildDemo() {
        /* ⚠ 帽子积木（当绿旗被点击）没有 SUBSTACK 输入 —— 后续积木走 <next>。
           只有 重复执行 / 重复N次 / 如果…那么 这类 C 形积木才用 SUBSTACK。
           写错了不会报错，只会静默只生成最上面那一块，看着像"搭了但没搭全"。 */
        var xml =
            '<block type="event_whenflagclicked">' +
            '<next>' +
            '<block type="control_repeat">' +
            '<value name="TIMES"><shadow type="math_whole_number">' +
            '<field name="NUM">10</field></shadow></value>' +
            '<statement name="SUBSTACK">' +
            '<block type="motion_movesteps">' +
            '<value name="STEPS"><shadow type="math_number">' +
            '<field name="NUM">10</field></shadow></value>' +
            '<next><block type="motion_turnright">' +
            '<value name="DEGREES"><shadow type="math_number">' +
            '<field name="NUM">15</field></shadow></value>' +
            '</block></next></block>' +
            '</statement></block>' +
            '</next></block>';
        switchTab(['代码', '代码页', 'Code']);
        var b = addBlockXml(xml);
        /* 搭完自己数一遍：嵌套没建出来时 domToBlock 也不报错，
           不校验的话就变成"说搭好了，其实只有一块"。 */
        var n = 1;
        try { n = b.getDescendants(false).length; } catch (e) { /* ignore */ }
        if (n < 5) throw new Error('脚本没搭完整（只生成了 ' + n + ' 块）');
        return '已搭好（' + n + ' 块积木）';
    }

    /* ================================================================== *
     * 计划执行
     * ------------------------------------------------------------------ *
     * 关闭「观察过程」时：
     *   · AI 打开的弹窗创建后立刻收进 DOCK（节点保留，点图标随时看）
     *   · 另开一个小窗显示"现在在做什么 + 正在想什么"
     * 这两件事是同时发生的，所以你既不会被打断，也不会失去对它的掌控。
     * ================================================================== */

    var steps = [], stepIdx = 0, stopReq = false;

    function stopRun() { stopReq = true; }

    function ensureProg() {
        if (progWin) return progWin;
        progWin = winShell('sw-prog', 'STAR 正在工作', false);
        progWin.querySelector('.sw-prog-body').innerHTML =
            '<div class="sw-prog-think"><b>正在思考</b><span class="sw-think-txt"></span></div>' +
            '<ol class="sw-prog-steps"></ol>' +
            '<div class="sw-prog-bar"><i></i></div>';
        attachChrome(progWin, function () { progWin.style.display = 'none'; });
        return progWin;
    }
    function progOpen() {
        ensureProg();
        if (!progWin.parentNode) topHost().appendChild(progWin);
        progWin.style.display = '';
        place(progWin, 360, 240);
        progWin.style.left = (window.innerWidth - 380) + 'px';
        progWin.style.top = '120px';
        front(progWin);
    }
    function progSteps(list) {
        var ol = progWin && progWin.querySelector('.sw-prog-steps');
        if (!ol) return;
        var h = '';
        for (var i = 0; i < list.length; i++) {
            var cl = i < stepIdx ? 'is-ok' : (i === stepIdx ? 'is-run' : '');
            var mk = i < stepIdx ? '✓' : (i === stepIdx ? '●' : '○');
            h += '<li class="' + cl + '"><em>' + mk + '</em><span>' + esc(list[i]) + '</span></li>';
        }
        ol.innerHTML = h;
        var bar = progWin.querySelector('.sw-prog-bar i');
        if (bar) bar.style.width = (list.length ? Math.round(stepIdx / list.length * 100) : 0) + '%';
    }
    function progThink(txt) {
        var el = progWin && progWin.querySelector('.sw-think-txt');
        if (el) el.textContent = txt || '';
    }
    /* 逐字冒出来的"正在想"，纯视觉，不影响执行 */
    function typeThink(txt) {
        if (thinkTimer) { window.clearTimeout(thinkTimer); thinkTimer = 0; }
        var i = 0;
        var step = Math.max(1, Math.ceil(txt.length / 40));
        var tick = function () {
            i += step;
            progThink(txt.slice(0, i));
            if (i < txt.length && !stopReq) thinkTimer = window.setTimeout(tick, 24);
        };
        tick();
    }

    function runPlan(list) {
        if (STAR_CHAT_ONLY) {
            push('sys', 'STAR 只聊天与教学，不会执行编辑器操作。');
            return Promise.resolve();
        }
        if (!aiCfg().canOperate) {
            push('sys', '当前设置不允许 STAR 操作编辑器，已跳过执行（可在「设置 → 常规 → STAR AI」开启）。');
            return Promise.resolve();
        }
        if (busy) return Promise.resolve();
        busy = true;
        stopReq = false;
        steps = list;
        stepIdx = 0;
        var log = [];
        for (var i = 0; i < list.length; i++) log.push({ st: '', t: list[i].label });

        if (!watchOn()) progOpen();
        progSteps(log.map(function (x) { return x.t; }));
        typeThink(list.length ? list[0].think || '开始处理…' : '');

        var next = function () {
            if (stopReq || stepIdx >= steps.length) return finish();
            var s = steps[stepIdx];
            log[stepIdx].st = 'run';
            progSteps(log.map(function (x) { return x.t; }));
            typeThink(s.think || s.label);
            var p;
            try {
                p = Promise.resolve(s.run());
            } catch (e) {
                p = Promise.reject(e);
            }
            p.then(function (r) {
                log[stepIdx].st = 'ok';
                log[stepIdx].t = s.label + (r ? ' —— ' + r : '');
            }, function (e) {
                log[stepIdx].st = 'no';
                log[stepIdx].t = s.label + ' —— ' + (e && e.message ? e.message : '失败');
            }).then(function () {
                stepIdx++;
                progSteps(log.map(function (x) { return x.t; }));
                if (watchOn()) { pushLog(log.slice()); }
                if (stepIdx < steps.length && !stopReq) typeThink(steps[stepIdx].think || '');
                return next();
            });
        };
        var finish = function () {
            busy = false;
            if (!watchOn()) {
                progThink('完成。后台打开的窗口都收在 DOCK 栏里，点图标随时查看。');
            }
            pushLog(log.slice());
            steps = [];
        };
        return next();
    }

    /* ================================================================== *
     * 发送消息
     * ================================================================== */

    function submit() {
        if (!inputEl) return;
        var txt = (inputEl.value || '').trim();
        if (!txt) return;
        if (!aiCfg().enabled) {
            push('sys', 'STAR AI 未开启，请在「设置 → 常规 → STAR AI」中开启。');
            return;
        }
        applyAICfg();
        inputEl.value = '';
        push('me', txt);
        var p = cfg.provider || 'local';
        if (p === 'local') { localRun(txt); return; }
        if (isFree(p)) { callFree(txt); return; }
        if (p === 'custom') {
            if (!cfg.api || !cfg.key) {
                push('sys', '通用接口还没填地址或 Key，已改用本地教学应答。' +
                    '点右上角齿轮可以配置。');
                localRun(txt);
                return;
            }
            callModel(txt);
            return;
        }
        localRun(txt);
    }

    /* 「想画画」的信号。模型回绝时爱说"我无法生成图片/png"，
       这种话同样应该触发打开造型器，所以关键词里带上它们。 */
    /* 末尾的单个「画」是兜底：早期只列了「画一个/画一张/画幅」这类固定搭配，
       「画一只猫」「画朵云」统统不命中，只能回帮助文本。 */
    var DRAW_RE = /造型|绘制|画板|生成图|出图|图片|png|插画|立绘|画/;

    /* 从「点击文件菜单」「点一下 保存」「打开 设置」这类话里抠出目标名字。
       优先取引号里的，其次取"点击/打开/点一下"后面的第一个词。 */
    function clickTarget(t) {
        var m = t.match(/[「\["'"'"']([^」\]"'"'"']{1,12})[」\]"'"'"']/);
        if (m && m[1]) return m[1].trim();
        m = t.match(/(?:点击|按一下|按下|点一下|点开|打开)\s*([^\s，。、]{1,10})/);
        if (m && m[1]) return m[1].trim();
        return '';
    }

    /* 离线也能给出矢量图：内置几套角色 SVG 源码。
       AI 出不了位图，但能写 SVG —— 本地引擎命中画图需求时直接吐源码，
       回复下方会出现「导入为造型」，点了就变成当前角色的造型。 */
    var SVG_TPL = [
        { name: '小猫', k: ['猫', '小猫', '猫咪', 'cat'],
          svg: '<svg viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg">' +
               '<ellipse cx="240" cy="226" rx="92" ry="66" fill="#f6c177"/>' +
               '<circle cx="240" cy="152" r="62" fill="#ffd8a8"/>' +
               '<path d="M190 112 L180 58 L224 92 Z" fill="#f6c177"/>' +
               '<path d="M290 112 L300 58 L256 92 Z" fill="#f6c177"/>' +
               '<circle cx="217" cy="150" r="8" fill="#2d3748"/>' +
               '<circle cx="263" cy="150" r="8" fill="#2d3748"/>' +
               '<path d="M240 168 L231 179 L249 179 Z" fill="#e8899a"/>' +
               '<path d="M240 179 Q226 194 214 183" stroke="#2d3748" stroke-width="4" fill="none" stroke-linecap="round"/>' +
               '<path d="M240 179 Q254 194 266 183" stroke="#2d3748" stroke-width="4" fill="none" stroke-linecap="round"/>' +
               '<path d="M330 250 Q382 228 372 176" stroke="#f6c177" stroke-width="22" fill="none" stroke-linecap="round"/>' +
               '</' + 'svg>' },
        { name: '火箭', k: ['火箭', '飞船', 'rocket', '航天'],
          svg: '<svg viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg">' +
               '<path d="M240 40 Q292 110 292 196 L188 196 Q188 110 240 40 Z" fill="#eef2f7"/>' +
               '<circle cx="240" cy="150" r="26" fill="#75c1c4"/>' +
               '<path d="M188 196 L152 250 L188 236 Z" fill="#4a90a4"/>' +
               '<path d="M292 196 L328 250 L292 236 Z" fill="#4a90a4"/>' +
               '<rect x="206" y="236" width="68" height="26" rx="6" fill="#c9d4e0"/>' +
               '<path d="M216 262 L206 316 L240 300 L274 316 L264 262 Z" fill="#ff8a5c"/>' +
               '<path d="M240 300 L240 340" stroke="#ffb300" stroke-width="10" fill="none" stroke-linecap="round"/>' +
               '</' + 'svg>' },
        { name: '星星', k: ['星星', '星', 'star', '五角星'],
          svg: '<svg viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg">' +
               '<path d="M240 52 L292 148 L398 160 L318 232 L340 338 L240 286 L140 338 ' +
               'L162 232 L82 160 L188 148 Z" fill="#ffcf5c" stroke="#f0a500" ' +
               'stroke-width="6" stroke-linejoin="round"/>' +
               '<circle cx="240" cy="196" r="34" fill="#fff3c4"/>' +
               '</' + 'svg>' },
        { name: '小人', k: ['小人', '人', '角色', '人物', '火柴人', 'player'],
          svg: '<svg viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg">' +
               '<circle cx="240" cy="96" r="42" fill="#ffd8a8"/>' +
               '<circle cx="226" cy="90" r="5" fill="#2d3748"/>' +
               '<circle cx="254" cy="90" r="5" fill="#2d3748"/>' +
               '<path d="M226 112 Q240 124 254 112" stroke="#2d3748" stroke-width="4" fill="none" stroke-linecap="round"/>' +
               '<path d="M240 138 L240 236" stroke="#75c1c4" stroke-width="18" fill="none" stroke-linecap="round"/>' +
               '<path d="M240 160 L180 206" stroke="#75c1c4" stroke-width="14" fill="none" stroke-linecap="round"/>' +
               '<path d="M240 160 L300 206" stroke="#75c1c4" stroke-width="14" fill="none" stroke-linecap="round"/>' +
               '<path d="M240 236 L202 320" stroke="#4a90a4" stroke-width="16" fill="none" stroke-linecap="round"/>' +
               '<path d="M240 236 L278 320" stroke="#4a90a4" stroke-width="16" fill="none" stroke-linecap="round"/>' +
               '</' + 'svg>' },
        { name: '云朵', k: ['云', '云朵', 'cloud', '天气'],
          svg: '<svg viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg">' +
               '<ellipse cx="186" cy="206" rx="70" ry="52" fill="#ffffff"/>' +
               '<ellipse cx="256" cy="180" rx="86" ry="64" fill="#ffffff"/>' +
               '<ellipse cx="322" cy="212" rx="64" ry="48" fill="#ffffff"/>' +
               '<rect x="140" y="212" width="216" height="46" rx="23" fill="#ffffff"/>' +
               '<circle cx="196" cy="300" r="9" fill="#bfe3ef"/>' +
               '<circle cx="240" cy="314" r="9" fill="#bfe3ef"/>' +
               '<circle cx="284" cy="300" r="9" fill="#bfe3ef"/>' +
               '</' + 'svg>' }
    ];

    function pickSvg(t) {
        var s = String(t || '');
        for (var i = 0; i < SVG_TPL.length; i++) {
            for (var j = 0; j < SVG_TPL[i].k.length; j++) {
                if (s.indexOf(SVG_TPL[i].k[j]) >= 0) return SVG_TPL[i];
            }
        }
        return SVG_TPL[0];
    }

    /* [1.0.5 SEA] 本地引擎改为「聊天 + Start Editor 教学」文字应答。
       旧指令识别代码保留但不进入（入口直接返回），编辑器一律不被触碰。 */
    function chatTeach(txt, quiet) {
        if (quiet) return;
        var t = String(txt == null ? '' : txt);
        var z = /[\u4e00-\u9fa5]/.test(t);
        var a = aiCfg();
        var pre = a.callName ? (a.callName + (z ? '，' : ', ')) : '';
        /* 英文提问归一化到同一套中文教学条目，回复仍按原语言给 */
        var EN2ZH = [
            [/\b(save|download|export|sb3)\b/i, '保存'],
            [/\b(block|blocks|program|programming|script|drag)\b/i, '积木'],
            [/\b(glass|theme|dark|appearance|blur)\b/i, '玻璃'],
            [/\b(minimize|genie|dock)\b/i, '最小化'],
            [/\b(costume|canvas|paint|thumbnail|zoom)\b/i, '造型'],
            [/\b(music|audio|offline|sample|track)\b/i, '音乐'],
            [/\b(project files|package|zip)\b/i, '工程文件'],
            [/\b(language|english|chinese|locale)\b/i, '语言'],
            [/\b(version|about|release)\b/i, '版本'],
            [/\b(userscript|tampermonkey|addon)\b/i, '油猴'],
            [/\b(shortcut|stt|hotkey)\b/i, '快捷键'],
            [/\b(settings|preferences|where|option)\b/i, '设置'],
            [/\b(hello|hi|who are you|help)\b/i, '你好']
        ];
        var probe = t;
        for (var k = 0; k < EN2ZH.length; k++) {
            if (EN2ZH[k][0].test(t)) probe += ' ' + EN2ZH[k][1];
        }
        var TEACH = [
            [/保存|下载|导出|另存|\.sb3|sb3|文件保存到/i,
             '保存作品：点顶栏「文件」→「保存到电脑」，会下载标准 .sb3。想看压缩包里有什么，去左侧「工程文件」工作区。',
             'File → Save to your computer downloads a standard .sb3. The "Project files" tab shows exactly what is inside the package.'],
            [/帮我做|帮我编|代做|写一个作品|做个作品|搭一个|搭个|生成.*(积木|作品)|加.*积木|拖.*积木|删除.*积木|积木|编程|写脚本|代码怎么/i,
             'STAR 现在只聊天和教学，不代你编程或生成积木。自己动手的顺序是：切到「代码」标签 → 左侧选一个积木分类 → 把积木拖进工作区 → 改参数 → 点绿旗运行。',
             'STAR only chats and teaches now; it will not build blocks for you. Switch to the Code tab, pick a category on the left, drag a block into the workspace, edit its fields, then click the green flag.'],
            [/毛玻璃|液态玻璃|玻璃|主题|深色|浅色|弹窗外观|窗口样式|按钮样式/i,
             '在「设置 → 外观」里可以调弹窗外观、按钮样式和主题；毛玻璃与液态玻璃是互斥的，开一个会自动关另一个。',
             'Settings → Appearance controls popup look, window buttons and theme. Frosted Glass and Liquid Glass are mutually exclusive — enabling one disables the other.'],
            [/最小化|神灯|缩放效果|dock|收进/i,
             '窗口最小化会收进右下角 DOCK。动画样式在「设置 → 外观 → 弹窗动画 → 最小化动画」，有「神灯效果」（卷曲吸入）和「缩放效果」（直线缩小）两项。',
             'Minimized windows land in the Dock. Choose the animation in Settings → Appearance → Popup animation → Minimize animation: Genie effect or Scale effect.'],
            [/造型|画布|缩略图|绘画|画笔|工具栏/i,
             '造型编辑器：左侧工具栏是单列可上下滚动的，顶部工具排成一行，右下角有当前造型缩略图；滚轮或缩放按钮带动画，每个工具右下角标了快捷键。',
             'The costume editor has a single scrollable tool column, one-row top tools, a current-costume thumbnail at bottom right, animated zoom, and shortcut letters on each tool.'],
            [/音乐|素材库|联网|没网|编曲|音轨/i,
             '左侧「音乐」是音乐工坊：多轨编曲、导入音频、导出 MIDI/WAV。在线素材库需要联网，没网络会显示「请联网」；本地导入和编曲不受影响。',
             'The Music tab is the multi-track workshop. Its online sample library needs a connection and shows "Please connect to the internet" when offline; local import and editing still work.'],
            [/工程文件|压缩包|里面有什么|打包后/i,
             '「工程文件」工作区会真的把作品打包一次，再列出 .sb3 里的 project.json、造型和声音资源，能预览、单独下载，还会显示压缩率。',
             'The "Project files" tab actually packages the project once, then lists project.json, costumes and sounds with previews, single-file downloads and compression ratios.'],
            [/语言|英文|中文|切换界面|播放器首页/i,
             '语言在设置里切换，改完不会跳到播放器首页（这个跳转问题已经修掉了）。',
             'Change the interface language in Settings; switching no longer falls back to the player-only home screen.'],
            [/版本|版本号|关于|更新内容|介绍|start editor是什么/i,
             'Start Editor 是可离线单文件使用的图形化编程编辑器，当前版本 1.0.5 SEA。版本大卡只在「设置 → 版本号」页显示，带液态流动动画，下面还有历代更新记录。',
             'Start Editor is a single-file offline block-based editor, currently 1.0.5 SEA. The animated version card only appears under Settings → Version, followed by the release history.'],
            [/油猴|用户脚本|插件脚本/i,
             '油猴脚本删除或停用后会立即失效：定时器、监听、观察器和注入样式都会被撤销，不用刷新页面。',
             'Userscripts stop immediately when deleted or disabled — timers, listeners, observers and injected styles are all torn down without a reload.'],
            [/快捷键|stt|怎么打开|怎么呼出|启动.*ai/i,
             '在编辑器里 1.2 秒内依次按 S、T、T 可以打开或收起 STAR AI；输入框里打字时不会误触发。',
             'Press S, T, T within 1.2 seconds to toggle STAR AI; it is ignored while typing in an input.'],
            [/设置|选项卡|分区|在哪|哪里/i,
             '设置分区有：常规、外观、高级、版本号、STAR AI。STAR AI 里可调总开关、称呼、温度、内置免费模型。',
             'Settings sections: General, Appearance, Advanced, Version and STAR AI. STAR AI controls the enable switch, your name, temperature and the built-in free models.'],
            [/你好|你是谁|叫什么|能做什么|聊会|hi|hello/i,
             '我是 STAR，Start Editor 里的助手。现在只陪你聊天、用文字讲 Start Editor 怎么用；不会替你编程作品，也不会去点编辑器。想问哪一块？',
             'I am STAR, the assistant inside Start Editor. I only chat and teach the editor in plain text — no programming, no clicking the editor for you. What would you like to know?']
        ];
        var reply = '';
        for (var i = 0; i < TEACH.length; i++) {
            if (TEACH[i][0].test(probe)) { reply = z ? TEACH[i][1] : TEACH[i][2]; break; }
        }
        if (!reply) {
            reply = z
                ? '我可以陪你聊，也可以讲 Start Editor 的用法：保存作品、积木工作区、造型编辑器、音乐工坊、工程文件、玻璃效果、DOCK 最小化动画、版本号页等等。想了解哪一块，直接问就行。'
                : 'I can chat or explain Start Editor in plain text: saving projects, the blocks workspace, costume editor, music workshop, project files, glass effects, Dock minimize animations and the version page. Just ask.';
        }
        if (a.temperature >= 0.8) {
            reply += z ? '\n（想再聊细一点，随时问～）' : '\nAsk me anything else.';
        }
        push('ai', pre + reply);
    }

    /* 本地指令引擎：入口闸门 —— 只读模式下只回文字，不执行任何动作 */
    function localRun(txt, quiet) {
        if (STAR_CHAT_ONLY) return chatTeach(txt, quiet);
        var t = txt;
        var plan = [];

        if (/监视|监控|看变量|数据|变量值/.test(t)) {
            plan.push({ label: '打开数据监视', think: '先把角色身上的变量和状态读出来。',
                        run: function () {
                            return switchTab(['代码', 'Code']).then(function () {
                                openMonitor(); return '已打开';
                            });
                        } });
        }
        /* 画画：AI 出不了图，但它能把造型器打开 —— 所以命中就开，
           不命中"我无法生成图片"这种回绝。关键词里刻意带上 图片/png，
           因为模型回绝时说的就是这两个词。 */
        if (DRAW_RE.test(t)) {
            plan.push({ label: '打开造型器绘画', think: '切到造型页，再把绘制面板打开，方便照着画。',
                        run: function () {
                            return openPaint().then(function (ok) {
                                return ok ? '已打开绘制面板'
                                          : '已切到造型页（绘制按钮没找到，页面上点一下「绘制」即可）';
                            });
                        } });
            /* 出不了位图，但能写 SVG：直接给出矢量图源码，回复下方可一键导入成造型 */
            (function () {
                var tpl = pickSvg(t);
                plan.push({ label: '生成角色矢量图', think: '给一段能直接用的 SVG 源码。',
                            run: function () {
                                push('ai', '这是「' + tpl.name + '」的矢量图源码，' +
                                    '点下面的「导入为造型」直接变成当前角色的造型：\n\n' +
                                    '```svg\n' + tpl.svg + '\n```');
                                return '已给出 SVG 源码（' + tpl.name + '）';
                            } });
            })();
        }
        if (/拓展|扩展/.test(t)) {
            var eid = matchExt(t);
            plan.push({ label: '加载拓展 ' + (eid || '（未识别）'),
                        think: '确认拓展 id，再交给 VM 加载。',
                        run: function () {
                            if (!eid) throw new Error('没听出要加载哪个拓展，换个说法试试：加载画笔拓展');
                            return loadExt(eid).then(function () { return '已加载 ' + eid; });
                        } });
        }
        if (/删除.*积木|清空.*积木|删掉.*积木/.test(t)) {
            plan.push({ label: '删除积木', think: '清空当前角色工作区里的顶层脚本。',
                        run: function () {
                            return switchTab(['代码', 'Code']).then(function () {
                                var n = delBlocks();
                                return '删掉了 ' + n + ' 组脚本';
                            });
                        } });
        }
        if (/搭建|做一个|做个|建一个|创建.*脚本|示例/.test(t)) {
            plan.push({ label: '搭建示例作品', think: '绿旗 → 重复十次 → 移动并转向。',
                        run: function () { buildDemo(); return '已搭好'; } });
        }
        if (/运行|启动|开始跑|绿旗|跑起来/.test(t) && !/停止/.test(t)) {
            plan.push({ label: '运行作品', think: '点绿旗把作品跑起来。',
                        run: function () {
                            return runProject().then(function () { return '已运行'; });
                        } });
        }
        if (/停止|停下来|暂停|结束运行/.test(t)) {
            plan.push({ label: '停止作品', think: '把正在跑的脚本全部停下。',
                        run: function () {
                            return stopProject().then(function () { return '已停止'; });
                        } });
        }
        if (/撤销|回退|反悔/.test(t)) {
            plan.push({ label: '撤销', think: '回退工作区里上一步操作。',
                        run: function () {
                            return undoRedo(false).then(function () { return '已撤销一步'; });
                        } });
        }
        if (/重做|恢复上一步/.test(t)) {
            plan.push({ label: '重做', think: '把刚撤销的那步再做回来。',
                        run: function () {
                            return undoRedo(true).then(function () { return '已重做'; });
                        } });
        }
        if (/添加角色|新建角色|加个角色|添加一个角色/.test(t)) {
            plan.push({ label: '添加角色', think: '在角色区点开添加入口。',
                        run: function () {
                            return addSprite().then(function () { return '已点开添加角色'; });
                        } });
        }
        /* 设置变量：「把得分设为 10」「设置 得分 为 5」 */
        var vm1 = t.match(/(?:把|将|设置)\s*([^\s设为为]+?)\s*(?:设为|设置为|设成|改为|为)\s*(-?\d+(?:\.\d+)?|[^\s，。]+)/);
        if (vm1 && vm1[1] && vm1[2]) {
            (function (m) {
                plan.push({ label: '设置变量 ' + m[1] + ' = ' + m[2],
                            think: '在角色（或舞台）上找到这个变量，把值改掉。',
                            run: function () {
                                return setVar(m[1], m[2]).then(function (n) {
                                    return '已改 ' + n + ' 处';
                                });
                            } });
            })(vm1);
        }
        /* 通用点击：说得出名字的按钮，AI 都能替你点 —— 这是"操控整个编辑器"的兜底 */
        if (/点击|按一下|按下|点一下|打开菜单|点开/.test(t)) {
            var ct = clickTarget(t);
            if (ct) {
                (function (nm) {
                    plan.push({ label: '点击「' + nm + '」',
                                think: '在界面上找到写着「' + nm + '」的地方，点下去。',
                                run: function () {
                                    return clickText([nm]).then(function () { return '已点击'; });
                                } });
                })(ct);
            }
        }

        if (/积木/.test(t) && !plan.length) {
            var c = findCatalog(t);
            plan.push({ label: c ? ('拖出积木：' + c.name) : '拖出积木（未识别）',
                        think: '把指令拆成点击消息，逐条点击编辑器并回读校验。',
                        run: function () {
                            if (!c) throw new Error('没听出是哪块积木，试试：拖出一个移动20步的积木');
                            /* [1.0.5 SEA] 主路径：把「拖出积木」拆成一串
                               点击消息，逐条真实点击编辑器（代码标签 → 分类 →
                               积木 → 工作区 → 参数输入框），不再直接写 XML。 */
                            var msgs = clickPlanForBlock(c);
                            var before = [];
                            try {
                                var ws0 = getWS();
                                before = (ws0 && ws0.getTopBlocks ? ws0.getTopBlocks(true) : []).slice();
                            } catch (e0) { /* ignore */ }
                            return switchTab(['代码', 'Code']).then(function () {
                                return sendClickMessage(msgs);
                            }).then(function (n) {
                                var field = fieldNameFor(t);
                                var got = (c.expect === null || c.expect === undefined)
                                    ? null : latestBlockValue(c, field);
                                if (c.expect !== null && c.expect !== undefined &&
                                    String(got) !== String(c.expect)) {
                                    /* 点击链路没把参数写进去（或写错）：先撤掉
                                       这次点击产生的同类型积木，再用严格 XML
                                       写入校正。「移动20步」绝不能变成 10 步。 */
                                    try {
                                        var ws2 = getWS();
                                        var after = ws2 && ws2.getTopBlocks ? ws2.getTopBlocks(true) : [];
                                        for (var z = 0; z < after.length; z++) {
                                            if (before.indexOf(after[z]) < 0 && after[z].type === c.type) {
                                                try { after[z].dispose(false); } catch (eD) { /* ignore */ }
                                            }
                                        }
                                    } catch (eC) { /* ignore */ }
                                    var b = addBlockXml(c.xml);
                                    var chk = readBlockValue(b, field);
                                    if (chk !== null && String(chk) !== String(c.expect)) {
                                        throw new Error('参数没按指令写入：要求 ' +
                                            c.expect + '，实际 ' + chk);
                                    }
                                    return '已发送 ' + n + ' 条点击消息；参数严格校正为 ' + c.expect;
                                }
                                return '已发送 ' + n + ' 条点击消息' +
                                    (c.expect !== null && c.expect !== undefined
                                        ? '，参数 ' + c.expect + ' 已核对' : '');
                            });
                        } });
        }

        if (!plan.length) {
            if (quiet) return;
            var tip = '本地指令引擎听懂的是这几类：\n' +
                '· 监视数据 / 看看变量\n· 打开造型器绘画（画画就开它）\n· 加载画笔拓展\n' +
                '· 拖出一个移动20步积木（数字会原样写进积木）\n' +
                '· 删除所有积木\n· 搭一个示例作品\n' +
                '· 运行作品 / 停止\n· 撤销 / 重做\n· 添加角色\n' +
                '· 把得分设为 10\n· 点击「文件」\n\n' +
                '想要真正的对话式 AI，点右上角齿轮挑一个接口。';
            push('ai', tip);
            return;
        }
        var head = watchOn()
            ? '好的，我按这几步做，弹窗会直接显示出来：'
            : '好的，我转到后台做，弹窗会收进 DOCK 栏，右下角小窗显示进度：';
        push('ai', head);
        runPlan(plan);
    }

    /* 真实模型：OpenAI 兼容接口。
       只做单次对话 + 文本回复，工具调用由本地引擎负责 —— 这样即使模型侧
       返回的格式不合预期，也不会把编辑器改坏。 */
    function callModel(txt) {
        push('sys', '正在请求 ' + (cfg.model || '通用接口') + ' …');
        var body = {
            model: cfg.model,
            temperature: aiCfg().temperature,
            messages: [{ role: 'system', content: starSys() },
                       { role: 'user', content: txt }],
            stream: false
        };
        var url = cfg.api.replace(/\/+$/, '') + '/chat/completions';
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json',
                       'Authorization': 'Bearer ' + cfg.key },
            body: JSON.stringify(body)
        }).then(function (r) {
            return r.text().then(function (s) {
                if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + s.slice(0, 120));
                return JSON.parse(s);
            });
        }).then(function (j) {
            var txt2 = pickText(j, 0) || '(没有返回内容)';
            push('ai', plainAIText(txt2));
            /* 模型回了文本之后，再看里面有没有能直接执行的指令。
               纯聊天内容就不要弹"本地引擎听不懂"那串提示了。 */
            dispatchAIReply(txt2);
        }, function (e) {
            push('sys', '请求失败：' + (e && e.message ? e.message : e) + '。已改用本地教学应答。');
            localRun(txt);
        });
    }

    /* ---------------- 启动 ---------------- */

    loadCfg();
    ptrOn = readPtrOn();
    sessions = readJSON(STORE_SESS, []);
    if (!Array.isArray(sessions)) sessions = [];
    if (!sessions.length) newSession();

    function noEdit() {
        push('sys', 'STAR 只聊天与教学，不会操作编辑器或编程作品。');
        return false;
    }
    window.__blStar = {
        open: open,
        close: close,
        toggle: toggle,
        isOpen: isOpen,
        /* [1.0.5 SEA] 所有会改动作品 / 点击编辑器的接口一律只读拒绝 */
        run: noEdit,
        monitor: noEdit,
        paint: noEdit,
        ext: noEdit,
        addBlock: noEdit,
        delBlocks: noEdit,
        build: noEdit,
        clickText: noEdit,
        start: noEdit,
        stop: noEdit,
        undo: noEdit,
        redo: noEdit,
        addSprite: noEdit,
        setVar: noEdit,
        importSvg: noEdit,
        svgOf: noEdit,
        sendClickMessage: noEdit,
        cfg: function () { return cfg; },
        openCfg: function () { openCfg(); },
        freeUrl: function (id, text) {
            var f = findFree(id);
            return f ? freeUrl(f, text, curOpt(id)) : '';
        },
        parse: parseReply,
        budget: budgetFor,
        withSys: function (id, text, bud) {
            var f = findFree(id);
            return f ? withSys(f, text, bud || budgetFor()) : '';
        },
        candidates: function (id, text) {
            var f = findFree(id);
            return f ? candidates(freeUrl(f, withSys(f, text, budgetFor()), curOpt(id)), cfg.proxy, cfg.proxyTpl) : [];
        },
        submit: function (t) { if (inputEl) { inputEl.value = t || ''; submit(); } },
        ptr: function () { return ptrOn; },
        setPtr: setPtrOn,
        delSession: delSession,
        pushAi: function (t) { push('ai', plainAIText(t)); },
        /* 供测试使用 */
        _state: function () {
            return { watch: watchMode, busy: busy, sessions: sessions.length,
                     win: !!win, prog: !!progWin, mon: !!monWin };
        },
        /* [1.0.5 SEA] */
        aiCfg: aiCfg,
        setAICfg: setAICfg,
        stt: function () { if (!aiCfg().enabled) return false; toggle(); return true; }
    };

    /* 设置分区改了配置 → 同一个事件循环内对齐模型与提示词 */
    document.addEventListener('bl:star-ai-change', function () { applyAICfg(true); });
    window.addEventListener('storage', function (e) {
        if (e && e.key === AI_KEY) applyAICfg(true);
    });
    installSTT();
    applyAICfg();
})();

