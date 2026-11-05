/* 心晴岛 · 本地存档。只写本机 localStorage，不联网、不采集任何个人信息。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};
  var U = window.SEL.utils;

  var KEY = 'sunny-isles-save-v1';
  var memory = null;
  var memoryOnly = false;

  var SKILLS = ['awareness', 'management', 'social', 'relationship', 'decision'];
  var HEX = /^#[0-9a-fA-F]{3,8}$/;
  var DAY = /^\d{4}-\d{2}-\d{2}$/;

  function intIn(v, lo, hi, dflt) {
    var n = typeof v === 'number' && isFinite(v) ? Math.round(v) : dflt;
    return Math.max(lo, Math.min(hi, n));
  }

  function freshProfile(name, avatar) {
    var skills = {};
    SKILLS.forEach(function (k) { skills[k] = 0; });
    var safeName = typeof name === 'string' && name.trim() ? name.trim() : '小探险家';
    return {
      id: U.uid('p'),
      name: safeName.slice(0, 12),
      avatar: typeof avatar === 'string' && avatar ? avatar : 'cloud',
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

  /* 把任意来源（旧版本存档 / 用户导入文件）修成可用结构；无法修复时返回 null。
     这一步必须足够宽容：宁可丢弃坏字段，也不能让整份存档读不出来。 */
  function normalize(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.profiles)) return null;
    s.version = 1;
    var usedIds = {};
    s.profiles = s.profiles.map(function (p) {
      if (!p || typeof p !== 'object') return null;
      var base = freshProfile(p.name, p.avatar);
      Object.keys(base).forEach(function (k) {
        if (p[k] === undefined || p[k] === null) p[k] = base[k];
      });
      if (typeof p.id !== 'string' || !p.id) p.id = base.id;
      if (usedIds[p.id]) p.id = base.id;
      usedIds[p.id] = true;
      p.name = (typeof p.name === 'string' && p.name.trim() ? p.name.trim() : base.name).slice(0, 12);
      p.avatar = typeof p.avatar === 'string' && p.avatar ? p.avatar : 'cloud';
      p.createdAt = typeof p.createdAt === 'string' ? p.createdAt : base.createdAt;
      p.lastVisit = typeof p.lastVisit === 'string' ? p.lastVisit : '';
      p.stars = Math.max(0, intIn(p.stars, 0, 1e9, 0));

      if (!p.skills || typeof p.skills !== 'object' || Array.isArray(p.skills)) p.skills = {};
      SKILLS.forEach(function (k) { p.skills[k] = Math.max(0, intIn(p.skills[k], 0, 1e9, 0)); });

      if (!p.settings || typeof p.settings !== 'object' || Array.isArray(p.settings)) p.settings = {};
      ['voice', 'sfx', 'reduceMotion'].forEach(function (k) {
        if (typeof p.settings[k] !== 'boolean') p.settings[k] = base.settings[k];
      });

      var levels = {};
      var knownLevels = {};
      try {
        allLevels().forEach(function (x) { knownLevels[x.level.id] = true; });
      } catch (e) { knownLevels = null; }
      if (p.levels && typeof p.levels === 'object' && !Array.isArray(p.levels)) {
        Object.keys(p.levels).forEach(function (id) {
          var r = p.levels[id];
          if (!r || typeof r !== 'object' || (knownLevels && !knownLevels[id])) return;
          levels[id] = {
            done: r.done === true,
            stars: intIn(r.stars, 0, 3, 0),
            attempts: Math.max(0, intIn(r.attempts, 0, 1e6, 0)),
            lastAt: typeof r.lastAt === 'string' ? r.lastAt : ''
          };
        });
      }
      p.levels = levels;

      var stickerIds = null;
      try { stickerIds = (data().stickers || []).map(function (x) { return x.id; }); } catch (e) {}
      var seenStickers = {};
      p.stickers = (Array.isArray(p.stickers) ? p.stickers : []).filter(function (id) {
        if (typeof id !== 'string' || seenStickers[id]) return false;
        if (stickerIds && stickerIds.indexOf(id) < 0) return false;
        seenStickers[id] = true;
        return true;
      });

      p.checkins = (Array.isArray(p.checkins) ? p.checkins : []).filter(function (c) {
        return c && typeof c === 'object' && typeof c.date === 'string' && DAY.test(c.date) &&
          typeof c.emotion === 'string' && c.emotion;
      }).map(function (c) {
        return {
          date: c.date, emotion: c.emotion,
          intensity: intIn(c.intensity, 1, 5, 3),
          reason: typeof c.reason === 'string' ? c.reason : '',
          strategy: typeof c.strategy === 'string' ? c.strategy : '',
          note: typeof c.note === 'string' ? c.note : '',
          at: typeof c.at === 'string' ? c.at : ''
        };
      }).slice(-400);

      p.flowers = (Array.isArray(p.flowers) ? p.flowers : []).filter(function (f) {
        return f && typeof f === 'object' && typeof f.date === 'string' && DAY.test(f.date) &&
          typeof f.emotion === 'string' && f.emotion;
      }).map(function (f) {
        return {
          id: typeof f.id === 'string' && f.id ? f.id : U.uid('f'),
          date: f.date, emotion: f.emotion,
          color: typeof f.color === 'string' && HEX.test(f.color) ? f.color : '#FFC94A',
          petal: intIn(f.petal, 0, 4, 0)
        };
      }).slice(-120);

      var counts = {};
      if (p.strategyCount && typeof p.strategyCount === 'object' && !Array.isArray(p.strategyCount)) {
        Object.keys(p.strategyCount).forEach(function (id) {
          counts[id] = Math.max(0, intIn(p.strategyCount[id], 0, 1e6, 0));
        });
      }
      p.strategyCount = counts;
      return p;
    }).filter(Boolean);

    if (!s.profiles.length) return null;
    if (s.profiles.length > 12) s.profiles = s.profiles.slice(0, 12);
    if (!s.profiles.some(function (p) { return p.id === s.activeId; })) s.activeId = s.profiles[0].id;
    return s;
  }

  function read() {
    if (memory) return memory;
    var raw = null;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch (e) {
      memoryOnly = true;
      memory = freshSave();
      return memory;
    }
    if (!raw) { memory = freshSave(); return memory; }
    var safe = null;
    try { safe = normalize(JSON.parse(raw)); } catch (e) { safe = null; }
    if (safe) { memory = safe; return memory; }
    /* 存档坏了：先原样备份一份原始文本，再以新档启动，避免用户数据被无声覆盖 */
    try { window.localStorage.setItem(KEY + '-corrupt-' + Date.now(), raw); } catch (e) {}
    memory = freshSave();
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
    var unlockedSticker = null;
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
      p.skills[islandId] = (p.skills[islandId] || 0) +
        (typeof skillPoints === 'number' ? skillPoints : stars);
      p.lastVisit = U.today();
      var st = found.level.reward && found.level.reward.sticker;
      if (st && p.stickers.indexOf(st) < 0) { p.stickers.push(st); unlockedSticker = st; }
    });
    return {
      newSticker: unlockedSticker,
      newStars: gained, isNew: isNew, islandId: islandId
    };
  }

  function addSkill(islandId, delta) {
    update(function (p) { p.skills[islandId] = (p.skills[islandId] || 0) + (delta || 1); });
  }

  function addCheckin(entry) {
    if (!entry || typeof entry !== 'object' || typeof entry.emotion !== 'string' || !entry.emotion) {
      return { firstToday: false, star: 0 };
    }
    var today = U.today();
    var day = typeof entry.date === 'string' && DAY.test(entry.date) ? entry.date : today;
    var firstToday = !current().checkins.some(function (c) { return c.date === day; });
    update(function (p) {
      p.checkins.push({
        date: day,
        emotion: entry.emotion,
        intensity: intIn(entry.intensity, 1, 5, 3),
        reason: typeof entry.reason === 'string' ? entry.reason : '',
        strategy: typeof entry.strategy === 'string' ? entry.strategy : '',
        note: typeof entry.note === 'string' ? entry.note : '',
        at: new Date().toISOString()
      });
      if (p.checkins.length > 400) p.checkins = p.checkins.slice(-400);
      p.flowers.push({
        id: U.uid('f'), date: day, emotion: entry.emotion,
        color: typeof entry.color === 'string' && HEX.test(entry.color) ? entry.color : '#FFC94A',
        petal: Math.floor(Math.random() * 5)
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
        f.createdAt = p.createdAt || f.createdAt;
        /* 清空的是「进度」，不是孩子调好的声音/动效偏好 */
        f.settings = { voice: p.settings.voice, sfx: p.settings.sfx, reduceMotion: p.settings.reduceMotion };
        return f;
      });
    });
  }

  function exportSave() { return JSON.stringify(read(), null, 2); }

  function importSave(text) {
    var obj;
    try { obj = JSON.parse(String(text)); }
    catch (e) { throw new Error('这不是有效的 JSON 备份文件'); }
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.profiles) || !obj.profiles.length) {
      throw new Error('备份里没有小玩家档案');
    }
    var s = normalize(obj);
    if (!s) throw new Error('备份里没有可用的档案');
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
