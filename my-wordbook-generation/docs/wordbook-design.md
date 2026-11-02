# Wordbook 单词书 — 设计说明

日期：2026-11-02
状态：设计已确认，进入实现

## 1. 目标与范围

一个完全离线的本地单词学习应用，面向中文母语的英语学习者。核心能力：

- 三级场景词库：日常对话 2,000 / 影视 4,000 / 阅读书报 8,000（累积，L2 含 L1，L3 含 L2）。
- 每日学习与复习，不认识的词自动进入生词本。
- 生词本支持 CSV、XLSX、TXT、Markdown、JSON、Anki CSV 六种导出。
- 科学记忆：SM-2 间隔重复 + 主动回忆题型 + 错词强化 + 复习负载可视化。
- 三种运行形态：本地网页（双击 `index.html`）、Edge 启动器（隐藏本地服务 + 独立窗口）、Electron 桌面版（系统托盘常驻）。

非目标：账号云同步、AI 生成助记、原生移动端、社区功能。

## 2. 词库

数据源：ECDICT（https://github.com/skywind3000/ECDICT ，MIT）。构建脚本从 `ecdict.csv` 生成
`js/data/wordbank.js`，以 `window.WB_WORDBANK` 暴露，保证 `file://` 下也能加载。

筛选规则：

- 只收小写单词原形（保留 `I`），允许连字符与撇号；剔除专有名词、变形词（exchange 含 `0:`/`1:`）。
- 必须有中文释义；清洗 `\n`、`\r`、`[网络]`/`[计]` 等标签与噪声行。
- 按 ECDICT `frq`/`bnc` 的较小词频序号升序排序（数值越小越常用），取前 8,000 个。
- 前 2,000 为 L1，接着 2,000 为 L2，最后 4,000 为 L3。
- 约 150 个基础功能词（the/and/of…）标记 `basic: true`，默认从每日队列跳过，可在设置中开启。
- 每条字段：`w` 单词、`ph` 音标、`zh` 中文释义数组、`r` 词频序号、`tag` 考试标签、`basic`、`t` 档位。
- 元信息包含 `version/builtAt/source/license/tiers/total`。
- 构建与校验：`python scripts/build_wordbank.py`；校验脚本检查 8000 条、无重复、每档数量精确、释义非空。

## 3. 页面与学习闭环

导航：今日 / 学习 / 复习 / 生词本 / 统计 / 设置。

- 首次引导：选择档位（默认 L1）、每日新词数（默认 20）、主题；写入设置后进入今日页。
- 今日页：当前档位、今日新词与待复习数量、连续打卡、目标进度、开始按钮、未来 7 天到期提示。
- 学习会话（新词）：
  - 正面：单词、音标、发音按钮；提示先主动回忆再翻面。
  - 翻面：中文释义、档位/词频/考试标签、加入生词本、评分（忘记 / 模糊 / 记得 / 简单）。
  - 评分后按 SM-2 排期；忘记自动进生词本并在本轮稍后重现。
- 复习会话：到期卡片，按设置随机使用四种题型：
  1. 英→中：四选一（干扰项取自同档位其他词）。
  2. 中→英：显示中文，回忆后翻面自评。
  3. 拼写：显示中文与音标，输入英文，校验后自评。
  4. 听音：播放发音，四选一英文。
  - 答错自动进生词本；答错卡本轮稍后重现。
- 生词本：搜索（单词/释义）、筛选（档位/来源/掌握/难词）、排序；支持备注、标记掌握、移除、选中后开始复习、导出。
- 统计：连续打卡、累计学习、掌握数、生词数、今日正确率；12 周热力图；未来 30 天复习负载；档位进度。
- 设置：档位、每日新词、复习上限、跳过基础词、启用题型、自动收录、主题、全量 JSON 备份、清空数据（二次确认）。

每日队列规则：先到期复习（上限 `reviewCap`，默认 200），再新词（每日上限 `dailyNew`，默认 20）。

## 4. 记忆算法（SM-2 变体）

卡片字段：`state`（new/learning/review/relearning）、`ease`（默认 2.5）、`interval`（天）、`due`（本地日期 YYYY-MM-DD）、`reps`、`lapses`、`lastGrade`、`firstLearned`。

评分映射与排期：

- 忘记（quality 2）：`lapses+1`，`ease-0.2`（下限 1.3），`interval=1`，`due=今天`，`state=relearning`。
- 模糊（quality 3）：`ease-0.15`（下限 1.3）；新卡 `interval=1`，已有卡 `interval=max(1, round(interval*1.2))`。
- 记得（quality 4）：新卡 `interval=1`；第二次 `interval=3`；之后 `interval=round(interval*ease)`。
- 简单（quality 5）：新卡 `interval=2`；第二次 `interval=5`；之后 `interval=round(interval*ease*1.3)`，`ease+0.15`（上限 3.0）。
- 间隔 > 7 天时加 ±5% 随机模糊；上限 365 天。
- 连续遗忘 4 次标记 `leech`，自动进生词本并优先出现在复习队列。
- 预估保持率：`0.9^(elapsed/interval)`，仅用于图表展示。

