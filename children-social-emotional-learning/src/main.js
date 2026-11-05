/* 心晴岛 · 启动与路由。hash 路由，file:// 与 Electron loadFile 通用。 */
(function () {
  'use strict';
  var U = window.SEL.utils, UI = window.SEL.ui, S = window.SEL.state;
  var Audio = window.SEL.audio, G = window.SEL.games, SC = window.SEL.screens;
  var Calm = window.SEL.calm, ST = window.SEL.screentime;
  var currentRoute = 'home';

  function parts() {
    return String(window.location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  }

  function errorView(err) {
    return {
      html: '<div class="card center" style="margin:60px auto;max-width:640px">' +
        '<div style="font-size:52px">☁️</div><h2>这一页遇到一点小云朵</h2>' +
        '<p class="muted">别担心，回到首页再试一次就好。</p>' +
        '<pre class="small muted" style="white-space:pre-wrap;text-align:left;background:#FFF8EC;padding:12px;border-radius:12px">' +
        U.esc(String(err && err.message || err)) + '</pre>' +
        '<button class="btn primary" data-nav="#/home">回首页</button></div>',
      mount: function () {}
    };
  }

  function render() {
    G.cleanup();
    UI.closeModal();
    UI.resetSay();
    Audio.stopSpeak();

    var p = parts(), view;
    currentRoute = p[0] || 'home';
    try {
      if (!window.SEL_DATA || !window.SEL_DATA.islands) throw new Error('课程内容还没加载好');
      switch (p[0]) {
        case '': case 'home': view = SC.home(); break;
        case 'map': view = SC.map(); break;
        case 'island': view = SC.island(p[1]); break;
        case 'level': view = SC.level(p[1]); break;
        case 'emotions': view = SC.emotions(); break;
        case 'help': view = SC.help(); break;
        case 'checkin': view = SC.checkin(); break;
        case 'strategies': view = SC.strategies(); break;
        case 'garden': view = SC.garden(); break;
        case 'stickers': view = SC.stickers(); break;
        case 'report': view = SC.report(); break;
        case 'parent': view = SC.parent(); break;
        case 'profile': view = SC.profile(); break;
        case 'settings': view = SC.settings(); break;
        default: view = SC.home();
      }
    } catch (e) {
      console.error('[心晴岛] 页面渲染出错：', e);
      view = errorView(e);
    }

    /* 换掉 #screen 节点，顺带丢弃上一次绑在它上面的委托事件，避免监听器累积 */
    var oldScreen = document.getElementById('screen');
    var screen = document.createElement('main');
    screen.id = 'screen';
    screen.setAttribute('role', 'main');
    screen.setAttribute('tabindex', '-1');
    oldScreen.parentNode.replaceChild(screen, oldScreen);
    screen.innerHTML = view.html;
    document.getElementById('topbar').innerHTML = UI.topbar();
    document.body.classList.toggle('reduce-motion', S.current().settings.reduceMotion === true);
    try { view.mount(screen); }
    catch (e) {
      console.error('[心晴岛] 交互绑定出错：', e);
      screen.insertAdjacentHTML('beforeend',
        '<div class="card center" style="margin-top:20px"><p class="muted">这一页的小按钮需要重新加载一下。</p>' +
        '<button class="btn primary" data-nav="#/home">回首页</button></div>');
    }
    try { window.scrollTo(0, 0); } catch (e) {}
    /* 换页时被点中的按钮随旧节点一起消失，焦点会掉回 body。
       把焦点交给新页面（不滚动），键盘与读屏用户才能从新内容继续。 */
    try {
      var ae = document.activeElement;
      if (!ae || ae === document.body || !document.body.contains(ae)) {
        screen.focus({ preventScroll: true });
      }
    } catch (e) {}

    /* 冷静角按钮跟着页面走；使用时长/睡前锁在每次换页时复核一次 */
    syncCalm();
    checkTimeLock();
  }

  function checkTimeLock() {
    var info = ST.state();
    var box = document.getElementById('time-lock');
    if (!box) return;
    if (!info.locked) {
      if (!box.hidden) {
        box.hidden = true;
        box.innerHTML = '';
        document.body.classList.remove('time-locked');
        syncCalm();
      }
      return;
    }
    if (box.hidden) {
      box.innerHTML = ST.lockView(info);
      box.hidden = false;
      document.body.classList.add('time-locked');
      UI.closeModal();
      syncCalm();
      try { document.getElementById('screen').setAttribute('aria-hidden', 'true'); } catch (e) {}
    }
  }

  function syncCalm() {
    var info = ST.state();
    if (Calm) Calm.sync(currentRoute, info.locked);
    var screen = document.getElementById('screen');
    if (screen) {
      if (info.locked) screen.setAttribute('aria-hidden', 'true');
      else screen.removeAttribute('aria-hidden');
    }
  }

  /* 全局事件：一次绑定，页面重绘不重复注册 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    /* 情绪急救：任何页面都能就地打开，不换路由、不丢当前关卡进度 */
    if (t.closest('[data-calm-open]')) {
      e.preventDefault();
      Audio.unlock();
      if (Calm) Calm.open();
      return;
    }

    /* 时间锁请大人解锁：先过家长门（PIN 或算术），当天不再弹 */
    if (t.closest('[data-time-unlock]')) {
      e.preventDefault();
      SC.gateModal(function () {
        ST.unlockToday();
        checkTimeLock();
        syncCalm();
        UI.toast('已解锁，今天不再提醒');
      });
      return;
    }

    var nav = t.closest('[data-nav]');
    if (nav) {
      e.preventDefault();
      Audio.unlock(); Audio.sfx('tap'); Audio.stopSpeak();
      UI.closeModal();
      var hash = nav.getAttribute('data-nav');
      if (window.location.hash === hash) render();
      else window.location.hash = hash;
      return;
    }

    var say = t.closest('[data-say]');
    if (say) {
      Audio.unlock();
      Audio.speak(UI.getSay(say.getAttribute('data-say')));
      return;
    }

    var toggle = t.closest('[data-toggle]');
    if (toggle) {
      var key = toggle.getAttribute('data-toggle');
      var cur = S.current().settings[key];
      if (typeof cur !== 'boolean') return;
      S.setSetting(key, !cur);
      /* 关掉朗读时顺手停掉正在念的那一句，不然关完还在念 */
      if (key === 'voice' && cur) Audio.stopSpeak();
      Audio.sfx('tap');
      render();
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { UI.closeModal(); Audio.stopSpeak(); }
  });

  window.addEventListener('hashchange', render);
  window.SEL.render = render;

  /* 使用时长按 20 秒累加：只统计窗口可见的时间，切到后台不算。
     到点由 checkTimeLock 盖上软锁；家长解锁后当天不再打扰。 */
  setInterval(function () {
    try {
      if (document.visibilityState === 'hidden') return;
      var info = ST.state();
      if (!info.locked) S.addUsage(20);
      checkTimeLock();
    } catch (e) {}
  }, 20000);
  document.addEventListener('visibilitychange', function () {
    try { if (document.visibilityState === 'visible') checkTimeLock(); } catch (e) {}
  });

  /* PWA：只有 http(s) 才注册 Service Worker。Electron 走 file://，
     注册会失败（也不该注册），所以按协议跳过，桌面版行为完全不变。 */
  function registerServiceWorker() {
    try {
      if (!('serviceWorker' in navigator)) return;
      if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
      navigator.serviceWorker.register('sw.js').catch(function () { /* 离线预览不阻塞启动 */ });
    } catch (e) {}
  }

  function welcome() {
    var KEY = 'sunny-isles-welcomed-v1';
    var seen = false;
    try { seen = window.localStorage.getItem(KEY) === '1'; } catch (e) {}
    if (seen) return;
    /* 孩子已经自己点去别的页面时，不要再弹窗打断 */
    var p = parts();
    if (p[0] && p[0] !== 'home') return;
    UI.modal({
      title: '欢迎来到心晴岛 ☁️',
      art: '<div style="display:flex;justify-content:center;gap:4px;align-items:flex-end">' +
        window.SEL.art.buddy('owl', 'happy', 76) + window.SEL.art.buddy('cloud', 'happy', 118) +
        window.SEL.art.buddy('fox', 'happy', 78) + '</div>',
      body: '<p>我是小云朵<b>团团</b>，这两位是<b>咕咕老师</b>和<b>小火苗</b>。</p>' +
        '<p class="muted">这里有 ' + (window.SEL_DATA.islands || []).length + ' 座小岛、会开花的签到、还有一整个冷静工具箱。' +
        '没有「答错」，每个选择都会告诉你接下来会发生什么。</p>' +
        '<div class="row" style="justify-content:center"><span class="chip">🔍 认识情绪</span>' +
        '<span class="chip blue">🫧 练会冷静</span><span class="chip green">💛 听懂别人</span></div>',
      actions: [
        { label: '先去逛逛', cls: 'ghost', nav: '#/map' },
        { label: '从签到开始 🌤', cls: 'primary', nav: '#/checkin' }
      ]
    }, function () {});
    try { window.localStorage.setItem(KEY, '1'); } catch (e) {}
  }

  function boot() {
    if (!window.location.hash) window.location.hash = '#/home';
    render();
    registerServiceWorker();
    setTimeout(welcome, 450);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
