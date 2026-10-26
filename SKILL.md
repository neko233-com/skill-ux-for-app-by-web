---
name: skill-ux-for-app-by-web
description: |
  Generate interactive UX prototype HTML from a text brief, optionally guided by
  historical style reference images. Auto-detects game vs app UI, applies built-in
  style packs (8 game styles + 6 app styles, extensible), and emits a single
  self-contained HTML file that works offline and embeds into Feishu docs.
  Use when: 交互原型 / UX 原型 / 可点击 demo / 策划交互稿 / 高保真界面演示 /
  按参考图还原风格的网页原型 / game UI prototype / app UI prototype.
description_zh: "文字描述+风格参考图 → 可交互 UX 原型 HTML（自动区分游戏/应用，可嵌飞书）"
description_en: "Text + style refs → interactive UX prototype HTML (game/app aware, Feishu-embeddable)"
version: 1.0.0
license: MIT
metadata:
  category: ux-prototype
  runtime: node>=18
  outputs: [html]
---

# skill-ux-for-app-by-web

把**文字描述**（可选配**历史风格参考图**）变成**可点击的 UX 原型 HTML**：

- 自动区分 **游戏 UI** 还是 **应用 UI**
- 内置风格包：游戏 8 套 + 应用 6 套，支持自定义扩展
- 单文件、零外链、`file://` 可开，**可嵌入飞书文档**做策划交互原型
- 由 `scripts/build.mjs` 确定性构建 —— 比手写 HTML 稳定一个数量级

## 激活条件

出现以下任一意图时使用本 skill：

- 做交互原型 / UX 原型 / 界面 demo / 可点流程 / 高保真演示稿
- 「按这段描述出一版可以点的页面」
- 「参考这张图的风格，做一个游戏主城 / App 首页」
- 「生成能放进飞书的原型」

## 铁律

1. **不要手写整页 HTML**。写 `spec.json`，跑构建器。
2. **不要加任何外链**（CDN 字体/图片/JS）。产物必须自包含。
3. **产出后必须跑 `validate.mjs`**，ERROR 为 0 才能交付。
4. 有 Playwright/浏览器条件时，按 `workflows/04-qa.md` 做点击冒烟。
5. 交付时用一句话报备：识别结果（game/app）+ 所用风格 + 文件路径 + 飞书用法。

## 标准流程（6 步）

### 1. 解析描述

读 `workflows/01-parse.md`。产出：屏幕清单、跳转关系、内容块。

### 2. 判别 game / app

读 `detection/detect-kind.md`。不确定就**问用户一句**（给两个选项）。
判完告诉用户，让其有机会纠偏。

### 3. 选风格

- 用户点名 → 直接用
- **有参考图** → 读 `workflows/02-style-from-ref.md`：视觉对齐最近内置包，
  用 `tokens.overrides` 微调主色；气质完全对不上才写 `styles/custom/`
- 没点名没图 → 查 `styles/catalog.md` 推荐一套，并说明理由

### 4. 写 spec.json

Schema 权威文件：`styles/SCHEMA.md`。

最小可用例子：

```json
{
  "meta": { "title": "星穹旅人", "device": "phone", "note": "点击出征进入战斗" },
  "kind": "game",
  "style": "anime",
  "nav": { "mode": "dock", "items": [
    { "screen": "home", "label": "主城", "icon": "🏰" },
    { "screen": "battle", "label": "冒险", "icon": "⚔️" }
  ]},
  "screens": [
    { "id": "home", "title": "主城", "blocks": [
      { "type": "currency", "props": { "items": [
        { "icon": "💰", "label": "金币", "value": "12.4K" },
        { "icon": "💎", "label": "钻石", "value": "860" }
      ]}},
      { "type": "gacha-banner", "props": { "title": "限定祈愿", "sub": "保底 42/80", "cta": "前往", "to": "battle" }},
      { "type": "grid", "props": { "cols": 3, "items": [
        { "icon": "⚔️", "title": "出征", "to": "battle" },
        { "icon": "🏪", "title": "商店", "act": "toast", "toast": "商店演示中" }
      ]}}
    ]},
    { "id": "battle", "title": "战斗", "blocks": [
      { "type": "hp-bar", "props": { "name": "幼龙", "hp": 100, "max": 100 } },
      { "type": "skill-bar", "props": { "items": [
        { "icon": "🔥", "name": "炎刃", "cost": "12" }
      ]}}
    ]}
  ],
  "demo": { "hpDrain": true }
}
```

