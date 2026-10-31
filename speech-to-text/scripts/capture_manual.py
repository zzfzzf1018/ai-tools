import subprocess
import tkinter as tk
from pathlib import Path

from speech_to_text.gui import Application


def main() -> None:
    destination = Path(__file__).resolve().parent.parent / "docs/images/application.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    root = tk.Tk()
    try:
        application = Application(root)
        application.output.set("D:\\SpeechToText\\output")
        application.model_dir.set("D:\\SpeechToText\\models")
        application.table.insert("", "end", values=("\u4e2d\u6587\u4f1a\u8bae.mp4", "\u5b8c\u6210"))
        application._set_preview(
            "\u4f60\u597d\uff0c\u6b22\u8fce\u4f7f\u7528\u8bed\u97f3\u8f6c\u6587\u5b57\u5de5\u5177\u3002\n"
            "\u4eca\u5929\u6211\u4eec\u6d4b\u8bd5\u4e2d\u6587\u8bc6\u522b\u548c\u65f6\u95f4\u8f74\u5b57\u5e55\u3002"
        )
        root.attributes("-topmost", True)
        root.update()
        path = "'" + str(destination).replace("'", "''") + "'"
        native = """
using System;
using System.Runtime.InteropServices;
public static class WindowCapture {
    [StructLayout(LayoutKind.Sequential)]
    public struct Rectangle { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)]
    public struct Point { public int X, Y; }
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll")]
    public static extern bool GetClientRect(IntPtr window, out Rectangle rectangle);
    [DllImport("user32.dll")]
    public static extern bool ClientToScreen(IntPtr window, ref Point point);
}
"""
        script = (
            "Add-Type -AssemblyName System.Drawing; "
            f"Add-Type -TypeDefinition @'\n{native}\n'@; "
            "[WindowCapture]::SetProcessDPIAware() | Out-Null; "
            f"$Window=[WindowCapture]::GetAncestor([intptr]{root.winfo_id()}, 2); "
            "$Rectangle=[WindowCapture+Rectangle]::new(); "
            "$Point=[WindowCapture+Point]::new(); "
            "[WindowCapture]::GetClientRect($Window, [ref]$Rectangle) | Out-Null; "
            "[WindowCapture]::ClientToScreen($Window, [ref]$Point) | Out-Null; "
            "$Width=$Rectangle.Right-$Rectangle.Left; $Height=$Rectangle.Bottom-$Rectangle.Top; "
            "$Bitmap=[System.Drawing.Bitmap]::new($Width, $Height); "
            "$Graphics=[System.Drawing.Graphics]::FromImage($Bitmap); "
            "$Graphics.CopyFromScreen($Point.X, $Point.Y, 0, 0, "
            "[System.Drawing.Size]::new($Width, $Height)); "
            f"$Bitmap.Save({path}, [System.Drawing.Imaging.ImageFormat]::Png); "
            "$Graphics.Dispose(); $Bitmap.Dispose()"
        )
        subprocess.run(["powershell.exe", "-NoProfile", "-Command", script], check=True, timeout=30)
        print(f"Manual screenshot captured: {destination}")
    finally:
        root.destroy()


if __name__ == "__main__":
    main()
