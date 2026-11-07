# 心晴岛 · 儿童社会情绪学习（SEL）游戏软件

> 面向 **6–10 岁**儿童的社会情绪学习（Social and Emotional Learning, SEL）互动软件。
> 参考 Tilli 等成熟 SEL 产品的「学习 → 应用 → 反思 → 策略」循环方法，**原创**设计与内容（角色、美术、文案均为自研，非克隆），以生动有趣的游戏化方式帮助孩子认识情绪、管理情绪、学会社交。

---

## 一、它解决什么问题

儿童在成长中常遇到两类挑战：**认识并接纳自己的情绪**（我现在的感受是什么？）、**在与他人相处时做出妥当的选择**（我该怎么说、怎么做？）。心晴岛把 CASEL（全球最具影响力的 SEL 框架）五大能力拆成 5 座小岛、19 个互动关卡，让孩子在"玩"中练习：

| 小岛 | 对应 SEL 能力 | 练什么 |
|---|---|---|
| 🔍 情绪侦探岛 | Self-Awareness · 自我认知 | 识别 10 种情绪、给心情打分、觉察身体信号 |
| 🫧 冷静能量岛 | Self-Management · 自我管理 | 呼吸练习、冷静角、把冲动变成可选择的行动 |
| 🔭 同理望远镜岛 | Social Awareness · 社会认知 | 站在别人角度想、读懂场景里的情绪线索 |
| 🌉 友谊桥梁岛 | Relationship Skills · 人际关系 | 表达、倾听、道歉、合作、解决小冲突 |
| 🗼 智慧灯塔岛 | Responsible Decision-Making · 负责任决策 | 做选择前想后果、权衡轻重、承担后果 |

## 二、核心功能

- **每日情绪签到**：4 步流程（选情绪 → 强度与原因 → 送自己一个小方法 → 种一朵心情花，可顺手留一句话），形成可回看的"心情日历"。
- **19 个互动关卡**，覆盖 7 种题型：情境选择、连一连、排顺序、心情温度计（滑块）、呼吸练习、分支故事、分分类。
- **每一道题都会说话**：进入关卡自动连读标题、引导语、题干、玩法说明、全部选项 / 卡片与按钮提示；点过的卡片、出现的提示、故事每个做法、结局的道理、过关结算也都会念出来。关卡顶部有播报条（再听一遍 / 只听选项 / 停一停），`Alt + R` 可随时重听；家长可单独关闭自动读题、调整 0.7×–1.2× 语速。
- **说一说 · 勇气小话筒**：每关结尾与独立练习页提供贴合情境的话题，用「我觉得…／因为…／我希望…」三句式，先听中文示范，再自己大声说出来，点「我说出来啦」收获勇气星、连续天数与 3 枚表达贴纸。独立页随机抽卡，也可用 `#/express/<情境卡 id>` 指定某张卡反复练。不录音、不语音识别、不保存说过的话，只记次数与日期；家长面板与成长周报能看到开口次数。
- **10 种情绪脸谱 + 贴纸册 + 心情花园**：完成关卡收集贴纸，每日签到在心情花园里种下一朵花，用成长可视化激励坚持。
- **5 个"策略肌肉"**：觉察 / 呼吸 / 应对 / 拉开距离 / 表达——可随时打开练习。
- **情绪急救角（悬浮）**：任何儿童页面右下角都有「冷静 60 秒」，一键进入 4-2-6 呼吸；只盖一层弹窗，不换页、不丢当前关卡进度，关掉就回到刚才那一题。
- **家长面板**（家长门保护，可选用 4 位 PIN）：能力练习次数雷达、14/30 天情绪强度折线、策略有效性（用了方法后下一次签到的强度变化）、按薄弱能力自动推荐的「本周 3 关」、近 14 天签到日历、情绪统计、签到明细、每关完成情况、使用时长与睡前锁、JSON 备份导入导出与进度清空。
- **成长周报**：每周一张「心情天气卡」，汇总记录天数、平均强度、开出的花与用过的方法，可打印或另存为 PDF，方便贴在冰箱上聊一聊。
- **多档案**：同一设备上可建立多个孩子档案，互不干扰。

## 三、面向儿童的安全设计

- **没有"答错"**：所有互动用"这个选择会带来什么"来引导，不用批评性语言。
- **完全离线**：无账号、无网络请求、无遥测、无广告。数据只存在本机（`localStorage`）。
- **不碰麦克风**：朗读用的是系统中文语音（本机合成），「说一说」不申请麦克风、不录音、不做语音识别（浏览器语音识别通常要联网），也不保存孩子说过的任何一句话；CSP 保持 `media-src 'none'`，Electron 继续统一拒绝摄像头/麦克风权限申请。
- **儿童友好文案**：无医疗/诊断表述，不给孩子贴标签，「说一说」不判断说得对不对、不打分。
- **家长门**：涉及数据的面板用算术题或 4 位家长 PIN 确认；PIN 只保存加盐哈希，连续输错 5 次锁定 1 分钟。
- **使用时长与睡前锁**：家长可设每日上限与睡前时段。到点只盖一层休息提醒，不删除任何记录；解除需要再过一次家长门，解锁后当天不再打扰。

