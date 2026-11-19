# Changelog

本文件记录所有版本变更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

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
