"""GitVersion calculation, release planning and GitHub release asset preparation."""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from collections.abc import Callable, Mapping
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAG_PREFIX = "web-blocker-v"
MANIFEST_PATH = "outputs/web-blocker/manifest.json"
PLUGIN_DIR = "outputs/web-blocker"
ARCHIVE_PREFIX = "web-blocker"
STABLE = re.compile(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)")
SEMVER = re.compile(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?")
SHA = re.compile(r"[0-9a-f]{40}")
MANIFEST_VERSION = re.compile(r'("version"\s*:\s*")[^"]*(")')
Resolver = Callable[[Path, Mapping[str, str] | None], dict]


class VersionError(RuntimeError):
    pass


def stable_version(value: str) -> tuple[int, ...]:
    match = STABLE.fullmatch(value or "")
    if not match:
        raise VersionError(f"Release version must be stable X.Y.Z: {value!r}.")
    numbers = tuple(int(part) for part in match.groups())
    if any(number > 65535 for number in numbers):
        raise VersionError("Version components must not exceed 65535.")
    return numbers


def source_version(root: Path) -> str:
    manifest_file = root / MANIFEST_PATH
    if not manifest_file.is_file():
        raise VersionError(f"Manifest not found: {manifest_file}")
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    version = str(manifest.get("version", "")).strip()
    if not version:
        raise VersionError(f"{MANIFEST_PATH} has no version field.")
    stable_version(version)
    return version


def tool_environment(env: Mapping[str, str] | None) -> dict[str, str]:
    return {
        **(os.environ if env is None else env),
        "DOTNET_NOLOGO": "1",
        "DOTNET_CLI_TELEMETRY_OPTOUT": "1",
        "DOTNET_SKIP_FIRST_TIME_EXPERIENCE": "1",
    }


def run(command: list[str], root: Path, env: Mapping[str, str] | None = None) -> str:
    try:
        completed = subprocess.run(
            command,
            cwd=root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=tool_environment(env),
        )
    except OSError as error:
        raise VersionError(f"{command[0]} is not available: {error}") from error
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip()
        raise VersionError(f"{' '.join(command[:4])} failed: {detail}")
    return completed.stdout.strip()


def run_git(root: Path, args: list[str], env: Mapping[str, str] | None = None) -> str:
    return run(["git", *args], root, env)


def restore_tools(root: Path, env: Mapping[str, str] | None = None) -> None:
    run(["dotnet", "tool", "restore"], root, env)


def resolve_version(root: Path, env: Mapping[str, str] | None = None) -> dict:
    head = run_git(root, ["rev-parse", "HEAD"], env)
    output = run(
        [
            "dotnet",
            "tool",
            "run",
            "dotnet-gitversion",
            "--",
            "/output",
            "json",
            "/config",
            str(root / "GitVersion.yml"),
            "/c",
            head,
            "/nofetch",
            "/nonormalize",
            "/nocache",
            "/verbosity",
            "quiet",
        ],
        root,
        env,
    )
    try:
        version = json.loads(output.lstrip("\ufeff"))
    except json.JSONDecodeError as error:
        raise VersionError(f"GitVersion did not return JSON: {output[:200]}") from error
    if not SEMVER.fullmatch(str(version.get("SemVer", ""))) or not SHA.fullmatch(
        str(version.get("Sha", ""))
    ):
        raise VersionError("GitVersion returned an invalid SemVer or commit SHA.")
    if version["Sha"] != head:
        raise VersionError(f"GitVersion selected {version['Sha']} instead of HEAD {head}.")
    return version


def build_metadata(version: dict, baseline: str) -> dict:
    semver = version["SemVer"]
    return {
        "version": semver,
        "full_version": version.get("FullSemVer", semver),
        "commit": version["Sha"],
        "source": "gitversion",
        "source_version": baseline,
        "uncommitted_changes": int(version.get("UncommittedChanges", 0)),
    }


def fallback_metadata(baseline: str, reason: str) -> dict:
    return {
        "version": f"{baseline}-local",
        "full_version": f"{baseline}-local",
        "commit": None,
        "source": "source-fallback",
        "source_version": baseline,
        "uncommitted_changes": None,
        "fallback_reason": reason,
    }


def calculate_metadata(
    root: Path, allow_fallback: bool, resolver: Resolver = resolve_version
) -> dict:
    baseline = source_version(root)
    try:
        restore_tools(root)
        version = resolver(root, None)
    except VersionError as error:
        if not allow_fallback:
            raise
        return fallback_metadata(baseline, str(error))
    return build_metadata(version, baseline)


def tag_version(tag_name: str) -> str:
    match = re.fullmatch(re.escape(TAG_PREFIX) + r"(.*)", tag_name or "")
    if not match:
        raise VersionError(f"Release tag must be {TAG_PREFIX}X.Y.Z: {tag_name!r}.")
    stable_version(match[1])
    return match[1]


def verify_tag(version: dict, tag_name: str, sha: str | None) -> str:
    expected = tag_version(tag_name)
    if str(version.get("SemVer", "")) != expected:
        raise VersionError(
            f"GitVersion computed {version.get('SemVer')} but tag {tag_name} says {expected}."
        )
    if sha and str(version.get("Sha", "")) != sha:
        raise VersionError(
            f"Tag {tag_name} targets {sha}, but GitVersion resolved {version.get('Sha')}."
        )
    if int(version.get("UncommittedChanges", 0)) != 0:
        raise VersionError("A release requires a clean worktree.")
    return expected


def write_manifest_version(root: Path, semver: str) -> None:
    path = root / MANIFEST_PATH
    updated, replaced = MANIFEST_VERSION.subn(rf'\g<1>{semver}\g<2>', path.read_text("utf-8"), 1)
    if replaced != 1:
        raise VersionError(f"{MANIFEST_PATH} must define exactly one version field.")
    pending = path.with_name(path.name + ".tmp")
    pending.write_text(updated, encoding="utf-8")
    os.replace(pending, path)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def prepare_assets(root: Path, version: dict, archive: Path) -> list[dict]:
    semver = str(version.get("SemVer", ""))
    if not SEMVER.fullmatch(semver) or not SHA.fullmatch(str(version.get("Sha", ""))):
        raise VersionError("Invalid release version or SHA.")
    if not archive.is_file() or not archive.stat().st_size:
        raise VersionError(f"Missing or empty release archive: {archive}")
    with zipfile.ZipFile(archive) as contents:
        if contents.testzip() is not None:
            raise VersionError("Release archive is corrupt.")
        try:
            manifest = json.loads(
                contents.read(f"{ARCHIVE_PREFIX}/manifest.json").decode("utf-8-sig")
            )
        except KeyError as error:
            raise VersionError(f"Release archive lacks manifest.json: {error}") from error
    if str(manifest.get("version", "")) != semver:
        raise VersionError(
            f"Packaged manifest version {manifest.get('version')} does not match {semver}."
        )
    destination = root / "release-assets"
    shutil.rmtree(destination, ignore_errors=True)
    destination.mkdir()
    filename = f"{ARCHIVE_PREFIX}-{semver}.zip"
    shutil.copy2(archive, destination / filename)
    digest = file_sha256(destination / filename)
    assets = [{"filename": filename, "bytes": archive.stat().st_size, "sha256": digest}]
    (destination / "SHA256SUMS.txt").write_text(
        "".join(f"{asset['sha256']}  {asset['filename']}\n" for asset in assets),
        encoding="ascii",
        newline="\n",
    )
    release = {
        "version": semver,
        "full_version": version.get("FullSemVer", semver),
        "commit": version["Sha"],
        "assets": assets,
    }
    (destination / "release.json").write_text(
        json.dumps(release, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    return assets


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pending = path.with_name(path.name + ".tmp")
    pending.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    os.replace(pending, path)


def write_github_output(values: dict[str, str]) -> None:
    if target := os.environ.get("GITHUB_OUTPUT"):
        with open(target, "a", encoding="utf-8") as output:
            output.writelines(f"{key}={value}\n" for key, value in values.items())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    version_cmd = commands.add_parser("version", help="Calculate the build version")
    version_cmd.add_argument("--output", type=Path, help="Write build metadata JSON")
    version_cmd.add_argument(
        "--allow-fallback",
        action="store_true",
        help="Use <source version>-local when .NET, Git history or GitVersion is unavailable",
    )
    apply_cmd = commands.add_parser(
        "apply", help="Write the GitVersion version into the extension manifest"
    )
    apply_cmd.add_argument("--tag", help="Release tag that must match the computed version")
    prepare = commands.add_parser("prepare", help="Collect GitHub release downloads")
    prepare.add_argument("--archive", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "version":
            metadata = calculate_metadata(ROOT, args.allow_fallback)
            if metadata["source"] != "gitversion":
                print(
                    "WARNING: GitVersion unavailable, using unofficial version "
                    f"{metadata['version']}: {metadata['fallback_reason']}",
                    file=sys.stderr,
                )
            print(f"Build version: {metadata['version']} ({metadata['source']})")
            if args.output:
                write_json(args.output, metadata)
            write_github_output({"version": metadata["version"]})
        elif args.command == "apply":
            restore_tools(ROOT)
            version = resolve_version(ROOT)
            if args.tag:
                verify_tag(version, args.tag, os.environ.get("GITHUB_SHA"))
            stable_version(version["SemVer"])
            write_manifest_version(ROOT, version["SemVer"])
            print(f"Manifest version set to {version['SemVer']}")
            write_github_output({"version": version["SemVer"]})
        else:
            restore_tools(ROOT)
            version = resolve_version(ROOT)
            expected = os.environ.get("RELEASE_VERSION")
            if expected is not None and expected != version["SemVer"]:
                raise VersionError("Build version changed before preparing release assets.")
            for asset in prepare_assets(ROOT, version, args.archive.resolve()):
                print(f"{asset['sha256']}  {asset['filename']}")
    except (VersionError, OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
