import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

const WB = boot(['core/store.js', 'core/srs.js']);
const today = '2026-11-02';
const fixed = function () { return 0.5; };

test('新卡评分 记得：间隔 1 天，明天到期', function () {
  const card = WB.srs.newCard('apple');
  const next = WB.srs.schedule(card, 4, today, fixed);
  assert.equal(next.interval, 1);
  assert.equal(next.due, '2026-11-03');
  assert.equal(next.state, 'review');
  assert.equal(next.successReps, 1);
  assert.equal(next.firstLearned, today);
});

test('新卡评分 简单：间隔 2 天', function () {
  const next = WB.srs.schedule(WB.srs.newCard('apple'), 5, today, fixed);
  assert.equal(next.interval, 2);
  assert.equal(next.due, '2026-11-04');
  assert.equal(next.ease, 2.65);
});

test('第二次记得间隔 3 天，之后按 ease 增长', function () {
  let card = WB.srs.newCard('apple');
  card = WB.srs.schedule(card, 4, today, fixed);
  card = WB.srs.schedule(card, 4, '2026-11-03', fixed);
  assert.equal(card.interval, 3);
  assert.equal(card.due, '2026-11-06');
  card = WB.srs.schedule(card, 4, '2026-11-06', fixed);
  assert.equal(card.interval, 8);
  assert.equal(card.successReps, 3);
});

test('忘记：当天重学、ease 下降、lapses 增加', function () {
  const todayCard = WB.srs.schedule(WB.srs.newCard('apple'), 4, today, fixed);
  const next = WB.srs.schedule(todayCard, 2, '2026-11-03', fixed);
  assert.equal(next.interval, 1);
  assert.equal(next.due, '2026-11-03');
  assert.equal(next.state, 'relearning');
  assert.equal(next.lapses, 1);
  assert.equal(next.ease, 2.3);
  assert.equal(next.lapseStreak, 1);
});

test('连续遗忘 4 次标记为难词', function () {
  let card = WB.srs.newCard('apple');
  const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
  days.forEach(function (day) {
    card = WB.srs.schedule(card, 2, day, fixed);
  });
  assert.equal(card.lapseStreak, 4);
  assert.equal(card.leech, true);
  assert.equal(card.ease, 1.7);
});

test('ease 下限 1.3，间隔上限 365 天', function () {
  let card = WB.srs.newCard('apple');
  for (let i = 0; i < 20; i += 1) {
    card = WB.srs.schedule(card, 2, today, fixed);
  }
  assert.equal(card.ease, 1.3);

  card = WB.srs.schedule(card, 4, today, fixed);
  assert.equal(card.ease, 1.3);
  for (let i = 0; i < 20; i += 1) {
    card = WB.srs.schedule(card, 4, WB.date.addDays(today, i), fixed);
    assert.ok(card.interval <= 365);
  }
  assert.equal(card.interval, 365);
});

test('模糊：新卡 1 天，老卡按 1.2 倍增长', function () {
  const fresh = WB.srs.schedule(WB.srs.newCard('apple'), 3, today, fixed);
  assert.equal(fresh.interval, 1);
  const old = Object.assign({}, fresh, { interval: 10, successReps: 2, due: '2026-11-12' });
  const next = WB.srs.schedule(old, 3, '2026-11-03', fixed);
  assert.equal(next.interval, 12);
});

test('预览返回四档评分与文案', function () {
  const card = WB.srs.newCard('apple');
  const preview = WB.srs.preview(card, today);
  assert.equal(preview.length, 4);
  assert.deepEqual(Array.from(preview, function (item) { return item.q; }), [2, 3, 4, 5]);
  assert.equal(preview[0].text, '今天再来');
  assert.equal(preview[3].text, '2 天后');
});

test('保持率随时间下降', function () {
  const card = WB.srs.schedule(WB.srs.newCard('apple'), 4, today, fixed);
  const fresh = WB.srs.retention(card, '2026-11-03');
  const stale = WB.srs.retention(card, '2026-11-08');
  assert.equal(Math.round(fresh * 100), 90);
  assert.ok(stale < fresh);
  assert.equal(WB.srs.retention(WB.srs.newCard('apple'), today), null);
});
