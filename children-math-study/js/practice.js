/* ===== 练习中心：每日口算 / 听算模式 / 单元综合小测 / 错题组卷 =====
   - 口算题按年级动态生成，不写死在内容里，可无限练
   - 全部复用 Game.mount，因此自动继承语音播报、提示阶梯与键盘作答
   - 每日口算 / 单元小测使用 transient 模式，不污染错题本
*/
(function () {

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = arr => arr[rnd(0, arr.length - 1)];
  const pickN = (arr, n) => arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
  const fmt = x => String(Number(Number(x).toFixed(2)));
  const esc = s => (window.UI ? UI.esc(s) : String(s == null ? '' : s));

  function calc(prompt, ans, hint) {
    return { prompt, ans, hint };
  }

  /* ---------- 按年级的口算题生成器 ---------- */
  const BUILDERS = {
    1: [
      () => { const a = rnd(1, 9), b = rnd(1, 10 - a); return calc(`${a} + ${b} = ⬜`, a + b, `从 ${a} 开始往后数 ${b} 个`); },
      () => { const a = rnd(3, 10), b = rnd(1, a); return calc(`${a} - ${b} = ⬜`, a - b, `从 ${a} 往回数 ${b} 个`); },
      () => { const a = rnd(2, 9); return calc(`凑十：${a} + ⬜ = 10`, 10 - a, `想一想，${a} 再添上几就是 10`); },
      () => { const a = rnd(5, 9), b = rnd(2, 9); return calc(`${a} + ${b} = ⬜`, a + b, `先把 ${a} 凑成 10，再加剩下的`); },
      () => { const a = rnd(11, 18), b = rnd(2, 9); return calc(`${a} - ${b} = ⬜`, a - b, `可以先减到 10，再减剩下的`); }
    ],
    2: [
      () => { const a = rnd(2, 9), b = rnd(2, 9); return calc(`${a} × ${b} = ⬜`, a * b, `用乘法口诀：${a} 的 ${b} 倍`); },
      () => { const a = rnd(2, 9), b = rnd(2, 9); return calc(`${a * b} ÷ ${a} = ⬜`, b, `想：${a} 乘几等于 ${a * b}`); },
      () => { const a = rnd(2, 9) * 100, b = rnd(1, 8) * 100; return calc(`${a} + ${b} = ⬜`, a + b, `整百数相加，先算百位`); },
      () => { const a = rnd(3, 9) * 100, b = rnd(1, a / 100) * 100; return calc(`${a} - ${b} = ⬜`, a - b, `整百数相减，先算百位`); },
      () => { const a = rnd(2, 9), b = rnd(2, 9); return calc(`${a} × ${b} + 1 = ⬜`, a * b + 1, `先算乘法 ${a} × ${b}，再加 1`); }
    ],
    3: [
      () => { const a = rnd(11, 49), b = rnd(2, 9); return calc(`${a} × ${b} = ⬜`, a * b, `把 ${a} 拆成整十和个位，分别乘 ${b} 再相加`); },
      () => { const b = rnd(2, 9), q = rnd(11, 49); return calc(`${b * q} ÷ ${b} = ⬜`, q, `想：${b} 乘几等于 ${b * q}`); },
      () => { const a = rnd(120, 480), b = rnd(110, 390); return calc(`${a} + ${b} = ⬜`, a + b, `相同数位对齐，从个位加起`); },
      () => { const ai = rnd(11, 89), bi = rnd(11, 89); return calc(`${fmt(ai / 10)} + ${fmt(bi / 10)} = ⬜`, (ai + bi) / 10, `小数点对齐，先按整数加，再点小数点`); },
      () => { const ai = rnd(31, 99), bi = rnd(11, 30); return calc(`${fmt(ai / 10)} - ${fmt(bi / 10)} = ⬜`, (ai - bi) / 10, `小数点对齐，从十分位减起`); }
    ],
    4: [
      () => { const a = rnd(2, 9), b = rnd(11, 40); return calc(`${a} × ${b} = ⬜`, a * b, `把 ${b} 拆成整十和个位，分别相乘再相加`); },
      () => { const a = pick([25, 125, 50]), b = a === 125 ? 8 : (a === 25 ? 4 : 2); return calc(`巧算：${a} × ${b} = ⬜`, a * b, `${a} × ${b} 是一对好朋友，记住它就能秒算`); },
      () => { const a = rnd(2, 9) * 1000, b = rnd(1, 8) * 1000; return calc(`${a} + ${b} = ⬜`, a + b, `都是整千数，先算千位`); },
      () => { const ai = rnd(11, 89), bi = rnd(11, 89); return calc(`${fmt(ai / 10)} + ${fmt(bi / 10)} = ⬜`, (ai + bi) / 10, `小数加法要对齐小数点`); },
      () => { const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9); return calc(`巧算：${a} × ${b} + ${a} × ${c} = ⬜`, a * (b + c), `用乘法分配律：${a} × (${b} + ${c})`); }
    ],
    5: [
      () => { const ai = rnd(11, 49), b = rnd(2, 9); return calc(`${fmt(ai / 10)} × ${b} = ⬜`, ai * b / 10, `先按整数算 ${ai} × ${b}，再点一位小数`); },
      () => { const b = rnd(2, 5), q = rnd(2, 9); return calc(`${fmt(b * q / 10)} ÷ ${b} = ⬜`, q / 10, `把被除数看成 ${b * q} 个十分之一来分`); },
      () => { const d = rnd(5, 12), a = rnd(1, d - 1), b = rnd(1, d - a); return calc(`${a}/${d} + ${b}/${d} 的分子是几？`, a + b, `分母相同，分子直接相加：${a} + ${b}`); },
      () => { const x = rnd(2, 9), b = rnd(2, 9), a = rnd(2, 9); return calc(`${a} × x = ${a * x}，x 是几？`, x, `两边同时除以 ${a}`); },
      () => {
        const n = pick([12, 18, 24, 36]);
        const factors = [2, 3, 4, 6, 8, 9, 12, 18].filter(x => n % x === 0 && x !== n);
        const f = pick(factors);
        const nonFactors = [5, 7, 8, 9, 10, 11, 14, 15, 16, 20].filter(x => n % x !== 0 && x !== f);
        const c = calc(`下面哪个数是 ${n} 的因数？`, f, `看 ${n} 能不能被它整除`);
        // 判断类题必须自备干扰项，避免随机干扰项里又出现一个真因数
        c.choices = [String(f), ...pickN(nonFactors, 3).map(String)].sort(() => Math.random() - 0.5);
        return c;
      }
    ]
  };

  // 听算只从「计算题」里出；静态缓存一次，避免每次出题都把所有 builder 白跑一遍
  const AURAL_POOLS = {};
  Object.keys(BUILDERS).forEach(g => {
    const pool = BUILDERS[g].filter(fn => !fn().choices);
    AURAL_POOLS[g] = pool.length ? pool : BUILDERS[g].slice();
  });

  // 因数判断题需要给出选项，其余按算式读题
  function needsOptions(prompt) { return /下面哪个数/.test(prompt); }

  function makeChoices(ans, count) {
    const num = Number(ans);
    const out = [String(ans)];
    const deltas = [1, -1, 2, -2, 3, -3, 5, -5, 10, -10, 4, -4, 6, 9, 0.5, -0.5];
    let guard = 0;
    while (out.length < count && guard++ < 120) {
      const v = Number((num + pick(deltas)).toFixed(2));
      if (v < 0 || !Number.isFinite(v)) continue;
      const s = fmt(v);
      if (!out.includes(s)) out.push(s);
    }
    // 兜底也必须去重：用一个远离干扰项区间的递增值，保证 4 个选项互不重复
    let extra = 1000;
    while (out.length < count) {
      const s = fmt(Math.max(0, num + extra++));
      if (!out.includes(s)) out.push(s);
    }
    return out.sort(() => Math.random() - 0.5);
  }

  function buildQuestion(grade, aural, idx) {
    const g = Math.max(1, Math.min(5, Number(grade) || 1));
    // 判断/选择类题没有唯一可输入的答案，听算模式只从计算题里出
    const p = aural ? pick(AURAL_POOLS[g])() : pick(BUILDERS[g])();
    const answer = fmt(p.ans);
    // 听算一律用输入题：只听不看，练的是心算
    const type = aural ? 'input' : (needsOptions(p.prompt) || Math.random() < 0.55 ? 'choice' : 'input');
    const q = {
      id: 'p' + idx,
      type,
      prompt: p.prompt,
      answer,
      hints: [p.hint, `再检查一遍运算符号和进位，正确答案是 ${answer}。`],
      aural: !!aural
    };
    if (type === 'choice') q.options = p.choices || makeChoices(answer, 4);
    return q;
  }

  /* ---------- 通用结算卡 ---------- */
  function renderResult(container, cfg) {
    container.innerHTML = '';
    const card = el('div', 'card practice-result');
    card.innerHTML = `
      <div class="pr-emoji">${cfg.emoji || '🎉'}</div>
      <h2>${esc(cfg.title)}</h2>
      <div class="pr-score">${esc(cfg.score || '')}</div>
      <p class="pr-msg">${esc(cfg.message || '')}</p>
      <div class="pr-metrics">
        ${(cfg.metrics || []).map(m => `<div class="pr-metric"><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`).join('')}
      </div>
      <div class="result-actions"></div>
    `;
    container.appendChild(card);
    const acts = card.querySelector('.result-actions');
    (cfg.actions || []).forEach(a => {
      const b = el('button', a.primary ? 'btn-big' : 'btn-secondary', a.label);
      b.onclick = a.onClick;
      acts.appendChild(b);
    });
    if (window.Speech) Speech.autoSpeak(() => cfg.speech || cfg.title);
  }

  function finishGame(startedAt) {
    return { seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)) };
  }

  /* ---------- 每日口算 ---------- */
  const Practice = {
    renderDaily(container) {
      container.innerHTML = '';
      const wrap = el('div', 'practice-wrap');
      const lastG = (Save.data.settings || {}).lastGrade;
      let grade = (Data.grade(lastG) ? lastG : 1);
      let count = 10;
      let mode = 'normal';
      // 实时取值：顶栏 / 家长视图随时可能开关语音，不能用一次性快照
      const auralReady = () => !!(window.Speech && Speech.supported && Speech.canAural && Speech.canAural());
      const voiceOK = auralReady();

      const setup = el('div', 'card practice-setup');
      setup.innerHTML = `
        <h2>🎯 每日口算挑战</h2>
        <p class="practice-lead">每天练一小会儿，算得又快又准！题目按年级自动生成，做错也有提示。</p>
        <div class="opt-row"><span class="opt-label">选择年级</span><div class="opt-btns" id="pd-grade"></div></div>
        <div class="opt-row"><span class="opt-label">题目数量</span><div class="opt-btns" id="pd-count"></div></div>
        <div class="opt-row"><span class="opt-label">练习方式</span><div class="opt-btns" id="pd-mode"></div></div>
        <p class="practice-note ${voiceOK ? 'hidden' : ''}" id="pd-voice-note">
          ⚠️ 听算需要先开启语音朗读（顶栏 🔊 或家长视图）。当前已为你切换为普通模式。
        </p>
        <div class="practice-start"><button class="btn-big" id="pd-start">开始挑战 ➜</button></div>
      `;
      wrap.appendChild(setup);
      wrap.appendChild(el('div', 'practice-stage'));
      container.appendChild(wrap);

      const gradeBox = setup.querySelector('#pd-grade');
      Data.grades.forEach(g => {
        const b = el('button', 'opt-btn', `${g.emoji} ${g.title.replace('年级', '')}年级`);
        b.dataset.value = g.grade;
        b.onclick = () => { grade = g.grade; sync(); };
        gradeBox.appendChild(b);
      });
      const countBox = setup.querySelector('#pd-count');
      [5, 10, 20].forEach(n => {
        const b = el('button', 'opt-btn', `${n} 题`);
        b.dataset.value = n;
        b.onclick = () => { count = n; sync(); };
        countBox.appendChild(b);
      });
      const modeBox = setup.querySelector('#pd-mode');
      [['normal', '👀 看题算'], ['aural', '🎧 听算模式']].forEach(([v, label]) => {
        const b = el('button', 'opt-btn', label);
        b.dataset.value = v;
        b.onclick = () => {
          if (v === 'aural' && !auralReady()) {
            UI.toast('听算需要可用的系统语音，请先开启语音朗读～', '#f87171');
            return;
          }
          mode = v; sync();
        };
        modeBox.appendChild(b);
      });

      const sync = () => {
        gradeBox.querySelectorAll('.opt-btn').forEach(b => b.classList.toggle('active', +b.dataset.value === +grade));
        countBox.querySelectorAll('.opt-btn').forEach(b => b.classList.toggle('active', +b.dataset.value === +count));
        modeBox.querySelectorAll('.opt-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.value === mode);
          if (b.dataset.value === 'aural') b.classList.toggle('disabled', !auralReady());
        });
        const note = setup.querySelector('#pd-voice-note');
        if (note) note.classList.toggle('hidden', auralReady());
      };
      sync();

      const start = () => {
        if (mode === 'aural' && !auralReady()) {
          UI.toast('听算需要可用的系统语音，已为你改为看题模式', '#f87171');
          mode = 'normal'; sync();
        }
        const aural = mode === 'aural';
        const questions = [];
        for (let i = 0; i < count; i++) questions.push(buildQuestion(grade, aural, i));
        const startedAt = Date.now();
        setup.classList.add('hidden');
        const stage = wrap.querySelector('.practice-stage');
        stage.innerHTML = '';
        Game.mount(stage, {
          icon: aural ? '🎧' : '🎯',
          title: aural ? '听算挑战（只听题）' : `每日口算 · ${Data.grade(grade).title}`,
          lessonId: '__practice_daily__',
          transient: true,
          questions
        }, {
          onQuestionDone() {},
          onFinish(stats) {
            const extra = finishGame(startedAt);
            Save.recordPractice(aural ? 'aural' : 'daily', extra);
            const right = stats.total - stats.wrong;
            const rate = stats.total ? Math.round(right / stats.total * 100) : 100;
            renderResult(wrap, {
              emoji: rate >= 90 ? '🏆' : (rate >= 60 ? '🎉' : '💪'),
              title: aural ? '听算挑战完成！' : '每日口算完成！',
              score: `${right} / ${stats.total} 题`,
              message: rate >= 90 ? '算得又快又准，太厉害啦！' : '每天练一点，明天会更棒～',
              metrics: [
                { value: `${rate}%`, label: '正确率' },
                { value: `${extra.seconds}s`, label: '用时' },
                { value: `${Save.streak()} 天`, label: '连续打卡' },
                { value: `${count}`, label: '本次题量' }
              ],
              actions: [
                { label: '🔁 再来一组', primary: true, onClick: () => Practice.renderDaily(container) },
                { label: '📊 成长报告', onClick: () => App.navigate('parent') },
                { label: '🏠 回到首页', onClick: () => App.navigate('home') }
              ],
              speech: `练习完成！答对 ${right} 题，共 ${stats.total} 题，正确率 ${rate}%，连续打卡 ${Save.streak()} 天。`
            });
          }
        });
      };
      setup.querySelector('#pd-start').onclick = start;
    },

    /* ---------- 单元综合小测 ---------- */
    renderUnitQuiz(container, unitKey) {
      container.innerHTML = '';
      const wrap = el('div', 'practice-wrap');
      container.appendChild(wrap);
      const meta = Data.unitMeta(unitKey);
      const up = Data.unitProgress(unitKey);
      if (!meta || !up) { App.navigate('home'); return; }

      const entries = Data.unitEntries(unitKey);
      const rec = (Save.data.unitQuiz || {})[unitKey];
      const intro = el('div', 'card practice-setup');
      if (!up.allDone) {
        const todo = entries.filter(e => !Data.completed(e.lesson.id)).map(e => e.lesson.title);
        intro.innerHTML = `
          <div class="pr-emoji">🔒</div>
          <h2>单元小测还没解锁</h2>
          <p class="practice-lead">先完成「${esc(meta.unit.title)}」的全部课程，再来检验学习成果吧！</p>
          <div class="quiz-list">${todo.map(t => `<span>📘 ${esc(t)}</span>`).join('')}</div>
          <div class="practice-start"><button class="btn-big" id="qu-back">返回地图 🗺️</button></div>
        `;
        wrap.appendChild(intro);
        intro.querySelector('#qu-back').onclick = () => App.navigate('grade/' + meta.grade.grade);
        return;
      }

      const recStars = Math.max(0, Math.min(3, Math.trunc(Number(rec && rec.stars) || 0)));
      const recLine = rec
        ? `<p class="practice-note">🏅 上次成绩：答对 ${Number(rec.correct) || 0}/${Number(rec.total) || 0} 题 · ${'⭐'.repeat(recStars)}（${esc(rec.at)}）</p>`
        : '';
      intro.innerHTML = `
        <h2>🎓 单元综合小测 · ${esc(meta.unit.title)}</h2>
        <p class="practice-lead">${esc(meta.semester.title)} · 从本单元 ${entries.length} 课中抽题组卷，检验一下掌握程度。</p>
        <div class="quiz-list">${entries.map(e =>
          `<span>${Data.completed(e.lesson.id) ? '✅' : '📘'} ${esc(e.lesson.title)}</span>`).join('')}</div>
        ${recLine}
        <div class="practice-start"><button class="btn-big" id="qu-start">${rec ? '🔁 再测一次' : '开始小测 ➜'}</button></div>
      `;
      wrap.appendChild(intro);
      wrap.appendChild(el('div', 'practice-stage'));

      intro.querySelector('#qu-start').onclick = () => {
        // 单课单元也要凑够一套卷：按课程数自适应每课抽题量
        const per = Math.max(2, Math.ceil(8 / Math.max(1, entries.length)));
        const questions = Data.unitQuestions(unitKey, per, 10);
        if (!questions.length) { UI.toast('这个单元暂时没有可测的题目'); return; }
        const startedAt = Date.now();
        intro.classList.add('hidden');
        const stage = wrap.querySelector('.practice-stage');
        Game.mount(stage, {
          icon: '🎓', title: `单元小测 · ${meta.unit.title}`,
          lessonId: '__practice_quiz__', transient: true, questions
        }, {
          onQuestionDone() {},
          onFinish(stats) {
            const extra = finishGame(startedAt);
            const right = stats.total - stats.wrong;
            const stars = stats.wrong === 0 ? 3 : (stats.wrong <= 3 ? 2 : 1);
            Save.saveUnitQuiz(unitKey, { stars, correct: right, total: stats.total, seconds: extra.seconds });
            Save.recordPractice('quiz', extra);
            renderResult(wrap, {
              emoji: stars === 3 ? '🏆' : '🎓',
              title: `单元小测完成 · ${'⭐'.repeat(stars)}`,
              score: `${right} / ${stats.total} 题`,
              message: stars === 3 ? '满分通过！这个单元你真的学会了～' : '把错题再练一遍，就能拿满星啦',
              metrics: [
                { value: `${stars}/3`, label: '小测星级' },
                { value: `${extra.seconds}s`, label: '用时' },
                { value: `${entries.length}`, label: '覆盖课程' },
                { value: `${Save.streak()} 天`, label: '连续打卡' }
              ],
              actions: [
                { label: '🔁 再测一次', primary: true, onClick: () => Practice.renderUnitQuiz(container, unitKey) },
                { label: '🗺️ 返回地图', onClick: () => App.navigate('grade/' + meta.grade.grade) },
                { label: '🏠 回到首页', onClick: () => App.navigate('home') }
              ],
              speech: `单元小测完成！答对 ${right} 题，共 ${stats.total} 题，获得 ${stars} 颗星。`
            });
          }
        });
      };
    },

    /* ---------- 错题一键组卷 ---------- */
    renderWrongDrill(container) {
      container.innerHTML = '';
      const wrap = el('div', 'practice-wrap');
      container.appendChild(wrap);
      const wrongs = (Save.data.wrongBook || []).slice();
      const before = wrongs.length;
      if (!wrongs.length) {
        wrap.appendChild(el('div', 'card empty-state', '🎉 错题本空空的，先去闯关吧！'));
        return;
      }

      const questions = [];
      wrongs.slice(0, 10).forEach(w => {
        const fresh = Data.findQuestion(w.lessonId, w.qid);
        const q = fresh || {
          id: w.qid,
          type: w.type || (Array.isArray(w.options) && w.options.length ? 'choice' : 'input'),
          prompt: w.prompt || '', answer: w.answer,
          options: w.options || null, template: w.template || null,
          items: w.items || null, bank: w.bank || null,
          hints: w.hints || [],
          visual: w.visual ? { emoji: w.visual } : null
        };
        if (q.type === 'sequence' && !Array.isArray(q.items)) return;
        const safe = Object.assign({}, q, { lessonId: w.lessonId });
        // 旧存档里缺答案的脏题直接跳过，避免组卷出现无法作答的题
        if (window.Game && Game._normalizeQuestion && !Game._normalizeQuestion(safe)) return;
        questions.push(safe);
      });
      if (!questions.length) {
        wrap.appendChild(el('div', 'card empty-state', '这些老错题建议回到课程里重做哦～'));
        return;
      }

      const intro = el('div', 'card practice-setup');
      intro.innerHTML = `
        <h2>📝 错题组卷复习</h2>
        <p class="practice-lead">从错题本抽 ${questions.length} 道题组成一套卷。答对两次的错题会自动飞走～</p>
        <div class="practice-start"><button class="btn-big" id="wd-start">开始复习 ➜</button></div>
      `;
      wrap.appendChild(intro);
      wrap.appendChild(el('div', 'practice-stage'));
      intro.querySelector('#wd-start').onclick = () => {
        const startedAt = Date.now();
        intro.classList.add('hidden');
        const stage = wrap.querySelector('.practice-stage');
        Game.mount(stage, {
          icon: '📝', title: '错题组卷', lessonId: '__wrong_drill__', questions
        }, {
          onQuestionDone() {},
          onFinish(stats) {
            const extra = finishGame(startedAt);
            Save.recordPractice('wrong', extra);
            const moved = Math.max(0, before - (Save.data.wrongBook || []).length);
            renderResult(wrap, {
              emoji: moved ? '🎉' : '💪',
              title: '错题复习完成！',
              score: `${stats.total - stats.wrong} / ${stats.total} 题`,
              message: moved ? `有 ${moved} 道错题连对两次，飞走啦！` : '继续加油，答对两次错题就会飞走～',
              metrics: [
                { value: `${moved}`, label: '移出错题' },
                { value: `${(Save.data.wrongBook || []).length}`, label: '剩余错题' },
                { value: `${extra.seconds}s`, label: '用时' },
                { value: `${Save.streak()} 天`, label: '连续打卡' }
              ],
              actions: [
                { label: '📕 回到错题本', primary: true, onClick: () => App.navigate('wrong') },
                { label: '🎯 每日口算', onClick: () => App.navigate('daily') },
                { label: '🏠 回到首页', onClick: () => App.navigate('home') }
              ],
              speech: `错题复习完成！答对 ${stats.total - stats.wrong} 题，有 ${moved} 道错题飞走了。`
            });
          }
        });
      };
    },

    // 供离线自检脚本使用
    _buildQuestion: buildQuestion,
    _makeChoices: makeChoices
  };

  window.Practice = Practice;
})();
