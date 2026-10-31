import math
import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Segment:
    start: float
    end: float
    text: str

    def __post_init__(self) -> None:
        if not math.isfinite(self.start) or not math.isfinite(self.end):
            raise ValueError("Subtitle timestamps must be finite")
        if self.start < 0 or self.end <= self.start:
            raise ValueError("Subtitle timestamps require 0 <= start < end")
        if not self.text.strip():
            raise ValueError("Subtitle text cannot be empty")


def timestamp(seconds: float, separator: str = ",") -> str:
    if not math.isfinite(seconds) or seconds < 0:
        raise ValueError("Timestamp must be finite and nonnegative")
    milliseconds = int(seconds * 1000 + 0.5)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, fraction = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{whole_seconds:02}{separator}{fraction:03}"


def render(segments: list[Segment]) -> dict[str, str]:
    text_lines: list[str] = []
    srt_blocks: list[str] = []
    vtt_blocks: list[str] = []
    previous_end = 0.0
    previous_end_ms = 0
    for index, segment in enumerate(segments, 1):
        if segment.start < previous_end:
            raise ValueError("Subtitle segments must be ordered and nonoverlapping")
        previous_end = segment.end
        text = " ".join(segment.text.split())
        text_lines.append(text)
        if "-->" in text:
            text = text.replace("-->", "->")
        start_ms = max(previous_end_ms, int(segment.start * 1000 + 0.5))
        end_ms = max(start_ms + 1, int(segment.end * 1000 + 0.5))
        previous_end_ms = end_ms
        start, end = start_ms / 1000, end_ms / 1000
        srt_blocks.append(f"{index}\n{timestamp(start)} --> {timestamp(end)}\n{text}\n")
        vtt_blocks.append(f"{timestamp(start, '.')} --> {timestamp(end, '.')}\n{text}\n")
    return {
        "txt": "\n".join(text_lines) + ("\n" if text_lines else ""),
        "srt": "\n".join(srt_blocks),
        "vtt": "WEBVTT\n\n" + "\n".join(vtt_blocks),
    }


def export(
    segments: list[Segment], destination: Path, stem: str, *, overwrite: bool = False
) -> dict[str, Path]:
    if not stem or Path(stem).name != stem or stem in {".", ".."}:
        raise ValueError("Output stem must be a file name")
    contents = render(segments)
    destination.mkdir(parents=True, exist_ok=True)
    paths = {extension: destination / f"{stem}.{extension}" for extension in contents}
    for path in paths.values():
        if path.is_symlink():
            raise ValueError(f"Output cannot be a symbolic link: {path}")
        if path.exists():
            if not path.is_file():
                raise IsADirectoryError(f"Output is not a regular file: {path}")
            if not overwrite:
                raise FileExistsError(f"Output already exists: {path}")
    with tempfile.TemporaryDirectory(prefix=".stt-", dir=destination) as temporary_dir:
        temporary_root = Path(temporary_dir)
        backups: dict[Path, Path] = {}
        published: list[Path] = []
        try:
            for extension, content in contents.items():
                (temporary_root / f"new.{extension}").write_text(
                    content, encoding="utf-8", newline="\n"
                )
                target = paths[extension]
                if overwrite and target.exists():
                    backup = temporary_root / f"old.{extension}"
                    shutil.copy2(target, backup)
                    backups[target] = backup
            for extension, target in paths.items():
                temporary = temporary_root / f"new.{extension}"
                if overwrite:
                    os.replace(temporary, target)
                    published.append(target)
                else:
                    with target.open("xb") as output:
                        published.append(target)
                        output.write(temporary.read_bytes())
        except BaseException:
            for target in published:
                if target in backups:
                    os.replace(backups[target], target)
                else:
                    target.unlink(missing_ok=True)
            raise
    return paths
