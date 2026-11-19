# DESIGN-0001 — 软件设计说明（Review & Fix）

**Task ID:** 0001
**Slug:** review-and-fix-extension
**关联:** REQ-0001 / PLAN-0001
**版本:** 1.0
**语言:** zh-CN

---

## 1. 系统概述

Edge 浏览器 Manifest V3 扩展，允许用户在任意网页上通过拖拽矩形区域创建放大镜覆盖层。放大镜通过 DOM 克隆 + CSS `transform: scale()` 实现视觉放大，支持拖拽移动、缩放调节、层级切换和关闭。

### 架构组件

```
┌─────────────────────────────────────────────────────────┐
│  Edge Browser Extension (MV3)                           │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │  background.js│   │ content.js   │   │  popup.js   │  │
│  │  (SW, 快捷键) │───┤ (页面注入)    │───┤ (弹窗面板)   │  │
│  └──────┬───────┘   └──────┬───────┘   └──────┬──────┘  │
│         │                   │                   │        │
│         └─── messages ─────┴───── messages ────┘        │
│                                                          │
│  manifest.json 声明:                                     │
│    - content_scripts (run_at: document_idle)            │
│    - background.service_worker                           │
│    - permissions: storage / activeTab / scripting        │
│    - host_permissions: <all_urls>                       │
│    - commands: toggle-select-mode (Ctrl+Shift+M)         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 组件详细设计

### 2.1 manifest.json 变更

**变更内容：** `all_frames: true` → `all_frames: false`

**理由：**
1. content.js 自身已有 `if (window.top !== window.self) return;` 早退保护，子 frame 根本不工作
2. `all_frames: true` 导致每个子 frame 都跑一次脚本（JS 解析 + 文件加载），浪费资源
3. PING 消息会随机命中某个子 frame，popup 可能拿到子 frame 状态
4. 改为 `false` 后 content script 只在顶层 frame 注入，逻辑更简单

**安全影响：** 无。顶层 frame 仍是绝大多数放大镜使用场景的有效载体。

### 2.2 content.js 变更

#### 2.2.1 资源路径绝对化（`captureContent` 方法重写）

**现状：** 仅处理了 `[src],[href]`，有多处 Bug（base 计算、`.src` vs `getAttribute('src')`）

**新设计：**

```javascript
// URL 基址：当前文档最终 URL 的目录部分
// 比 location.origin + pathname.replace 更稳健的做法：
const baseResolver = new URL('.', window.location.href);
const BASE = baseResolver.href;

// 统一的 URL 绝对化函数
function absolutize(value, base = BASE) {
  if (!value) return value;
  const trimmed = value.trim();
  // 跳过协议/scheme 已完备的 URL
  if (/^(data|blob|javascript|mailto|tel):/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return trimmed;
  if (trimmed.startsWith('#')) return trimmed;
  if (trimmed.startsWith('/')) {
    // 以 / 开头：相对于 origin 根
    try { return new URL(trimmed, window.location.origin).href; } catch (_) { return value; }
  }
  // 相对路径
  try { return new URL(trimmed, base).href; } catch (_) { return value; }
}

// srcset 特殊处理
function absolutizeSrcset(value) {
  if (!value) return value;
  return value.split(',').map((part) => {
    const trimmed = part.trim();
    // 格式: "url size" 或 "url"
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) return absolutize(trimmed);
    return absolutize(trimmed.slice(0, spaceIdx)) + trimmed.slice(spaceIdx);
  }).join(', ');
}

// 在 captureContent 中统一调用：
const targets = [
  // img
  ['img', ['src', 'data-src', 'srcset']],
  // video / audio
  ['video', ['src', 'poster', 'data-src']],
  ['audio', ['src']],
  // iframe（清洗阶段已移除，但 src 也要绝对化以防漏）
  ['iframe', ['src']],
  // SVG image / use
  ['image', ['href', 'xlink:href']],
  ['use', ['href', 'xlink:href']],
  ['source', ['src', 'srcset']],
  // form
  ['form', ['action']],
  // link（rel=stylesheet 已移除，但 rel=icon 等需要处理）
  ['link', ['href']],
  // 通用：任何带 data-src 的元素
  ['[data-src]', ['data-src']],
];
```

#### 2.2.2 DOM 安全清洗扩展

**新增移除标签：**
```javascript
clone.querySelectorAll('base, object, embed, meta[http-equiv]').forEach(n => {
  // meta refresh 即使大小写混写也要匹配
  if (n.tagName === 'META') {
    const equiv = (n.getAttribute('http-equiv') || '').toLowerCase();
    if (equiv === 'refresh') n.remove();
  } else {
    n.remove();
  }
});
```

**`<a>` 标签加固：**
```javascript
clone.querySelectorAll('a[target="_blank"]').forEach((a) => {
  const rel = a.getAttribute('rel') || '';
  if (!rel.includes('noopener')) {
    a.setAttribute('rel', (rel + ' noopener').trim());
  }
});
clone.querySelectorAll('a[download]').forEach((a) => {
  a.removeAttribute('download');
});
```

#### 2.2.3 键盘监听器管理

**设计：**
```javascript
const KEYBOARD_HANDLERS = [];

