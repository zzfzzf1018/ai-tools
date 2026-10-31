import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify packaged bilingual transcription")
    parser.add_argument("--archive", type=Path, help="Verify checksum and run the extracted ZIP")
    parser.add_argument("--report", type=Path, help="Write persistent packaged acceptance evidence")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    executable = root / "dist/SpeechToText/SpeechToText.exe"
    cases = [
        ("en.mp3", "en", "speech"),
        ("zh.mp4", "zh", "\u4e2d\u6587"),
        ("zh.mkv", "zh", "\u5b57\u5e55"),
        ("delayed.mp4", "en", "english"),
        ("silence.wav", "unknown", ""),
    ]
    evidence = {
        "schema_version": 1,
        "status": "running",
        "started_at_utc": datetime.now(UTC).isoformat(),
        "fixture_kind": "synthetic_tts",
        "clean_windows_verified": False,
        "business_media_verified": False,
        "cases": [],
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    with tempfile.TemporaryDirectory(prefix="stt-release-") as temporary_dir:
        temporary_root = Path(temporary_dir)
        if args.archive:
            archive_path = args.archive.resolve()
            expected_hash = Path(str(archive_path) + ".sha256").read_text().split()[0]
            with archive_path.open("rb") as source:
                assert hashlib.file_digest(source, "sha256").hexdigest() == expected_hash
            evidence["archive_sha256"] = expected_hash
            extracted = temporary_root / "\u53d1\u884c\u5305 folder"
            with zipfile.ZipFile(archive_path) as archive:
                for relative in (
                    "SpeechToText.exe",
                    "help.cmd",
                    "build-info.json",
                    "docs/user-guide.html",
                    "docs/images/application.png",
                ):
                    assert "SpeechToText/" + relative in archive.namelist()
                assert archive.testzip() is None
                archive.extractall(extracted)
            release = extracted / "SpeechToText"
            manifest = json.loads((release / "build-info.json").read_text(encoding="utf-8-sig"))
            assert manifest["standard_checks"] == "passed"
            assert manifest["model_included"] is False
            executable = release / "SpeechToText.exe"
            print("PASS archive checksum, contents and build metadata")
        with executable.open("rb") as source:
            evidence["executable_sha256"] = hashlib.file_digest(source, "sha256").hexdigest()
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
            evidence["cases"].append(
                {
                    "input": name,
                    "language": result["language"],
                    "segments": result["segments"],
                    "duration": result["duration"],
                    "status": "passed",
                    "outputs_sha256": {
                        extension: hashlib.sha256(Path(path).read_bytes()).hexdigest()
                        for extension, path in result["outputs"].items()
                    },
                }
            )
            print(f"PASS packaged {name}: {result['segments']} segments, {language}")
    evidence["status"] = "passed"
    evidence["completed_at_utc"] = datetime.now(UTC).isoformat()
    if args.report:
        args.report.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Packaged release acceptance passed")


if __name__ == "__main__":
    main()
