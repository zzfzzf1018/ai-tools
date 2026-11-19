# 0002 — Review 当前扩展代码并修复问题（二次）

**日期：** 2026-11-19
**状态：** In Progress
**工作流：** single-branch
**评审策略：** never（settings.json: reviewerPolicy=never）

## 用户原始请求

> 请 review 当前扩展代码并修复问题

## 上下文

- 本项目为 Edge 浏览器扩展（Manifest V3），根目录 `c:\flying\ai-tools\webpage-magnifier`
- 上一次同类任务已作为 requirement record 0001 完成，coder 做了多处修复并生成 REQ/PLAN/DESIGN/TASK 四份文档
- 本次是硬闸口（.trae/rules/agent-toolkit.md "Hard gate — no file changes before orchestrator"）生效后的第二次正式走 orchestrator 流程
- 用户再次发出"review 并修复"请求，视作对 0001 修复后代码的进一步审查，允许发现 0001 修复引入的新问题或遗漏问题
- 所有 Git 自动化关闭（autoCommit/autoPush/autoTag=false），不执行 git 操作

## 0001 已完成的关键修复（本次 review 需关注是否引入新问题）

- manifest `all_frames:true` → `false`
- DOM 克隆资源路径绝对化（14 类属性）
- SPA history hook
- Magnifier 监听器生命周期 + `_listeners` + `destroyed`
- content ↔ popup 消息闭环
- 安全清洗扩展

## 本次 review 重点

1. 0001 修复引入的回归问题（history hook 签名、资源绝对化边界、监听器清理幂等性）
2. 上次未覆盖的边界：跨域 iframe、video/canvas 元素、clip-path/float/z-index 对克隆的影响、transform scale 后点击区域偏差
3. popup ↔ background ↔ content 消息链路完整可靠性
4. Edge 特有的兼容性（与 Chrome 的差异）
5. 语法 + manifest validation

## 交付要求

- 共用前缀 `0002-review-and-fix-extension` 的 REQ/PLAN/DESIGN/TASK 四份文档
- 所有代码改动通过 Node 语法校验
- 改动清单附在 TASK 文档中

## 语言

zh-CN
