#!/usr/bin/env python3
import argparse
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}
PDF_EXTENSION = ".pdf"


def run_command(commands: list[str]) -> bool:
    try:
        subprocess.run(commands, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def install_tesseract() -> bool:
    system_name = platform.system().lower()
    if system_name == "windows":
        if shutil.which("winget"):
            return run_command(["winget", "install", "--id", "TesseractOCR.Tesseract", "-e", "--source", "winget"])
        if shutil.which("choco"):
            return run_command(["choco", "install", "tesseract", "-y"])
        print("Tesseract installation command: winget install --id TesseractOCR.Tesseract -e --source winget", file=sys.stderr)
        return False
    if system_name == "darwin":
        if shutil.which("brew"):
            return run_command(["brew", "install", "tesseract"])
        print("Tesseract installation command: brew install tesseract", file=sys.stderr)
        return False
    if system_name.startswith("linux"):
        if shutil.which("sudo"):
            return run_command(["sudo", "apt-get", "update"]) and run_command(["sudo", "apt-get", "install", "-y", "tesseract-ocr"])
        if shutil.which("apt-get"):
            return run_command(["apt-get", "update"]) and run_command(["apt-get", "install", "-y", "tesseract-ocr"])
        print("Tesseract installation command: sudo apt-get update && sudo apt-get install -y tesseract-ocr", file=sys.stderr)
        return False

    print("Tesseract is required. Please install Tesseract OCR manually for this OS.", file=sys.stderr)
    return False


def ensure_tesseract(auto_install: bool = False) -> bool:
    if shutil.which("tesseract") is not None:
        return True
    if auto_install and install_tesseract():
        return shutil.which("tesseract") is not None
    return False


def normalize_language_code(lang: str) -> str:
    return lang.strip() or "zh-CN"


def detect_file_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in IMAGE_EXTENSIONS:
        return "image"
    if suffix == PDF_EXTENSION:
        return "pdf"
    raise ValueError(f"Unsupported file type: {path}")


def default_output_path(input_path: Path, target_lang: str) -> Path:
    parent = input_path.parent
    stem = input_path.stem
    output_name = f"{stem}_{target_lang}"
    if input_path.suffix.lower() == ".pdf":
        return parent / f"{output_name}.pdf"
    return parent / f"{output_name}{input_path.suffix.lower()}"


def read_ocr_text_from_image(image_path: Path) -> str:
    try:
        from PIL import Image
        import pytesseract
    except ImportError as exc:
        raise RuntimeError("Missing OCR dependencies. Run: pip install -r requirements.txt") from exc

    if not ensure_tesseract(auto_install=True):
        raise RuntimeError(
            "Tesseract installation failed. Please install Tesseract OCR manually or retry after fixing the environment."
        )

    image = Image.open(image_path)
    text = pytesseract.image_to_string(image, config="--psm 6")
    return text.strip()


def read_ocr_text_from_pdf(pdf_path: Path) -> list[str]:
    try:
        from pdf2image import convert_from_path
        from PIL import Image
        import pytesseract
    except ImportError as exc:
        raise RuntimeError("Missing OCR dependencies. Run: pip install -r requirements.txt") from exc

    if not ensure_tesseract(auto_install=True):
        raise RuntimeError(
            "Tesseract installation failed. Please install Tesseract OCR manually or retry after fixing the environment."
        )

    pages = convert_from_path(str(pdf_path), dpi=200)
    extracted_pages: list[str] = []
    for page in pages:
        text = pytesseract.image_to_string(page, config="--psm 6")
        extracted_pages.append(text.strip())
    return extracted_pages


def translate_text(text: str, target_lang: str) -> str:
    if not text.strip():
        return ""
    try:
        from deep_translator import GoogleTranslator
    except ImportError:
        return text

    try:
        translated = GoogleTranslator(source="auto", target=target_lang).translate(text)
        return translated or text
    except Exception:
        return text


def wrap_text(text: str, max_chars: int = 60) -> list[str]:
    lines: list[str] = []
    for paragraph in text.splitlines():
        if not paragraph.strip():
            lines.append("")
            continue
        words = paragraph.split()
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if len(candidate) <= max_chars:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines


def locate_font() -> str:
    candidates = [
        os.environ.get("SYSTEMROOT", "") and os.path.join(os.environ["SYSTEMROOT"], "Fonts", "simhei.ttf"),
        os.environ.get("SYSTEMROOT", "") and os.path.join(os.environ["SYSTEMROOT"], "Fonts", "msyh.ttc"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate
    return None


def render_translated_image(input_path: Path, translated_text: str, output_path: Path):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as exc:
        raise RuntimeError("Missing image dependencies. Run: pip install -r requirements.txt") from exc

    base_image = Image.open(input_path).convert("RGB")
    width, height = base_image.size
    margin = 40
    text_font_size = max(18, min(width // 30, 40))
    font_path = locate_font()
    font = ImageFont.truetype(font_path, text_font_size) if font_path else ImageFont.load_default()

    wrapped_lines = wrap_text(translated_text, max_chars=max(20, width // 12))
    rendered_height = 0
    for line in wrapped_lines:
        _, line_h = font.getbbox(line)[2:4]
        rendered_height += line_h + 8

    canvas = Image.new("RGB", (width, height + rendered_height + margin * 2), "white")
    canvas.paste(base_image, (0, 0))

    draw = ImageDraw.Draw(canvas)
    y = height + margin
    for line in wrapped_lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        text_width = bbox[2] - bbox[0]
        text_x = max(20, (width - text_width) // 2)
        draw.text((text_x, y), line, font=font, fill=(0, 0, 0))
        _, line_h = font.getbbox(line)[2:4]
        y += line_h + 10

    canvas.save(output_path)


def extract_ocr_layout(page_image):
    try:
        import pytesseract
        from pytesseract import Output
    except ImportError as exc:
        raise RuntimeError("Missing OCR dependencies. Run: pip install -r requirements.txt") from exc

    data = pytesseract.image_to_data(page_image, config="--psm 6", output_type=Output.DICT)
    grouped: dict[tuple[int, int, int], list[dict]] = {}

    for index, word in enumerate(data["text"]):
        if not word.strip():
            continue
        try:
            confidence = float(data["conf"][index])
        except (TypeError, ValueError):
            confidence = 0.0
        if confidence < 30:
            continue

        block_num = int(data["block_num"][index])
        par_num = int(data["par_num"][index])
        line_num = int(data["line_num"][index])
        key = (block_num, par_num, line_num)
        grouped.setdefault(key, []).append(
            {
                "text": word,
                "left": int(data["left"][index]),
                "top": int(data["top"][index]),
                "width": int(data["width"][index]),
                "height": int(data["height"][index]),
            }
        )

    lines: list[dict] = []
    for key in sorted(grouped):
        words = sorted(grouped[key], key=lambda item: item["left"])
        text = " ".join(item["text"] for item in words)
        left = min(item["left"] for item in words)
        top = min(item["top"] for item in words)
        right = max(item["left"] + item["width"] for item in words)
        bottom = max(item["top"] + item["height"] for item in words)
        lines.append(
            {
                "text": text,
                "left": left,
                "top": top,
                "right": right,
                "bottom": bottom,
                "height": max(bottom - top, 1),
            }
        )
    return lines


def render_translated_pdf(input_path: Path, translated_pages: list[str], output_path: Path, target_lang: str):
    try:
        from PIL import Image
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise RuntimeError("Missing PDF dependencies. Run: pip install -r requirements.txt") from exc

    temp_dir = Path(tempfile.mkdtemp(prefix="translate_pdf_"))
    page_images: list[Path] = []
    try:
        from pdf2image import convert_from_path

        pages = convert_from_path(str(input_path), dpi=200, fmt="png")
        for index, page in enumerate(pages):
            page_file = temp_dir / f"page_{index}.png"
            page.save(page_file)
            page_images.append(page_file)

        pdf_canvas = canvas.Canvas(str(output_path), pagesize=A4)
        for index, page_file in enumerate(page_images):
            whole_page = Image.open(page_file).convert("RGB")
            page_width, page_height = whole_page.size
            scale = min(A4[0] / page_width, A4[1] / page_height)
            draw_width = page_width * scale
            draw_height = page_height * scale
            x = (A4[0] - draw_width) / 2
            y = (A4[1] - draw_height) / 2
            pdf_canvas.drawImage(str(page_file), x, y, width=draw_width, height=draw_height)

            lines = extract_ocr_layout(whole_page)
            translated = translated_pages[index] if index < len(translated_pages) else ""

            if not lines:
                fallback_lines = wrap_text(translated, max_chars=70)
                if fallback_lines:
                    pdf_canvas.setFont("Helvetica", 10)
                    text_y = 30
                    for line in fallback_lines[:18]:
                        pdf_canvas.drawString(30, text_y, line[:90])
                        text_y += 12
            else:
                for item in lines:
                    text = translate_text(item["text"], target_lang) or item["text"]
                    if not text.strip():
                        continue
                    max_chars = max(12, int((item["right"] - item["left"]) / 7))
                    wrapped_lines = wrap_text(text, max_chars=max_chars)
                    for offset, wrapped_line in enumerate(wrapped_lines[:4]):
                        font_size = max(7, min(18, int(item["height"] * 0.55)))
                        pdf_canvas.setFont("Helvetica", font_size)
                        baseline_y = y + draw_height - (item["top"] * scale) - offset * (font_size * 1.3)
                        pdf_canvas.drawString(x + item["left"] * scale, baseline_y, wrapped_line[:120])
            pdf_canvas.showPage()
        pdf_canvas.save()
    finally:
        for temp_file in temp_dir.iterdir():
            try:
                temp_file.unlink()
            except OSError:
                pass
        temp_dir.rmdir()


def process_image(input_path: Path, output_path: Path, target_lang: str):
    ocr_text = read_ocr_text_from_image(input_path)
    translated = translate_text(ocr_text, target_lang)
    render_translated_image(input_path, translated or ocr_text, output_path)


def process_pdf(input_path: Path, output_path: Path, target_lang: str):
    ocr_pages = read_ocr_text_from_pdf(input_path)
    translated_pages = [translate_text(page, target_lang) or page for page in ocr_pages]
    render_translated_pdf(input_path, translated_pages, output_path, target_lang)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Translate text in an image or PDF into another language and save a new file."
    )
    parser.add_argument("input_file", type=Path, help="Source image or PDF file to translate.")
    parser.add_argument("--lang", "--target-language", dest="target_language", default="zh-CN",
                        help="Target language code, for example zh-CN, en, ja, fr")
    parser.add_argument("-o", "--output", type=Path, help="Output file path.")
    parser.add_argument("--install-tesseract", action="store_true",
                        help="Attempt to install Tesseract OCR automatically for this OS.")
    return parser


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    input_path = args.input_file.resolve()
    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        return 1

    try:
        file_type = detect_file_type(input_path)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    target_lang = normalize_language_code(args.target_language)
    if not ensure_tesseract(auto_install=True):
        print(
            "Tesseract OCR was not found and auto-install failed. Install it manually or rerun with --install-tesseract.",
            file=sys.stderr,
        )
        return 4

    output_path = args.output.resolve() if args.output else default_output_path(input_path, target_lang)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        if file_type == "image":
            process_image(input_path, output_path, target_lang)
        else:
            process_pdf(input_path, output_path, target_lang)
    except Exception as exc:
        print(f"Translation failed: {exc}", file=sys.stderr)
        return 3

    print(f"Saved translated output to: {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
