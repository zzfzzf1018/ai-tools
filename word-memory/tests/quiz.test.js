import test from 'node:test';
import assert from 'node:assert/strict';

import { buildQuestion, checkAnswer, normalizeSpelling, QUESTION_TYPE } from '../src/core/quiz.js';
import { mulberry32 } from '../src/core/util.js';
import { makeWordbook } from './helpers.js';
import { createWordbook } from '../src/core/wordbook.js';

test('选择题恰好 4 个选项且只有一个正确', () => {
  const wordbook = makeWordbook(30);
  const rand = mulberry32(7);
  for (let i = 0; i < 20; i += 1) {
    const q = buildQuestion({ wordbook, index: i, mode: 'choice', rand });
    assert.equal(q.options.length, 4);
    assert.equal(q.options.filter((o) => o.correct).length, 1);
  }
});

test('干扰项释义互不相同，也不与答案词汇重复', () => {
  const wordbook = makeWordbook(30);
  const rand = mulberry32(11);
  const q = buildQuestion({ wordbook, index: 3, mode: 'choice', rand });
  const texts = q.options.map((o) => o.text);
  assert.equal(new Set(texts).size, texts.length);
});

test('中文选项不泄露英文单词', () => {
  const wordbook = makeWordbook(30);
  const rand = mulberry32(3);
  let checked = 0;
  for (let i = 0; i < 40; i += 1) {
    const q = buildQuestion({ wordbook, index: i % 30, mode: 'choice', rand });
    if (q.type !== QUESTION_TYPE.EN2ZH) continue;
    checked += 1;
    for (const opt of q.options) {
      assert.equal(opt.meta, '', '中文选项不应带英文元信息');
      assert.ok(!/[a-z]{4,}/i.test(opt.text), `中文选项含英文：${opt.text}`);
    }
  }
  assert.ok(checked > 0, '应至少验证到一个英译中题目');
});

test('拼写题返回答案与提示', () => {
  const wordbook = makeWordbook(30);
  const rand = mulberry32(5);
  const q = buildQuestion({ wordbook, index: 0, mode: 'spell', rand });
  assert.equal(q.type, QUESTION_TYPE.SPELL);
  assert.equal(q.answer, 'apple');
  assert.equal(q.options.length, 0);
  assert.match(q.hint, /5 个字符/);
});

test('功能词只出"看英文选中文"，不考古怪的释义题', () => {
  const wordbook = createWordbook({
    meta: {},
    words: [
      ['the', 'art. 指已提到的人（物）；指说话人与听者已知的人（物）', 'ðə', 1],
      ['of', 'prep. 关于；属于…的', 'əv', 1],
      ['and', 'conj. 和；与', 'ənd', 1],
      ['she', 'pron. 她', 'ʃi:', 1],
      ['apple', 'n. 苹果', 'ˈæpl', 1],
      ['banana', 'n. 香蕉', 'bəˈnɑːnə', 1],
      ['cherry', 'n. 樱桃', 'ˈtʃeri', 1],
      ['dolphin', 'n. 海豚', 'ˈdɒlfɪn', 1],
    ],
  });
  const rand = mulberry32(17);
  for (const index of [0, 1, 2, 3]) {
    for (const mode of ['spell', 'mixed', 'choice']) {
      const q = buildQuestion({ wordbook, index, mode, rand });
      assert.equal(q.type, QUESTION_TYPE.EN2ZH, `${wordbook.wordAt(index).word} 在 ${mode} 模式下应只考英译中`);
    }
  }
  // 实词仍然可以出拼写题
  const q = buildQuestion({ wordbook, index: 4, mode: 'spell', rand });
  assert.equal(q.type, QUESTION_TYPE.SPELL);
});

test('过短的词不生成拼写题', () => {
  const wordbook = createWordbook({
    meta: {},
    words: [
      ['ox', 'n. 公牛', 'ɒks', 1],
      ['a', 'art. 一个', 'ə', 1],
      ['apple', 'n. 苹果', 'ˈæpl', 1],
      ['banana', 'n. 香蕉', 'bəˈnɑːnə', 1],
      ['cherry', 'n. 樱桃', 'ˈtʃeri', 1],
    ],
  });
  const rand = mulberry32(9);
  const q = buildQuestion({ wordbook, index: 0, mode: 'spell', rand });
  assert.equal(q.type, QUESTION_TYPE.EN2ZH);
});

test('checkAnswer 能判定选择题', () => {
  const wordbook = makeWordbook(30);
  const rand = mulberry32(13);
  const q = buildQuestion({ wordbook, index: 2, mode: 'choice', rand });
  const correct = q.options.find((o) => o.correct);
  const wrong = q.options.find((o) => !o.correct);
  assert.equal(checkAnswer(q, { key: correct.key }), true);
  assert.equal(checkAnswer(q, { key: wrong.key }), false);
  assert.equal(checkAnswer(q, { key: '不存在的词' }), false);
});

test('拼写判定忽略大小写与多余空格', () => {
  assert.equal(normalizeSpelling('  Apple '), 'apple');
  assert.equal(normalizeSpelling('DON\u2019T'), "don't");
  const q = { type: QUESTION_TYPE.SPELL, answer: "don't" };
  assert.equal(checkAnswer(q, 'DON’T'), true);
  assert.equal(checkAnswer(q, ' dont '), false);
});

test('索引越界抛出 RangeError', () => {
  const wordbook = makeWordbook(5);
  assert.throws(() => buildQuestion({ wordbook, index: 99 }), RangeError);
});

test('相同随机种子产生相同题目', () => {
  const wordbook = makeWordbook(30);
  const a = buildQuestion({ wordbook, index: 4, mode: 'mixed', rand: mulberry32(21) });
  const b = buildQuestion({ wordbook, index: 4, mode: 'mixed', rand: mulberry32(21) });
  assert.equal(a.type, b.type);
  assert.deepEqual(
    a.options.map((o) => o.key),
    b.options.map((o) => o.key),
  );
});

test('词库很小时也能凑出选项', () => {
  const wordbook = makeWordbook(4);
  const q = buildQuestion({ wordbook, index: 0, mode: 'choice', rand: mulberry32(2) });
  assert.ok(q.options.length >= 1);
  assert.equal(q.options.filter((o) => o.correct).length, 1);
});
