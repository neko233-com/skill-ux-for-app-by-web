# 安装到 Codex

Codex 的 skill 目录：`~/.codex/skills/<skill-id>/`

## 一键安装（Windows PowerShell）

```powershell
$src = "D:\Code\neko233-Projects\skill-ux-for-app-by-web"
$dst = "$env:USERPROFILE\.codex\skills\skill-ux-for-app-by-web"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item -Recurse -Force "$src\*" $dst
# 排除本地测试产物
Remove-Item -Recurse -Force "$dst\tests\artifacts","$dst\prototypes","$dst\node_modules" -ErrorAction SilentlyContinue
Write-Host "installed → $dst"
```

## macOS / Linux

```bash
SRC=~/path/to/skill-ux-for-app-by-web
DST=~/.codex/skills/skill-ux-for-app-by-web
mkdir -p "$DST"
rsync -a --exclude tests/artifacts --exclude prototypes --exclude node_modules "$SRC/" "$DST/"
```

## 从 git 安装

```bash
git clone https://github.com/neko233-com/skill-ux-for-app-by-web.git \
  ~/.codex/skills/skill-ux-for-app-by-web
```

## 使用

Codex 会读到根目录 `SKILL.md` 的 frontmatter（name/description）。
在对话里说「帮我做一个 XX 的交互原型」即可触发。
若未自动触发，可显式提及 skill 名 `skill-ux-for-app-by-web`。

## 依赖

- Node.js ≥ 18（必须，在 PATH 中）
- Python Playwright（可选，用于 QA）
