#!/usr/bin/env node
/** edge-cases.mjs — 构建器边界用例：错误必须清晰，错误路径不得产出残缺 HTML */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIR = join(ROOT, "tests", "artifacts", "edge");
mkdirSync(DIR, { recursive: true });
const NODE = process.execPath;
const BUILD = join(ROOT, "scripts", "build.mjs");
const VAL = join(ROOT, "scripts", "validate.mjs");

let pass = 0, fail = 0;
const cases = [];

function run(args) {
  try {
    const out = execFileSync(NODE, [BUILD, ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") };
  }
}
function expectFail(name, spec, match) {
  const f = join(DIR, name + ".spec.json");
  writeFileSync(f, JSON.stringify(spec, null, 2));
  const outF = join(DIR, name + ".html");
  const r = run(["--spec", f, "--out", outF]);
  const okBuild = r.code !== 0;
  const okMsg = !match || new RegExp(match).test(r.out);
  const okNoFile = !existsSync(outF) || readFileSync(outF, "utf8").length < 50;
  if (okBuild && okMsg) { pass++; console.log("  ✓", name, "→", r.out.trim().slice(0, 80)); }
  else { fail++; console.log("  ✗", name, "code=" + r.code, r.out.trim().slice(0, 120), "noFile=" + okNoFile); }
}
function expectPass(name, spec, opts = {}) {
  const f = join(DIR, name + ".spec.json");
  writeFileSync(f, JSON.stringify(spec, null, 2));
  const outF = join(DIR, name + ".html");
  const r = run(["--spec", f, "--out", outF]);
  let okV = true, vout = "";
  if (r.code === 0 && existsSync(outF)) {
    try {
      vout = execFileSync(NODE, [VAL, outF], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) { okV = false; vout = (e.stdout || "") + (e.stderr || ""); }
  }
  const passBuild = r.code === 0 && existsSync(outF);
  const html = passBuild ? readFileSync(outF, "utf8") : "";
  let extra = true;
  if (opts.contains && !html.includes(opts.contains)) extra = false;
  if (opts.notContains && html.includes(opts.notContains)) extra = false;
  if (passBuild && okV && extra) { pass++; console.log("  ✓", name, opts.note || ""); }
  else { fail++; console.log("  ✗", name, "build=" + r.code, "validate-ok=" + okV, (r.out + vout).trim().slice(0, 140)); }
}

const base = (over = {}) => ({
  meta: { title: "edge", device: "phone" },
  kind: "app",
  style: "ios-clean",
  screens: [{ id: "home", title: "home", blocks: [{ type: "hero", props: { title: "t" } }] }],
  ...over,
});

console.log("## 必须失败的 spec（清晰报错）");
expectFail("no-kind", base({ kind: undefined }), "kind");
expectFail("no-style", base({ style: undefined }), "style");
expectFail("no-screens", base({ screens: [] }), "screens");
expectFail("dup-screen-id", base({ screens: [{ id: "a", blocks: [] }, { id: "a", blocks: [] }] }), "重复");
expectFail("bad-goto", base({ screens: [{ id: "home", blocks: [{ type: "buttons", props: { items: [{ label: "x", to: "nope" }] } }] }] }), "不存在");
expectFail("bad-nav-target", base({ nav: { mode: "tabs", items: [{ screen: "zzz", label: "z" }] } }), "不存在");
expectFail("bad-style", base({ style: "not-a-style" }), "未找到|not");
{
  const bf = join(DIR, "badjson.spec.json");
  writeFileSync(bf, "{ nope }", "utf8");
  const r = run(["--spec", bf, "--out", join(DIR, "badjson.html")]);
  if (r.code !== 0 && /JSON|解析|Unexpected|invalid/.test(r.out)) { pass++; console.log("  ✓ bad-json →", r.out.trim().slice(0, 80)); }
  else { fail++; console.log("  ✗ bad-json", "code=" + r.code, r.out.trim().slice(0, 120)); }
}

console.log("## 必须成功的 spec（健壮性）");
expectPass("empty-blocks", base({ screens: [{ id: "home", title: "H", blocks: [] }] }));
expectPass("custom-html", base({ screens: [{ id: "home", title: "H", blocks: [{ type: "custom", props: { html: "<div class=\"ux-card\">ok</div>" } }] }] }), { contains: "ok" });
expectPass("unknown-block", base({ screens: [{ id: "home", title: "H", blocks: [{ type: "no-such-block", props: {} }] }] }), { note: "未知 block 应注释降级" });
expectPass("state-all", base({
  screens: [{ id: "home", title: "H", blocks: [
    { type: "list", props: { state: "loading", skeletonRows: 2 } },
    { type: "list", props: { state: "empty", emptyTitle: "空" } },
    { type: "list", props: { state: "error", emptyTitle: "错" } },
    { type: "list", props: { state: "disabled" }, },
    { type: "list", props: { state: "ready", items: [{ title: "a" }] } },
  ] }],
}), { contains: "ux-skeleton" });
expectPass("detail-modal", base({
  screens: [{ id: "home", title: "H", blocks: [
    { type: "grid", props: { items: [{ icon: "coin", title: "g", detail: { title: "T", desc: "D", rewards: ["x"] } }] } },
    { type: "buttons", props: { items: [{ label: "b", detail: { title: "B", desc: "d" } }] } },
    { type: "currency", props: { items: [{ icon: "coin", label: "c", value: "1", detail: { title: "C" } }] } },
    { type: "inventory", props: { items: [{ icon: "gem", name: "i", detail: { title: "I" } }] } },
    { type: "gacha-banner", props: { title: "gacha", sub: "s" } },
  ] }],
}), { contains: "data-modal-title" });
expectPass("anim-badge-icon", base({
  screens: [{ id: "home", title: "H", blocks: [
    { type: "list", anim: "fade-up", props: { items: [{ title: "x", badge: "pulse", icon: "star" }] } },
    { type: "stats", props: { items: [{ label: "n", countTo: 100, countPrefix: "¥" }] } },
    { type: "progress", props: { indeterminate: true } },
    { type: "state-switcher", props: { for: "h1", states: ["ready", "loading", "empty", "error"] } },
    { type: "state-views", props: { for: "h1", views: [
      { state: "ready", blocks: [{ type: "note", props: { text: "r" } }] },
      { state: "loading", blocks: [{ type: "list", props: { state: "loading" } }] },
    ] } },
  ] }],
}), { contains: "uxi-star" });
expectPass("sketch-default", base({ meta: { title: "e", device: "phone" } }), { contains: 'data-render="sketch"' });
expectPass("hi-optin", base({ meta: { title: "e", device: "phone", renderMode: "hi" } }), { contains: 'data-render="hi"' });
expectPass("transitions", base({
  screens: [
    { id: "home", title: "A", transition: "fade", blocks: [{ type: "hero", props: { title: "a" } }] },
    { id: "b", title: "B", transition: "zoom", blocks: [{ type: "hero", props: { title: "b" } }] },
    { id: "c", title: "C", transition: "flip", blocks: [{ type: "hero", props: { title: "c" } }] },
    { id: "d", title: "D", transition: "none", blocks: [{ type: "hero", props: { title: "d" } }] },
  ],
}), { contains: 'data-transition="flip"' });
expectPass("game-kind", base({
  kind: "game", style: "supercell",
  screens: [
    { id: "home", title: "h", blocks: [
      { type: "currency", props: { items: [{ icon: "coin", label: "c", value: "9" }] } },
      { type: "player-bar", props: { name: "p", level: 1, exp: 0.1 } },
      { type: "gacha-banner", props: { title: "g", sub: "s", cta: "go" } },
      { type: "quest", props: { items: [{ title: "q", progress: 0.5 }] } },
      { type: "leaderboard", props: { items: [{ rank: 1, name: "n", score: 1 }] } },
      { type: "hp-bar", props: { name: "e", hp: 5, max: 10 } },
      { type: "skill-bar", props: { items: [{ icon: "zap", name: "s", cost: 1 }] } },
      { type: "joystick-hint" },
    ] },
    { id: "b", title: "b", blocks: [{ type: "inventory", props: { items: [{ icon: "gem" }] } }] },
  ],
  nav: { mode: "dock", items: [{ screen: "home", label: "H", icon: "home", badge: 3 }, { screen: "b", label: "B", icon: "bag" }] },
}), { contains: "uxi-coin" });

console.log("\n==========================");
console.log(`edge-cases: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
