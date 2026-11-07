/* ========================================
   趣味英语乐园 - 语音功能
   使用 Web Speech API 实现发音
   ======================================== */

const SpeechHelper = {
    // 语音设置（与学习进度分开存储）
    // guide：题目语音引导（读题 + 活泼反馈），家长可在设置面板单独关闭
    settings: { autoSpeak: true, rate: 0.8, voiceName: '', guide: true },
    settingsKey: 'kidsEnglishSpeechSettings',

    // 发音请求去重：避免快速重复点击时堆叠合成请求
    lastSpeakKey: '',
    lastSpeakTime: 0,

    // 检查浏览器是否支持语音合成
    isSupported: function() {
        return 'speechSynthesis' in window;
    },

    loadSettings: function() {
        try {
            const raw = localStorage.getItem(this.settingsKey);
            if (raw) Object.assign(this.settings, JSON.parse(raw));
        } catch (e) {
            console.warn('加载语音设置失败:', e);
        }
        this.settings.rate = parseFloat(this.settings.rate);
        if (!Number.isFinite(this.settings.rate)) this.settings.rate = 0.8;
        this.settings.autoSpeak = this.settings.autoSpeak !== false;
        this.settings.guide = this.settings.guide !== false;
        this.settings.voiceName = this.settings.voiceName || '';
    },

    saveSettings: function() {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(this.settings));
        } catch (e) {
            console.warn('保存语音设置失败:', e);
        }
    },

    // 获取所有英语语音
    getEnglishVoices: function() {
        if (!this.isSupported()) return [];
        return window.speechSynthesis.getVoices()
            .filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    },

    // 获取英语语音
    getEnglishVoice: function() {
        if (!this.isSupported()) return null;
        const voices = window.speechSynthesis.getVoices();
        if (this.settings.voiceName) {
            const chosen = voices.find(v => v.name === this.settings.voiceName);
            if (chosen) return chosen;
        }
        // 优先选择美式或英式英语
        const preferredVoices = [
            'Google US English',
            'Google UK English Female',
            'Google UK English Male',
            'Microsoft Zira - English (United States)',
            'Samantha',
            'Alex',
            'Daniel',
            'Karen',
            'English (US)',
            'English (UK)'
        ];
        
        for (const name of preferredVoices) {
            const voice = voices.find(v => v.name.includes(name));
            if (voice) return voice;
        }
        
        // 返回任何英语语音
        return voices.find(v => v.lang && v.lang.startsWith('en')) || null;
    },

    // 生成缓存键（text + rate + voice 组成的唯一标识）
    makeKey: function(text, rate) {
        return `${text.toLowerCase()}|${rate || this.settings.rate}|${this.settings.voiceName || 'auto'}`;
    },

    // 检查是否应该跳过（600ms 内相同请求直接跳过）
    shouldSkip: function(key) {
        const now = Date.now();
        if (key === this.lastSpeakKey && now - this.lastSpeakTime < 600) {
            return true;
        }
        this.lastSpeakKey = key;
        this.lastSpeakTime = now;
        return false;
    },

    // 朗读文本
    // options.dedupe === false：关闭 600ms 去重（连续两次相同表扬也要读出来）
    // options.queue === true：不 cancel，排进浏览器朗读队列，实现「读题 → 读单词」自然连读
    speak: function(text, options = {}) {
        // 语音是「可选增强」：不支持、被中断或合成失败时都静默 resolve，
        // 绝不 reject。绝大多数调用方不会写 .catch()，reject 会在浏览器/Electron
        // 里变成未处理的 Promise 拒绝（控制台报错，甚至弹出未捕获异常）。
        return new Promise((resolve) => {
            if (!this.isSupported()) {
                resolve();  // 不支持时静默结束，调用方无需处理拒绝
                return;
            }

            // 600ms 内相同请求跳过，避免快速连点堆叠
            const key = this.makeKey(text, options.rate);
            if (options.dedupe !== false && this.shouldSkip(key)) {
                resolve();
                return;
            }

            // 排队模式下保留已有的朗读队列，其余情况取消之前的朗读
            if (options.queue !== true) window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            const voice = this.getEnglishVoice();
            
            utterance.lang = 'en-US';
            utterance.rate = options.rate || this.settings.rate;  // 语速可在设置面板调整
            utterance.pitch = options.pitch || 1.1;  // 稍高的音调，更有趣
            utterance.volume = options.volume || 1;
            
            if (voice) {
                utterance.voice = voice;
            }

            utterance.onend = () => resolve();
            // 主动 cancel（canceled/interrupted）与合成失败都按「静默结束」处理；
            // 调用方拿到的 Promise 永远是 resolved，链式 .then 的推进逻辑也不会被卡住。
            utterance.onerror = () => resolve();

            window.speechSynthesis.speak(utterance);
        });
    },

    // 朗读单词（带高亮回调）；options.queue 可排进朗读队列
    speakWord: function(word, onStart, onEnd, options = {}) {
        if (!this.isSupported()) return;

        // 600ms 内相同请求跳过
        const key = this.makeKey('word:' + word, this.settings.rate * 0.95);
        if (options.dedupe !== false && this.shouldSkip(key)) return;

        if (options.queue !== true) window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(word);
        const voice = this.getEnglishVoice();
        
        utterance.lang = 'en-US';
        utterance.rate = options.rate || this.settings.rate * 0.95;
        utterance.pitch = options.pitch || 1.1;
        
        if (voice) utterance.voice = voice;

        if (onStart) {
            utterance.onstart = onStart;
        }
        if (onEnd) {
            utterance.onend = onEnd;
        }
        utterance.onerror = () => {
            if (onEnd) onEnd();
        };

        window.speechSynthesis.speak(utterance);
    },

    // 朗读句子；options.queue 可排进朗读队列
    speakSentence: function(sentence, onStart, onEnd, options = {}) {
        if (!this.isSupported()) return;
        if (options.queue !== true) window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(sentence);
        const voice = this.getEnglishVoice();
        
        utterance.lang = 'en-US';
        utterance.rate = options.rate || this.settings.rate;
        utterance.pitch = options.pitch || 1.0;
        
        if (voice) utterance.voice = voice;

        if (onStart) {
            utterance.onstart = onStart;
        }
        if (onEnd) {
            utterance.onend = onEnd;
        }
        utterance.onerror = () => {
            if (onEnd) onEnd();
        };

        window.speechSynthesis.speak(utterance);
    },

    // 停止朗读
    stop: function() {
        if (this.isSupported()) window.speechSynthesis.cancel();
    },

    // 预加载语音（某些浏览器需要）
    preloadVoices: function() {
        this.loadSettings();
        if (this.isSupported()) {
            window.speechSynthesis.getVoices();
            window.speechSynthesis.addEventListener('voiceschanged', () => {
                window.speechSynthesis.getVoices();
            });
        }
    },

    // 检测是否正在朗读
    isSpeaking: function() {
        return window.speechSynthesis.speaking;
    }
};

