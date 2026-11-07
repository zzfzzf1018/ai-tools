# WordMemory · 多账户 / 多词库间隔重复记忆

> 一个不用注册、不用联网、打开就能用的背单词工具。
> 内置 8000 个最常用英文词汇作为默认词库，用间隔重复（SM-2）安排复习；支持多账户分人使用、导入任意自定义词库并随时切换，学习记录保存在本地。

**版本**：v2.1.0 ｜ **默认词库**：8000 词（COCA 词频排序）｜ **依赖**：运行时零依赖

在线体验：<https://zzfzzf1018.github.io/ai-tools/> ｜ 离线版：[Releases](https://github.com/zzfzzf1018/ai-tools/releases)

**三种形态**：Web 版（静态站点）｜ 单文件 HTML 版（双击即用）｜ **Windows EXE 便携版**（免安装，数据放 U 盘目录）

---

## 目录

- [为什么选择它](#为什么选择它)
- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [使用方法](#使用方法)
- [账户与词库](#账户与词库)
- [EXE 便携版](#exe-便携版)
- [学习方法：间隔重复](#学习方法间隔重复)
- [数据与隐私](#数据与隐私)
- [项目结构](#项目结构)
- [开发与构建](#开发与构建)
- [测试](#测试)
- [词库数据来源](#词库数据来源)
- [发布流程](#发布流程)
- [常见问题](#常见问题)
- [许可](#许可)

---

## 为什么选择它

大多数背单词软件的问题是：**词表太杂、复习安排靠感觉、数据锁在别人的服务器上**。

这个项目做了三件很朴素的事：

1. **只收最常用的 8000 词**，按真实语料使用频率排序，学到的第一个词就是你明天会在文章里遇到的词。
2. **每次作答都计算下一次出现时间**，从 1 分钟到 1 年，用最少的复习次数换取最长久的记忆。
3. **所有数据存在你自己的设备上**，可以随时导出成 JSON 文件带走；EXE 便携版把数据放在程序同目录，U 盘随身带。

---

## 功能特性

### 词库（可替换）

- **内置 8000 个高频词**作为默认词库，来自 COCA 语料库词频表，按使用频率由高到低排序
- 每条包含：单词、中文释义、英式音标、所属频段
- 四档频段：核心（1–1000）、常用（1001–3000）、进阶（3001–5500）、拓展（5501–8000）
- 支持中英文双向搜索（输入 `放弃` 或 `abandon` 都能找到）
- **可以导入任意多个自定义词库**（JSON / CSV / TXT），随时切换、重命名、导出、删除；内置词库始终保留且不可删除
- 每个账户各自记住自己正在使用的词库，切换账户时自动切回

### 账户（多人共用一台设备）

- 可创建任意多个账户（例如「小明」「雅思备考」），随时在顶栏下拉切换
- 账户之间的学习记录、统计、标记、设置**完全隔离**
- 同一账户下不同词库的进度也彼此独立，切换后原进度完整保留
- 支持新建、重命名、删除、全量备份与恢复

### 记忆管理

| 标记 | 作用 | 位置 |
| --- | --- | --- |
| ⭐ 重点 | 优先出现在复习队列最前面 | 词库列表 / 学习卡片 |
| ✓ 已掌握 | 立即移出学习队列，不再出现 | 词库列表 / 学习卡片 |
| 跳过 | 本轮先跳过这个词，稍后再出现 | 学习卡片 |

所有标记都可以随时撤销，撤销后按原有学习进度继续。

### 学习

- **间隔重复**：SM-2 算法变体，四档自评（忘记了 / 有点模糊 / 记得 / 很简单）
- **学习步骤**：新词先经过 1 分钟 → 10 分钟两次短暂复习，通过后才进入长期记忆队列
- **三种题型**：看英文选中文、看中文选英文、拼写填空
- **智能降级**：冠词、介词、连词等语法词只考「英译中」，避免出现无意义的长释义题干
- **错词重排**：答错的词会在本轮会话内再次出现（最多 3 次），强化即时记忆
- **键盘操作**：`1`–`4` 评分、`空格` 看答案、`A`–`D` 选项、`S` 朗读、`Esc` 结束

### 统计

- 今日进度、连续打卡天数、累计正确率
- 最近 13 周学习热力图
- 最近 14 天新学 / 复习堆叠柱状图
- 四个频段的分段掌握情况
- 记忆强度分布（0–100%，综合间隔、遗忘次数与正确率）
- 未来 7 天到期预测，提前知道哪天任务重

### 其他

- **三版本**：标准 Web 版 + 单文件离线版（一个 HTML 文件）+ Windows EXE 便携版
- **便携版**：Electron 打包的单个 EXE，免安装、免装 Node、自带窗口；数据写在 EXE 同目录 `WordMemory-data/`，整个文件夹可放 U 盘随身带走
- **CI 自动发布**：打 tag 即自动构建 EXE、跑冒烟测试并附到 GitHub Release
- **响应式**：桌面端侧边导航，移动端底部标签栏
- **深浅双主题**，跟随设置即时切换
- **本地持久化**：浏览器版用 IndexedDB（自动降级 localStorage / 内存），便携版用本地文件；写入防抖 400 ms，关闭页面不丢进度
- **导入导出**：当前词库进度 JSON 备份 + 全量工作区备份（所有账户、词库、进度）
- **语音朗读**：调用浏览器自带语音引擎，无需联网

---

## 快速开始

### 方式一：EXE 便携版（推荐给 Windows 用户）

```bash
npm install
npm run build:exe
```

产物在 `dist/WordMemory.exe`（Electron 便携版，约 106 MB），**双击即可运行**：

- 不需要安装 Node、不需要装任何运行库、不需要联网，也不要求系统装 Chrome
- 自带 Chromium 内核的桌面窗口（无地址栏、无控制台），带中文菜单与自定义图标
- 首次运行会在 EXE 同目录生成 `WordMemory-data/`，所有账户、词库、进度都在这里
- 把 EXE 和这个文件夹一起拷到 U 盘，换台电脑继续背，进度原样带过去
- 关闭窗口即完全退出，不留后台进程；窗口尺寸会自动记住

详细说明见 [EXE 便携版](#exe-便携版)。

### 方式二：单文件 HTML 版（推荐给只想用浏览器的人）

```bash
# 在项目目录执行
npm install
npm run build
```

构建完成后打开 `dist/word-memory.html`——**双击即可**，不需要服务器、不需要联网。

也可以直接把 `dist/word-memory.html` 发给别人，一个文件包含全部代码与 8000 词数据（约 678 KB）。

### 方式三：Web 版（推荐给要部署的人）

```bash
npm run build
npx serve dist/web        # 或任意静态服务器
# 浏览器访问 http://localhost:3000
```

也可以使用项目自带的预览服务器：

```bash
npm run dev               # 构建 + 启动 http://127.0.0.1:4173
```

### 方式四：从 GitHub Release 下载

前往仓库的 Releases 页面，下载 `word-memory-<version>.html`（单文件版）或 `WordMemory.exe`（便携版）。
EXE 由 GitHub Actions 的 Windows 任务自动构建并随每个 tag 发布（见[发布流程](#发布流程)）。

---

## 使用方法

### 1. 今日

首页展示今天要做的事：

- **待复习**：到了复习时间、还没过一遍的词
- **今日新词**：还有多少新词额度（默认每天 20 个）
- **已掌握**：手动标记过「不需要再背」的词
- **连续打卡**：连续有学习记录的天数

点击「开始学习」进入会话。如果今天没有到期复习，会直接开始学新词。

### 2. 学习

一张卡片的流程：

1. **作答**——选择题点选项，拼写题输入后回车
2. **看答案**——展示完整词条，选择题会告诉你选对没有
3. **自评**——根据刚才回忆的难易程度点四个按钮之一

自评按钮上会实时显示「下次什么时候再见到它」，例如 `记得 · 10 分钟`、`很简单 · 4 天`。

> **关于自评**：不要为了好看而选「很简单」。诚实评分才能让算法把复习安排在真正需要的时间点。

### 3. 词库

浏览**当前词库**的全部词条（内置默认 8000 词，切换词库后显示对应内容），可以：

- 搜索英文或中文
- 按状态筛选（全部 / 未学习 / 学习中 / 复习中 / 已掌握 / 重点）
- 按频段筛选
- 点 ⭐ 标记重点，点 ✓ 标记已掌握（再点一次撤销）
- 点喇叭朗读

### 4. 统计

查看学习量、正确率、热力图与记忆强度分布，判断自己的节奏是否合理。

### 5. 设置

| 设置项 | 说明 | 建议 |
| --- | --- | --- |
| 每日新词上限 | 每天最多学多少个新词 | 新手 10–20，稳定后 30 |
| 每日复习上限 | 每天最多复习多少个 | 时间紧张时调低，比放弃复习好 |
| 每轮卡片数 | 一次会话最多多少张 | 20–30，碎片时间可调小 |
| 参与的频段 | 只学某些频段 | 只想打基础就选「核心 + 常用」 |
| 新词顺序 | 按词频 / 乱序 / 新词优先 | 默认按词频最符合「先学最常用」 |
| 题型 | 混合 / 只选择 / 只拼写 | 混合最能训练不同方向的提取 |
| 显示音标 | 是否展示英式音标 | 默认开 |
| 自动朗读 | 出卡时自动发音 | 需要浏览器语音支持 |
| 主题 | 深色 / 浅色 | — |

设置页顶部还有「账户」与「词库」两个管理区，可以新建账户、导入词库、重命名、导出与删除；
底部「数据」区域可以导出当前词库进度、导出全量备份、导入备份、清空学习进度。

### 6. 切换账户与词库

页面顶部有一条常驻切换栏，左侧两个下拉框分别是**账户**与**词库**，改选后立即生效：

- 切换账户 → 自动切到该账户上次使用的词库，学习记录与统计随之切换
- 切换词库 → 当前会话结束，词库内容、待复习队列、统计全部换成新词库的
- 右侧「管理」按钮直达设置页的账户 / 词库管理区
- 切换栏右端显示当前数据存储方式（便携版文件 / IndexedDB / localStorage / 临时内存）

### 键盘快捷键

| 按键 | 作用 |
| --- | --- |
| `空格` / `Enter` | 显示答案 / 提交拼写 |
| `A` `B` `C` `D` | 选择对应选项 |
| `1` `2` `3` `4` | 评分：忘记了 / 有点模糊 / 记得 / 很简单 |
| `S` | 朗读当前单词 |
| `Esc` | 结束本轮 |

---

## 账户与词库

### 数据隔离模型

学习记录以「词库内的索引」为主键，而不同词库的同一个索引代表完全不同的单词，因此进度必须按两个维度隔离：

| 数据 | 存储键 | 作用域 |
| --- | --- | --- |
| 工作区元数据（账户表、词库表、激活关系） | `wm/v2/meta` | 全局 |
| 自定义词库内容 | `wm/v2/book/<bookId>` | 全局共享，所有账户都能切换使用 |
| 账户设置 | `wm/v2/settings/<accountId>` | 账户内所有词库共享 |
| 学习记录 / 每日统计 | `wm/v2/progress/<accountId>/<bookId>` | **账户 × 词库**独立 |

也就是说：**同一个词库，两个人各背各的；同一个人，背不同词库也各算各的**。设置（每日新词数、题型、主题等）跟随账户，不会因为换词库而重置。

内置 8000 词库 ID 固定为 `builtin-coca8000`，始终存在且不可删除；删除自定义词库时，所有账户在该词库下的进度会一并清理。

### 导入自定义词库

在「设置 → 词库 → 导入词库」选择文件，支持三种格式：

| 格式 | 示例 | 说明 |
| --- | --- | --- |
| JSON（本项目结构） | `{"meta":{"name":"四级"},"words":[["apple","n. 苹果","ˈæpl",1]]}` | 与 `data/words.json` 完全兼容，字段顺序：单词、释义、音标、频段 |
| JSON（对象数组 / 映射） | `[{"word":"apple","meaning":"苹果"}]` 或 `{"apple":"苹果"}` | 音标、频段可省略 |
| CSV / TXT | `apple,苹果,/ˈæpl/,1` 或 `apple⇥苹果` | 支持表头、`#` 注释、引号包裹的逗号；Tab / 逗号 / 空格分隔均可 |

规则：

- 单词（忽略大小写）去重，只保留第一次出现；空单词、空释义的行会被跳过并在导入后提示
- 频段只接受 1–4；未指定时按内置词库的 1:2:2.5:2.5 比例自动分档
- 单个词库上限 50000 词，释义最长 300 字符
- 导入后自动切换为当前词库；每个账户记住自己的选择

导出的词库是标准 JSON，可再导入到另一台设备，或在 Web 版与 EXE 便携版之间迁移。

### 备份与迁移

| 操作 | 内容 | 适用场景 |
| --- | --- | --- |
| 导出当前词库进度 | 仅「当前账户 × 当前词库」的记录 + 设置 | 单个词库迁移 |
| 导出全量备份 | 所有账户、全部自定义词库、全部设置与进度 | 换电脑、Web ↔ EXE 迁移 |
| 导入全量备份 | 覆盖整个工作区 | 恢复 / 迁移（会先清空现有 v2 数据） |
| 重置工作区 | 恢复到「一个默认账户 + 内置词库」 | 彻底重来 |

> v1.0 的老数据不会丢：首次升级时自动迁移到「默认账户 × 内置 8000 词库」，原始 `localStorage['word-memory/v1']` 会保留不动。

---

## EXE 便携版（Electron）

### 构建与运行

```bash
npm install
npm run build:exe       # 先构建 Web 产物，再用 electron-builder 打包单文件 EXE
npm run verify:exe      # 冒烟测试：headless 启动 EXE + 校验 API/令牌/落盘/退出
npm run test:e2e:exe    # 真实浏览器端到端（需系统 Chrome / Edge）
```

主方案基于 **Electron 45 + electron-builder 26** 的 `portable` target：esbuild 先把主进程、零依赖 HTTP 服务与全部静态资源打成自包含 `main.cjs`，electron-builder 再产出单文件 `dist/WordMemory.exe`（约 106 MB）。构建需要 Windows 与 Node ≥ 20，产物在别的 Windows 机器上**不需要安装 Node 或任何运行库**。

双击后是真正的桌面应用窗口（Electron Chromium 内核、无地址栏、无控制台窗口），带中文菜单、自定义图标、窗口尺寸记忆与单实例锁。窗口内部仍复用已验证的本地 HTTP 服务与文件 KV：

1. 主进程在 `127.0.0.1` 随机端口启动服务
2. `BrowserWindow` 加载该地址，页面通过 `/api/snapshot` 一次性载入数据
3. 每次变更经 `/api/kv` 原子写入 EXE 同目录的文件
4. 关闭窗口 → `app.quit()` → 服务关闭，不留后台进程

> 为什么仍保留本地服务：把「数据存在哪」与「界面怎么渲染」解耦，Web 版、单文件版、Electron 版共用同一套前端与同一套存储逻辑；换成 IPC 重写只会增加分叉风险，没有实际收益。

### 目录结构

```
U 盘 / 任意目录/
├── WordMemory.exe
└── WordMemory-data/            ← 自动生成，与 EXE 同目录
    ├── kv/
    │   ├── <sha1(key)>.json     ← 每个逻辑键一个文件，原子写入
    │   └── …
    ├── window-state.json        ← 窗口位置与尺寸
    ├── runtime.json             ← 运行中的端口/版本（退出自动删除）
    └── wordmemory.log           ← 启动与错误日志（无控制台窗口时用于排错）
```

数据目录优先取 electron-builder portable 提供的 `PORTABLE_EXECUTABLE_DIR`——它指向**用户放置 EXE 的位置**，而不是程序自解压的临时目录；这正是 U 盘携带能生效的关键。可用 `WM_DATA_DIR` 覆盖；目录不可写时自动回退到 `用户目录/WordMemory-data`。

### 安全与网络

- 服务只监听 `127.0.0.1` 随机端口，不对外暴露，不访问互联网
- 每次启动生成随机令牌，只注入本程序打开的页面；所有 `/api/*` 请求必须携带 `x-wm-token`
- 校验 `Host` 头，阻断 DNS rebinding；拒绝 `..` 等非法键名与超大请求体
- 单实例锁避免两个进程同时写同一数据目录；窗口关闭即退出

### 环境变量与故障排查

| 变量 | 作用 |
| --- | --- |
| `WM_DATA_DIR` | 指定数据目录（优先级最高） |
| `WM_HEADLESS=1` | 只启动服务、不创建窗口，端口写入 `runtime.json`，供自动化测试/CI 使用 |
| `WM_NO_SINGLETON=1` | 允许并行实例（调试用） |
| `PORTABLE_EXECUTABLE_DIR` | 由 electron-builder portable 自动设置，无需手动指定 |
| `CHROME_PATH` | 端到端测试指定浏览器可执行文件 |

| 现象 | 处理 |
| --- | --- |
| 双击后没反应 | 看 `WordMemory-data/wordmemory.log`；未签名的 Electron 程序可能被安全软件拦截 |
| 提示数据目录不可写 | 把 EXE 移到可写目录，或设置 `WM_DATA_DIR` |
| 首次打开是空白 | 首次启动 portable exe 需自解压，等 3–10 秒 |
| 从 Electron 宿主终端启动报「需要以 Electron 主进程启动」 | 环境继承了 `ELECTRON_RUN_AS_NODE=1`，清除该变量后重试 |
| 杀毒软件报毒 | 未做代码签名，可能被误报；用 `dist/exe-info.json` 中的 SHA-256 校验 |

### 备用方案

`npm run build:sea` 仍保留 v2.0 的 Node SEA 方案（不依赖 Electron，约 84 MB，用系统 Chrome `--app` 打开），产物为 `dist/sea/WordMemory.exe`。主交付以 Electron 版为准。

---

## 学习方法：间隔重复

人脑遗忘是有规律的。德国心理学家艾宾浩斯发现，新学的信息在最初几天遗忘最快，之后逐渐平缓。**在即将忘记的那一刻复习**，能用最少的次数把记忆维持最久——这就是间隔重复（Spaced Repetition）。

本项目使用 SM-2 算法的变体，核心参数：

| 参数 | 值 | 含义 |
| --- | --- | --- |
| 学习步骤 | 1 分钟 → 10 分钟 | 新词的两次短间隔巩固 |
| 初始难度因子 EF | 2.5 | 决定复习间隔的增长速度 |
| EF 范围 | 1.3 – 3.0 | 答错降低，答对提高 |
| 毕业间隔 | 1 天 | 通过两个学习步骤后进入长期队列 |
| 「很简单」毕业 | 4 天 | 直接跳过学习步骤 |
| 最大间隔 | 365 天 | 再熟也不会超过一年 |
| 成熟词标准 | ≥ 21 天 | 用于统计「真正记住」的比例 |

四档评分对间隔的影响（复习阶段，当前间隔记为 `iv`）：

- **忘记了**：EF − 0.2，间隔重置，回到 1 分钟后重新学，遗忘次数 +1
- **有点模糊**：EF − 0.15，间隔 = `iv × 1.2`
- **记得**：EF 不变，间隔 = `iv × EF`
- **很简单**：EF + 0.15，间隔 = `iv × EF × 1.3`（且严格大于「记得」）

举例：一个词当前间隔 10 天、EF 2.5。

| 选择 | 下次出现 |
| --- | --- |
| 忘记了 | 1 分钟后重新学 |
| 有点模糊 | 12 天后 |
| 记得 | 25 天后 |
| 很简单 | 34 天后 |

算法细节、公式推导与边界处理见 [`docs/学习算法.md`](docs/学习算法.md)。

### 一套坚持得下去的使用节奏

1. **每天固定时间**打开，先清「待复习」，再学新词——顺序反了会让复习任务越积越多。
2. **新词别贪多**。每天 20 个新词，一个月后每天会产生约 60–100 个复习，这已经是不少的量。
3. **诚实自评**。觉得「有点模糊」就点「有点模糊」，算法会帮你多安排一次。
4. **善用「已掌握」**。像 `the`、`of` 这类词如果早就会了，直接标记掌握，别浪费时间。
5. **断更了别慌**。回来时复习量会很大，把「每日复习上限」调低到 50，慢慢消化，不要一次清空。

---

## 数据与隐私

- **浏览器版 / 单文件版**：全部数据保存在浏览器 **IndexedDB**（数据库 `word-memory`），键名以 `wm/v2/` 开头；不可用时自动降级 localStorage，再降级为内存。
- **EXE 便携版**：全部数据保存在 EXE 同目录的 `WordMemory-data/kv/*.json`，页面只与本机 `127.0.0.1` 的临时服务通信。
- 没有云端账号、没有埋点、没有外部网络请求（Web 版只在首次加载时读取本地 `data/words.json`）。
- 清除浏览器数据会丢失进度，**建议定期在「设置 → 数据 → 导出全量备份」**。
- 换设备 / 跨版本迁移：旧设备导出全量备份 JSON → 新设备「导入全量备份」。
- 隐私模式下若存储完全不可用，应用会降级为内存模式并提示导出备份。
- v1 老存档在首次升级时自动迁移，原 `localStorage['word-memory/v1']` 保留不删。

数据结构说明见 [`docs/数据结构.md`](docs/数据结构.md)。

---

## 项目结构

```
word-memory/
├── src/
│   ├── main.js                 # 入口：加载词库 → 准备 KV → 启动应用
│   ├── index.html              # 唯一的 HTML 模板（三端共用）
│   ├── core/                   # 纯逻辑，无 DOM 依赖，可被 Node 直接测试
│   │   ├── kv.js               # 同步快照 KV（内存 / IDB / localStorage / HTTP）
│   │   ├── workspace.js        # 多账户、多词库、进度隔离、v1 迁移、全量备份
│   │   ├── bookparse.js        # 自定义词库解析（JSON / CSV / TXT）与校验
│   │   ├── srs.js              # SM-2 间隔重复算法
│   │   ├── session.js          # 学习会话状态机
│   │   ├── scheduler.js        # 每日队列构建与交错
│   │   ├── store.js            # 状态存储、持久化、迁移、导入导出
│   │   ├── wordbook.js         # 词库索引与搜索
│   │   ├── quiz.js             # 出题与判分
│   │   ├── stats.js            # 统计、热力图、预测
│   │   └── util.js             # 时间/数值/随机数工具
│   ├── ui/
│   │   ├── app.js              # 主控制器：路由、渲染、事件、工作区切换
│   │   ├── dom.js              # DOM 辅助、确认/输入弹层、语音朗读
│   │   ├── icons.js            # 内联 SVG 图标
│   │   └── views/              # 视图的纯字符串渲染函数
│   │       ├── today.js · study.js · browse.js · stats.js · settings.js
│   │       ├── workspace.js    # 账户 / 词库管理卡片
│   │       └── topbar.js       # 顶栏账户与词库切换器
│   └── styles/main.css         # 全部样式（含深/浅主题变量）
├── desktop/                    # 便携版运行时
│   ├── electron/main.mjs       # Electron 主进程（窗口/菜单/单实例/生命周期）
│   ├── main.mjs                # SEA 备用方案入口（系统浏览器 --app）
│   ├── server.mjs              # 零依赖 HTTP 服务 + 文件 KV（两方案共用）
│   └── env.mjs                 # 数据目录、浏览器探测与启动
├── electron-builder.yml        # Electron portable 打包配置
├── data/words.json             # 构建产物：默认 8000 词数据集
├── scripts/
│   ├── build-data.mjs          # 词库数据管道（抓取 → 清洗 → 输出）
│   ├── build.mjs               # 打包 Web 版 + 单文件版
│   ├── build-exe.mjs           # Electron 打包（esbuild + electron-builder）
│   ├── build-sea.mjs           # SEA 备用方案打包
│   ├── verify-exe.mjs          # EXE 冒烟测试（headless）
│   ├── serve.mjs               # 本地预览服务器
│   ├── verify.mjs              # 产物校验（jsdom 真实加载单文件版）
│   ├── e2e.mjs                 # Web 版浏览器端到端回归
│   ├── e2e-exe.mjs             # EXE 版浏览器端到端回归
│   └── release-notes.mjs       # 从 CHANGELOG 生成 Release 说明
├── .github/workflows/          # 仓库根：CI + Release（含 Windows EXE 任务）
├── tests/                      # 141 个测试用例
├── docs/                       # 详细文档
├── dist/                       # 构建输出（已 gitignore）
└── package.json
```

架构说明见 [`docs/技术架构.md`](docs/技术架构.md)。

---

## 开发与构建

### 环境要求

- Node.js ≥ 18（推荐 20 / 22；**构建 EXE 需要 ≥ 20 且为 Windows**）
- npm ≥ 9

### 常用命令

```bash
npm install           # 安装开发依赖（esbuild、jsdom、playwright-core、electron、electron-builder）
npm run data          # 重建默认词库数据（有缓存则离线可用）
npm run data -- --fetch    # 强制重新下载源数据
npm run dev           # 构建并启动本地预览 http://127.0.0.1:4173
npm run build         # 构建 dist/web 与 dist/word-memory.html
npm test              # 运行全部测试（141 个用例）
npm run verify        # 测试 + 构建 + 产物校验（发布前必跑）
npm run build:exe     # 构建 Web 产物 + Electron 版 dist/WordMemory.exe
npm run build:sea     # 备用：Node SEA 版 dist/sea/WordMemory.exe
npm run verify:exe    # EXE 冒烟测试（需先 build:exe）
npm run test:e2e      # Web 版浏览器端到端回归（需先 build）
npm run test:e2e:exe  # EXE 版浏览器端到端回归（需先 build:exe）
node scripts/build-exe.mjs --bundle-only   # 只校验主进程可打包（CI 在 Linux 上用）
```

### 构建产物

| 文件 | 说明 |
| --- | --- |
| `dist/WordMemory.exe` | Electron 便携版，约 106 MB，双击即用，数据写同目录 `WordMemory-data/` |
| `dist/word-memory.html` | 单文件版，678 KB，内联 JS/CSS/数据，可离线双击运行 |
| `dist/web/index.html` | Web 版入口（Electron 也复用这份产物） |
| `dist/web/assets/app.js` | 打包压缩后的应用代码（IIFE，兼容 ES2019） |
| `dist/web/assets/app.css` | 样式 |
| `dist/web/data/words.json` | 默认词库数据（555 KB） |
| `dist/electron-app/main.cjs` | Electron 主进程自包含 bundle（构建中间产物） |
| `dist/electron-out/WordMemory.exe` | electron-builder 原始产物 |
| `dist/version.json` | 版本、词数、产物指纹 |
| `dist/exe-info.json` | EXE 引擎/版本、体积、SHA-256、内嵌资源清单 |

### 修改样式或逻辑

- 样式改 `src/styles/main.css`
- 页面结构改 `src/ui/views/*.js`（纯字符串模板）
- 交互逻辑改 `src/ui/app.js`
- 账户 / 词库规则改 `src/core/workspace.js`，词库导入格式改 `src/core/bookparse.js`
- 便携版窗口/菜单改 `desktop/electron/main.mjs`，本地服务改 `desktop/server.mjs`（改完需重新 `npm run build:exe`）
- Electron 打包配置改 `electron-builder.yml`（图标由 `scripts/build-exe.mjs` 自动生成 `dist/electron-app/icon.ico`）
- 学习算法改 `src/core/srs.js`（改完记得跑 `npm test`）

改完执行 `npm run build`，刷新浏览器即可看到效果。

---

## 测试

```bash
npm test
```

覆盖范围（13 个文件、141 个用例）：

| 测试文件 | 覆盖内容 | 用例数 |
| --- | --- | --- |
| `srs.test.js` | 间隔重复算法、边界、容错 | 18 |
| `store.test.js` | 持久化、迁移、导入导出、异常恢复 | 15 |
| `scheduler.test.js` | 队列构建、限额、优先级、交错 | 13 |
| `quiz.test.js` | 出题、干扰项、判分、题型降级 | 11 |
| `stats.test.js` | 统计口径、打卡、预测、热力图 | 8 |
| `session.test.js` | 会话推进、重排、跳过、统计 | 12 |
| `data.test.js` | 词库完整性、去重、体积 | 11 |
| `ui.test.js` | jsdom 界面集成（导航/学习/标记/设置） | 14 |
| `kv.test.js` | 四种 KV 后端、快照串行写入、HTTP 令牌、adapter | 8 |
| `bookparse.test.js` | JSON/CSV/TXT 解析、去重、自动分档、校验 | 8 |
| `workspace.test.js` | 账户/词库 CRUD、进度隔离、v1 迁移、全量备份 | 11 |
| `ui-workspace.test.js` | 顶栏切换、进度隔离、管理弹窗、词库导入 | 6 |
| `portable.test.js` | 便携版 HTTP 服务、令牌/Host 校验、文件落盘、portable 数据目录 | 6 |

产物校验（`npm run verify`）还会用 jsdom 真实加载 `dist/word-memory.html`，确认它能独立启动并渲染出 8000 词。

### 浏览器端到端测试

```bash
npm run build && npm run test:e2e          # Web 版，18 项断言
npm run build:exe && npm run verify:exe    # EXE 冒烟，13 项断言（CI 会跑）
npm run test:e2e:exe                       # EXE 真实浏览器，17 项断言
```

Web 版跑真实用户路径：学 8 张卡 → 落盘 → 刷新 → 标记掌握/重点 → 搜索 → 改设置 → 导出 → 清空 → 导入 → 键盘评分 → 切换主题。

EXE 版以 `WM_HEADLESS=1` 启动打包后的 Electron EXE（只起服务、不建窗口），验证：引擎与版本、文件落盘 → 新建账户 → 导入 CSV 词库 → 刷新后账户与词库仍在 → 无控制台异常。

这一层能捕获 jsdom 掩盖的问题（真实 IndexedDB / 真实本地文件、真实下载、真实渲染）。CI 的 Windows 任务会跑 EXE 冒烟；浏览器端到端因需要额外浏览器，只在本地发布前执行。

详细说明见 [`docs/测试与发布.md`](docs/测试与发布.md)。

---

## 词库数据来源

| 项 | 内容 |
| --- | --- |
| 词频排序 | COCA（Corpus of Contemporary American English）20000 词频表 |
| 中文释义 / 音标 | 来自开源项目 [qwerty-learner](https://github.com/Kaiyiwing/qwerty-learner)（MIT 许可）的 `coca20000.json` |
| 抓取地址 | `https://cdn.jsdelivr.net/gh/Kaiyiwing/qwerty-learner@master/public/dicts/coca20000.json` |
| 清洗规则 | 去重、剔除专有名词与冒犯性词汇、剔除空释义、压缩释义长度 |
| 最终规模 | 8000 条，555 KB |
| 数据指纹 | 见 `data/words.json` 的 `meta.sourceHash` |

数据管道是可复现的：同样的源文件必然生成同样的 `data/words.json`（脚本不含时间戳等易变字段）。重新生成：

```bash
npm run data -- --fetch
```

清洗规则详见 `scripts/build-data.mjs` 顶部注释。

---

## 发布流程

项目使用 GitHub Actions 自动化：

| 工作流 | 任务 | 触发条件 | 作用 |
| --- | --- | --- | --- |
| `word-memory-ci.yml` | `verify`（ubuntu） | PR / push 到 main | 语法检查（含 `desktop/`）→ 数据校验 → 单元测试 → 构建 → 产物校验 → Electron 主进程打包校验 |
| `word-memory-release.yml` | `build`（ubuntu） | 打 tag `word-memory-v*` / 手动 | 测试 → 构建 HTML → 生成发布说明 → 上传产物 |
| 同上 | **`build-exe`（windows-latest）** | 同上 | 缓存 Electron → `npm ci` → Windows 单元测试 → `build:exe` → `verify:exe` → 上传 EXE |
| 同上 | `release` | 依赖上面两者 | 创建 Release，附带单文件 HTML + `WordMemory.exe` + `exe-info.json` |
| 同上 | `pages` | 依赖 `build` | 部署 Web 版到 GitHub Pages |

EXE 构建失败不会阻塞 HTML/Pages 发布：Release 会带上 warning 说明并只发布 HTML。

发布新版本：

```bash
# 1. 更新版本号（package.json）
# 2. 更新 CHANGELOG.md
# 3. 提交并打 tag
git add .
git commit -m "feat(word-memory): 说明本次改动"
git tag word-memory-v2.1.0
git push origin main --tags
```

Tag 推送后，Windows 任务会自动构建 Electron 便携版、跑 13 项冒烟测试，并把 EXE 附到 Release；`dist/exe-info.json` 里的 SHA-256 可用来校验下载文件。也可以在 Actions 页面手动 `workflow_dispatch` 重新发布某个 tag。

> CI 的 Linux 任务设置 `ELECTRON_SKIP_BINARY_DOWNLOAD=1` 跳过 Electron 二进制下载，并用 `--bundle-only` 校验主进程可打包；只有 Windows 任务真正产出 EXE。

---

## 常见问题

**Q：单文件版保存不了进度？**
A：Chrome / Edge / Firefox 在 `file://` 下允许 IndexedDB / localStorage，但个别浏览器（如部分 Safari 版本）会限制。如果看到「当前环境无法自动保存进度」的提示，改用 Web 版（`npm run dev`）、EXE 便携版，或通过本地服务器打开。

**Q：v1 的老进度会丢吗？**
A：不会。首次打开 v2 会自动迁移到「默认账户 × 内置 8000 词库」，原始 `localStorage['word-memory/v1']` 保留不删。

**Q：换了电脑，进度怎么迁移？**
A：旧设备「设置 → 数据 → 导出」得到 JSON 文件，新设备「导入」即可，会覆盖当前进度。

**Q：为什么第一个词是 `the`？**
A：词库严格按 COCA 使用频率排序，`the` 确实是英语中出现频率最高的词。如果你早就会了，在词库里标记「已掌握」即可跳过。

**Q：某个词的释义不准确怎么办？**
A：释义来自开源词典的自动提取，可能存在少量偏差。可以点击卡片上的「已掌握」跳过它，或在 `scripts/build-data.mjs` 中加入自定义修正规则后重新生成数据。

**Q：每天学多少个词合适？**
A：新手 10–20 个。经验公式：**每天复习量 ≈ 新词数 × 3～5**。每天 20 个新词，一个月后每天大约要复习 60–100 个词，需要 15–25 分钟。

**Q：为什么答错的词会马上再出现一次？**
A：这是有意的设计——短期记忆在几分钟内最脆弱，即时重来一次能显著提高当天的留存率。同一张卡最多出现 3 次，不会死循环。

**Q：能离线使用吗？**
A：单文件版与 EXE 便携版完全离线；Web 版除了首次加载本地 `data/words.json` 外也不发出任何网络请求。语音朗读依赖系统语音引擎，部分浏览器需要联网下载语音包。

**Q：一台电脑几个人一起背，进度会混吗？**
A：不会。给每个人建一个账户，学习记录、统计、设置按账户完全隔离，顶栏一键切换。每个账户还能各自选不同的词库。

**Q：切换词库后原来的进度还在吗？**
A：在。进度按「账户 × 词库」分开存放，切回来会完整恢复。词库列表里也可以随时导出某个词库的 JSON。

**Q：怎么导入自己的词表？**
A：设置 → 词库 → 导入词库，选 `.csv` / `.txt`（每行「单词,释义」）或 `.json`。表头、注释、重复词会自动处理，导入后自动切换过去。格式示例见 [账户与词库](#账户与词库)。

**Q：EXE 的数据在哪？换电脑怎么带走？**
A：在 EXE 同目录的 `WordMemory-data/`。把 `WordMemory.exe` 和这个文件夹一起拷走即可；也可以在任何一端用「导出全量备份 → 导入全量备份」在 Web 版与便携版之间迁移。

**Q：EXE 会不会偷偷联网 / 占着后台不退？**
A：只监听 `127.0.0.1` 的随机端口，页面与本机服务之间的通信需要一次性令牌；Electron 窗口关闭即完全退出，不留后台进程，也不再需要心跳计时器。

**Q：为什么 EXE 有 100 多 MB？和之前的版本有什么不同？**
A：v2.1 起用 Electron 打包，内置了 Chromium 运行时，所以体积从 SEA 版的 84 MB 增至约 106 MB，换来的是独立桌面窗口、无需系统浏览器、菜单与窗口状态记忆。原来的 Node SEA 方案仍可用 `npm run build:sea` 构建（`dist/sea/WordMemory.exe`），适合追求体积的场景。

**Q：CI 会自动发布 EXE 吗？**
A：会。打 `word-memory-v*` tag 后，`windows-latest` 任务自动构建、跑冒烟测试并上传 `WordMemory.exe` 到 Release；Linux 任务同时发布单文件 HTML 与 Pages。EXE 构建失败不会阻塞 HTML 发布。

---

## 许可

- 代码：MIT
- 词库数据：来自 [qwerty-learner](https://github.com/Kaiyiwing/qwerty-learner)（MIT），词频基于 COCA 语料库统计结果

本项目仅供学习使用，不构成任何形式的商业承诺。
