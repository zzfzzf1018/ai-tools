# ai-tools

一个扁平式（flat）单仓多包（monorepo）仓库，集中存放多个**彼此独立**的个人工具与学习类应用。每个子目录都是一套自包含的工程，拥有各自的依赖清单、构建脚本与说明文档，**没有**统一的根 `package.json`、没有 pnpm/yarn workspace 抽象层——仓库只是用 Git 把它们归到一起，便于统一版本管理与 GitHub Actions 自动发布。

- **远端**：`https://github.com/zzfzzf1018/ai-tools`
- **发布**：各包通过独立 tag（带前缀，如 `children-eng-study-v1.2.3`、`web-blocker-v1.4.6`）触发 `.github/workflows/` 下的专属流水线，自动构建并发布到 GitHub Releases。
- **许可证**：各包独立声明（多为 `MIT`；少数未授予开源许可，见各子目录说明）。

---

## 目录结构

```
ai-tools/
├── children-eng-study/      # 儿童英语学习 · 桌面 + Web（Electron）
├── children-math-study/     # 儿童数学学习 · 桌面 + Web（Electron）
├── children-typing-tutor/   # 儿童英文打字 tutor · Web/PWA + 桌面（React + Vite + TS）
├── my-wordbook-generation/  # 单词书 · 离线分级词汇 + SM-2 记忆 · 桌面（Electron）
├── web-markdown-ext/        # 浏览器扩展（MV3）· 网页一键转 Markdown
├── webpage-md/              # 命令行工具 · 网页正文 + 备用内容转 Markdown
├── doc-translation/         # 命令行工具 · 文档/图片/PDF OCR 翻译
├── speech-to-text/          # 桌面 + CLI · 本地语音转文字（faster-whisper）
├── web-blocker/             # 浏览器扩展（MV3）· 区域屏蔽 + 知乎侧边栏隐藏
├── New folder/              # 空目录占位，暂未归类
└── .github/workflows/       # 各包的自动发布流水线
```

---

## 包一览

| 目录 | 名称 | 类型 / 技术栈 | 语言 | 当前版本 | 入口形态 |
|------|------|---------------|------|----------|----------|
| `children-eng-study` | 趣味英语乐园 Kids English Wonderland | 儿童英语学习（一至五年级，沪教版风格）· 纯前端 HTML/CSS/JS + Electron 45 打包 | 前端 | v1.2.3 | Windows 便携 exe / Web zip |
| `children-math-study` | 数学奇妙岛 Math Wonder Island | 儿童数学思维（一至五年级，上海教材）· 纯前端 + Electron 45 打包 | 前端 | v1.0.3 | Windows 便携 exe / Web zip |
| `children-typing-tutor` | 打字小岛 Typing Island | 儿童英文打字 tutor（6–9 岁）· React 19 + Vite 7 + TypeScript + PWA + Electron 45 | 前端 (TS) | v1.1.2 | Web / Windows 便携 + NSIS 安装包 |
| `my-wordbook-generation` | 单词书 Wordbook | 离线分级词汇 + SM-2 间隔记忆 · 纯前端 + Electron（electron-packager） | 前端 | v1.1.0 | Windows 便携 exe |
| `web-markdown-ext` | Web to Markdown | 浏览器扩展（Manifest V3）· Mozilla Readability + Turndown，网页/选区一键转 Markdown | 前端 (JS) | v0.x | Edge / Chrome 加载解压缩扩展 |
| `webpage-md` | 网页转 Markdown | 命令行工具 · 正文 + 备用内容分离为 Markdown（Readability + Playwright 渲染） | Node.js | v1.0.0 | CLI（`node src/cli.js <url>`） |
| `doc-translation` | 文档图像/PDF 翻译 | 命令行工具 · Tesseract OCR 提取 + 翻译，原位重排生成译文图片/PDF | Python | — | `python translate_document.py` |
| `speech-to-text` | 本地语音转文字 Speech to Text | 桌面 + CLI · faster-whisper 本地推理，音视频转 TXT/SRT/VTT | Python | v1.1.1 | Windows exe（PyInstaller）/ CLI |
| `web-blocker` | 网页屏蔽器 + 知乎侧边栏隐藏 | 浏览器扩展（MV3）· 点选区域屏蔽、收回留白、规则导入导出 | 前端 (JS) | v1.4.6 / v1.1.0 | Edge / Chrome 加载解压缩扩展 |
| `New folder` | — | 空占位目录 | — | — | — |

---

## 各包简介与文档入口

### 儿童学习三件套（Electron 桌面 + Web）

