# 工作流 06 · 游戏玩法优先的交互原型

当 `kind=game` 时，不要把需求只拆成「主页 / 列表 / 弹窗」。先还原**一个可操作的核心循环**，
再补外围页面。内置组件是本地演示状态机，不假装实现联网或完整商业游戏规则。

## 1. 先写核心循环，再写屏幕

用一行描述：

```
选择对象 → 选择操作/目标 → 确认 → 数值结算 → 动画与日志反馈 → 下一决策
```

每个玩法至少回答：

- 当前是谁的什么阶段？回合、行动力、费用、金币、人口是否可见？
- 可选对象有什么？选中态、不可选原因是否明确？
- 操作是立即生效还是二次确认？能否取消？
- 操作后哪些数值真实变化？生命、库存、手牌、位置、回合不能停留在 Toast。
- 下一步是什么？抽牌、敌方行动、回合恢复、胜负或继续布阵。

## 2. 选择玩法组件

| 用户玩法 | 首选 block | 必须跑通的演示链 |
|---|---|---|
| SLG / 战争策略 / 领地 | `slg-map` + `turn-bar` + `currency` | 选己方格 → 行军/进攻 → 相邻目标 → 兵力变化 → 结束回合 |
| 卡牌战斗 / 卡组构筑 | `card-battle` | 选牌与目标 → 打出 → 扣能量/结算 → 抽牌/敌方回合 |
| 斗地主 / 掼蛋 / 扑克 | `poker-table` | 多选 → 提示/理牌 → 出牌 → 手牌与轮次变化 |
| 自走棋 / 战棋布阵 | `auto-chess` | 购买 → 上下阵/换位 → 羁绊/升星 → 战斗与收入 |
| RPG / 回合制 / Boss | `card-battle` 或 `hp-bar` + `skill-bar` + `overhead-bar` | 目标/技能 → HP/护盾 → 敌方行动 |
| 塔防 | `slg-map`（格子）+ `overhead-bar` + `turn-bar` | 选格 → 放置/升级（用 `ux:game` 扩展）→ 波次 |
| Roguelike | `card-battle` + `grid` + `quest` | 选路线 → 战斗/事件 → 奖励进入下一局 |
| 放置 / 挂机 | `turn-bar` + `stats` + `progress` + `overhead-bar` | 领取 → 数值增长 → 冷却/下一轮 |
| 消除 / 解谜 | `slg-map`（复用网格）或 `custom` | 选格/交换 → 消除反馈 → 步数变化 |
| MOBA / 动作 | `joystick-hint` + `skill-bar` + `overhead-bar` | 移动提示 → 技能 → 命中/冷却反馈 |

未内置的细分规则通过 `document.addEventListener("ux:game", ...)` 和 `UXGame` API 扩展；
只有现有 block 无法表达布局时才使用 `custom`，不要因为缺少某个数值规则就手写整页。

## 3. 标记类型与方向

```jsonc
{
  "kind": "game",
  "game": { "genre": "auto-chess" },
  "meta": { "device": "phone", "orientation": "portrait" }
}
```

- **小游戏默认 `portrait`**，不要因为棋盘或牌桌就擅自改横屏。
- 用户明确要求横屏、或已确认以桌面/横屏小游戏为主时用 `landscape`。
- 需要兼容真实设备旋转时用 `auto`；评审演示可加 `act:"orientation"` 按钮。
- `act:"orientation"` 只切换原型布局，不锁定系统方向；小游戏宿主的方向清单仍由宿主配置。
- 竖屏优先保证：主操作在下半屏、触控目标约 44px、手牌/商店内部横滑、重要状态不依赖悬停。
- 横屏不是旋转页面：Dock 到右侧，SLG/自走棋使用「棋盘 + 操作面板」双栏，牌桌压缩纵向空间。
- 视口窄于 640px 时强制横屏预览也回退单栏与底部 Dock，不把棋盘压缩成不可点击的小格。
- 检查 390×844、360×800、844×390 与 1280×800；宽屏桌面仍显示设备框，不拉伸成后台页面。

## 4. 头顶状态与道具

- 单位头顶只放当前决策需要的 HP、关键异常、少量道具；完整描述放详情面板。
- 独立单位用 `overhead-bar`；卡牌敌人、自走棋棋子直接给 `statuses/items`。
- 道具必须有 `qty/effect/value`，点击后扣数量并结算；不要只做「使用成功」Toast。
- 状态/道具过多时内部横滑；禁止 fixed 定位遮住棋盘、手牌或 Dock。

## 5. 动画必须表达因果

| 事件 | 内置反馈 |
|---|---|
| 抽牌 / 购买 / 提示 | `anim-deal` |
| 伤害 / 受击 | `anim-hit` + `UXGame.floatText(el, "-6", "damage")` |
| 治疗 / 护盾 | `anim-heal` / `anim-glow-once` + 绿色或蓝色跳字 |
| 攻击 / 冲刺 | `anim-lunge` |
| 上阵 / 行军落位 | `anim-land` |
| 三合升星 / 升级 | `anim-level-up` |
| 出牌 | `.is-leaving` 的离场动画，然后从手牌移除 |

- 动画顺序应与数值因果一致，不能用长时间特效挡住下一次操作。
- 伤害数值与 HP 同步更新；动画结束不是状态提交的唯一时机。
- `prefers-reduced-motion` 下关闭装饰动画，保留文本和状态反馈。
- 循环呼吸只用于真正需要持续注意的对象，不给整个界面加满屏无限动画。

## 6. 构建与验收

```bash
node scripts/build.mjs --spec examples/game-genres.spec.json --out examples/demo-game-genres.html
node scripts/validate.mjs examples/demo-game-genres.html
python tests/e2e_game_qa.py examples/demo-game-genres.html
```

除通用 QA 外，逐项做「操作前值 → 操作 → 操作后值」断言。至少覆盖一次负路径：
能量不足、人口已满、非法牌型或不可达地块，确认有原因提示且状态不被误改。
