import argparse
import json
import sys
from pathlib import Path

from speech_to_text import __version__
from speech_to_text.engine import MODELS, Options, Transcriber
from speech_to_text.media import CancelledError


def add_model_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--model", default="small", help=f"Model name {MODELS} or local directory")
    parser.add_argument("--model-dir", type=Path, help="Model download/cache directory")
    parser.add_argument("--offline", action="store_true", help="Use cached model only")
    parser.add_argument("--device", choices=["cpu", "cuda"], default="cpu")
    parser.add_argument("--compute-type", choices=["int8", "float16", "float32"], default="int8")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Local Chinese/English speech transcription")
    root.add_argument("--version", action="version", version=__version__)
    commands = root.add_subparsers(dest="command")
    commands.add_parser("gui", help="Open desktop application (default)")
    commands.add_parser("doctor", help="Check native libraries and runtime")
    download = commands.add_parser(
        "download-model", help="Download and verify a multilingual model"
    )
    add_model_arguments(download)
    transcribe = commands.add_parser("transcribe", help="Export TXT/SRT/VTT from media files")
    transcribe.add_argument("inputs", nargs="+", type=Path)
    transcribe.add_argument("-o", "--output-dir", type=Path, default=Path("output"))
    transcribe.add_argument("--language", choices=["auto", "zh", "en"], default="auto")
    transcribe.add_argument(
        "--audio-track", type=int, default=0, help="Audio track index (zero-based)"
    )
    transcribe.add_argument("--overwrite", action="store_true")
    transcribe.add_argument("--quiet", action="store_true")
    add_model_arguments(transcribe)
    return root


def doctor() -> dict[str, str | int]:
    import tkinter

    import av
    import ctranslate2
    import faster_whisper

    return {
        "python": sys.version.split()[0],
        "av": av.__version__,
        "faster_whisper": faster_whisper.__version__,
        "ctranslate2": ctranslate2.__version__,
        "tk": str(tkinter.TkVersion),
        "cuda_devices": ctranslate2.get_cuda_device_count(),
    }


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command in {None, "gui"}:
            from speech_to_text.gui import main as gui_main

            return gui_main()
        if args.command == "doctor":
            print(json.dumps(doctor(), ensure_ascii=False, indent=2))
            return 0
        options = Options(
            model=args.model,
            model_dir=args.model_dir,
            offline=args.offline,
            device=args.device,
            compute_type=args.compute_type,
            language=getattr(args, "language", "auto"),
            audio_track=getattr(args, "audio_track", 0),
            overwrite=getattr(args, "overwrite", False),
        )
        transcriber = Transcriber(options)

        def progress(message: str, fraction: float | None) -> None:
            if not getattr(args, "quiet", False):
                prefix = f"{fraction:.0%} " if fraction is not None else ""
                print(prefix + message, file=sys.stderr, flush=True)

        if args.command == "download-model":
            transcriber.load_model(progress)
            print("Model ready")
            return 0
        failed = False
        for source in args.inputs:
            try:
                result = transcriber.transcribe(source, args.output_dir, progress=progress)
                print(
                    json.dumps(
                        {
                            "source": str(result.source),
                            "language": result.language,
                            "duration": result.duration,
                            "segments": len(result.segments),
                            "outputs": {
                                extension: str(path) for extension, path in result.outputs.items()
                            },
                        },
                        ensure_ascii=False,
                    )
                )
            except (CancelledError, KeyboardInterrupt):
                raise
            except Exception as error:
                failed = True
                print(f"ERROR: {source}: {error}", file=sys.stderr)
        return 1 if failed else 0
    except (CancelledError, KeyboardInterrupt):
        print("Cancelled", file=sys.stderr)
        return 130
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
