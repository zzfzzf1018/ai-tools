Add-Type -AssemblyName System.Drawing
$iconDir = 'c:\flying\ai-tools\webpage-magnifier\icons'
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

function New-Icon($size, $path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # 背景圆角矩形（用纯色圆形近似）
    $g.Clear([System.Drawing.Color]::FromArgb(41, 121, 255))

    # 放大镜外框
    $pad = [int]($size * 0.12)
    $penW = [Math]::Max(2, [int]($size * 0.08))
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $penW)
    $g.DrawEllipse($pen, $pad, $pad, ($size - 2*$pad), ($size - 2*$pad))

    # 放大镜镜片（半透明白色）
    $lensPad = [int]($size * 0.22)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(100, 255, 255, 255))
    $g.FillEllipse($brush, $lensPad, $lensPad, ($size - 2*$lensPad), ($size - 2*$lensPad))

    # 手柄
    $handleStart = [int]($size * 0.55)
    $handleEnd = [int]($size * 0.88)
    $handlePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(2, [int]($size * 0.1)))
    $g.DrawLine($handlePen, $handleStart, $handleStart, $handleEnd, $handleEnd)

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $pen.Dispose(); $handlePen.Dispose(); $brush.Dispose()
    $g.Dispose(); $bmp.Dispose()
}

New-Icon 16  (Join-Path $iconDir 'icon16.png')
New-Icon 48  (Join-Path $iconDir 'icon48.png')
New-Icon 128 (Join-Path $iconDir 'icon128.png')

Get-ChildItem $iconDir | Select-Object Name, Length
