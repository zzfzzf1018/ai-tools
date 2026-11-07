/**
 * 学习会话状态机
 * ------------------------------------------------------------
 * 一次会话 = 构建好的队列 + 掌握节奏。
 *
 * 特殊处理：
 *   - 学习中（间隔 < 10 分钟）的卡片在本轮内重新排队，
 *     让"刚忘掉的词"在同一次会话里再出现一次；
 *   - 同一张卡最多出现 3 次，防止死循环；
 *   - 每张卡记录作答耗时，用于统计专注度。
 */

import { GRADE, STATUS, previewIntervals } from './srs.js';
import { MINUTE } from './util.js';

const MAX_APPEARANCE = 3;
/** 到期时间小于该阈值的卡片在本轮内重新排队（即"刚忘掉"的词立刻再问一次） */
const IN_SESSION_REQUEUE_MS = 3 * MINUTE;

export function createSession({ wordbook, store, settings, queue, now = () => Date.now() }) {
  let items = queue.map((index) => ({ index, attempts: 0 }));
  const planned = items.length;
  const startedAt = now();
  let cardShownAt = startedAt;
  let finishedAt = 0;
  const listeners = new Set();
  const log = [];

  const stats = {
    answered: 0,
    correct: 0,
    newLearned: 0,
    reviewed: 0,
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    totalMs: 0,
  };

  function emit() {
    for (const fn of listeners) {
      try {
        fn(session);
      } catch {
        /* 忽略订阅者异常 */
      }
    }
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function current() {
    const item = items[0];
    if (!item) return null;
    const word = wordbook.wordAt(item.index);
    const state = store.getState(item.index);
    const preview = previewIntervals(state, now()).map((p) => ({
      ...p,
      isNew: state.s === STATUS.NEW || state.s === STATUS.LEARNING,
    }));
    return {
      index: item.index,
      word,
      state,
      preview,
      attempt: item.attempts + 1,
      isNew: state.s === STATUS.NEW,
    };
  }

  function submit(grade, at = now()) {
    const item = items[0];
    if (!item) return { finished: true, next: null };

    const before = store.getState(item.index);
    const firstEncounter = (before.seen || 0) === 0;
    const elapsed = Math.max(0, Math.min(at - cardShownAt, 5 * MINUTE));

    const after = store.recordReview(item.index, grade, at);

    item.attempts += 1;
    stats.answered += 1;
    stats.totalMs += elapsed;
    if (grade >= GRADE.GOOD) stats.correct += 1;
    if (grade === GRADE.AGAIN) stats.again += 1;
    else if (grade === GRADE.HARD) stats.hard += 1;
    else if (grade === GRADE.GOOD) stats.good += 1;
    else stats.easy += 1;

    if (firstEncounter) stats.newLearned += 1;
    else stats.reviewed += 1;

    store.bumpDaily(
      {
        n: firstEncounter ? 1 : 0,
        r: firstEncounter ? 0 : 1,
        c: grade >= GRADE.GOOD ? 1 : 0,
        a: 1,
        ms: elapsed,
      },
      at,
    );

    log.push({ index: item.index, grade, at, ms: elapsed });

    const delay = after.due - at;
    const needsRequeue =
      (after.s === STATUS.LEARNING || after.s === STATUS.REVIEW) &&
      delay >= 0 &&
      delay <= IN_SESSION_REQUEUE_MS &&
      item.attempts < MAX_APPEARANCE;

    items.shift();
    if (needsRequeue) {
      const pos = Math.min(items.length, 3);
      items.splice(pos, 0, item);
    }

    cardShownAt = at;
    if (!items.length) finishedAt = at;
    emit();

    return { finished: items.length === 0, next: current(), lastState: after };
  }

  /** 跳过当前卡（不记录评分，移到队尾；仅剩一张时直接移除） */
  function skip(at = now()) {
    const item = items[0];
    if (!item) return { finished: true };
    items.shift();
    if (items.length > 0) {
      items.push(item);
    }
    cardShownAt = at;
    if (!items.length) finishedAt = at;
    emit();
    return { finished: items.length === 0, next: current() };
  }

  /** 移除当前卡且不记录评分（用于"标记已掌握"） */
  function drop(at = now()) {
    if (!items.length) return { finished: true };
    items.shift();
    cardShownAt = at;
    if (!items.length) finishedAt = at;
    emit();
    return { finished: items.length === 0, next: current() };
  }

  /** 提前结束本轮：丢弃剩余卡片 */
  function finish() {
    items = [];
    finishedAt = now();
    store.flush();
    emit();
    return summary();
  }

  function end() {
    store.flush();
    return summary();
  }

  function summary() {
    const total = stats.answered;
    return {
      planned,
      answered: stats.answered,
      correct: stats.correct,
      accuracy: total ? stats.correct / total : 0,
      newLearned: stats.newLearned,
      reviewed: stats.reviewed,
      durationMs: (finishedAt || now()) - startedAt,
      again: stats.again,
      hard: stats.hard,
      good: stats.good,
      easy: stats.easy,
      remaining: items.length,
      log: log.slice(),
    };
  }

  const session = {
    get planned() {
      return planned;
    },
    get size() {
      return items.length;
    },
    get done() {
      return stats.answered;
    },
    get remaining() {
      return items.length;
    },
    get finished() {
      return items.length === 0;
    },
    get stats() {
      return { ...stats };
    },
    get startedAt() {
      return startedAt;
    },
    current,
    submit,
    skip,
    drop,
    finish,
    end,
    summary,
    onChange,
  };

  return session;
}
