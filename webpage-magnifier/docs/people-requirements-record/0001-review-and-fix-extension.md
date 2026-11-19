# 0001 — Review 当前扩展代码并修复问题

**日期：** 2026-11-19
**状态：** In Progress
**工作流：** single-branch
**评审策略：** never（不触发独立 Reviewer）

## 用户原始请求

> 请 review 当前扩展代码并修复问题

## 上下文与前置事件

- 本项目是一个 Edge 浏览器扩展（Manifest V3），目录根为 `c:\flying\ai-tools\webpage-magnifier`
- 此前该扩展已由同一 Agent 开发完成并做过一轮手动 review
- 在本任务之前，已向 `.trae/rules/agent-toolkit.md` 和 `AGENTS.md` 新增硬闸口规则：**调用 Write/Edit 之前必须先调 orchestrator**
- 本次任务是硬闸口生效后的首个编码任务，必须完整走 orchestrator → coder 流程

## 待 review 的文件清单

| 文件 | 角色 |
|------|------|
| `manifest.json` | MV3 扩展清单 |
| `content.js` | 页面注入脚本：选区模式、放大镜 DOM 捕获、缩放、层级切换 |
| `content.css` | 选区覆盖层 + 放大镜 UI 样式 |
| `popup.html` + `popup.js` + `popup.css` | 工具栏弹出面板 |
| `background.js` | Service Worker，处理快捷键兜底注入 |
| `icons/*.png` | 扩展图标 |

## 修复范围

- 功能性 Bug：逻辑错误、边界条件未覆盖、状态不一致
- 架构问题：消息链路不可靠、事件/监听器泄漏、SPA/iframe 兼容性
- 安全问题：事件处理器未清洗、资源路径未绝对化、相对 URL 断链
- 体验问题：交互冲突、面板遮挡、滚动缩放异常

## 语言

zh-CN（settings.json 配置）
