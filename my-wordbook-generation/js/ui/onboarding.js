/* 单词书 · 首次引导 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const ui = WB.ui;

  const TIERS = [
    { t: 1, num: '2,000', name: '日常对话', desc: '覆盖生活口语与基础交流，应付大多数日常场景。' },
    { t: 2, num: '4,000', name: '影视观赏', desc: '在日常词基础上加入影视高频表达，不带字幕也能跟上。' },
    { t: 3, num: '8,000', name: '阅读书报', desc: '覆盖新闻、小说与非虚构文章，流畅阅读原版书报。' }
  ];

  function render(root) {
    const settings = WB.store.getSettings();
    let tier = settings.tier || 1;
    let dailyNew = settings.dailyNew || 20;
    let theme = settings.theme || 'auto';

    function draw() {
      root.innerHTML = '';
      const tierCards = TIERS.map(function (item) {
        return ui.el('button', {
          class: 'tier-choice',
          type: 'button',
          'aria-pressed': String(tier === item.t),
          onclick: function () { tier = item.t; draw(); }
        },
          ui.el('div', { class: 'num' }, item.num),
          ui.el('div', { class: 'name' }, item.name),
          ui.el('div', { class: 'desc' }, item.desc)
        );
      });

      const dailyChoices = [10, 20, 30, 50].map(function (value) {
        return ui.el('button', {
          type: 'button',
          'aria-pressed': String(dailyNew === value),
          onclick: function () { dailyNew = value; draw(); }
        }, String(value) + ' 词');
      });

      const themeChoices = [
        { value: 'auto', label: '跟随系统' },
        { value: 'light', label: '浅色' },
        { value: 'dark', label: '深色' }
      ].map(function (item) {
        return ui.el('button', {
          type: 'button',
          'aria-pressed': String(theme === item.value),
          onclick: function () { theme = item.value; draw(); }
        }, item.label);
      });

      root.appendChild(ui.el('div', { class: 'onboard' },
        ui.el('div', { class: 'onboard-hero' },
          ui.el('div', { class: 'eyebrow' }, '离线单词书'),
          ui.el('h1', null, '把单词真正记住'),
          ui.el('p', { class: 'lede' },
            '按场景分级收录 2,000 / 4,000 / 8,000 词。每天少量新词，配合间隔重复与主动回忆，把单词从“见过”变成“记得”。')
        ),

        ui.el('div', { class: 'card onboard-section' },
          ui.el('h2', null, '选择词库目标'),
          ui.el('div', { class: 'sub' }, '三级词库逐级累积，之后可以在设置里随时切换。'),
          ui.el('div', { class: 'tier-grid' }, tierCards)
        ),

        ui.el('div', { class: 'card onboard-section' },
          ui.el('div', { class: 'row between' },
            ui.el('div', null,
              ui.el('h2', null, '每天学习多少新词'),
              ui.el('div', { class: 'sub' }, '少量、稳定、每天坚持，比一次背很多更有效。')
            ),
            ui.el('div', { class: 'segmented' }, dailyChoices)
          )
        ),

        ui.el('div', { class: 'card onboard-section' },
          ui.el('div', { class: 'row between' },
            ui.el('div', null,
              ui.el('h2', null, '界面主题'),
              ui.el('div', { class: 'sub' }, '纸墨书房风格，深色模式适合夜间学习。')
            ),
            ui.el('div', { class: 'segmented' }, themeChoices)
          )
        ),

        ui.el('div', { class: 'onboard-actions' },
          ui.el('button', {
            class: 'btn primary lg',
            type: 'button',
            onclick: function () {
              WB.store.updateSettings({ tier: tier, dailyNew: dailyNew, theme: theme, onboardingDone: true });
              if (WB.main) {
                WB.main.applyTheme();
                WB.main.go('today');
              }
              ui.toast('已准备好，开始今天的学习');
            }
          }, '开始学习')
        ),

        ui.el('p', { class: 'muted tiny', style: 'text-align:center;margin-top:18px' },
          '词库来自 ECDICT（MIT 协议）· 所有数据只保存在本机浏览器')
      ));
    }

    draw();
  }

  WB.ui.onboarding = { render: render };
})();
