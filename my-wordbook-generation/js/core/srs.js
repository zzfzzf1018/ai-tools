/* 单词书 · SM-2 间隔重复排期 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const MIN_EASE = 1.3;
  const MAX_EASE = 3.0;
  const MAX_INTERVAL = 365;

  const GRADES = [
    { q: 2, label: '忘记', hint: '完全想不起来', cls: 'g2' },
    { q: 3, label: '模糊', hint: '有点印象', cls: 'g3' },
    { q: 4, label: '记得', hint: '顺利想起来', cls: 'g4' },
    { q: 5, label: '简单', hint: '毫不费力', cls: 'g5' }
  ];

  function newCard(word) {
    return {
      w: word,
      state: 'new',
      ease: 2.5,
      interval: 0,
      due: WB.date.today(),
      reps: 0,
      successReps: 0,
      lapses: 0,
      lapseStreak: 0,
      lastGrade: 0,
      firstLearned: null,
      lastReviewed: null,
      leech: false
    };
  }

  function schedule(card, grade, todayKey, rng) {
    const today = todayKey || WB.date.today();
    const random = rng || Math.random;
    const c = Object.assign({
      w: card && card.w,
      state: 'new',
      ease: 2.5,
      interval: 0,
      due: today,
      reps: 0,
      successReps: 0,
      lapses: 0,
      lapseStreak: 0,
      lastGrade: 0,
      firstLearned: null,
      lastReviewed: null,
      leech: false
    }, card || {});

    const wasNew = c.state === 'new' || !c.reps;
    if (wasNew) c.firstLearned = c.firstLearned || today;

    c.reps = (c.reps || 0) + 1;
    c.lastGrade = grade;
    c.lastReviewed = today;

    let interval = 1;

    if (grade <= 2) {
      c.lapses = (c.lapses || 0) + 1;
      c.lapseStreak = (c.lapseStreak || 0) + 1;
      c.ease = Math.max(MIN_EASE, Math.round(((c.ease || 2.5) - 0.2) * 100) / 100);
      interval = 1;
      c.state = 'relearning';
      if (c.lapseStreak >= 4) c.leech = true;
      c.interval = interval;
      c.due = today;
      return c;
    }

    c.lapseStreak = 0;

    if (grade === 3) {
      c.ease = Math.max(MIN_EASE, Math.round(((c.ease || 2.5) - 0.15) * 100) / 100);
      interval = wasNew ? 1 : Math.max(1, Math.round((c.interval || 1) * 1.2));
      c.state = 'review';
    } else if (grade === 4) {
      if (wasNew) interval = 1;
      else if ((c.successReps || 0) === 1) interval = 3;
      else interval = Math.round((c.interval || 1) * (c.ease || 2.5));
      c.state = 'review';
    } else {
      if (wasNew) interval = 2;
      else if ((c.successReps || 0) === 1) interval = 5;
      else interval = Math.round((c.interval || 1) * (c.ease || 2.5) * 1.3);
      c.ease = Math.min(MAX_EASE, Math.round(((c.ease || 2.5) + 0.15) * 100) / 100);
      c.state = 'review';
    }

    if (interval > 7) {
      const jitter = (random() - 0.5) * 0.1;
      interval = Math.round(interval * (1 + jitter));
    }

    c.interval = Math.max(1, Math.min(MAX_INTERVAL, interval));
    c.successReps = (c.successReps || 0) + 1;
    c.due = WB.date.addDays(today, c.interval);
    return c;
  }

  function preview(card, todayKey) {
    const today = todayKey || WB.date.today();
    return GRADES.map(function (g) {
      const next = schedule(card, g.q, today, function () { return 0.5; });
      let text;
      if (g.q === 2) text = '今天再来';
      else if (next.interval === 1) text = '明天';
      else text = next.interval + ' 天后';
      return { q: g.q, label: g.label, hint: g.hint, cls: g.cls, interval: next.interval, text: text };
    });
  }

  function isDue(card, todayKey) {
    if (!card || !card.state || card.state === 'new') return false;
    return String(card.due || '') <= (todayKey || WB.date.today());
  }

  function retention(card, todayKey) {
    if (!card || !card.interval) return null;
    const today = todayKey || WB.date.today();
    const start = WB.date.addDays(card.due, -card.interval);
    const elapsed = Math.max(0, WB.date.diff(start, today));
    return Math.max(0, Math.min(1, Math.pow(0.9, elapsed / card.interval)));
  }

  function stateLabel(card) {
    if (!card || card.state === 'new' || !card.reps) return '未学习';
    if (card.state === 'relearning') return '重学中';
    if (card.leech) return '难词';
    return '复习中';
  }

  WB.srs = {
    GRADES: GRADES,
    newCard: newCard,
    schedule: schedule,
    preview: preview,
    isDue: isDue,
    retention: retention,
    stateLabel: stateLabel,
    MAX_INTERVAL: MAX_INTERVAL
  };
})();
