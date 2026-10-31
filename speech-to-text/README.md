# 本地语音转文字

版本 **1.1.0 候选版**：新增默认关闭的“长文件与断点恢复”，普通转写路径保持不变。
工程门禁以当前发行包的 `validation/release-evidence.json` 为准；本次功能变更不继承 1.0.1 的人工发布批准，见 [发布说明](docs/release-review.md)。

Windows 桌面和命令行工具，将中文、英文音频或视频转为 UTF-8 TXT、SRT、WebVTT。
使用 faster-whisper 多语言模型本地推理，媒体不会上传。首次使用需下载模型，之后可离线运行。

## 快速使用

**不会写代码也能用：**双击 `help.cmd`，或用浏览器打开 [使用与一键出包手册](docs/user-guide.html)。其中包含实际界面截图、首次安装、双击出包、分享和故障处理步骤。

已构建的版本：解压完整发行目录，双击 `SpeechToText.exe`。不要只复制 EXE，旁边的 `_internal` 是必要依赖。
源码工作区：双击 `run.cmd`。首次设置先双击 `build.cmd`。

桌面操作：添加一个或多个媒体文件，选择语言和模型，指定输出目录，再开始转写。
每个媒体输出同名 `.txt`、`.srt`、`.vtt`，默认不覆盖。多个目录中的同名媒体应使用不同输出目录，避免冲突。
音轨编号从 0 开始；视频默认使用第一条音轨，字幕时间相对于播放器中的媒体起点。

## 一键构建

要求 Windows 10/11 x64、Python 3.13 x64（含 Tcl/Tk）、网络和可写目录。建议 8 GB 以上内存。
安装 Python 可使用 `py install 3.13`，或 python.org 官方安装程序。
无需单独安装 FFmpeg、CUDA 或系统 Python 包；默认 CPU + int8。

```powershell
./build.ps1
# 或双击 build.cmd
```

双击入口会自动查找 Python 3.13，有安装管理器时尝试自动安装；成功后自动打开出包目录。没有管理器时按使用手册从官网安装即可。
脚本显示中文七阶段进度，建立隔离 `.build-venv`，安装锁定依赖，执行依赖检查、静态检查、自动化测试、原生诊断，再用 PyInstaller 打包。
失败立即终止。产物为 `dist/SpeechToText/SpeechToText.exe` 和 `dist/SpeechToText-windows-x64.zip`。
每次构建日志保存在 `.artifacts/logs`；同一目录不允许并发出包；新 ZIP 内容验证与 SHA-256 计算通过后才替换旧 ZIP，并生成同名 `.zip.sha256` 校验文件。
发行目录包含离线 HTML 手册、`help.cmd`、`build-info.json` 与运行依赖。接收者只需完整解压 ZIP 并双击 EXE，不需要 Python。
模型不打包进 EXE，避免将数百 MB 到数 GB 的模型强行绑定到安装包。
没有 `py` 启动器时：`./build.ps1 -PythonPath 'C:/Python313/python.exe'`。
PowerShell 策略阻止脚本时使用 `build.cmd`，它仅为本次进程设置策略，不修改系统策略，也不请求管理员权限。

## 命令行

源码命令使用虚拟环境；发行版将以下解释器和 `-m speech_to_text` 替换成 `SpeechToText.exe`。

```powershell
.\.build-venv\Scripts\python.exe -m speech_to_text transcribe 'D:/media/会议.mp4' 'D:/media/english.mp3' -o output --language auto --model small --model-dir .models
.\.build-venv\Scripts\python.exe -m speech_to_text transcribe 'D:/media/movie.mkv' -o output --language zh --audio-track 1
.\.build-venv\Scripts\python.exe -m speech_to_text doctor
.\.build-venv\Scripts\python.exe -m speech_to_text --help
```

语言参数为 `auto`、`zh`、`en`，执行转写而非翻译。批量中某文件失败时继续处理后续文件，最终返回 1；全部成功返回 0，取消返回 130。
标准输出是逐文件 JSON 结果；进度及错误写到标准错误。`--quiet` 隐藏进度。使用 `--overwrite` 才允许覆盖。

## 模型与离线

```powershell
.\.build-venv\Scripts\python.exe -m speech_to_text download-model --model small --model-dir .models
.\.build-venv\Scripts\python.exe -m speech_to_text transcribe input.mp3 --model small --model-dir .models --offline
```

桌面默认缓存为用户目录 `.cache/local-transcribe`。如使用上述缓存，在界面将“模型缓存”设为工作区 `.models` 的完整路径。
离线部署需复制完整缓存结构，或将 `--model` 指向 CTranslate2 格式的本地模型目录。
网络受限时可在联网机器下载后拷贝；下载连接的网络元数据不等于上传音视频。

模型可选 `tiny`、`base`、`small`、`medium`、`large-v3`、`large-v3-turbo`。
`tiny` 速度快，但本项目中文验收曾出现明显错字，推荐默认 `small`；较大模型通常更准确，也更慢、更耗内存。
不支持英文专用 `.en` 模型，以免误选后丧失中文能力。中英混合使用 `auto`，复杂混合语音仍需校对。
GPU 可使用 `--device cuda --compute-type float16`，须自行提供兼容的 NVIDIA CUDA 12/cuDNN 9。
GPU 路径不属于本次 Windows CPU 验收范围。

## 长文件与断点恢复（可选）

普通文件不勾选“长文件与断点恢复”，继续使用原有整段解码和转写逻辑，仍限两小时。
长文件或需要恢复的任务，勾选此选项后开始；命令行显式添加 `--long-files`：

