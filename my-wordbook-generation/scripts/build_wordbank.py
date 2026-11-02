#!/usr/bin/env python3
"""Build a 2000 / 4000 / 8000 tiered English-Chinese wordbank from ECDICT.

Usage:
  npm pack ecdict && tar -xf ecdict-*.tgz      # produces package/assets/ecdict.csv
  python scripts/build_wordbank.py [path/to/ecdict.csv]

The generated file is written to js/data/wordbank.js and is loaded by the
classic-script app (window.WB_WORDBANK), so the app also works from file://.
"""

import csv
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CSV = os.path.join(ROOT, ".cache", "package", "assets", "ecdict.csv")
OUT = os.path.join(ROOT, "js", "data", "wordbank.js")

TIER_SIZES = (2000, 4000, 8000)
WORD_RE = re.compile(r"^[a-z][a-z'\-]*$")
CN_RE = re.compile(r"[\u4e00-\u9fff]")
DOMAIN_RE = re.compile(r"^\[[^\]]+\]")
NAME_RE = re.compile(r"(人名|地名|姓氏|女子名|男子名)")
PLACE_RE = re.compile(r"n\. .*(州|市|县|河|山|岛|国|镇|村|港|湾).*")

EXAM_TAGS = ("zk", "gk", "cet4", "cet6", "ky", "toefl", "ielts", "gre")

# Very common function words that Chinese learners almost always know.
# They stay in the bank but are skipped by the daily queue by default.
BASIC_WORDS = set("""
a an the and or but if because so though although while unless until
of to in on at by for with from into onto upon about above across after
against along among around as before behind below beneath beside besides
between beyond during except inside outside over past since through
throughout till toward towards under up down out off away back near
than that this these those there here where when why how what which who
whom whose whether not no nor none never too very can could may might
must shall should will would do does did done be am is are was were been
being have has had having i you he she it we they me him her us them
my your his its our their mine yours hers ours theirs myself yourself
himself herself itself ourselves yourselves themselves some any all both
each every either neither few many much more most little less least other
another such own same one
""".split())


def rank_of(row):
    """ECDICT bnc/frq are frequency ranks: smaller means more frequent."""
    values = []
    for key in ("frq", "bnc"):
        try:
            value = int(row.get(key) or 0)
        except ValueError:
            value = 0
        if value > 0:
            values.append(value)
    return min(values) if values else None


def is_lemma(row):
    """Skip inflected forms that point back to a headword (0:/1: exchange)."""
    exchange = row.get("exchange") or ""
    return "0:" not in exchange and "1:" not in exchange


def clean_senses(raw):
    raw = (raw or "").replace("\\n", "\n").replace("\\r", " ")
    lines = []
    for line in raw.split("\n"):
        line = " ".join(line.split()).strip()
        line = re.sub(r"\[[^\]]+\]", "", line).strip()
        if not line:
            continue
        if DOMAIN_RE.match(line):
            continue
        lines.append(line)
    if not lines:
        for line in raw.split("\n"):
            line = " ".join(line.split()).strip()
            line = re.sub(r"\[[^\]]+\]", "", line).strip()
            if line:
                lines.append(line)
    senses = []
    seen = set()
    for line in lines:
        if len(line) > 120:
            line = line[:120].rstrip(" ,;，；")
        key = line.lower()
        if key in seen:
            continue
        seen.add(key)
        senses.append(line)
        if len(senses) >= 3:
            break
    return senses


def is_name_only(senses):
    text = " ".join(senses)
    if not text:
        return True
    if NAME_RE.search(text) and not re.search(r"(v\.|a\.|ad\.|prep\.|conj\.|pron\.|num\.|vt\.|vi\.|aux\.)", text):
        return True
    if PLACE_RE.search(text) and len(senses) <= 1:
        return True
    return False


def build(csv_path):
    candidates = []
    with open(csv_path, encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            word = (row.get("word") or "").strip()
            rank = rank_of(row)
            if rank is None or not is_lemma(row):
                continue
            if word != "I" and not WORD_RE.match(word):
                continue
            if word.endswith(("'", "-")) or len(word) < 2 and word not in ("a", "I"):
                continue
            if word.startswith("n'"):
                continue
            senses = clean_senses(row.get("translation") or "")
            if not senses or not CN_RE.search(" ".join(senses)):
                continue
            if is_name_only(senses):
                continue
            tags = [tag for tag in (row.get("tag") or "").split() if tag in EXAM_TAGS]
            entry = {
                "w": word,
                "ph": " ".join((row.get("phonetic") or "").split()),
                "zh": senses,
                "r": rank,
                "tag": tags,
                "basic": word.lower() in BASIC_WORDS,
            }
            candidates.append(entry)

    candidates.sort(key=lambda item: (item["r"], item["w"].lower()))
    selected = candidates[: TIER_SIZES[-1]]
    if len(selected) < TIER_SIZES[-1]:
        raise SystemExit(f"Only {len(selected)} words available, need {TIER_SIZES[-1]}")

    words = []
    for index, entry in enumerate(selected):
        if index < TIER_SIZES[0]:
            tier = 1
        elif index < TIER_SIZES[1]:
            tier = 2
        else:
            tier = 3
        entry["t"] = tier
        words.append(entry)

    meta = {
        "version": "1.0.0",
        "builtAt": date.today().isoformat(),
        "source": "ECDICT (https://github.com/skywind3000/ECDICT)",
        "license": "MIT",
        "tiers": list(TIER_SIZES),
        "total": len(words),
        "candidates": len(candidates),
    }
    payload = {"meta": meta, "words": words}
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("/* Generated by scripts/build_wordbank.py — do not edit by hand. */\n")
        handle.write("window.WB_WORDBANK=")
        handle.write(body)
        handle.write(";\n")

    print(f"candidates: {len(candidates)}")
    print(f"selected:   {len(words)}")
    print(f"tiers:      {TIER_SIZES} (tier1={sum(1 for w in words if w['t']==1)}, "
          f"tier2={sum(1 for w in words if w['t']==2)}, tier3={sum(1 for w in words if w['t']==3)})")
    print(f"basic:      {sum(1 for w in words if w['basic'])}")
    print(f"output:     {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)")
    for index in (0, 199, 1999, 2000, 3999, 4000, 7999):
        item = words[index]
        print(f"  #{index+1:5d} t{item['t']} r{item['r']:<5d} {item['w']:<18s} {item['zh'][0][:42]}")
    return words


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    if not os.path.exists(csv_path):
        raise SystemExit(f"ECDICT CSV not found: {csv_path}\nSee the usage note at the top of this script.")
    build(csv_path)


