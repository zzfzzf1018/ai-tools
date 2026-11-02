/* 单词书 · 今日页 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const ui = WB.ui;

  const TIPS = [
    '间隔重复：在快要忘记的时候复习，记忆最牢固。',
    '主动回忆：先遮住答案想一遍，比反复阅读更有效。',
    '睡眠会巩固记忆，学完后的当晚是黄金复习窗口。',
    '少量多次：每天二十个新词，坚持比突击更重要。',
    '答错的词会被自动收进生词本，本轮稍后还会再见一次。'
  ];

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 5) return '夜深了，学几个就休息吧。';
    if (hour < 11) return '早上好，先来一组新词。';
    if (hour < 14) return '中午好，用几分钟过一遍。';
    if (hour < 18) return '下午好，继续今天的进度。';
    return '晚上好，今天学一点。';
  }

  function render(root) {
    const settings = WB.store.getSettings();
    const today = WB.date.today();
    const daily = WB.store.getDaily()[today] || {};
    const cards = WB.store.getCards();
    const notebook = WB.store.getNotebook();
    const dueCount = Object.keys(cards).filter(function (key) {
      const card = cards[key];
      return card && card.state && card.state !== 'new' && String(card.due || '') <= today;
    }).length;
    const pool = WB.words.pending(settings.tier, cards, settings.skipBasic);
    const newRemaining = Math.max(0, settings.dailyNew - (daily.newCount || 0));
    const newToday = Math.min(newRemaining, pool.length);
    const learned = WB.words.list(settings.tier).filter(function (word) {
      const card = cards[word.w];
      return card && card.reps > 0;
    }).length;
    const target = WB.words.tierTarget(settings.tier);
    const notebookCount = Object.keys(notebook).length;
    const mastered = Object.keys(notebook).filter(function (key) { return notebook[key].mastered; }).length;
    const accuracy = daily.total ? Math.round(((daily.correct || 0) / daily.total) * 100) + '%' : '—';
    const percent = Math.min(100, Math.round(((daily.newCount || 0) / settings.dailyNew) * 100));

    const forecast = [];
    let maxForecast = 1;
    for (let i = 0; i < 7; i += 1) {
      const key = WB.date.addDays(today, i);
      let count = 0;
      Object.keys(cards).forEach(function (w) {
        const card = cards[w];
        if (!card || !card.state || card.state === 'new') return;
        if (i === 0 ? String(card.due || '') <= today : card.due === key) count += 1;
      });
      maxForecast = Math.max(maxForecast, count);
      forecast.push({
        key: key,
        count: count,
        label: i === 0 ? '今天' : i === 1 ? '明天' : WB.date.short(key)
      });
    }

    const bars = forecast.map(function (item) {
      const height = item.count ? Math.max(10, Math.round((item.count / maxForecast) * 92)) : 3;
      return ui.el('div', { class: 'fday', title: item.key + ' · ' + item.count + ' 张到期' },
        ui.el('span', { class: 'n' }, item.count ? String(item.count) : ''),
        ui.el('i', {
          class: 'fbar' + (item.count ? (item.count >= maxForecast ? ' has many' : ' has') : ''),
          style: 'height:' + height + 'px'
        }),
        ui.el('span', { class: 'd' }, item.label)
      );
    });

    const hero = ui.el('section', { class: 'today-hero' },
      ui.el('div', { class: 'hero-copy' },
        ui.el('div', { class: 'eyebrow' }, WB.date.formatCN(today)),
        ui.el('h1', { style: 'margin-top:8px' }, greeting()),
        ui.el('p', { class: 'lede' },
          '当前词库：' + ui.tierTitle(settings.tier) + '　·　今日新词 ' +
          String(daily.newCount || 0) + ' / ' + String(settings.dailyNew)),
        ui.el('div', { class: 'hero-actions' },
          newToday > 0
            ? ui.el('button', {
                class: 'btn primary lg',
                type: 'button',
                onclick: function () { WB.main.go('learn'); }
              }, '开始学习 · ' + newToday + ' 词')
            : ui.el('button', { class: 'btn primary lg', type: 'button', disabled: true },
                pool.length === 0 ? '当前词库已学完' : '今日新词已完成'),
          dueCount > 0
            ? ui.el('button', {
                class: 'btn lg',
                type: 'button',
                onclick: function () { WB.main.go('review'); }
              }, '开始复习 · ' + dueCount + ' 张')
            : ui.el('button', { class: 'btn lg', type: 'button', disabled: true }, '暂无到期复习')
        )
      ),
      ui.el('div', { class: 'ring-wrap' },
        ui.el('div', { class: 'ring', style: '--p:' + percent },
          ui.el('div', { class: 'ring-label' },
            ui.el('b', null, percent + '%'),
            ui.el('span', null, '今日新词目标')
          )
        ),
        ui.el('span', { class: 'muted tiny' }, '已完成 ' + String(daily.newCount || 0) + ' 个新词')
      )
    );

    const stats = ui.el('div', { class: 'stat-grid' },
      ui.stat('连续打卡', String(WB.store.streak()), '天'),
      ui.stat('生词本', String(notebookCount), '词'),
      ui.stat('已掌握', String(mastered), '词'),
      ui.stat('今日正确率', accuracy)
    );

    const forecastCard = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' },
        ui.el('h2', null, '未来 7 天复习'),
        ui.el('span', { class: 'muted tiny' }, '按到期日统计')
      ),
      ui.el('div', { class: 'forecast' }, bars),
      ui.el('p', { class: 'muted tiny', style: 'margin-top:8px' },
        '今天有 ' + dueCount + ' 张卡片到期，复习上限为 ' + settings.reviewCap + ' 张。')
    );

    const tipIndex = WB.date.diff('2026-01-01', today) % TIPS.length;
    const tipCard = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' }, ui.el('h2', null, '记忆方法')),
      ui.el('div', { class: 'tip' },
        ui.el('span', { class: 'seal' }, '记'),
        ui.el('div', null,
          ui.el('p', null, TIPS[Math.abs(tipIndex)]),
          ui.el('p', { class: 'muted tiny', style: 'margin-top:4px' },
            'SM-2 间隔重复 + 主动回忆 + 错词强化')
        )
      )
    );

    const tierCard = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' },
        ui.el('h2', null, '词库进度'),
        ui.el('span', { class: 'chip accent' }, ui.tierTitle(settings.tier))
      ),
      ui.el('div', { class: 'tier-progress' },
        ui.el('div', { class: 'tier-line' },
          ui.el('div', { class: 'head' },
            ui.el('b', null, ui.tierLabel(settings.tier)),
            ui.el('span', null, ui.num(learned) + ' / ' + ui.num(target))
          ),
          ui.el('div', { class: 'track' },
            ui.el('i', { style: 'width:' + Math.min(100, (learned / target) * 100) + '%' })
          )
        )
      ),
      ui.el('p', { class: 'muted tiny', style: 'margin-top:10px' },
        '前 2,000 词覆盖日常对话，4,000 词覆盖影视，8,000 词覆盖书报阅读。')
    );

    root.appendChild(hero);
    root.appendChild(stats);
    root.appendChild(ui.el('div', { class: 'grid-2', style: 'margin-top:16px' }, forecastCard, tipCard));
    root.appendChild(ui.el('div', { style: 'margin-top:16px' }, tierCard));
  }

  WB.ui.today = { render: render };
})();
