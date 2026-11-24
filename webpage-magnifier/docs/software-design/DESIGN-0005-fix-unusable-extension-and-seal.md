# DESIGN-0005 — 修复扩展不可用问题并达到可封板状态

**Task ID：** 0005
**Slug：** fix-unusable-extension-and-seal
**日期：** 2026-11-24
**关联需求：** [REQ-0005](../requirements/REQ-0005-fix-unusable-extension-and-seal.md)
**关联计划：** [PLAN-0005](../execution-plans/PLAN-0005-fix-unusable-extension-and-seal.md)

---

## 1. 设计概览

本任务为缺陷修复，不改变扩展整体架构（content / background / popup 三部分 + manifest）。改动点围绕「打包产物正确、选区可见、放大镜可用、注入幂等、交互不回退」展开：

```
修复范围
├── scripts/pack.ps1      staging + 条目校验（产物结构）
├── content.css           选框显隐、裁切归属、只读透镜、面板圆角
├── content.js            IIFE 幂等、快捷键单一来源、Esc 生命周期、
│                         SPA href 判定、克隆对齐、拖拽入口、notifyRuntime、初始倍率
├── manifest.json         版本 1.0.9、Ctrl+Shift+Y、移除 storage
├── popup.html / popup.js 文案与改键提示
├── background.js         受限协议补全、insertCSS 独立容错
└── README.md / CHANGELOG.md 文档同步
```

设计约束：不新增依赖、不重写架构、不改动 manifest 其他字段、不执行 Git 动作。

## 2. 打包脚本设计（`scripts/pack.ps1`）

### 2.1 问题根因

`Compress-Archive -Path $files` 逐项接收文件路径时，仅保留文件名，`icons/icon16.png` 被写成平铺 `icon16.png`，导致 Edge 依据 manifest 查找 `icons/icon16.png` 失败。

### 2.2 新流程

```
$root = pack.ps1 所在 scripts 目录的父目录（项目根）
1. 逐个 Test-Path 校验 $files；缺失项累加并打印 MISSING
2. 若存在缺失 → 打印汇总 → exit 1（不生成 zip）
3. 创建唯一临时 staging 目录（系统临时目录下随机 GUID）
4. 按相对路径复制文件，自动创建 icons 子目录
5. Compress-Archive -Path "$stageDir\*" -DestinationPath $zipPath -Force
6. 用 ZipArchive 重建条目，把分隔符统一为正斜杠（Windows PowerShell 5.1 的 Compress-Archive 会写反斜杠，浏览器不识别）
7. finally 清理 staging 目录
8. System.IO.Compression.ZipFile 打开 zip，读取条目（\ → / 归一化）
9. 校验必需条目：manifest.json、icons/icon16.png、icons/icon48.png、icons/icon128.png
10. 缺失 → 打印失败原因 → exit 1；通过 → 打印条目清单与文件信息，exit 0
```

### 2.3 关键点

