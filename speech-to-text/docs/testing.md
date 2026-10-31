# 测试与验收

## 自动化层次

1. 字幕：毫秒进位、UTF-8 中英文、空结果、极短片段、非有限/负时间、片段重叠、覆盖保护和失败清理。
2. 媒体：真实 WAV/MP4/MKV 编解码、损坏输入、无音轨、错误音轨、取消、时间线及资源上限。
3. 引擎：模型复用、原语言参数、字幕导出、重叠边界归一化、纯数字静音跳过推理、取消不发布。
4. CLI：批量失败后继续、参数错误、JSON 输出与原生核心诊断。
5. GUI：创建真实 Tk、布局、文件队列和任务事件，不依赖浏览器截图。
6. 集成：真实 small 多语言模型识别中英文 WAV/MP3/MP4/MKV；3 秒延迟视频音轨；数字静音。
7. 打包：PyInstaller 产物执行 doctor，真实字幕导出，验证数据文件、DLL 和动态导入完整性。

本次本地验证结果：38 项标准测试通过，无跳过；10 项真实 small 模型测试通过；
5 项便携 EXE 实际转写检查通过。静态检查、格式、依赖一致性和原生诊断均通过。

## 执行

```powershell
./build.ps1 -TestOnly
./build.ps1 -TestOnly -Integration
./build.ps1 -Integration
```

标准测试无需模型与网络（环境初装仍需要依赖下载）。集成测试不在普通 pytest 中自动下载模型。
手动准备后可运行：

```powershell
./scripts/prepare_fixtures.ps1
.\.build-venv\Scripts\python.exe -m speech_to_text download-model --model small --model-dir .models
$env:STT_INTEGRATION='1'
.\.build-venv\Scripts\python.exe -m pytest -m integration -q
Remove-Item Env:STT_INTEGRATION
# 已打包后直接复验发行 EXE
.\.build-venv\Scripts\python.exe scripts/verify_release.py
```

样本由系统 TTS 生成，中文和英文测试句由本项目编写，不下载版权不明音视频。
准备脚本需要 Microsoft Huihui Desktop 和 Microsoft Zira Desktop；缺少语音时明确失败，不跳过集成验收冒充成功。
脚本插入 2 秒前置静音、1 秒尾静音，并为 MP4/MKV 生成真实视频流。
关键词断言不能等同于准确率统计，因此不得将这些合成样本宣称为真实业务准确率报告。

## 人工业务验收

- 用业务代表性录音、会议 MP4 和多音轨 MKV 校对中文/英文文字；涵盖轻声、噪音、口音和中英混合。
- 在播放器加载 SRT/VTT，对首句、末句、静音后语句和长片段抽查时间偏差。
- 比较标准答案统计 CER/WER，并由用户确定目标；项目不凭空指定已实现准确率。
- 在目标机器记录模型首次/缓存启动时间、峰值内存、整段处理耗时。
- 人工检查桌面高 DPI、窄窗口、文件名滚动、进度、取消、关闭行为。
- 如发布 GPU 版本，另验证目标 CUDA/cuDNN 驱动矩阵；CPU 通过不代表 GPU 已验收。

## 发布门禁

锁依赖一致；Ruff 检查与格式通过；全部标准测试通过；真实双语和时间轴验收通过；
打包诊断及实际转写通过；无未关闭 P0/P1；发布记录写明已验证范围和未验证项。
CI 配置已经提供，但本地执行通过不代表 GitHub 远程 workflow 已实际运行。