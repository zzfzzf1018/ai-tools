/* ===== 错题同类题自动变形再练 =====
   两条生成路径：
   1) 题干含标准算式时，保留原有措辞、只替换数字并重算答案（同结构变形）
   2) 情景题/概念题按「课程知识点 + 年级」映射到同结构生成器，换一组数值再练
   变式题全部复用 Game.mount，因此自动继承语音播报、提示阶梯与键盘作答。
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

  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }
  function calc(a, op, b) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? 0 : a / b;
    return 0;
  }

  /* ---------- 1. 同结构变形：保留题干措辞，只换数字 ---------- */
  // 情景题没有标准算式，改为「反推原题数字与答案之间的唯一算术关系」：
  // 找到唯一公式后，换一组数字用同一公式重算，答案必然正确；有歧义就放弃，交给知识点池。
  const FORMULAS_1 = [
    { k: 'n-1', f: n => n - 1, gen: () => [rnd(3, 20)] },
    { k: 'n+1', f: n => n + 1, gen: () => [rnd(1, 20)] },
    { k: 'n*2', f: n => n * 2, gen: () => [rnd(2, 15)] },
    { k: 'n/2', f: n => n / 2, gen: () => [rnd(2, 9) * 2] }
  ];
  const FORMULAS_2 = [
    { k: 'a+b', f: (a, b) => a + b, gen: () => [rnd(2, 20), rnd(1, 15)] },
    { k: 'a-b', f: (a, b) => a - b, gen: () => { const a = rnd(4, 20), b = rnd(1, a - 1); return [a, b]; } },
    { k: 'b-a', f: (a, b) => b - a, gen: () => { const a = rnd(1, 9), b = rnd(a + 1, a + 12); return [a, b]; } },
    { k: 'a*b', f: (a, b) => a * b, gen: () => [rnd(2, 9), rnd(2, 9)] },
    { k: 'a/b', f: (a, b) => a / b, gen: () => { const b = rnd(2, 9), c = rnd(2, 9); return [b * c, b]; } },
    { k: 'b/a', f: (a, b) => b / a, gen: () => { const a = rnd(2, 9), c = rnd(2, 9); return [a, a * c]; } },
    { k: 'a+b+1', f: (a, b) => a + b + 1, gen: () => [rnd(1, 9), rnd(1, 9)] },
    { k: 'b-a+1', f: (a, b) => b - a + 1, gen: () => { const a = rnd(1, 9), b = rnd(a + 1, a + 9); return [a, b]; } }
  ];

  function deriveNumeric(q) {
    const p = String((q && q.prompt) || '');
    const ansRaw = q && q.answer;
    if (!p || !/^\d+(?:\.\d+)?$/.test(String(ansRaw == null ? '' : ansRaw))) return null;
    const answer = Number(ansRaw);
    const re = /\d+(?:\.\d+)?/g;
    const nums = [];
    let m;
    while ((m = re.exec(p))) {
      nums.push({ raw: m[0], val: Number(m[0]), start: m.index, end: m.index + m[0].length });
    }
    if (nums.length < 1 || nums.length > 3) return null;

    const hits = [];
    if (nums.length === 1) {
      FORMULAS_1.forEach(f => { if (f.f(nums[0].val) === answer) hits.push({ f, idx: [0] }); });
    } else {
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          FORMULAS_2.forEach(f => {
            if (f.f(nums[i].val, nums[j].val) === answer) hits.push({ f, idx: [i, j] });
          });
        }
      }
    }
    if (hits.length !== 1) return null;   // 歧义公式一律不变形，避免生成错题
    const hit = hits[0];

    let newVals = null, newAnswer = null;
    for (let t = 0; t < 30; t++) {
      const cand = hit.f.gen();
      const res = cand.length === 1 ? hit.f.f(cand[0]) : hit.f.f(cand[0], cand[1]);
      if (Number.isFinite(res) && Number.isInteger(res) && res > 0 &&
          cand.every(v => Number.isInteger(v) && v > 0)) {
        newVals = cand; newAnswer = res; break;
      }
    }
    if (!newVals) return null;

    // 按原位置倒序替换，避免字符串偏移
    let newPrompt = p;
    const edits = hit.idx.map((ni, k) => ({
      start: nums[ni].start, end: nums[ni].end, text: String(newVals[k])
    })).sort((a, b) => b.start - a.start);
    edits.forEach(e => { newPrompt = newPrompt.slice(0, e.start) + e.text + newPrompt.slice(e.end); });
    if (newPrompt === p) return null;
    return {
      prompt: newPrompt, answer: fmt(newAnswer),
      hint: '照着原来的方法再算一遍：先看清数字之间的关系',
      _formula: hit.f.k, _nums: newVals
    };
  }

  function deriveFromQuestion(q) {
    const p = String((q && q.prompt) || '');
    if (!p) return null;
    const NUM = '(\\d+(?:\\.\\d+)?)';
    const OP = '([+\\-×÷])';
    const BOX = '(?:⬜|□|\\?|？)';

    // 模式 A：A op B = ⬜（求结果）
    let m = p.match(new RegExp(NUM + '\\s*' + OP + '\\s*' + NUM + '\\s*=\\s*' + BOX));
    if (m) {
      const op = m[2];
      let a, b, ans;
      if (op === '+') { a = rnd(2, 18); b = rnd(2, Math.max(2, 20 - a)); ans = a + b; }
      else if (op === '-') { a = rnd(5, 20); b = rnd(1, a); ans = a - b; }
      else if (op === '×') { a = rnd(2, 9); b = rnd(2, 9); ans = a * b; }
      else { b = rnd(2, 9); ans = rnd(2, 9); a = b * ans; }
      const expr = `${a} ${op} ${b} = ⬜`;
      return {
        prompt: p.replace(m[0], expr), answer: fmt(ans),
        hint: `先看清是「${op}」，再把 ${a} 和 ${b} 算一遍`
      };
    }

    // 模式 B：A op ⬜ = C（求第二个运算数）
    m = p.match(new RegExp(NUM + '\\s*' + OP + '\\s*' + BOX + '\\s*=\\s*' + NUM));
    if (m) {
      const op = m[2];
      let a, x, c;
      if (op === '+') { a = rnd(2, 9); x = rnd(1, 10 - a); c = a + x; }
      else if (op === '-') { x = rnd(1, 9); a = rnd(x + 1, x + 12); c = a - x; }
      else if (op === '×') { a = rnd(2, 9); x = rnd(2, 9); c = a * x; }
      else { x = rnd(2, 9); c = rnd(2, 9); a = x * c; }
      const expr = `${a} ${op} ⬜ = ${c}`;
      return {
        prompt: p.replace(m[0], expr), answer: fmt(x),
        hint: `想一想：${a} ${op} 几 会得到 ${c}？`
      };
    }

    // 模式 C：⬜ op B = C（求第一个运算数）
    m = p.match(new RegExp(BOX + '\\s*' + OP + '\\s*' + NUM + '\\s*=\\s*' + NUM));
    if (m) {
      const op = m[1], b = Number(m[2]);
      let x, c;
      if (op === '+') { x = rnd(1, 12); c = x + b; }
      else if (op === '-') { c = rnd(1, 12); x = c + b; }
      else if (op === '×') { x = rnd(2, 9); c = x * b; }
      else { c = rnd(2, 9); x = c * b; }
      const expr = `⬜ ${op} ${b} = ${c}`;
      return {
        prompt: p.replace(m[0], expr), answer: fmt(x),
        hint: `倒过来想：几 ${op} ${b} 会等于 ${c}？`
      };
    }

    // 情景题：反推唯一算术关系后换数字
    return deriveNumeric(q);
  }

  /* ---------- 2. 知识点 → 同结构生成器 ---------- */
  const GENERATORS = {
    add: () => { const a = rnd(2, 9), b = rnd(2, 9); return { prompt: `算一算：${a} + ${b} = ⬜`, answer: a + b, hint: `从 ${a} 开始往后数 ${b} 个` }; },
    sub: () => { const a = rnd(5, 20), b = rnd(1, a); return { prompt: `算一算：${a} - ${b} = ⬜`, answer: a - b, hint: `从 ${a} 往回数 ${b} 个` }; },
    missingAdd: () => { const a = rnd(2, 9); return { prompt: `凑十：${a} + ⬜ = 10`, answer: 10 - a, hint: `想一想，${a} 再添上几就是 10` }; },
    mul: () => { const a = rnd(2, 9), b = rnd(2, 9); return { prompt: `算一算：${a} × ${b} = ⬜`, answer: a * b, hint: `用乘法口诀：${a} 的 ${b} 倍` }; },
    div: () => { const a = rnd(2, 9), b = rnd(2, 9); return { prompt: `算一算：${a * b} ÷ ${a} = ⬜`, answer: b, hint: `想：${a} 乘几等于 ${a * b}` }; },
    mixed: () => { const a = rnd(2, 9), b = rnd(2, 9), c = rnd(1, 9); return { prompt: `先乘后加：${a} × ${b} + ${c} = ⬜`, answer: a * b + c, hint: `先算 ${a} × ${b}，再加 ${c}` }; },
    group: () => { const per = rnd(2, 6), groups = rnd(2, 5); return { prompt: `${groups} 个盘子，每盘放 ${per} 个，一共几个？`, answer: per * groups, hint: `几个几相加，可以用乘法：${per} × ${groups}` }; },
    count: () => { const n = rnd(3, 9), add = rnd(1, 4); return { prompt: `篮子里有 ${n} 个苹果，又放进 ${add} 个，一共有几个？`, answer: n + add, hint: `从 ${n} 往后数 ${add} 个` }; },
    decimalAdd: () => { const ai = rnd(11, 89), bi = rnd(11, 89); return { prompt: `${fmt(ai / 10)} + ${fmt(bi / 10)} = ⬜`, answer: (ai + bi) / 10, hint: '小数点对齐，先按整数加，再点小数点' }; },
    decimalSub: () => { const ai = rnd(31, 99), bi = rnd(11, 30); return { prompt: `${fmt(ai / 10)} - ${fmt(bi / 10)} = ⬜`, answer: (ai - bi) / 10, hint: '小数点对齐，从十分位减起' }; },
    decimalMul: () => { const ai = rnd(11, 49), b = rnd(2, 9); return { prompt: `${fmt(ai / 10)} × ${b} = ⬜`, answer: ai * b / 10, hint: `先按整数算 ${ai} × ${b}，再点一位小数` }; },
    fraction: () => { const d = rnd(5, 12), a = rnd(1, d - 1), b = rnd(1, d - a); return { prompt: `${a}/${d} + ${b}/${d} 的分子是几？`, answer: a + b, hint: `分母相同，分子直接相加：${a} + ${b}` }; },
    equation: () => { const a = rnd(2, 9), x = rnd(2, 9); return { prompt: `${a} × x = ${a * x}，x 是几？`, answer: x, hint: `两边同时除以 ${a}` }; },
    factor: () => {
      const n = pick([12, 18, 24, 36]);
      const factors = [2, 3, 4, 6, 8, 9, 12, 18].filter(x => n % x === 0 && x !== n);
      const f = pick(factors);
      const non = [5, 7, 8, 9, 10, 11, 14, 15, 16, 20].filter(x => n % x !== 0 && x !== f);
      return {
        prompt: `下面哪个数是 ${n} 的因数？`, answer: f, type: 'choice',
        choices: shuffle([String(f), ...pickN(non, 3).map(String)]),
        hint: `看 ${n} 能不能被它整除`
      };
    },
    compare: () => {
      const a = rnd(3, 40), hi = a + 5, ans = rnd(a + 1, hi - 1);
      return {
        prompt: `比 ${a} 大、比 ${hi} 小的数是哪个？`, answer: ans, type: 'choice',
        choices: shuffle([String(ans), String(a - 2), String(a - 1), String(hi + 1)]),
        hint: `在数轴上找 ${a} 和 ${hi} 中间的数`
      };
    }
  };

  function conceptsToKinds(text, grade) {
    const c = String(text || '');
    const kinds = [];
    if (/凑十|进位|20\s*以内|加法|减法|加减|加减小高手/.test(c)) kinds.push('add', 'sub', 'missingAdd', 'count');
    if (/乘法|口诀|倍|乘除/.test(c)) kinds.push('mul', 'mixed');
    if (/除法|平均分|分一分|竖式/.test(c)) kinds.push('div', 'group');
    if (/小数/.test(c)) kinds.push('decimalAdd', 'decimalSub', 'decimalMul');
    if (/分数/.test(c)) kinds.push('fraction');
    if (/因数|倍数/.test(c)) kinds.push('factor');
    if (/方程/.test(c)) kinds.push('equation');
    if (/比多少|比大小|比较|排序|顺序/.test(c)) kinds.push('compare');
    if (/数一数|数的认识|认识/.test(c)) kinds.push('count', 'add');
    if (!kinds.length) {
      const byGrade = {
        1: ['add', 'sub', 'count'], 2: ['mul', 'div', 'add'],
        3: ['mul', 'div', 'decimalAdd', 'mixed'],
        4: ['mul', 'decimalAdd', 'mixed', 'compare'],
        5: ['decimalMul', 'fraction', 'factor', 'equation']
      };
      kinds.push(...(byGrade[grade] || ['add', 'sub']));
    }
    return [...new Set(kinds)];
  }

  /* ---------- 3. 生成题目 ---------- */
  function toQuestion(g, idx, preferType) {
    const answer = fmt(g.answer);
    const type = g.type || (preferType === 'input' || preferType === 'dragdrop' || preferType === 'sequence'
      ? 'input' : (Math.random() < 0.55 ? 'choice' : 'input'));
    const q = {
      id: 'var' + idx,
      type,
      prompt: g.prompt,
      answer,
      hints: [g.hint, `再检查一遍运算符号和进位，正确答案是 ${answer}。`],
      _variant: true
    };
    if (type === 'choice') q.options = g.choices || Practice._makeChoices(answer, 4);
    return q;
  }

  function fallbackQuestion(w) {
    return {
      id: w.qid,
      type: w.type || (Array.isArray(w.options) && w.options.length ? 'choice' : 'input'),
      prompt: w.prompt || '', answer: w.answer,
      options: w.options || null, template: w.template || null,
      items: w.items || null, bank: w.bank || null, hints: w.hints || []
    };
  }

  function entryFor(w) {
    const hit = Data.findLesson(w.lessonId);
    const q0 = Data.findQuestion(w.lessonId, w.qid) || fallbackQuestion(w);
    const grade = hit ? hit.grade.grade : 1;
    const concept = hit ? (hit.lesson.concept || hit.lesson.title) : '综合练习';
    const label = hit ? `${hit.grade.title} · ${hit.lesson.title}` : '旧存档错题';
    return {
      w, q0, grade, concept, label,
      kinds: conceptsToKinds(`${concept} ${hit ? hit.lesson.title : ''} ${hit ? hit.unit.title : ''}`, grade)
    };
  }

  function buildSet(entries, perSource, limit) {
    const questions = [];
    for (const e of entries) {
      // 第一题优先用原题的同结构变形（换数字、保留措辞）
      const derived = deriveFromQuestion(e.q0);
      if (derived) questions.push(Object.assign(toQuestion(derived, questions.length, e.q0.type), { _structure: true }));
      for (let i = 0; i < perSource && questions.length < limit; i++) {
        questions.push(toQuestion(GENERATORS[pick(e.kinds)](), questions.length, e.q0.type));
      }
      if (questions.length >= limit) break;
    }
    return questions.slice(0, limit);
  }

  /* ---------- 4. 结算 ---------- */
  async function finish(container, stats, startedAt, entries, mode) {
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    await Save.recordVariant({ total: stats.total, correct: stats.total - stats.wrong });
    // 全部答对才算「知识点巩固」，给涉及的错题记一次连对
    let consolidated = 0;
    const perfect = stats.total > 0 && stats.wrong === 0;
    if (perfect) {
      for (const e of entries) {
        const done = await Save.consolidateWrong(e.w.lessonId, e.w.qid);
        if (done) consolidated++;
      }
    }
    Practice._renderResult(container, {
      emoji: perfect ? '🏆' : '🔁',
      title: perfect ? '同类题全对，知识点巩固啦！' : '变式训练完成！',
      score: `${stats.total - stats.wrong} / ${stats.total} 题`,
      message: perfect
        ? `给 ${consolidated} 道错题记了一次巩固，再去错题本重做一次就能让它们飞走～`
        : '错题换个数字再来一遍，多练几次就熟啦',
      metrics: [
        { value: `${stats.total ? Math.round((stats.total - stats.wrong) / stats.total * 100) : 100}%`, label: '正确率' },
        { value: `${seconds}s`, label: '用时' },
        { value: `${Save.data.stats.variantSessions}`, label: '累计变式训练' },
        { value: `${consolidated}`, label: '巩固错题' }
      ],
      actions: [
        { label: '🔁 再练一组', primary: true, onClick: () => (mode === 'all' ? Variants.render(container) : Variants.openForWrong(entries[0] && entries[0].w)) },
        { label: '📕 回错题本', onClick: () => App.navigate('wrong') },
        { label: '🏠 回到首页', onClick: () => App.navigate('home') }
      ],
      speech: `变式训练完成！答对 ${stats.total - stats.wrong} 题，共 ${stats.total} 题${perfect ? '，全部答对，知识点巩固啦' : '，继续加油'}。`
    });
  }

  /* ---------- 5. 页面与弹层 ---------- */
  const Variants = {
    forWrong(w, count) {
      const e = entryFor(w);
      return {
        title: `同类题变式 · ${e.concept}`, concept: e.concept,
        entries: [e], questions: buildSet([e], (count || 4) - 1, count || 4)
      };
    },

    forAll(wrongs, limit) {
      const byLesson = {};
      (wrongs || []).forEach(w => {
        (byLesson[w.lessonId] = byLesson[w.lessonId] || []).push(w);
      });
      const entries = Object.keys(byLesson).slice(0, 5).map(k => entryFor(byLesson[k][0]));
      return {
        title: '全部错题 · 同类题变式训练',
        concept: `${entries.length} 个知识点`,
        entries,
        questions: buildSet(entries, 2, limit || 10)
      };
    },

    /* 独立页：#/variants */
    render(container) {
      container.innerHTML = '';
      const wrap = el('div', 'practice-wrap');
      container.appendChild(wrap);
      const wrongs = (Save.data.wrongBook || []).slice();
      const set = this.forAll(wrongs, 10);
      if (!set.entries.length || !set.questions.length) {
        wrap.appendChild(el('div', 'card empty-state', '🎉 错题本空空的，先去闯关，再来练同类题吧！'));
        return;
      }
      const intro = el('div', 'card practice-setup');
      intro.innerHTML = `
        <h2>🔁 同类题自动变形再练</h2>
        <p class="practice-lead">从你的错题出发，保留原来的题目结构、换一组数字重新出题。
        会算这一道，就能算会一类题；全部答对还会给原错题记一次巩固。</p>
        <div class="quiz-list">${set.entries.map(e =>
          `<span>📌 ${esc(e.label)} · ${esc(e.concept)}</span>`).join('')}</div>
        <p class="practice-note">本组共 ${set.questions.length} 题，其中 ${set.questions.filter(q => q._structure).length} 道由原题直接变形而来。</p>
        <div class="practice-start"><button class="btn-big" id="vr-start">开始变式训练 ➜</button></div>
      `;
      wrap.appendChild(intro);
      wrap.appendChild(el('div', 'practice-stage'));
      intro.querySelector('#vr-start').onclick = () => {
        const startedAt = Date.now();
        intro.classList.add('hidden');
        Game.mount(wrap.querySelector('.practice-stage'), {
          icon: '🔁', title: '同类题变式训练', lessonId: '__variants__',
          transient: true, questions: set.questions
        }, {
          onQuestionDone() {},
          onFinish: stats => finish(wrap, stats, startedAt, set.entries, 'all')
        });
      };
    },

    /* 错题本单条：弹层里练 4 道 */
    openForWrong(w) {
      if (!w) return;
      const set = this.forWrong(w, 4);
      UI.overlay(`
        <div class="overlay-card wide">
          <div class="wp-head">
            <div class="sparkle-guide">🔁</div>
            <button class="btn-round" id="vr-close" title="关闭（Esc）">✖</button>
          </div>
          <div class="variant-intro">根据「${esc(set.concept)}」自动变形出 ${set.questions.length} 道同类题</div>
          <div id="vr-game" class="practice-game"></div>
        </div>`, () => {
        let closed = false;
        const onKey = e => { if (e.key === 'Escape') close(); };
        const close = () => {
          if (closed) return;
          closed = true;
          window.removeEventListener('keydown', onKey);
          if (window.Speech) Speech.stop();
          UI.closeOverlay();
        };
        document.getElementById('vr-close').onclick = close;
        window.addEventListener('keydown', onKey);
        const startedAt = Date.now();
        Game.mount(document.getElementById('vr-game'), {
          icon: '🔁', title: '同类题变式', lessonId: '__variants__',
          transient: true, questions: set.questions
        }, {
          onQuestionDone() {},
          onFinish: async stats => {
            close();
            const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
            await Save.recordVariant({ total: stats.total, correct: stats.total - stats.wrong });
            let moved = 0;
            if (stats.total > 0 && stats.wrong === 0) {
              const done = await Save.consolidateWrong(w.lessonId, w.qid);
              if (done) moved = 1;
            }
            UI.toast(stats.wrong === 0
              ? (moved ? '🏆 全对！错题已记一次巩固' : '🏆 同类题全对，太棒了！')
              : '练完啦，再看一眼错题本吧～', 'var(--secondary)');
            if (window.Speech) Speech.autoSpeak(() => `变式训练完成，答对 ${stats.total - stats.wrong} 题，共 ${stats.total} 题，用时 ${seconds} 秒`);
            Practice._grantBadgesSoon();
            App.navigate('wrong');
          }
        });
      });
    },

    // 供离线自检
    _deriveFromQuestion: deriveFromQuestion,
    _formulas: { one: FORMULAS_1, two: FORMULAS_2 },
    _conceptsToKinds: conceptsToKinds,
    _forWrong: w => Variants.forWrong(w, 4),
    _forAll: w => Variants.forAll(w, 10)
  };

  window.Variants = Variants;
})();
