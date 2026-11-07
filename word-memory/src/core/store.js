/**
 * 状态存储层
 * ------------------------------------------------------------
 * 职责：
 *   1. 维护全部学习状态（每词的 SRS 数据 + 每日统计 + 设置）
 *   2. 通过可替换的 adapter 做持久化（localStorage / 内存 / 自定义）
 *   3. 自动保存（防抖）、导入导出、版本迁移与容错
 *
 * 设计要点：
 *   - 只为"有变化"的词保存记录，8000 词全新建时占用接近 0
 *   - 任何读取都经过 normalizeState，历史数据不会让界面崩溃
 *   - 存储写入失败（隐私模式 / 配额耗尽）不会抛到调用方，
 *     而是记录 lastError 并继续以内存态工作
 */

import { dateKey } from './util.js';
import {
  STATUS,
  defaultState,
  normalizeState,
  review as applyReviewPure,
  markMastered as markMasteredPure,
  unmarkMastered as unmarkMasteredPure,
  toggleStar as toggleStarPure,
} from './srs.js';

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'word-memory/v1';

export const DEFAULT_SETTINGS = Object.freeze({
  newPerDay: 20, // 每日新词上限
  reviewPerDay: 200, // 每日复习上限
  levels: [1, 2, 3, 4], // 参与学习的频段
  order: 'frequency', // frequency=按词频 | random=乱序 | new-first=新词优先
  answerMode: 'mixed', // choice=选义 | spell=拼写 | mixed=混合
  autoPlay: false, // 出卡自动发音
  showPhonetic: true, // 显示音标
  theme: 'dark', // dark | light
  sessionSize: 20, // 每轮会话卡片上限
});

const SETTING_RULES = {
  newPerDay: { min: 0, max: 500, int: true },
  reviewPerDay: { min: 0, max: 2000, int: true },
  sessionSize: { min: 5, max: 200, int: true },
};

const ALLOWED_ORDER = ['frequency', 'random', 'new-first'];
const ALLOWED_MODE = ['choice', 'spell', 'mixed'];
const ALLOWED_THEME = ['dark', 'light'];

/** 内存适配器：默认实现，Node 测试与隐私模式兜底 */
export function createMemoryAdapter(initial = null) {
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
    isPersistent: false,
  };
}

/**
 * localStorage 适配器
 * 在 file:// 或隐私模式下 setItem 可能抛异常，这里统一降级
 */
export function createLocalAdapter(storage) {
  let persistent = true;
  return {
    kind: 'local',
    get(key) {
      try {
        return storage.getItem(key);
      } catch {
        persistent = false;
        return null;
      }
    },
    set(key, value) {
      try {
        storage.setItem(key, value);
        persistent = true;
        return true;
      } catch {
        persistent = false;
        return false;
      }
    },
    remove(key) {
      try {
        storage.removeItem(key);
      } catch {
        /* 忽略 */
      }
    },
    get isPersistent() {
      return persistent;
    },
  };
}

function blankData() {
  return {
    v: SCHEMA_VERSION,
    meta: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      dataVersion: '',
    },
    settings: { ...DEFAULT_SETTINGS, levels: [...DEFAULT_SETTINGS.levels] },
    words: {},
    daily: {},
  };
}

function sanitizeSettings(raw, fallback) {
  const out = { ...fallback };
  if (!raw || typeof raw !== 'object') return out;

  for (const [key, rule] of Object.entries(SETTING_RULES)) {
    const n = Number(raw[key]);
    if (Number.isFinite(n)) {
      const clamped = Math.min(rule.max, Math.max(rule.min, Math.round(n)));
      out[key] = clamped;
    }
  }
  if (Array.isArray(raw.levels)) {
    const levels = raw.levels
      .map((x) => Number(x))
      .filter((x) => [1, 2, 3, 4].includes(x));
    // 空选择视为"全部频段"
    out.levels = levels.length ? [...new Set(levels)].sort() : [...DEFAULT_SETTINGS.levels];
  }
  if (ALLOWED_ORDER.includes(raw.order)) out.order = raw.order;
  if (ALLOWED_MODE.includes(raw.answerMode)) out.answerMode = raw.answerMode;
  if (ALLOWED_THEME.includes(raw.theme)) out.theme = raw.theme;
  if (typeof raw.autoPlay === 'boolean') out.autoPlay = raw.autoPlay;
  if (typeof raw.showPhonetic === 'boolean') out.showPhonetic = raw.showPhonetic;
  return out;
}

