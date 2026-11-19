# PLAN-0003 — 补齐项目基础设施四项缺失

**Task ID：** 0003  
**Slug：** project-infra-gap-fill  
**日期：** 2026-11-19  
**关联需求：** [REQ-0003](../requirements/REQ-0003-project-infra-gap-fill.md)  
**关联设计：** [DESIGN-0003](../software-design/DESIGN-0003-project-infra-gap-fill.md)

---

## 阶段一：分析与设计（已完成）

| # | 步骤 | 状态 | 产出 |
|---|------|------|------|
| 1.1 | 初始化预检：读取 settings.json + schema | 完成 | initialized=true, single-branch, reviewerPolicy=never |
| 1.2 | 读取需求记录 0003-project-infra-gap-fill.md | 完成 | 四项缺失明确 |
| 1.3 | 探查项目结构与 monorepo workflows | 完成 | 9 个现有 yml，无 webpage-magnifier 前缀冲突 |
| 1.4 | 读取扩展全部源码（manifest/content/background/popup） | 完成 | content.js 832 行、background.js 86 行、pack.ps1 文件清单 |
| 1.5 | 读取参照 workflow（web-markdown-ext-release.yml） | 完成 | 双 job（verify + publish）结构 |
| 1.6 | 编写 REQ-0003 需求规格 | 完成 | 编号需求 REQ-1 ~ REQ-4，验收标准 6 条 |

## 阶段二：设计文档（本阶段产出）

| # | 步骤 | 状态 | 产出路径 |
|---|------|------|----------|
| 2.1 | 编写 PLAN-0003 执行计划 | 进行中 | `docs/execution-plans/PLAN-0003-project-infra-gap-fill.md` |
| 2.2 | 编写 DESIGN-0003 软件设计 | 待执行 | `docs/software-design/DESIGN-0003-project-infra-gap-fill.md` |

## 阶段三：实现（待执行）

| # | 步骤 | 验证命令 | 状态 |
|---|------|----------|------|
| 3.1 | 创建 README.md | 文件存在 + 8 章节齐备 | 待执行 |
| 3.2 | 创建 .gitignore | 文件存在 + 覆盖 6 项规则 | 待执行 |
| 3.3 | 创建 CHANGELOG.md | 文件存在 + Keep a Changelog 格式 | 待执行 |
| 3.4 | 创建 release-webpage-magnifier.yml | YAML 语法校验 + 文件位置正确 | 待执行 |
| 3.5 | 语法校验：node + js-yaml 或等效 | `node -e "const YAML=require('js-yaml'); ..."` | 待执行 |
| 3.6 | 文件存在性批量校验 | `Test-Path` / `Get-ChildItem` | 待执行 |

## 阶段四：自审与结项（待执行）

| # | 步骤 | 状态 |
|---|------|------|
| 4.1 | 自审：README 内容与 manifest/源码一致性 | 待执行 |
| 4.2 | 自审：.gitignore 不误排 `.agent-toolkit/` | 待执行 |
| 4.3 | 自审：workflow paths/tag 匹配规则 | 待执行 |
| 4.4 | 编写 TASK-0003 任务结项文档 | 待执行 |
| 4.5 | 向 Orchestrator 汇报交付清单与验证结果 | 待执行 |

## Git 与评审策略

- `autoCommit/autoPush/autoTag` 虽为 true，但用户显式要求本次基础设施改动等审阅后再 commit — **不自动执行任何 Git 操作**
- `reviewerPolicy: never` — 不调用独立 Reviewer
- 不创建 release tag（release workflow 是为未来准备，当前不推送 tag）

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| README 权限说明不准确 | 用户误用扩展 | 直接从 manifest.json + content.js 代码中提取权限实际用途 |
| .gitignore 误排 `.agent-toolkit/` | 模板文件丢失 | 显式列出 `.agent-toolkit/` 下需提交的文件（settings.json, install-files.json, install-manifest.json, settings.schema.json, settings.template.json），再 `!` 排除无关子目录 |
| workflow paths 写法错误 | 触发条件失效 | 严格参照 monorepo 现有 9 个 workflow 的 paths 格式，用 `paths-filter` 精确匹配 |
| workflow zip 构建排除项不全 | Release zip 含模板文件 | 列出完整排除清单并与 pack.ps1 对照 |
| YAML 缩进错误 | workflow 解析失败 | 用 node + js-yaml 运行时校验，发现错误立即修正 |
