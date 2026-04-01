Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-RectF {
  param(
    [single]$X,
    [single]$Y,
    [single]$Width,
    [single]$Height
  )

  return New-Object System.Drawing.RectangleF -ArgumentList @($X, $Y, $Width, $Height)
}

function New-PointF {
  param(
    [single]$X,
    [single]$Y
  )

  return New-Object System.Drawing.PointF -ArgumentList @($X, $Y)
}

function New-RoundedRectPath {
  param(
    [System.Drawing.RectangleF]$Rect,
    [single]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = [single]($Radius * 2)

  $path.AddArc($Rect.X, $Rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rect.Right - $diameter, $Rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rect.Right - $diameter, $Rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rect.X, $Rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-DccPngBytes {
  param(
    [int]$Size
  )

  $bitmap = New-Object System.Drawing.Bitmap -ArgumentList $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $gold = [System.Drawing.ColorTranslator]::FromHtml("#D4B064")
  $goldSoft = [System.Drawing.ColorTranslator]::FromHtml("#C49A3E")
  $goldDeep = [System.Drawing.ColorTranslator]::FromHtml("#6F541E")
  $panelTop = [System.Drawing.ColorTranslator]::FromHtml("#252018")
  $panelBottom = [System.Drawing.ColorTranslator]::FromHtml("#0E0E11")
  $shineTop = [System.Drawing.Color]::FromArgb(70, 255, 255, 255)
  $shineBottom = [System.Drawing.Color]::FromArgb(0, 255, 255, 255)

  $pad = [single][Math]::Max([Math]::Round($Size * 0.07), 1)
  $width = [single]($Size - ($pad * 2))
  $height = [single]($Size - ($pad * 2))
  $rect = New-RectF $pad $pad $width $height
  $radius = [single][Math]::Max([Math]::Round($Size * 0.18), 2)
  $path = New-RoundedRectPath -Rect $rect -Radius $radius

  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList @($rect, $panelTop, $panelBottom, [single]90.0)
  $graphics.FillPath($bgBrush, $path)

  $shineRect = New-RectF $rect.X $rect.Y $rect.Width ([single][Math]::Max([Math]::Round($rect.Height * 0.48), 2))
  $shineBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList @($shineRect, $shineTop, $shineBottom, [single]90.0)
  $graphics.FillPath($shineBrush, $path)

  $outerPen = New-Object System.Drawing.Pen -ArgumentList $gold, ([single][Math]::Max([Math]::Round($Size * 0.045), 1))
  $graphics.DrawPath($outerPen, $path)

  $innerInset = [single][Math]::Max([Math]::Round($Size * 0.06), 1)
  $innerWidth = [single]($rect.Width - ($innerInset * 2))
  $innerHeight = [single]($rect.Height - ($innerInset * 2))
  if ($innerWidth -gt 0 -and $innerHeight -gt 0) {
    $innerRect = New-RectF ($rect.X + $innerInset) ($rect.Y + $innerInset) $innerWidth $innerHeight
    $innerRadius = [single][Math]::Max($radius - $innerInset, 1)
    $innerPath = New-RoundedRectPath -Rect $innerRect -Radius $innerRadius
    $innerPen = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::FromArgb(110, $goldSoft)), ([single][Math]::Max([Math]::Round($Size * 0.014), 1))
    $graphics.DrawPath($innerPen, $innerPath)
    $innerPen.Dispose()
    $innerPath.Dispose()
  }

  $fontSize = [single][Math]::Max([Math]::Round($Size * 0.34), 6)
  $font = New-Object System.Drawing.Font -ArgumentList @("Bahnschrift SemiCondensed", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $textBrush = New-Object System.Drawing.SolidBrush -ArgumentList $gold
  $shadowBrush = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(115, 0, 0, 0))
  $text = "DCC"
  $textSize = $graphics.MeasureString($text, $font)
  $textX = [single](($Size - $textSize.Width) / 2)
  $textY = [single](($Size - $textSize.Height) / 2 - ($Size * 0.04))
  $graphics.DrawString($text, $font, $shadowBrush, (New-PointF ($textX + [single][Math]::Max([Math]::Round($Size * 0.018), 1)) ($textY + [single][Math]::Max([Math]::Round($Size * 0.022), 1))))
  $graphics.DrawString($text, $font, $textBrush, (New-PointF $textX $textY))

  $linePen = New-Object System.Drawing.Pen -ArgumentList $goldDeep, ([single][Math]::Max([Math]::Round($Size * 0.03), 1))
  $lineY = [single]($rect.Bottom - [Math]::Round($Size * 0.18))
  $lineX = [single]($rect.X + [Math]::Round($Size * 0.22))
  $lineWidth = [single]($rect.Width - [Math]::Round($Size * 0.44))
  $graphics.DrawLine($linePen, $lineX, $lineY, ($lineX + $lineWidth), $lineY)

  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $stream.ToArray()

  $stream.Dispose()
  $linePen.Dispose()
  $textBrush.Dispose()
  $shadowBrush.Dispose()
  $font.Dispose()
  $outerPen.Dispose()
  $shineBrush.Dispose()
  $bgBrush.Dispose()
  $path.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()

  return ,([byte[]]$bytes)
}

function Save-InstallerSidebar {
  param(
    [string]$Path
  )

  $width = 164
  $height = 314
  $bitmap = New-Object System.Drawing.Bitmap -ArgumentList $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $gold = [System.Drawing.ColorTranslator]::FromHtml("#D4B064")
  $goldSoft = [System.Drawing.ColorTranslator]::FromHtml("#C49A3E")
  $text = [System.Drawing.ColorTranslator]::FromHtml("#ECECEC")
  $muted = [System.Drawing.ColorTranslator]::FromHtml("#A1A1AA")
  $top = [System.Drawing.ColorTranslator]::FromHtml("#191814")
  $bottom = [System.Drawing.ColorTranslator]::FromHtml("#0A0A0C")

  $bgRect = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, $width, $height
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList @($bgRect, $top, $bottom, [single]90.0)
  $graphics.FillRectangle($bgBrush, $bgRect)

  $glowBrush = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(30, $gold))
  $graphics.FillEllipse($glowBrush, 18, 16, 128, 88)

  $bandBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList @((New-Object System.Drawing.Rectangle -ArgumentList 0, 0, $width, 6), $gold, $goldSoft, [single]0.0)
  $graphics.FillRectangle($bandBrush, 0, 0, $width, 6)

  $iconBytes = [byte[]](New-DccPngBytes -Size 128)
  $iconStream = New-Object System.IO.MemoryStream -ArgumentList (, $iconBytes)
  $iconImage = [System.Drawing.Image]::FromStream($iconStream)
  $graphics.DrawImage($iconImage, 34, 26, 96, 96)

  $titleFont = New-Object System.Drawing.Font -ArgumentList @("Bahnschrift SemiCondensed", 24, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $bodyFont = New-Object System.Drawing.Font -ArgumentList @("Segoe UI", 11, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $monoFont = New-Object System.Drawing.Font -ArgumentList @("Consolas", 10, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $titleBrush = New-Object System.Drawing.SolidBrush -ArgumentList $gold
  $bodyBrush = New-Object System.Drawing.SolidBrush -ArgumentList $text
  $mutedBrush = New-Object System.Drawing.SolidBrush -ArgumentList $muted

  $graphics.DrawString("DRIVE", $titleFont, $titleBrush, (New-PointF 28 140))
  $graphics.DrawString("CLEANER", $titleFont, $titleBrush, (New-PointF 28 166))
  $graphics.DrawString("by Clark", $monoFont, $mutedBrush, (New-PointF 30 198))
  $graphics.DrawString("Secure drive cleanup", $bodyFont, $bodyBrush, (New-PointF 28 232))
  $graphics.DrawString("and formatting for", $bodyFont, $bodyBrush, (New-PointF 28 249))
  $graphics.DrawString("Windows media.", $bodyFont, $bodyBrush, (New-PointF 28 266))

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)

  $mutedBrush.Dispose()
  $bodyBrush.Dispose()
  $titleBrush.Dispose()
  $monoFont.Dispose()
  $bodyFont.Dispose()
  $titleFont.Dispose()
  $iconImage.Dispose()
  $iconStream.Dispose()
  $bandBrush.Dispose()
  $glowBrush.Dispose()
  $bgBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Save-InstallerHeader {
  param(
    [string]$Path
  )

  $width = 150
  $height = 57
  $bitmap = New-Object System.Drawing.Bitmap -ArgumentList $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $gold = [System.Drawing.ColorTranslator]::FromHtml("#D4B064")
  $goldSoft = [System.Drawing.ColorTranslator]::FromHtml("#C49A3E")
  $text = [System.Drawing.ColorTranslator]::FromHtml("#ECECEC")
  $muted = [System.Drawing.ColorTranslator]::FromHtml("#A1A1AA")
  $top = [System.Drawing.ColorTranslator]::FromHtml("#151518")
  $bottom = [System.Drawing.ColorTranslator]::FromHtml("#0A0A0C")

  $bgRect = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, $width, $height
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList @($bgRect, $top, $bottom, [single]0.0)
  $graphics.FillRectangle($bgBrush, $bgRect)

  $bandBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList @((New-Object System.Drawing.Rectangle -ArgumentList 0, 0, 4, $height), $gold, $goldSoft, [single]90.0)
  $graphics.FillRectangle($bandBrush, 0, 0, 4, $height)

  $iconBytes = [byte[]](New-DccPngBytes -Size 64)
  $iconStream = New-Object System.IO.MemoryStream -ArgumentList (, $iconBytes)
  $iconImage = [System.Drawing.Image]::FromStream($iconStream)
  $graphics.DrawImage($iconImage, 10, 7, 42, 42)

  $titleFont = New-Object System.Drawing.Font -ArgumentList @("Bahnschrift SemiCondensed", 15, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $subFont = New-Object System.Drawing.Font -ArgumentList @("Consolas", 8.5, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $titleBrush = New-Object System.Drawing.SolidBrush -ArgumentList $gold
  $subBrush = New-Object System.Drawing.SolidBrush -ArgumentList $muted
  $bodyBrush = New-Object System.Drawing.SolidBrush -ArgumentList $text

  $graphics.DrawString("DRIVE CLEANER", $titleFont, $titleBrush, (New-PointF 58 10))
  $graphics.DrawString("DCC  |  by Clark", $subFont, $subBrush, (New-PointF 59 28))
  $graphics.DrawString("Admin-secured media tools", $subFont, $bodyBrush, (New-PointF 59 38))

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)

  $bodyBrush.Dispose()
  $subBrush.Dispose()
  $titleBrush.Dispose()
  $subFont.Dispose()
  $titleFont.Dispose()
  $iconImage.Dispose()
  $iconStream.Dispose()
  $bandBrush.Dispose()
  $bgBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $projectRoot "assets"
$buildDir = Join-Path $projectRoot "build"
New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null

$iconPath = Join-Path $assetsDir "dcc.ico"
$previewPath = Join-Path $assetsDir "dcc-icon-preview.png"
$installerSidebarPath = Join-Path $buildDir "installerSidebar.bmp"
$installerHeaderPath = Join-Path $buildDir "installerHeader.bmp"
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$entries = foreach ($size in $sizes) {
  [pscustomobject]@{
    Size = $size
    Bytes = [byte[]](New-DccPngBytes -Size $size)
  }
}

[System.IO.File]::WriteAllBytes($previewPath, ([byte[]](New-DccPngBytes -Size 512)))

$fileStream = [System.IO.File]::Open($iconPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$writer = New-Object System.IO.BinaryWriter -ArgumentList $fileStream

$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$entries.Count)

$offset = 6 + ($entries.Count * 16)
foreach ($entry in $entries) {
  $dimension = if ($entry.Size -ge 256) { [byte]0 } else { [byte]$entry.Size }
  $writer.Write([byte]$dimension)
  $writer.Write([byte]$dimension)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]32)
  $writer.Write([uint32]$entry.Bytes.Length)
  $writer.Write([uint32]$offset)
  $offset += $entry.Bytes.Length
}

foreach ($entry in $entries) {
  $writer.Write([byte[]]$entry.Bytes)
}

$writer.Flush()
$writer.Close()
$fileStream.Close()

Save-InstallerSidebar -Path $installerSidebarPath
Save-InstallerHeader -Path $installerHeaderPath

Write-Output $iconPath
Write-Output $previewPath
Write-Output $installerSidebarPath
Write-Output $installerHeaderPath
