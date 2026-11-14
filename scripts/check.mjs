#!/usr/bin/env node
/**
 * check.mjs — 仓库自检（CI 与本地共用）
 *
 *  1. 拼装产物必须通过 scripts/build.mjs（含与原单文件的 sha256 指纹比对）
 *  2. src/index.html 里的每个 {{include}} 都真实存在
 *  3. src/ 下不存在「未被模板引用」的孤儿块
 *  4. 产物结构完整：doctype / <html> / </html> / 关键装载点
 *  5. 单文件体积不超过 Cloudflare Pages 25 MiB 单文件上限
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";

const root = resolve(import.meta.dirname, "..");
const fail = [];
const ok = (msg) => console.log(`  ✔ ${msg}`);
const bad = (msg) => {
  fail.push(msg);
  console.log(`  ✖ ${msg}`);
};

// 1. 构建（内部已做指纹校验）
const r = spawnSync(process.execPath, [join(root, "scripts/build.mjs")], { encoding: "utf8" });
if (r.status !== 0) {
  console.log(r.stdout ?? "", r.stderr ?? "");
  console.log("\n✖ 构建失败，自检中止");
  process.exit(1);
}
ok("构建通过（131 处分层块拼装为单文件）");

const tpl = readFileSync(join(root, "src/index.html"), "utf8");
const dist = readFileSync(join(root, "dist/index.html"), "utf8");

// 2 + 3. include 可达性 / 孤儿块
const includes = [...tpl.matchAll(/\{\{include ([^}]+)\}\}/g)].map((m) => m[1].trim());
const missing = includes.filter((p) => !existsSync(join(root, p)));
missing.length ? bad(`悬空 include：${missing.slice(0, 3).join(", ")}`) : ok(`${includes.length} 处 include 全部可达`);

const layerDirs = ["src/boot", "src/assets", "src/bridge", "src/vendor/chunks", "src/vendor/loaders", "src/patches/js", "src/patches/css"];
const onDisk = layerDirs.flatMap((d) =>
  existsSync(join(root, d)) ? readdirSync(join(root, d)).map((f) => `${d}/${f}`) : []
);
const orphans = onDisk.filter((f) => !includes.includes(f));
orphans.length ? bad(`孤儿块 ${orphans.length} 个：${orphans.slice(0, 3).join(", ")}`) : ok(`${onDisk.length} 个分层文件全部被引用`);

const empty = onDisk.filter((f) => statSync(join(root, f)).size === 0);
empty.length ? bad(`空文件：${empty.join(", ")}`) : ok("无空块文件");

// 4. 结构完整性
const marks = [
  ["doctype", /^<!doctype html>/i],
  ["<html>", /<html>/i],
  ["同步注入总线 B107", /\[B107\]/],
  ["资源表 __RES__", /__RES__/],
  ["内嵌 bundle", /id="bl-embedded-bundle"/],
  ["桥接层 B13", /\[B13\]/],
  ["chunk 装载器", /data-bilup-src=/],
  ["闭合标签", /<\/html>\s*$/],
];
for (const [name, re] of marks) (re.test(dist) ? ok(`结构 · ${name}`) : bad(`结构缺失 · ${name}`));

// 5. 体积
const mb = statSync(join(root, "dist/index.html")).size / 1048576;
mb < 25 ? ok(`体积 ${mb.toFixed(2)} MB（< 25 MiB Pages 单文件上限）`) : bad(`体积 ${mb.toFixed(2)} MB 超过 Pages 单文件上限`);

console.log(fail.length ? `\n✖ 自检未通过：${fail.length} 项` : "\n✔ 自检全部通过");
process.exit(fail.length ? 1 : 0);
