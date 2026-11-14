#!/usr/bin/env node
/**
 * import-single-file.mjs — 把单文件版 StartEditor_*.html 逆向拆成工程目录
 *
 * 用法：
 *   node scripts/import-single-file.mjs <单文件.html> [--out .]
 *
 * 产物：
 *   src/index.html                 入口模板（含 {{include path}} 占位）
 *   src/boot/*                     ① 启动层 B00–B07 + B85
 *   src/assets/*                   ② 资源层 B20 / bundle / 源码文本
 *   src/bridge/*                   ③ 桥接层 B13–B15
 *   src/vendor/chunks,loaders/*    ④ 构建层 16 个 chunk + 装载器
 *   src/patches/js,css/*           ⑤ 补丁层 B28–B99
 *   docs/BLOCKS.md                 块清单（可读索引）
 *   docs/blocks.json               块清单（机器可读）
 *
 * 设计约束：inner 内容逐字节原样落盘，模板按原顺序生成，
 *           因此 scripts/build.mjs 可以 1:1 还原出原文件。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";

const BLOCK_RE = /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

const argv = process.argv.slice(2);
const srcPath = argv.find((a) => !a.startsWith("--")) ?? "StartEditor_修复版.html";
const outArg = argv.indexOf("--out");
const root = resolve(outArg >= 0 ? argv[outArg + 1] : ".");

const html = readFileSync(resolve(srcPath), "utf8");

/** 依据块在原文中的序号（即分层顺序）决定归属目录 */
function place(idx, tag, attrs, id) {
  const ext = tag === "style" ? "css" : attrs.includes("text/plain") ? "txt" : "js";
  if (idx <= 9) return { dir: "src/boot", ext };
  if (idx <= 14) return { dir: "src/assets", ext };
  if (idx <= 17) return { dir: "src/bridge", ext };
  if (idx <= 41) {
    const isLoader = /data-bilup-src=/.test(attrs);
    return { dir: isLoader ? "src/vendor/loaders" : "src/vendor/chunks", ext };
  }
  return { dir: tag === "style" ? "src/patches/css" : "src/patches/js", ext: tag === "style" ? "css" : "js" };
}

/** 从块内注释头里抽出人类可读标题，供 docs/BLOCKS.md 使用 */
function titleOf(inner, id, srcName) {
  const m = /\[B(\d{2,3})\]([^\n]*)/.exec(inner);
  if (m) {
    const t = m[2].replace(/[\u2500-\u257F─=]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (t) return t;
    return `B${m[1]}`;
  }
  const first = inner.split("\n").find((l) => l.trim().length > 0) ?? "";
  if (/^js\/|^css\//.test(first)) return `内嵌资源 · ${first.trim()}`;
  const cjk = /[\u4e00-\u9fa5]/.test(first);
  if (cjk && first.trim().length < 80) return first.replace(/^[/\s*]+|[\s*-]+$/g, "").slice(0, 60);
  return `压缩 / 二进制资源块${id ? ` · ${id}` : ""}（无注释头）`;
}

const files = [];
let cursor = 0;
let idx = 0;
let template = "";
const rows = [];

for (const m of html.matchAll(BLOCK_RE)) {
  template += html.slice(cursor, m.index);
  const [whole, tag, attrs, inner] = m;
  const idMatch = /id="([^"]+)"/.exec(attrs);
  const id = idMatch ? idMatch[1] : "";
  const mk = /\[B(\d{2,3})\]/.exec(inner);
  const marker = mk ? `b${mk[1]}` : "";
  const srcName = /data-bilup-src="([^"]+)"/.exec(attrs)?.[1] ?? "";

  if (inner.length === 0) {
    template += whole; // 空块保持原样，不生成空文件
  } else {
    const { dir, ext } = place(idx, tag.toLowerCase(), attrs, id);
    // 装载器优先用真实 chunk 文件名做 slug，便于与 webpack 产物对齐
    const nameSlug = srcName ? srcName.split("/").pop().split(".")[0] : "";
    const slug = `${String(idx).padStart(3, "0")}-${id || marker || nameSlug || "chunk"}`;
    const rel = `${dir}/${slug}.${ext}`;
    files.push({ rel, content: inner });
    const open = `<${tag}${attrs}>`;
    template += `${open}{{include ${rel}}}</${tag}>`;
    rows.push({
      order: idx,
      marker: marker.toUpperCase() || "-",
      tag: tag.toLowerCase(),
      id: id || "-",
      bytes: Buffer.byteLength(inner, "utf8"),
      file: rel,
      title: titleOf(inner, id, srcName),
    });
  }
  cursor = m.index + whole.length;
  idx += 1;
}
template += html.slice(cursor);

// ── 落盘 ────────────────────────────────────────────────────────────────────
for (const d of ["src", "docs"]) {
  const p = join(root, d);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}
for (const f of files) {
  const p = join(root, f.rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, f.content, "utf8");
}
mkdirSync(join(root, "src"), { recursive: true });
mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "src/index.html"), template, "utf8");

// ── 清单 ────────────────────────────────────────────────────────────────────
const byLayer = {
  "① 启动层": rows.filter((r) => r.order <= 9),
  "② 资源层": rows.filter((r) => r.order > 9 && r.order <= 14),
  "③ 桥接层": rows.filter((r) => r.order > 14 && r.order <= 17),
  "④ 构建层": rows.filter((r) => r.order > 17 && r.order <= 41),
  "⑤ 补丁层": rows.filter((r) => r.order > 41),
};

const md = [
  "# 块清单（BLOCKS）",
  "",
  "> 由 `scripts/import-single-file.mjs` 自动生成，勿手改。",
  `> 源文件：\`${srcPath}\`（${(html.length / 1048576).toFixed(2)} MB，${rows.length} 个可拆分块）`,
  "",
];
for (const [layer, list] of Object.entries(byLayer)) {
  md.push(`## ${layer}`, "", "| 序号 | 块 | 类型 | 体积 | 文件 | 说明 |", "| --- | --- | --- | --- | --- | --- |");
  for (const r of list) {
    md.push(
      `| ${r.order} | ${r.marker} | ${r.tag} | ${(r.bytes / 1024).toFixed(1)} KB | \`${r.file}\` | ${r.title.replace(/\|/g, "\\|")} |`
    );
  }
  md.push("");
}
writeFileSync(join(root, "docs/BLOCKS.md"), md.join("\n"), "utf8");
writeFileSync(
  join(root, "docs/blocks.json"),
  JSON.stringify({ source: srcPath, sha256: createHash("sha256").update(html).digest("hex"), blocks: rows }, null, 2),
  "utf8"
);

console.log(`✔ 拆分完成：${rows.length} 块 → ${root}`);
console.log(`  模板 src/index.html  ${(Buffer.byteLength(template) / 1024).toFixed(1)} KB`);
