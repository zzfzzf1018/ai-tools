---
name: translate-image-pdf
description: OCR a PDF or image, translate the extracted text into a target language, and write a new translated file.
---

# Translate Image/PDF

Use this skill when a user wants to translate the text embedded in a screenshot, scanned image, or PDF file into a new output file.

## Command template

```bash
python translate_document.py "<input-file>" --lang "<target-language>" --output "<output-file>"
```

Examples:

```bash
python translate_document.py "./input/sample.png" --lang zh-CN --output "./output/sample_zh.png"
python translate_document.py "./input/sample.pdf" --lang en --output "./output/sample_en.pdf"
python translate_document.py "./input/sample.pdf" --lang zh-CN --output "./output/sample_zh.pdf" --install-tesseract
```

## Behavior

1. Detect whether the input file is an image or PDF.
2. If Tesseract OCR is missing, attempt to install it automatically for the current OS.
3. OCR the text with Tesseract.
4. Translate the extracted text to the requested language.
5. Write a new translated image or PDF output file.

## Notes

- The input must be an image (`.png`, `.jpg`, `.jpeg`, `.bmp`, `.tif`, `.tiff`) or PDF (`.pdf`).
- If Tesseract is not installed, the tool automatically tries to install it via the system package manager (`winget`, `brew`, or `apt-get`).
- If translation fails due to network restrictions, the tool keeps the original OCR text and writes the file anyway.
- Use a specific output path so the result is clearly stored in a separate file.
