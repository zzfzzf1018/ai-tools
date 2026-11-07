/** KV 存储层测试 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryKV,
  createLocalKV,
  createSnapshotKV,
  createHttpKV,
  createKVAdapter,
} from '../src/core/kv.js';

function mockStorage() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key(i) {
      return [...map.keys()][i] ?? null;
    },
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
  };
}

test('内存 KV：读写、删除、keys 与非持久化标记', () => {
  const kv = createMemoryKV({ a: '1' });
  assert.equal(kv.get('a'), '1');
  kv.set('b', '2');
  assert.deepEqual(kv.keys().sort(), ['a', 'b']);
  kv.remove('a');
  assert.equal(kv.get('a'), null);
  assert.equal(kv.isPersistent, false);
});

test('localStorage KV：只枚举指定前缀的键', () => {
  const storage = mockStorage();
  storage.setItem('unrelated', 'x');
  const kv = createLocalKV(storage);
  kv.set('wm/v2/meta', '{}');
  kv.set('wm/v2/book/a', '[]');
  assert.deepEqual(kv.keys().sort(), ['wm/v2/book/a', 'wm/v2/meta']);
  assert.equal(storage.getItem('wm/v2/meta'), '{}');
  assert.equal(kv.isPersistent, true);
});

test('localStorage KV：配额不足时降级但不抛异常', () => {
  const storage = mockStorage();
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  const kv = createLocalKV(storage);
  assert.equal(kv.set('wm/a', '1'), false);
  assert.equal(kv.isPersistent, false);
  assert.match(kv.lastError, /QuotaExceededError/);
  assert.equal(kv.get('wm/a'), null);
});

test('快照 KV：读同步可见，写串行且 flush 可等待', async () => {
  const writes = [];
  const kv = createSnapshotKV({
    snapshot: { a: '1' },
    write: async (key, value) => {
      await new Promise((r) => setTimeout(r, key === 'b' ? 15 : 1));
      writes.push([key, value]);
    },
    remove: async (key) => writes.push([key, null]),
  });
  assert.equal(kv.get('a'), '1');
  kv.set('b', '2');
  kv.set('b', '3');
  kv.remove('a');
  // 同步读立即反映最后一次写入
  assert.equal(kv.get('b'), '3');
  assert.equal(kv.get('a'), null);
  await kv.flush();
  assert.deepEqual(writes, [
    ['b', '2'],
    ['b', '3'],
    ['a', null],
  ]);
  assert.equal(kv.isPersistent, true);
});

test('快照 KV：写入失败被记录且不影响后续读取', async () => {
  const kv = createSnapshotKV({
    write: async () => {
      throw new Error('disk full');
    },
  });
  kv.set('wm/a', '1');
  await kv.flush();
  assert.equal(kv.get('wm/a'), '1');
  assert.equal(kv.isPersistent, false);
  assert.equal(kv.lastError, 'disk full');
});

test('HTTP KV：加载快照、携带令牌、删除转为 null', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/snapshot')) {
      return { ok: true, json: async () => ({ ok: true, kv: { 'wm/v2/meta': '{"a":1}' } }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const http = createHttpKV({ token: 'TOKEN123', fetchImpl });
  const kv = await http.load();
  assert.deepEqual(JSON.parse(kv.get('wm/v2/meta')), { a: 1 });
  assert.equal(kv.kind, 'http');

  kv.set('wm/v2/book/x', 'payload');
  kv.remove('wm/v2/meta');
  await kv.flush();

  assert.ok(calls.every((c) => c.options.headers['x-wm-token'] === 'TOKEN123'));
  const posts = calls.filter((c) => c.url.endsWith('/kv'));
  assert.equal(posts.length, 2);
  assert.deepEqual(JSON.parse(posts[0].options.body), { key: 'wm/v2/book/x', value: 'payload' });
  assert.deepEqual(JSON.parse(posts[1].options.body), { key: 'wm/v2/meta', value: null });
});

test('HTTP KV：快照异常时抛出可读错误', async () => {
  const http = createHttpKV({ fetchImpl: async () => ({ ok: true, json: async () => ({ ok: false }) }) });
  await assert.rejects(() => http.load(), /快照读取失败/);
});

test('KVAdapter 可被 store.js 当作 adapter 使用', () => {
  const kv = createMemoryKV();
  const adapter = createKVAdapter(kv);
  assert.equal(adapter.get('k'), null);
  assert.equal(adapter.set('k', 'v'), true);
  assert.equal(adapter.get('k'), 'v');
  adapter.remove('k');
  assert.equal(adapter.get('k'), null);
});
