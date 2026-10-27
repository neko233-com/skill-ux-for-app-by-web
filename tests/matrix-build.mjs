#!/usr/bin/env node
/**
 * matrix-build.mjs — 为全部内置风格各构建一份示例原型，用于视觉回归
 *   node tests/matrix-build.mjs
 * 输出到 tests/artifacts/matrix/<style>.html
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "tests", "artifacts", "matrix");
mkdirSync(OUT, { recursive: true });

function listStyles(kind) {
  const dir = join(ROOT, "styles", kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".tokens.json"))
    .map((f) => f.replace(".tokens.json", ""));
}

const baseSpec = (kind, style) => {
  if (kind === "game") {
    return {
      meta: { title: "风格预览 · 游戏", device: "phone", renderMode: "hi" },
      kind, style,
      demo: { hpDrain: true },
      screens: [
        {
          id: "home", title: "主城", blocks: [
            { type: "currency", props: { items: [
              { icon: "💰", label: "金币", value: "12.4K" },
              { icon: "💎", label: "钻石", value: "860" },
            ] } },
            { type: "player-bar", props: { name: "旅人", level: 28, exp: 0.62 } },
            { type: "gacha-banner", props: { title: "限定祈愿", sub: "保底 42/80", cta: "前往", to: "battle" } },
            { type: "grid", props: { cols: 3, items: [
              { icon: "⚔️", title: "出征", to: "battle" },
              { icon: "🎒", title: "背包", act: "toast", toast: "背包" },
              { icon: "🏆", title: "排行", act: "toast", toast: "排行" },
            ] } },
            { type: "note", props: { text: style } },
          ],
        },
        {
          id: "battle", title: "战斗", blocks: [
            { type: "hp-bar", props: { name: "幼龙", hp: 100, max: 100 } },
            { type: "hp-bar", props: { name: "旅人", hp: 72, max: 100 } },
            { type: "skill-bar", props: { items: [
              { icon: "🔥", name: "炎刃", cost: "12" },
              { icon: "❄️", name: "冰封", cost: "18" },
              { icon: "✨", name: "奥义", cost: "40" },
            ] } },
            { type: "inventory", props: { items: [
              { icon: "🗡️", qty: 1, rarity: "legend" },
              { icon: "🧪", qty: 9, rarity: "common" },
              { icon: "💎", qty: 4, rarity: "rare" },
              { icon: "📖", qty: 1, rarity: "epic" },
            ] } },
            { type: "buttons", props: { items: [
              { label: "自动战斗", variant: "primary", act: "toast", toast: "自动战斗" },
              { label: "返回", variant: "ghost", to: "home" },
            ] } },
          ],
        },
      ],
    };
  }
  return {
    meta: { title: "风格预览 · 应用", device: "phone", renderMode: "hi" },
    kind, style,
    screens: [
      {
        id: "home", title: "工作台", blocks: [
          { type: "search", props: { placeholder: "搜索" } },
          { type: "hero", props: { title: "今日待办 6", sub: "预览风格 · " + style, motif: "📋", cta: { label: "开始", toast: "开始" } } },
          { type: "stats", props: { items: [
            { label: "营收", value: "¥128K", icon: "💰", tone: "primary" },
            { label: "订单", value: "326", icon: "📦" },
          ] } },
          { type: "chart", props: { values: [40, 65, 50, 80, 70], labels: ["一", "二", "三", "四", "五"] } },
          { type: "list", props: { items: [
            { icon: "🧾", title: "预算复核", sub: "财务 · 2h 前", to: "me" },
            { icon: "🤝", title: "拜访纪要", sub: "销售 · 昨天" },
          ] } },
          { type: "note", props: { text: style } },
        ],
      },
      {
        id: "me", title: "我的", blocks: [
          { type: "profile", props: { name: "陈小北", sub: "产品策划", avatar: "🧕" } },
          { type: "settings", props: { items: [
            { label: "消息通知", type: "toggle", value: true },
            { label: "深色模式", type: "toggle", value: false },
            { label: "语言", type: "select", value: "简体中文" },
          ] } },
          { type: "buttons", props: { items: [
            { label: "退出登录", variant: "danger", block: true, act: "modal" },
            { label: "返回", variant: "ghost", block: true, to: "home" },
          ] } },
        ],
      },
    ],
  };
};

let ok = 0, fail = 0;
for (const kind of ["game", "app"]) {
  for (const style of listStyles(kind)) {
    if (style.startsWith("_")) continue;
    const specPath = join(OUT, `${style}.spec.json`);
    const htmlPath = join(OUT, `${style}.html`);
    writeFileSync(specPath, JSON.stringify(baseSpec(kind, style), null, 2), "utf8");
    try {
      execFileSync(process.execPath, [
        join(ROOT, "scripts", "build.mjs"),
        "--spec", specPath, "--out", htmlPath, "--quiet",
      ], { stdio: "pipe" });
      execFileSync(process.execPath, [
        join(ROOT, "scripts", "validate.mjs"), htmlPath, "--max-kb", "400",
      ], { stdio: "pipe" });
      console.log(`✓ ${kind}/${style}`);
      ok++;
    } catch (e) {
      console.error(`✗ ${kind}/${style}:`, e.message?.slice(0, 300) || e);
      fail++;
    }
  }
}
console.log(`\nmatrix: ${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
