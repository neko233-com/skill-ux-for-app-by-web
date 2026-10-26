# 示例

| 文件 | 说明 |
|---|---|
| `game-anime.spec.json` | 游戏示例 spec（二次元，4 屏） |
| `app-ios-clean.spec.json` | 应用示例 spec（苹果极简，3 屏） |
| `app-features.spec.json` | 能力展示：动效 / 状态切换 / 图标 / 红点 |
| `app-features.sketch.spec.json` | 同上 + `renderMode: sketch` 草图模式 |
| `demo-game-anime.html` | 游戏产物 |
| `demo-app-ios.html` | 应用产物 |
| `demo-app-features.html` | 能力展示产物 |
| `demo-app-sketch.html` | 草图模式产物 |
| `demo-game-custom.html` | 自定义风格包 `neko-crimson` 扩展演示 |

重新生成：

```bash
node scripts/build.mjs --spec examples/game-anime.spec.json --out examples/demo-game-anime.html
node scripts/build.mjs --spec examples/app-features.spec.json --out examples/demo-app-features.html
node scripts/build.mjs --spec examples/app-features.sketch.spec.json --out examples/demo-app-sketch.html
```

浏览器直接打开 `.html` 即可点击体验。
