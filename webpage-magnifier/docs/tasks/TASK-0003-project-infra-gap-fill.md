# TASK-0003 — 补齐项目基础设施四项缺失

**Task ID：** 0003  
**Slug：** project-infra-gap-fill  
**日期：** 2026-11-19  
**状态：** Completed  
**工作流：** single-branch  
**评审策略：** never（settings 配置，本次无需独立 Reviewer）

---

## 关联文档

| 类型 | 路径 |
|------|------|
| 原始需求记录 | [docs/people-requirements-record/0003-project-infra-gap-fill.md](../people-requirements-record/0003-project-infra-gap-fill.md) |
| 需求规格 | [docs/requirements/REQ-0003-project-infra-gap-fill.md](../requirements/REQ-0003-project-infra-gap-fill.md) |
| 执行计划 | [docs/execution-plans/PLAN-0003-project-infra-gap-fill.md](../execution-plans/PLAN-0003-project-infra-gap-fill.md) |
| 软件设计 | [docs/software-design/DESIGN-0003-project-infra-gap-fill.md](../software-design/DESIGN-0003-project-infra-gap-fill.md) |

---

## 实施概览

本任务属于 **项目基础设施层** 变更，不涉及运行时代码改动。在已有 Edge 浏览器扩展（manifest v3）基础上补齐四项缺失：README 详细文档、.gitignore、CHANGELOG、GitHub Actions Release Workflow。

---

## 变更文件清单

### 新增（4 项交付文件）

| # | 路径 | 类型 | 说明 |
|---|------|------|------|
| 1 | `c:\flying\ai-tools\webpage-magnifier\README.md` | Markdown | 详细中文文档：8 章节（简介/功能/安装/使用/开发指南/目录结构/已知限制/权限说明） |
| 2 | `c:\flying\ai-tools\webpage-magnifier\.gitignore` | Git 配置 | 6 类排除规则（打包产物/系统垃圾/IDE/user data/临时目录），不误排 `.agent-toolkit/` |
| 3 | `c:\flying\ai-tools\webpage-magnifier\CHANGELOG.md` | Markdown | Keep a Changelog 格式，v1.0.0 条目，与 manifest.json `version: "1.0.0"` 一致 |
| 4 | `c:\flying\ai-tools\.github\workflows\release-webpage-magnifier.yml` | YAML | monorepo 根 workflow，tag `webpage-magnifier-v*` 触发 Release，push main + paths 触发 build 检查 |

### 新增（4 份 Agent Toolkit 文档）

| # | 路径 | 类型 |
|---|------|------|
| 1 | `c:\flying\ai-tools\webpage-magnifier\docs\requirements\REQ-0003-project-infra-gap-fill.md` | 需求规格 |
| 2 | `c:\flying\ai-tools\webpage-magnifier\docs\execution-plans\PLAN-0003-project-infra-gap-fill.md` | 执行计划 |
| 3 | `c:\flying\ai-tools\webpage-magnifier\docs\software-design\DESIGN-0003-project-infra-gap-fill.md` | 软件设计 |
| 4 | `c:\flying\ai-tools\webpage-magnifier\docs\tasks\TASK-0003-project-infra-gap-fill.md` | 结项文档（本文件） |

### 修改

无。本次任务全部为新增文件。

---

## 验证结果

### 1. 文件存在性校验（PowerShell Test-Path）

| 文件 | 结果 |
|------|------|
| README.md | OK |
| .gitignore | OK |
| CHANGELOG.md | OK |
| release-webpage-magnifier.yml（monorepo 根） | OK |
| REQ-0003 / PLAN-0003 / DESIGN-0003 / TASK-0003 | OK × 4 |

### 2. YAML 语法校验（node + js-yaml，临时 npm install）

