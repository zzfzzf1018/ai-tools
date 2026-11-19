# Agent Toolkit

## Overview

This repository contains a reusable coding-agent workflow for GitHub Copilot, WorkBuddy, and TRAE: workspace instructions, an Init agent and supporting skill, an Orchestrator skill, a Coder agent, and a read-only Reviewer whose use is controlled by project settings.

本仓库包含可复用的 AI 编码工作流，同时支持 GitHub Copilot、WorkBuddy 和 TRAE：工作区指令、Init Agent 及其 Skill、Orchestrator Skill、Coder Agent，以及使用方式由项目设置控制的只读 Reviewer Agent。

## Install / 安装

### One-click Windows launcher / Windows 一键启动器

On Windows, double-click the repository-root `install-agent-toolkit.cmd` and enter the new or existing project directory. A path containing spaces may be typed with or without surrounding quotes. The launcher requires PowerShell 7 (`pwsh.exe`) available on `PATH`, resolves the installer relative to the launcher (not the current working directory), reports success or failure, and pauses so the result remains visible. It delegates to `scripts/install-agent-toolkit.ps1`; all installer safety checks remain in force.

在 Windows 上，双击仓库根目录中的 `install-agent-toolkit.cmd`，输入新建或已有项目目录。包含空格的路径可以带或不带外层引号。启动器要求 `PATH` 中可找到 PowerShell 7（`pwsh.exe`），根据启动器自身位置定位安装器（与当前工作目录无关），显示成功或失败结果并暂停，以便查看输出。它会调用 `scripts/install-agent-toolkit.ps1`，安装器原有安全检查均保持有效。

### Direct PowerShell install / PowerShell 直接安装

Run from this repository with PowerShell 7 or later:

```powershell
pwsh -NoProfile -File .\scripts\install-agent-toolkit.ps1 -TargetPath "C:\work\my-project"
```

Preview first with:

```powershell
pwsh -NoProfile -File .\scripts\install-agent-toolkit.ps1 -TargetPath "C:\work\my-project" -DryRun
```

The Windows launcher is also included in the toolkit install mapping, so an installed toolkit can be launched the same way.

Windows 启动器也包含在工具包安装映射中，因此安装后的工具包也可用相同方式启动。

Source installs require GitVersion 6.4.0 and Git history. Release ZIPs include GitVersion-derived `.agent-toolkit/package-version.json` and do not require GitVersion. Package metadata hashes cover the mapping and its source files; modified, missing or unverifiable package inputs are rejected before target writes. These hashes detect changes but are not independent provenance authentication. Older ZIPs without hashes must be replaced with a current package. Changes to source-tree files mark the install `partial`; the manifest distinguishes completed and requested versions and commits, so conflicts or interrupted writes do not claim a complete new version.

源码安装需要 GitVersion 6.4.0 和 Git 历史。Release ZIP 包含 GitVersion 生成的 `.agent-toolkit/package-version.json`，无需安装 GitVersion。包元数据哈希覆盖映射及其源文件；包输入被修改、缺失或无法验证时，在写入目标前拒绝。这些哈希用于检测更改，不是独立的来源认证。没有哈希的旧 ZIP 必须替换为当前安装包。源码树文件有未提交修改时安装标记为 `partial`；清单区分已完成及尝试安装的版本和提交，因此冲突或中断写入不会声称新版本已完整安装。

### Upgrade and release / 升级与发布

```powershell
pwsh -NoProfile -File C:\work\my-project\scripts\upgrade-agent-toolkit.ps1
```

The installed upgrader selects the latest stable GitHub Release from this repository and verifies the stable tag, asset name, package metadata and safe archive paths before calling the local installer. It preserves settings, backups, conflict and reparse protections, and refuses known downgrades. For private repositories, supply a token with contents read access via `GH_TOKEN`, then `GITHUB_TOKEN`, or a noninteractive Git credential helper. Credentials are not stored in the project or forwarded to redirected asset hosts. With no credential it attempts anonymous access. A 404 may mean either no stable Release or insufficient access.

已安装的升级器选择本仓库最新正式 GitHub Release，验证正式标签、资源名称、包元数据和安全归档路径后调用本地安装器。它保留设置、备份、冲突与重解析点保护，并拒绝已知降级。私有仓库需要具有内容读取权限的令牌：按 `GH_TOKEN`、`GITHUB_TOKEN`、非交互式 Git 凭据管理器的顺序读取。凭据不会保存在项目内，也不会转发给重定向的资产主机。没有凭据时尝试匿名访问。404 可能表示没有正式 Release，也可能表示权限不足。

