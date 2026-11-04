/* 心晴岛 · 声音。全部用 Web Audio 实时合成 + 系统语音，不加载任何音频文件。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};

  var ctx = null;
  var master = null;
  var unlocked = false;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function unlock() {
    var c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(function () {});
    unlocked = true;
  }

  /* 单个音符：freq 频率、dur 秒、type 波形、delay 延迟、vol 音量 */
  function tone(freq, dur, type, delay, vol) {
    var c = ensure();
    if (!c || !master) return;
    try {
      var t0 = c.currentTime + (delay || 0);
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.5, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    } catch (e) { /* 忽略音频设备异常，不影响游戏 */ }
  }

  function noise(dur, vol) {
    var c = ensure();
    if (!c || !master) return;
    try {
      var len = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, len, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = c.createBufferSource(); src.buffer = buf;
      var g = c.createGain(); g.gain.value = vol || 0.15;
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (e) {}
  }

  var patterns = {
    tap:      function () { tone(660, 0.09, 'sine', 0, 0.35); },
    pop:      function () { tone(880, 0.08, 'triangle', 0, 0.4); tone(1180, 0.09, 'sine', 0.06, 0.28); },
    select:   function () { tone(523, 0.1, 'sine', 0, 0.35); tone(659, 0.12, 'sine', 0.07, 0.3); },
    good:     function () { tone(523, 0.13, 'sine', 0, 0.4); tone(659, 0.13, 'sine', 0.1, 0.4); tone(784, 0.22, 'sine', 0.2, 0.4); },
    tryagain: function () { tone(440, 0.16, 'sine', 0, 0.28); tone(392, 0.2, 'sine', 0.12, 0.25); },
    star:     function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, 0.18, 'sine', i * 0.09, 0.35); }); },
    win:      function () { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, 0.2, 'triangle', i * 0.11, 0.32); }); },
    whoosh:   function () { noise(0.22, 0.09); },
    bubble:   function () { tone(392, 0.12, 'sine', 0, 0.3); tone(523, 0.16, 'sine', 0.08, 0.25); },
    breathe:  function () { tone(330, 0.9, 'sine', 0, 0.18); },
    plant:    function () { tone(392, 0.12, 'sine', 0, 0.3); tone(523, 0.14, 'sine', 0.1, 0.3); tone(659, 0.2, 'sine', 0.2, 0.3); }
  };

  function enabled() {
    try { return window.SEL.state.current().settings.sfx !== false; }
    catch (e) { return true; }
  }

  function sfx(name, force) {
    if (!force && !enabled()) return;
    unlock();
    var p = patterns[name];
    if (p) p();
  }

  /* 中文朗读。系统无中文语音时静默失败，不影响任何功能。 */
  function speak(text, opts) {
    if (!text) return;
    try {
      if (window.SEL.state.current().settings.voice === false) return;
    } catch (e) {}
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'zh-CN';
      u.rate = (opts && opts.rate) || 0.92;
      u.pitch = (opts && opts.pitch) || 1.12;
      u.volume = 1;
      var voices = window.speechSynthesis.getVoices() || [];
      var zh = voices.filter(function (v) { return /zh|cmn|Chinese/i.test(v.lang + ' ' + v.name); })[0];
      if (zh) u.voice = zh;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  function stopSpeak() {
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
  }

  window.SEL.audio = {
    unlock: unlock, sfx: sfx, speak: speak, stopSpeak: stopSpeak, tone: tone
  };

  /* 第一次点击/按键后解锁音频上下文（浏览器自动播放策略） */
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
})();
