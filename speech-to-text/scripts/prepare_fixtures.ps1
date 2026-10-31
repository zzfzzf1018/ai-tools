param([string]$PythonPath = "$PSScriptRoot\..\.build-venv\Scripts\python.exe")
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$FixtureDir = Join-Path $Root '.test-media'
New-Item -ItemType Directory -Force -Path $FixtureDir | Out-Null
Add-Type -AssemblyName System.Speech
$Synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
    $Synth.SelectVoice('Microsoft Zira Desktop')
    $Synth.SetOutputToWaveFile((Join-Path $FixtureDir 'raw-en.wav'))
    $Synth.Speak('Hello. Welcome to the speech to text tool. We are testing English recognition and synchronized subtitles.')
    $Synth.SetOutputToNull()
    $Synth.SelectVoice('Microsoft Huihui Desktop')
    $Chinese = -join @(0x4f60,0x597d,0xff0c,0x6b22,0x8fce,0x4f7f,0x7528,0x8bed,0x97f3,0x8f6c,0x6587,0x5b57,0x5de5,0x5177,0x3002,0x4eca,0x5929,0x6211,0x4eec,0x6d4b,0x8bd5,0x4e2d,0x6587,0x8bc6,0x522b,0x548c,0x65f6,0x95f4,0x8f74,0x5b57,0x5e55,0x3002 | ForEach-Object { [char]$_ })
    $Synth.SetOutputToWaveFile((Join-Path $FixtureDir 'raw-zh.wav'))
    $Synth.Speak($Chinese)
    $Synth.SetOutputToNull()
} finally {
    $Synth.Dispose()
}
& $PythonPath (Join-Path $PSScriptRoot 'media_fixtures.py') $FixtureDir
if ($LASTEXITCODE -ne 0) { throw 'Fixture encoding failed' }
Write-Host "Fixtures ready: $FixtureDir"