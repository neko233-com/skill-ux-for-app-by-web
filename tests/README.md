# 测试

## 一键全链路（推荐）

```bash
node tests/verify-all.mjs
node tests/edge-cases.mjs   # 构建器边界用例
```

覆盖：5 个示例 spec 构建+校验 · 6 个 demo 校验 · 14 风格矩阵 · 自定义风格 ·
默认草图 / 显式 hi · 文案克制 · 飞书自包含 · UTF-8 编码。

## 浏览器 E2E（需 Python Playwright + Chromium）

```bash
python tests/e2e_qa.py examples/demo-game-anime.html     # 通用冒烟
python tests/e2e_qa.py examples/demo-app-ios.html
python tests/e2e_qa.py examples/demo-app-sketch.html
python tests/e2e_qa.py examples/demo-app-features.html
python tests/modal_e2e.py                                 # 弹窗/道具栏
python tests/e2e_game_qa.py examples/demo-game-genres.html  # 玩法（35 用例）
```

## 矩阵与截图

```bash
node tests/matrix-build.mjs    # 14 风格构建+校验
python tests/matrix_shot.py    # 每风格首屏截图
```

## 产物位置

| 路径 | 内容 |
|---|---|
| `tests/artifacts/` | 中间产物 |
| `tests/screenshots/` | e2e 截图 |
| `tests/screenshots/matrix/` | 风格矩阵截图 |
| `tests/screenshots/game-genres/` | 玩法截图 |

## 通过标准

- `verify-all.mjs`：0 failed
- `e2e_qa.py` / `modal_e2e.py` / `e2e_game_qa.py`：全部 PASS
- 人工目检截图：风格可区分、无破版、文字可读

## 扩展风格测试

复制 `styles/_template.tokens.json` → `styles/custom/<id>.tokens.json`，
把任意 spec 的 `style` 改成该 id，重复上面流程。
