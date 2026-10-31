param(
    [string]$PythonPath,
    [switch]$TestOnly,
    [switch]$Integration,
    [switch]$InstallPython,
    [switch]$OpenOutput
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts\packaging.ps1')
$LogDirectory = Join-Path $PSScriptRoot '.artifacts\logs'
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
$LogPath = Join-Path $LogDirectory ('build-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $PID + '.log')
$BuildLock = $null
$TranscriptStarted = $false
Push-Location $PSScriptRoot
try {
    Start-Transcript -LiteralPath $LogPath -Force | Out-Null
    $TranscriptStarted = $true
    Write-Host '========== 语音转文字：一键编译出包 =========='
    Write-Host "日志文件：$LogPath"
    Write-Host '请保持此窗口打开。首次下载和出包可能需要几分钟，请勿重复双击。'
    if ($env:OS -ne 'Windows_NT' -or -not [Environment]::Is64BitOperatingSystem) {
        throw '出包脚本仅支持 Windows 10/11 64 位系统。'
    }
    try {
        $BuildLock = Enter-BuildLock (Join-Path $PSScriptRoot '.artifacts\build.lock')
    } catch {
        throw '另一个出包任务正在运行，请等它结束。不要删除正在使用的锁文件。'
    }
    Write-Host '[1/7] 检查 Python 和构建环境'
    $PythonPath = Get-BuildPython -RequestedPath $PythonPath -Root $PSScriptRoot -InstallPython:$InstallPython
    $Python = Join-Path $PSScriptRoot '.build-venv\Scripts\python.exe'
    if (-not (Test-Path $Python)) {
        Invoke-Checked -Executable $PythonPath -Arguments @('-m', 'venv', '.build-venv')
    }
    if (-not (Test-BuildPython $Python)) {
        throw '构建环境版本不兼容。关闭此窗口，把 .build-venv 文件夹改名为 .build-venv-old，再双击 build.cmd。不会删除音视频或转写结果。'
    }
    Write-Host '[2/7] 下载并安装锁定的构建依赖'
    Invoke-Checked -Executable $Python -Arguments @('-m', 'pip', 'install', '-r', 'requirements-lock.txt')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'pip', 'install', '--no-deps', '-e', '.')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'pip', 'check')
    Write-Host '[3/7] 自动检查代码并运行测试，任何失败都会停止出包'
    Invoke-Checked -Executable $Python -Arguments @('-m', 'ruff', 'check', 'src', 'tests', 'scripts')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'ruff', 'format', '--check', 'src', 'tests', 'scripts')
    Invoke-Checked -Executable $Python -Arguments @('scripts/release_evidence.py', 'snapshot', '--output', '.artifacts/source-manifest.json')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'pytest', '-m', 'not integration', '-q', '--junitxml=.artifacts/standard-tests.xml')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'speech_to_text', 'doctor')
    if ($Integration) {
        & (Join-Path $PSScriptRoot 'scripts\prepare_fixtures.ps1') -PythonPath $Python
        Invoke-Checked -Executable $Python -Arguments @('-m', 'speech_to_text', 'download-model', '--model', 'small', '--model-dir', '.models')
        $PreviousIntegration = $env:STT_INTEGRATION
        try {
            $env:STT_INTEGRATION = '1'
            Invoke-Checked -Executable $Python -Arguments @('-m', 'pytest', '-m', 'integration', '-q', '--junitxml=.artifacts/integration-tests.xml')
        } finally {
            $env:STT_INTEGRATION = $PreviousIntegration
        }
    }
    if (-not $TestOnly) {
        Write-Host '[4/7] 生成 Windows 应用程序；这一步较慢是正常现象'
        Invoke-Checked -Executable $Python -Arguments @('-m', 'PyInstaller', '--clean', '--noconfirm', 'speech-to-text.spec')
        Write-Host '[5/7] 验证生成的应用程序'
        Invoke-Checked -Executable '.\dist\SpeechToText\SpeechToText.exe' -Arguments @('doctor')
        if ($Integration) {
            Invoke-Checked -Executable $Python -Arguments @('scripts/verify_release.py', '--report', '.artifacts/packaged-acceptance.json')
        }
        Write-Host '[6/7] 放入使用说明和构建记录'
        Copy-Item 'README.md', 'requirements-lock.txt', 'help.cmd' -Destination 'dist\SpeechToText'
        New-Item -ItemType Directory -Force -Path 'dist\SpeechToText\docs' | Out-Null
        Copy-Item 'docs\*' -Destination 'dist\SpeechToText\docs' -Recurse -Force
        New-Item -ItemType Directory -Force -Path 'dist\SpeechToText\validation' | Out-Null
        Copy-Item '.artifacts\standard-tests.xml', '.artifacts\source-manifest.json' -Destination 'dist\SpeechToText\validation'
        if ($Integration) {
            Invoke-Checked -Executable $Python -Arguments @('scripts/release_evidence.py', 'collect', '--output', '.artifacts/release-evidence.json')
            Copy-Item '.artifacts\integration-tests.xml', '.artifacts\packaged-acceptance.json', '.artifacts\release-evidence.json' -Destination 'dist\SpeechToText\validation'
            Copy-Item 'scripts\clean_windows.ps1' -Destination 'dist\SpeechToText\validation'
            Copy-Item 'acceptance.cmd' -Destination 'dist\SpeechToText'
            New-Item -ItemType Directory -Force -Path 'dist\SpeechToText\validation\media' | Out-Null
            foreach ($Media in @('en.mp3', 'zh.mp4', 'zh.mkv', 'delayed.mp4', 'silence.wav')) {
                Copy-Item (Join-Path '.test-media' $Media) -Destination 'dist\SpeechToText\validation\media'
            }
        }
        $Manifest = [ordered]@{
            built_at_utc = (Get-Date).ToUniversalTime().ToString('o')
            platform = 'windows-x64'
            version = (& $Python -c 'import speech_to_text; print(speech_to_text.__version__)')
            python = (& $Python -c 'import sys; print(sys.version.split()[0])')
            standard_checks = 'passed'
            real_model_checks = $(if ($Integration) { 'passed' } else { 'not_run' })
            engineering_status = $(if ($Integration) { 'passed' } else { 'incomplete' })
            formal_release_status = 'pending'
            source_sha256 = (Get-Content '.artifacts/source-manifest.json' -Raw | ConvertFrom-Json).sha256
            model_included = $false
        }
        $Manifest | ConvertTo-Json | Set-Content 'dist\SpeechToText\build-info.json' -Encoding UTF8
        Write-Host '[7/7] 生成 ZIP 并验证内容；旧 ZIP 只在新包验证成功后替换'
        $ArchivePath = Join-Path $PSScriptRoot 'dist\SpeechToText-windows-x64.zip'
        New-ReleaseArchive -SourceDirectory (Join-Path $PSScriptRoot 'dist\SpeechToText') -ArchivePath $ArchivePath
        if ($Integration) {
            Invoke-Checked -Executable $Python -Arguments @('scripts/release_evidence.py', 'verify-archive', '--archive', $ArchivePath, '--output', "$ArchivePath.acceptance.json")
        }
        Write-Host '========== 出包成功 =========='
        Write-Host "可分享的安装包：$ArchivePath"
        Write-Host "校验文件：$ArchivePath.sha256"
        Write-Host '使用方法：完整解压 ZIP，双击 SpeechToText.exe。接收者无需安装 Python。'
        Write-Host '首次转写仍需联网下载模型；ZIP 中不包含模型。'
        if ($OpenOutput) { Start-Process explorer.exe -ArgumentList ('"' + (Join-Path $PSScriptRoot 'dist') + '"') }
    } else {
        Write-Host '========== 测试通过（本次不生成 ZIP） =========='
    }
} catch {
    Write-Host '========== 出包失败：请勿分发旧目录中的未验证程序 =========='
    Write-Host $_.Exception.Message
    Write-Host "请把这个日志文件交给维护人员：$LogPath"
    Write-Host '常见问题处理见 docs/user-guide.html。解决后重新双击 build.cmd。'
    exit 1
} finally {
    if ($BuildLock) { $BuildLock.Dispose() }
    if ($TranscriptStarted) { Stop-Transcript | Out-Null }
    Pop-Location
}