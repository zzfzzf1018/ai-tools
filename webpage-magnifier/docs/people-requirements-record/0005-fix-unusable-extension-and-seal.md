# 0005 — 深度测试并修复扩展至可封板

**日期：** 2026-11-24
**状态：** Done
**工作流：** single-branch（main）
**评审策略：** never（普通开发不强制独立评审）

## 用户原始请求

> 这个项目完全不能用啊 全是问题。帮忙仔细测试和修复直到可以封板

## 现象与根因定位（静态审查 + 产物核查）

1. **zip 包无法安装**：`scripts/pack.ps1` 用 `Compress-Archive -Path $files` 明确列文件，
   PowerShell 会丢弃 `icons/` 目录前缀，zip 内变成 `icon16.png` 等平铺文件，
   而 `manifest.json` 声明 `"16": "icons/icon16.png"`，Edge 加载报 `Couldn't load icon`。
   （仓库根 CI workflow 已修，本地脚本与本地 `webpage-magnifier.zip` 仍是坏的。）
2. **拖拽选区时看不到选框**：`content.css` 对 `.__wpm_select_box` 写了
   `display: none !important`，JS 用 `element.style.display='block'` 无法覆盖 `!important`，
   选框永远不可见，用户以为扩展无反应。
3. **快捷键失效/双触发风险**：manifest 默认 `Ctrl+Shift+M` 是 Chrome/Edge 保留快捷键
   （切换个人资料），命令不会被分配；同时 content.js 又自行监听同一组合键，
   一旦浏览器放行就会与 `chrome.commands` 各触发一次，导致「开了又关」。
4. **重复注入崩溃**：`content.js` 顶层 `const` 声明，`chrome.scripting.executeScript`
   再次注入同一文件会抛 `Identifier has already been declared`，注入失败 →
   popup 显示「当前页面不支持」（扩展重载后的旧标签页必现）。
5. **放大镜控制面板被裁切**：`.__wpm_magnifier` 设了 `overflow: hidden !important`，
   选区较小时面板（含 ✕ 关闭按钮）被裁掉，无法关闭/调缩放。
6. **克隆内容可点击**：放大镜内克隆的 `<a>` 等元素仍可交互，拖动/点击时误跳转页面。
7. **Esc 取消无效**：Esc 监听只在 mousedown 拖拽过程中注册，进入选区模式后未拖拽时按 Esc 无反应。
8. **SPA 误销毁**：任意 `pushState/replaceState` 都会销毁放大镜，部分站点滚动即 pushState，
   放大镜被无故清掉。
9. **克隆内容错位**：克隆根节点被强制 `padding: 0`，有内边距的容器内容会偏移；
   宽度按 border-box 数值写入 content-box 元素会撑大内容。
10. **潜在未捕获 Promise rejection**：`chrome.runtime.sendMessage` 无接收方时 try/catch 兜不住 Promise 拒绝。

## 交互决策

- 保留「popup 按钮 + 快捷键」双入口，但快捷键只走 `chrome.commands` 单一路径；默认改为
  `Ctrl+Shift+Y`（Chrome/Edge 均未占用），popup/README 同步说明可在 `edge://extensions/shortcuts` 改键。
- 放大镜语义定为「只读透镜」：克隆内容 `pointer-events: none`，拖动改为放大镜本体任意位置可拖。
- 版本按补丁号递增到 `1.0.9`；同步 CHANGELOG / README。
- 不执行 commit / push / tag（用户未明确要求）。

## 验收标准

- `node --check` 全部 JS 通过；`manifest.json` 可被 JSON 解析。
- `scripts/pack.ps1` 产出的 zip 内含 `icons/icon16.png` 等正确路径，可直接解压加载。
- 真实浏览器（Edge）加载解压扩展后：扩展 service worker 正常、命令快捷键已分配；
  进入选区模式可见遮罩与虚线选框；拖拽释放后生成正确倍率放大镜；面板完整可见且可关闭；
  拖拽移动、缩放、置顶切换、Esc 取消、重复注入均正常；页面无控制台报错。
- 四件套文档（REQ/PLAN/DESIGN/TASK）与本记录使用同一编号 0005。

## 验证结果（Done）

- 静态：`node --check` 三个 JS 退出码 0；manifest JSON 解析通过；CSS/JS 自查项全部命中。
- 打包：`scripts/pack.ps1` 退出码 0，zip 条目含 `icons/icon16.png`、`icons/icon48.png`、`icons/icon128.png`，反斜杠条目 0。
- 真实 Edge E2E（CDP 驱动真实鼠标/键盘事件）：**30/30 断言通过**；覆盖快捷键分配、遮罩与选框可见、放大镜创建与倍率、面板可点、本体拖动、只读透镜、Esc 取消、重复注入幂等、无控制台报错。
- zip 安装校验：解压后 `--load-extension` 加载成功，版本 1.0.9，content script PING 正常。
- E2E 额外发现并修复：3x/5x 时面板跑出视口导致无法关闭，新增 `positionPanel()` 复测通过。
- 详细证据见 [TASK-0005](../tasks/TASK-0005-fix-unusable-extension-and-seal.md) 第 7、8 节。
