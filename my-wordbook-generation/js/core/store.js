/* 单词书 · 本地存储（localStorage，带内存兜底） */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const PREFIX = 'wb:v1:';

  let ls = null;
  try {
    ls = window.localStorage;
    const probe = PREFIX + 'probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
  } catch (e) {
    ls = null;
  }
  const memory = {};

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  const date = WB.date = {
    pad: pad,
    key: function (d) {
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    },
    today: function () { return date.key(new Date()); },
    parse: function (key) {
      const parts = String(key).split('-').map(Number);
      return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, 12, 0, 0);
    },
    addDays: function (key, n) {
      const d = date.parse(key);
      d.setDate(d.getDate() + Number(n || 0));
      return date.key(d);
    },
    diff: function (a, b) {
      return Math.round((date.parse(b) - date.parse(a)) / 86400000);
    },
    formatCN: function (key) {
      const d = date.parse(key);
      const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
      return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + week;
    },
    short: function (key) {
      const d = date.parse(key);
      return (d.getMonth() + 1) + '/' + d.getDate();
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readRaw(key) {
    try {
      if (ls) {
        const value = ls.getItem(PREFIX + key);
        if (value != null) memory[key] = value;
        return value;
      }
    } catch (e) { /* ignore */ }
    return memory[key] || null;
  }

  function writeRaw(key, value) {
    memory[key] = value;
    try {
      if (ls) ls.setItem(PREFIX + key, value);
    } catch (e) {
      if (WB.ui && WB.ui.toast) {
        WB.ui.toast('浏览器存储空间不足，最新改动可能未保存', 'warn');
      }
    }
  }

  function readJSON(key, fallback) {
    const raw = readRaw(key);
    if (raw == null) return clone(fallback);
    try {
      const value = JSON.parse(raw);
      if (value == null) return clone(fallback);
      return value;
    } catch (e) {
      return clone(fallback);
    }
  }

  function plainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function objectMap(value) {
    const source = plainObject(value);
    const out = {};
    Object.keys(source).forEach(function (key) {
      const item = source[key];
      if (item && typeof item === 'object' && !Array.isArray(item)) out[key] = item;
    });
    return out;
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function defaultSettings() {
    return {
      tier: 1,
      dailyNew: 20,
      reviewCap: 200,
      skipBasic: true,
      modes: { en2zh: true, zh2en: true, spell: true, listen: true },
      autoAddUnknown: true,
      theme: 'auto',
      onboardingDone: false
    };
  }

  function mergeSettings(raw) {
    const base = defaultSettings();
    const input = raw && typeof raw === 'object' ? raw : {};
    const out = Object.assign({}, base, input);
    out.modes = Object.assign({}, base.modes, input.modes && typeof input.modes === 'object' ? input.modes : {});
    out.tier = [1, 2, 3].indexOf(Number(out.tier)) >= 0 ? Number(out.tier) : 1;
    out.dailyNew = clampNumber(out.dailyNew, 1, 200, 20);
    out.reviewCap = clampNumber(out.reviewCap, 20, 2000, 200);
    out.theme = ['auto', 'light', 'dark'].indexOf(out.theme) >= 0 ? out.theme : 'auto';
    out.skipBasic = !!out.skipBasic;
    out.autoAddUnknown = out.autoAddUnknown !== false;
    out.onboardingDone = !!out.onboardingDone;
    Object.keys(out.modes).forEach(function (key) { out.modes[key] = !!out.modes[key]; });
    if (!Object.keys(out.modes).some(function (key) { return out.modes[key]; })) {
      out.modes.en2zh = true;
    }
    return out;
  }

  const loadedReviews = readJSON('reviews', []);

  const state = {
    settings: mergeSettings(readJSON('settings', {})),
    cards: plainObject(readJSON('cards', {})),
    notebook: plainObject(readJSON('notebook', {})),
    reviews: Array.isArray(loadedReviews) ? loadedReviews : [],
    daily: plainObject(readJSON('daily', {})),
    meta: plainObject(readJSON('meta', {}))
  };

  if (!state.meta.version) state.meta.version = 1;
  if (!state.meta.createdAt) state.meta.createdAt = date.today();
  state.meta.lastOpen = date.today();

  function persist(key) {
    writeRaw(key, JSON.stringify(state[key]));
  }

  persist('meta');

  function getSettings() { return state.settings; }

  function updateSettings(patch) {
    const next = Object.assign({}, state.settings, patch || {});
    if (patch && patch.modes) {
      next.modes = Object.assign({}, state.settings.modes, patch.modes);
    }
    state.settings = mergeSettings(next);
    persist('settings');
    return state.settings;
  }

  function getCards() { return state.cards; }
  function getCard(word) { return state.cards[word] || null; }

  function putCard(card) {
    if (!card || !card.w) return null;
    state.cards[card.w] = card;
    persist('cards');
    return card;
  }

  function getNotebook() { return state.notebook; }
  function isInNotebook(word) { return !!state.notebook[word]; }

  function addNotebook(word, source) {
    if (!word) return null;
    if (!state.notebook[word]) {
      state.notebook[word] = {
        addedAt: date.today(),
        source: source || 'manual',
        note: '',
        mastered: false,
        leech: false
      };
      persist('notebook');
    } else if (source === 'leech') {
      state.notebook[word].leech = true;
      persist('notebook');
    }
    return state.notebook[word];
  }

  function updateNotebook(word, patch) {
    if (!state.notebook[word]) addNotebook(word, 'manual');
    Object.assign(state.notebook[word], patch || {});
    persist('notebook');
    return state.notebook[word];
  }

  function removeNotebook(word) {
    if (state.notebook[word]) {
      delete state.notebook[word];
      persist('notebook');
    }
  }

  function getReviews() { return state.reviews; }

  function logReview(word, grade, mode) {
    state.reviews.push({ w: word, ts: Date.now(), grade: grade, mode: mode || '' });
    if (state.reviews.length > 10000) {
      state.reviews = state.reviews.slice(-10000);
    }
    persist('reviews');
  }

  function getDaily() { return state.daily; }

  function todayEntry() {
    const key = date.today();
    if (!state.daily[key]) {
      state.daily[key] = { newCount: 0, reviewCount: 0, correct: 0, total: 0 };
    }
    const entry = state.daily[key];
    entry.newCount = entry.newCount || 0;
    entry.reviewCount = entry.reviewCount || 0;
    entry.correct = entry.correct || 0;
    entry.total = entry.total || 0;
    return entry;
  }

  function recordAnswer(kind, correct) {
    const entry = todayEntry();
    if (kind === 'new') entry.newCount += 1;
    else if (kind === 'review') entry.reviewCount += 1;
    entry.total += 1;
    if (correct) entry.correct += 1;
    persist('daily');
  }

  function activity(entry) {
    if (!entry) return false;
    return (entry.newCount || 0) + (entry.reviewCount || 0) + (entry.total || 0) > 0;
  }

  function streak() {
    let cursor = date.today();
    if (!activity(state.daily[cursor])) cursor = date.addDays(cursor, -1);
    let count = 0;
    while (count < 10000 && activity(state.daily[cursor])) {
      count += 1;
      cursor = date.addDays(cursor, -1);
    }
    return count;
  }

  function resetAll() {
    ['settings', 'cards', 'notebook', 'reviews', 'daily', 'meta'].forEach(function (key) {
      delete memory[key];
      try { if (ls) ls.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    });
    state.settings = defaultSettings();
    state.cards = {};
    state.notebook = {};
    state.reviews = [];
    state.daily = {};
    state.meta = { version: 1, createdAt: date.today(), lastOpen: date.today() };
    ['settings', 'cards', 'notebook', 'reviews', 'daily', 'meta'].forEach(persist);
    return state.settings;
  }

  function importAll(payload) {
    const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
    if (!data) throw new Error('不是有效的备份文件');
    if (data.schema !== 'wb:v1') throw new Error('不是单词书导出的备份文件');

    const meta = plainObject(data.meta);
    if (!Object.keys(meta).length) throw new Error('备份文件缺少元信息');

    const cards = objectMap(data.cards);
    Object.keys(cards).forEach(function (key) {
      if (!cards[key].w) cards[key].w = key;
    });

    state.settings = mergeSettings(data.settings);
    state.cards = cards;
    state.notebook = objectMap(data.notebook);
    state.reviews = Array.isArray(data.reviews) ? data.reviews.filter(function (item) {
      return item && typeof item === 'object' && !Array.isArray(item) && item.w;
    }) : [];
    state.daily = objectMap(data.daily);
    state.meta = Object.assign({}, meta, {
      version: meta.version || 1,
      createdAt: meta.createdAt || date.today(),
      lastOpen: date.today()
    });

    ['settings', 'cards', 'notebook', 'reviews', 'daily', 'meta'].forEach(persist);
    return state.settings;
  }

  function exportAll() {
    return {
      app: '单词书 Wordbook',
      schema: 'wb:v1',
      exportedAt: new Date().toISOString(),
      meta: state.meta,
      settings: state.settings,
      cards: state.cards,
      notebook: state.notebook,
      reviews: state.reviews,
      daily: state.daily
    };
  }

  function storageBytes() {
    let total = 0;
    Object.keys(memory).forEach(function (key) { total += memory[key].length; });
    return total;
  }

  WB.store = {
    available: !!ls,
    getSettings: getSettings,
    updateSettings: updateSettings,
    getCards: getCards,
    getCard: getCard,
    putCard: putCard,
    getNotebook: getNotebook,
    isInNotebook: isInNotebook,
    addNotebook: addNotebook,
    updateNotebook: updateNotebook,
    removeNotebook: removeNotebook,
    getReviews: getReviews,
    logReview: logReview,
    getDaily: getDaily,
    todayEntry: todayEntry,
    recordAnswer: recordAnswer,
    streak: streak,
    resetAll: resetAll,
    importAll: importAll,
    exportAll: exportAll,
    storageBytes: storageBytes
  };
})();
