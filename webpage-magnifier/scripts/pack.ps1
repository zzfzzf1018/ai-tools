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
foreach ($f in $files) {
  if (Test-Path $f) {
    Write-Host "OK  $f"
  } else {
    Write-Host "MISSING  $f"
  }
}
if (Test-Path 'webpage-magnifier.zip') { Remove-Item 'webpage-magnifier.zip' -Force }
Compress-Archive -Path $files -DestinationPath 'webpage-magnifier.zip' -Force
Write-Host '---'
Get-ChildItem webpage-magnifier.zip | Select-Object Name, Length
