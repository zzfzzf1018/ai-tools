import argparse
import hashlib
import json
import subprocess
import xml.etree.ElementTree as ET
import zipfile
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_PACKAGED_CASES = {
    (name, long_mode)
    for long_mode in (False, True)
    for name in ("en.mp3", "zh.mp4", "zh.mkv", "delayed.mp4", "silence.wav")
} | {("long-en.mkv", True)}


def file_hash(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def source_manifest(root: Path) -> dict:
    files = set()
    for name in ("src", "scripts", "tests", "docs", ".github", ".config"):
        directory = root / name
        if directory.exists():
            files.update(path for path in directory.rglob("*") if path.is_file())
    files.update(
        path
        for path in root.iterdir()
        if path.is_file()
        and (
            path.suffix in {".cmd", ".ps1", ".spec"}
            or path.name
            in {
                "README.md",
                "pyproject.toml",
                "requirements-lock.txt",
                ".gitignore",
                "GitVersion.yml",
            }
        )
    )
    entries = {
        path.relative_to(root).as_posix(): file_hash(path)
        for path in sorted(files)
        if not any(part == "__pycache__" or part.endswith(".egg-info") for part in path.parts)
    }
    encoded = json.dumps(entries, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return {"sha256": hashlib.sha256(encoded).hexdigest(), "files": entries}


def junit_summary(path: Path) -> dict:
    root = ET.parse(path).getroot()
    cases = list(root.iter("testcase"))
    failures = sum(case.find("failure") is not None for case in cases)
    errors = sum(case.find("error") is not None for case in cases)
    skipped = sum(case.find("skipped") is not None for case in cases)
    return {
        "tests": len(cases),
        "failures": failures,
        "errors": errors,
        "skipped": skipped,
        "status": "passed" if cases and failures == errors == skipped == 0 else "failed",
        "report_sha256": file_hash(path),
    }


def git_state(root: Path) -> dict:
    try:
        revision = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        ).stdout.strip()
        changes = subprocess.run(
            ["git", "-C", str(root), "status", "--porcelain", "--", "."],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        ).stdout.strip()
        return {"commit": revision, "dirty": bool(changes)}
    except (OSError, subprocess.SubprocessError):
        return {"commit": None, "dirty": True}


def collect_evidence(
    root: Path,
    snapshot: Path,
    standard: Path,
    integration: Path,
    packaged: Path,
    executable: Path,
) -> dict:
    source = json.loads(snapshot.read_text(encoding="utf-8"))
    unchanged = source == source_manifest(root)
    packaged_report = json.loads(packaged.read_text(encoding="utf-8"))
    packaged_passed = (
        packaged_report.get("status") == "passed"
        and len(packaged_report.get("cases", [])) == len(EXPECTED_PACKAGED_CASES)
        and {
            (case.get("input"), case.get("long_files")) for case in packaged_report.get("cases", [])
        }
        == EXPECTED_PACKAGED_CASES
        and all(case.get("status") == "passed" for case in packaged_report["cases"])
        and packaged_report.get("executable_sha256") == file_hash(executable)
    )
    standard_result = junit_summary(standard)
    integration_result = junit_summary(integration)
    local_passed = (
        unchanged
        and packaged_passed
        and all(result["status"] == "passed" for result in (standard_result, integration_result))
    )
    publication = git_state(root)
    return {
        "schema_version": 1,
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "engineering_status": "passed" if local_passed else "failed",
        "formal_release_status": "pending",
        "source_sha256": source["sha256"],
        "source_unchanged_during_validation": unchanged,
        "source_publication": {**publication, "status": "pending"},
        "standard_tests": standard_result,
        "integration_tests": integration_result,
        "packaged_tests": {
            "status": "passed" if packaged_passed else "failed",
            "tests": len(packaged_report.get("cases", [])),
            "report_sha256": file_hash(packaged),
            "executable_sha256": packaged_report.get("executable_sha256"),
        },
        "clean_windows": {"status": "pending", "reason": "No independent machine receipt"},
        "business_media": {"status": "pending", "reason": "No representative business corpus"},
        "fixture_kind": "synthetic_tts",
    }


def verify_archive(archive: Path, evidence: Path) -> dict:
    expected = Path(str(archive) + ".sha256").read_text().split()[0]
    if file_hash(archive) != expected:
        raise ValueError("Archive SHA-256 mismatch")
    recorded = json.loads(evidence.read_text(encoding="utf-8"))
    if recorded["engineering_status"] != "passed":
        raise ValueError("Engineering acceptance did not pass")
    with zipfile.ZipFile(archive) as contents:
        if contents.testzip() is not None:
            raise ValueError("Archive CRC verification failed")
        executable_hash = hashlib.sha256(contents.read("SpeechToText/SpeechToText.exe")).hexdigest()
        if executable_hash != recorded["packaged_tests"]["executable_sha256"]:
            raise ValueError("Archive executable differs from accepted executable")
        bundled = json.loads(contents.read("SpeechToText/validation/release-evidence.json"))
        if bundled != recorded:
            raise ValueError("Bundled acceptance evidence differs from recorded evidence")
    return {
        "status": "passed",
        "archive_sha256": expected,
        "source_sha256": recorded["source_sha256"],
        "engineering_status": recorded["engineering_status"],
        "formal_release_status": recorded["formal_release_status"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evidence-bound engineering acceptance")
    commands = parser.add_subparsers(dest="command", required=True)
    snapshot = commands.add_parser("snapshot")
    snapshot.add_argument("--output", type=Path, required=True)
    collect = commands.add_parser("collect")
    collect.add_argument("--output", type=Path, required=True)
    archive = commands.add_parser("verify-archive")
    archive.add_argument("--archive", type=Path, required=True)
    archive.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "snapshot":
        result = source_manifest(ROOT)
    elif args.command == "collect":
        result = collect_evidence(
            ROOT,
            ROOT / ".artifacts/source-manifest.json",
            ROOT / ".artifacts/standard-tests.xml",
            ROOT / ".artifacts/integration-tests.xml",
            ROOT / ".artifacts/packaged-acceptance.json",
            ROOT / "dist/SpeechToText/SpeechToText.exe",
        )
    else:
        result = verify_archive(args.archive, ROOT / ".artifacts/release-evidence.json")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    if result.get("engineering_status") == "failed":
        raise SystemExit("Engineering evidence verification failed")
    print(json.dumps({key: value for key, value in result.items() if key != "files"}, indent=2))


if __name__ == "__main__":
    main()
