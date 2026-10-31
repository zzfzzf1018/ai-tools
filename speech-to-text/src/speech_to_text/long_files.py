import hashlib
import json
import math
import os
import shutil
import tempfile
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import asdict
from pathlib import Path
from threading import Event
from typing import TYPE_CHECKING, Any

import numpy as np

from speech_to_text.media import AudioChunk, check_cancelled, iter_media_chunks
from speech_to_text.subtitles import Segment, export

if TYPE_CHECKING:
    from speech_to_text.engine import Progress, Result, Transcriber

CHUNK_SECONDS = 300
OVERLAP_SECONDS = 2
CHECKPOINT_VERSION = 1


@contextmanager
def checkpoint_lock(path: Path) -> Generator[None]:
    with path.open("a+b") as handle:
        handle.seek(0, os.SEEK_END)
        if handle.tell() == 0:
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        try:
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            raise ValueError("This long-file task is already running") from error
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def file_identity(source: Path, cancel: Event | None) -> dict[str, Any]:
    before = source.stat()
    digest = hashlib.sha256()
    with source.open("rb") as handle:
        while block := handle.read(1024 * 1024):
            check_cancelled(cancel)
            digest.update(block)
    after = source.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise ValueError("Input changed while preparing the long-file task")
    return {
        "path": str(source),
        "size": after.st_size,
        "mtime_ns": after.st_mtime_ns,
        "sha256": digest.hexdigest(),
    }


def save_checkpoint(path: Path, state: dict[str, Any]) -> None:
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, prefix=".pending-", delete=False
        ) as handle:
            temporary = Path(handle.name)
            json.dump(state, handle, ensure_ascii=False, allow_nan=False)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def load_checkpoint(
    path: Path, identity: dict[str, Any], settings: dict[str, Any]
) -> tuple[dict[str, Any], list[Segment]]:
    initial = {
        "version": CHECKPOINT_VERSION,
        "source": identity,
        "settings": settings,
        "completed_chunks": 0,
        "end": 0.0,
        "complete": False,
        "language": "unknown" if settings["language"] == "auto" else settings["language"],
        "segments": [],
    }
    if not path.exists():
        return initial, []
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
        if (
            state["version"] != CHECKPOINT_VERSION
            or state["source"] != identity
            or state["settings"] != settings
        ):
            raise ValueError("Checkpoint media or settings do not match")
        count, end = state["completed_chunks"], state["end"]
        if type(count) is not int or count < 0:
            raise ValueError("Invalid completed chunk count")
        if type(end) not in (int, float) or not math.isfinite(end) or end < 0:
            raise ValueError("Invalid checkpoint duration")
        if type(state["complete"]) is not bool:
            raise ValueError("Invalid checkpoint completion state")
        if not isinstance(state["language"], str) or not state["language"]:
            raise ValueError("Invalid checkpoint language")
        if count == 0 and end != 0:
            raise ValueError("Invalid empty checkpoint")
        if state["complete"] and count == 0:
            raise ValueError("Completed checkpoint must contain decoded chunks")
        if count and not (count - 1) * CHUNK_SECONDS < end <= count * CHUNK_SECONDS:
            raise ValueError("Invalid checkpoint chunk boundary")
        segments = [Segment(**item) for item in state["segments"]]
        previous_end = 0.0
        for segment in segments:
            if segment.start < previous_end or segment.end > end:
                raise ValueError("Invalid checkpoint segment order")
            previous_end = segment.end
        return state, segments
    except (KeyError, TypeError, ValueError, AttributeError) as error:
        raise ValueError(
            f"Cannot resume checkpoint: {path}. Restore the original media/settings or "
            "delete this checkpoint to restart. " + str(error)
        ) from error


