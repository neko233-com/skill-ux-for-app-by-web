#!/usr/bin/env node
/**
 * build.mjs — skill-ux-for-app-by-web 确定性构建器
 * 零依赖，Node ≥ 18。
 *
 *   node scripts/build.mjs --spec path/to/spec.json --out out.html
 *   node scripts/build.mjs --spec-json '{"kind":"game","style":"anime",...}' --out out.html
 *
 * 产出：单文件自包含 HTML（无任何外链），可直接 file:// 打开、可嵌入飞书。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderGameBlock } from "./game-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/* ── CLI ──────────────────────────────────────── */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { out[key] = next; i++; }
      else out[key] = true;
    }
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
if (args.help || (!args.spec && !args["spec-json"] && !args.example)) {
  console.log(`Usage:
  node scripts/build.mjs --spec <spec.json> --out <out.html>
  node scripts/build.mjs --spec-json '<json>' --out <out.html>
  node scripts/build.mjs --example game|app --out <out.html>
Options:
  --styles-dir <dir>   额外风格目录（默认 <root>/styles）
  --quiet              只输出错误`);
  process.exit(args.help ? 0 : 1);
}
const QUIET = !!args.quiet;

/* ── 工具 ─────────────────────────────────────── */
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");
function deepMerge(base, over) {
  if (over == null) return base;
  if (Array.isArray(base) || Array.isArray(over)) return over;
  if (typeof base !== "object" || typeof over !== "object") return over;
  const r = { ...base };
  for (const k of Object.keys(over)) r[k] = deepMerge(base?.[k], over[k]);
  return r;
}
function setPath(obj, path, val) {
  const parts = path.split(".");
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof o[parts[i]] !== "object" || o[parts[i]] == null) o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = val;
}
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function slugify(s) {
  return String(s).trim().toLowerCase().replace(/[^\w一-鿿-]+/g, "-").replace(/^-+|-+$/g, "") || "prototype";
}

/* ── 风格解析 ─────────────────────────────────── */
function loadStyle(styleId, kind, specTokens) {
  const candidates = [
    join(ROOT, "styles", kind, `${styleId}.tokens.json`),
    join(ROOT, "styles", "custom", `${styleId}.tokens.json`),
    join(ROOT, "styles", `${styleId}.tokens.json`),
  ];
  if (args["styles-dir"]) {
    candidates.unshift(join(resolve(args["styles-dir"]), kind, `${styleId}.tokens.json`));
    candidates.unshift(join(resolve(args["styles-dir"]), "custom", `${styleId}.tokens.json`));
    candidates.unshift(join(resolve(args["styles-dir"]), `${styleId}.tokens.json`));
  }
  let tokens = null;
  for (const c of candidates) {
    if (existsSync(c)) { tokens = JSON.parse(read(c)); break; }
  }
  if (!tokens) {
    // list available
    const dirs = [join(ROOT, "styles", kind), join(ROOT, "styles", "custom")];
    const avail = [];
    for (const d of dirs) {
      if (!existsSync(d)) continue;
      try {
        for (const f of readdirSync(d)) if (f.endsWith(".tokens.json")) avail.push(f.replace(".tokens.json", ""));
      } catch { /* ignore */ }
    }
    throw new Error(`style "${styleId}" 未找到。可用: ${avail.join(", ") || "(无)"}`);
  }
  if (specTokens?.overrides) {
    const over = {};
    for (const [k, v] of Object.entries(specTokens.overrides)) setPath(over, k, v);
    tokens = deepMerge(tokens, over);
  }
  return tokens;
}

/* ── Icons ────────────────────────────────────── */
const ICONS = JSON.parse(read(join(__dirname, "icons.json")));
delete ICONS._comment;
const ICON_NAMES = Object.keys(ICONS);

function iconHtml(name, size = 20, cls = "") {
  if (!name) return "";
  const key = String(name).trim();
  const id = key.startsWith("icon:") ? key.slice(5) : key;
  if (ICONS[id]) {
    const s = Number(size) || 20;
    return `<svg class="ux-icon${cls ? " " + cls : ""}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#uxi-${esc(id)}"/></svg>`;
  }
  return esc(key);
}

