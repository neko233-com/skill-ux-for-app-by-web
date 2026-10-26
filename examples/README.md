# 示例

| 文件 | 说明 |
|---|---|
| `game-anime.spec.json` | 游戏示例 spec（二次元，4 屏） |
| `app-ios-clean.spec.json` | 应用示例 spec（苹果极简，3 屏） |
| `demo-game-anime.html` | 上述游戏 spec 的构建产物 |
| `demo-app-ios.html` | 上述应用 spec 的构建产物 |
| `demo-game-custom.html` | 自定义风格包 `neko-crimson` 的产物（扩展演示） |

重新生成：

```bash
node scripts/build.mjs --spec examples/game-anime.spec.json --out examples/demo-game-anime.html
node scripts/build.mjs --spec examples/app-ios-clean.spec.json --out examples/demo-app-ios.html
```

浏览器直接打开 `.html` 即可点击体验。
