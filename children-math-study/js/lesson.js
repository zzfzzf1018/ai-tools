/* ===== Lesson 播放器：故事 → 探索 → 闯关 → 结算 ===== */
(function () {

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  const Lesson = {
    current: null,

    play(lessonId, container) {
      const hit = Data.findLesson(lessonId);
      if (!hit) return;
      const L = hit.lesson;
      this.current = { id: lessonId, entry: hit };
      container.innerHTML = '';
      const stage = el('div', 'lesson-stage');

      // 阶段指示器
      const steps = el('div', 'stage-steps');
      const stepDefs = [['📖 故事'], ['🧪 探索'], ['🎮 闯关']];
      const stepEls = stepDefs.map(([t]) => {
        const s = el('div', 'stage-step', t);
        steps.appendChild(s);
        return s;
      });

      const body = el('div');
      stage.appendChild(steps);
      stage.appendChild(body);
      container.appendChild(stage);

      const setStep = (i) => stepEls.forEach((s, j) => {
        s.classList.toggle('active', j === i);
        s.classList.toggle('done', j < i);
      });

      // 引导角色闪闪开场
      const guide = L.guide || '🤖';
      setStep(0);
      this.playStory(body, L, guide, () => {
        Save.recordExplored(lessonId);
        setStep(1);
        this.playExplore(body, L, guide, () => {
          setStep(2);
          this.playGames(body, L, guide, (stars, stats) => {
            this.showResult(body, L, stars, stats, () => {
              App.navigate('grade/' + hit.grade.grade);
            });
          });
        });
      });
    },

    /* ---------- 故事 ---------- */
    playStory(body, L, guide, next) {
      const scenes = (L.story && L.story.scenes) || [];
      let i = 0;
      const sc = el('div', 'card story-scene');
      body.innerHTML = '';
      body.appendChild(sc);

      function render() {
        const s = scenes[i];
        sc.innerHTML = `
          <div class="sparkle-guide">${guide}</div>
          <div class="scene-art">${s.emoji || ''}</div>
          <div class="scene-text">${s.text}</div>
          ${s.sparkle ? `<div class="scene-sparkle">✨ ${s.sparkle}</div>` : ''}
        `;
        const dots = el('div', 'scene-dots');
        scenes.forEach((_, j) => {
          const d = el('span');
          if (j === i) d.classList.add('on');
          dots.appendChild(d);
        });
        sc.appendChild(dots);
        const nav = el('div', 'story-nav');
        const skip = el('button', 'btn-secondary', '⏭ 跳过故事');
        skip.style.opacity = '.75';
        skip.onclick = () => next();
        nav.appendChild(skip);
        if (i > 0) {
          const prev = el('button', 'btn-secondary', '⬅ 上一步');
          prev.onclick = () => { i--; render(); };
          nav.appendChild(prev);
        }
        const btn = el('button', 'btn-big', i < scenes.length - 1 ? '继续 ▶' : '动手试一试 ➜');
        btn.onclick = () => { i < scenes.length - 1 ? (i++, render()) : next(); };
        nav.appendChild(btn);
        sc.appendChild(nav);
      }
      if (!scenes.length) { next(); return; }
      render();
    },

    /* ---------- 探索 ---------- */
    playExplore(body, L, guide, next) {
      body.innerHTML = '';
      const card = el('div', 'card');
      body.appendChild(card);
      if (!L.explore || !L.explore.type) { next(); return; }
      Explore.mount(card, Object.assign({ guide }, L.explore), next);
    },

    /* ---------- 闯关 ---------- */
    playGames(body, L, guide, finish) {
      body.innerHTML = '';
      const card = el('div', 'card');
      body.appendChild(card);
      const games = L.games || [];
      let gi = 0;
      const totals = { wrong: 0, total: 0 };

      function run() {
        if (gi >= games.length) {
          // 星星：0 错=3，1~3 错=2，更多=1
          const stars = totals.wrong === 0 ? 3 : (totals.wrong <= 3 ? 2 : 1);
          finish(stars, { wrong: totals.wrong, total: totals.total, perfect: totals.wrong === 0 });
          return;
        }
        Game.mount(card, Object.assign({ lessonId: L.id }, games[gi]), {
          onQuestionDone() {},
          onFinish(stats) {
            totals.wrong += stats.wrong;
            totals.total += stats.total;
            if (stats.perfect && games.length > 1) {
              UI.toast('零失误通关 ' + games[gi].title + '！', 'var(--secondary)');
            }
            gi++;
            setTimeout(() => { if (card.isConnected) run(); }, 600);
          }
        });
      }
      if (!games.length) { finish(3, { wrong: 0, total: 0, perfect: true }); return; }
      run();
    },

    /* ---------- 结算 ---------- */
    showResult(body, L, stars, stats, next) {
      const record = async () => {
        if (stats.perfect && stats.total > 0) await Save.addBadge('perfect-candidate');
        await Save.recordLesson(L.id, stars);
        return Rewards.checkBadges();
      };
      record().then(fresh => {
        body.innerHTML = '';
        const starHtml = [1, 2, 3].map(n =>
          `<span class="star">${n <= stars ? '⭐' : '☆'}</span>`).join('');
        const msg = stars === 3 ? '太惊人了，零失误通关！'
          : stars === 2 ? '很棒的表现！再练一次拿满 3 星吧'
            : '完成啦！复习一下故事和探索，再来挑战！';
        const panel = el('div', 'card result-panel', `
          <div class="sparkle-guide">🎉</div>
          <h2 class="result-msg">${msg}</h2>
          <div class="result-stars">${starHtml}</div>
          <div class="result-sub">答对 ${stats.total - stats.wrong}/${stats.total} 题 · ${L.title}</div>
          <div class="result-actions">
            <button class="btn-big" id="rs-next">返回地图 🏝️</button>
            <button class="btn-secondary" id="rs-again">🔁 再玩一次</button>
          </div>
        `);
        body.appendChild(panel);
        panel.querySelector('#rs-next').onclick = () => next();
        panel.querySelector('#rs-again').onclick = () => {
          this.play(L.id, document.getElementById('page'));
        };
        if (fresh.length) {
          setTimeout(() => {
            if (document.getElementById('page').contains(panel)) Rewards.showBadgeOverlay(fresh);
          }, 800);
        }
      });
    }
  };

  window.Lesson = Lesson;
})();
