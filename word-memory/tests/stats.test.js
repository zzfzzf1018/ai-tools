import test from 'node:test';
import assert from 'node:assert/strict';

import { overview, streakOf, forecast, heatmap, recentSeries, daysSinceLastStudy } from '../src/core/stats.js';
import { STATUS, GRADE } from '../src/core/srs.js';
import { dateKey, DAY } from '../src/core/util.js';
import { makeWordbook, makeStore, defaultSettings, T0 } from './helpers.js';

function seed(store, wordbook, plan) {
  for (const [index, state] of Object.entries(plan)) {
    store.setState(Number(index), { ...store.getState(Number(index)), ...state });
  }
}

test('overview 统计各阶段数量', () => {
  const wordbook = makeWordbook(20);
  const store = makeStore();
  seed(store, wordbook, {
    0: { s: STATUS.LEARNING, due: T0 - 1000, seen: 1, ok: 1 },
    1: { s: STATUS.REVIEW, iv: 30, due: T0 - 1000, seen: 4, ok: 4 },
    2: { s: STATUS.REVIEW, iv: 5, due: T0 + DAY, seen: 3, ok: 2 },
    3: { s: STATUS.MASTERED, seen: 5, ok: 5 },
    4: { s: STATUS.NEW, star: 1 },
  });
  const o = overview({ wordbook, store, settings: defaultSettings(), now: T0 });
  assert.equal(o.total, 20);
  assert.equal(o.studied, 3);
  assert.equal(o.learning, 1);
  assert.equal(o.reviewing, 2);
  assert.equal(o.mastered, 1);
  assert.equal(o.mature, 1);
  assert.equal(o.dueNow, 2);
  assert.equal(o.starred, 1);
});

test('正确率按累计作答计算', () => {
  const wordbook = makeWordbook(5);
  const store = makeStore();
  store.setState(0, { s: STATUS.REVIEW, iv: 2, due: T0, seen: 4, ok: 3 });
  store.setState(1, { s: STATUS.REVIEW, iv: 2, due: T0, seen: 2, ok: 2 });
  const o = overview({ wordbook, store, settings: defaultSettings(), now: T0 });
  assert.ok(Math.abs(o.accuracy - 5 / 6) < 1e-9);
});

test('streakOf 计算连续天数，允许今天未开始', () => {
  const daily = {};
  for (let i = 1; i <= 3; i += 1) {
    daily[dateKey(T0 - i * DAY)] = { n: 1, r: 0, c: 1, a: 1, ms: 1 };
  }
  assert.equal(streakOf(daily, T0), 3);

  daily[dateKey(T0)] = { n: 1, r: 0, c: 1, a: 1, ms: 1 };
  assert.equal(streakOf(daily, T0), 4);

  const gap = { [dateKey(T0 - 5 * DAY)]: { n: 1, r: 0, c: 0, a: 1, ms: 1 } };
  assert.equal(streakOf(gap, T0), 0);
  assert.equal(streakOf({}, T0), 0);
});

test('forecast 把今天到期的计入第 0 桶', () => {
  const wordbook = makeWordbook(10);
  const store = makeStore();
  seed(store, wordbook, {
    0: { s: STATUS.REVIEW, iv: 1, due: T0 - 1 },
    1: { s: STATUS.REVIEW, iv: 1, due: T0 + 2 * DAY },
    2: { s: STATUS.REVIEW, iv: 1, due: T0 + 2 * DAY },
  });
  const f = forecast(store, T0, 7);
  assert.equal(f.length, 7);
  assert.equal(f[0], 1);
  assert.equal(f[2], 2);
});

test('heatmap 返回 weeks*7 个格子并标记等级', () => {
  const store = makeStore();
  store.bumpDaily({ n: 5, r: 10 }, T0);
  const heat = heatmap(store, T0, 13);
  assert.equal(heat.cells.length, 91);
  assert.ok(heat.cells.some((c) => c.count === 15));
  assert.ok(heat.cells.every((c) => c.level >= 0 && c.level <= 4));
});

test('recentSeries 返回按日期升序的序列', () => {
  const store = makeStore();
  store.bumpDaily({ n: 3 }, T0);
  const series = recentSeries(store, T0, 14);
  assert.equal(series.length, 14);
  assert.equal(series[13].key, dateKey(T0));
  assert.equal(series[13].newLearned, 3);
  assert.ok(series[0].ts < series[13].ts);
});

test('daysSinceLastStudy 返回距今天数', () => {
  const store = makeStore();
  assert.equal(daysSinceLastStudy(store, T0), null);
  store.bumpDaily({ n: 1 }, T0 - 2 * DAY);
  assert.equal(daysSinceLastStudy(store, T0), 2);
});

test('考试：连续答对后 maturity 提升', () => {
  const wordbook = makeWordbook(3);
  const store = makeStore();
  let st = store.getState(0);
  st = store.recordReview(0, GRADE.EASY, T0);
  st = store.recordReview(0, GRADE.EASY, T0 + 5 * DAY);
  st = store.recordReview(0, GRADE.EASY, T0 + 20 * DAY);
  assert.ok(st.iv >= 21, `间隔应达到成熟标准，实际 ${st.iv}`);
  const o = overview({ wordbook, store, settings: defaultSettings(), now: T0 + 20 * DAY });
  assert.equal(o.mature, 1);
});
