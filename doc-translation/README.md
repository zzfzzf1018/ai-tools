# 文档图像/PDF 翻译工具

这是一个简单的命令行工具，用于：

- 识别图片中的文本（OCR）
- 识别 PDF 每页中的文本（OCR）
- 将提取文本翻译为指定语言
- 生成新的翻译结果文件（图片或 PDF）

## 安装

在 Windows 下：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

注意：还需要安装系统级的 Tesseract OCR：

- Windows: `winget install --id=TesseractOCR.Tesseract -e`
- macOS: `brew install tesseract`
- Ubuntu/Debian: `sudo apt-get install tesseract-ocr`

## 使用方式

### 自动安装 Tesseract OCR

如果本机还没有安装 Tesseract，脚本会在首次运行时自动尝试安装；如果你希望强制重试，也可以显式传 `--install-tesseract`：

```powershell
python translate_document.py .\input\sample.png --lang zh-CN --output .\output\sample_zh.png
python translate_document.py .\input\sample.png --lang zh-CN --output .\output\sample_zh.png --install-tesseract
```

脚本会根据操作系统自动选择：

- Windows: `winget install --id TesseractOCR.Tesseract -e --source winget`
- macOS: `brew install tesseract`
- Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y tesseract-ocr`

### 图片翻译

```powershell
python translate_document.py .\input\sample.png --lang zh-CN --output .\output\sample_zh.png
```

### PDF 翻译

```powershell
python translate_document.py .\input\sample.pdf --lang en --output .\output\sample_en.pdf
```

### 语言参数

`--lang` 可以使用 ISO 语言代码，例如：

- `zh-CN`
- `en`
- `ja`
- `fr`
- `de`

## 输出说明

- 图片输入：输出为保留原图版式的译文覆盖版图片，优先在 OCR 检测到的文字位置直接替换译文，而不是简单追加到图片底部。
- PDF 输入：输出为新生成的 PDF，每页均保留原始页面图像，并在 OCR 文字的原始位置附近放置译文，以尽量保留版式。
- 改进点：对图片和 PDF 都采用按块/按行的 OCR 版面识别，优先保持文本块位置与整体布局，而不是简单的底部追加译文；同时对日文/技术术语做词典保护和低置信度过滤，减少乱码和未翻译残留。

## 设计思路

该工具采用：

1. OCR 提取文字
2. 通过翻译服务翻译文本
3. 将译文重排到新文件中

适用于批量处理扫描件、截图、PDF 文档的基础翻译场景。
