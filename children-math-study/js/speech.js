/* ===== 语音播报：题目 / 选项 / 提示 / 故事 全链路朗读 =====
   使用浏览器内置 Web Speech API（调用操作系统本地中文语音，完全离线、无需素材与网络）。
   - 不支持 TTS 或本机无中文语音时自动降级：隐藏自动播报、保留提示，绝不阻断学习流程。
   - 所有文本先经 toSpeakText 清洗：去掉 emoji、把数学符号翻成中文读法、分数/小数逐位读。
   - 家长视图可调：总开关、自动读题、读选项、语速、音色。
*/
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const synth = root.speechSynthesis || null;
  const Utter = root.SpeechSynthesisUtterance || null;
  const supported = !!(synth && Utter);

  let voices = [];
  let activeUtter = null;   // 持有引用，避免部分 Chromium 版本被 GC 后中断朗读
  let activeBtn = null;
  let autoTimer = null;

  const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

  // 图形符号（emoji / 箭头 / 装饰符）。⬜ 需先单独替换为「几」，否则会被当成图形删掉。
  const PICTO_RE = /[\u{1F000}-\u{1FAFF}\u{1FC00}-\u{1FFFD}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}]/gu;
  const SYMBOL_MAP = {
    '+': ' 加 ', '＋': ' 加 ', '-': ' 减 ', '−': ' 减 ', '－': ' 减 ',
    '×': ' 乘 ', '✖': ' 乘 ', '·': ' 乘 ',
    '÷': ' 除以 ', '/': '，',
    '=': ' 等于 ', '＝': ' 等于 ', '≈': ' 约等于 ',
    '>': ' 大于 ', '＜': ' 小于 ', '<': ' 小于 ', '＞': ' 大于 ',
    '%': ' 百分之', '°': ' 度 ', '?': '？', '～': ' 到 ', '~': ' 到 ',
    '(': '，', ')': '，', '（': '，', '）': '，',
    ',': '，', '，': '，', ';': '；', '；': '；', ':': '，', '：': '，',
    '|': '，', '｜': '，', '\n': '。'
  };

  function settings() {
    return (root.Save && root.Save.data && root.Save.data.settings) || {};
  }

  function hasPictographic(s) {
    PICTO_RE.lastIndex = 0;
    return PICTO_RE.test(String(s));
  }

  /* 把题目文本转成适合中文 TTS 朗读的文本 */
  function toSpeakText(raw) {
    let s = String(raw == null ? '' : raw);
    // 存档字段已做 HTML 转义，先还原实体再去标签，避免把 &lt; 之类念成字母
    s = s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
    s = s.replace(/<[^>]*>/g, '');                 // 去 HTML 标签（题干可能含内联 SVG）
    s = s.replace(/[⬜□▢＿_]{1,}/g, ' 几 ');        // 填空位读成「几」
    s = s.replace(/[✖✕]/g, ' 乘 ');                // 这两个乘号落在图形区间，先救回来
    s = s.replace(/(\d+)\s*\/\s*(\d+)/g, (_m, a, b) => ` ${b} 分之 ${a} `); // 1/2 → 二分之一
    s = s.replace(PICTO_RE, ' ');                  // 图形不朗读
    s = s.split('').map(ch => SYMBOL_MAP[ch] != null ? SYMBOL_MAP[ch] : ch).join('');
    s = s.replace(/(\d+)\.(\d+)/g, (_m, a, b) => ` ${a} 点 ${b.split('').join(' ')} `); // 3.14 → 三点一四
    s = s.replace(/([a-zA-Z])\s*([a-zA-Z])/g, '$1 $2');
    s = s.replace(/\s{2,}/g, ' ').replace(/\s+([，。；？])/g, '$1').trim();
    return s;
  }

  function optionText(opt) {
    const raw = String(opt == null ? '' : opt);
    const t = toSpeakText(raw);
    // 纯图形选项清洗后是空串，所以必须先数图案再判断文本是否为空
    if (hasPictographic(raw) && !/\d/.test(t)) {
      PICTO_RE.lastIndex = 0;
      const pics = raw.match(PICTO_RE) || [];
      const uniq = new Set(pics);
      return uniq.size === 1 && pics.length > 1
        ? `${pics.length} 个图案，请看图片`
        : (pics.length === 1 ? '1 个图案，请看图片' : '看图片选一选');
    }
    if (!t) return '看图片选一选';
    return t;
  }

  function readOptions(list, label) {
    if (!Array.isArray(list) || !list.length) return '';
    return list.map((o, i) => `选项${CN_NUM[i] || (i + 1)}，${optionText(o)}`).join('；');
  }

  /* 组织一道题的完整朗读稿 */
  function questionText(q, withOptions) {
    if (!q) return '';
    const s = settings();
    const prompt = toSpeakText(q.prompt || (
      q.type === 'dragdrop' ? '把下面的数字拖进空格，让等式成立吧' :
        q.type === 'sequence' ? '按顺序排一排' : '请看题'
    ));
    let text = prompt;
    if (withOptions !== false && s.readOptions !== false) {
      if (q.type === 'choice' && Array.isArray(q.options)) {
        text += '。' + readOptions(q.options);
      } else if (q.type === 'sequence' && Array.isArray(q.items)) {
        text += '。可以选的有：' + q.items.map(optionText).join('，');
      } else if (q.type === 'dragdrop' && q.template) {
        text += '。式子是：' + toSpeakText(q.template) + '。把数字拖进空格里';
        if (Array.isArray(q.bank)) {
          text += '。可以选的数字有：' + q.bank.map(optionText).join('，');
        }
      }
    }
    return text.replace(/。{2,}/g, '。');
  }

  function chineseVoices() {
    return voices.filter(v => /^zh/i.test(v.lang || ''));
  }

  function pickVoice(uri) {
    if (!voices.length) return null;
    if (uri) {
      const exact = voices.find(v => v.voiceURI === uri);
      if (exact) return exact;
    }
    const zh = chineseVoices();
    if (!zh.length) return null;
    // 优先大陆普通话，其次任意中文
    return zh.find(v => /zh[-_]CN/i.test(v.lang || '')) || zh[0];
  }

  function refreshVoices() {
    if (!supported) return;
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function clearBtn() {
    if (activeBtn) { activeBtn.classList.remove('playing'); activeBtn = null; }
  }

  function bindBtn(btn) {
    clearBtn();
    if (btn) { btn.classList.add('playing'); activeBtn = btn; }
  }

  /* 核心：朗读一段文字。同一时刻只保留一段，避免多段叠读 */
  function speak(text, opts) {
    opts = opts || {};
    if (!supported) return false;
    if (!enabled() && !opts.force) return false;
    const spoken = toSpeakText(text);
    if (!spoken) return false;
    try {
      synth.cancel();
      // 切题后的播报可能脱离用户手势链，部分 Chromium/Electron 需要显式 resume
      try { if (synth.paused) synth.resume(); } catch (e) { /* ignore */ }
      refreshVoices();
      const u = new Utter(spoken);
      const s = settings();
      const rate = Number(opts.rate != null ? opts.rate : s.speechRate);
      u.rate = clamp(Number.isFinite(rate) && rate > 0 ? rate : 0.9, 0.5, 1.6);
      u.pitch = clamp(Number(s.speechPitch) || 1.05, 0.5, 1.6);
      u.volume = 1;
      u.lang = 'zh-CN';
      const v = pickVoice(s.speechVoiceURI);
      if (v) { u.voice = v; u.lang = v.lang; }
      bindBtn(opts.button);
      activeUtter = u;
      u.onend = () => { if (activeUtter === u) { activeUtter = null; clearBtn(); } opts.onend && opts.onend(); };
      u.onerror = () => { if (activeUtter === u) { activeUtter = null; clearBtn(); } opts.onerror && opts.onerror(); };
      synth.speak(u);
      return true;
    } catch (e) {
      activeUtter = null;
      clearBtn();
      opts.onerror && opts.onerror(e);
      return false;
    }
  }

  function stop() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (!supported) return;
    try { synth.cancel(); } catch (e) { /* ignore */ }
    activeUtter = null;
    clearBtn();
  }

  function enabled() { return supported && settings().speech !== false; }
  function autoRead() { return enabled() && settings().autoRead !== false; }

  /* 听算要把题目藏起来，必须确认系统里真的有可用语音，否则一律退回显示题目 */
  function canAural() {
    if (!supported || !enabled()) return false;
    refreshVoices();
    return voices.length > 0;
  }

  /* 自动播报：延迟一小拍，等页面渲染完、用户手势链路闭合 */
  function later(fn, delay) {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { autoTimer = null; fn(); }, delay == null ? 320 : delay);
  }
  function autoSpeak(textOrFn, delay) {
    if (!autoRead()) return false;
    later(() => { const t = typeof textOrFn === 'function' ? textOrFn() : textOrFn; speak(t); }, delay);
    return true;
  }
  function autoQuestion(q, delay) {
    return autoSpeak(() => questionText(q), delay);
  }

  /* 首次用户手势时预热语音列表（部分系统 getVoices 首次为空） */
  function warmup() {
    if (!supported) return;
    refreshVoices();
    try { if (synth.paused) synth.resume(); } catch (e) { /* ignore */ }
  }

  function setSetting(key, value) {
    if (!root.Save || !root.Save.data) return Promise.resolve();
    root.Save.data.settings[key] = value;
    return root.Save.write();
  }

  function toggle() {
    if (!supported) return false;   // 设备不支持时不要写存档、也不要误报"已开启"
    const on = !enabled();
    if (!on) stop();
    setSetting('speech', on);
    return on;
  }

  function revealButton(opts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'speech-btn';
    b.textContent = '👀 显示题目';
    b.title = '听不清时可以把题目显示出来';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (opts && opts.onReveal) opts.onReveal();
    });
    return b;
  }

  /* 生成一个朗读按钮；onClick 可自定义，默认朗读 getText() */
  function button(label, getText, opts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'speech-btn';
    b.textContent = label;
    b.title = '点击朗读';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!supported) {
        root.UI && UI.toast('当前设备不支持语音朗读哦', '#f87171');
        return;
      }
      if (!enabled()) {
        root.UI && UI.toast('语音已关闭，可在家长视图打开', '#f87171');
        return;
      }
      if (b.classList.contains('playing')) { stop(); return; }
      if (opts && opts.onClick) opts.onClick(b);
      else speak(getText(), { button: b });
    });
    return b;
  }

  function stopButton() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'speech-btn stop';
    b.textContent = '⏹ 停止';
    b.title = '停止朗读';
    b.addEventListener('click', (e) => { e.stopPropagation(); stop(); });
    return b;
  }

  /* 题目工具条：读题目 / 读选项 / 再听一遍 / 停止 */
  function questionBar(q, opts) {
    const bar = document.createElement('div');
    bar.className = 'speech-bar';
    if (!supported || !enabled()) {
      bar.classList.add('speech-off');
      const tip = document.createElement('span');
      tip.className = 'speech-tip';
      tip.textContent = !supported ? '本设备不支持语音朗读' : '语音已关闭';
      bar.appendChild(tip);
      // 听算模式一旦没声音就必须能显示题目，避免孩子卡住
      if (q.aural && opts && opts.onReveal) bar.appendChild(revealButton(opts));
      return bar;
    }
    bar.appendChild(button('🔊 读题目', () => questionText(q, false)));
    if ((q.type === 'choice' && Array.isArray(q.options)) ||
        (q.type === 'sequence' && Array.isArray(q.items))) {
      bar.appendChild(button('🔢 读选项', () => {
        const list = q.type === 'choice' ? q.options : q.items;
        return (q.type === 'choice' ? readOptions(list) : '可以选的有：' + list.map(optionText).join('，'));
      }));
    }
    if (q.type === 'dragdrop' && Array.isArray(q.bank)) {
      bar.appendChild(button('🔢 读数字卡', () => '可以选的数字有：' + q.bank.map(optionText).join('，')));
    }
    if (q.aural || q.type === 'dragdrop' || q.type === 'input') {
      bar.appendChild(button('🔁 再听一遍', () => questionText(q, !q.aural)));
    }
    // 即使语音看起来可用，也必须留一条"看到题目"的出口：
    // 系统静音、无中文语音、播报被策略拦截时孩子仍能继续作答
    if (q.aural && opts && opts.onReveal) bar.appendChild(revealButton(opts));
    bar.appendChild(stopButton());
    return bar;
  }

  const Speech = {
    supported,
    enabled,
    autoRead,
    canAural,
    speak,
    stop,
    later,
    autoSpeak,
    autoQuestion,
    questionText,
    toSpeakText,
    optionText,
    readOptions,
    warmup,
    toggle,
    setSetting,
    button,
    stopButton,
    questionBar,
    refreshVoices,
    voices() { refreshVoices(); return voices.slice(); },
    chineseVoices() { refreshVoices(); return chineseVoices(); },
    status() {
      refreshVoices();
      return {
        supported, chineseVoices: chineseVoices().length,
        allVoices: voices.length, enabled: enabled(), canAural: canAural()
      };
    },
    // 供离线自检脚本使用
    _toSpeakText: toSpeakText
  };

  root.Speech = Speech;
  if (supported && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', refreshVoices);
  }
  refreshVoices();
})();
