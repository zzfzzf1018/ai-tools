# 数学奇妙岛 Math Wonder Island · 设计文档

- 日期：2026-11-03
- 状态：已批准（用户确认方案 C）
- 项目路径：`c:\flying\ai-tools\children-math-study`

## 1. 背景与目标

为小学生（一至五年级，上海教材沪教版）打造的数学学习桌面工具。目标不是刷题，而是让小朋友轻松愉快地理解数学概念、建立数学思维。题目全部原创情景化，不照搬课本。

### 已确认的关键决策

| 决策点 | 结论 |
|---|---|
| 使用者 | 覆盖一至五年级，均衡开发 |
| 产品形态 | Electron 桌面应用（portable exe）+ Web 版 zip，同 children-eng-study 架构 |
| 内容策略 | 内置静态内容（开发期生成，打包进应用，完全离线） |
| 学习体验 | 方案 C：故事引入 → 互动探索 → 闯关练习 三步闭环 |
| 视觉风格 | 方案 C：成长式双画风（低年级糖果风、高年级太空风、三年级过渡） |

## 2. 课程内容体系（沪教版）

- 内容以 JS 模块形式打包进应用（`content/grade1.js` … `content/grade5.js`，各自定义 `window.CONTENT_GRADE_N`，经 script 标签加载——避免 file:// 下 fetch JSON 的限制，Electron 与 Web 双端通用）
- 每年级按学期组织单元，每单元含 3-6 个知识点（lesson）
- 每个 lesson 三段结构：
  1. `story` — 分镜式图文故事（3-4 幕），概念放进情景
  2. `explore` — 可动手的互动演示（拖拽分组、点击计数、数轴滑动、铺方格、天平等复用引擎）
  3. `games` — 3-5 关闯关小游戏（choice / input / dragdrop / sequence 题型），错题进入提示阶梯（情境提示 → 图示提示 → 讲解）

### 沪教版知识点覆盖（v1.0 范围）

- 一年级：10 以内数与加减、20 以内加减（进位/退位）、认识图形、100 以内数、认识人民币、整时半时
- 二年级：乘法口诀与乘除法、千以内数、三位数加减、角、克与千克、时分秒
- 三年级：一位数乘除两三位数、年月日、周长、面积、小数初步、分数初步
- 四年级：大数的认识、运算定律、角的度量、平行与垂直、小数意义与加减、三角形、平均数
- 五年级：小数乘除法、简易方程、多边形面积、分数意义与加减、因数与倍数、长方体正方体

v1.0 每年级先内置 6 个代表性知识点（每学期 3 个），后续版本扩充。

## 3. 视觉体系

- 一二年级 `candy` 主题：糖果色渐变背景、大圆角、大表情符号
- 三年级 `transition` 主题：清新过渡色
- 四五年级 `space` 主题：深蓝底、霓虹点缀、太空角色
- 全部通过 CSS 变量换肤，无位图依赖；插画用内联 SVG + Emoji
- 陪伴角色 IP：向导小机器人"闪闪"（以 SVG/Emoji 组合呈现），贯穿故事与引导

## 4. 技术架构

```
children-math-study/
├── index.html            # 单页应用入口
├── css/
│   ├── base.css          # 布局、组件通用样式
│   └── themes.css        # 三套主题 CSS 变量
├── js/
│   ├── app.js            # 路由与页面切换（年级→单元→lesson）
│   ├── data.js           # 内容加载与课程元数据
│   ├── lesson.js         # lesson 播放器（story/explore/games 状态机）
│   ├── explore.js        # 互动探索引擎（拖拽分组/计数/数轴/方格/天平）
│   ├── game.js           # 闯关引擎（4 种题型 + 提示阶梯 + 判分）
│   ├── rewards.js        # 星星/勋章/错题本
│   ├── parent.js         # 家长视图
│   └── save.js           # 进度存取（Electron IPC / localStorage 双通道）
├── content/
│   └── grade1..5.json    # 课程内容
├── desktop/
│   ├── main.js           # Electron 主进程
│   ├── preload.js        # contextBridge 存取接口
│   └── icon.ico/png
├── docs/superpowers/specs/  # 设计文档
└── package.json          # electron + electron-builder（portable）
```

