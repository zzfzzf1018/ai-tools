function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    $PreviousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $Executable @Arguments 2>&1 | ForEach-Object { Write-Host $_ }
        $CommandExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $PreviousPreference
    }
    if ($CommandExitCode -ne 0) {
        throw "命令失败，错误码 $CommandExitCode：$Executable $Arguments"
    }
}

function Test-BuildPython {
    param([string]$Path)
    if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    try {
            & $Path -c 'import sys, struct; assert sys.version_info[:2] == (3, 13) and struct.calcsize(chr(80)) == 8' 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Get-BuildPython {
    param([string]$RequestedPath, [string]$Root, [switch]$InstallPython)
    if ($RequestedPath) {
        if (Test-BuildPython $RequestedPath) { return $RequestedPath }
        throw '指定的 Python 不可用。请使用 Python 3.13 64 位版本。'
    }
    $Candidates = @(
        (Join-Path $Root '.build-venv\Scripts\python.exe'),
        "$env:LOCALAPPDATA\Python\pythoncore-3.13-64\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:ProgramFiles\Python313\python.exe"
    )
    foreach ($RegistryPath in @(
        'HKCU:\Software\Python\PythonCore\3.13\InstallPath',
        'HKLM:\Software\Python\PythonCore\3.13\InstallPath'
    )) {
        if (Test-Path $RegistryPath) {
            $InstallPath = (Get-Item $RegistryPath).GetValue('')
            if ($InstallPath) { $Candidates += Join-Path $InstallPath 'python.exe' }
        }
    }
    foreach ($Candidate in $Candidates) {
        if (Test-BuildPython $Candidate) { return $Candidate }
    }
    $Launcher = Get-Command py -ErrorAction SilentlyContinue
    if ($Launcher) {
        try {
            $Candidate = & $Launcher.Source -3.13 -c 'import sys; print(sys.executable)' 2>$null
            if ($LASTEXITCODE -eq 0 -and (Test-BuildPython $Candidate)) { return $Candidate }
        } catch {}
        if ($InstallPython) {
            Write-Host '正在尝试通过 Python 安装管理器下载 Python 3.13，不需要管理员权限。'
            try {
                Invoke-Checked -Executable $Launcher.Source -Arguments @('install', '3.13')
                return Get-BuildPython -Root $Root
            } catch {
                throw '自动安装 Python 未成功。请按 docs/user-guide.html 的步骤安装 Python 3.13 64 位，再双击 build.cmd。'
            }
        }
    }
    throw '没有找到 Python 3.13 64 位。请打开 docs/user-guide.html，按「首次准备」安装后重试。无需安装编程软件。'
}

function Enter-BuildLock {
    param([string]$Path)
    return [System.IO.File]::Open($Path, [System.IO.FileMode]::OpenOrCreate,
        [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
}

function New-ReleaseArchive {
    param([string]$SourceDirectory, [string]$ArchivePath)
    $Required = @('SpeechToText.exe', 'README.md', 'help.cmd', 'build-info.json',
        'docs/user-guide.html', 'docs/release-review.md', 'docs/images/application.png')
    foreach ($RelativePath in $Required) {
        if (-not (Test-Path -LiteralPath (Join-Path $SourceDirectory $RelativePath) -PathType Leaf)) {
            throw "发行目录缺少文件：$RelativePath。旧 ZIP 未修改。"
        }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $SourceDirectory '_internal') -PathType Container)) {
        throw '发行目录缺少 _internal 运行依赖。旧 ZIP 未修改。'
    }
    $Pending = Join-Path (Split-Path $ArchivePath -Parent) ('.stt-' + [guid]::NewGuid() + '.zip')
    $Previous = "$Pending.previous"
    try {
        Compress-Archive -LiteralPath $SourceDirectory -DestinationPath $Pending -Force
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $Archive = [System.IO.Compression.ZipFile]::OpenRead($Pending)
        try {
            $Prefix = Split-Path $SourceDirectory -Leaf
            $Names = @($Archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
            foreach ($RelativePath in $Required) {
                if ("$Prefix/$RelativePath" -notin $Names) { throw "ZIP 内容验证失败：$RelativePath" }
            }
            if (-not @($Names | Where-Object { $_ -like "$Prefix/_internal/*" }).Count) {
                throw 'ZIP 内容验证失败：缺少运行依赖。'
            }
        } finally {
            $Archive.Dispose()
        }
        $Hasher = [System.Security.Cryptography.SHA256]::Create()
        $Stream = [System.IO.File]::OpenRead($Pending)
        try {
            $Hash = [BitConverter]::ToString($Hasher.ComputeHash($Stream)).Replace('-', '').ToLowerInvariant()
        } finally {
            $Stream.Dispose()
            $Hasher.Dispose()
        }
        if (Test-Path -LiteralPath $ArchivePath) {
            [System.IO.File]::Replace($Pending, $ArchivePath, $Previous)
        } else {
            [System.IO.File]::Move($Pending, $ArchivePath)
        }
        "$Hash  $(Split-Path $ArchivePath -Leaf)" | Set-Content -LiteralPath "$ArchivePath.sha256" -Encoding ascii
    } finally {
        if (Test-Path -LiteralPath $Pending) { Remove-Item -LiteralPath $Pending -Force }
        if (Test-Path -LiteralPath $Previous) { Remove-Item -LiteralPath $Previous -Force }
    }
}