For offline use, supply a separately obtained trusted stable ZIP; the older `-ReleaseJsonPath` plus `-ArchivePath` form remains available:

离线使用时提供单独获取的可信正式 ZIP；旧的 `-ReleaseJsonPath` 加 `-ArchivePath` 形式仍可使用：

```powershell
pwsh -NoProfile -File C:\work\my-project\scripts\upgrade-agent-toolkit.ps1 -ArchivePath C:\downloads\agent-toolkit.zip
```

Inspect legacy or partial installations before opting in with `-AllowUnknownVersion`. If the version matches but the installed commit differs or is unknown, inspect it and explicitly add `-AllowSameVersionDifferentCommit`; neither switch permits a known downgrade. Older installed upgraders cannot accept newly added package files: bootstrap with both the upgrader and installer from a trusted current checkout or extracted package and specify `-TargetPath C:\work\my-project`. Offline metadata does not prove that the ZIP is latest. HTTPS and package hashes do not independently authenticate provenance.

旧版或部分完成的安装需先检查，再通过 `-AllowUnknownVersion` 显式选择继续。版本相同但安装提交不同或未知时，检查后还需显式添加 `-AllowSameVersionDifferentCommit`；两个开关均不允许已知降级。旧版升级器无法接受新增的安装包文件：请使用可信的当前源码树或解压包中的升级器及安装器进行首次升级，并指定 `-TargetPath C:\work\my-project`。离线元数据不能证明 ZIP 是最新版本；HTTPS 和包内哈希不能独立验证来源。

For example, bootstrap from a trusted current checkout: / 例如，从可信的当前源码树执行首次升级：

```powershell
pwsh -NoProfile -File C:\trusted\agent-toolkit\scripts\upgrade-agent-toolkit.ps1 -TargetPath C:\work\my-project -ArchivePath C:\downloads\agent-toolkit.zip
```

The read-only doctor checks manifest state, source identity, settings and managed-file drift. It does not disclose settings values; it returns exit code 1 when issues need attention. / 只读 doctor 检查清单状态、来源身份、设置和托管文件差异，不显示设置值；发现需要处理的问题时返回退出码 1。

```powershell
pwsh -NoProfile -File C:\work\my-project\scripts\doctor-agent-toolkit.ps1
pwsh -NoProfile -File C:\work\my-project\scripts\doctor-agent-toolkit.ps1 -Json
```

To package a Git checkout locally, run `pwsh -NoProfile -File .\scripts\package-agent-toolkit.ps1 -OutputDirectory <directory>`. CI uploads the versioned ZIP on ordinary runs; on a pushed stable tag it checks GitVersion and main ancestry, then publishes after validation with GitHub-generated release notes. Prerelease tags do not publish. No release is created merely by running the local packager.

在 Git 源码树中本地打包，可运行 `pwsh -NoProfile -File .\scripts\package-agent-toolkit.ps1 -OutputDirectory <directory>`。普通 CI 会上传版本化 ZIP；推送正式标签时，CI 检查 GitVersion 和 main 历史，验证通过后发布并使用 GitHub 自动生成的 Release Notes。预发布标签不会触发发布。仅运行本地打包器不会创建 Release。

The target may be new or existing. First install creates `.agent-toolkit/settings.json` from the uninitialized template. Workspace instructions check settings automatically before every task: missing settings or `initialized: false` invokes Init before ordinary feature work, without requiring an explicit command; malformed or schema-invalid settings stop with an explicit error.

目标目录可以是新目录或已有目录。首次安装会从未初始化模板创建 `.agent-toolkit/settings.json`。每项任务开始时，工作区指令会自动检查设置：文件缺失或 `initialized: false` 时，在普通功能开发前自动调用 Init，无需用户显式调用命令；JSON 格式错误或不符合 Schema 时会明确报错并停止。

## Installed layout / 安装后的目录结构

A single canonical source publishes the same instructions/prompts, agents, and skills to every supported host, so no content is maintained three times. Each entry in `.agent-toolkit/install-files.json` declares either one `target` or a `targets` array; a target may carry `frontmatter` overrides, and a `null` override removes a key that only one host understands. The installer derives the host-specific header while copying the shared body byte for byte.

