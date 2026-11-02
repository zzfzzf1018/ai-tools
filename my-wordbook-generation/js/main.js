/* 单词书 · 路由与启动 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const ui = WB.ui;
  const NAV = [
    ['today', '今日'],
    ['learn', '学习'],
    ['review', '复习'],
    ['notebook', '生词本'],
    ['stats', '统计'],
    ['settings', '设置']
  ];
  const VIEWS = {
    start: 'onboarding',
    today: 'today',
    learn: 'learn',
    review: 'review',
    notebook: 'notebook',
    stats: 'stats',
    settings: 'settings'
  };
  const TITLES = {
    start: '开始',
    today: '今日',
    learn: '学习',
    review: '复习',
    notebook: '生词本',
    stats: '统计',
    settings: '设置'
  };

  let cleanup = null;

  function routeName() {
    const hash = String(location.hash || '').replace(/^#\//, '').split('?')[0];
    return VIEWS[hash] ? hash : 'today';
  }

  function applyTheme() {
    const settings = WB.store.getSettings();
    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const dark = settings.theme === 'dark' ||
      (settings.theme === 'auto' && media && media.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const button = document.getElementById('themeToggle');
    if (button) {
      button.innerHTML = '';
      button.appendChild(ui.icon(dark ? 'sun' : 'moon'));
      button.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
    }
  }

  function refreshChrome() {
    const badge = document.getElementById('tierBadge');
    if (badge) badge.textContent = ui.tierTitle(WB.store.getSettings().tier);
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    WB.store.updateSettings({ theme: current === 'dark' ? 'light' : 'dark' });
    applyTheme();
  }

  function render() {
    let route = routeName();
    if (!WB.store.getSettings().onboardingDone) route = 'start';
    const nav = document.getElementById('nav');
    const view = document.getElementById('view');
    if (!nav || !view) return;

    nav.style.display = route === 'start' ? 'none' : '';
    Array.prototype.forEach.call(nav.querySelectorAll('a'), function (link) {
      if (link.dataset.route === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    view.innerHTML = '';
    view.dataset.route = route;

    const module = WB.ui[VIEWS[route]] || WB.ui.today;
    cleanup = module.render(view) || null;
    document.title = TITLES[route] + ' · 单词书';
    refreshChrome();
  }

  function go(name) {
    const hash = '#/' + name;
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function buildNav() {
    const nav = document.getElementById('nav');
    if (!nav || nav.children.length) return;
    NAV.forEach(function (item) {
      nav.appendChild(ui.el('a', {
        href: '#/' + item[0],
        dataset: { route: item[0] }
      }, item[1]));
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^http/.test(location.protocol)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* ignore */ });
    });
  }

  function init() {
    buildNav();
    applyTheme();
    refreshChrome();
    render();

    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.addEventListener('click', toggleTheme);

    window.addEventListener('hashchange', render);
    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = function () {
        if (WB.store.getSettings().theme === 'auto') applyTheme();
      };
      if (media.addEventListener) media.addEventListener('change', onChange);
      else if (media.addListener) media.addListener(onChange);
    }
    registerServiceWorker();
  }

  WB.main = {
    go: go,
    render: render,
    applyTheme: applyTheme,
    refreshChrome: refreshChrome,
    toggleTheme: toggleTheme
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