/* ========================================
   语音小助手 VoiceGuide（v1.6.0）
   让每道题「会说话」：读题 + 活泼表扬 + 温柔鼓励 + 通关庆祝
   - 题目指令与目标单词排进浏览器原生朗读队列，自然串行、不引入额外定时器
   - 家长可在设置面板用「题目语音引导」单独关闭（不影响单词发音按钮）
   ======================================== */
const VoiceGuide = {
    // 每个题型的英文题目指令：全英文 + 图片沉浸，不出现中文词义
    PROMPTS: {
        match:        'Hi! Match each word with its picture!',
        guess:        'Listen carefully, then tap the right one!',
        spell:        'Look at the picture. Can you spell the word?',
        memory:       'Flip two cards and find the pairs!',
        fillword:     'Tap the letters and build the word!',
        sentence:     'Listen, then tap the words in order!',
        card:         'Look at the picture. Listen and say the word!',
        sentenceShow: 'Listen to the sentence, then build it!'
    },

    PRAISE: [
        'Great job!', 'Awesome!', 'You did it!', 'Super star!', 'Wow, amazing!',
        'Fantastic!', 'Well done!', 'Brilliant!', 'High five!', 'You are a word hero!'
    ],
    RETRY: [
        'Try again, you can do it!', 'Almost! Listen once more.',
        'No worries, have another try!', 'Oops! Give it one more go.',
        'Keep going, little explorer!'
    ],
    CHEER: [
        'Hooray! You cleared the level!', 'Champion! Let us go on!',
        'Wow! You are amazing today!'
    ],

    // 不同情绪用不同音调/语速，听起来更像小伙伴在说话
    MOODS: {
        prompt: { rate: 0.85, pitch: 1.35 },
        happy:  { rate: 0.90, pitch: 1.42 },
        gentle: { rate: 0.82, pitch: 1.12 },
        cheer:  { rate: 0.92, pitch: 1.50 },
        word:   { rate: 0.78, pitch: 1.15 },
        line:   { rate: 0.82, pitch: 1.05 }
    },

    _last: {},

    enabled: function() { return SpeechHelper.settings.guide !== false; },
    auto: function() { return this.enabled() && SpeechHelper.settings.autoSpeak !== false; },
    prompt: function(type) { return this.PROMPTS[type] || this.PROMPTS.card; },
    autoPrompt: function(type) { return this.auto() ? this.prompt(type) : null; },

    escapeHtml: function(str) {
        return String(str).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    },

    // 随机取一句，并避免连续两次说同一句
    pick: function(kind) {
        const list = this[kind] || this.PRAISE;
        if (!list || !list.length) return '';
        let text = list[Math.floor(Math.random() * list.length)];
        let guard = 0;
        while (list.length > 1 && text === this._last[kind] && guard++ < 6) {
            text = list[Math.floor(Math.random() * list.length)];
        }
        this._last[kind] = text;
        return text;
    },

    say: function(text, mood) {
        if (!this.enabled() || !text) return;
        const s = this.MOODS[mood] || this.MOODS.happy;
        SpeechHelper.speak(text, { rate: s.rate, pitch: s.pitch, dedupe: false });
    },

    // 读整道题：题目指令 → 目标单词 → 例句（队列串行）
    // isAuto=true 时额外受「自动朗读」开关约束；手动点 🔊 时只要引导开着就能听
    readQuestion: function(type, target, isAuto) {
        if (!this.enabled()) return false;
        if (isAuto && !this.auto()) return false;
        const t = (typeof target === 'string') ? { word: target } : (target || {});
        const p = this.MOODS.prompt;
        SpeechHelper.speak(this.prompt(type), { rate: p.rate, pitch: p.pitch, dedupe: false });
        if (t.word) {
            const w = this.MOODS.word;
            SpeechHelper.speak(t.word, { rate: w.rate, pitch: w.pitch, dedupe: false, queue: true });
        }
        if (t.sentence) {
            const l = this.MOODS.line;
            SpeechHelper.speak(t.sentence, { rate: l.rate, pitch: l.pitch, dedupe: false, queue: true });
        }
        return true;
    },

    // 单独读一个单词（连连看点英文 / 记忆翻牌翻到单词卡时用）
    sayWord: function(word) {
        if (!this.enabled() || !word) return;
        const w = this.MOODS.word;
        SpeechHelper.speak(word, { rate: w.rate, pitch: w.pitch, dedupe: false });
    },

    // 答对：随机表扬 + 把刚学会的单词/句子再读一遍巩固
    praise: function(target) {
        if (!this.enabled()) return;
        this.say(this.pick('PRAISE'), 'happy');
        const t = (typeof target === 'string') ? { word: target } : (target || {});
        if (t.word) {
            const w = this.MOODS.word;
            SpeechHelper.speak(t.word, { rate: w.rate, pitch: w.pitch, dedupe: false, queue: true });
        } else if (t.sentence) {
            const l = this.MOODS.line;
            SpeechHelper.speak(t.sentence, { rate: l.rate, pitch: l.pitch, dedupe: false, queue: true });
        }
    },

    // 答错：温柔鼓励 + 把目标单词重读一次，方便孩子再听清
    retry: function(target) {
        if (!this.enabled()) return;
        this.say(this.pick('RETRY'), 'gentle');
        const t = (typeof target === 'string') ? { word: target } : (target || {});
        if (t.word) {
            const w = this.MOODS.word;
            SpeechHelper.speak(t.word, { rate: w.rate, pitch: w.pitch, dedupe: false, queue: true });
        }
    },

    cheer: function() { this.say(this.pick('CHEER'), 'cheer'); },
    encourage: function(text) { this.say(text || 'Let us go on!', 'happy'); },

    // 题目播报条：小老师头像 + 英文题目指令 + 重听按钮
    barHtml: function(type, opts) {
        const o = opts || {};
        const buddy = o.buddy || '🐣';
        return `<div class="voice-guide" data-guide-type="${this.escapeHtml(type)}">
            <span class="vg-buddy" aria-hidden="true">${buddy}</span>
            <div class="vg-body">
                <span class="vg-label">🎧 Little Teacher</span>
                <span class="vg-text">${this.escapeHtml(this.prompt(type))}</span>
            </div>
            <button type="button" class="vg-replay" aria-label="再听一遍题目">🔊 <span>再听一遍</span></button>
        </div>`;
    },

    // 绑定播报条：点击重听整道题；getTarget 返回当前题的目标（单词/句子）
    bindBar: function(root, type, getTarget) {
        if (!root) return;
        const btn = root.querySelector('.vg-replay');
        const bubble = root.querySelector('.vg-body');
        const replay = () => this.readQuestion(type, getTarget ? getTarget() : null, false);
        if (btn) btn.addEventListener('click', replay);
        if (bubble) bubble.addEventListener('click', replay);
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    SpeechHelper.preloadVoices();
});
