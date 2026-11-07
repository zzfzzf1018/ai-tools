# 更新日志

本文件记录 WordMemory 的所有重要变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [2.1.0] - 2026-11-07

EXE 主方案改为 Electron 桌面应用，并接入 GitHub Actions 自动构建与发布。

### 新增

- **Electron 便携版**：`npm run build:exe` 现在用 Electron 45 + electron-builder 26 的 `portable` target 产出 `dist/WordMemory.exe`（约 106 MB）
  - 真正的桌面窗口：自带 Chromium 内核，无地址栏、无控制台，不依赖系统 Chrome/Edge
  - 中文菜单（文件 / 视图 / 帮助）、自定义 256×256 图标、窗口尺寸与位置记忆、单实例锁
  - `desktop/electron/main.mjs` 复用 `desktop/server.mjs` 的零依赖本地服务与文件 KV，前端代码完全不变
  - 数据目录优先取 `PORTABLE_EXECUTABLE_DIR`（用户放置 EXE 的位置），而不是 portable 自解压的临时目录，U 盘携带有效
  - 新增 `WordMemory-data/{runtime.json,window-state.json,wordmemory.log}`：运行端口、窗口状态、无控制台时的排错日志
  - 关闭窗口即退出，移除 SEA 版的心跳计时器
- **CI 自动发布 EXE**：`word-memory-release.yml` 新增 `build-exe` job（windows-latest）
  - 缓存 Electron / electron-builder 下载、Windows 平台单元测试、`build:exe`、`verify:exe`、上传 EXE artifact
  - `release` job 把 `WordMemory.exe` 与 `exe-info.json` 一起附到 GitHub Release；EXE 构建失败不影响 HTML/Pages 发布（带 warning）
  - `word-memory-ci.yml` 增加 `desktop/` 语法检查与 `build-exe.mjs --bundle-only` 主进程打包校验；Linux 任务用 `ELECTRON_SKIP_BINARY_DOWNLOAD=1` 避免下载二进制
- **自动化测试模式**：`WM_HEADLESS=1` 只启动服务、不创建窗口，端口写入 `runtime.json`；`verify:exe` / `test:e2e:exe` 改用它验证打包后的 EXE
- **备用方案保留**：`npm run build:sea` 仍可产出 v2.0 的 Node SEA 版 `dist/sea/WordMemory.exe`（约 84 MB）

### 变更

- `desktop/env.mjs` 的 `resolveDataDir()` 新增 `portableDir` / `packaged` 参数，按 `WM_DATA_DIR → PORTABLE_EXECUTABLE_DIR → EXE 目录 → 用户目录` 依次回退
- `server.mjs` 的 `/api/shutdown` 延迟 150 ms 再断开连接，避免 `closeAllConnections()` 截断响应
- `scripts/build.mjs` 不再整目录删除 `dist`，改为精确清理自身产物（避免误删 EXE 打包中间目录）
- `scripts/build-exe.mjs` 重写为 Electron 打包，并支持 `--bundle-only` 快速校验；新增 `electron-builder.yml` 与 `scripts/build-sea.mjs`
- 依赖新增 `electron@45.2.1`、`electron-builder@26.18.0`；`postject` 保留给 SEA 备用方案

### 修复

- Electron 从 Electron 宿主派生的终端启动时若继承了 `ELECTRON_RUN_AS_NODE=1`，会退化成纯 Node 并崩溃；主进程现在给出明确报错，测试脚本启动前清除该变量
- portable EXE 首次启动需要自解压，测试脚本的端口等待改为轮询 `runtime.json`（GUI 程序 stdout 不可靠），超时放宽到 120 秒
- `/api/shutdown` 增加 `app.exit()` 兜底，保证 headless 无窗口时也能退出

### 工程

- 测试从 140 增至 141 个（新增 portable 数据目录优先级用例）
- 验证链：141 单测 · 7 产物校验 · **13** EXE 冒烟 · **17** EXE 浏览器端到端 · 18 Web 端到端，全部通过
- 额外验证：Electron GUI 窗口模式能启动、数据目录正确落在 EXE 同目录、窗口状态写入、退出无残留进程

### 已知限制

- Electron 便携版约 106 MB，未做代码签名，个别杀毒软件可能误报（用 `dist/exe-info.json` 的 SHA-256 校验）
- 只在 Windows 构建；`portable` target 首次启动需自解压，比 SEA 版略慢
- CI 的 Windows 任务首次构建需下载 Electron 与 NSIS 工具（已加缓存），约 3–6 分钟

---

## [2.0.0] - 2026-11-07

多账户、可替换词库与 Windows EXE 便携版。学习记录从「一份存档」升级为「账户 × 词库」二维隔离。

### 新增

- **EXE 便携版**：`npm run build:exe` 产出单文件 `dist/WordMemory.exe`，基于 Node 22 SEA + postject，免安装、免装 Node、约 84 MB
  - 双击后用 Chrome / Edge `--app` 模式打开独立窗口，使用独立浏览器配置
  - 数据写入 EXE 同目录 `WordMemory-data/kv/*.json`，整个目录可放 U 盘随身带走
  - 内置零依赖 HTTP 服务：静态资源内嵌、快照读取、单键原子写入
  - 每次启动生成随机会话令牌 + 校验 Host，只监听 `127.0.0.1`；页面心跳消失 2 分钟自动退出
  - 支持 `WM_DATA_DIR` / `WM_NO_BROWSER` 环境变量，目录不可写时回退用户目录
