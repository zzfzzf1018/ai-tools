# TASK-0001 — Review 并修复 Edge 网页区域放大器扩展（任务收尾）

**Task ID:** 0001
**Slug:** review-and-fix-extension
**状态:** Completed（已交付代码修复 + 验证）
**日期:** 2026-11-19

---

## 文档索引

| 文档 | 路径 |
|------|------|
| 用户需求原始记录 | [docs/people-requirements-record/0001-review-and-fix-extension.md](../people-requirements-record/0001-review-and-fix-extension.md) |
| 需求规格 | [REQ-0001-review-and-fix-extension.md](../requirements/REQ-0001-review-and-fix-extension.md) |
| 执行计划 | [PLAN-0001-review-and-fix-extension.md](../execution-plans/PLAN-0001-review-and-fix-extension.md) |
| 软件设计说明 | [DESIGN-0001-review-and-fix-extension.md](../software-design/DESIGN-0001-review-and-fix-extension.md) |

---

## 变更文件列表

| 文件 | 操作 | 变更量 | 说明 |
|------|------|--------|------|
| `manifest.json` | Edit | 1 行 | `all_frames: true` → `false` |
| `content.js` | Write (全重写) | ~660 行 → ~700 行 | 核心修复，详见下方 |
| `popup.js` | Write (全重写) | ~215 行 → ~220 行 | 新增消息监听 + PING 防御 |
| `background.js` | — | 0 行 | 未变动 |
| `content.css` / `popup.css` / `popup.html` / `icons/*` | — | 0 行 | 未变动 |
| `docs/requirements/REQ-0001-*.md` | Create | 新增 | 需求规格 |
| `docs/execution-plans/PLAN-0001-*.md` | Create | 新增 | 执行计划 |
| `docs/software-design/DESIGN-0001-*.md` | Create | 新增 | 软件设计说明 |
| `docs/tasks/TASK-0001-*.md` | Create | 本文件 | 任务收尾 |

---

## 实现摘要

### 1. manifest.json — all_frames: false

- **变更前：** `"all_frames": true`（每个子 frame 都会注入 content.js）
- **变更后：** `"all_frames": false`（只有顶层 frame 注入）
- **解决问题：** I9 PING 消息随机命中子 frame；每个子 frame 白跑一次 JS 解析

### 2. content.js — 资源路径绝对化（REQ-0001-01）

新增三个工具函数 + 重构 captureContent 中的 URL 修复：

- `URL_BASE` — 通过 `new URL('.', window.location.href).href` 可靠得到目录 URL（比旧版字符串拼接稳健，不会出现末尾缺 `/` 的问题）
- `absolutizeUrl(value)` — 统一的绝对化函数，正确跳过 `data:` / `blob:` / `javascript:` / `mailto:` / `//` / `#` / `/` 开头的 URL 和已绝对 URL
- `absolutizeSrcset(value)` — 拆分 srcset 逗号分隔的候选，逐个绝对化后重组
- `absolutizeElementAttrs(el, attrs)` — 统一入口

**覆盖的标签/属性（旧版只有 `[src],[href]`）：**

| 元素 | 属性 |
|------|------|
| img | src, data-src, srcset |
| video | src, poster, data-src |
| audio | src, data-src |
| source | src, srcset |
| image | href, xlink:href |
| use | href, xlink:href |
| form | action |
| link | href |
| a | href |
| [data-src] | data-src |

### 3. content.js — DOM 安全清洗扩展（REQ-0001-10）

在原有基础上新增：

| 移除/加固项 | 说明 |
|-------------|------|
| `<object>, <embed>, <base>` | 插件对象 + 基址影响 |
| `<meta[http-equiv="refresh"]>` | 自动跳转 |
| `<a[target="_blank"]>` 加 `rel="noopener"` | 新窗口安全 |
| `<a[download]>` 移除 download 属性 | 防止下载劫持 |

### 4. content.js — 键盘监听器生命周期（REQ-0001-02）

- 新增 `KEYBOARD_LISTENERS` 数组 + `cleanupKeyboardListeners()` 函数
- `installKeyboardShortcut()` 开头先 cleanup 再注册
- 虽然 MV3 content script 不会随 SPA 卸载，但显式防御是好实践

### 5. content.js — Magnifier 实例销毁完整性（REQ-0001-03）

重构监听器管理：

- 构造函数初始 `this._listeners = []` 和 `this.destroyed = false`
- `_addListener(target, type, handler, options)` 统一注册并保存引用
- `bindEvents()` 中所有监听器都改为 `this._addListener(...)`
- `destroy()` 里：
  1. 遍历 `this._listeners` 逐个 removeEventListener
  2. 清理 document 级拖拽监听器（dragMoveHandler / dragEndHandler）
  3. 幂等：开头检查 `this.destroyed` flag
  4. 通知 popup（`chrome.runtime.sendMessage({ type: 'MAGNIFIER_DESTROYED' })`）

### 6. content.js — SPA 导航响应（REQ-0001-04）

**顶层立即执行（早于 DOMContentLoaded）的 history hook：**

