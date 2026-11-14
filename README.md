# StartEditor

> 一个「单文件」Web 编辑器，现在有了能真正维护的仓库结构。

线上产物是**一个 `index.html`**：样式、脚本、静态资源、12 个 webpack chunk 全部内联，靠内置的 DEFLATE 解码器在启动期同步解压，零请求、秒开。

代价是它没法维护 —— 20 MB、单行超长文本、105 段压缩源码挤在一个文件里。本仓库把那个文件按**层**拆成 131 个可定位、可 diff、可单独修改的源文件，再用一个零依赖脚本按原顺序拼回去，**拼回产物与原始文件逐字节一致**。

```
src/（131 个分层块）
   ↓  npm run build  →  字符串按序拼接，不压缩、不转译、不注入空白
dist/index.html（20.7 MB，与原始单文件 sha256 相同）
```

## 目录结构

```
.
├── .github/
│   └── workflows/
│       ├── ci.yml                        # 构建 + 自检 + 产物存档
│       └── deploy-cloudflare-pages.yml   # 构建 → artifact → wrangler pages deploy
├── docs/
│   ├── BLOCKS.md                         # 131 个块的完整清单（自动生成）
│   ├── blocks.json                       # 同一份清单的机器可读版 + 基线指纹
│   ├── 代码结构说明.md                    # 分层原理、启动时序、改哪儿的对照表
│   └── 部署.md                            # Cloudflare Pages / Vercel / 自托管
├── public/                               # 静态透传（原样进 dist/）
│   ├── _headers                          # CF Pages 缓存与安全响应头
│   └── favicon.svg
├── scripts/
│   ├── import-single-file.mjs            # 单文件 → 分层源码（可重复执行）
│   ├── build.mjs                         # 分层源码 → dist/index.html
│   ├── dev.mjs                           # watch + 本地静态服务（零依赖）
│   └── check.mjs                         # 可达性 / 孤儿块 / 结构 / 体积自检
├── src/
│   ├── index.html                        # 入口模板：骨架 + 131 个 {{include}}
│   ├── boot/                             # ① 启动层  B00 B01 B02–B07 B107
│   ├── assets/                           # ② 资源层  __RES__ 资源表 + 11.9 MB 主 bundle
│   ├── bridge/                           # ③ 桥接层  B13–B15 索引 / Blob / URL 重写
│   ├── vendor/
│   │   ├── chunks/                       # ④ 构建层  12 个 webpack chunk 原文
│   │   └── loaders/                      # ④ 构建层  与 chunk 配对的解码装载器
│   └── patches/
│       ├── js/                           # ⑤ 补丁层  58 个功能补丁
│       └── css/                          # ⑤ 补丁层  34 个样式块
├── .editorconfig
├── .gitattributes                        # 大载荷标记 -text，防止行尾被改写
├── .gitignore
├── .nvmrc                                # Node 22
├── LICENSE
├── README.md
├── package.json                          # 零依赖，仅 5 个脚本
├── tsconfig.json
├── types.d.ts                            # window.__bl* 运行时 API 声明
├── vercel.json
└── wrangler.toml                         # Pages 项目配置
```

## 快速开始

```bash
npm run dev      # http://localhost:5173 ，改 src/ 自动重拼
npm run build    # 产出 dist/index.html
npm run check    # 自检：include 可达 / 无孤儿块 / 结构完整 / < 25 MiB
```

没有 `npm install` 这一步 —— 构建链路只用 Node 内置模块，`devDependencies` 为空。

## 拆分的正确性怎么保证

`scripts/import-single-file.mjs` 在拆分时记录了原始文件的 sha256（存在 `docs/blocks.json`）。构建时会比对：

- `npm run verify` → 强制要求一致，用于证明「拆分没吞字节」；
- `npm run build` → 只提示。因为一旦你改了 `src/` 里的代码，指纹本来就该变。

刚拆完时两者相同：

```text
✔ build  dist/index.html  20.67 MB  sha256=b7f2374f5da11c1c…  includes=131
✔ 基线指纹一致：产物与导入时的单文件逐字节相同
```

## 部署到 Cloudflare Pages

| 配置项 | 值 |
| --- | --- |
| Build command | **`npm run build`** |
| Build output directory | **`dist`** |
| Framework preset | None |
| Node 版本 | 22（`.nvmrc` 自动识别） |

命令行等价物：

```bash
npm run build
npx wrangler pages deploy dist --project-name=starteditor
```

CI 版本已写在 `.github/workflows/deploy-cloudflare-pages.yml`，配好 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` 两个 secret 即可自动发布。细节见 [docs/部署.md](docs/部署.md)。

## 修改须知（三条禁忌）

1. `src/assets/` 与 `src/vendor/` 里的超长单行文本**不能格式化** —— 它们是按换行分段、按字节长度解码的；
2. `bl-embedded-bundle` 的文本**不能增删字符** —— 桥接层用 `indexOf` 建索引，错一位后面全崩；
3. `{{include}}` 占位**不能加缩进或换行** —— 它按字节替换。

想改哪里、对应哪个文件，看 [docs/代码结构说明.md](docs/代码结构说明.md) 的对照表；想知道某个 `Bxx` 是什么，查 [docs/BLOCKS.md](docs/BLOCKS.md)。

## License

[MIT](LICENSE)
