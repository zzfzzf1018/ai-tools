# REQ-0005 — 修复扩展不可用问题并达到可封板状态

**Task ID：** 0005
**Slug：** fix-unusable-extension-and-seal
**日期：** 2026-11-24
**关联需求记录：** [docs/people-requirements-record/0005-fix-unusable-extension-and-seal.md](../people-requirements-record/0005-fix-unusable-extension-and-seal.md)
**对应计划：** [PLAN-0005](../execution-plans/PLAN-0005-fix-unusable-extension-and-seal.md)
**对应设计：** [DESIGN-0005](../software-design/DESIGN-0005-fix-unusable-extension-and-seal.md)

---

## 1. 背景与问题

用户反馈「这个项目完全不能用啊 全是问题」，要求仔细测试并修复到可以封板。静态审查与产物核查确认存在多个 P0 级缺陷，覆盖打包、样式、注入稳定性、快捷键与交互：

| # | 问题 | 影响 |
|---|------|------|
| 1 | `scripts/pack.ps1` 用 `Compress-Archive -Path $files` 打包，丢失 `icons/` 目录前缀 | zip 内为平铺 `icon16.png`，与 manifest `icons/icon16.png` 不符，Edge 报 `Couldn't load icon` |
| 2 | `.__wpm_select_box` 含 `display: none !important` | JS 的 inline `display:block` 无法覆盖 `!important`，拖拽时选框永远不可见 |
| 3 | `.__wpm_magnifier` 含 `overflow: hidden !important` | 选区较小时控制面板（含 ✕ 关闭按钮）被裁切 |
| 4 | 放大镜克隆内容可点击 | 拖动/点击误触链接与表单，页面跳转 |
| 5 | `content.js` 顶层 `const` + content 内 Ctrl+Shift+M 全局监听 | 重复注入抛 `Identifier has already been declared`；快捷键与 `chrome.commands` 双触发「开了又关」 |
| 6 | Esc 监听仅在 mousedown 拖拽时注册 | 进入选区模式后未拖拽按 Esc 无反应 |
| 7 | 任意 `pushState/replaceState` 都销毁放大镜 | 部分站点滚动即 pushState，放大镜被误清 |
| 8 | 克隆根节点强制 `padding: 0`、宽度口径不一致 | 有内边距的容器内容偏移、宽高被撑大 |
| 9 | `chrome.runtime.sendMessage` 无接收方时 Promise 拒绝未捕获 | 控制台出现未处理 rejection |
| 10 | manifest 使用 `Ctrl+Shift+M`（浏览器保留键）且声明未使用的 `storage` 权限 | 命令未分配、权限冗余 |

## 2. 编号需求

### REQ-1：打包脚本输出结构化 zip

- **REQ-1.1** `scripts/pack.ps1` 必须先逐个校验源文件存在；任一缺失时输出 `MISSING <path>` 并以退出码 1 结束，不得生成 zip。
- **REQ-1.2** 采用「临时 staging 目录 + 目录级打包」：复制文件到 staging 目录且保留 `icons/` 子目录，执行 `Compress-Archive -Path "$stageDir\*"`。
- **REQ-1.3** 打包完成后必须用 `System.IO.Compression` 读取 zip 条目，校验至少包含 `manifest.json`、`icons/icon16.png`、`icons/icon48.png`、`icons/icon128.png`；不满足时输出失败原因并以退出码 1 结束。
- **REQ-1.4** 校验结束后必须清理 staging 临时目录（成功与失败路径都要清理）。
- **REQ-1.5** 脚本执行完毕输出 zip 条目清单与文件信息，便于人工核对。

### REQ-2：修复选区与放大镜样式

- **REQ-2.1** `.__wpm_select_box` 不得声明 `display`（显隐完全由 JS inline style 控制）。
- **REQ-2.2** `.__wpm_magnifier` 不得声明 `overflow`，避免裁切控制面板；内容裁切职责保留在 `.__wpm_scale_wrap`。
- **REQ-2.3** `.__wpm_scale_wrap` 必须设置 `pointer-events: none !important`（只读透镜，禁止交互克隆内容），并设置 `border-radius: 5px !important`。
- **REQ-2.4** `.__wpm_panel` 改为完整圆角边框（`border: 1px solid rgba(41,121,255,.35)` 与 `border-radius: 6px`），不改变面板内部布局结构。

### REQ-3：修复 content script 稳定性与交互

