import hashlib
import importlib.metadata
import importlib.util
import json
import os
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

import pytest

import speech_to_text

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("versioning", ROOT / "scripts/versioning.py")
versioning = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(versioning)
SHA_A = "a" * 40
SHA_B = "b" * 40
MAIN_PUSH = {"name": "push", "ref": "refs/heads/main", "sha": SHA_A}


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=root, check=True, capture_output=True, text=True
    ).stdout.strip()


def write_source_version(project: Path, value: str) -> None:
    package = project / "src/speech_to_text"
    package.mkdir(parents=True, exist_ok=True)
    (package / "__init__.py").write_text(f'__version__ = "{value}"\n', encoding="utf-8")


def commit_all(root: Path, message: str) -> str:
    git(root, "add", "-A")
    git(root, "commit", "-q", "-m", message)
    return git(root, "rev-parse", "HEAD")


@pytest.fixture
def monorepo(tmp_path: Path) -> tuple[Path, Path]:
    """Git root with this project in speech-to-text/ and an unrelated sibling project."""
    root = tmp_path / "\u4ed3\u5e93 repo"
    project = root / "speech-to-text"
    project.mkdir(parents=True)
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.name", "Test")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "commit.gpgsign", "false")
    git(root, "config", "tag.gpgsign", "false")
    shutil.copy2(ROOT / "GitVersion.yml", project / "GitVersion.yml")
    shutil.copytree(ROOT / ".config", project / ".config")
    write_source_version(project, "1.0.0")
    write_source_version(root / "other", "9.0.0")
    return root, project


def test_source_version_is_single_stable_baseline() -> None:
    assert versioning.source_version(ROOT) == speech_to_text.__version__
    assert importlib.metadata.version("local-speech-to-text") == speech_to_text.__version__
    assert speech_to_text.build_version() == speech_to_text.__version__


@pytest.mark.parametrize(
    "text",
    [
        "",
        '__version__ = "1.2"\n',
        '__version__ = "1.2.0-rc.1"\n',
        '__version__ = "01.2.0"\n',
        '__version__ = "1.0.0"\n__version__ = "1.0.1"\n',
        '__version__ = "70000.0.0"\n',
    ],
)
def test_source_version_rejects_invalid_baselines(text: str) -> None:
    with pytest.raises(versioning.VersionError):
        versioning.read_source_version(text)


@pytest.mark.parametrize(
    ("current", "previous", "event", "expected"),
    [
        ("1.2.0", "1.1.0", MAIN_PUSH, {"publish": True, "tag": "speech-to-text-v1.2.0"}),
        ("1.1.1", "1.1.0", MAIN_PUSH, {"publish": True, "tag": "speech-to-text-v1.1.1"}),
        ("1.0.0", None, MAIN_PUSH, {"publish": True, "tag": "speech-to-text-v1.0.0"}),
        ("1.1.0", "1.1.0", MAIN_PUSH, {"publish": False, "tag": ""}),
        ("1.2.0", "1.1.0", {**MAIN_PUSH, "name": "pull_request"}, {"publish": False, "tag": ""}),
        ("1.2.0", "1.1.0", {**MAIN_PUSH, "ref": "refs/heads/dev"}, {"publish": False, "tag": ""}),
    ],
)
def test_release_plan(current, previous, event, expected) -> None:
    assert versioning.plan_release(current, previous, event) == expected


@pytest.mark.parametrize(("current", "previous"), [("1.0.9", "1.1.0"), ("1.10.0", "1.10.0x")])
def test_release_plan_rejects_downgrade_and_invalid_history(current, previous) -> None:
    with pytest.raises(versioning.VersionError):
        versioning.plan_release(current, previous, MAIN_PUSH)


