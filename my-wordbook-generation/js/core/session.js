/* 单词书 · 每日队列与会话状态 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const MODE_LABELS = { en2zh: '英译中', zh2en: '中译英', spell: '拼写', listen: '听音' };

  let current = null;

  function enabledModes(modes) {
    return Object.keys(modes || {}).filter(function (key) { return modes[key] && MODE_LABELS[key]; });
  }

  function pickMode(modes, rng) {
    const list = enabledModes(modes);
    if (!list.length) return 'en2zh';
    const random = rng || Math.random;
    return list[Math.floor(random() * list.length)];
  }

  function makeItem(word, type, mode) {
    return {
      word: word,
      type: type,
      mode: mode || null,
      counted: false,
      retries: 0
    };
  }

  function build(kind, items, reason) {
    current = {
      kind: kind,
      queue: items,
      index: 0,
      answered: 0,
      correct: 0,
      added: 0,
      retryCount: 0,
      finished: false,
      reason: reason || '',
      startedAt: Date.now()
    };
    return current;
  }

  function start(kind) {
    const settings = WB.store.getSettings();
    const cards = WB.store.getCards();
    const today = WB.date.today();
    let items = [];
    let reason = '';

    if (kind === 'learn') {
      const entry = WB.store.getDaily()[today] || {};
      const used = entry.newCount || 0;
      const allow = Math.max(0, settings.dailyNew - used);
      const pool = WB.words.pending(settings.tier, cards, settings.skipBasic);
      if (!pool.length) {
        reason = '当前档位的单词已经全部学完，可以在设置里切换到更大的词库。';
      } else if (allow <= 0) {
        reason = '今天的新词目标已经完成。可以继续复习，或到设置里调高每日新词数。';
      }
      items = pool.slice(0, allow).map(function (word) {
        return makeItem(word, 'learn', null);
      });
    } else {
      const due = Object.keys(cards)
        .map(function (key) { return cards[key]; })
        .filter(function (card) {
          return card && card.state && card.state !== 'new' &&
            String(card.due || '') <= today;
        })
        .sort(function (a, b) {
          if (!!a.leech !== !!b.leech) return a.leech ? -1 : 1;
          return String(a.due || '').localeCompare(String(b.due || ''));
        })
        .slice(0, settings.reviewCap);

      if (!due.length) {
        reason = '今天没有到期的复习卡片。';
      }
      due.forEach(function (card) {
        const word = WB.words.lookup(card.w);
        if (word) items.push(makeItem(word, 'review', pickMode(settings.modes)));
      });
    }

    return build(kind, items, reason);
  }

  function startWords(input) {
    const settings = WB.store.getSettings();
    const items = (input || []).map(function (entry) {
      const word = typeof entry === 'string' ? WB.words.lookup(entry) : entry;
      if (!word) return null;
      return makeItem(word, 'review', pickMode(settings.modes));
    }).filter(Boolean);
    return build('review', items, items.length ? '' : '没有可复习的单词。');
  }

  function resume(kind) {
    if (!current || current.finished || !current.queue.length) return null;
    return !kind || current.kind === kind ? current : null;
  }

  function peek() {
    if (!current) return null;
    return current.queue[current.index] || null;
  }

  function cardFor(item) {
    if (!item) return null;
    return WB.store.getCard(item.word.w) || WB.srs.newCard(item.word.w);
  }

  function collect(word, source) {
    if (!word || WB.store.isInNotebook(word.w)) return false;
    WB.store.addNotebook(word.w, source || 'manual');
    if (current) current.added += 1;
    return true;
  }

  function answer(grade, mode) {
    const session = current;
    const item = peek();
    if (!session || !item) return null;

    const settings = WB.store.getSettings();
    const today = WB.date.today();
    const card = cardFor(item);
    const updated = WB.srs.schedule(card, grade, today);
    WB.store.putCard(updated);
    WB.store.logReview(item.word.w, grade, mode || item.mode || item.type);

    const kind = item.counted ? 'retry' : item.type === 'learn' ? 'new' : 'review';
    WB.store.recordAnswer(kind, grade >= 3);
    item.counted = true;

    session.answered += 1;
    if (grade >= 3) session.correct += 1;

    if (grade <= 2 && settings.autoAddUnknown && !WB.store.isInNotebook(item.word.w)) {
      WB.store.addNotebook(item.word.w, item.type === 'learn' ? 'learn' : 'review');
      session.added += 1;
    }

    if (updated.leech) {
      if (WB.store.isInNotebook(item.word.w)) {
        WB.store.updateNotebook(item.word.w, { leech: true });
      } else {
        WB.store.addNotebook(item.word.w, 'leech');
        session.added += 1;
      }
    }

    let retried = false;
    if (grade <= 2 && item.retries < 2) {
      const retry = Object.assign({}, item, {
        counted: true,
        retries: item.retries + 1,
        mode: session.kind === 'review' ? pickMode(settings.modes) : null
      });
      session.queue.push(retry);
      session.retryCount += 1;
      retried = true;
    }

    session.index += 1;
    if (session.index >= session.queue.length) session.finished = true;

    return { finished: session.finished, card: updated, retried: retried };
  }

  function summary() {
    if (!current) return null;
    return {
      kind: current.kind,
      answered: current.answered,
      correct: current.correct,
      accuracy: current.answered ? Math.round((current.correct / current.answered) * 100) : 0,
      added: current.added,
      total: current.queue.length,
      finished: current.finished,
      reason: current.reason,
      retryCount: current.retryCount
    };
  }

  function reset(kind) {
    if (current && (!kind || current.kind === kind)) current = null;
  }

  WB.session = {
    MODE_LABELS: MODE_LABELS,
    start: start,
    startWords: startWords,
    resume: resume,
    peek: peek,
    cardFor: cardFor,
    answer: answer,
    collect: collect,
    summary: summary,
    reset: reset,
    get current() { return current; }
  };
})();
