# ai-tools

一个扁平式（flat）单仓多包（monorepo）仓库，集中存放多个**彼此独立**的个人工具与学习类应用。每个子目录都是一套自包含的工程，拥有各自的依赖清单、构建脚本与说明文档，**没有**统一的根 `package.json`、没有 pnpm/yarn workspace 抽象层——仓库只是用 Git 把它们归到一起，便于统一版本管理与 GitHub Actions 自动发布。

- **远端**：`https://github.com/zzfzzf1018/ai-tools`
- **发布**：各包通过独立 tag（带前缀，如 `children-eng-study-v1.6.0`、`web-blocker-v1.4.8`）触发 `.github/workflows/` 下的专属流水线，自动构建并发布到 GitHub Releases；`word-memory` 额外发布到 GitHub Pages 站点。
- **许可证**：各包独立声明（多为 `MIT`；少数未授予开源许可，见各子目录说明）。
- **当前状态**（2026-11-17）：`main` 与远端同步，工作树干净；11 个实际工具包 + 1 个空占位目录；已累计 61 个版本 tag、9 条工作流。

---

## 目录结构

```
ai-tools/
├── children-eng-study/                  # 儿童英语学习 · Web + 桌面（Electron 45）
├── children-math-study/                 # 儿童数学学习 · Web + 桌面（Electron 45）
├── children-social-emotional-learning/  # 儿童社会情绪学习（SEL）· Web/PWA + 桌面（Electron）
├── children-typing-tutor/               # 儿童英文打字 tutor · Web/PWA + 桌面（React + Vite + TS）
├── my-wordbook-generation/             # 单词书 · 离线分级词汇 + SM-2 记忆 · 桌面（Electron）
├── word-memory/                         # WordMemory · 8000 词间隔重复 · Web/Pages + 单文件 + EXE
├── web-markdown-ext/                    # 浏览器扩展（MV3）· 网页一键转 Markdown
├── webpage-md/                          # CLI · 网页正文 + 备用内容转 Markdown
├── doc-translation/                     # CLI · 文档/图片/PDF OCR 翻译
├── speech-to-text/                      # 桌面 + CLI · 本地语音转文字（faster-whisper）
├── web-blocker/                         # 浏览器扩展（MV3）· 区域屏蔽 + 知乎侧边栏隐藏
├── vocabulary-memorize/                # 空目录占位，暂未归类（未被 Git 跟踪）
└── .github/workflows/                   # 9 条 CI / 发布流水线
```

---

## 包一览

版本以**已推送的最高 tag**为准（源码内版本号偶尔滞后，见「说明」）。

| 目录 | 名称 | 类型 / 技术栈 | 语言 | 当前版本 | 入口形态 |
|------|------|---------------|------|----------|----------|
| `children-eng-study` | 趣味英语乐园 Kids English Wonderland | 儿童英语（一至五年级）· 纯前端 + Electron 45 | 前端 | v1.6.0 | Windows 便携 exe / Web zip |
| `children-math-study` | 数学奇妙岛 Math Wonder Island | 儿童数学思维（一至五年级）· 纯前端 + Electron 45 | 前端 | v1.2.0 | Windows 便携 exe / Web zip |
| `children-social-emotional-learning` | 心晴岛 Sunny Isles | 儿童社会情绪学习 SEL（6–10 岁）· 纯前端 + PWA + Electron | 前端 | v1.3.1 | Windows 便携 exe / Web zip(PWA) |
| `children-typing-tutor` | 打字小岛 Typing Island | 儿童英文打字 tutor（6–9 岁）· React 19 + Vite 7 + TS + PWA + Electron 45 | 前端 (TS) | v1.1.2 | Web / Windows 便携 + NSIS 安装包 |
| `my-wordbook-generation` | 单词书 Wordbook | 离线分级词汇 + SM-2 间隔记忆 · 纯前端 + electron-packager | 前端 | v1.1.0 | Windows 便携 exe |
| `word-memory` | WordMemory | 8000 词（COCA 词频）+ SM-2 · 多账户/多词库 · Web/PWA + Electron 45 | 前端 | v2.1.0 | GitHub Pages / 单文件 HTML / Windows EXE |
| `web-markdown-ext` | Web to Markdown | 浏览器扩展（MV3）· Readability + Turndown，网页/选区一键转 MD | 前端 (JS) | v0.2.0 | Edge / Chrome 加载解压缩扩展 |
| `webpage-md` | 网页转 Markdown | CLI · 正文 + 备用内容分离为 Markdown（Readability + Playwright） | Node.js | v1.0.0 | CLI（`node src/cli.js <url>`） |
| `doc-translation` | 文档图像/PDF 翻译 | CLI · Tesseract OCR 提取 + 翻译，原位重排生成译文图片/PDF | Python | — | `python translate_document.py` |
| `speech-to-text` | 本地语音转文字 Speech to Text | 桌面 + CLI · faster-whisper 本地推理，音视频转 TXT/SRT/VTT | Python | v1.1.1 | Windows exe（PyInstaller）/ CLI |
| `web-blocker` | 网页屏蔽器 + 知乎侧边栏隐藏 | 浏览器扩展（MV3）· 点选区域屏蔽、规则导入导出 | 前端 (JS) | v1.4.8 / v1.1.0 | Edge / Chrome 加载解压缩扩展 |
| `vocabulary-memorize` | — | 空占位目录 | — | — | — |