def owned_segments(raw: Any, chunk: AudioChunk, previous_end: float) -> list[Segment]:
    if not math.isfinite(raw.start) or not math.isfinite(raw.end):
        raise ValueError("Model returned nonfinite timestamps")
    words = getattr(raw, "words", None)
    if words:
        selected = []
        for word in words:
            if not math.isfinite(word.start) or not math.isfinite(word.end):
                raise ValueError("Model returned nonfinite word timestamps")
            midpoint = chunk.start + (word.start + word.end) / 2
            if chunk.core_start <= midpoint < chunk.core_end:
                selected.append(word)
        if not selected:
            return []
        start = chunk.start + selected[0].start
        end = chunk.start + selected[-1].end
        text = "".join(word.word for word in selected).strip()
    else:
        midpoint = chunk.start + (raw.start + raw.end) / 2
        if not chunk.core_start <= midpoint < chunk.core_end:
            return []
        start, end, text = chunk.start + raw.start, chunk.start + raw.end, raw.text.strip()
    start = max(previous_end, chunk.core_start, start)
    end = min(chunk.core_end, end)
    return [Segment(start, end, text)] if text and end > start else []


def output_hash(path: Path) -> str | None:
    if path.is_symlink():
        raise ValueError(f"Output cannot be a symbolic link: {path}")
    if not path.exists():
        return None
    if not path.is_file():
        raise IsADirectoryError(f"Output is not a regular file: {path}")
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def publish_outputs(
    checkpoint: Path,
    state: dict[str, Any],
    segments: list[Segment],
    destination: Path,
    stem: str,
    overwrite: bool,
) -> dict[str, Path]:
    staging = checkpoint.with_suffix(".export")
    targets = {
        extension: destination / f"{stem}.{extension}" for extension in ("txt", "srt", "vtt")
    }
    plan = state.get("publication")
    if plan is None and not overwrite:
        for target in targets.values():
            if output_hash(target) is not None:
                raise FileExistsError(f"Output already exists: {target}")
    staged = export(segments, staging, stem, overwrite=True)
    new_hashes = {extension: output_hash(path) for extension, path in staged.items()}
    if plan is None:
        plan = {}
        for extension, target in targets.items():
            original = output_hash(target)
            if original is not None:
                backup = staging / f"{extension}.old"
                shutil.copy2(target, backup)
                with backup.open("r+b") as handle:
                    os.fsync(handle.fileno())
                if output_hash(backup) != original:
                    raise ValueError("Output changed while backing up")
            plan[extension] = {"original": original, "new": new_hashes[extension]}
        state["publication"] = plan
        save_checkpoint(checkpoint, state)
    if not isinstance(plan, dict) or set(plan) != set(targets):
        raise ValueError("Invalid checkpoint publication plan")
    for extension, target in targets.items():
        entry = plan[extension]
        if not isinstance(entry, dict) or entry.get("new") != new_hashes[extension]:
            raise ValueError("Checkpoint publication does not match generated subtitles")
        original = entry.get("original")
        if original is not None:
            if not overwrite:
                raise FileExistsError("Resuming this publication requires --overwrite")
            if output_hash(staging / f"{extension}.old") != original:
                raise ValueError("Checkpoint output backup is missing or damaged")
        current = output_hash(target)
        if current not in (original, entry["new"]):
            raise FileExistsError(f"Output changed outside this task: {target}")
    published: list[str] = []
    try:
        for extension, target in targets.items():
            if output_hash(target) == plan[extension]["new"]:
                continue
            with staged[extension].open("r+b") as handle:
                os.fsync(handle.fileno())
            if overwrite:
                os.replace(staged[extension], target)
            elif os.name == "nt":
                os.rename(staged[extension], target)
            else:
                os.link(staged[extension], target)
                staged[extension].unlink()
            published.append(extension)
    except Exception:
        for extension in published:
            target = targets[extension]
            if output_hash(target) != plan[extension]["new"]:
                continue
            if plan[extension]["original"] is None:
                target.unlink(missing_ok=True)
            else:
                shutil.copy2(staging / f"{extension}.old", target)
        raise
    return targets