一份源文件会同时发布到所有受支持的宿主，指令/提示词、智能体与技能都不需要维护三遍。`.agent-toolkit/install-files.json` 中的每个条目可以声明单个 `target`，也可以声明 `targets` 数组；每个目标可携带 `frontmatter` 覆盖项，取值为 `null` 的覆盖项用于删除仅某个宿主才认识的字段。安装器在复制共享正文时，同时生成目标宿主所需的文件头。

```text
<project>/
├── AGENTS.md                            # Shared workspace rules (root-level, tool-neutral)
├── .github/                             # GitHub Copilot
│   ├── copilot-instructions.md
│   ├── agents/*.agent.md
│   ├── skills/<name>/SKILL.md
│   └── prompts/<name>.prompt.md
├── .codebuddy/                          # WorkBuddy / CodeBuddy project config
│   ├── rules/agent-toolkit/RULE.mdc     # alwaysApply: true, enabled: true
│   ├── agents/<name>.md
│   ├── skills/<name>/SKILL.md
│   └── commands/<name>.md
├── .workbuddy/                          # WorkBuddy Desktop project skills
│   └── skills/<name>/SKILL.md
├── .trae/                               # TRAE
│   ├── rules/agent-toolkit.md           # alwaysApply: true
│   ├── agents/<name>.md
│   ├── skills/<name>/SKILL.md
│   └── commands/<name>.md
├── .agent-toolkit/                      # Settings, install manifest, mapping, backups
├── docs/agent-toolkit.md
├── install-agent-toolkit.cmd
└── scripts/install-agent-toolkit.ps1
```

### Content coverage / 内容覆盖

| Content / 内容 | Canonical source / 单一源文件 | GitHub Copilot | WorkBuddy | TRAE |
| --- | --- | --- | --- | --- |
| Instructions and prompts / 指令与提示词 | `.github/copilot-instructions.md`, `.github/prompts/*.prompt.md` | `copilot-instructions.md`, `prompts/*.prompt.md` | `AGENTS.md`, `.codebuddy/rules/agent-toolkit/RULE.mdc`, `.codebuddy/commands/*.md` | `.trae/rules/agent-toolkit.md`, `.trae/commands/*.md` |
| Agents / 智能体 | `.github/agents/*.agent.md` | `.github/agents/*.agent.md` | `.codebuddy/agents/*.md` | `.trae/agents/*.md` |
| Skills / 技能 | `.github/skills/<name>/SKILL.md` | `.github/skills/<name>/SKILL.md` | `.codebuddy/skills/<name>/SKILL.md`, `.workbuddy/skills/<name>/SKILL.md` | `.trae/skills/<name>/SKILL.md` |

All three content types therefore have a native entry point on all three hosts. The two canonical prompts (`agent-toolkit-init`, `agent-toolkit-orchestrator`) are installed unchanged as Copilot prompt files and as slash commands for WorkBuddy and TRAE; the host copies drop Copilot-only `mode`/`tools` keys and TRAE commands gain the required `name`.

因此三类内容在三个宿主上都有原生入口。两份 canonical prompt（`agent-toolkit-init`、`agent-toolkit-orchestrator`）作为 Copilot prompt 文件原样安装，并作为 WorkBuddy 与 TRAE 的斜杠命令安装；宿主副本会删除 Copilot 专属的 `mode`/`tools` 键，TRAE 命令额外补上必需的 `name`。

