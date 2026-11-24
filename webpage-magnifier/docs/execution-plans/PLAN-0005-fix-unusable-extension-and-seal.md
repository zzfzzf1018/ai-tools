# PLAN-0005 — 修复扩展不可用问题并达到可封板状态

**Task ID：** 0005
**Slug：** fix-unusable-extension-and-seal
**日期：** 2026-11-24
**关联需求：** [REQ-0005](../requirements/REQ-0005-fix-unusable-extension-and-seal.md)
**关联设计：** [DESIGN-0005](../software-design/DESIGN-0005-fix-unusable-extension-and-seal.md)
**原始记录：** [docs/people-requirements-record/0005-fix-unusable-extension-and-seal.md](../people-requirements-record/0005-fix-unusable-extension-and-seal.md)

---

## 阶段一：分析与准备（已完成）

| # | 步骤 | 状态 | 产出 |
|---|------|------|------|
| 1.1 | 初始化预检：读取 `.agent-toolkit/settings.json` 并对照 schema | 完成 | `initialized=true`、`single-branch`、`language=zh-CN`、`reviewerPolicy=never` |
| 1.2 | 读取需求记录 `0005-fix-unusable-extension-and-seal.md` | 完成 | 10 项根因与验收标准 |
| 1.3 | 读取全部待改文件（manifest / content.js / content.css / background.js / popup.* / pack.ps1 / README / CHANGELOG） | 完成 | 确认每项修复的落点 |
| 1.4 | 读取既有 `0003` 四件套文档，确认文档格式与编号约定 | 完成 | 文档结构模板 |
| 1.5 | 确认 Git 状态与工具链 | 完成 | 仓库根 `c:\flying\ai-tools`，仅需求记录未跟踪；Node v22.14.0 |

## 阶段二：设计与文档（本阶段产出）

| # | 步骤 | 状态 | 产出路径 |
|---|------|------|----------|
| 2.1 | 编写 REQ-0005 需求规格 | 完成 | `docs/requirements/REQ-0005-fix-unusable-extension-and-seal.md` |
| 2.2 | 编写 PLAN-0005 执行计划（本文件） | 完成 | `docs/execution-plans/PLAN-0005-fix-unusable-extension-and-seal.md` |
| 2.3 | 编写 DESIGN-0005 软件设计 | 完成 | `docs/software-design/DESIGN-0005-fix-unusable-extension-and-seal.md` |

## 阶段三：实现（按依赖顺序）

| # | 步骤 | 文件 | 验证命令/方式 | 状态 |
|---|------|------|---------------|------|
| 3.1 | 重写打包脚本为 staging + 条目分隔符规范化 + 条目校验 | `scripts/pack.ps1` | 运行脚本并列出 zip 条目 | 待执行 |
| 3.2 | 修正选框显隐、裁切、只读透镜与面板圆角 | `content.css` | 文本自查 | 待执行 |
| 3.3 | IIFE + 幂等守卫、移除 content 快捷键、Esc 生命周期、SPA href 判定、克隆对齐、拖拽、notifyRuntime、宿主兜底、初始倍率自适应 | `content.js` | `node --check` | 待执行 |
| 3.4 | 版本号、快捷键、移除 storage 权限 | `manifest.json` | JSON 解析 | 待执行 |
| 3.5 | popup 文案与 shortcuts 提示 | `popup.html`、`popup.js` | `node --check popup.js` + 文本检索 | 待执行 |
| 3.6 | 受限协议补全、insertCSS 独立容错 | `background.js` | `node --check` | 待执行 |
| 3.7 | README 版本/快捷键/权限说明同步 | `README.md` | 文本检索 | 待执行 |
| 3.8 | CHANGELOG 新增 1.0.9 修复条目 | `CHANGELOG.md` | 文本检索 | 待执行 |

## 阶段四：验证

| # | 验证项 | 精确命令 |
|---|--------|----------|
| 4.1 | JS 语法 | `node --check content.js`；`node --check popup.js`；`node --check background.js` |
| 4.2 | manifest 可解析 | `Get-Content -Raw manifest.json \| ConvertFrom-Json \| Out-Null` |
| 4.3 | 打包结构 | `powershell -NoProfile -File .\scripts\pack.ps1` 后读取 zip 条目 |
| 4.4 | CSS 回归自查 | 检索 `.__wpm_select_box` 无 `display:none`、`.__wpm_magnifier` 无 `overflow:hidden` |
| 4.5 | 快捷键/守卫自查 | 检索 content.js 无 `Ctrl+Shift+M` 监听、存在 `__wpm_loaded` |

## 阶段五：自审与结项

| # | 步骤 | 状态 |
|---|------|------|
| 5.1 | 自审：逐条对照 REQ-1 ~ REQ-7 与验收标准 | 待执行 |
| 5.2 | 自审：检查无额外重构、无新增依赖、无越界改动 | 待执行 |
| 5.3 | 编写 TASK-0005 结项文档并链接四份文档 | 待执行 |
| 5.4 | 向 Orchestrator 汇报变更文件、验证结果与剩余风险 | 待执行 |

## Git 与评审策略

- `settings.json` 中 `autoCommit/autoPush/autoTag` 均为 `true`，但用户明确本次**不要求**任何 Git 动作 — 不执行 commit / push / tag。
- `reviewerPolicy: never` — 不调用独立 Reviewer，也不声称已有独立评审结论。
- 不修改 `.agent-toolkit/`、`.trae/`、`.github/` 及 `0001`–`0004` 文档。

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `Compress-Archive` 在 Windows PowerShell 5.1 与 PowerShell 7 的 zip 条目分隔符差异 | 条目校验误判 | 读取条目时把 `\` 归一化为 `/` 再比较 |
| 移除外层 `overflow:hidden` 后内容溢出 | 视觉溢出 | 裁切职责由 `.__wpm_scale_wrap` 的 `overflow:hidden` 承担；外层尺寸已按 scale 计算 |
| IIFE 幂等守卫使扩展重载后的旧标签页不再注册新监听 | 旧标签页需刷新后使用 | 这是浏览器扩展重载的固有限制；至少消除注入崩溃，刷新页面即可恢复，记入剩余风险 |
| 初始倍率下调后用户期望 200% | 体验差异 | 仅在超出视口时下调，且不低于 1.0；面板滑杆可随时调回 |
| 打包脚本 `exit 1` 在 finally 清理中的行为 | 临时目录残留 | 先清理 staging，再做条目校验与退出判定 |
