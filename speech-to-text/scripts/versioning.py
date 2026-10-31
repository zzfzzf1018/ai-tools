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
TAG_PREFIX = "speech-to-text-v"
SOURCE_VERSION_FILE = "src/speech_to_text/__init__.py"
ARCHIVE_PREFIX = "SpeechToText"
STABLE = re.compile(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)")
SEMVER = re.compile(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?")
SHA = re.compile(r"[0-9a-f]{40}")
SOURCE_VERSION = re.compile(r'^__version__ = "([^"\n]*)"$', re.MULTILINE)
ZERO_SHA = "0" * 40
Resolver = Callable[[Path, Mapping[str, str] | None], dict]


class VersionError(RuntimeError):
    pass


def stable_version(value: str) -> tuple[int, ...]:
    match = STABLE.fullmatch(value or "")
    if not match:
        raise VersionError(f"Release version must be stable X.Y.Z: {value!r}.")
    numbers = tuple(int(part) for part in match.groups())
    if any(number > 65535 for number in numbers):
        raise VersionError("Windows version components must not exceed 65535.")
    return numbers


def read_source_version(text: str) -> str:
    matches = SOURCE_VERSION.findall(text)
    if len(matches) != 1:
        raise VersionError(f"{SOURCE_VERSION_FILE} must define exactly one __version__.")
    stable_version(matches[0])
    return matches[0]


def source_version(root: Path) -> str:
    return read_source_version((root / SOURCE_VERSION_FILE).read_text(encoding="utf-8"))


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
    if "-" not in semver and semver != baseline:
        raise VersionError(
            f"HEAD carries tag {TAG_PREFIX}{semver} but {SOURCE_VERSION_FILE} says {baseline}."
        )
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


def validate_release(version: dict, tag: str, sha: str) -> str:
    match = re.fullmatch(re.escape(TAG_PREFIX) + r"(.*)", tag or "")
    if not match:
        raise VersionError(f"Release tag must be {TAG_PREFIX}X.Y.Z.")
    stable_version(match[1])
    if version.get("SemVer") != match[1] or version.get("Sha") != sha:
        raise VersionError(
            "Release tag, GitVersion and checked-out commit do not match: "
            f"{tag}, {version.get('SemVer')}, {version.get('Sha')}, {sha}."
        )
    if version.get("UncommittedChanges", 0) != 0:
        raise VersionError("A release requires a clean worktree.")
    return match[1]


def plan_release(current: str, previous: str | None, event: Mapping[str, str]) -> dict:
    plan = {"publish": False, "tag": ""}
    if event.get("name") != "push" or event.get("ref") != "refs/heads/main":
        return plan
    if current == previous:
        return plan
    tag = TAG_PREFIX + current
    validate_release(
        {"SemVer": current, "Sha": event["sha"], "UncommittedChanges": 0}, tag, event["sha"]
    )
    if previous is not None and stable_version(current) <= stable_version(previous):
        raise VersionError("Release version must increase; downgrades are not published.")
    return {"publish": True, "tag": tag}


def previous_source_version(root: Path, before: str) -> str | None:
    if before == ZERO_SHA:
        return None
    filename = run_git(root, ["rev-parse", "--show-prefix"]) + SOURCE_VERSION_FILE
    if not run_git(root, ["ls-tree", "--full-tree", before, "--", filename]):
        return None
    return read_source_version(run_git(root, ["show", f"{before}:{filename}"]))


def prepare_release_plan(
    root: Path, env: Mapping[str, str], resolver: Resolver = resolve_version
) -> dict:
    event = {
        "name": env.get("GITHUB_EVENT_NAME", ""),
        "ref": env.get("GITHUB_REF", ""),
        "sha": env.get("GITHUB_SHA", ""),
    }
    if event["name"] != "push" or event["ref"] != "refs/heads/main":
        return {"publish": False, "tag": ""}
    before = env.get("STT_BEFORE_SHA", "")
    if not SHA.fullmatch(before):
        raise VersionError("The push before SHA is required to compare project versions.")
    if run_git(root, ["rev-parse", "HEAD"]) != event["sha"]:
        raise VersionError("Release planning requires the pushed commit to be checked out.")
    current = source_version(root)
    plan = plan_release(current, previous_source_version(root, before), event)
    if plan["publish"]:
        if run_git(root, ["tag", "--list", plan["tag"]]):
            raise VersionError(f"Release tag {plan['tag']} already exists; use a new version.")
        run_git(
            root,
            [
                "-c",
                "user.name=github-actions[bot]",
                "-c",
                "user.email=41898282+github-actions[bot]@users.noreply.github.com",
                "-c",
                "tag.gpgsign=false",
                "tag",
                "-a",
                plan["tag"],
                "-m",
                f"Speech to Text {current}",
                event["sha"],
            ],
        )
        validate_release(resolver(root, env), plan["tag"], event["sha"])
    return plan


def file_sha256(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def prepare_assets(root: Path, version: dict, archive: Path) -> list[dict]:
    semver = str(version.get("SemVer", ""))
    if not SEMVER.fullmatch(semver) or not SHA.fullmatch(str(version.get("Sha", ""))):
        raise VersionError("Invalid release version or SHA.")
    if not archive.is_file() or not archive.stat().st_size:
        raise VersionError(f"Missing or empty release archive: {archive}")
    checksum = Path(f"{archive}.sha256")
    digest = file_sha256(archive)
    if not checksum.is_file() or checksum.read_text(encoding="ascii").split()[:1] != [digest]:
        raise VersionError("Release archive does not match its .sha256 file.")
    with zipfile.ZipFile(archive) as contents:
        if contents.testzip() is not None:
            raise VersionError("Release archive is corrupt.")
        try:
            info = json.loads(
                contents.read(f"{ARCHIVE_PREFIX}/build-info.json").decode("utf-8-sig")
            )
            embedded = json.loads(
                contents.read(f"{ARCHIVE_PREFIX}/_internal/speech_to_text/build-version.json")
            )
        except KeyError as error:
            raise VersionError(f"Release archive lacks version metadata: {error}") from error
    if (info.get("version"), info.get("commit")) != (semver, version["Sha"]) or embedded.get(
        "version"
    ) != semver:
        raise VersionError("Archive build metadata does not match the GitVersion result.")
    if info.get("standard_checks") != "passed" or info.get("version_source") != "gitversion":
        raise VersionError("Only GitVersion builds that passed standard checks can be released.")
    if version.get("UncommittedChanges", 0) != 0 or info.get("uncommitted_changes") != 0:
        raise VersionError("Release downloads must be built from a clean worktree.")
    destination = root / "release-assets"
    shutil.rmtree(destination, ignore_errors=True)
    destination.mkdir()
    filename = f"{ARCHIVE_PREFIX}-{semver}-windows-x64.zip"
    shutil.copy2(archive, destination / filename)
    if file_sha256(destination / filename) != digest:
        raise VersionError("Copied release archive changed.")
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
        "standard_checks": info.get("standard_checks"),
        "real_model_checks": info.get("real_model_checks"),
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
    commands.add_parser("plan", help="Decide whether this main push publishes a release")
    version = commands.add_parser("version", help="Calculate the build version")
    version.add_argument("--output", type=Path, help="Write build metadata JSON")
    version.add_argument(
        "--allow-fallback",
        action="store_true",
        help="Use <source version>-local when .NET, Git history or GitVersion is unavailable",
    )
    prepare = commands.add_parser("prepare", help="Collect GitHub release downloads")
    prepare.add_argument("--archive", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "plan":
            plan = prepare_release_plan(ROOT, os.environ)
            print(
                f"Version raised: publish {plan['tag']}"
                if plan["publish"]
                else "Version unchanged or not a main push: pipeline only."
            )
            write_github_output({"publish": str(plan["publish"]).lower(), "tag": plan["tag"]})
        elif args.command == "version":
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
