/* 单词书 · 统计 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const ui = WB.ui;

  function levelFor(count) {
    if (!count) return 0;
    if (count <= 4) return 1;
    if (count <= 12) return 2;
    if (count <= 25) return 3;
    return 4;
  }

  function render(root) {
    const today = WB.date.today();
    const cards = WB.store.getCards();
    const notebook = WB.store.getNotebook();
    const daily = WB.store.getDaily();
    const entry = daily[today] || {};
    const cardList = Object.keys(cards).map(function (key) { return cards[key]; });
    const totalReviews = cardList.reduce(function (sum, card) { return sum + (card.reps || 0); }, 0);
    const notebookCount = Object.keys(notebook).length;
    const mastered = Object.keys(notebook).filter(function (key) { return notebook[key].mastered; }).length;
    const dueCount = cardList.filter(function (card) {
      return card.state && card.state !== 'new' && String(card.due || '') <= today;
    }).length;
    const leechCount = Object.keys(notebook).filter(function (key) { return notebook[key].leech; }).length;
    const accuracy = entry.total ? Math.round(((entry.correct || 0) / entry.total) * 100) + '%' : '—';
    const reviewed = cardList.filter(function (card) { return card.interval > 0 && card.state !== 'new'; });
    const retentionValues = reviewed.map(function (card) { return WB.srs.retention(card, today); }).filter(function (value) {
      return value != null;
    });
    const avgRetention = retentionValues.length
      ? Math.round((retentionValues.reduce(function (a, b) { return a + b; }, 0) / retentionValues.length) * 100) + '%'
      : '—';

    const stats = ui.el('div', { class: 'stat-grid five' },
      ui.stat('连续打卡', String(WB.store.streak()), '天'),
      ui.stat('累计回顾', ui.num(totalReviews), '次'),
      ui.stat('生词本', String(notebookCount), '词'),
      ui.stat('已掌握', String(mastered), '词'),
      ui.stat('今日正确率', accuracy)
    );

    const cells = [];
    const weekday = WB.date.parse(today).getDay();
    const start = WB.date.addDays(today, -(weekday + 77));
    for (let i = 0; i < 84; i += 1) {
      const key = WB.date.addDays(start, i);
      if (key > today) {
        cells.push(ui.el('i', { class: 'future' }));
        continue;
      }
      const day = daily[key] || {};
      const count = day.total != null
        ? day.total
        : (day.newCount || 0) + (day.reviewCount || 0);
      const level = levelFor(count);
      cells.push(ui.el('i', {
        class: level ? 'l' + level : '',
        title: key + ' · 学习 ' + count + ' 次'
      }));
    }

    const heatCard = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' },
        ui.el('h2', null, '12 周学习热力图'),
        ui.el('div', { class: 'legend' },
          ui.el('span', null, '少'),
          ui.el('i', null), ui.el('i', { class: 'l1' }), ui.el('i', { class: 'l2' }),
          ui.el('i', { class: 'l3' }), ui.el('i', { class: 'l4' }),
          ui.el('span', null, '多')
        )
      ),
      ui.el('div', { class: 'heat-wrap' }, ui.el('div', { class: 'heat' }, cells)),
      ui.el('p', { class: 'muted tiny', style: 'margin-top:10px' },
        '统计范围：' + start + ' 至 ' + today + '，每格代表一天的学习次数。')
    );

    const loadBars = [];
    let maxLoad = 1;
    const loadCounts = [];
    for (let i = 0; i < 30; i += 1) {
      const key = WB.date.addDays(today, i);
      let count = 0;
      cardList.forEach(function (card) {
        if (!card || !card.state || card.state === 'new') return;
        if (i === 0 ? String(card.due || '') <= today : card.due === key) count += 1;
      });
      loadCounts.push({ key: key, count: count });
      maxLoad = Math.max(maxLoad, count);
    }
    loadCounts.forEach(function (item, index) {
      const height = item.count ? Math.max(8, Math.round((item.count / maxLoad) * 96)) : 3;
      loadBars.push(ui.el('i', {
        class: item.count ? (item.count === maxLoad && maxLoad > 1 ? 'has peak' : 'has') : '',
        style: 'height:' + height + 'px',
        title: item.key + ' · ' + item.count + ' 张到期'
      }));
    });

    const loadCard = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' },
        ui.el('h2', null, '未来 30 天复习负载'),
        ui.el('span', { class: 'chip accent' }, '今天 ' + dueCount + ' 张')
      ),
      ui.el('div', { class: 'load-chart' }, loadBars),
      ui.el('div', { class: 'row between', style: 'margin-top:6px' },
        ui.el('span', { class: 'muted tiny' }, '今天'),
        ui.el('span', { class: 'muted tiny' }, '30 天后')
      )
    );

    const healthCard = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' }, ui.el('h2', null, '记忆健康')),
      ui.el('div', { class: 'tier-progress' },
        ui.el('div', { class: 'tier-line' },
          ui.el('div', { class: 'head' }, ui.el('b', null, '平均预估保持率'), ui.el('span', null, avgRetention)),
          ui.el('div', { class: 'track' },
            ui.el('i', { style: 'width:' + (avgRetention === '—' ? 0 : parseInt(avgRetention, 10)) + '%' })
          )
        ),
        ui.el('div', { class: 'row between', style: 'font-size:12.5px;color:var(--ink-2)' },
          ui.el('span', null, '待复习'),
          ui.el('b', null, String(dueCount) + ' 张')
        ),
        ui.el('div', { class: 'row between', style: 'font-size:12.5px;color:var(--ink-2)' },
          ui.el('span', null, '难词（连续遗忘）'),
          ui.el('b', null, String(leechCount) + ' 个')
        ),
        ui.el('div', { class: 'row between', style: 'font-size:12.5px;color:var(--ink-2)' },
          ui.el('span', null, '今日新词 / 复习'),
          ui.el('b', null, String(entry.newCount || 0) + ' / ' + String(entry.reviewCount || 0))
        )
      ),
      ui.el('p', { class: 'muted tiny', style: 'margin-top:12px' },
        '保持率 = 0.9^(已过天数 / 当前间隔)，仅用于估算，不代表真实记忆强度。')
    );

    const tierLines = [1, 2, 3].map(function (level) {
      const learned = WB.words.list(level).filter(function (word) {
        const card = cards[word.w];
        return card && card.reps > 0;
      }).length;
      const target = WB.words.tierTarget(level);
      const percent = Math.min(100, (learned / target) * 100);
      return ui.el('div', { class: 'tier-line t' + level },
        ui.el('div', { class: 'head' },
          ui.el('b', null, 'L' + level + ' ' + ui.tierLabel(level)),
          ui.el('span', null, ui.num(learned) + ' / ' + ui.num(target) + '（' + Math.round(percent) + '%）')
        ),
        ui.el('div', { class: 'track' }, ui.el('i', { style: 'width:' + percent + '%' }))
      );
    });

    const tierCard = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' },
        ui.el('h2', null, '档位进度'),
        ui.el('span', { class: 'muted tiny' }, '累计 ' + ui.num(WB.words.total) + ' 词')
      ),
      ui.el('div', { class: 'tier-progress' }, tierLines)
    );

    root.appendChild(ui.pageHead(
      '统计',
      '连续学习、复习负载与词库进度一目了然。',
      null
    ));
    root.appendChild(stats);
    root.appendChild(ui.el('div', { style: 'margin-top:16px' }, heatCard));
    root.appendChild(ui.el('div', { class: 'grid-2', style: 'margin-top:16px' }, loadCard, healthCard));
    root.appendChild(ui.el('div', { style: 'margin-top:16px' }, tierCard));
  }

  WB.ui.stats = { render: render };
})();
