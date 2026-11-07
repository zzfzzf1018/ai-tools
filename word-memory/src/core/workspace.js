/**
 * 工作区：多账户 + 多词库 + 进度隔离
 * ------------------------------------------------------------
 * 数据全部通过 KV 存放，键名约定：
 *
 *   wm/v2/meta                              工作区元数据（账户表、词库表、激活关系）
 *   wm/v2/book/<bookId>                    自定义词库内容（内置 8000 词库不落 KV）
 *   wm/v2/settings/<accountId>             账户级设置（跨词库共享）
 *   wm/v2/progress/<accountId>/<bookId>    该账户在该词库下的学习记录
 *
 * 设计理由：学习记录以「词库索引」为主键，不同词库索引含义不同，
 * 因此必须按 (账户, 词库) 双维度隔离，不能共用一份存档。
 *
 * 本模块是纯逻辑：所有方法同步，可被 Node 直接测试。
 */

import { DEFAULT_SETTINGS } from './store.js';
import { validateBook } from './bookparse.js';

export const META_KEY = 'wm/v2/meta';
export const BUILTIN_BOOK_ID = 'builtin-coca8000';
export const BUILTIN_BOOK_NAME = 'COCA 8000 核心词';
export const WORKSPACE_VERSION = 2;

const KEY = {
  book: (id) => `wm/v2/book/${id}`,
  settings: (id) => `wm/v2/settings/${id}`,
  progress: (accountId, bookId) => `wm/v2/progress/${accountId}/${bookId}`,
  progressPrefix: (accountId) => `wm/v2/progress/${accountId}/`,
};

let seq = 0;
function makeId(prefix) {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

function safeName(value, fallback) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return name || fallback;
}

function cloneMeta(meta) {
  return {
    ...meta,
    accounts: meta.accounts.map((a) => ({ ...a })),
    books: meta.books.map((b) => ({ ...b })),
    activeBook: { ...meta.activeBook },
  };
}

