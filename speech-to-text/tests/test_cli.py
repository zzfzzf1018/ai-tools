import json
from pathlib import Path

from test_engine import FakeModel
from test_media import create_audio

from speech_to_text import cli
from speech_to_text.engine import Transcriber


def test_cli_batch_continues_after_failure(tmp_path: Path, monkeypatch, capsys) -> None:
    source = tmp_path / "good.wav"
    create_audio(source)
    monkeypatch.setattr(cli, "Transcriber", lambda options: Transcriber(options, FakeModel))
    code = cli.main(
        [
            "transcribe",
            str(tmp_path / "missing.mp3"),
            str(source),
            "-o",
            str(tmp_path / "out"),
            "--quiet",
        ]
    )
    assert code == 1
    captured = capsys.readouterr()
    assert "missing.mp3" in captured.err
    assert json.loads(captured.out)["segments"] == 1


def test_cli_bad_options(capsys) -> None:
    assert cli.main(["transcribe", "file.mp3", "--compute-type", "float16"]) == 1
    assert "requires CUDA" in capsys.readouterr().err


def test_doctor(capsys) -> None:
    assert cli.main(["doctor"]) == 0
    assert json.loads(capsys.readouterr().out)["cuda_devices"] >= 0


def test_cli_long_files_is_opt_in(tmp_path: Path, monkeypatch, capsys) -> None:
    source = tmp_path / "good.wav"
    create_audio(source)
    seen = []

    def transcriber(options):
        seen.append(options.long_files)
        return Transcriber(options, FakeModel)

    monkeypatch.setattr(cli, "Transcriber", transcriber)
    assert cli.main(["transcribe", str(source), "-o", str(tmp_path / "old"), "--quiet"]) == 0
    assert (
        cli.main(
            [
                "transcribe",
                str(source),
                "-o",
                str(tmp_path / "new"),
                "--quiet",
                "--long-files",
            ]
        )
        == 0
    )
    assert seen == [False, True]
    assert len(capsys.readouterr().out.splitlines()) == 2
