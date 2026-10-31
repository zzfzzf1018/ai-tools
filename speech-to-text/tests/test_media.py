from fractions import Fraction
from pathlib import Path
from threading import Event

import av
import numpy as np
import pytest

from speech_to_text.media import SAMPLE_RATE, CancelledError, decode_media, iter_media_chunks


def create_audio(path: Path, *, offset: float = 0, duration: float = 1) -> None:
    with av.open(str(path), "w") as container:
        stream = container.add_stream("pcm_s16le" if path.suffix == ".wav" else "aac", rate=16000)
        stream.layout = "mono"
        samples = (np.sin(np.arange(int(duration * 16000)) * 0.1) * 16000).astype(np.int16)
        frame = av.AudioFrame.from_ndarray(samples.reshape(1, -1), format="s16", layout="mono")
        frame.sample_rate = 16000
        frame.time_base = Fraction(1, 16000)
        frame.pts = int(offset * 16000)
        for packet in stream.encode(frame):
            container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)


@pytest.mark.parametrize("extension", [".wav", ".mp4", ".mkv"])
def test_decode_formats(tmp_path: Path, extension: str) -> None:
    source = tmp_path / f"audio{extension}"
    create_audio(source)
    audio = decode_media(source)
    assert audio.dtype == np.float32
    assert 15000 <= len(audio) <= 18000
    assert np.max(np.abs(audio)) > 0.1


def test_missing_corrupt_and_wrong_track(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        decode_media(tmp_path / "missing.mp3")
    corrupt = tmp_path / "corrupt.mp4"
    corrupt.write_bytes(b"not a video")
    with pytest.raises(ValueError, match="decode"):
        decode_media(corrupt)
    source = tmp_path / "audio.wav"
    create_audio(source)
    with pytest.raises(ValueError, match="track"):
        decode_media(source, 1)


def test_cancel_before_decode(tmp_path: Path) -> None:
    source = tmp_path / "audio.wav"
    create_audio(source)
    cancel = Event()
    cancel.set()
    with pytest.raises(CancelledError):
        decode_media(source, cancel=cancel)


def test_no_audio_track(tmp_path: Path) -> None:
    source = tmp_path / "video.mp4"
    with av.open(str(source), "w") as container:
        stream = container.add_stream("mpeg4", rate=25)
        stream.width = 32
        stream.height = 32
        stream.pix_fmt = "yuv420p"
        frame = av.VideoFrame.from_ndarray(np.zeros((32, 32, 3), dtype=np.uint8), format="rgb24")
        for packet in stream.encode(frame):
            container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)
    with pytest.raises(ValueError, match="no audio"):
        decode_media(source)


def test_duration_limit(tmp_path: Path, monkeypatch) -> None:
    import speech_to_text.media as media

    source = tmp_path / "long.wav"
    create_audio(source, duration=2)
    monkeypatch.setattr(media, "MAX_AUDIO_SECONDS", 1)
    with pytest.raises(ValueError, match="limit"):
        decode_media(source)


@pytest.mark.parametrize("extension", [".wav", ".mp4", ".mkv"])
def test_chunked_decode_matches_original(tmp_path: Path, extension: str) -> None:
    source = tmp_path / f"chunks{extension}"
    create_audio(source, duration=2.3)
    original = decode_media(source)
    chunks = list(iter_media_chunks(source, chunk_seconds=0.5, overlap_seconds=0.1))
    restored = np.zeros(len(original), np.float32)
    previous_end = 0.0
    for chunk in chunks:
        assert chunk.core_start == previous_end
        assert chunk.audio.size <= round(0.7 * SAMPLE_RATE)
        left = round((chunk.core_start - chunk.start) * SAMPLE_RATE)
        count = round((chunk.core_end - chunk.core_start) * SAMPLE_RATE)
        start = round(chunk.core_start * SAMPLE_RATE)
        restored[start : start + count] = chunk.audio[left : left + count]
        previous_end = chunk.core_end
    np.testing.assert_array_equal(restored, original)
    assert previous_end == len(original) / SAMPLE_RATE


def test_chunk_mode_does_not_change_legacy_limit(tmp_path: Path, monkeypatch) -> None:
    import speech_to_text.media as media

    source = tmp_path / "long.wav"
    create_audio(source, duration=2)
    monkeypatch.setattr(media, "MAX_AUDIO_SECONDS", 1)
    with pytest.raises(ValueError, match="limit"):
        decode_media(source)
    chunks = list(iter_media_chunks(source, chunk_seconds=0.5, overlap_seconds=0.1))
    assert chunks[-1].core_end == 2


def test_chunked_sparse_timeline_over_two_hours(tmp_path: Path, monkeypatch) -> None:
    from types import SimpleNamespace

    import speech_to_text.media as media

    source = tmp_path / "sparse.wav"
    source.touch()
    frame = av.AudioFrame.from_ndarray(np.ones((1, 160), np.int16), "s16", "mono")
    frame.sample_rate = SAMPLE_RATE
    frame.time_base = Fraction(1, SAMPLE_RATE)
    frame.pts = 7201 * SAMPLE_RATE

    class Container:
        start_time = 0
        streams = SimpleNamespace(audio=[object()])

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def decode(self, stream):
            return iter([frame])

    monkeypatch.setattr(media.av, "open", lambda *args: Container())
    count = 0
    for chunk in iter_media_chunks(source):
        assert chunk.audio.nbytes <= 304 * SAMPLE_RATE * 4
        count += 1
    assert count == 25
    assert chunk.core_end == 7201.01


def test_chunk_cancel_and_invalid_parameters(tmp_path: Path) -> None:
    source = tmp_path / "chunks.wav"
    create_audio(source, duration=2)
    cancel = Event()
    chunks = iter_media_chunks(source, cancel=cancel, chunk_seconds=0.5, overlap_seconds=0.1)
    next(chunks)
    cancel.set()
    with pytest.raises(CancelledError):
        next(chunks)
    for value in [0, -1, float("nan"), float("inf")]:
        with pytest.raises(ValueError):
            next(iter_media_chunks(source, chunk_seconds=value))
