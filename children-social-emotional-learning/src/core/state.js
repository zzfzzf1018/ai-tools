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
  var MAX_CHECKINS = 400;
  var MAX_FLOWERS = 365;      // 约一年的心情花，避免 localStorage 无限增长
  var MAX_PROFILES = 12;      // 一台电脑最多 12 个小玩家
  /* 超出展示上限的记录不丢弃，搬进 archive（随存档一起导出/导入），上限再给一个很宽的天花板 */
  var MAX_ARCHIVE_CHECKINS = 2000;
  var MAX_ARCHIVE_FLOWERS = 1000;
  var MAX_IMPORT = 5 * 1024 * 1024;

  function intIn(v, lo, hi, dflt) {
    var n = typeof v === 'number' && isFinite(v) ? Math.round(v) : dflt;
    return Math.max(lo, Math.min(hi, n));
  }
  /* 用户/备份可控的字符串一律限长，防止一份超大备份把 localStorage 配额撑爆 */
  function str(v, max, dflt) {
    return typeof v === 'string' ? v.slice(0, max) : (dflt || '');
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
    return { version: 1, activeId: p.id, profiles: [p], archive: {} };
  }

  /* 档案 id 只允许安全字符：导入的备份可能是任意 JSON，不能让 __proto__ / constructor
     之类的键渗进 levels / archive / strategyCount 这些普通对象里 */
  var SAFE_ID = /^[A-Za-z0-9_-]{1,60}$/;
  var RESERVED_ID = ['__proto__', 'constructor', 'prototype'];
  function safeId(id) {
    return typeof id === 'string' && SAFE_ID.test(id) && RESERVED_ID.indexOf(id) < 0 ? id : null;
  }

  /* 归档槽：profileId -> { checkins: [], flowers: [] } */
  function archiveSlot(s, pid) {
    if (!s.archive || typeof s.archive !== 'object' || Array.isArray(s.archive)) s.archive = {};
    var a = Object.prototype.hasOwnProperty.call(s.archive, pid) ? s.archive[pid] : null;
    if (!a || typeof a !== 'object') a = s.archive[pid] = { checkins: [], flowers: [] };
    if (!Array.isArray(a.checkins)) a.checkins = [];
    if (!Array.isArray(a.flowers)) a.flowers = [];
    return a;
  }

  function cleanCheckins(list) {
    return (Array.isArray(list) ? list : []).filter(function (c) {
      return c && typeof c === 'object' && typeof c.date === 'string' && DAY.test(c.date) &&
        typeof c.emotion === 'string' && c.emotion;
    }).map(function (c) {
      return {
        date: c.date, emotion: str(c.emotion, 40),
        intensity: intIn(c.intensity, 1, 5, 3),
        reason: str(c.reason, 500),
        strategy: str(c.strategy, 40),
        note: str(c.note, 500),
        at: str(c.at, 40)
      };
    });
  }

  function cleanFlowers(list) {
    return (Array.isArray(list) ? list : []).filter(function (f) {
      return f && typeof f === 'object' && typeof f.date === 'string' && DAY.test(f.date) &&
        typeof f.emotion === 'string' && f.emotion;
    }).map(function (f) {
      return {
        id: str(f.id, 60) || U.uid('f'),
        date: f.date, emotion: str(f.emotion, 40),
        color: typeof f.color === 'string' && HEX.test(f.color) ? f.color : '#FFC94A',
        petal: intIn(f.petal, 0, 4, 0)
      };
    });
  }

  /* 把任意来源（旧版本存档 / 用户导入文件）修成可用结构；无法修复时返回 null。
     这一步必须足够宽容：宁可丢弃坏字段，也不能让整份存档读不出来。 */
  function normalize(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.profiles)) return null;
    s.version = 1;
    var usedIds = Object.create(null);
    s.profiles = s.profiles.map(function (p) {
      if (!p || typeof p !== 'object') return null;
      var base = freshProfile(p.name, p.avatar);
      Object.keys(base).forEach(function (k) {
        if (p[k] === undefined || p[k] === null) p[k] = base[k];
      });
      var safe = safeId(p.id);
      if (!safe) safe = base.id;
      p.id = safe;
      if (usedIds[p.id]) p.id = base.id;
      usedIds[p.id] = true;
      p.name = str(p.name, 12, base.name).trim() || base.name;
      p.avatar = str(p.avatar, 40) || 'cloud';
      p.createdAt = str(p.createdAt, 20) || base.createdAt;
      p.lastVisit = str(p.lastVisit, 20);
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
            lastAt: str(r.lastAt, 20)
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

      p.checkins = cleanCheckins(p.checkins);
      p.flowers = cleanFlowers(p.flowers);

      var counts = Object.create(null);
      if (p.strategyCount && typeof p.strategyCount === 'object' && !Array.isArray(p.strategyCount)) {
        Object.keys(p.strategyCount).slice(0, 100).forEach(function (id) {
          counts[str(id, 40)] = Math.max(0, intIn(p.strategyCount[id], 0, 1e6, 0));
        });
      }
      p.strategyCount = counts;
      return p;
    }).filter(Boolean);

    if (!s.profiles.length) return null;
    if (s.profiles.length > MAX_PROFILES) s.profiles = s.profiles.slice(0, MAX_PROFILES);
    if (!s.profiles.some(function (p) { return p.id === s.activeId; })) s.activeId = s.profiles[0].id;

    /* 超上限的记录不丢：搬进归档，跟着存档一起导出/导入 */
    var arch = {};
    if (s.archive && typeof s.archive === 'object' && !Array.isArray(s.archive)) {
      Object.keys(s.archive).forEach(function (pid) {
        var a = s.archive[pid];
        if (!a || typeof a !== 'object') return;
        arch[pid] = {
          checkins: cleanCheckins(a.checkins).slice(-MAX_ARCHIVE_CHECKINS),
          flowers: cleanFlowers(a.flowers).slice(-MAX_ARCHIVE_FLOWERS)
        };
      });
    }
    s.profiles.forEach(function (p) {
      if (p.checkins.length > MAX_CHECKINS) {
        var slotC = arch[p.id] || (arch[p.id] = { checkins: [], flowers: [] });
        slotC.checkins = slotC.checkins.concat(p.checkins.slice(0, p.checkins.length - MAX_CHECKINS)).slice(-MAX_ARCHIVE_CHECKINS);
        p.checkins = p.checkins.slice(-MAX_CHECKINS);
      }
      if (p.flowers.length > MAX_FLOWERS) {
        var slotF = arch[p.id] || (arch[p.id] = { checkins: [], flowers: [] });
        slotF.flowers = slotF.flowers.concat(p.flowers.slice(0, p.flowers.length - MAX_FLOWERS)).slice(-MAX_ARCHIVE_FLOWERS);
        p.flowers = p.flowers.slice(-MAX_FLOWERS);
      }
    });
    /* 档案删掉后，别把它的归档留成孤儿数据 */
    var alive = {};
    s.profiles.forEach(function (p) { alive[p.id] = true; });
    Object.keys(arch).forEach(function (pid) { if (!alive[pid]) delete arch[pid]; });
    s.archive = arch;
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
    /* 存档坏了：原样备份一次（固定 key，不用时间戳，避免每次启动都新增一份），
       随后立刻把可用新档写回主 KEY —— 否则原始坏文本一直在，启动一次就多一个备份 key */
    var backed = false;
    try { window.localStorage.setItem(KEY + '-corrupt', raw); backed = true; } catch (e) {}
    memory = freshSave();
    if (backed) {
      try { window.localStorage.setItem(KEY, JSON.stringify(memory)); }
      catch (e) { memoryOnly = true; }
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
    /* 注意：update 的回调签名是 (profile, save)。超出展示上限时要把旧记录搬进
       save.archive，所以这里必须接收第二个参数，否则会抛 ReferenceError，
       孩子点「种下这朵花」将没有任何反应（第 401 条签到起必然触发）。 */
    update(function (p, s) {
      p.checkins.push({
        date: day,
        emotion: str(entry.emotion, 40),
        intensity: intIn(entry.intensity, 1, 5, 3),
        reason: str(entry.reason, 500),
        strategy: str(entry.strategy, 40),
        note: str(entry.note, 500),
        at: new Date().toISOString()
      });
      if (p.checkins.length > MAX_CHECKINS) {
        var arcC = archiveSlot(s, p.id);
        arcC.checkins = arcC.checkins.concat(p.checkins.slice(0, p.checkins.length - MAX_CHECKINS)).slice(-MAX_ARCHIVE_CHECKINS);
        p.checkins = p.checkins.slice(-MAX_CHECKINS);
      }
      p.flowers.push({
        id: U.uid('f'), date: day, emotion: str(entry.emotion, 40),
        color: typeof entry.color === 'string' && HEX.test(entry.color) ? entry.color : '#FFC94A',
        petal: Math.floor(Math.random() * 5)
      });
      if (p.flowers.length > MAX_FLOWERS) {
        var arcF = archiveSlot(s, p.id);
        arcF.flowers = arcF.flowers.concat(p.flowers.slice(0, p.flowers.length - MAX_FLOWERS)).slice(-MAX_ARCHIVE_FLOWERS);
        p.flowers = p.flowers.slice(-MAX_FLOWERS);
      }
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
    var created = null;
    update(function (_p, s) {
      /* 上限写在数据层，而不是只靠界面拦一下 */
      if (s.profiles.length >= MAX_PROFILES) return;
      created = freshProfile(name, avatar);
      s.profiles.push(created);
      s.activeId = created.id;
    });
    return created;
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
      if (s.archive) delete s.archive[id];
      if (s.activeId === id) s.activeId = s.profiles[0].id;
    });
  }

  function resetProfile(id) {
    update(function (_p, s) {
      if (s.archive) delete s.archive[id];   /* 清空进度也包括归档，避免旧记录被导出回来 */
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
    var raw = String(text);
    if (raw.length > MAX_IMPORT) throw new Error('备份文件太大，换一份试试');
    var obj;
    try { obj = JSON.parse(raw); }
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
    for (var i = 0; i < MAX_CHECKINS; i++) {
      if (byDate[U.daysAgo(i)]) streak++;
      else if (i > 0) break;
    }
    var emotionCount = Object.create(null);
    var arc = (read().archive || {})[p.id];
    var archived = arc && Array.isArray(arc.checkins) ? arc.checkins : [];
    /* 统计要包含已归档的更早记录，否则家长面板里「记下过的心情」会在第 401 条后突然缩水 */
    p.checkins.concat(archived).forEach(function (c) {
      emotionCount[c.emotion] = (emotionCount[c.emotion] || 0) + 1;
    });
    return {
      totalLevels: levels.length, doneLevels: done,
      stars: p.stars, stickers: p.stickers.length,
      checkins: p.checkins.length, checkinsTotal: p.checkins.length + archived.length,
      streak: streak,
      archivedCheckins: archived.length,
      skills: p.skills, emotionCount: emotionCount,
      strategyCount: p.strategyCount
    };
  }

  window.SEL.state = {
    SKILLS: SKILLS,
    limits: { checkins: MAX_CHECKINS, flowers: MAX_FLOWERS, profiles: MAX_PROFILES, archivedCheckins: MAX_ARCHIVE_CHECKINS, archivedFlowers: MAX_ARCHIVE_FLOWERS },
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
