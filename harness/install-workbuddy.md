# 安装到 WorkBuddy

WorkBuddy 的用户 skill 目录：`~/.workbuddy/skills/<skill-id>/`

（本仓库 SKILL.md 的 frontmatter 已兼容 WorkBuddy：含 `description_zh` /
`description_en` / `version` / `license` / `metadata`。）

## 一键安装（Windows PowerShell）

```powershell
$src = "D:\Code\neko233-Projects\skill-ux-for-app-by-web"
$dst = "$env:USERPROFILE\.workbuddy\skills\skill-ux-for-app-by-web"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item -Recurse -Force "$src\*" $dst
Remove-Item -Recurse -Force "$dst\tests\artifacts","$dst\prototypes","$dst\node_modules" -ErrorAction SilentlyContinue
Write-Host "installed → $dst"
```

## macOS / Linux

```bash
SRC=~/path/to/skill-ux-for-app-by-web
DST=~/.workbuddy/skills/skill-ux-for-app-by-web
mkdir -p "$DST"
rsync -a --exclude tests/artifacts --exclude prototypes --exclude node_modules "$SRC/" "$DST/"
```

## 从 git 安装

```bash
git clone https://github.com/neko233-com/skill-ux-for-app-by-web.git \
  ~/.workbuddy/skills/skill-ux-for-app-by-web
```

## 使用与重启

- 放好后**重启 WorkBuddy**（或新开会话）让 skill 被索引
- 对话中描述需求即可；也可显式说「使用 skill-ux-for-app-by-web」
- 若你的 WorkBuddy 版本使用 marketplace 布局，把整个文件夹
  拷到 `~/.workbuddy/skills-marketplace/skills/skill-ux-for-app-by-web`
  效果等同

## 依赖

- Node.js ≥ 18
- Python Playwright（可选）
