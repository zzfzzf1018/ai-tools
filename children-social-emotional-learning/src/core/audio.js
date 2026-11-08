/* 心晴岛 · 声音。全部用 Web Audio 实时合成 + 系统语音，不加载任何音频文件。
   朗读部分支持「排队连读」：读题时把题目、说明、选项依次念完，切页或新的一句
   朗读会作废旧队列，不会在另一个页面继续念上一关的文字。 */
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

  /* 中文语音选择。Chrome/Electron 首次调用 getVoices() 往往返回空数组，
     要等 voiceschanged 之后才有；缓存一份，避免第一句用英文声音念中文。 */
  var zhVoice = null;
  function pickZhVoice() {
    try {
      var voices = window.speechSynthesis.getVoices() || [];
      if (!voices.length) return null;
      var zh = voices.filter(function (v) { return /^(zh|cmn)|Chinese/i.test((v.lang || '') + ' ' + (v.name || '')); });
      /* 普通话（zh-CN）优先，其次本地语音（离线可用、不依赖在线语音服务） */
      zh.sort(function (a, b) {
        var ac = /^zh[-_]CN/i.test(a.lang || '') ? 0 : 1;
        var bc = /^zh[-_]CN/i.test(b.lang || '') ? 0 : 1;
        if (ac !== bc) return ac - bc;
        if (a.localService === b.localService) return 0;
        return a.localService ? -1 : 1;
      });
      return zh[0] || null;
    } catch (e) { return null; }
  }

  /* 中文语音可用性检测。getVoices() 首次常为空，要等 voiceschanged；
     一直为空时只报 unknown（有些环境不列声音但仍能念中文），不误报给家长。 */
  var voiceListeners = [];
  function isZhVoice(v) { return /^(zh|cmn)|Chinese/i.test((v.lang || '') + ' ' + (v.name || '')); }
  function voiceStatus() {
    if (!('speechSynthesis' in window)) return { state: 'unsupported', zh: 0, total: 0 };
    var voices = [];
    try { voices = window.speechSynthesis.getVoices() || []; } catch (e) {}
    if (!voices.length) return { state: 'unknown', zh: 0, total: 0 };
    var zh = voices.filter(isZhVoice).length;
    return { state: zh ? 'ok' : 'missing', zh: zh, total: voices.length };
  }
  function onVoicesChange(fn) {
    if (typeof fn === 'function' && voiceListeners.indexOf(fn) < 0) voiceListeners.push(fn);
  }

  /* 角色化语音：同一套本机中文语音，用音高/语速区分三位伙伴 */
  function roles() {
    try { return (window.SEL.state.data().voiceRoles || {}); }
    catch (e) { return {}; }
  }
  function voiceRolesEnabled() {
    try { return window.SEL.state.current().settings.voiceRoles !== false; }
    catch (e) { return true; }
  }
  function roleForSpeaker(name) {
    var s = String(name || '');
    if (s.indexOf('咕咕') >= 0) return 'owl';
    if (s.indexOf('小火苗') >= 0 || s.indexOf('火苗') >= 0) return 'fox';
    return 'cloud';
  }

  /* ---------------- 朗读队列 ----------------
     voice      总开关：关掉后所有朗读（含手动小喇叭）都不出声
     autoRead   自动引导开关：只管「不需要孩子点小喇叭」的朗读（读题、反馈、鼓励、结算）
     voiceRate  语速 0.7–1.2，家长可调
     voiceRoles 角色化语音开关；每句可带 role 覆盖整段默认角色                        */
  var queue = [];
  var speaking = false;
  var gen = 0;
  var spokenLog = [];

  function settings() {
    try { return window.SEL.state.current().settings || {}; }
    catch (e) { return {}; }
  }
  function voiceEnabled() { return settings().voice !== false; }
  function autoReadEnabled() { return voiceEnabled() && settings().autoRead !== false; }
  function readRate() {
    var r = Number(settings().voiceRate);
    return isFinite(r) && r >= 0.7 && r <= 1.2 ? r : 0.9;
  }
  function cleanText(t) {
    return String(t == null ? '' : t).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
  function log(t) { spokenLog.push(t); if (spokenLog.length > 200) spokenLog.shift(); }

  var activeOpts = null;   /* 当前正在念的这一段的参数（onItem/onDone/onStop 都挂在它上面） */
  var watchdog = null;     /* 平台偶发「cancel 后紧接 speak 被吞、且不回调」时，兜底复位 speaking */

  function notifyStop() {
    /* 一段朗读被打断时也要通知界面复位：否则播报条会永远停在「正在读…」。 */
    if (activeOpts && activeOpts.onStop) {
      try { activeOpts.onStop(); } catch (e) {}
    }
    activeOpts = null;
  }

  function pump() {
    if (speaking || !queue.length) return;
    var item = queue.shift();
    var my = gen;
    speaking = true;
    activeOpts = item.opts;
    var u;
    try { u = new SpeechSynthesisUtterance(item.text); }
    catch (e) { speaking = false; activeOpts = null; return pump(); }
    u.lang = 'zh-CN';
    var conf = item.role && voiceRolesEnabled() ? roles()[item.role] : null;
    u.rate = item.opts.rate ||
      Math.max(0.5, Math.min(1.5, readRate() * (conf ? (Number(conf.rate) || 1) : 1)));
    u.pitch = item.opts.pitch || (conf ? (Number(conf.pitch) || 1.12) : 1.12);
    u.volume = 1;
    if (zhVoice) u.voice = zhVoice;
    var timer = null;
    var finished = false;
    var retries = 0;
    /* 超时按「实际语速」估算：0.7×0.86≈0.6 倍速时中文 TTS 约 400ms/字，
       固定 300ms/字会让 watchdog 在句子还没念完时就 done()，下一句被塞进浏览器内部队列。 */
    var effRate = Math.max(0.5, Number(u.rate) || 1);
    var waitMs = Math.min(120000, Math.max(8000, Math.ceil(item.text.length * 550 / effRate)));
    function schedule() { watchdog = timer = setTimeout(onWatchdog, waitMs); }
    function done() {
      if (finished || my !== gen) return;   /* 换页 / 新一句已把这一代作废 */
      finished = true;
      if (timer) { clearTimeout(timer); timer = null; }
      watchdog = null;
      speaking = false;
      activeOpts = null;
      if (queue.length) pump();
      else if (item.opts.onDone) { try { item.opts.onDone(); } catch (e2) {} }
    }
    function onWatchdog() {
      if (finished || my !== gen) return;
      /* 浏览器还在念/排队就续期，绝不提前把下一句塞进去 */
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) { schedule(); return; }
      } catch (e5) {}
      /* cancel() 后紧接 speak() 被吞时新 utterance 不会有任何回调：
         重试一次，而不是把整段题目当成「已念完」静默跳过。 */
      if (retries < 1) {
        retries++;
        try { window.speechSynthesis.speak(u); } catch (e6) {}
        schedule();
        return;
      }
      done();   /* 兜底复位，保证 speaking 不会永久卡住 */
    }
    u.onend = done;
    u.onerror = done;                       /* 语音服务失败也安静收尾，不卡住队列 */
    if (item.opts.onItem) { try { item.opts.onItem(item.text); } catch (e3) {} }
    schedule();
    try { window.speechSynthesis.speak(u); }
    catch (e4) { done(); }
  }

  /* 无语音环境（如 jsdom / 未装中文语音的系统）：不排队、不报错，界面照常可用 */
  function hasSpeech() {
    return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  }

  function enqueue(parts, opts) {
    if (!voiceEnabled()) return;
    var o = opts || {};
    /* 每句可以是纯文本，也可以是 { text, role }：一个故事里三位伙伴各用自己的声音 */
    var list = (Array.isArray(parts) ? parts : [parts]).map(function (p) {
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        return { text: cleanText(p.text), role: p.role || o.role || null };
      }
      return { text: cleanText(p), role: o.role || null };
    }).filter(function (x) { return x.text; });
    if (!list.length) return;
    list.forEach(function (x) { log(x.text); queue.push({ text: x.text, opts: o, role: x.role }); });
    if (!hasSpeech()) {
      queue.length = 0;
      speaking = false;
      activeOpts = null;
      if (o.onItem) { try { o.onItem(list[0].text); } catch (e) {} }
      if (o.onDone) { try { o.onDone(); } catch (e) {} }
      return;
    }
    pump();
  }

  /* 打断式单句：默认把正在念的与排队中的全部停掉，再念这一句。
     传 { queue: true } 则排到队尾（交互短提示用，避免把正在念的半句切碎）。 */
  function speak(text, opts) {
    var o = opts || {};
    if (!o.queue) stopSpeak();
    enqueue(text, o);
  }

  /* 连读：停掉旧的，再按数组顺序念完。onItem / onDone 供界面显示「正在读…」。 */
  function speakSequence(parts, opts) {
    stopSpeak();
    enqueue(parts, opts);
  }

  /* 丢掉还没念到的排队内容，但保留当前正在念的那一句 */
  function dropPending() {
    notifyStop();
    queue.length = 0;
  }

  /* 自动引导默认由团团来讲；故事里某句自带 role 时会覆盖它 */
  function withRole(opts) {
    var o = {};
    for (var k in (opts || {})) {
      if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    }
    if (!o.role) o.role = 'cloud';
    return o;
  }

  /* 只允许「自动引导」调用的入口：家长关掉自动读题后，读题/反馈/鼓励全部安静 */
  function readAuto(parts, opts) {
    if (!autoReadEnabled()) return;
    speakSequence(parts, withRole(opts));
  }
  function readQuestion(parts, opts) {
    if (!autoReadEnabled()) return;
    speakSequence(parts, withRole(opts));
  }
  function readAutoOne(text, opts) {
    if (!autoReadEnabled()) return;
    speak(text, withRole(opts));
  }
  /* 交互短提示：不清当前正在念的一句，只把排队中的旧提示换成最新这条。
     连点卡片不会听到一串被切断的残句，也不会积压十几条等着念。 */
  function readAutoTail(text, opts) {
    if (!autoReadEnabled()) return;
    dropPending();
    var o = withRole(opts);
    o.queue = true;
    speak(text, o);
  }

  function stopSpeak() {
    gen++;
    notifyStop();
    queue.length = 0;
    speaking = false;
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
  }

  window.SEL.audio = {
    unlock: unlock, sfx: sfx, speak: speak, speakSequence: speakSequence,
    readAuto: readAuto, readAutoOne: readAutoOne, readAutoTail: readAutoTail,
    readQuestion: readQuestion,
    stopSpeak: stopSpeak, tone: tone,
    voiceEnabled: voiceEnabled, autoReadEnabled: autoReadEnabled, readRate: readRate,
    voiceStatus: voiceStatus, onVoicesChange: onVoicesChange,
    roles: roles, roleForSpeaker: roleForSpeaker, voiceRolesEnabled: voiceRolesEnabled,
    recent: function () { return spokenLog.slice(); },
    clearLog: function () { spokenLog = []; },
    isSpeaking: function () { return speaking || queue.length > 0; }
  };

  /* 第一次点击/按键后解锁音频上下文（浏览器自动播放策略） */
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });

  if ('speechSynthesis' in window) {
    try {
      zhVoice = pickZhVoice();
      window.speechSynthesis.addEventListener('voiceschanged', function () {
        zhVoice = pickZhVoice();
        voiceListeners.forEach(function (fn) { try { fn(voiceStatus()); } catch (e) {} });
      });
    } catch (e) {}
  }
})();