function registerKeyboardHandler(handler) {
  KEYBOARD_HANDLERS.push(handler);
  document.addEventListener('keydown', handler, true);
}

function cleanupAllKeyboardHandlers() {
  KEYBOARD_HANDLERS.forEach((h) => {
    document.removeEventListener('keydown', h, true);
  });
  KEYBOARD_HANDLERS.length = 0;
}
```

实际使用：init() 开始时先 cleanup 再 register。

#### 2.2.4 Magnifier 实例生命周期

**监听器保存策略：**

```javascript
class Magnifier {
  constructor(rect, scale) {
    this.destroyed = false;
    this._listeners = [];  // 保存 { target, type, handler, options }
    ...
  }

  _addListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._listeners.push({ target, type, handler, options });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    // 1. 清理所有注册的监听器
    this._listeners.forEach(({ target, type, handler, options }) => {
      try { target.removeEventListener(type, handler, options); } catch (_) {}
    });
    this._listeners.length = 0;

    // 2. 清理 document 级拖拽监听器
    if (this.dragMoveHandler) document.removeEventListener('mousemove', this.dragMoveHandler, true);
    if (this.dragEndHandler) document.removeEventListener('mouseup', this.dragEndHandler, true);
    this.dragMoveHandler = null;
    this.dragEndHandler = null;
    this.dragState = null;

    // 3. 移除 DOM
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
    this.scaleWrap = null;
    this.panel = null;

    // 4. 全局引用
    if (magnifier === this) magnifier = null;

    // 5. 通知 popup/background
    try {
      chrome.runtime.sendMessage({ type: 'MAGNIFIER_DESTROYED' });
    } catch (_) {}
  }
}
```

**drag handler 保存为实例字段：**

```javascript
startDrag(e) {
  ...
  this.dragMoveHandler = (ev) => this._onDragMove(ev);
  this.dragEndHandler = () => this._onDragEnd();
  document.addEventListener('mousemove', this.dragMoveHandler, true);
  document.addEventListener('mouseup', this.dragEndHandler, true);
  ...
}
```

#### 2.2.5 SPA 导航 Hook

**必须在 content script 顶层立即执行（早于 DOMContentLoaded）：**

```javascript
// === SPA 导航检测（必须立即执行） ===
(function hookHistory() {
  if (window.__wpm_history_hooked) return;
  window.__wpm_history_hooked = true;

  const origPushState = window.history.pushState;
  const origReplaceState = window.history.replaceState;

  function dispatchNav() {
    window.dispatchEvent(new CustomEvent('__wpm_spa_nav__'));
  }

  window.history.pushState = function(...args) {
    const result = origPushState.apply(this, args);
    dispatchNav();
    return result;
  };
  window.history.replaceState = function(...args) {
    const result = origReplaceState.apply(this, args);
    dispatchNav();
    return result;
  };
})();
```

**导航处理函数（注册在 init 中）：**

```javascript
function handleSpaNav() {
  // 销毁放大镜
  if (magnifier) {
    magnifier.destroy();
    magnifier = null;
  }
  // 退出选区模式
  if (selectMode) {
    selectMode = false;
    exitSelectMode();
  }
  // 通知 popup
  try {
    chrome.runtime.sendMessage({ type: 'SPA_NAVIGATED' });
  } catch (_) {}
}
```

#### 2.2.6 拖拽边界保护

```javascript
_onDragEnd() {
  this.dragState = null;
  document.removeEventListener('mousemove', this.dragMoveHandler, true);
  document.removeEventListener('mouseup', this.dragEndHandler, true);
  this.dragMoveHandler = null;
  this.dragEndHandler = null;
  this.keepInViewport();  // 新增：松手后强制回视口
}
```

### 2.3 popup.js 变更

**新增消息监听：**

```javascript
// popup 现有 runtime.onMessage 里添加
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || sender.tab) return;  // 只处理 content → popup 的消息
  switch (msg.type) {
    case 'SELECT_MODE_CHANGED':
      selectMode = !!msg.selectMode;
      updateUI();
      break;
    case 'MAGNIFIER_CREATED':
      hasMagnifier = true;
      if (typeof msg.scale === 'number') currentScale = msg.scale;
      zIndexHigh = true;  // 新建默认置顶
      updateUI();
      break;
    case 'MAGNIFIER_DESTROYED':
    case 'SPA_NAVIGATED':
      hasMagnifier = false;
      selectMode = false;
      updateUI();
      break;
  }
});
```

**ensureContentScript 防御：**

```javascript
async function ensureContentScript(tab) {
  if (!tab || !isInjectableUrl(tab.url)) return false;
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    // 只接受来自顶层且 ok=true 的响应
    if (resp && resp.ok) return true;
    // 如果子 frame 返回 not-top-frame，或返回 ok:false → 都当作未注入
  } catch (_) { /* 未注入，继续 */ }
  ...
}
```

### 2.4 background.js

**变更：** 无结构性变更。保持现有快捷键兜底注入逻辑。

---

## 3. 数据流

### 3.1 正常创建流程

```
用户按 Ctrl+Shift+M
       │
       ▼
 content.js  enterSelectMode()
       │
       ▼
 用户拖拽选区 → onSelectMouseUp()
       │
       ├→ selectMode = false / exitSelectMode()
       │
       ▼
 createMagnifier(rect)
       │
       ├→ Magnifier.build()
       │    ├→ sourceRectToPage()  ← 绝对坐标
       │    ├→ captureContent()    ← 深克隆 + 安全清洗 + URL绝对化
       │    ├→ 绑定监听器（保存到 _listeners）
       │    ├→ applyScale() / applyZIndex()
       │    └→ keepInViewport()
       │
       └→ chrome.runtime.sendMessage({ type: 'MAGNIFIER_CREATED', scale })
              │
              ▼
        popup.js 监听 → updateUI()
