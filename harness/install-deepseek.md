# 安装到 DeepSeek（及读取 AGENTS.md 的 harness）

DeepSeek 系 harness 没有统一的全局 skills 目录约定，推荐用
**项目根 `AGENTS.md`** 或 **项目内 skill 文件夹** 两种方式接入。
本仓库根目录的 `AGENTS.md` 就是给这类 harness 的入口（内容契约与 `SKILL.md` 一致）。

## 方式 A · 放进当前项目（推荐）

把仓库克隆到你的工作区，例如：

```
your-project/
  AGENTS.md          ← 从本仓库复制，或直接指向本仓库的 AGENTS.md
  skills/
    skill-ux-for-app-by-web/   ← 整个仓库拷进来
```

在 DeepSeek 的项目上下文里，harness 会读到 `AGENTS.md`，
其中写明「执行 SKILL.md 流程」，进而读取 `skills/skill-ux-for-app-by-web/SKILL.md`。

若你的 DeepSeek 版本直接读 `SKILL.md`（Claude 风格），把仓库内容
拷到它约定的 skills 目录即可，结构无需改动。

## 方式 B · 系统提示词挂载

在自定义系统提示词 / 指令里加一段：

```
当需要生成可交互 UX 原型时，阅读并严格执行
<repo>/SKILL.md 的 6 步流程（解析→判别→风格→spec→build→QA）。
构建命令：
  node <repo>/scripts/build.mjs --spec <spec> --out <out>
  node <repo>/scripts/validate.mjs <out>
```

`<repo>` 换成实际绝对路径。

## 方式 C · 直接粘贴 SKILL.md 全文

单次会话内，把 `SKILL.md` 全文贴进对话作为指令。
注意：这种方式没有 `scripts/` 与 `styles/` 时，只能走
`workflows/03-compose.md` 的降级手写路径，稳定性下降 ——
**优先 A / B，保证脚本可执行**。

## 依赖

- Node.js ≥ 18（DeepSeek 调用本机 shell 时可用即可）
- Python Playwright（可选）