- 使用 `$PSScriptRoot` 推导项目根，脚本可从任意工作目录运行，也兼容 `powershell -File .\scripts\pack.ps1`。
- 打包源为 staging 目录内的 `*`，因此保留目录层级。
- Windows PowerShell 5.1 的 `Compress-Archive` 把条目分隔符写成 `\`，Chromium 系浏览器按 zip 规范只认 `/`，因此必须重建条目分隔符，否则即使目录层级正确也会找不到图标。
- 条目校验使用 zip 真实内容而非源文件清单，能发现「文件复制成功但打包失败」的情况。
- `exit 1` 放在 staging 清理之后，避免临时目录残留。

## 3. 样式设计（`content.css`）

| 选择器 | 变更 | 理由 |
|--------|------|------|
| `.__wpm_select_box` | 删除 `display: none !important` | `!important` 优先级高于 inline `display:block`，选框永远不可见；显隐交由 JS inline style |
| `.__wpm_magnifier` | 删除 `overflow: hidden !important` | 选区较小时控制面板宽度大于放大镜导致被裁切 |
| `.__wpm_scale_wrap` | 增加 `pointer-events: none !important` 与 `border-radius: 5px !important` | 只读透镜，禁止点击克隆的链接/表单；圆角由内层承担 |
| `.__wpm_panel` | 由「左边框 + 下边框 + 左下圆角」改为完整 `border` 与 `border-radius: 6px` | 外层不再裁切，面板需自身闭环圆角边框 |

裁切归属：`.__wpm_scale_wrap` 自带 `overflow: hidden`，且 `transform: scale` 作用于整个元素（含裁切区域），因此移除父级裁切不会让克隆内容溢出。

## 4. Content Script 设计（`content.js`）

### 4.1 IIFE 与幂等守卫

```js
(function () {
  'use strict';
  if (window.__wpm_loaded) return;
  window.__wpm_loaded = true;
  // ...原逻辑...
})();
```

- 消除顶层 `const` / `let` 在重复 `executeScript` 时抛 `Identifier has already been declared`。
- 同一页面只保留一份实例，避免重复注册消息监听导致「开一次又关一次」。
- 已知限制：扩展重载后旧标签页中的旧实例监听器已随上下文失效，守卫会阻止新实例重复初始化；此类标签页刷新后恢复正常。该限制记录在 TASK 剩余风险中。

### 4.2 快捷键单一来源

删除 `KEYBOARD_LISTENERS`、`installKeyboardShortcut()`、`cleanupKeyboardListeners()` 及 `init()` 内相关调用。快捷键仅由 `chrome.commands` → background → `TOGGLE_SELECT_MODE` 驱动，避免与 content 内监听双触发。

### 4.3 Esc 生命周期

- 进入选区模式（`enterSelectMode`）时注册 `keydown` 捕获监听（保存在 `MOVE_LISTENERS.key`）。
- `cleanupSelectListeners()` 统一移除（退出选区、鼠标释放、再次进入前都会调用）。
- `onSelectKeyDown` 处理 `Escape`：`preventDefault` → 置 `selectMode=false` → `exitSelectMode()` → `notifyRuntime(SELECT_MODE_CHANGED)`。

### 4.4 SPA 导航判定

```js
let lastHref = window.location.href;
function handleSpaNav() {
  const href = window.location.href;
  if (href === lastHref) return;
  lastHref = href;
  refreshUrlBase();
  // 销毁放大镜、退出选区、notifyRuntime(SPA_NAVIGATED)
}
```

避免 `replaceState` 写回同 URL 或页面滚动触发的伪导航清除放大镜。

### 4.5 克隆对齐（`captureContent`）

- 移除 `clone.style.padding = '0'`，保留容器原有内边距。
- 增加 `clone.style.boxSizing = 'border-box'`，使写入的 `width/height`（来自 `getBoundingClientRect`）与边框盒口径一致。
- 先改写克隆根节点自身 `id`（`__wpm_cloned_0`），再使用计数器改写后代 `id`，避免与页面既有 id 冲突。

### 4.6 拖拽入口

- `this.el` 的 `mousedown`：若 `e.target` 位于 `this.panel` 内则忽略，否则调用 `startDrag(e)`。
- `this.panel` 的 `mousedown` / `click` 继续 `stopPropagation`。
- `_onDragMove(e)` 增加 `e.preventDefault()`，抑制拖拽期间的文本选择与原生拖放。

### 4.7 统一 runtime 通知

```js
function notifyRuntime(msg) {
  try {
    const p = chrome.runtime.sendMessage(msg);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) { /* 扩展上下文失效时忽略 */ }
}
```

替换 `toggleSelectMode`、`onSelectMouseUp`、`onSelectKeyDown`、`handleSpaNav`、`Magnifier.build`、`Magnifier.destroy` 中全部发送点，消除未处理 Promise rejection。

### 4.8 宿主兜底

`selectHost()` 返回 `document.body || document.documentElement`，用于 `createSelectOverlay()` 挂载以及选区模式的 cursor / userSelect 设置与恢复。

### 4.9 初始倍率自适应

`createMagnifier` 中先按原逻辑取 `options.scale` 并 clamp，然后：

```
maxW = window.innerWidth  - 32   // 左右各 16px
maxH = window.innerHeight - 32
fit  = Math.min(scale, maxW / rect.width, maxH / rect.height)
final = clamp(fit, MIN_SCALE, MAX_SCALE)
```

仅下调初始值，不修改 `Magnifier.setScale` 的用户主动调节行为。

### 4.10 面板视口收敛（`positionPanel`）

真实浏览器测试发现：`SET_SCALE` 到 3x/5x 时放大镜可能超出视口，面板因贴住放大镜右上角而被推到屏幕外，关闭按钮不可点。设计如下：

```
positionPanel():
  elRect = this.el.getBoundingClientRect()
  vpLeft = clamp(elRect.right - panelWidth, 8, innerWidth  - 8 - panelWidth)
  vpTop  = clamp(elRect.top,                 8, innerHeight - 8 - panelHeight)
  panel.style.setProperty('left',  vpLeft - elRect.left, 'important')
  panel.style.setProperty('top',   vpTop  - elRect.top,  'important')
  panel.style.setProperty('right', 'auto', 'important')
