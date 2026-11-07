/**
 * 间隔重复算法（SM-2 变体 + 学习阶段）
 * ------------------------------------------------------------
 * 设计参考 Anki / SuperMemo SM-2：
 *   1. 新词先经过两个学习步骤（1 分钟、10 分钟），连续"记得"才毕业
 *   2. 毕业后进入复习阶段，间隔按难度因子 EF 增长
 *   3. 答错时 EF 衰减、间隔重置、重新进入学习步骤（"遗忘"计数 +1）
 *   4. EF 夹在 [1.3, 3.0]，间隔上限 365 天
 *
 * 评分为 4 档，与经典 SM-2 的 0-5 分级对应关系：
 *   AGAIN(0) 忘记  ← SM-2 <3
 *   HARD(1)  模糊
 *   GOOD(2)  记得
 *   EASY(3)  很简单
 *
 * 所有函数均为纯函数：输入 state 不被修改，返回新对象。
 */

import { MINUTE, DAY, clamp } from './util.js';

export const GRADE = Object.freeze({
  AGAIN: 0,
  HARD: 1,
  GOOD: 2,
  EASY: 3,
});

export const GRADE_META = Object.freeze([
  { key: 'again', label: '忘记了', hint: '重新学', tone: 'again' },
  { key: 'hard', label: '有点模糊', hint: '短间隔', tone: 'hard' },
  { key: 'good', label: '记得', hint: '正常', tone: 'good' },
  { key: 'easy', label: '很简单', hint: '长间隔', tone: 'easy' },
]);

export const STATUS = Object.freeze({
  NEW: 0,
  LEARNING: 1,
  REVIEW: 2,
  MASTERED: 3,
});

export const STATUS_LABEL = Object.freeze({
  0: '未学习',
  1: '学习中',
  2: '复习中',
  3: '已掌握',
});

export const EF_DEFAULT = 2.5;
export const EF_MIN = 1.3;
export const EF_MAX = 3.0;
export const LEARNING_STEPS = Object.freeze([1, 10]); // 分钟
export const EASY_INTERVAL = 4; // 天
export const GRADUATING_INTERVAL = 1; // 天
export const MAX_INTERVAL = 365; // 天
export const MATURE_INTERVAL = 21; // 天，视为"成熟词"

/** 全新词条的状态 */
export function defaultState() {
  return {
    s: STATUS.NEW, // 状态
    ef: EF_DEFAULT, // 难度因子
    iv: 0, // 当前间隔（天）
    reps: 0, // 进入复习阶段后的成功复习次数
    due: 0, // 下次到期时间戳
    last: 0, // 上次复习时间戳
    lapse: 0, // 遗忘次数
    star: 0, // 重点标记 0/1
    seen: 0, // 累计作答次数
    ok: 0, // 累计答对次数
    step: 0, // 学习步骤索引
  };
}

/**
 * 容错归一化：把外部（旧版本 / 手工导入）数据修补成合法状态
 */
export function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const num = (v, fallback, min, max) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return clamp(n, min, max);
  };
  const status = [0, 1, 2, 3].includes(Number(raw.s)) ? Number(raw.s) : 0;
  const state = {
    s: status,
    ef: num(raw.ef, EF_DEFAULT, EF_MIN, EF_MAX),
    iv: num(raw.iv, 0, 0, MAX_INTERVAL),
    reps: num(raw.reps, 0, 0, 100000),
    due: num(raw.due, 0, 0, Number.MAX_SAFE_INTEGER),
    last: num(raw.last, 0, 0, Number.MAX_SAFE_INTEGER),
    lapse: num(raw.lapse, 0, 0, 100000),
    star: raw.star ? 1 : 0,
    seen: num(raw.seen, 0, 0, 1000000),
    ok: num(raw.ok, 0, 0, 1000000),
    step: num(raw.step, 0, 0, LEARNING_STEPS.length),
  };
  if (state.s === STATUS.REVIEW && state.iv <= 0) state.iv = 1;
  if (state.s === STATUS.NEW) {
    state.due = 0;
    state.iv = 0;
  }
  return state;
}

/** 该状态是否需要在 now 之前复习 */
export function isDue(state, now = Date.now()) {
  if (!state) return false;
  if (state.s === STATUS.LEARNING || state.s === STATUS.REVIEW) {
    return state.due <= now;
  }
  return false;
}

/** 是否已掌握（不再出现在队列中） */
export function isMastered(state) {
  return !!state && state.s === STATUS.MASTERED;
}

/** 学习阶段的下一次间隔（毫秒），用于预览 */
function stepDelayMs(step) {
  const idx = clamp(step, 0, LEARNING_STEPS.length - 1);
  return LEARNING_STEPS[idx] * MINUTE;
}

/**
 * 核心：提交一次评分，返回新的状态
 * @param {object} prev 之前的状态（不会被修改）
 * @param {number} grade 0-3
 * @param {number} now 当前时间戳
 */
