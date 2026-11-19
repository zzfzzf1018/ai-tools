# Changelog

本文件记录所有版本变更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

---

## [1.0.5] - 2026-11-19

### 修复

- 补齐 CHANGELOG 缺失的版本条目（v1.0.3 / v1.0.4），Release body 现在能正确读取对应版本段落
- Release workflow 中 `gh release create` 的 `--body-file` 输入文件路径对齐，ubuntu-latest runner 能正确解析

---

## [1.0.4] - 2026-11-19

### 修复

- Release workflow YAML 语法错误：旧版在 `run: |` 里嵌套 bash here-document，内部 Python 代码缩进丢失（0 空格），GitHub Actions 解析阶段直接失败。修复：将 Python here-doc 抽为独立脚本 `webpage-magnifier/scripts/changelog-section.py`，workflow 里一行 `python3 脚本` 调用，彻底绕开 YAML here-doc 缩进问题。

---

## [1.0.3] - 2026-11-19

### 修复

- Release body 读取 CHANGELOG 详细段落：旧版 `gh release create --generate-notes` 自动生成的 release notes 过于简略，不包含具体改动条目。新增 workflow step（`Extract CHANGELOG section`）用 Python 脚本从 `CHANGELOG.md` 切出对应版本段落，通过 `--body-file` 传给 `gh release create`。找不到版本段落时自动退回 `--generate-notes` 兜底。

---

## [1.0.2] - 2026-11-19

### 修复

- Release workflow zip 目录结构：旧版 `Compress-Archive -Path $files` 只保留文件名，丢失 `icons/` 前缀，导致 Edge 加载扩展时报 `Couldn't load icon icons/icon16.png`。改用 staging 目录 + `Compress-Archive -Path staging/*`，完整保留 `manifest.json`、`content.js`、`icons/icon16.png` 等相对路径。

### 新增

- README.md 详细中文文档（安装/使用/开发指南/权限说明/已知限制）
- .gitignore 排除 zip/IDE/temp 产物
- CHANGELOG.md（本文件）
- GitHub Actions Release workflow（monorepo 根 `.github/workflows/release-webpage-magnifier.yml`），push tag `webpage-magnifier-v*` 自动构建 zip + 创建 Release

---

## [1.0.0] - 2026-11-19

### 新增

- 网页区域放大器初始版本发布
- 选区模式：快捷键 `Ctrl+Shift+M` 或 popup 按钮启动，拖拽矩形区域创建放大镜覆盖层
- 放大镜覆盖层：支持拖拽移动（`⋮⋮` 手柄）、缩放调节（1.0x ~ 5.0x，步长 0.1）
- 层级切换：置顶（`z-index: 2147483647`）/ 置底（`z-index: 1`），按钮文本实时变化
- SPA 兼容：hook `history.pushState` / `history.replaceState` + 监听 `popstate` / `hashchange` / 自定义事件，路由变化后自动销毁放大镜并退出选区模式
- DOM 安全清洗：移除 `script` / `iframe` / `link[rel=stylesheet]` / `object` / `embed` / `base` / `meta[http-equiv=refresh]`，去除所有内联 `on*` 事件处理器
- 资源路径绝对化：手动绝对化 `src` / `href` / `srcset` / `poster` / `data-src` 等属性，绕过页面 `<base>` 标签影响
- 链接安全加固：`a[target="_blank"]` 自动补充 `rel="noopener"`，移除 `download` 属性防止下载劫持
- 仅顶层 frame 工作：`window.top !== window.self` 守卫 + manifest `all_frames: false`，避免 iframe 嵌套时重复注入
- Service Worker 主动注入机制：content script 未就绪时通过 `chrome.scripting.executeScript` 主动注入，解决快捷键时序竞态
- PING 就绪等待：注入后轮询等待 content script 初始化完成再发送指令
- 快捷键兜底：background service worker 作为 content script 内部快捷键监听的补充兜底
- Esc 取消：选区模式中按 Esc 可取消，无需拖动
- 视口边界校正：放大镜拖动、缩放后自动回视口内（保持 8px 边距）

### 修复

### 重构

- 扩展结构重组为 content / background / popup 三文件分离，manifest v3 合规

### 文档

### 安全

- DOM 克隆后移除所有可执行脚本、iframe、内联事件处理器，防止攻击者通过选区触发恶意行为
