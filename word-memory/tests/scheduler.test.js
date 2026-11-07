import test from 'node:test';
import assert from 'node:assert/strict';

import { buildQueue, interleave, countDue } from '../src/core/scheduler.js';
import { STATUS, GRADE } from '../src/core/srs.js';
import { makeWordbook, makeStore, defaultSettings, T0 } from './helpers.js';

test('interleave 均匀插入新词', () => {
  const reviews = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9'];
  const fresh = ['f1'];
  const out = interleave(reviews, fresh);
  assert.equal(out.length, 10);
  assert.equal(out.filter((x) => x.startsWith('f')).length, 1);
  // 新词应落在序列中后段，而不是首尾挤在一起
  assert.ok(out.indexOf('f1') >= 8);
});

test('interleave 处理空输入', () => {
  assert.deepEqual(interleave([], ['a']), ['a']);
  assert.deepEqual(interleave(['a'], []), ['a']);
  assert.deepEqual(interleave([], []), []);
});

test('新库队列按词频从 0 开始', () => {
  const wordbook = makeWordbook(30);
  const store = makeStore();
  const queue = buildQueue({
    wordbook,
    store,
    settings: defaultSettings({ newPerDay: 10 }),
    now: T0,
  });
  assert.deepEqual(queue.queue, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(queue.freshCount, 30);
});

test('已掌握的词不进入队列', () => {
  const wordbook = makeWordbook(10);
  const store = makeStore();
  store.setMastered(0, true, T0);
  store.setMastered(1, true, T0);
  const queue = buildQueue({
    wordbook,
    store,
    settings: defaultSettings({ newPerDay: 20 }),
    now: T0,
  });
  assert.ok(!queue.queue.includes(0));
  assert.ok(!queue.queue.includes(1));
});

test('每日新词上限生效，含已学数量', () => {
  const wordbook = makeWordbook(30);
  const store = makeStore();
  store.bumpDaily({ n: 4 }, T0);
  const queue = buildQueue({
    wordbook,
    store,
    settings: defaultSettings({ newPerDay: 10 }),
    now: T0,
  });
  const freshPicked = queue.queue.filter((i) => !store.hasRecord(i));
  assert.ok(freshPicked.length <= 6, `今日剩余额度应为 6，实际 ${freshPicked.length}`);
});

test('到期复习进入队列并优先于新词', () => {
  const wordbook = makeWordbook(10);
  const store = makeStore();
  store.setState(5, {
    s: STATUS.REVIEW,
    iv: 3,
    due: T0 - 1000,
    ef: 2.5,
    reps: 2,
    seen: 3,
    ok: 3,
    last: T0 - 86400000,
  });
  const queue = buildQueue({
    wordbook,
    store,
    settings: defaultSettings({ newPerDay: 0, sessionSize: 20 }),
    now: T0,
  });
  assert.deepEqual(queue.queue, [5]);
});

test('重点词排在复习队首', () => {
  const wordbook = makeWordbook(10);
  const store = makeStore();
  const base = { s: STATUS.REVIEW, iv: 2, ef: 2.5, reps: 1, seen: 1, ok: 1, last: T0 - 86400000 };
  store.setState(3, { ...base, due: T0 - 5000 });
  store.setState(8, { ...base, due: T0 - 10000, star: 1 });
  const queue = buildQueue({
    wordbook,
    store,
    settings: defaultSettings({ newPerDay: 0 }),
    now: T0,
  });
  assert.equal(queue.queue[0], 8, '重点词应排最前');
});

test('频段设置过滤词条', () => {
  const wordbook = makeWordbook(12); // level 循环 1,2,3,4
  const store = makeStore();
  const queue = buildQueue({
    wordbook,
    store,
    settings: defaultSettings({ newPerDay: 100, levels: [1] }),
    now: T0,
  });
  const levels = queue.queue.map((i) => wordbook.wordAt(i).level);
  assert.ok(levels.every((lv) => lv === 1), `应只包含 level 1，实际 ${levels}`);
});

test('sessionSize 限制单轮数量', () => {
  const wordbook = makeWordbook(60);
  const store = makeStore();
  const queue = buildQueue({
    wordbook,
    store,
    settings: defaultSettings({ newPerDay: 100, sessionSize: 15 }),
    now: T0,
  });
  assert.equal(queue.queue.length, 15);
});

test('乱序模式种子相同则结果稳定', () => {
  const wordbook = makeWordbook(40);
  const store = makeStore();
  const settings = defaultSettings({ newPerDay: 20, order: 'random' });
  const a = buildQueue({ wordbook, store, settings, now: T0, seed: 42 });
  const b = buildQueue({ wordbook, store, settings, now: T0, seed: 42 });
  assert.deepEqual(a.queue, b.queue);
  const c = buildQueue({ wordbook, store, settings, now: T0, seed: 43 });
  assert.notDeepEqual(a.queue, c.queue);
});

test('countDue 统计不受每日上限影响', () => {
  const wordbook = makeWordbook(10);
  const store = makeStore();
  for (let i = 0; i < 5; i += 1) {
    store.setState(i, {
      s: STATUS.REVIEW, iv: 2, ef: 2.5, reps: 1, seen: 1, ok: 1, due: T0 - 1, last: T0,
    });
  }
  const { due, fresh } = countDue({ wordbook, store, settings: defaultSettings(), now: T0 });
  assert.equal(due, 5);
  assert.equal(fresh, 5);
});

test('队列中不重复出现同一个词', () => {
  const wordbook = makeWordbook(40);
  const store = makeStore();
  store.setState(2, { s: STATUS.REVIEW, iv: 1, ef: 2.5, reps: 1, seen: 2, ok: 2, due: T0 - 1 });
  const queue = buildQueue({ wordbook, store, settings: defaultSettings({ newPerDay: 30 }), now: T0 });
  assert.equal(new Set(queue.queue).size, queue.queue.length);
});

test('学习中的词到期后也进入队列', () => {
  const wordbook = makeWordbook(6);
  const store = makeStore();
  store.setState(1, { s: STATUS.LEARNING, step: 1, due: T0 - 60000, seen: 1, ok: 1 });
  const queue = buildQueue({ wordbook, store, settings: defaultSettings({ newPerDay: 0 }), now: T0 });
  assert.deepEqual(queue.queue, [1]);
});
