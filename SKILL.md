---
name: skill-ux-for-app-by-web
description: |
  Generate interactive UX prototype HTML from a text brief, optionally guided by
  historical style reference images. Auto-detects game vs app UI, applies built-in
  style packs (8 game styles + 6 app styles, extensible), and emits a single
  self-contained HTML file that works offline and embeds into Feishu docs.
  Gameplay-first blocks cover SLG, card battles, poker and auto-chess, with
  overhead items, combat animation and portrait/landscape layouts (portrait first).
  Use when: 交互原型 / UX 原型 / 可点击 demo / 策划交互稿 / 高保真界面演示 /
  按参考图还原风格的网页原型 / game UI prototype / app UI prototype.
description_zh: "文字描述+风格参考图 → 可交互 UX 原型 HTML（自动区分游戏/应用，可嵌飞书）"
description_en: "Text + style refs → interactive UX prototype HTML (game/app aware, Feishu-embeddable)"
version: 1.2.2
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
- **内联 SVG 图标库**、**红点/数字徽标**、**骨架/空态/错误态**、**Tween 动画引擎**
- **玩法优先**：SLG 地图、卡牌战斗、打牌、自走棋均有真实可选中/结算状态
- **单位头顶状态/道具栏**、伤害跳字、发牌/受击/上阵/升星动画，支持 reduced-motion
- **游戏默认竖屏**，支持显式横屏与跟随设备；横屏重排 Dock、棋盘与操作面板
- **草图模式**（`meta.renderMode="sketch"`）：同一份 spec 输出低保真线框，给策划早期对齐
- 屏幕切换 transition：slide / fade / zoom / flip
- 单文件、零外链、`file://` 可开，**可嵌入飞书文档**做策划交互原型
- 由 `scripts/build.mjs` 确定性构建 —— 比手写 HTML 稳定一个数量级

## 激活条件

出现以下任一意图时使用本 skill：

- 做交互原型 / UX 原型 / 界面 demo / 可点流程 / 高保真演示稿
- 「按这段描述出一版可以点的页面」
- 「参考这张图的风格，做一个游戏主城 / App 首页」
- 「生成能放进飞书的原型」

## 铁律

0. **默认出草图**。`meta.renderMode` 省略即 sketch；要高保真才写 `"renderMode": "hi"`。
0b. **文案克制**。默认不写 `note`；写了也要 ≤16 字。禁止在界面上罗列功能说明或 AI 长句。
0c. **可点就有反馈**。道具栏/背包/入口优先 `detail` 弹窗，而不是 toast 一句话。

1. **不要手写整页 HTML**。写 `spec.json`，跑构建器。
2. **不要加任何外链**（CDN 字体/图片/JS）。产物必须自包含。
3. **产出后必须跑 `validate.mjs`**，ERROR 为 0 才能交付。
4. 有 Playwright/浏览器条件时，按 `workflows/04-qa.md` 做点击冒烟。
5. 交付时用一句话报备：识别结果（game/app）+ 所用风格 + 文件路径 + 飞书用法。

## 标准流程（6 步）

### 1. 解析描述

读 `workflows/01-parse.md`。产出：屏幕清单、跳转关系、内容块。
如果是游戏，再读 `workflows/06-gameplay.md`：补 `game.genre`、核心操作闭环和
`meta.orientation`（小游戏默认 `portrait`），不要把玩法做成只有 Toast 的静态稿。

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

### 5. 构建 + 校验 + 全链路验证

```bash
node scripts/build.mjs --spec <spec.json> --out <name>.html
node scripts/validate.mjs <name>.html
node tests/verify-all.mjs    # 可选：全链路 19 项（含边界用例）
node tests/edge-cases.mjs    # 可选：构建器边界
```

校验 FAIL → 改 spec 重建；**禁止**直接在产物 HTML 上修。

### 6. QA + 交付

- 按 `workflows/04-qa.md` 至少完成 A（静态）；有条件做 B/C
- 使用玩法 block 时必须跑 `tests/e2e_game_qa.py`（有 Playwright 时），验证操作前后数值而非只点导航
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

## 能力速查（v1.2）

| 需求 | 怎么写 |
|---|---|
| 图标 | `icon: "sword"`（名见 SCHEMA；未知名回退 emoji） |
| 红点 | `badge: "pulse"` 或 `badge: { type:"dot", tone:"danger" }` |
| 数字徽标 | `badge: 5` / `badge: { value:"新", tone:"new" }` |
| 弹窗详情 | item/按钮加 `detail: { title, desc, rewards?, icon?, ok? }` |
| 加载态 | block 上 `props.state: "loading"` |
| 空/错态 | `state: "empty"|"error"` + emptyTitle/emptyAction |
| 禁用 | `state: "disabled"` |
| 状态演示 | `state-switcher` + `state-views`（同 `for` id） |
| 数字滚动 | stats 项 `countTo: 128400, countPrefix: "¥"` |
| 入场动画 | block `anim: "fade-up"` 或 `meta.stagger: true` |
| 加载条纹 | progress `indeterminate: true` |
| 高保真 | `meta.renderMode: "hi"`（默认 sketch） |
| 屏切换 | screen `transition: "zoom"` |
| 运行时 tween | 页面内 `UXTween.to / UXTween.count`（见 SCHEMA） |
| 游戏类型/方向 | `game.genre:"slg"` + `meta.orientation:"portrait"`（默认竖屏） |
| SLG 核心循环 | `slg-map`：选格 → 行军/进攻 → 目标 → 回合 |
| 卡牌战斗 | `card-battle`：费用、目标、伤害/治疗、抽牌 |
| 打牌 | `poker-table`：多选、提示、理牌、出牌 |
| 自走棋 | `auto-chess`：购买、站位、羁绊、升星、战斗 |
| 头顶道具 | `overhead-bar`，或单位 `statuses/items` |
| 战斗动画 | `anim-deal/hit/heal/lunge/land/level-up` + `UXGame.floatText` |
| 横竖屏演示 | 按钮 `act:"orientation"` 或 `UX.toggleOrientation()` |

完整玩法 spec：`examples/game-genres.spec.json`；产物：`examples/demo-game-genres.html`。

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
| `scripts/game-blocks.mjs` | 玩法 block 渲染器 |
| `scripts/game-core.css` `game-core.js` | 横竖屏、玩法状态与战斗动画（仅 game 内联） |
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