- **可替换词库**：内置 8000 词作为默认词库（不可删除），可导入任意多个自定义词库并随时切换
  - 支持 JSON（本项目结构 / 对象数组 / 单词→释义映射）、CSV、TXT/Tab 分隔
  - 表头与注释跳过、重复词去重、空释义过滤、频段按 1:2:2.5:2.5 自动分档
  - 词库可重命名、导出、删除；删除时清理所有账户在该词库下的进度
- **多账户**：可创建任意多个账户（不同人背单词），顶栏随时切换
  - 学习记录 / 统计 / 标记按「账户 × 词库」独立，设置按账户共享（跨词库不重置）
  - 每个账户记住自己上次使用的词库
  - 支持新建、重命名、删除，至少保留一个账户
- **全量备份**：导出 / 导入包含所有账户、自定义词库、设置与进度的工作区备份；原「单库进度」导出保留
- **v1 自动迁移**：首次启动把 `localStorage['word-memory/v1']` 迁到「默认账户 × 内置词库」，原数据不删除
- **顶栏工作区切换条**：账户 / 词库下拉 + 存储模式提示 + 管理入口，桌面与移动端均可用
- **设置页管理区**：账户与词库列表、导入入口、账户设置共享说明

### 变更

- 浏览器版存储从 `localStorage['word-memory/v1']` 改为 IndexedDB（数据库 `word-memory`），不可用时逐级降级 localStorage / 内存
- `store.js` 新增可选 `settingsKey`，把账户级设置从学习记录中分离；不传该参数时保持 v1 行为，既有测试与备份格式不变
- `main.js` 启动时先准备 KV 后端与工作区，再同步挂载应用；Web / 单文件 / EXE 共用同一份前端代码
- `e2e.mjs` 改为从 IndexedDB 读取断言数据，适配新的存储结构

### 工程

- 新增 `src/core/kv.js`、`workspace.js`、`bookparse.js`，`src/ui/views/workspace.js`、`topbar.js`
- 新增 `desktop/main.mjs`、`server.mjs`、`env.mjs`
- 新增 `scripts/build-exe.mjs`、`verify-exe.mjs`、`e2e-exe.mjs` 与 npm 命令 `build:exe` / `verify:exe` / `test:e2e:exe`
- 新增 `postject` 开发依赖；测试从 102 增至 140 个（新增 KV / 词库解析 / 工作区 / 工作区 UI / 便携版服务 5 组）
- 产物校验 7 项、EXE 冒烟 12 项、EXE 浏览器端到端 16 项、Web 浏览器端到端 18 项全部通过

### 已知限制

- EXE 只在 Windows 构建；产物约 84 MB，未做代码签名，个别杀毒软件可能误报（可用 `dist/exe-info.json` 的 SHA-256 校验）
- EXE 尚未接入 GitHub Actions 发布，需要本地构建后手动上传到 Release —— **2.1.0 已接入 CI**
- 便携版依赖系统 Chrome / Edge；找不到时只启动服务并打印地址，需手动打开 —— **2.1.0 Electron 版已自带窗口**
- 自定义词库单库上限 50000 词；学习记录仍以词库索引为主键，因此重新导入同一词库时应保持词条顺序稳定

---

## [1.0.0] - 2026-11-07

首个正式版本。

### 新增

- **8000 词词库**：基于 COCA 词频表，按使用频率排序，含中文释义与英式音标
- **四档频段**：核心（1–1000）、常用（1001–3000）、进阶（3001–5500）、拓展（5501–8000）
- **SM-2 间隔重复算法**：两段学习步骤（1 分钟 / 10 分钟）+ 四档自评 + 难度因子动态调整
- **三种题型**：看英文选中文、看中文选英文、拼写填空，支持混合模式
- **功能词降级**：冠词/介词/连词/代词等只考英译中，避免无意义的长释义题干
- **词汇标记**：⭐ 重点（优先复习）、✓ 已掌握（移出队列），均可撤销
- **学习会话**：答错的卡片本轮内重排（最多 3 次），支持跳过、直接看答案、标记掌握
- **词库浏览**：中英文双向搜索、状态筛选、频段筛选、分页浏览
- **学习统计**：今日进度、连续打卡、13 周热力图、14 天堆叠柱状图、频段掌握、记忆强度分布、未来 7 天到期预测
- **本地持久化**：localStorage 自动保存（400 ms 防抖），支持 JSON 导出/导入、清空进度
- **双版本构建**：Web 版（静态站点）+ 单文件离线版（646 KB，双击即用）
- **响应式布局**：桌面端侧边导航，移动端底部标签栏
- **深浅双主题**：即时切换并持久化
- **语音朗读**：调用浏览器 `speechSynthesis`，支持自动朗读
- **键盘操作**：`1`–`4` 评分、`空格` 看答案、`A`–`D` 选项、`S` 朗读、`Esc` 结束
- **URL 路由**：页面状态同步到 hash，刷新保持当前位置

### 工程

- 8 个测试文件、102 个测试用例（算法 / 存储 / 调度 / 出题 / 统计 / 会话 / 数据 / 界面）
- `scripts/verify.mjs` 产物校验：用 jsdom 真实加载单文件版并执行，确认可独立启动
- GitHub Actions：CI（PR / push 校验）与 Release（tag 触发构建、发布、Pages 部署）
- 完整文档：使用手册、学习算法、技术架构、数据结构、测试与发布

### 已知限制

- 词库释义来自开源词典的自动提取，个别条目可能有偏差
- 语音朗读依赖系统语音引擎，部分环境需要额外下载语音包
- 单文件版在个别浏览器的 `file://` 协议下可能无法写入 localStorage，此时会降级为内存模式并提示导出备份
