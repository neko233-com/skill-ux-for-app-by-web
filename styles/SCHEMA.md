# Spec Schema v1

构建器输入。一个 JSON 描述一份原型。由 LLM 从「文字描述 + 参考图」解析而来，
交给 `scripts/build.mjs` 确定性产出 HTML。

```jsonc
{
  "meta": {
    "title": "星穹旅人",            // 必填。原型标题
    "subtitle": "主城 · v0.3",      // 可选
    "lang": "zh-CN",                // 默认 zh-CN
    "device": "phone",              // phone | desktop | auto（默认 auto）
    "note": "策划：点击「出征」进入战斗" // 可选，页脚说明
  },
  "kind": "game",                   // game | app  ← 必填
  "style": "anime",                 // 风格包 id，见 styles/catalog.md
  "tokens": {                       // 可选。覆盖 token（深路径点号）
    "overrides": {
      "palette.primary": "#FF6B9D",
      "shape.radiusLg": "24px"
    }
  },
  "nav": {                          // 可选。主导航
    "mode": "tabs",                 // tabs | dock | sidebar | none
    "items": [
      { "screen": "home",  "label": "主城", "icon": "🏰" },
      { "screen": "bag",   "label": "背包", "icon": "🎒" }
    ]
  },
  "screens": [                      // 至少 1 个
    {
      "id": "home",                 // 必填，唯一，[a-z0-9-]+
      "title": "主城",              // 可选（titlebar 用）
      "role": "primary",            // primary | secondary | modal
      "chrome": "auto",             // auto | hud | header | none
      "blocks": [                   // 见下方 block 注册表
        { "type": "player-bar", "props": { "name": "旅人", "level": 28, "exp": 0.62 } },
        { "type": "gacha-banner", "props": { "title": "限定祈愿", "sub": "距结束 2天", "cta": "前往祈愿" } },
        { "type": "grid", "props": {
          "cols": 3,
          "items": [
            { "icon": "⚔️", "title": "冒险", "to": "battle" },
            { "icon": "🗺️", "title": "探索" },
            { "icon": "🏪", "title": "商店" }
          ]
        }}
      ]
    }
  ],
  "flows": [                        // 可选。显式跳转（grid item 的 to 也会自动注册）
    { "from": "home", "to": "battle", "on": "click", "target": "[data-act=start]" }
  ],
  "demo": {                         // 可选。内置演示行为
    "toasts": true,                 // 按钮点击后 toast
    "hpDrain": false,               // battle 屏自动演示掉血
    "progressFill": true            // progress 进入视口时动画到目标值
  }
}
```

## Block 注册表

### 通用

| type | 关键 props | 说明 |
|---|---|---|
| `titlebar` | `title`, `back?`, `actions?: [{label,to?}]` | 顶栏 |
| `hero` | `title`, `sub?`, `motif?`（emoji）, `cta?{label,to?}` | 大视觉头图（CSS 渐变 + motif） |
| `section` | `title?`, `blocks: Block[]` | 分组容器 |
| `grid` | `cols?`(2-4), `items:[{icon,title,sub?,badge?,to?,tone?}]` | 卡片宫格；`to` 自动绑跳转 |
| `list` | `items:[{icon?,title,sub?,trailing?,to?}]` | 列表行 |
| `stats` | `items:[{label,value,icon?,tone?}]` | 数值胶囊组 |
| `progress` | `label?`, `value`(0-1), `tone?`, `showValue?` | 进度条 |
| `buttons` | `items:[{label,variant?,to?,act?}]` | 按钮组；variant: primary/ghost/danger |
| `form` | `fields:[{label,placeholder?,type?,required?}]`, `submit?{label}` | 表单；提交 → toast |
| `settings` | `items:[{label,desc?,type:toggle\|select\|link,value?}]` | 设置组 |
| `carousel` | `items:[{title,desc?,tone?}]` | 横滑卡片（可拖/点指示点） |
| `note` | `text`, `tone?` | 策划注释块 |
| `search` | `placeholder?` | 搜索框（app） |
| `tabs` | `items:[{label,active?}]` | 分段控件 / 筛选 chip |
| `stepper` | `items:[{label,done?,active?}]` | 流程步骤 |
| `profile` | `name`, `sub?`, `avatar?`(emoji), `stats?` | 个人头部 |
| `chart` | `values:[num]`, `labels?`, `height?` | 纯 CSS 柱状图 |
| `table` | `head:[str]`, `rows:[[str]]` | 简单表格 |
| `custom` | `html` | 原生 HTML（用当前 token 的工具类上样式） |

### 游戏专属

| type | 关键 props | 说明 |
|---|---|---|
| `currency` | `items:[{icon,label,value,plus?}]` | 顶栏货币 |
| `player-bar` | `name`, `level`, `exp`(0-1), `avatar?` | 头像 + 等级 + 经验 |
| `hp-bar` | `name`, `hp`, `max`, `side?`(left/right), `tone?` | 战斗血条 |
| `skill-bar` | `items:[{icon,name,cd?,cost?}]` | 技能按钮排 |
| `dock` | `items:[{icon,label,to?,badge?}]` | 底部游戏坞 |
| `quest` | `items:[{title,desc?,progress?,reward?,done?}]` | 任务列表 |
| `leaderboard` | `items:[{rank,name,score,me?}]` | 排行榜 |
| `inventory` | `items:[{icon,qty?,rarity?}]` | 背包格子 |
| `joystick-hint` | — | 战斗操作提示（装饰） |

### 内部约定

- Block 内 `to: "<screenId>"` → 生成 `data-goto="<screenId>"`，由 ux-core 统一接管。
- `act: "toast:<文案>"` → `data-act="toast"` + `data-toast="..."`。
- 没写 `nav` 时：game 默认从 screens 里取 `role=primary` 的前几个组成 dock；
  app 默认组成 tabs。
- `id` 为 `home` 或第一个 screen 为初始屏。

## Token 文件 schema

见 `styles/game/anime.tokens.json` 作为权威样例。字段：

```
id, kind, name, nameEn, summary, whenToUse,
palette: { bg, bgAlt, surface, surface2, ink, ink2, ink3,
           primary, primary2, onPrimary, accent, accent2,
           ok, warn, danger, line, glass }
type:    { fontStack, weightDisplay, weightBody, weightStrong,
           fsXs, fsSm, fsMd, fsLg, fsXl, fs2xl, fs3xl, tracking }
shape:   { rSm, rMd, rLg, rXl, rFull, borderW, borderC, stroke }
elevation:{ card, btn, btnPress, glow, inset }
motion:  { ease, durFast, dur, durSlow, pressScale }
chrome:  { header, button, card, tab, pattern, grain }
extras:  { "任意自定义 CSS 变量，注入 :root" }
```

自定义风格：复制 `styles/_template.tokens.json` → `styles/custom/<id>.tokens.json`，
spec 的 `style` 填该 id 即可。
