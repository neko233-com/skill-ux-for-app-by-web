# Spec Schema v1.1

构建器输入。一个 JSON 描述一份原型。由 LLM 从「文字描述 + 参考图」解析而来，
交给 `scripts/build.mjs` 确定性产出 HTML。

```jsonc
{
  "meta": {
    "title": "星穹旅人",
    "subtitle": "主城 · v0.3",
    "lang": "zh-CN",
    "device": "phone",              // phone | desktop | auto
    "note": "策划：点击「出征」进入战斗",
    "renderMode": "hi",             // hi | sketch  ← 草图模式
    "stagger": false                // true 时屏幕内容自动错峰入场
  },
  "kind": "game",                   // game | app  ← 必填
  "style": "anime",
  "tokens": { "overrides": { "palette.primary": "#FF6B9D" } },
  "nav": {
    "mode": "tabs",                 // tabs | dock | sidebar | none
    "items": [
      { "screen": "home", "label": "主城", "icon": "castle", "badge": { "type": "dot", "pulse": true } },
      { "screen": "msg",  "label": "邮件", "icon": "mail",  "badge": 5 }
    ]
  },
  "screens": [
    {
      "id": "home",
      "title": "主城",
      "role": "primary",            // primary | secondary | modal
      "chrome": "auto",             // auto | hud | header | none
      "transition": "slide",        // slide | fade | zoom | flip | none
      "stagger": false,             // 单屏覆盖 meta.stagger
      "blocks": [ /* 见 block 注册表 */ ]
    }
  ],
  "flows": [ { "from": "home", "to": "battle", "on": "click", "target": "[data-act=start]" } ],
  "demo": { "toasts": true, "hpDrain": false, "progressFill": true }
}
```

## 每个 block 的通用字段

```jsonc
{
  "type": "list",
  "anim": "fade-up",     // 可选。fade-up|fade-in|pop|bounce|shake|wiggle|pulse|glow|spin|slide-in-right|slide-in-left|slide-in-up|float|flash
  "props": {
    "state": "ready",    // ready | loading | empty | error | disabled
    "skeletonRows": 4,   // state=loading 时骨架行数
    "emptyIcon": "inbox",
    "emptyTitle": "还没有消息",
    "emptyDesc": "有人 @ 你时会出现在这里",
    "emptyAction": "去逛逛",
    "...": "其余为该 block 专属 props"
  }
}
```

- `state=loading` → 自动换成骨架屏
- `state=empty/error` → 自动换成空态/错误态（带图标与 CTA）
- `state=disabled` → 整块置灰且不可点
- 用 `state-switcher` + `state-views` 可做「一键切换四态」的演示控件

## Icon（内联 SVG）

所有 `icon` 字段优先接受 **图标名**（见下表；`icon:` 前缀可省略），
未知名自动回退为 emoji 原样输出。

`scripts/icons.json` 全量名单（stroke 风格，24×24）：

```
UI: home search settings user users bell heart star plus minus check x
    chevron-left/right/up/down arrow-left/right/up/down refresh share edit
    trash trash-2 eye eye-off lock unlock mail send calendar clock camera
    image download upload filter folder file inbox alert-circle
    alert-triangle info check-circle play pause skip-forward volume music
    mic video map map-pin compass gift shopping-cart credit-card wallet
    trending-up trending-down bar-chart pie-chart activity zap battery
    wifi bluetooth smartphone monitor tablet gamepad trophy crown
    message-circle message-square phone sunrise droplet feather aperture
    sun sun-dim moon cloud umbrella coffee book bookmark graduation-cap
    briefcase clipboard list grid layers copy link external-link
    maximize minimize more-horizontal more-vertical menu sliders power
    log-out log-in user-plus user-check loader sparkles palette

游戏: sword shield axe bow magic potion flask gem coin coins bag backpack
      package swords skull ghost dragon castle tower flag target crosshair
      anchor rocket planet
```

用法示例：

```jsonc
{ "icon": "sword", "size": 24 }
{ "icon": "trophy" }
{ "icon": "⚔️" }          // 回退 emoji
```

## 红点 / 徽标

支持在 nav item、grid item、list item、tab 等处：

```jsonc
"badge": true                          // 数字 1
"badge": 5                             // 数字徽标
"badge": "dot"                         // 纯红点
"badge": "pulse"                       // 呼吸红点
"badge": { "type": "dot", "pulse": true, "tone": "danger" }
"badge": { "value": 12, "tone": "accent" }
"badge": { "value": "新", "tone": "new" }
"badge": { "type": "none" }            // 关闭
```

`tone`：`danger`（默认红）| `ok` | `warn` | `accent` | `new` | `outline`

## Tween / 动画运行时

页面内联了 `window.UXTween`（及 `window.UX`）：

