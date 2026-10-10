#!/usr/bin/env python3
import argparse
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}
PDF_EXTENSION = ".pdf"
_PROTECTED_TERMS = [
    "XiO-N",
    "Xio-N",
    "MEL-Import",
    "MEL-Export",
    "RT ION Plan",
    "RT Structure Set",
    "RT Dose",
    "RT Image(DRR)",
    "DICOM",
    "RIS",
    "MOSAIQ",
    "K2Dose",
    "A/B室",
    "A/B",
    "HHT",
    "Elekta",
    "MEL-Import-",
    "MEL-Export-",
]
_TECHNICAL_GLOSSARY = {
    "画像": "图像",
    "処理": "处理",
    "利用時": "使用时",
    "利用": "使用",
    "時": "时",
    "表示": "显示",
    "設定": "设置",
    "検査": "检查",
    "情報": "信息",
    "診断": "诊断",
    "入力": "输入",
    "出力": "输出",
    "撮影": "拍摄",
    "保存": "保存",
    "読込": "读取",
    "開始": "开始",
    "終了": "结束",
    "患者": "患者",
    "施設": "设施",
    "部門": "部门",
    "病院": "医院",
    "医師": "医生",
    "登録": "注册",
    "送信": "发送",
    "受信": "接收",
    "日付": "日期",
    "時間": "时间",
    "機能": "功能",
    "再構成": "重建",
    "読影": "阅片",
    "定義": "定义",
    "画像処理": "图像处理",
    "表示部": "显示部",
    "確認": "确认",
    "選択": "选择",
    "更新": "更新",
    "治療": "治疗",
    "計画": "计划",
    "イメージ": "图像",
    "接続": "连接",
    "データ": "数据",
    "連携": "协同",
    "管理": "管理",
    "画面": "画面",
    "線源": "线源",
    "更に": "进一步",
    "検証": "验证",
    "チェック": "检查",
    "通知": "通知",
    "条件": "条件",
    "対応": "对应",
    "必要": "必要",
    "機器": "设备",
    "系": "系统",
    "社": "公司",
    "向け": "面向",
    "前": "前",
    "後": "后",
    "図": "图",
    "異常": "异常",
    "準備": "准备",
    "使用": "使用",
    "方向": "方向",
    "項目": "项目",
    "影像": "影像",
    "照射": "照射",
    "外部": "外部",
    "予定": "计划",
    "注記": "注记",
    "設定値": "设置值",
    "構成": "构成",
    "表示名": "显示名",
    "変更": "更改",
    "中": "中",
    "治療計画イメージ": "治疗计划图像",
    "利用時": "使用时",
    "HHT社向け": "面向HHT公司",
    "Elekta向け": "面向Elekta",
    "線源管理": "线源管理",
    "受信処理": "接收处理",
    "処理中": "处理中",
    "受信する": "接收",
    "登録済": "已注册",
    "保存済": "已保存",
    "読み込み": "读取",
    "送信先": "发送目标",
    "最終画面": "最终画面",
    "接続画面": "连接画面",
    "設定画面": "设置画面",
    "編集画面": "编辑画面",
    "再構成画像": "重建图像",
    "処理結果": "处理结果",
    "照射計画": "照射计划",
    "計画登録": "计划登记",
    "画像表示": "图像显示",
    "患者情報": "患者信息",
    "病院情報": "医院信息",
    "前処理": "前处理",
    "伝送": "传输",
    "確認済": "已确认",
    "再送信": "重发",
    "連続": "连续",
    "同時": "同时",
    "実行": "执行",
    "停止": "停止",
    "転送": "转发",
    "確認": "确认",
    "比較": "比较",
    "確認画面": "确认画面",
    "読込済": "已读取",
    "書込": "写入",
    "表示済": "已显示",
    "検索": "检索",
    "解析": "解析",
    "診療": "诊疗",
    "再起動": "重启",
    "測定": "测量",
    "異常終了": "异常结束",
    "前回": "上次",
    "次回": "下次",
    "発生": "发生",
    "影響": "影响",
    "入力済": "已输入",
    "出力済": "已输出",
    "完了": "完成",
    "失敗": "失败",
    "未了": "未完成",
    "同一": "相同",
    "状態": "状态",
}
_TRANSLATION_CACHE: dict[tuple[str, str], str] = {}


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


