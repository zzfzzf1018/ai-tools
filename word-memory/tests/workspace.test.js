/** 工作区：多账户 / 多词库 / 进度隔离 / 迁移 / 备份 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryKV, createKVAdapter } from '../src/core/kv.js';
import { createStore } from '../src/core/store.js';
import { createWorkspace, BUILTIN_BOOK_ID, META_KEY } from '../src/core/workspace.js';
import { parseBook } from '../src/core/bookparse.js';
import { makePayload, T0 } from './helpers.js';

const BUILTIN = makePayload(40);

function setup(kv = createMemoryKV(), legacy = null, builtinPayload = BUILTIN) {
  return createWorkspace({ kv, builtinPayload, legacy, now: () => T0 });
}

function openStore(ws, accountId, bookId) {
  const store = createStore({
    adapter: createKVAdapter(ws.kv),
    key: ws.progressKey(accountId, bookId),
    settingsKey: ws.settingsKey(accountId),
    now: () => T0,
  });
  store.load();
  return store;
}

function sampleBook() {
  return parseBook('apple,苹果\nbanana,香蕉\ncherry,樱桃', { filename: 'fruit.csv', name: '水果词库' });
}

function markMastered(ws, accountId, bookId) {
  const store = openStore(ws, accountId, bookId);
  store.setMastered(0, true);
  store.flush();
  return store;
}

test('初始化：一个默认账户、内置 8000 词库为默认且不可删除', () => {
  const ws = setup();
  assert.equal(ws.accounts().length, 1);
  assert.equal(ws.books().length, 1);
  assert.equal(ws.activeBookId(), BUILTIN_BOOK_ID);
  assert.equal(ws.bookById(BUILTIN_BOOK_ID).builtin, true);
  assert.equal(ws.bookById(BUILTIN_BOOK_ID).count, 40);
  assert.throws(() => ws.deleteBook(BUILTIN_BOOK_ID), /不能删除/);
  assert.equal(ws.initResult.migrated, false);
  assert.ok(ws.kv.get(META_KEY));
});

test('账户：新建、重名自动加序号、切换、重命名、删除', () => {
  const ws = setup();
  const a = ws.addAccount('小明');
  const b = ws.addAccount('小明');
  assert.equal(a.name, '小明');
  assert.equal(b.name, '小明 2');

  ws.setActiveAccount(a.id);
  assert.equal(ws.activeAccountId(), a.id);
  ws.renameAccount(a.id, '小红');
  assert.equal(ws.activeAccount().name, '小红');

  assert.throws(() => ws.deleteAccount('不存在'), /账户不存在/);
  ws.deleteAccount(a.id);
  assert.equal(ws.accounts().length, 2);
  assert.notEqual(ws.activeAccountId(), a.id);
  ws.deleteAccount(b.id);
  assert.equal(ws.accounts().length, 1);
  assert.throws(() => ws.deleteAccount(ws.activeAccountId()), /至少/);
});

test('词库：导入后切换、重命名、导出、删除', () => {
  const ws = setup();
  const book = ws.addBook('水果', sampleBook());
  assert.equal(book.count, 3);
  assert.equal(ws.books().length, 2);
  assert.equal(ws.bookPayload(book.id).words.length, 3);
  assert.equal(ws.bookPayload(BUILTIN_BOOK_ID), BUILTIN);

  ws.setActiveBook(book.id);
  assert.equal(ws.activeBookId(), book.id);
  assert.equal(ws.activeBook().name, '水果');

  ws.renameBook(book.id, '水果 2');
  assert.equal(ws.activeBook().name, '水果 2');

  ws.deleteBook(book.id);
  assert.equal(ws.books().length, 1);
  assert.equal(ws.activeBookId(), BUILTIN_BOOK_ID);
  assert.equal(ws.kv.get(`wm/v2/book/${book.id}`), null);
});

test('每个账户记住自己当前使用的词库', () => {
  const ws = setup();
  const book = ws.addBook('水果', sampleBook());
  const a = ws.addAccount('小明');
  const firstAccount = ws.accounts()[0].id;

  ws.setActiveBook(book.id, a.id);
  assert.equal(ws.activeBookId(a.id), book.id);
  assert.equal(ws.activeBookId(firstAccount), BUILTIN_BOOK_ID);

  ws.setActiveAccount(a.id);
  assert.equal(ws.activeBookId(), book.id);
  ws.setActiveAccount(firstAccount);
  assert.equal(ws.activeBookId(), BUILTIN_BOOK_ID);
});

test('学习记录按账户与词库双维度隔离', () => {
  const ws = setup();
  const accA = ws.activeAccountId();
  const accB = ws.addAccount('小明').id;
  const book = ws.addBook('水果', sampleBook());

  const storeA = openStore(ws, accA, BUILTIN_BOOK_ID);
  storeA.setMastered(0, true);
  storeA.updateSettings({ newPerDay: 33 });
  storeA.flush();
  assert.equal(storeA.getState(0).s, 3);

  const storeB = openStore(ws, accB, BUILTIN_BOOK_ID);
  assert.equal(storeB.getState(0).s, 0, '另一个账户不应看到 A 的记录');
  assert.equal(storeB.settings.newPerDay, 20, '设置也应按账户隔离');

  const storeBook = openStore(ws, accA, book.id);
  assert.equal(storeBook.getState(0).s, 0, '同一账户换词库也不应串记录');
  assert.equal(storeBook.settings.newPerDay, 33, '同一账户跨词库共享设置');

  const back = openStore(ws, accA, BUILTIN_BOOK_ID);
  assert.equal(back.getState(0).s, 3, '切回原词库应恢复进度');
});

test('删除账户 / 词库会清理对应的学习记录', () => {
  const ws = setup();
  const accA = ws.activeAccountId();
  const accB = ws.addAccount('小明').id;
  const book = ws.addBook('水果', sampleBook());

  markMastered(ws, accB, BUILTIN_BOOK_ID);
  markMastered(ws, accA, book.id);
  assert.ok(ws.kv.get(ws.progressKey(accB, BUILTIN_BOOK_ID)));
  assert.ok(ws.kv.get(ws.progressKey(accA, book.id)));

  ws.deleteAccount(accB);
  assert.equal(ws.kv.get(ws.progressKey(accB, BUILTIN_BOOK_ID)), null);
  assert.equal(ws.kv.get(ws.settingsKey(accB)), null);

  ws.deleteBook(book.id);
  assert.equal(ws.kv.get(ws.progressKey(accA, book.id)), null);
  assert.equal(ws.kv.get(`wm/v2/book/${book.id}`), null);
  assert.equal(ws.activeBookId(accA), BUILTIN_BOOK_ID);
});

test('v1 旧存档自动迁移到默认账户的内置词库', () => {
  const legacy = JSON.stringify({
    v: 1,
    meta: { createdAt: T0, updatedAt: T0, dataVersion: '' },
    settings: { newPerDay: 42 },
    words: { 0: { s: 3, star: 1 } },
    daily: { '2026-11-07': { n: 2, r: 1, c: 2, a: 3, ms: 1000 } },
  });
  const ws = setup(createMemoryKV({ 'word-memory/v1': legacy }), legacy);
  assert.equal(ws.initResult.migrated, true);
  assert.equal(ws.readSettings().newPerDay, 42);
  const store = openStore(ws, ws.activeAccountId(), BUILTIN_BOOK_ID);
  assert.equal(store.getState(0).s, 3);
  assert.equal(store.getState(0).star, 1);
  assert.deepEqual(store.allDaily()['2026-11-07'], { n: 2, r: 1, c: 2, a: 3, ms: 1000 });
});

test('损坏的工作区元数据会自动重建，内置词库始终存在', () => {
  const kv = createMemoryKV({ [META_KEY]: '{broken', 'wm/v2/book/ghost': '[]' });
  const ws = setup(kv);
  assert.equal(ws.accounts().length, 1);
  assert.equal(ws.books().length, 1);
  assert.equal(ws.activeBookId(), BUILTIN_BOOK_ID);
});

test('全量备份可跨工作区还原账户、词库与进度', () => {
  const ws = setup();
  const accB = ws.addAccount('小明').id;
  const book = ws.addBook('水果', sampleBook());
  ws.setActiveBook(book.id, accB);
  markMastered(ws, accB, book.id);

  const backup = ws.exportBundle();
  const parsed = JSON.parse(backup);
  assert.equal(parsed.app, 'word-memory');
  assert.equal(parsed.meta.accounts.length, 2);

  const restored = setup();
  const stats = restored.importBundle(backup);
  assert.equal(stats.accounts, 2);
  assert.equal(stats.books, 2);
  assert.equal(restored.bookById(book.id).count, 3);
  assert.equal(restored.activeBookId(accB), book.id);
  assert.equal(openStore(restored, accB, book.id).getState(0).s, 3);
});

test('全量备份导入会先清空旧数据并拒绝非法文件', () => {
  const ws = setup();
  ws.addAccount('旧账户');
  const backup = setup().exportBundle();
  const stats = ws.importBundle(backup);
  assert.equal(stats.accounts, 1);
  assert.equal(ws.accounts().length, 1);
  assert.throws(() => ws.importBundle('{}'), /不是有效/);
  assert.throws(() => ws.importBundle('{bad'), /JSON 解析失败/);
});

test('重置工作区恢复初始状态', () => {
  const ws = setup();
  ws.addAccount('小明');
  ws.addBook('水果', sampleBook());
  ws.resetAll();
  assert.equal(ws.accounts().length, 1);
  assert.equal(ws.books().length, 1);
  assert.equal(ws.kv.keys().filter((k) => k.startsWith('wm/v2/book/')).length, 0);
});
