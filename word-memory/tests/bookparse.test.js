/** 自定义词库解析测试 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBook, validateBook, serializeBook, splitCsvLine, fnv1a } from '../src/core/bookparse.js';
import { createWordbook } from '../src/core/wordbook.js';

test('CSV 行切分支持引号、逗号与 Tab', () => {
  assert.deepEqual(splitCsvLine('apple,"n. 苹果, 苹果树"'), ['apple', 'n. 苹果, 苹果树']);
  assert.deepEqual(splitCsvLine('word\tmeaning\t/f/'), ['word', 'meaning', '/f/']);
  assert.deepEqual(splitCsvLine('say,"he said ""hi"""'), ['say', 'he said "hi"']);
});

test('解析本项目 words.json 结构', () => {
  const payload = {
    meta: { name: '测试词库', version: '1.0.0' },
    words: [
      ['apple', 'n. 苹果', 'ˈæpl', 1],
      ['banana', 'n. 香蕉', '', 2],
    ],
  };
  const parsed = parseBook(JSON.stringify(payload), { filename: 'my.json' });
  assert.equal(parsed.words.length, 2);
  assert.equal(parsed.meta.name, '测试词库');
  assert.deepEqual(parsed.words[0], ['apple', 'n. 苹果', 'ˈæpl', 1]);
  assert.equal(createWordbook(parsed).size, 2);
});

test('解析对象数组与「单词→释义」映射', () => {
  const arr = parseBook(JSON.stringify([{ word: 'cat', meaning: '猫' }, { word: 'dog', meaning: '狗', level: 3 }]), {
    filename: 'a.json',
  });
  assert.equal(arr.words.length, 2);
  assert.equal(arr.words[1][3], 3);

  const map = parseBook(JSON.stringify({ alpha: '希腊字母', beta: { meaning: '测试版' } }), { filename: 'b.json' });
  assert.deepEqual(map.words.map((r) => r[0]), ['alpha', 'beta']);
  assert.equal(map.words[1][1], '测试版');
});

test('解析 CSV / TXT：表头、注释、重复项与空释义', () => {
  const csv = '# 我的词表\nword,meaning,phonetic\napple,苹果,/ˈæpl/\nBanana,"香蕉, 芭蕉"\nAPPLE,重复的苹果\n,缺单词\ndog,\ncat,猫';
  const parsed = parseBook(csv, { filename: 'list.csv' });
  assert.deepEqual(parsed.words.map((r) => r[0]), ['apple', 'Banana', 'cat']);
  assert.equal(parsed.words[1][1], '香蕉, 芭蕉');
  assert.equal(parsed.meta.skipped, 3);

  const txt = parseBook('hello 你好\nworld\t世界', { filename: 'list.txt' });
  assert.equal(txt.words.length, 2);
  assert.equal(txt.words[0][1], '你好');
});

test('未指定频段时按内置比例自动分档', () => {
  const lines = Array.from({ length: 80 }, (_, i) => `word${i},释义${i}`).join('\n');
  const parsed = parseBook(lines, { filename: 'x.csv' });
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const row of parsed.words) counts[row[3]] += 1;
  assert.equal(parsed.words.length, 80);
  assert.deepEqual(counts, { 1: 10, 2: 20, 3: 25, 4: 25 });
  assert.equal(parsed.meta.count, 80);
});

test('非法内容给出明确错误', () => {
  assert.throws(() => parseBook('', { filename: 'a.csv' }), /文件是空的/);
  assert.throws(() => parseBook('{broken', { filename: 'a.json' }), /JSON 解析失败/);
  assert.throws(() => parseBook('# 只有注释\napple', { filename: 'a.txt' }), /没有解析出有效词条/);
  assert.throws(() => parseBook('[]', { filename: 'a.json' }), /没有解析出有效词条/);
});

test('validateBook 拒绝结构错误的词库，序列化可往返', () => {
  assert.throws(() => validateBook(null), /words 数组/);
  assert.throws(() => validateBook({ words: [['a']] }), /格式错误/);
  assert.throws(() => validateBook({ words: [['a', '释义', '', 9]] }), /频段非法/);

  const payload = parseBook('apple,苹果', { filename: 'a.csv', name: '水果' });
  const roundtrip = JSON.parse(serializeBook(payload));
  assert.doesNotThrow(() => validateBook(roundtrip));
  assert.equal(roundtrip.meta.name, '水果');
});

test('数据指纹稳定且对内容敏感', () => {
  const a = fnv1a('apple,苹果');
  assert.equal(a, fnv1a('apple,苹果'));
  assert.notEqual(a, fnv1a('apple,香蕉'));
  assert.match(a, /^[0-9a-f]{8}$/);
});
