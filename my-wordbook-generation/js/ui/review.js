/* 单词书 · 复习会话（英译中 / 中译英 / 拼写 / 听音） */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const ui = WB.ui;

  function modeLabel(mode) {
    return WB.session.MODE_LABELS[mode] || '复习';
  }

  function gradeLabel(grade) {
    const match = WB.srs.GRADES.find(function (item) { return item.q === grade; });
    return match ? match.label : '记得';
  }

  function buildQuestion(item) {
    const settings = WB.store.getSettings();
    const word = item.word;
    const mode = item.mode || 'en2zh';
    const question = {
      item: item,
      mode: mode,
      options: [],
      revealed: false,
      checked: false,
      done: false,
      input: '',
      spoken: false,
      selected: null,
      correct: null,
      grade: null,
      nextCard: null,
      correctText: ''
    };

    if (mode === 'en2zh' || mode === 'listen') {
      const others = WB.words.distractors(word, 3, settings.tier);
      const options = others.map(function (other) {
        return {
          text: mode === 'listen' ? other.w : WB.words.sensesText(other),
          ok: false
        };
      });
      options.push({
        text: mode === 'listen' ? word.w : WB.words.sensesText(word),
        ok: true
      });
      question.options = WB.words.shuffle(options);
      const right = question.options.find(function (option) { return option.ok; });
      question.correctText = right ? right.text : '';
    }

    if (mode === 'spell') question.correctText = word.w;
    return question;
  }

  function render(root) {
    let session = WB.session.resume('review');
    if (!session) session = WB.session.start('review');
    let question = null;

    function next() {
      question = null;
      if (!session.finished && WB.session.peek()) {
        question = buildQuestion(WB.session.peek());
      }
      draw();
    }

    function settle(grade, correct) {
      if (!question || question.done) return;
      question.wasInNotebook = WB.store.isInNotebook(question.item.word.w);
      const result = WB.session.answer(grade);
      question.done = true;
      question.correct = correct;
      question.grade = grade;
      question.nextCard = result ? result.card : null;
      question.retried = !!(result && result.retried);
      draw();
    }

    function chooseOption(index) {
      if (!question || question.done) return;
      const option = question.options[index];
      if (!option) return;
      question.selected = option;
      settle(option.ok ? 4 : 2, option.ok);
    }

    function submitSpell() {
      if (!question || question.done) return;
      const value = question.input || '';
      if (!value.trim()) {
        ui.toast('请先输入单词');
        return;
      }
      question.checked = true;
      question.spellingOk = WB.words.matches(question.item.word, value);
      draw();
    }

    function gradeGrid(q) {
      const card = WB.session.cardFor(q.item);
      const preview = WB.srs.preview(card, WB.date.today());
      return ui.el('div', { class: 'grade-grid' },
        preview.map(function (entry) {
          return ui.el('button', {
            class: 'grade ' + entry.cls,
            type: 'button',
            title: entry.hint,
            onclick: function () { settle(entry.q, entry.q >= 3); }
          },
            ui.el('b', null, entry.label),
            ui.el('span', null, entry.text)
          );
        })
      );
    }

    function feedback(q) {
      const word = q.item.word;
      let message = '';
      let text = '';
      if (q.mode === 'listen' || q.mode === 'en2zh') {
        text = q.correct ? '回答正确。' : '回答错误。正确答案：' + q.correctText + '。';
      } else if (q.mode === 'spell') {
        text = q.spellingOk ? '拼写正确。' : '拼写有误，正确拼写：' + word.w + '。';
      } else {
        text = '已显示答案。';
      }
      let due = '';
      if (q.nextCard) {
        if (q.grade <= 2) {
          due = q.retried ? '已安排今天重学，本轮稍后还会再出现一次。' : '已安排今天重学。';
        } else {
          due = '下次复习：' + q.nextCard.interval + ' 天后（' + q.nextCard.due + '）。';
        }
      }
      if (q.grade <= 2 && !q.wasInNotebook && WB.store.isInNotebook(word.w)) {
        message = '已自动加入生词本。';
      }
      const label = '评分：' + gradeLabel(q.grade);
      return ui.el('div', { class: 'feedback ' + (q.correct ? 'ok' : 'bad') },
        ui.el('p', null, ui.el('strong', null, text), ' ', message),
        ui.el('p', { class: 'tiny', style: 'margin-top:4px' }, label + '　' + due)
      );
    }

    function draw() {
      root.innerHTML = '';
      const today = WB.date.today();

      if (!session.queue.length) {
        const cards = WB.store.getCards();
        const nextDue = Object.keys(cards)
          .filter(function (key) {
            const card = cards[key];
            return card && card.state && card.state !== 'new' && String(card.due || '') > today;
          })
          .map(function (key) { return cards[key].due; })
          .sort()[0];
        root.appendChild(ui.el('div', { class: 'study' },
          ui.el('div', { class: 'flash' },
            ui.el('div', { class: 'empty' },
              ui.el('div', { class: 'mark' }, '静'),
              ui.el('h3', null, '今天没有到期的复习'),
              ui.el('p', null, session.reason + (nextDue ? ' 下次到期：' + nextDue + '。' : '')),
              ui.el('div', { class: 'row' },
                ui.el('button', {
                  class: 'btn primary',
                  type: 'button',
                  onclick: function () { WB.main.go('learn'); }
                }, '去学新词'),
                ui.el('button', {
                  class: 'btn ghost',
                  type: 'button',
                  onclick: function () { WB.main.go('today'); }
                }, '回到今日')
              )
            )
          )
        ));
        return;
      }

      if (session.finished && !question) {
        root.appendChild(ui.el('div', { class: 'study' },
          ui.el('div', { class: 'card summary' },
            ui.el('div', { class: 'big' }, String(session.answered),
              ui.el('small', null, '本次复习次数')
            ),
            ui.el('div', { class: 'summary-stats' },
              ui.el('div', { class: 'sitem' },
                ui.el('b', null, (session.answered ? Math.round((session.correct / session.answered) * 100) : 0) + '%'),
                ui.el('span', null, '本轮正确率')
              ),
              ui.el('div', { class: 'sitem' }, ui.el('b', null, String(session.added)), ui.el('span', null, '加入生词本')),
              ui.el('div', { class: 'sitem' }, ui.el('b', null, String(session.retryCount)), ui.el('span', null, '本轮重现'))
            ),
            ui.el('div', { class: 'row', style: 'justify-content:center' },
              ui.el('button', {
                class: 'btn primary',
                type: 'button',
                onclick: function () {
                  session = WB.session.start('review');
                  question = null;
                  draw();
                }
              }, '再来一组'),
              ui.el('button', {
                class: 'btn',
                type: 'button',
                onclick: function () { WB.main.go('notebook'); }
              }, '查看生词本'),
              ui.el('button', {
                class: 'btn ghost',
                type: 'button',
                onclick: function () { WB.main.go('today'); }
              }, '回到今日')
            )
          )
        ));
        return;
      }

      if (!question) question = buildQuestion(WB.session.peek());
      if (!question) return;

      const q = question;
      const word = q.item.word;
      const mode = q.mode;
      const progress = Math.min(1, session.index / session.queue.length) * 100;

      if (mode === 'listen' && !q.spoken) {
        q.spoken = true;
        setTimeout(function () { ui.speak(word.w); }, 90);
      }

      const top = ui.el('div', null,
        ui.el('div', { class: 'study-bar' },
          ui.el('div', { class: 'left' },
            ui.chip('复习', 'accent'),
            ui.chip(modeLabel(mode), 'plain'),
            ui.el('span', null, '第 ' + Math.min(session.index + 1, session.queue.length) + ' / ' + session.queue.length + ' 张')
          ),
          ui.el('span', { class: 'kbd-hint' }, '按 1-4 选择 / 评分')
        ),
        ui.el('div', { class: 'progress-track', style: 'margin-top:8px' },
          ui.el('i', { style: 'width:' + progress + '%' })
        )
      );

      const parts = [];
      const actionParts = [];

      if (mode === 'listen') {
        parts.push(ui.el('div', { class: 'word compact' }, ui.el('small', null, '听音辨词'), '听'));
        parts.push(ui.el('div', { class: 'speak-row' },
          ui.el('button', {
            class: 'speak-btn',
            type: 'button',
            style: 'font-size:14px;padding:10px 20px',
            onclick: function () { ui.speak(word.w); }
          }, ui.icon('speaker'), '再播一次')
        ));
        parts.push(ui.el('p', { class: 'hint' }, '听发音，从下面选出你听到的单词。'));
      } else if (mode === 'en2zh') {
        parts.push(ui.el('div', { class: 'word' }, ui.el('small', null, '英译中'), word.w));
        if (word.ph) parts.push(ui.el('div', { class: 'phonetic' }, '/' + word.ph + '/'));
        parts.push(ui.el('div', { class: 'speak-row' }, ui.speakButton(word.w)));
        parts.push(ui.el('p', { class: 'hint' }, '先回忆释义，再选出最接近的一项。'));
      } else if (mode === 'zh2en') {
        parts.push(ui.el('div', { class: 'word compact' }, ui.el('small', null, '中译英'), '看中文说英文'));
        parts.push(ui.el('ul', { class: 'senses' },
          (word.zh || []).map(function (sense, index) {
            return ui.el('li', null, ui.el('b', null, String(index + 1)), sense);
          })
        ));
        if (q.revealed || q.done) {
          parts.push(ui.el('div', { class: 'word compact', style: 'margin-top:16px' }, word.w));
          if (word.ph) parts.push(ui.el('div', { class: 'phonetic' }, '/' + word.ph + '/'));
          parts.push(ui.el('div', { class: 'speak-row' }, ui.speakButton(word.w)));
        } else {
          parts.push(ui.el('p', { class: 'hint' }, '先在脑中回忆英文拼写与读音，再显示答案。'));
        }
      } else {
        parts.push(ui.el('div', { class: 'word compact' }, ui.el('small', null, '拼写'), '看中文写英文'));
        parts.push(ui.el('ul', { class: 'senses' },
          (word.zh || []).map(function (sense, index) {
            return ui.el('li', null, ui.el('b', null, String(index + 1)), sense);
          })
        ));
      }

      if (mode === 'en2zh' || mode === 'listen') {
        const optionNodes = q.options.map(function (option, index) {
          let cls = 'option';
          if (q.done) {
            if (option.ok) cls += ' correct';
            else if (option === q.selected) cls += ' wrong';
          }
          return ui.el('button', {
            class: cls,
            type: 'button',
            disabled: q.done,
            onclick: function () { chooseOption(index); }
          },
            ui.el('span', { class: 'idx' }, String(index + 1)),
            ui.el('span', null, option.text)
          );
        });
        parts.push(ui.el('div', { class: 'options' }, optionNodes));
      }

      if (mode === 'spell') {
        const spellingClass = q.checked ? (q.spellingOk ? ' ok' : ' bad') : '';
        const input = ui.el('input', {
          class: 'spell-input' + spellingClass,
          type: 'text',
          autocomplete: 'off',
          autocapitalize: 'none',
          spellcheck: 'false',
          placeholder: '输入英文单词',
          value: q.input,
          disabled: q.checked,
          oninput: function (event) { q.input = event.target.value; }
        });
        parts.push(ui.el('form', {
          class: 'spell-form',
          onsubmit: function (event) { event.preventDefault(); submitSpell(); }
        }, input,
          ui.el('button', {
            class: 'btn primary',
            type: 'submit',
            disabled: q.checked
          }, q.checked ? '已提交' : '检查拼写')
        ));
        if (q.checked && !q.spellingOk) {
          parts.push(ui.el('p', { class: 'feedback bad', style: 'margin-top:10px' },
            '正确拼写：', ui.el('strong', null, word.w)));
        }
        if (!q.checked) {
          parts.push(ui.el('p', { class: 'hint' }, '输入后按回车检查；检查完再按实际难度评分。'));
        }
        setTimeout(function () {
          if (!q.checked && !q.done && input && input.focus) input.focus();
        }, 0);
      }

      if (!q.done) {
        if (mode === 'zh2en' && !q.revealed) {
          actionParts.push(ui.el('button', {
            class: 'btn primary lg wide',
            type: 'button',
            onclick: function () { q.revealed = true; draw(); }
          }, '显示答案', ui.el('span', { class: 'key' }, 'Space')));
        } else if ((mode === 'zh2en' && q.revealed) || (mode === 'spell' && q.checked)) {
          actionParts.push(gradeGrid(q));
        }
      }

      const flash = ui.el('div', { class: 'flash' }, parts);
      const study = ui.el('div', { class: 'study' }, top, flash);

      if (q.done) {
        study.appendChild(feedback(q));
        study.appendChild(ui.el('button', {
          class: 'btn primary lg wide',
          type: 'button',
          onclick: next
        }, session.finished ? '查看总结' : '下一题', ui.el('span', { class: 'key' }, 'Enter')));
      } else if (actionParts.length) {
        study.appendChild(ui.el('div', { class: 'stack', style: 'gap:10px' }, actionParts));
      }

      root.appendChild(study);
    }

    function onKey(event) {
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!question) return;
      const q = question;
      if (q.done) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          next();
        }
        return;
      }
      if (q.mode === 'zh2en' && !q.revealed) {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          q.revealed = true;
          draw();
        }
        return;
      }
      const index = Number(event.key);
      if ((q.mode === 'en2zh' || q.mode === 'listen') && index >= 1 && index <= 4) {
        event.preventDefault();
        chooseOption(index - 1);
        return;
      }
      if (index >= 1 && index <= 4 && ((q.mode === 'zh2en' && q.revealed) || (q.mode === 'spell' && q.checked))) {
        event.preventDefault();
        settle([2, 3, 4, 5][index - 1], [2, 3, 4, 5][index - 1] >= 3);
      }
    }

    draw();
    document.addEventListener('keydown', onKey);
    return function () { document.removeEventListener('keydown', onKey); };
  }

  WB.ui.review = { render: render };
})();