- 渲染层纯 vanilla JS（无构建步骤、无框架），与兄弟项目一致
- 进度保存：Electron 下经 IPC 写 `userData/mathwonder-save.json`；Web 版降级 localStorage
- 错题本数据结构：`{lessonId, questionId, count, lastAt}`，答对两次自动移出

## 5. 家长视图（轻量）

- 主界面入口进入（无需密码，v1.0 不做家长锁）
- 展示：各年级/单元完成度与星级、错题分布、建议练习的知识点

## 6. 发布规范

- tag 格式：`children-math-study-vX.Y.Z`（monorepo 规范）
- GitHub Release 附：Windows portable exe、Web 版 zip、SHA256 校验
- 小改动仅升 patch 版本，无空提交

## 7. 测试要点

- 浏览器跑通：年级选择 → 单元地图 → lesson 三段闭环 → 星星结算 → 错题本 → 家长视图
- 三主题切换正确（按年级自动）
- 拖拽/点击互动在桌面（Electron）与 Web（触屏/鼠标）均可操作
- 进度保存与恢复（刷新/重启不丢失）

## 8. v1.1 扩展设计（2026-11-07）

### 8.1 语音播报
- 新增 `js/speech.js`，基于系统本地 Web Speech API（离线、无素材、不联网）；不支持或缺少中文语音时自动降级
- 覆盖：闯关题干 / 选项 / 拖放数字卡 / 提示 / 故事分镜 / 探索要求与结论 / 结算语 / 错题本题干 / 练习中心全部题型
- 文本清洗层 `toSpeakText`：去 emoji 与 HTML、数学符号中文化、填空位读「几」、小数逐位读、分数按中文语序读
- 设置项存于 `settings`：`speech` / `autoRead` / `readOptions` / `speechRate` / `speechPitch` / `speechVoiceURI`
- 顶栏提供全局开关；每次切题、换页、切换学习阶段统一 `Speech.stop()`

### 8.2 单元递进
- `Data.pathOf(grade)` 将「学期 → 单元 → 课程」展平成连续路径，每个节点带 `unitKey = g{年级}s{学期序号}u{单元序号}`、`semesterIndex`、`unitIndex`、`order`
- 解锁规则：第一课默认开放，其余课程要求路径中前一课已完成；**跨单元、跨学期不再重置**（修正 v1.0 每单元重置 `prevDone` 的缺陷）
- 配套 API：`isUnlocked` / `unitProgress` / `unitMeta` / `gradeUnits` / `allUnitKeys` / `nextToLearn` / `unitQuestions` / `prevLesson`
- UI：学习路线横幅、单元序号与状态徽章、单元进度条、锁定提示、单元通行证、单元小测入口
- 存档新增 `unitPassed`（单元首次通关）与 `unitQuiz`（小测成绩），均带脏数据兜底

### 8.3 练习中心
- 新增 `js/practice.js`，统一复用 `Game.mount`，因此自动继承语音、提示阶梯与键盘作答
- 每日口算：按年级动态生成，5 个年级各有题型池；干扰项与提示自动生成
- 听算模式：题干只播报不显示，强制输入题；语音不可用时退回普通显示
- 单元综合小测：单元全通关后开放，抽题组卷、按错题数评星、成绩存档
- 错题一键组卷：跨课组卷按题目自身 `lessonId` 归属，答对两次仍自动移出
- `Game.mount` 新增 `transient`（练习不写错题本）与逐题 `lessonId` 归属；`onQuestionDone` 回调正式启用

### 8.4 成长数据与家长视图
- 存档新增 `stats`（累计首次作答/正确）与 `daily`（按本地日期的答题、正确、练习次数、用时）
- 家长视图：连续打卡、正确率、近 7 日柱状图、各年级当前进度、单元掌握度、语音设置、孩子姓名