def transcribe_resumable(
    transcriber: "Transcriber",
    source: Path,
    destination: Path,
    cancel: Event | None,
    progress: "Progress | None",
) -> "Result":
    from speech_to_text.engine import Result

    options = transcriber.options
    destination.mkdir(parents=True, exist_ok=True)
    cache = destination / ".stt-resume"
    cache.mkdir(exist_ok=True)
    key = hashlib.sha256(str(source).encode("utf-8")).hexdigest()
    checkpoint = cache / f"{key}.json"
    settings = {
        "model": str(Path(options.model).resolve())
        if Path(options.model).is_dir()
        else options.model,
        "model_dir": str(options.model_dir.resolve()) if options.model_dir else None,
        "language": options.language,
        "device": options.device,
        "compute_type": options.compute_type,
        "audio_track": options.audio_track,
        "chunk_seconds": CHUNK_SECONDS,
        "overlap_seconds": OVERLAP_SECONDS,
    }
    with checkpoint_lock(cache / f"{key}.lock"):
        if not checkpoint.exists() and not options.overwrite:
            for extension in ("txt", "srt", "vtt"):
                target = destination / f"{source.stem}.{extension}"
                if output_hash(target) is not None:
                    raise FileExistsError(f"Output already exists: {target}")
        if progress:
            progress("Checking long-file media and checkpoint", None)
        identity = file_identity(source, cancel)
        state, segments = load_checkpoint(checkpoint, identity, settings)
        if not state.get("publication") and not options.overwrite:
            for extension in ("txt", "srt", "vtt"):
                target = destination / f"{source.stem}.{extension}"
                if output_hash(target) is not None:
                    raise FileExistsError(f"Output already exists: {target}")
        check_cancelled(cancel)
        if not checkpoint.exists():
            save_checkpoint(checkpoint, state)
        if not state["complete"]:
            if progress:
                progress(f"Resuming after {state['end']:.1f}s; scanning media", None)
            seen = 0
            chunks = iter_media_chunks(
                source,
                options.audio_track,
                cancel,
                chunk_seconds=CHUNK_SECONDS,
                overlap_seconds=OVERLAP_SECONDS,
            )
            try:
                for index, chunk in enumerate(chunks):
                    seen = index + 1
                    if index < state["completed_chunks"]:
                        if seen == state["completed_chunks"] and chunk.core_end != state["end"]:
                            raise ValueError("Checkpoint does not match decoded media timeline")
                        continue
                    check_cancelled(cancel)
                    added: list[Segment] = []
                    if np.any(chunk.audio):
                        model = transcriber.load_model(progress, cancel)
                        raw_segments, info = model.transcribe(
                            chunk.audio,
                            language=None if state["language"] == "unknown" else state["language"],
                            task="transcribe",
                            beam_size=5,
                            vad_filter=False,
                            word_timestamps=True,
                            condition_on_previous_text=False,
                        )
                        language = info.language
                        for raw in raw_segments:
                            check_cancelled(cancel)
                            previous_end = (
                                added[-1].end if added else segments[-1].end if segments else 0
                            )
                            added.extend(owned_segments(raw, chunk, previous_end))
                            if progress:
                                progress(raw.text.strip(), None)
                    else:
                        language = state["language"]
                    check_cancelled(cancel)
                    next_state = {
                        **state,
                        "completed_chunks": seen,
                        "end": chunk.core_end,
                        "language": language,
                        "segments": state["segments"] + [asdict(segment) for segment in added],
                    }
                    save_checkpoint(checkpoint, next_state)
                    state = next_state
                    segments.extend(added)
                    if progress:
                        progress(f"Checkpoint saved: {chunk.core_end:.1f}s", None)
            finally:
                chunks.close()
            if seen < state["completed_chunks"]:
                raise ValueError("Checkpoint exceeds decoded media timeline")
            check_cancelled(cancel)
            state["complete"] = True
            save_checkpoint(checkpoint, state)
        check_cancelled(cancel)
        current = source.stat()
        if (current.st_size, current.st_mtime_ns) != (identity["size"], identity["mtime_ns"]):
            raise ValueError("Input changed during transcription; checkpoint retained, no export")
        paths = publish_outputs(
            checkpoint,
            state,
            segments,
            destination,
            source.stem,
            options.overwrite,
        )
        try:
            checkpoint.unlink(missing_ok=True)
        except OSError:
            if progress:
                progress(f"Outputs saved; checkpoint cleanup deferred: {checkpoint}", None)
        else:
            shutil.rmtree(checkpoint.with_suffix(".export"), ignore_errors=True)
        if progress:
            progress("Complete" if segments else "Complete: no speech detected", 1.0)
        return Result(source, state["language"], state["end"], segments, paths)
