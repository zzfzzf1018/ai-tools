/**
 * 界面集成测试（jsdom）
 * 覆盖：挂载、导航、学习会话主流程、词库筛选与标记、设置持久化。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { makePayload, T0 } from './helpers.js';

let dom;
let app;
let createApp;

function bootDom() {
  dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost:4173/',
    pretendToBeVisual: true,
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  global.getComputedStyle = dom.window.getComputedStyle;
  try {
    dom.window.localStorage.clear();
  } catch {
    /* 忽略 */
  }
  const root = dom.window.document.getElementById('app');
  app = createApp({ root, payload: makePayload(60), version: 'test' });
  return app;
}

function click(selector, root = dom.window.document) {
  const el = root.querySelector(selector);
  assert.ok(el, `未找到元素：${selector}`);
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return el;
}

function text(selector) {
  const el = dom.window.document.querySelector(selector);
  return el ? el.textContent.trim() : null;
}

test.before(async () => {
  ({ createApp } = await import('../src/ui/app.js'));
});

test.beforeEach(() => {
  bootDom();
});

test.afterEach(() => {
  if (app) app.store.flush();
  dom.window.close();
});

test('挂载后渲染侧边栏与今日视图', () => {
  const doc = dom.window.document;
  assert.ok(doc.querySelector('.brand__name'));
  assert.equal(doc.querySelectorAll('.nav__item').length, 5);
  assert.ok(doc.querySelector('.hero'));
  assert.ok(doc.querySelector('[data-action="start"]'));
});

test('导航可以切换到词库与统计', () => {
  click('[data-action="nav"][data-view="browse"]');
  assert.ok(dom.window.document.querySelector('#search-input'));
  click('[data-action="nav"][data-view="stats"]');
  assert.ok(dom.window.document.querySelector('.heatmap'));
  click('[data-action="nav"][data-view="settings"]');
  assert.ok(dom.window.document.querySelector('[data-action="export"]'));
});

test('开始学习后出现卡片与选项', () => {
  click('[data-action="start"]');
  assert.ok(dom.window.document.querySelector('.flashcard'));
  const options = dom.window.document.querySelectorAll('.option, #spell-input');
  assert.ok(options.length > 0, '应出现选项或拼写框');
});

test('作答后展示答案与四个评分按钮', () => {
  app.store.updateSettings({ answerMode: 'choice' });
  app.render();
  click('[data-action="start"]');

  const option = dom.window.document.querySelector('[data-action="pick"]');
  assert.ok(option, '应出现选择题选项');
  option.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  const gradeButtons = dom.window.document.querySelectorAll('[data-action="grade"]');
  assert.equal(gradeButtons.length, 4);
  assert.ok(dom.window.document.querySelector('.flashcard__meaning'));
});

test('评分后进度推进并写入存储', () => {
  app.store.updateSettings({ answerMode: 'choice' });
  app.render();
  click('[data-action="start"]');
  click('[data-action="reveal"]');

  const firstIndex = app.state.session.current().index;
  click('[data-action="grade"][data-grade="2"]');
  assert.equal(app.store.getState(firstIndex).seen, 1);
  assert.ok(app.state.session.done >= 1);
});

test('词库视图渲染分页列表并可标记重点', () => {
  click('[data-action="nav"][data-view="browse"]');
  const rows = dom.window.document.querySelectorAll('.wordrow');
  assert.equal(rows.length, 50);
  assert.ok(dom.window.document.querySelector('.pager'));

  const starBtn = dom.window.document.querySelector('[data-action="toggle-star"]');
  const index = Number(starBtn.dataset.index);
  starBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(app.store.getState(index).star, 1);
});

test('标记已掌握后从队列中排除', () => {
  click('[data-action="nav"][data-view="browse"]');
  const btn = dom.window.document.querySelector('[data-action="toggle-mastered"]');
  const index = Number(btn.dataset.index);
  btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(app.store.getState(index).s, 3);
  assert.equal(app.store.hasRecord(index), true);
});

test('搜索过滤词库', () => {
  click('[data-action="nav"][data-view="browse"]');
  const before = dom.window.document.querySelectorAll('.wordrow').length;
  const input = dom.window.document.getElementById('search-input');
  input.value = 'zebra';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const after = dom.window.document.querySelectorAll('.wordrow').length;
  assert.ok(after > 0 && after < before, `过滤后应减少：${before} → ${after}`);
  assert.match(dom.window.document.querySelector('.wordrow__word').textContent, /zebra/i);
});

test('筛选"已掌握"为空时显示空态', () => {
  click('[data-action="nav"][data-view="browse"]');
  click('[data-action="filter"][data-filter="mastered"]');
  assert.ok(dom.window.document.querySelector('.empty'));
});

test('设置项修改立即生效并持久化', () => {
  click('[data-action="nav"][data-view="settings"]');
  const bump = dom.window.document.querySelector('[data-action="bump"][data-key="newPerDay"][data-delta="1"]');
  bump.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(app.store.settings.newPerDay, 21);
  app.store.flush();

  const raw = dom.window.localStorage.getItem('word-memory/v1');
  assert.ok(raw && JSON.parse(raw).settings.newPerDay === 21);
});

test('切换主题会更新根节点属性', () => {
  click('[data-action="nav"][data-view="settings"]');
  const select = dom.window.document.querySelector('[data-select="theme"]');
  select.value = 'light';
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(dom.window.document.documentElement.dataset.theme, 'light');
});

test('学习页面可以直接标记当前词为已掌握', () => {
  app.store.updateSettings({ answerMode: 'choice' });
  app.render();
  click('[data-action="start"]');
  click('[data-action="reveal"]');
  const index = app.state.session.current().index;
  click(`[data-action="master"][data-index="${index}"]`);
  assert.equal(app.store.getState(index).s, 3);
});

test('结束本轮后展示结果页', () => {
  app.store.updateSettings({ answerMode: 'choice' });
  app.render();
  click('[data-action="start"]');
  click('[data-action="reveal"]');
  click('[data-action="grade"][data-grade="3"]');
  click('[data-action="end-session"]');
  assert.ok(dom.window.document.querySelector('.result'));
  assert.ok(dom.window.document.querySelector('[data-action="start"]'));
});
