/**
 * 自定义词库解析与校验
 * ------------------------------------------------------------
 * 支持三种导入格式：
 *   1. JSON —— 本项目 words.json 结构 / 对象数组 / 顶层数组 / 「单词:释义」映射
 *   2. CSV —— word,meaning[,phonetic[,level]]，支持引号与逗号转义
 *   3. TXT —— 每行用 Tab、逗号或空格分隔，# 开头为注释
 *
 * 统一输出与内置词库完全相同的 payload：
 *   { meta: { name, version, count, source, sourceHash, fields, levels },
 *     words: [[word, meaning, phonetic, level], ...] }
 *
 * 索引即学习记录的主键，因此同一个词库导入后顺序必须稳定；
 * 重复单词（忽略大小写）只保留第一次出现。
 */

export const MIN_WORDS = 1;
export const MAX_WORDS = 50000;
export const MAX_MEANING_LEN = 300;

export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** CSV 单行切分（支持双引号包裹与 "" 转义） */
export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if ((ch === ',' || ch === '\t') && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function cleanWord(raw) {
  return String(raw ?? '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();
}

function cleanMeaning(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_MEANING_LEN);
}

function cleanPhonetic(raw) {
  return String(raw ?? '').trim().replace(/^\/|\/$/g, '').trim();
}

function normalizeLevel(raw, index, total) {
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 4) return n;
  // 与内置 8000 词库一致的四档比例：1/8、2/8、2.5/8、2.5/8
  const r = total > 0 ? index / total : 0;
  if (r < 0.125) return 1;
  if (r < 0.375) return 2;
  if (r < 0.6875) return 3;
  return 4;
}

/** 从任意 JSON 结构中抽取 [word, meaning, phonetic, level] 四元组列表 */
function rowsFromJson(data) {
  if (Array.isArray(data)) {
    return data.map((row) => (Array.isArray(row)
      ? row
      : [row?.word ?? row?.w ?? row?.name, row?.meaning ?? row?.m ?? row?.definition ?? row?.trans, row?.phonetic ?? row?.p ?? row?.ipa, row?.level ?? row?.lv]));
  }
  if (!data || typeof data !== 'object') throw new Error('JSON 内容不是对象或数组');

  if (Array.isArray(data.words)) return rowsFromJson(data.words);

  // 「单词 → 释义」映射
  const keys = Object.keys(data).filter((k) => !['meta', 'name', 'version', 'count', 'source', 'fields', 'levels'].includes(k));
  if (keys.length) {
    return keys.map((word) => {
      const value = data[word];
      return Array.isArray(value)
        ? [word, ...value]
        : [word, typeof value === 'object' ? value?.meaning ?? value?.m : value];
    });
  }
  throw new Error('未找到词条数据（需要 words 数组或「单词:释义」对象）');
}

function rowsFromText(text) {
  const rows = [];
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    const cells = splitCsvLine(trimmed);
    if (cells.length >= 2) {
      rows.push(cells);
      continue;
    }
    // 单列时用空白分隔：word meaning
    const m = trimmed.match(/^(\S+)\s+(.+)$/);
    if (m) rows.push([m[1], m[2]]);
    else rows.push([trimmed, '']);
  }
  if (rows.length === 1 && rows[0].length >= 2 && /^(word|单词|term)$/i.test(rows[0][0])) {
    return []; // 只有表头
  }
  // 去掉疑似表头行
  if (rows.length > 1 && /^(word|单词|term)$/i.test(rows[0][0]) && /释义|meaning|翻译|解释|definition/i.test(rows[0][1])) {
    rows.shift();
  }
  return rows;
}

/**
 * 解析词库文本
 * @param {string} text 文件内容
 * @param {object} options
 * @param {string} options.filename 用于判断格式与默认名称
 * @param {string} options.name 词库显示名
 * @returns {{meta: object, words: array}}
 */
export function parseBook(text, options = {}) {
  const { filename = '', name = '' } = options;
  const content = String(text ?? '').trim();
  if (!content) throw new Error('文件是空的');

  const isJson = /\.json$/i.test(filename) || /^[[{]/.test(content);
  let rows;
  let suppliedMeta = {};
  if (isJson) {
    let data;
    try {
      data = JSON.parse(content);
    } catch (err) {
      throw new Error(`JSON 解析失败：${err.message}`);
    }
    suppliedMeta = data && !Array.isArray(data) && data.meta && typeof data.meta === 'object' ? data.meta : {};
    rows = rowsFromJson(data);
  } else {
    rows = rowsFromText(content);
  }

  const seen = new Set();
  const words = [];
  let skipped = 0;
  const total = rows.length;
  for (let i = 0; i < total; i += 1) {
    const row = Array.isArray(rows[i]) ? rows[i] : [rows[i]];
    const word = cleanWord(row[0]);
    const meaning = cleanMeaning(row[1]);
    if (!word || !meaning || seen.has(word.toLowerCase())) {
      skipped += 1;
      continue;
    }
    if (word.length > 64) {
      skipped += 1;
      continue;
    }
    seen.add(word.toLowerCase());
    words.push([word, meaning, cleanPhonetic(row[2]), normalizeLevel(row[3], words.length, total)]);
  }

  if (words.length < MIN_WORDS) throw new Error('没有解析出有效词条（每行需要「单词 + 释义」）');
  if (words.length > MAX_WORDS) throw new Error(`词条数 ${words.length} 超过上限 ${MAX_WORDS}`);

  const baseName = name.trim() || suppliedMeta.name || filename.replace(/\.[^.]+$/, '') || '自定义词库';
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const row of words) counts[row[3]] = (counts[row[3]] || 0) + 1;
  const ranges = { 1: '1-1000', 2: '1001-3000', 3: '3001-5500', 4: '5501-8000' };
  const labels = { 1: '核心', 2: '常用', 3: '进阶', 4: '拓展' };
  const levels = {};
  for (const lv of [1, 2, 3, 4]) {
    levels[lv] = { name: labels[lv], range: ranges[lv], count: counts[lv] || 0 };
  }

  return {
    meta: {
      name: String(baseName).slice(0, 60),
      version: 'custom',
      count: words.length,
      source: isJson ? '用户导入（JSON）' : '用户导入（文本）',
      sourceHash: fnv1a(content),
      fields: ['word', 'meaning', 'phonetic', 'level'],
      custom: true,
      skipped,
      levels,
    },
    words,
  };
}

/** 校验一个词库 payload 是否可被 createWordbook 接受 */
export function validateBook(payload) {
  if (!payload || !Array.isArray(payload.words)) throw new Error('词库缺少 words 数组');
  if (!payload.words.length) throw new Error('词库不能为空');
  for (let i = 0; i < payload.words.length; i += 1) {
    const row = payload.words[i];
    if (!Array.isArray(row) || row.length < 2) throw new Error(`第 ${i + 1} 条格式错误`);
    if (!String(row[0] || '').trim()) throw new Error(`第 ${i + 1} 条缺少单词`);
    if (!String(row[1] || '').trim()) throw new Error(`第 ${i + 1} 条缺少释义`);
    if (![1, 2, 3, 4].includes(Number(row[3]))) throw new Error(`第 ${i + 1} 条频段非法`);
  }
  return payload;
}

/** 词库导出为易读 JSON */
export function serializeBook(payload) {
  return JSON.stringify(payload, null, 2);
}
