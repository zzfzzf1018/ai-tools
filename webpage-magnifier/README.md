# 网页区域放大器（Edge 浏览器扩展）

> 版本 **v1.0.0** — 选中网页任意区域，创建可拖拽、可缩放、可切换层级的放大镜覆盖层。

---

## 目录

- [功能列表](#功能列表)
- [安装步骤](#安装步骤)
- [使用说明](#使用说明)
- [开发指南](#开发指南)
  - [Manifest V3 结构](#manifest-v3-结构)
  - [Content Script 职责](#content-script-职责)
  - [Background Service Worker 职责](#background-service-worker-职责)
  - [Popup 职责](#popup-职责)
  - [消息链路协议](#消息链路协议)
  - [SPA / iframe 兼容策略](#spa--iframe-兼容策略)
- [目录结构](#目录结构)
- [已知限制](#已知限制)
- [权限说明](#权限说明)

---

## 功能列表

| # | 功能 | 说明 |
|---|------|------|
| 1 | **选区放大** | 激活选区模式后在页面上拖拽矩形，松开自动为该区域创建放大镜覆盖层 |
| 2 | **缩放调节** | 放大镜面板内置滑块，支持 1.0x ~ 5.0x 步长 0.1 的缩放，保持右上角锚点 |
| 3 | **拖拽移动** | 放大镜面板顶部手柄（⋮⋮）可拖动放大镜到页面任意位置 |
| 4 | **层级切换** | "置顶"按钮在 `z-index: 2147483647` 和 `z-index: 1` 之间切换 |
| 5 | **快捷键** | `Ctrl+Shift+M` 一键开启/关闭选区模式，`Esc` 在选区模式中取消 |

---

## 安装步骤

### 方式一：开发者模式（推荐本地调试）

1. 打开 Edge 浏览器，地址栏输入 `edge://extensions`
2. 右上角开启 **"开发者模式"**
3. 点击 **"加载解压缩"** 按钮
4. 选择本项目根目录（包含 `manifest.json` 的目录）
5. 扩展出现在扩展列表中，可固定到工具栏

### 方式二：打包安装

1. 在项目根目录运行 PowerShell 脚本打包：
   ```powershell
   .\scripts\pack.ps1
   ```
2. 得到 `webpage-magnifier.zip`（安装前需解压）
3. 解压后按方式一的步骤加载解压目录

---

## 使用说明

### 启动选区模式

- **快捷键**：`Ctrl+Shift+M`（默认）
- **Popup 按钮**：点击工具栏扩展图标，在弹窗中点击"开始选区"按钮

进入选区模式后，页面上会出现半透明蓝色遮罩，鼠标指针变为十字线。

### 框选区域

1. 在页面上**按住鼠标左键**拖拽出一个矩形区域
2. 松开鼠标 — 自动创建放大镜覆盖层
3. 选区太小（宽/高 < 4px）时不会创建放大镜

### 调整放大镜

- **缩放**：拖动面板上的滑块，或在 Popup 中用 + / - / 重置按钮
- **拖拽**：按住放大镜右上角的 `⋮⋮` 手柄移动到任意位置
- **层级**：点击"置顶/置底"按钮切换 z-index
- **关闭**：点击放大镜上的 ✕ 按钮，或 Popup 中的"关闭放大镜"按钮

### 快捷键清单

| 快捷键 | 作用 |
|--------|------|
| `Ctrl+Shift+M` | 开启/关闭选区模式 |
| `Esc` | 取消选区（仅在选区模式中生效） |

---

## 开发指南

### Manifest V3 结构

本扩展使用 **Manifest V3**，核心入口：

```
manifest.json          ← 扩展清单（权限、content_scripts、commands 快捷键）
content.js + content.css   ← Content Script（注入到每个顶层页面）
background.js          ← Service Worker（后台常驻脚本）
popup.html + popup.js + popup.css  ← 工具栏点击弹窗
icons/icon16.png / icon48.png / icon128.png  ← 图标
```

### Content Script 职责

`content.js` 是整个扩展的**核心**，负责：

1. 管理选区模式（`toggleSelectMode`）
2. 捕获选区 DOM 并克隆（`captureContent`）
3. 创建并管理放大镜覆盖层（`Magnifier` 类）
4. SPA 导航检测与自动清理（hook history + popstate/hashchange）
5. DOM 安全清洗（移除 script/iframe/base/link/object/embed、去除内联事件处理器、资源路径绝对化）
6. 所有功能仅在**顶层 frame** 运行（`window.top !== window.self` 守卫）

样式全部使用 `.__wpm_` 前缀类名 + `!important`，抵抗宿主页面 CSS 覆盖。

### Background Service Worker 职责

`background.js` 是 service worker，负责：

1. **快捷键兜底**：处理 `chrome.commands.onCommand`，content script 未就绪时主动注入
2. **主动注入**：调用 `chrome.scripting.executeScript` + `insertCSS`，解决 service worker 与 manifest content_scripts 的注入时序差
3. **等待就绪**：注入后通过 PING 轮询等待 content script 初始化完成，避免竞态

### Popup 职责

`popup.js` 负责工具栏弹窗 UI：

1. 首次打开时探测当前 tab 的 content script 状态，必要时主动注入
2. 提供选区开关、缩放滑块、+/-/重置按钮、层级切换、关闭按钮
3. 通过 `chrome.runtime.onMessage` 监听来自 content 的状态广播，实时同步 UI
4. 所有 `sendMessage` 带 try/catch，避免 content 不可达时阻塞 UI

### 消息链路协议

**Popup ↔ Content（chrome.tabs.sendMessage）：**

| 方向 | 消息类型 | 说明 |
|------|----------|------|
| popup → content | `PING` | 健康检查，content 就绪后返回 `{ok:true}` |
| popup → content | `TOGGLE_SELECT_MODE` | 开启/关闭选区模式 |
| popup → content | `GET_STATUS` | 查询当前状态（selectMode/hasMagnifier/scale/zIndexHigh） |
| popup → content | `SET_SCALE` | 设置缩放比例 |
| popup → content | `TOGGLE_Z_INDEX` | 切换层级 |
| popup → content | `DESTROY_CURRENT` | 关闭当前放大镜 |
| popup → content | `DESTROY_ALL` | 关闭所有放大镜 |
| popup → content | `CREATE_MAGNIFIER` | 外部创建放大镜（传入 rect + options） |

**Content 广播（chrome.runtime.sendMessage）：**

| 消息类型 | 说明 |
|----------|------|
| `SELECT_MODE_CHANGED` | 选区模式切换，携带 `{selectMode: boolean}` |
| `MAGNIFIER_CREATED` | 放大镜创建，携带 `{scale: number}` |
| `MAGNIFIER_DESTROYED` | 放大镜销毁 |
| `SPA_NAVIGATED` | SPA 路由变化后自动销毁，popup 同步 UI |

**Background → Content：** 仅 `TOGGLE_SELECT_MODE`（快捷键兜底路径，经 tabs.sendMessage 发送）。

### SPA / iframe 兼容策略

**SPA 兼容（解决路由变化后放大镜残留问题）：**

- 在 content script **顶层立即执行** history hook（早于 DOMContentLoaded）
- hook `history.pushState` / `history.replaceState`，每次调用后派发 `__wpm_spa_nav__` 自定义事件
- 同时监听 `popstate` / `hashchange`
- 任何导航事件触发后：刷新 URL_BASE（资源绝对化依赖）→ 销毁放大镜 → 退出选区 → 通知 popup

**iframe 兼容：**

- manifest content_scripts 配置 `"all_frames": false`，仅顶层 frame 注入
- content.js 内部再次守卫：`if (window.top !== window.self) return;`，防止 iframe 嵌套时子 frame 响应 popup 指令
- background.js / popup.js 的 PING 路由能正确识别并跳过子 frame

---

## 目录结构

```
webpage-magnifier/
├── manifest.json              # 扩展清单（manifest v3）
├── content.js                 # Content Script 核心（832 行）
├── content.css                # Content Script 样式（.__wpm_ 前缀）
├── background.js              # Service Worker（快捷键兜底 + 主动注入）
├── popup.html                 # 工具栏弹窗 HTML
├── popup.js                   # 工具栏弹窗逻辑
├── popup.css                  # 工具栏弹窗样式
├── icons/
│   ├── icon16.png             # 16x16 图标
│   ├── icon48.png             # 48x48 图标
│   └── icon128.png            # 128x128 图标
├── scripts/
│   ├── pack.ps1               # PowerShell 打包脚本
│   └── gen-icons.ps1          # 图标生成脚本
├── .screenshots/              # 功能截图目录（占位）
├── .gitignore                 # 版本控制排除规则
├── CHANGELOG.md               # 版本变更日志
└── README.md                  # 本文档
```

---

## 已知限制

| # | 限制 | 原因 |
|---|------|------|
| 1 | **canvas 内容可能空白** | canvas 像素不随 DOM 克隆传播，放大镜是 DOM 克隆而非截图（无 canvas 访问权限） |
| 2 | **跨域 iframe 内容无法克隆** | content script 只注入到顶层 frame，跨域 iframe 内容不在本扩展控制范围内 |
| 3 | **快照不随原页面实时更新** | 放大镜是选区创建时的一次 DOM 克隆快照，原页面内容变化后放大镜不会自动同步 |
| 4 | **页面刷新后放大镜丢失** | 页面刷新会重新加载 content script，之前的放大镜状态无法持久化 |
| 5 | **edge://、chrome:// 等受限页面不可用** | 浏览器内置页面禁止扩展注入，popup 会显示"不支持"提示 |

---

## 权限说明

### `storage`

声明了但当前版本未实际调用。预留用于未来的设置持久化（如默认缩放比例偏好）。

### `activeTab`

在 popup 和 background 中调用 `chrome.tabs.query({ active: true, currentWindow: true })`，获取当前活动标签页的 `tabId`。所有向 content script 发消息、主动注入脚本/样式，都需要 `tabId` 定位目标。

### `scripting`

调用 `chrome.scripting.executeScript` + `chrome.scripting.insertCSS` 主动注入 content.js / content.css。

**为什么需要主动注入？** manifest 虽然声明了 `content_scripts`，但 service worker 被唤醒时 content script 可能尚未就绪——快捷键在 content script 初始化前按下会失败。主动注入 + PING 轮询等待解决了这个时序问题。

### `host_permissions: <all_urls>`

允许 content script 在 **任意网页 URL** 运行。manifest content_scripts 的 `matches: ["<all_urls>"]` 依赖这项权限，才能在用户访问的每个页面注入选区、放大镜功能。

扩展主动拦截了受限协议（`chrome://`、`edge://`、`chrome-extension://`、`about:`、`view-source:`），不会尝试在这些页面注入。
