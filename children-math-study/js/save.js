/* ===== 进度存取：Electron IPC 优先，Web 端降级 localStorage ===== */
(function () {
  const KEY = 'mathwonder-save-v1';

  const DEFAULT_SAVE = {
    player: { name: '小小数学家', avatar: '🦊', createdAt: null },
    stars: {},        // lessonId -> 0~3（历史最高）
    completed: {},    // lessonId -> true
    wrongBook: [],    // [{lessonId, qid, visual, prompt, count, lastAt}]
    badges: [],       // badge id 列表
    exploreDone: {},  // lessonId -> true（完成过探索）
    unitPassed: {},   // unitKey -> true（首次完成整个单元，颁发通行证）
    unitQuiz: {},     // unitKey -> { stars, correct, total, at }
    daily: {},        // YYYY-MM-DD -> { answers, correct, sessions, seconds, daily, aural, quiz, wrong }
    stats: { answers: 0, correct: 0 },  // 累计首次作答数与正确数
    settings: {
      lastGrade: null, lastLesson: null, sound: true,
      speech: true,          // 语音播报总开关
      autoRead: true,        // 进入题目自动朗读
      readOptions: true,     // 朗读题干时一并读选项
      speechRate: 0.9,       // 语速（儿童稍慢）
      speechPitch: 1.05,
      speechVoiceURI: ''     // 空 = 自动挑选中文语音
    }
  };

  // 深拷贝默认存档，避免重置/导入时共享嵌套对象
  function defaultSave() {
    return JSON.parse(JSON.stringify(DEFAULT_SAVE));
  }

  function deepMerge(base, extra) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!extra || typeof extra !== 'object') return out;
    for (const k of Object.keys(extra)) {
      const bv = base ? base[k] : undefined;
      const ev = extra[k];
      if (bv && typeof bv === 'object' && !Array.isArray(bv) && ev && typeof ev === 'object' && !Array.isArray(ev)) {
        out[k] = deepMerge(bv, ev);
      } else {
        out[k] = ev;
      }
    }
    return out;
  }

  // 存档可能被手工改坏或来自旧版本，做一次类型兜底，避免整页白屏
  function clampInt(v, lo, hi) {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
  }
  function safeStr(v, max) {
    return typeof v === 'string' ? v.slice(0, max || 500) : '';
  }
  function safeList(v, max) {
    if (!Array.isArray(v)) return null;
    const out = v.slice(0, max || 20)
      .map(x => (typeof x === 'string' || typeof x === 'number') ? safeStr(String(x), 200) : '')
      .filter(x => x !== '');
    return out.length ? out : null;
  }

  // 存档可能被手工改坏、导入旧版或被注入内容，逐字段归一化，避免渲染时白屏/注入
  function normalize(d) {
    if (!d.player || typeof d.player !== 'object') d.player = Object.assign({}, DEFAULT_SAVE.player);
    if (typeof d.player.name !== 'string' || !d.player.name) d.player.name = DEFAULT_SAVE.player.name;
    d.player.name = safeStr(d.player.name, 12);
    if (typeof d.player.avatar !== 'string') d.player.avatar = DEFAULT_SAVE.player.avatar;
    for (const key of ['stars', 'completed', 'exploreDone']) {
      if (!d[key] || typeof d[key] !== 'object' || Array.isArray(d[key])) d[key] = {};
    }
    for (const k of Object.keys(d.stars)) {
      d.stars[k] = clampInt(d.stars[k], 0, 3);
    }
    for (const k of Object.keys(d.completed)) d.completed[k] = !!d.completed[k];
    for (const k of Object.keys(d.exploreDone)) d.exploreDone[k] = !!d.exploreDone[k];

    // 错题快照逐字段收敛：缺答案/缺选项的脏题不会让重做浮层永远无法作答
    d.wrongBook = (Array.isArray(d.wrongBook) ? d.wrongBook : [])
      .filter(w => w && typeof w === 'object' && w.lessonId != null && w.qid != null)
      .map(w => {
        const item = {
          lessonId: safeStr(String(w.lessonId), 80),
          qid: safeStr(String(w.qid), 80),
          type: ['choice', 'input', 'dragdrop', 'sequence'].includes(w.type) ? w.type : 'choice',
          prompt: safeStr(w.prompt, 800),
          visual: safeStr(w.visual, 200),
          options: safeList(w.options),
          template: safeStr(w.template, 500) || null,
          items: safeList(w.items),
          bank: safeList(w.bank),
          hints: safeList(w.hints, 10),
          count: clampInt(w.count, 1, 9999),
          wrongStreak: clampInt(w.wrongStreak, 0, 9999),
          rightStreak: clampInt(w.rightStreak, 0, 9999),
          lastAt: /^\d{4}-\d{2}-\d{2}$/.test(w.lastAt) ? w.lastAt : ''
        };
        if (typeof w.answer === 'string' || typeof w.answer === 'number') {
          item.answer = safeStr(String(w.answer), 200);
        } else if (Array.isArray(w.answer)) {
          const arr = w.answer.slice(0, 20).map(x => safeStr(String(x), 200)).filter(Boolean);
          if (arr.length) item.answer = arr;
        }
        return item;
      });
    d.badges = (Array.isArray(d.badges) ? d.badges : [])
      .filter(x => typeof x === 'string').slice(0, 50);

    if (!d.settings || typeof d.settings !== 'object') d.settings = {};
    const s = d.settings;
    if (typeof s.lastLesson !== 'string') s.lastLesson = null;
    if (s.lastGrade != null && !Number.isFinite(Number(s.lastGrade))) s.lastGrade = null;
    for (const k of ['sound', 'speech', 'autoRead', 'readOptions']) {
      if (typeof s[k] !== 'boolean') s[k] = true;
    }
    if (!Number.isFinite(Number(s.speechRate))) s.speechRate = 0.9;
    s.speechRate = Math.max(0.5, Math.min(1.6, Number(s.speechRate)));
    if (!Number.isFinite(Number(s.speechPitch))) s.speechPitch = 1.05;
    s.speechPitch = Math.max(0.5, Math.min(1.6, Number(s.speechPitch)));
    if (typeof s.speechVoiceURI !== 'string') s.speechVoiceURI = '';

    for (const key of ['unitPassed', 'unitQuiz']) {
      if (!d[key] || typeof d[key] !== 'object' || Array.isArray(d[key])) d[key] = {};
    }
    const cleanPassed = {};
    for (const [k, v] of Object.entries(d.unitPassed)) {
      if (k && k.length <= 40 && v === true) cleanPassed[k] = true;
    }
    d.unitPassed = cleanPassed;
    // unitQuiz 的 stars 若被改成负数/巨值，'⭐'.repeat() 会抛 RangeError 导致整页白屏
    const cleanQuiz = {};
    for (const [k, v] of Object.entries(d.unitQuiz)) {
      if (!k || k.length > 40 || !v || typeof v !== 'object') continue;
      cleanQuiz[k] = {
        stars: clampInt(v.stars, 0, 3),
        correct: clampInt(v.correct, 0, 9999),
        total: clampInt(v.total, 0, 9999),
        seconds: clampInt(v.seconds, 0, 99999),
        at: /^\d{4}-\d{2}-\d{2}$/.test(v.at) ? v.at : ''
      };
    }
    d.unitQuiz = cleanQuiz;

    // 打卡数据只保留合法日期键，避免脏存档破坏连续天数计算
    const cleanDaily = {};
    if (d.daily && typeof d.daily === 'object' && !Array.isArray(d.daily)) {
      for (const [k, v] of Object.entries(d.daily)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== 'object') continue;
        const answers = clampInt(v.answers, 0, 999999);
        cleanDaily[k] = {
          answers,
          correct: Math.min(answers, clampInt(v.correct, 0, 999999)),
          sessions: clampInt(v.sessions, 0, 9999),
          seconds: clampInt(v.seconds, 0, 999999),
          daily: clampInt(v.daily, 0, 9999),
          aural: clampInt(v.aural, 0, 9999),
          quiz: clampInt(v.quiz, 0, 9999),
          wrong: clampInt(v.wrong, 0, 9999)
        };
      }
    }
    d.daily = cleanDaily;
    if (!d.stats || typeof d.stats !== 'object') d.stats = { answers: 0, correct: 0 };
    d.stats.answers = clampInt(d.stats.answers, 0, 99999999);
    d.stats.correct = Math.min(d.stats.answers, clampInt(d.stats.correct, 0, 99999999));
    return d;
  }

  function dateKey(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  async function loadRaw() {
    if (window.mathwonder && window.mathwonder.isDesktop) {
      try {
        const raw = await window.mathwonder.loadSave();
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    }
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }

  async function persist(data) {
    const json = JSON.stringify(data);
    if (window.mathwonder && window.mathwonder.isDesktop) {
      return window.mathwonder.writeSave(json);
    }
    try { localStorage.setItem(KEY, json); return true; }
    catch (e) { return false; }   // 隐私模式 / 存储被禁用时降级为「本次会话内有效」，不中断学习
  }

  const Save = {
    data: null,

    async init() {
      const raw = await loadRaw();
      this.isFresh = !raw;
      this.data = normalize(deepMerge(defaultSave(), raw || {}));
      if (!this.data.player.createdAt) {
        this.data.player.createdAt = new Date().toISOString();
        await this.write();
      }
      return this.data;
    },

    async write() { return persist(this.data); },

    totalStars() {
      return Object.values(this.data.stars).reduce((s, v) => s + (v || 0), 0);
    },

    starsOf(lessonId) { return this.data.stars[lessonId] || 0; },

    recordLesson(lessonId, stars) {
      const prev = this.data.stars[lessonId] || 0;
      this.data.stars[lessonId] = Math.max(prev, stars);
      this.data.completed[lessonId] = true;
      return this.write();
    },

    recordExplored(lessonId) {
      this.data.exploreDone[lessonId] = true;
      return this.write();
    },

    addWrong(item) {
      const found = this.data.wrongBook.find(w => w.lessonId === item.lessonId && w.qid === item.qid);
      if (found) {
        found.count = (Number(found.count) || 0) + 1;
        found.lastAt = new Date().toISOString().slice(0, 10);
        found.wrongStreak = (Number(found.wrongStreak) || 0) + 1;
        found.rightStreak = 0;   // 再次答错，连击清零，必须先连续答对两次才会移出
        // 题目内容可能更新，重做时优先使用最新快照
        for (const k of ['type', 'options', 'template', 'items', 'bank', 'hints', 'answer', 'visual', 'prompt']) {
          if (item[k] !== undefined) found[k] = item[k];
        }
      } else {
        this.data.wrongBook.push(Object.assign({
          count: 1, wrongStreak: 1, rightStreak: 0,
          lastAt: new Date().toISOString().slice(0, 10)
        }, item));
      }
      return this.write();
    },

    // 答对一次：错题 streak 归零；连续答对两次移出错题本
    resolveWrong(lessonId, qid) {
      const found = this.data.wrongBook.find(w => w.lessonId === lessonId && w.qid === qid);
      if (!found) return Promise.resolve();
      found.rightStreak = (found.rightStreak || 0) + 1;
      found.wrongStreak = 0;
      if (found.rightStreak >= 2) {
        this.data.wrongBook = this.data.wrongBook.filter(w => w !== found);
      }
      return this.write();
    },

    addBadge(id) {
      if (this.data.badges.includes(id)) return Promise.resolve(false);
      this.data.badges.push(id);
      return this.write().then(() => true);
    },

    setLastGrade(g) { this.data.settings.lastGrade = g; return this.write(); },

    setLastLesson(lessonId) {
      const hit = Data.findLesson(lessonId);
      this.data.settings.lastLesson = lessonId;
      if (hit) this.data.settings.lastGrade = hit.grade.grade;
      return this.write();
    },

    setSound(on) {
      this.data.settings.sound = !!on;
      return this.write();
    },

    setSpeechSetting(key, value) {
      this.data.settings[key] = value;
      return this.write();
    },

    setName(name) {
      const v = String(name == null ? '' : name).trim().slice(0, 12);
      this.data.player.name = v || DEFAULT_SAVE.player.name;
      return this.write();
    },

    todayKey() { return dateKey(new Date()); },

    _dayRec() {
      const k = dateKey(new Date());
      if (!this.data.daily[k]) {
        this.data.daily[k] = {
          answers: 0, correct: 0, sessions: 0, seconds: 0,
          daily: 0, aural: 0, quiz: 0, wrong: 0
        };
      }
      return this.data.daily[k];
    },

    // 每次「首次作答」记一笔，供家长视图统计正确率与打卡
    recordAnswer(correct) {
      const rec = this._dayRec();
      this.data.stats.answers++;
      rec.answers++;
      if (correct) { this.data.stats.correct++; rec.correct++; }
      return this.write();
    },

    // 完成一套练习（每日口算 / 听算 / 单元小测 / 错题组卷）
    recordPractice(kind, extra) {
      const rec = this._dayRec();
      rec.sessions++;
      rec[kind] = (rec[kind] || 0) + 1;
      if (extra && Number(extra.seconds)) rec.seconds += Math.round(extra.seconds);
      return this.write();
    },

    markUnitPassed(key) {
      if (!key || this.data.unitPassed[key]) return Promise.resolve(false);
      this.data.unitPassed[key] = true;
      return this.write().then(() => true);
    },

    saveUnitQuiz(key, result) {
      this.data.unitQuiz[key] = Object.assign({ at: this.todayKey() }, result);
      return this.write();
    },

    // 连续打卡天数：今天已练从今天起算，否则从昨天起算
    streak() {
      const set = new Set(Object.keys(this.data.daily)
        .filter(k => (this.data.daily[k].answers || 0) > 0));
      const cur = new Date(); cur.setHours(0, 0, 0, 0);
      if (!set.has(dateKey(cur))) cur.setDate(cur.getDate() - 1);
      let n = 0;
      while (set.has(dateKey(cur))) { n++; cur.setDate(cur.getDate() - 1); }
      return n;
    },

    lastDays(n) {
      const out = [];
      const cur = new Date(); cur.setHours(0, 0, 0, 0);
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(cur); d.setDate(cur.getDate() - i);
        const k = dateKey(d);
        const rec = this.data.daily[k] || {};
        out.push({
          key: k,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          weekday: '日一二三四五六'[d.getDay()],
          answers: rec.answers || 0,
          correct: rec.correct || 0,
          sessions: rec.sessions || 0
        });
      }
      return out;
    },

    // 导入完整存档；导入前做同样的类型兜底，脏数据不会白屏
    importSave(obj) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return Promise.reject(new Error('存档格式不正确'));
      }
      this.data = normalize(deepMerge(defaultSave(), obj));
      if (!this.data.player.createdAt) this.data.player.createdAt = new Date().toISOString();
      this.isFresh = false;
      return this.write();
    },

    // 重置全部进度，但保留家长设置过的孩子名字与头像（属于"资料"而非"进度"）
    reset() {
      const keep = {
        name: this.data && this.data.player ? this.data.player.name : DEFAULT_SAVE.player.name,
        avatar: this.data && this.data.player ? this.data.player.avatar : DEFAULT_SAVE.player.avatar
      };
      this.data = normalize(defaultSave());
      this.data.player.name = keep.name;
      this.data.player.avatar = keep.avatar;
      this.data.player.createdAt = new Date().toISOString();
      this.isFresh = false;
      return this.write();
    }
  };

  window.Save = Save;
})();
