from collections.abc import Callable
from pathlib import Path
from threading import Event

import av
import numpy as np

SAMPLE_RATE = 16000
MAX_AUDIO_SECONDS = 7200
SUPPORTED_EXTENSIONS = {".mp3", ".mp4", ".mkv", ".wav", ".m4a", ".flac", ".ogg", ".webm"}


class CancelledError(Exception):
    pass


def check_cancelled(cancel: Event | None) -> None:
    if cancel is not None and cancel.is_set():
        raise CancelledError("Transcription cancelled")


def decode_media(
    source: Path,
    audio_track: int = 0,
    cancel: Event | None = None,
    progress: Callable[[str, float | None], None] | None = None,
) -> np.ndarray:
    if not source.is_file():
        raise FileNotFoundError(f"Input file not found: {source}")
    if source.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file extension: {source.suffix}")
    check_cancelled(cancel)
    chunks: list[tuple[int, np.ndarray]] = []
    cursor = 0
    decoded_samples = 0
    try:
        with av.open(str(source)) as container:
            if not container.streams.audio:
                raise ValueError("Input contains no audio track")
            if audio_track < 0 or audio_track >= len(container.streams.audio):
                raise ValueError(f"Audio track {audio_track} does not exist")
            stream = container.streams.audio[audio_track]
            origin = (container.start_time or 0) / av.time_base
            if container.duration and container.duration / av.time_base > MAX_AUDIO_SECONDS:
                raise ValueError(f"Input exceeds the {MAX_AUDIO_SECONDS // 3600}-hour limit")
            resampler = av.AudioResampler(format="fltp", layout="mono", rate=SAMPLE_RATE)

            def append(frame: av.AudioFrame) -> None:
                nonlocal cursor, decoded_samples
                check_cancelled(cancel)
                samples = frame.to_ndarray().reshape(-1).astype(np.float32)
                decoded_samples += samples.size
                if decoded_samples > MAX_AUDIO_SECONDS * SAMPLE_RATE:
                    raise ValueError("Decoded sample count exceeds the duration limit")
                start = (
                    round((float(frame.time) - origin) * SAMPLE_RATE)
                    if frame.time is not None
                    else cursor
                )
                if start < 0:
                    samples = samples[-start:]
                    start = 0
                if start + samples.size > MAX_AUDIO_SECONDS * SAMPLE_RATE:
                    raise ValueError("Decoded audio exceeds the duration limit")
                if samples.size:
                    chunks.append((start, samples))
                    cursor = max(cursor, start + samples.size)

            for frame in container.decode(stream):
                check_cancelled(cancel)
                for converted in resampler.resample(frame):
                    append(converted)
            for converted in resampler.resample(None):
                append(converted)
    except av.error.FFmpegError as error:
        raise ValueError(f"Unable to decode media: {error}") from error
    if not chunks or cursor == 0:
        raise ValueError("Input contains no decodable audio samples")
    audio = np.zeros(cursor, dtype=np.float32)
    for start, samples in chunks:
        check_cancelled(cancel)
        audio[start : start + samples.size] = samples
    if progress:
        progress("Decoded audio", 0.0)
    return audio
