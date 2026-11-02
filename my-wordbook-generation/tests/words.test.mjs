import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

const WB = boot(['core/store.js', 'core/words.js']);

test('词库共 8000 条，分档 2000 / 4000 / 8000，且无重复', function () {
  const all = WB.words.all();
  assert.equal(all.length, 8000);
  const unique = new Set(all.map(function (item) { return item.w.toLowerCase(); }));
  assert.equal(unique.size, 8000);
  const tiers = all.reduce(function (acc, item) {
    acc[item.t] = (acc[item.t] || 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(tiers, { 1: 2000, 2: 2000, 3: 4000 });
  assert.equal(WB.words.list(1).length, 2000);
  assert.equal(WB.words.list(2).length, 4000);
  assert.equal(WB.words.list(3).length, 8000);
});

test('每条词都有中文释义与词频', function () {
  const all = WB.words.all();
  all.forEach(function (item) {
    assert.ok(item.w);
    assert.ok(Array.isArray(item.zh) && item.zh.length > 0, item.w + ' 缺少释义');
    assert.ok(/[\u4e00-\u9fff]/.test(item.zh.join(' ')), item.w + ' 释义没有中文');
    assert.ok(item.r > 0);
    assert.ok([1, 2, 3].includes(item.t));
  });
});

test('档位按词频升序且逐级累积', function () {
  const list = WB.words.list(2);
  for (let i = 1; i < list.length; i += 1) {
    assert.ok(list[i].r >= list[i - 1].r, '第 ' + i + ' 条词频逆序');
  }
  const firstTier = WB.words.list(1).map(function (item) { return item.w; });
  const secondTier = WB.words.list(2).map(function (item) { return item.w; });
  assert.deepEqual(firstTier, secondTier.slice(0, 2000));
});

test('大小写查找与词条信息', function () {
  assert.equal(WB.words.lookup('I').w, 'I');
  assert.equal(WB.words.lookup('i').w, 'I');
  assert.ok(WB.words.lookup('the').basic);
  assert.equal(WB.words.tierLabel(3), '阅读书报');
  assert.equal(WB.words.tierTarget(2), 4000);
  assert.match(WB.words.tierTitle(1), /日常对话/);
});

test('待学队列跳过基础词与已学卡片', function () {
  const pool = WB.words.pending(1, {}, true);
  assert.ok(pool.length < WB.words.list(1).length);
  pool.forEach(function (item) { assert.equal(item.basic, false); });

  const first = pool[0];
  const cards = {};
  cards[first.w] = { w: first.w, state: 'review', reps: 2 };
  const after = WB.words.pending(1, cards, true);
  assert.equal(after[0].w, pool[1].w);
  assert.equal(after.length, pool.length - 1);
});

test('干扰项数量正确、互不相同且排除原词', function () {
  const word = WB.words.lookup('apple');
  const others = WB.words.distractors(word, 3, 1, function () { return 0.4; });
  assert.equal(others.length, 3);
  assert.ok(others.every(function (item) { return item.w !== word.w; }));
  const texts = new Set(others.map(function (item) { return WB.words.sensesText(item); }));
  assert.equal(texts.size, 3);
});

test('拼写比较忽略大小写与首尾空格', function () {
  const word = WB.words.lookup('apple');
  assert.equal(WB.words.matches(word, ' Apple '), true);
  assert.equal(WB.words.matches(word, 'apples'), false);
});