---

## 各包简介与文档入口

### 儿童学习四件套（Electron 桌面 + Web）

- **`children-eng-study`** — 趣味英语乐园，沪教版风格。26 单元 / 229 词拆 82 关，章节递进冒险地图、全英文图文卡片、六道游戏题语音播报、句子小剧场、贴纸册 / Combo / 磨耳朵 / 剧情冒险 / 弱项专练、宠物进化、SM-2 间隔复习、跟读真实评分。v1.6.0 封板。详见 [children-eng-study/README.md](children-eng-study/README.md)。
- **`children-math-study`** — 数学奇妙岛，上海教材体系。v1.2.0 新增错题同类题自动变形再练（`js/variants.js`，只换数字不换措辞）、星星商店 / 头像装扮、勋章扩展；v1.1.0 起有题目语音播报、单元递进与练习中心。本包**无独立 README**，结构为根 `index.html` + `css/` + `js/` + `content/` + `desktop/` + `docs/`，变更见 `CHANGELOG.md`。
- **`children-social-emotional-learning`** — 心晴岛，参考 CASEL 五大能力框架，5 座岛 / 19 个互动关卡，面向 6–10 岁。逐句点读 + 高亮、角色化语音（团团/咕咕老师/小火苗）、双示范话术、「勇气小话筒」说一说、情绪急救角、家长面板（含 4 位 PIN）、成长周报、多档案；完全离线、不碰麦克风、无外部请求。详见 [children-social-emotional-learning/README.md](children-social-emotional-learning/README.md)。
- **`children-typing-tutor`** — 打字小岛，结构最完整的前端工程：React 19 + Vite 7 + TypeScript，含 PWA 离线、20 节分步课程、专项复习，以及 ESLint/Prettier/Vitest/Playwright 测试与 `docs/` 规范。详见 [children-typing-tutor/README.md](children-typing-tutor/README.md)。

> 四者桌面版均用 Electron 产出 Windows 便携 exe，学习数据保存在本地 `localStorage`，**不上传任何服务器**。

### 背单词两条路线（两包互不相同）

- **`my-wordbook-generation`** — 单词书，离线分级词汇 + SM-2 间隔记忆；桌面版由 `electron-packager` 打包（非 electron-builder）。含 PWA、`启动单词书.vbs` 一键启动脚本与 `vendor/` 本地依赖。本包**无独立 README**，说明见 `docs/`。
- **`word-memory`** — WordMemory，与上面那包**不是同一个项目**。内置 8000 个 COCA 词频词汇，SM-2 复习，支持多账户 / 多词库切换与自定义词库导入；三种形态：Web 静态站点（GitHub Pages：<https://zzfzzf1018.github.io/ai-tools/>）、单文件 HTML、Electron 45 + electron-builder 26 产出的 Windows EXE（约 106 MB）。v2.1.0 起接入 CI + 发布流水线。详见 [word-memory/README.md](word-memory/README.md)。

