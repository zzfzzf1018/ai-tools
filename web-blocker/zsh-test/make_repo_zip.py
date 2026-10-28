# 重建仓库 zip：排除 dist/（打包输出）与 preview-sizes.png（本地预览图）
import os
import sys
import zipfile

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

out_dir = os.path.dirname(os.path.abspath(__file__))
out_path = os.path.abspath(os.path.join(out_dir, "..", "outputs", "web-blocker.zip"))
root = os.path.abspath(os.path.join(out_dir, "..", "outputs", "web-blocker"))

skip_dirs = {"dist", ".git"}
skip_files = {"preview-sizes.png"}

with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fn in sorted(filenames):
            if fn in skip_files:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, os.path.dirname(root)).replace(os.sep, "/")
            z.write(full, rel)

with zipfile.ZipFile(out_path) as z:
    names = sorted(z.namelist())

need = [
    "web-blocker/.gitignore",
    "web-blocker/tools/package.py",
    "web-blocker/tools/gen_icons.py",
    "web-blocker/tests/blocker-harness.mjs",
    "web-blocker/一键打包.bat",
]
print("entries:", len(names))
print("dist leaked:", any("/dist/" in n for n in names))
print("preview leaked:", any("preview-sizes" in n for n in names))
print("key present:", all(n in names for n in need))
print("zip size:", os.path.getsize(out_path))