export function review(prev, grade, now = Date.now()) {
  if (!Number.isInteger(grade) || grade < 0 || grade > 3) {
    throw new RangeError(`无效的评分：${grade}，应为 0-3 的整数`);
  }
  const state = normalizeState(prev);
  if (state.s === STATUS.MASTERED) return state;

  state.seen += 1;
  if (grade >= GRADE.GOOD) state.ok += 1;
  state.last = now;

  if (state.s === STATUS.NEW || state.s === STATUS.LEARNING) {
    return advanceLearning(state, grade, now);
  }
  return advanceReview(state, grade, now);
}

/** 学习阶段推进 */
function advanceLearning(state, grade, now) {
  state.s = STATUS.LEARNING;

  if (grade === GRADE.AGAIN) {
    state.step = 0;
    state.due = now + stepDelayMs(0);
    return state;
  }

  if (grade === GRADE.HARD) {
    const idx = clamp(state.step, 0, LEARNING_STEPS.length - 1);
    state.step = idx;
    state.due = now + Math.round(LEARNING_STEPS[idx] * 1.5) * MINUTE;
    return state;
  }

  if (grade === GRADE.EASY) {
    state.s = STATUS.REVIEW;
    state.ef = clamp(state.ef + 0.15, EF_MIN, EF_MAX);
    state.iv = EASY_INTERVAL;
    state.reps += 1;
    state.step = 0;
    state.due = now + EASY_INTERVAL * DAY;
    return state;
  }

  // GOOD
  const next = state.step + 1;
  if (next >= LEARNING_STEPS.length) {
    state.s = STATUS.REVIEW;
    state.iv = GRADUATING_INTERVAL;
    state.reps += 1;
    state.step = 0;
    state.due = now + GRADUATING_INTERVAL * DAY;
    return state;
  }
  state.step = next;
  state.due = now + stepDelayMs(next);
  return state;
}

/** 复习阶段推进 */
function advanceReview(state, grade, now) {
  if (grade === GRADE.AGAIN) {
    state.lapse += 1;
    state.s = STATUS.LEARNING;
    state.step = 0;
    state.iv = 0;
    state.ef = clamp(state.ef - 0.2, EF_MIN, EF_MAX);
    state.due = now + stepDelayMs(0);
    return state;
  }

  let interval = state.iv > 0 ? state.iv : 1;
  if (grade === GRADE.HARD) {
    state.ef = clamp(state.ef - 0.15, EF_MIN, EF_MAX);
    interval = Math.max(1, Math.round(interval * 1.2));
  } else if (grade === GRADE.GOOD) {
    interval = Math.max(1, Math.round(interval * state.ef));
  } else {
    state.ef = clamp(state.ef + 0.15, EF_MIN, EF_MAX);
    // "简单"必须严格长于"记得"，否则两个按钮体感无差别
    const base = Math.max(1, Math.round(interval * state.ef));
    interval = Math.max(base + 1, Math.round(base * 1.3));
  }

  interval = Math.min(interval, MAX_INTERVAL);
  state.iv = interval;
  state.reps += 1;
  state.due = now + interval * DAY;
  return state;
}

/**
 * 预览四个按钮对应的下一次间隔（毫秒）
 * 用于在界面上直接显示"3 分钟 / 1 天 / 6 天"
 */
export function previewIntervals(prev, now = Date.now()) {
  return [0, 1, 2, 3].map((grade) => {
    const next = review(prev, grade, now);
    const delta = Math.max(0, next.due - now);
    return { grade, ms: delta, days: next.iv };
  });
}

/** 手动标记为已掌握（不再参与学习） */
export function markMastered(prev, now = Date.now()) {
  const state = normalizeState(prev);
  state.s = STATUS.MASTERED;
  state.iv = 0;
  state.due = 0;
  state.step = 0;
  state.last = now;
  return state;
}

/** 取消"已掌握"：回到之前的阶段（有复习记录→复习中，否则→新词） */
export function unmarkMastered(prev, now = Date.now()) {
  const state = normalizeState(prev);
  if (state.s !== STATUS.MASTERED) return state;
  if (state.reps > 0) {
    state.s = STATUS.REVIEW;
    state.iv = Math.max(1, state.iv || 1);
    state.due = now;
  } else {
    state.s = STATUS.NEW;
    state.iv = 0;
    state.due = 0;
  }
  return state;
}

/** 切换重点标记 */
export function toggleStar(prev) {
  const state = normalizeState(prev);
  state.star = state.star ? 0 : 1;
  return state;
}

/**
 * 记忆强度估算（0-1），用于可视化
 * 依据间隔长度与遗忘次数做对数映射
 */
export function memoryStrength(state) {
  if (!state) return 0;
  if (state.s === STATUS.MASTERED) return 1;
  if (state.s === STATUS.NEW) return 0;
  const intervalScore = Math.log2(1 + Math.max(0, state.iv)) / Math.log2(1 + MATURE_INTERVAL);
  const penalty = 1 / (1 + state.lapse * 0.35);
  const acc = state.seen > 0 ? state.ok / state.seen : 0.6;
  const score = intervalScore * 0.6 * penalty + acc * 0.4;
  return clamp(score, 0, 1);
}
