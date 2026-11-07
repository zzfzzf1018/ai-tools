/* ===== 课程数据：内容脚本（content/gradeN.js）在 index.html 中预加载 =====
   单元递进：年级 → 学期 → 单元 → 课程，展平为一条连续的学习路径。
   解锁规则跨单元、跨学期连续生效：完成上一课才解锁下一课，不再每个单元从第一课重新解锁。
*/
(function () {
  const Data = {
    grades: [],

    init() {
      this.grades = [
        window.CONTENT_GRADE_1,
        window.CONTENT_GRADE_2,
        window.CONTENT_GRADE_3,
        window.CONTENT_GRADE_4,
        window.CONTENT_GRADE_5
      ].filter(Boolean);
      this._idx = null;
      this._paths = {};
    },

    grade(n) { return this.grades.find(g => g.grade === n); },

    completed(id) {
      return !!(window.Save && Save.data && Save.data.completed && Save.data.completed[id]);
    },

    /* 把某个年级的全部课程展平为有序路径（跨学期、跨单元连续编号） */
    pathOf(gradeOrNum) {
      const g = typeof gradeOrNum === 'number' ? this.grade(gradeOrNum) : gradeOrNum;
      if (!g) return [];
      if (this._paths && this._paths[g.grade]) return this._paths[g.grade];
      const list = [];
      (g.semesters || []).forEach((sem, si) => {
        (sem.units || []).forEach((unit, ui) => {
          (unit.lessons || []).forEach((lesson, li) => {
            list.push({
              lesson, unit, unitIndex: ui,
              unitKey: `g${g.grade}s${si}u${ui}`,
              semester: sem, semesterIndex: si,
              lessonIndex: li, grade: g, order: list.length
            });
          });
        });
      });
      this._paths = this._paths || {};
      this._paths[g.grade] = list;
      return list;
    },

    // 全部 lesson 索引：id -> {lesson, unit, unitKey, semester, grade, ...}
    lessonIndex() {
      if (this._idx) return this._idx;
      const idx = {};
      for (const g of this.grades) {
        for (const e of this.pathOf(g)) idx[e.lesson.id] = e;
      }
      this._idx = idx;
      return idx;
    },

    findLesson(id) { return this.lessonIndex()[id] || null; },

    // 按 lessonId + qid 从内容里取回最新题目，错题重做时避免使用过期的存档快照
    findQuestion(lessonId, qid) {
      const hit = this.findLesson(lessonId);
      if (!hit) return null;
      for (const game of hit.lesson.games || []) {
        const q = (game.questions || []).find(x => x.id === qid);
        if (q) return q;
      }
      return null;
    },

    /* ---------- 单元递进 ---------- */

    // 顺序解锁：第一课永远开放，其余课程要求前一课已完成（跨单元、跨学期同样生效）
    isUnlocked(lessonId) {
      const hit = this.findLesson(lessonId);
      if (!hit) return false;
      const path = this.pathOf(hit.grade);
      const i = path.findIndex(e => e.lesson.id === lessonId);
      if (i <= 0) return true;
      return this.completed(path[i - 1].lesson.id);
    },

    unitKeyOf(lessonId) {
      const hit = this.findLesson(lessonId);
      return hit ? hit.unitKey : null;
    },

    unitEntries(unitKey) {
      for (const g of this.grades) {
        const es = this.pathOf(g).filter(e => e.unitKey === unitKey);
        if (es.length) return es;
      }
      return [];
    },

    unitMeta(unitKey) {
      const es = this.unitEntries(unitKey);
      return es.length ? es[0] : null;
    },

    unitProgress(unitKey) {
      const es = this.unitEntries(unitKey);
      if (!es.length) return null;
      const total = es.length;
      const done = es.filter(e => this.completed(e.lesson.id)).length;
      const unlocked = this.isUnlocked(es[0].lesson.id);
      const allDone = done === total;
      return {
        total, done, ratio: total ? done / total : 0, allDone, unlocked,
        started: done > 0,
        state: allDone ? 'done' : (!unlocked ? 'locked' : (done > 0 ? 'learning' : 'ready'))
      };
    },

    // 某年级所有单元（按教材顺序），供年级页与家长视图使用
    gradeUnits(gradeOrNum) {
      const seen = new Set();
      const out = [];
      for (const e of this.pathOf(gradeOrNum)) {
        if (seen.has(e.unitKey)) continue;
        seen.add(e.unitKey);
        out.push({
          key: e.unitKey, entry: e, unit: e.unit, semester: e.semester,
          semesterIndex: e.semesterIndex, unitIndex: e.unitIndex,
          progress: this.unitProgress(e.unitKey)
        });
      }
      return out;
    },

    allUnitKeys() {
      const keys = [];
      for (const g of this.grades) {
        for (const u of this.gradeUnits(g)) keys.push(u.key);
      }
      return keys;
    },

    // 推荐的下一课：第一个「未完成且已解锁」的课程；全部完成时返回最后一课
    nextToLearn(gradeOrNum) {
      const path = this.pathOf(gradeOrNum);
      for (const e of path) {
        if (!this.completed(e.lesson.id) && this.isUnlocked(e.lesson.id)) return e;
      }
      return path.length ? path[path.length - 1] : null;
    },

    // 单元综合小测：每课抽至多 perLesson 题，合成一套卷（题 id 加课前缀避免撞号）
    unitQuestions(unitKey, perLesson, limit) {
      perLesson = perLesson || 2;
      limit = limit || 10;
      const picked = [];
      for (const e of this.unitEntries(unitKey)) {
        const pool = [];
        (e.lesson.games || []).forEach(g => (g.questions || []).forEach(q => pool.push(q)));
        pool.sort(() => Math.random() - 0.5);
        for (const q of pool.slice(0, perLesson)) {
          if (picked.length >= limit) break;
          picked.push(Object.assign({}, q, {
            id: `${e.lesson.id}~${q.id}`,
            _fromLesson: e.lesson.id
          }));
        }
        if (picked.length >= limit) break;
      }
      return picked;
    },

    // 同一本教材顺序中的下一课（不跨年级）
    nextLesson(id) {
      const hit = this.findLesson(id);
      if (!hit) return null;
      const list = this.pathOf(hit.grade);
      const i = list.findIndex(e => e.lesson.id === id);
      return i >= 0 && i + 1 < list.length ? list[i + 1].lesson : null;
    },

    prevLesson(id) {
      const hit = this.findLesson(id);
      if (!hit) return null;
      const list = this.pathOf(hit.grade);
      const i = list.findIndex(e => e.lesson.id === id);
      return i > 0 ? list[i - 1].lesson : null;
    },

    // 找 lesson 所在 grade 内容对象
    gradeOfLesson(id) {
      const hit = this.findLesson(id);
      return hit ? hit.grade : null;
    },

    // 年级完成度 0~1
    gradeProgress(g) {
      const path = this.pathOf(g);
      if (!path.length) return 0;
      return path.filter(e => this.completed(e.lesson.id)).length / path.length;
    },

    // 年级总课数 / 已完成课数
    gradeCount(n) {
      const path = this.pathOf(n);
      return { total: path.length, done: path.filter(e => this.completed(e.lesson.id)).length };
    }
  };

  window.Data = Data;
})();
