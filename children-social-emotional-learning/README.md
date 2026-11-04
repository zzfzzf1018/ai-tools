# 心晴岛 · 儿童社会情绪学习（SEL）游戏软件

> 面向 **6–10 岁**儿童的社会情绪学习（Social and Emotional Learning, SEL）互动软件。
> 参考 Tilli 等成熟 SEL 产品的「学习 → 应用 → 反思 → 策略」循环方法，**原创**设计与内容（角色、美术、文案均为自研，非克隆），以生动有趣的游戏化方式帮助孩子认识情绪、管理情绪、学会社交。

---

## 一、它解决什么问题

儿童在成长中常遇到两类挑战：**认识并接纳自己的情绪**（我现在的感受是什么？）、**在与他人相处时做出妥当的选择**（我该怎么说、怎么做？）。心晴岛把 CASEL（全球最具影响力的 SEL 框架）五大能力拆成 5 座小岛、19 个互动关卡，让孩子在"玩"中练习：

| 小岛 | 对应 SEL 能力 | 练什么 |
|---|---|---|
| 🟡 自我觉察岛 | Self-Awareness | 识别 10 种情绪、给心情打分、觉察身体信号 |
| 🟢 自我管理岛 | Self-Management | 呼吸练习、冷静角、把冲动变成可选择的行动 |
| 🔵 社会觉察岛 | Social Awareness | 站在别人角度想、读懂场景里的情绪线索 |
| 🟣 人际关系岛 | Relationship Skills | 表达、倾听、道歉、合作、解决小冲突 |
| 🟠 负责任决定岛 | Responsible Decision-Making | 做选择前想后果、权衡轻重、承担后果 |

## 二、核心功能

- **每日情绪签到**：4 步流程（选情绪 → 给强度 → 选原因 → 小策略），形成可回看的"心情日历"。
- **19 个互动关卡**，覆盖 7 种题型：情境选择、连一连、排顺序、心情温度计（滑块）、呼吸练习、分支故事、分分类。
- **10 种情绪脸谱 + 情绪花园**：完成关卡获得贴纸，种进"心情花园"，用成长可视化激励坚持。
- **5 个"策略肌肉"**：觉察 / 呼吸 / 应对 / 拉开距离 / 表达——可随时打开练习。
- **家长面板**（算术家长门保护）：数据雷达、打卡日历、关卡进度、贴纸墙、JSON 备份导入导出。
- **多档案**：同一设备上可建立多个孩子档案，互不干扰。

## 三、面向儿童的安全设计

- **没有"答错"**：所有互动用"这个选择会带来什么"来引导，不用批评性语言。
- **完全离线**：无账号、无网络请求、无遥测、无广告。数据只存在本机（`localStorage`）。
- **儿童友好文案**：无医疗/诊断表述，不给孩子贴标签。
- **家长门**：涉及数据的面板用一道简单算术题做家长确认。

## 四、快速开始

### 方式 A：网页版（零安装）