```js
// 元素 tween（支持 px/%/颜色）
UXTween.to(el, { opacity: 0.5, transform: "scale(1.1)", backgroundColor: "#FF6B9D" },
  { duration: 400, ease: "backOut", onDone: () => {} });

// 数字滚动
UXTween.count(el, 128400, { from: 0, duration: 800, prefix: "¥" });

// 序列
UXTween.seq([() => UX.toast("a"), () => UX.toast("b")], 200);

// easing: linear quadIn/Out/InOut cubicIn/Out/InOut backOut elasticOut bounceOut
```

CSS 动画类（可加在任意 block 的 `anim` 字段，或 custom HTML 上）：
`anim-fade-up` `anim-fade-in` `anim-pop` `anim-bounce` `anim-shake` `anim-wiggle`
`anim-pulse` `anim-glow` `anim-spin` `anim-slide-in-right|left|up` `anim-float` `anim-flash`

容器加 `data-stagger` → 子元素自动 40ms 错峰入场。

`progress` 支持 `"indeterminate": true` 条纹滚动加载条。

`stats` 支持 `"countTo": 128400, "countPrefix": "¥", "countFrom": 0` 进屏自动滚动。

## 草图模式（wireframe）

```jsonc
"meta": { "renderMode": "sketch" }
```

- 全局去色、虚线框、斜纹占位、灰度填充
- 保留结构、信息层级、红点（仍为红，方便找交互点）
- 右上角 `SKETCH · 草图模式` 水印
- 适合策划早期对齐；高保真评审用默认 `"hi"`

## 屏幕切换

```jsonc
{ "id": "detail", "transition": "zoom" }   // slide(默认) | fade | zoom | flip | none
```

## 状态演示控件

```jsonc
{ "type": "state-switcher", "props": { "for": "list-host", "states": ["ready","loading","empty","error"], "active": "ready" } }
{ "type": "state-views", "props": { "for": "list-host", "active": "ready", "views": [
  { "state": "ready",   "blocks": [ /* ... */ ] },
  { "state": "loading", "blocks": [ { "type": "list", "props": { "state": "loading" } } ] },
  { "state": "empty",   "blocks": [ { "type": "list", "props": { "state": "empty", "emptyTitle": "还没有消息" } } ] },
  { "state": "error",   "blocks": [ { "type": "list", "props": { "state": "error", "emptyAction": "重试" } } ] }
] } }
```

## Block 注册表（v1.1）

### 通用

| type | 关键 props | 说明 |
|---|---|---|
| `titlebar` | `title`, `back?`, `actions?: [{label,to?,icon?}]` | 顶栏 |
| `hero` | `title`, `sub?`, `motif?`（icon 名或 emoji）, `cta?{label,to?,icon?}` | 大视觉头图 |
| `section` | `title?`, `blocks: Block[]` | 分组容器 |
| `grid` | `cols?`(2-4), `items:[{icon,title,sub?,badge?,to?,tone?}]` | 卡片宫格 |
| `list` | `items:[{icon?,title,sub?,trailing?,badge?,to?}]` | 列表行 |
| `stats` | `items:[{label,value?,countTo?,countPrefix?,icon?,tone?}]` | 数值胶囊；可 count-up |
| `progress` | `label?`, `value?(0-1)`, `indeterminate?`, `showValue?` | 进度条 |
| `buttons` | `items:[{label,icon?,variant?,to?,act?}]` | 按钮组 |
| `form` | `fields:[{label,placeholder?,type?,required?}]`, `submit?` | 表单 |
| `settings` | `items:[{label,desc?,type:toggle\|select\|link,value?}]` | 设置组 |
| `carousel` | `items:[{title,desc?,tone?}]` | 横滑卡片 |
| `note` | `text`, `icon?` | 策划注释 |
| `search` | `placeholder?` | 搜索框 |
| `tabs` | `items:[{label,active?}]` | 分段控件 |
| `stepper` | `items:[{label,done?,active?}]` | 流程步骤 |
| `profile` | `name`, `sub?`, `avatar?`(icon/emoji), `stats?` | 个人头部 |
| `chart` | `values:[num]`, `labels?`, `height?` | 柱状图 |
| `table` | `head:[str]`, `rows:[[str]]` | 表格 |
| `state-switcher` | `for`, `states?`, `active?` | 状态演示切换器 |
| `state-views` | `for`, `views:[{state,blocks}], active?` | 状态视图容器 |
| `custom` | `html` | 原生 HTML |

### 游戏专属

| type | 关键 props |
|---|---|
| `currency` | `items:[{icon,label,value,plus?}]` |
| `player-bar` | `name`, `level`, `exp`, `avatar?` |
| `hp-bar` | `name`, `hp`, `max`, `side?`, `tone?` |
| `skill-bar` | `items:[{icon,name,cd?,cost?}]` |
| `dock` | `items:[{icon,label,to?,badge?}]` |
| `quest` | `items:[{title,desc?,progress?,reward?,done?}]` |
| `leaderboard` | `items:[{rank,name,score,me?}]` |
| `inventory` | `items:[{icon,name?,qty?,rarity?}]` |
| `joystick-hint` | — |
| `gacha-banner` | `title`, `sub?`, `cta?`, `to?`, `motif?` |

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
