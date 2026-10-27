# 测试

## 快速

```bash
# 1) 示例构建 + 校验
node scripts/build.mjs --example game --out tests/artifacts/example-game.html
node scripts/build.mjs --example app  --out tests/artifacts/example-app.html
node scripts/validate.mjs tests/artifacts/example-game.html
node scripts/validate.mjs tests/artifacts/example-app.html

# 2) 浏览器冒烟（需 Python Playwright + Chromium）
python tests/e2e_qa.py tests/artifacts/example-game.html
python tests/e2e_qa.py tests/artifacts/example-app.html

# 3) 全风格矩阵（14 套）构建 + 校验 + 截图
node tests/matrix-build.mjs
python tests/matrix_shot.py

# 4) 游戏玩法、横竖屏与动画（需 Playwright + Chromium）
node scripts/build.mjs --spec examples/game-genres.spec.json --out tests/artifacts/game-genres.html
node scripts/validate.mjs tests/artifacts/game-genres.html
python tests/e2e_game_qa.py tests/artifacts/game-genres.html
```

## 产物位置

| 路径 | 内容 |
|---|---|
| `tests/artifacts/` | 示例 HTML |
| `tests/artifacts/matrix/` | 14 套风格的预览 HTML + spec |
| `tests/screenshots/` | e2e 截图（mobile/desktop） |
| `tests/screenshots/matrix/` | 每风格首屏截图 |
| `tests/screenshots/game-genres/` | 五屏在 390×844 / 844×390 下两个方向的 20 张截图 |

## 游戏状态回归

`e2e_game_qa.py` 使用独立浏览器页面执行 35 条用例，覆盖：

- 默认竖屏、显式横屏、右侧 Dock、窄屏单栏回退、`auto` 跟随真实视口旋转
- 头顶道具扣库存与 HP 结算、头顶栏不遮 Dock
- SLG 攻击/行军、非法目标不扣兵力、回合递增
- 卡牌费用、目标 HP、死亡目标迁移、抽牌与牌库扣减、费用不足负路径
- 扑克对子校验、提示、出牌移除、快速重复点击防重复结算
- 自走棋购买、三合升星、棋子数量守恒、人口上限、经验升级与战斗
- `prefers-reduced-motion` 下无无限装饰动画
- 每个用例的 `pageerror` / `console.error` 都必须为空

## 通过标准

- `validate.mjs`：0 error（PASS）
- `e2e_qa.py`：0 JS 报错、active 屏唯一、点击后不白屏、无横向溢出
- `e2e_game_qa.py`：35/35 通过，操作前后状态符合预期，截图目检核心操作可见
- `matrix-build.mjs`：14/14 ok
- 人工目检：各风格气质可区分；文字可读；无明显破版

## 自定义风格扩展测试

1. 复制 `styles/_template.tokens.json` → `styles/custom/<id>.tokens.json`
2. 把示例 spec 的 `style` 改成该 id
3. 重复上面 1/2 步
