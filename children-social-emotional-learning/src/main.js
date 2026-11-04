/* 心晴岛 · 启动与路由。hash 路由，file:// 与 Electron loadFile 通用。 */
(function () {
  'use strict';
  var U = window.SEL.utils, UI = window.SEL.ui, S = window.SEL.state;
  var Audio = window.SEL.audio, G = window.SEL.games, SC = window.SEL.screens;

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
  }

  /* 全局事件：一次绑定，页面重绘不重复注册 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

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
      S.setSetting(key, !cur);
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

  function welcome() {
    var KEY = 'sunny-isles-welcomed-v1';
    var seen = false;
    try { seen = window.localStorage.getItem(KEY) === '1'; } catch (e) {}
    if (seen) return;
    UI.modal({
      title: '欢迎来到心晴岛 ☁️',
      art: '<div style="display:flex;justify-content:center;gap:4px;align-items:flex-end">' +
        window.SEL.art.buddy('owl', 'happy', 76) + window.SEL.art.buddy('cloud', 'happy', 118) +
        window.SEL.art.buddy('fox', 'happy', 78) + '</div>',
      body: '<p>我是小云朵<b>团团</b>，这两位是<b>咕咕老师</b>和<b>小火苗</b>。</p>' +
        '<p class="muted">这里有五座小岛、会开花的签到、还有一整个冷静工具箱。' +
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
    setTimeout(welcome, 450);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
