import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

function fresh() {
  return boot(['core/store.js', 'core/srs.js', 'core/words.js', 'core/session.js']);
}

test('新词队列按词频取词，跳过基础词，并受每日上限限制', function () {
  const WB = fresh();
  WB.store.updateSettings({ tier: 1, dailyNew: 3, skipBasic: true });
  const session = WB.session.start('learn');
  assert.equal(session.queue.length, 3);
  assert.ok(session.queue.every(function (item) { return item.type === 'learn'; }));
  const pool = WB.words.pending(1, {}, true);
  assert.equal(session.queue[0].word.w, pool[0].w);
  assert.equal(session.queue[0].word.basic, false);
});

test('开启“不跳过基础词”后从 the 开始', function () {
  const WB = fresh();
  WB.store.updateSettings({ tier: 1, dailyNew: 2, skipBasic: false });
  const session = WB.session.start('learn');
  assert.equal(session.queue[0].word.w, 'the');
});

test('忘记后加入生词本，本轮稍后重现', function () {
  const WB = fresh();
  WB.store.updateSettings({ tier: 1, dailyNew: 2, skipBasic: true, autoAddUnknown: true });
  const session = WB.session.start('learn');
  assert.equal(session.queue.length, 2);
  const first = session.queue[0].word.w;

  WB.session.answer(2);
  assert.equal(WB.store.isInNotebook(first), true);
  assert.equal(session.queue.length, 3);
  assert.equal(session.index, 1);
  assert.equal(session.finished, false);
  assert.equal(WB.store.getDaily()[WB.date.today()].newCount, 1);

  WB.session.answer(4);
  assert.equal(session.index, 2);

  const retry = WB.session.peek();
  assert.equal(retry.word.w, first);
  assert.equal(retry.retries, 1);
  const result = WB.session.answer(4);
  assert.equal(result.finished, true);
  assert.equal(WB.session.summary().answered, 3);
  assert.equal(WB.session.summary().retryCount, 1);
});

test('每日新词达到上限后队列为空', function () {
  const WB = fresh();
  WB.store.updateSettings({ tier: 1, dailyNew: 1, skipBasic: true });
  const session = WB.session.start('learn');
  assert.equal(session.queue.length, 1);
  WB.session.answer(4);
  const next = WB.session.start('learn');
  assert.equal(next.queue.length, 0);
  assert.match(next.reason, /目标已经完成/);
  assert.equal(WB.store.getDaily()[WB.date.today()].newCount, 1);
});

test('复习队列只取到期卡片，难词优先', function () {
  const WB = fresh();
  const today = WB.date.today();
  const base = { state: 'review', ease: 2.5, interval: 3, reps: 2, successReps: 2, lapses: 0, lapseStreak: 0, lastGrade: 4, leech: false };
  WB.store.putCard(Object.assign({}, base, { w: 'book', due: today }));
  WB.store.putCard(Object.assign({}, base, { w: 'study', due: today, leech: true }));
  WB.store.putCard(Object.assign({ w: 'apple', due: WB.date.addDays(today, 2) }, base));

  const session = WB.session.start('review');
  assert.equal(session.queue.length, 2);
  assert.equal(session.queue[0].word.w, 'study');
  assert.ok(WB.session.MODE_LABELS[session.queue[0].mode]);
  WB.session.answer(4);
  const next = WB.store.getCard('study');
  assert.ok(next.interval >= 7 && next.interval <= 9);
  assert.equal(next.due, WB.date.addDays(today, next.interval));
});

test('生词本指定单词可直接组一套复习', function () {
  const WB = fresh();
  WB.store.addNotebook('apple', 'manual');
  const session = WB.session.startWords([WB.words.lookup('apple')]);
  assert.equal(session.queue.length, 1);
  assert.equal(session.queue[0].type, 'review');
  assert.equal(WB.session.peek().word.w, 'apple');
});

test('已结束或空的会话不会被恢复', function () {
  const WB = fresh();
  WB.store.updateSettings({ tier: 1, dailyNew: 1, skipBasic: true });
  const session = WB.session.start('learn');
  assert.equal(WB.session.resume('learn'), session);
  WB.session.answer(4);
  assert.equal(session.finished, true);
  assert.equal(WB.session.resume('learn'), null);

  const empty = WB.session.start('learn');
  assert.equal(empty.queue.length, 0);
  assert.equal(WB.session.resume('learn'), null);
});

test('第三次遗忘后不再安排本轮重现', function () {
  const WB = fresh();
  WB.store.updateSettings({ tier: 1, dailyNew: 1, skipBasic: true });
  const session = WB.session.start('learn');
  assert.equal(session.queue.length, 1);

  assert.equal(WB.session.answer(2).retried, true);
  assert.equal(WB.session.answer(2).retried, true);
  assert.equal(WB.session.answer(2).retried, false);
  assert.equal(session.finished, true);
});
