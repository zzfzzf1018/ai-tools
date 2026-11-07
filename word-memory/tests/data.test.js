import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'data/words.json');

const raw = fs.readFileSync(DATA_FILE, 'utf8');
const payload = JSON.parse(raw);
const words = payload.words;

test('词库包含 8000 个词条', () => {
  assert.equal(payload.meta.count, 8000);
  assert.equal(words.length, 8000);
});

test('每条记录结构完整（词/释义/音标/频段）', () => {
  for (const row of words) {
    assert.ok(Array.isArray(row), '记录应为数组');
    assert.equal(row.length, 4, `字段数量应为 4：${JSON.stringify(row)}`);
    assert.ok(typeof row[0] === 'string' && row[0].length > 0, '单词为空');
    assert.ok(typeof row[1] === 'string' && row[1].length > 0, `释义为空：${row[0]}`);
    assert.ok(typeof row[2] === 'string', `音标类型错误：${row[0]}`);
    assert.ok([1, 2, 3, 4].includes(row[3]), `频段非法：${row[0]}`);
  }
});

test('单词无重复（忽略大小写）', () => {
  const seen = new Set();
  const dup = [];
  for (const row of words) {
    const key = row[0].toLowerCase();
    if (seen.has(key)) dup.push(row[0]);
    seen.add(key);
  }
  assert.deepEqual(dup, [], `发现重复词：${dup.slice(0, 10)}`);
});

test('词形只包含英文字母、连字符与撇号', () => {
  const bad = words.filter((row) => !/^[A-Za-z][A-Za-z'-]*$/.test(row[0]));
  assert.deepEqual(bad.map((r) => r[0]).slice(0, 10), []);
});

test('释义不含乱码与占位符', () => {
  const bad = words.filter((row) => /\uFFFD/.test(row[1]) || row[1] === '无');
  assert.deepEqual(bad.map((r) => r[0]).slice(0, 10), []);
});

test('释义长度受控（不超过 60 字符）', () => {
  const long = words.filter((row) => row[1].length > 60);
  assert.deepEqual(long.map((r) => r[0]).slice(0, 5), []);
});

test('频段分布符合设计（1000/2000/2500/2500）', () => {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const row of words) counts[row[3]] += 1;
  assert.equal(counts[1], 1000);
  assert.equal(counts[2], 2000);
  assert.equal(counts[3], 2500);
  assert.equal(counts[4], 2500);
});

test('高频词排在前列', () => {
  const first = words.slice(0, 10).map((r) => r[0]);
  for (const w of ['the', 'be', 'and']) {
    assert.ok(first.includes(w), `前 10 应包含 ${w}，实际 ${first.join(',')}`);
  }
});

test('音标覆盖率高于 98%', () => {
  const withPhonetic = words.filter((row) => row[2] && row[2].length > 0).length;
  assert.ok(withPhonetic / words.length > 0.98, `音标覆盖率 ${(withPhonetic / words.length * 100).toFixed(2)}%`);
});

test('文件体积在合理范围（< 800KB）', () => {
  const size = Buffer.byteLength(raw);
  assert.ok(size < 800 * 1024, `数据文件 ${(size / 1024).toFixed(1)}KB 超出预期`);
});

test('元信息包含来源与指纹', () => {
  assert.ok(payload.meta.source);
  assert.ok(payload.meta.sourceHash);
  assert.equal(payload.meta.version, '1.0.0');
});
