/* 单词书 · 新词学习 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const ui = WB.ui;

  function render(root) {
    let session = WB.session.resume('learn');
    if (!session) session = WB.session.start('learn');
    let revealed = false;

    function draw() {
      root.innerHTML = '';
      const today = WB.date.today();

      if (!session.queue.length) {
        const actions = [];
        if (WB.store.getSettings().tier < 3) {
          actions.push(ui.el('button', {
            class: 'btn primary',
            type: 'button',
            onclick: function () { WB.main.go('settings'); }
          }, '切换到更大的词库'));
        }
        actions.push(ui.el('button', {
          class: 'btn ghost',
          type: 'button',
          onclick: function () { WB.main.go('today'); }
        }, '回到今日'));
        root.appendChild(ui.el('div', { class: 'study' },
          ui.el('div', { class: 'flash' },
            ui.el('div', { class: 'empty' },
              ui.el('div', { class: 'mark' }, '安'),
              ui.el('h3', null, '今天的新词已经处理完'),
              ui.el('p', null, session.reason || '没有需要学习的新词。'),
              ui.el('div', { class: 'row' }, actions)
            )
          )
        ));
        return;
      }

      if (session.finished) {
        const settings = WB.store.getSettings();
        const daily = WB.store.getDaily()[today] || {};
        const remaining = Math.max(0, settings.dailyNew - (daily.newCount || 0));
        const actions = [];
        if (remaining > 0) {
          actions.push(ui.el('button', {
            class: 'btn primary',
            type: 'button',
            onclick: function () {
              session = WB.session.start('learn');
              revealed = false;
              draw();
            }
          }, '再来一组'));
        }
        actions.push(ui.el('button', {
          class: 'btn',
          type: 'button',
          onclick: function () { WB.main.go('review'); }
        }, '去复习'));
        actions.push(ui.el('button', {
          class: 'btn ghost',
          type: 'button',
          onclick: function () { WB.main.go('today'); }
        }, '回到今日'));

        root.appendChild(ui.el('div', { class: 'study' },
          ui.el('div', { class: 'card summary' },
            ui.el('div', { class: 'big' }, String(session.answered),
              ui.el('small', null, '本次回顾次数')
            ),
            ui.el('div', { class: 'summary-stats' },
              ui.el('div', { class: 'sitem' }, ui.el('b', null, String(session.correct)), ui.el('span', null, '答对')),
              ui.el('div', { class: 'sitem' }, ui.el('b', null, String(session.added)), ui.el('span', null, '加入生词本')),
              ui.el('div', { class: 'sitem' }, ui.el('b', null, String(session.retryCount)), ui.el('span', null, '本轮重现'))
            ),
            ui.el('div', { class: 'row', style: 'justify-content:center' }, actions)
          )
        ));
        return;
      }

      const item = WB.session.peek();
      if (!item) return;
      const card = WB.session.cardFor(item);
      const preview = WB.srs.preview(card, today);
      const inNotebook = WB.store.isInNotebook(item.word.w);
      const tags = (item.word.tag || []).map(function (tag) { return ui.chip(tag.toUpperCase(), 'plain'); });

      const progress = (session.index / session.queue.length) * 100;

      const top = ui.el('div', null,
        ui.el('div', { class: 'study-bar' },
          ui.el('div', { class: 'left' },
            ui.chip('新词', 'accent'),
            ui.el('span', null, '第 ' + String(session.index + 1) + ' / ' + String(session.queue.length) + ' 张')
          ),
          ui.el('span', { class: 'kbd-hint' },
            revealed ? '按 1-4 评分' : '按空格翻面'
          )
        ),
        ui.el('div', { class: 'progress-track', style: 'margin-top:8px' },
          ui.el('i', { style: 'width:' + progress + '%' })
        )
      );

      let flash;
      let actions;

      if (!revealed) {
        flash = ui.el('div', { class: 'flash' },
          ui.el('div', { class: 'word' },
            ui.el('small', null, '新词'),
            item.word.w
          ),
          item.word.ph ? ui.el('div', { class: 'phonetic' }, '/' + item.word.ph + '/') : null,
          ui.el('div', { class: 'speak-row' }, ui.speakButton(item.word.w)),
          ui.el('p', { class: 'hint' }, '先在心里回想它的意思，再翻面核对。'),
          ui.el('div', { class: 'flash-meta' },
            ui.chip(ui.tierTitle(item.word.t), 'accent'),
            tags
          )
        );
        actions = ui.el('div', { class: 'stack', style: 'gap:10px' },
          ui.el('button', {
            class: 'btn primary lg wide',
            type: 'button',
            onclick: function () { revealed = true; draw(); }
          }, '显示释义', ui.el('span', { class: 'key' }, 'Space')),
          ui.el('button', {
            class: 'btn ghost wide',
            type: 'button',
            disabled: inNotebook,
            onclick: function () {
              const added = WB.session.collect(item.word, 'manual');
              ui.toast(added ? '已加入生词本' : '这个单词已在生词本中');
              draw();
            }
          }, inNotebook ? '已在生词本中' : '不认识 · 加入生词本')
        );
      } else {
        flash = ui.el('div', { class: 'flash' },
          ui.el('div', { class: 'word compact' }, item.word.w),
          item.word.ph ? ui.el('div', { class: 'phonetic' }, '/' + item.word.ph + '/') : null,
          ui.el('div', { class: 'speak-row' }, ui.speakButton(item.word.w)),
          ui.el('ul', { class: 'senses' },
            (item.word.zh || []).map(function (sense, index) {
              return ui.el('li', null, ui.el('b', null, String(index + 1)), sense);
            })
          ),
          ui.el('div', { class: 'flash-meta' },
            ui.chip(ui.tierTitle(item.word.t), 'accent'),
            ui.chip('词频 #' + item.word.r, 'plain'),
            tags,
            card.leech ? ui.chip('难词', 'danger') : null
          ),
          ui.el('p', { class: 'hint' }, '根据刚才回忆的难易程度评分，系统会安排下次复习时间。')
        );

        const gradeButtons = preview.map(function (entry) {
          return ui.el('button', {
            class: 'grade ' + entry.cls,
            type: 'button',
            title: entry.hint,
            onclick: function () {
              WB.session.answer(entry.q);
              revealed = false;
              draw();
            }
          },
            ui.el('b', null, entry.label),
            ui.el('span', null, entry.text)
          );
        });

        actions = ui.el('div', { class: 'stack', style: 'gap:10px' },
          ui.el('div', { class: 'grade-grid' }, gradeButtons),
          ui.el('button', {
            class: 'btn ghost wide',
            type: 'button',
            disabled: inNotebook,
            onclick: function () {
              const added = WB.session.collect(item.word, 'manual');
              ui.toast(added ? '已加入生词本' : '这个单词已在生词本中');
              draw();
            }
          }, inNotebook ? '已在生词本中' : '加入生词本')
        );
      }

      root.appendChild(ui.el('div', { class: 'study' }, top, flash, actions));
    }

    function onKey(event) {
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (session.finished || !WB.session.peek()) return;
      if (!revealed) {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          revealed = true;
          draw();
        }
        return;
      }
      const index = Number(event.key);
      if (index >= 1 && index <= 4) {
        event.preventDefault();
        WB.session.answer([2, 3, 4, 5][index - 1]);
        revealed = false;
        draw();
      }
    }

    draw();
    document.addEventListener('keydown', onKey);
    return function () { document.removeEventListener('keydown', onKey); };
  }

  WB.ui.learn = { render: render };
})();
