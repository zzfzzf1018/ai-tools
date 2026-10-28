# -*- coding: utf-8 -*-
"""
网页屏蔽器一键打包脚本

流程：静态检查（node --check）→ 假 DOM 集成测试 → 校验 manifest 与图标 → 产出 dist/web-blocker-v<版本>.zip
用法：
    python tools/package.py                # 全量：检查 + 测试 + 打包
    python tools/package.py --skip-tests   # 跳过测试（赶时间时用，不推荐）
    python tools/package.py --out D:/tmp   # 指定输出目录（默认 <项目>/dist）
只打包浏览器运行所需文件（manifest / background / content / popup / icons），
tests/ tools/ 文档一概不进 zip —— 那些是仓库的事。
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

RUNTIME_FILES = ["manifest.json", "background.js", "content.js", "popup.html", "popup.js"]
JS_FILES = ["background.js", "content.js", "popup.js"]

args = [a for a in sys.argv[1:]]
skip_tests = "--skip-tests" in args
args = [a for a in args if a != "--skip-tests"]
out_dir = os.path.abspath(args[args.index("--out") + 1]) if "--out" in args and len(args) > args.index("--out") + 1 else os.path.join(ROOT, "dist")

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
step("1/4 语法检查 node --check")
node = shutil.which("node")
if not node:
    failures.append("找不到 node：语法检查与测试都无法执行；确认已安装 Node.js 并加入 PATH")
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

# ---------------------------------------------------------------- 2. 行为测试
step("2/4 假 DOM 集成测试 tests/blocker-harness.mjs")
if skip_tests:
    print("  --skip-tests：已跳过（后果自负 :)）")
elif not node:
    print("  已因缺少 node 跳过")
else:
    r = run([node, "tests/blocker-harness.mjs"], capture=True)
    lines = (r.stdout or "").strip().splitlines() + (r.stderr or "").strip().splitlines()
    for line in lines[-4:]:
        print("  " + line)
    if r.returncode == 0 and any("全部断言通过" in l for l in lines):
        print("  OK   测试全部通过")
    else:
        failures.append("集成测试未通过（上方有断言信息；也可 --skip-tests 硬跳）")

# ------------------------------------------------------- 3. manifest 与图标
step("3/4 校验 manifest 与图标")
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

icon_refs = []
for group in ("icons", "action"):
    node_cfg = manifest.get(group) or {}
    if group == "action":
        node_cfg = node_cfg.get("default_icon") or {}
    icon_refs += list(node_cfg.values())
missing = [p for p in icon_refs if not os.path.isfile(os.path.join(ROOT, p))]
if missing:
    failures.append("manifest 引用的图标缺失：" + ", ".join(missing))
else:
    print("  OK   " + str(len(icon_refs)) + " 处图标引用全部存在（" + ", ".join(sorted(set(icon_refs))) + "）")

# ---------------------------------------------------------------- 4. 打包
step("4/4 打包")
out_name = "web-blocker-v" + version + ".zip"
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
        if n.lower().endswith(".png") and n != "preview-sizes.png"
    ]

with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for rel in files:
        z.write(os.path.join(ROOT, rel), "web-blocker/" + rel)

# 回读校验：zip 里一个不多一个不少
with zipfile.ZipFile(out_path) as z:
    packed = sorted(n[len("web-blocker/"):] for n in z.namelist())
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
print("  下一步：edge://extensions → 开发人员模式 → 加载解扩展选解压后的 web-blocker 文件夹（或对已装版本点「重新加载 ↻」）")
