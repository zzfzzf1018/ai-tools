# 0004 — 修复 Release workflow zip 目录结构

**日期：** 2026-11-19
**状态：** In Progress
**工作流：** single-branch
**评审策略：** never

## 用户原始请求

> Failed to load extension. File: ~\Downloads\webpage-magnifier-1.0.0 Error: Couldn't load icon icons/icon16.png specified in icons.

## 根因定位

workflow release-webpage-magnifier.yml 里的 build zip step：

```powershell
$files = @(
  "webpage-magnifier/manifest.json",
  "webpage-magnifier/icons/icon16.png",
  ...
)
Compress-Archive -Path $files -DestinationPath $zipPath -Force
```

PowerShell `Compress-Archive` 对**明确列出的文件路径**会**丢弃目录前缀**，zip 内部结构变成：

```
manifest.json
content.js
icon16.png    ← 没 icons/ 目录！
```

manifest.json 声明 `"16": "icons/icon16.png"`，解压后这个路径不存在 → Edge 加载扩展时报 Couldn't load icon。

## 修复方案

改用 staging 目录 + 目录级打包：

```powershell
$stageDir = Join-Path (Get-Location) "stage-webpage-magnifier"
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

# 逐个文件复制，用 -DestinationContainerPath 保留相对路径
Copy-Item "webpage-magnifier/manifest.json" $stageDir
Copy-Item "webpage-magnifier/content.js" $stageDir
...
Copy-Item "webpage-magnifier/icons" "$stageDir/icons" -Recurse

# 然后对 staging 目录打包，-Path $stageDir/* 会保留子目录结构
Compress-Archive -Path "$stageDir\*" -DestinationPath $zipPath -Force
```

这样 zip 内部结构变成正确的：

```
manifest.json
content.js
icons/icon16.png
icons/icon48.png
icons/icon128.png
...
```

解压后 manifest.json 在根目录，icons/ 子目录正确 → Edge 加载成功。

## 交付

- 修复 `.github/workflows/release-webpage-magnifier.yml` 的 Build release zip step
- 本地验证 zip 结构
- 重新打 tag 或让用户手动触发 workflow

## Git 权限

autoCommit: true, autoPush: true（已开）
