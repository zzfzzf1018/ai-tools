# TASK-0005 — 修复扩展不可用问题并达到可封板状态

**Task ID：** 0005
**Slug：** fix-unusable-extension-and-seal
**日期：** 2026-11-24
**状态：** Completed
**工作流：** single-branch（main）
**评审策略：** never（settings 配置，本次未调用独立 Reviewer）

---

## 关联文档

| 类型 | 路径 |
|------|------|
| 原始需求记录 | [docs/people-requirements-record/0005-fix-unusable-extension-and-seal.md](../people-requirements-record/0005-fix-unusable-extension-and-seal.md) |
| 需求规格 | [docs/requirements/REQ-0005-fix-unusable-extension-and-seal.md](../requirements/REQ-0005-fix-unusable-extension-and-seal.md) |
| 执行计划 | [docs/execution-plans/PLAN-0005-fix-unusable-extension-and-seal.md](../execution-plans/PLAN-0005-fix-unusable-extension-and-seal.md) |
| 软件设计 | [docs/software-design/DESIGN-0005-fix-unusable-extension-and-seal.md](../software-design/DESIGN-0005-fix-unusable-extension-and-seal.md) |

---

## 实施概览

针对需求记录中的 10 项根因逐条修复，未改变扩展整体架构、未新增依赖、未改动 `0001`–`0004` 既有文档与 `.agent-toolkit/`、`.trae/`、`.github/`。

修复主线：

1. 打包产物结构正确（staging + 条目校验 + 正斜杠规范化）
2. 选区选框可见、面板不被裁切、克隆内容不可交互
3. content script 幂等注入、快捷键单一来源、Esc 生命周期正确、SPA 判定准确、克隆对齐
4. manifest 版本/快捷键/权限同步
5. popup、background、README、CHANGELOG 同步

---

## 变更文件清单

### 修改（9 个）

| # | 路径 | 说明 |
|---|------|------|
| 1 | `c:\flying\ai-tools\webpage-magnifier\scripts\pack.ps1` | staging 目录 + 目录级打包 + zip 条目校验 + 正斜杠规范化；UTF-8 BOM 保证 Windows PowerShell 5.1 正确解析中文 |
| 2 | `c:\flying\ai-tools\webpage-magnifier\content.css` | 删除选框 `display`、删除外层 `overflow` 裁切、scale_wrap 只读透镜与圆角、面板完整圆角边框 |
| 3 | `c:\flying\ai-tools\webpage-magnifier\content.js` | IIFE + 幂等守卫、移除 content 快捷键、Esc 生命周期、SPA href 判定、克隆对齐、本体拖动、notifyRuntime、宿主兜底、初始倍率自适应、`positionPanel` 面板视口收敛 |
| 4 | `c:\flying\ai-tools\webpage-magnifier\manifest.json` | 版本 1.0.9、默认键 Ctrl+Shift+Y、移除 storage |
| 5 | `c:\flying\ai-tools\webpage-magnifier\popup.html` | 快捷键文案与 `edge://extensions/shortcuts` 提示 |
| 6 | `c:\flying\ai-tools\webpage-magnifier\popup.js` | 按钮文案改为 Ctrl+Shift+Y |
| 7 | `c:\flying\ai-tools\webpage-magnifier\background.js` | 补充受限协议、insertCSS 独立容错 |
| 8 | `c:\flying\ai-tools\webpage-magnifier\README.md` | v1.0.9、快捷键与改键说明、拖拽说明、权限说明同步 |
| 9 | `c:\flying\ai-tools\webpage-magnifier\CHANGELOG.md` | 新增 `[1.0.9] - 2026-11-24` 修复条目 |

### 新增（4 份文档）

`REQ-0005`、`PLAN-0005`、`DESIGN-0005`、`TASK-0005`（本文件），均为编号 0005 与 slug `fix-unusable-extension-and-seal`。

### 构建产物

`c:\flying\ai-tools\webpage-magnifier\webpage-magnifier.zip`（被 `.gitignore` 的 `*.zip` 排除，不纳入版本控制）。

---

## 验证命令与真实结果

### 1. JS 语法检查

```powershell
node --check content.js
node --check popup.js
node --check background.js
```

结果：三条命令退出码均为 0，输出 `content.js exit=0`、`popup.js exit=0`、`background.js exit=0`。

### 2. manifest.json 解析

```powershell
Get-Content -Raw manifest.json | ConvertFrom-Json | Out-Null
```

结果：退出码 0，无异常。解析后确认 `version: 1.0.9`、`permissions: {activeTab, scripting}`。

### 3. 打包脚本与 zip 结构

```powershell
powershell -NoProfile -File .\scripts\pack.ps1
```

结果：退出码 0，输出：