function sanitizeDaily(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    if (!value || typeof value !== 'object') continue;
    const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
    out[key] = {
      n: num(value.n),
      r: num(value.r),
      c: num(value.c),
      a: num(value.a),
      ms: num(value.ms),
    };
  }
  return out;
}

/**
 * 创建存储实例
 * @param {object} options
 * @param {object} options.adapter 存储适配器
 * @param {string} options.key 学习记录存储键（按账户 + 词库区分）
 * @param {string} options.settingsKey 账户级设置键；为空时设置随记录一起存（v1 行为）
 * @param {() => number} options.now 时间源（便于测试）
 */
export function createStore(options = {}) {
  const {
    adapter = createMemoryAdapter(),
    key = STORAGE_KEY,
    settingsKey = '',
    now = () => Date.now(),
    autoSaveDelay = 400,
  } = options;

  let data = blankData();
  let dirty = false;
  let timer = null;
  let lastError = null;
  const listeners = new Set();

  function emit(event) {
    for (const fn of listeners) {
      try {
        fn(event, store);
      } catch {
        /* 订阅者异常不影响主流程 */
      }
    }
  }

  function markDirty() {
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      save();
    }, autoSaveDelay);
    if (typeof timer === 'object' && timer && 'unref' in timer) timer.unref();
  }

  function serialize() {
    if (!settingsKey) return JSON.stringify(data);
    // 设置提升到账户级后，学习记录里不再重复保存
    const { settings: _unused, ...rest } = data;
    return JSON.stringify(rest);
  }

  function save() {
    if (!dirty) return true;
    data.meta.updatedAt = now();
    let ok = true;
    if (settingsKey) {
      ok = adapter.set(settingsKey, JSON.stringify(data.settings)) && ok;
    }
    ok = adapter.set(key, serialize()) && ok;
    dirty = !ok;
    lastError = ok ? null : '存储写入失败（可能是隐私模式或空间不足）';
    if (ok) emit('save');
    return ok;
  }

  function load() {
    const raw = adapter.get(key);
    const rawSettings = settingsKey ? adapter.get(settingsKey) : null;
    if (!raw && !rawSettings) {
      data = blankData();
      dirty = false;
      return { ok: true, fresh: true };
    }
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (rawSettings) {
        try {
          parsed.settings = JSON.parse(rawSettings);
        } catch {
          /* 设置损坏时忽略，由 migrate 使用默认值 */
        }
      }
      data = migrate(parsed);
      dirty = false;
      // 设置与记录分键存储时，首次加载需要把默认值写回设置键
      if (settingsKey && !rawSettings) {
        adapter.set(settingsKey, JSON.stringify(data.settings));
      }
      return { ok: true, fresh: false, fromVersion: parsed?.v };
    } catch (err) {
      data = blankData();
      dirty = false;
      lastError = `存档解析失败：${err.message}`;
      return { ok: false, error: lastError };
    }
  }

  function migrate(parsed) {
    const base = blankData();
    if (!parsed || typeof parsed !== 'object') throw new Error('存档格式非法');

    const out = {
      v: SCHEMA_VERSION,
      meta: {
        createdAt: Number(parsed.meta?.createdAt) || Date.now(),
        updatedAt: Number(parsed.meta?.updatedAt) || Date.now(),
        dataVersion: typeof parsed.meta?.dataVersion === 'string' ? parsed.meta.dataVersion : '',
      },
      settings: sanitizeSettings(parsed.settings, base.settings),
      words: {},
      daily: sanitizeDaily(parsed.daily),
    };

    if (parsed.words && typeof parsed.words === 'object') {
      for (const [idx, raw] of Object.entries(parsed.words)) {
        const i = Number(idx);
        if (!Number.isInteger(i) || i < 0) continue;
        const state = normalizeState(raw);
        const isDefault =
          state.s === STATUS.NEW && state.star === 0 && state.seen === 0 && state.lapse === 0;
        if (!isDefault) out.words[i] = state;
      }
    }
    return out;
  }

  /** 取得词条状态（返回副本，调用方随便改） */
  function getState(index) {
    const raw = data.words[index];
    return raw ? { ...raw } : defaultState();
  }

  function hasRecord(index) {
    return Object.prototype.hasOwnProperty.call(data.words, index);
  }

  function setState(index, state) {
    const normalized = normalizeState(state);
    const isDefault =
      normalized.s === STATUS.NEW &&
      normalized.star === 0 &&
      normalized.seen === 0 &&
      normalized.lapse === 0;
    if (isDefault) {
      if (hasRecord(index)) delete data.words[index];
    } else {
      data.words[index] = normalized;
    }
    markDirty();
    return normalized;
  }

  function recordReview(index, grade, at = now()) {
    const next = applyReviewPure(getState(index), grade, at);
    setState(index, next);
    return next;
  }

  function setMastered(index, value, at = now()) {
    const prev = getState(index);
    const next = value ? markMasteredPure(prev, at) : unmarkMasteredPure(prev, at);
    setState(index, next);
    return next;
  }

  function toggleStar(index) {
    const next = toggleStarPure(getState(index));
    setState(index, next);
    return next;
  }

  function bumpDaily(delta, at = now()) {
    const k = dateKey(at);
    const cur = data.daily[k] || { n: 0, r: 0, c: 0, a: 0, ms: 0 };
    const next = {
      n: cur.n + (delta.n || 0),
      r: cur.r + (delta.r || 0),
      c: cur.c + (delta.c || 0),
      a: cur.a + (delta.a || 0),
      ms: cur.ms + (delta.ms || 0),
    };
    data.daily[k] = next;
    markDirty();
    return next;
  }

  function getDaily(k = dateKey(now())) {
    return data.daily[k] || { n: 0, r: 0, c: 0, a: 0, ms: 0 };
  }

  function allDaily() {
    return { ...data.daily };
  }

  function updateSettings(patch) {
    data.settings = sanitizeSettings({ ...data.settings, ...patch }, data.settings);
    markDirty();
    emit('settings');
    return { ...data.settings };
  }

  function reset(options2 = {}) {
    const { keepSettings = true } = options2;
    const settings = keepSettings ? data.settings : blankData().settings;
    data = blankData();
    data.settings = settings;
    markDirty();
    flush();
    emit('reset');
  }

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    return save();
  }

  function exportJSON() {
    flush();
    return JSON.stringify(
      {
        v: SCHEMA_VERSION,
        meta: { ...data.meta, exportedAt: now() },
        settings: data.settings,
        words: data.words,
        daily: data.daily,
      },
      null,
      2,
    );
  }

  function importJSON(text) {
    let parsed;
    try {
      parsed = typeof text === 'string' ? JSON.parse(text) : text;
    } catch (err) {
      return { ok: false, error: `JSON 解析失败：${err.message}` };
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.words) {
      return { ok: false, error: '文件内容不是有效的备份（缺少 words 字段）' };
    }
    try {
      const next = migrate(parsed);
      const known = Object.keys(next.words).filter((k) => Number(k) < 100000).length;
      data = next;
      dirty = true;
      save();
      emit('import');
      return { ok: true, count: known };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  const store = {
    // 元信息
    get schemaVersion() {
      return SCHEMA_VERSION;
    },
    get settings() {
      return { ...data.settings, levels: [...data.settings.levels] };
    },
    get meta() {
      return { ...data.meta };
    },
    get lastError() {
      return lastError;
    },
    get isPersistent() {
      return adapter.isPersistent !== false;
    },
    get pending() {
      return dirty;
    },
    // 生命周期
    load,
    save,
    flush,
    // 词状态
    getState,
    setState,
    hasRecord,
    recordReview,
    setMastered,
    toggleStar,
    // 统计
    bumpDaily,
    getDaily,
    allDaily,
    // 设置与数据管理
    updateSettings,
    reset,
    export: exportJSON,
    import: importJSON,
    subscribe,
    // 供 UI 批量读取，返回内部引用（约定只读）
    _rawWords: () => data.words,
    _setDataVersion(v) {
      data.meta.dataVersion = String(v || '');
      markDirty();
    },
    get dataVersion() {
      return data.meta.dataVersion;
    },
  };

  return store;
}
