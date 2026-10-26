# skill-ux-for-app-by-web

> **文字描述 + 历史风格参考图 → 可交互 UX 原型 HTML**  
> 自动区分 **游戏 / 应用** · 内置 14 套风格包 · 可扩展 · 可嵌入**飞书文档**

一个给 **Codex / WorkBuddy / DeepSeek / MiMo / Claude 系** harness 通用的 skill 仓库。
LLM 负责理解需求与选风格，**确定性脚本**负责产出稳定 HTML —— 这是它比「让模型直接写页面」稳定一个数量级的原因。

## 为什么是这个设计

| 传统做法 | 本 skill |
|---|---|
| 模型每次手写几百行 HTML，风格漂移 | 模型只产出小体积 `spec.json`，`build.mjs` 渲染 |
| 外链字体/CDN，内网/飞书里白屏 | 强制零外链，`validate.mjs` 把关 |
| 游戏/App 风格混用 | `detection/` 先判别，再选对应风格库 |
| 换个模型就换一套样式 | 风格 = 数据文件（tokens），与模型无关 |

## 快速体验

```bash
# 需要 Node ≥ 18
node scripts/build.mjs --example game --out prototypes/demo-game.html
node scripts/build.mjs --example app  --out prototypes/demo-app.html
node scripts/validate.mjs prototypes/demo-game.html
```

用浏览器打开 `prototypes/demo-game.html` 即可点击体验。

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

完整说明见 [`SKILL.md`](SKILL.md)。

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
python tests/e2e_qa.py    # 需要 playwright + chromium
```

## License

MIT © neko233-com
