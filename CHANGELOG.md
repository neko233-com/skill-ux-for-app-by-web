# Changelog

## 1.2.2 — 超深度验证发布

- 新增 `tests/verify-all.mjs`（19 项一键全链路）与 `tests/edge-cases.mjs`（18 项边界）
- 构建器：JSON 解析失败给中文错误；容忍 UTF-8 BOM；错误路径不产出残缺 HTML
- 弹窗图标改走 SVG sprite
- 文档一致性：AGENTS / SKILL / workflows/04 / tests/README 对齐
- 全部 demo 自包含校验（0 外链）、文案克制（0 「策划注 ·」）、133–237 KB

**验证**：verify-all 19/19 · edge 18/18 · matrix 14/14 · e2e×5 + modal + gameplay 35 用例全 PASS

## 1.2.1 / 1.2.0

- 弹窗 `detail`（道具栏 / 背包 / 入口可点）
- 默认草图 `renderMode`；高保真显式 `hi`
- 文案收敛（无策划注长句）

## 1.1.0

- Tween 引擎 + 16 动画 + stagger
- 状态四态 + state-switcher
- 内联 SVG 图标库 + 红点/徽标
- 草图模式、屏幕 transition、count-up、indeterminate 进度

## 1.0.0

- 首发：game/app 判别、14 风格包、确定性构建器、飞书安全校验、harness 安装文档
