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
    settings: { lastGrade: null }
  };

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
      this.data = deepMerge(DEFAULT_SAVE, raw || {});
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
        found.count += 1;
        found.lastAt = new Date().toISOString().slice(0, 10);
        found.wrongStreak = (found.wrongStreak || 0) + 1;
      } else {
        this.data.wrongBook.push(Object.assign({
          count: 1, wrongStreak: 1,
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

    setLastGrade(g) { this.data.settings.lastGrade = g; return this.write(); }
  };

  window.Save = Save;
})();