@pytest.mark.parametrize(
    ("version", "tag"),
    [
        ({"SemVer": "1.2.0", "Sha": SHA_B, "UncommittedChanges": 0}, "speech-to-text-v1.2.0"),
        ({"SemVer": "1.2.1", "Sha": SHA_A, "UncommittedChanges": 0}, "speech-to-text-v1.2.0"),
        ({"SemVer": "1.2.0", "Sha": SHA_A, "UncommittedChanges": 2}, "speech-to-text-v1.2.0"),
        ({"SemVer": "1.2.0-1", "Sha": SHA_A, "UncommittedChanges": 0}, "speech-to-text-v1.2.0-1"),
        (
            {"SemVer": "1.2.0", "Sha": SHA_A, "UncommittedChanges": 0},
            "children-typing-tutor-v1.2.0",
        ),
    ],
)
def test_release_validation_rejects_mismatches(version, tag) -> None:
    with pytest.raises(versioning.VersionError):
        versioning.validate_release(version, tag, SHA_A)


def test_build_metadata_requires_tagged_version_to_match_source() -> None:
    development = versioning.build_metadata(
        {"SemVer": "1.1.1-3", "FullSemVer": "1.1.1-3", "Sha": SHA_A, "UncommittedChanges": 1},
        "1.1.0",
    )
    assert development["version"] == "1.1.1-3"
    assert development["source"] == "gitversion"
    assert development["uncommitted_changes"] == 1
    with pytest.raises(versioning.VersionError):
        versioning.build_metadata({"SemVer": "1.1.0", "Sha": SHA_A}, "1.2.0")


def test_local_fallback_is_marked_unofficial(tmp_path: Path, monkeypatch) -> None:
    def unavailable(root: Path, env=None) -> None:
        raise versioning.VersionError("dotnet is not available")

    monkeypatch.setattr(versioning, "restore_tools", unavailable)
    with pytest.raises(versioning.VersionError):
        versioning.calculate_metadata(ROOT, allow_fallback=False)
    output = tmp_path / "build-version.json"
    assert versioning.main(["version", "--allow-fallback", "--output", str(output)]) == 0
    metadata = json.loads(output.read_text(encoding="utf-8"))
    assert metadata["version"] == f"{speech_to_text.__version__}-local"
    assert metadata["source"] == "source-fallback"
    assert metadata["commit"] is None
    assert versioning.main(["version", "--output", str(tmp_path / "strict.json")]) == 1
    assert not (tmp_path / "strict.json").exists()


def push_env(sha: str, before: str, name: str = "push") -> dict[str, str]:
    return {
        "GITHUB_EVENT_NAME": name,
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_SHA": sha,
        "STT_BEFORE_SHA": before,
    }


def fake_resolver(project: Path, env=None) -> dict:
    return {
        "SemVer": versioning.source_version(project),
        "Sha": git(project, "rev-parse", "HEAD"),
        "UncommittedChanges": 0,
    }


def test_release_plan_reads_this_project_across_whole_push(monorepo) -> None:
    root, project = monorepo
    before = commit_all(root, "initial")
    write_source_version(root / "other", "9.1.0")
    commit_all(root, "other project raised")
    plan = versioning.prepare_release_plan(
        project, push_env(git(root, "rev-parse", "HEAD"), before), fake_resolver
    )
    assert plan == {"publish": False, "tag": ""}
    write_source_version(project, "1.1.0")
    commit_all(root, "raise version")
    (project / "README.md").write_text("docs\n", encoding="utf-8")
    head = commit_all(root, "later commit in same push")
    plan = versioning.prepare_release_plan(project, push_env(head, before), fake_resolver)
    assert plan == {"publish": True, "tag": "speech-to-text-v1.1.0"}
    assert git(root, "rev-list", "-n", "1", "speech-to-text-v1.1.0") == head
    with pytest.raises(versioning.VersionError, match="already exists"):
        versioning.prepare_release_plan(project, push_env(head, before), fake_resolver)


