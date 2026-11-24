# 网页区域放大器 - 打包脚本
# 采用 staging 目录 + 目录级打包，确保 zip 内保留 icons/ 等子目录结构。
# 打包后使用 System.IO.Compression 校验 zip 条目，结构不正确时以退出码 1 结束。

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

$files = @(
  'manifest.json',
  'content.js',
  'content.css',
  'popup.html',
  'popup.js',
  'popup.css',
  'background.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
)

$missing = @()
foreach ($f in $files) {
  if (Test-Path $f) {
    Write-Host "OK  $f"
  } else {
    Write-Host "MISSING  $f"
    $missing += $f
  }
}

if ($missing.Count -gt 0) {
  Write-Host "打包中止：缺少 $($missing.Count) 个源文件"
  Pop-Location
  exit 1
}

$zipPath = Join-Path $root 'webpage-magnifier.zip'
$stageDir = Join-Path ([System.IO.Path]::GetTempPath()) ('wpm-pack-' + [System.Guid]::NewGuid().ToString('N'))

try {
  New-Item -ItemType Directory -Path $stageDir -Force | Out-Null
  foreach ($f in $files) {
    $dest = Join-Path $stageDir $f
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) {
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $f -Destination $dest -Force
  }

  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $zipPath -Force

  # Windows PowerShell 5.1 的 Compress-Archive 会把条目分隔符写成反斜杠，
  # 浏览器按 zip 规范只认正斜杠，这里统一重建为 forward-slash 条目。
  $tmpZip = $zipPath + '.rebuild'
  if (Test-Path $tmpZip) { Remove-Item $tmpZip -Force }
  $srcZip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $dstZip = [System.IO.Compression.ZipFile]::Open($tmpZip, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
      foreach ($entry in $srcZip.Entries) {
        $entryName = $entry.FullName -replace '\\', '/'
        $newEntry = $dstZip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $inStream = $entry.Open()
        try {
          $outStream = $newEntry.Open()
          try { $inStream.CopyTo($outStream) } finally { $outStream.Dispose() }
        } finally { $inStream.Dispose() }
      }
    } finally {
      $dstZip.Dispose()
    }
  } finally {
    $srcZip.Dispose()
  }
  Remove-Item $zipPath -Force
  Move-Item $tmpZip $zipPath -Force
} finally {
  if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($zip.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
} finally {
  $zip.Dispose()
}

Write-Host '--- zip 条目 ---'
$entries | ForEach-Object { Write-Host "ZIP  $_" }

$required = @(
  'manifest.json',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
)
$missingEntries = @($required | Where-Object { $entries -notcontains $_ })

if ($missingEntries.Count -gt 0) {
  Write-Host "打包校验失败：zip 缺少 $($missingEntries -join ', ')"
  Pop-Location
  exit 1
}

Write-Host '--- 打包校验通过 ---'
Get-ChildItem $zipPath | Select-Object Name, Length
Pop-Location
exit 0
