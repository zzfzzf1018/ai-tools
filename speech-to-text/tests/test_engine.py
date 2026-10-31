from pathlib import Path
from threading import Event
from types import SimpleNamespace

import pytest
from test_media import create_audio

from speech_to_text.engine import Options, Transcriber, normalize_segments
from speech_to_text.media import CancelledError


class FakeModel:
    def __init__(self, *args, **kwargs) -> None:
        self.calls = 0

    def transcribe(self, audio, **kwargs):
        assert kwargs["task"] == "transcribe"
        assert kwargs["word_timestamps"] is True
        self.calls += 1
        return iter(
            [SimpleNamespace(start=0.2, end=0.8, text="\u4f60\u597d Hello")]
        ), SimpleNamespace(language="zh")


def test_transcribe_exports_and_reuses_model(tmp_path: Path) -> None:
    source = tmp_path / "audio.wav"
    create_audio(source)
    transcriber = Transcriber(Options(model="tiny"), FakeModel)
    result = transcriber.transcribe(source, tmp_path / "output")
    assert result.language == "zh"
    assert result.outputs["txt"].read_text(encoding="utf-8") == "\u4f60\u597d Hello\n"
    assert "00:00:00,200 --> 00:00:00,800" in result.outputs["srt"].read_text()
    second = transcriber.transcribe(source, tmp_path / "second")
    assert second.segments == result.segments
    assert transcriber._model.calls == 2


def test_normalize_clamps_overlap_and_duration() -> None:
    raw = [
        SimpleNamespace(start=-1, end=1, text="one"),
        SimpleNamespace(start=0.5, end=3, text="two"),
        SimpleNamespace(start=4, end=5, text="outside"),
    ]
    segments = normalize_segments(raw, 2)
    assert [(segment.start, segment.end) for segment in segments] == [(0, 1), (1, 2)]


def test_cancel_does_not_publish(tmp_path: Path) -> None:
    source = tmp_path / "audio.wav"
    create_audio(source)
    cancel = Event()

    def progress(message, fraction):
        if message == "\u4f60\u597d Hello":
            cancel.set()

    with pytest.raises(CancelledError):
        Transcriber(Options(model="tiny"), FakeModel).transcribe(
            source, tmp_path / "output", cancel=cancel, progress=progress
        )
    assert not (tmp_path / "output").exists()


def test_digital_silence_does_not_load_model(tmp_path: Path) -> None:
    import wave

    source = tmp_path / "silent.wav"
    with wave.open(str(source), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(16000)
        output.writeframes(b"\x00\x00" * 16000)

    def forbidden_model(*args, **kwargs):
        raise AssertionError("Silent audio must not run inference")

    result = Transcriber(Options(), forbidden_model).transcribe(source, tmp_path / "out")
    assert result.language == "unknown"
    assert not result.segments
    assert result.outputs["txt"].read_bytes() == b""


@pytest.mark.parametrize(
    "kwargs",
    [
        {"language": "fr"},
        {"audio_track": -1},
        {"compute_type": "float16"},
        {"model": "tiny.en"},
        {"device": "invalid"},
    ],
)
def test_invalid_options(kwargs) -> None:
    with pytest.raises(ValueError):
        Options(**kwargs)
