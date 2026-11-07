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

    play(lessonId, container, opts) {
      // "再玩一次"等直接调用 play 的路径也要先停掉上一段朗读
      if (window.Speech) Speech.stop();
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
      const finishFlow = (stars, stats) => {
        this.showResult(body, L, stars, stats, () => {
          App.navigate('grade/' + hit.grade.grade);
        });
      };

      const halt = () => { if (window.Speech) Speech.stop(); };

      const startChallenge = () => {
        halt();
        setStep(2);
        this.playGames(body, L, guide, finishFlow);
      };

      const startFull = () => {
        halt();
        setStep(0);
        this.playStory(body, L, guide, () => {
          halt();
          Save.recordExplored(lessonId);
          setStep(1);
          this.playExplore(body, L, guide, () => {
            halt();
            setStep(2);
            this.playGames(body, L, guide, finishFlow);
          });
        });
      };

      // 已通关课程再次进入：让孩子自己选复习还是直接挑战
      if (Save.data.completed[lessonId] && !(opts && opts.forceFull)) {
        UI.overlay(`
          <div class="overlay-card">
            <div class="sparkle-guide">🗺️</div>
            <h2>这一课你已经通关啦！</h2>
            <div class="overlay-text">想再复习一遍，还是直接挑战闯关？</div>
            <div class="overlay-actions">
              <button class="btn-big" id="ls-review">📖 复习一遍</button>
              <button class="btn-secondary" id="ls-challenge">🎮 直接闯关</button>
            </div>
          </div>`, () => {
          document.getElementById('ls-review').onclick = () => { UI.closeOverlay(); startFull(); };
          document.getElementById('ls-challenge').onclick = () => { UI.closeOverlay(); startChallenge(); };
        });
      } else {
        startFull();
      }
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
        // 故事分镜逐幕朗读，识字不多的孩子也能独立听懂
        const storyText = () => Speech.toSpeakText(s.text + '。' + (s.sparkle || ''));
        if (window.Speech && Speech.supported && Speech.enabled()) {
          const sbar = el('div', 'speech-bar');
          sbar.appendChild(Speech.button('🔊 听故事', storyText));
          sbar.appendChild(Speech.stopButton());
          sc.appendChild(sbar);
          Speech.autoSpeak(storyText);
        }
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
    // 小奖状花样库：每次通关随机一款（主题 + 称号 + 印章）
    CERT_THEMES: [
      { cls: 'cert-red',    ribbon: '奖  状', seal: '🏅', titles: ['数学小状元', '满分小达人', '智慧小明星'] },
      { cls: 'cert-blue',   ribbon: '荣 誉 证 书', seal: '🎖️', titles: ['口算小超人', '速算小飞侠', '思维小博士'] },
      { cls: 'cert-purple', ribbon: '嘉  奖  令', seal: '🏆', titles: ['闯关小勇士', '魔法数学家', '探索小能手'] },
      { cls: 'cert-green',  ribbon: '奖  状', seal: '🌟', titles: ['勤奋小蜜蜂', '进步小明星', '解题小高手'] },
      { cls: 'cert-orange', ribbon: '特 别 嘉 奖', seal: '👑', titles: ['数学小王子', '数学小公主', '最强大脑星'] }
    ],

    showResult(body, L, stars, stats, next) {
      const record = async () => {
        if (stats.perfect && stats.total > 0) await Save.addBadge('perfect-candidate');
        await Save.recordLesson(L.id, stars);
        return Rewards.checkBadges();
      };
      record().then(fresh => {
        // 结算是异步的；若期间已切页，body 已脱离文档，不要再往游离节点上渲染
        if (!body.isConnected) return;
        if (window.Speech) Speech.stop();
        body.innerHTML = '';
        const nextL = Data.nextLesson(L.id);
        const starHtml = [1, 2, 3].map(n =>
          `<span class="star">${n <= stars ? '⭐' : '☆'}</span>`).join('');
        // 每次通关随机抽一款奖状花样与称号
        const theme = this.CERT_THEMES[Math.floor(Math.random() * this.CERT_THEMES.length)];
        const title = theme.titles[Math.floor(Math.random() * theme.titles.length)];
        const playerName = (Save.data.player && Save.data.player.name) || '小朋友';
        const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        const msg = stars === 3 ? '零失误通关，太惊人了！'
          : stars === 2 ? '很棒！再练一次冲击满星吧'
            : '通关成功！继续加油哦';
        const panel = el('div', 'card result-panel', `
          <div class="certificate ${theme.cls}">
            <div class="cert-ribbon">${theme.ribbon}</div>
            <div class="cert-avatar">${UI.esc((Save.data.player || {}).avatar || '🦊')}${UI.esc((Save.data.player || {}).accessory || '')}</div>
            <div class="cert-title">${title}</div>
            <div class="cert-body">
              兹授予 <b class="cert-name">${UI.esc(playerName)}</b><br>
              在「${UI.esc(L.title)}」闯关中表现出色<br>
              <span class="cert-msg">${msg}</span>
            </div>
            <div class="result-stars">${starHtml}</div>
            <div class="cert-foot">
              <span class="cert-score">${stats.total ? `答对 ${stats.total - stats.wrong}/${stats.total} 题` : '完成全部挑战'}</span>
              <span class="cert-date">${today}</span>
              <span class="cert-seal">${theme.seal}</span>
            </div>
          </div>
          <div class="result-actions">
            ${nextL ? `<button class="btn-big" id="rs-next-lesson" data-next-id="${nextL.id}">下一课：${nextL.title} ➜</button>` : ''}
            <button class="${nextL ? 'btn-secondary' : 'btn-big'}" id="rs-next">返回地图 🏝️</button>
            <button class="btn-secondary" id="rs-again">🔁 再玩一次</button>
          </div>
        `);
        body.appendChild(panel);

        // 单元递进：本单元全部通关后颁发"单元通行证"，并开放单元综合小测
        const hit = Data.findLesson(L.id);
        const unitKey = hit && hit.unitKey;
        const up = unitKey ? Data.unitProgress(unitKey) : null;
        const meta = unitKey ? Data.unitMeta(unitKey) : null;
        if (up && up.allDone && meta) {
          const quizRec = (Save.data.unitQuiz || {})[unitKey];
          const firstPass = !(Save.data.unitPassed || {})[unitKey];
          if (firstPass) Save.markUnitPassed(unitKey);
          const pass = el('div', 'unit-pass', `
            <div class="up-icon">${firstPass ? '🎓' : '🏅'}</div>
            <div class="up-text">
              <b>${firstPass ? '单元通行证到手！' : '本单元已全部通关'} · ${UI.esc(meta.unit.title)}</b>
              <p>${up.total} 课全部完成${quizRec
                ? ` · 上次小测答对 ${quizRec.correct}/${quizRec.total} 题`
                : ' · 来一场单元小测，看看掌握得怎么样'}</p>
            </div>
            <button class="btn-secondary" id="up-quiz">🎓 ${quizRec ? '再测一次' : '去单元小测'}</button>
          `);
          panel.insertBefore(pass, panel.querySelector('.result-actions'));
          pass.querySelector('#up-quiz').onclick = () => {
            if (window.Speech) Speech.stop();
            App.navigate('quiz/' + unitKey);
          };
          if (firstPass && window.Speech) {
            Speech.autoSpeak(() => `太厉害了！${Speech.toSpeakText(meta.unit.title)} 这个单元全部通关，获得单元通行证！`);
          }
        } else if (window.Speech) {
          Speech.autoSpeak(() => `恭喜通关！${Speech.toSpeakText(msg)}，获得 ${stars} 颗星星。`);
        }

        panel.querySelector('#rs-next').onclick = () => next();
        panel.querySelector('#rs-again').onclick = () => {
          this.play(L.id, document.getElementById('page'), { forceFull: true });
        };
        const nextBtn = panel.querySelector('#rs-next-lesson');
        if (nextBtn) nextBtn.onclick = () => App.navigate('lesson/' + nextBtn.dataset.nextId);
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
