from fractions import Fraction
from pathlib import Path
from threading import Event

import av
import numpy as np
import pytest

from speech_to_text.media import CancelledError, decode_media


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
