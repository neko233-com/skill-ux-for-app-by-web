# 工作流 03 · 组装与构建

**默认路径是脚本构建，不是手写 HTML。** 手写只有在 Node 不可用时才走降级。

## 脚本路径（推荐）

1. 把解析结果写成 `spec.json`（schema：`styles/SCHEMA.md`）
2. 构建：
   ```bash
   node scripts/build.mjs --spec <path/to/spec.json> --out <path/to/out.html>
   ```
   Windows / PowerShell / bash 通用。Node ≥ 18，零依赖。
3. 校验：
   ```bash
   node scripts/validate.mjs <path/to/out.html>
   ```
   必须 `PASS`。有 ERROR 就修 spec 再建，不要直接改产物 HTML。
4. 自测（有 Playwright 时，强烈建议）：
   见 `workflows/04-qa.md`。

## 降级路径（无 Node）

若环境确实没有 Node：
1. 读 `scripts/ux-core.css` + `scripts/chrome-recipes.css` + `scripts/ux-core.js`
2. 按 `styles/<kind>/<style>.tokens.json` 生成 `:root { --ux-*: ... }`
   （字段映射见 `scripts/build.mjs` 的 `tokensToCss`）
3. 按 SCHEMA 的 block 语义手写结构，类名必须使用 `.ux-*` 契约
4. 仍然跑 `validate` 的检查清单（可用人眼对照 `scripts/validate.mjs` 规则）
5. 交付前用浏览器打开一遍，确认无控制台报错

## 常见构建错误

| 报错 | 原因 | 修法 |
|---|---|---|
| `style "x" 未找到` | id 写错 / 放错目录 | 对 catalog；custom 放 `styles/custom/` |
| `screen id 重复` | id 照抄中文 | 改短英文 slug |
| `item.to 不存在` | 跳转目标漏建 screen | 补 screen 或改成 `act:toast` |
| `spec.kind 必填` | 忘了判别结果 | 按 detection 填 game/app |

## 产物放置

- 默认写到用户指定路径；未指定时写 `prototypes/<slug>-<style>.html`
- 不要覆盖用户的既有文件，除非用户明确要求
- 同一需求改需求后：**重建**，不要在旧 HTML 上打补丁