def test_release_plan_pr_first_push_downgrade_and_wrong_checkout(monorepo) -> None:
    root, project = monorepo
    first = commit_all(root, "initial")
    assert versioning.prepare_release_plan(
        project, push_env(first, "0" * 40, "pull_request"), fake_resolver
    ) == {"publish": False, "tag": ""}
    assert versioning.prepare_release_plan(project, push_env(first, "0" * 40), fake_resolver)[
        "publish"
    ]
    git(root, "tag", "-d", "speech-to-text-v1.0.0")
    write_source_version(project, "0.9.0")
    head = commit_all(root, "downgrade")
    with pytest.raises(versioning.VersionError, match="increase"):
        versioning.prepare_release_plan(project, push_env(head, first), fake_resolver)
    with pytest.raises(versioning.VersionError, match="checked out"):
        versioning.prepare_release_plan(project, push_env(first, first), fake_resolver)
    with pytest.raises(versioning.VersionError, match="before SHA"):
        versioning.prepare_release_plan(project, push_env(head, ""), fake_resolver)
    assert not git(root, "tag", "--list", "speech-to-text-v0.9.0")


def make_archive(tmp_path: Path, info: dict, embedded: dict | None) -> Path:
    dist = tmp_path / "dist"
    dist.mkdir(exist_ok=True)
    archive = dist / "SpeechToText-windows-x64.zip"
    with zipfile.ZipFile(archive, "w") as contents:
        contents.writestr("SpeechToText/SpeechToText.exe", b"exe")
        contents.writestr(
            "SpeechToText/build-info.json", "\ufeff" + json.dumps(info), zipfile.ZIP_DEFLATED
        )
        if embedded is not None:
            contents.writestr(
                "SpeechToText/_internal/speech_to_text/build-version.json", json.dumps(embedded)
            )
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    Path(f"{archive}.sha256").write_text(f"{digest}  {archive.name}\n", encoding="ascii")
    return archive


GOOD_INFO = {
    "version": "1.2.0",
    "commit": SHA_A,
    "version_source": "gitversion",
    "uncommitted_changes": 0,
    "standard_checks": "passed",
    "real_model_checks": "not_run",
}
RELEASE = {"SemVer": "1.2.0", "FullSemVer": "1.2.0", "Sha": SHA_A}


def test_prepare_assets_writes_versioned_download_and_checksums(tmp_path: Path) -> None:
    archive = make_archive(tmp_path, GOOD_INFO, {"version": "1.2.0"})
    assets = versioning.prepare_assets(tmp_path, RELEASE, archive)
    target = tmp_path / "release-assets"
    assert sorted(path.name for path in target.iterdir()) == [
        "SHA256SUMS.txt",
        "SpeechToText-1.2.0-windows-x64.zip",
        "release.json",
    ]
    digest = hashlib.sha256((target / "SpeechToText-1.2.0-windows-x64.zip").read_bytes())
    assert assets[0]["sha256"] == digest.hexdigest()
    sums = (target / "SHA256SUMS.txt").read_bytes()
    assert sums == f"{digest.hexdigest()}  SpeechToText-1.2.0-windows-x64.zip\n".encode()
    release = json.loads((target / "release.json").read_text(encoding="utf-8"))
    assert release["commit"] == SHA_A
    assert release["real_model_checks"] == "not_run"


@pytest.mark.parametrize(
    "problem",
    ["version", "commit", "fallback", "tests", "dirty", "embedded", "missing_embedded", "checksum"],
)
def test_prepare_assets_rejects_unverified_archives(tmp_path: Path, problem: str) -> None:
    info = dict(GOOD_INFO)
    embedded: dict | None = {"version": "1.2.0"}
    if problem == "version":
        info["version"] = "1.2.0-local"
    elif problem == "dirty":
        info["uncommitted_changes"] = 3
    elif problem == "commit":
        info["commit"] = SHA_B
    elif problem == "fallback":
        info["version_source"] = "source-fallback"
    elif problem == "tests":
        info["standard_checks"] = "failed"
    elif problem == "embedded":
        embedded = {"version": "1.1.9"}
    elif problem == "missing_embedded":
        embedded = None
    archive = make_archive(tmp_path, info, embedded)
    if problem == "checksum":
        with archive.open("ab") as handle:
            handle.write(b"tampered")
    with pytest.raises(versioning.VersionError):
        versioning.prepare_assets(tmp_path, RELEASE, archive)
    assert not (tmp_path / "release-assets").exists()


