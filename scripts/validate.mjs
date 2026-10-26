#!/usr/bin/env node
/**
 * validate.mjs — 产出 HTML 的飞书安全 / 自包含校验
 *   node scripts/validate.mjs <file.html> [--max-kb 500]
 * 退出码 0 = 通过；1 = 有 ERROR（WARN 不算失败）
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const opt = {};
for (let i = 0; i < process.argv.slice(2).length; i++) {
  const a = process.argv.slice(2)[i];
  if (a.startsWith("--")) { opt[a.slice(2)] = process.argv.slice(2)[i + 1]; }
}
const maxKb = Number(opt["max-kb"] || 500);
const file = args[0];
if (!file || !existsSync(resolve(file))) {
  console.error("Usage: node scripts/validate.mjs <file.html> [--max-kb 500]");
  process.exit(1);
}
const html = readFileSync(resolve(file), "utf8");
const errors = [];
const warns = [];
const notes = [];

function err(m) { errors.push(m); }
function warn(m) { warns.push(m); }
function note(m) { notes.push(m); }

/* 1. 大小 */
const kb = html.length / 1024;
if (kb > maxKb) err(`文件过大: ${kb.toFixed(1)} KB > ${maxKb} KB（飞书附件/iframe 建议 < ${maxKb}KB）`);
else note(`size ${kb.toFixed(1)} KB`);

/* 2. 结构 */
if (!/^<!DOCTYPE html>/i.test(html)) err("缺少 <!DOCTYPE html>");
if (!/<meta charset="utf-8">/i.test(html)) err("缺少 <meta charset=utf-8>（编码必须显式 UTF-8）");
if (!/<meta name="viewport"/i.test(html)) err("缺少 viewport meta（移动端/飞书内嵌必需）");
if (!/<html[^>]*lang=/i.test(html)) err("<html> 缺少 lang 属性");
if (!/<title>[^<]+<\/title>/i.test(html)) err("缺少非空 <title>");
if (!/id="ux-app"/.test(html)) err("缺少 #ux-app 根节点");
if (!/class="ux-screen"/.test(html)) err("没有 .ux-screen 屏幕");
if (!/class="ux-stage"/.test(html)) warn("没有 .ux-stage 舞台容器");

/* 3. 自包含：禁止外链 */
const externalPatterns = [
  [/<script[^>]+src=["']https?:/i, "外链 <script src=http>"],
  [/<link[^>]+href=["']https?:/i, "外链 <link href=http>"],
  [/<img[^>]+src=["']https?:/i, "外链 <img src=http>"],
  [/url\(\s*['"]?https?:/i, "CSS url(http) 外链"],
  [/url\(\s*['"]?\/\//i, "CSS url(//) 协议相对外链"],
  [/@import\s+url\(/i, "@import 外链"],
  [/@import\s+["']https?:/i, "@import 外链"],
  [/<iframe[^>]+src=["']https?:/i, "内嵌 iframe 外链"],
  [/\bfetch\s*\(/, "运行时 fetch（飞书/file:// 下会失败）"],
  [/XMLHttpRequest/, "XHR（飞书/file:// 下会失败）"],
  [/new\s+WebSocket/, "WebSocket（飞书沙箱可能拦截）"],
  [/navigator\.sendBeacon/, "sendBeacon"],
];
for (const [re, msg] of externalPatterns) {
  if (re.test(html)) err(msg);
}

/* 窗口逃逸（iframe 内会被拦或体验差） */
if (/window\.open\s*\(/.test(html)) err("window.open（嵌入 iframe 中不可用）");
if (/target=["']_blank["']/.test(html)) warn("target=_blank 在飞书内嵌中可能被拦截");

/* 4. 必要交互痕迹 */
if (!/data-goto|data-goto-tab/.test(html) && !/UX\.go/.test(html)) {
  warn("未发现任何跳转绑定（data-goto / data-goto-tab）——是否是静态稿？");
}
if (!/addEventListener/.test(html)) warn("没有事件监听，交互可能缺失");

/* 5. 基础可访问性/稳健 */
if (/<button(?![^>]*class="[^"]*ux-toggle)[^>]*>\s*<\/button>/.test(html)) warn("存在空 button");
if (!/prefers-reduced-motion/.test(html)) note("建议支持 prefers-reduced-motion（可选）");
if (/\sonerror\s*=\s*["']\s*alert/.test(html)) warn("onerror=alert 不适合原型交付");

/* 6. 飞书友好性 */
if (!/data-screen/.test(html)) err("缺少 data-screen（路由标记）");
if (/position\s*:\s*fixed/i.test(html)) {
  // fixed 在某些 iframe 里定位相对 viewport 会跑偏 —— core 用 absolute，若外部 custom 引入 fixed 则提醒
  const fixedCount = (html.match(/position\s*:\s*fixed/gi) || []).length;
  if (fixedCount > 0) warn(`使用了 position:fixed ×${fixedCount}（嵌入 iframe 时建议用 absolute + 容器定位）`);
}

/* 结果 */
console.log(`── validate: ${resolve(file)}`);
for (const n of notes) console.log(`  · ${n}`);
for (const w of warns) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);
if (errors.length) {
  console.log(`FAIL — ${errors.length} error(s), ${warns.length} warn(s)`);
  process.exit(1);
}
console.log(`PASS — 0 error(s), ${warns.length} warn(s)`);
process.exit(0);
