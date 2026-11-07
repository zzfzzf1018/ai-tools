import test from 'node:test';
import assert from 'node:assert/strict';

import { createStore, createMemoryAdapter, SCHEMA_VERSION } from '../src/core/store.js';
import { STATUS, GRADE } from '../src/core/srs.js';
import { T0, makeStore } from './helpers.js';
import { dateKey } from '../src/core/util.js';

test('空存储首次加载返回 fresh', () => {
  const store = makeStore();
  const result = store.load();
  assert.equal(result.ok, true);
  assert.equal(result.fresh, true);
  assert.equal(store.settings.newPerDay, 20);
});

test('设置与状态可往返读写', () => {
  const store = makeStore();
  store.setState(3, { ...store.getState(3), s: STATUS.REVIEW, iv: 5, due: T0 + 1000 });
  const st = store.getState(3);
  assert.equal(st.s, STATUS.REVIEW);
  assert.equal(st.iv, 5);
});

test('默认状态不会写入存储（节省空间）', () => {
  const store = makeStore();
  store.setState(7, store.getState(7));
  assert.equal(store.hasRecord(7), false);
});

test('重点标记的新词会保留记录', () => {
  const store = makeStore();
  store.toggleStar(9);
  assert.equal(store.hasRecord(9), true);
  assert.equal(store.getState(9).star, 1);
});

test('recordReview 推进状态并累计作答', () => {
  const store = makeStore();
  const next = store.recordReview(1, GRADE.GOOD, T0);
  assert.equal(next.seen, 1);
  assert.equal(next.ok, 1);
  assert.equal(store.getState(1).s, STATUS.LEARNING);
});

test('数据能持久化到 adapter 并在新实例中恢复', () => {
  const adapter = createMemoryAdapter();
  const a = createStore({ adapter, now: () => T0 });
  a.load();
  a.recordReview(2, GRADE.EASY, T0);
  a.bumpDaily({ n: 1, r: 0, c: 1, a: 1, ms: 3000 }, T0);
  a.flush();

  const b = createStore({ adapter, now: () => T0 });
  const result = b.load();
  assert.equal(result.fresh, false);
  assert.equal(b.getState(2).s, STATUS.REVIEW);
  assert.equal(b.getDaily(dateKey(T0)).n, 1);
});

test('导出与导入可完整往返', () => {
  const store = makeStore();
  store.recordReview(4, GRADE.GOOD, T0);
  store.toggleStar(5);
  store.bumpDaily({ n: 1, r: 0, c: 0, a: 1, ms: 1200 }, T0);
  const backup = store.export();

  const other = makeStore();
  const result = other.import(backup);
  assert.equal(result.ok, true);
  assert.equal(other.getState(4).s, STATUS.LEARNING);
  assert.equal(other.getState(5).star, 1);
});

test('导入非法内容返回错误而不破坏现有数据', () => {
  const store = makeStore();
  store.toggleStar(6);

  assert.equal(store.import('不是 JSON').ok, false);
  assert.equal(store.import('{"foo":1}').ok, false);
  assert.equal(store.getState(6).star, 1, '原有数据应保留');
});

test('损坏的存档不会让 store 崩溃', () => {
  const adapter = createMemoryAdapter({ 'word-memory/v1': '{broken' });
  const store = createStore({ adapter, now: () => T0 });
  const result = store.load();
  assert.equal(result.ok, false);
  assert.ok(store.lastError);
  assert.equal(store.getState(0).s, STATUS.NEW);
});

test('设置越界会被夹取，非法选项被忽略', () => {
  const store = makeStore();
  store.updateSettings({ newPerDay: -50, reviewPerDay: 99999, order: 'hack', theme: 'neon' });
  const s = store.settings;
  assert.equal(s.newPerDay, 0);
  assert.equal(s.reviewPerDay, 2000);
  assert.equal(s.order, 'frequency');
  assert.equal(s.theme, 'dark');
});

test('频段列表去重排序，空列表回落默认', () => {
  const store = makeStore();
  store.updateSettings({ levels: [3, 3, 1] });
  assert.deepEqual(store.settings.levels, [1, 3]);
  store.updateSettings({ levels: [] });
  assert.deepEqual(store.settings.levels, [1, 2, 3, 4]);
});

test('每日统计按日期分桶', () => {
  const store = makeStore();
  const d1 = dateKey(T0);
  const d2 = dateKey(T0 + 86400000);
  store.bumpDaily({ n: 2 }, T0);
  store.bumpDaily({ r: 5 }, T0 + 86400000);
  assert.equal(store.getDaily(d1).n, 2);
  assert.equal(store.getDaily(d2).r, 5);
  assert.equal(store.getDaily('1999-01-01').n, 0);
});

test('重置保留设置、清空进度', () => {
  const store = makeStore();
  store.updateSettings({ newPerDay: 42 });
  store.recordReview(0, GRADE.GOOD, T0);
  store.reset({ keepSettings: true });
  assert.equal(store.settings.newPerDay, 42);
  assert.equal(store.hasRecord(0), false);
  assert.equal(store.getDaily(dateKey(T0)).n, 0);
});

test('内存适配器可识别为非持久化', () => {
  const store = makeStore();
  assert.equal(store.isPersistent, false);
});

test('导出的存档带有版本号', () => {
  const store = makeStore();
  const parsed = JSON.parse(store.export());
  assert.equal(parsed.v, SCHEMA_VERSION);
  assert.ok(parsed.meta.exportedAt);
});
