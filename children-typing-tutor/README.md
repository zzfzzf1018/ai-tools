# 打字小岛 · Typing Island

中文引导的儿童英文打字学习软件，面向 6–9 岁初学者。网页版与 Windows 桌面版共用课程、指法提示、练习和学习记录逻辑。

## 已实现

- 20 节分步课程：认识键盘、F/J 定位、基准行、上下排、单词、Shift 和短句。
- 每节按键课都有讲解、跟练、小测；小测准确率至少 85% 解锁下一课，不要求速度。
- 字母、单词、短句自由练习，不限时、1 分钟或 3 分钟。
- 兔兔去旅行、放飞单词气球两个小游戏，使用已解锁课程的按键，无失败惩罚。
- 虚拟键盘、手指分工、暂停、重试、星星、勋章、每日目标、学习足迹。
- 本地保存、声音开关、减少动态效果、清除记录二次确认。
- 网页首次成功缓存后可离线使用；桌面版内置全部资源。

## 开发环境

已在 Windows、Node.js 22.14.0 上开发验证。支持 Node.js 22.12+（22.x）、24.x 或 26+，建议 Node.js 22.14 或 24 LTS，npm 10+。首次安装依赖和下载 Electron、Playwright 浏览器需要联网。

```powershell
npm ci
npx playwright install chromium
npm run dev
```

打开终端打印的本地地址，通常为 <http://127.0.0.1:5173>。手机页面可以浏览，但打字学习需要电脑或外接物理键盘；虚拟键盘仅作指法示意。

## 构建与验证

```powershell
npm run typecheck
npm run lint
npm test
npm run format:check
npm run test:e2e
```

端到端测试自动生产构建，临时使用 `127.0.0.1:4173` 运行生产预览、`127.0.0.1:5174` 验证开发服务，两个端口均需空闲。测试包括全部 20 课通关、错误重试、练习和游戏、暂停、设置、离线刷新、四种屏幕尺寸。报告位于 `playwright-report/`，截图和失败追踪位于 `test-results/`，均不入库。

```powershell
npm run build
npm run preview
```

网页产物位于 `dist/`，应通过 HTTP 服务访问，不要双击网页文件。部署支持相对路径；离线功能在 HTTPS 或 localhost 下生效。开发服务器不启用离线缓存，验证离线请使用生产预览。

## Windows 桌面版

```powershell
npm run desktop:dev
npm run desktop:build
npm run desktop:package
```

- `desktop:dev` 先构建网页，再用 Electron 启动，避免网页和桌面加载逻辑不同。
- `desktop:build` 输出 `release/win-unpacked/Typing Island.exe`。目录包需保留整个目录，不可单独移动该 exe。
- `desktop:package` 输出 `release/` 下的 portable 便携版与 NSIS 安装包，文件名包含版本、架构及打包类型。
- 安装包未签名，Windows 可能提示未知发布者。不要对不明来源的软件忽略安全警告；本项目不包含代码签名证书。

验证打包后的桌面程序：

```powershell
$env:DESKTOP_EXECUTABLE = (Resolve-Path 'release/win-unpacked/Typing Island.exe').Path
npm run test:desktop
Remove-Item Env:DESKTOP_EXECUTABLE
```

桌面测试使用临时用户目录，验证课程完成、重启恢复、资源加载和安全隔离，不修改个人学习记录。未设置环境变量时测试本地 Electron 工程。其他操作系统尚未完成安装包验收。

## 数据与隐私

无账号、无服务器、无广告，不收集儿童姓名、年龄、摄像头信息或原始按键历史。课程成绩和设置保存在当前浏览器/桌面用户配置内的 `localStorage`，键名为 `typing-island-v1`。两端记录不互通；清除浏览器数据、更换浏览器或点击“重新开始整个小岛”会失去对应记录。

窗口失焦自动暂停；关闭或切换未完成练习时会提示确认。练习只在完成时保存结果，不恢复中途输入。记录损坏或写入失败会提示，但不阻断练习。浏览器清理缓存或存储空间不足可能导致离线资源被移除，需联网重新缓存。

## 项目结构

```text
src/data/          课程和指法映射
src/lib/           纯打字引擎、本地进度与单元测试
src/components/    键盘示意和共享练习界面
src/App.tsx        学习地图、课堂、练习、游戏、成长与设置
electron/          隔离的桌面窗口入口
public/assets/     原创本地插画
tests/             浏览器和真实桌面测试
docs/              需求、设计、规范和审查验收记录
```

## 文档

- [需求文档](docs/requirements.md)
- [设计文档](docs/design.md)
- [开发与评审规范](docs/standards.md)
- [审查修复与封板记录](docs/release.md)
- [第三方资源说明](docs/third-party.md)

## 常见问题

- 输入没有反应：点击练习区；若显示暂停，先点继续。关闭中文输入法，使用英文输入模式。长按重复输入、输入法组合和 Ctrl/Alt/Meta 快捷键不计入练习。
- 大小写不对：检查 Caps Lock；Shift 需要与字母同时按下。
- 离线不可用：先联网使用生产构建，等右上角出现“已可离线学习”。本地开发服务器不会显示该状态。
- 下载打包依赖失败：检查到 npm 与 Electron 官方下载源的网络连接，不要将代理口令、证书或 `.env` 提交到仓库。
- 更新：网页显示更新按钮后可在退出课堂时更新；桌面首版需重新下载安装包，无后台自动更新。

本仓库目前不授予额外的开源许可证；发布或再分发前需由所有者确定许可证，并遵守依赖及字体的第三方许可。
