import base64
import hashlib
import os
import shutil
import subprocess
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pytest

pytestmark = pytest.mark.skipif(os.name != "nt", reason="Windows packaging entry points")
ROOT = Path(__file__).resolve().parent.parent


@pytest.mark.parametrize("exit_code", [0, 7])
def test_double_click_entry_preserves_status_and_working_directory(
    tmp_path: Path, exit_code: int
) -> None:
    project = tmp_path / "\u4e2d\u6587 folder"
    project.mkdir()
    shutil.copy2(ROOT / "build.cmd", project / "build.cmd")
    (project / "build.ps1").write_text(
        f"[Console]::WriteLine((Get-Location).Path); exit {exit_code}", encoding="utf-8"
    )
    completed = subprocess.run(
        ["cmd.exe", "/d", "/c", "call", str(project / "build.cmd")],
        cwd=tmp_path,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
        env={**os.environ, "STT_BUILD_NO_PAUSE": "1"},
    )
    assert completed.returncode == exit_code, completed.stdout + completed.stderr
    assert str(project) in completed.stdout
    assert ("successfully" if exit_code == 0 else "failed") in completed.stdout


def ps_literal(value: Path) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def run_helper(script: str) -> subprocess.CompletedProcess[str]:
    preamble = (
        "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); "
        "$ErrorActionPreference='Stop'; "
        f". {ps_literal(ROOT / 'scripts/packaging.ps1')}; "
    )
    encoded = base64.b64encode((preamble + script).encode("utf-16-le")).decode("ascii")
    return subprocess.run(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
    )


