# REQ-0002 — 第二轮代码审查与修复

**Task ID:** 0002
**Slug:** review-and-fix-extension-again
**日期:** 2026-11-19
**状态:** Approved

---

## 1. 背景与目标

上一轮（REQ-0001）已完成对 Edge 网页区域放大器扩展的首轮代码审查，修复了 `manifest.all_frames`、资源路径绝对化、SPA history hook、Magnifier 监听器生命周期、popup ↔ content 消息闭环、DOM 安全清洗等六大类问题。

本次（REQ-0002）是对 **0001 修复后代码的第二轮审查**，目标是：

1. 验证 0001 修复是否引入回归
2. 覆盖 0001 未覆盖的边界条件
3. 修复本轮发现的新问题
4. 最终交付一份语法正确、无明显已知缺陷的扩展代码库

---

## 2. 上轮修复回归验证（必须通过）

| 编号 | 验证项 | 验证方法 | 预期结果 |
|------|--------|----------|----------|
| RGR-01 | manifest `all_frames: false` | 读取 manifest.json 确认 | 值为 false |
| RGR-02 | content.js 顶层 frame 双重保护 | grep `window.top !== window.self` | 至少 2 处（init 和 onMessage） |
| RGR-03 | SPA history hook 顶层立即执行 | grep `__wpm_history_hooked` 位置 | 在 IIFE 中，早于 DOMContentLoaded |
| RGR-04 | Magnifier.destroy 幂等性 | 检查 `this.destroyed` flag | 开头 return 保护 |
| RGR-05 | Magnifier._listeners 完整性 | 检查所有 bindEvents 监听器 | 全部通过 `_addListener` 注册 |
| RGR-06 | popup → content 消息 PING 防御 | 检查 ensureContentScript | 有 `resp.ok && !resp.reason` 判断 |
| RGR-07 | content → popup 四种消息 | 检查 popup.js onMessage | SELECT_MODE_CHANGED / MAGNIFIER_CREATED / MAGNIFIER_DESTROYED / SPA_NAVIGATED 全部覆盖 |
| RGR-08 | DOM 安全清洗完整度 | grep 移除项 | script/iframe/object/embed/base/meta refresh/on*/a[target=_blank]/download/id 替换 |
| RGR-09 | 资源绝对化覆盖 14 类属性 | grep targets 数组 | img/video/audio/source/image/use/form/link/a/[data-src] |
| RGR-10 | 语法校验 | Node --check 全部 .js | 无错误输出 |

---

## 3. 本轮发现的新问题（必须修复）

### REQ-0002-01：URL_BASE 在 SPA 导航后不更新

- **来源:** content.js 第 63-70 行
- **问题描述:** `URL_BASE` 是 IIFE 立即计算的 `const`，在 SPA 导航（history.pushState/replaceState）后不会更新。新创建的放大镜在 `absolutizeUrl` 解析相对路径时使用旧的 URL_BASE，在 SPA 路由页面上会将 `/photo.jpg` 解析到错误的路径
- **严重度:** High
- **修复要求:**
  1. 将 `URL_BASE` 从 IIFE const 改为可更新的闭包变量
  2. 提供 `refreshUrlBase()` 函数
  3. 在 `handleSpaNav()` 中调用 refreshUrlBase

### REQ-0002-02：createMagnifier 缺少 rect 参数校验

- **来源:** content.js 第 389-395 行
- **问题描述:** `createMagnifier(rect, options)` 直接使用传入的 rect 对象的 left/top/width/height 字段，无任何校验。如果 rect 为 null、undefined 或缺字段，NaN 值会被写入 DOM style
- **严重度:** Medium
- **修复要求:**
  1. 校验 rect 是否为 Object，四个字段是否为正有限数
  2. 校验失败时返回 null 或抛出 RangeError

### REQ-0002-03：background.js ensureInjected 与 TOGGLE_SELECT_MODE 竞态

- **来源:** background.js 第 49-59 行
- **问题描述:** `ensureInjected(tabId)` 执行脚本注入后，立即调用 `chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SELECT_MODE' })`。如果 content script 的 `init()` 尚未完成 `chrome.runtime.onMessage.addListener` 注册（MV3 中 executeScript 是异步的），消息会静默失败
- **严重度:** Medium
- **修复要求:**
  1. 注入后先发送 PING 等待 content 就绪
  2. PING 成功后再发送 TOGGLE_SELECT_MODE
  3. 整体超时保护（如 2000ms）

