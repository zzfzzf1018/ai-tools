/* ========================================
   趣味英语乐园 - 语音功能
   使用 Web Speech API 实现发音
   ======================================== */

const SpeechHelper = {
    // 语音设置（与学习进度分开存储）
    settings: { autoSpeak: true, rate: 0.8, voiceName: '' },
    settingsKey: 'kidsEnglishSpeechSettings',

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
        return voices.find(v => v.lang.startsWith('en')) || null;
    },

    // 朗读文本
    speak: function(text, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.isSupported()) {
                reject(new Error('浏览器不支持语音合成'));
                return;
            }

            // 取消之前的朗读
            window.speechSynthesis.cancel();

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
            utterance.onerror = (e) => reject(e);

            window.speechSynthesis.speak(utterance);
        });
    },

    // 朗读单词（带高亮回调）
    speakWord: function(word, onStart, onEnd) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(word);
        const voice = this.getEnglishVoice();
        
        utterance.lang = 'en-US';
        utterance.rate = this.settings.rate * 0.95;
        utterance.pitch = 1.1;
        
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

    // 朗读句子
    speakSentence: function(sentence, onStart, onEnd) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(sentence);
        const voice = this.getEnglishVoice();
        
        utterance.lang = 'en-US';
        utterance.rate = this.settings.rate;
        utterance.pitch = 1.0;
        
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
            window.speechSynthesis.onvoiceschanged = () => {
                window.speechSynthesis.getVoices();
            };
        }
    },

    // 检测是否正在朗读
    isSpeaking: function() {
        return window.speechSynthesis.speaking;
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    SpeechHelper.preloadVoices();
});