def test_workflow_routes_only_this_project_and_isolates_write_permission() -> None:
    path = ROOT.parent / ".github/workflows/speech-to-text-release.yml"
    if not (ROOT.parent / ".git").exists():
        return  # Project copied out of the ai-tools repository; the workflow lives at its root.
    workflow = path.read_text(encoding="utf-8")
    assert workflow.count('- "speech-to-text/**"') == 2
    assert "pull_request_target" not in workflow
    assert not re.search(r"^\s+tags:", workflow, re.MULTILINE)
    assert workflow.count("contents: write") == 1
    assert workflow.index("contents: write") > workflow.index("  publish:")
    assert "needs.verify.outputs.publish == 'true'" in workflow
    assert "-RequireGitVersion" in workflow and "fetch-depth: 0" in workflow
    for line in workflow.splitlines():
        if "uses: actions/" in line:
            assert len(line.rsplit("@", 1)[1]) == 40, line
    assert "persist-credentials: false" in workflow


def require_gitversion() -> None:
    if os.environ.get("STT_GITVERSION") != "1":
        pytest.skip("Set STT_GITVERSION=1 to run the real GitVersion regression")


@pytest.mark.gitversion
def test_real_gitversion_tags_development_builds_and_isolation(monorepo) -> None:
    require_gitversion()
    root, project = monorepo
    versioning.restore_tools(project)
    tagged = commit_all(root, "initial")
    git(root, "tag", "-a", "speech-to-text-v1.0.0", "-m", "release")
    git(root, "tag", "-a", "children-typing-tutor-v9.0.0", "-m", "other project")
    version = versioning.resolve_version(project)
    assert (version["SemVer"], version["Sha"]) == ("1.0.0", tagged)
    assert versioning.validate_release(version, "speech-to-text-v1.0.0", tagged) == "1.0.0"
    write_source_version(root / "other", "9.0.1")
    head = commit_all(root, "other project change")
    git(root, "tag", "-a", "other-v9.0.1", "-m", "other project")
    version = versioning.resolve_version(project)
    assert (version["SemVer"], version["Sha"]) == ("1.0.1-1", head)
    assert versioning.build_metadata(version, "1.0.0")["version"] == "1.0.1-1"
    (project / "dirty.txt").write_text("uncommitted\n", encoding="utf-8")
    assert versioning.resolve_version(project)["UncommittedChanges"] > 0
    (project / "dirty.txt").unlink()
    git(root, "checkout", "-q", "--detach", "speech-to-text-v1.0.0")
    assert versioning.resolve_version(project)["SemVer"] == "1.0.0"


@pytest.mark.gitversion
def test_real_gitversion_release_plan_in_github_environment(monorepo) -> None:
    require_gitversion()
    root, project = monorepo
    versioning.restore_tools(project)
    before = commit_all(root, "initial")
    git(root, "tag", "-a", "speech-to-text-v1.0.0", "-m", "release")
    write_source_version(project, "1.1.0")
    head = commit_all(root, "raise version")
    env = {**os.environ, **push_env(head, before), "GITHUB_ACTIONS": "true"}
    plan = versioning.prepare_release_plan(project, env)
    assert plan == {"publish": True, "tag": "speech-to-text-v1.1.0"}
    version = versioning.resolve_version(project, env)
    assert versioning.build_metadata(version, "1.1.0")["version"] == "1.1.0"
