# 🌈 趣味英语乐园 (Kids English Wonderland)

> 面向上海小学一至五年级的趣味英语学习应用
> 图文结合 · 标准发音 · 四个小游戏 · 成就激励 · 单文件 Windows 便携版

**当前稳定版：v1.0.5** ・ 仓库：https://github.com/zzfzzf1018/ai-tools/tree/main/children-eng-study ・ 发布：https://github.com/zzfzzf1018/ai-tools/releases

---

## ✨ 功能特性

| 模块 | 说明 |
|------|------|
| 📚 **分级学习** | 一年级到五年级，每年级 5 个单元，涵盖字母、单词、句型、短语 |
| 🔊 **标准发音** | 基于 Web Speech API，美式英语发音，语速和音调专为儿童调整 |
| 🖼️ **图文卡片** | 每个单词配 Emoji 图、国际音标、中文释义、英文例句与翻译 |
| 🎮 **四个小游戏** | 单词连连看 · 听音选词 · 拼写大师 · 记忆翻牌 |
| ⭐ **激励系统** | 星星奖励、连续学习天数、成就徽章、彩色纸屑庆祝动画 |
| 💾 **本地持久化** | 学习进度自动保存到浏览器 localStorage |
| 🎨 **生动界面** | 漂浮气泡背景、卡片翻转动画、表情弹跳、按钮微交互 |
| 🖥️ **桌面版** | Electron 单文件便携 exe，双击即用、无需安装 |

---

## 📦 下载安装（推荐普通用户使用）