```
OK  manifest.json
OK  content.js
OK  content.css
OK  popup.html
OK  popup.js
OK  popup.css
OK  background.js
OK  icons/icon16.png
OK  icons/icon48.png
OK  icons/icon128.png
--- zip 条目 ---
ZIP  icons/icon128.png
ZIP  icons/icon16.png
ZIP  icons/icon48.png
ZIP  background.js
ZIP  content.css
ZIP  content.js
ZIP  manifest.json
ZIP  popup.css
ZIP  popup.html
ZIP  popup.js
--- 打包校验通过 ---
```

独立读取 zip（`System.IO.Compression.ZipFile`）复核：

```
ENTRY background.js
ENTRY content.css
ENTRY content.js
ENTRY icons/icon128.png
ENTRY icons/icon16.png
ENTRY icons/icon48.png
ENTRY manifest.json
ENTRY popup.css
ENTRY popup.html
ENTRY popup.js
icons/icon16.png=True; icons/icon48.png=True; icons/icon128.png=True; manifest.json=True; backslashEntries=0
```

**过程中发现并修复的额外缺陷：** Windows PowerShell 5.1 的 `Compress-Archive` 即使使用 staging 目录，仍把 zip 条目分隔符写成反斜杠（`icons\icon16.png`），Chromium 系浏览器按 zip 规范只认正斜杠，仍会找不到图标。脚本已增加「ZipArchive 重建条目并统一为正斜杠」步骤，最终 `backslashEntries=0`。

**编码注意：** 脚本含中文注释/输出，首次以无 BOM UTF-8 保存时 Windows PowerShell 5.1 按 ANSI 读取导致解析失败（`The string is missing the terminator`）。已改为 UTF-8 with BOM（`EF BB BF`），`powershell -NoProfile -File` 可正常执行。

### 4. content.css 自查

PowerShell 正则提取 CSS 规则块后检查：

```
select_box has display declaration: False
magnifier has overflow declaration: False
scale_wrap has pointer-events none: True
scale_wrap has border-radius 5px: True
```

即 `.__wpm_select_box` 已无 `display` 声明，`.__wpm_magnifier` 已无 `overflow` 声明。

### 5. content.js 自查

```
content.js has __wpm_loaded guard: True
content.js has ctrl+shift+m handler: False
content.js defines notifyRuntime: True
actual sendMessage invocations: 1
notifyRuntime call sites: 7
```

即已加 IIFE 幂等守卫、已无 Ctrl+Shift+M 监听、全部 runtime 消息经 `notifyRuntime`（唯一 `sendMessage` 调用位于该辅助函数内部）。

### 6. popup / background / 文档联动

```
bg insertCSS separate try: True
bg chromewebstore blocked: True
bg edge addons blocked: True
bg devtools blocked: True
popup.js has Ctrl+Shift+Y: True
popup.html has shortcuts hint: True
README v1.0.9: True
CHANGELOG 1.0.9: True
```

### 7. 真实 Edge 端到端验证（Orchestrator 复核）

Coder 交付后由 Orchestrator 用真实 Edge 加载解压扩展执行端到端测试（临时测试目录 `%TEMP%\wpm-e2e`，不进入仓库）：

- 启动方式：`msedge --user-data-dir=<临时 profile> --load-extension=<扩展目录> --disable-extensions-except=<扩展目录> --remote-debugging-port=9333 http://127.0.0.1:8777/test.html`
- 驱动方式：CDP `Runtime.evaluate` 调用真实 `chrome.tabs.sendMessage` / `chrome.commands.getAll`，并用 `Input.dispatchMouseEvent` / `dispatchKeyEvent` 派发真实鼠标键盘事件；页面为本地静态测试页（含卡片、链接、内边距）
- 结果：**30/30 断言全部通过**，关键证据：

| 断言 | 实测 |
|------|------|
| 扩展加载 + SW 可访问 | 通过 |
| 快捷键已分配 | `{"name":"toggle-select-mode","shortcut":"Ctrl+Shift+Y"}` |
| PING / GET_STATUS | `{"ok":true,"selectMode":false,"hasMagnifier":false}` |
| 选区遮罩 | 铺满视口 1378×809，`z-index:2147483647` |
| 拖拽中选框 | `display=block`，551×299 与拖拽一致（修复前恒为 none） |
| 放大镜创建 | 1102×598 = 选区 551×299 × 2x |
| 面板/关闭按钮 | 完整在视口内，`elementFromPoint` 命中 `__wpm_btn_close` |
| 只读透镜 | `pointer-events:none`，点击不跳转（href 未变） |
| 本体拖动 | (207,146) → (127,106)，位移 −80/−40 精确 |
| 3x 缩放 | 宽度 1653，面板/关闭按钮仍在视口内且可命中 |
| 点击 ✕ | 放大镜移除 |
| 克隆保真 | 根节点 `padding-top:16px`、`box-sizing:border-box`、`id=__wpm_cloned_0` |
| 未拖拽按 Esc | `selectMode:false` 且遮罩移除 |
| 连续两次注入 content.js | 无重复声明错误，PING 正常，TOGGLE 仍单次切换 |
| 控制台 | 无 JS error |

