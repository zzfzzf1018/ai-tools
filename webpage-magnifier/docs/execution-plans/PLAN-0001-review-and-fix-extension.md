# PLAN-0001 — Review 并修复 Edge 网页区域放大器扩展（执行计划）

**Task ID:** 0001
**Slug:** review-and-fix-extension
**关联需求:** REQ-0001
**来源:** docs/people-requirements-record/0001-review-and-fix-extension.md
**执行顺序:** 编号严格递增，每个任务完成后运行对应验证步骤

---

## 阶段一：基础加固

### TASK-01 — 修正 manifest.json 配置
- **目标:** 消除子 frame 冗余注入
- **动作:** 将 `all_frames: true` 改为 `false`
- **原因:** content.js 本身只在 top frame 工作，manifest 声明 `all_frames: true` 会让每个子 frame 都跑一次脚本（JS 解析 + 文件加载），白白浪费资源，且引入 PING 消息随机命中子 frame 的问题（I9）
- **验证:** 手动 reload 扩展后打开一个带 iframe 的页面（如 `about:blank` + 内嵌 iframe 的测试页），确认只有顶层 frame 有放大镜能力
- **风险:** 如果有页面只有 iframe 有内容（如某些在线文档预览），顶层 frame 空白则放大镜功能失效；但这是极端场景，且用户可以在 iframe 右键单独打开
- **依赖:** 无

### TASK-02 — 修复资源路径绝对化逻辑（I1）
- **目标:** 让 `captureContent` 中所有相对 URL 正确转换
- **文件:** `content.js` 中 `captureContent` 方法
- **子任务:**
  - TASK-02a: 重写 URL 基址计算，确保末尾有 `/`（`new URL('', window.location.href).pathname` 或 `window.location.origin + new URL('', window.location.href).pathname.replace(/\/[^\/]*$/, '/')`）
  - TASK-02b: 修复 `src` 处理——改用 `getAttribute('src')` 而非 `.src`（`.src` 已是浏览器解析后的绝对 URL，但我们需要判断原始值）
  - TASK-02c: 新增 `srcset` 处理——拆分逗号分隔的候选，逐个绝对化
  - TASK-02d: 新增 SVG `<image>` 和 `<use>` 的 `href` / `xlink:href` 处理
  - TASK-02e: 新增 `<form action>` 处理
  - TASK-02f: 新增 `data-src` / `poster` 处理
  - TASK-02g: 跳过 `data:` / `blob:` / `javascript:` / `#` / `//` 开头的 URL
- **验证:** 在一个包含相对路径图片的测试页面（如项目自带的静态 HTML）创建放大镜，确认图片加载成功
- **依赖:** TASK-01 完成（frame 问题隔离）

### TASK-03 — 扩展 DOM 安全清洗（I1、REQ-0001-10）
- **目标:** 彻底移除可执行/有风险的克隆 DOM 元素
- **新增移除:** `<object>` / `<embed>` / `<base>` / `<meta[http-equiv="refresh"]>`
- **修改:** `<a>` 标签添加 `rel="noopener"`；`<a download>` 移除 download 属性
- **保留移除:** `script` / `iframe` / `link[rel=stylesheet]` / `on*` 属性（已存在）
- **验证:** 克隆内容中 grep 不存在上述标签/属性
- **依赖:** TASK-02

---

## 阶段二：架构修复

### TASK-04 — 键盘监听器生命周期管理（I2）
- **目标:** 确保 keydown 监听器不会泄漏或叠加
- **动作:**
  - 将 `installKeyboardShortcut()` 返回值改为返回一个 cleanup 函数
  - 用模块级变量 `const KEYBOARD_SHORTCUT_HANDLER = null` 持有引用（实际只需防止重复注册）
  - `init()` 里先调用 cleanup 再注册
- **注意:** 当前 content script 在 SPA 里不会被卸载（MV3 content script 与页面生命周期绑定），所以 init 只跑一次；但显式防御是好实践
- **验证:** 在 SPA 中连续多次 Ctrl+Shift+M，每次只切换一次，不是 2 倍/3 倍触发
- **依赖:** 无

### TASK-05 — Magnifier 实例销毁完整性（I3、REQ-0001-03）
- **目标:** `destroy()` 是幂等且彻底的
- **动作:**
  - 在构造函数或 `bindEvents` 里，把所有监听器 handler 保存为实例字段
  - `destroy()` 里按字段逐个 removeEventListener
  - 保留 document 级拖拽监听器的清理（已有）
  - 加一个 `this.destroyed` flag，所有方法先检查，destroy 后调用都 return
- **验证:** 创建放大镜 → 关闭 → 用 Chrome DevTools 检查 document 上剩余的 mousemove/mouseup/keydown 监听器数量
- **依赖:** 无

