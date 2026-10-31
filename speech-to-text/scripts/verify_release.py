import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    executable = root / "dist/SpeechToText/SpeechToText.exe"
    cases = [
        ("en.mp3", "en", "speech"),
        ("zh.mp4", "zh", "\u4e2d\u6587"),
        ("zh.mkv", "zh", "\u5b57\u5e55"),
        ("delayed.mp4", "en", "english"),
        ("silence.wav", "unknown", ""),
    ]
    with tempfile.TemporaryDirectory(prefix="stt-release-") as temporary_dir:
        temporary_root = Path(temporary_dir)
        inputs = []
        for index, (name, _, _) in enumerate(cases):
            source = root / ".test-media" / name
            target = temporary_root / f"case-{index}{source.suffix}"
            shutil.copy2(source, target)
            inputs.append(target)
        command = [
            str(executable),
            "transcribe",
            *(str(path) for path in inputs),
            "-o",
            str(temporary_root / "output"),
            "--model",
            "small",
            "--model-dir",
            str(root / ".models"),
            "--offline",
            "--quiet",
        ]
        completed = subprocess.run(
            command,
            capture_output=True,
            encoding="utf-8",
            timeout=600,
            env={**os.environ, "PYTHONUTF8": "1"},
        )
        if completed.returncode:
            raise RuntimeError(f"Packaged transcription failed: {completed.stderr}")
        results = [json.loads(line) for line in completed.stdout.splitlines() if line.strip()]
        assert len(results) == len(cases)
        for (name, language, keyword), result in zip(cases, results, strict=True):
            assert result["language"] == language, result
            text = Path(result["outputs"]["txt"]).read_text(encoding="utf-8").lower()
            assert keyword in text, (name, text)
            srt = Path(result["outputs"]["srt"]).read_text(encoding="utf-8")
            vtt = Path(result["outputs"]["vtt"]).read_text(encoding="utf-8")
            assert vtt.startswith("WEBVTT\n\n")
            if name == "silence.wav":
                assert text == "" and srt == "" and result["segments"] == 0
            else:
                assert " --> " in srt and result["segments"] > 0
            if name == "delayed.mp4":
                first_timestamp = srt.splitlines()[1].split(" --> ")[0]
                hours, minutes, seconds = first_timestamp.replace(",", ".").split(":")
                assert int(hours) * 3600 + int(minutes) * 60 + float(seconds) >= 2.5
            print(f"PASS packaged {name}: {result['segments']} segments, {language}")
    print("Packaged release acceptance passed")


if __name__ == "__main__":
    main()