E2E 过程中发现并补充修复一个 Coder 未覆盖的真实缺陷：`SET_SCALE` 到 3x 时放大镜宽度超出视口，面板被推到屏幕外导致关闭按钮不可点。已新增 `Magnifier.positionPanel()`（见 DESIGN-0005 §4.10），在创建/缩放/拖动结束/窗口 resize 时把面板收敛进视口，并复测通过。

### 8. zip 安装校验

```
Expand-Archive webpage-magnifier.zip → %TEMP%\wpm-zipcheck
msedge --load-extension=<解压目录> ...
OK  扩展已从 zip 解压目录加载：网页区域放大器|1.0.9
OK  zip 安装后的 content script 正常响应（tabId=...）
==== zip 安装校验通过 ====
```

即修复后的 zip 不再出现 `Couldn't load icon`，可直接分发/上架。

---

## 自审结论

| 自审项 | 结果 |
|--------|------|
| REQ-1 打包：缺失即中止、staging 保目录、条目校验、清理临时目录 | 通过（实跑退出码 0，条目含 `icons/` 前缀） |
| REQ-2 样式：选框显隐、外层不裁切、只读透镜、面板圆角 | 通过（正则块级检查） |
| REQ-3 content：IIFE 守卫、快捷键移除、Esc 生命周期、SPA 判定、克隆对齐、拖动、notifyRuntime、宿主兜底、初始倍率 | 通过（逐项对照 diff 与语法检查） |
| REQ-4 manifest：仅改版本/快捷键/权限 | 通过（diff 仅 3 处） |
| REQ-5 popup 文案 | 通过（按钮与说明区均改为 Y，新增改键提示） |
| REQ-6 background 受限协议与 CSS 容错 | 通过（布尔检查全为 True） |
| REQ-7 文档同步 | 通过（版本、快捷键、权限说明、CHANGELOG 条目齐备） |
| 无额外重构 / 无新增依赖 | 通过（diff 仅限目标文件） |
| 越界改动检查 | 通过（未触碰 `.agent-toolkit/`、`.trae/`、`.github/` 与 `0001`–`0004` 文档） |
| 选框初始状态 | 通过（创建 overlay 时以内联 `display:none` 隐藏，避免左上角 4x4 虚线残影） |

---

## 独立评审状态

`reviewerPolicy: never`，未调用独立 Reviewer，也没有任何独立评审结论。本任务的验证结论均来自上述本地命令与自查。

---

## Git 与 Release 动作

| 动作 | 执行状态 | 说明 |
|------|----------|------|
| git add | 未执行 | 用户未要求 |
| git commit | 未执行 | 用户未要求（settings `autoCommit: true` 但本次以用户意图为准） |
| git push | 未执行 | 用户未要求 |
| git tag | 未执行 | 用户未要求 |
| GitHub Release | 未触发 | 无 tag 推送 |

**Git 动作：无（用户未要求）。**

`git status --porcelain` 当前显示 9 个修改文件 + 4 个新增文档（均为本次交付），无其他意外改动。

---

## 剩余风险

| # | 风险 | 等级 | 说明 | 缓解建议 |
|---|------|------|------|----------|
| 1 | 扩展重载前已打开的旧标签页 | 中 | 旧 content script 的扩展上下文随重载失效；刷新页面即可恢复。已用连续两次 `executeScript` 注入验证幂等，不会再出现重复声明崩溃 | 刷新页面；无需额外操作 |
| 2 | 移除外层 `overflow` 后 1px 边框与内容对齐 | 低 | 外层 border-box 与内层未缩放宽度相差 2px，可能视觉上轻微贴边 | 如出现 1–2px 视觉瑕疵，可调整 `scaleWrap` 尺寸或外边距 |
| 3 | 初始倍率自动下调 | 低 | 选区接近视口大小时初始倍率可能低于 200% | 面板滑杆与 popup 均可随时调回 |
| 4 | Esc 捕获阶段 `preventDefault` | 极低 | 可能阻止宿主页面自身的 Esc 处理（仅选区模式期间） | 选区模式为短暂交互态，可接受 |
| 5 | 打包脚本依赖 `.NET Framework` 的 `System.IO.Compression` | 极低 | Windows PowerShell 5.1 与 PowerShell 7 均自带该程序集 | 已在本机实测通过 |