- **REQ-3.1** 整个 `content.js` 包裹在 IIFE 中，并在入口设置严格模式与幂等守卫：`if (window.__wpm_loaded) return; window.__wpm_loaded = true;`，重复注入不得因顶层声明冲突抛错。
- **REQ-3.2** 删除 content 内 Ctrl+Shift+M 全局键盘监听（`installKeyboardShortcut`、`cleanupKeyboardListeners`、`KEYBOARD_LISTENERS` 及相关调用），快捷键只保留 `chrome.commands` 单一路径。
- **REQ-3.3** Esc 监听取代方案：进入选区模式时注册，退出选区模式时由统一清理函数移除；未拖拽时按 Esc 也能取消选区。
- **REQ-3.4** `handleSpaNav` 必须比较 `location.href` 与记录的 `lastHref`，仅在 URL 真正变化时刷新 base、销毁放大镜并广播 `SPA_NAVIGATED`。
- **REQ-3.5** `captureContent` 克隆根节点不得强制 `padding: 0`；必须设置 `boxSizing: border-box`；必须改写克隆根节点自身的 `id`（不仅后代）。
- **REQ-3.6** 放大镜本体任意位置可拖动：`mousedown` 若目标位于面板内则忽略，否则调用 `startDrag`；面板自身的 `stopPropagation` 保留；`_onDragMove` 必须调用 `e.preventDefault()`。
- **REQ-3.7** 新增 `notifyRuntime(msg)` 统一发送 runtime 消息并吞掉 Promise 拒绝，替换 content.js 中全部 `chrome.runtime.sendMessage` 调用点。
- **REQ-3.8** `enterSelectMode` / `createSelectOverlay` 挂载宿主必须使用 `document.body || document.documentElement`，body 缺失时不得报错。
- **REQ-3.9** 初始倍率自适应：若 `width/height × scale` 超过视口（四周各留 16px），将初始 scale 降到可容纳的最大值，但不得低于 `MIN_SCALE`；用户仍可通过滑杆调整；保留原有参数校验与 clamp。

### REQ-4：更新 manifest

- **REQ-4.1** `version` 更新为 `1.0.9`。
- **REQ-4.2** `toggle-select-mode` 的默认快捷键改为 `Ctrl+Shift+Y`。
- **REQ-4.3** 删除未使用的 `storage` 权限，保留 `activeTab`、`scripting`、`host_permissions`。
- **REQ-4.4** 除上述三项外不得改动 manifest 其他字段。

### REQ-5：同步 popup 文案

- **REQ-5.1** `popup.html` 与 `popup.js` 中所有 `Ctrl+Shift+M` 文案改为 `Ctrl+Shift+Y`。
- **REQ-5.2** 说明区补充「快捷键可在 `edge://extensions/shortcuts` 中修改」。

### REQ-6：增强 background 注入逻辑

- **REQ-6.1** `BLOCKED_PROTOCOLS` 补充 `chrome-extension://`、`devtools://`、`https://chromewebstore.google.com`、`https://microsoftedge.microsoft.com/addons`。
- **REQ-6.2** `insertCSS` 使用独立 try/catch，CSS 注入失败仅告警，不影响整体注入判定。

### REQ-7：同步文档

- **REQ-7.1** `README.md` 版本号更新为 v1.0.9，所有 `Ctrl+Shift+M` 改为 `Ctrl+Shift+Y`，使用说明补充快捷键可在 `edge://extensions/shortcuts` 修改；权限说明与移除 `storage` 后的 manifest 保持一致。
- **REQ-7.2** `CHANGELOG.md` 新增 `## [1.0.9] - 2026-11-24`，在「修复」中列出打包结构、选框不可见、快捷键保留冲突与双触发、重复注入崩溃、面板裁切、克隆内容误点击、Esc 失效、SPA 误销毁、克隆内边距错位九项。

## 3. 假设

1. 工作区 Git 分支为 `main`，`developmentWorkflow` 为 `single-branch`，本次不执行 commit / push / tag（用户未要求）。
2. 真实 Edge 端到端加载测试由用户执行；本任务完成静态校验、JSON 解析、打包结构与源码自查。
3. 放大镜的产品语义确定为「只读透镜」，克隆内容不接受鼠标交互，拖动改由放大镜本体承担。
4. 快捷键统一走 `chrome.commands`，`Ctrl+Shift+Y` 在 Chrome/Edge 默认未被占用。
5. 不新增依赖、不重写架构、不改动 `0001`–`0004` 既有文档与 `.agent-toolkit/`、`.trae/`、`.github/`。

## 4. 验收标准

- [ ] `node --check content.js`、`node --check popup.js`、`node --check background.js` 全部通过。
- [ ] `Get-Content -Raw manifest.json | ConvertFrom-Json | Out-Null` 无异常，且版本为 `1.0.9`、默认快捷键为 `Ctrl+Shift+Y`、无 `storage` 权限。
- [ ] 运行 `powershell -NoProfile -File .\scripts\pack.ps1` 退出码为 0，zip 条目包含 `icons/icon16.png`、`icons/icon48.png`、`icons/icon128.png`、`manifest.json` 且无平铺图标。
- [ ] `content.css` 中 `.__wpm_select_box` 无 `display` 声明，`.__wpm_magnifier` 无 `overflow` 声明，`.__wpm_scale_wrap` 含 `pointer-events: none`。
- [ ] `content.js` 已无 Ctrl+Shift+M 监听逻辑，含 `window.__wpm_loaded` 幂等守卫，全部 runtime 消息经 `notifyRuntime` 发送。
- [ ] 四份文档（REQ/PLAN/DESIGN/TASK）均使用编号 `0005` 与 slug `fix-unusable-extension-and-seal`，TASK 文档链接需求记录及前三份文档并记录实际验证命令与结果。
