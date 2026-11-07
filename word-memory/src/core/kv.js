/**
 * 键值存储层（同步读 + 后台异步写）
 * ------------------------------------------------------------
 * 背景：v2 引入「多账户 × 多词库」后，数据不再只有一份。为了让
 * store.js / UI 继续保持同步 API，这里约定：
 *
 *   - 启动时把后端全部 KV 一次性载入内存（快照）
 *   - 之后 get / set / remove 全部同步操作内存
 *   - set / remove 通过可替换的 writer 异步落盘（串行，保证顺序）
 *   - flush() 等待所有挂起写入完成，用于切换账户、导出、关页
 *
 * 后端实现：
 *   createMemoryKV()   测试 / 内存降级
 *   createLocalKV()    浏览器 localStorage
 *   createHttpKV()     EXE 便携版（Node 本地服务）
 *   createIdbKV()      浏览器 IndexedDB（大容量，存自定义词库）
 *
 * 所有实现暴露相同接口：
 *   { get, set, remove, keys, flush, isPersistent, lastError }
 */

/** 纯内存实现，测试与降级用 */
export function createMemoryKV(initial = {}) {
  const map = new Map(Object.entries(initial || {}));
  return {
    kind: 'memory',
    get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    set(key, value) {
      map.set(key, value);
      return true;
    },
    remove(key) {
      map.delete(key);
    },
    keys() {
      return [...map.keys()];
    },
    flush() {
      return Promise.resolve();
    },
    isPersistent: false,
    lastError: null,
  };
}

/** localStorage 实现（同步；容量约 5 MB，作为 IndexedDB 的降级方案） */
export function createLocalKV(storage, prefix = 'wm/') {
  let persistent = true;
  let lastError = null;
  return {
    kind: 'local',
    get(key) {
      try {
        return storage.getItem(key);
      } catch (err) {
        persistent = false;
        lastError = err.message;
        return null;
      }
    },
    set(key, value) {
      try {
        storage.setItem(key, value);
        persistent = true;
        lastError = null;
        return true;
      } catch (err) {
        persistent = false;
        lastError = `本地空间不足：${err.message}`;
        return false;
      }
    },
    remove(key) {
      try {
        storage.removeItem(key);
      } catch (err) {
        lastError = err.message;
      }
    },
    keys() {
      const out = [];
      try {
        for (let i = 0; i < storage.length; i += 1) {
          const k = storage.key(i);
          if (k && (!prefix || k.startsWith(prefix))) out.push(k);
        }
      } catch {
        /* 忽略 */
      }
      return out;
    },
    flush() {
      return Promise.resolve();
    },
    get isPersistent() {
      return persistent;
    },
    get lastError() {
      return lastError;
    },
  };
}

/**
 * 同步快照实现：读内存，写后端。
 * writer(key, value) / remover(key) 可返回 Promise 或同步值。
 */
export function createSnapshotKV({ snapshot = {}, write, remove, kind = 'snapshot' } = {}) {
  const map = new Map(Object.entries(snapshot || {}));
  let chain = Promise.resolve();
  let lastError = null;
  let failed = false;

  function enqueue(job) {
    chain = chain.then(job).catch((err) => {
      lastError = err?.message || String(err);
      failed = true;
    });
    return chain;
  }

  return {
    kind,
    get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    set(key, value) {
      map.set(key, value);
      if (write) enqueue(() => write(key, value));
      return true;
    },
    remove(key) {
      map.delete(key);
      if (remove) enqueue(() => remove(key));
    },
    keys() {
      return [...map.keys()];
    },
    flush() {
      return chain;
    },
    get isPersistent() {
      return !failed;
    },
    get lastError() {
      return lastError;
    },
  };
}

/**
 * EXE 便携版后端。
 * 需要先 await load() 取回服务端快照，之后接口同步。
 */
export function createHttpKV({ base = '/api', token = '', fetchImpl = (...args) => fetch(...args) } = {}) {
  const headers = { 'content-type': 'application/json', ...(token ? { 'x-wm-token': token } : {}) };

  async function request(path, options = {}) {
    const res = await fetchImpl(`${base}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    if (!res.ok) throw new Error(`服务端返回 ${res.status}`);
    return res.json();
  }

  const post = (payload) =>
    request('/kv', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

  return {
    async load() {
      const data = await request('/snapshot');
      if (!data || !data.ok || !data.kv) throw new Error('便携版数据快照读取失败');
      return createSnapshotKV({
        kind: 'http',
        snapshot: data.kv,
        write: (key, value) => post({ key, value }),
        remove: (key) => post({ key, value: null }),
      });
    },
    ping() {
      return request('/ping', { method: 'POST' }).catch(() => null);
    },
  };
}

/** IndexedDB 单表 KV，浏览器默认后端（容量远大于 localStorage） */
export function createIdbKV({ dbName = 'word-memory', storeName = 'kv' } = {}) {
  function open() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('当前环境不支持 IndexedDB'));
        return;
      }
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'));
    });
  }

  function tx(db, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      const request = fn(store);
      t.oncomplete = () => resolve(request ? request.result : undefined);
      t.onerror = () => reject(t.error || new Error('IndexedDB 事务失败'));
      t.onabort = () => reject(t.error || new Error('IndexedDB 事务中止'));
    });
  }

  return {
    async load() {
      const db = await open();
      const rows = await tx(db, 'readonly', (s) => s.getAll());
      const snapshot = {};
      for (const row of rows || []) {
        if (row && typeof row.key === 'string') snapshot[row.key] = row.value;
      }
      return createSnapshotKV({
        kind: 'idb',
        snapshot,
        write: (key, value) => tx(db, 'readwrite', (s) => s.put({ key, value })),
        remove: (key) => tx(db, 'readwrite', (s) => s.delete(key)),
      });
    },
  };
}

/**
 * 浏览器端后端选择：IndexedDB > localStorage > 内存。
 * 返回 { kv, legacy, mode }，legacy 是 v1 旧存档的原始字符串（用于迁移）。
 */
export async function createBrowserKV({ storage, forceMode } = {}) {
  let legacy = null;
  let ls = storage;
  if (!ls) {
    try {
      ls = window.localStorage;
    } catch {
      ls = null;
    }
  }
  if (ls) {
    try {
      legacy = ls.getItem('word-memory/v1');
    } catch {
      legacy = null;
    }
  }

  if (forceMode !== 'local' && forceMode !== 'memory') {
    try {
      const kv = await createIdbKV().load();
      return { kv, legacy, mode: 'idb' };
    } catch {
      /* 降级 */
    }
  }

  if (ls && forceMode !== 'memory') {
    try {
      const probe = '__wm_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return { kv: createLocalKV(ls), legacy, mode: 'local' };
    } catch {
      /* 降级 */
    }
  }

  return { kv: createMemoryKV(legacy ? { 'word-memory/v1': legacy } : {}), legacy, mode: 'memory' };
}

/** 把 KV 包装成 store.js 需要的 adapter */
export function createKVAdapter(kv) {
  return {
    kind: kv.kind || 'kv',
    get: (key) => kv.get(key),
    set: (key, value) => kv.set(key, value) !== false,
    remove: (key) => kv.remove(key),
    get isPersistent() {
      return kv.isPersistent !== false;
    },
  };
}