| Host / 宿主 | Entry points / 生效入口 | Notes / 说明 |
| --- | --- | --- |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/agents/*.agent.md`, `.github/skills/<name>/SKILL.md`, `.github/prompts/*.prompt.md` | Uses the Copilot agent, skill, and prompt formats unchanged; no extra configuration. 直接使用 Copilot 的 agent、skill 与 prompt 格式，无需额外配置。 |
| WorkBuddy | `.codebuddy/rules/agent-toolkit/RULE.mdc`, `.codebuddy/agents/*.md`, `.codebuddy/skills/<name>/SKILL.md`, `.codebuddy/commands/*.md`, `.workbuddy/skills/<name>/SKILL.md`, `AGENTS.md` | `RULE.mdc` carries `alwaysApply: true` and `enabled: true`, so the rules load in every session. The root `AGENTS.md` is loaded only while the project has no `CODEBUDDY.md`, so the rule file is the always-on path. Project subagents live in `.codebuddy/agents/` and require no host switch. `.codebuddy/skills/` is the CodeBuddy/CLI project-level skill path; `.workbuddy/skills/` is the WorkBuddy Desktop project-level path, so both are installed to cover either runtime. `RULE.mdc` 带有 `alwaysApply: true` 与 `enabled: true`，每次会话都会加载规则。根目录 `AGENTS.md` 仅在项目没有 `CODEBUDDY.md` 时才会被加载，所以常驻路径是规则文件。项目子代理位于 `.codebuddy/agents/`，无需宿主开关。`.codebuddy/skills/` 是 CodeBuddy/CLI 的项目级技能路径，`.workbuddy/skills/` 是 WorkBuddy Desktop 的项目级技能路径，两者都安装以覆盖不同运行时。 |
| TRAE | `.trae/rules/agent-toolkit.md`, `.trae/agents/<name>.md`, `.trae/skills/<name>/SKILL.md`, `.trae/commands/<name>.md` | The rule file carries `alwaysApply: true`. Subagents live under `.trae/agents/` and require the host switch `Settings > Beta > Subagents > Enable Subagents Directory`. Root `AGENTS.md` additionally requires the TRAE import switch `Settings > Rules > Include AGENTS.md in context`; the always-applied rule file does not. 规则文件带有 `alwaysApply: true`；子代理位于 `.trae/agents/`，需要在宿主中打开 `设置 > Beta > Subagents > 启用子代理目录` 开关。根目录 `AGENTS.md` 还需要打开 `设置 > 规则 > 将 AGENTS.md 包含在上下文中` 才会被读取，常驻规则文件不受此开关影响。 |

Host-specific frontmatter is generated, not authored twice. TRAE and WorkBuddy subagent names are converted to kebab-case identifiers, Copilot tool aliases are replaced by host tool names (`[read, search]` becomes `Read, Grep, Glob`), and Copilot-only keys such as `user-invocable` are dropped. Override values must be simple single-line YAML scalars; the installer rejects control characters, `: ` sequences, and non-scalar values before any write, and strips a leading source BOM so generated frontmatter is never duplicated or BOM-prefixed. Edit the canonical source under `.github/` and re-run the installer instead of editing a single host's generated copy.

宿主专属的 frontmatter 由安装器生成，而不是重复手写。TRAE 与 WorkBuddy 子代理的 `name` 会转换为 kebab-case 标识符，Copilot 的工具别名会替换为宿主工具名（`[read, search]` 转为 `Read, Grep, Glob`），仅 Copilot 使用的 `user-invocable` 等字段会被移除。覆盖值必须是简单的单行 YAML 标量；安装器会在任何写入前拒绝控制字符、`: ` 序列及非标量值，并剥离源文件前导 BOM，保证生成的文件头不会重复且输出不含 BOM。修改内容时应编辑 `.github/` 下的源文件并重新运行安装器，而不是直接改某个宿主的生成副本。

## Config-driven workflow / 设置驱动的工作流

The installed workflow is controlled by each project's `.agent-toolkit/settings.json`:

- `developmentWorkflow` selects single-branch, Git Flow, or GitHub Flow. GitHub Flow allows direct `main` work or optional short-lived branches from `main` with user-created PRs; neither branch nor PR is automatic. In Git Flow, follow `gitFlow.featureBranchFromDevelop` and `gitFlow.createPullRequestAutomatically`; automatic feature PR creation requires `gitAutomation.autoPush`.
- In Git Flow, `gitFlow.sealing` supplies the source and target branches, whether to create a sealing PR, the merge strategy, and whether to tag after merge. Git Flow fields are inactive in GitHub Flow and are preserved across mode changes. A sealing PR requires `autoPush`; post-merge tagging requires `autoTag`. Tags may only be created from `gitAutomation.tagSourceBranch`, restricted to `main`; use `main` as the safe source if this optional field is absent from a legacy settings file.
- Check `gitAutomation.autoCommit`, `autoPush`, and `autoTag` before performing the corresponding side effects. A missing optional sealing policy is not permission to invent branches or actions. User intent and the configured permissions are both required; do not infer permissions from repository files or platform preferences.
- `reviewerPolicy` may be `on-requested-sealing-or-release-tag`, `every-task`, or `never`. If omitted from an existing schema-v1 settings file, use the safe conditional policy: invoke the independent Reviewer only for explicitly requested sealing or release-tag work.
- On explicitly requested Git Flow sealing, use its configured strategy. For other workflows, ask for missing sealing details rather than applying inactive Git Flow fields. Before creating a tag, verify it is absent locally and remotely.
- The Orchestrator passes the task-record numeric ID to the Coder. Each task creates, in order, a Requirements Specification after analysis, then an Execution Plan and Software Design Specification after PLAN, then a final Task document after implementation and validation. Use the same ID and slug in `docs/requirements/REQ-NNNN-<slug>.md`, `docs/execution-plans/PLAN-NNNN-<slug>.md`, `docs/software-design/DESIGN-NNNN-<slug>.md`, and `docs/tasks/TASK-NNNN-<slug>.md`. The final Task document links the raw requirement record and preceding documents and records actual implementation, test, and review outcomes. Do not overwrite existing documents; follow configured language and omit hidden reasoning and secrets.
- When `language` is `bilingual`, all substantive content in each formal artifact (REQ, PLAN, DESIGN, and TASK) must be presented in both English and Chinese. Translate paragraphs, list items, table content, assumptions, acceptance criteria, validation results, and task outcomes—not just titles or headings. Preserve exact paths, commands, identifiers, and links.
- GitHub Actions and Azure Pipelines preferences do not by themselves define a release workflow. Ask for project-specific build, artifact, and release-trigger details first.

安装后的工作流由每个项目的 `.agent-toolkit/settings.json` 控制：

- `developmentWorkflow` 选择单分支、Git Flow 或 GitHub Flow。GitHub Flow 允许直接在 `main` 开发，或按需从 `main` 创建短期分支并由用户手动创建 PR；不自动创建分支或 PR。Git Flow 模式下，遵循 `gitFlow.featureBranchFromDevelop` 和 `gitFlow.createPullRequestAutomatically`；自动创建功能 PR 必须具有 `gitAutomation.autoPush` 权限。
- Git Flow 中，`gitFlow.sealing` 提供封板源/目标分支、是否创建封板 PR、合并策略以及合并后是否打 tag。Git Flow 字段在 GitHub Flow 中不生效，切换模式时予以保留。封板 PR 需要 `autoPush`；合并后打 tag 需要 `autoTag`。Tag 只能从 `gitAutomation.tagSourceBranch` 指定的分支创建，该字段仅允许 `main`；旧设置缺少此可选字段时，安全来源为 `main`。
- 执行对应操作前检查 `gitAutomation.autoCommit`、`autoPush` 和 `autoTag`。缺少可选封板策略不代表可以自行推断分支或操作；必须同时具备用户意图和配置权限，不得从仓库文件或平台偏好推断权限。
- `reviewerPolicy` 可设为 `on-requested-sealing-or-release-tag`、`every-task` 或 `never`。已有 schema-v1 设置未包含该字段时，安全默认策略是仅在用户明确要求封板或创建 Release Tag 时调用独立 Reviewer。
- 用户明确要求 Git Flow 封板时使用其配置的策略。其他工作流应询问缺失的封板细节，不应套用未生效的 Git Flow 字段。创建 tag 前须确认本地和远程均不存在。
- Orchestrator 会将任务需求记录的数字 ID 传给 Coder。每项任务按顺序创建：分析后创建需求说明书，PLAN 之后创建执行计划和软件设计说明书，实现与验证后创建最终 Task 文档。四份文档在 `docs/requirements/REQ-NNNN-<slug>.md`、`docs/execution-plans/PLAN-NNNN-<slug>.md`、`docs/software-design/DESIGN-NNNN-<slug>.md` 和 `docs/tasks/TASK-NNNN-<slug>.md` 中使用相同 ID 和 slug。最终 Task 文档链接原始需求记录和前三份文档，并记录实际实现、测试及 Review 结果。不得覆盖已有文档；遵循已配置语言，且不得记录隐藏推理或机密信息。
- 当 `language` 为 `bilingual` 时，每份正式文档（REQ、PLAN、DESIGN 和 TASK）的所有实质性内容都必须同时以英文和中文呈现。段落、列表项、表格内容、假设、验收标准、验证结果和任务结论都要翻译，不能只翻译标题或小节名称。准确保留路径、命令、标识符和链接。
- GitHub Actions 和 Azure Pipelines 偏好本身不会定义发布工作流；生成前应先询问项目专属的构建、制品和发布触发条件。

## GitVersion / 版本管理

The repository root `GitVersion.yml` uses GitVersion 6.4 `GitHubFlow/v1`, baseline `0.1.1`, and optional `[vV]` tag prefix. `v0.1.1` already exists. Before a requested tag, calculate the version on `main` and verify the tag is absent locally and remotely. Untagged main commits may share a SemVer; CI artifacts are scoped to each run. Stable matching tags on main ancestry alone trigger publication.

根目录 `GitVersion.yml` 使用 GitVersion 6.4 的 `GitHubFlow/v1`、`0.1.1` 起始基线及可选 `[vV]` 标签前缀。`v0.1.1` 已存在。收到打标签请求后，在 `main` 计算版本，并确认本地及远程不存在该标签。未打标签的 main 提交可能具有相同 SemVer；CI 制品按运行隔离。只有匹配且位于 main 历史的正式标签才触发发布。

## Existing files and installer / 已有文件与安装器

- Existing project files are never overwritten on first install, and existing settings are preserved.
- On later installs, a toolkit-managed file is updated only if its current SHA-256 hash matches the last installed hash. Before replacement, the old copy is backed up under `.agent-toolkit/backups/`.
- User-modified files and filename collisions are preserved and reported as conflicts.
- A source-tree install runs read-only Git queries (`git rev-parse` and `git status`); the installer does not run Git write operations or create commits, branches, tags, pushes, PRs, or releases.
- Every mapped target is tracked separately in `.agent-toolkit/install-manifest.json`, which is written as `manifestVersion: 2`. A `manifestVersion: 1` manifest from an earlier install is still accepted, so upgrading an existing project preserves the update and conflict rules.
- Root `README.md`, `.gitignore`, and `GitVersion.yml` describe this repository and are not installer targets. No mapping change is required for them.

- 首次安装不会覆盖已有项目文件，也会保留已有设置。
- 后续安装只有在工具包托管文件的当前 SHA-256 与上次安装记录匹配时才更新；覆盖前会备份至 `.agent-toolkit/backups/`。
- 用户修改过的文件和文件名冲突会保留并报告。
- 从源码树安装时，安装器执行只读 Git 查询（`git rev-parse` 和 `git status`）；不执行 Git 写操作，不创建 commit、分支、tag、push、PR 或 release。
- 每个映射目标都会在 `.agent-toolkit/install-manifest.json` 中单独记录，清单以 `manifestVersion: 2` 写入。早前安装产生的 `manifestVersion: 1` 清单仍可读取，因此升级已有项目时更新与冲突规则保持不变。
- 根目录 `README.md`、`.gitignore` 和 `GitVersion.yml` 用于说明本仓库，不属于安装器目标文件，因此无需修改安装映射。

## Settings compatibility / 设置兼容性

Preferences are stored in `.agent-toolkit/settings.json` and validated with `.agent-toolkit/settings.schema.json`. The `gitFlow.sealing`, `gitAutomation.tagSourceBranch`, and enum-valued `reviewerPolicy` fields are optional, so existing schema-v1 settings without them remain valid. An absent `reviewerPolicy` means conditional review only for explicitly requested sealing or release-tag work; absent sealing settings do not grant permission to invent sealing actions. In Git Flow, `createPullRequest` requires `autoPush`, and `tagAfterMerge` requires `autoTag` and a main target. In GitHub Flow those legacy dependencies are inactive and the fields are preserved, not executed. Tagging must be from `main`. Preserve `additionalRequirements` and `customSettings` during initialization.

偏好保存在 `.agent-toolkit/settings.json`，并根据 `.agent-toolkit/settings.schema.json` 校验。`gitFlow.sealing`、`gitAutomation.tagSourceBranch` 和枚举型 `reviewerPolicy` 均为可选，因此不含这些字段的已有 schema-v1 设置仍然有效。缺少 `reviewerPolicy` 时，仅在用户明确要求封板或创建 Release Tag 时调用 Reviewer；缺少封板设置不代表可以自行推断操作。Git Flow 中 `createPullRequest` 需要 `autoPush`，`tagAfterMerge` 需要 `autoTag` 且目标为 main；GitHub Flow 中这些旧字段的依赖不生效，字段予以保留但不执行。Tag 只能从 `main` 创建。初始化时必须保留 `additionalRequirements` 和 `customSettings`。

Use the Orchestrator workflow for task records and phase reporting. Reviewer invocation follows `reviewerPolicy`; when it is absent, conditional review applies only to explicitly requested sealing or release-tag work.

使用 Orchestrator 工作流管理需求记录和阶段汇报。Reviewer 是否参与由 `reviewerPolicy` 控制；缺少该字段时，仅在用户明确要求封板或创建 Release Tag 时需要 Reviewer 验收。
