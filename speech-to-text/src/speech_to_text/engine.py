import math
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from threading import Event
from typing import Any

import numpy as np

from speech_to_text.media import SAMPLE_RATE, check_cancelled, decode_media
from speech_to_text.subtitles import Segment, export

MODELS = ("tiny", "base", "small", "medium", "large-v3", "large-v3-turbo")
Progress = Callable[[str, float | None], None]


@dataclass(frozen=True)
class Options:
    model: str = "small"
    language: str = "auto"
    device: str = "cpu"
    compute_type: str = "int8"
    model_dir: Path | None = None
    offline: bool = False
    audio_track: int = 0
    overwrite: bool = False

    def __post_init__(self) -> None:
        if self.language not in {"auto", "zh", "en"}:
            raise ValueError("Language must be auto, zh or en")
        if self.device not in {"cpu", "cuda"}:
            raise ValueError("Device must be cpu or cuda")
        if self.compute_type not in {"int8", "float16", "float32"}:
            raise ValueError("Unsupported compute type")
        if self.device == "cpu" and self.compute_type == "float16":
            raise ValueError("float16 requires CUDA; use int8 on CPU")
        if self.audio_track < 0:
            raise ValueError("Audio track must be nonnegative")
        if self.model not in MODELS and not Path(self.model).is_dir():
            raise ValueError("Model must be a multilingual model name or a local model directory")


@dataclass(frozen=True)
class Result:
    source: Path
    language: str
    duration: float
    segments: list[Segment]
    outputs: dict[str, Path]


def normalize_segments(raw_segments: Any, duration: float) -> list[Segment]:
    segments: list[Segment] = []
    previous_end = 0.0
    for raw in raw_segments:
        if not math.isfinite(raw.start) or not math.isfinite(raw.end):
            raise ValueError("Model returned nonfinite timestamps")
        text = raw.text.strip()
        start = max(previous_end, 0.0, float(raw.start))
        end = min(duration, float(raw.end))
        if text and end > start:
            segments.append(Segment(start, end, text))
            previous_end = end
    return segments


class Transcriber:
    def __init__(self, options: Options, model_factory: Callable[..., Any] | None = None) -> None:
        self.options = options
        self._factory = model_factory
        self._model: Any = None

    def load_model(self, progress: Progress | None = None, cancel: Event | None = None) -> Any:
        check_cancelled(cancel)
        if self._model is None:
            if progress:
                progress("Loading model (first use may download model weights)", None)
            factory = self._factory
            if factory is None:
                from faster_whisper import WhisperModel

                factory = WhisperModel
            self._model = factory(
                self.options.model,
                device=self.options.device,
                compute_type=self.options.compute_type,
                download_root=str(self.options.model_dir) if self.options.model_dir else None,
                local_files_only=self.options.offline,
            )
        check_cancelled(cancel)
        return self._model

    def transcribe(
        self,
        source: Path,
        destination: Path,
        *,
        cancel: Event | None = None,
        progress: Progress | None = None,
    ) -> Result:
        source = source.resolve()
        destination = destination.resolve()
        outputs = {
            extension: destination / f"{source.stem}.{extension}"
            for extension in ("txt", "srt", "vtt")
        }
        if source in outputs.values():
            raise ValueError("Output cannot replace the input media")
        if not self.options.overwrite:
            for path in outputs.values():
                if path.exists():
                    raise FileExistsError(f"Output already exists: {path}")
        if progress:
            progress("Decoding media", None)
        audio = decode_media(source, self.options.audio_track, cancel, progress)
        duration = len(audio) / SAMPLE_RATE
        if not np.any(audio):
            check_cancelled(cancel)
            paths = export([], destination, source.stem, overwrite=self.options.overwrite)
            if progress:
                progress("Complete: no speech detected", 1.0)
            language = self.options.language if self.options.language != "auto" else "unknown"
            return Result(source, language, duration, [], paths)
        model = self.load_model(progress, cancel)
        check_cancelled(cancel)
        raw_segments, info = model.transcribe(
            audio,
            language=None if self.options.language == "auto" else self.options.language,
            task="transcribe",
            beam_size=5,
            vad_filter=False,
            word_timestamps=True,
            condition_on_previous_text=False,
        )
        collected: list[Any] = []
        for raw in raw_segments:
            check_cancelled(cancel)
            collected.append(raw)
            if progress:
                progress(raw.text.strip(), min(0.99, max(0.0, raw.end / duration)))
        segments = normalize_segments(collected, duration)
        check_cancelled(cancel)
        paths = export(segments, destination, source.stem, overwrite=self.options.overwrite)
        if progress:
            progress("Complete" if segments else "Complete: no speech detected", 1.0)
        return Result(source, info.language, duration, segments, paths)