def test_helper_detects_real_interpreter_and_rejects_missing_path(tmp_path: Path) -> None:
    completed = run_helper(
        f"if (-not (Test-BuildPython {ps_literal(Path(sys.executable))})) "
        "{ throw 'probe failed' }; "
        f"try {{ Get-BuildPython -RequestedPath {ps_literal(tmp_path / 'missing.exe')}; "
        "exit 8 } catch { Write-Host 'missing path rejected' }"
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert "missing path rejected" in completed.stdout


def test_native_command_failure_is_not_swallowed() -> None:
    completed = run_helper(
        "try { Invoke-Checked -Executable cmd.exe -Arguments @('/d', '/c', 'exit 7'); "
        "exit 8 } catch { Write-Host 'native failure detected' }"
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert "native failure detected" in completed.stdout


def test_missing_build_command_is_not_accepted(tmp_path: Path) -> None:
    completed = run_helper(
        "$global:LASTEXITCODE=0; "
        f"try {{ Invoke-Checked -Executable {ps_literal(tmp_path / 'missing.exe')} "
        "-Arguments @(); exit 8 } catch { Write-Host 'missing command rejected' }"
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert "missing command rejected" in completed.stdout


def test_concurrent_build_lock(tmp_path: Path) -> None:
    lock = ps_literal(tmp_path / "build.lock")
    completed = run_helper(
        f"$First=Enter-BuildLock {lock}; try {{ try {{ $Second=Enter-BuildLock {lock}; "
        "$Second.Dispose(); exit 8 } catch { Write-Host 'second build rejected' } "
        "} finally { $First.Dispose() }"
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert "second build rejected" in completed.stdout


def prepare_release(tmp_path: Path) -> Path:
    source = tmp_path / "\u4e2d\u6587 folder" / "SpeechToText"
    (source / "docs/images").mkdir(parents=True)
    (source / "_internal").mkdir()
    for relative in [
        "SpeechToText.exe",
        "README.md",
        "help.cmd",
        "build-info.json",
        "docs/user-guide.html",
        "docs/release-review.md",
        "docs/images/application.png",
        "_internal/runtime.dll",
    ]:
        (source / relative).write_bytes(b"test fixture")
    return source


def test_archive_structure_checksum_and_repeated_build(tmp_path: Path) -> None:
    source = prepare_release(tmp_path)
    archive = tmp_path / "release.zip"
    for iteration in (1, 2):
        (source / "README.md").write_text(f"revision {iteration}")
        completed = run_helper(
            f"New-ReleaseArchive -SourceDirectory {ps_literal(source)} "
            f"-ArchivePath {ps_literal(archive)}"
        )
        assert completed.returncode == 0, completed.stdout + completed.stderr
        with zipfile.ZipFile(archive) as contents:
            assert contents.read("SpeechToText/README.md") == f"revision {iteration}".encode()
            assert "SpeechToText/docs/user-guide.html" in contents.namelist()
            assert "SpeechToText/_internal/runtime.dll" in contents.namelist()
        assert archive.with_suffix(".zip.sha256").is_file()
        actual_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
        assert archive.with_suffix(".zip.sha256").read_text().startswith(actual_hash + "  ")
        assert not list(tmp_path.glob(".stt-*.zip"))


def test_compression_failure_preserves_previous_zip(tmp_path: Path) -> None:
    source = prepare_release(tmp_path)
    archive = tmp_path / "release.zip"
    archive.write_bytes(b"previous verified release")
    completed = run_helper(
        "function Compress-Archive { param($LiteralPath, $DestinationPath, [switch]$Force); "
        "Set-Content -LiteralPath $DestinationPath -Value 'partial'; throw 'simulated failure' }; "
        f"try {{ New-ReleaseArchive -SourceDirectory {ps_literal(source)} "
        f"-ArchivePath {ps_literal(archive)}; exit 8 }} "
        "catch { Write-Host 'compression failure detected' }"
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert "compression failure detected" in completed.stdout
    assert archive.read_bytes() == b"previous verified release"
    assert not list(tmp_path.glob(".stt-*.zip"))


def test_powershell_scripts_keep_utf8_bom_for_chinese_messages() -> None:
    for script in (ROOT / "build.ps1", ROOT / "scripts/packaging.ps1"):
        assert script.read_bytes().startswith(b"\xef\xbb\xbf")


def test_missing_manual_prevents_release_replacement(tmp_path: Path) -> None:
    source = prepare_release(tmp_path)
    (source / "docs/user-guide.html").unlink()
    archive = tmp_path / "release.zip"
    archive.write_bytes(b"previous release")
    completed = run_helper(
        f"try {{ New-ReleaseArchive -SourceDirectory {ps_literal(source)} "
        f"-ArchivePath {ps_literal(archive)}; exit 8 }} "
        "catch { Write-Host 'missing manual rejected' }"
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert "missing manual rejected" in completed.stdout
    assert archive.read_bytes() == b"previous release"


class ManualParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.identifiers: set[str] = set()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if identity := attributes.get("id"):
            self.identifiers.add(identity)
        for attribute in ("href", "src"):
            if value := attributes.get(attribute):
                self.links.append(value)


def test_offline_manual_resources_and_navigation() -> None:
    manual = ROOT / "docs/user-guide.html"
    parser = ManualParser()
    parser.feed(manual.read_text(encoding="utf-8"))
    assert {"choose", "prepare", "build", "use", "share", "troubleshoot"} <= parser.identifiers
    for link in parser.links:
        target = urlsplit(link)
        if target.scheme:
            assert target.scheme == "https"
        elif target.path:
            assert (manual.parent / unquote(target.path)).is_file(), link
        elif target.fragment:
            assert target.fragment in parser.identifiers
    assert (ROOT / "docs/images/application.png").read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    assert "docs\\user-guide.html" in (ROOT / "help.cmd").read_text()


@pytest.fixture(scope="module")
def evidence_functions():
    import runpy

    return runpy.run_path(str(ROOT / "scripts/release_evidence.py"))


@pytest.mark.parametrize("marker", ["", "<failure/>", "<error/>", "<skipped/>"])
def test_acceptance_junit_rejects_incomplete_gates(tmp_path: Path, evidence_functions, marker):
    report = tmp_path / "tests.xml"
    report.write_text(
        f"<testsuites><testsuite><testcase>{marker}</testcase></testsuite></testsuites>"
    )
    result = evidence_functions["junit_summary"](report)
    assert result["status"] == ("passed" if not marker else "failed")


def test_source_manifest_detects_changes_and_ignores_bytecode(tmp_path: Path, evidence_functions):
    (tmp_path / "src").mkdir()
    source = tmp_path / "src/sample.py"
    source.write_text("value = 1\n")
    first = evidence_functions["source_manifest"](tmp_path)
    (tmp_path / "src/__pycache__").mkdir()
    (tmp_path / "src/__pycache__/sample.pyc").write_bytes(b"generated")
    assert evidence_functions["source_manifest"](tmp_path) == first
    source.write_text("value = 2\n")
    assert evidence_functions["source_manifest"](tmp_path)["sha256"] != first["sha256"]


def test_source_manifest_does_not_read_local_secrets(tmp_path: Path, evidence_functions):
    (tmp_path / "README.md").write_text("public")
    first = evidence_functions["source_manifest"](tmp_path)
    (tmp_path / ".env").write_text("private configuration")
    assert evidence_functions["source_manifest"](tmp_path) == first


def test_empty_junit_cannot_pass(tmp_path: Path, evidence_functions):
    report = tmp_path / "empty.xml"
    report.write_text("<testsuites><testsuite/></testsuites>")
    assert evidence_functions["junit_summary"](report)["status"] == "failed"


def test_clean_machine_runner_rejects_this_python_machine(tmp_path: Path):
    completed = subprocess.run(
        [
            "powershell.exe",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(ROOT / "scripts/clean_windows.ps1"),
            "-ResultDirectory",
            str(tmp_path),
        ],
        capture_output=True,
        timeout=30,
    )
    assert completed.returncode == 2
    import json

    receipt = json.loads((tmp_path / "clean-windows-result.json").read_text(encoding="utf-8-sig"))
    assert receipt["python_detected"] is True
    assert receipt["clean_windows_verified"] is False
    assert receipt["status"] == "blocked"


@pytest.mark.parametrize("mismatch", ["none", "source", "executable"])
def test_evidence_never_seals_unverified_external_gates(
    tmp_path: Path, evidence_functions, mismatch
):
    import json

    artifacts = tmp_path / ".artifacts"
    artifacts.mkdir()
    (tmp_path / "src").mkdir()
    source = tmp_path / "src/sample.py"
    source.write_text("value = 1\n")
    snapshot = artifacts / "source.json"
    snapshot.write_text(json.dumps(evidence_functions["source_manifest"](tmp_path)))
    standard = artifacts / "standard.xml"
    integration = artifacts / "integration.xml"
    for report in (standard, integration):
        report.write_text("<testsuites><testsuite><testcase/></testsuite></testsuites>")
    executable = artifacts / "app.exe"
    executable.write_bytes(b"accepted executable")
    packaged = artifacts / "packaged.json"
    packaged.write_text(
        json.dumps(
            {
                "status": "passed",
                "cases": [{"status": "passed"} for _ in range(5)],
                "executable_sha256": hashlib.sha256(executable.read_bytes()).hexdigest(),
            }
        )
    )
    if mismatch == "source":
        source.write_text("value = 2\n")
    elif mismatch == "executable":
        executable.write_bytes(b"different executable")
    evidence = evidence_functions["collect_evidence"](
        tmp_path, snapshot, standard, integration, packaged, executable
    )
    assert evidence["engineering_status"] == ("passed" if mismatch == "none" else "failed")
    assert evidence["formal_release_status"] == "pending"
    assert evidence["clean_windows"]["status"] == "pending"
    assert evidence["business_media"]["status"] == "pending"