前往 [Releases](https://github.com/zzfzzf1018/ai-tools/releases/tag/children-eng-study-v1.0.5) 选择你需要的形态：

| 形态 | 文件 | 大小 | 使用方式 |
|------|------|------|----------|
| 🖥️ **Windows 便携版** | `Kids-English-Wonderland-1.0.5-x64-portable.exe` | ~105 MB | 双击即用，无需安装、无需浏览器 |
| 🌐 **Web 版** | `Kids-English-Wonderland-1.0.5-web.zip` | ~30 KB | 解压后用浏览器打开 `index.html` |

### 桌面版使用说明

1. 双击 `Kids-English-Wonderland-1.0.5-x64-portable.exe`
2. 首次启动会解压到临时目录（约 30 秒），后续启动几乎瞬时
3. 未签名：Windows 可能提示"未知发布者"，核对 `SHA256SUMS.txt` 中的校验值后可继续运行
4. 学习数据保存在本机，不会上传任何服务器
5. 发音使用 Windows 内置英语语音（建议设置 → 时间和语言 → 语音中确认已安装英文语音包）

### Web 版使用说明

**方式一**：双击 `index.html` 直接在浏览器打开（最简单）

**方式二**：本地 HTTP 服务器（推荐，语音加载更稳定）

```bash
python -m http.server 8080
# 然后访问 http://localhost:8080
```

---

## 📁 项目结构

```
children-eng-study/
├── index.html              # 主页面（首页 / 学习 / 游戏 / 成就 四个 Tab）
├── css/
│   └── style.css           # 儿童友好主题样式 + 丰富动画
├── js/
│   ├── data.js             # 一~五年级词汇与例句数据（沪教版风格）
│   ├── speech.js           # Web Speech API 语音封装
│   ├── app.js              # 主应用：导航、卡片、进度、弹窗、成就
│   └── game.js             # 四个小游戏逻辑
├── desktop/                # Electron 桌面版
│   ├── main.js             # 主进程：单实例、窗口记忆、外链转系统浏览器
│   ├── icon.png
│   └── icon.ico
├── package.json            # Electron 依赖、electron-builder 配置与打包脚本
├── .gitignore
└── README.md
```

---

## 📖 学习内容（沪教版风格）

- **一年级 🐣 字母大冒险** — 打招呼、家人、身体部位、数字 1–10、动物
- **二年级 🐰 单词乐园** — 颜色、文具、食物、玩具、家居
- **三年级 🦊 句型花园** — 问候用语、学校生活、日常作息、爱好兴趣、形容词
- **四年级 🦁 故事森林** — 房间物品、天气与四季、运动、职业、旅行
- **五年级 🐉 魔法城堡** — 节日庆典、环境保护、购物、未来梦想、学习方法

每个年级 5 个单元，每单元 8–10 个单词，含音标、例句与中文翻译。

---

## 💡 使用说明

1. **选择年级**：首页点击对应年级卡片（一年级~五年级）
2. **单元学习**：点击右上角 `U1 U2 U3…` 切换单元，卡片自动发音
3. **交互操作**：
   - 🔊 点击卡片喇叭图标 → 再听一遍
   - ◀ 上一张 / ▶ 下一张 → 切换卡片
   - 完成一单元全部卡片 → 奖励 5 颗星星 + 彩色纸屑庆祝
4. **玩游戏**：导航到「🎮 游戏」Tab，选择四个小游戏之一
5. **成就追踪**：「📊 成就」Tab 查看已学单词数、朗读次数、徽章解锁

---

## 🌐 浏览器兼容性

| 浏览器 | 语音合成 | 备注 |
|--------|----------|------|
| Chrome / Edge (桌面) | ✅ 优秀 | 推荐 |
| Safari (macOS / iOS) | ✅ 优秀 | |
| Chrome / Edge (Android) | ✅ 良好 | |
| Firefox | ⚠️ 有限 | 部分系统可能无内置英语语音 |

语音合成依赖浏览器内置的 Web Speech API，首次点击发音时浏览器会加载对应语言的语音包。

---

## 🛠️ 技术栈

- **纯前端** — 零依赖、零构建，浏览器直接打开即用
- **HTML5 / CSS3 / 原生 JavaScript (ES6+)**
- **Web Speech API** — `speechSynthesis` 语音合成
- **localStorage** — 进度持久化
- **Electron 45 + electron-builder** — Windows 单文件便携版打包
- **GitHub Actions** — 自动构建与发布

---

## 🔧 开发者指南

### 本地开发

```bash
# Web 版：直接打开 index.html，或起本地服务
python -m http.server 8080

# 桌面版：开发模式启动 Electron
npm install
npm run desktop
```

### 本地打包桌面版

```bash
npm install
npm run desktop:runtime   # 首次需要，下载 Electron 运行时
npm run package           # 产出 release/Kids-English-Wonderland-<version>-x64-portable.exe
```

### 自动发布（GitHub Actions）

工作流：[children-eng-study-release.yml](../.github/workflows/children-eng-study-release.yml)

| 触发 | 行为 |
|------|------|
| Pull Request 改动 `children-eng-study/**` | 校验 JS 语法与 manifest |
| 推送 `children-eng-study-v*` tag | 自动打包便携 exe + Web zip → 发布 GitHub Release |

### 发版步骤

```bash
# 1. 修改 package.json 的 version（必须与将要打的 tag 一致）
# 2. 提交并推送 main
git add children-eng-study
git commit -m "feat(children-eng-study): <变更说明>"
git push origin main

# 3. 打 tag 推送，触发自动发布
git tag -a children-eng-study-v1.0.5 -m "children-eng-study v1.0.5"
git push origin children-eng-study-v1.0.5
```

### 版本号规则

- 任何变更都需升级版本号，**不允许删除已发布的 tag**（GitHub Ruleset 已强制开启）
- **Patch（x.y.Z+1）**：无功能改动、文档、构建/CI 修复、依赖升级
- **Minor（x.Y+1.0）**：小功能新增、内容扩充（如新增单元/单词）
- **Major（X+1.0.0）**：架构调整、破坏性变更

历史已发布的 tag 均不可删除或移动，如需修正发版问题请升 Patch 版本。

### 产物清单

- `Kids-English-Wonderland-<version>-x64-portable.exe` — Windows 单文件便携版
- `Kids-English-Wonderland-<version>-web.zip` — Web 版
- `SHA256SUMS.txt` — 上述两文件的 SHA256 校验值

---

## 📝 数据说明

所有学习数据（单词、音标、例句、中文）均为原创编写，以沪教版《英语》小学教材的主题和词汇为参考框架，**未复制任何受版权保护的教材原文或插图**。Emoji 图标来自系统内置，无第三方素材依赖。

## 📄 License

MIT

---

## 📌 版本记录

### v1.0.5 (2026-11-03)
- 📚 文档：补充版本号规则，明确 tag 不可删除策略
- 🔒 启用 GitHub Ruleset `protect-release-tags`，禁止删除或移动已发布 tag

### v1.0.4 (2026-11-03) — 🎯 当前稳定版
- 🖥️ 桌面版改为单文件便携 exe（electron-builder portable），双击即用，无需解压
- 📦 Release 产物：便携 exe + Web 版 zip
- 🔧 CI 修复：补 Electron runtime 下载步骤
- ✅ 已通过本地冒烟与 CI 全链路验证

### v1.0.3 (2026-11-03)
- 📦 Release 产物拆分为桌面版 zip 与 Web 版 zip 两个独立下载

### v1.0.2 (2026-11-03)
- 🔁 验证 GitHub Actions 自动打包发布链路（无功能变更）

### v1.0.1 (2026-11-03)
- 🖥️ 新增 Windows Electron 桌面便携版（免安装、离线可用）
- 🎨 新增应用图标（渐变圆角 + ABC）
- 📄 补充桌面版构建与使用文档

### v1.0.0 (2026-11-02)
- 🎉 首个正式版本
- ✅ 一年级~五年级 25 个单元全部单词
- ✅ Web Speech API 发音
- ✅ 四个趣味小游戏
- ✅ 星星 / 徽章 / 连续天数激励系统
- ✅ localStorage 进度持久化
