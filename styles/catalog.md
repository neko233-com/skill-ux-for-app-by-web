# 风格速查表

构建时把 `style` 填成下表的 **id**。自定义风格放 `styles/custom/<id>.tokens.json`。

## 游戏（`styles/game/`）

| id | 名称 | 气质 | 适合 |
|---|---|---|---|
| `anime` | 二次元 | 粉紫高饱和 · 白描边 · 闪光 | 二次元手游 / 抽卡养成 |
| `supercell` | Supercell 欧美卡通 | 蓝金高饱和 · 粗描边 · 实色阴影 | SLG / 塔防 / 休闲竞技 |
| `apple-game` | 苹果风格 | 毛玻璃 · 系统字 · 细腻渐变 | 轻游戏 / Apple Arcade 感 |
| `flat` | 扁平风格 | 纯色块 · 无阴影 · 高可读 | 休闲 / 教育 / 活动页 |
| `volume` | 立体风格 | 斜面高光 · 内阴影 · 拟物按键 | RPG / 策略 / 经营 |
| `neon-arcade` | 霓虹街机 | 深底霓虹 · 扫描线 · 辉光 | 赛博 / 街机 / 音游 |
| `ink-wash` | 水墨国风 | 宣纸 · 墨色 · 朱砂印 | 武侠 / 仙侠 / 解谜 |
| `pixel-retro` | 像素复古 | 限色盘 · 硬边框 · 位移阴影 | 像素游戏 / Rogue |

## 应用（`styles/app/`）

| id | 名称 | 气质 | 适合 |
|---|---|---|---|
| `ios-clean` | 苹果极简 | iOS HIG · 分组列表 · 系统蓝 | C 端 App / 工具 |
| `material` | 谷歌质感 | Material 3 · tonal · 柔和阴影 | Android 向 / 效率工具 |
| `glass` | 玻璃拟态 | 毛玻璃 · 光斑底 · 内高光 | 创意官网 / 媒体 |
| `brutalist` | 新粗野主义 | 粗描边 · 硬阴影 · 撞色 | 创意工具 / 活动页 |
| `business` | 商务后台 | 企业蓝 · 高密度 · 表格优先 | SaaS / 看板 / B 端 |
| `ink-minimal` | 极简墨水 | 白底黑字 · 细线 · 大留白 | 内容产品 / 写作工具 |

## 如何扩展

1. 复制 `styles/_template.tokens.json` → `styles/custom/<你的id>.tokens.json`
2. 改 `id` 与全部色值/圆角/阴影/动效
3. spec 里写 `"style": "<你的id>"` 即可
4. （可选）在 `scripts/chrome-recipes.css` 加 `[data-style="<你的id>"] { ... }`
   做 token 表达不了的特化（纹理、特殊描边等）

## 选型口诀

- 用户点名 → 照办
- 有参考图 → 数 palette / 圆角 / 阴影密度，选最近的包；气质完全对不上就 custom
- 游戏没给风格 → 动作/养成 → `supercell` 或 `anime`；叙事/国风 → `ink-wash`；轻量 → `flat`；高级感 → `apple-game`
- 应用没给风格 → 工具 → `ios-clean`；B 端 → `business`；创意 → `brutalist` 或 `glass`；内容 → `ink-minimal`
