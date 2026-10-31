import json
import os
import subprocess
import sys
from pathlib import Path
from threading import Event
from types import SimpleNamespace

import numpy as np
import pytest
from test_engine import FakeModel
from test_media import create_audio

from speech_to_text import long_files
from speech_to_text.engine import Options, Transcriber
from speech_to_text.media import AudioChunk, CancelledError


@pytest.fixture
def task(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(long_files, "CHUNK_SECONDS", 1)
    monkeypatch.setattr(long_files, "OVERLAP_SECONDS", 0.1)
    source = tmp_path / "long.wav"
    create_audio(source, duration=3.4)
    output = tmp_path / "output"
    options = Options(model="tiny", long_files=True)
    return source, output, options


def interrupt(task):
    source, output, options = task
    cancel = Event()

    def progress(message, fraction):
        if message == "Checkpoint saved: 1.0s":
            cancel.set()

    with pytest.raises(CancelledError):
        Transcriber(options, FakeModel).transcribe(source, output, cancel=cancel, progress=progress)
    return next((output / ".stt-resume").glob("*.json"))


def test_resume_equals_uninterrupted(task, tmp_path: Path):
    interrupt(task)
    source, output, options = task
    resumed = Transcriber(options, FakeModel).transcribe(source, output)
    fresh = Transcriber(options, FakeModel).transcribe(source, tmp_path / "fresh")
    assert resumed.segments == fresh.segments
    assert resumed.duration == fresh.duration == 3.4
    for extension in resumed.outputs:
        assert resumed.outputs[extension].read_bytes() == fresh.outputs[extension].read_bytes()


@pytest.mark.parametrize("kind", ["media", "settings", "json", "order", "duration"])
def test_invalid_checkpoint_never_publishes(task, kind):
    checkpoint = interrupt(task)
    source, output, options = task
    if kind == "media":
        stat = source.stat()
        contents = bytearray(source.read_bytes())
        contents[-1] ^= 1
        source.write_bytes(contents)
        os.utime(source, ns=(stat.st_atime_ns, stat.st_mtime_ns))
    elif kind == "settings":
        options = Options(model="base", long_files=True)
    elif kind == "json":
        checkpoint.write_text("{broken", encoding="utf-8")
    else:
        state = json.loads(checkpoint.read_text(encoding="utf-8"))
        if kind == "order":
            state["segments"] *= 2
        else:
            state["end"] = -1
        checkpoint.write_text(json.dumps(state), encoding="utf-8")
    with pytest.raises(ValueError, match="Cannot resume"):
        Transcriber(options, FakeModel).transcribe(source, output)
    assert checkpoint.exists()
    assert not list(output.glob("*.txt"))


def test_export_failure_retains_complete_checkpoint(task, monkeypatch):
    source, output, options = task
    original_export = long_files.export

    def fail(*args, **kwargs):
        raise OSError("disk full")

    monkeypatch.setattr(long_files, "export", fail)
    with pytest.raises(OSError, match="disk full"):
        Transcriber(options, FakeModel).transcribe(source, output)
    checkpoint = next((output / ".stt-resume").glob("*.json"))
    assert json.loads(checkpoint.read_text(encoding="utf-8"))["complete"] is True
    monkeypatch.setattr(long_files, "export", original_export)

    def forbidden(*args, **kwargs):
        raise AssertionError("Completed checkpoint must not rerun inference")

    result = Transcriber(options, forbidden).transcribe(source, output)
    assert result.segments
    assert not checkpoint.exists()


def test_cancel_mid_chunk_repeats_only_that_chunk(task):
    source, output, options = task
    cancel = Event()
    calls = []

    class Model(FakeModel):
        def transcribe(self, audio, **kwargs):
            calls.append(1)

            def segments():
                yield SimpleNamespace(start=0.2, end=0.8, text="first")
                cancel.set()
                yield SimpleNamespace(start=0.8, end=0.9, text="second")

            return segments(), SimpleNamespace(language="zh")

    with pytest.raises(CancelledError):
        Transcriber(options, Model).transcribe(source, output, cancel=cancel)
    checkpoint = next((output / ".stt-resume").glob("*.json"))
    assert json.loads(checkpoint.read_text(encoding="utf-8"))["completed_chunks"] == 0
    resumed = Transcriber(options, FakeModel)
    resumed.transcribe(source, output)
    assert resumed._model.calls == 4


def test_atomic_checkpoint_failure_preserves_old(task, monkeypatch):
    checkpoint = interrupt(task)
    old = checkpoint.read_bytes()

    def fail(*args):
        raise OSError("replace failed")

    monkeypatch.setattr(long_files.os, "replace", fail)
    with pytest.raises(OSError, match="replace failed"):
        long_files.save_checkpoint(checkpoint, {"new": "state"})
    assert checkpoint.read_bytes() == old
    assert not list(checkpoint.parent.glob(".pending-*"))


def test_lock_blocks_concurrent_task_and_releases(task):
    source, output, options = task
    checkpoint = interrupt(task)
    with long_files.checkpoint_lock(checkpoint.with_suffix(".lock")):
        with pytest.raises(ValueError, match="already running"):
            Transcriber(options, FakeModel).transcribe(source, output)
    assert Transcriber(options, FakeModel).transcribe(source, output).segments


def test_process_crash_releases_lock_and_resumes(task):
    source, output, options = task
    code = """
import os, sys
from pathlib import Path
from types import SimpleNamespace
from speech_to_text import long_files
from speech_to_text.engine import Options, Transcriber
long_files.CHUNK_SECONDS = 1
long_files.OVERLAP_SECONDS = 0.1
class Model:
    def __init__(self, *args, **kwargs): pass
    def transcribe(self, audio, **kwargs):
        raw = SimpleNamespace(start=0.2, end=0.8, text='saved')
        return iter([raw]), SimpleNamespace(language='zh')
def progress(message, fraction):
    if message == 'Checkpoint saved: 1.0s': os._exit(9)
Transcriber(Options(model='tiny', long_files=True), Model).transcribe(
    Path(sys.argv[1]), Path(sys.argv[2]), progress=progress)
"""
    environment = {**os.environ, "PYTHONPATH": str(Path(__file__).resolve().parents[1] / "src")}
    process = subprocess.run(
        [sys.executable, "-c", code, str(source), str(output)],
        env=environment,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert process.returncode == 9, process.stderr
    resumed = Transcriber(options, FakeModel)
    result = resumed.transcribe(source, output)
    assert resumed._model.calls == 3
    assert result.segments[0].text == "saved"


def test_word_ownership_avoids_overlap_duplicates():
    first = AudioChunk(0, 0, 1, np.zeros(17600, np.float32))
    second = AudioChunk(0.9, 1, 2, np.zeros(17600, np.float32))
    words = [
        SimpleNamespace(start=0.8, end=0.96, word=" first"),
        SimpleNamespace(start=0.97, end=1.09, word=" second"),
    ]
    raw = SimpleNamespace(start=0.8, end=1.09, text="first second", words=words)
    before = long_files.owned_segments(raw, first, 0)
    shifted = SimpleNamespace(
        start=-0.1,
        end=0.19,
        text=raw.text,
        words=[
            SimpleNamespace(start=word.start - 0.9, end=word.end - 0.9, word=word.word)
            for word in words
        ],
    )
    after = long_files.owned_segments(shifted, second, before[-1].end)
    assert [segment.text for segment in before + after] == ["first", "second"]
    assert after[0].start == 1


def test_long_silence_and_overwrite_protection(task):
    import wave

    source, output, options = task
    with wave.open(str(source), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(16000)
        handle.writeframes(b"\0\0" * 54400)

    def forbidden(*args, **kwargs):
        raise AssertionError("Silence must not load model")

    result = Transcriber(options, forbidden).transcribe(source, output)
    assert result.language == "unknown"
    assert not result.segments
    assert result.outputs["txt"].read_bytes() == b""
    with pytest.raises(FileExistsError):
        Transcriber(options, forbidden).transcribe(source, output)
    assert not list((output / ".stt-resume").glob("*.json"))


@pytest.mark.parametrize("overwrite", [False, True])
def test_interrupted_publication_resumes_without_inference(task, monkeypatch, overwrite):
    source, output, _ = task
    options = Options(model="tiny", long_files=True, overwrite=overwrite)
    output.mkdir()
    if overwrite:
        for extension in ("txt", "srt", "vtt"):
            (output / f"long.{extension}").write_text(f"old {extension}")
    operation = "replace" if overwrite else "rename" if os.name == "nt" else "link"
    original = getattr(long_files.os, operation)

    def crash_after_txt(first, second):
        original(first, second)
        if Path(second) == output / "long.txt":
            raise KeyboardInterrupt("simulated process exit during publication")

    monkeypatch.setattr(long_files.os, operation, crash_after_txt)
    with pytest.raises(KeyboardInterrupt):
        Transcriber(options, FakeModel).transcribe(source, output)
    checkpoint = next((output / ".stt-resume").glob("*.json"))
    assert json.loads(checkpoint.read_text(encoding="utf-8"))["publication"]
    monkeypatch.setattr(long_files.os, operation, original)

    def forbidden(*args, **kwargs):
        raise AssertionError("Publication resume must not rerun inference")

    result = Transcriber(options, forbidden).transcribe(source, output)
    assert result.outputs["srt"].read_text().count(" --> ") == len(result.segments)
    assert not checkpoint.exists()
    assert not list((output / ".stt-resume").glob("*.export"))


def test_publication_does_not_take_over_modified_output(task, monkeypatch):
    source, output, options = task
    original = long_files.os.rename if os.name == "nt" else long_files.os.link
    operation = "rename" if os.name == "nt" else "link"

    def crash(first, second):
        original(first, second)
        if Path(second) == output / "long.txt":
            raise KeyboardInterrupt()

    monkeypatch.setattr(long_files.os, operation, crash)
    with pytest.raises(KeyboardInterrupt):
        Transcriber(options, FakeModel).transcribe(source, output)
    monkeypatch.setattr(long_files.os, operation, original)
    protected = output / "long.txt"
    protected.write_text("user changed this output")
    with pytest.raises(FileExistsError, match="outside this task"):
        Transcriber(options, FakeModel).transcribe(source, output)
    assert protected.read_text() == "user changed this output"
