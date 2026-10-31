# 本地语音转文字

Windows 桌面和命令行工具，将中文、英文音频或视频转为 UTF-8 TXT、SRT、WebVTT。
使用 faster-whisper 多语言模型本地推理，媒体不会上传。首次使用需下载模型，之后可离线运行。

## 快速使用

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

脚本建立隔离 `.build-venv`，安装锁定依赖，执行依赖检查、静态检查、自动化测试、原生诊断，再用 PyInstaller 打包。
失败立即终止。产物为 `dist/SpeechToText/SpeechToText.exe` 和 `dist/SpeechToText-windows-x64.zip`。
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

## 时间轴与限制

- 支持 MP3、MP4、MKV、WAV、M4A、FLAC、OGG、WebM；实际编码须为 PyAV 支持的非加密编码。
- 解码至 16 kHz 单声道，按原始帧时间戳保留前置静音、音轨延迟和间隙。
- SRT/VTT 使用模型片段时间戳，毫秒格式，片段非负、按序、不重叠，不靠文本长度估算时间。
- 时间戳格式精度为 1 ms，不代表识别模型定位误差必然小于 1 ms；噪音、多人重叠、音乐、口音会影响准确率。
- 全零数字静音输出空 TXT/SRT 和合法 VTT；低音量、噪音及音乐并不一定是无语音，需要人工判断。
- 最多 2 小时，完整 PCM 在内存中解码，2 小时 PCM 约 460 MB，实际峰值还包括解码片段和模型。
- 取消在解码帧和模型片段边界生效；模型加载、下载及当前原生推理调用不能即时中断。
- 不含说话人分离、字幕编辑器、实时麦克风、翻译或云端服务。只处理可信来源的媒体。

默认输出失败会清理本次新建文件，覆盖模式在普通写入异常时恢复旧文件集合。
文件导出不是跨文件系统的数据库事务，不支持断电恢复；不支持多个进程同时覆盖同一输出集合。
用户输入媒体和输出文件均不会自动删除。

## 测试与文档

```powershell
./build.ps1 -TestOnly
# 真实模型 + 双语合成语音 + MP3/MP4/MKV + 延迟音轨 + 静音
./build.ps1 -TestOnly -Integration
```

真实验收需要 Windows 中文 `Microsoft Huihui Desktop` 和英文 `Microsoft Zira Desktop` 语音。
标准测试不下载模型，CI 每次提交执行测试和打包；手动 CI 可启用真实识别验收。
本地 CPU 发布验收：38 项标准测试、10 项真实 small 模型测试、5 项便携 EXE 转写检查通过。
便携包复验可运行 `.\.build-venv\Scripts\python.exe scripts/verify_release.py`，需先准备模型及测试媒体。

- [需求文档](docs/requirements.md)
- [设计文档](docs/design.md)
- [测试与验收](docs/testing.md)
- [审查与发布记录](docs/release-review.md)

依赖版本见 `requirements-lock.txt`，核心稳定版 CTranslate2 需要提供 `pkg_resources` 的 setuptools。
该接口会产生弃用警告，但不影响本次已验证的 CPU 转写。ONNX VAD 不在执行路径中；使用 Whisper 自带无语音判断。
构建是平台相关的，Windows 产物不能直接在 Linux/macOS 运行。