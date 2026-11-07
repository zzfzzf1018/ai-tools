#!/usr/bin/env node
/**
 * 词库数据管道
 * ------------------------------------------------------------
 * 输入：COCA 20000 词频表（含中文释义与英式音标），来自
 *       qwerty-learner 开源词典（MIT）。
 * 输出：data/words.json —— 8000 条最常用词汇的精简数据集。
 *
 * 清洗规则（保证可复现，同一输入必得同一输出）：
 *   1. 按词频顺序遍历，保留首次出现的词条作为排名
 *   2. 仅保留纯英文词形（允许连字符、撇号）
 *   3. 剔除首字母大写的专有名词（保留 I / TV / OK 等极常用缩写白名单）
 *   4. 剔除脏话与冒犯性词汇
 *   5. 剔除释义缺失、含替换字符(U+FFFD)等损坏记录
 *   6. 释义压缩：按词性切分，每词性最多 2 个义项，最多 2 个词性，
 *      总长上限 42 字符，超出截断
 *   7. 按排名切成 4 个频段（level 1-4）
 *
 * 用法：
 *   node scripts/build-data.mjs          # 有缓存则用缓存
 *   node scripts/build-data.mjs --fetch  # 强制重新下载源数据
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'coca20000.json');
const OUT_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(OUT_DIR, 'words.json');

const SOURCE_URL =
  'https://cdn.jsdelivr.net/gh/Kaiyiwing/qwerty-learner@master/public/dicts/coca20000.json';
const SOURCE_LABEL = 'COCA 20000 frequency list (via qwerty-learner)';

const TARGET_COUNT = 8000;
const MAX_MEANING_LEN = 48;
const MAX_SENSE_PER_POS = 2;
const MAX_POS = 2;

/** 保留的极常用大写词形（其余首字母大写词视为专有名词剔除） */
const KEEP_UPPER = new Set([
  'I', 'OK', 'TV', 'Mr', 'Mrs', 'Ms', 'Dr', 'PC', 'CEO', 'DNA', 'GDP', 'IQ',
]);

/** 需要剔除的冒犯性词汇（学习场景屏蔽） */
const BLOCKED = new Set([
  'fuck', 'fucking', 'fucked', 'fucker', 'shit', 'shitty', 'bitch', 'bitches',
  'bastard', 'asshole', 'arsehole', 'cunt', 'nigger', 'nigga', 'whore', 'slut',
  'dick', 'cock', 'pussy', 'piss', 'prick', 'retard', 'retarded', 'bollocks',
  'boobs', 'tits', 'porn', 'porno', 'rape', 'raped', 'rapist', 'suck', 'sucks',
  'crap', 'damn', 'goddamn', 'penis', 'vagina', 'semen', 'orgasm', 'condom',
]);

const POS_TOKENS = [
  'vt', 'vi', 'adj', 'adv', 'prep', 'conj', 'pron', 'art', 'num', 'int',
  'aux', 'abbr', 'pl', 'ad', 'n', 'v', 'a',
];
const POS_RE = new RegExp(
  `(?<![A-Za-z])(${POS_TOKENS.join('|')})\\.`,
  'g',
);

