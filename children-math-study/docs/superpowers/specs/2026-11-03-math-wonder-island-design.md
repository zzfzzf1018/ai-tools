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
