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
  var TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
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
      usage: { date: U.today(), seconds: 0 },   // 当天累计使用秒数（家长端时长限制用）
      stories: {},         // storyId -> { nodes: [], endings: [] } 走过的分支
      /* 只记「说过的次数 / 日期 / 用过的句式」，绝不保存孩子说的内容 */
      expression: { total: 0, days: [], frames: {}, prompts: {}, variants: { peer: 0, adult: 0 },
        todayStars: { date: '', count: 0 }, lastAt: '' },
      settings: {
        voice: true, sfx: true, reduceMotion: false,
        autoRead: true,          // 进入关卡自动读题、反馈与鼓励
        voiceRate: 0.9,          // 朗读语速 0.7–1.2
        voiceRoles: true,        // 团团 / 咕咕老师 / 小火苗 用不同音高语速
        screenLimit: 0,          // 每日分钟上限，0 = 不限制
        bedtimeOn: false,        // 睡前锁定
        bedtimeStart: '20:30',
        bedtimeEnd: '07:30'
      },
      lastVisit: ''
    };
  }

  function freshSave() {
    var p = freshProfile('小探险家', 'cloud');
    /* gate：家长区门锁。pin 只存加盐哈希，绝不存明文；fails/lockUntil 用于连续输错后短暂锁定。
       这是"防误入"，不是加密保险箱——4 位 PIN 本身只有 1 万种组合。 */
    return { version: 1, activeId: p.id, profiles: [p], archive: {}, gate: { salt: '', hash: '', fails: 0, lockUntil: 0 } };
  }

  /* 档案 id 只允许安全字符：导入的备份可能是任意 JSON，不能让 __proto__ / constructor
     之类的键渗进 levels / archive / strategyCount 这些普通对象里 */
  var SAFE_ID = /^[A-Za-z0-9_-]{1,60}$/;
  var RESERVED_ID = ['__proto__', 'constructor', 'prototype'];
  function safeId(id) {
    return typeof id === 'string' && SAFE_ID.test(id) && RESERVED_ID.indexOf(id) < 0 ? id : null;
  }
  /* 日期不仅要长得像 YYYY-MM-DD，还得是真的那一天：
     '2026-99-99' 能过正则，但会在花园里显示成「99月99日」。用解析再回写比对挡掉。 */
  function validDay(s) {
    if (typeof s !== 'string' || !DAY.test(s)) return false;
    var d = U.parseDay(s);
    return !!d && U.today(d) === s;
  }

  /* ---------- 家长 PIN ---------- */
  /* 4 位 PIN 只有 1 万种组合，任何哈希都能被穷举；这里的加盐哈希只是避免明文躺在
     localStorage 里被顺手看到，真正的保护来自「连续输错锁定」。界面文案也如实说明。 */
  function pinHash(salt, pin) {
    var s = String(salt) + '|' + String(pin) + '|' + String(salt);
    var h = 0x811c9dc5;
    for (var round = 0; round < 3; round++) {
      for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      s = h.toString(16) + s;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  function newSalt() {
    return Math.floor(Math.random() * 0xffffffff).toString(16) + Date.now().toString(16).slice(-6);
  }
  function cleanGate(g) {
    var out = { salt: '', hash: '', fails: 0, lockUntil: 0 };
    if (!g || typeof g !== 'object' || Array.isArray(g)) return out;
    var salt = typeof g.salt === 'string' && /^[0-9a-f]{6,40}$/.test(g.salt) ? g.salt : '';
    var hash = typeof g.hash === 'string' && /^[0-9a-f]{8}$/.test(g.hash) ? g.hash : '';
    if (salt && hash) { out.salt = salt; out.hash = hash; }
    out.fails = intIn(g.fails, 0, 999, 0);
    out.lockUntil = Math.max(0, intIn(g.lockUntil, 0, 4102444800000, 0));
    return out;
  }
  function pinSet() {
    var g = cleanGate(read().gate);
    return !!(g.salt && g.hash);
  }
  function setPin(pin) {
    if (!/^\d{4}$/.test(String(pin))) throw new Error('PIN 需要是 4 位数字');
    var salt = newSalt();
    update(function (_p, s) {
      s.gate = { salt: salt, hash: pinHash(salt, pin), fails: 0, lockUntil: 0 };
    });
    return true;
  }
  function clearPin() {
    update(function (_p, s) { s.gate = { salt: '', hash: '', fails: 0, lockUntil: 0 }; });
  }
  /* 返回 { ok, locked, wait }：locked 表示还在惩罚期内，wait 是剩余秒数 */
  function verifyPin(pin) {
    var g = cleanGate(read().gate);
    if (!g.hash) return { ok: true, locked: false, wait: 0 };
    var now = Date.now();
    if (g.lockUntil > now) return { ok: false, locked: true, wait: Math.ceil((g.lockUntil - now) / 1000) };
    var ok = pinHash(g.salt, String(pin || '')) === g.hash;
    update(function (_p, s) {
      var cur = cleanGate(s.gate);
      if (ok) { cur.fails = 0; cur.lockUntil = 0; }
      else {
        cur.fails += 1;
        if (cur.fails >= 5) { cur.lockUntil = Date.now() + 60000; cur.fails = 0; }
      }
      s.gate = cur;
    });
    return { ok: ok, locked: false, wait: 0 };
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
      return c && typeof c === 'object' && validDay(c.date) &&
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
      return f && typeof f === 'object' && validDay(f.date) &&
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

  /* 表达练习记录：只保留次数与日期。导入的备份可能带任意键，
     一律走白名单 + 无原型对象，避免 __proto__ 之类的键污染存档。 */
  function knownExpressionKeys() {
    var out = { frames: Object.create(null), prompts: Object.create(null) };
    try {
      var ex = (data().expression || {});
      (ex.frames || []).forEach(function (f) { if (safeId(f.id)) out.frames[f.id] = true; });
      (ex.prompts || []).forEach(function (p) { if (safeId(p.id)) out.prompts[p.id] = true; });
      Object.keys(ex.levelPrompts || {}).forEach(function (k) { if (safeId(k)) out.prompts[k] = true; });
    } catch (e) {}
    return out;
  }
  /* 每日勇气星上限：课程数据可配 1–10，读取侧与写入侧必须用同一个值，
     否则把 cap 调大后，每次清洗都会把计数夹回 3，等于可以无限刷星。 */
  function dailyCap() {
    try { return U.clamp(Number((data().expression || {}).dailyStarCap) || 3, 1, 10); }
    catch (e) { return 3; }
  }
  function cleanCountMap(obj, known) {
    var out = Object.create(null);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
    Object.keys(obj).slice(0, 100).forEach(function (k) {
      if (!safeId(k) || (known && !known[k])) return;
      out[k] = Math.max(0, intIn(obj[k], 0, 1e6, 0));
    });
    return out;
  }
  /* 两种示范各练了多少次，只认这两个键，导入的怪键一律丢弃 */
  function cleanVariants(v) {
    var out = { peer: 0, adult: 0 };
    if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
    out.peer = Math.max(0, intIn(v.peer, 0, 1e6, 0));
    out.adult = Math.max(0, intIn(v.adult, 0, 1e6, 0));
    return out;
  }
  function cleanExpression(x) {
    var known = knownExpressionKeys();
    var out = {
      total: 0, days: [], frames: cleanCountMap(x && x.frames, known.frames),
      prompts: cleanCountMap(x && x.prompts, known.prompts),
      variants: cleanVariants(x && x.variants),
      todayStars: { date: '', count: 0 }, lastAt: ''
    };
    if (!x || typeof x !== 'object' || Array.isArray(x)) return out;
    out.total = Math.max(0, intIn(x.total, 0, 1e6, 0));
    var seen = Object.create(null);
    out.days = (Array.isArray(x.days) ? x.days : []).slice(-60).filter(function (d) {
      if (!d || typeof d !== 'object' || !validDay(d.date) || seen[d.date]) return false;
      seen[d.date] = true;
      return true;
    }).map(function (d) { return { date: d.date, count: Math.max(1, intIn(d.count, 1, 999, 1)) }; }).slice(-60);
    var ts = x.todayStars;
    if (ts && typeof ts === 'object' && validDay(ts.date)) {
      out.todayStars = { date: ts.date, count: intIn(ts.count, 0, dailyCap(), 0) };
    }
    out.lastAt = validDay(x.lastAt) ? x.lastAt : '';
    return out;
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
      p.createdAt = validDay(p.createdAt) ? p.createdAt : base.createdAt;
      p.lastVisit = validDay(p.lastVisit) ? p.lastVisit : '';
      p.stars = Math.max(0, intIn(p.stars, 0, 1e9, 0));

      if (!p.skills || typeof p.skills !== 'object' || Array.isArray(p.skills)) p.skills = {};
      SKILLS.forEach(function (k) { p.skills[k] = Math.max(0, intIn(p.skills[k], 0, 1e9, 0)); });

      if (!p.settings || typeof p.settings !== 'object' || Array.isArray(p.settings)) p.settings = {};
      ['voice', 'sfx', 'reduceMotion', 'bedtimeOn', 'autoRead', 'voiceRoles'].forEach(function (k) {
        if (typeof p.settings[k] !== 'boolean') p.settings[k] = base.settings[k];
      });
      var vr = Number(p.settings.voiceRate);
      p.settings.voiceRate = isFinite(vr) ? Math.round(U.clamp(vr, 0.7, 1.2) * 10) / 10 : base.settings.voiceRate;
      /* 0 = 不限制；允许 5–240 分钟，避免导入一份 999999 分钟把限制变成隐形关闭 */
      p.settings.screenLimit = intIn(p.settings.screenLimit, 0, 240, 0);
      ['bedtimeStart', 'bedtimeEnd'].forEach(function (k) {
        p.settings[k] = TIME.test(String(p.settings[k] || '')) ? p.settings[k] : base.settings[k];
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
      p.expression = cleanExpression(p.expression);

      var counts = Object.create(null);
      if (p.strategyCount && typeof p.strategyCount === 'object' && !Array.isArray(p.strategyCount)) {
        Object.keys(p.strategyCount).slice(0, 100).forEach(function (id) {
          counts[str(id, 40)] = Math.max(0, intIn(p.strategyCount[id], 0, 1e6, 0));
        });
      }
      p.strategyCount = counts;

      /* 使用时长：只保留"今天"的计数，跨天的旧数据直接归零（不参与统计） */
      var today = U.today();
      if (!p.usage || typeof p.usage !== 'object' || Array.isArray(p.usage)) p.usage = { date: today, seconds: 0 };
      p.usage.date = validDay(p.usage.date) ? p.usage.date : today;
      p.usage.seconds = p.usage.date === today ? Math.max(0, intIn(p.usage.seconds, 0, 86400, 0)) : 0;
      if (p.usage.date !== today) p.usage.date = today;

      /* 故事分支探索：只保留当前课程里真实存在的节点，防止导入的怪 id 无限增长 */
      var storyNodes = null;
      try {
        storyNodes = {};
        (data().stories || []).forEach(function (st) {
          storyNodes[st.id] = {};
          Object.keys(st.nodes || {}).forEach(function (n) { storyNodes[st.id][n] = true; });
        });
      } catch (e) { storyNodes = null; }
      var stories = Object.create(null);
      if (p.stories && typeof p.stories === 'object' && !Array.isArray(p.stories)) {
        Object.keys(p.stories).slice(0, 50).forEach(function (sid) {
          if (storyNodes && !storyNodes[sid]) return;
          var rec = p.stories[sid];
          if (!rec || typeof rec !== 'object') return;
          var keep = function (arr) {
            return (Array.isArray(arr) ? arr : []).filter(function (n) {
              return typeof n === 'string' && (!storyNodes || storyNodes[sid][n]);
            }).filter(function (n, i, a) { return a.indexOf(n) === i; }).slice(0, 200);
          };
          stories[sid] = { nodes: keep(rec.nodes), endings: keep(rec.endings) };
        });
      }
      p.stories = stories;
      return p;
    }).filter(Boolean);

    if (!s.profiles.length) return null;
    if (s.profiles.length > MAX_PROFILES) s.profiles = s.profiles.slice(0, MAX_PROFILES);
    if (!s.profiles.some(function (p) { return p.id === s.activeId; })) s.activeId = s.profiles[0].id;

    /* 超上限的记录不丢：搬进归档，跟着存档一起导出/导入 */
    var arch = {};
    if (s.archive && typeof s.archive === 'object' && !Array.isArray(s.archive)) {
      Object.keys(s.archive).forEach(function (pid) {
        /* JSON.parse 会把 "__proto__" 做成自有键，但 arch[pid] 赋值会改成设置原型；
           归档键和档案 id 走同一套安全白名单，不让导入的备份污染对象原型 */
        var spid = safeId(pid);
        if (!spid) return;
        var a = s.archive[pid];
        if (!a || typeof a !== 'object') return;
        arch[spid] = {
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
    s.gate = cleanGate(s.gate);
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
    var day = typeof entry.date === 'string' && validDay(entry.date) ? entry.date : today;
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

  /* ---------- 说一说 · 勇气小话筒 ----------
     孩子自己点「我说出来啦」才记一次：不录音、不识别、不保存说过的话。
     同一天最多发 3 颗勇气星，之后照常累计次数（避免孩子刷星）。 */
  function recordExpression(topicId, frameId, variant) {
    var known = knownExpressionKeys();
    var id = typeof topicId === 'string' ? topicId.slice(0, 60) : '';
    if (!id || !known.prompts[id]) return null;   /* 未知话题不写库，防伪造 */
    var frame = typeof frameId === 'string' ? frameId.slice(0, 40) : '';
    if (frame && !known.frames[frame]) frame = '';
    var mode = variant === 'adult' ? 'adult' : 'peer';
    var today = U.today();
    var out = { star: 0, total: 0, streak: 0, capped: false, badges: [] };
    update(function (p) {
      var e = cleanExpression(p.expression);
      e.total += 1;
      var rec = null;
      e.days.forEach(function (d) { if (d.date === today) rec = d; });
      if (!rec) { rec = { date: today, count: 0 }; e.days.push(rec); }
      if (e.days.length > 60) e.days = e.days.slice(-60);
      rec.count = Math.min(999, rec.count + 1);
      if (frame) e.frames[frame] = (e.frames[frame] || 0) + 1;
      e.prompts[id] = (e.prompts[id] || 0) + 1;
      e.variants[mode] = (e.variants[mode] || 0) + 1;
      e.lastAt = today;
      if (e.todayStars.date !== today) e.todayStars = { date: today, count: 0 };
      var cap = dailyCap();
      if (e.todayStars.count < cap) { e.todayStars.count += 1; p.stars += 1; out.star = 1; }
      else out.capped = true;
      p.expression = e;
      out.total = e.total;
      var badges = [];
      try { badges = (data().expression || {}).badges || []; } catch (err2) {}
      badges.forEach(function (b) {
        if (e.total >= b.at && b.id && p.stickers.indexOf(b.id) < 0) {
          p.stickers.push(b.id);
          out.badges.push(b);
        }
      });
    });
    out.streak = expressionStats().streak;
    return out;
  }

  function expressionStats() {
    var e = cleanExpression(current().expression);
    var byDate = Object.create(null);
    e.days.forEach(function (d) { byDate[d.date] = d.count; });
    var streak = 0;
    for (var i = 0; i < 60; i++) {
      if (byDate[U.daysAgo(i)]) streak++;
      else if (i > 0) break;
    }
    var week = 0, monday = U.weekStart();
    e.days.forEach(function (d) { if (U.dayDiff(monday, d.date) >= 0) week += d.count; });
    var topFrame = '', topCount = 0;
    Object.keys(e.frames).forEach(function (k) {
      if (e.frames[k] > topCount) { topCount = e.frames[k]; topFrame = k; }
    });
    return {
      total: e.total, streak: streak, week: week, days: e.days.length,
      lastAt: e.lastAt, topFrame: topFrame, frames: e.frames, variants: e.variants,
      today: byDate[U.today()] || 0,
      todayStars: e.todayStars.date === U.today() ? e.todayStars.count : 0
    };
  }

  /* ---------- 使用时长 ---------- */
  function usageToday() {
    var p = current();
    if (!p.usage || p.usage.date !== U.today()) return 0;
    return Math.max(0, p.usage.seconds || 0);
  }
  function addUsage(seconds) {
    var n = Math.max(0, Math.round(Number(seconds) || 0));
    if (!n) return usageToday();
    return update(function (p) {
      var today = U.today();
      if (!p.usage || p.usage.date !== today) p.usage = { date: today, seconds: 0 };
      p.usage.seconds = Math.min(86400, p.usage.seconds + n);
      return p.usage.seconds;
    });
  }

  /* ---------- 故事分支探索 ---------- */
  function markStoryNode(storyId, nodeId, ending) {
    if (typeof storyId !== 'string' || typeof nodeId !== 'string') return;
    update(function (p) {
      if (!p.stories || typeof p.stories !== 'object') p.stories = {};
      var rec = p.stories[storyId];
      if (!rec || typeof rec !== 'object') rec = p.stories[storyId] = { nodes: [], endings: [] };
      if (!Array.isArray(rec.nodes)) rec.nodes = [];
      if (!Array.isArray(rec.endings)) rec.endings = [];
      if (rec.nodes.indexOf(nodeId) < 0) rec.nodes.push(nodeId);
      if (ending && rec.endings.indexOf(nodeId) < 0) rec.endings.push(nodeId);
    });
  }
  function storyProgress(storyId) {
    var p = current();
    var rec = (p.stories || {})[storyId];
    var story = null;
    try { story = (data().stories || []).filter(function (s) { return s.id === storyId; })[0] || null; } catch (e) {}
    var nodes = story ? Object.keys(story.nodes || {}) : [];
    var endings = story ? nodes.filter(function (k) {
      var n = story.nodes[k] || {};
      return n.ending === true || !n.choices || !n.choices.length;
    }) : [];
    var seenEndings = rec && Array.isArray(rec.endings)
      ? rec.endings.filter(function (k) { return endings.indexOf(k) >= 0; }) : [];
    return {
      seen: rec && Array.isArray(rec.nodes) ? rec.nodes.length : 0,
      total: nodes.length,
      endingsSeen: seenEndings.length,
      endingsTotal: endings.length,
      endingsRemaining: Math.max(0, endings.length - seenEndings.length)
    };
  }

  /* ---------- 情绪趋势 / 策略有效性 ---------- */
  /* 归档记录在前、展示区在后，按日期与写入时间排好序；"下一次签到"才有意义 */
  function allCheckinsSorted() {
    var p = current();
    var arc = (read().archive || {})[p.id];
    var archived = arc && Array.isArray(arc.checkins) ? arc.checkins : [];
    return archived.concat(p.checkins).slice().sort(function (a, b) {
      if (a.date === b.date) return String(a.at || '').localeCompare(String(b.at || ''));
      return a.date < b.date ? -1 : 1;
    });
  }

  function checkinTrend(days) {
    var n = Math.max(1, Math.min(90, Math.round(Number(days) || 14)));
    var buckets = Object.create(null);
    allCheckinsSorted().forEach(function (c) {
      var b = buckets[c.date] || (buckets[c.date] = { sum: 0, count: 0 });
      b.sum += c.intensity || 0;
      b.count += 1;
    });
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var day = U.daysAgo(i);
      var b = buckets[day];
      out.push({ date: day, count: b ? b.count : 0, avg: b && b.count ? b.sum / b.count : null });
    }
    return out;
  }

  function strategyEffect() {
    var list = allCheckinsSorted();
    var acc = Object.create(null);
    for (var i = 0; i < list.length - 1; i++) {
      var c = list[i], next = list[i + 1];
      if (!c.strategy || !next || typeof next.intensity !== 'number') continue;
      var gap = U.dayDiff(c.date, next.date);
      /* 只看一周内的下一次签到：隔了半个月再比，中间发生的事太多了 */
      if (gap < 0 || gap > 7) continue;
      var a = acc[c.strategy] || (acc[c.strategy] = { n: 0, sum: 0, down: 0, up: 0, same: 0 });
      var delta = next.intensity - (c.intensity || 0);
      a.n += 1; a.sum += delta;
      if (delta < 0) a.down += 1; else if (delta > 0) a.up += 1; else a.same += 1;
    }
    var names = Object.create(null);
    try { (data().strategies || []).forEach(function (s) { names[s.id] = s.name; }); } catch (e) {}
    return Object.keys(acc).map(function (id) {
      var a = acc[id];
      return {
        id: id, name: names[id] || id, n: a.n,
        avgDelta: a.sum / a.n, down: a.down, up: a.up, same: a.same,
        downRate: a.down / a.n
      };
    }).sort(function (x, y) { return y.n - x.n; });
  }

  /* 本周建议：从练得最少的能力里挑还没做的关卡；整岛都做完了就建议重玩星星最少的一关 */
  function recommendLevels(limit) {
    var n = Math.max(1, Math.min(5, Math.round(Number(limit) || 3)));
    var p = current();
    var islands = (data().islands || []).slice().sort(function (a, b) {
      return (p.skills[a.id] || 0) - (p.skills[b.id] || 0);
    });
    var out = [];
    islands.forEach(function (is) {
      if (out.length >= n) return;
      var levels = is.levels || [];
      var pick = null, idx = -1;
      for (var i = 0; i < levels.length; i++) {
        var rec = p.levels[levels[i].id];
        if (!(rec && rec.done) && isLevelUnlocked(is, i, p)) { pick = levels[i]; idx = i; break; }
      }
      if (pick) {
        out.push({
          island: is, level: pick, index: idx,
          reason: (p.skills[is.id] || 0) === 0 ? '这一项还没开始练' : '这一项练得最少'
        });
        return;
      }
      /* 全做完了：找星数最少的一关重玩，保持练习不断档 */
      var low = null;
      levels.forEach(function (lv, i) {
        var r = p.levels[lv.id];
        if (!r || !r.done) return;
        if (!low || r.stars < low.stars) low = { level: lv, stars: r.stars, index: i };
      });
      if (low && out.length < n) {
        out.push({ island: is, level: low.level, index: low.index, reason: '可以再玩一次，把星星补满' });
      }
    });
    return out;
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
        /* 清空的是「进度」，不是调好的偏好，更不是家长设的护栏：
           每日时长上限与睡前锁必须跨「清空进度」存活，否则家长一清空，
           孩子的使用限制就静默失效了。 */
        /* 「今天已经玩了多久」也是家长护栏：清空进度不能把它归零，
           否则时长上限一到，清空一次进度就能再玩满一天。 */
        f.usage = {
          date: U.today(),
          seconds: (p.usage && p.usage.date === U.today()) ? Math.max(0, Number(p.usage.seconds) || 0) : 0
        };
        f.settings = {
          voice: p.settings.voice, sfx: p.settings.sfx, reduceMotion: p.settings.reduceMotion,
          autoRead: p.settings.autoRead, voiceRate: p.settings.voiceRate,
          voiceRoles: p.settings.voiceRoles,
          screenLimit: p.settings.screenLimit, bedtimeOn: p.settings.bedtimeOn,
          bedtimeStart: p.settings.bedtimeStart, bedtimeEnd: p.settings.bedtimeEnd
        };
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
    recordExpression: recordExpression, expressionStats: expressionStats,
    addUsage: addUsage, usageToday: usageToday,
    markStoryNode: markStoryNode, storyProgress: storyProgress,
    checkinTrend: checkinTrend, strategyEffect: strategyEffect, recommendLevels: recommendLevels,
    pinSet: pinSet, setPin: setPin, clearPin: clearPin, verifyPin: verifyPin,
    setSetting: setSetting, createProfile: createProfile, setActive: setActive,
    removeProfile: removeProfile, resetProfile: resetProfile,
    exportSave: exportSave, importSave: importSave, stats: stats
  };
})();
