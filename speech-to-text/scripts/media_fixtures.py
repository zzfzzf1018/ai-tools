import sys
from fractions import Fraction
from pathlib import Path

import av
import numpy as np

from speech_to_text.media import decode_media


def encode(path: Path, samples: np.ndarray, *, delay: float = 0, video: bool = False) -> None:
    with av.open(str(path), "w") as container:
        codec = {".wav": "pcm_s16le", ".mp3": "libmp3lame"}.get(path.suffix, "aac")
        rate = 24000
        stream = container.add_stream(codec, rate=rate)
        stream.layout = "mono"
        video_stream = None
        if video:
            video_stream = container.add_stream("mpeg4", rate=25)
            video_stream.width = 320
            video_stream.height = 180
            video_stream.pix_fmt = "yuv420p"
        timeline = np.interp(
            np.arange(round(len(samples) * rate / 16000)) * 16000 / rate,
            np.arange(len(samples)),
            samples,
        )
        packets = []
        for start in range(0, len(timeline), 1024):
            data = (timeline[start : start + 1024] * 30000).astype(np.int16).reshape(1, -1)
            frame = av.AudioFrame.from_ndarray(data, format="s16", layout="mono")
            frame.sample_rate = rate
            frame.time_base = Fraction(1, rate)
            frame.pts = start + round(delay * rate)
            packets.extend(stream.encode(frame))
        packets.extend(stream.encode(None))
        if video_stream is not None:
            duration = len(samples) / 16000 + delay
            for index in range(round(duration * 25)):
                image = np.zeros((180, 320, 3), dtype=np.uint8)
                image[:, :, 1] = 70 + index % 100
                frame = av.VideoFrame.from_ndarray(image, format="rgb24")
                frame.pts = index
                frame.time_base = Fraction(1, 25)
                packets.extend(video_stream.encode(frame))
            packets.extend(video_stream.encode(None))
        packets.sort(key=lambda packet: float(packet.dts * packet.time_base))
        for packet in packets:
            container.mux(packet)


def main() -> None:
    destination = Path(sys.argv[1])
    for language in ("en", "zh"):
        raw = decode_media(destination / f"raw-{language}.wav")
        audio = np.concatenate(
            [np.zeros(32000, dtype=np.float32), raw, np.zeros(16000, dtype=np.float32)]
        )
        for extension in (".wav", ".mp3", ".mp4", ".mkv"):
            encode(
                destination / f"{language}{extension}", audio, video=extension in {".mp4", ".mkv"}
            )
    raw = decode_media(destination / "raw-en.wav")
    encode(destination / "delayed.mp4", raw, delay=3, video=True)
    encode(destination / "silence.wav", np.zeros(80000, dtype=np.float32))
    encode_sparse_long(destination / "long-en.mkv", decode_media(destination / "en.wav"))


def encode_sparse_long(path: Path, samples: np.ndarray, *, delay: float = 7201) -> None:
    with av.open(str(path), "w") as container:
        stream = container.add_stream("pcm_s16le", rate=16000)
        stream.layout = "mono"
        for offset, data in [(0, np.zeros(1600, np.float32)), (round(delay * 16000), samples)]:
            for start in range(0, len(data), 4096):
                values = (data[start : start + 4096] * 30000).astype(np.int16).reshape(1, -1)
                frame = av.AudioFrame.from_ndarray(values, format="s16", layout="mono")
                frame.sample_rate = 16000
                frame.time_base = Fraction(1, 16000)
                frame.pts = offset + start
                for packet in stream.encode(frame):
                    container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)


if __name__ == "__main__":
    main()
