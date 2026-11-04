/* ===== 应用入口：路由、页面渲染、主题切换 ===== */
(function () {

  /* ---------- UI 工具 ---------- */
  const UI = {
    overlay(html, after) {
      const ov = document.getElementById('overlay');
      ov.innerHTML = html;
      ov.classList.remove('hidden');
      after && after();
    },
    closeOverlay() {
      const ov = document.getElementById('overlay');
      ov.classList.add('hidden');
      ov.innerHTML = '';
    },
    toast(text, color) {
      const t = document.createElement('div');
      t.style.cssText = `position:fixed;top:70px;left:50%;transform:translateX(-50%);
        z-index:400;background:${color || 'var(--primary)'};color:#fff;font-size:17px;font-weight:bold;
        padding:10px 26px;border-radius:30px;box-shadow:0 6px 20px rgba(0,0,0,.25);
        animation:pop-in .25s;max-width:80vw;text-align:center;`;
      t.textContent = text;
      document.body.appendChild(t);
      setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 1200);
      setTimeout(() => t.remove(), 1700);
    },
    setTheme(name) {
      document.body.dataset.theme = name;
    },
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    updateStars() {
      document.getElementById('star-count').textContent = Save.totalStars();
    }
  };

  /* ---------- 路由 ---------- */
  const App = {
    page: document.getElementById('page'),

    async start() {
      await Save.init();
      Data.init();
      UI.updateStars();

      document.getElementById('btn-back').addEventListener('click', () => {
        const h = location.hash.replace(/^#\/?/, '');
        if (h.startsWith('lesson/')) {
          const hit = Data.findLesson(h.slice(7));
          this.navigate(hit ? 'grade/' + hit.grade.grade : 'home');
        } else {
          this.navigate('home');
        }
      });
      document.getElementById('btn-parent').addEventListener('click', () => this.navigate('parent'));
      document.getElementById('btn-wrong').addEventListener('click', () => this.navigate('wrong'));
      window.addEventListener('hashchange', () => this.route());

      // 首次引导弹窗（仅首次运行）
      if (Save.isFresh) {
        this.showWelcome();
      } else {
        this.route();
      }
    },

    showWelcome() {
      UI.overlay(`
        <div class="overlay-card">
          <div class="sparkle-guide">🤖</div>
          <h2>你好！我是闪闪 ✨</h2>
          <div class="overlay-text">
            欢迎来到 <b>数学奇妙岛</b>！<br>
            这里有故事、有好玩的小实验、还有闯关游戏。<br>
            跟我一起，边玩边变聪明吧！
          </div>
          <div class="overlay-actions">
            <button class="btn-big" id="wl-start">开始冒险 ➜</button>
          </div>
        </div>`, () => {
        document.getElementById('wl-start').onclick = () => {
          UI.closeOverlay();
          this.route();
        };
      });
    },

    navigate(route) {
      const target = '#/' + route;
      // hash 变化会触发 hashchange → route()，这里不再手动调用，避免同一次跳转渲染两遍
      if (location.hash === target) this.route();
      else location.hash = target;
    },

    route() {
      const h = location.hash.replace(/^#\/?/, '') || 'home';
      UI.closeOverlay();
      const topbar = document.getElementById('topbar');

      // 主题跟随年级
      let theme = 'candy';
      const gradeMatch = h.match(/^grade\/(\d)/);
      const lessonMatch = h.match(/^lesson\/(.+)$/);
      if (gradeMatch) theme = (Data.grade(+gradeMatch[1]) || {}).theme || 'candy';
      if (lessonMatch) {
        const g = Data.gradeOfLesson(lessonMatch[1]);
        theme = (g || {}).theme || 'candy';
      }
      UI.setTheme(theme);
      UI.updateStars();

      topbar.classList.add('hidden');
      this.page.innerHTML = '';

      if (h === 'home') { topbar.classList.remove('hidden'); this.renderHome(); }
      else if (gradeMatch) {
        if (!Data.grade(+gradeMatch[1])) { this.navigate('home'); return; }
        topbar.classList.remove('hidden'); this.renderGrade(+gradeMatch[1]);
      }
      else if (lessonMatch) {
        if (!Data.findLesson(lessonMatch[1])) { this.navigate('home'); return; }
        Save.setLastLesson(lessonMatch[1]);
        topbar.classList.remove('hidden'); Lesson.play(lessonMatch[1], this.page);
      }
      else if (h === 'parent') { topbar.classList.remove('hidden'); Parent.render(this.page); }
      else if (h === 'wrong') { topbar.classList.remove('hidden'); this.renderWrong(); }
      else { topbar.classList.remove('hidden'); this.renderHome(); }
    },

    /* ---------- 首页：年级选择 ---------- */
    renderHome() {
      document.getElementById('topbar-title').textContent = '🏝️ 数学奇妙岛';
      const p = this.page;
      p.insertAdjacentHTML('beforeend', `
        <h1 class="page-title">选择你的冒险岛 🗺️</h1>
        <p class="page-subtitle">每个年级都是一座小岛，跟着闪闪一起去探险吧！</p>
      `);

      // 继续上次：优先直达上次未完成的课程，否则回到上次年级
      const s = Save.data.settings || {};
      const lastL = s.lastLesson ? Data.findLesson(s.lastLesson) : null;
      const lastG = s.lastGrade ? Data.grade(s.lastGrade) : null;
      if (lastG) {
        const direct = lastL && lastL.grade.grade === lastG.grade && !Save.data.completed[lastL.lesson.id] ? lastL : null;
        const label = direct
          ? `继续上次：${direct.lesson.title} ➜`
          : `继续上次冒险：${lastG.emoji} ${lastG.title} ➜`;
        const row = document.createElement('div');
        row.className = 'continue-row';
        const btn = document.createElement('button');
        btn.className = 'btn-big';
        btn.id = 'btn-continue';
        btn.textContent = label;
        btn.onclick = () => this.navigate(direct ? 'lesson/' + direct.lesson.id : 'grade/' + lastG.grade);
        row.appendChild(btn);
        p.appendChild(row);
      }

      const grid = document.createElement('div');
      grid.className = 'grade-grid';
      Data.grades.forEach(g => {
        const prog = Data.gradeProgress(g);
        const card = document.createElement('div');
        card.className = 'grade-card';
        card.innerHTML = `
          <span class="grade-emoji">${g.emoji}</span>
          <h3>${g.title}</h3>
          <p>${g.subtitle || ''}</p>
          <div class="grade-progress"><div style="width:${prog * 100}%"></div></div>
          <p>${Math.round(prog * 100)}% 完成</p>
        `;
        card.addEventListener('click', () => this.navigate('grade/' + g.grade));
        grid.appendChild(card);
      });
      p.appendChild(grid);
    },

    /* ---------- 年级页：学期 tab + 单元关卡地图 ---------- */
    renderGrade(n) {
      const g = Data.grade(n);
      if (!g) return this.navigate('home');
      Save.setLastGrade(n);
      document.getElementById('topbar-title').textContent = `${g.emoji} ${g.title}`;
      const p = this.page;
      p.insertAdjacentHTML('beforeend', `
        <h1 class="page-title">${g.emoji} ${g.title}</h1>
        <p class="page-subtitle">${g.subtitle || ''}</p>
      `);

      const tabs = document.createElement('div');
      tabs.className = 'semester-tabs';
      const listWrap = document.createElement('div');
      p.appendChild(tabs);
      p.appendChild(listWrap);

      // 默认打开上次学习所在的学期（同年级时）
      const settings = Save.data.settings || {};
      const lastL = settings.lastLesson ? Data.findLesson(settings.lastLesson) : null;
      const inThisGrade = !!lastL && lastL.grade.grade === n;
      const defaultSem = inThisGrade ? Math.max(0, g.semesters.indexOf(lastL.semester)) : 0;

      const scrollToLast = () => {
        if (!inThisGrade) return;
        const node = listWrap.querySelector(`.lesson-node[data-lesson-id="${lastL.lesson.id}"]`);
        if (!node) return;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        requestAnimationFrame(() => node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }));
      };

      const renderSem = (si, autoScroll) => {
        tabs.querySelectorAll('.semester-tab').forEach((t, i) => t.classList.toggle('active', i === si));
        listWrap.innerHTML = '';
        const sem = g.semesters[si];
        const ul = document.createElement('div');
        ul.className = 'unit-list';
        sem.units.forEach(unit => {
          const uc = document.createElement('div');
          uc.className = 'card unit-card';
          const head = document.createElement('div');
          head.className = 'unit-head';
          head.innerHTML = `<span class="unit-icon">${unit.icon}</span>
            <div><h3>${unit.title}</h3><p>${unit.subtitle || ''}</p></div>`;
          uc.appendChild(head);
          const path = document.createElement('div');
          path.className = 'lesson-path';
          let prevDone = true; // 第一个节点默认解锁
          unit.lessons.forEach(L => {
            const done = !!Save.data.completed[L.id];
            const unlocked = prevDone || done; // 顺序解锁：前一节点完成才解锁
            prevDone = done;
            const node = document.createElement('div');
            node.className = 'lesson-node' + (done ? ' done' : '') + (unlocked ? '' : ' locked');
            node.dataset.lessonId = L.id;
            const stars = Save.starsOf(L.id);
            node.innerHTML = `
              ${unlocked ? '' : '<span class="node-lock">🔒</span>'}
              <div class="node-bubble">${done ? '✅' : L.icon || '📘'}</div>
              <div class="node-title">${L.title}</div>
              <div class="node-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
            `;
            if (unlocked) node.addEventListener('click', () => this.navigate('lesson/' + L.id));
            path.appendChild(node);
          });
          uc.appendChild(path);
          ul.appendChild(uc);
        });
        listWrap.appendChild(ul);
        if (autoScroll) scrollToLast();
      };

      g.semesters.forEach((sem, i) => {
        const t = document.createElement('button');
        t.className = 'semester-tab';
        t.textContent = sem.title;
        t.addEventListener('click', () => renderSem(i, false));
        tabs.appendChild(t);
      });
      renderSem(defaultSem, inThisGrade);
    },

    /* ---------- 错题本 ---------- */
    renderWrong() {
      document.getElementById('topbar-title').textContent = '📕 我的错题本';
      const p = this.page;
      p.insertAdjacentHTML('beforeend', `
        <h1 class="page-title">📕 错题本</h1>
        <p class="page-subtitle">答对两次，错题就会飞走哦！挑战一下吧</p>
      `);
      const wrongs = Save.data.wrongBook;
      if (!wrongs.length) {
        p.insertAdjacentHTML('beforeend',
          `<div class="empty-state">🎉 错题本空空的，你真是太棒了！</div>`);
        return;
      }
      const list = document.createElement('div');
      list.className = 'wrong-list';
      wrongs.forEach(w => {
        const hit = Data.findLesson(w.lessonId);
        const item = document.createElement('div');
        item.className = 'card wrong-item';
        item.innerHTML = `
          <div class="wq-visual">${UI.esc(w.visual || '📝')}</div>
          <div class="wq-main">
            <div class="wq-prompt">${UI.esc(w.prompt || '')}</div>
            <div class="wq-meta">${hit ? hit.grade.title + ' · ' + hit.lesson.title : ''} · 已错 ${w.count} 次</div>
          </div>`;
        const btn = document.createElement('button');
        btn.className = 'btn-secondary';
        btn.textContent = '✏️ 再试一次';
        btn.addEventListener('click', () => {
          this.practiceWrong(w, item);
        });
        item.appendChild(btn);
        list.appendChild(item);
      });
      p.appendChild(list);
    },

    practiceWrong(w, itemEl) {
      // 优先从内容里取回最新题目，按原题型（选择/输入/拖放/排序）重做
      const fresh = Data.findQuestion(w.lessonId, w.qid);
      const q = fresh || {
        id: w.qid,
        type: w.type || (Array.isArray(w.options) && w.options.length ? 'choice' : 'input'),
        prompt: w.prompt || '',
        answer: w.answer,
        options: w.options || null,
        template: w.template || null,
        items: w.items || null,
        bank: w.bank || null,
        hints: w.hints || [],
        visual: w.visual ? { emoji: w.visual } : null
      };

      // 极旧的存档可能缺少排序题选项，退回“重做本课”
      if (q.type === 'sequence' && !Array.isArray(q.items)) {
        UI.overlay(`
          <div class="overlay-card">
            <div class="sparkle-guide">📝</div>
            <div class="question-visual">${UI.esc(w.visual || '')}</div>
            <h2 style="font-size:22px">${UI.esc(w.prompt || '')}</h2>
            <div class="overlay-text">这道排序题需要回到课程里重新完成哦～</div>
            <div class="overlay-actions">
              <button class="btn-big" id="wp-lesson">去重做这一课 ➜</button>
            </div>
          </div>`, () => {
          document.getElementById('wp-lesson').onclick = () => this.navigate('lesson/' + w.lessonId);
        });
        return;
      }

      UI.overlay(`
        <div class="overlay-card wide">
          <div class="sparkle-guide">📝</div>
          <div id="wp-game" class="practice-game"></div>
        </div>`, () => {
        Game.mount(document.getElementById('wp-game'), {
          icon: '📝', title: '错题重做', lessonId: w.lessonId, questions: [q]
        }, {
          onQuestionDone() {},
          onFinish: () => {
            UI.closeOverlay();
            if (itemEl) Rewards.float(itemEl, '🎉');
            const still = Save.data.wrongBook.find(x => x.lessonId === w.lessonId && x.qid === w.qid);
            UI.toast(still ? '答对啦！再答对一次，错题就飞走～' : '错题飞走啦～', 'var(--secondary)');
            this.navigate('wrong');
          }
        });
      });
    }
  };

  window.App = App;
  window.UI = UI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.start());
  } else {
    App.start();
  }
})();
