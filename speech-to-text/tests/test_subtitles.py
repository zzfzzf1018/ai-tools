from pathlib import Path

import pytest

from speech_to_text.subtitles import Segment, export, render, timestamp


@pytest.mark.parametrize(
    ("seconds", "expected"),
    [(0, "00:00:00,000"), (59.9996, "00:01:00,000"), (3661.125, "01:01:01,125")],
)
def test_timestamp(seconds: float, expected: str) -> None:
    assert timestamp(seconds) == expected


@pytest.mark.parametrize("seconds", [-1, float("inf"), float("nan")])
def test_invalid_timestamp(seconds: float) -> None:
    with pytest.raises(ValueError):
        timestamp(seconds)


def test_render() -> None:
    contents = render([Segment(1.25, 2.5, "\u4f60\u597d world"), Segment(4, 5, "Next line")])
    assert contents["txt"] == "\u4f60\u597d world\nNext line\n"
    assert "1\n00:00:01,250 --> 00:00:02,500" in contents["srt"]
    assert contents["vtt"].startswith("WEBVTT\n\n00:00:01.250 --> 00:00:02.500")


def test_overlap_rejected() -> None:
    with pytest.raises(ValueError, match="nonoverlapping"):
        render([Segment(0, 2, "one"), Segment(1, 3, "two")])


def test_short_segment_remains_visible() -> None:
    assert "00:00:00,000 --> 00:00:00,001" in render([Segment(0, 0.0001, "a")])["srt"]


def test_export_utf8_and_no_overwrite(tmp_path: Path) -> None:
    paths = export([Segment(0, 1, "\u4e2d\u6587")], tmp_path, "sample")
    assert paths["txt"].read_text(encoding="utf-8") == "\u4e2d\u6587\n"
    with pytest.raises(FileExistsError):
        export([], tmp_path, "sample")
    assert paths["txt"].read_text(encoding="utf-8") == "\u4e2d\u6587\n"
    export([], tmp_path, "sample", overwrite=True)
    assert paths["txt"].read_bytes() == b""


def test_partial_collision_does_not_create_other_files(tmp_path: Path) -> None:
    (tmp_path / "sample.srt").write_text("original")
    with pytest.raises(FileExistsError):
        export([], tmp_path, "sample")
    assert not (tmp_path / "sample.txt").exists()


@pytest.mark.parametrize("stem", ["", "..", "../escape"])
def test_invalid_output_name(tmp_path: Path, stem: str) -> None:
    with pytest.raises(ValueError):
        export([], tmp_path, stem)


def test_adjacent_short_segments_do_not_overlap_after_rounding() -> None:
    contents = render([Segment(0, 0.0001, "one"), Segment(0.0001, 0.0002, "two")])
    assert "00:00:00,000 --> 00:00:00,001" in contents["srt"]
    assert "00:00:00,001 --> 00:00:00,002" in contents["srt"]


def test_plain_text_preserves_arrow() -> None:
    assert render([Segment(0, 1, "a --> b")])["txt"] == "a --> b\n"


def test_overwrite_failure_restores_original_set(tmp_path: Path, monkeypatch) -> None:
    import os

    originals = {extension: f"original-{extension}" for extension in ("txt", "srt", "vtt")}
    for extension, content in originals.items():
        (tmp_path / f"sample.{extension}").write_text(content)
    original_replace = os.replace

    def fail_second_publish(source, target):
        if Path(source).name == "new.srt":
            raise OSError("simulated disk failure")
        return original_replace(source, target)

    monkeypatch.setattr(os, "replace", fail_second_publish)
    with pytest.raises(OSError, match="disk failure"):
        export([Segment(0, 1, "new")], tmp_path, "sample", overwrite=True)
    for extension, content in originals.items():
        assert (tmp_path / f"sample.{extension}").read_text() == content
    assert sorted(path.name for path in tmp_path.iterdir()) == [
        "sample.srt",
        "sample.txt",
        "sample.vtt",
    ]


def test_directory_target_is_rejected_before_publication(tmp_path: Path) -> None:
    (tmp_path / "sample.srt").mkdir()
    with pytest.raises(IsADirectoryError):
        export([], tmp_path, "sample", overwrite=True)
    assert not (tmp_path / "sample.txt").exists()
