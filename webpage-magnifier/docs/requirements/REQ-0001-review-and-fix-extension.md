# REQ-0001 — Review 并修复 Edge 网页区域放大器扩展

**Task ID:** 0001
**Slug:** review-and-fix-extension
**来源:** docs/people-requirements-record/0001-review-and-fix-extension.md
**语言:** zh-CN（settings.json 配置）
**评审策略:** never
**开发工作流:** single-branch

---

## 1. 背景与目标

本项目是一个 Edge 浏览器扩展（Manifest V3），允许用户在任意网页上框选区域、创建可拖动、可调节缩放比例的放大镜覆盖层。当前版本已实现核心功能，但需要一次系统性 review 以消除功能性 Bug、架构问题、安全隐患与体验缺陷。

本次任务聚焦于：**修复已知与可发现的问题**，不引入新功能。所有变更必须保持向后兼容，且通过语法校验。

---

## 2. 范围

**纳入：**
- `manifest.json` — MV3 清单声明优化
- `content.js` — 选区捕获、DOM 克隆、消息链路、SPA 兼容
- `content.css` — 放大镜/选区样式与宿主页面隔离
- `popup.js` — 弹窗消息通信、注入策略
- `background.js` — Service Worker 快捷键兜底注入
- `popup.html` / `popup.css` — 弹窗 UI（仅当发现问题时）

**不纳入：**
- 新增功能（多放大镜同时存在、历史快照、导出截图等）
- 重构为 TypeScript 或模块化打包
- i18n 国际化（当前硬编码中文）

---

## 3. 问题清单（按发现顺序编号）

### P0 — 必须修复（功能性缺陷/安全隐患）

| 编号 | 文件 | 问题 | 影响 |
|------|------|------|------|
| I1 | content.js:399 | 相对路径资源修复逻辑有多处 Bug：`base` 字符串拼接未加末尾 `/`、错误地使用 `n.src`（应 `getAttribute('src')`）、跳过了 `srcset` / `poster` / `data-src` / SVG `<image>` / `<use>` / `<form action>` | 克隆后的图片、SVG、表单提交地址断链；SPA 内部锚点 URL 错误改造 |
| I2 | content.js:103-112 | `installKeyboardShortcut()` 注册的 `keydown` 监听器永远不清理（无 `cleanupKeyboard()`）。SPA 多页导航后会重复注册；`destroy()` 也不清理 | 同一页面生命周期内多次调用 init 会叠加监听器；页面切换后旧监听器仍在执行 |
| I3 | content.js:551-563 | `Magnifier.destroy()` 只销毁拖拽相关监听器；面板上通过箭头函数绑定的监听器（drag handle、range input、zBtn、closeBtn）未被显式清理；此外当 `this.dragState` 为 null 时 mousemove/mouseup 可能已从 document 移除过，但没有显式 try 保护 | 理论上 `el.remove()` 会连带 GC 子节点监听器，但 content script 隔离环境中箭头函数闭包仍持有 `this` 引用，延迟 GC；需要防御式清理 |
| I4 | content.js:122 / 232 / 245 | 多处 `chrome.runtime.sendMessage()` 以 `.catch(() => {})` 静默吞掉错误，但 SPA 导航后 background SW 可能已重建，消息发送会失败，popup UI 状态与 content 实际状态不一致 | 关键状态同步丢失，popup 显示与实际不符 |
| I5 | content.js:567-570 | 只有当 `document.readyState === 'loading'` 时才挂 `DOMContentLoaded` 监听，使用 `{ once: true }`。`init()` 内部注册 `onMessage`、键盘监听后没有对 SPA 导航做任何处理；`RESPAWN` 消息处理体为空 | SPA 路由切换后 DOM 重渲染，但 content script 全局状态（selectMode / magnifier / DOM 节点引用）已失效却不清空；新页面上选区 overlay / 放大镜节点已不在 DOM 但引用仍在 |
| I6 | content.js:45-50 | `onMessage` 中 `window.top !== window.self` 判断——在嵌套 iframe 场景下（a.frame > b.frame > content frame），b 里的 top !== self 为 false 但 a 里的 top === self。需要同时在 init() 和 onMessage 里做双重判断，目前 init() 只判断一次，onMessage 每次都判断。但 init() 的一次性判断依赖页面初载时 frame 关系稳定，SPA 不会改变 frame 层级——实际这个问题影响不大，保留 | —— |
| I7 | content.js:465-468 | `startDrag()` 里 document 级 mousemove/mouseup 监听器没有考虑浏览器全屏、窗口失焦、页面切换等场景；`onDragEnd` 内 `this.dragState` 如果已被外部置 null（虽然当前不会），会遗留 document 监听器 | 低概率泄漏 |
| I8 | content.js:282 | `captureContent(pageRect)` 在选区完全落在 `position: sticky` / `position: fixed` / transform scale 元素内部时，祖先向上查找的 `getBoundingClientRect` 包含了 transform 后的视觉位移，但后续 `clone.style.left/top` 计算未考虑祖先的 transform-origin、rotate、skew | 克隆元素的视觉位置与原选区偏移 |
| I9 | popup.js:55-77 | `ensureContentScript()` 在已注入时走「PING → 直接返回 true」路径，不处理 PING 返回 `{ ok: false, reason: 'not-top-frame' }` 这种子 frame 响应——当前因为 `all_frames: true` 导致所有子 frame 都注册了 content，PING 会随机命中某个子 frame | 弹窗 UI 可能拿到子 frame 的状态，与顶层不一致 |