Block 全表、导航、demo 开关都在 SCHEMA.md。

### 5. 构建 + 校验

```bash
node scripts/build.mjs --spec <spec.json> --out <name>.html
node scripts/validate.mjs <name>.html
```

校验 FAIL → 改 spec 重建；**禁止**直接在产物 HTML 上修。

### 6. QA + 交付

- 按 `workflows/04-qa.md` 至少完成 A（静态）；有条件做 B/C
- 交付话术模板：

```
已生成可交互原型：
- 识别：游戏原型 / 应用原型
- 风格：二次元（anime）  ← 如有参考图，说明对齐来源
- 文件：prototypes/xxx.html
- 打开：浏览器直接打开即可；所有按钮/tab 可点
- 飞书：作为附件上传后下载打开（推荐）；
        或托管为 https URL 后用「嵌入网页」（见 workflows/05-feishu.md）
- 演示点：主城 → 出征 → 战斗技能；底部 Dock 切换背包/排行
```

## 风格包一览

完整表见 `styles/catalog.md`。

**游戏**：`anime` 二次元 · `supercell` 欧美卡通 · `apple-game` 苹果风格 ·
`flat` 扁平 · `volume` 立体 · `neon-arcade` 霓虹街机 · `ink-wash` 水墨国风 ·
`pixel-retro` 像素复古

**应用**：`ios-clean` 苹果极简 · `material` 谷歌质感 · `glass` 玻璃拟态 ·
`brutalist` 新粗野主义 · `business` 商务后台 · `ink-minimal` 极简墨水

## 扩展风格

复制 `styles/_template.tokens.json` → `styles/custom/<id>.tokens.json`，
改 id 与 token；特殊纹理可加 `[data-style="<id>"]` 规则到
`scripts/chrome-recipes.css`。然后 spec 的 `style` 填新 id。

## 目录地图

| 路径 | 用途 |
|---|---|
| `scripts/build.mjs` | 构建器（零依赖） |
| `scripts/validate.mjs` | 飞书安全 / 自包含校验 |
| `scripts/ux-core.css` `ux-core.js` | 基础样式与交互运行时 |
| `scripts/chrome-recipes.css` | 每风格特化 |
| `styles/*.tokens.json` | 风格包数据 |
| `styles/SCHEMA.md` | spec 与 token schema（权威） |
| `styles/catalog.md` | 风格速查与选型口诀 |
| `detection/detect-kind.md` | 游戏/应用判别 |
| `workflows/` | 解析 / 参考图 / 组装 / QA / 飞书 |
| `harness/` | codex / workbuddy / deepseek 安装 |
| `examples/` | 示例产物与 spec |

## 环境要求

- Node.js ≥ 18（构建器；零 npm 依赖）
- 可选：Python Playwright + Chromium（深度 QA）
- 无 Node 时走 `workflows/03-compose.md` 降级路径（不推荐）

## 常见错误速查

| 症状 | 处理 |
|---|---|
| style 未找到 | 对 catalog 拼写；custom 必须在 `styles/custom/` |
| 校验报外链 | 用了 CDN / custom 块里写了 http 图；全部内联或改 SVG/emoji |
| 嵌入飞书白屏 | 走附件路线；或确认 URL 可达且为 https |
| 样式发虚/发糊 | 多半没用内置风格包，手写了颜色；回到 token 体系 |
| 交互没反应 | 检查 `data-goto` 目标 id 是否存在；看浏览器 console |
