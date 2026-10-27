# skill-ux-for-app-by-web

> **文字描述 + 历史风格参考图 → 可交互 UX 原型 HTML**  
> 自动区分 **游戏 / 应用** · 内置 14 套风格包 · 可扩展 · 可嵌入**飞书文档**
> 游戏默认竖屏，深度支持 SLG / 卡牌 / 打牌 / 自走棋、头顶道具与战斗动画

一个给 **Codex / WorkBuddy / DeepSeek / MiMo / Claude 系** harness 通用的 skill 仓库。
LLM 负责理解需求与选风格，**确定性脚本**负责产出稳定 HTML —— 这是它比「让模型直接写页面」稳定一个数量级的原因。

## 为什么是这个设计

| 传统做法 | 本 skill |
|---|---|
| 模型每次手写几百行 HTML，风格漂移 | 模型只产出小体积 `spec.json`，`build.mjs` 渲染 |
| 外链字体/CDN，内网/飞书里白屏 | 强制零外链，`validate.mjs` 把关 |
| 游戏/App 风格混用 | `detection/` 先判别，再选对应风格库 |
| 游戏原型只有页面和 Toast | 玩法组件驱动选择、资源、HP、手牌、站位、回合等真实状态 |
| 密集游戏 UI 只做桌面缩放 | 默认竖屏；横屏重排 Dock 与双栏，支持 reduced-motion |
| 换个模型就换一套样式 | 风格 = 数据文件（tokens），与模型无关 |

## 快速体验

```bash
# 需要 Node ≥ 18
node scripts/build.mjs --example game --out prototypes/demo-game.html
node scripts/build.mjs --example app  --out prototypes/demo-app.html
node scripts/validate.mjs prototypes/demo-game.html

# 四种玩法 + 头顶道具 + 横竖屏综合示例
node scripts/build.mjs --spec examples/game-genres.spec.json --out examples/demo-game-genres.html
node scripts/validate.mjs examples/demo-game-genres.html
```

用浏览器打开 `prototypes/demo-game.html` 即可点击体验。
直接打开 `examples/demo-game-genres.html`，可演示 SLG 行军/进攻、卡牌费用与抽牌、
扑克多选/理牌、自走棋购买/布阵/升星；每屏均可切换横竖屏。

## 内置风格

**游戏**：二次元 · Supercell 欧美卡通 · 苹果风格 · 扁平 · 立体 · 霓虹街机 · 水墨国风 · 像素复古  

**应用**：苹果极简 · 谷歌质感 · 玻璃拟态 · 新粗野主义 · 商务后台 · 极简墨水  

详见 [`styles/catalog.md`](styles/catalog.md)。复制 `styles/_template.tokens.json` 到 `styles/custom/` 即可扩展。

## 工作流

```
文字描述 ──┐
           ├─→ 解析(spec) ─→ build.mjs ─→ 单文件 HTML ─→ validate ─→ 飞书
参考图   ──┘      ↑                         ↑
              detect game/app          styles/*.tokens.json
```

完整说明见 [`SKILL.md`](SKILL.md)；游戏核心循环、方向与动画规则见
[`workflows/06-gameplay.md`](workflows/06-gameplay.md)，组件字段见
[`styles/SCHEMA.md`](styles/SCHEMA.md)。

## 安装到各 harness

| Harness | 说明 |
|---|---|
| Codex | [`harness/install-codex.md`](harness/install-codex.md) → `~/.codex/skills/` |
| WorkBuddy | [`harness/install-workbuddy.md`](harness/install-workbuddy.md) → `~/.workbuddy/skills/` |
| DeepSeek / 读 AGENTS.md 的 | [`harness/install-deepseek.md`](harness/install-deepseek.md) |
| MiMo / Claude Code | 直接把本目录当 skill 用（读 `SKILL.md`） |

## 飞书嵌入

三种路线（附件 / 嵌入网页 / 截图+链接）见 [`workflows/05-feishu.md`](workflows/05-feishu.md)。

产物保证：单文件、显式 UTF-8、viewport 适配、无 `window.open`、无 XHR/fetch、系统字体栈、默认 < 500KB。

## 目录结构

```
├── SKILL.md                 # 权威工作流（harness 入口）
├── AGENTS.md                # 兼容读 AGENTS.md 的 harness
├── detection/               # game vs app 判别
├── styles/                  # 风格包 + schema + catalog
├── scripts/
│   ├── build.mjs            # 确定性构建器（零依赖）
│   ├── validate.mjs         # 自包含 / 飞书安全校验
│   ├── ux-core.css|js       # 基础样式与交互运行时
│   ├── game-blocks.mjs      # SLG / 卡牌 / 打牌 / 自走棋渲染器
│   ├── game-core.css|js     # 玩法状态、头顶栏、方向与动画
│   └── chrome-recipes.css   # 风格特化
├── workflows/               # 解析 / 参考图 / 组装 / QA / 飞书
├── harness/                 # 各 harness 安装说明
├── examples/                # 示例 spec 与产物
└── tests/                   # 深度测试脚本
```

## 测试

```bash
node scripts/build.mjs --example game --out tests/artifacts/g.html
node scripts/validate.mjs tests/artifacts/g.html
python tests/e2e_qa.py tests/artifacts/g.html    # 需要 playwright + chromium

# 游戏玩法：状态、方向、头顶栏与动画回归
node scripts/build.mjs --spec examples/game-genres.spec.json --out tests/artifacts/game-genres.html
python tests/e2e_game_qa.py tests/artifacts/game-genres.html
```

## License

MIT © neko233-com
