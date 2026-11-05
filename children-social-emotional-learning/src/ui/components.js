/* 心晴岛 · 通用界面组件。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};
  var U = window.SEL.utils;
  var A = window.SEL.art;

  var sayMap = {};
  function say(text) {
    var id = U.uid('say');
    sayMap[id] = String(text || '');
    return 'data-say="' + id + '"';
  }
  function getSay(id) { return sayMap[id] || ''; }
  function resetSay() { sayMap = {}; }

  function speakBtn(text, label) {
    return '<button class="speak-btn" ' + say(text) + ' title="听一听" aria-label="' + U.esc(label || '朗读') + '">🔊</button>';
  }

  function starRow(n, total) {
    total = total || 3;
    var s = '<span class="stars">';
    for (var i = 0; i < total; i++) s += '<span class="' + (i < n ? '' : 'star-off') + '">⭐</span>';
    return s + '</span>';
  }

  function progressBar(pct, label) {
    pct = U.clamp(Math.round(pct), 0, 100);
    return '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      (label ? '<div class="small muted" style="margin-top:6px">' + U.esc(label) + '</div>' : '');
  }

  function sectionHead(title, hint, eyebrow) {
    return '<div class="section-head"><div>' +
      (eyebrow ? '<div class="eyebrow">' + U.esc(eyebrow) + '</div>' : '') +
      '<h2>' + U.esc(title) + '</h2></div>' +
      (hint ? '<div class="hint">' + U.esc(hint) + '</div>' : '') + '</div>';
  }

  function guideRow(text, kind, emotion) {
    return '<div class="guide-row">' +
      '<div class="guide-avatar">' + A.buddy(kind || 'cloud', emotion || 'happy', 76) + '</div>' +
      '<div class="bubble">' + U.esc(text) + '</div>' + speakBtn(text) + '</div>';
  }

  function topbar() {
    var p = window.SEL.state.current();
    var s = p.settings;
    return '<a class="brand" href="#/home" data-nav="#/home">' + A.brandMark(44) +
      '<span class="brand-text"><span class="brand-name">心晴岛</span><br><span class="brand-sub">SUNNY ISLES · 儿童社会情绪学习</span></span></a>' +
      '<div class="top-spacer"></div>' +
      '<div class="top-chip star-chip" title="我的星星">⭐ <span>' + p.stars + '</span></div>' +
      '<button class="top-chip profile-chip" data-nav="#/profile" title="切换小玩家" aria-label="切换小玩家">👤 ' + U.esc(p.name) + '</button>' +
      '<button class="top-btn ' + (s.voice ? '' : 'off') + '" data-toggle="voice" title="朗读开关" aria-label="朗读开关">' + (s.voice ? '🔊' : '🔇') + '</button>' +
      '<button class="top-btn ' + (s.sfx ? '' : 'off') + '" data-toggle="sfx" title="音效开关" aria-label="音效开关">' + (s.sfx ? '🎵' : '🔕') + '</button>' +
      '<button class="top-btn" data-nav="#/parent" title="家长/老师专区" aria-label="家长专区">👨‍👩‍👧</button>';
  }

  function toast(msg) {
    var layer = document.getElementById('toast-layer');
    if (!layer) return;
    var d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    layer.appendChild(d);
    setTimeout(function () { d.remove(); }, 2300);
  }

  var confettiEmoji = ['⭐', '✨', '🌈', '🎉', '💛', '🌸', '🫧'];
  function confetti(n) {
    n = n || 16;
    try { if (window.SEL.state.current().settings.reduceMotion === true) return; } catch (e) {}
    for (var i = 0; i < n; i++) {
      (function (i) {
        setTimeout(function () {
          var e = document.createElement('span');
          e.className = 'confetti';
          e.textContent = confettiEmoji[Math.floor(Math.random() * confettiEmoji.length)];
          e.style.left = (8 + Math.random() * 84) + 'vw';
          e.style.top = (58 + Math.random() * 24) + 'vh';
          e.style.fontSize = (18 + Math.random() * 22) + 'px';
          document.body.appendChild(e);
          setTimeout(function () { e.remove(); }, 1400);
        }, i * 55);
      })(i);
    }
  }

  /* modal({ title, art, body, actions:[{label, cls, nav, act, close}] }, onAct) */
  function modal(opts, onAct) {
    opts = opts || {};
    var old = document.getElementById('overlay');
    if (!old) return;
    var lastFocus = document.activeElement;
    /* 换掉 overlay 节点，避免每次弹窗都叠加一层事件委托 */
    var ov = document.createElement('div');
    ov.id = 'overlay';
    ov.setAttribute('aria-live', 'polite');
    old.parentNode.replaceChild(ov, old);
    var actions = (opts.actions || []).map(function (a) {
      var attrs = '';
      if (a.nav) attrs += ' data-nav="' + U.esc(a.nav) + '"';
      if (a.act) attrs += ' data-modal-act="' + U.esc(a.act) + '"';
      else if (a.close !== false) attrs += ' data-modal-close="1"';
      return '<button class="btn ' + (a.cls || 'primary') + '" ' + attrs + '>' + U.esc(a.label) + '</button>';
    }).join('');
    ov.innerHTML = '<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">' +
      (opts.art ? '<div class="modal-art">' + opts.art + '</div>' : '') +
      (opts.title ? '<h2>' + U.esc(opts.title) + '</h2>' : '') +
      (opts.body || '') +
      (actions ? '<div class="modal-actions">' + actions + '</div>' : '') +
      '</div></div>';
    U.delegate(ov, 'click', '[data-modal-close]', function () { closeModal(); });
    U.delegate(ov, 'click', '[data-modal-act]', function (e, t) {
      if (onAct) onAct(t.getAttribute('data-modal-act'), ov);
    });
    /* 键盘可达：打开时把焦点移进弹窗，Tab 只在弹窗内循环，关闭后还给原来的元素 */
    ov._lastFocus = lastFocus;
    function focusable() {
      return U.$$('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])', ov);
    }
    var firstBtn = focusable()[0];
    if (firstBtn && firstBtn.focus) { try { firstBtn.focus(); } catch (e) {} }
    ov.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = focusable();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.body.classList.add('modal-open');
    if (opts.onMount) opts.onMount(ov);
  }

  function closeModal() {
    var ov = document.getElementById('overlay');
    if (ov) {
      var back = ov._lastFocus;
      ov.innerHTML = '';
      if (back && back.focus && document.body.contains(back)) {
        try { back.focus(); } catch (e) {}
      }
      ov._lastFocus = null;
    }
    document.body.classList.remove('modal-open');
  }

  function confirm(opts, onYes) {
    modal({
      title: opts.title || '确认一下', art: opts.art || '🤔',
      body: '<p class="muted">' + U.esc(opts.text || '') + '</p>',
      actions: [
        { label: '再想想', cls: 'ghost', close: true },
        { label: opts.yes || '好的', cls: opts.danger ? 'pink' : 'primary', act: 'yes' }
      ]
    }, function (act) {
      if (act === 'yes') { closeModal(); onYes(); }
    });
  }

  function emptyState(emoji, title, text, actionHtml) {
    return '<div class="card center" style="padding:44px 24px">' +
      '<div style="font-size:60px">' + emoji + '</div><h3 style="margin:10px 0">' + U.esc(title) + '</h3>' +
      '<p class="muted">' + U.esc(text) + '</p>' + (actionHtml || '') + '</div>';
  }

  window.SEL.ui = {
    say: say, getSay: getSay, resetSay: resetSay, speakBtn: speakBtn,
    starRow: starRow, progressBar: progressBar, sectionHead: sectionHead,
    guideRow: guideRow, topbar: topbar, toast: toast, confetti: confetti,
    modal: modal, closeModal: closeModal, confirm: confirm, emptyState: emptyState
  };
})();
