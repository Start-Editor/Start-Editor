#!/usr/bin/env node
/**
 * dev.mjs — 本地开发服务器：watch src/ → 重新拼装 → 静态托管 dist/
 * 零依赖。默认 http://localhost:5173
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, watch } from "node:fs";
import { join, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const port = Number(process.env.PORT ?? 5173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function build() {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(root, "scripts/build.mjs")], { stdio: "inherit" });
  if (r.status === 0) console.log(`  ↻ rebuild ${Date.now() - t0}ms`);
}

build();

let timer = null;
for (const dir of ["src", "public"]) {
  const p = join(root, dir);
  if (!existsSync(p)) continue;
  watch(p, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(build, 120);
  });
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let file = join(dist, url === "/" ? "index.html" : url);
  if (!existsSync(file) || !extname(file)) file = join(dist, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, {
    "content-type": MIME[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`\n➜  StartEditor  http://localhost:${port}\n`));
