# 🌈 趣味英语乐园 (Kids English Wonderland)

> 面向上海小学一至五年级的趣味英语学习应用
> 图文结合 · 标准发音 · 字母大冒险 · 五个小游戏 · 成就激励 · 单文件 Windows 便携版

**当前稳定版：v1.2.0** ・ 仓库：https://github.com/zzfzzf1018/ai-tools/tree/main/children-eng-study ・ 发布：https://github.com/zzfzzf1018/ai-tools/releases

---

## ✨ 功能特性

| 模块 | 说明 |
|------|------|
| 📚 **分级学习** | 一年级到五年级，每年级 5 个单元 + 一年级额外「字母大冒险」，涵盖单词、句型、短语 |
| 🔤 **字母大冒险** | 一年级 Unit 0，26 个字母大小写展示、音标、例词、例句，专为零基础设计 |
| 🔊 **标准发音** | 基于 Web Speech API，美式英语发音，语速和音调专为儿童调整，600ms 去重防堆叠 |
| ⚙️ **语音设置** | 自动朗读开关、语速 0.6–1.2 调节、英语音色选择 |
| 🖼️ **图文卡片** | 每个单词配 Emoji 图、国际音标、中文释义、英文例句与翻译 |
| ⭐ **收藏 / 不熟** | 卡片上一键收藏或标记不熟，成就页两个 Tab 分别列出，点击可快速定位 |
| 🎙️ **录音 / 回放** | MediaRecorder 录制孩子自己的朗读，本地持久化，随时回放对比 |
| 🗣️ **句子跟读** | 基于 SpeechRecognition（Chrome/Edge），先听标准音再跟读，自动对比反馈 |
| 🔍 **离线词典** | 学习页顶部搜索框，全词库模糊匹配，点击结果直接跳转 |
| 🎮 **五个小游戏** | 单词连连看 · 听音选词 · 拼写大师 · 记忆翻牌 · **字母拼拼乐**（新增） |
| ⭐ **激励系统** | 星星奖励、连续学习天数、成就徽章、彩色纸屑庆祝动画 |
| 💾 **本地持久化** | 学习进度、收藏/不熟、录音自动保存到 localStorage，支持 JSON 导出/导入 |
| 🎨 **生动界面** | 漂浮气泡背景、卡片翻转动画、表情弹跳、按钮微交互、键盘焦点高亮 |
| 🖥️ **桌面版** | Electron 单文件便携 exe，双击即用、无需安装 |

---

## 📦 下载安装（推荐普通用户使用）

