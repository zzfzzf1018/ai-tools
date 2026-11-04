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
    settings: { lastGrade: null, lastLesson: null, sound: true }
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
  function normalize(d) {
    if (!d.player || typeof d.player !== 'object') d.player = Object.assign({}, DEFAULT_SAVE.player);
    if (typeof d.player.name !== 'string' || !d.player.name) d.player.name = DEFAULT_SAVE.player.name;
    for (const key of ['stars', 'completed', 'exploreDone']) {
      if (!d[key] || typeof d[key] !== 'object' || Array.isArray(d[key])) d[key] = {};
    }
    for (const k of Object.keys(d.stars)) {
      const n = Number(d.stars[k]);
      d.stars[k] = Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0;
    }
    d.wrongBook = Array.isArray(d.wrongBook)
      ? d.wrongBook.filter(w => w && typeof w === 'object' && w.lessonId && w.qid)
      : [];
    d.badges = Array.isArray(d.badges) ? d.badges : [];
    if (!d.settings || typeof d.settings !== 'object') d.settings = { lastGrade: null, lastLesson: null, sound: true };
    if (typeof d.settings.lastLesson !== 'string') d.settings.lastLesson = null;
    if (typeof d.settings.sound !== 'boolean') d.settings.sound = true;
    return d;
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
    localStorage.setItem(KEY, json);
    return true;
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

    // 重置全部进度（保留默认玩家资料）
    reset() {
      this.data = normalize(defaultSave());
      this.data.player.createdAt = new Date().toISOString();
      this.isFresh = false;
      return this.write();
    }
  };

  window.Save = Save;
})();
