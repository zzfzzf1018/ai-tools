# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。小规模修改仅递增修订号（patch）。
Git 标签格式：`web-markdown-ext-v<版本号>`（带 v 前缀）。

## [0.2.0] - 2026-11-03

### 新增
- **设置页面**（`options/`）：可配置输出格式（元信息头/Front Matter/标题风格/列表符号等）、内容处理（代码块语言检测、标题层级修正、数学公式保留、图片处理模式）、文件名模板（支持 `{{date}}/{{title}}/{{url-host}}`）、历史记录条数、预览开关
- **公共配置模块**（`lib/config.js`）：所有模块共享的 `chrome.storage.local` 设置读写，带缓存与默认值
- **图片本地化下载**：当设置为 `download-local` 模式时，content script 扫描 HTML 中的 `<img>`，通知 background 通过 `chrome.downloads` 下载到指定子目录，并把 Markdown 中的图片 URL 替换为相对路径
- **转换历史**：`chrome.storage.local` 保存最近 10 条转换记录（可配置），弹窗底部展示历史列表，点击可在新标签页打开
- **页面高亮预览**：转换前用半透明蒙层高亮 Readability 识别的正文区域，操作栏提供「确认转换 / 取消」按钮（可在设置中关闭）
- **右键菜单增强**：在链接上右键新增「转换此链接页面为 Markdown」，自动打开目标页面、等待加载完成后转换并复制
- **Obsidian YAML Front Matter**：可开启，自动生成 `title`/`date`/`source`/`tags`（从 URL host 推导）/`created` 等字段
- **数学公式保留**：支持 KaTeX `.katex`（data 属性 / annotation 还原）、MathJax `mjx-container`、原生 MathML `<math>` 三种来源还原为 `$...$` / `$$...$$`
- **代码块语言检测**：从 HTML class（`language-xxx`、`hljs language-xxx`）和 data 属性提取，外加 17 种语言的内容特征启发式检测
- **标题层级修正**：正文有多个 `<h1>` 时，自动把非文章主标题的 h1 降为 h2，避免多个一级标题
- **vitest 单元测试**：32 个测试用例覆盖基础转换、GFM 特性、Front Matter、代码块检测、数学公式还原、文件名模板、标题修正等
- **ESLint 集成**（`package.json`）：`npm run lint` 执行代码风格检查

### 变更
- **manifest 权限升级**：新增 `storage`（设置/历史）、`tabs`（批量/链接打开）、`host_permissions: <all_urls>`（图片下载）；新增 `options_ui` 入口
- **共享注入脚本列表**：`lib/config.js` 加入 popup 和 background 的 CONTENT_SCRIPTS，所有入口统一加载配置
- **`tools/package.py`**：运行时文件列表新增 `options/*.html|css|js` 和 `lib/config.js`；JS 语法检查覆盖范围同步更新
- **删除线修复**：显式 `<del>`/`<s>`/`<strike>` → `~~...~~` 规则，确保 GFM 删除线正确输出
- **markdown-convert.js**：整体重构，支持配置驱动、后处理式代码块检测、HTML 预处理管道
- **Content script 配置加载竞态**：settings 从"启动时 async IIFE 预加载"改为"消息处理时按需 await ensureSettings()"，避免 executeScript → sendMessage 时序下 settings 仍为 null 导致图片处理静默跳过（fix Critical）
- **Preview 监听注册顺序**：`chrome.runtime.onMessage.addListener` 从 sendMessage callback **内部**移到**之前**，消除 content script 快速响应时消息丢失的竞态；同时 lastError 检查上移到 listener 注册之后但保证路径正确（fix Critical）
- **Preview 死代码清理**：删除 showPreviewOverlay 中创建但从未 appendChild 的 previewHighlight 元素、删除重复创建 overlay 的临时方案；整体重写为蒙层 + 底部操作栏 + 正文背景高亮的干净实现
- **无用变量 pageHost**：processImages 中声明但未使用的 pageHost 已删除
- **Dead message handler**：content.js 中 `wmd:preview-confirmed` / `wmd:preview-cancelled` 两个无调用方的 if 分支已删除
- **convertLinkPage 防御增强**：新增 URL 协议校验（仅 http/https/file）、newTab null 检查、fired 防重入、超时后关闭孤立 tab

## [0.1.1] - 2026-11-03

### 新增
- 发布强制变更留痕：`versioning.py prepare` 从 CHANGELOG.md 提取对应版本段落生成 RELEASE_NOTES.md 作为 GitHub Release 说明；缺失该版本段落时发布直接失败
- Release 说明包含版本变更内容 + 安装方式

### 变更
- Release 上传资产改为精确列表（zip + SHA256SUMS.txt + release.json），不再整目录上传

## [0.1.0] - 2026-11-03

### 新增
- 基于 Manifest V3 的 Edge/Chrome 扩展初始版本
- 智能正文提取：集成 Mozilla Readability 0.5.0，自动识别文章正文
- 选区转换：支持鼠标选中内容转换（右键菜单、弹窗按钮、快捷键 Alt+M）
- 弹窗交互：Markdown 预览文本框（可编辑）、复制到剪贴板、下载 .md 文件（以页面标题命名）
- HTML → Markdown 转换：Turndown 7.2.0 + GFM 插件（表格/删除线/任务列表/围栏代码块）
- 相对链接自动转绝对链接；base64 内联图片自动剔除；图片保留原始 URL
- 转换结果自动附加元信息头（标题、来源 URL、抓取时间）
- 显式错误提示：弹窗状态栏与页面 Toast（正文提取失败、无选区、受限页面等场景）
- 项目文档：需求文档、设计文档、AI 开发指南、README
- GitVersion 版本控制（tag-prefix `web-markdown-ext-v`，dotnet 工具清单固定 6.3.0）
- `tools/package.py` 一键打包：node 语法检查 + manifest/图标/运行时文件校验 + zip 产物回读校验
- `scripts/versioning.py`：GitVersion 计算、版本写入 manifest、发布资产准备（zip + SHA256SUMS）
- GitHub Actions 自动发布：main/PR 校验，`web-markdown-ext-v*` 标签触发打包并创建 GitHub Release
