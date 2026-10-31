param(
    [string]$PackageDirectory = (Split-Path $PSScriptRoot -Parent),
    [string]$ResultDirectory = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'SpeechToText-Acceptance')
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $ResultDirectory | Out-Null
$ResultPath = Join-Path $ResultDirectory 'clean-windows-result.json'
$Receipt = [ordered]@{
    schema_version = 1
    status = 'running'
    clean_windows_verified = $false
    fixture_kind = 'synthetic_tts'
    business_media_verified = $false
    started_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    windows_version = [Environment]::OSVersion.VersionString
    machine_name = $env:COMPUTERNAME
    python_detected = $true
}
function Save-Receipt {
    $Receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ResultPath -Encoding UTF8
}
function Invoke-App {
    param([string[]]$Arguments)
    $PreviousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $Output = & $Executable @Arguments 2> (Join-Path $ResultDirectory 'application-errors.log')
        $ExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $PreviousPreference
    }
    if ($ExitCode -ne 0) { throw "应用验收命令失败：$Arguments；错误码 $ExitCode" }
    return $Output
}
try {
    Save-Receipt
    $Candidates = @(
        "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe",
        "$env:LOCALAPPDATA\Python\pythoncore-*\python.exe",
        "$env:ProgramFiles\Python*\python.exe"
    )
    $PythonFiles = @($Candidates | ForEach-Object { Get-Item $_ -ErrorAction SilentlyContinue })
    $PythonCommands = @(Get-Command python, python3 -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -notlike '*\WindowsApps\*' })
    $PythonRegistry = @('HKCU:\Software\Python\PythonCore', 'HKLM:\Software\Python\PythonCore' |
        Where-Object { Test-Path $_ })
    $Receipt.python_detected = ($PythonFiles.Count + $PythonCommands.Count + $PythonRegistry.Count) -gt 0
    if ($Receipt.python_detected) {
        $Receipt.status = 'blocked'
        $Receipt.reason = '检测到已安装的 Python。这不是干净机器验收，请在另一台未安装 Python 的 Windows 电脑运行。'
        Save-Receipt
        Write-Host $Receipt.reason
        Write-Host "结果：$ResultPath"
        exit 2
    }
    $Executable = Join-Path $PackageDirectory 'SpeechToText.exe'
    if (-not (Test-Path -LiteralPath $Executable)) { throw '请完整解压验收包，不能只复制验收脚本。' }
    $Hasher = [Security.Cryptography.SHA256]::Create()
    $Stream = [IO.File]::OpenRead($Executable)
    try {
        $Receipt.executable_sha256 = [BitConverter]::ToString($Hasher.ComputeHash($Stream)).Replace('-', '').ToLowerInvariant()
    } finally {
        $Stream.Dispose()
        $Hasher.Dispose()
    }
    $Receipt.build = Get-Content (Join-Path $PackageDirectory 'build-info.json') -Raw | ConvertFrom-Json
    Write-Host '正在验证应用，不使用系统 Python。首次验收需要联网下载 small 模型。'
    $Doctor = Invoke-App @('doctor')
    $Receipt.doctor = ($Doctor -join "`n") | ConvertFrom-Json
    $ModelDirectory = Join-Path $env:LOCALAPPDATA ('SpeechToTextAcceptance\models-' + [guid]::NewGuid())
    Invoke-App @('download-model', '--model', 'small', '--model-dir', $ModelDirectory) | ForEach-Object { Write-Host $_ }
    $Cases = @('en.mp3', 'zh.mp4', 'zh.mkv', 'delayed.mp4', 'silence.wav')
    $Inputs = @()
    $MediaDirectory = Join-Path $ResultDirectory 'media'
    New-Item -ItemType Directory -Force -Path $MediaDirectory | Out-Null
    for ($Index = 0; $Index -lt $Cases.Count; $Index++) {
        $Source = Join-Path $PackageDirectory ('validation\media\' + $Cases[$Index])
        $Target = Join-Path $MediaDirectory ('case-' + $Index + [IO.Path]::GetExtension($Source))
        Copy-Item -LiteralPath $Source -Destination $Target -Force
        $Inputs += $Target
    }
    $OutputDirectory = Join-Path $ResultDirectory ('output-' + [guid]::NewGuid())
    $Arguments = @('transcribe') + $Inputs + @('-o', $OutputDirectory, '--model', 'small',
        '--model-dir', $ModelDirectory, '--offline', '--quiet')
    $Results = @(Invoke-App $Arguments | Where-Object { $_.Trim() } | ForEach-Object { $_ | ConvertFrom-Json })
    if ($Results.Count -ne 5) { throw '实际应用返回的案例数量不匹配。' }
    $ExpectedLanguages = @('en', 'zh', 'zh', 'en', 'unknown')
    for ($Index = 0; $Index -lt $Results.Count; $Index++) {
        $Result = $Results[$Index]
        if ($Result.language -ne $ExpectedLanguages[$Index]) { throw "案例 $Index 语言不匹配。" }
        if ($Index -lt 4 -and $Result.segments -le 0) { throw "案例 $Index 未识别出语音。" }
        if ($Index -eq 4 -and $Result.segments -ne 0) { throw '静音产生了虚假字幕。' }
        foreach ($Extension in @('txt', 'srt', 'vtt')) {
            if (-not (Test-Path -LiteralPath $Result.outputs.$Extension)) { throw "缺少 $Extension 输出。" }
        }
        $Text = [IO.File]::ReadAllText($Result.outputs.txt, [Text.Encoding]::UTF8).ToLowerInvariant()
        if ($Index -in @(0, 3) -and ($Text -notmatch 'speech' -or $Text -notmatch 'english')) {
            throw "案例 $Index 英文关键词不匹配。"
        }
        if ($Index -in @(1, 2) -and ($Text -notmatch '中文' -or $Text -notmatch '字幕')) {
            throw "案例 $Index 中文关键词不匹配。"
        }
        $Srt = [IO.File]::ReadAllText($Result.outputs.srt, [Text.Encoding]::UTF8)
        if ($Index -eq 4 -and ($Text.Trim() -or $Srt.Trim())) { throw '静音输出不为空。' }
        $Cues = [regex]::Matches($Srt, '(?m)^(?<start>\d{2}:\d{2}:\d{2},\d{3}) --> (?<end>\d{2}:\d{2}:\d{2},\d{3})\r?$')
        if ($Index -lt 4 -and $Cues.Count -ne $Result.segments) { throw '字幕片段数量不匹配。' }
        $PreviousEnd = 0.0
        foreach ($Cue in $Cues) {
            $Start = [TimeSpan]::Parse($Cue.Groups['start'].Value.Replace(',', '.'), [Globalization.CultureInfo]::InvariantCulture).TotalSeconds
            $End = [TimeSpan]::Parse($Cue.Groups['end'].Value.Replace(',', '.'), [Globalization.CultureInfo]::InvariantCulture).TotalSeconds
            if ($Start -lt $PreviousEnd -or $End -le $Start -or $End -gt $Result.duration + 0.002) {
                throw '字幕时间轴范围或顺序不匹配。'
            }
            $PreviousEnd = $End
        }
        if ($Index -eq 3) {
            $FirstStart = [TimeSpan]::Parse($Cues[0].Groups['start'].Value.Replace(',', '.'), [Globalization.CultureInfo]::InvariantCulture).TotalSeconds
            if ($FirstStart -lt 2.5) { throw '延迟音轨字幕被错误提前。' }
        }
    }
    $Receipt.status = 'passed'
    $Receipt.clean_windows_verified = $true
    $Receipt.first_model_download = 'passed'
    $Receipt.offline_transcription = 'passed'
    $Receipt.cases = $Results
    $Receipt.completed_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    Save-Receipt
    Write-Host '干净 Windows 应用流程验收通过。业务音视频准确率仍需单独验收。'
    Write-Host "请将此结果文件交给维护人员：$ResultPath"
} catch {
    $Receipt.status = 'failed'
    $Receipt.reason = $_.Exception.Message
    Save-Receipt
    Write-Host $_.Exception.Message
    Write-Host "结果：$ResultPath"
    exit 1
}