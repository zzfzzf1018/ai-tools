/**
 * 学习队列调度
 * ------------------------------------------------------------
 * 负责把"该学的词"挑选出来并排成一次会话的顺序：
 *   1. 到期复习（含中断的学习中词条）优先，重点标记的词再优先
 *   2. 新词按设定顺序（词频 / 乱序）补充，受每日上限约束
 *   3. 两者按比例交错，避免连续复习过于枯燥
 */

import { STATUS } from './srs.js';
import { dateKey, mulberry32, shuffled } from './util.js';

/**
 * 均匀交错两个序列
 * 例：interleave([a1..a9], [b1]) → 每 10 张出现 1 张新词
 */
export function interleave(reviews, fresh) {
  const a = reviews;
  const b = fresh;
  const total = a.length + b.length;
  if (!a.length) return b.slice();
  if (!b.length) return a.slice();

  const out = [];
  let ai = 0;
  let bi = 0;

  for (let k = 0; k < total; k += 1) {
    // 用整数运算算出"到第 k 张为止应当插入多少张新词"，避免浮点误差导致新词扎堆在开头
    const targetB = Math.floor(((k + 1) * b.length) / total);
    if (bi < b.length && bi < targetB) {
      out.push(b[bi]);
      bi += 1;
    } else if (ai < a.length) {
      out.push(a[ai]);
      ai += 1;
    } else {
      out.push(b[bi]);
      bi += 1;
    }
  }
  return out;
}

/**
 * 构建今日队列
 * @param {object} params
 * @param {object} params.wordbook 词库
 * @param {object} params.store 状态存储
 * @param {object} params.settings 设置
 * @param {number} params.now 当前时间
 * @param {number} [params.seed] 随机种子（乱序模式使用，保证一天内稳定）
 */
export function buildQueue({ wordbook, store, settings, now = Date.now(), seed }) {
  const levels = new Set(settings.levels && settings.levels.length ? settings.levels : [1, 2, 3, 4]);
  const records = store._rawWords();

  const dueList = [];
  const freshList = [];

  for (let i = 0; i < wordbook.size; i += 1) {
    const row = wordbook.wordAt(i);
    if (!row || !levels.has(row.level)) continue;
    const st = records[i];

    if (!st || st.s === STATUS.NEW) {
      freshList.push(i);
      continue;
    }
    if (st.s === STATUS.MASTERED) continue;
    if (st.due <= now) dueList.push(i);
  }

  // 复习排序：重点词优先，其次到期更早的优先，再次遗忘多的优先
  dueList.sort((x, y) => {
    const sx = records[x];
    const sy = records[y];
    const starDiff = (sy.star ? 1 : 0) - (sx.star ? 1 : 0);
    if (starDiff !== 0) return starDiff;
    const dueDiff = (sx.due || 0) - (sy.due || 0);
    if (dueDiff !== 0) return dueDiff;
    return (sy.lapse || 0) - (sx.lapse || 0);
  });

  // 新词排序
  const starFresh = freshList.filter((i) => records[i] && records[i].star);
  const normalFresh = freshList.filter((i) => !(records[i] && records[i].star));

  if (settings.order === 'random') {
    const rand = mulberry32(seed ?? hashSeed(dateKey(now)));
    shuffled(normalFresh, rand).forEach((v, k) => {
      normalFresh[k] = v;
    });
  }
  const orderedFresh = [...starFresh, ...normalFresh];

  const today = store.getDaily(dateKey(now));
  const newLeft = Math.max(0, (settings.newPerDay ?? 20) - today.n);
  const reviewLeft = Math.max(0, (settings.reviewPerDay ?? 200) - today.r);

  const reviews = dueList.slice(0, reviewLeft);
  const freshWords = orderedFresh.slice(0, newLeft);

  const sessionCap = Math.max(5, settings.sessionSize ?? 20);
  let queue;
  if (settings.order === 'new-first' && freshWords.length && reviews.length) {
    queue = [...freshWords.slice(0, Math.ceil(sessionCap / 2)), ...reviews].slice(0, sessionCap);
  } else {
    queue = interleave(reviews, freshWords).slice(0, sessionCap);
  }

  return {
    queue,
    dueCount: dueList.length,
    freshCount: freshList.length,
    dueLimited: Math.max(0, dueList.length - reviewLeft),
    freshLimited: Math.max(0, orderedFresh.length - newLeft),
    newLeftToday: newLeft,
    reviewLeftToday: reviewLeft,
  };
}

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 计算"今日概览"用的到期数量（不做上限截断）
 */
export function countDue({ wordbook, store, settings, now = Date.now() }) {
  const levels = new Set(settings.levels || [1, 2, 3, 4]);
  const records = store._rawWords();
  let due = 0;
  let fresh = 0;
  for (let i = 0; i < wordbook.size; i += 1) {
    const row = wordbook.wordAt(i);
    if (!row || !levels.has(row.level)) continue;
    const st = records[i];
    if (!st || st.s === STATUS.NEW) {
      fresh += 1;
      continue;
    }
    if (st.s !== STATUS.MASTERED && st.due <= now) due += 1;
  }
  return { due, fresh };
}
