# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。小规模修改仅递增修订号（patch）。
Git 标签格式：`web-markdown-ext-v<版本号>`（带 v 前缀）。

## [0.1.1] - 2026-11-03

### 新增
- 发布强制变更留痕：`versioning.py prepare` 从 CHANGELOG.md 提取对应版本段落生成 RELEASE_NOTES.md 作为 GitHub Release 说明；缺失该版本段落时发布直接失败
- Release 说明包含版本变更内容 + 安装方式

### 变更
- Release 上传资产改为精确列表（zip + SHA256SUMS.txt + release.json），不再整目录上传

## [0.1.0] - 2026-11-03

### 新增
- 基于 Manifest V3 的 Edge/Chrome 扩展初始版本
- 智能正文提取：集成 Mozilla Readability 0.5.0，自动识别文章正文
- 选区转换：支持鼠标选中内容转换（右键菜单、弹窗按钮、快捷键 Alt+M）
- 弹窗交互：Markdown 预览文本框（可编辑）、复制到剪贴板、下载 .md 文件（以页面标题命名）
- HTML → Markdown 转换：Turndown 7.2.0 + GFM 插件（表格/删除线/任务列表/围栏代码块）
- 相对链接自动转绝对链接；base64 内联图片自动剔除；图片保留原始 URL
- 转换结果自动附加元信息头（标题、来源 URL、抓取时间）
- 显式错误提示：弹窗状态栏与页面 Toast（正文提取失败、无选区、受限页面等场景）
- 项目文档：需求文档、设计文档、AI 开发指南、README
- GitVersion 版本控制（tag-prefix `web-markdown-ext-v`，dotnet 工具清单固定 6.3.0）
- `tools/package.py` 一键打包：node 语法检查 + manifest/图标/运行时文件校验 + zip 产物回读校验
- `scripts/versioning.py`：GitVersion 计算、版本写入 manifest、发布资产准备（zip + SHA256SUMS）
- GitHub Actions 自动发布：main/PR 校验，`web-markdown-ext-v*` 标签触发打包并创建 GitHub Release
