import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

const WB = boot(['core/store.js', 'core/srs.js', 'core/words.js', 'core/export.js']);

function seed() {
  WB.store.addNotebook('banana', 'review');
  WB.store.addNotebook('apple', 'learn');
  WB.store.updateNotebook('apple', { note: 'a "red" fruit, sweet', mastered: true });
  WB.store.putCard({ w: 'apple', state: 'review', reps: 3, due: '2026-11-08', interval: 3 });
}

seed();

test('导出行包含完整列并按字母排序', function () {
  const rows = WB.exporter.rows();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].w, 'apple');
  assert.equal(rows[0].tier, 'L2');
  assert.equal(rows[0].mastered, '已掌握');
  assert.equal(rows[0].reps, '3');
  assert.equal(rows[0].due, '2026-11-08');
  assert.ok(rows[0].ph.length > 0);
  assert.equal(rows[1].source, '复习答错');
});

test('CSV 带 BOM、表头与转义', function () {
  const csv = WB.exporter.toCSV(WB.exporter.rows(['apple']));
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.indexOf('单词,音标,释义,档位,来源,加入日期,掌握状态,复习次数,下次复习,备注') > 0);
  assert.ok(csv.includes('"a ""red"" fruit, sweet"'));
  assert.ok(csv.includes('\r\n'));
});

test('TXT 一行一词，Markdown 转义竖线', function () {
  WB.store.updateNotebook('banana', { note: 'pipe | here' });
  const rows = WB.exporter.rows(['apple', 'banana']);
  const txt = WB.exporter.toTXT(rows);
  assert.equal(txt.trim().split(/\r\n/).length, 2);
  const md = WB.exporter.toMarkdown(rows);
  assert.ok(md.startsWith('# 单词书 · 生词本'));
  assert.ok(md.includes('| 单词 | 音标 |'));
  assert.ok(md.includes('pipe \\| here'));
});

test('Anki TSV 头与三列格式', function () {
  const anki = WB.exporter.toAnki(WB.exporter.rows(['apple']));
  const lines = anki.split('\n');
  assert.equal(lines[0], '#separator:Tab');
  assert.equal(lines[1], '#html:false');
  assert.equal(lines[2], '#columns:Front\tBack\tTags');
  const row = lines[3].split('\t');
  assert.equal(row.length, 3);
  assert.equal(row[0], 'apple');
  assert.ok(row[1].includes('苹果'));
  assert.ok(row[2].startsWith('wordbook tier2'));
});

test('JSON 全量备份包含各数据区', function () {
  const parsed = JSON.parse(WB.exporter.fullJSON());
  assert.equal(parsed.schema, 'wb:v1');
  assert.deepEqual(Object.keys(parsed).sort(), ['app', 'cards', 'daily', 'exportedAt', 'meta', 'notebook', 'reviews', 'schema', 'settings']);
  assert.equal(parsed.notebook.apple.mastered, true);
  assert.ok(parsed.cards.apple.reps === 3);
});

test('未加载 XLSX 时返回 false，由调用方回退 CSV', function () {
  assert.equal(WB.exporter.toXLSX(WB.exporter.rows()), false);
});
