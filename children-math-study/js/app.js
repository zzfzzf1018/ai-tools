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
      // 弹层里可能正挂着一个 Game 实例，关闭时释放它的键盘/拖拽监听
      ov.querySelectorAll('[data-game-mount]').forEach(b => {
        try { b._gameDispose && b._gameDispose(); } catch (e) { /* ignore */ }
      });
      ov.classList.add('hidden');
      ov.innerHTML = '';
    },
    toast(text, color) {
      const t = document.createElement('div');
      // space 主题的 --primary/--secondary 是亮青/亮黄，白字几乎看不清
      const ink = document.body.dataset.theme === 'space' ? '#0f172a' : '#fff';
      t.style.cssText = `position:fixed;top:70px;left:50%;transform:translateX(-50%);
        z-index:400;background:${color || 'var(--primary)'};color:${ink};font-size:17px;font-weight:bold;
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
    },
    updateAvatar() {
      const b = document.getElementById('btn-avatar');
      if (!b || !window.Shop) return;
      b.textContent = Shop.avatarText();
      const name = (Save.data.player || {}).name || '小朋友';
      b.title = `${name} · 点击进入星星商店`;
    },
    updateVoice() {
      const btn = document.getElementById('btn-voice');
      if (!btn) return;
      const ok = !!(window.Speech && Speech.supported && Speech.enabled());
      btn.textContent = ok ? '🔊' : '🔇';
      btn.title = ok ? '语音朗读已开启（点击关闭）' : '语音朗读已关闭（点击开启）';
      btn.classList.toggle('muted', !ok);
    }
  };

  /* ---------- 路由 ---------- */
  const App = {
    page: document.getElementById('page'),

    async start() {
      await Save.init();
      Data.init();
      UI.updateStars();
      UI.updateVoice();
      UI.updateAvatar();

      // 首次用户手势时预热系统语音列表（部分平台首次 getVoices 为空）
      document.addEventListener('pointerdown', () => {
        if (window.Speech) Speech.warmup();
      }, { once: true });

      document.getElementById('btn-back').addEventListener('click', () => {
        const h = location.hash.replace(/^#\/?/, '');
        if (h.startsWith('lesson/')) {
          const hit = Data.findLesson(h.slice(7));
          this.navigate(hit ? 'grade/' + hit.grade.grade : 'home');
        } else if (h.startsWith('quiz/')) {
          const meta = Data.unitMeta(h.slice(5));
          this.navigate(meta ? 'grade/' + meta.grade.grade : 'home');
        } else {
          this.navigate('home');
        }
      });
      document.getElementById('btn-parent').addEventListener('click', () => this.navigate('parent'));
      document.getElementById('btn-wrong').addEventListener('click', () => this.navigate('wrong'));
      document.getElementById('btn-avatar').addEventListener('click', () => this.navigate('shop'));
      document.getElementById('btn-voice').addEventListener('click', () => {
        if (!window.Speech) return;
        if (!Speech.supported) {
          UI.toast('本设备不支持语音朗读，可照常看题作答', '#f87171');
          return;
        }
        Speech.warmup();
        const on = Speech.toggle();
        UI.updateVoice();
        UI.toast(on ? '🔊 语音朗读已开启' : '🔇 语音朗读已关闭', on ? 'var(--secondary)' : '#f87171');
        if (on) Speech.speak('语音朗读已开启，我们一起听题吧');
      });
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
            题目都能<b>读给你听</b>，跟着单元一关一关往前走吧！
          </div>
          <div class="overlay-actions">
            <button class="btn-big" id="wl-start">开始冒险 ➜</button>
          </div>
        </div>`, () => {
        document.getElementById('wl-start').onclick = () => {
          if (window.Speech) Speech.warmup();
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
      // 换页先停止朗读、释放上一页游戏实例的全局监听，并清掉拖拽残影
      if (window.Speech) Speech.stop();
      document.querySelectorAll('[data-game-mount]').forEach(b => {
        try { b._gameDispose && b._gameDispose(); } catch (e) { /* ignore */ }
      });
      document.querySelectorAll('.drag-ghost').forEach(g => g.remove());
      const h = location.hash.replace(/^#\/?/, '') || 'home';
      UI.closeOverlay();
      const topbar = document.getElementById('topbar');

      // 主题跟随年级
      let theme = 'candy';
      const gradeMatch = h.match(/^grade\/(\d)/);
      const lessonMatch = h.match(/^lesson\/(.+)$/);
      const quizMatch = h.match(/^quiz\/(.+)$/);
      if (gradeMatch) theme = (Data.grade(+gradeMatch[1]) || {}).theme || 'candy';
      if (lessonMatch) {
        const g = Data.gradeOfLesson(lessonMatch[1]);
        theme = (g || {}).theme || 'candy';
      }
      if (quizMatch) {
        const meta = Data.unitMeta(quizMatch[1]);
        theme = (meta && meta.grade || {}).theme || 'candy';
      }
      if (h === 'daily' || h === 'wrong-drill' || h === 'variants' || h === 'shop') {
        const lg = (Save.data.settings || {}).lastGrade;
        theme = (Data.grade(lg) || {}).theme || 'candy';
      }
      UI.setTheme(theme);
      UI.updateStars();
      UI.updateVoice();
      UI.updateAvatar();

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
      else if (h === 'daily') {
        topbar.classList.remove('hidden');
        document.getElementById('topbar-title').textContent = '🎯 每日口算';
        Practice.renderDaily(this.page);
      }
      else if (quizMatch) {
        const meta = Data.unitMeta(quizMatch[1]);
        if (!meta) { this.navigate('home'); return; }
        topbar.classList.remove('hidden');
        document.getElementById('topbar-title').textContent = '🎓 单元小测';
        Practice.renderUnitQuiz(this.page, quizMatch[1]);
      }
      else if (h === 'wrong-drill') {
        topbar.classList.remove('hidden');
        document.getElementById('topbar-title').textContent = '📝 错题组卷';
        Practice.renderWrongDrill(this.page);
      }
      else if (h === 'variants') {
        topbar.classList.remove('hidden');
        document.getElementById('topbar-title').textContent = '🔁 同类题变式';
        Variants.render(this.page);
      }
      else if (h === 'shop') {
        topbar.classList.remove('hidden');
        document.getElementById('topbar-title').textContent = '🛍️ 星星商店';
        Shop.render(this.page);
      }
      else if (h === 'parent') { topbar.classList.remove('hidden'); Parent.render(this.page); }
      else if (h === 'wrong') { topbar.classList.remove('hidden'); this.renderWrong(); }
      else { topbar.classList.remove('hidden'); this.renderHome(); }
    },

    /* ---------- 首页：年级选择 + 今日冒险 ---------- */
    renderHome() {
      document.getElementById('topbar-title').textContent = '🏝️ 数学奇妙岛';
      const p = this.page;
      p.insertAdjacentHTML('beforeend', `
        <h1 class="page-title">选择你的冒险岛 🗺️</h1>
        <p class="page-subtitle">每个年级都是一座小岛，按单元一关一关往前走吧！</p>
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

      // 今日冒险：每日口算 / 打卡 / 错题组卷 / 单元小测
      const streak = Save.streak();
      const wrongs = Save.data.wrongBook || [];
      const doneUnits = Data.allUnitKeys().filter(k => {
        const up = Data.unitProgress(k);
        return up && up.allDone;
      });
      const quizReady = doneUnits.filter(k => !(Save.data.unitQuiz || {})[k]);
      const quizTarget = quizReady[0] || doneUnits[0] || null;
      const today = Save.data.daily[Save.todayKey()] || {};
      const hub = document.createElement('div');
      hub.className = 'card home-hub';
      hub.innerHTML = `
        <div class="hub-head">
          <h2>${window.Shop ? Shop.avatarHtml() : '🦊'} ⚡ 今日冒险 · ${UI.esc((Save.data.player || {}).name || '小朋友')}</h2>
          <span class="hub-streak">🔥 连续打卡 ${streak} 天</span>
        </div>
        <p class="hub-note">今天已答 ${today.answers || 0} 题${today.answers ? ` · 答对 ${today.correct || 0} 题` : '，先来热热身吧'} · 可用 ⭐ ${Save.availableStars()} 颗</p>
        <div class="hub-actions">
          <button class="hub-btn" id="hub-daily"><span>🎯</span><b>每日口算</b><small>按年级自动出题</small></button>
          <button class="hub-btn" id="hub-wrong"><span>📕</span><b>错题组卷</b><small>${wrongs.length ? `${wrongs.length} 道待巩固` : '暂时空空的'}</small></button>
          <button class="hub-btn" id="hub-variants"><span>🔁</span><b>变式再练</b><small>${wrongs.length ? '同类题换数字再练' : '有错题后开放'}</small></button>
          <button class="hub-btn" id="hub-quiz"><span>🎓</span><b>单元小测</b><small>${quizReady.length ? `${quizReady.length} 个单元可测` : (doneUnits.length ? `${doneUnits.length} 个单元可复测` : '通关单元后开放')}</small></button>
          <button class="hub-btn" id="hub-shop"><span>🛍️</span><b>星星商店</b><small>换头像与挂件</small></button>
          <button class="hub-btn" id="hub-parent"><span>📊</span><b>成长报告</b><small>看看最近的努力</small></button>
        </div>`;
      p.appendChild(hub);
      hub.querySelector('#hub-daily').onclick = () => this.navigate('daily');
      hub.querySelector('#hub-wrong').onclick = () => this.navigate(wrongs.length ? 'wrong-drill' : 'wrong');
      hub.querySelector('#hub-variants').onclick = () => this.navigate(wrongs.length ? 'variants' : 'wrong');
      hub.querySelector('#hub-quiz').onclick = () => {
        if (!quizTarget) { UI.toast('先通关一个单元，就能来挑战小测啦～'); return; }
        this.navigate('quiz/' + quizTarget);
      };
      hub.querySelector('#hub-shop').onclick = () => this.navigate('shop');
      hub.querySelector('#hub-parent').onclick = () => this.navigate('parent');

      const grid = document.createElement('div');
      grid.className = 'grade-grid';
      Data.grades.forEach(g => {
        const prog = Data.gradeProgress(g);
        const cnt = Data.gradeCount(g.grade);
        const next = Data.nextToLearn(g.grade);
        const cur = next ? `第 ${next.semesterIndex + 1} 学期 · 第 ${next.unitIndex + 1} 单元` : '全部通关';
        const card = document.createElement('div');
        card.className = 'grade-card';
        if (next) card.style.setProperty('--theme-hint', '1');
        card.innerHTML = `
          <span class="grade-emoji">${g.emoji}</span>
          <h3>${g.title}</h3>
          <p>${g.subtitle || ''}</p>
          <div class="grade-progress"><div style="width:${prog * 100}%"></div></div>
          <p>${Math.round(prog * 100)}% 完成 · ${cnt.done}/${cnt.total} 课</p>
          <p class="grade-current">📍 ${cur}</p>
        `;
        card.addEventListener('click', () => this.navigate('grade/' + g.grade));
        grid.appendChild(card);
      });
      p.appendChild(grid);
    },

    /* ---------- 年级页：学习路线 + 学期 tab + 单元递进地图 ---------- */
    renderGrade(n) {
      const g = Data.grade(n);
      if (!g) return this.navigate('home');
      Save.setLastGrade(n);
      document.getElementById('topbar-title').textContent = `${g.emoji} ${g.title}`;
      const p = this.page;
      const cnt = Data.gradeCount(n);
      const next = Data.nextToLearn(n);
      p.insertAdjacentHTML('beforeend', `
        <h1 class="page-title">${g.emoji} ${g.title}</h1>
        <p class="page-subtitle">${g.subtitle || ''}</p>
      `);

      // 学习路线横幅：明确当前处在哪个单元、下一步学什么
      const banner = document.createElement('div');
      banner.className = 'card path-banner';
      const allDone = cnt.done === cnt.total && cnt.total > 0;
      banner.innerHTML = `
        <div class="pb-icon">🗺️</div>
        <div class="pb-main">
          <div class="pb-title">${allDone ? '🎉 本年级已全部通关，随时可以复习' :
            `学习路线：第 ${next ? next.semesterIndex + 1 : 1} 学期 · 第 ${next ? next.unitIndex + 1 : 1} 单元 ${UI.esc(next ? next.unit.title : '')}`}</div>
          <div class="pb-sub">${allDone ? '也可以去做单元小测，检验一下掌握程度' :
            `下一步：${UI.esc(next ? next.lesson.title : '')} · 已完成 ${cnt.done}/${cnt.total} 课`}</div>
          <div class="pb-bar"><div style="width:${cnt.total ? cnt.done / cnt.total * 100 : 0}%"></div></div>
        </div>
        ${next ? `<button class="btn-big" id="btn-go-next">${allDone ? '🔁 复习一遍' : '继续闯关 ➜'}</button>` : ''}
      `;
      p.appendChild(banner);
      const goBtn = banner.querySelector('#btn-go-next');
      if (goBtn && next) goBtn.onclick = () => this.navigate('lesson/' + next.lesson.id);

      const unitList = Data.gradeUnits(n);
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
        sem.units.forEach((unit, ui) => {
          const key = `g${n}s${si}u${ui}`;
          const up = Data.unitProgress(key);
          const globalIdx = unitList.findIndex(u => u.key === key) + 1;
          const unitCount = unitList.length;
          const stateLabel = up.state === 'done' ? '✅ 已通关' :
            up.state === 'locked' ? '🔒 未解锁' :
              up.state === 'learning' ? '🔥 学习中' : '✨ 新单元';
          const uc = document.createElement('div');
          uc.className = 'card unit-card unit-' + up.state;
          const head = document.createElement('div');
          head.className = 'unit-head';
          head.innerHTML = `
            <span class="unit-step">第 ${globalIdx} 单元</span>
            <span class="unit-icon">${unit.icon}</span>
            <div class="unit-heading">
              <h3>${unit.title} <span class="unit-state">${stateLabel}</span></h3>
              <p>${unit.subtitle || ''} · ${up.done}/${up.total} 课 · 全年级共 ${unitCount} 个单元</p>
              <div class="unit-progress"><div style="width:${up.ratio * 100}%"></div></div>
            </div>`;
          uc.appendChild(head);

          const path = document.createElement('div');
          path.className = 'lesson-path';
          unit.lessons.forEach(L => {
            const done = !!Save.data.completed[L.id];
            // 关键：解锁状态取自全年级连续路径，跨单元、跨学期不再重置
            const unlocked = Data.isUnlocked(L.id) || done;
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
            if (unlocked) {
              node.addEventListener('click', () => this.navigate('lesson/' + L.id));
            } else {
              node.addEventListener('click', () => {
                const prev = Data.prevLesson(L.id);
                UI.toast(prev ? `先完成《${prev.title}》就解锁啦！` : '按顺序完成前面的课程哦～', '#f87171');
                if (window.Speech) Speech.speak(prev ? `先完成${prev.title}，就能解锁这一课啦` : '按顺序完成前面的课程');
              });
            }
            path.appendChild(node);
          });
          uc.appendChild(path);

          // 单元通关后开放综合小测
          if (up.allDone) {
            const rec = (Save.data.unitQuiz || {})[key];
            const foot = document.createElement('div');
            foot.className = 'unit-foot';
            const stars = Math.max(0, Math.min(3, Math.trunc(Number(rec && rec.stars) || 0)));
            foot.innerHTML = `<span>${rec
              ? `🏅 上次小测：答对 ${Number(rec.correct) || 0}/${Number(rec.total) || 0} 题 · ${'⭐'.repeat(stars)}`
              : '🎓 单元已通关，来一场综合小测吧！'}</span>`;
            const qb = document.createElement('button');
            qb.className = 'btn-secondary';
            qb.textContent = rec ? '🎓 再测一次' : '🎓 开始单元小测';
            qb.onclick = () => this.navigate('quiz/' + key);
            foot.appendChild(qb);
            uc.appendChild(foot);
          } else if (up.state === 'locked') {
            const foot = document.createElement('div');
            foot.className = 'unit-foot locked-hint';
            foot.textContent = '🔒 完成上一个单元的全部课程后解锁';
            uc.appendChild(foot);
          }
          ul.appendChild(uc);
        });
        listWrap.appendChild(ul);
        if (autoScroll) scrollToLast();
      };

      g.semesters.forEach((sem, i) => {
        const path = Data.pathOf(n).filter(e => e.semesterIndex === i);
        const done = path.filter(e => Data.completed(e.lesson.id)).length;
        const t = document.createElement('button');
        t.className = 'semester-tab';
        t.textContent = `${sem.title}  ${done}/${path.length}`;
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
      const drill = document.createElement('div');
      drill.className = 'continue-row wrong-actions';
      const drillBtn = document.createElement('button');
      drillBtn.className = 'btn-big';
      drillBtn.textContent = `📝 一键组卷复习（${wrongs.length} 题）`;
      drillBtn.onclick = () => this.navigate('wrong-drill');
      drill.appendChild(drillBtn);
      const variantBtn = document.createElement('button');
      variantBtn.className = 'btn-secondary';
      variantBtn.textContent = '🔁 全部错题 · 同类题变式训练';
      variantBtn.onclick = () => this.navigate('variants');
      drill.appendChild(variantBtn);
      p.appendChild(drill);

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
        if (window.Speech && Speech.supported) {
          item.appendChild(Speech.button('🔊', () => Speech.toSpeakText(w.prompt || '')));
        }
        const btn = document.createElement('button');
        btn.className = 'btn-secondary';
        btn.textContent = '✏️ 再试一次';
        btn.addEventListener('click', () => {
          this.practiceWrong(w, item);
        });
        item.appendChild(btn);
        const vBtn = document.createElement('button');
        vBtn.className = 'btn-secondary';
        vBtn.textContent = '🔁 变式';
        vBtn.title = '自动生成同结构不同数字的同类题';
        vBtn.addEventListener('click', () => Variants.openForWrong(w));
        item.appendChild(vBtn);
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

      // 极旧的存档可能缺少排序题选项，退回"重做本课"
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
          <div class="wp-head">
            <div class="sparkle-guide">📝</div>
            <button class="btn-round" id="wp-close" title="关闭（Esc）">✖</button>
          </div>
          <div id="wp-game" class="practice-game"></div>
        </div>`, () => {
        let closed = false;
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        const close = () => {
          if (closed) return;
          closed = true;
          window.removeEventListener('keydown', onKey);
          if (window.Speech) Speech.stop();
          UI.closeOverlay();
        };
        document.getElementById('wp-close').onclick = close;
        window.addEventListener('keydown', onKey);
        Game.mount(document.getElementById('wp-game'), {
          icon: '📝', title: '错题重做', lessonId: w.lessonId, questions: [q]
        }, {
          onQuestionDone() {},
          onFinish: (stats) => {
            close();
            if (!stats.total) {
              UI.toast('这道旧题已无法作答，回课程里重做吧～', '#f87171');
              this.navigate('wrong');
              return;
            }
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
