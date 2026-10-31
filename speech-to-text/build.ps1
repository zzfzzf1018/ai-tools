param(
    [string]$PythonPath,
    [switch]$TestOnly,
    [switch]$Integration
)
$ErrorActionPreference = 'Stop'
function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Executable $Arguments" }
}
Push-Location $PSScriptRoot
try {
    if (-not $PythonPath) {
        if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
            throw 'Install Python 3.13 x64 (including Tcl/Tk), or pass -PythonPath.'
        }
        $PythonPath = & py -3.13 -c 'import sys; print(sys.executable)'
        if ($LASTEXITCODE -ne 0) { throw 'Python 3.13 required. Install with: py install 3.13' }
    }
    Invoke-Checked -Executable $PythonPath -Arguments @('-c', 'import sys; assert sys.version_info[:2] == (3, 13), "Build requires Python 3.13"')
    $Python = Join-Path $PSScriptRoot '.build-venv\Scripts\python.exe'
    if (-not (Test-Path $Python)) {
        Invoke-Checked -Executable $PythonPath -Arguments @('-m', 'venv', '.build-venv')
    }
    Invoke-Checked -Executable $Python -Arguments @('-c', 'import sys; assert sys.version_info[:2] == (3, 13), "Remove incompatible .build-venv and retry"')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'pip', 'install', '-r', 'requirements-lock.txt')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'pip', 'install', '--no-deps', '-e', '.')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'pip', 'check')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'ruff', 'check', 'src', 'tests', 'scripts')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'ruff', 'format', '--check', 'src', 'tests', 'scripts')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'pytest', '-m', 'not integration', '-q')
    Invoke-Checked -Executable $Python -Arguments @('-m', 'speech_to_text', 'doctor')
    if ($Integration) {
        & (Join-Path $PSScriptRoot 'scripts\prepare_fixtures.ps1') -PythonPath $Python
        Invoke-Checked -Executable $Python -Arguments @('-m', 'speech_to_text', 'download-model', '--model', 'small', '--model-dir', '.models')
        $PreviousIntegration = $env:STT_INTEGRATION
        try {
            $env:STT_INTEGRATION = '1'
            Invoke-Checked -Executable $Python -Arguments @('-m', 'pytest', '-m', 'integration', '-q')
        } finally {
            $env:STT_INTEGRATION = $PreviousIntegration
        }
    }
    if (-not $TestOnly) {
        Invoke-Checked -Executable $Python -Arguments @('-m', 'PyInstaller', '--clean', '--noconfirm', 'speech-to-text.spec')
        Invoke-Checked -Executable '.\dist\SpeechToText\SpeechToText.exe' -Arguments @('doctor')
        if ($Integration) {
            Invoke-Checked -Executable $Python -Arguments @('scripts/verify_release.py')
        }
        Copy-Item 'README.md', 'requirements-lock.txt' -Destination 'dist\SpeechToText'
        New-Item -ItemType Directory -Force -Path 'dist\SpeechToText\docs' | Out-Null
        Copy-Item 'docs\*' -Destination 'dist\SpeechToText\docs' -Recurse -Force
        Compress-Archive -Path 'dist\SpeechToText' -DestinationPath 'dist\SpeechToText-windows-x64.zip' -Force
        Write-Host 'Build ready: dist\SpeechToText\SpeechToText.exe'
    }
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
} finally {
    Pop-Location
}