```powershell
.\.build-venv\Scripts\python.exe -m speech_to_text transcribe 'D:/media/长会议.mkv' -o output --model small --model-dir .models --offline --long-files
```

- 分块模式不设原有两小时上限。每块核心五分钟，左右各最多两秒重叠，按词时间戳归属消除重复，再映射回原媒体时间轴。块边界识别仍可能有误差，需要校对。
- 单个 PCM 窗口最多 304 秒，约 19.5 MB；解码时会有多个暂存窗口，模型和字幕文本另占内存。不是总进程内存保证，也不将整段音频保存到磁盘。
- 每个完整识别块原子保存至输出目录 `.stt-resume`。取消、推理错误或进程退出后，保留检查点；再次添加同一媒体，使用同一输出目录、模型、语言、设备、精度及音轨，并再次勾选，即可自动恢复。
- 恢复先计算媒体 SHA-256 并重新顺序解码，跳过已完成块的识别。长文件的校验与扫描需要时间，并非直接跳转到断点；当前未完成块会重跑，最多约五分钟识别工作。
- 媒体或识别设置变化、检查点损坏时拒绝恢复，避免混入旧结果。需要重头处理时可换输出目录，或按错误提示删除对应 JSON 检查点；不要删除正在运行任务的文件。
- 最终 TXT/SRT/VTT 生成后清理任务检查点和暂存字幕，锁文件可以保留且不阻挡下次运行。最终发布期间中断也可恢复，只接管本任务哈希匹配的输出；用户改动过的输出不会被擅自覆盖。
- 默认保护已有输出，只有明确允许覆盖才替换旧结果。不要多个任务同时覆盖同一输出集合；系统断电、存储损坏及恶意媒体不在恢复保证内。

## 时间轴与限制

- 支持 MP3、MP4、MKV、WAV、M4A、FLAC、OGG、WebM；实际编码须为 PyAV 支持的非加密编码。
- 解码至 16 kHz 单声道，按原始帧时间戳保留前置静音、音轨延迟和间隙。
- SRT/VTT 使用模型片段时间戳，毫秒格式，片段非负、按序、不重叠，不靠文本长度估算时间。
- 时间戳格式精度为 1 ms，不代表识别模型定位误差必然小于 1 ms；噪音、多人重叠、音乐、口音会影响准确率。
- 全零数字静音输出空 TXT/SRT 和合法 VTT；低音量、噪音及音乐并不一定是无语音，需要人工判断。
- 默认模式最多 2 小时，完整 PCM 在内存中解码，2 小时 PCM 约 460 MB，实际峰值还包括解码片段和模型。可选长文件模式使用固定窗口。
- 取消在解码帧和模型片段边界生效；模型加载、下载及当前原生推理调用不能即时中断。
- 不含说话人分离、字幕编辑器、实时麦克风、翻译或云端服务。只处理可信来源的媒体。

默认输出失败会清理本次新建文件，覆盖模式在普通写入异常时恢复旧文件集合。
默认模式文件导出不是跨文件系统的数据库事务，不支持断电恢复；长文件模式增加检查点与可恢复发布，但也不保证存储断电安全。不支持多个进程同时覆盖同一输出集合。
用户输入媒体和输出文件均不会自动删除。

## 测试与文档

```powershell
./build.ps1 -TestOnly
# 真实模型 + 双语合成语音 + MP3/MP4/MKV + 延迟音轨 + 静音
./build.ps1 -TestOnly -Integration
```

真实验收需要 Windows 中文 `Microsoft Huihui Desktop` 和英文 `Microsoft Zira Desktop` 语音。
标准测试不下载模型，CI 模板可配置提交检查和手动真实识别验收；当前项目位于主仓库子目录，GitHub 工作流需要由主仓库根目录的 `.github/workflows` 调用，本轮未验证远程 CI。
完整门禁运行 `build.cmd -Integration`，执行标准回归、真实 small 模型集成测试和发行 EXE 验收，将 JUnit、源码指纹、逐案例报告及汇总打包进 `validation`。
最终数量和状态以 `validation/release-evidence.json` 为准；源码中途变化、测试失败/跳过或 EXE 不匹配均不能通过，不用历史测试数量代替本轮结果。
`build-info.json` 的 `engineering_status` 表示本轮本机工程门禁；自动报告的 `formal_release_status` 是构建时状态。用户人工批准、实际发布提交和远程标签另行记录，不把未提供的外部机器或准确率数据写成测试通过。
便携包复验可运行 `.\.build-venv\Scripts\python.exe scripts/verify_release.py`，需先准备模型及测试媒体。
对实际分发 ZIP 复验可加 `--archive dist/SpeechToText-windows-x64.zip`，同时检查哈希、ZIP 文件与构建记录。

- [需求文档](docs/requirements.md)
- [设计文档](docs/design.md)
- [测试与验收](docs/testing.md)
- [审查与发布记录](docs/release-review.md)
- [普通用户图文手册](docs/user-guide.html)
- [正式封板外部验收](docs/external-acceptance.md)

依赖版本见 `requirements-lock.txt`，核心稳定版 CTranslate2 需要提供 `pkg_resources` 的 setuptools。
该接口会产生弃用警告，但不影响本次已验证的 CPU 转写。ONNX VAD 不在执行路径中；使用 Whisper 自带无语音判断。
构建是平台相关的，Windows 产物不能直接在 Linux/macOS 运行。