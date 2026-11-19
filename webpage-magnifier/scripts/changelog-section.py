#!/usr/bin/env python3
"""从 CHANGELOG.md 切出指定版本段落，输出到 stdout。

用法: python3 changelog-section.py <version> <path-to-changelog>
找不到版本段落时输出 "NOT_FOUND" 到 stdout，退出码 0。
"""
import sys
import re


def main():
    if len(sys.argv) < 3:
        print("NOT_FOUND")
        sys.exit(0)

    version = sys.argv[1]
    path = sys.argv[2]

    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except (OSError, IOError):
        print("NOT_FOUND")
        sys.exit(0)

    header = f"## [{version}]"
    idx = content.find(header)
    if idx == -1:
        print("NOT_FOUND")
        sys.exit(0)

    after = content[idx + len(header):]
    m = re.search(r'^## \[', after, re.MULTILINE)
    body = after if not m else after[:m.start()]

    print(header + body.strip())


if __name__ == "__main__":
    main()
