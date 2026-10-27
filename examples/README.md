# 示例

| spec | 产物 | 说明 |
|---|---|---|
| `game-anime.spec.json` | `demo-game-anime.html` | 游戏主城（二次元，4 屏，道具栏弹窗） |
| `game-custom-neko.spec.json` | `demo-game-custom.html` | 自定义风格包 `neko-crimson` |
| `game-genres.spec.json` | `demo-game-genres.html` | 玩法矩阵（SLG/卡牌/自走棋/扑克） |
| `app-ios-clean.spec.json` | `demo-app-ios.html` | 应用工作台（苹果极简，3 屏） |
| `app-features.spec.json` | `demo-app-features.html` | 动效/状态/图标/红点 |
| `app-features.sketch.spec.json` | `demo-app-sketch.html` | 草图模式（默认） |

重新生成：

```bash
node scripts/build.mjs --spec examples/game-anime.spec.json --out examples/demo-game-anime.html
```

浏览器直接打开 `.html` 即可点击体验。