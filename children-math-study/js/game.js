/* ===== 闯关游戏引擎 =====
   题型：choice / input / dragdrop / sequence
   提示阶梯：hints 数组逐条展示，最后一条作为讲解兜底
*/
(function () {

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  const Game = {
    /**
     * mount(box, gameCfg, callbacks)
     * callbacks: { onQuestionDone(qid, correct), onFinish(stats) }
     * stats: { total, correct, wrong, perfect }
     */
    mount(box, gameCfg, cb) {
      box.innerHTML = '';
      const panel = el('div', 'game-panel');
      const head = el('div', 'game-head');
      head.innerHTML = `<span style="font-size:32px">${gameCfg.icon || '🎯'}</span><h3>${gameCfg.title}</h3>`;
      const prog = el('div', 'game-progress');
      const stage = el('div');
      panel.appendChild(head);
      panel.appendChild(prog);
      panel.appendChild(stage);
      box.appendChild(panel);

      const qs = gameCfg.questions;
      qs.forEach(() => prog.appendChild(el('span')));
      const dots = [...prog.children];
      const stats = { total: qs.length, correct: 0, wrong: 0, perfect: true };
      let qi = 0;

      function renderQ() {
        dots.forEach((d, i) => d.classList.toggle('now', i === qi));
        const q = qs[qi];
        stage.innerHTML = '';
        if (q.visual && q.visual.emoji) {
          stage.appendChild(el('div', 'question-visual', q.visual.emoji));
        }
        if (q.visual && q.visual.svg) {
          const v = el('div', 'question-visual');
          v.innerHTML = q.visual.svg;
          stage.appendChild(v);
        }
        stage.appendChild(el('div', 'question-prompt',
          q.prompt || (q.type === 'dragdrop' ? '把下面的数字拖进空格，让等式成立吧！' : '')));

        const hintArea = el('div');
        stage.appendChild(hintArea);
        let hintIdx = 0;
        let attempts = 0;
        let finished = false;

        function showNextHint(force) {
          if (!q.hints || !q.hints.length) return;
          if (hintIdx < q.hints.length) {
            const h = el('div', 'hint-box',
              `<span class="hint-label">💡 提示 ${hintIdx + 1}</span>${q.hints[hintIdx]}`);
            hintArea.innerHTML = '';
            hintArea.appendChild(h);
            hintIdx++;
          }
        }

        function markResult(correct, answerEl) {
          if (correct) {
            stats.correct++;
            Rewards.float(answerEl || stage, '⭐');
            UI.toast(Rewards.praise(), 'var(--secondary)');
            Save.resolveWrong(gameCfg.lessonId, q.id);
            dots[qi].classList.add('ok');
            setTimeout(() => { if (stage.isConnected) next(); }, 900);
          } else {
            stats.wrong++;
            stats.perfect = false;
            attempts++;
            dots[qi].classList.add('bad');
            Save.addWrong({
              lessonId: gameCfg.lessonId,
              qid: q.id,
              type: q.type,
              options: q.options || null,
              template: q.template || null,
              visual: (q.visual && q.visual.emoji) || '',
              prompt: q.prompt || '',
              answer: q.answer
            });
            UI.toast(Rewards.encourage(), '#f87171');
            showNextHint();
          }
        }

        // 答对一次后锁定本题，避免重复点击/重复提交把同一题计算两次
        const safeJudge = (correct, answerEl) => {
          if (finished) return;
          if (correct) finished = true;
          markResult(correct, answerEl);
        };

        const api = renderers[q.type] || renderers.choice;
        api(stage, q, safeJudge);
      }

      function next() {
        qi++;
        if (qi < qs.length) renderQ();
        else {
          dots.forEach(d => d.classList.remove('now'));
          cb.onFinish(stats);
        }
      }

      renderQ();
    }
  };

  /* ---------- 各题型渲染器：render(stage, q, judge(correct, answerEl)) ---------- */
  const renderers = {};

  /* 选择题 */
  renderers.choice = function (stage, q, judge) {
    const list = el('div', 'choice-list');
    const opts = q.options.slice();
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
    keys.forEach(k => {
      const b = el('button', null, k);
      b.addEventListener('click', () => {
        if (buf.length >= 8) return;
        if (k === '.' && buf.includes('.')) return;
        buf += k;
        disp.textContent = buf;
      });
      pad.appendChild(b);
    });
    const del = el('button', 'key-del', '⌫');
    del.addEventListener('click', () => { buf = buf.slice(0, -1); disp.textContent = buf; });
    pad.appendChild(del);
    const ok = el('button', 'key-ok', '✔ 确认');
    ok.addEventListener('click', () => {
      if (buf === '') return;
      const v = parseFloat(buf);
      const ans = parseFloat(q.answer);
      judge(Math.abs(v - ans) < 1e-9, disp);
      buf = ''; disp.textContent = '';
    });
    pad.appendChild(ok);
    wrap.appendChild(disp);
    wrap.appendChild(pad);
    stage.appendChild(wrap);
  };

  /* 拖放填空题：q.slots=[...], q.bank=[...], q.answer 可以是数组或单值 */
  renderers.dragdrop = function (stage, q, judge) {
    const line = el('div');
    line.style.cssText = 'font-size:26px;font-weight:bold;margin-bottom:6px;';
    // 模板渲染：q.template 如 "3 + ⬜ = 7"，⬜ 处生成 slot
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
    const chips = {};
    const answers = Array.isArray(q.answer) ? q.answer : q.answer.split?.('|') || [q.answer];
    const bankItems = q.bank ? q.bank.slice() : answers.slice();
    if (q.shuffle !== false) bankItems.sort(() => Math.random() - .5);
    bankItems.forEach(v => {
      const c = el('span', 'answer-chip', String(v));
      chips[String(v)] = c;
      bank.appendChild(c);
      makeChipDraggable(c, String(v));
    });
    stage.appendChild(bank);

    function makeChipDraggable(chip, val) {
      chip.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const ghost = chip.cloneNode(true);
        ghost.style.cssText += 'position:fixed;pointer-events:none;z-index:500;opacity:.9;';
        document.body.appendChild(ghost);
        chip.classList.add('dragging');
        const rect = chip.getBoundingClientRect();
        const offX = e.clientX - rect.left, offY = e.clientY - rect.top;
        const move = (ev) => {
          ghost.style.left = (ev.clientX - offX) + 'px';
          ghost.style.top = (ev.clientY - offY) + 'px';
        };
        move(e.clientX, e.clientY);
        const up = (ev) => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          ghost.remove();
          chip.classList.remove('dragging');
          const under = document.elementFromPoint(ev.clientX, ev.clientY);
          const slot = under && under.closest('.drop-slot');
          if (slot) {
            // 若槽已被占用，原筹码回库
            const prev = slot.dataset.value;
            if (prev && chips[prev]) chips[prev].classList.remove('used');
            slot.textContent = val;
            slot.dataset.value = val;
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
                    if (String(answers[+s.dataset.slotId]) !== s.dataset.value) {
                      const used = chips[s.dataset.value];
                      if (used) used.classList.remove('used');
                      s.textContent = ''; s.dataset.value = ''; s.classList.remove('filled');
                    }
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
    const items = q.items.slice();
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
            const ok = picked.every((p, i) => String((q.answer)[i]) === p);
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
})();