```

- 调用时机：`keepInViewport()` 末尾（创建、拖动结束、resize）、`setScale()` 经由 `keepInViewport()`。
- 面板 CSS 的 `top/right` 带 `!important`，因此必须用 `setProperty(..., 'important')` 覆盖。
- 只移动面板、不改变放大镜倍率与位置，用户主动缩放行为不受影响。
- 窗口 `resize` 时重新收敛，避免拖动窗口后面板越界。

## 5. Manifest / Popup / Background / 文档设计

| 文件 | 变更 |
|------|------|
| `manifest.json` | `version: 1.0.9`；命令默认键 `Ctrl+Shift+Y`；权限仅保留 `activeTab`、`scripting`；`host_permissions` 不变 |
| `popup.html` | 按钮与使用说明快捷键改为 `Ctrl+Shift+Y`；说明区增加 `edge://extensions/shortcuts` 改键提示 |
| `popup.js` | 按钮文案同步为 `Ctrl+Shift+Y` |
| `background.js` | `BLOCKED_PROTOCOLS` 增加 `chrome-extension://`、`devtools://`、Chrome Web Store、Edge Add-ons；`executeScript` 与 `insertCSS` 分开 try/catch，CSS 失败仅告警 |
| `README.md` | 版本 v1.0.9；快捷键文案全量替换；补充改键入口；权限说明移除 `storage` 段落 |
| `CHANGELOG.md` | 新增 `## [1.0.9] - 2026-11-24`，在「修复」下列出十项 P0 修复 |

## 6. 兼容性与安全

- **Manifest V3**：不新增 API，`chrome.commands`、`chrome.scripting`、`chrome.tabs` 均为已有能力。
- **受限页面**：background 与 popup 双重拦截 `edge://`、`chrome://`、`chrome-extension://`、`devtools://`、扩展商店页面。
- **DOM 克隆安全清洗不变**：仍移除 `script/iframe/link[rel=stylesheet]/object/embed/base`、`meta refresh`、内联 `on*`，并绝对化资源路径。
- **只读透镜**：克隆内容 `pointer-events: none`，交互面仅剩面板与放大镜本体拖动，降低误跳转风险。
- **向后兼容**：消息类型与协议不变，popup / background 无需同步新协议。

## 7. 测试验证方案

| 验证对象 | 方法 | 期望 |
|----------|------|------|
| JS 语法 | `node --check content.js` / `popup.js` / `background.js` | 均无输出、退出码 0 |
| manifest | `Get-Content -Raw manifest.json \| ConvertFrom-Json \| Out-Null` | 无异常；版本 1.0.9 |
| 打包 | `powershell -NoProfile -File .\scripts\pack.ps1` + 读取 zip 条目 | 含 `icons/` 前缀四文件与 `manifest.json`，退出码 0 |
| 选框样式 | 检索 `content.css` | `.__wpm_select_box` 无 `display`；无 `display: none !important` |
| 裁切 | 检索 `content.css` | `.__wpm_magnifier` 无 `overflow` |
| 真实浏览器 E2E | Edge + `--load-extension` + CDP 驱动真实鼠标/键盘事件 | 30 项断言全部通过（选区可见、放大镜创建、面板可点、拖动、缩放、Esc、重复注入、无控制台报错） |
| zip 安装 | 解压 `webpage-magnifier.zip` 后 `--load-extension` 指向解压目录 | 扩展加载、版本 1.0.9、content script PING 正常 |
| 快捷键 | 检索 `content.js` / `manifest.json` | content 无 `Ctrl+Shift+M` 监听；manifest 为 `Ctrl+Shift+Y` |
| 幂等 | 检索 `content.js` | 含 `window.__wpm_loaded` 守卫 |
| 运行时 | 用户在 Edge 加载解压扩展端到端测试 | service worker 正常、选区/放大镜/面板/Esc/拖拽/缩放可用 |