```
$ cd c:\flying\ai-tools
$ npm install --no-save --prefix .tmp-yaml js-yaml    # 成功
$ node -e "const yaml=require('./.tmp-yaml/...'); yaml.load(fs.readFileSync(...))"
YAML VALID
Name: Webpage Magnifier Release
Jobs: [ 'build', 'release' ]
On triggers push: {"branches":["main"],"paths":[6 项],"tags":["webpage-magnifier-v*"]}
Build runs-on: windows-latest
Release if: startsWith(github.ref, 'refs/tags/webpage-magnifier-v')
```

### 3. .gitignore 内容校验（PowerShell Select-String）

- `*.zip` 覆盖打包产物 ✓
- `.trae-html-share-packages/` 覆盖 popup.html 导出临时目录 ✓
- `Thumbs.db` / `.vscode/` / `node_modules/` 等均覆盖 ✓
- **未排除 `.agent-toolkit/` 整行** — 正确，保留已提交的模板配置 ✓

### 4. README 章节校验

8 个必需章节齐备：目录、功能列表、安装步骤、使用说明、开发指南、目录结构、已知限制、权限说明。权限说明与 manifest.json permissions + content.js/background.js 实际使用代码交叉验证一致。

### 5. CHANGELOG 格式校验

- `## [1.0.0] - 2026-11-19` 与 manifest.json `"version": "1.0.0"` 一致
- `### 新增 / 修复 / 重构 / 文档 / 安全` 分类符合 Keep a Changelog 格式

### 6. Workflow 命名冲突校验

monorepo 根 `.github/workflows/` 现有 10 个 yml 文件（含新增），文件名无一冲突。

---

## 自审结论

| 自审项 | 结果 |
|--------|------|
| README 内容与 manifest/源码一致性 | 通过（权限说明、功能列表、SPA 策略均从源码提取） |
| .gitignore 不误排 `.agent-toolkit/` | 通过（显式排除 .agent-toolkit 整行的检查结果为"否（正确）"） |
| workflow paths/tag 匹配规则 | 通过（paths 6 项精确 glob、tag `webpage-magnifier-v*` 与 release 条件对齐） |
| workflow zip 构建排除模板文件 | 通过（$files 数组仅含扩展 10 个必要文件） |
| YAML 语法 | 通过（运行时 js-yaml.load 无错误） |
| CHANGELOG 版本号对齐 | 通过（1.0.0 三方一致） |
| 交付文件数量 | 通过（7 个新增文件全部就位） |

---

## Git 与 Release 动作

| 动作 | 执行状态 | 说明 |
|------|----------|------|
| git add | 未执行 | 用户显式要求基础设施改动审阅后一起 commit |
| git commit | 未执行 | 同上；settings.json `gitAutomation.autoCommit: true` 但用户意图优先 |
| git push | 未执行 | 同上；`gitAutomation.autoPush: true` 但用户意图优先 |
| git tag | 未执行 | release workflow 为未来准备，当前不推送 tag |
| GitHub Release | 未触发 | 无 tag 推送，release job 不会运行 |
| Reviewer 独立评审 | 未执行 | `reviewerPolicy: never`，无需调用 |

---

## 剩余风险

| # | 风险 | 等级 | 说明 | 缓解建议 |
|---|------|------|------|----------|
| 1 | workflow 未在 GitHub Actions 环境实际跑过 | 低 | 本地 YAML 语法正确但 CI 环境差异未知 | 首次推送 tag `webpage-magnifier-v0.1.0-test` 做 dry-run |
| 2 | GitHub Release 创建权限依赖 repository settings | 低 | workflow release job 需要 `contents: write`（已在 permissions 中声明） | 推送 tag 后若 release 创建失败，检查 repo 的 workflow 权限 |
| 3 | .gitignore 的 `.trae/` / `.codebuddy/` / `.workbuddy/` 子目录级排除可能遗漏某些 user data 路径 | 极低 | 目前已排除已知的 user data 子目录 | 遇到新的临时目录再补充 |
| 4 | README 功能截图占位空 | 极低 | 用户标注可留空 | 实际有截图后在 `.screenshots/` 目录放图并替换 README 占位 |
