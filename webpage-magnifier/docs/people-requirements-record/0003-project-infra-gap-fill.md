# 0003 — 补充项目基础设施（文档、gitignore、GitHub Actions、Changelog）

**日期：** 2026-11-19
**状态：** In Progress
**工作流：** single-branch
**评审策略：** never

## 用户原始请求

> 我手动推送好了。我发现你没有详细文档，没有gitignore，没有自动创建github action自动发布 没有changelog

## 需求拆解

用户显式指出四项缺失：

| # | 缺失项 | 说明 |
|---|--------|------|
| 1 | 详细文档 | 当前只有 manifest/popup 内零散说明，缺少 README、安装指南、开发指南 |
| 2 | .gitignore | 根目录（webpage-magnifier 子目录）缺少 .gitignore，zip 产物和 IDE 垃圾混进了 commit |
| 3 | GitHub Actions 自动发布 | 当前 settings.json `releaseAutomation.githubActions: false`，tag 后无自动构建 Release zip 流程 |
| 4 | CHANGELOG | 当前没有版本变更日志 |

## GitHub Actions 放置决策（用户确认）

- workflow 放 **monorepo 根** `.github/workflows/`
- 用 `paths` / `paths-filter` 只在 `webpage-magnifier/` 目录变化或 tag 带 `webpage-magnifier-` 前缀时触发
- 自动构建 zip → 创建 GitHub Release

## 同步要更新 settings.json

- `releaseAutomation.githubActions`: false → true（用户显式要求自动发布）
- `gitAutomation` 三项已是 true（上次为 commit/push/tag 打开的）

## 交付文件清单（Coder 任务范围）

| 路径 | 说明 |
|------|------|
| `webpage-magnifier/README.md` | 详细文档：功能、安装、使用、开发、目录结构、权限说明 |
| `webpage-magnifier/.gitignore` | 排除 zip、IDE、临时文件、产物目录 |
| `webpage-magnifier/CHANGELOG.md` | v1.0.0 初始条目（feat/fix/docs/refactor 分类） |
| `<monorepo-root>/.github/workflows/release-webpage-magnifier.yml` | tag `webpage-magnifier-*` 触发 → 构建 zip → 创建 Release |

## Coder 四份文档共用前缀

`0003-project-infra`

## Git 权限

- autoCommit: true, autoPush: true, autoTag: true
- releaseAutomation.githubActions: **本次任务需更新为 true**
- 所有 Git 改动需要用户显式意图（已确认）
- Reviewer policy: never
