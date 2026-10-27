# skill-ux-for-app-by-web

> 兼容入口：若你的 harness 读取 `AGENTS.md` 而非 `SKILL.md`，请直接执行
> [SKILL.md](./SKILL.md) 中的完整流程。两者内容契约一致，以 `SKILL.md` 为准。

## 一句话

根据**文字描述 + 可选的历史风格参考图**，自动生成可交互的 UX 原型 HTML
（自动区分 **游戏 / 应用**，内置多套风格包，产出可嵌入飞书文档）。

## 快速契约（给 harness 的最小指令）

当用户出现以下意图时激活本 skill：

- 做交互原型 / UX 原型 / 界面 demo / 高保真可点流程
- 「按这个描述出一版可点击的页面」
- 「参考这张图的风格，做个游戏主城 / App 首页」
- 「生成能放进飞书文档的原型」

执行步骤（详见 SKILL.md）：

1. **解析** 文字描述 → `kind`（game|app）+ 屏幕/流程/内容清单；游戏补 `game.genre`、核心操作闭环和 `meta.orientation`（默认竖屏），读 `workflows/06-gameplay.md`
2. **选风格**（用户点名 → 用点名；有参考图 → 视觉对齐最近风格包或写 custom；都没有 → 按 kind 推荐）
3. **写 spec.json**（schema 见 `styles/SCHEMA.md`）
4. **构建**：`node scripts/build.mjs --spec <spec.json> --out <out.html>`
5. **校验**：`node scripts/validate.mjs <out.html>` 必须 0 错误
6. **交付**：HTML 路径 + 飞书嵌入方式（见 `workflows/05-feishu.md`）

不要手写整页 HTML 除非 build 脚本不可用；脚本产出比手写稳定一个数量级。

## 目录

- `SKILL.md` — 完整工作流（权威）
- `scripts/build.mjs` — 确定性 HTML 构建器（零依赖，Node ≥ 18）
- `scripts/validate.mjs` — 产出物自包含/飞书安全校验
- `scripts/game-blocks.mjs` + `game-core.css|js` — SLG/卡牌/打牌/自走棋、头顶道具、横竖屏与动画
- `styles/` — 风格包（游戏 8 套 + 应用 6 套，可扩展）
- `detection/` — 游戏 vs 应用判别
- `workflows/` — 解析 / 参考图 / 组装 / QA / 飞书嵌入
- `harness/` — codex / workbuddy / deepseek 安装说明
