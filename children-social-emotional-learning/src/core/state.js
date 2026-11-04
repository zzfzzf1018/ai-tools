/* 心晴岛 · 本地存档。只写本机 localStorage，不联网、不采集任何个人信息。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};
  var U = window.SEL.utils;

  var KEY = 'sunny-isles-save-v1';
  var memory = null;
  var memoryOnly = false;

  var SKILLS = ['awareness', 'management', 'social', 'relationship', 'decision'];

  function freshProfile(name, avatar) {
    var skills = {};
    SKILLS.forEach(function (k) { skills[k] = 0; });
    return {
      id: U.uid('p'),
      name: (name || '小探险家').slice(0, 12),
      avatar: avatar || 'cloud',
      createdAt: U.today(),
      stars: 0,
      skills: skills,
      levels: {},          // levelId -> { done, stars, attempts, lastAt }
      stickers: [],        // stickerId[]
      checkins: [],        // { date, emotion, intensity, reason, strategy, note }
      flowers: [],         // { id, date, emotion, color, petal }
      strategyCount: {},   // strategyId -> 次数
      settings: { voice: true, sfx: true, reduceMotion: false },
      lastVisit: ''
    };
  }

  function freshSave() {
    var p = freshProfile('小探险家', 'cloud');
    return { version: 1, activeId: p.id, profiles: [p] };
  }

  function normalize(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.profiles) || !s.profiles.length) return freshSave();
    s.version = 1;
    s.profiles = s.profiles.map(function (p) {
      var base = freshProfile(p.name, p.avatar);
      Object.keys(base).forEach(function (k) {
        if (p[k] === undefined || p[k] === null) p[k] = base[k];
      });
      SKILLS.forEach(function (k) { if (typeof p.skills[k] !== 'number') p.skills[k] = 0; });
      ['levels', 'strategyCount'].forEach(function (k) { if (!p[k] || typeof p[k] !== 'object') p[k] = {}; });
      ['stickers', 'checkins', 'flowers'].forEach(function (k) { if (!Array.isArray(p[k])) p[k] = []; });
      if (!p.settings || typeof p.settings !== 'object') p.settings = base.settings;
      if (typeof p.stars !== 'number') p.stars = 0;
      return p;
    });
    if (!s.profiles.some(function (p) { return p.id === s.activeId; })) s.activeId = s.profiles[0].id;
    return s;
  }

  function read() {
    if (memory) return memory;
    try {
      var raw = window.localStorage.getItem(KEY);
      memory = raw ? normalize(JSON.parse(raw)) : freshSave();
    } catch (e) {
      memoryOnly = true;
      memory = freshSave();
    }
    return memory;
  }

  function write(s) {
    memory = s;
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); }
    catch (e) { memoryOnly = true; /* 隐私模式或 file:// 限制：内存运行，仍可导出备份 */ }
  }

  function current() {
    var s = read();
    return s.profiles.filter(function (p) { return p.id === s.activeId; })[0] || s.profiles[0];
  }

  function update(fn) {
    var s = read();
    var p = s.profiles.filter(function (x) { return x.id === s.activeId; })[0] || s.profiles[0];
    var r = fn(p, s);
    write(s);
    return r;
  }

  function data() { return window.SEL_DATA; }

  function allLevels() {
    var out = [];
    (data().islands || []).forEach(function (island) {
      (island.levels || []).forEach(function (lv, idx) {
        out.push({ island: island, level: lv, index: idx });
      });
    });
    return out;
  }

  function findLevel(levelId) {
    return allLevels().filter(function (x) { return x.level.id === levelId; })[0] || null;
  }

  function isIslandUnlocked(island, profile) {
    var p = profile || current();
    return p.stars >= (island.unlockAt || 0);
  }

  function isLevelUnlocked(island, idx, profile) {
    var p = profile || current();
    if (!isIslandUnlocked(island, p)) return false;
    if (idx === 0) return true;
    var prev = island.levels[idx - 1];
    return !!(prev && p.levels[prev.id] && p.levels[prev.id].done);
  }

  function addStars(n) {
    return update(function (p) { p.stars += n; return p.stars; });
  }

  function unlockSticker(id) {
    if (!id) return false;
    return update(function (p) {
      if (p.stickers.indexOf(id) >= 0) return false;
      p.stickers.push(id);
      return true;
    });
  }

  function completeLevel(levelId, stars, skillPoints) {
    var found = findLevel(levelId);
    if (!found) return { newSticker: null, newStars: 0 };
    var islandId = found.island.id;
    var gained = 0;
    var isNew = false;
    update(function (p) {
      var old = p.levels[levelId];
      var prevStars = (old && old.stars) || 0;
      gained = Math.max(0, stars - prevStars);
      isNew = !(old && old.done);
      p.levels[levelId] = {
        done: true,
        stars: Math.max(prevStars, stars),
        attempts: ((old && old.attempts) || 0) + 1,
        lastAt: U.today()
      };
      p.stars += gained;
      p.skills[islandId] = (p.skills[islandId] || 0) + (skillPoints || stars);
      p.lastVisit = U.today();
      var st = found.level.reward && found.level.reward.sticker;
      if (st && p.stickers.indexOf(st) < 0) p.stickers.push(st);
    });
    return {
      newSticker: (found.level.reward && found.level.reward.sticker) || null,
      newStars: gained, isNew: isNew, islandId: islandId
    };
  }

  function addSkill(islandId, delta) {
    update(function (p) { p.skills[islandId] = (p.skills[islandId] || 0) + (delta || 1); });
  }

  function addCheckin(entry) {
    var today = U.today();
    var day = (entry && entry.date) || today;
    var firstToday = !current().checkins.some(function (c) { return c.date === day; });
    update(function (p) {
      p.checkins.push({
        date: day,
        emotion: entry.emotion,
        intensity: entry.intensity || 3,
        reason: entry.reason || '',
        strategy: entry.strategy || '',
        note: entry.note || '',
        at: new Date().toISOString()
      });
      if (p.checkins.length > 400) p.checkins = p.checkins.slice(-400);
      p.flowers.push({
        id: U.uid('f'), date: day, emotion: entry.emotion,
        color: entry.color || '#FFC94A', petal: Math.floor(Math.random() * 5)
      });
      if (p.flowers.length > 120) p.flowers = p.flowers.slice(-120);
      if (firstToday) p.stars += 1;
      p.lastVisit = today;
    });
    return { firstToday: firstToday, star: firstToday ? 1 : 0 };
  }

  function practiceStrategy(id) {
    update(function (p) { p.strategyCount[id] = (p.strategyCount[id] || 0) + 1; });
  }

  function setSetting(key, value) {
    update(function (p) { p.settings[key] = value; });
  }

  function createProfile(name, avatar) {
    var p = freshProfile(name, avatar);
    update(function (_p, s) { s.profiles.push(p); s.activeId = p.id; });
    return p;
  }

  function setActive(id) {
    update(function (_p, s) {
      if (s.profiles.some(function (x) { return x.id === id; })) s.activeId = id;
    });
  }

  function removeProfile(id) {
    update(function (_p, s) {
      if (s.profiles.length <= 1) return;
      s.profiles = s.profiles.filter(function (x) { return x.id !== id; });
      if (s.activeId === id) s.activeId = s.profiles[0].id;
    });
  }

  function resetProfile(id) {
    update(function (_p, s) {
      s.profiles = s.profiles.map(function (p) {
        if (p.id !== id) return p;
        var f = freshProfile(p.name, p.avatar);
        f.id = p.id;
        return f;
      });
    });
  }

  function exportSave() { return JSON.stringify(read(), null, 2); }

  function importSave(text) {
    var obj = JSON.parse(text);
    var s = normalize(obj);
    write(s);
    return s;
  }

  function stats() {
    var p = current();
    var levels = allLevels();
    var done = levels.filter(function (x) { return p.levels[x.level.id] && p.levels[x.level.id].done; }).length;
    var byDate = {};
    p.checkins.forEach(function (c) { byDate[c.date] = (byDate[c.date] || 0) + 1; });
    var streak = 0;
    for (var i = 0; i < 400; i++) {
      if (byDate[U.daysAgo(i)]) streak++;
      else if (i > 0) break;
    }
    var emotionCount = {};
    p.checkins.forEach(function (c) { emotionCount[c.emotion] = (emotionCount[c.emotion] || 0) + 1; });
    return {
      totalLevels: levels.length, doneLevels: done,
      stars: p.stars, stickers: p.stickers.length,
      checkins: p.checkins.length, streak: streak,
      skills: p.skills, emotionCount: emotionCount,
      strategyCount: p.strategyCount
    };
  }

  window.SEL.state = {
    SKILLS: SKILLS,
    get memoryOnly() { return memoryOnly; },
    save: read, current: current, profiles: function () { return read().profiles; },
    update: update, data: data, allLevels: allLevels, findLevel: findLevel,
    isIslandUnlocked: isIslandUnlocked, isLevelUnlocked: isLevelUnlocked,
    addStars: addStars, unlockSticker: unlockSticker, completeLevel: completeLevel,
    addSkill: addSkill, addCheckin: addCheckin, practiceStrategy: practiceStrategy,
    setSetting: setSetting, createProfile: createProfile, setActive: setActive,
    removeProfile: removeProfile, resetProfile: resetProfile,
    exportSave: exportSave, importSave: importSave, stats: stats
  };
})();
