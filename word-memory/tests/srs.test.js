import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GRADE,
  STATUS,
  EF_MAX,
  EF_MIN,
  MAX_INTERVAL,
  defaultState,
  normalizeState,
  review,
  isDue,
  previewIntervals,
  markMastered,
  unmarkMastered,
  toggleStar,
  memoryStrength,
} from '../src/core/srs.js';
import { MINUTE, DAY } from '../src/core/util.js';

const T = 1_800_000_000_000;

test('新词首次"记得"进入学习第 2 步，间隔 10 分钟', () => {
  const next = review(defaultState(), GRADE.GOOD, T);
  assert.equal(next.s, STATUS.LEARNING);
  assert.equal(next.step, 1);
  assert.equal(next.due - T, 10 * MINUTE);
  assert.equal(next.seen, 1);
  assert.equal(next.ok, 1);
});

test('连续两次"记得"后毕业，间隔 1 天', () => {
  let st = review(defaultState(), GRADE.GOOD, T);
  st = review(st, GRADE.GOOD, T + 20 * MINUTE);
  assert.equal(st.s, STATUS.REVIEW);
  assert.equal(st.iv, 1);
  assert.equal(st.due - (T + 20 * MINUTE), DAY);
  assert.equal(st.reps, 1);
});

test('"很简单"直接毕业，间隔 4 天', () => {
  const st = review(defaultState(), GRADE.EASY, T);
  assert.equal(st.s, STATUS.REVIEW);
  assert.equal(st.iv, 4);
  assert.equal(st.ef, 2.65);
});

test('"忘记了"回到学习第一步，间隔 1 分钟', () => {
  const st = review(defaultState(), GRADE.AGAIN, T);
  assert.equal(st.s, STATUS.LEARNING);
  assert.equal(st.step, 0);
  assert.equal(st.due - T, 1 * MINUTE);
  assert.equal(st.ok, 0);
  assert.equal(st.seen, 1);
});

test('复习阶段"记得"按 EF 增长间隔', () => {
  let st = { ...defaultState(), s: STATUS.REVIEW, iv: 10, reps: 3, seen: 5, ok: 5 };
  st = review(st, GRADE.GOOD, T);
  assert.equal(st.iv, 25); // 10 * 2.5
  assert.equal(st.due - T, 25 * DAY);
});

test('复习阶段"很简单"严格长于"记得"', () => {
  const base = { ...defaultState(), s: STATUS.REVIEW, iv: 10, reps: 3 };
  const good = review(base, GRADE.GOOD, T);
  const easy = review(base, GRADE.EASY, T);
  assert.ok(easy.iv > good.iv, `easy(${easy.iv}) 应大于 good(${good.iv})`);
  assert.ok(easy.ef > good.ef);
});

test('复习阶段"忘记了"重置间隔、累加 lapse 并降低 EF', () => {
  const base = { ...defaultState(), s: STATUS.REVIEW, iv: 60, ef: 2.5, reps: 4 };
  const st = review(base, GRADE.AGAIN, T);
  assert.equal(st.s, STATUS.LEARNING);
  assert.equal(st.iv, 0);
  assert.equal(st.lapse, 1);
  assert.equal(st.ef, 2.3);
  assert.equal(st.due - T, 1 * MINUTE);
});

test('EF 收敛在 [1.3, 3.0]', () => {
  let st = { ...defaultState(), s: STATUS.REVIEW, iv: 10, ef: EF_MIN };
  for (let i = 0; i < 10; i += 1) {
    st = { ...st, s: STATUS.REVIEW };
    st = review(st, GRADE.AGAIN, T + i * DAY);
  }
  assert.ok(st.ef >= EF_MIN);
  assert.equal(st.ef, EF_MIN);

  let hi = { ...defaultState(), s: STATUS.REVIEW, iv: 10, ef: EF_MAX };
  for (let i = 0; i < 10; i += 1) {
    hi = review(hi, GRADE.EASY, T + i * DAY);
  }
  assert.ok(hi.ef <= EF_MAX);
  assert.equal(hi.ef, EF_MAX);
});

test('间隔不会超过 MAX_INTERVAL', () => {
  let st = { ...defaultState(), s: STATUS.REVIEW, iv: 300, ef: 3.0, reps: 10 };
  st = review(st, GRADE.EASY, T);
  assert.equal(st.iv, MAX_INTERVAL);
});

test('已掌握的词不再被算法修改', () => {
  const st = markMastered(defaultState(), T);
  const after = review(st, GRADE.AGAIN, T + DAY);
  assert.equal(after.s, STATUS.MASTERED);
  assert.equal(after.seen, 0);
});

test('取消已掌握：有复习记录回复习中，否则回新词', () => {
  const fresh = unmarkMastered(markMastered(defaultState(), T));
  assert.equal(fresh.s, STATUS.NEW);

  const learned = { ...defaultState(), s: STATUS.REVIEW, iv: 12, reps: 3 };
  const restored = unmarkMastered(markMastered(learned, T));
  assert.equal(restored.s, STATUS.REVIEW);
  assert.ok(restored.iv >= 1);
});

test('重点标记可切换', () => {
  const on = toggleStar(defaultState());
  assert.equal(on.star, 1);
  assert.equal(toggleStar(on).star, 0);
});

test('非法评分抛出 RangeError', () => {
  assert.throws(() => review(defaultState(), 4, T), RangeError);
  assert.throws(() => review(defaultState(), -1, T), RangeError);
  assert.throws(() => review(defaultState(), 1.5, T), RangeError);
});

test('normalizeState 能修复残缺数据', () => {
  const s = normalizeState({ s: 9, ef: 'abc', iv: 9999, star: 'yes', due: null });
  assert.equal(s.s, STATUS.NEW);
  assert.equal(s.ef, 2.5);
  assert.ok(s.iv <= MAX_INTERVAL);
  assert.equal(s.star, 1);
  assert.equal(s.due, 0);
});

test('isDue 只对学习/复习阶段且到期返回 true', () => {
  assert.equal(isDue({ s: STATUS.NEW, due: T - 1 }, T), false);
  assert.equal(isDue({ s: STATUS.LEARNING, due: T - 1 }, T), true);
  assert.equal(isDue({ s: STATUS.REVIEW, due: T + 1 }, T), false);
  assert.equal(isDue({ s: STATUS.MASTERED, due: 0 }, T), false);
});

test('previewIntervals 给出四个递增的间隔预览', () => {
  const base = { ...defaultState(), s: STATUS.REVIEW, iv: 10 };
  const preview = previewIntervals(base, T);
  assert.equal(preview.length, 4);
  assert.ok(preview[0].ms <= preview[1].ms);
  assert.ok(preview[1].ms <= preview[2].ms);
  assert.ok(preview[2].ms <= preview[3].ms);
  assert.equal(preview[0].grade, 0);
});

test('memoryStrength 随间隔增长而提升', () => {
  const low = memoryStrength({ ...defaultState(), s: STATUS.REVIEW, iv: 1, seen: 3, ok: 3 });
  const high = memoryStrength({ ...defaultState(), s: STATUS.REVIEW, iv: 90, seen: 8, ok: 8 });
  assert.ok(high > low);
  assert.equal(memoryStrength(markMastered(defaultState())), 1);
  assert.equal(memoryStrength(defaultState()), 0);
});

test('review 不修改传入对象', () => {
  const prev = defaultState();
  const snapshot = JSON.stringify(prev);
  review(prev, GRADE.GOOD, T);
  assert.equal(JSON.stringify(prev), snapshot);
});
