/** 界面集成：账户 / 词库切换与管理（jsdom） */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createMemoryKV } from '../src/core/kv.js';
import { createWorkspace } from '../src/core/workspace.js';
import { parseBook } from '../src/core/bookparse.js';
import { makePayload } from './helpers.js';

const BUILTIN = makePayload(30);
const FRUIT = () => parseBook('apple,苹果\nbanana,香蕉\ncherry,樱桃', { filename: 'fruit.csv', name: '水果词库' });

let dom;
let ws;
let app;
let createApp;

function boot({ withBook = true, withAccount = false } = {}) {
  dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost:4173/',
    pretendToBeVisual: true,
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.FileReader = dom.window.FileReader;
  global.File = dom.window.File;
  global.Blob = dom.window.Blob;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;

  ws = createWorkspace({ kv: createMemoryKV(), builtinPayload: BUILTIN });
  if (withBook) ws.addBook('水果词库', FRUIT());
  if (withAccount) ws.addAccount('小明');

  app = createApp({
    root: dom.window.document.getElementById('app'),
    payload: BUILTIN,
    version: 'test',
    workspace: ws,
  });
  return app;
}

function click(selector, root = dom.window.document) {
  const el = root.querySelector(selector);
  assert.ok(el, `未找到元素：${selector}`);
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return el;
}

function change(selector, value) {
  const el = dom.window.document.querySelector(selector);
  assert.ok(el, `未找到元素：${selector}`);
  el.value = value;
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  return el;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test.before(async () => {
  ({ createApp } = await import('../src/ui/app.js'));
});

test.afterEach(() => {
  if (app) app.store.flush();
  if (dom) dom.window.close();
});

test('顶栏提供账户与词库下拉，并可随时切换词库', () => {
  boot();
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('#account-select option').length, 1);
  assert.equal(doc.querySelectorAll('#book-select option').length, 2);
  assert.equal(app.wordbook.size, 30);
  assert.equal(doc.querySelector('#brand-sub').textContent, BUILTIN.meta?.name || '自定义词库');

  const bookId = ws.books().find((b) => !b.builtin).id;
  change('#book-select', bookId);
  assert.equal(app.wordbook.size, 3);
  assert.equal(ws.activeBookId(), bookId);
  assert.equal(doc.querySelector('#brand-sub').textContent, '水果词库');
});

test('切换词库后学习记录彼此独立，切回可恢复', () => {
  boot();
  app.store.setMastered(0, true);
  app.store.flush();
  assert.equal(app.store.getState(0).s, 3);

  const bookId = ws.books().find((b) => !b.builtin).id;
  change('#book-select', bookId);
  assert.equal(app.store.getState(0).s, 0, '新词库不应继承旧词库的掌握标记');
  assert.equal(app.state.session, null, '切换词库应结束当前会话');

  app.store.setMastered(1, true);
  app.store.flush();
  change('#book-select', ws.builtinBookId);
  assert.equal(app.store.getState(0).s, 3, '切回原词库应恢复进度');
  assert.equal(app.store.getState(1).s, 0);
});

test('切换账户后学习记录与设置都不串号', () => {
  boot({ withAccount: true });
  const second = ws.accounts()[1].id;
  app.store.setMastered(0, true);
  app.store.updateSettings({ newPerDay: 37 });
  app.store.flush();

  change('#account-select', second);
  assert.equal(ws.activeAccountId(), second);
  assert.equal(app.store.getState(0).s, 0);
  assert.equal(app.store.settings.newPerDay, 20);

  change('#account-select', ws.accounts()[0].id);
  assert.equal(app.store.getState(0).s, 3);
  assert.equal(app.store.settings.newPerDay, 37);
});

test('设置页展示账户与词库管理区及全量备份入口', () => {
  boot();
  click('[data-action="nav"][data-view="settings"]');
  const doc = dom.window.document;
  assert.ok(doc.querySelector('[data-action="account-add"]'));
  assert.ok(doc.querySelector('[data-action="book-add"]'));
  assert.ok(doc.querySelector('[data-action="export-all"]'));
  assert.ok(doc.querySelector('[data-action="import-all"]'));
  assert.ok(doc.querySelector('[data-action="book-delete"][disabled]'), '内置词库删除按钮应禁用');
  assert.match(doc.body.textContent, /内置默认/);
});

test('通过弹窗新建账户后自动切换', async () => {
  boot();
  click('[data-action="nav"][data-view="settings"]');
  click('[data-action="account-add"]');
  await tick();
  const input = dom.window.document.querySelector('#modal-input');
  assert.ok(input, '应弹出输入对话框');
  input.value = '小红';
  click('[data-modal="ok"]');
  await tick();
  await tick();

  assert.equal(ws.accounts().length, 2);
  assert.equal(ws.activeAccount().name, '小红');
  assert.match(dom.window.document.querySelector('#account-select').textContent, /小红/);
});

test('导入 CSV 词库后自动切换为当前词库', async () => {
  boot({ withBook: false });
  click('[data-action="nav"][data-view="settings"]');
  const input = dom.window.document.querySelector('#import-book-file');
  assert.ok(input, '应存在词库导入输入框');

  const file = new dom.window.File(['kiwi,猕猴桃\nlemon,柠檬'], 'mylist.csv', { type: 'text/csv' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick();
  await tick();
  await tick();

  assert.equal(ws.books().length, 2);
  assert.equal(app.wordbook.size, 2);
  assert.equal(ws.activeBook().name, 'mylist');
});
