"""Tests for scripts/versioning.py release tooling."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("versioning", ROOT / "scripts" / "versioning.py")
versioning = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(versioning)

CHANGELOG_SAMPLE = """# 更新日志

## [1.4.4] - 2026-11-03

### 修复

- 弹窗开关点不动

## [1.4.3] - 2026-11-03

修复若干 BUG。

## [1.4.41] - 2026-11-03

防止前缀误匹配的占位版本。
"""


def write_changelog(root: Path, text: str = CHANGELOG_SAMPLE, newline: str = "\n") -> None:
    path = root / versioning.CHANGELOG_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.replace("\n", newline), encoding="utf-8", newline="")


class ChangelogNotesTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def notes(self, semver: str) -> str:
        return versioning.changelog_notes(self.root, semver)

    def test_extracts_middle_section_until_next_heading(self):
        write_changelog(self.root)
        self.assertEqual(self.notes("1.4.3"), "修复若干 BUG。")

    def test_extracts_first_section_to_end_of_block(self):
        write_changelog(self.root)
        self.assertEqual(self.notes("1.4.4"), "### 修复\n\n- 弹窗开关点不动")

    def test_exact_version_match_not_prefix(self):
        write_changelog(self.root)
        self.assertNotIn("占位", self.notes("1.4.4"))
        self.assertEqual(self.notes("1.4.41"), "防止前缀误匹配的占位版本。")

    def test_crlf_line_endings(self):
        write_changelog(self.root, newline="\r\n")
        self.assertEqual(self.notes("1.4.3"), "修复若干 BUG。")

    def test_missing_version_raises(self):
        write_changelog(self.root)
        with self.assertRaises(versioning.VersionError):
            self.notes("9.9.9")

    def test_missing_file_raises(self):
        with self.assertRaises(versioning.VersionError):
            self.notes("1.4.4")

    def test_empty_section_raises(self):
        write_changelog(self.root, "# 更新日志\n\n## [2.0.0] - 2026-11-03\n\n## [1.0.0] - 2026-11-03\n\n有内容。\n")
        with self.assertRaises(versioning.VersionError):
            self.notes("2.0.0")


class RepositoryChangelogTests(unittest.TestCase):
    """Guard: the version being shipped must always have its changes recorded."""

    def test_manifest_version_has_changelog_entry(self):
        manifest = json.loads((ROOT / versioning.MANIFEST_PATH).read_text(encoding="utf-8-sig"))
        notes = versioning.changelog_notes(ROOT, manifest["version"])
        self.assertTrue(notes.strip())


if __name__ == "__main__":
    unittest.main()