```

### 3.2 SPA 导航清理流程

```
SPA 路由切换
       │
       ├→ history.pushState / replaceState hook → dispatch __wpm_spa_nav__
       ├→ hashchange → 触发 handleSpaNav()
       └→ popstate → 触发 handleSpaNav()
              │
              ▼
        handleSpaNav()
              ├→ magnifier.destroy()
              │    └→ chrome.runtime.sendMessage({ type: 'MAGNIFIER_DESTROYED' })
              ├→ exitSelectMode()
              └→ chrome.runtime.sendMessage({ type: 'SPA_NAVIGATED' })
                     │
                     ▼
               popup.js → updateUI()
```

---

## 4. 安全考量

| 风险 | 防护 |
|------|------|
| 克隆 DOM 中残留内联事件 `onclick="..."` | 遍历所有元素移除 `on*` 属性（已实现） |
| 克隆 DOM 中残留 `<script>` 执行 | 移除 `<script>` 标签（已实现） |
| 相对 URL 被页面基址解析到非预期位置 | 手动绝对化，绕过页面 `<base>` 影响 |
| `<a target="_blank">` 绕过 popup 安全 | 添加 `rel="noopener"` |
| `<a download>` 触发意外下载 | 移除 `download` 属性 |
| `<meta http-equiv="refresh">` 自动跳转 | 移除该标签 |
| `<base>` 影响相对路径解析 | 移除 `<base>` 标签 |
| 插件对象 `<object>` / `<embed>` | 移除 |
| SVG `<image>` / `<use>` 远程加载资源 | 绝对化 URL（不能完全阻止远程加载，但与原页面一致） |
| history hook 被多个 content script 叠加 | `window.__wpm_history_hooked` 标志位 |

---

## 5. 兼容性

| 场景 | 处理策略 |
|------|----------|
| Edge / Chrome (Chromium) | 主要目标，MV3 完整支持 |
| `<all_urls>` 匹配的 https / http | 支持 |
| edge:// / chrome:// / about:blank | background.js 和 popup.js 都有 isInjectable 过滤 |
| iframe 嵌套 | 改 `all_frames: false`，只顶层工作；iframe 内内容需要用户在顶层放大镜中捕获 |
| 页面 transform: scale | 外层放大镜 position: fixed 不受影响，克隆内容 captureContent 用 getBoundingClientRect 坐标 + scroll 修正 |
| SPA 路由（pushState） | hook history + 监听 popstate/hashchange |
| SPA 路由（非 pushState，如 hash） | hashchange 监听已覆盖 |
| SPA 路由（框架私有路由，如 Next.js Router） | 最终会调 history.pushState/replaceState，hook 覆盖 |

---

## 6. 验证矩阵

| 验证点 | 方法 | 通过标准 |
|--------|------|----------|
| manifest.json 语法 | `JSON.parse` | 无抛错 |
| content.js 语法 | `node --check` | 无错误 |
| popup.js 语法 | `node --check` | 无错误 |
| background.js 语法 | `node --check` | 无错误 |
| 资源绝对化 | 在含相对路径图片的测试页创建放大镜，检查图片 src 已变绝对 | 检查 DOM 属性 |
| SPA 导航清理 | 在 SPA 页创建放大镜 → 路由切换 → 放大镜消失 | 手动测试 |
| 销毁完整性 | 创建放大镜 → 关闭 → DevTools 检查 document 监听器 | mousemove/mouseup 数量正常 |
| 拖拽边界 | 拖出视口 → 松手 → 放大镜在视口内 | 手动测试 |
| 关闭按钮消息 | content 关闭放大镜 → popup 控制面板隐藏 | 手动测试 |

---

## 7. 不修复项（明确排除）

| 项目 | 原因 |
|------|------|
| 放大镜内容实时更新 | 当前实现是快照克隆，不跟原 DOM 同步；实时更新成本高（需要 MutationObserver + 持续重渲染），且超出本次 review 范围 |
| `<canvas>` 渲染方案 | 彻底解决 DOM 克隆安全，但实现成本高、无法克隆复杂 CSS 样式，超出范围 |
| 多放大镜支持 | 当前单放大镜设计清晰，多放大镜引入 z-index 冲突管理、面板布局、生命周期复杂度，不在本次范围 |
| i18n | 所有字符串硬编码中文，manifest 无 locales/ 目录；本次只修 Bug |
