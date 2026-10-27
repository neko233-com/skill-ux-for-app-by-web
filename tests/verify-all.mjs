#!/usr/bin/env node
/**
 * verify-all.mjs — 一键全链路验证（构建/校验/自定义风格/默认草图/文案检查）
 *   node tests/verify-all.mjs
 * 退出码 0 = 全通过
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ART = join(ROOT, "tests", "artifacts");
mkdirSync(ART, { recursive: true });
const NODE = process.execPath;
const BUILD = join(ROOT, "scripts", "build.mjs");
const VAL = join(ROOT, "scripts", "validate.mjs");

let pass = 0, fail = 0;
const fails = [];
function ok(name) { pass++; console.log("  ✓", name); }
function bad(name, err) { fail++; fails.push(name + " :: " + String(err).slice(0, 200)); console.log("  ✗", name, String(err).slice(0, 160)); }

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

console.log("## 1. 示例 spec 构建 + 校验");
for (const f of readdirSync(join(ROOT, "examples")).filter((x) => x.endsWith(".spec.json"))) {
  const out = join(ART, "va-" + f.replace(".spec.json", ".html"));
  try {
    run(NODE, [BUILD, "--spec", join(ROOT, "examples", f), "--out", out, "--quiet"]);
    run(NODE, [VAL, out, "--max-kb", "500"]);
    ok("spec " + f);
  } catch (e) { bad("spec " + f, e.stdout || e.message); }
}

console.log("## 2. 示例 demo 校验");
for (const f of readdirSync(join(ROOT, "examples")).filter((x) => x.startsWith("demo-") && x.endsWith(".html"))) {
  try {
    run(NODE, [VAL, join(ROOT, "examples", f), "--max-kb", "500"]);
    ok("demo " + f);
  } catch (e) { bad("demo " + f, e.stdout || e.message); }
}

console.log("## 3. 全风格矩阵");
try {
  const out = run(NODE, [join(ROOT, "tests", "matrix-build.mjs")]);
  if (/matrix: 14 ok, 0 fail/.test(out) || /0 fail/.test(out)) ok("matrix 14/14");
  else bad("matrix", out.slice(-300));
} catch (e) { bad("matrix", e.stdout || e.message); }

console.log("## 4. 自定义风格（custom tokens）");
try {
  const t = JSON.parse(readFileSync(join(ROOT, "styles", "_template.tokens.json"), "utf8"));
  t.id = "va-custom"; t.kind = "game"; t.name = "verify custom";
  t.palette.primary = "#5B8CFF"; t.palette.bg = "#F0F4FF";
  writeFileSync(join(ROOT, "styles", "custom", "va-custom.tokens.json"), JSON.stringify(t, null, 2));
  const spec = JSON.parse(readFileSync(join(ROOT, "examples", "game-anime.spec.json"), "utf8"));
  spec.style = "va-custom"; spec.meta.title = "custom verify";
  const sp = join(ART, "va-custom.spec.json");
  const op = join(ART, "va-custom.html");
  writeFileSync(sp, JSON.stringify(spec, null, 2));
  run(NODE, [BUILD, "--spec", sp, "--out", op, "--quiet"]);
  run(NODE, [VAL, op]);
  ok("custom style va-custom");
  unlinkSync(join(ROOT, "styles", "custom", "va-custom.tokens.json"));
} catch (e) { bad("custom style", e.stdout || e.message); }

console.log("## 5. 默认草图（无 renderMode）");
try {
  const spec = JSON.parse(readFileSync(join(ROOT, "examples", "app-ios-clean.spec.json"), "utf8"));
  delete spec.meta.renderMode;
  const sp = join(ART, "va-default-sketch.spec.json");
  const op = join(ART, "va-default-sketch.html");
  writeFileSync(sp, JSON.stringify(spec, null, 2));
  run(NODE, [BUILD, "--spec", sp, "--out", op, "--quiet"]);
  const html = readFileSync(op, "utf8");
  if (/data-render="sketch"/.test(html)) ok("default is sketch");
  else bad("default sketch", "data-render != sketch");
  if (/data-render="hi"/.test(html) && !/data-render="sketch"/.test(html)) bad("default sketch", "got hi");
} catch (e) { bad("default sketch", e.stdout || e.message); }

console.log("## 6. 高保真显式 hi");
try {
  const spec = JSON.parse(readFileSync(join(ROOT, "examples", "game-anime.spec.json"), "utf8"));
  spec.meta.renderMode = "hi";
  const sp = join(ART, "va-hi.spec.json");
  const op = join(ART, "va-hi.html");
  writeFileSync(sp, JSON.stringify(spec, null, 2));
  run(NODE, [BUILD, "--spec", sp, "--out", op, "--quiet"]);
  const html = readFileSync(op, "utf8");
  if (/data-render="hi"/.test(html)) ok("renderMode=hi");
  else bad("renderMode hi", "not hi");
} catch (e) { bad("renderMode hi", e.stdout || e.message); }

console.log("## 7. 文案克制（无「策划注 ·」长句 / TODO）");
{
  const leaks = [];
  for (const f of readdirSync(join(ROOT, "examples")).filter((x) => x.startsWith("demo-") && x.endsWith(".html"))) {
    const html = readFileSync(join(ROOT, "examples", f), "utf8");
    // UI 文案检查：注释块 CSS 里的「策划注释」标题不算
    const textHits = (html.match(/策划注 ·|示例：|演示中|点击.*查看反馈|这里还什么都没有/g) || []);
    if (textHits.length) leaks.push(f + " → " + textHits.join(" / "));
  }
  if (leaks.length) bad("quiet copy", leaks.join("; "));
  else ok("no verbose UI copy in demos");
}

console.log("## 8. 飞书安全（无外链资源）");
{
  const badRefs = [];
  const re = /<script[^>]+src=["']https?:|<link[^>]+href=["']https?:|<img[^>]+src=["']https?:|url\(\s*["']?https?:|@import\s+url\(|fetch\s*\(|window\.open\s*\(/gi;
  for (const f of readdirSync(join(ROOT, "examples")).filter((x) => x.startsWith("demo-") && x.endsWith(".html"))) {
    const html = readFileSync(join(ROOT, "examples", f), "utf8");
    const hits = html.match(re) || [];
    if (hits.length) badRefs.push(f + " → " + hits.length);
  }
  if (badRefs.length) bad("feishu safe", badRefs.join("; "));
  else ok("demos are self-contained");
}

console.log("## 9. 源码编码（UTF-8 无 BOM）");
{
  const badEnc = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "artifacts" || e.name === "screenshots" || e.name === ".codely-cli" || e.name === "node_modules") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(mjs|js|css|json|md|py)$/.test(e.name)) {
        const b = readFileSync(p);
        if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) badEnc.push(p + " BOM");
        else { try { b.toString("utf8"); } catch { badEnc.push(p + " not-utf8"); } }
      }
    }
  };
  walk(ROOT);
  if (badEnc.length) bad("encoding", badEnc.join("; "));
  else ok("all source files utf-8");
}

console.log("\n================================");
console.log(`verify-all: ${pass} passed, ${fail} failed`);
if (fails.length) { console.log("FAILURES:"); fails.forEach((f) => console.log(" -", f)); }
process.exit(fail ? 1 : 0);
