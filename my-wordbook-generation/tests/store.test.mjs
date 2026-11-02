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
