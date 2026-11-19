# PLAN-0002 — 第二轮代码审查执行计划

**Task ID:** 0002
**Slug:** review-and-fix-extension-again
**关联 REQ:** REQ-0002-review-and-fix-extension-again.md
**日期:** 2026-11-19
**状态:** Approved

---

## 1. 总体策略

本轮在 REQ-0001 修复后代码的基础上，执行以下策略：

1. **先验证回归** — 确认上轮修复的 10 项关键点仍然存在且正确
2. **修复本轮 3 个 Bug** — URL_BASE 更新、createMagnifier 校验、background 竞态
3. **补充边界处理** — 记录但不修复（如 canvas 克隆），避免过度工程
4. **最终语法校验** — Node --check 全部文件

---

## 2. 任务分解

### TASK-1：回归验证（15 分钟）

**目标:** 确认上轮修复的 10 项关键点仍然存在

| 检查项 | 方法 | 工具 |
|--------|------|------|
| RGR-01 manifest all_frames | 读取 manifest.json | Read |
| RGR-02 top frame 双重保护 | grep window.top !== | Grep |
| RGR-03 SPA hook 位置 | grep __wpm_history_hooked | Grep |
| RGR-04 destroy 幂等 | grep this.destroyed | Grep |
| RGR-05 _addListener 覆盖率 | 检查 bindEvents → _addListener | Read |
| RGR-06 PING 防御 | grep ensureContentScript | Grep |
| RGR-07 四种消息覆盖 | 检查 popup.js switch | Read |
| RGR-08 安全清洗完整度 | grep 移除/加固项 | Grep |
| RGR-09 资源绝对化覆盖 | 检查 targets 数组 | Read |
| RGR-10 语法校验 | node --check 三个 JS | Shell |

**验证后如发现回归 → 先修复回归再进行后续任务**

### TASK-2：REQ-0002-01 — URL_BASE SPA 导航更新（20 分钟）

**修改文件:** content.js

**具体步骤:**

1. 将 `const URL_BASE` IIFE 改写为 `let URL_BASE = resolveBase()` + 顶层调用
2. 新增 `function refreshUrlBase() { URL_BASE = resolveBase(); }`
3. 改写 `absolutizeUrl()` 中用到的 `URL_BASE` 引用（闭包会自动访问最新值）
4. 在 `handleSpaNav()` 中开头调用 `refreshUrlBase()`
5. 验证：Node --check content.js

### TASK-3：REQ-0002-02 — createMagnifier 参数校验（10 分钟）

**修改文件:** content.js

**具体步骤:**

1. 在 `createMagnifier(rect, options)` 函数开头新增校验：
   ```js
   if (!rect || typeof rect !== 'object') return null;
   const required = ['left', 'top', 'width', 'height'];
   for (const k of required) {
     if (typeof rect[k] !== 'number' || !isFinite(rect[k])) return null;
   }
   if (rect.width <= 0 || rect.height <= 0) return null;
   ```
2. 在调用点（onSelectMouseUp、onMessage CREATE_MAGNIFIER）保持现有逻辑不变
3. build() 中也加一道防护：`if (!this.sourceRect || !isFinite(this.sourceRect.left)) { ... empty state ... }`
4. 验证：Node --check content.js

### TASK-4：REQ-0002-03 — background.js ensureInjected 竞态修复（15 分钟）

**修改文件:** background.js

**具体步骤:**

1. 在 `ensureInjected(tabId)` 成功后，发送 PING 并等待响应（带超时）
2. 新增 `async function waitForContent(tabId, timeout = 2000)`：
   - 发送 PING 并 await 响应
   - 超时后返回 false
3. 修改 chrome.commands.onCommand 处理流程：
   - ensureInjected → waitForContent(2000) → TOGGLE_SELECT_MODE
   - 等待失败则 warn 日志并放弃

### TASK-5：最终语法校验（5 分钟）

**执行命令:**

```powershell
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest.json: OK')"
node --check content.js  && echo "content.js: OK"
node --check popup.js    && echo "popup.js: OK"
node --check background.js && echo "background.js: OK"
```

### TASK-6：修复点 grep 验证（5 分钟）

执行 grep 命令验证所有修复点代码已就位：

- `refreshUrlBase` 存在
- `createMagnifier` 参数校验存在
- `waitForContent` 存在于 background.js

### TASK-7：自审与 Task 文档撰写（15 分钟）

- 自审所有改动
- 创建 TASK-0002 文档

---

## 3. 风险与缓解

| 编号 | 风险 | 影响 | 缓解 |
|------|------|------|------|
| RSK-1 | URL_BASE 更新后 absolutizeUrl 闭包可能没正确读取 | 资源路径错误 | absolutizeUrl 中 `const effectiveBase = base || URL_BASE` 引用的是同一个 URL_BASE 变量，let 可被重新赋值，闭包会读取最新值 |
| RSK-2 | createMagnifier 返回 null 时调用方未处理 | TypeError | 检查所有调用点：onSelectMouseUp 已用返回值或直接调用未返回检查；onMessage CREATE_MAGNIFIER 用了 await 但没检查返回值。需要在两处调用方加 null 检查 |
| RSK-3 | background.js waitForContent 超时时间太短 | 首次注入慢时误判 | 2000ms 足够；失败时有 warn 日志 |

---

## 4. 任务执行顺序

TASK-1（回归验证）→ TASK-2 ~ TASK-4（修复代码，顺序可互换但建议先 content.js 再 background.js）→ TASK-5（语法校验）→ TASK-6（grep 验证）→ TASK-7（自审 + Task 文档）