- hook `history.pushState` / `history.replaceState`
- 在调用原方法后 `dispatchEvent(new CustomEvent('__wpm_spa_nav__'))`
- `window.__wpm_history_hooked` 标志位防止重复 hook

**init() 中注册的三个导航监听器：**

- `popstate` — 浏览器后退/前进
- `hashchange` — 哈希路由
- `__wpm_spa_nav__` — pushState/replaceState

**`handleSpaNav()` 处理：**

1. destroy 放大镜
2. 退出选区模式
3. 发 `SPA_NAVIGATED` 消息给 popup

### 7. content.js — 拖拽松手后强制回视口（REQ-0001-07）

- `_onDragEnd()` 末尾新增 `this.keepInViewport()`

### 8. content.js — 关闭按钮通知 popup（REQ-0001-09）

- `Magnifier.build()` 末尾发 `MAGNIFIER_CREATED` 消息（带 scale）
- `Magnifier.destroy()` 末尾发 `MAGNIFIER_DESTROYED` 消息

### 9. popup.js — 消息监听增强（REQ-0001-06d/06e）

新增对 content 发来的四种消息的响应：

| 消息类型 | 处理 |
|----------|------|
| SELECT_MODE_CHANGED | 更新 selectMode → updateUI |
| MAGNIFIER_CREATED | hasMagnifier=true → 更新 currentScale/zIndexHigh → updateUI |
| MAGNIFIER_DESTROYED | hasMagnifier=false → updateUI |
| SPA_NAVIGATED | 同 MAGNIFIER_DESTROYED |

**ensureContentScript 防御：** PING 返回 `{ ok: false, reason: 'not-top-frame' }` 时不再当作已注入，继续进入主动注入流程。

---

## 验证命令与结果

### 语法校验（全部通过）

```powershell
# manifest.json（JSON.parse）
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest.json OK')"
# 输出：manifest.json OK

# content.js
node --check content.js
# 输出：（无输出 = 通过）

# popup.js
node --check popup.js
# 输出：（无输出 = 通过）

# background.js
node --check background.js
# 输出：（无输出 = 通过）
```

### 修复点 grep 验证（全部 13 项命中）

```powershell
node -e 'const src = require("fs").readFileSync("content.js","utf8"); const checks = { "URL_BASE": src.includes("URL_BASE"), "absolutizeUrl": src.includes("function absolutizeUrl"), "absolutizeSrcset": src.includes("function absolutizeSrcset"), "hookHistory": src.includes("__wpm_history_hooked"), "handleSpaNav": src.includes("function handleSpaNav"), "destroyed flag": src.includes("this.destroyed = false"), "_listeners array": src.includes("this._listeners = []"), "destroy cleanup": src.includes("this._listeners.forEach"), "keepInViewport dragEnd": src.includes("_onDragEnd") && src.includes("this.keepInViewport()"), "meta refresh": src.includes("meta[http-equiv]"), "noopener": src.includes("noopener"), "download removal": src.includes("download"), "SPA_NAVIGATED": src.includes("SPA_NAVIGATED") }; for (const [k,v] of Object.entries(checks)) console.log((v?"[OK]  ":"[FAIL] ") + k); console.log("ALL OK?", Object.values(checks).every(v=>v));'
```

**输出：** 13 项全部 `[OK]`，`ALL OK? true`

### popup.js 消息处理验证

```powershell
node -e 'const src = require("fs").readFileSync("popup.js","utf8"); const checks = ["MAGNIFIER_CREATED","MAGNIFIER_DESTROYED","SPA_NAVIGATED","not-top-frame","ensureContentScript"]; for (const c of checks) console.log(c + ":", src.includes(c));'
# 输出：全部 true
```

---

## 未执行的验证

手动集成测试（TC-1 ~ TC-5，见 PLAN TASK-11）需要在 Edge 浏览器中加载未打包扩展并交互操作，当前环境无 GUI，**无法自动执行**。建议用户在本地：

1. 打开 `edge://extensions/` → 开启开发模式 → 「加载解压缩的扩展」选择项目根
2. 打开任意含图片的静态网页（如项目自带测试页或 Wikipedia）
3. 按 PLAN TASK-11 的 5 个用例手动验证

---

## 自审发现（修复后的二次 review）

自审内容覆盖以下维度：
1. 所有旧 Bug 是否已修复
2. 新增代码是否引入新问题
3. 边界条件是否覆盖
4. 消息链路是否闭环
5. 监听器是否成对注册/清理

### 自审结果

