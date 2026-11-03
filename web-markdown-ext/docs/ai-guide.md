# AI 开发指南 — Web to Markdown

本文件为后续参与本项目的 AI 助手提供上下文与开发约定。**修改代码前请先阅读本文档与 `docs/design.md`。**

## 1. 项目速览

Edge/Chrome 浏览器扩展（Manifest V3），网页 → Markdown 转换。无构建步骤、无框架、纯原生 JS，第三方库本地打包于 `lib/`。

核心数据流与消息协议见 `docs/design.md` 第 3、4 节。

## 2. 开发约定（必须遵守）

1. **文档同步**：每次代码修改必须同步更新相关文档（`docs/`、`README.md`），并在 `CHANGELOG.md` 追加变更记录
2. **版本号**：小规模修改仅递增修订号（patch），如 0.1.0 → 0.1.1；不做无意义的版本跃升；版本号需同步修改 `manifest.json` 中的 `version`
3. **Git 标签**：格式为 `web-markdown-ext-v<版本号>`（如 `web-markdown-ext-v0.1.1`，注意带 `v` 前缀，与全仓其他项目一致；GitVersion 通过 tag-prefix 识别）
4. **无网络依赖**：禁止引入任何 CDN/远程资源；新增依赖必须本地打包到 `lib/` 并在 `README.md` 技术栈中登记
5. **最小权限**：新增能力如需权限，先评估能否用现有 activeTab 模型解决；确需新增权限时在 `docs/requirements.md` NFR-3 处补充理由
6. **显式错误**：任何失败路径必须有用户可感知的提示（弹窗状态栏 / 页面 Toast / 系统通知），禁止静默 catch
7. **语言**：代码注释、文档、提交信息使用中文

## 3. 本地开发

无需安装任何依赖，无构建步骤：

1. Edge 访问 `edge://extensions/` → 开启开发人员模式 →「加载解压缩的扩展」选择项目根目录
2. 修改代码后：在 `edge://extensions/` 点击扩展卡片上的「重新加载」按钮
   - 注意：popup/background/content 任何修改都需要重新加载扩展；content script 改动后还需刷新目标页面
3. 调试：
   - popup：右键扩展图标 →「检查弹出内容」
   - background：扩展卡片 →「Service Worker」链接
   - content：目标页面 F12 → Console

## 4. 验证清单

提交前按 `docs/design.md` 第 8 节执行手动测试。一键校验与打包（会失败退出非零）：

```powershell
python tools/package.py
```

## 5. 发布流程

1. 完成功能修改，更新文档；**在 CHANGELOG.md 顶部新增 `## [X.Y.Z] - 日期` 段落写明变更内容（CI 发布必需，缺失则发布失败）**，提交并推送 main
2. 本地 `python tools/package.py` 验证通过
3. 打标签并推送：`git tag web-markdown-ext-v<X.Y.Z>` → `git push origin web-markdown-ext-v<X.Y.Z>`
4. GitHub Actions 自动执行：GitVersion 校验标签 → 打包 → 从 CHANGELOG 提取该版本变更生成 Release 说明 → 创建 GitHub Release（zip + SHA256SUMS.txt + release.json）
5. 注意：manifest.json 的 `version` 由 CI 在发布时写入，本地保持与上一个发布版一致即可

## 6. 已知限制

- 选区转换基于 `window.getSelection()`，不支持跨 iframe 选区
- 部分站点（强 CSP 或 Shadow DOM 封装组件）Readability 提取效果可能不佳，引导用户改用选区转换
- 图片仅保留 URL，不做本地化下载（设计决策，见 design.md 第 5 节）

## 7. 第三方库版本

| 库 | 版本 | 来源 |
|---|---|---|
| @mozilla/readability | 0.5.0 | unpkg.com/@mozilla/readability@0.5.0/Readability.js |
| turndown | 7.2.0 | unpkg.com/turndown@7.2.0/dist/turndown.js |
| turndown-plugin-gfm | 1.0.2 | unpkg.com/turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.js |

升级库文件时：下载对应版本覆盖 `lib/` 同名文件，更新本表与 `README.md`，并记录 CHANGELOG。
