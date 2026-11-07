/* ===== 闯关游戏引擎 =====
   题型：choice / input / dragdrop / sequence
   提示阶梯：hints 数组逐条展示，最后一条作为讲解兜底
   题目守卫：所有题目（含旧存档快照）先经 normalizeQuestion 收敛，保证可作答且不会被注入 HTML
*/
(function () {

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* 把异常题目收敛成「一定能作答」的安全题目。内置题目原样通过，只做转义。 */
  function normalizeQuestion(q) {
    if (!q || typeof q !== 'object') return null;
    const out = Object.assign({}, q);
    const rawAns = out.answer;
    if (rawAns == null) return null;
    const ansArr = Array.isArray(rawAns) ? rawAns : [rawAns];
    if (!ansArr.length || ansArr.some(a => a == null || String(a) === '')) return null;

    const eStr = v => esc(String(v));
    out.id = String(out.id || ('q' + Math.random().toString(36).slice(2)));
    out.prompt = typeof out.prompt === 'string' ? esc(out.prompt) : '请看题作答';
    out.hints = Array.isArray(out.hints)
      ? out.hints.filter(h => typeof h === 'string').map(esc) : [];
    out.visual = (out.visual && typeof out.visual === 'object')
      ? {
        emoji: typeof out.visual.emoji === 'string' ? esc(out.visual.emoji) : '',
        svg: typeof out.visual.svg === 'string' ? out.visual.svg : '' // 仅内置 SVG，可信
      } : null;
    if (out.lessonId != null) out.lessonId = String(out.lessonId);

    const ansText = ansArr.map(eStr);
    const fallbackChoice = () => {
      const correct = ansText.join('、');
      return { type: 'choice', options: [correct, '其他答案', '都不对'], answer: correct };
    };
    let type = ['choice', 'input', 'dragdrop', 'sequence'].includes(out.type) ? out.type : 'choice';

    if (type === 'choice') {
      const correct = ansText[0];
      const options = Array.isArray(out.options) ? out.options.map(o => eStr(o)) : [];
      if (!options.includes(correct)) options.push(correct);
      if (options.length < 2) options.push('其他答案');
      Object.assign(out, { type: 'choice', options, answer: correct });
    } else if (type === 'input') {
      if (!Number.isFinite(parseFloat(ansArr[0]))) Object.assign(out, fallbackChoice());
      else Object.assign(out, { type: 'input', answer: eStr(ansArr[0]) });
    } else if (type === 'sequence') {
      const items = Array.isArray(out.items) ? out.items.map(eStr) : [];
      if (!Array.isArray(rawAns) || !items.length || items.length !== ansArr.length) {
        Object.assign(out, fallbackChoice());
      } else {
        Object.assign(out, { type: 'sequence', items, answer: ansText });
      }
    } else { // dragdrop
      const tpl = typeof out.template === 'string' ? esc(out.template) : '';
      const holes = (tpl.match(/⬜/g) || []).length;
      const answers = Array.isArray(rawAns) ? ansText : String(rawAns).split('|').map(eStr);
      const bank = Array.isArray(out.bank) ? out.bank.map(eStr) : answers.slice();
      if (!holes || holes !== answers.length || bank.length < answers.length) {
        Object.assign(out, fallbackChoice());
      } else {
        Object.assign(out, { type: 'dragdrop', template: tpl, answer: answers, bank });
      }
    }
    return out;
  }

  const Game = {
    /**
     * mount(box, gameCfg, callbacks)
     * callbacks: { onQuestionDone(qid, correct), onFinish(stats) }
     * stats: { total, correct, wrong, perfect }
     * 返回 dispose()；同时挂在 box._gameDispose 供换页时统一释放。
     */
    mount(box, gameCfg, cb) {
      box.innerHTML = '';
      cb = cb || {};
      const panel = el('div', 'game-panel');
      const head = el('div', 'game-head');
      head.innerHTML = `<span style="font-size:32px">${esc(gameCfg.icon || '🎯')}</span><h3>${esc(gameCfg.title)}</h3>`;
      const prog = el('div', 'game-progress');
      const stage = el('div');
      panel.appendChild(head);
      panel.appendChild(prog);
      panel.appendChild(stage);
      box.appendChild(panel);

      // transient 练习（每日口算 / 单元小测）不写错题本，也不消耗错题连对次数
      const transient = !!gameCfg.transient;
      const qs = (gameCfg.questions || []).map(normalizeQuestion).filter(Boolean);
      if (!qs.length) {
        (cb.onFinish || function () {})({ total: 0, correct: 0, wrong: 0, perfect: true });
        return function () {};
      }
      qs.forEach(() => prog.appendChild(el('span')));
      const dots = [...prog.children];
      const stats = { total: qs.length, correct: 0, wrong: 0, perfect: true };
      let qi = 0;
      let cleanup = null;   // 当前题目注册的全局监听（如键盘），切题/结束时释放
      let disposed = false;

      const dispose = () => {
        if (disposed) return;
        disposed = true;
        if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
        if (window.Speech) Speech.stop();
        delete box._gameDispose;
        delete box.dataset.gameMount;
      };
      box.dataset.gameMount = '1';
      box._gameDispose = dispose;

      function renderQ() {
        if (disposed) return;
        // 切题先停止上一段朗读，避免两道题叠读
        if (window.Speech) Speech.stop();
        dots.forEach((d, i) => d.classList.toggle('now', i === qi));
        const q = qs[qi];
        // 错题组卷里每道题可能来自不同课程，按题自身的 lessonId 归属
        const lessonId = q.lessonId || q._fromLesson || gameCfg.lessonId;
        stage.innerHTML = '';
        // 只有确认系统有可用语音时，才敢把题目藏起来
        const aural = !!q.aural && !!(window.Speech && Speech.canAural());
        const promptText = q.prompt || (q.type === 'dragdrop' ? '把下面的数字拖进空格，让等式成立吧！' : '');
        if (!aural && q.visual && q.visual.emoji) {
          stage.appendChild(el('div', 'question-visual', q.visual.emoji));
        }
        if (!aural && q.visual && q.visual.svg) {
          const v = el('div', 'question-visual');
          v.innerHTML = q.visual.svg;
          stage.appendChild(v);
        }
        const promptEl = el('div', 'question-prompt' + (aural ? ' aural-prompt' : ''),
          aural ? '🎧 仔细听题，听完再作答～' : promptText);
        stage.appendChild(promptEl);

        let revealed = !aural;
        const reveal = () => {
          if (revealed || !promptEl.isConnected) return;
          revealed = true;
          promptEl.textContent = promptText;
          promptEl.classList.remove('aural-prompt');
        };
        // 语音工具条：只有真的隐藏了题目，才需要"显示题目"出口
        const barQ = aural ? q : Object.assign({}, q, { aural: false });
        if (window.Speech) stage.appendChild(Speech.questionBar(barQ, { onReveal: reveal }));

        if (window.Speech) {
          if (aural) {
            // 播报失败（无语音 / 被策略拦截 / 抛异常）立即显示题目，绝不让孩子卡住
            const ok = Speech.speak(Speech.questionText(q, false), { onerror: reveal });
            if (!ok) reveal();
          } else {
            Speech.autoQuestion(barQ);
          }
        } else {
          reveal();
        }

        const hintArea = el('div');
        stage.appendChild(hintArea);
        let hintIdx = 0;
        let attempts = 0;
        let finished = false;
        let wrongCounted = false;   // 同一题只计一次错，避免连点错选项重复扣星
        let answered = false;       // 每题只记一笔首次作答
        let lastHintAt = 0;

        function showNextHint() {
          if (!q.hints || !q.hints.length) return;
          const now = Date.now();
          if (now - lastHintAt < 350) return;   // 连点错误选项时不要把提示一次耗尽
          if (hintIdx >= q.hints.length) return;
          lastHintAt = now;
          const hint = q.hints[hintIdx];
          const isLast = hintIdx === q.hints.length - 1;
          const h = el('div', 'hint-box',
            `<span class="hint-label">💡 提示 ${hintIdx + 1}</span>${hint}`);
          if (window.Speech && Speech.supported && Speech.enabled()) {
            h.appendChild(Speech.button('🔊 听提示', () => Speech.toSpeakText(hint)));
          }
          // 最后一条通常是讲解/答案，只显示不自动念，避免听算与口算被泄题
          if (window.Speech && !isLast) {
            Speech.autoSpeak(() => '小提示，' + Speech.toSpeakText(hint));
          }
          hintArea.innerHTML = '';
          hintArea.appendChild(h);
          hintIdx++;
        }

        function markResult(correct, answerEl) {
          if (correct) {
            stats.correct++;
            Rewards.float(answerEl || stage, '⭐');
            if (window.Sound) window.Sound.correct();
            UI.toast(Rewards.praise(), 'var(--secondary)');
            if (!transient) Save.resolveWrong(lessonId, q.id);
            dots[qi].classList.remove('bad');
            dots[qi].classList.add('ok');
            setTimeout(() => { if (stage.isConnected && !disposed) next(); }, 900);
          } else {
            attempts++;
            dots[qi].classList.add('bad');
            if (!wrongCounted) {
              wrongCounted = true;
              stats.wrong++;
              stats.perfect = false;
              if (window.Sound) window.Sound.wrong();
              if (!transient) {
                Save.addWrong({
                  lessonId: lessonId,
                  qid: q.id,
                  type: q.type,
                  options: q.options || null,
                  template: q.template || null,
                  items: q.items || null,
                  bank: q.bank || null,
                  hints: q.hints || null,
                  visual: (q.visual && q.visual.emoji) || '',
                  prompt: q.prompt || '',
                  answer: q.answer
                });
              }
            }
            UI.toast(Rewards.encourage(), '#f87171');
            showNextHint();
          }
          if (cb.onQuestionDone) cb.onQuestionDone(q.id, correct);
        }

        // 答对一次后锁定本题，避免重复点击/重复提交把同一题计算两次
        const safeJudge = (correct, answerEl) => {
          if (finished || disposed) return;
          if (correct) finished = true;
          // 正确率口径 = 每题「第一次作答」；先错后对也只记第一笔
          if (!answered) {
            answered = true;
            if (window.Save && Save.recordAnswer) Save.recordAnswer(correct);
          }
          markResult(correct, answerEl);
        };

        const api = renderers[q.type] || renderers.choice;
        cleanup = api(stage, q, safeJudge) || null;
      }

      function next() {
        if (window.Speech) Speech.stop();
        if (cleanup) { cleanup(); cleanup = null; }
        qi++;
        if (qi < qs.length) renderQ();
        else {
          dots.forEach(d => d.classList.remove('now'));
          if (cb.onFinish) cb.onFinish(stats);
        }
      }

      renderQ();
      return dispose;
    }
  };

  /* ---------- 各题型渲染器：render(stage, q, judge(correct, answerEl)) ---------- */
  const renderers = {};

  /* 选择题 */
  renderers.choice = function (stage, q, judge) {
    const list = el('div', 'choice-list');
    const opts = (q.options || []).slice();
    if (q.shuffle !== false) opts.sort(() => Math.random() - .5);
    opts.forEach(opt => {
      const b = el('button', 'choice-btn', String(opt));
      b.addEventListener('click', () => {
        const correct = String(opt) === String(q.answer);
        b.classList.add(correct ? 'correct' : 'wrong');
        list.querySelectorAll('.choice-btn').forEach(x => x.disabled = true);
        if (!correct) {
          setTimeout(() => {
            list.querySelectorAll('.choice-btn').forEach(x => {
              x.disabled = false;
              x.classList.remove('wrong');
            });
          }, 700);
        }
        judge(correct, b);
      });
      list.appendChild(b);
    });
    stage.appendChild(list);
  };

  /* 数字输入题 */
  renderers.input = function (stage, q, judge) {
    const wrap = el('div', 'input-pad');
    const disp = el('div', 'input-display', '');
    const pad = el('div', 'keypad');
    let buf = '';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];

    const push = (k) => {
      if (buf.length >= 8) return;
      if (k === '.' && buf.includes('.')) return;
      buf += k;
      disp.textContent = buf;
    };
    const back = () => { buf = buf.slice(0, -1); disp.textContent = buf; };
    const submit = () => {
      if (buf === '') return;
      const v = parseFloat(buf);
      const ans = parseFloat(q.answer);
      judge(Number.isFinite(ans) && Math.abs(v - ans) < 1e-9, disp);
      buf = ''; disp.textContent = '';
    };

    keys.forEach(k => {
      const b = el('button', null, k);
      b.addEventListener('click', () => push(k));
      pad.appendChild(b);
    });
    const del = el('button', 'key-del', '⌫');
    del.addEventListener('click', back);
    pad.appendChild(del);
    const ok = el('button', 'key-ok', '✔ 确认');
    ok.addEventListener('click', submit);
    pad.appendChild(ok);
    wrap.appendChild(disp);
    wrap.appendChild(pad);
    stage.appendChild(wrap);

    // 桌面端支持实体键盘：数字 / 小数点 / 退格 / 回车
    const onKeyDown = (e) => {
      if (!stage.isConnected) {
        window.removeEventListener('keydown', onKeyDown);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key >= '0' && e.key <= '9') { e.preventDefault(); push(e.key); }
      else if (e.key === '.') { e.preventDefault(); push('.'); }
      else if (e.key === 'Backspace') { e.preventDefault(); back(); }
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  };

  /* 拖放填空题：q.template 如 "3 + ⬜ = 7"，⬜ 处生成 slot */
  renderers.dragdrop = function (stage, q, judge) {
    const line = el('div');
    line.style.cssText = 'font-size:26px;font-weight:bold;margin-bottom:6px;';
    const slots = [];
    const parts = String(q.template || '⬜').split('⬜');
    parts.forEach((p, i) => {
      if (p) line.appendChild(document.createTextNode(p));
      if (i < parts.length - 1) {
        const s = el('span', 'drop-slot');
        s.dataset.slotId = i;
        s.dataset.value = '';
        line.appendChild(s);
        slots.push(s);
      }
    });
    stage.appendChild(line);

    const bank = el('div', 'drop-bank');
    const chips = {};          // chipId -> chip，支持相同答案的重复筹码
    let chipSeq = 0;
    const answers = Array.isArray(q.answer) ? q.answer : String(q.answer).split('|');
    const bankItems = q.bank ? q.bank.slice() : answers.slice();
    // 答案中重复的值需要足够的筹码（如 1+3 与 3+1 两个空都填 4）
    const need = {}, have = {};
    answers.forEach(v => { need[String(v)] = (need[String(v)] || 0) + 1; });
    bankItems.forEach(v => { have[String(v)] = (have[String(v)] || 0) + 1; });
    Object.keys(need).forEach(v => {
      while ((have[v] || 0) < need[v]) { bankItems.push(v); have[v] = (have[v] || 0) + 1; }
    });
    if (q.shuffle !== false) bankItems.sort(() => Math.random() - .5);
    bankItems.forEach(v => {
      const c = el('span', 'answer-chip', String(v));
      const chipId = 'chip' + (chipSeq++);
      c.dataset.chipId = chipId;
      chips[chipId] = c;
      bank.appendChild(c);
      makeChipDraggable(c, String(v));
    });
    stage.appendChild(bank);

    function clearSlot(s) {
      const used = chips[s.dataset.chipId];
      if (used) used.classList.remove('used');
      s.textContent = ''; s.dataset.value = ''; s.dataset.chipId = '';
      s.classList.remove('filled');
    }

    function makeChipDraggable(chip, val) {
      chip.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const ghost = chip.cloneNode(true);
        ghost.className += ' drag-ghost';
        ghost.style.cssText += 'position:fixed;pointer-events:none;z-index:500;opacity:.9;';
        document.body.appendChild(ghost);
        chip.classList.add('dragging');
        const rect = chip.getBoundingClientRect();
        const offX = e.clientX - rect.left, offY = e.clientY - rect.top;
        const move = (ev) => {
          ghost.style.left = (ev.clientX - offX) + 'px';
          ghost.style.top = (ev.clientY - offY) + 'px';
        };
        move(e);   // 首帧也传事件对象，避免 NaNpx
        const up = (ev) => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          ghost.remove();
          chip.classList.remove('dragging');
          const under = document.elementFromPoint(ev.clientX, ev.clientY);
          const slot = under && under.closest('.drop-slot');
          if (slot) {
            // 若槽已被占用，原筹码回库
            const prevId = slot.dataset.chipId;
            if (prevId && chips[prevId]) chips[prevId].classList.remove('used');
            // 同一筹码从旧槽移到新槽时，先清空旧槽，避免两个槽都自认为已填
            const oldSlot = slots.find(s => s !== slot && s.dataset.chipId === chip.dataset.chipId);
            if (oldSlot) clearSlot(oldSlot);
            slot.textContent = val;
            slot.dataset.value = val;
            slot.dataset.chipId = chip.dataset.chipId;
            slot.classList.add('filled');
            chip.classList.add('used');
            // 检查是否全部填满
            if (slots.every(s => s.dataset.value !== '')) {
              setTimeout(() => {
                const ok = slots.every(s => String(answers[+s.dataset.slotId]) === s.dataset.value);
                if (ok) judge(true, slots[0]);
                else {
                  judge(false, slots.find(s => String(answers[+s.dataset.slotId]) !== s.dataset.value));
                  // 清空错误槽，允许重填
                  slots.forEach(s => {
                    if (String(answers[+s.dataset.slotId]) !== s.dataset.value) clearSlot(s);
                  });
                }
              }, 350);
            }
          }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    }
  };

  /* 排序/按序点选题 */
  renderers.sequence = function (stage, q, judge) {
    const slotsRow = el('div', 'seq-slots');
    const items = (q.items || []).slice();
    if (q.shuffle !== false) items.sort(() => Math.random() - .5);
    const picked = [];
    const slots = (q.answer || []).map((_, i) => {
      const s = el('span', 'drop-slot');
      s.dataset.slotId = i;
      slotsRow.appendChild(s);
      return s;
    });
    stage.appendChild(slotsRow);
    const list = el('div', 'seq-list');
    items.forEach(v => {
      const it = el('button', 'seq-item', String(v));
      it.addEventListener('click', () => {
        if (it.classList.contains('picked')) return;
        const idx = picked.length;
        if (idx >= slots.length) return;
        picked.push(String(v));
        slots[idx].textContent = v;
        slots[idx].classList.add('filled');
        it.classList.add('picked');
        if (picked.length === slots.length) {
          setTimeout(() => {
            const ok = picked.every((p, i) => String((q.answer || [])[i]) === p);
            judge(ok, slots[0]);
            if (!ok) {
              setTimeout(() => {
                picked.length = 0;
                slots.forEach(s => { s.textContent = ''; s.classList.remove('filled'); });
                list.querySelectorAll('.seq-item').forEach(x => x.classList.remove('picked'));
              }, 800);
            }
          }, 350);
        }
      });
      list.appendChild(it);
    });
    stage.appendChild(list);
  };

  window.Game = Game;
  Game._normalizeQuestion = normalizeQuestion;   // 供离线自检
})();
