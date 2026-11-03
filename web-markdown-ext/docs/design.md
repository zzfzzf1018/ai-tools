# 设计文档 — Web to Markdown

版本：0.1.0 ｜ 日期：2026-11-03

## 1. 架构总览

Manifest V3 扩展，四个运行时组件，无后端：

```
┌─────────────────────────────────────────────────────┐
│ 弹出窗口 popup/ （UI：预览、编辑、复制、下载）          │
├─────────────────────────────────────────────────────┤
│ Service Worker background.js （右键菜单、快捷键调度）   │
├─────────────────────────────────────────────────────┤
│ 内容脚本 content/content.js （页面内提取、剪贴板、Toast）│
├─────────────────────────────────────────────────────┤
│ 共享库 lib/ （Readability / Turndown / GFM / 转换封装） │
└─────────────────────────────────────────────────────┘
```

## 2. 模块职责

| 模块 | 职责 | 不做什么 |
|---|---|---|
| `manifest.json` | 声明权限、入口、快捷键 | — |
| `background.js` | 注册右键菜单；调度快捷键/菜单事件；注入脚本；受限页面系统通知 | 不做转换 |
| `content/content.js` | 页面内提取（正文/选区）；相对链接转绝对；右键流程的转换+复制+Toast | 不渲染 UI 弹窗 |
| `popup/popup.js` | 弹窗交互：触发提取、调用转换、复制、下载 | 不直接访问页面 DOM |
| `lib/markdown-convert.js` | Turndown 配置与转换封装（`window.wmdToMarkdown`） | 页面上下文与弹窗上下文共用 |

## 3. 消息协议

| 消息 | 方向 | 载荷 | 响应 |
|---|---|---|---|
| `wmd:extract` | popup → content | `{ type, mode: 'article'\|'selection' }` | `{ ok, data: { title, html, url } }` 或 `{ ok: false, error }` |
| `wmd:convert` | background → content | `{ type, mode }` | 无（content 内完成转换、复制、Toast） |

两条路径分离的原因：弹窗路径需要拿到 HTML 在弹窗内转换并展示；右键/快捷键路径弹窗未打开，需在页面上下文内完成全部转换并复制。

## 4. 数据流

**弹窗路径：**
```
用户点击图标 → popup.js 注入 content scripts（scripting.executeScript）
→ 发送 wmd:extract → content.js 提取返回 HTML
→ popup.js 调 wmdToMarkdown() 转换 → 文本框展示 → 复制 / 下载
```

**右键/快捷键路径：**
```
右键菜单/Alt+M → background.js 注入 content scripts
→ 发送 wmd:convert → content.js 提取 + wmdToMarkdown() 转换
→ 写剪贴板 → 页面 Toast 提示
```

## 5. 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 正文提取 | Mozilla Readability 本地打包 | 业界标准（Firefox 阅读模式同源），质量远高于手写规则 |
| Markdown 转换 | Turndown + GFM 插件本地打包 | 成熟稳定，GFM 覆盖表格/删除线/任务列表 |
| 依赖加载方式 | 本地打包，禁 CDN | 满足 MV3 CSP；完全离线；隐私安全 |
| 权限模型 | activeTab + scripting 按需注入 | 用户主动操作时授权，不申请 `<all_urls>`，权限最小化 |
| 选区实现 | `window.getSelection()` | 比自研框选模式简单可靠，覆盖绝大多数摘录需求 |
| 脚本重复注入 | `window.__wmdLoaded` 守卫 | executeScript 重复注入时避免重复注册监听 |
| 图片处理 | 保留绝对 URL，剔除 base64 | 体积小、速度快；data URL 会污染 Markdown 源码 |

## 6. 转换规则细节

- Turndown 配置：`headingStyle: 'atx'`、`codeBlockStyle: 'fenced'`、`bulletListMarker: '-'`、`emDelimiter: '*'`
- 自定义规则：过滤 `src` 为 `data:` 的 `<img>`
- 输出后处理：压缩 3 个以上连续换行为 2 个；顶部拼接元信息头

## 7. 错误处理矩阵

| 场景 | 捕获点 | 提示方式 |
|---|---|---|
| 受限页面（edge:// 等） | popup.js URL 预检 + executeScript 异常 | 弹窗状态栏 / 系统通知（右键路径） |
| 正文提取为空 | content.js extract() 抛错 | 弹窗状态栏 / 页面 Toast |
| 无选区 | content.js extract() 抛错 | 同上 |
| 剪贴板失败 | copyText() catch | execCommand 回退 |
| 下载失败 | chrome.downloads 回调 lastError | 弹窗状态栏 |

## 8. 测试方案

手动测试（Edge 开发者模式加载解压缩扩展）：

1. **文章页**（博客/新闻）：转换正文 → 结构完整、链接为绝对路径
2. **含表格页面**：表格转为 GFM 表格语法
3. **选区**：选中段落 + 图片 → 右键转换 → Toast 提示且剪贴板内容正确
4. **异常**：edge://extensions 页面 → 明确错误提示；未选中时点选区转换 → 明确提示
5. **离线**：断网状态下功能正常；Network 面板零请求
6. **快捷键**：Alt+M 转换选区并复制

## 9. 构建与发布

**版本控制（GitVersion）**

- 配置：`GitVersion.yml`（GitHubFlow/v1，tag-prefix `^web-markdown-ext-v`，main 分支 Patch 递增）
- 工具链：`.config/dotnet-tools.json` 固定 gitversion.tool 6.3.0，`dotnet tool restore` 安装
- `scripts/versioning.py` 三个子命令：
  - `version [--allow-fallback]`：计算构建版本（GitVersion 不可用时回退 manifest 版本 + `-local` 后缀）
  - `apply --tag <tag>`：校验标签与 GitVersion 计算结果一致、工作区干净，然后把版本写入 manifest.json
  - `prepare --archive <zip>`：校验 zip 完整性与包内 manifest 版本，产出 `release-assets/`（zip + SHA256SUMS.txt + release.json + RELEASE_NOTES.md）；**从 CHANGELOG.md 提取 `## [X.Y.Z]` 段落生成 Release 说明，缺失该段落则发布失败（强制变更留痕）**

**打包（tools/package.py）**

语法检查（node --check 自有 JS）→ 校验 manifest 可解析、运行时文件与图标齐全 → 产出 `dist/web-markdown-ext-v<版本>.zip`（zip 内以 `web-markdown-ext/` 为根）→ 回读校验 zip 内容。

不设 Node 行为测试：Readability/Turndown 依赖真实浏览器 DOM，转换管道的端到端验证在真实浏览器中完成（本文件第 8 节）。

**CI / 自动发布（`.github/workflows/web-markdown-ext-release.yml`）**

- 触发：main 推送（`web-markdown-ext/**` 路径过滤）、PR、`web-markdown-ext-v*` 标签
- verify（windows）：checkout（全历史+标签）→ node/python/dotnet → GitVersion apply（仅标签）→ package.py → prepare 资产 → 上传 artifact
- publish（ubuntu，仅标签）：下载 artifact → `sha256sum --check` 复核 → `gh release create`（草稿→转正，拒绝覆盖已存在 Release）
- 全部第三方 Action 以 commit SHA 固定