- 直接**双击 `index.html`**，用浏览器打开即可（以 `file://` 运行，无需服务器、无需联网）。
- 或运行 `start-web.bat`（会尝试起一个本地静态服务并打开页面）。

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
├─ src/
│  ├─ styles.css         # 明亮、圆润、儿童友好的主题
│  ├─ data/curriculum.js # 课程/题库/情绪/策略/故事/贴纸数据（唯一数据源）
│  ├─ core/              # utils / audio(Web Audio 合成音效+中文TTS) / state(存档)
│  └─ ui/                # art(内联SVG) / components / games(7种题型) / screens(全部页面)
├─ desktop/
│  ├─ main.js            # Electron 主进程：loadFile 加载页面，禁用外部跳转
│  └─ serve.mjs          # 零依赖本地静态服务器
├─ tools/
│  ├─ verify.mjs         # 静态校验：数据契约/引用完整性/离线资源
│  └─ smoke.mjs          # 运行时冒烟测试（jsdom）：全部页面+关卡+签到闭环+题型
├─ scripts/
│  ├─ version.cjs        # GitVersion 版本解析
│  └─ release.cjs        # 发布计划/版本校验/资产打包（CI 用）
├─ GitVersion.yml        # 语义化版本策略（tag 前缀隔离 monorepo）
├─ .config/dotnet-tools.json  # dotnet GitVersion 工具清单
└─ package.json
```

## 六、技术架构

- **零构建纯前端**：原生 JavaScript（无框架、无打包器、无 ES Module），用普通 `<script>` 标签加载，因此能直接以 `file://` 双击运行——这是离线优先设计的关键。
- **Electron 外壳**：`desktop/main.js` 用 `loadFile` 直接打开仓库内的 `index.html`；`nodeIntegration:false` + `contextIsolation:true`，页面无法访问 Node，更安全；拦截一切新窗口与外部导航。
- **全离线资源**：音效用 Web Audio API 实时合成（无音频文件），中文语音用浏览器 `speechSynthesis`，美术全部为内联 SVG，**0 个外部 `<script src>`**。
- **本地存档**：`localStorage` 持久化，不可用时降级为内存态；支持多档案与 JSON 备份。

## 七、开发与测试

```bash
npm install
npm run serve    # 本地静态预览（:http://localhost:5173）
npm run verify   # 数据契约/引用/离线资源静态校验
npm run smoke    # jsdom 运行时冒烟测试（需 jsdom，已在 devDependencies）
npm run build:win
```

- `tools/verify.mjs`：校验课程数据字段、关卡引用、题型合法性、无外部 URL。
- `tools/smoke.mjs`：在 jsdom 中渲染全部页面与 19 个关卡，跑通签到闭环与 7 种题型交互。

## 八、版本管理与自动发布（GitVersion + GitHub Actions）

本项目遵循本仓库 monorepo 的统一约定：每个子项目用**独立的 tag 前缀**隔离版本，互不干扰。

- **版本号来源**：GitVersion 从 git 历史与 tag 计算语义化版本。
- **Tag 约定**：`children-social-emotional-learning-vX.Y.Z`（例如 `children-social-emotional-learning-v1.0.0`）。
- **发布流程**（` .github/workflows/children-social-emotional-learning-release.yml`）：
  1. 在 `package.json` 把 `version` 改为新版本并提交/推送 `main`。
  2. CI 检测到版本变化（对比推送前后）后，自动打 tag、用 GitVersion 计算版本、构建 Windows 便携版 + Web ZIP。
  3. 自动在校验通过后将产物发布为 GitHub Release（便携 exe + web.zip + `SHA256SUMS.txt` + `release.json`）。
- **本地计算版本**：需先 `dotnet tool restore` 安装 GitVersion，再 `npm run release:version`。

> 未打 tag 的日常提交只会做"构建+校验"，不会发布；只有 `package.json` 版本号相对上一次提交**递增**时才会触发发布。

## 九、家长 / 老师使用要点

- 鼓励孩子每天做 1 次情绪签到，重点不在"对不对"，而在"我注意到了什么"。
- 关卡里的"策略肌肉"可在孩子真的生气/紧张时一起练习，把游戏里的练习迁移到真实场景。
- 家长面板的数据用于陪伴式回顾，不建议作为奖惩依据。

## 十、免责声明

- 本软件为**教育辅助工具**，**不构成任何医疗、心理诊断或治疗建议**。如孩子出现持续的情绪或行为困扰，请寻求专业儿童心理/精神科医师帮助。
- 所有内容仅供学习参考，软件按"现状"提供，作者不对使用结果作任何保证。
- 学习记录仅保存在本机，开发者无法访问。

## 十一、许可

本项目按仓库根目录 LICENSE 授权。课程内容与原创美术仅供个人与教学场景使用。