科学依据：间隔重复（spacing effect）、主动回忆（testing effect）、复习优先、错词再现。

## 5. 存储

localStorage，前缀 `wb:v1:`：

- `settings`：`{tier, dailyNew, reviewCap, skipBasic, modes, autoAddUnknown, theme, onboardingDone}`
- `cards`：以单词为键的卡片对象。
- `notebook`：以单词为键：`{addedAt, source, note, mastered, leech}`
- `reviews`：数组 `{w, ts, grade, mode}`，上限 10,000 条（超出截断最旧）。
- `daily`：`{YYYY-MM-DD: {newCount, reviewCount, correct, total}}`
- `meta`：`{version, createdAt, lastOpen}`

写入即时保存；读取做 schema 兜底与版本迁移；导出 JSON 包含全部数据。

## 6. 导出

统一从生词本导出，按钮触发浏览器下载：

- CSV：UTF-8 BOM，逗号转义，Excel 直接打开。
- XLSX：内置 SheetJS 浏览器版（`vendor/xlsx.full.min.js`），单工作表“生词本”。
- TXT：纯文本，一行一词。
- Markdown：标题 + 表格。
- JSON：`settings/cards/notebook/reviews/daily/meta` 全量备份。
- Anki CSV：`#separator:Tab`、`#html:false` 头部，三列 Front/Back/Tags，UTF-8。

列：单词、音标、释义、档位、来源、加入日期、掌握状态、复习次数、下次复习、备注。

## 7. 架构与文件

原生 HTML/CSS/JS，无构建工具，经典 script 顺序加载，全局命名空间 `window.WB`，确保 `file://` 可用。

```
index.html
manifest.webmanifest
sw.js
vendor/xlsx.full.min.js
css/tokens.css
css/app.css
js/data/wordbank.js        # 生成物
js/core/store.js           # 设置/卡片/生词本/统计持久化
js/core/srs.js             # SM-2 纯函数
js/core/words.js           # 词库索引、档位过滤、干扰项
js/core/session.js         # 队列与会话状态
js/core/export.js          # 六种导出（纯函数 + 下载）
js/core/speech.js          # Web Speech API
js/ui/*.js                 # today/learn/review/notebook/stats/settings/onboarding
js/main.js                 # 路由与启动
scripts/build_wordbank.py
scripts/serve.mjs          # 本地静态服务，端口 4173
启动单词书.vbs              # 隐藏启动服务 + Edge --app 窗口
desktop/main.js            # Electron 主进程：窗口、托盘、单实例、状态记忆
desktop/icon.*             # 桌面图标（png / ico）
package.json               # desktop 与 package 脚本
tests/*.test.mjs           # node --test
```

桌面：`启动单词书.vbs` 运行 `node scripts/serve.mjs`（隐藏窗口），再用 Edge `--app=http://127.0.0.1:4173` 打开独立窗口；`manifest.webmanifest` + `sw.js` 支持安装为桌面应用。`file://` 模式不依赖服务。

Electron 桌面版：`npm install` 后 `npm run desktop` 启动，`npm run package` 用 electron-packager 生成
`dist/Wordbook-win32-x64/`。关闭窗口隐藏到系统托盘（右键退出），单实例运行，窗口位置与大小写入
`%APPDATA%\单词书\window-state.json`；渲染进程启用 `contextIsolation` / `sandbox` 并禁用
`nodeIntegration`，不产生子窗口、不导航到外部页面。三种形态各自使用独立的本地存储，
可通过设置页的全量 JSON 备份与导入迁移。

## 8. 验收

- 词库精确 2,000 / 4,000 / 8,000，累积且无重复，释义齐全。
- 首次引导 → 今日页 → 学习 → 复习 → 生词本 → 导出全链路可用。
- 不认识的词进入生词本；答错/忘记自动收录；可备注、掌握、移除。
- 六种导出文件可正常打开，CSV 不乱码，XLSX 可读，JSON 可解析，Anki 格式可导入。
- 刷新与重启后数据不丢；`file://`、桌面启动器与 Electron 桌面版均可运行。
- Electron 版单实例、关闭最小化到托盘、托盘可恢复窗口并可退出；导入全量备份后设置、卡片、生词本与统计全部生效。
- `node --test` 覆盖 SRS 排期、队列、导出纯函数、词库校验。
