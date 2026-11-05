/* 心晴岛 · 情绪急救角。
   任何页面右上角都有一个「我现在有点难受」的按钮：点开只盖一层弹窗，
   不换路由、不重绘当前关卡，关掉就回到刚才那一题。60 秒呼吸可随时结束。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};
  var U = window.SEL.utils, UI = window.SEL.ui, S = window.SEL.state, Audio = window.SEL.audio;

  var SECONDS = 60;

  function phaseOf(elapsed) {
    /* 4 秒吸气 → 2 秒停 → 6 秒呼气，12 秒一轮，60 秒正好 5 轮 */
    var t = elapsed % 12;
    if (t < 4) return { key: 'in', name: '吸气', left: 4 - t, cue: '鼻子慢慢吸，肚子像气球鼓起来 🫧' };
    if (t < 6) return { key: 'hold', name: '停一下', left: 6 - t, cue: '轻轻停住，不着急' };
    return { key: 'out', name: '呼气', left: 12 - t, cue: '嘴巴慢慢呼，肩膀放下来 🌿' };
  }

  function open() {
    var body = '<div data-calm>' +
      '<p class="muted small">不用离开现在的页面。跟着大泡泡呼吸 60 秒，想停就停。</p>' +
      '<div class="breath-stage" style="padding-top:6px">' +
        '<div class="breath-orb" data-calm-orb style="width:170px;height:170px;font-size:20px">准备好了吗</div>' +
        '<div class="breath-cue" data-calm-cue style="font-size:17px;margin-top:12px">点「开始」，我们一起慢下来</div>' +
        '<div class="calm-clock" data-calm-clock>60 秒</div>' +
      '</div>' +
      '<div style="margin-top:16px"><button class="btn primary" data-modal-act="start">开始 60 秒 ▶</button></div>' +
      '<p class="small muted" style="margin-top:12px">情绪上来的时候，先让身体慢下来，再决定怎么做。</p>' +
      '</div>';

    UI.modal({
      title: '给自己 60 秒 🌿',
      art: '🫧',
      body: body,
      actions: [{ label: '先不用，回去继续', cls: 'ghost', close: true }]
    }, function (act, ov) {
      if (act !== 'start') return;
      var run = U.$('[data-calm]', ov);
      if (!run) return;
      var orb = U.$('[data-calm-orb]', run);
      var cue = U.$('[data-calm-cue]', run);
      var clock = U.$('[data-calm-clock]', run);
      var startBtn = U.$('[data-modal-act="start"]', run);
      if (startBtn) { startBtn.disabled = true; startBtn.textContent = '正在练习…'; }

      var elapsed = 0;
      var tick = null;
      Audio.unlock(); Audio.sfx('pop');

      function finish() {
        if (tick) { tick(); tick = null; }
        orb.className = 'breath-orb';
        orb.textContent = '做到啦';
        cue.textContent = '你刚刚给自己留了一点点空间 🌿';
        clock.textContent = '60 / 60 秒';
        S.practiceStrategy('breathing');
        Audio.sfx('win');
        UI.confetti(10);
        if (startBtn) {
          startBtn.textContent = '完成 ✓';
          startBtn.disabled = true;
        }
        var tip = document.createElement('div');
        tip.className = 'chip green';
        tip.style.marginTop = '12px';
        tip.textContent = '冷静角练习 +1';
        run.appendChild(tip);
      }

      function step() {
        elapsed += 1;
        if (elapsed >= SECONDS) { finish(); return; }
        var ph = phaseOf(elapsed);
        orb.className = 'breath-orb ' + ph.key;
        orb.textContent = ph.name + ' ' + Math.ceil(ph.left);
        cue.textContent = ph.cue;
        clock.textContent = (SECONDS - elapsed) + ' 秒';
        if (elapsed % 4 === 0) Audio.sfx('bubble');
      }

      tick = UI.every(step, 1000);
      step();
    });
  }

  /* 只在儿童页面显示；家长区/设置/周报是大人看的，不打扰。
     锁屏（使用时长到）时由 main.js 隐藏。 */
  function visibleOn(route) {
    return ['', 'home', 'map', 'island', 'level', 'emotions', 'help', 'checkin',
      'strategies', 'garden', 'stickers'].indexOf(route) >= 0;
  }

  function sync(route, locked) {
    var btn = document.getElementById('calm-fab');
    if (!btn) return;
    var show = visibleOn(route) && !locked;
    btn.hidden = !show;
    btn.setAttribute('aria-hidden', show ? 'false' : 'true');
    btn.tabIndex = show ? 0 : -1;
  }

  window.SEL.calm = { open: open, sync: sync, visibleOn: visibleOn, SECONDS: SECONDS };
})();