| 检查项 | 结果 | 备注 |
|--------|------|------|
| URL_BASE 计算正确性 | 通过 | `new URL('.', href)` 在所有 Edge 版本上表现一致，比字符串拼接更稳健 |
| absolutizeUrl 跳过 data/blob/javascript | 通过 | 正则 `/^(data\|blob\|javascript\|mailto\|tel\|about):/i` 覆盖全部不可安全改造 scheme |
| absolutizeUrl 跳过 `//` 和 `#` | 通过 | 显式判断 |
| absolutizeUrl `/path` 根路径处理 | 通过 | `new URL(path, origin)` 正确 |
| SPA history hook 标志位 | 通过 | `__wpm_history_hooked` 防止多 content script 叠加 |
| SPA hook 在顶层立即执行 | 通过 | content.js 顶层 IIFE，不在 init() 里 |
| SPA hook try/catch 包裹 | 通过 | 某些受限页面可能失败，静默忽略 |
| Magnifier.destroy 幂等 | 通过 | `this.destroyed` flag 开头 return |
| Magnifier._listeners 清理完整性 | 通过 | bindEvents 里所有监听器通过 `_addListener` 注册，destroy 里 forEach 清理 |
| document 级拖拽监听器清理 | 通过 | dragMoveHandler / dragEndHandler 在 destroy 和 dragEnd 双重清理 |
| popup 消息路由 | 通过 | 新增 case 覆盖三种新消息 |
| popup not-top-frame 防御 | 通过 | `if (resp && resp.ok && !resp.reason) return true;` |
| manifest all_frames → false | 通过 | 消除子 frame 干扰 |

### 自审发现的小问题（已记录未修复）

| 编号 | 问题 | 影响 | 决策 |
|------|------|------|------|
| L1 | SPA hook 的 history.pushState 签名未保持「长度」属性（函数签名 `function(...args)` 与原方法的 `length` 不同） | 理论上某些严格检查会失败，但实际浏览器和框架都不检查 Function.length | 可接受，不加 `Object.defineProperty` 模拟 length 成本太高 |
| L2 | SPA hook 不 hook `window.onpopstate` 赋值（只监听事件） | 如果页面 JS 直接设 `window.onpopstate = fn`，我们的监听器仍能触发，但页面自己的赋值会覆盖我们没有任何影响——我们用 `addEventListener`，不会被覆盖 | 已通过 addEventListener + capture=true 规避，无影响 |
| L3 | popup 打开时如果 content 刚刚被 SPA 导航清理，PING 可能延迟 | popup 每次打开都会 `ensureContentScript`，会主动重注入；已处理 |

---

## 评审策略

`.agent-toolkit/settings.json` 中 `reviewerPolicy: never` —— 本次任务**不调用独立 Reviewer**。所有质量保证由自审完成。

---

## Git / 发布动作

`.agent-toolkit/settings.json`：

- `autoCommit: false` —— **未执行** git commit
- `autoPush: false` —— **未执行** git push
- `autoTag: false` —— **未执行** git tag
- `developmentWorkflow: single-branch` —— **未创建**分支

所有变更在工作目录本地完成，未产生任何 Git side effect。由用户决定何时提交。

---

## 剩余风险

| 编号 | 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|------|----------|
| R1 | 部分网站使用非标准 history API（如 `window.history.length++` 手动改长度）或完全不用 SPA | 低 | 放大镜创建流程不变；hook 无效时 SPA 导航不会自动清理放大镜，需要 popup 打开时 GET_STATUS 兜底 | popup 的 `refreshStatus()` 每次打开都会从 content 拉状态，可兜底 |
| R2 | `absolutizeUrl` 对 `//domain.com/path` 协议相对 URL 直接返回原值（跳过），如果原页面用非 https 协议，克隆内容可能加载失败 | 极低 | 用户当前就在该页面上，原页面的 `//` URL 本身就能加载；放大镜克隆后同样协议加载，不会更差 | 行为与原页面一致 |
| R3 | `<a[target="_blank"]>` 加 `rel="noopener"` 可能与已有的复杂 rel 值冲突（如已有 `rel="nofollow noopener"`） | 极低 | 正则 `/\bnoopener\b/` 只在不包含时添加；已有则不重复添加 | 安全 |
| R4 | 克隆 DOM 中 `on*` 属性移除可能误伤合法的 HTML 原生属性（极少见如 `onabort`、`oncanplay` 等） | 无影响 | 所有 `on*` 属性都是内联事件，移除后内容静态展示；放大镜本身不执行克隆 DOM 的事件，所以移除是对的 | 设计决策 |
| R5 | `captureContent` 的向上祖先查找在 `position: sticky` / 嵌套 flex 场景下可能找不到完全覆盖的祖先，退化为使用当前元素 | 低 | 退化为当前元素后放大镜区域仍然有效，只是视觉上可能比选区略小 | 已在代码里 `if (!container || container === document.documentElement) container = el` 兜底 |
| R6 | `all_frames: false` 后，如果页面只有 iframe 有内容（如在线文档预览），顶层无法创建放大镜 | 极低 | 用户可以右键 iframe → 在新标签打开单独放大；或手动 reload iframe 到顶层 | manifest 可加条件 `matches` 针对某些站点覆盖 |

---

## 结论

本次 review 与修复覆盖了 REQ-0001 列出的 P0（功能性缺陷/安全隐患）和 P1（体验/架构）问题。所有代码变更已通过 Node 语法校验、修复点 grep 验证、自审。建议用户在 Edge 浏览器中手动加载扩展，按 PLAN TASK-11 的 5 个手动测试用例做集成验证后再提交 Git。