### 8.5 自检与端到端回归
- `scripts/verify.js`（`npm run verify`）：纯 Node VM 沙箱加载全部前端脚本，校验语法、内容、解锁链、动态出题、朗读文本、存档兜底，无需浏览器与第三方依赖
- `scripts/e2e.html` + `scripts/e2e.js`（`npm run e2e`）：Edge/Chrome headless 加载真实 DOM 页面，模拟点击完整通关一课、错题重做、单元小测、听算失败兜底与脏存档导入；结果以 `#e2e-out` JSON 回传，Node 侧解析并给出退出码

### 8.6 封板前复审确立的约束
- **任何隐藏题目文字的模式都必须有可见出口**：`Speech.canAural()` 检查系统语音，朗读失败（`speak()` 返回 false 或 `onerror`）立即 `reveal()`，工具条恒定保留「👀 显示题目」
- **题目进入渲染器前统一过 `Game._normalizeQuestion`**：缺答案丢弃、结构不符降级、所有文本转义；存档导入时 `Save.normalize` 再逐字段收敛一次，形成两道防线
- **所有弹层内嵌游戏实例必须可退出**：关闭按钮 + Esc，`UI.closeOverlay()` 统一调用 `box._gameDispose()` 释放键盘/拖拽监听
- **正确率口径为每题首次作答**：`safeJudge` 用 `answered` 锁，先错后对只记一笔
- **异步结算需检查节点仍在文档中**：`if (!body.isConnected) return;`
- 换页前统一 `Speech.stop()` + 调用所有 `[data-game-mount]` 的 dispose + 清理 `.drag-ghost` 残影

## 9. v1.2 扩展设计（2026-11-07）

### 9.1 错题同类题自动变形
- 新增 `js/variants.js`，两条生成路径，均输出标准题目对象并复用 `Game.mount`（自动继承语音、提示、键盘）
- **结构变形**：题干含 `A op B = ⬜` / `A op ⬜ = C` / `⬜ op B = C` 时，保留中文措辞、替换数字、按运算关系重算答案
- **语义反推**（情景题）：提取题干全部数字（1~3 个），枚举 12 个候选算术关系（`n±1 / n×2 / n÷2 / a±b / a×b / a÷b / a+b+1 / b-a+1` 等），仅当**唯一**关系能复现原题答案时才变形；新数字代入同一公式得到新答案，保证不出错题
- **知识点兜底**：`conceptsToKinds()` 把课程 `concept`/标题映射到 15 类同结构生成器（加减乘除、凑十、小数、分数、因数、方程、平均分、比大小、数数）；按年级给默认池
- 变式全对调用 `Save.consolidateWrong()` 给原错题记一次连对；`Save.recordVariant()` 累计训练次数与正确率
- 入口：错题本单条弹层、独立页 `#/variants`、首页「变式再练」

### 9.2 星星商店与装扮
- 新增 `js/shop.js`，16 件商品（8 头像 + 8 挂件），价格 0~30 星
- `Save.data.wallet = { spent, owned }`；`availableStars() = totalStars() - spent`，重玩刷新更高星级自动补余额
- 免费基础款恒定拥有；`buy()` 校验余额与重复购买，`equip()` 切换 `player.avatar` / `player.accessory`
- 形象展示点：顶栏按钮、首页问候、通关奖状、家长档案、商店主视觉
- 勋章由 6 枚扩到 12 枚，`Rewards.checkBadges()` 读取 `daily.aural`、`unitQuiz.stars`、`stats.variantSessions`、`wallet.owned`、`Save.streak()`；`grantBadgesSoon()` 在练习/变式结算后即时补发

### 9.3 存档兼容
- 新增字段全部经 `normalize()` 收敛；旧存档导入后自动补齐默认值（免费装扮、空钱包、零变式统计）
- `reset()` 保留孩子姓名，头像/挂件与钱包一起恢复默认，避免「戴着未解锁装扮」的状态不一致