前往 [Releases](https://github.com/zzfzzf1018/ai-tools/releases/tag/children-eng-study-v1.2.0) 选择你需要的形态：

| 形态 | 文件 | 大小 | 使用方式 |
|------|------|------|----------|
| 🖥️ **Windows 便携版** | `Kids-English-Wonderland-1.2.0-x64-portable.exe` | ~110 MB | 双击即用，无需安装、无需浏览器 |
| 🌐 **Web 版** | `Kids-English-Wonderland-1.2.0-web.zip` | ~40 KB | 解压后用浏览器打开 `index.html` |

### 桌面版使用说明

1. 双击 `Kids-English-Wonderland-1.2.0-x64-portable.exe`
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

- **一年级 🐣 单词启蒙** — **Unit 0 字母大冒险**（26 字母大小写+音标+例词）、打招呼、家人、身体部位、数字 1–10、动物
- **二年级 🐰 单词乐园** — 颜色、文具、食物、玩具、家居
- **三年级 🦊 句型花园** — 问候用语、学校生活、日常作息、爱好兴趣、形容词
- **四年级 🦁 故事森林** — 房间物品、天气与四季、运动、职业、旅行
- **五年级 🐉 魔法城堡** — 节日庆典、环境保护、购物、未来梦想、学习方法

一年级共 6 个单元（含字母大冒险），二~五年级各 5 个单元，每单元 8–10 个单词，含音标、例句与中文翻译。

---

## 💡 使用说明

1. **选择年级**：首页点击对应年级卡片（一年级~五年级）
2. **单元学习**：点击右上角 `U1 U2 U3…` 切换单元，卡片自动发音
3. **交互操作**：
   - 点击卡片任意位置或 🔊 喇叭 → 再听一遍
   - ⚙️ 右上角设置 → 关闭自动朗读、调整语速、选择音色
   - ◀ 上一张 / ▶ 下一张 → 切换卡片
   - 完成一单元全部卡片 → 首次完成奖励 5 颗星星 + 彩色纸屑庆祝
4. **玩游戏**：导航到「🎮 游戏」Tab，选择四个小游戏之一（满星 5 颗，每 2 次失误扣 1 颗，保底 1 颗；词汇优先来自当前学习的单元）
5. **成就追踪**：「📊 成就」Tab 查看已学单词数、朗读次数、年级进度、徽章解锁，并可导出/导入进度 JSON

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
git tag -a children-eng-study-v1.1.1 -m "children-eng-study v1.1.1"
git push origin children-eng-study-v1.1.1
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

### v1.2.0 (2026-11-03) — 🎯 字母大冒险 + 收藏/录音/跟读 + 词典 + 新游戏

> 首次功能扩充升级，schemaVersion 升至 3（新增 favorites / weakWords / recordings 字段，旧存档自动兼容）。

- ✨ **字母大冒险**：一年级新增 Unit 0，26 个字母卡片，展示大小写、音标、例词、例句
- ✨ **收藏 / 不熟**：卡片底部 ⭐☆ 切换收藏、❌✓ 标记不熟；成就页两个 Tab 分别列出，点击可快速跳转定位
- ✨ **录音 / 回放**：卡片底部 🎙️ 用 MediaRecorder 录制朗读（最长 10s），存为 Data URL 到 localStorage，▶️ 按钮随时回放
- ✨ **句子跟读**：卡片底部 🗣️ 先听标准音，再用 SpeechRecognition 识别用户朗读并对比反馈（Chrome/Edge 桌面版）
- ✨ **离线词典**：学习页顶部 🔍 搜索框，全词库（跨年级跨单元）模糊匹配，300ms 防抖，点击结果直接跳转
- ✨ **字母拼拼乐**：第五个游戏（🧱），打乱字母池 + 干扰字母，点击拼词，支持撤回
- ✨ **发音去重**：speech.js 新增 600ms 内相同请求跳过逻辑，防止快速连点时堆叠合成请求
- ♿ **键盘可达**：所有按钮/卡片/新 Tab 统一 `*:focus-visible` 高亮，不熟练鼠标的小朋友可用纯键盘操作
- 🐛 **存档兼容**：normalizeUserData 自动补齐 favorites / weakWords / recordings 新字段，旧版本备份可直接导入

### v1.1.1 (2026-11-03) — 🎯 当前稳定版
- 🐛 修复听音选词点击正确答案直接报错卡死（`this.updateScore is not a function`），答对后加防重复点击锁
- 🐛 修复游戏星星永远满星：改为按失误扣星（每 2 次失误扣 1 颗，保底 1 颗），四个游戏均统计失误
- 🐛 修复连连看配对成功不朗读（查找字段写错），并取消每对消去时的纸屑轰炸
- 🐛 修复切换 Tab / 快速换单元后仍残留朗读：切页时发音代次失效并清理自动朗读定时器
- 🐛 修复设置面板盖在弹窗之上、Esc 无法关闭、⚙️ 只能开不能关；补充 `role="dialog"`，小屏不溢出
- 🐛 修复导出下载在部分浏览器被中断（链接挂入 DOM 并延迟回收 URL），导出内容加入语音设置
- 🐛 修复导入校验过松：拒绝数组/非对象数据、拒绝更高版本备份，语音设置一并恢复
- 🐛 修复每次取消朗读产生的 unhandled rejection；无语音环境下不再抛错
- 🐛 修复拼写提示把空格和撇号计入字母数（如 living room 误报 11 个字母）
- 🐛 修复应用长时间打开跨天后任务与连续天数不重置（每分钟 + 回到前台时检查）
- 🐛 修复读屏只念「点击再听一遍」而不念单词内容（aria-label 补全词义）
- 🎮 游戏词汇优先使用当前学习的单元，不足时从同年级补齐
- 🧹 移除从未使用的 `gradeProgress` 存档字段与 letter-card 特例；package-lock 版本同步

### v1.1.0 (2026-11-03)
- ✨ 新增语音设置面板：自动朗读开关、语速 0.6–1.2、英语音色选择（右上角 ⚙️）
- ✨ 新增年级进度条，展示每个年级已完成单元数
- ✨ 新增进度 JSON 导出/导入，换机或重装可恢复
- ♿ 整张学习卡片可点击重听，卡片支持回车/空格；年级卡与游戏卡支持键盘操作
- 🎮 游戏星星改为按正确率发放（1–5 颗），不再固定 3 颗
- 🔇 切换 Tab 自动停止发音
- 🎨 记忆翻牌字号提升到 14px 并允许换行，长单词不再溢出
- 🌐 移除 Google Fonts 外部依赖，离线使用系统字体
- 🎨 新增 favicon、theme-color，并支持 `prefers-reduced-motion`
- 📝 一年级主题「字母大冒险」调整为与实际内容一致的「单词启蒙」

### v1.0.7 (2026-11-03)
- 🐛 修复单元完成奖励：最后一张卡片可点击「完成 ✓」，首次完成奖励 5 星，重复学习不再重复发星
- 🐛 修复学习天数始终为 0、每日任务从不跨天重置
- 🐛 修复游戏始终使用一年级词汇，改为跟随当前选择的年级
- 🐛 修复拼写游戏答对后重复提交会跳题、答错无反馈
- 🐛 修复弹窗点遮罩/Esc 关闭时丢失 `onClose` 回调（改为弹窗队列）
- 🐛 修复自动发音被计入「朗读次数」，进度与徽章统计失真
- 🐛 修复从「← 返回」切回学习页后翻页按钮消失
- 🐛 修复快速翻卡时朗读上一张卡片的例句
- 🐛 修复连连看配对成功不发音，并移除无效代码
- 🐛 修复 `grade_complete` / `grade_5` 徽章永远无法解锁，多个徽章同时解锁时改为合并提示
- 🐛 修复「已学单词」按纯文本去重导致跨年级重复词不计数（存档自动迁移为「年级-单元-单词」）
- 🐛 修复移动端 `.game-options` 类名写错，听音选词仍为两列
- 📝 内容修正：`living` → `living room`；`Spring` → `Spring Festival`；重复的「再见」改为「拜拜」

### v1.0.6 (2026-11-03)
- 🔧 CI 修复：发布步骤遇到 draft Release 时不再硬失败，改为补传资产并正式发布

### v1.0.5 (2026-11-03)
- 📚 文档：补充版本号规则，明确 tag 不可删除策略
- 🔒 启用 GitHub Ruleset `protect-release-tags`，禁止删除或移动已发布 tag
- ✅ 便携 exe 实机验证通过（SHA256 校验一致、窗口正常启动）

### v1.0.4 (2026-11-03)
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