### TASK-06 — 消息链路修复（I4、I15、REQ-0001-09）
- **目标:** 关键状态变化可靠同步到 popup 和 background
- **动作:**
  - TASK-06a: `Magnifier.destroy()` 里发 `MAGNIFIER_DESTROYED` 消息
  - TASK-06b: `createMagnifier()` 里发 `MAGNIFIER_CREATED` 消息（带 scale）
  - TASK-06c: `setScale()` / `toggleZIndex()` 里发对应状态变更消息
  - TASK-06d: popup.js 里监听这些新消息，实时更新 UI（不依赖 popup 重新打开）
  - TASK-06e: popup.js `ensureContentScript()` 里处理 `{ ok: false, reason: 'not-top-frame' }` 响应——忽略，继续当作顶层已就绪（因为 `all_frames` 已改为 false）
- **验证:** 打开 popup → 创建放大镜 → 在 content 里关闭放大镜 → popup 控制面板自动隐藏
- **依赖:** TASK-01（all_frames: false 后 top-frame 判断更干净）、TASK-05（destroy 才会发消息）

### TASK-07 — SPA 导航响应（I5、REQ-0001-04）
- **目标:** SPA 路由切换后放大镜自动销毁、状态重置
- **动作:**
  - hook `history.pushState` / `history.replaceState`，在调用原方法后分发自定义事件 `__wpm_spa_nav__`
  - 在 content.js 里监听 `popstate`、`hashchange` 和 `__wpm_spa_nav__`
  - 导航事件触发时：销毁放大镜、退出选区模式、发消息给 popup
- **注意:** hook history 要在 content script 顶层立即执行（不能等 DOMContentLoaded），否则会漏掉页面初始化时的 pushState
- **验证:** 在 SPA 页面（如 Vue/React 路由 demo）创建放大镜 → 路由切换 → 放大镜消失
- **依赖:** TASK-05、TASK-06

---

## 阶段三：体验修复

### TASK-08 — 拖拽松手后强制 keepInViewport（REQ-0001-07）
- **目标:** 防止放大镜被拖出可视区域松手后卡在边界外
- **动作:** `onDragEnd` 里调用 `this.keepInViewport()`
- **验证:** 拖到边缘松手，放大镜自动回视口内
- **依赖:** 无

### TASK-09 — 修复 PING 消息路由（I9）
- **目标:** popup 的 `ensureContentScript()` 不因子 frame 响应而误判
- **原因:** TASK-01 把 `all_frames` 改为 false 后，子 frame 不再注册 content script，PING 只会命中顶层——问题自动解决
- **动作:** TASK-01 完成后此问题自动消除，但仍需在 popup.js 里加防御逻辑：PING 返回非 ok 时直接进入注入流程
- **验证:** 在带 iframe 的页面打开 popup，PING 只命中顶层
- **依赖:** TASK-01

---

## 阶段四：验证与收尾

### TASK-10 — 语法校验
- **目标:** 所有变更通过语法检查
- **命令:**
  - `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest.json OK')"`
  - `node --check content.js`
  - `node --check popup.js`
  - `node --check background.js`
- **通过标准:** 无错误输出
- **依赖:** TASK-01 ~ TASK-09 全部完成

### TASK-11 — 手动集成测试
- **目标:** 验证核心交互无回归
- **测试用例:**
  - TC-1: 打开普通页面 → Ctrl+Shift+M → 拖拽选区 → 放大镜出现 → 图片可见
  - TC-2: 放大镜 → 拖拽到角落 → 松手 → 仍在视口内
  - TC-3: 放大镜 → 关闭按钮 → popup 自动隐藏控制面板
  - TC-4: SPA 页面 → 创建放大镜 → 路由切换 → 放大镜消失
  - TC-5: 放大镜 → 调整缩放 → 内容缩放正确、面板显示新百分比
- **依赖:** TASK-10 通过

### TASK-12 — 文档收尾
- **目标:** 创建 DESIGN 和 TASK 文档
- **动作:**
  - 创建 `docs/software-design/DESIGN-0001-review-and-fix-extension.md`
  - 创建 `docs/tasks/TASK-0001-review-and-fix-extension.md`
- **依赖:** TASK-11 完成

---

## 执行顺序总结

```
TASK-01 (manifest) ─┬─→ TASK-02 (资源路径) ─→ TASK-03 (安全清洗)
                    ├─→ TASK-09 (PING路由)
                    └─→ TASK-06 (消息链路) ─→ TASK-07 (SPA导航)

TASK-04 (键盘监听) ──┐
TASK-05 (销毁完整) ──┴──→ TASK-06 / TASK-07

TASK-08 (拖拽边界) ── 独立

全部完成 → TASK-10 (语法) → TASK-11 (集成) → TASK-12 (文档)
```

---

## 不执行的 Git 动作

根据 `.agent-toolkit/settings.json`：
- `autoCommit: false` —— 不执行 git commit
- `autoPush: false` —— 不执行 git push
- `autoTag: false` —— 不执行 git tag
- `reviewerPolicy: never` —— 不调用独立 Reviewer

所有变更在本地完成，由用户决定何时提交。
