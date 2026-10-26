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
```

## 产物位置

| 路径 | 内容 |
|---|---|
| `tests/artifacts/` | 示例 HTML |
| `tests/artifacts/matrix/` | 14 套风格的预览 HTML + spec |
| `tests/screenshots/` | e2e 截图（mobile/desktop） |
| `tests/screenshots/matrix/` | 每风格首屏截图 |

## 通过标准

- `validate.mjs`：0 error（PASS）
- `e2e_qa.py`：0 JS 报错、active 屏唯一、点击后不白屏、无横向溢出
- `matrix-build.mjs`：14/14 ok
- 人工目检：各风格气质可区分；文字可读；无明显破版

## 自定义风格扩展测试

1. 复制 `styles/_template.tokens.json` → `styles/custom/<id>.tokens.json`
2. 把示例 spec 的 `style` 改成该 id
3. 重复上面 1/2 步
