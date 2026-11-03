# -*- coding: utf-8 -*-
"""
Web to Markdown 一键打包脚本

流程：静态检查（node --check）→ 校验 manifest 与图标 → 产出 dist/web-markdown-ext-v<版本>.zip
用法：
    python tools/package.py                # 全量：检查 + 打包
    python tools/package.py --out D:/tmp   # 指定输出目录（默认 <项目>/dist）

说明：本项目无 Node 行为测试——Readability/Turndown 依赖真实浏览器 DOM，
转换管道已在真实浏览器中端到端验证（见 docs/design.md 第 8 节）。
只打包浏览器运行所需文件，docs/ scripts/ tools/ tests 一概不进 zip。
"""
import json
import os
import shutil
import subprocess
import sys
import zipfile

try:  # Windows 控制台默认 GBK，先切成 UTF-8 免得中文全成问号
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 浏览器运行时需要的全部文件（相对项目根目录）
RUNTIME_FILES = [
    "manifest.json",
    "background.js",
    "content/content.js",
    "popup/popup.html",
    "popup/popup.css",
    "popup/popup.js",
    "options/options.html",
    "options/options.css",
    "options/options.js",
    "lib/readability.js",
    "lib/turndown.js",
    "lib/turndown-plugin-gfm.js",
    "lib/config.js",
    "lib/markdown-convert.js",
]
# 自有 JS（node --check 范围；第三方库不重复检查）
JS_FILES = [
    "background.js",
    "content/content.js",
    "popup/popup.js",
    "options/options.js",
    "lib/config.js",
    "lib/markdown-convert.js",
]

args = [a for a in sys.argv[1:]]
out_dir = (
    os.path.abspath(args[args.index("--out") + 1])
    if "--out" in args and len(args) > args.index("--out") + 1
    else os.path.join(ROOT, "dist")
)

failures = []


def step(title):
    print("\n== " + title + " " + "=" * max(0, 56 - len(title)))


def run(cmd, cwd=None, capture=False):
    return subprocess.run(
        cmd,
        cwd=cwd or ROOT,
        capture_output=capture,
        text=True,
        encoding="utf-8",
        errors="replace",
        shell=False,
    )


# ---------------------------------------------------------------- 1. 静态检查
step("1/3 语法检查 node --check")
node = shutil.which("node")
if not node:
    failures.append("找不到 node：语法检查无法执行；确认已安装 Node.js 并加入 PATH")
else:
    for f in JS_FILES:
        p = os.path.join(ROOT, f)
        if not os.path.isfile(p):
            failures.append("缺少文件 " + f)
            continue
        r = run([node, "--check", f])
        if r.returncode == 0:
            print("  OK   " + f)
        else:
            failures.append(f + " 语法错误：\n" + (r.stderr or "").strip()[:800])

# ------------------------------------------------------- 2. manifest 与文件
step("2/3 校验 manifest 与运行时文件")
manifest_path = os.path.join(ROOT, "manifest.json")
try:
    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)
    version = str(manifest.get("version", "?"))
    print("  OK   manifest.json 解析成功，版本 " + version)
except Exception as err:
    print("  FAIL " + str(err))
    print("\n打包中止：manifest.json 无法解析。")
    sys.exit(1)

missing = [f for f in RUNTIME_FILES if not os.path.isfile(os.path.join(ROOT, f))]
if missing:
    failures.append("运行时文件缺失：" + ", ".join(missing))
else:
    print("  OK   " + str(len(RUNTIME_FILES)) + " 个运行时文件全部存在")

icon_refs = []
for group in ("icons", "action"):
    node_cfg = manifest.get(group) or {}
    if group == "action":
        node_cfg = node_cfg.get("default_icon") or {}
    icon_refs += list(node_cfg.values())
missing_icons = [p for p in icon_refs if not os.path.isfile(os.path.join(ROOT, p))]
if missing_icons:
    failures.append("manifest 引用的图标缺失：" + ", ".join(missing_icons))
else:
    print("  OK   " + str(len(icon_refs)) + " 处图标引用全部存在（" + ", ".join(sorted(set(icon_refs))) + "）")

# ---------------------------------------------------------------- 3. 打包
step("3/3 打包")
out_name = "web-markdown-ext-v" + version + ".zip"
out_path = os.path.join(out_dir, out_name)
os.makedirs(out_dir, exist_ok=True)
if os.path.exists(out_path):
    os.remove(out_path)

files = list(RUNTIME_FILES)
icons_dir = os.path.join(ROOT, "icons")
if os.path.isdir(icons_dir):
    files += [
        "icons/" + n
        for n in sorted(os.listdir(icons_dir))
        if n.lower().endswith(".png")
    ]

with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for rel in files:
        z.write(os.path.join(ROOT, rel), "web-markdown-ext/" + rel)

# 回读校验：zip 里一个不多一个不少
with zipfile.ZipFile(out_path) as z:
    packed = sorted(n[len("web-markdown-ext/"):] for n in z.namelist())
expected = sorted(files)
if packed != expected:
    failures.append("zip 内容与预期不符：多 " + str(set(packed) - set(expected)) + " 少 " + str(set(expected) - set(packed)))

# ---------------------------------------------------------------- 结果
print("")
if failures:
    print("✗ 打包失败，共 " + str(len(failures)) + " 个问题：")
    for f in failures:
        print("  - " + f)
    sys.exit(1)

print("✓ 打包完成：" + out_path)
print("  版本 v" + version + " · " + str(len(files)) + " 个文件 · " + format(os.path.getsize(out_path), ",") + " 字节")
print("  下一步：edge://extensions → 开发人员模式 → 加载解压缩的扩展选解压后的 web-markdown-ext 文件夹")
