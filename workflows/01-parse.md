# 工作流 01 · 从文字描述解析

输入：用户的一段话（可能很乱）。输出：一份可写进 `spec.json` 的结构。

## 步骤

1. **抽取产品名 / 界面名** → `meta.title`（没有就用「XX 原型」）
2. **判 kind** → 读 `detection/detect-kind.md`，给出一句话结论让用户可纠偏
3. **游戏补玩法与方向** → `game.genre` + `meta.orientation`，并读 `workflows/06-gameplay.md`
   - 小游戏缺省 `portrait`；用户明确要求才设 `landscape`，需要跟随设备旋转用 `auto`
   - 先写「选择 → 确认 → 结算 → 反馈 → 下一步」核心循环，不能只列静态页面
4. **列屏幕**：用户提到的每个「页 / 界面 / 流程步骤」→ 一个 screen
   - id 用短英文：`home` `battle` `login` `detail` `order` …
   - title 用中文原词
   - role：第一屏 = primary；流程中间页 secondary；确认框类 modal
5. **列每屏内容**：把描述里的元素映射到 block 注册表（见 `styles/SCHEMA.md`）
   - 实在没有合适 block → `custom` 注入 HTML，并只用 `.ux-*` 工具类上风格
6. **列跳转**：任何「进入 / 打开 / 点击后」→ `to` 或 `flows`
7. **选风格** → 见 `workflows/02-style-from-ref.md` 或 catalog
8. **写 meta.note**：一句给策划看的交互说明（放页脚）

## 映射提示（高频）

| 用户原话 | block |
|---|---|
| 顶部显示金币钻石 | `currency` |
| 玩家头像等级经验 | `player-bar` |
| 大 banner / 卡池 | `gacha-banner` 或 `hero` |
| 功能入口宫格 | `grid` |
| 设置项开关 | `settings` |
| 战斗血条 | `hp-bar` |
| 角色/棋子头顶状态、道具 | `overhead-bar`，或单位的 `statuses/items` |
| SLG 地图、侦察、行军 | `slg-map` |
| 手牌、费用、抽牌、回合战斗 | `card-battle` |
| 扑克、多选、提示、理牌 | `poker-table` |
| 自走棋棋盘、商店、备战席 | `auto-chess` |
| 回合/阶段/行动力 | `turn-bar` |
| 技能按钮一排 | `skill-bar` |
| 任务列表 | `quest` |
| 排行榜 | `leaderboard` |
| 背包格子 | `inventory` |
| 底部导航 | `nav`（不是 block） |
| 表单提交 | `form` |
| 数据看板 | `stats` + `chart` + `table` |
| 个人中心 | `profile` + `settings` |
| 说明文案高亮 | `note` |

## 自检

- 每个 screen id 唯一，且所有 `to` 指向存在的 id
- 首屏 3 秒能看懂这是什么产品
- 至少 2 个屏或 1 个多交互单屏，否则没有「原型感」