## 四、快速开始

### 方式 A：网页版（零安装）

- 直接**双击 `index.html`**，用浏览器打开即可（以 `file://` 运行，无需服务器、无需联网）。
- 或运行 `start-web.bat`（会尝试起一个本地静态服务并打开页面）。
- **安装到桌面（PWA）**：用 `npm run serve`（http://127.0.0.1:5173）或任意静态托管打开后，浏览器会提示「安装心晴岛」。安装后断网也能启动；Service Worker 会缓存全部脚本与图标（`file://` 下不注册，双击打开仍然可用）。发行包 `*-web.zip` 已包含 `manifest.webmanifest`、`sw.js` 与 `icons/`，解压后 `node desktop/serve.mjs` 即可安装（该预览服务给清单返回 `application/manifest+json`，入口与 SW 不缓存）。

### 方式 B：Windows 桌面版（单文件便携）

- 下载发布的 `SunnyIsles-SEL-<版本>.exe`，**双击即可运行**，无需安装。
- 未签名版本在 Windows 上可能提示"未知发布者"，属正常现象，允许运行即可。
- 开发模式：先 `npm install`，再 `npm start`（启动 Electron 加载本地页面）。

### 方式 C：自行构建

```bash
npm install
npm run build:win        # 产出 dist/SunnyIsles-SEL-<版本>.exe（便携版）
npm run build:portable   # 同上（别名）
```

## 五、目录结构

```
children-social-emotional-learning/
├─ index.html            # 网页入口（零构建，直接打开）
├─ manifest.webmanifest  # PWA 清单（安装到桌面）
├─ sw.js                 # Service Worker（离线缓存，仅 http/https 注册）
├─ icons/                # PWA 图标 192 / 512
├─ src/
│  ├─ styles.css         # 明亮、圆润、儿童友好的主题（含打印样式）
│  ├─ data/curriculum.js # 课程/题库/情绪/策略/故事/贴纸/说一说数据（唯一数据源）
│  ├─ core/              # utils / audio(合成音效 + 朗读队列) / state / screentime(时长与睡前锁)
│  └─ ui/                # art / components / calm(情绪急救) / games / expression(说一说) / screens
├─ desktop/
│  ├─ main.js            # Electron 主进程：loadFile 加载页面，禁用外部跳转
│  └─ serve.mjs          # 零依赖本地静态服务器（仅绑定 127.0.0.1，不进便携版）
├─ tools/
│  ├─ verify.mjs         # 静态校验：数据契约/引用/离线资源/PWA/安全基线
│  ├─ smoke.mjs          # jsdom 冒烟测试：页面+关卡+签到+新功能回归
│  ├─ visual.cjs         # Electron 截图基线（像素对比，锁视觉）
│  └─ lib/               # seed(固定示例存档) / png(零依赖编解码) / freeze-time
├─ scripts/
│  ├─ version.cjs        # GitVersion 版本解析
│  ├─ release.cjs        # 发布计划/版本校验/资产打包（CI 用）
│  └─ release-notes.cjs  # 从 CHANGELOG 生成 Release 说明
├─ build/
│  ├─ icon.svg           # 应用图标源文件（云朵团团）
│  └─ icon.png           # 打包用 512×512 图标
├─ GitVersion.yml        # 语义化版本策略（tag 前缀隔离 monorepo）
├─ .config/dotnet-tools.json  # dotnet GitVersion 工具清单
└─ package.json
```

## 六、技术架构

- **零构建纯前端**：原生 JavaScript（无框架、无打包器、无 ES Module），用普通 `<script>` 标签加载，因此能直接以 `file://` 双击运行——这是离线优先设计的关键。
- **Electron 外壳**：`desktop/main.js` 用 `loadFile` 直接打开仓库内的 `index.html`；`nodeIntegration:false` + `contextIsolation:true` + `sandbox:true`，页面无法访问 Node，更安全；拦截一切新窗口与外部导航、拒绝摄像头/麦克风等权限申请、禁止 `<webview>` 挂载，并关闭拼写检查避免 Chromium 下载在线词典（保证完全离线）；单实例锁避免重复启动写坏同一份存档。
- **内容安全策略**：`index.html` 内置 CSP，只允许本地脚本/样式与 `data:` 图标，禁止外部连接、`unsafe-eval` 与内联脚本。
- **全离线资源**：音效用 Web Audio API 实时合成（无音频文件），中文语音用浏览器 `speechSynthesis`（优先本机普通话语音），美术全部为内联 SVG，**0 个外部 `<script src>`**。
- **朗读队列**：`audio.js` 把一段题目拆成多条 utterance 排队连读，并用「代次」作废旧队列；换页、点选项、关开关都会立刻安静下来。自动引导（读题、反馈、鼓励、结算）与手动小喇叭分属两级开关，家长可只关自动朗读。
- **本地存档**：`localStorage` 持久化，不可用时降级为内存态；支持多档案与 JSON 备份。为控制本机存储占用，界面最多展示最近 400 条签到与 365 朵心情花；更早的记录会自动移入归档（每档最多 2000 条 / 1000 朵），随导出备份一起保存与还原，不会丢失。

