import test from 'node:test';
import assert from 'node:assert/strict';

import { createSession } from '../src/core/session.js';
import { STATUS, GRADE } from '../src/core/srs.js';
import { MINUTE, dateKey } from '../src/core/util.js';
import { makeWordbook, makeStore, defaultSettings, T0 } from './helpers.js';

function setup(queue, options = {}) {
  const wordbook = makeWordbook(30);
  const store = makeStore({ now: () => options.now ?? T0 });
  const session = createSession({
    wordbook,
    store,
    settings: defaultSettings(options.settings),
    queue,
    now: () => options.now ?? T0,
  });
  return { wordbook, store, session };
}

test('会话按队列推进并产出总结', () => {
  const { session, store } = setup([0, 1, 2]);
  assert.equal(session.planned, 3);
  assert.equal(session.current().index, 0);

  session.submit(GRADE.GOOD, T0);
  assert.equal(session.current().index, 1);
  session.submit(GRADE.GOOD, T0 + 1000);
  session.submit(GRADE.GOOD, T0 + 2000);

  assert.equal(session.finished, true);
  const summary = session.summary();
  assert.equal(summary.answered, 3);
  assert.equal(summary.newLearned, 3);
  assert.equal(summary.correct, 3);
  assert.equal(summary.accuracy, 1);
  assert.equal(store.getState(0).s, STATUS.LEARNING);
});

test('"忘记了"的词会在本轮内重新出现', () => {
  const { session } = setup([0, 1, 2, 3]);
  session.submit(GRADE.AGAIN, T0);
  const remaining = [];
  while (!session.finished) {
    const card = session.current();
    remaining.push(card.index);
    session.submit(GRADE.GOOD, T0 + 1000);
  }
  assert.ok(remaining.includes(0), '答错的词应再次出现');
});

test('同一张卡单轮最多出现 3 次，不会死循环', () => {
  const { session } = setup([0]);
  let guard = 0;
  while (!session.finished && guard < 20) {
    session.submit(GRADE.AGAIN, T0 + guard * 1000);
    guard += 1;
  }
  assert.ok(guard <= 3, `应最多出现 3 次，实际 ${guard}`);
  assert.equal(session.finished, true);
});

test('会话统计区分新学与复习', () => {
  const { session, store } = setup([5]);
  store.setState(5, {
    s: STATUS.REVIEW, iv: 3, ef: 2.5, reps: 2, seen: 2, ok: 2, due: T0 - 1000,
  });
  session.submit(GRADE.GOOD, T0);
  const s = session.summary();
  assert.equal(s.newLearned, 0);
  assert.equal(s.reviewed, 1);
});

test('每日统计随会话写入', () => {
  const { session, store } = setup([0, 1]);
  session.submit(GRADE.GOOD, T0);
  session.submit(GRADE.AGAIN, T0 + 1000);
  const today = store.getDaily(dateKey(T0));
  assert.equal(today.n, 2);
  assert.equal(today.a, 2);
  assert.equal(today.c, 1);
});

test('skip 把当前卡移到队尾', () => {
  const { session } = setup([0, 1, 2]);
  session.skip(T0);
  assert.equal(session.current().index, 1);
  assert.equal(session.remaining, 3);
});

test('drop 移除当前卡且不记录评分', () => {
  const { session, store } = setup([0, 1]);
  session.drop(T0);
  assert.equal(session.current().index, 1);
  assert.equal(store.getState(0).seen, 0);
});

test('finish 提前结束并保留已有统计', () => {
  const { session } = setup([0, 1, 2]);
  session.submit(GRADE.GOOD, T0);
  const summary = session.finish();
  assert.equal(session.finished, true);
  assert.equal(summary.answered, 1);
  assert.equal(session.remaining, 0);
});

test('current 提供四个间隔预览且带状态', () => {
  const { session } = setup([0]);
  const card = session.current();
  assert.equal(card.preview.length, 4);
  assert.equal(card.isNew, true);
  assert.equal(card.word.word, 'apple');
  assert.equal(card.attempt, 1);
});

test('onChange 在提交后触发', () => {
  const { session } = setup([0, 1]);
  let count = 0;
  const off = session.onChange(() => {
    count += 1;
  });
  session.submit(GRADE.GOOD, T0);
  assert.equal(count, 1);
  off();
  session.submit(GRADE.GOOD, T0 + 1);
  assert.equal(count, 1);
});

test('空队列会话直接视为完成', () => {
  const { session } = setup([]);
  assert.equal(session.finished, true);
  assert.equal(session.current(), null);
  assert.equal(session.summary().answered, 0);
});

test('作答耗时被限制在合理范围', () => {
  const { session, store } = setup([0]);
  session.submit(GRADE.GOOD, T0 + 60 * MINUTE); // 超过 5 分钟上限
  const today = store.getDaily(dateKey(T0));
  assert.ok(today.ms <= 5 * MINUTE);
});

test('答错的卡在本轮内重新排队', () => {
  const { session } = setup([0, 1, 2, 3, 4]);
  session.submit(GRADE.AGAIN, T0); // 1 分钟后到期 → 本轮重排
  const order = [];
  let t = T0;
  while (!session.finished) {
    order.push(session.current().index);
    t += 1000;
    session.submit(GRADE.GOOD, t);
  }
  const occurrences = order.filter((i) => i === 0).length;
  assert.ok(occurrences >= 1, '答错的词应在本轮再次出现');
});