export function createWorkspace({ kv, builtinPayload, legacy = null, now = () => Date.now() } = {}) {
  if (!kv) throw new TypeError('createWorkspace 需要 kv');
  if (!builtinPayload || !Array.isArray(builtinPayload.words)) {
    throw new TypeError('createWorkspace 需要内置词库 payload');
  }

  let meta = null;
  let initResult = { ok: false, fresh: false, migrated: false };

  function defaultMeta() {
    const ts = now();
    const account = { id: makeId('acc'), name: '默认账户', createdAt: ts };
    const book = {
      id: BUILTIN_BOOK_ID,
      name: BUILTIN_BOOK_NAME,
      builtin: true,
      count: builtinPayload.words.length,
      createdAt: ts,
    };
    return {
      v: WORKSPACE_VERSION,
      createdAt: ts,
      accounts: [account],
      books: [book],
      activeAccountId: account.id,
      activeBook: { [account.id]: BUILTIN_BOOK_ID },
    };
  }

  function readMeta(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.books)) return null;
      const accounts = parsed.accounts
        .filter((a) => a && typeof a.id === 'string' && typeof a.name === 'string')
        .map((a) => ({ id: a.id, name: a.name, createdAt: Number(a.createdAt) || now() }));
      const books = parsed.books
        .filter((b) => b && typeof b.id === 'string' && typeof b.name === 'string')
        .map((b) => ({
          id: b.id,
          name: b.name,
          builtin: !!b.builtin,
          count: Number(b.count) || 0,
          createdAt: Number(b.createdAt) || now(),
        }));
      if (!accounts.length) return null;
      // 内置词库永远存在且不可删除
      if (!books.some((b) => b.id === BUILTIN_BOOK_ID)) {
        books.unshift({
          id: BUILTIN_BOOK_ID,
          name: BUILTIN_BOOK_NAME,
          builtin: true,
          count: builtinPayload.words.length,
          createdAt: now(),
        });
      }
      for (const b of books) {
        if (b.id === BUILTIN_BOOK_ID) {
          b.builtin = true;
          b.count = builtinPayload.words.length;
        }
      }
      const activeAccountId = accounts.some((a) => a.id === parsed.activeAccountId)
        ? parsed.activeAccountId
        : accounts[0].id;
      const activeBook = {};
      for (const a of accounts) {
        const candidate = parsed.activeBook?.[a.id];
        activeBook[a.id] = books.some((b) => b.id === candidate) ? candidate : BUILTIN_BOOK_ID;
      }
      return { v: WORKSPACE_VERSION, createdAt: Number(parsed.createdAt) || now(), accounts, books, activeAccountId, activeBook };
    } catch {
      return null;
    }
  }

  function saveMeta() {
    kv.set(META_KEY, JSON.stringify(meta));
  }

  function migrateLegacy() {
    if (!legacy) return false;
    let parsed;
    try {
      parsed = JSON.parse(legacy);
    } catch {
      return false;
    }
    if (!parsed || typeof parsed !== 'object') return false;
    const accId = meta.activeAccountId;
    // v1 存档整体作为 (默认账户, 内置词库) 的进度，store.load 会自行清洗
    kv.set(KEY.progress(accId, BUILTIN_BOOK_ID), JSON.stringify(parsed));
    if (parsed.settings && typeof parsed.settings === 'object') {
      kv.set(KEY.settings(accId), JSON.stringify(parsed.settings));
    }
    // 保留原始 key，不做破坏性删除
    return true;
  }

  function init() {
    meta = readMeta(kv.get(META_KEY));
    if (meta) {
      saveMeta();
      initResult = { ok: true, fresh: false, migrated: false };
      return initResult;
    }
    meta = defaultMeta();
    saveMeta();
    const migrated = migrateLegacy();
    initResult = { ok: true, fresh: true, migrated };
    return initResult;
  }

  /* ---------------- 查询 ---------------- */

  const accounts = () => meta.accounts.map((a) => ({ ...a }));
  const books = () => meta.books.map((b) => ({ ...b }));
  const activeAccountId = () => meta.activeAccountId;
  const activeAccount = () => meta.accounts.find((a) => a.id === meta.activeAccountId) || meta.accounts[0];
  const accountById = (id) => meta.accounts.find((a) => a.id === id) || null;
  const bookById = (id) => meta.books.find((b) => b.id === id) || null;
  const activeBookId = (accountId = meta.activeAccountId) => meta.activeBook[accountId] || BUILTIN_BOOK_ID;
  const activeBook = (accountId = meta.activeAccountId) => bookById(activeBookId(accountId)) || meta.books[0];
  const settingsKey = (accountId = meta.activeAccountId) => KEY.settings(accountId);
  const progressKey = (accountId = meta.activeAccountId, bookId = activeBookId(accountId)) => KEY.progress(accountId, bookId);

  function readSettings(accountId = meta.activeAccountId) {
    const raw = kv.get(KEY.settings(accountId));
    if (!raw) return { ...DEFAULT_SETTINGS, levels: [...DEFAULT_SETTINGS.levels] };
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS, levels: [...DEFAULT_SETTINGS.levels] };
    }
  }

  function writeSettings(settings, accountId = meta.activeAccountId) {
    kv.set(KEY.settings(accountId), JSON.stringify(settings || {}));
  }

  function bookPayload(bookId = activeBookId()) {
    if (bookId === BUILTIN_BOOK_ID) return builtinPayload;
    const raw = kv.get(KEY.book(bookId));
    if (!raw) return null;
    try {
      return validateBook(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  /* ---------------- 账户 ---------------- */

  function uniqueAccountName(name) {
    const base = safeName(name, '新账户');
    const used = new Set(meta.accounts.map((a) => a.name));
    if (!used.has(base)) return base;
    let i = 2;
    while (used.has(`${base} ${i}`)) i += 1;
    return `${base} ${i}`;
  }

  function addAccount(name) {
    const account = { id: makeId('acc'), name: uniqueAccountName(name), createdAt: now() };
    meta.accounts.push(account);
    meta.activeBook[account.id] = BUILTIN_BOOK_ID;
    saveMeta();
    return { ...account };
  }

  function renameAccount(id, name) {
    const account = accountById(id);
    if (!account) throw new Error('账户不存在');
    account.name = safeName(name, account.name);
    saveMeta();
    return { ...account };
  }

  function deleteAccount(id) {
    if (meta.accounts.length <= 1) throw new Error('至少需要保留一个账户');
    const account = accountById(id);
    if (!account) throw new Error('账户不存在');
    meta.accounts = meta.accounts.filter((a) => a.id !== id);
    delete meta.activeBook[id];
    for (const key of kv.keys()) {
      if (key === KEY.settings(id) || key.startsWith(KEY.progressPrefix(id))) kv.remove(key);
    }
    if (meta.activeAccountId === id) meta.activeAccountId = meta.accounts[0].id;
    saveMeta();
    return { ...account };
  }

  function setActiveAccount(id) {
    if (!accountById(id)) throw new Error('账户不存在');
    meta.activeAccountId = id;
    // 账户记住自己上次使用的词库
    if (!meta.activeBook[id]) meta.activeBook[id] = BUILTIN_BOOK_ID;
    saveMeta();
    return activeAccount();
  }

  /* ---------------- 词库 ---------------- */

  function uniqueBookName(name) {
    const base = safeName(name, '自定义词库');
    const used = new Set(meta.books.map((b) => b.name));
    if (!used.has(base)) return base;
    let i = 2;
    while (used.has(`${base} ${i}`)) i += 1;
    return `${base} ${i}`;
  }

  function addBook(name, payload) {
    validateBook(payload);
    const id = makeId('book');
    const book = {
      id,
      name: uniqueBookName(name),
      builtin: false,
      count: payload.words.length,
      createdAt: now(),
    };
    kv.set(KEY.book(id), JSON.stringify(payload));
    meta.books.push(book);
    saveMeta();
    return { ...book };
  }

  function renameBook(id, name) {
    const book = bookById(id);
    if (!book) throw new Error('词库不存在');
    book.name = safeName(name, book.name);
    saveMeta();
    return { ...book };
  }

  function deleteBook(id) {
    const book = bookById(id);
    if (!book) throw new Error('词库不存在');
    if (book.builtin) throw new Error('内置 8000 词库是默认词库，不能删除');
    kv.remove(KEY.book(id));
    meta.books = meta.books.filter((b) => b.id !== id);
    for (const account of meta.accounts) {
      const key = KEY.progress(account.id, id);
      kv.remove(key);
      if (meta.activeBook[account.id] === id) meta.activeBook[account.id] = BUILTIN_BOOK_ID;
    }
    saveMeta();
    return { ...book };
  }

  function setActiveBook(bookId, accountId = meta.activeAccountId) {
    if (!accountById(accountId)) throw new Error('账户不存在');
    if (!bookById(bookId)) throw new Error('词库不存在');
    meta.activeBook[accountId] = bookId;
    saveMeta();
    return bookById(bookId);
  }

  /* ---------------- 备份 ---------------- */

  /** 全量备份：所有账户、自定义词库、设置、学习进度 */
  function exportBundle() {
    const data = {};
    for (const key of kv.keys()) {
      if (key.startsWith('wm/v2/')) data[key] = kv.get(key);
    }
    data[META_KEY] = JSON.stringify(meta);
    return JSON.stringify(
      {
        app: 'word-memory',
        v: WORKSPACE_VERSION,
        exportedAt: now(),
        meta: cloneMeta(meta),
        data,
      },
      null,
      2,
    );
  }

  /** 导入全量备份（覆盖当前工作区），返回统计信息 */
  function importBundle(text) {
    let bundle;
    try {
      bundle = typeof text === 'string' ? JSON.parse(text) : text;
    } catch (err) {
      throw new Error(`JSON 解析失败：${err.message}`);
    }
    if (!bundle || bundle.app !== 'word-memory' || !bundle.data || typeof bundle.data !== 'object') {
      throw new Error('不是有效的 WordMemory 全量备份');
    }
    const nextMeta = readMeta(bundle.data[META_KEY]);
    if (!nextMeta) throw new Error('备份中的工作区元数据损坏');

    // 先清掉旧的 v2 数据，再逐条写入
    for (const key of kv.keys()) {
      if (key.startsWith('wm/v2/')) kv.remove(key);
    }
    for (const [key, value] of Object.entries(bundle.data)) {
      if (key.startsWith('wm/v2/') && typeof value === 'string') kv.set(key, value);
    }
    meta = nextMeta;
    saveMeta();
    return {
      accounts: meta.accounts.length,
      books: meta.books.length,
      records: Object.keys(bundle.data).filter((k) => k.startsWith('wm/v2/progress/')).length,
    };
  }

  /** 危险操作：清空整个工作区并恢复到初始状态 */
  function resetAll() {
    for (const key of kv.keys()) {
      if (key.startsWith('wm/v2/')) kv.remove(key);
    }
    meta = defaultMeta();
    saveMeta();
    initResult = { ok: true, fresh: true, migrated: false };
  }

  init();

  return {
    kv,
    builtinPayload,
    get meta() {
      return cloneMeta(meta);
    },
    get initResult() {
      return { ...initResult };
    },
    get builtinBookId() {
      return BUILTIN_BOOK_ID;
    },
    accounts,
    books,
    activeAccountId,
    activeAccount,
    accountById,
    bookById,
    activeBookId,
    activeBook,
    settingsKey,
    progressKey,
    readSettings,
    writeSettings,
    bookPayload,
    addAccount,
    renameAccount,
    deleteAccount,
    setActiveAccount,
    addBook,
    renameBook,
    deleteBook,
    setActiveBook,
    exportBundle,
    importBundle,
    resetAll,
    key: KEY,
  };
}
