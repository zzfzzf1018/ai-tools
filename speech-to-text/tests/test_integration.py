import os
from dataclasses import replace
from pathlib import Path
from threading import Event

import numpy as np
import pytest

from speech_to_text.engine import Options, Transcriber
from speech_to_text.media import CancelledError, decode_media, iter_media_chunks

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module", params=[False, True], ids=["legacy", "long-files"])
def real_transcriber(request):
    if os.environ.get("STT_INTEGRATION") != "1":
        pytest.skip("Set STT_INTEGRATION=1 to run real model acceptance tests")
    return Transcriber(
        Options(
            model=os.environ.get("STT_TEST_MODEL", "small"),
            model_dir=Path(".models"),
            offline=True,
            long_files=request.param,
        )
    )


@pytest.mark.parametrize("language", ["en", "zh"])
@pytest.mark.parametrize("extension", [".wav", ".mp3", ".mp4", ".mkv"])
def test_real_bilingual_formats(real_transcriber, tmp_path: Path, language: str, extension: str):
    source = Path(".test-media") / f"{language}{extension}"
    result = real_transcriber.transcribe(source, tmp_path)
    assert result.segments
    text = result.outputs["txt"].read_text(encoding="utf-8").lower()
    if language == "en":
        assert "speech" in text and "english" in text
    else:
        assert "\u4e2d\u6587" in text and "\u5b57\u5e55" in text
    assert result.language == language
    assert result.segments[0].start >= 1.0
    assert all(0 <= segment.start < segment.end <= result.duration for segment in result.segments)
    assert result.outputs["srt"].is_file()
    assert result.outputs["vtt"].read_text(encoding="utf-8").startswith("WEBVTT")


def test_delayed_video_audio_preserves_timeline(real_transcriber, tmp_path: Path):
    source = Path(".test-media/delayed.mp4")
    audio = decode_media(source)
    assert np.max(np.abs(audio[:44000])) < 0.01
    assert np.max(np.abs(audio[50000:])) > 0.05
    result = real_transcriber.transcribe(source, tmp_path)
    assert result.segments and result.segments[0].start >= 2.5


def test_real_silence(real_transcriber, tmp_path: Path):
    result = real_transcriber.transcribe(Path(".test-media/silence.wav"), tmp_path)
    assert not result.segments
    assert result.outputs["txt"].read_bytes() == b""


@pytest.fixture(scope="module")
def sparse_source(tmp_path_factory):
    from scripts.media_fixtures import encode_sparse_long

    if os.environ.get("STT_INTEGRATION") != "1":
        pytest.skip("Set STT_INTEGRATION=1 to run real model acceptance tests")
    source = tmp_path_factory.mktemp("long-media") / "long-en.mkv"
    encode_sparse_long(source, decode_media(Path(".test-media/en.wav")))
    return source


def test_real_speech_after_two_hours(real_transcriber, sparse_source, tmp_path: Path):
    transcriber = Transcriber(
        replace(real_transcriber.options, long_files=True),
        lambda *args, **kwargs: real_transcriber.load_model(),
    )
    result = transcriber.transcribe(sparse_source, tmp_path)
    text = result.outputs["txt"].read_text(encoding="utf-8").lower()
    assert "speech" in text and "english" in text
    assert result.duration > 7200
    assert result.segments[0].start >= 7202.5
    assert all(segment.end <= result.duration for segment in result.segments)
    with pytest.raises(ValueError, match="limit"):
        decode_media(sparse_source)


def test_sparse_decoder_memory_is_bounded(sparse_source, record_testsuite_property):
    import tracemalloc

    tracemalloc.start()
    try:
        maximum = 0
        for chunk in iter_media_chunks(sparse_source):
            maximum = max(maximum, chunk.audio.nbytes)
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
    record_testsuite_property("decoded_pcm_window_bytes", maximum)
    record_testsuite_property("python_numpy_decode_peak_bytes", peak)
    assert maximum <= 304 * 16000 * 4
    assert peak < 90 * 1024 * 1024


@pytest.mark.parametrize("language", ["en", "zh"])
def test_real_chunk_boundary_resume(real_transcriber, language, tmp_path: Path, monkeypatch):
    from scripts.media_fixtures import encode
    from speech_to_text import long_files

    monkeypatch.setattr(long_files, "CHUNK_SECONDS", 10)
    monkeypatch.setattr(long_files, "OVERLAP_SECONDS", 2)
    audio = decode_media(Path(f".test-media/{language}.wav"))
    source = tmp_path / f"repeated-{language}.wav"
    encode(source, np.tile(audio, 3))
    transcriber = Transcriber(
        replace(real_transcriber.options, long_files=True, language=language),
        lambda *args, **kwargs: real_transcriber.load_model(),
    )
    cancel = Event()

    def progress(message, fraction):
        if message == "Checkpoint saved: 10.0s":
            cancel.set()

    with pytest.raises(CancelledError):
        transcriber.transcribe(source, tmp_path / "resume", cancel=cancel, progress=progress)
    resumed = transcriber.transcribe(source, tmp_path / "resume")
    fresh = transcriber.transcribe(source, tmp_path / "fresh")
    assert resumed.segments == fresh.segments
    text = resumed.outputs["txt"].read_text(encoding="utf-8").lower()
    keyword = "speech" if language == "en" else "\u4e2d\u6587"
    assert text.count(keyword) == 3, text
    assert all(
        first.end <= second.start
        for first, second in zip(resumed.segments, resumed.segments[1:], strict=False)
    )
