/* ===== 课程数据：内容脚本（content/gradeN.js）在 index.html 中预加载 ===== */
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
    },

    grade(n) { return this.grades.find(g => g.grade === n); },

    // 全部 lesson 索引：id -> {lesson, unit, semester, grade}
    lessonIndex() {
      if (this._idx) return this._idx;
      const idx = {};
      for (const g of this.grades) {
        for (const sem of g.semesters) {
          for (const unit of sem.units) {
            for (const lesson of unit.lessons) {
              idx[lesson.id] = { lesson, unit, semester: sem, grade: g };
            }
          }
        }
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

    // 同一本教材顺序中的下一课（不跨年级）
    nextLesson(id) {
      const hit = this.findLesson(id);
      if (!hit) return null;
      const list = [];
      for (const sem of hit.grade.semesters) {
        for (const unit of sem.units) list.push(...unit.lessons);
      }
      const i = list.findIndex(L => L.id === id);
      return i >= 0 && i + 1 < list.length ? list[i + 1] : null;
    },

    // 找 lesson 所在 grade 内容对象
    gradeOfLesson(id) {
      const hit = this.findLesson(id);
      return hit ? hit.grade : null;
    },

    // 年级完成度 0~1
    gradeProgress(g) {
      let total = 0, done = 0;
      for (const sem of g.semesters) {
        for (const unit of sem.units) {
          for (const lesson of unit.lessons) {
            total++;
            if (Save.data.completed[lesson.id]) done++;
          }
        }
      }
      return total ? done / total : 0;
    }
  };

  window.Data = Data;
})();
