import os
from pathlib import Path

import numpy as np
import pytest

from speech_to_text.engine import Options, Transcriber
from speech_to_text.media import decode_media

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def real_transcriber():
    if os.environ.get("STT_INTEGRATION") != "1":
        pytest.skip("Set STT_INTEGRATION=1 to run real model acceptance tests")
    return Transcriber(
        Options(
            model=os.environ.get("STT_TEST_MODEL", "small"), model_dir=Path(".models"), offline=True
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