const WORD_RE = /^[A-Za-z][A-Za-z'-]*$/;

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

async function ensureSource(force) {
  if (!force && fs.existsSync(CACHE_FILE)) {
    log(`· 使用缓存源数据：${path.relative(ROOT, CACHE_FILE)}`);
    return fs.readFileSync(CACHE_FILE);
  }
  log(`· 正在下载源数据：${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`下载失败：HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, buf);
  log(`· 已缓存 ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
  return buf;
}

/** 归一化单词：去首尾空白、合并重复撇号、压缩内部空白 */
function normalizeWord(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['']{2,}/g, "'")
    .replace(/^[-']+|[-']+$/g, '');
}

/** 清理音标：去掉缺省音标的占位连字符 */
function tidyPhonetic(uk, us) {
  const pick = (v) => (typeof v === 'string' ? v.trim().replace(/^[-—–]+/, '') : '');
  const out = pick(uk) || pick(us);
  // 音标里不应出现中文与替换字符
  if (/[\u4e00-\u9fff\ufffd]/.test(out)) return '';
  return out.slice(0, 48);
}

/**
 * 释义压缩：按词性切分，保留有限义项
 * 例：`adj.肥的,胖的,厚的,大量的n.脂肪,肥肉` → `adj. 肥的；胖的 n. 脂肪；肥肉`
 */
function tidyMeaning(rawTrans) {
  if (!Array.isArray(rawTrans)) return '';
  const joined = rawTrans
    .filter((t) => typeof t === 'string')
    .join('，')
    .replace(/\uFFFD/g, '')
    .replace(/[，,]{2,}/g, '，')
    .replace(/\s+/g, ' ')
    .trim();
  if (!joined) return '';
  if (/^(无|無|none|null|-|—|－)$/i.test(joined)) return '';

  // 切分为 [前缀, pos, 内容, pos, 内容, ...]
  POS_RE.lastIndex = 0;
  const parts = joined.split(POS_RE);
  const raw = [];
  const head = (parts[0] || '').trim();
  if (head) raw.push({ pos: '', body: head });
  for (let i = 1; i < parts.length; i += 2) {
    raw.push({ pos: parts[i], body: (parts[i + 1] || '').trim() });
  }
  if (raw.length === 0) return '';

  // 合并形如 `vt.& vi.碰撞` 的空段：把 & 前挂到后一个词性上
  const segments = [];
  let pendingPos = [];
  for (const seg of raw) {
    const body = seg.body.replace(/^[&；;、\s]+/, '').trim();
    const meaningful = /[^\s&]/.test(seg.body);
    if (!meaningful) {
      if (seg.pos) pendingPos.push(seg.pos);
      continue;
    }
    const posList = [...pendingPos, seg.pos].filter(Boolean);
    pendingPos = [];
    segments.push({ posList, body });
  }
  if (segments.length === 0) return '';

  const rendered = [];
  for (const seg of segments) {
    if (rendered.length >= MAX_POS) break;
    const senses = seg.body
      .split(/[，,]/)
      .map((s) => s.trim().replace(/^[&；;、]+/, '').trim())
      .filter((s) => s && /[^\s&]/.test(s))
      .slice(0, MAX_SENSE_PER_POS);
    if (!senses.length) continue;
    let prefix = '';
    if (seg.posList.length === 1) prefix = `${seg.posList[0]}. `;
    else if (seg.posList.length > 1) prefix = `${seg.posList[0]}.& ${seg.posList.slice(1).join('.& ')}. `;
    rendered.push(`${prefix}${senses.join('；')}`);
  }

  let out = rendered.join('  ').replace(/\s{2,}/g, ' ').trim();
  if (!out) return '';
  if (out.length > MAX_MEANING_LEN) {
    out = `${out.slice(0, MAX_MEANING_LEN - 1)}…`;
  }
  return out;
}

function levelOf(rank) {
  if (rank <= 1000) return 1;
  if (rank <= 3000) return 2;
  if (rank <= 5500) return 3;
  return 4;
}

function isAcceptable(name) {
  if (!WORD_RE.test(name)) return false;
  if (name.length < 1 || name.length > 32) return false;
  const lower = name.toLowerCase();
  if (BLOCKED.has(lower)) return false;
  // 剔除首字母大写的专名（保留白名单）
  if (name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase()) {
    return KEEP_UPPER.has(name);
  }
  // 全大写缩写（如 HMO / NCAA）价值较低，剔除
  if (name.length > 1 && name === name.toUpperCase()) return false;
  return true;
}

function build(sourceBuf) {
  const raw = JSON.parse(sourceBuf.toString('utf8'));
  if (!Array.isArray(raw)) throw new Error('源数据格式异常：期望数组');

  const seen = new Set();
  const words = [];
  let rank = 0;
  const rejected = { duplicate: 0, improperNoun: 0, blocked: 0, badMeaning: 0, badWord: 0 };

  for (const entry of raw) {
    if (words.length >= TARGET_COUNT) break;
    const name = normalizeWord(entry?.name);
    if (!name) {
      rejected.badWord += 1;
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      rejected.duplicate += 1;
      continue;
    }
    seen.add(key);

    if (BLOCKED.has(key)) {
      rejected.blocked += 1;
      continue;
    }
    if (!isAcceptable(name)) {
      rejected.improperNoun += 1;
      continue;
    }
    const meaning = tidyMeaning(entry?.trans);
    if (!meaning) {
      rejected.badMeaning += 1;
      continue;
    }
    rank += 1;
    words.push([
      name,
      meaning,
      tidyPhonetic(entry?.ukphone, entry?.usphone),
      levelOf(rank),
    ]);
  }

  return { words, rejected, sourceCount: raw.length };
}

async function main() {
  const force = process.argv.includes('--fetch');
  const buf = await ensureSource(force);
  const sourceHash = crypto.createHash('sha256').update(buf).digest('hex');
  const { words, rejected, sourceCount } = build(buf);

  if (words.length < TARGET_COUNT * 0.99) {
    throw new Error(
      `词条数量不足：期望 ${TARGET_COUNT}，实际 ${words.length}`,
    );
  }

  const levelCount = [0, 0, 0, 0, 0];
  for (const w of words) levelCount[w[3]] += 1;

  const payload = {
    meta: {
      name: 'WordMemory 8000 核心词库',
      version: '1.0.0',
      count: words.length,
      source: SOURCE_LABEL,
      sourceUrl: SOURCE_URL,
      sourceHash: sourceHash.slice(0, 16),
      sourceCount,
      levels: {
        1: { name: '核心', range: '1-1000', count: levelCount[1] },
        2: { name: '常用', range: '1001-3000', count: levelCount[2] },
        3: { name: '进阶', range: '3001-5500', count: levelCount[3] },
        4: { name: '拓展', range: '5501-8000', count: levelCount[4] },
      },
      fields: ['word', 'meaning', 'phonetic', 'level'],
    },
    words,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const json = JSON.stringify(payload);
  fs.writeFileSync(OUT_FILE, json, 'utf8');

  const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(1);
  log('');
  log('数据构建完成');
  log(`  输出文件：${path.relative(ROOT, OUT_FILE)}  ${sizeKB} KB`);
  log(`  词条数量：${words.length}`);
  log(`  频段分布：核心 ${levelCount[1]} / 常用 ${levelCount[2]} / 进阶 ${levelCount[3]} / 拓展 ${levelCount[4]}`);
  log(`  清洗剔除：重复 ${rejected.duplicate}、专名 ${rejected.improperNoun}、敏感 ${rejected.blocked}、` +
      `坏释义 ${rejected.badMeaning}、非法词形 ${rejected.badWord}`);
  log(`  源数据指纹：${sourceHash.slice(0, 16)}`);
  log('');
  log('样例：');
  for (const i of [0, 1, 500, 1999, 4999, 7999]) {
    const w = words[i];
    if (w) log(`  #${i + 1}  ${w[0]}  [${w[2] || '无音标'}]  L${w[3]}  ${w[1]}`);
  }
}

main().catch((err) => {
  process.stderr.write(`构建失败：${err.stack || err.message}\n`);
  process.exit(1);
});
