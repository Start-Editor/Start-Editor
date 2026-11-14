#!/usr/bin/env node
/**
 * build.mjs — 把 src/ 分层文件拼装成可直接托管的单文件 dist/index.html
 *
 * 规则：src/index.html 里的 `{{include <相对路径>}}` 会用该文件的**原始字节**替换，
 *       不额外插入换行、不改缩进 —— 所以产物与原单文件逐字节一致
 *       （这就是为什么大块资源可以放在独立文件里而不影响运行）。
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tplPath = join(root, "src/index.html");
const outDir = join(root, process.env.OUT_DIR ?? "dist");
const outFile = join(outDir, "index.html");

const tpl = readFileSync(tplPath, "utf8");
const INCLUDE = /\{\{include ([^}]+)\}\}/g;
const used = new Set();

const html = tpl.replace(INCLUDE, (_, rel) => {
  const p = join(root, rel.trim());
  if (!existsSync(p)) throw new Error(`missing include: ${rel}`);
  used.add(rel.trim());
  return readFileSync(p, "utf8");
});

const orphan = ["src/boot", "src/assets", "src/bridge", "src/vendor/chunks", "src/vendor/loaders", "src/patches/js", "src/patches/css"]
  .flatMap((d) => (existsSync(join(root, d)) ? readdirSync(join(root, d)).map((f) => `${d}/${f}`) : []))
  .filter((f) => !used.has(f));

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html, "utf8");

// public/ 是纯静态透传目录（_headers、favicon 等）
const pub = join(root, "public");
if (existsSync(pub)) {
  for (const f of readdirSync(pub)) {
    const s = join(pub, f);
    if (statSync(s).isFile()) copyFileSync(s, join(outDir, f));
  }
}

const bytes = Buffer.byteLength(html, "utf8");
const sha = createHash("sha256").update(html).digest("hex");
console.log(`✔ build  dist/index.html  ${(bytes / 1048576).toFixed(2)} MB  sha256=${sha.slice(0, 16)}…  includes=${used.size}`);
if (orphan.length) console.log(`⚠ 未引用文件 ${orphan.length} 个：${orphan.slice(0, 5).join(", ")}${orphan.length > 5 ? " …" : ""}`);

// 与导入时记录的基线指纹比对：
//   一致   → 分层拆分无损（刚导入、或改动恰好抵消时）
//   不一致 → 说明本次构建前有人改过分层源码，属正常状态
//   加 --strict 则要求必须一致（用于验证「拆分工具没有吞掉任何字节」）
const manifest = join(root, "docs/blocks.json");
if (existsSync(manifest)) {
  const base = JSON.parse(readFileSync(manifest, "utf8")).sha256;
  if (base) {
    if (base === sha) console.log("✔ 基线指纹一致：产物与导入时的单文件逐字节相同");
    else if (process.argv.includes("--strict")) {
      console.error(`✖ 基线指纹不一致：基线 ${base.slice(0, 16)}… ≠ 当前 ${sha.slice(0, 16)}…`);
      process.exit(1);
    } else console.log(`· 基线指纹 ${base.slice(0, 16)}…（已修改分层源码，属预期）`);
  }
}
