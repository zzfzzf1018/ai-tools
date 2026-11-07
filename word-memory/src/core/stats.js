/**
 * 统计计算
 * ------------------------------------------------------------
 * 全部为纯函数，输入 store / wordbook / 时间，输出展示用数据。
 * 遍历 8000 条记录的成本在毫秒级，界面可每次渲染重算。
 */

import { STATUS, MATURE_INTERVAL } from './srs.js';
import { DAY, dateKey, daysBetween, parseDateKey, startOfDay } from './util.js';

export function overview({ wordbook, store, settings, now = Date.now() }) {
  const records = store._rawWords();
  const levels = new Set(settings.levels || [1, 2, 3, 4]);

  let studied = 0;
  let learning = 0;
  let reviewing = 0;
  let mastered = 0;
  let mature = 0;
  let starred = 0;
  let dueNow = 0;
  let seenTotal = 0;
  let okTotal = 0;
  let scopeTotal = 0;

  for (let i = 0; i < wordbook.size; i += 1) {
    const row = wordbook.wordAt(i);
    if (!row) continue;
    if (levels.has(row.level)) scopeTotal += 1;
    const st = records[i];
    if (!st) continue;
    if (st.star) starred += 1;
    seenTotal += st.seen || 0;
    okTotal += st.ok || 0;
    if (st.s === STATUS.MASTERED) {
      mastered += 1;
      continue;
    }
    if (st.s === STATUS.NEW) continue;
    studied += 1;
    if (st.s === STATUS.LEARNING) learning += 1;
    else if (st.s === STATUS.REVIEW) {
      reviewing += 1;
      if (st.iv >= MATURE_INTERVAL) mature += 1;
    }
    if (st.due <= now) dueNow += 1;
  }

  const today = store.getDaily(dateKey(now));
  const accuracy = seenTotal > 0 ? okTotal / seenTotal : 0;
  const masteredRate = wordbook.size > 0 ? mastered / wordbook.size : 0;

  return {
    total: wordbook.size,
    scopeTotal,
    studied,
    learning,
    reviewing,
    mastered,
    mature,
    starred,
    dueNow,
    newCount: Math.max(0, wordbook.size - mastered - studied),
    accuracy,
    masteredRate,
    today: {
      newLearned: today.n,
      reviewed: today.r,
      answered: today.a,
      correct: today.c,
      ms: today.ms,
      accuracy: today.a > 0 ? today.c / today.a : 0,
    },
    streak: streakOf(store.allDaily(), now),
    activeDays: Object.values(store.allDaily()).filter((d) => d.n + d.r > 0).length,
  };
}

/** 连续打卡天数（允许今天还没开始，则从昨天算起） */
export function streakOf(daily, now = Date.now()) {
  let cursor = startOfDay(now);
  const key0 = dateKey(cursor);
  const active = (k) => {
    const d = daily[k];
    return !!d && d.n + d.r > 0;
  };
  if (!active(key0)) {
    cursor -= DAY;
    if (!active(dateKey(cursor))) return 0;
  }
  let streak = 0;
  while (active(dateKey(cursor))) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}

/** 未来 N 天的到期预测 */
export function forecast(store, now = Date.now(), days = 7) {
  const records = store._rawWords();
  const base = startOfDay(now);
  const buckets = new Array(days).fill(0);

  for (const st of Object.values(records)) {
    if (st.s !== STATUS.LEARNING && st.s !== STATUS.REVIEW) continue;
    if (st.due <= now) {
      buckets[0] += 1;
      continue;
    }
    const offset = Math.floor((st.due - base) / DAY);
    if (offset >= 0 && offset < days) buckets[offset] += 1;
  }
  return buckets;
}

/**
 * 活跃热力图（类似 GitHub 贡献图）
 * @returns {{weeks:number, cells: Array<{key:string, count:number, level:number, ts:number}>}}
 */
export function heatmap(store, now = Date.now(), weeks = 13) {
  const daily = store.allDaily();
  const today = startOfDay(now);
  const weekday = new Date(today).getDay(); // 0=周日
  const offsetToMonday = (weekday + 6) % 7;
  const end = today + (6 - offsetToMonday) * DAY; // 本周周日
  const start = end - (weeks * 7 - 1) * DAY;

  const counts = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const ts = start + i * DAY;
    const key = dateKey(ts);
    const d = daily[key];
    counts.push({ key, ts, count: d ? d.n + d.r : 0, raw: d || null });
  }
  const max = Math.max(1, ...counts.map((c) => c.count));
  const cells = counts.map((c) => ({
    ...c,
    level: c.count === 0 ? 0 : Math.min(4, Math.ceil((c.count / max) * 4)),
  }));

  const total = cells.reduce((sum, c) => sum + c.count, 0);
  return { weeks, cells, total, start, end };
}

/** 最近 N 天的学习量序列（用于折线/柱状图） */
export function recentSeries(store, now = Date.now(), days = 14) {
  const daily = store.allDaily();
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const ts = startOfDay(now) - i * DAY;
    const key = dateKey(ts);
    const d = daily[key] || { n: 0, r: 0, c: 0, a: 0, ms: 0 };
    out.push({ key, ts, newLearned: d.n, reviewed: d.r, total: d.n + d.r, accuracy: d.a ? d.c / d.a : 0 });
  }
  return out;
}

/** 距上次学习过去了多久 */
export function daysSinceLastStudy(store, now = Date.now()) {
  const keys = Object.keys(store.allDaily())
    .filter((k) => {
      const d = store.allDaily()[k];
      return d && d.n + d.r > 0;
    })
    .sort();
  if (!keys.length) return null;
  const last = parseDateKey(keys[keys.length - 1]);
  if (Number.isNaN(last)) return null;
  return daysBetween(last, now);
}