### 网页 → Markdown 两条路线

- **`web-markdown-ext`** — 浏览器扩展（MV3），整页正文或选区一键转 GitHub 风格 Markdown，完全离线。v0.2.0 新增设置页（`options/`）、公共配置模块（`lib/config.js`）、图片本地化下载、转换历史。详见 [web-markdown-ext/README.md](web-markdown-ext/README.md)。
- **`webpage-md`** — Node.js 工具，Agent / CLI / Skill 三种调用方式，把网页**正文**与**其他可读内容**分离保存为 `content.md` / `extras.md` / `metadata.json`；`--render` 用 Playwright 无头 Chromium 处理 JS 渲染页面。详见 [webpage-md/README.md](webpage-md/README.md)。

### 文档与语音处理（Python）

- **`doc-translation`** — Tesseract OCR 提取图片/PDF 文本 → 翻译 → 按原始版面重排生成译文图片或 PDF。需系统级 Tesseract（首次可自动安装）。详见 [doc-translation/README.md](doc-translation/README.md)。
- **`speech-to-text`** — faster-whisper 本地推理，媒体不外传；产出同名 `.txt` / `.srt` / `.vtt`。提供桌面 exe 与 CLI，含一键构建（`build.ps1` / `build.cmd`）与工程门禁（`validation/release-evidence.json`）。详见 [speech-to-text/README.md](speech-to-text/README.md)。

### 浏览器扩展 `web-blocker`

一个 MV3 扩展工程，包含主扩展**网页屏蔽器**（点选任意区域 → 记住「站点+区域」→ 自动屏蔽并收回父级留白，支持多选、整站/单页、规则导入导出、快捷键暂停，v1.4.8）以及衍生的**知乎侧边栏隐藏**子扩展（v1.1.0）。纯本地存储，不联网。详见 [web-blocker/outputs/web-blocker/README.md](web-blocker/outputs/web-blocker/README.md) 与 [web-blocker/outputs/zhihu-sidebar-hide/README.md](web-blocker/outputs/zhihu-sidebar-hide/README.md)。

---

## 开发与发布约定

1. **每个包自管依赖**：进入对应子目录安装/构建，仓库根不做统一安装。各包 README 已写明本地开发、打包与发版命令（本说明不重复罗列，以子目录文档为准）。
2. **自动发布由 tag 驱动**：推送带前缀的 tag 才触发对应 `.github/workflows/<package>-release.yml`，自动校验版本/CHANGELOG 并产出 GitHub Release。已发布 tag 受 GitHub Ruleset 保护，不可删除或移动。`word-memory` 的 release 流水线还会把 Web 产物发布到 GitHub Pages。
3. **版本号**：语义化版本（SemVer）。`children-typing-tutor`、`children-social-emotional-learning`、`web-blocker`、`web-markdown-ext`、`speech-to-text` 用 GitVersion 计算；`children-eng-study`、`children-math-study`、`my-wordbook-generation`、`word-memory` 手动维护 `CHANGELOG.md` + `package.json` 版本。
4. **CI 例外**：`word-memory-ci.yml` 是按路径触发的独立 CI（仅当该工作流自身或发布工作流变更、PR、手动触发时运行），不与 tag 发布耦合。
5. **`.gitattributes`**：统一规定 `children-eng-study/scripts/*.sh` 使用 LF 换行，确保 CI（Linux）与本地执行一致。

---

## 说明

- 本仓库为个人工具集合，**不构成任何投资建议或商业担保**。
- 各包的许可证、第三方依赖与数据隐私边界以各自子目录 README 为准。
- `children-math-study/`、`my-wordbook-generation/` 目前**没有**独立 README，以 `CHANGELOG.md` / `docs/` 和各包源码为准。
- `vocabulary-memorize/` 为本地空目录占位（未被 Git 跟踪），未纳入任何工具；旧的 `New folder/` 占位已删除。
- **版本口径提醒**：版本号以最高 tag 为准。`web-markdown-ext` 的 `manifest.json` 仍写 `0.1.0`，但 `CHANGELOG.md` 与最高 tag 均为 `v0.2.0`，以 tag 为准。
