import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

test('存储占用统计包含启动时读取的数据', function () {
  const cards = {};
  for (let i = 0; i < 20; i += 1) {
    cards['word' + i] = { w: 'word' + i, state: 'review', reps: 5, due: '2026-11-02' };
  }
  const WB = boot(['core/store.js'], { cards: cards });
  assert.equal(Object.keys(WB.store.getCards()).length, 20);
  assert.ok(WB.store.storageBytes() > 500);
});

test('坏 JSON 回退到默认值而不崩溃', function () {
  const WB = boot(['core/store.js'], { settings: '{bad json', notebook: '[]' });
  assert.equal(WB.store.getSettings().tier, 1);
  assert.equal(Object.keys(WB.store.getNotebook()).length, 0);
});

test('全量备份可跨实例导入', function () {
  const WB = boot(['core/store.js']);
  WB.store.updateSettings({ dailyNew: 35, theme: 'dark' });
  WB.store.putCard({ w: 'apple', state: 'review', interval: 4, reps: 2, due: '2026-11-06' });
  WB.store.addNotebook('apple', 'learn');
  WB.store.recordAnswer('new', true);
  const backup = WB.store.exportAll();

  const next = boot(['core/store.js']);
  const settings = next.store.importAll(backup);

  assert.equal(settings.dailyNew, 35);
  assert.equal(settings.theme, 'dark');
  assert.equal(next.store.getCard('apple').interval, 4);
  assert.equal(next.store.isInNotebook('apple'), true);
  assert.equal(next.store.todayEntry().newCount, 1);
});

test('无效备份被拒绝且不破坏现有数据', function () {
  const WB = boot(['core/store.js']);
  WB.store.addNotebook('apple', 'manual');

  assert.throws(function () { WB.store.importAll({ app: 'x' }); }, /单词书/);
  assert.throws(function () { WB.store.importAll({ schema: 'wb:v1' }); }, /元信息/);
  assert.throws(function () { WB.store.importAll({ schema: 'wb:v2', meta: { version: 1 } }); }, /单词书/);

  assert.equal(WB.store.isInNotebook('apple'), true);
});
