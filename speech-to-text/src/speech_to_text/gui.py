import os
import queue
import threading
import tkinter as tk
import webbrowser
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from speech_to_text.engine import MODELS, Options, Result, Transcriber
from speech_to_text.media import SUPPORTED_EXTENSIONS, CancelledError


class Application:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("\u8bed\u97f3\u8f6c\u6587\u5b57 | Local Transcribe")
        self.root.geometry("1060x780")
        self.root.minsize(880, 680)
        self.events: queue.Queue = queue.Queue()
        self.cancel = threading.Event()
        self.busy = False
        self.files: dict[str, Path] = {}
        self.results: dict[str, Result] = {}
        self.controls: list[ttk.Widget] = []
        self.output = tk.StringVar(value=str(Path.cwd() / "output"))
        self.model_dir = tk.StringVar(value=str(Path.home() / ".cache" / "local-transcribe"))
        self.language = tk.StringVar(value="\u81ea\u52a8\u68c0\u6d4b")
        self.model = tk.StringVar(value="small")
        self.device = tk.StringVar(value="cpu")
        self.compute_type = tk.StringVar(value="int8")
        self.track = tk.StringVar(value="0")
        self.offline = tk.BooleanVar(value=False)
        self.overwrite = tk.BooleanVar(value=False)
        self.status = tk.StringVar(value="\u5c31\u7eea")
        self._build()
        self.root.protocol("WM_DELETE_WINDOW", self._close)
        self.root.after(100, self._poll)

    def _button(self, parent, text, command, **kwargs) -> ttk.Button:
        button = ttk.Button(parent, text=text, command=command, **kwargs)
        self.controls.append(button)
        return button

    def _build(self) -> None:
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(".", font=("Microsoft YaHei UI", 10), background="#f5f6f6")
        style.configure("TButton", padding=(12, 7))
        style.configure(
            "Title.TLabel", font=("Microsoft YaHei UI", 20, "bold"), foreground="#202927"
        )
        style.configure("Accent.TButton", background="#167568", foreground="white")
        style.map("Accent.TButton", background=[("active", "#0c5d53"), ("disabled", "#889893")])
        style.configure("Treeview", rowheight=30, background="white", fieldbackground="white")
        style.configure("Horizontal.TProgressbar", background="#167568")
        self.root.configure(background="#f5f6f6")
        body = ttk.Frame(self.root, padding=22)
        body.grid(sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        body.columnconfigure(0, weight=1)
        body.rowconfigure(2, weight=2)
        body.rowconfigure(6, weight=1)
        ttk.Label(body, text="\u8bed\u97f3\u8f6c\u6587\u5b57", style="Title.TLabel").grid(
            row=0, column=0, sticky="w", pady=(0, 14)
        )
        toolbar = ttk.Frame(body)
        toolbar.grid(row=1, column=0, sticky="ew", pady=(0, 8))
        self._button(toolbar, "+ \u6dfb\u52a0\u6587\u4ef6", self._add).pack(side="left")
        self._button(toolbar, "\u79fb\u9664\u9009\u4e2d", self._remove).pack(side="left", padx=6)
        self._button(toolbar, "\u6e05\u7a7a", self._clear).pack(side="left")
        table = ttk.Frame(body)
        table.grid(row=2, column=0, sticky="nsew")
        table.columnconfigure(0, weight=1)
        table.rowconfigure(0, weight=1)
        self.table = ttk.Treeview(table, columns=("file", "state"), show="headings", height=5)
        self.table.heading("file", text="\u97f3\u89c6\u9891\u6587\u4ef6")
        self.table.heading("state", text="\u72b6\u6001")
        self.table.column("file", width=600, minwidth=300)
        self.table.column("state", width=150, minwidth=120, stretch=False)
        self.table.grid(row=0, column=0, sticky="nsew")
        vertical = ttk.Scrollbar(table, orient="vertical", command=self.table.yview)
        vertical.grid(row=0, column=1, sticky="ns")
        horizontal = ttk.Scrollbar(table, orient="horizontal", command=self.table.xview)
        horizontal.grid(row=1, column=0, sticky="ew")
        self.table.configure(yscrollcommand=vertical.set, xscrollcommand=horizontal.set)
        self.table.bind("<<TreeviewSelect>>", self._show_selected)
        settings = ttk.Frame(body, padding=(0, 14, 0, 0))
        settings.grid(row=3, column=0, sticky="ew")
        for column in (1, 3, 5):
            settings.columnconfigure(column, weight=1)
        fields = [
            (
                "\u8bed\u8a00",
                self.language,
                ("\u81ea\u52a8\u68c0\u6d4b", "\u4e2d\u6587", "English"),
            ),
            ("\u6a21\u578b", self.model, MODELS),
            ("\u8bbe\u5907", self.device, ("cpu", "cuda")),
            ("\u7cbe\u5ea6", self.compute_type, ("int8", "float16", "float32")),
        ]
        for index, (label, variable, values) in enumerate(fields):
            row, pair = divmod(index, 3)
            ttk.Label(settings, text=label).grid(
                row=row, column=pair * 2, sticky="w", padx=(0, 8), pady=4
            )
            combo = ttk.Combobox(
                settings, textvariable=variable, values=values, state="readonly", width=12
            )
            combo.grid(row=row, column=pair * 2 + 1, sticky="ew", padx=(0, 18), pady=4)
            self.controls.append(combo)
        ttk.Label(settings, text="\u97f3\u8f68").grid(row=1, column=2, sticky="w")
        track = ttk.Spinbox(settings, from_=0, to=99, textvariable=self.track, width=12)
        track.grid(row=1, column=3, sticky="ew", padx=(0, 18))
        self.controls.append(track)
        flags = ttk.Frame(settings)
        flags.grid(row=2, column=0, columnspan=6, sticky="w", pady=6)
        for label, variable in [
            ("\u4ec5\u4f7f\u7528\u672c\u5730\u6a21\u578b", self.offline),
            ("\u8986\u76d6\u5df2\u6709\u8f93\u51fa", self.overwrite),
        ]:
            control = ttk.Checkbutton(flags, text=label, variable=variable)
            control.pack(side="left", padx=(0, 20))
            self.controls.append(control)
        paths = ttk.Frame(body)
        paths.grid(row=4, column=0, sticky="ew", pady=(4, 10))
        paths.columnconfigure(1, weight=1)
        for row, (label, variable) in enumerate(
            [
                ("\u8f93\u51fa\u76ee\u5f55", self.output),
                ("\u6a21\u578b\u7f13\u5b58", self.model_dir),
            ]
        ):
            ttk.Label(paths, text=label).grid(row=row, column=0, sticky="w", padx=(0, 10), pady=4)
            entry = ttk.Entry(paths, textvariable=variable)
            entry.grid(row=row, column=1, sticky="ew", pady=4)
            self.controls.append(entry)
            self._button(paths, "\u6d4f\u89c8", lambda value=variable: self._directory(value)).grid(
                row=row, column=2, padx=(8, 0), pady=4
            )
        ttk.Label(body, text="\u8f6c\u5199\u9884\u89c8").grid(
            row=5, column=0, sticky="w", pady=(4, 6)
        )
        preview_frame = ttk.Frame(body)
        preview_frame.grid(row=6, column=0, sticky="nsew")
        preview_frame.columnconfigure(0, weight=1)
        preview_frame.rowconfigure(0, weight=1)
        self.preview = tk.Text(
            preview_frame,
            height=5,
            wrap="word",
            relief="flat",
            padx=12,
            pady=10,
            font=("Microsoft YaHei UI", 10),
            background="white",
            state="disabled",
        )
        self.preview.grid(row=0, column=0, sticky="nsew")
        preview_scroll = ttk.Scrollbar(preview_frame, command=self.preview.yview)
        preview_scroll.grid(row=0, column=1, sticky="ns")
        self.preview.configure(yscrollcommand=preview_scroll.set)
        self.progress = ttk.Progressbar(body, maximum=100)
        self.progress.grid(row=7, column=0, sticky="ew", pady=(14, 8))
        footer = ttk.Frame(body)
        footer.grid(row=8, column=0, sticky="ew")
        footer.columnconfigure(0, weight=1)
        self.status_label = ttk.Label(footer, textvariable=self.status, wraplength=460)
        self.status_label.grid(row=0, column=0, sticky="w")
        self._button(footer, "\u6253\u5f00\u8f93\u51fa", self._open_output).grid(
            row=0, column=1, padx=6
        )
        self.cancel_button = ttk.Button(
            footer, text="\u53d6\u6d88", command=self._cancel, state="disabled"
        )
        self.cancel_button.grid(row=0, column=2, padx=6)
        self._button(footer, "\u5f00\u59cb\u8f6c\u5199", self._start, style="Accent.TButton").grid(
            row=0, column=3
        )

    def _directory(self, variable: tk.StringVar) -> None:
        path = filedialog.askdirectory(parent=self.root)
        if path:
            variable.set(path)

    def _add(self) -> None:
        paths = filedialog.askopenfilenames(
            parent=self.root,
            filetypes=[
                (
                    "Audio / Video",
                    " ".join(f"*{extension}" for extension in sorted(SUPPORTED_EXTENSIONS)),
                ),
                ("All files", "*.*"),
            ],
        )
        existing = set(self.files.values())
        for path in paths:
            source = Path(path).resolve()
            if source not in existing:
                identity = self.table.insert("", "end", values=(str(source), "\u5f85\u5904\u7406"))
                self.files[identity] = source
                existing.add(source)

    def _remove(self) -> None:
        for identity in self.table.selection():
            self.files.pop(identity, None)
            self.results.pop(identity, None)
            self.table.delete(identity)

    def _clear(self) -> None:
        self.table.delete(*self.table.get_children())
        self.files.clear()
        self.results.clear()
        self._set_preview("")

    def _set_preview(self, text: str) -> None:
        self.preview.configure(state="normal")
        self.preview.delete("1.0", "end")
        self.preview.insert("end", text)
        self.preview.configure(state="disabled")

    def _show_selected(self, event=None) -> None:
        selected = self.table.selection()
        if selected and selected[0] in self.results:
            self._set_preview(
                "\n".join(segment.text for segment in self.results[selected[0]].segments)
            )

    def _start(self) -> None:
        if self.busy:
            return
        if not self.files:
            messagebox.showwarning(
                "\u672a\u9009\u62e9\u6587\u4ef6",
                "\u8bf7\u6dfb\u52a0\u97f3\u89c6\u9891\u6587\u4ef6",
                parent=self.root,
            )
            return
        try:
            if not self.output.get().strip():
                raise ValueError("Output directory cannot be empty")
            options = Options(
                model=self.model.get(),
                language={
                    "\u81ea\u52a8\u68c0\u6d4b": "auto",
                    "\u4e2d\u6587": "zh",
                    "English": "en",
                }[self.language.get()],
                device=self.device.get(),
                compute_type=self.compute_type.get(),
                model_dir=Path(self.model_dir.get()) if self.model_dir.get().strip() else None,
                offline=self.offline.get(),
                audio_track=int(self.track.get()),
                overwrite=self.overwrite.get(),
            )
        except (ValueError, KeyError) as error:
            messagebox.showerror("\u53c2\u6570\u9519\u8bef", str(error), parent=self.root)
            return
        self.busy = True
        self.cancel.clear()
        self.results.clear()
        self._set_preview("")
        self.progress["value"] = 0
        for control in self.controls:
            control.configure(state="disabled")
        self.cancel_button.configure(state="normal")
        jobs = list(self.files.items())
        for identity, source in jobs:
            self.table.item(identity, values=(str(source), "\u6392\u961f\u4e2d"))
        threading.Thread(
            target=self._worker, args=(jobs, Path(self.output.get()), options), daemon=True
        ).start()

    def _worker(self, jobs: list[tuple[str, Path]], output: Path, options: Options) -> None:
        transcriber = Transcriber(options)
        failures: list[str] = []
        completed = 0
        for index, (identity, source) in enumerate(jobs):
            if self.cancel.is_set():
                break
            self.events.put(("state", identity, "\u8f6c\u5199\u4e2d"))

            def progress(message, fraction, current=index):
                self.events.put(
                    ("progress", message, (current + (fraction or 0)) / len(jobs) * 100)
                )

            try:
                result = transcriber.transcribe(
                    source, output, cancel=self.cancel, progress=progress
                )
                completed += 1
                self.events.put(("result", identity, result))
            except CancelledError:
                self.events.put(("state", identity, "\u5df2\u53d6\u6d88"))
                break
            except Exception as error:
                failures.append(f"{source.name}: {error}")
                self.events.put(("state", identity, "\u5931\u8d25"))
        self.events.put(("done", completed, failures))

    def _poll(self) -> None:
        for _ in range(100):
            try:
                kind, first, second = self.events.get_nowait()
            except queue.Empty:
                break
            if kind == "state":
                self.table.item(first, values=(str(self.files[first]), second))
            elif kind == "progress":
                self.status.set(first[:180])
                self.progress["value"] = second
            elif kind == "result":
                self.results[first] = second
                label = "\u5b8c\u6210" if second.segments else "\u65e0\u8bed\u97f3"
                self.table.item(first, values=(str(self.files[first]), label))
                self.table.selection_set(first)
                self._show_selected()
            elif kind == "done":
                self.busy = False
                for control in self.controls:
                    control.configure(
                        state="readonly" if isinstance(control, ttk.Combobox) else "normal"
                    )
                self.cancel_button.configure(state="disabled")
                if self.cancel.is_set():
                    for identity in self.files:
                        if self.table.item(identity, "values")[1] == "\u6392\u961f\u4e2d":
                            self.table.item(
                                identity, values=(str(self.files[identity]), "\u5df2\u53d6\u6d88")
                            )
                else:
                    self.progress["value"] = 100
                self.status.set(
                    f"\u5b8c\u6210 {first} / {len(self.files)}; \u5931\u8d25 {len(second)}"
                )
                if second:
                    messagebox.showerror(
                        "\u8f6c\u5199\u9519\u8bef", "\n\n".join(second), parent=self.root
                    )
        self.root.after(100, self._poll)

    def _cancel(self) -> None:
        self.cancel.set()
        self.cancel_button.configure(state="disabled")
        self.status.set(
            "\u6b63\u5728\u53d6\u6d88; "
            "\u7b49\u5f85\u5f53\u524d\u89e3\u7801/\u6a21\u578b\u8c03\u7528\u8fd4\u56de"
        )

    def _open_output(self) -> None:
        path = Path(self.output.get()).resolve()
        if not path.is_dir():
            messagebox.showwarning(
                "\u8f93\u51fa\u76ee\u5f55", "\u76ee\u5f55\u5c1a\u4e0d\u5b58\u5728", parent=self.root
            )
        elif os.name == "nt":
            os.startfile(path)
        else:
            webbrowser.open(path.as_uri())

    def _close(self) -> None:
        if self.busy and not messagebox.askyesno(
            "\u9000\u51fa",
            "\u4efb\u52a1\u6b63\u5728\u8fd0\u884c\uff0c\u53d6\u6d88\u5e76\u9000\u51fa\uff1f",
            parent=self.root,
        ):
            return
        self.cancel.set()
        self.root.destroy()


def main() -> int:
    root = tk.Tk()
    Application(root)
    root.mainloop()
    return 0