- **`children-eng-study`** — 面向小学一至五年级的趣味英语应用：分级学习、字母大冒险、标准发音（Web Speech API）、五个小游戏、录音回放、句子跟读、成就激励。详见 [children-eng-study/README.md](children-eng-study/README.md)。
- **`children-math-study`** — 数学奇妙岛，上海教材体系的小学数学思维工具，技术形态与英语乐园一致（纯前端 + Electron 打包）。结构：根 `index.html` + `css/` + `js/` + `content/` + `desktop/`，版本号见 `package.json`（v1.0.3），变更记录见 `CHANGELOG.md`。
- **`children-typing-tutor`** — 打字小岛，结构最完整的前端工程：React 19 + Vite 7 + TypeScript，含 PWA 离线能力、20 节分步课程、专项复习、多儿童无关（暂未做）路线，以及完整的 ESLint/Prettier/Vitest/Playwright 测试与 `docs/` 规范文档。详见 [children-typing-tutor/README.md](children-typing-tutor/README.md)。

> 三者的桌面版均用 Electron 45 + electron-builder 产出 Windows 单文件便携 exe，学习数据保存在本地 `localStorage`，**不上传任何服务器**。

### 单词书 `my-wordbook-generation`

离线分级词汇工具，内置 SM-2 间隔重复记忆算法；桌面版由 `electron-packager` 打包（非 electron-builder）。含 PWA（`sw.js` / `manifest.webmanifest`）、`启动单词书.vbs` 一键启动脚本与 `vendor/` 本地依赖。

### 网页 → Markdown 两条路线

- **`web-markdown-ext`** — 浏览器扩展（MV3），在浏览器内一键把整页正文或选中内容转成 GitHub 风格 Markdown，完全离线、不上传数据。详见 [web-markdown-ext/README.md](web-markdown-ext/README.md)。
- **`webpage-md`** — 命令行 / Agent / Skill 三种调用方式的 Node.js 工具，把网页**正文**与**其他可读内容**分离保存为 `content.md` / `extras.md` / `metadata.json`；支持 `--render`（Playwright 无头 Chromium）处理 JS 渲染页面。详见 [webpage-md/README.md](webpage-md/README.md)。

### 文档与语音处理（Python）

- **`doc-translation`** — 简单命令行工具：Tesseract OCR 提取图片/PDF 文本 → 翻译 → 按原始版面重排生成译文图片或 PDF。需系统级 Tesseract（首次运行可自动安装）。详见 [doc-translation/README.md](doc-translation/README.md)。
- **`speech-to-text`** — 本地语音转文字，faster-whisper 多语言模型本地推理，媒体不外传；产出同名 `.txt` / `.srt` / `.vtt`。提供桌面 exe 与 CLI 两种形态，含一键构建（`build.ps1` / `build.cmd`）与工程门禁（`validation/release-evidence.json`）。详见 [speech-to-text/README.md](speech-to-text/README.md)。

### 浏览器扩展 `web-blocker`

一个 MV3 扩展工程，包含主扩展**网页屏蔽器**（点选任意区域→记住「站点+区域」→自动屏蔽并收回父级留白，支持多选、整站/单页、规则导入导出、快捷键暂停）以及衍生的**知乎侧边栏隐藏**子扩展。纯本地存储，不联网。详见 [web-blocker/outputs/web-blocker/README.md](web-blocker/outputs/web-blocker/README.md) 与 [web-blocker/outputs/zhihu-sidebar-hide/README.md](web-blocker/outputs/zhihu-sidebar-hide/README.md)。

---

## 开发与发布约定

1. **每个包自管依赖**：进入对应子目录安装/构建，仓库根不做统一安装。各包 README 已写明本地开发、打包与发版命令（本说明不重复罗列，以子目录文档为准）。
2. **自动发布由 tag 驱动**：推送到带前缀的 tag 才会触发对应 `.github/workflows/<package>-release.yml`，自动校验版本/CHANGELOG 并产出 GitHub Release。已发布 tag 受 GitHub Ruleset 保护，不可删除或移动。
3. **版本号**：语义化版本（SemVer）。部分包用 GitVersion 计算（如 `speech-to-text`、`web-blocker`、`web-markdown-ext`、`children-typing-tutor`），部分包手动登记 `CHANGELOG.md` 条目后升 `package.json` 版本（如 `children-eng-study`、`children-math-study`）。
4. **`.gitattributes`**：统一规定 `children-eng-study/scripts/*.sh` 使用 LF 换行，确保 CI（Linux）与本地执行一致。

---

## 说明

- 本仓库为个人工具集合，**不构成任何投资建议或商业担保**。
- 各包的许可证、第三方依赖与数据隐私边界以各自子目录 README 为准。
- `New folder/` 为临时空目录占位，未纳入上述任何工具，后续归类或删除不影响其他包。
