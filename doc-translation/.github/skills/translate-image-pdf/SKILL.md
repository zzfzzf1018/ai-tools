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
3. OCR the text with Tesseract and prefer detected text-box regions over whole-page translation.
4. Translate only Japanese text and glossary-heavy technical labels into the requested language, while leaving English / acronyms like XiO-N, DICOM, RIS, MOSAIQ, RT ION Plan, etc. intact.
5. Repaint translated text in-place on the original OCR boxes to preserve layout instead of appending a bottom translation block.
6. Write a new translated image or PDF output file.

## Notes

- The input must be an image (`.png`, `.jpg`, `.jpeg`, `.bmp`, `.tif`, `.tiff`) or PDF (`.pdf`).
- If Tesseract is not installed, the tool automatically tries to install it via the system package manager (`winget`, `brew`, or `apt-get`).
- For screenshots and diagrams, this skill intentionally prefers layout-preserving OCR replacement, not a bottom-of-page translation strip.
- For medical / technical flowcharts, the tool should only translate actual Japanese content and keep technical labels, product names, and English acronyms untouched.
- If translation fails due to network restrictions, the tool keeps the original OCR text and writes the file anyway.
- Use a specific output path so the result is clearly stored in a separate file.
