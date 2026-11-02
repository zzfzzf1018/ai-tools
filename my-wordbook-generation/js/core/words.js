/* 单词书 · 词库索引与档位 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const bank = window.WB_WORDBANK || { meta: {}, words: [] };
  const words = Array.isArray(bank.words) ? bank.words : [];

  const byWord = new Map();
  words.forEach(function (item) {
    byWord.set(item.w, item);
    byWord.set(item.w.toLowerCase(), item);
  });

  const tierLists = {};
  const tierLabels = { 1: '日常对话', 2: '影视观赏', 3: '阅读书报' };
  const tierTargets = { 1: 2000, 2: 4000, 3: 8000 };

  function list(tier) {
    const level = Number(tier) === 2 ? 2 : Number(tier) === 3 ? 3 : 1;
    if (!tierLists[level]) {
      tierLists[level] = words.filter(function (item) { return item.t <= level; });
    }
    return tierLists[level];
  }

  function byTier(tier) {
    return words.filter(function (item) { return item.t === Number(tier); });
  }

  function lookup(word) {
    if (!word) return null;
    return byWord.get(word) || byWord.get(String(word).toLowerCase()) || null;
  }

  function pending(tier, cards, skipBasic) {
    const map = cards || {};
    return list(tier).filter(function (item) {
      const card = map[item.w];
      if (card && card.state && card.state !== 'new') return false;
      if (skipBasic && item.basic) return false;
      return true;
    });
  }

  function shuffle(items, rng) {
    const random = rng || Math.random;
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function distractors(word, count, tier, rng) {
    const n = count || 3;
    const current = word || {};
    const primary = (current.zh && current.zh[0] || '').toLowerCase();
    let pool = words.filter(function (item) {
      return item.w !== current.w &&
        item.t === current.t &&
        item.zh && item.zh.length &&
        item.zh[0].toLowerCase() !== primary;
    });
    if (pool.length < n) {
      pool = list(tier || current.t || 1).filter(function (item) {
        return item.w !== current.w && item.zh && item.zh.length;
      });
    }
    return shuffle(pool, rng).slice(0, n);
  }

  function sensesText(item) {
    return item && item.zh ? item.zh.join('；') : '';
  }

  function normalize(text) {
    return String(text == null ? '' : text)
      .trim()
      .toLowerCase()
      .replace(/[’‘]/g, "'");
  }

  function matches(item, input) {
    if (!item) return false;
    return normalize(input) === normalize(item.w);
  }

  function rankOf(item) {
    return item && item.r ? item.r : Number.MAX_SAFE_INTEGER;
  }

  function sortByRank(items) {
    return items.slice().sort(function (a, b) { return rankOf(a) - rankOf(b); });
  }

  function learnedCount(tier, cards) {
    const map = cards || {};
    let count = 0;
    words.forEach(function (item) {
      if (item.t !== Number(tier)) return;
      const card = map[item.w];
      if (card && card.reps > 0) count += 1;
    });
    return count;
  }

  function tierLabel(tier) { return tierLabels[Number(tier)] || tierLabels[1]; }
  function tierTarget(tier) { return tierTargets[Number(tier)] || tierTargets[1]; }
  function tierTitle(tier) {
    const target = tierTarget(tier);
    return tierLabel(tier) + ' · ' + target.toLocaleString('en-US') + ' 词';
  }

  WB.words = {
    meta: bank.meta,
    all: function () { return words; },
    list: list,
    byTier: byTier,
    lookup: lookup,
    pending: pending,
    distractors: distractors,
    sensesText: sensesText,
    matches: matches,
    normalize: normalize,
    sortByRank: sortByRank,
    learnedCount: learnedCount,
    shuffle: shuffle,
    tierLabel: tierLabel,
    tierTarget: tierTarget,
    tierTitle: tierTitle,
    total: words.length
  };
})();
