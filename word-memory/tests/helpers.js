/** 测试辅助：构造小型词库与内存存储 */

import { createWordbook } from '../src/core/wordbook.js';
import { createStore, createMemoryAdapter } from '../src/core/store.js';

export const SAMPLE_WORDS = [
  'apple', 'banana', 'cherry', 'dolphin', 'eagle',
  'forest', 'garden', 'harbor', 'island', 'jacket',
  'kettle', 'ladder', 'magnet', 'needle', 'orange',
  'pebble', 'quartz', 'rabbit', 'silver', 'turtle',
  'umbrella', 'violet', 'walnut', 'yellow', 'zebra',
  'anchor', 'basket', 'candle', 'dragon', 'engine',
];

export const T0 = new Date(2026, 10, 7, 9, 0, 0).getTime(); // 2026-11-07 09:00 本地时间

export function makePayload(count = SAMPLE_WORDS.length) {
  const words = [];
  for (let i = 0; i < count; i += 1) {
    const base = SAMPLE_WORDS[i % SAMPLE_WORDS.length];
    const word = i < SAMPLE_WORDS.length ? base : `${base}${Math.floor(i / SAMPLE_WORDS.length)}`;
    words.push([word, `第${i + 1}号词释义`, `${word}-phonetic`, (i % 4) + 1]);
  }
  return {
    meta: { version: 'test', sourceHash: 'testhash', count: words.length },
    words,
  };
}

export function makeWordbook(count = SAMPLE_WORDS.length) {
  return createWordbook(makePayload(count));
}

export function makeStore(options = {}) {
  const adapter = options.adapter || createMemoryAdapter();
  const store = createStore({
    adapter,
    now: options.now || (() => T0),
  });
  store.load();
  return store;
}

export function defaultSettings(overrides = {}) {
  return {
    newPerDay: 20,
    reviewPerDay: 200,
    levels: [1, 2, 3, 4],
    order: 'frequency',
    answerMode: 'mixed',
    autoPlay: false,
    showPhonetic: true,
    theme: 'dark',
    sessionSize: 20,
    ...overrides,
  };
}
