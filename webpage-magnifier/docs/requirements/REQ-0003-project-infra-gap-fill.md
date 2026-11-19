# REQ-0003 — 补齐项目基础设施四项缺失

**Task ID：** 0003  
**Slug：** project-infra-gap-fill  
**日期：** 2026-11-19  
**关联需求记录：** [docs/people-requirements-record/0003-project-infra-gap-fill.md](../people-requirements-record/0003-project-infra-gap-fill.md)

---

## 1. 背景与问题

`webpage-magnifier`（网页区域放大器）是 Edge 浏览器扩展项目（manifest v3），已具备可用的核心功能代码（选区放大、拖拽、缩放、层级切换、快捷键 Ctrl+Shift+M），但项目层面的基础设施文档与自动化存在四项缺失：

| # | 缺失项 | 现状 |
|---|--------|------|
| 1 | 详细项目文档（README） | 项目根目录无 README.md，新接手者难以理解扩展结构与开发要点 |
| 2 | .gitignore | 根目录缺少，已有 `webpage-magnifier.zip`、`.DS_Store`、IDE 配置、`.trae-html-share-packages/` 等非源码文件存在提交风险 |
| 3 | GitHub Actions Release workflow | monorepo 根 `.github/workflows/` 已有 9 个子项目 workflow，但没有 webpage-magnifier 对应的自动打包发布流程 |
| 4 | CHANGELOG | 无 Keep a Changelog 格式的版本变更日志 |

## 2. 编号需求

### REQ-1：编写项目 README.md

- **REQ-1.1** 必须在项目根目录 `c:\flying\ai-tools\webpage-magnifier\README.md` 创建文件，语言为中文
- **REQ-1.2** README 必须包含以下章节：项目简介（标注 v1.0.0）、功能列表、安装步骤、使用说明、开发指南、目录结构表、已知限制、权限说明
- **REQ-1.3** 功能列表需覆盖：选区放大、缩放滑块、拖拽移动、层级切换（置顶/置底）、快捷键 Ctrl+Shift+M
- **REQ-1.4** 开发指南需说明：manifest v3 结构、content/background/popup 三部分职责、消息链路协议（popup↔content、content 广播）、SPA/iframe 兼容策略（hook history、all_frames: false、顶层 frame 守卫）
- **REQ-1.5** 目录结构表需列出扩展核心文件与各自职责
- **REQ-1.6** 已知限制需覆盖：canvas 空白选区、跨域 iframe 内容无法克隆、快照不随原页面更新
- **REQ-1.7** 权限说明需分别解释 storage、activeTab、scripting、host_permissions（all_urls）四项的用途

### REQ-2：编写 .gitignore

- **REQ-2.1** 在项目根目录创建 `.gitignore`
- **REQ-2.2** 必须排除的产物：`*.zip`、`*.crx`、`*.pem` 打包产物
- **REQ-2.3** 必须排除的系统垃圾：`.DS_Store`、`Thumbs.db`、`ehthumbs.db`
- **REQ-2.4** 必须排除的 IDE/编辑器：`.vscode/`、`.idea/`、`.trae/`（临时 user data）、`.codebuddy/`、`.workbuddy/` 的 user data（注意：模板文件通常要提交，实际使用时按子目录细化）
- **REQ-2.5** 必须排除的临时目录：`.trae-html-share-packages/`、`node_modules/`
- **REQ-2.6** **必须保留** `.agent-toolkit/` 下的配置文件（已在 git 中，不要误排除）

### REQ-3：编写 CHANGELOG.md

- **REQ-3.1** 在项目根目录创建 `CHANGELOG.md`，采用 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式
- **REQ-3.2** 版本号标注 `v1.0.0 (2026-11-19)`，与 manifest.json 版本一致
- **REQ-3.3** 条目分类至少包含 feat/fix/docs/refactor，可选 security
- **REQ-3.4** 条目内容需准确反映 v1.0.0 初始发布的实际功能与架构决策

### REQ-4：创建 GitHub Actions Release Workflow

- **REQ-4.1** workflow 文件位置为 **monorepo 根** `.github/workflows/release-webpage-magnifier.yml`（不在子目录内）
- **REQ-4.2** workflow 命名不与现有 9 个 workflow 冲突，文件名 `release-webpage-magnifier.yml`
- **REQ-4.3** 触发条件必须支持：`push` tag `webpage-magnifier-v*`、`push` to `main` 且 `webpage-magnifier/**/*.{js,json,css,html,md,png}` 变更
- **REQ-4.4** build job 必须检出代码，使用 PowerShell `Compress-Archive`（与 pack.ps1 一致）构建 zip
- **REQ-4.5** zip 文件必须排除 `.agent-toolkit/`、`.trae/`、`.github/`、`.codebuddy/`、`.workbuddy/`、`docs/agent-toolkit.md`、`scripts/doctor*.ps1` 等模板文件，只保留扩展必要文件
- **REQ-4.6** zip 文件名格式：`webpage-magnifier-<version>.zip`
- **REQ-4.7** release job 必须在 tag 触发时创建 GitHub Release，title 为 `webpage-magnifier v<version>`，上传 zip 资产
- **REQ-4.8** workflow YAML 语法必须正确，需通过 node + js-yaml 或等效方式校验

## 3. 假设

1. monorepo 根已有 `.github/workflows/` 目录（已确认真实存在且含 9 个 yml）
2. 扩展核心源码不再变动，本次任务仅涉及基础设施层
3. 用户会审阅所有改动后手动执行 commit，settings 中 autoCommit/autoPush/autoTag 虽为 true 但不自动触发
4. 现有 9 个 workflow 可作为参照模板（`web-markdown-ext-release.yml` 结构最接近）
5. 项目目录下存在 `.trae-html-share-packages/popup.html.zip` 和 `webpage-magnifier.zip` 属于应被 gitignore 的临时产物

## 4. 验收标准

- [ ] README.md 存在于 `c:\flying\ai-tools\webpage-magnifier\README.md`，包含所有 8 个必需章节，内容与 manifest.json + 源码一致
- [ ] .gitignore 存在于 `c:\flying\ai-tools\webpage-magnifier\.gitignore`，覆盖全部 6 项排除规则且不误排 `.agent-toolkit/`
- [ ] CHANGELOG.md 存在于 `c:\flying\ai-tools\webpage-magnifier\CHANGELOG.md`，Keep a Changelog 格式，v1.0.0 条目与 manifest 版本匹配
- [ ] release-webpage-magnifier.yml 存在于 `c:\flying\ai-tools\.github\workflows\release-webpage-magnifier.yml`，YAML 语法校验通过，不与现有 workflow 重名
- [ ] 四个 REQ/PLAN/DESIGN/TASK 文档全部创建，Task ID 均为 0003
- [ ] 所有文件路径均为绝对路径，无相对路径或路径拼接错误
