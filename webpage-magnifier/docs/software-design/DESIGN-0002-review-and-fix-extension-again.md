# DESIGN-0002 — 第二轮代码修复软件设计说明

**Task ID:** 0002
**Slug:** review-and-fix-extension-again
**关联 REQ:** REQ-0002-review-and-fix-extension-again.md
**关联 PLAN:** PLAN-0002-review-and-fix-extension-again.md
**日期:** 2026-11-19
**状态:** Approved

---

## 1. 修复范围

本轮修改仅涉及两个文件：

| 文件 | 修改类型 | 变更内容 |
|------|----------|----------|
| `content.js` | Edit | URL_BASE 可更新化 + handleSpaNav 刷新 + createMagnifier 参数校验 + build 防护 |
| `background.js` | Edit | 新增 waitForContent 函数 + ensureInjected 后等待 PING |

`popup.js`、`manifest.json`、CSS 文件、HTML 文件均**不修改**。

---

## 2. 详细设计

### 2.1 URL_BASE SPA 导航更新（修复 REQ-0002-01）

**修改前结构:**
```js
const URL_BASE = (function resolveBase() {
  try { return new URL('.', window.location.href).href; }
  catch (_) { return window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/'); }
})();
```

**修改后结构:**
```js
let URL_BASE = resolveBase();

function resolveBase() {
  try { return new URL('.', window.location.href).href; }
  catch (_) { return window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/'); }
}

function refreshUrlBase() {
  URL_BASE = resolveBase();
}
```

**为什么这样设计:**
1. 把 IIFE 改成普通函数 + 顶层调用，逻辑完全不变
2. `let URL_BASE` 保持与所有 `absolutizeUrl` 闭包引用的一致性——闭包引用的是变量本身，不是值快照；`let` 重新赋值后闭包自动读取最新值
3. `refreshUrlBase()` 命名清晰，在 `handleSpaNav()` 开头调用

**handleSpaNav 修改:**
```js
function handleSpaNav() {
  if (window.top !== window.self) return;
  refreshUrlBase();  // ← 新增
  // ... 原有逻辑不变
}
```

### 2.2 createMagnifier 参数校验（修复 REQ-0002-02）

**修改前:**
```js
function createMagnifier(rect, options) {
  options = options || {};
  const scale = clamp(typeof options.scale === 'number' ? options.scale : DEFAULT_SCALE, MIN_SCALE, MAX_SCALE);
  if (magnifier) magnifier.destroy();
  magnifier = new Magnifier(rect, scale);
  return magnifier;
}
```

**修改后:**
```js
function createMagnifier(rect, options) {
  // 参数校验
  if (!rect || typeof rect !== 'object') return null;
  const required = ['left', 'top', 'width', 'height'];
  for (const k of required) {
    if (typeof rect[k] !== 'number' || !isFinite(rect[k])) return null;
  }
  if (rect.width <= 0 || rect.height <= 0) return null;

  options = options || {};
  const scale = clamp(typeof options.scale === 'number' ? options.scale : DEFAULT_SCALE, MIN_SCALE, MAX_SCALE);
  if (magnifier) magnifier.destroy();
  magnifier = new Magnifier(rect, scale);
  return magnifier;
}
```

**调用方处理:**
- `onSelectMouseUp(e)`: 调用 `createMagnifier(rect)` 返回值未使用，但 rect 是本地构造的，已确保正确。无需要改。
- `onMessage CREATE_MAGNIFIER`: 改为 `const m = createMagnifier(msg.rect, msg.options || {}); if (!m) { sendResponse({ ok: false, reason: 'invalid rect' }); return; }`

**Magnifier.build() 防护:**
```js
if (!this.sourceRect || !isFinite(this.sourceRect.left) || !isFinite(this.sourceRect.width)) {
  // 强制进入 empty 状态
  this.scaleWrap.innerHTML = '<div class="__wpm_empty">区域数据异常</div>';
  return;
}
```

### 2.3 background.js ensureInjected 竞态修复（修复 REQ-0002-03）

**修改前:**
```js
try {
  await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SELECT_MODE' });
} catch (_) {
  try {
    await ensureInjected(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SELECT_MODE' });  // ← 竞态：注入后立即发
  } catch (e) {
    console.warn('[WPM] 快捷键执行失败：', e);
  }
}
```

**修改后:**
```js
async function waitForContent(tabId, timeout = 2000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tryPing = async () => {
      try {
        const resp = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        if (resp && resp.ok) { resolve(true); return; }
      } catch (_) {}
      if (Date.now() - start >= timeout) { resolve(false); return; }
      setTimeout(tryPing, 100);
    };
    tryPing();
  });
}

// chrome.commands.onCommand 内部：
try {
  await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SELECT_MODE' });
} catch (_) {
  try {
    await ensureInjected(tab.id);
    const ready = await waitForContent(tab.id, 2000);
    if (!ready) { console.warn('[WPM] content script 注入后未就绪'); return; }
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SELECT_MODE' });
  } catch (e) {
    console.warn('[WPM] 快捷键执行失败：', e);
  }
}
```

**设计理由:**
1. 用 Promise + 递归 setTimeout 实现轮询，比循环 + sleep 更简洁
2. 默认 2000ms 超时覆盖所有主流设备的 content script 初始化时间
3. PING 每 100ms 发一次，足够及时
4. resolve(true/false) 用布尔值，调用方判断清晰

---

## 3. 不修改的边界条件（设计决策）

| 边界 | 决策 | 理由 |
|------|------|------|
| canvas 克隆为空白 | 不修复 | 增强成本高（需要遍历所有 canvas.toDataURL 并替换为 img），当前放大镜主要用于文字/图片区域；可后续单独做增强 |
| Magnifier._listeners options 保存 | 不改 | 当前所有调用未传 options，两边都是 undefined，严格匹配 |
| popup.js 消息监听器无 return true | 不改 | 当前没有异步 sendResponse，不需要返回 true |
| popup.js 不处理 tabId 为 undefined 的 sendToContent | 不改 | getActiveTab 失败时 popup UI 已经 setStatusUnavailable()，不会触发后续 |
| absolutizeElementAttrs 中 [data-src] 冗余遍历 | 不改 | 功能正确，冗余遍历可忽略 |

---

## 4. 安全考虑

本轮修复不涉及安全模型变更：
- 无新增权限
- 无新增外部网络请求
- URL_BASE 更新仍然使用同源解析（new URL），不会引入新的 open redirect 风险
- createMagnifier 校验不改变 DOM 安全清洗逻辑
- background.js waitForContent 轮询只发 PING，不发送用户数据

---

## 5. 兼容性

| 目标 | 兼容性 |
|------|--------|
| Edge (MV3) | resolveBase 使用 `new URL()` + `window.location.*`，全部 Edge 版本支持 |
| Chrome (MV3) | 同上 |
| 纯 JS 语法 | Node 14+ / Edge 90+ 支持 let + arrow function + Promise |
| SPA 框架 | history hook 在框架之前执行；popstate/hashchange 是标准事件 |
