/* 心晴岛 · 通用界面组件。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};
  var U = window.SEL.utils;
  var A = window.SEL.art;

  var sayMap = {};
  function sayId(text) {
    var id = U.uid('say');
    sayMap[id] = String(text || '');
    return id;
  }
  function say(text) { return 'data-say="' + sayId(text) + '"'; }
  function getSay(id) { return sayMap[id] || ''; }
  function resetSay() { sayMap = {}; }

  function speakBtn(text, label, role) {
    return '<button class="speak-btn" ' + say(text) +
      (role ? ' data-role="' + U.esc(role) + '"' : '') +
      ' title="听一听" aria-label="' + U.esc(label || '朗读') + '">🔊</button>';
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
    var role = kind === 'owl' ? 'owl' : (kind === 'fox' ? 'fox' : 'cloud');
    return '<div class="guide-row" data-role="' + role + '">' +
      '<div class="guide-avatar">' + A.buddy(kind || 'cloud', emotion || 'happy', 76) + '</div>' +
      '<div class="bubble">' + U.esc(text) + '</div>' + speakBtn(text, '听一听', role) + '</div>';
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

  /* 彩带/练习计时等"短暂动画"用的计时器登记：弹窗关闭或路由切换时统一清掉，
     避免脱离 DOM 的节点背后还挂着一两个计时器空转 */
  var transient = [];
  function later(fn, ms) {
    var entry = { id: null, kind: 't' };
    entry.id = setTimeout(function () {
      transient = transient.filter(function (x) { return x !== entry; });
      fn();
    }, ms);
    transient.push(entry);
    return entry.id;
  }
  function every(fn, ms) {
    var entry = { id: setInterval(fn, ms), kind: 'i' };
    transient.push(entry);
    entry.stop = function () {
      clearInterval(entry.id);
      transient = transient.filter(function (x) { return x !== entry; });
    };
    return entry.stop;
  }
  function clearTransient() {
    transient.splice(0).forEach(function (x) {
      try { if (x.kind === 'i') clearInterval(x.id); else clearTimeout(x.id); } catch (e) {}
    });
    U.$$('.confetti', document.body).forEach(function (e) { e.remove(); });
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
        later(function () {
          var e = document.createElement('span');
          e.className = 'confetti';
          e.textContent = confettiEmoji[Math.floor(Math.random() * confettiEmoji.length)];
          e.style.left = (8 + Math.random() * 84) + 'vw';
          e.style.top = (58 + Math.random() * 24) + 'vh';
          e.style.fontSize = (18 + Math.random() * 22) + 'px';
          document.body.appendChild(e);
          later(function () { e.remove(); }, 1400);
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
    ov.innerHTML = '<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" ' +
      'aria-label="' + U.esc(opts.title || '提示') + '">' +
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
    /* 弹窗一关，挂在它上面的彩带/练习计时立刻停，不留后台空转 */
    clearTransient();
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

  /* ---------- 逐句点读（v1.3.0） ----------
     - 非交互文本随时可点（带 data-say，走 main.js 的全局委托）
     - 选项/卡片这类交互元素只在「点读模式」下朗读：捕获阶段拦截，
       保证点它只念、不选中，不会误触发游戏逻辑
     - 自动朗读与手动点读都高亮当前那一句，被打断或念完自动清除 */
  var readMode = false;
  var READ_SELECTORS = [
    '.level-head h2', '.guide-row .bubble', '.game-prompt', '.game-instruction',
    '.option-btn', '.pair-col-label', '.pair-item', '.order-item .ord-text',
    '.drag-item', '.bucket', '.bucket h4', '.slider-labels span', '.story-text', '.story-moral',
    '.feedback-box', '.breath-cue', '.say-scene', '.say-demo p', '.say-frame',
    '.say-audience label'
  ];
  var INTERACTIVE = /(?:^|\s)(option-btn|pair-item|drag-item|order-item|bucket)(?:\s|$)/;

  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  function markOne(el) {
    /* 去掉 emoji / 序号 / 上下箭头这类装饰再取文本：
       否则「🫧先在心里…」和朗读稿里的「做法 1：先在心里…」互不为子串，
       自动读题到选项时高亮就找不到对应元素。 */
    var clone = el.cloneNode(true);
    U.$$('.opt-emoji, .di-emoji, .ord-emoji, .sf-emoji, .pair-face, .ord-num, .ord-move, .breath-dots', clone)
      .forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    var text = clean(clone.textContent);
    if (text.length < 2) return;
    var interactive = INTERACTIVE.test(el.className || '') || !!el.closest('.bucket');
    var hasControl = !!el.querySelector('button, a, input, select, textarea');
    /* 手动点读与旁边小喇叭用同一个角色的声音：guide-row / story-top 会带 data-role */
    var roleHost = el.closest('[data-role]');
    var role = roleHost ? roleHost.getAttribute('data-role') : 'cloud';
    el.setAttribute('data-read', text);
    el.setAttribute('data-role', role);
    el.classList.add('readable');
    if (!interactive && !hasControl) el.setAttribute('data-say', sayId(text));
    else el.removeAttribute('data-say');
  }
  function markReadable(root) {
    if (!root) return;
    U.$$(READ_SELECTORS.join(','), root).forEach(markOne);
  }
  function clearHighlight() {
    U.$$('.reading', document.body).forEach(function (el) { el.classList.remove('reading'); });
  }
  function highlight(text) {
    var t = clean(text), best = null, score = 0;
    clearHighlight();
    U.$$('[data-read]', document.body).forEach(function (el) {
      var own = clean(el.getAttribute('data-read') || '');
      if (own.length < 2) return;
      var s = 0;
      if (t.indexOf(own) >= 0) s = own.length;                 /* 朗读稿带前缀，取元素文本长度 */
      else if (own.indexOf(t) >= 0 && t.length > 4) s = t.length;
      if (s > score) { best = el; score = s; }
    });
    if (best) best.classList.add('reading');
    return best;
  }
  function readElement(el) {
    var text = clean(el.getAttribute('data-read') || el.textContent);
    if (!text) return;
    window.SEL.audio.speak(text, {
      role: el.getAttribute('data-role') || undefined,
      onItem: function () { clearHighlight(); el.classList.add('reading'); },
      onDone: clearHighlight, onStop: clearHighlight
    });
  }
  function setReadMode(on) {
    readMode = !!on;
    document.body.classList.toggle('read-mode', readMode);
    if (!readMode) clearHighlight();
  }
  function isReadMode() { return readMode; }

  /* 没检测到中文语音时给家长的可操作提示：只在明确 missing/unsupported 时出现，
     getVoices() 一直为空算 unknown，不误报（有些环境不列声音但仍能念中文）。 */
  function voiceHint(compact) {
    var st = window.SEL.audio.voiceStatus();
    var help = {};
    try { help = window.SEL.state.data().voiceHelp || {}; } catch (e) {}
    if (st.state === 'ok' || st.state === 'unknown') return '';
    var title = st.state === 'unsupported'
      ? '这台浏览器不支持朗读，可以换用 Chrome / Edge 或桌面版。'
      : (help.missing || '还没检测到中文语音。');
    if (compact) {
      return '<div class="voice-hint compact" data-voice-hint role="status">👨‍👩‍👧 给家长：' + U.esc(title) +
        ' <button class="btn tiny ghost" data-nav="#/settings">看怎么添加 →</button></div>';
    }
    var steps = Array.isArray(help.steps) ? help.steps : [];
    return '<div class="voice-hint" data-voice-hint role="status"><b>👨‍👩‍👧 给家长：' + U.esc(title) + '</b>' +
      (st.state === 'missing' && steps.length
        ? '<ul>' + steps.map(function (s) { return '<li>' + U.esc(s) + '</li>'; }).join('') + '</ul>'
        : '') +
      /* 浏览器压根不支持朗读时，给一个点了没反应的按钮只会更困惑 */
      (st.state === 'missing' ? '<button class="btn tiny blue" data-voice-test>🔊 试听一句</button>' : '') +
      '</div>';
  }

  window.SEL.ui = {
    say: say, sayId: sayId, getSay: getSay, resetSay: resetSay, speakBtn: speakBtn,
    starRow: starRow, progressBar: progressBar, sectionHead: sectionHead,
    guideRow: guideRow, topbar: topbar, toast: toast, confetti: confetti,
    later: later, every: every, clearTransient: clearTransient,
    modal: modal, closeModal: closeModal, confirm: confirm, emptyState: emptyState,
    markReadable: markReadable, setReadable: markOne, highlight: highlight,
    clearHighlight: clearHighlight, readElement: readElement,
    setReadMode: setReadMode, isReadMode: isReadMode, voiceHint: voiceHint
  };
})();
