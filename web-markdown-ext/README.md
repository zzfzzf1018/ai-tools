# Web to Markdown

一个 Microsoft Edge / Chrome 浏览器扩展（Manifest V3），一键将网页内容转换为 Markdown 格式。

## 功能特性

- **智能正文提取**：基于 Mozilla Readability，自动识别文章正文，过滤导航、广告、页脚
- **选区转换**：鼠标选中任意内容，右键菜单或弹窗一键转换
- **弹窗预览编辑**：转换结果在弹窗文本框中展示，可编辑、手动选择复制
- **复制到剪贴板**：一键复制，方便粘贴到 Obsidian / Typora / Notion 等
- **下载 .md 文件**：自动以页面标题命名
- **GitHub 风格 Markdown**：支持表格、删除线、任务列表、围栏代码块（GFM）
- **完全离线**：所有依赖库本地打包，无任何网络请求，不上传任何数据
- **图片保留链接**：Markdown 中保留图片原始 URL（相对路径自动转绝对路径，base64 内联图片自动剔除）

## 安装（Edge）

1. 打开 Edge，访问 `edge://extensions/`
2. 打开左侧「开发人员模式」
3. 点击「加载解压缩的扩展」，选择本项目根目录
4. 工具栏出现扩展图标即安装成功（可点击拼图图标将其固定到工具栏）

## 使用方法

| 操作 | 方式 |
|---|---|
| 转换整个网页正文 | 点击工具栏图标 →「转换正文」 |
| 转换选中内容 | 选中文字 → 右键「转换选中内容为 Markdown」（自动复制）；或点击图标 →「转换选区」 |
| 快捷键 | `Alt+M` 转换选区并复制（可在 `edge://extensions/shortcuts` 修改） |
| 复制结果 | 弹窗中点击「复制」，或直接在文本框中手动选择复制 |
| 下载文件 | 弹窗中点击「下载 .md」，以页面标题命名保存 |

转换结果自动附带元信息头（标题、来源 URL、抓取时间），便于笔记归档溯源。

## 目录结构

```
web-markdown-ext/
├── manifest.json            # 扩展清单（Manifest V3）
├── background.js            # Service Worker：右键菜单、快捷键
├── content/
│   └── content.js           # 内容脚本：正文/选区提取、剪贴板、页面 Toast
├── popup/
│   ├── popup.html           # 弹窗界面
│   ├── popup.css
│   └── popup.js             # 弹窗逻辑：提取触发、转换、复制、下载
├── lib/
│   ├── readability.js       # Mozilla Readability 0.5.0
│   ├── turndown.js          # Turndown 7.2.0
│   ├── turndown-plugin-gfm.js  # GFM 扩展 1.0.2
│   └── markdown-convert.js  # 共享转换封装（页面与弹窗上下文通用）
├── icons/                   # 扩展图标（16/32/48/128）
├── docs/                    # 项目文档
├── CHANGELOG.md
└── .gitignore
```

## 技术栈

- Manifest V3 / chrome.* API（activeTab、scripting、contextMenus、downloads、notifications）
- [@mozilla/readability](https://github.com/mozilla/readability) 0.5.0 — 正文提取
- [turndown](https://github.com/mixmark-io/turndown) 7.2.0 + turndown-plugin-gfm 1.0.2 — HTML → Markdown

## 文档

- [需求文档](docs/requirements.md)
- [设计文档](docs/design.md)
- [AI 开发指南](docs/ai-guide.md)
- [变更记录](CHANGELOG.md)
