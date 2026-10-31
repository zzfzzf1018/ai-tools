import os
import tkinter as tk
from pathlib import Path

import pytest
from test_engine import FakeModel
from test_media import create_audio

from speech_to_text.engine import Options, Transcriber
from speech_to_text.gui import Application


def test_gui_layout_queue_and_worker(tmp_path: Path, monkeypatch) -> None:
    import speech_to_text.gui as gui

    try:
        root = tk.Tk()
    except tk.TclError as error:
        if os.name == "nt":
            pytest.fail(f"Windows Tk initialization failed: {error}")
        pytest.skip(f"No desktop display available: {error}")
    try:
        app = Application(root)
        app._clear()
        assert not app.files
        assert app.language.get() == "\u81ea\u52a8\u68c0\u6d4b"
        assert app.long_files.get() is False
        for geometry in ("1060x780", "880x680"):
            root.geometry(geometry)
            root.update()
            for widget in [*app.controls, app.cancel_button, app.status_label, app.preview]:
                assert widget.winfo_rootx() >= root.winfo_rootx()
                assert widget.winfo_rooty() >= root.winfo_rooty()
                assert (
                    widget.winfo_rootx() + widget.winfo_width()
                    <= root.winfo_rootx() + root.winfo_width()
                )
                assert (
                    widget.winfo_rooty() + widget.winfo_height()
                    <= root.winfo_rooty() + root.winfo_height()
                )
        source = tmp_path / "good.wav"
        create_audio(source)
        jobs = []
        for path in [source, tmp_path / "missing.mp3"]:
            identity = app.table.insert("", "end", values=(str(path), "pending"))
            app.files[identity] = path
            jobs.append((identity, path))
        monkeypatch.setattr(gui, "Transcriber", lambda options: Transcriber(options, FakeModel))
        errors = []
        monkeypatch.setattr(
            gui.messagebox, "showerror", lambda *args, **kwargs: errors.append(args)
        )
        app.busy = True
        app._worker(jobs, tmp_path / "output", Options())
        app._poll()
        assert not app.busy
        assert len(app.results) == 1
        assert errors and "missing.mp3" in errors[0][1]
        assert "Hello" in app.preview.get("1.0", "end")
        app._clear()
        assert not app.files and not app.results
        assert not app.preview.get("1.0", "end").strip()
        identity = app.table.insert("", "end", values=(str(source), "pending"))
        app.files[identity] = source
        app.output.set(str(tmp_path / "long-output"))
        app.long_files.set(True)
        captured = []

        class ImmediateThread:
            def __init__(self, *, target, args, daemon):
                self.target, self.args = target, args
                captured.append(args[2])

            def start(self):
                self.target(*self.args)

        monkeypatch.setattr(gui.threading, "Thread", ImmediateThread)
        app._start()
        assert captured[0].long_files is True
        assert all(str(control.cget("state")) == "disabled" for control in app.controls)
        app._poll()
        assert not app.busy
        assert app.results[identity].segments
        assert app.long_files.get() is True
    finally:
        root.destroy()
