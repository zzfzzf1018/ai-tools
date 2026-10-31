import json
from pathlib import Path

# Release baseline; bump it to publish. Packaged builds carry the GitVersion result instead.
__version__ = "1.1.1"


def build_version() -> str:
    """Return the GitVersion SemVer embedded by packaging, or the source baseline."""
    try:
        metadata = json.loads(
            (Path(__file__).with_name("build-version.json")).read_text(encoding="utf-8")
        )
    except FileNotFoundError:
        return __version__
    return str(metadata["version"])