### P1 — 应该修复（体验/架构）

| 编号 | 文件 | 问题 |
|------|------|------|
| I10 | content.js:168-175 | `createSelectOverlay()` 把 overlay 挂到 `document.body`，如果页面存在 `overflow: hidden` 的根容器，overlay 可能被裁切；选区 `position: fixed` 依赖 viewport，OK，但创建时机要确保 body 存在 |
| I11 | content.js:532-549 | `keepInViewport()` 用 `getBoundingClientRect()` 取位置，然后写回 `style.left`（绝对 px），但如果页面有 `transform: scale` 的祖先，`position: fixed` 参照系会被扭曲，位置会偏移 |
| I12 | content.css:67-72 | `__wpm_scale_wrap` 有 `transition: transform 0.08s ease-out`，但放大镜外层 `__wpm_magnifier` 没有过渡，拖拽时会有「scale_wrap 先到位、外层再到位」的错序视觉 |
| I13 | manifest.json:37 | `all_frames: true` 与代码中「仅 top frame 工作」的设计意图矛盾；当前 content.js 通过 init 里的 `window.top !== window.self` 早退，但每个子 frame 仍然跑了一次脚本（JS 解析 + 文件 I/O） |
| I14 | popup.html:11 / 15 / 34 / 38 | 使用 emoji（🔍🎯⏹⬆️⬇️🗑）作为 UI 图标，popup 面板在某些系统/字体下可能渲染为空白方框 |
| I15 | content.js:450 | 关闭按钮 `closeBtn` 点击后只调 `this.destroy()`，不会通知 popup 更新状态；popup 下一次打开才会看到状态变化 |
| I16 | content.js:274 | 放大镜 `zIndexHigh` 默认 true，当页面用了 `position: fixed; z-index: 2147483647` 的 Modal（如钉钉、飞书、GitHub Actions 日志面板），放大镜会被 Modal 压住但 `toggleZIndex()` 只有「置顶」和「置底」两档，没有「同层以上」的策略 |

---

## 4. 需求规格

### 4.1 核心修复

**REQ-0001-01 — 资源路径绝对化**
- 必须修复 I1 中的所有相对 URL 缺陷
- 修复规则：`src` / `href` / `srcset` / `poster` / `data-src` / `<image xlink:href>` / `<use xlink:href>` / `<form action>` 都要处理
- 跳过 `data:` / `blob:` / `javascript:` / `#fragment`
- 当原 URL 已是绝对协议（`http://` / `https://` / `//`）时保持不变
- SVG 的 `<image>` 和 `<use>` 标签通过 `xlink:href` 或 `href` 引用，都要处理
- `srcset` 中有多个候选 URL，需要拆分后逐个绝对化
- **验收标准：** 克隆后的放大镜内图片可正常加载、SVG 可正常渲染、表单 action 指向绝对地址

**REQ-0001-02 — 键盘监听器生命周期管理**
- `installKeyboardShortcut()` 返回一个清理函数，destroy 时调用
- 当放大镜被关闭或退出选区模式时，若不再需要快捷键则按需清理（当前设计下快捷键始终有用，所以不清理，但要显式持有引用避免 GC 闭包泄漏）
- SPA 场景：init 仅执行一次（content script 不会被 SPA 卸载），但显式持有引用是好实践
- **验收标准：** 同一页面多次触发 init 不会叠加 keydown 监听器；`destroyAllMagnifiers()` 后监听器数量恢复

**REQ-0001-03 — Magnifier 实例销毁完整性**
- `Magnifier.destroy()` 必须清理：
  - document 上挂的 mousemove / mouseup 拖拽监听器
  - 内部元素上的所有 addEventListener （drag handle、range、zBtn、closeBtn、panel mousedown/click、el mousedown）
  - 清除箭头函数绑定的 `this.onDragMove` / `this.onDragEnd` 引用
- 所有清理操作要幂等（多次 destroy 不会报错）
- **验收标准：** 使用 `querySelectorAll('*')` 遍历子元素逐个 removeEventListener 不可行（拿不到监听器引用），所以正确做法是把监听器引用保存到实例字段

**REQ-0001-04 — SPA 导航响应**
- 监听 `popstate` 和 `hashchange`，SPA 导航时：
  1. 销毁现存放大镜
  2. 重置 `selectMode` / `selectStart` / `magnifier` 全局状态
  3. 通知 popup
- 对于需要 `history.pushState` 才能切的 SPA（Vue Router 默认模式），监听 `popstate` 不够——需要 hook `history.pushState` / `history.replaceState`
- **验收标准：** SPA 导航到新页面后，放大镜不残留；popup 再次打开能正确反映新页面状态