### REQ-0002-04：Magnifier._listeners.options 保存不完整

- **来源:** content.js 第 424-427 行
- **问题描述:** `_addListener` 当前所有调用未传 options 参数，保存的是 `undefined`。规范要求 removeEventListener 参数与 addEventListener 完全一致。虽然现代浏览器对 undefined 参数宽容，但严格匹配应保持参数透传
- **严重度:** Medium（鲁棒性增强）
- **修复要求:** 将 `_addListener` 的 options 参数默认值改为 `undefined`，removeEventListener 保持传 undefined 即可（当前实现已正确）。**重新评估后认为当前实现 OK**——options 未传入时两边都是 undefined，匹配。此条降级为 Info。

---

## 4. 边界条件审查结果（记录，无需代码修复）

| 编号 | 边界 | 结果 | 说明 |
|------|------|------|------|
| BND-01 | 跨域 iframe 内容捕获 | 安全移除正确 | iframe 会在安全清洗中被移除，符合跨域安全模型 |
| BND-02 | canvas 元素克隆为空白 | 已知限制 | cloneNode 不复制 canvas 像素内容；如要增强可用 toDataURL |
| BND-03 | video 元素克隆 | 正确（有局限） | video 标签克隆后需要重新播放；src/poster 已绝对化 |
| BND-04 | z-index 2147483647 层级穿透 | 正确 | 32-bit signed int max，基本盖过所有页面元素 |
| BND-05 | transform scale 后点击区域 | 正确 | scaleWrap 在 scale 外层有真实尺寸，拖拽手柄/面板在 scaleWrap 外不受 transform 影响 |
| BND-06 | SPA 消息链路可靠性 | 正确 | history hook → CustomEvent → handleSpaNav → destroy → SPA_NAVIGATED → popup 更新状态，闭环完整 |
| BND-07 | Edge 与 Chrome 兼容性 | 正确 | API 完全兼容；Edge 同样支持 MV3 |
| BND-08 | content.css !important 抵抗 | 正确 | 所有属性加了 !important，抵抗宿主页面 CSS 覆盖 |
| BND-09 | popup 关闭后 runtime.sendMessage | 已 try/catch | content.js handleSpaNav 中发送 SPA_NAVIGATED 时 popup 可能已关闭 |
| BND-10 | window.top !== window.self 双重保护 | 正确 | init() 和 onMessage() 各有一处 |

---

## 5. 验收标准

### 功能验收

| 编号 | 验收项 | 通过条件 |
|------|--------|----------|
| AC-01 | SPA 导航后资源路径解析正确 | 在 SPA 页面（如 Next.js/Vue SPA）导航后，创建新放大镜时 img/srcset 等资源能正确加载 |
| AC-02 | createMagnifier 参数保护 | 传入无效 rect 时不抛异常，不写入 NaN 样式 |
| AC-03 | background 快捷键可靠 | 在页面首次加载后立即按 Ctrl+Shift+M，选区模式能正确激活 |
| AC-04 | 无回归 | 上轮修复的 10 项回归验证（RGR-01 ~ RGR-10）全部通过 |

### 质量验收

| 编号 | 验收项 | 通过条件 |
|------|--------|----------|
| AC-05 | manifest.json 语法 | JSON.parse 无错 |
| AC-06 | content.js 语法 | node --check 无错 |
| AC-07 | popup.js 语法 | node --check 无错 |
| AC-08 | background.js 语法 | node --check 无错 |
| AC-09 | 无新增 console.error | 代码中无未捕获异常可能 |

---

## 6. 假设与约束

| 编号 | 假设/约束 | 来源 |
|------|-----------|------|
| A-01 | Edge 浏览器 MV3 API 与 Chrome 完全兼容 | 用户声明 + 代码使用 chrome.* 命名空间 |
| A-02 | 用户目标是 Edge 浏览器 | 项目类型 edge-browser-extension |
| A-03 | 不执行任何 Git 操作 | settings.json autoCommit/autoPush/autoTag=false |
| A-04 | 不调用独立 Reviewer | settings.json reviewerPolicy=never |
| A-05 | 仅修改现有文件，不新增不需要的文件 | 工作区规则 |
| A-06 | 所有 JS 文件保持 Node.js 语法可验证 | 验收标准 AC-05~08 |
