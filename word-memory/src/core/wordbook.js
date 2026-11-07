/**
 * 词库索引层
 * ------------------------------------------------------------
 * 负责把 data/words.json 的紧凑数组转成查询友好的结构，
 * 并提供搜索、按频段筛选、随机取样等能力。
 *
 * 数据格式：words = [[word, meaning, phonetic, level], ...]
 * 索引即词频顺序（0 为最高频），排序稳定，可作为持久化键使用。
 */

export function createWordbook(payload) {
  if (!payload || !Array.isArray(payload.words)) {
    throw new TypeError('词库数据非法：缺少 words 数组');
  }
  const words = payload.words;
  const meta = payload.meta || {};
  const size = words.length;

  // 预建小写索引，避免搜索时反复 toLowerCase
  const lower = new Array(size);
  for (let i = 0; i < size; i += 1) {
    lower[i] = String(words[i][0] || '').toLowerCase();
  }

  const levelBuckets = { 1: [], 2: [], 3: [], 4: [] };
  for (let i = 0; i < size; i += 1) {
    const lv = words[i][3] || 1;
    if (levelBuckets[lv]) levelBuckets[lv].push(i);
  }

  function wordAt(index) {
    const row = words[index];
    if (!row) return null;
    return {
      index,
      word: row[0],
      meaning: row[1] || '',
      phonetic: row[2] || '',
      level: row[3] || 1,
    };
  }

  /**
   * 搜索：精确 > 前缀 > 包含 > 释义包含
   * @returns {number[]} 索引数组
   */
  function search(query, limit = 120) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];

    const exact = [];
    const prefix = [];
    const contains = [];
    const inMeaning = [];
    const max = Math.max(1, limit);

    for (let i = 0; i < size; i += 1) {
      const w = lower[i];
      if (w === q) {
        exact.push(i);
        continue;
      }
      if (w.startsWith(q)) {
        if (prefix.length < max) prefix.push(i);
        continue;
      }
      if (w.includes(q)) {
        if (contains.length < max) contains.push(i);
        continue;
      }
      if (inMeaning.length < max && words[i][1] && words[i][1].includes(q)) {
        inMeaning.push(i);
      }
    }

    return [...exact, ...prefix, ...contains, ...inMeaning].slice(0, max);
  }

  /** 按频段取索引 */
  function byLevel(level) {
    return (levelBuckets[level] || []).slice();
  }

  /** 全部索引 */
  function allIndices() {
    const out = new Array(size);
    for (let i = 0; i < size; i += 1) out[i] = i;
    return out;
  }

  return {
    meta,
    size,
    wordAt,
    search,
    byLevel,
    allIndices,
    levels: [1, 2, 3, 4],
    get dataVersion() {
      return `${meta.version || 'unknown'}-${meta.sourceHash || 'nosource'}-${size}`;
    },
  };
}