**REQ-0001-05 — Top-frame-only 消息路由强化**
- `ensureContentScript()` 在 PING 后要检查返回值的 `ok` 字段；如果返回 `not-top-frame`，忽略并继续注入（或直接当作已就绪——因为 `all_frames: true` 意味着顶层肯定也已注入）
- 建议：把 `manifest.json` 的 `all_frames` 改为 `false`，让 content script 只在顶层 frame 注入，从根源上消除子 frame 干扰
- **验收标准：** popup.GET_STATUS 返回的永远是顶层状态，与手动在顶层 console 看到的一致

### 4.2 体验修复

**REQ-0001-06 — DOM 克隆 transform 偏移**
- `captureContent` 里向上找覆盖祖先时，如果祖先有 `transform: scale(...)`，`getBoundingClientRect()` 返回的是视觉 rect；`absLeft = origBR.left + scrollX` 已包含缩放偏移，后续 `clone.style.left = (absLeft - pageRect.left)` 的计算是正确的
- 但如果页面缩放导致 `transform-origin` 不是 top-left，偏移计算会出错；可以检测 `transform` 字符串，非 scale 时退化为 `getBoundingClientRect` 直接当 absolute 坐标用
- **验收标准：** 放大镜内容位置与选区对齐误差 ≤ 2px

**REQ-0001-07 — 拖拽边界保护**
- 拖拽结束 `onDragEnd` 时也调用 `keepInViewport()`，防止拖出可视区域松手后放大镜卡在边界外
- **验收标准：** 拖拽松手后放大镜始终在视口内

**REQ-0001-08 — keepInViewport 绝对定位修复**
- 当前 `keepInViewport` 用 `getBoundingClientRect()` 取 left/top 后写回 `style.left`，在有祖先 transform 的场景下 `style.left` 是绝对 px，但 `getBoundingClientRect` 返回的也是相对于视口的 px（fixed 定位不被祖先 transform 影响——因为外层 `position: fixed`）
- 重新验证：外层 `__wpm_magnifier` 是 `position: fixed`，不受祖先 transform 影响，所以当前实现正确；I11 实际不成立——**标记为已排除**

**REQ-0001-09 — 关闭按钮通知 popup**
- `Magnifier.destroy()` 在自己主动关闭（close 按钮）时，要通过 `chrome.runtime.sendMessage({ type: 'MAGNIFIER_DESTROYED' })` 通知 popup
- 全局 `magnifier` 变量置 null 后发消息
- **验收标准：** popup 监听 `MAGNIFIER_DESTROYED`，收到后隐藏控制面板

### 4.3 安全加固

**REQ-0001-10 — DOM 克隆清洗扩展**
- 当前只移除 `script` / `iframe` / `link[rel=stylesheet]`，还需要移除：
  - `<object>` / `<embed>` —— 插件对象
  - `<form>` 中的 `<button type="submit">` —— 防止误触提交
  - 所有带 `target="_blank"` 且无 `rel="noopener"` 的 `<a>` —— 加 `rel="noopener"`
  - 带 `download` 属性的 `<a>` —— 移除 download 属性（防止下载劫持）
  - `<meta http-equiv="refresh">` —— 防止自动跳转
  - `<base>` —— 防止影响相对路径解析（注意我们已经手动绝对化，但移除更安全）
- **验收标准：** 克隆内容中不存在可执行脚本、插件对象、自动跳转元素

---

## 5. 假设

- A1：Node.js 环境可用（用于 JSON 解析、JS 语法校验）
- A2：Edge 浏览器版本支持 Manifest V3（当前 Edge 基于 Chromium，版本 ≥ 88 满足）
- A3：`icons/*.png` 文件已存在且尺寸正确（Glob 已确认）
- A4：`all_frames: true` 改为 `false` 不影响功能——content script 在顶层 frame 运行已满足需求，不需要对子 frame 也注入
- A5：SPA hook `history.pushState` / `history.replaceState` 不会被站点自身的相同 hook 破坏

---

## 6. 验收标准（总体）

1. **语法校验通过：** `manifest.json` 可被 `JSON.parse` 解析；所有 `.js` 文件可被 Node 的 `--check` 或 `Function()` 构造函数解析
2. **资源修复：** 放大镜内所有相对路径图片/链接在克隆后指向绝对 URL，图片能正常显示
3. **SPA 兼容：** SPA 路由切换后放大镜自动销毁，popup 能正确反映状态
4. **销毁完整性：** 手动调用 `destroyAllMagnifiers()` 后，document 上无残留的 mousemove/mouseup/keydown 监听器
5. **安全清洗：** 克隆 DOM 中移除了 script/iframe/object/embed/base/meta refresh/内联事件处理器
6. **消息可靠：** popup 关闭按钮、内容脚本关闭按钮、SPA 导航三条路径都能同步通知 popup
7. **拖拽边界：** 拖拽放大镜松手后始终在视口内

---

## 7. 不在本次范围

- 多放大镜同时存在
- 历史快照 / 撤销
- 放大镜内容随原页面实时更新
- 导出截图功能
- i18n / 国际化
- TypeScript 重构
- 将放大镜内容渲染到 `<canvas>`（安全彻底但实现成本高）