function iconSprite() {
  const symbols = ICON_NAMES.map((name) => {
    const d = ICONS[name];
    const paths = String(d).split("|").map((p) => `<path d="${p.trim()}"/>`).join("");
    return `<symbol id="uxi-${esc(name)}" viewBox="0 0 24 24">${paths}</symbol>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${symbols}</svg>`;
}

function ico(props, size = 20) {
  if (!props) return "";
  if (typeof props === "string") return iconHtml(props, size);
  if (props && props.name) return iconHtml(props.name, props.size || size);
  return "";
}

/* ── 状态包裹 ─────────────────────────────────── */
function wrapState(block, html, props = {}) {
  const st = props.state || "ready";
  if (st === "ready") return html;
  const anim = block.anim ? ` anim-${esc(block.anim)}` : "";
  if (st === "loading") {
    const rows = Number(props.skeletonRows || 4);
    let sk = "";
    for (let i = 0; i < rows; i++) {
      sk += `<div class="ux-skeleton-row"><div class="ux-skeleton ux-skeleton--avatar"></div><div class="body"><div class="ux-skeleton ux-skeleton--text" style="width:${50 + (i % 3) * 15}%"></div><div class="ux-skeleton ux-skeleton--text" style="width:${30 + (i % 2) * 20}%;height:10px"></div></div></div>`;
    }
    return `<div class="ux-list${anim}" aria-busy="true">${sk}</div>`;
  }
  if (st === "empty" || st === "error") {
    const isErr = st === "error";
    const icon = props.emptyIcon || (isErr ? "alert-triangle" : "inbox");
    const title = props.emptyTitle || (isErr ? "加载失败" : "暂无数据");
    const desc = props.emptyDesc != null ? props.emptyDesc : (isErr ? "点击重试" : "");
    const action = props.emptyAction
      ? `<button class="ux-btn ${isErr ? "ux-btn--primary" : ""} ux-btn--sm ux-empty__action" data-act="toast" data-toast="${esc(props.emptyActionToast || props.emptyAction)}">${esc(props.emptyAction)}</button>`
      : "";
    return `<div class="ux-empty${isErr ? " ux-empty--error" : ""}${anim}"><div class="ux-empty__icon">${iconHtml(icon, 24)}</div><div class="ux-empty__title">${esc(title)}</div>${desc ? `<p class="ux-empty__desc">${esc(desc)}</p>` : ""}${action}</div>`;
  }
  if (st === "disabled") {
    return `<div class="ux-state-disabled${anim}" aria-disabled="true">${html}</div>`;
  }
  return html;
}

function modalAttrs(detail, fallbackTitle = "", fallbackBody = "") {
  const d = detail || {};
  const title = d.title || fallbackTitle || "详情";
  const bodyLines = [];
  if (d.desc || d.body) bodyLines.push(String(d.desc || d.body));
  if (Array.isArray(d.lines)) d.lines.forEach((x) => bodyLines.push(String(x)));
  if (Array.isArray(d.rewards) && d.rewards.length) {
    bodyLines.push("");
    d.rewards.forEach((r) => bodyLines.push("· " + (typeof r === "string" ? r : ((r.label || r.name || "") + (r.qty != null ? " ×" + r.qty : "")))));
  }
  const body = bodyLines.join("\n");
  return ` data-act="modal" data-modal-title="${esc(title)}" data-modal-body="${esc(body)}" data-modal-ok="${esc(d.ok || "确定")}" data-modal-icon="${esc(d.icon || "")}"`;
}
function badgeHtml(b, asDot = false) {
  if (b == null || b === false) return "";
  if (b === true) return asDot ? `<span class="ux-dot ux-dot--pulse"></span>` : `<span class="ux-badge">1</span>`;
  if (typeof b === "number") return `<span class="ux-badge">${esc(b > 99 ? "99+" : b)}</span>`;
  if (typeof b === "string") {
    if (b === "dot" || b === "pulse") return `<span class="ux-dot${b === "pulse" ? " ux-dot--pulse" : ""}"></span>`;
    return `<span class="ux-badge">${esc(b)}</span>`;
  }
  const tone = b.tone ? ` ux-badge--${esc(b.tone)}` : "";
  if (b.type === "dot" || b.dot) {
    return `<span class="ux-dot${b.tone ? ` ux-dot--${esc(b.tone)}` : ""}${b.pulse === false ? "" : " ux-dot--pulse"}${b.size ? ` ux-dot--${esc(b.size)}` : ""}"></span>`;
  }
  if (b.type === "none") return "";
  const val = b.value != null ? b.value : "";
  if (val === "") return `<span class="ux-badge ux-badge--dot${tone}"></span>`;
  return `<span class="ux-badge${tone}">${esc(String(val).length > 3 ? "99+" : val)}</span>`;
}

function animWrap(block, html) {
  if (!block.anim) return html;
  return `<div class="anim-${esc(block.anim)}">${html}</div>`;
}

/* ── CSS 变量 ────────────────────────────────── */
function tokensToCss(t) {
  const p = t.palette, ty = t.type, sh = t.shape, el = t.elevation, mo = t.motion;
  const lines = [
    `--ux-bg:${p.bg};`,
    `--ux-bg-alt:${p.bgAlt};`,
    `--ux-surface:${p.surface};`,
    `--ux-surface-2:${p.surface2};`,
    `--ux-ink:${p.ink};`,
    `--ux-ink-2:${p.ink2};`,
    `--ux-ink-3:${p.ink3};`,
    `--ux-primary:${p.primary};`,
    `--ux-primary-2:${p.primary2};`,
    `--ux-on-primary:${p.onPrimary};`,
    `--ux-accent:${p.accent};`,
    `--ux-accent-2:${p.accent2};`,
    `--ux-ok:${p.ok};`,
    `--ux-warn:${p.warn};`,
    `--ux-warning:${p.warn};`,
    `--ux-danger:${p.danger};`,
    `--ux-line:${p.line};`,
    `--ux-glass:${p.glass};`,
    `--ux-font:${ty.fontStack};`,
    `--ux-weight-display:${ty.weightDisplay};`,
    `--ux-weight-body:${ty.weightBody};`,
    `--ux-weight-strong:${ty.weightStrong};`,
    `--ux-fs-xs:${ty.fsXs};`,
    `--ux-fs-sm:${ty.fsSm};`,
    `--ux-fs-md:${ty.fsMd};`,
    `--ux-fs-lg:${ty.fsLg};`,
    `--ux-fs-xl:${ty.fsXl};`,
    `--ux-fs-2xl:${ty.fs2xl};`,
    `--ux-fs-3xl:${ty.fs3xl};`,
    `--ux-tracking:${ty.tracking};`,
    `--ux-r-sm:${sh.rSm};`,
    `--ux-r-md:${sh.rMd};`,
    `--ux-r-lg:${sh.rLg};`,
    `--ux-r-xl:${sh.rXl};`,
    `--ux-r-full:${sh.rFull};`,
    `--ux-border-w:${sh.borderW};`,
    `--ux-border-c:${sh.borderC};`,
    `--ux-stroke:${sh.stroke};`,
    `--ux-sh-card:${el.card};`,
    `--ux-sh-btn:${el.btn};`,
    `--ux-sh-btn-press:${el.btnPress};`,
    `--ux-glow:${el.glow};`,
    `--ux-inset:${el.inset};`,
    `--ux-ease:${mo.ease};`,
    `--ux-dur-fast:${mo.durFast};`,
    `--ux-dur:${mo.dur};`,
    `--ux-dur-slow:${mo.durSlow};`,
    `--ux-press:${mo.pressScale};`,
    `--ux-tabbar-h:64px;`,
    `--ux-pad:16px;`,
  ];
  if (t.extras && typeof t.extras === "object") {
    for (const [k, v] of Object.entries(t.extras)) {
      if (!k.startsWith("--")) continue;
      lines.push(`${k}:${v};`);
    }
  }
  return lines.join("\n    ");
}

/* ── Block → HTML ─────────────────────────────── */
function blockHtml(b, ctx) {
  const type = b.type;
  const p = b.props || {};
  const raw = blockHtmlInner(b, ctx);
  return wrapState(b, animWrap(b, raw), p);
}

function blockHtmlInner(b, ctx) {
  const type = b.type;
  const p = b.props || {};
  const gameBlock = renderGameBlock(b, ctx, { esc, iconHtml });
  if (gameBlock !== null) return gameBlock;
  switch (type) {
    case "titlebar": {
      const back = p.back !== false && ctx.screens.length > 1
        ? `<button class="ux-titlebar__back" data-act="back" aria-label="返回">${iconHtml("chevron-left", 18)}</button>`
        : `<span class="ux-titlebar__back" style="visibility:hidden"></span>`;
      const actions = (p.actions || []).map((a) =>
        a.to
          ? `<button class="ux-titlebar__action" data-goto="${esc(a.to)}">${esc(a.label)}</button>`
          : `<button class="ux-titlebar__action" data-act="toast" data-toast="${esc(a.toast || a.label)}">${esc(a.label)}</button>`
      ).join("");
      return `<header class="ux-titlebar">${back}<h1 class="ux-titlebar__title">${esc(p.title ?? ctx.screen.title ?? "")}</h1><div class="ux-titlebar__side">${actions}</div></header>`;
    }
    case "hero": {
      const cta = p.cta
        ? `<div class="ux-hero__cta">${p.cta.to
            ? `<button class="ux-btn" data-goto="${esc(p.cta.to)}">${esc(p.cta.label)}</button>`
            : `<button class="ux-btn" data-act="toast" data-toast="${esc(p.cta.toast || p.cta.label)}">${esc(p.cta.label)}</button>`}</div>`
        : "";
      return `<section class="ux-hero"><div class="ux-hero__motif" aria-hidden="true">${ico(p.motif, 84) || esc(p.motif || "✨")}</div><h2 class="ux-hero__title">${esc(p.title || ctx.meta.title)}</h2>${p.sub ? `<p class="ux-hero__sub">${esc(p.sub)}</p>` : ""}${cta}</section>`;
    }
    case "section": {
      const head = p.title
        ? `<div class="ux-section__head"><h3 class="ux-section__title">${esc(p.title)}</h3>${p.more ? `<span class="ux-section__more">${esc(p.more)}</span>` : ""}</div>`
        : "";
      const kids = (p.blocks || []).map((c) => blockHtml(c, ctx)).join("\n");
      return `<section class="ux-section">${head}${kids}</section>`;
    }
    case "grid": {
      const cols = Math.min(4, Math.max(2, p.cols || 3));
      const items = (p.items || []).map((it) => {
        const badge = badgeHtml(it.badge);
        const iconEl = ico(it.icon, 28) || `<span class="ux-tile__icon">${esc(it.icon || "📦")}</span>`;
        const attrs = it.to ? ` data-goto="${esc(it.to)}"` : (it.detail || it.act === "modal") ? modalAttrs(it.detail, it.title || "详情", it.sub || "") : it.act ? ` data-act="${esc(it.act)}" data-toast="${esc(it.toast || it.title)}"` : "";
        return `<button class="ux-tile"${attrs}>${badge}${iconEl}<span class="ux-tile__title">${esc(it.title || "")}</span>${it.sub ? `<span class="ux-tile__sub">${esc(it.sub)}</span>` : ""}</button>`;
      }).join("\n");
      return `<div class="ux-grid" data-cols="${cols}">${items}</div>`;
    }
    case "list": {
      const rows = (p.items || []).map((it) => {
        const attrs = it.to ? ` data-goto="${esc(it.to)}"` : (it.detail || it.act === "modal") ? modalAttrs(it.detail, it.title || "详情", it.sub || "") : "";
        const trailBits = [];
        if (it.trailing) trailBits.push(`<span class="ux-row__trail">${esc(it.trailing)}</span>`);
        else {
          const asDot = it.badge === true || it.badge === "dot" || it.badge === "pulse" || (it.badge && it.badge.dot);
          const bd = badgeHtml(it.badge, asDot);
          if (bd) trailBits.push(`<span class="ux-row__trail">${bd}</span>`);
          if (it.to) trailBits.push(`<span class="ux-row__trail">${iconHtml("chevron-right", 16)}</span>`);
        }
        const trail = trailBits.join("");
        return `<div class="ux-row"${attrs} ${it.to ? 'role="button" tabindex="0"' : ""}>${it.icon ? `<span class="ux-row__icon">${ico(it.icon, 20) || esc(it.icon)}</span>` : ""}<div class="ux-row__body"><div class="ux-row__title">${esc(it.title || "")}</div>${it.sub ? `<div class="ux-row__sub">${esc(it.sub)}</div>` : ""}</div>${trail}</div>`;
      }).join("\n");
      return `<div class="ux-list">${rows}</div>`;
    }
    case "stats": {
      const chips = (p.items || []).map((it) => {
        const cls = it.tone === "primary" ? " ux-chip--primary" : "";
        const countAttr = it.countTo != null ? ` data-count-to="${esc(it.countTo)}" data-count-from="${esc(it.countFrom ?? 0)}" data-count-prefix="${esc(it.countPrefix || "")}" data-count-suffix="${esc(it.countSuffix || "")}"` : "";
        const valTxt = it.value != null ? esc(it.value) : (it.countTo != null ? "0" : "");
        return `<span class="ux-chip${cls}">${it.icon ? `<span class="ux-chip__icon">${ico(it.icon, 15) || esc(it.icon)}</span>` : ""}${it.label ? `<span class="ux-chip__label">${esc(it.label)}</span>` : ""}<span class="ux-chip__value"${countAttr}>${valTxt}</span></span>`;
      }).join("\n");
      return `<div class="ux-stats">${chips}</div>`;
    }
    case "progress": {
      const v = Math.max(0, Math.min(1, Number(p.value ?? 0)));
      const valTxt = p.showValue === false ? "" : `<span>${Math.round(v * 100)}%</span>`;
      if (p.indeterminate) return `<div class="ux-progress"><div class="ux-progress__head"><span>${esc(p.label || "加载中")}</span></div><div class="ux-progress__track"><div class="ux-progress__bar is-indeterminate"></div></div></div>`;
      return `<div class="ux-progress"><div class="ux-progress__head"><span>${esc(p.label || "进度")}</span>${valTxt}</div><div class="ux-progress__track"><div class="ux-progress__bar" data-value="${v}"></div></div></div>`;
    }
    case "buttons": {
      const btns = (p.items || []).map((b2) => {
        const variant = b2.variant ? ` ux-btn--${b2.variant}` : "";
        const size = b2.size ? ` ux-btn--${b2.size}` : "";
        const block = b2.block ? " ux-btn--block" : "";
        const attrs = b2.to
          ? ` data-goto="${esc(b2.to)}"`
          : b2.detail
            ? modalAttrs(b2.detail, b2.label || "详情")
            : b2.act
              ? ` data-act="${esc(b2.act)}" data-toast="${esc(b2.toast || b2.label)}"`
              : ` data-act="toast" data-toast="${esc(b2.toast || b2.label || "")}"`
        return `<button class="ux-btn${variant}${size}${block}"${attrs}>${b2.icon ? ico(b2.icon, 18) : ""}${esc(b2.label || "按钮")}</button>`;
      }).join("\n");
      return `<div class="ux-buttons">${btns}</div>`;
    }
    case "form": {
      const fields = (p.fields || []).map((f, i) => {
        const id = `f${ctx.screen.id}_${i}`;
        const type = f.type || "text";
        const req = f.required ? `<span class="req">*</span>` : "";
        const input = type === "textarea"
          ? `<textarea class="ux-input" id="${id}" rows="3" placeholder="${esc(f.placeholder || "")}" ${f.required ? "required" : ""}></textarea>`
          : `<input class="ux-input" id="${id}" type="${esc(type)}" placeholder="${esc(f.placeholder || "")}" ${f.required ? "required" : ""}>`;
        return `<div class="ux-field"><label class="ux-field__label" for="${id}">${esc(f.label || "")}${req}</label>${input}</div>`;
      }).join("\n");
      const submit = p.submit
        ? `<button class="ux-btn ux-btn--primary ux-btn--block" type="submit">${esc(p.submit.label || "提交")}</button>`
        : "";
      return `<form class="ux-form" data-toast="${esc(p.toast || p.submit?.toast || "提交成功")}">${fields}${submit}</form>`;
    }
    case "settings": {
      const rows = (p.items || []).map((it) => {
        let trail = "";
        if (it.type === "toggle") trail = `<button class="ux-toggle${it.value ? " is-on" : ""}" aria-checked="${it.value ? "true" : "false"}"></button>`;
        else if (it.type === "select") trail = `<span class="ux-row__trail">${esc(it.value || "默认")} ${iconHtml("chevron-down", 14)}</span>`;
        else trail = `<span class="ux-row__trail">${esc(it.value || "")} ${iconHtml("chevron-right", 14)}</span>`;
        return `<div class="ux-row" ${it.to ? `data-goto="${esc(it.to)}"` : ""}><div class="ux-row__body"><div class="ux-row__title">${esc(it.label || "")}</div>${it.desc ? `<div class="ux-row__sub">${esc(it.desc)}</div>` : ""}</div>${trail}</div>`;
      }).join("\n");
      return `<div class="ux-list">${rows}</div>`;
    }
    case "carousel": {
      const items = (p.items || []).map((it, i) =>
        `<article class="ux-carousel__item" data-tone="${esc(it.tone || (i % 2 ? "accent" : "primary"))}"><h3 class="ux-carousel__title">${esc(it.title || "")}</h3>${it.desc ? `<p class="ux-carousel__desc">${esc(it.desc)}</p>` : ""}</article>`
      ).join("\n");
      return `<div class="ux-carousel" role="list">${items}</div>`;
    }
    case "note":
      const noteText = String(p.text || "");
      if (!noteText.trim()) return "";
      if (/[<&]/.test(noteText)) return `<aside class="ux-note">${noteText}</aside>`;
      return `<aside class="ux-note">${p.icon ? iconHtml(p.icon, 11) + " " : ""}${esc(noteText)}</aside>`;
    case "search":
      return `<div class="ux-search"><span class="ux-search__icon">${iconHtml("search", 16)}</span><input class="ux-input" type="search" placeholder="${esc(p.placeholder || "搜索")}"></div>`;
    case "tabs": {
      const items = (p.items || []).map((it, i) =>
        `<button class="ux-seg__item${(it.active ?? i === 0) ? " is-active" : ""}" type="button">${esc(it.label || "")}</button>`
      ).join("");
      return `<div class="ux-seg" role="tablist">${items}</div>`;
    }
    case "stepper": {
      const items = (p.items || []).map((it, i) =>
        `<div class="ux-stepper__step${it.done ? " is-done" : (it.active ?? i === 0) ? " is-active" : ""}"><div class="ux-stepper__dot">${it.done ? "✓" : i + 1}</div>${esc(it.label || "")}</div>`
      ).join("");
      return `<div class="ux-stepper">${items}</div>`;
    }
    case "profile":
      return `<div class="ux-profile"><div class="ux-profile__avatar">${ico(p.avatar, 28) || esc(p.avatar || "🙂")}</div><div><h3 class="ux-profile__name">${esc(p.name || "用户")}</h3><p class="ux-profile__sub">${esc(p.sub || "")}</p></div></div>`;
    case "chart": {
      const values = (p.values || []).map(Number);
      const max = Math.max(...values, 1);
      const labels = p.labels || [];
      const cols = values.map((v, i) =>
        `<div class="ux-chart__col"><div class="ux-chart__bar" data-h="${(v / max) * 100}"></div><span class="ux-chart__label">${esc(labels[i] ?? i + 1)}</span></div>`
      ).join("");
      return `<div class="ux-chart" style="height:${p.height || 120}px" role="img" aria-label="柱状图">${cols}</div>`;
    }
    case "table": {
      const head = (p.head || []).map((h) => `<th>${esc(h)}</th>`).join("");
      const rows = (p.rows || []).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
      return `<div class="ux-table-wrap"><table class="ux-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    case "custom":
      return String(p.html || "");

    /* game-only */
    case "currency": {
      const items = (p.items || []).map((it) =>
        `<button type="button" class="ux-currency__item"${it.detail || it.desc ? modalAttrs(it.detail || { title: it.label || "道具", desc: it.desc, icon: it.icon }, it.label || "道具") : ` data-act="toast" data-toast="${esc((it.label || "") + " " + (it.value ?? ""))}"`}><span class="icon">${ico(it.icon, 15) || esc(it.icon || "💰")}</span><span>${esc(it.value ?? "0")}</span>${it.plus !== false ? `<button class="ux-currency__plus" data-act="modal" data-modal-title="${esc((it.label || "获取") + " · 获取途径")}" data-modal-body="${esc(it.source || "商店 / 活动 / 任务")}" data-modal-ok="知道了" aria-label="增加">+</button>` : ""}</button>`
      ).join("");
      return `<div class="ux-currency">${items}</div>`;
    }
    case "player-bar":
      return `<div class="ux-player"><div class="ux-player__avatar">${ico(p.avatar, 24) || esc(p.avatar || "🧝")}</div><div class="ux-player__meta"><div><span class="ux-player__name">${esc(p.name || "旅人")}</span><span class="ux-player__level">Lv.${esc(p.level ?? 1)}</span></div><div class="ux-player__exp"><i data-value="${Math.max(0, Math.min(1, Number(p.exp ?? 0)))}"></i></div></div></div>`;
    case "hp-bar": {
      const hp = Number(p.hp ?? p.max ?? 100);
      const max = Number(p.max ?? Math.max(hp, 1));
      const ratio = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
      const drain = ctx.demoHp ? " data-demo-drain" : "";
      return `<div class="ux-hp" data-tone="${esc(p.tone || (ratio < 0.35 ? "danger" : ratio < 0.7 ? "warn" : "ok"))}" data-side="${esc(p.side || "left")}"><div class="ux-hp__head"><span>${esc(p.name || "目标")}</span><span>${esc(hp)} / ${esc(max)}</span></div><div class="ux-hp__track"><div class="ux-hp__fill" data-value="${ratio}"${drain} style="width:${ratio * 100}%"></div></div></div>`;
    }
    case "skill-bar": {
      const items = (p.items || []).map((it) =>
        `<button class="ux-skill" data-act="skill" data-name="${esc(it.name || "技能")}" data-cd="${esc(it.cd ?? "")}">${it.cost ? `<span class="ux-skill__cost">${esc(it.cost)}</span>` : ""}<span class="ux-skill__icon">${ico(it.icon, 26) || esc(it.icon || "💥")}</span><span class="ux-skill__name">${esc(it.name || "技能")}</span></button>`
      ).join("");
      return `<div class="ux-skills">${items}</div>`;
    }
    case "dock": {
      const items = (p.items || []).map((it) =>
        `<button class="ux-tabbar__item" data-goto-tab="${esc(it.to || "#")}" type="button"><span class="icon">${ico(it.icon, 22) || esc(it.icon || "📦")}</span><span>${esc(it.label || "")}</span>${badgeHtml(it.badge)}</button>`
      ).join("");
      return `<nav class="ux-tabbar" aria-label="主导航">${items}</nav>`;
    }
    case "quest": {
      const items = (p.items || []).map((it) => {
        const prog = it.progress != null
          ? `<div class="ux-progress" style="margin-bottom:0"><div class="ux-progress__track"><div class="ux-progress__bar" data-value="${Math.max(0, Math.min(1, Number(it.progress)))}"></div></div></div>`
          : "";
        return `<div class="ux-quest__item${it.done ? " is-done" : ""}"><div class="ux-quest__top"><span class="ux-quest__title">${esc(it.title || "")}</span><span class="ux-quest__reward">${esc(it.reward || (it.done ? "已领取" : ""))}</span></div>${it.desc ? `<div class="ux-quest__desc">${esc(it.desc)}</div>` : ""}${prog}</div>`;
      }).join("");
      return `<div class="ux-quest">${items}</div>`;
    }
    case "leaderboard": {
      const items = (p.items || []).map((it) =>
        `<div class="ux-rank__item${it.me ? " is-me" : ""}"><span class="ux-rank__no">${esc(it.rank ?? "-")}</span><span class="ux-rank__name">${esc(it.name || "")}${it.me ? "（我）" : ""}</span><span class="ux-rank__score">${esc(it.score ?? "")}</span></div>`
      ).join("");
      return `<div class="ux-rank">${items}</div>`;
    }
    case "inventory": {
      const items = (p.items || []).map((it) =>
        `<button class="ux-inv__slot" data-rarity="${esc(it.rarity || "common")}"${modalAttrs(it.detail || { title: it.name || "道具", desc: it.desc || "", icon: it.icon, ok: "关闭" }, it.name || "道具")}><span class="ux-inv__icon">${ico(it.icon, 26) || esc(it.icon || "❔")}</span>${it.qty ? `<span class="ux-inv__qty">${esc(it.qty)}</span>` : ""}</button>`
      ).join("");
      return `<div class="ux-inv">${items}</div>`;
    }
    case "joystick-hint":
      return `<div class="ux-stick" aria-hidden="true"><div class="ux-stick__pad"></div><div class="ux-stick__btns"><span class="ux-stick__abtn">✕</span><span class="ux-stick__abtn ux-stick__abtn--main">⚔️</span></div></div>`;
    case "gacha-banner":
      return `<button class="ux-gacha" type="button" ${p.to ? `data-goto="${esc(p.to)}"` : modalAttrs(p.detail || { title: p.title || "限定祈愿", desc: p.sub || "", icon: p.motif || "star", ok: p.cta || "前往" }, p.title || "限定祈愿", p.sub || "")}><span class="ux-gacha__star" aria-hidden="true">${ico(p.motif, 64) || esc(p.motif || "🌟")}</span><h3 class="ux-gacha__title">${esc(p.title || "限定祈愿")}</h3>${p.sub ? `<p class="ux-gacha__sub">${esc(p.sub)}</p>` : ""}<span class="ux-gacha__cta">${esc(p.cta || "查看详情")}</span></button>`;
    case "state-switcher": {
      const hostId = p.for || ("st-" + ctx.screen.id + "-" + (ctx._ss = (ctx._ss || 0) + 1));
      const states = p.states || ["ready", "loading", "empty", "error"];
      const labels = { ready: "正常", loading: "加载", empty: "空态", error: "错误", disabled: "禁用" };
      const btns = states.map((st, i) => `<button class="ux-state-switch__btn${(p.active || states[0]) === st ? " is-active" : ""}" data-state="${esc(st)}" type="button">${esc(labels[st] || st)}</button>`).join("");
      return `<div class="ux-state-switch" data-for="${esc(hostId)}" role="group" aria-label="状态演示"><span class="ux-state-switch__label">状态演示 · 点击切换</span>${btns}</div><div class="ux-state-host" id="${esc(hostId)}"></div>`;
    }
    case "state-views": {
      const hostId = p.for || ctx.screen.id + "-views";
      const views = (p.views || []).map((v) => {
        const inner = (v.blocks || []).map((c) => blockHtml(c, ctx)).join("\n");
        const shown = (v.state || "ready") === (p.active || "ready") ? " is-shown" : "";
        return `<div class="ux-state-view${shown}" data-state="${esc(v.state || "ready")}">${inner}</div>`;
      }).join("\n");
      return `<div class="ux-state-host" id="${esc(hostId)}">${views}</div>`;
    }
    default:
      return `<!-- unknown block: ${esc(type)} -->`;
  }
}

/* ── 屏幕 / 导航 / 组装 ────────────────────────── */
function resolveNav(spec) {
  const screens = spec.screens || [];
  if (spec.nav && spec.nav.items?.length) {
    return { mode: spec.nav.mode || (spec.kind === "game" ? "dock" : "tabs"), items: spec.nav.items };
  }
  const primaries = screens.filter((s) => s.role !== "modal").slice(0, 5);
  if (primaries.length >= 2) {
    const icons = spec.kind === "game"
      ? ["🏰", "🎒", "⚔️", "👥", "🏪"]
      : ["🏠", "📊", "💬", "👤", "⚙️"];
    return {
      mode: spec.kind === "game" ? "dock" : "tabs",
      items: primaries.map((s, i) => ({ screen: s.id, label: s.title || s.id, icon: icons[i] || "📄" })),
    };
  }
  return { mode: "none", items: [] };
}

function screenChrome(spec, screen, ctx) {
  const kind = spec.kind;
  const role = screen.role || "primary";
  if (role === "modal") return "none";
  const explicit = screen.chrome;
  if (explicit && explicit !== "auto") return explicit;
  if (kind === "game") return "hud";
  return "header";
}

function autoTitlebar(spec, screen) {
  // 若 blocks 里没有 titlebar，自动插入一个
  const has = (screen.blocks || []).some((b) => b.type === "titlebar");
  if (has) return null;
  return { type: "titlebar", props: { title: screen.title || spec.meta?.title || "原型" } };
}

function buildHtml(spec, tokens) {
  const kind = spec.kind === "app" ? "app" : "game";
  const meta = spec.meta || {};
  const title = meta.title || "交互原型";
  const device = meta.device || "auto";
  const orientation = meta.orientation || "portrait";
  const genre = kind === "game" ? (spec.game?.genre || "generic") : "";
  const nav = resolveNav(spec);
  const screens = spec.screens && spec.screens.length ? spec.screens : [{ id: "home", title: title, blocks: [{ type: "hero", props: { title, sub: "空 spec", motif: "✨" } }] }];
  const demoHp = !!(spec.demo && spec.demo.hpDrain);
  const demoToasts = spec.demo?.toasts !== false;
  const initial = screens[0].id;

  // 注册 flows + grid/list to
  const flowMap = {};
  for (const f of spec.flows || []) {
    flowMap[`${f.from}->${f.to}`] = f;
  }

  const screenHtml = screens.map((screen) => {
    const chromeMode = screenChrome(spec, screen, { screens, meta, kind });
    const ctx = { screen, meta, kind, screens, demoHp };
    let blocks = (screen.blocks || []).slice();
    const tb = autoTitlebar(spec, screen);
    if (tb && chromeMode !== "none") blocks = [tb, ...blocks];
    const dataAttrs = [
      `data-screen="${esc(screen.id)}"`,
      `data-title="${esc(screen.title || screen.id)}"`,
    ].join(" ");
    const trans = screen.transition ? ` data-transition="${esc(screen.transition)}"` : "";
    const scStagger = (meta.stagger === true || meta.stagger === "screen" || screen.stagger) ? " data-stagger" : "";
    // sticky head: titlebar + currency stay outside scroll
    let headHtml = "";
    let restBlocks = blocks.slice();
    if (chromeMode !== "none" && restBlocks[0]?.type === "titlebar") {
      headHtml += blockHtml(restBlocks[0], ctx);
      restBlocks = restBlocks.slice(1);
    }
    if (chromeMode !== "none" && restBlocks[0]?.type === "currency") {
      headHtml += blockHtml(restBlocks[0], ctx);
      restBlocks = restBlocks.slice(1);
    }
    const restHtml = restBlocks.map((b) => blockHtml(b, ctx)).join("\n");
    const bodyHtml = chromeMode === "none"
      ? restHtml
      : `${headHtml}<div class="ux-scroll"${scStagger}>\n${restHtml}\n</div>`;
    return `<section class="ux-screen"${trans} ${dataAttrs}>\n${bodyHtml}\n</section>`;
  }).join("\n");

  // bottom nav
  let navHtml = "";
  if (nav.mode === "tabs" || nav.mode === "dock") {
    const items = nav.items.map((it) =>
      `<button class="ux-tabbar__item" data-goto-tab="${esc(it.screen)}" type="button"><span class="icon">${ico(it.icon, 22) || esc(it.icon || "📄")}</span><span>${esc(it.label || it.screen)}</span>${badgeHtml(it.badge)}</button>`
    ).join("");
    navHtml = `<nav class="ux-tabbar" aria-label="主导航">${items}</nav>`;
  }

  // sidebar (desktop app)
  let sidebarHtml = "";
  if (device === "desktop" && kind === "app" && (nav.mode === "tabs" || nav.mode === "sidebar")) {
    const items = nav.items.map((it) =>
      `<button class="ux-sidebar__item" data-goto-tab="${esc(it.screen)}" type="button"><span class="icon">${ico(it.icon, 18) || esc(it.icon || "📄")}</span><span>${esc(it.label || it.screen)}</span></button>`
    ).join("");
    sidebarHtml = `<aside class="ux-sidebar"><div class="ux-sidebar__brand">${esc(title)}</div>${items}</aside>`;
    navHtml = "";
  }

  const footnote = meta.note
    ? `<footer class="ux-footnote">${esc(meta.note)}</footer>`
    : "";

  // top-of-frame currency etc. for game: inject screens' first chrome blocks stay inside screens.
  // Compose frame: sidebar optional + screens + tabbar + modal + toast
  const staggerAttr = meta.stagger === true || meta.stagger === "screen" ? " data-stagger" : "";
  const frameInner = `
${sidebarHtml}
<div class="ux-screens">
${screenHtml}
</div>
${navHtml}
${footnote}
<div class="ux-modal" role="dialog" aria-modal="true" aria-hidden="true">
  <div class="ux-modal__panel">
  <div class="ux-modal__head">
    <div class="ux-modal__icon" hidden></div>
    <h3 class="ux-modal__title">详情</h3>
  </div>
  <p class="ux-modal__body"></p>
  <div class="ux-modal__actions">
      <button class="ux-btn" data-modal-close type="button">取消</button>
      <button class="ux-btn ux-btn--primary" data-modal-ok type="button">确定</button>
    </div>
  </div>
</div>
<div class="ux-toast" role="status" aria-live="polite"></div>`;

  const cssVars = tokensToCss(tokens);
  const coreCss = read(join(__dirname, "ux-core.css"));
  const chromeCss = read(join(__dirname, "chrome-recipes.css"));
  const gameCss = kind === "game" ? read(join(__dirname, "game-core.css")) : "";
  const coreJs = read(join(__dirname, "ux-core.js"));
  const gameJs = kind === "game" ? read(join(__dirname, "game-core.js")) : "";

  const deviceAttr = device === "auto" ? (kind === "app" ? "phone" : "phone") : device;
  const navAttr = (deviceAttr === "desktop" && kind === "app" && (nav.mode === "tabs" || nav.mode === "sidebar")) ? "sidebar" : nav.mode;

  return `<!DOCTYPE html>
<html lang="${esc(meta.lang || "zh-CN")}" data-style="${esc(tokens.id)}" data-kind="${esc(kind)}" data-genre="${esc(genre)}" data-device="${esc(deviceAttr)}" data-nav="${esc(navAttr)}" data-orientation="${esc(orientation)}" data-orientation-view="${esc(orientation === "landscape" ? "landscape" : "portrait")}" data-render="${esc(meta.renderMode === "hi" ? "hi" : "sketch")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<style>
:root {
    ${cssVars}
    font-size: 16px;
  }
${coreCss}

${chromeCss}

${gameCss}
</style>
</head>
<body>
${iconSprite()}
<div class="ux-stage">
  <div class="ux-frame" id="ux-app" data-title="${esc(title)}" data-initial="${esc(initial)}" data-orientation="${esc(orientation === "landscape" ? "landscape" : "portrait")}" data-demo-hp="${demoHp ? "1" : "0"}" data-demo-toast="${demoToasts ? "1" : "0"}" data-render="${esc(meta.renderMode === "hi" ? "hi" : "sketch")}">
${frameInner}
  </div>
</div>
<script>
${coreJs}
</script>
${kind === "game" ? `<script>\n${gameJs}\n</script>` : ""}
</body>
</html>
`;
}

/* ── 示例 spec ────────────────────────────────── */
const EXAMPLES = {
  game: {
    meta: { title: "星穹旅人", subtitle: "主城", device: "phone", note: "示例：点击「出征」进入战斗演示" },
    kind: "game",
    style: "anime",
    demo: { hpDrain: true, toasts: true },
    nav: {
      mode: "dock",
      items: [
        { screen: "home", label: "主城", icon: "🏰" },
        { screen: "battle", label: "冒险", icon: "⚔️" },
        { screen: "bag", label: "背包", icon: "🎒" },
        { screen: "rank", label: "排行", icon: "🏆" },
      ],
    },
    screens: [
      {
        id: "home", title: "主城", blocks: [
          { type: "currency", props: { items: [
            { icon: "💰", label: "金币", value: "12.4K" },
            { icon: "💎", label: "钻石", value: "860" },
            { icon: "⚡", label: "体力", value: "88/100", plus: false },
          ] } },
          { type: "player-bar", props: { name: "旅人", level: 28, exp: 0.62 } },
          { type: "gacha-banner", props: { title: "限定祈愿 · 星穹", sub: "距结束 2天 04时 · 保底 42/80", cta: "前往祈愿", to: "battle" } },
          { type: "grid", props: { cols: 3, items: [
            { icon: "⚔️", title: "出征", sub: "主线 12-3", to: "battle" },
            { icon: "🗺️", title: "探索", act: "toast", toast: "探索功能演示中" },
            { icon: "🏪", title: "商店", act: "toast", toast: "商店功能演示中" },
            { icon: "👥", title: "公会", act: "toast", toast: "公会功能演示中" },
            { icon: "📜", title: "任务", act: "toast", toast: "任务功能演示中" },
            { icon: "⚙️", title: "设置", act: "modal", toast: "" },
          ] } },
          { type: "note", props: { text: "主城为默认首页；底部 Dock 与出征按钮均可进入战斗演示。" } },
        ],
      },
      {
        id: "battle", title: "战斗", blocks: [
          { type: "hp-bar", props: { name: "幼龙 · Lv.15", hp: 100, max: 100 } },
          { type: "hp-bar", props: { name: "旅人", hp: 86, max: 100, side: "left" } },
          { type: "hero", props: { title: "回合制演示", sub: "点击技能按钮查看反馈", motif: "🐉" } },
          { type: "skill-bar", props: { items: [
            { icon: "🔥", name: "炎刃", cost: "12" },
            { icon: "❄️", name: "冰封", cost: "18" },
            { icon: "✨", name: "奥义", cost: "40" },
            { icon: "🛡️", name: "防御", cost: "0" },
          ] } },
          { type: "joystick-hint" },
          { type: "buttons", props: { items: [
            { label: "自动战斗", variant: "primary", act: "toast", toast: "已开启自动战斗" },
            { label: "返回主城", variant: "ghost", to: "home" },
          ] } },
        ],
      },
      {
        id: "bag", title: "背包", blocks: [
          { type: "tabs", props: { items: [{ label: "全部", active: true }, { label: "装备" }, { label: "材料" }, { label: "限定" }] } },
          { type: "inventory", props: { items: [
            { icon: "🗡️", qty: 1, rarity: "legend", name: "苍穹之刃" },
            { icon: "🛡️", qty: 1, rarity: "epic", name: "星辉盾" },
            { icon: "🧪", qty: 24, rarity: "common", name: "治疗药水" },
            { icon: "💎", qty: 6, rarity: "rare", name: "强化石" },
            { icon: "📖", qty: 1, rarity: "epic", name: "技能书" },
            { icon: "🍖", qty: 12, rarity: "common", name: "烤肉" },
            { icon: "🔑", qty: 2, rarity: "rare", name: "秘境钥匙" },
            { icon: "🎀", qty: 1, rarity: "epic", name: "限定头像框" },
          ] } },
          { type: "note", props: { text: "点击格子会弹出道具 Toast；边框颜色对应稀有度。" } },
        ],
      },
      {
        id: "rank", title: "排行榜", blocks: [
          { type: "tabs", props: { items: [{ label: "战力榜", active: true }, { label: "公会榜" }, { label: "本周" }] } },
          { type: "leaderboard", props: { items: [
            { rank: 1, name: "夜翼", score: "98,420" },
            { rank: 2, name: "青雀", score: "95,110" },
            { rank: 3, name: "Kuro", score: "91,003" },
            { rank: 4, name: "旅人", score: "88,250", me: true },
            { rank: 5, name: "阿茶", score: "86,001" },
          ] } },
        ],
      },
    ],
  },
  app: {
    meta: { title: "工作台", device: "phone", note: "示例：App 侧多屏切换" },
    kind: "app",
    style: "ios-clean",
    nav: {
      mode: "tabs",
      items: [
        { screen: "home", label: "首页", icon: "🏠" },
        { screen: "data", label: "数据", icon: "📊" },
        { screen: "me", label: "我的", icon: "👤" },
      ],
    },
    screens: [
      {
        id: "home", title: "工作台", blocks: [
          { type: "search", props: { placeholder: "搜索订单 / 客户" } },
          { type: "hero", props: { title: "今日待办 6", sub: "3 条高优先级 · 预计 2.5h", motif: "📋", cta: { label: "开始处理", toast: "开始处理待办" } } },
          { type: "section", props: { title: "快捷入口", blocks: [
            { type: "grid", props: { cols: 4, items: [
              { icon: "📝", title: "新建", act: "toast", toast: "新建工作项" },
              { icon: "📤", title: "审批", act: "toast", toast: "打开审批" },
              { icon: "📅", title: "日程", act: "toast", toast: "打开日程" },
              { icon: "📁", title: "文档", to: "data" },
            ] } },
          ] } },
          { type: "section", props: { title: "最近", blocks: [
            { type: "list", props: { items: [
              { icon: "🧾", title: "Q3 预算复核", sub: "财务 · 2 小时前", to: "data" },
              { icon: "🤝", title: "客户 A 拜访纪要", sub: "销售 · 昨天" },
              { icon: "🚀", title: "版本 1.2 发布 checklist", sub: "研发 · 昨天" },
            ] } },
          ] } },
        ],
      },
      {
        id: "data", title: "数据", blocks: [
          { type: "tabs", props: { items: [{ label: "本周", active: true }, { label: "本月" }, { label: "自定义" }] } },
          { type: "stats", props: { items: [
            { label: "营收", value: "¥128.4K", icon: "💰", tone: "primary" },
            { label: "订单", value: "326", icon: "📦" },
            { label: "转化", value: "4.8%", icon: "📈" },
          ] } },
          { type: "chart", props: { values: [42, 58, 35, 72, 64, 88, 76], labels: ["一", "二", "三", "四", "五", "六", "日"] } },
          { type: "table", props: { head: ["渠道", "订单", "营收"], rows: [
            ["直营", "128", "¥52,300"],
            ["分销", "96", "¥41,200"],
            ["线上", "102", "¥34,900"],
          ] } },
        ],
      },
      {
        id: "me", title: "我的", blocks: [
          { type: "profile", props: { name: "陈小北", sub: "产品策划 · 工号 2331", avatar: "🧕" } },
          { type: "settings", props: { items: [
            { label: "消息通知", desc: "推送审批与评论", type: "toggle", value: true },
            { label: "深色模式", type: "toggle", value: false },
            { label: "语言", type: "select", value: "简体中文" },
            { label: "关于", type: "link", value: "v1.0.0" },
          ] } },
          { type: "buttons", props: { items: [
            { label: "退出登录", variant: "danger", block: true, act: "modal" },
          ] } },
          { type: "note", props: { text: "开关可点击切换；退出登录会弹确认框。" } },
        ],
      },
    ],
  },
};

/* ── main ─────────────────────────────────────── */
function main() {
  let spec;
  if (args.example) {
    const key = String(args.example);
    if (!EXAMPLES[key]) throw new Error(`--example 必须是 game|app`);
    spec = EXAMPLES[key];
  } else if (args["spec-json"]) {
    try { spec = JSON.parse(String(args["spec-json"]).replace(/^\uFEFF/, "")); } catch (e) { throw new Error("spec-json 解析失败: " + (e.message || e)); }
  } else {
    const p = resolve(args.spec);
    if (!existsSync(p)) throw new Error(`spec 不存在: ${p}`);
    try { spec = JSON.parse(read(p)); } catch (e) { throw new Error("spec JSON 解析失败: " + (e.message || e)); }
  }

  if (!spec.kind) throw new Error("spec.kind 必填: game | app");
  if (!spec.style) throw new Error("spec.style 必填（见 styles/catalog.md）");
  if (!spec.screens?.length) throw new Error("spec.screens 至少一项");
  if (spec.meta?.orientation && !["portrait", "landscape", "auto"].includes(spec.meta.orientation)) {
    throw new Error("meta.orientation 必须是 portrait | landscape | auto");
  }
  if (spec.game?.genre != null && typeof spec.game.genre !== "string") {
    throw new Error("game.genre 必须是字符串");
  }

  // id 唯一性
  const ids = new Set();
  for (const s of spec.screens) {
    if (!s.id) throw new Error("每个 screen 需要 id");
    if (ids.has(s.id)) throw new Error(`screen id 重复: ${s.id}`);
    ids.add(s.id);
  }
  // flow 目标存在
  for (const f of spec.flows || []) {
    if (f.to && !ids.has(f.to)) throw new Error(`flow.to 不存在: ${f.to}`);
  }
  for (const s of spec.screens) {
    for (const b of s.blocks || []) {
      const scan = (obj) => {
        if (!obj || typeof obj !== "object") return;
        if (obj.to && typeof obj.to === "string" && !ids.has(obj.to) && !["#"].includes(obj.to)) {
          // only flag if it looks like a screen ref inside known keys
          if (["to"].includes("to") && obj.title !== undefined || obj.screen !== undefined || obj.cta !== undefined || obj.label !== undefined || obj.icon !== undefined || b.type === "grid" || b.type === "list" || b.type === "buttons" || b.type === "dock" || b.type === "gacha-banner") {
            // soft check for grid/list/buttons
          }
        }
        for (const v of Object.values(obj)) if (v && typeof v === "object") scan(v);
      };
      scan(b.props);
      // hard check for common refs
      if (b.props?.to && !ids.has(b.props.to)) throw new Error(`${b.type}.to 不存在: ${b.props.to}`);
      for (const it of b.props?.items || []) {
        if (it.to && !ids.has(it.to)) throw new Error(`${b.type} item.to 不存在: ${it.to}`);
        if (it.screen && !ids.has(it.screen)) throw new Error(`nav item.screen 不存在: ${it.screen}`);
      }
      if (b.props?.cta?.to && !ids.has(b.props.cta.to)) throw new Error(`hero.cta.to 不存在: ${b.props.cta.to}`);
      if (b.props?.blocks) {
        // nested section blocks
      }
    }
  }
  for (const it of (spec.nav?.items || [])) {
    if (it.screen && !ids.has(it.screen)) throw new Error(`nav item.screen 不存在: ${it.screen}`);
  }

  const tokens = loadStyle(spec.style, spec.kind, spec.tokens);
  if (tokens.kind && tokens.kind !== spec.kind) {
    // allow but warn
    if (!QUIET) console.warn(`warn: style "${tokens.id}" kind=${tokens.kind} 与 spec.kind=${spec.kind} 不一致`);
  }
  const html = buildHtml(spec, tokens);

  const outPath = resolve(args.out || "out.html");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, "utf8");
  if (!QUIET) console.log(`✓ built ${outPath} (${(html.length / 1024).toFixed(1)} KB) style=${tokens.id} kind=${spec.kind} screens=${spec.screens.length}`);
}

try {
  main();
} catch (e) {
  console.error("✗ build failed:", e.message || e);
  process.exit(1);
}
