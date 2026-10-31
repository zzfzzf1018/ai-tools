# 版本管理与 GitHub 自动发布

## 下载使用

打开 [GitHub Releases](https://github.com/zzfzzf1018/ai-tools/releases)，选择标题为 `Speech to Text X.Y.Z`、标签为 `speech-to-text-vX.Y.Z` 的发布，展开 Assets：

- `SpeechToText-X.Y.Z-windows-x64.zip`：Windows 10/11 x64 便携版。完整解压后双击 `SpeechToText.exe`，无需 Python；不要只复制 EXE。
- `SHA256SUMS.txt`：下载文件的 SHA-256 校验和。可在下载目录运行 `certutil -hashfile SpeechToText-X.Y.Z-windows-x64.zip SHA256` 后与之比对（忽略大小写）。
- `release.json`：GitVersion 版本、源码提交 SHA、文件大小、哈希，以及 `standard_checks` / `real_model_checks` 状态。

Releases 中的 Source code ZIP/TAR 只是源码，不能直接运行。EXE 未签名，Windows 可能提示未知发布者；请只从本仓库下载并核对校验和。模型不随包分发，首次转写需联网下载（推荐 `small`）。
GitHub 托管机器没有中文 Huihui 语音，也不适合下载模型做真实识别，因此 Release 附件的 `real_model_checks` 为 `not_run`：它经过 Ruff、全部标准测试、真实 GitVersion 回归和打包 EXE 的 doctor/版本检查，真实双语模型验收仍按 [测试与验收](testing.md) 在本地执行。

只有工作流成功后才会出现下载；新增工作流不会为旧标签 `speech-to-text-v1.0.0`、`v1.0.1`、`v1.1.0` 补发附件。

## GitVersion 约定

版本由 [GitVersion.yml](../GitVersion.yml) 和工具清单 [.config/dotnet-tools.json](../.config/dotnet-tools.json) 控制，固定 GitVersion.Tool **6.3.0**、.NET SDK **8**。

| 概念 | 位置 | 说明 |
| --- | --- | --- |
| 正式版本基线 | `src/speech_to_text/__init__.py` 的 `__version__` | 唯一手工维护的版本号，必须是 `X.Y.Z`；`pyproject.toml` 通过 setuptools 动态读取，不再重复填写 |
| 构建版本 | GitVersion 计算 | 打标签提交为 `X.Y.Z`；其后 main 上的开发构建为 `X.Y.(Z+1)-N` |
| 发布标签 | `speech-to-text-vX.Y.Z` | 仅识别本项目前缀，忽略同仓 `children-typing-tutor-v*` 等其他项目标签 |

- 采用 GitHubFlow，`main` 默认递增 Patch。`main` 与 `unknown`（detached checkout）对已打标签提交都禁止再次递增。
- 关闭 `+semver:` 提交消息递增，避免同仓其他项目的提交改变本项目版本。`N` 是 Git 提交距离，可能包含其他项目的提交。
- 计算显式传入当前 `HEAD` SHA，并使用 `/nofetch /nonormalize /nocache`；返回 SHA 必须等于 `HEAD`。HEAD 带正式标签时，标签版本必须等于源码基线，否则停止。
- 打包时 `scripts/versioning.py` 将结果写入 `.artifacts/build-version.json`，PyInstaller 把它放进 EXE 内部；源码文件不被改写。`SpeechToText.exe --version`、`doctor` 输出的 `version`、发行目录 `build-info.json`（`version`、`full_version`、`version_source`、`commit`、`uncommitted_changes`）与 `validation/build-version.json` 一致，出包第 5 步会核对 EXE 实际版本。
- 未修改的源码直接运行时，`--version` 显示源码基线。

### 本地构建

双击 `build.cmd` 或运行 `./build.ps1` 时会自动计算版本：

- 已安装 .NET SDK 8、Git，且在完整 Git 克隆中：首次自动 `dotnet tool restore`（需访问 NuGet），之后使用 GitVersion 版本。工作区有未提交改动时仍计算版本，并在 `uncommitted_changes` 中记录。
- 缺少 .NET、Git 历史（例如下载的源码 ZIP）或 GitVersion 失败时，本地构建不中断，版本标记为 `X.Y.Z-local`、`version_source` 为 `source-fallback`，并给出警告。此类包只供自用，不是正式发布，`prepare` 步骤会拒绝它。
- `./build.ps1 -RequireGitVersion`：禁止回退，并额外运行真实 GitVersion 回归（`pytest -m gitversion`，报告 `validation/gitversion-tests.xml`）。CI 使用此模式。

```powershell
dotnet tool restore
.\.build-venv\Scripts\python.exe scripts/versioning.py version
./build.ps1 -RequireGitVersion
```

## 工作流与门禁

GitHub 只读取 Git 根目录的工作流，因此文件位于仓库根 `ai-tools/.github/workflows/speech-to-text-release.yml`。项目内的 `speech-to-text/.github/workflows/ci.yml` 是早期模板，GitHub 不会执行。

| 触发 | 行为 |
| --- | --- |
| `main` push 改动 `speech-to-text/**`，`__version__` 不变 | 完整验证并上传 14 天 Actions 构建产物，不创建 Release |
| `main` push 改动本项目，`__version__` 严格升高 | 完整验证通过后创建 `speech-to-text-vX.Y.Z` 标签与 Release |
| 修改本项目的 PR（含 PR 中升版） | 只读验证，不发布；合并到 main 后再判断 |
| 只改其他项目或根工作流、只推标签 | 不触发 |

`verify` 任务（`windows-latest`，Python 3.13 x64，.NET 8，完整 Git 历史）：

1. `scripts/versioning.py plan` 比较 push 的 `before` 与当前提交中本项目 `__version__`（Git 根相对路径，不受其他项目影响，覆盖一次推送的多个提交）。升版时在临时 checkout 建本地标签，再用 GitVersion 验证版本、SHA 与干净工作区一致；降版、预发布、重复标签或历史读取失败直接失败。
2. `scripts/versioning.py version` 输出构建版本。
3. `build.ps1 -RequireGitVersion`：锁定依赖、Ruff、标准测试、GitVersion 回归、doctor、PyInstaller、EXE doctor 与版本核对、ZIP 结构及 SHA-256。
4. `scripts/versioning.py prepare` 校验 ZIP 与 `.sha256`、包内 `build-info.json` 和内嵌版本均与 GitVersion 一致且 `standard_checks=passed`，生成 `release-assets/` 下的版本化 ZIP、`SHA256SUMS.txt`、`release.json`。

`publish` 任务只在 main push 升版且 `verify` 成功时运行，是唯一拥有 `contents: write` 的任务。它下载精确的构建产物，重新 `sha256sum --check`，用自带 `gh` 与 `GITHUB_TOKEN` 在该 push 的精确 SHA 上先建带附件的草稿，再转正式；同名 Release 存在时拒绝覆盖。不使用 `pull_request_target`，checkout 不保存凭据；所有 `actions/*` 固定到官方提交 SHA。

若网络失败留下草稿或标签，维护者核对后完成草稿，或在确认从未公开后删除该草稿与标签再重跑，不能覆盖已公开版本。

## 发布步骤

1. 将本项目改动连同根工作流提交到 `main` 并推送（在 Git 根目录，只暂存本项目与工作流）：

   ```powershell
   git add speech-to-text .github/workflows/speech-to-text-release.yml
   git diff --cached --stat
   git commit -m "Add GitVersion and automated releases for speech-to-text"
   git push origin main
   ```

   版本不变时只运行验证，可在 Actions → **Speech to Text CI and Release** 查看。
2. 在 GitHub Settings → Actions → General 确认 Actions 已启用、允许官方 Actions，工作流可声明 `contents: write`。私有仓库需有 Windows runner 额度。
3. 发布新版本：本地完成真实模型验收（`build.cmd -Integration`，见 [测试与验收](testing.md)）后，修改 `src/speech_to_text/__init__.py` 的 `__version__`，例如 `1.1.1`，同步 [发布记录](release-review.md)，提交并推送 main。不要手工创建标签。

   ```powershell
   git add speech-to-text
   git commit -m "Release speech-to-text 1.1.1"
   git push origin main
   ```

   工作流成功后自动出现 `speech-to-text-v1.1.1` 与下载附件。失败时查看 Actions 日志和 `speech-to-text-build-logs` 产物，修复后以新提交重推；不要上传未验收产物绕过门禁。
