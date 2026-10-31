# 第三方资源说明

- `public/assets/bunny.svg`、`public/assets/island.svg`：本项目原创矢量图，无运行时外站依赖。
- Nunito 字体：通过 `@fontsource/nunito` 本地打包；字体原许可 SIL Open Font License 1.1，以依赖包中许可文件为准。
- Lucide 图标：`lucide-react`，ISC 许可；以锁定版本包内许可为准。
- React、React DOM、Vite、TypeScript、Playwright、Vitest、Electron 及打包工具：各自许可见安装包与官方上游项目。Electron 包含 Chromium、Node.js 等组件的第三方声明，分发时保留构建产物内的 LICENSE 与 `LICENSES.chromium.html`。
- GitVersion.Tool 6.3.0：MIT 许可，仅用于构建时版本计算，不进入应用运行依赖；通过项目 .NET 工具清单固定版本。
- `semver`（ISC）、`yaml`（ISC）：仅用于发布版本校验及工作流结构回归，不进入应用运行依赖；确切版本和许可以锁文件及包内声明为准。

本清单用于来源追踪，不替代各依赖的正式许可证。代码仓库所有者在公开发布前应确定项目许可证，并审查锁定依赖及分发包内的第三方声明。
