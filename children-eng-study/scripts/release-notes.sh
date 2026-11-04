#!/usr/bin/env bash
# 从 CHANGELOG.md 提取指定版本条目，并追加下载安装说明，输出 GitHub Release 说明正文。
# 用法: scripts/release-notes.sh <CHANGELOG.md> <version>   例如 scripts/release-notes.sh CHANGELOG.md 1.2.2
set -euo pipefail

changelog="$1"
version="$2"

if [ ! -f "$changelog" ]; then
  echo "找不到变更记录文件: $changelog" >&2
  exit 1
fi

out="$(mktemp)"
awk -v ver="$version" '
  $0 ~ "^## \\[" ver "\\]" { capture = 1; next }
  capture && /^## \[/ { exit }
  capture { print }
' "$changelog" > "$out"

# 去掉正文开头的空行
sed -i -e '/./,$!d' "$out"

if [ ! -s "$out" ]; then
  echo "CHANGELOG.md 缺少 [$version] 条目，请先登记本次变更再发版" >&2
  exit 1
fi

cat >> "$out" <<'EOF'

---

**发布产物**

- `Kids-English-Wonderland-<version>-x64-portable.exe` — Windows x64 便携版，双击即用；首次启动解压到临时目录，无需安装
- `Kids-English-Wonderland-<version>-web.zip` — Web 版，解压后用浏览器打开 `index.html`
- `SHA256SUMS.txt` — 上述产物的 SHA256 校验值

未签名构建：Windows 可能提示"未知发布者"，运行前请核对 `SHA256SUMS.txt`。
语音使用 Windows 已安装的英语语音；学习进度与窗口状态仅保存在本机。
EOF

cat "$out"
