# 版本管理与 GitHub 自动发布

## 下载使用

打开 [GitHub Releases](https://github.com/zzfzzf1018/ai-tools/releases)，选择标题为 `Typing Island X.Y.Z`、标签为 `children-typing-tutor-vX.Y.Z` 的正式发布，展开 Assets：

- `Typing-Island-X.Y.Z-x64-portable.exe`：Windows x64 免安装版，下载后直接运行。
- `Typing-Island-X.Y.Z-x64-setup.exe`：Windows x64 NSIS 安装包。
- `Typing-Island-X.Y.Z-web.zip`：网页静态资源，解压后通过 HTTP 服务访问，不能双击 HTML；离线缓存需 HTTPS 或 localhost。
- `SHA256SUMS.txt`：三个文件的 SHA-256 校验和。
- `release.json`：GitVersion 版本、源码提交 SHA、文件大小及校验和。

Releases 中的 Source code ZIP/TAR 是源码，不是可直接运行的应用。所有 exe 仍未签名，Windows 可能提示未知发布者；应核对来源与校验和，不对来源不明的文件忽略安全警告。NSIS 系统安装/卸载不在自动化验收中，桌面不提供后台自动更新，学习记录保存在本机。

只有工作流成功完成后下载文件才会出现；新增工作流本身不会回填旧标签的发布。仓库所有者仍须确定项目许可及分发权利，自动发布不授予新的开源许可证。

## GitVersion 约定

版本由 [GitVersion.yml](../GitVersion.yml) 和固定工具清单 [.config/dotnet-tools.json](../.config/dotnet-tools.json) 控制。使用 GitVersion.Tool **6.3.0**、.NET SDK **8**，不是另写一套版本算法。

- 本项目在 `ai-tools/children-typing-tutor/`，Git 根目录在 `ai-tools/`。只识别 `children-typing-tutor-v` 标签前缀，不使用其他项目的发布标签。
- 沿用已有 `children-typing-tutor-v1.1.0` 等标签，不移动或覆盖历史标签。
- 采用 GitHubFlow，`main` 默认递增 Patch；例如 `1.1.0` 之后的未发布构建为 `1.1.1-N`。注意 `children-typing-tutor-v1.1.1` 已作为 CI 集成快照标签存在且不对应 npm 版本，因此 1.1.0 之后的首个正式修复版使用 `1.1.2`。
- `main` 与 `unknown` 都禁止对已经打标签的提交再次递增；后者覆盖 `main` 已超前时旧标签的 detached checkout，不能仅靠主分支配置保证标签版本正确。
- 不按提交中的 `+semver:` 自动升主/次版本，避免同仓其他项目的提交消息改变本项目版本。维护者通过 `npm version X.Y.Z --no-git-tag-version` 同步修改本项目两份 npm 元数据；这是自动发布的显式版本开关。
- 提交距离 `N` 仍可能包含同仓其他项目提交，不承诺独立的项目提交计数。
- 自动发布比较一次 `main` push 的 `before` 提交与当前提交中本项目 `package.json.version`，不是只比较最后一个提交，也不是比较 GitVersion 的开发计数。版本相同只跑 pipeline；正式版本严格升高才发布。历史版本读取使用 Git 根相对路径，不会误读同仓其他项目的 npm 元数据。新建项目或首次创建 main、没有旧版本时视为首次版本。
- 自动发布只接受严格的 `X.Y.Z` 正式标签，三个数字不可超过 Windows 的 65535 上限。不发布 `-rc.1`、旧 `-sealed-日期` 或其他非标准标签。
- 完整 Git 历史与标签是必要输入，源码下载 ZIP 或浅克隆不用于正式打包。计算显式传入当前 `HEAD` SHA，并使用 `/nofetch /nonormalize /nocache`，不主动拉取，也不让 CI 的分支规范化改写标签 checkout；返回 SHA 必须与 `HEAD` 一致。
- 两份 npm 元数据中的版本保持已提交的开发基线，不能作为最终产物版本来源。一键构建把 GitVersion 的 `SemVer` 通过 electron-builder `extraMetadata.version` 传入；exe 文件名和包内元数据使用计算版本，不写回源码或锁文件，即使进程强杀也不会留下临时版本改动。
- 升版 push 的验证任务在临时 CI checkout 中生成本项目本地标签，再由 GitVersion 计算精确正式版本；本地标签不推送。全部门禁通过后，发布任务通过 GitHub Release 在该 push 的精确 SHA 上创建远程标签与下载发布。降版、预发布版本、重复标签或 Git 历史读取失败直接拒绝，不静默当作普通发布。
- `build:all`、`build:web`、`build:windows` 和两个 `desktop:build` / `desktop:package` 兼容入口使用统一版本计算；`build` / `desktop:dev` 仅用于开发网页和工程运行，不是正式发布入口。

安装 .NET SDK 8、Git 和受支持的 Node.js 后，在项目目录运行：

```powershell
dotnet tool restore
npm run version:show
npm run build:all
```

首次还原工具需要访问 NuGet；首次构建还需要 npm、Electron 及打包工具下载。GitVersion 缺失、无 Git 历史或版本计算失败时立即停止，不回退为固定版本伪造成功。`npm run test:version` 需要 .NET/Git，并在临时多项目仓库中验证正式标签、开发版本、其他项目标签隔离、dirty guard 和 GitHub detached checkout；`npm test` 继续运行应用单测与构建/发布纯逻辑回归。

## 工作流位置与门禁

GitHub 只读取 **Git 根目录**下的工作流，因此本仓库的文件是 `ai-tools/.github/workflows/children-typing-tutor-release.yml`，不是项目子目录中的 `.github/`。push 和 PR 的路径过滤均只有 `children-typing-tutor/**`；仅修改同仓其他项目或根目录工作流不会触发本流程。未配置标签触发或手工触发，避免绕过目录改动条件；独立迁移仓库时应把工作流搬到新 Git 根目录，并调整项目工作目录、路径过滤、缓存和产物路径。

| 触发                                       | 行为                                              |
| ------------------------------------------ | ------------------------------------------------- |
| `main` push 有本项目改动，npm 正式版本不变 | 全量 pipeline 和 Actions 构建产物，不创建 Release |
| `main` push 有本项目改动，npm 正式版本升高 | 全量门禁通过后创建对应正式标签与 Release          |
| 修改本项目的 PR，包括 PR 中升版            | 只读验证，不创建 Release；合并到 main 后再判断    |
| 仅其他项目或根工作流改动、仅推送标签       | 不触发本流程                                      |

验证任务在 `windows-latest` 上使用 Node.js 24、.NET SDK 8、完整 Git 历史和锁定 npm 依赖，依次执行：

1. 比较 push 前后项目版本，输出是否发布与目标标签；升版时验证 GitVersion 正式版本、当前 push SHA 与干净工作区一致。
2. TypeScript、ESLint、Prettier、应用及构建/发布回归、真实 GitVersion 集成回归。
3. 全工具链 `npm audit --audit-level=high`，严重/高风险阻断，中低风险继续按已有文档披露。
4. Playwright Chromium 全量浏览器回归。
5. 一键构建网页、Windows x64 目录包、便携包和安装包。
6. 启动实际目录包和实际便携 exe，各自检查课程、统计、备份及重启持久化。
7. 网页 ZIP、下载清单和 SHA-256 生成，成功产物保留 14 天，失败浏览器报告保留 7 天。

只有 `main` push 的项目版本升高且验证成功，独立 `publish` 任务才运行并拥有 `contents: write`。下载精确匹配的构建产物，重新核对校验和，使用 runner 自带 `gh` 与自动提供的 `GITHUB_TOKEN` 发布，不需要另存 PAT 或签名密钥。远程标签指向该 push 的 SHA，而不是上传时可能已更新的 main 顶端。发布先创建带全部附件的草稿，再转正式，避免测试未通过或附件尚未准备时展示正式发布。

不使用 `pull_request_target`，checkout 不持久化凭据，PR 不能进入发布任务。已有同名标签或 Release 会拒绝覆盖；若网络失败留下草稿或标签，由维护者核对后完成草稿，或在确认从未公开发布后清理该未发布草稿及标签再重跑，不能覆盖已公开版本的下载文件。

所有 `actions/*` 使用经官方仓库核对的 v4 精确提交 SHA，而非可移动版本标签。升级时同时核对官方来源、更新 SHA 并重跑工作流校验与发布回归；不使用未经核对的第三方发布 Action。

## 首次发布步骤

本地实现和测试不会擅自创建提交、推送或触发远程发布。维护者需先将本项目变更 **连同仓库根工作流** 提交到 `main` 并推送；不能把旧 `1.1.0` 标签重新指向新提交。

在 Git 根目录操作，确认只暂存本项目及工作流，不包含同仓其他项目的改动：

```powershell
git add children-typing-tutor .github/workflows/children-typing-tutor-release.yml
git diff --cached --stat
git commit -m "Add Typing Island GitVersion and automated releases"
git push origin main
```

在 GitHub Settings → Actions → General 确认 Actions 已启用、允许官方 Actions，且组织策略允许工作流声明 `contents: write`。私有仓库还需有 Windows runner 可用额度。首次配置提交若项目版本不变，只运行验证，可在 Actions → **Typing Island CI and Release** 查看结果。

确认全量验证通过后，在项目目录提高 npm 正式版本，不手工创建标签。本轮后续修订示例为 `1.1.1`，须使用未发布且高于旧版本的实际版本：

```powershell
npm version 1.1.1 --no-git-tag-version
git add package.json package-lock.json
git commit -m "Release Typing Island 1.1.1"
git push origin main
```

这一 main push 自动执行发布门禁，并在成功后创建 `children-typing-tutor-v1.1.1` 和下载附件；无需另推标签。同版本代码或文档修改只跑 pipeline，其他项目修改完全不触发。失败时查看 Actions 失败步骤和测试报告；不要提前手工创建同名标签/Release，或上传未验收产物绕过门禁。