## 七、开发与测试

```bash
npm install
npm run serve    # 本地静态预览（http://127.0.0.1:5173，仅本机可访问）
npm run verify   # 数据契约/引用/离线资源静态校验
npm run smoke    # jsdom 运行时冒烟测试（需 jsdom，已在 devDependencies）
npm run visual   # Electron 截图基线对比（首次需 npm run visual:update 生成基线）
# 若宿主环境设置了 ELECTRON_RUN_AS_NODE=1（某些 IDE 内置终端会），先执行：
#   unset ELECTRON_RUN_AS_NODE      # Git Bash / macOS / Linux
#   Remove-Item Env:ELECTRON_RUN_AS_NODE   # PowerShell
npm run build:win
```

- `tools/verify.mjs`：校验课程数据字段、主键唯一性、关卡引用、题型合法性、解锁可达性、Electron 安全基线、样式表结构、无外部 URL。
- `tools/smoke.mjs`：在 jsdom 中渲染全部页面与 19 个关卡，跑通签到闭环、7 种题型交互、存档溢出归档、导入安全、焦点管理、家长面板，以及时长锁、PIN、趋势/有效性、周报、故事探索度、情绪急救角等 1.1.x 功能；1.2.0 起额外模拟 `speechSynthesis` 验证全关卡自动朗读、队列与开关，并覆盖「说一说」计次、上限、贴纸与统计。
- `tools/visual.cjs`：用 Electron 在固定时间（2026-01-15）截取桌面 1280px 与手机 390px 的 15 个页面（含新增的「说一说」页，用 `#/express/ex-1` 锁定情境卡以保证截图确定），与 `tools/visual/baseline/` 逐像素对比；差异超过 0.2% 失败并输出 `actual/` 与 `diff-*.png`。截图前会把存档的「自动读题」临时关掉，避免播报条文案随系统语音状态漂移。确认视觉改动符合预期后运行 `npm run visual:update` 更新基线。

## 八、版本管理与自动发布（GitVersion + GitHub Actions）

本项目遵循本仓库 monorepo 的统一约定：每个子项目用**独立的 tag 前缀**隔离版本，互不干扰。

- **版本号来源**：GitVersion 从 git 历史与 tag 计算语义化版本。
- **Tag 约定**：`children-social-emotional-learning-vX.Y.Z`（例如 `children-social-emotional-learning-v1.0.0`）。
- **发布流程**（`.github/workflows/children-social-emotional-learning-release.yml`）：
  1. 在 `package.json` 把 `version` 改为新版本并提交/推送 `main`。
  2. CI 检测到版本变化（对比推送前后）后，自动打 tag、用 GitVersion 计算版本、构建 Windows 便携版 + Web ZIP。
  3. 自动在校验通过后将产物发布为 GitHub Release（便携 exe + web.zip + `SHA256SUMS.txt` + `release.json`）。
- **本地计算版本**：需先 `dotnet tool restore` 安装 GitVersion，再 `npm run release:version`。

> 未打 tag 的日常提交只会做"构建+校验"，不会发布；只有 `package.json` 版本号相对上一次提交**递增**时才会触发发布。

## 九、家长 / 老师使用要点

- 鼓励孩子每天做 1 次情绪签到，重点不在"对不对"，而在"我注意到了什么"。
- 关卡里的"策略肌肉"可在孩子真的生气/紧张时一起练习，把游戏里的练习迁移到真实场景。
- 孩子跟着「说一说」开口时，先听完再回应，可复述一句「我听见了，你希望…」；不必纠正用词，也别急着追问。
- 家长面板的数据（含开口表达次数）用于陪伴式回顾，不建议作为奖惩依据；软件不记录孩子说了什么。

## 十、免责声明

- 本软件为**教育辅助工具**，**不构成任何医疗、心理诊断或治疗建议**。如孩子出现持续的情绪或行为困扰，请寻求专业儿童心理/精神科医师帮助。
- 所有内容仅供学习参考，软件按"现状"提供，作者不对使用结果作任何保证。
- 学习记录仅保存在本机，开发者无法访问。

## 十一、许可

本项目按仓库根目录 LICENSE 授权。课程内容与原创美术仅供个人与教学场景使用。
