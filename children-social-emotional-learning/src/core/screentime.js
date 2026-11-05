/* 心晴岛 · 屏幕时间与睡前锁。
   只做"提醒 + 软锁"：到点盖一层只有大人能解开的卡片，不删任何记录。
   家长解锁后当天不再打扰（sessionStorage），避免每 20 秒弹一次。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};
  var U = window.SEL.utils;

  var BYPASS_KEY = 'sunny-time-ok';

  function bypassed() {
    try { return window.sessionStorage.getItem(BYPASS_KEY) === U.today(); } catch (e) { return false; }
  }
  function unlockToday() {
    try { window.sessionStorage.setItem(BYPASS_KEY, U.today()); } catch (e) {}
  }
  function minutesOfDay(hhmm) {
    var p = String(hhmm || '').split(':');
    if (p.length !== 2) return null;
    var h = Number(p[0]), m = Number(p[1]);
    if (!(h >= 0 && h < 24 && m >= 0 && m < 60)) return null;
    return h * 60 + m;
  }
  function inBedtime(settings, now) {
    if (!settings || settings.bedtimeOn !== true) return false;
    var s = minutesOfDay(settings.bedtimeStart), e = minutesOfDay(settings.bedtimeEnd);
    if (s === null || e === null || s === e) return false;
    var cur = now.getHours() * 60 + now.getMinutes();
    /* 跨午夜（20:30 → 07:30）要拆成两段判断 */
    return s < e ? (cur >= s && cur < e) : (cur >= s || cur < e);
  }

  function state() {
    var S = window.SEL.state;
    var p = S.current();
    var settings = p.settings || {};
    var usedMin = Math.floor(S.usageToday() / 60);
    var limit = Number(settings.screenLimit) || 0;
    if (bypassed()) return { locked: false, reason: '', usedMin: usedMin, limit: limit, remain: Math.max(0, limit - usedMin) };
    var now = new Date();
    if (inBedtime(settings, now)) {
      return { locked: true, reason: 'bedtime', usedMin: usedMin, limit: limit, remain: 0, start: settings.bedtimeStart, end: settings.bedtimeEnd };
    }
    if (limit > 0 && usedMin >= limit) {
      return { locked: true, reason: 'limit', usedMin: usedMin, limit: limit, remain: 0 };
    }
    return { locked: false, reason: '', usedMin: usedMin, limit: limit, remain: limit > 0 ? limit - usedMin : Infinity };
  }

  function lockView(info) {
    var title = info.reason === 'bedtime' ? '该休息啦 🌙' : '今天玩得够久啦 🌿';
    var text = info.reason === 'bedtime'
      ? '现在是休息时间（' + U.esc(info.start || '') + ' – ' + U.esc(info.end || '') + '）。眼睛和大脑都需要好好睡一觉，明天再来找团团玩。'
      : '今天已经玩了 ' + info.usedMin + ' 分钟，到了约定的 ' + info.limit + ' 分钟。去喝口水、看看远处，或者和爸爸妈妈聊聊天吧。';
    return '<div class="time-lock-card">' +
      '<div class="tl-emoji">' + (info.reason === 'bedtime' ? '🌙' : '⏳') + '</div>' +
      '<h2>' + title + '</h2>' +
      '<p class="muted">' + text + '</p>' +
      '<p class="small muted">记录都还在，明天打开就能接着玩。</p>' +
      '<div class="row" style="justify-content:center;margin-top:18px">' +
      '<button class="btn primary" data-time-unlock>请大人来解锁</button></div>' +
      '<p class="small muted" style="margin-top:12px">大人的设置入口在「家长 / 老师专区」。</p>' +
      '</div>';
  }

  window.SEL.screentime = {
    state: state, unlockToday: unlockToday, bypassed: bypassed,
    inBedtime: inBedtime, lockView: lockView
  };
})();