def detect_tesseract_binary() -> str | None:
    candidates = [
        shutil.which("tesseract"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return str(candidate)
    return None


def ensure_tesseract(auto_install: bool = False) -> bool:
    binary = detect_tesseract_binary()
    if binary is not None:
        tesseract_dir = str(Path(binary).parent)
        path_entries = os.environ.get("PATH", "").split(os.pathsep)
        if tesseract_dir not in path_entries:
            os.environ["PATH"] = os.pathsep.join([tesseract_dir] + path_entries)
        return True
    if auto_install and install_tesseract():
        binary = detect_tesseract_binary()
        if binary is not None:
            tesseract_dir = str(Path(binary).parent)
            path_entries = os.environ.get("PATH", "").split(os.pathsep)
            if tesseract_dir not in path_entries:
                os.environ["PATH"] = os.pathsep.join([tesseract_dir] + path_entries)
            return True
    return False


def detect_tessdata_dir() -> Path | None:
    user_tessdata = Path.home() / "AppData" / "Local" / "Tesseract-OCR" / "tessdata"
    if not user_tessdata.exists():
        user_tessdata.mkdir(parents=True, exist_ok=True)
    os.environ["TESSDATA_PREFIX"] = str(user_tessdata)
    return user_tessdata


def ensure_ocr_language_data(*languages: str) -> bool:
    if not languages:
        return True

    tessdata_dir = detect_tessdata_dir()
    if tessdata_dir is None:
        return False
    tessdata_dir.mkdir(parents=True, exist_ok=True)

    missing = []
    for language in languages:
        traineddata = tessdata_dir / f"{language}.traineddata"
        if not traineddata.exists():
            missing.append((language, traineddata))

    for language, traineddata in missing:
        url = f"https://github.com/tesseract-ocr/tessdata/raw/main/{language}.traineddata"
        try:
            with urllib.request.urlopen(url, timeout=60) as response, open(traineddata, "wb") as target:
                shutil.copyfileobj(response, target)
        except Exception:
            return False
    return True


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
    if not ensure_ocr_language_data("eng", "jpn"):
        raise RuntimeError("Japanese and English Tesseract training data could not be installed.")

    image = Image.open(image_path)
    text = pytesseract.image_to_string(image, config="--psm 6", lang="eng+jpn")
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
    if not ensure_ocr_language_data("eng", "jpn"):
        raise RuntimeError("Japanese and English Tesseract training data could not be installed.")

    pages = convert_from_path(str(pdf_path), dpi=200)
    extracted_pages: list[str] = []
    for page in pages:
        text = pytesseract.image_to_string(page, config="--psm 6", lang="eng+jpn")
        extracted_pages.append(text.strip())
    return extracted_pages


def normalize_ocr_text(text: str) -> str:
    if not text:
        return ""

    cleaned = text.strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = cleaned.replace("MELmport", "MEL-Import")
    cleaned = cleaned.replace("MEL-Export", "MEL-Export")
    cleaned = cleaned.replace("xio-n", "XiO-N")
    cleaned = cleaned.replace("Xio-N", "XiO-N")
    cleaned = cleaned.replace("XIO-N", "XiO-N")
    cleaned = cleaned.replace("XiO-N ", "XiO-N ")
    cleaned = cleaned.replace(" DICOM", " DICOM")
    cleaned = cleaned.replace(" RIS", " RIS")
    cleaned = cleaned.replace(" MOSAIQ", " MOSAIQ")
    cleaned = cleaned.replace(" RT ION Plan", " RT ION Plan")
    cleaned = cleaned.replace("MEL - Import", "MEL-Import")
    cleaned = cleaned.replace("MEL - Export", "MEL-Export")
    cleaned = cleaned.replace("XiO - N", "XiO-N")
    cleaned = cleaned.replace("N\x00", "N")
    cleaned = cleaned.replace("\u00a0", " ")
    cleaned = re.sub(r"\s*[-–—]\s*", "-", cleaned)
    return cleaned


def contains_japanese(text: str) -> bool:
    if not text:
        return False
    if re.search(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]", text):
        return True
    for key in _TECHNICAL_GLOSSARY:
        if key in text:
            return True
    return False


def should_translate_region(text: str) -> bool:
    if not text:
        return False
    normalized = normalize_ocr_text(text)
    if is_noise_text(normalized):
        return False
    if len(normalized) < 2:
        return False
    if re.fullmatch(r"[A-Za-z0-9\s\-_/.:()@+]+", normalized):
        return False
    return contains_japanese(normalized)


def is_noise_text(text: str) -> bool:
    stripped = (text or "").strip()
    if not stripped:
        return True
    if len(stripped) <= 1:
        return True
    if re.fullmatch(r"[\W_]+", stripped):
        return True
    if re.fullmatch(r"[A-Za-z0-9\-./:_()]+", stripped) and len(stripped) <= 3:
        return True
    return False


def apply_glossary(text: str, target_lang: str) -> str:
    if not text or not target_lang.lower().startswith("zh"):
        return text
    result = text
    for src, translated in sorted(_TECHNICAL_GLOSSARY.items(), key=lambda item: len(item[0]), reverse=True):
        result = result.replace(src, translated)
    return result


def translate_japanese_phrases(text: str, target_lang: str) -> str:
    if not text or not target_lang.lower().startswith("zh"):
        return text
    if not contains_japanese(text):
        return text

    result = apply_glossary(text, target_lang)
    if not contains_japanese(result):
        return result

    parts: list[str] = []
    last_index = 0
    for match in re.finditer(r"[A-Za-z0-9./_()@:+\-]+", result):
        if match.start() > last_index:
            chunk = result[last_index:match.start()]
            if chunk and contains_japanese(chunk):
                parts.append(apply_glossary(chunk, target_lang))
            else:
                parts.append(chunk)
        parts.append(match.group(0))
        last_index = match.end()
    if last_index < len(result):
        tail = result[last_index:]
        if tail and contains_japanese(tail):
            parts.append(apply_glossary(tail, target_lang))
        else:
            parts.append(tail)
    return "".join(parts)


def translate_with_timeout(translator_fn, timeout_seconds: int = 10):
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(translator_fn)
        return future.result(timeout=timeout_seconds)


def protect_terms(text: str) -> tuple[str, dict[str, str]]:
    if not text:
        return text, {}

    protected: dict[str, str] = {}
    working = text
    for index, term in enumerate(sorted(_PROTECTED_TERMS, key=len, reverse=True)):
        token = f"__TERM_{index}__"
        if term in working:
            protected[token] = term
            working = working.replace(term, token)
    return working, protected


def restore_protected_terms(text: str, protected: dict[str, str]) -> str:
    restored = text
    for token, term in protected.items():
        restored = restored.replace(token, term)
    return restored


def translate_text(text: str, target_lang: str) -> str:
    if not text or not text.strip():
        return ""

    normalized = normalize_ocr_text(text)
    if is_noise_text(normalized):
        return normalized
    if not contains_japanese(normalized):
        return normalized

    cache_key = (normalized, target_lang)
    if cache_key in _TRANSLATION_CACHE:
        return _TRANSLATION_CACHE[cache_key]

    result = translate_japanese_phrases(normalized, target_lang)
    if not contains_japanese(result):
        _TRANSLATION_CACHE[cache_key] = result
        return result

    protected_text, protected = protect_terms(normalized)
    protected_text = apply_glossary(protected_text, target_lang)

    try:
        from googletrans import Translator
    except ImportError:
        Translator = None

    if Translator is not None and len(protected_text) <= 64:
        try:
            def translate_call():
                return Translator(timeout=3).translate(protected_text, dest=target_lang, src="ja")

            translated = translate_with_timeout(translate_call)
            candidate = getattr(translated, "text", None) or protected_text
            if candidate and candidate.strip() not in {"", protected_text}:
                result = candidate
        except Exception:
            result = protected_text
    else:
        result = protected_text

    restored = restore_protected_terms(result, protected)
    restored = apply_glossary(restored, target_lang)
    if not contains_japanese(restored):
        _TRANSLATION_CACHE[cache_key] = restored
        return restored

    _TRANSLATION_CACHE[cache_key] = normalized
    return normalized


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


def preprocess_ocr_image(image):
    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("Missing image dependencies. Run: pip install -r requirements.txt") from exc

    grayscale = image.convert("L")
    # Increase contrast for OCR-heavy diagrams and then enlarge to improve recognition quality.
    grayscale = grayscale.resize((grayscale.width * 2, grayscale.height * 2), Image.Resampling.LANCZOS)
    return grayscale


def detect_text_lines(image) -> list[dict]:
    try:
        import pytesseract
        from pytesseract import Output
    except ImportError as exc:
        raise RuntimeError("Missing OCR dependencies. Run: pip install -r requirements.txt") from exc

    try:
        data = pytesseract.image_to_data(
            image,
            config="--psm 6 -c preserve_interword_spaces=1",
            lang="eng+jpn",
            output_type=Output.DICT,
        )
    except pytesseract.TesseractError:
        data = pytesseract.image_to_data(
            image,
            config="--psm 6 -c preserve_interword_spaces=1",
            lang="eng+jpn",
            output_type=Output.DICT,
        )

    grouped: dict[tuple[int, int, int], list[dict]] = {}
    for idx, text in enumerate(data["text"]):
        if not text or not text.strip():
            continue
        try:
            confidence = float(data["conf"][idx])
        except (TypeError, ValueError):
            confidence = 0.0
        if confidence < 25:
            continue
        if re.sub(r"[^\u4e00-\u9fffA-Za-z0-9\-/()@.:_]+", "", text).strip() == "":
            continue

        block_num = int(data["block_num"][idx])
        par_num = int(data["par_num"][idx])
        line_num = int(data["line_num"][idx])
        key = (block_num, par_num, line_num)
        grouped.setdefault(key, []).append({
            "text": text.strip(),
            "left": int(data["left"][idx]) // 2,
            "top": int(data["top"][idx]) // 2,
            "width": max(1, int(data["width"][idx]) // 2),
            "height": max(1, int(data["height"][idx]) // 2),
        })

    lines: list[dict] = []
    for key in sorted(grouped):
        words = sorted(grouped[key], key=lambda item: item["left"])
        if not words:
            continue
        text = " ".join(item["text"] for item in words if item["text"]).strip()
        if len(text) < 2:
            continue
        left = min(item["left"] for item in words)
        top = min(item["top"] for item in words)
        right = max(item["left"] + item["width"] for item in words)
        bottom = max(item["top"] + item["height"] for item in words)
        if (right - left) < 12 and (bottom - top) < 10:
            continue
        lines.append({
            "text": text,
            "left": int(left),
            "top": int(top),
            "right": int(right),
            "bottom": int(bottom),
            "height": max(int(bottom - top), 1),
        })

    return sorted(lines, key=lambda item: (item["top"], item["left"]))


def draw_text_box(draw, font_path, box, text: str):
    if not text or not text.strip():
        return
    x1, y1, x2, y2 = box
    box_width = max(12, x2 - x1)
    box_height = max(12, y2 - y1)
    draw.rectangle((x1, y1, x2, y2), fill=(255, 255, 255))

    font_size = max(10, min(26, int(max(box_height, 12) * 0.8)))
    try:
        from PIL import ImageFont
        font = ImageFont.truetype(font_path, font_size) if font_path else ImageFont.load_default()
    except Exception:
        from PIL import ImageFont
        font = ImageFont.load_default()

    wrapped = wrap_text(text, max_chars=max(10, int(box_width / 8)))
    text_y = y1 + 2
    for wrapped_line in wrapped[:3]:
        bbox = draw.textbbox((0, 0), wrapped_line, font=font)
        text_width = bbox[2] - bbox[0]
        text_x = x1 + max(0, (box_width - text_width) // 2)
        draw.text((text_x, text_y), wrapped_line, font=font, fill=(0, 0, 0))
        _, line_h = font.getbbox(wrapped_line)[2:4]
        text_y += line_h + 4


def render_translated_image(input_path: Path, translated_text: str, output_path: Path, target_lang: str):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as exc:
        raise RuntimeError("Missing OCR dependencies. Run: pip install -r requirements.txt") from exc

    base_image = Image.open(input_path).convert("RGB")
    processed = preprocess_ocr_image(base_image)
    lines = detect_text_lines(processed)
    canvas = base_image.copy()
    draw = ImageDraw.Draw(canvas)
    font_path = locate_font()

    if not lines:
        font_size = max(18, min(canvas.width // 30, 40))
        font = ImageFont.truetype(font_path, font_size) if font_path else ImageFont.load_default()
        wrapped = wrap_text(translated_text, max_chars=max(20, canvas.width // 12))
        y = canvas.height - 40
        for line in reversed(wrapped):
            bbox = draw.textbbox((0, 0), line, font=font)
            text_width = bbox[2] - bbox[0]
            draw.text((max(10, (canvas.width - text_width) // 2), max(0, y - 30)), line, font=font, fill=(0, 0, 0))
            y -= 26
        canvas.save(output_path)
        return

    for line in lines:
        region_text = normalize_ocr_text(line["text"].strip())
        if not should_translate_region(region_text):
            continue

        width = max(1, line["right"] - line["left"])
        height = max(1, line["bottom"] - line["top"])
        if width > canvas.width * 0.75 or height > canvas.height * 0.6:
            continue

        translated = translate_text(region_text, target_lang) or region_text
        if not translated.strip() or translated.strip() == region_text.strip():
            continue
        if contains_japanese(translated):
            continue

        x1 = max(0, line["left"] - 5)
        y1 = max(0, line["top"] - 5)
        x2 = min(canvas.width, line["right"] + 5)
        y2 = min(canvas.height, line["bottom"] + 5)
        draw_text_box(draw, font_path, (x1, y1, x2, y2), translated)

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
    read_ocr_text_from_image(input_path)
    render_translated_image(input_path, "", output_path, target_lang)


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
    if not ensure_ocr_language_data("eng", "jpn"):
        print(
            "Tesseract OCR language data for English/Japanese could not be downloaded. Install eng+jpn language packs manually.",
            file=sys.stderr,
        )
        return 5

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
