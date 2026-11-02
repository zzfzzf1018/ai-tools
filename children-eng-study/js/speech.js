/* ========================================
   趣味英语乐园 - 语音功能
   使用 Web Speech API 实现发音
   ======================================== */

const SpeechHelper = {
    // 检查浏览器是否支持语音合成
    isSupported: function() {
        return 'speechSynthesis' in window;
    },

    // 获取英语语音
    getEnglishVoice: function() {
        const voices = window.speechSynthesis.getVoices();
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
            utterance.rate = options.rate || 0.8;  // 稍慢的语速，适合儿童
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
        utterance.rate = 0.75;
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
        utterance.rate = 0.85;
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
        window.speechSynthesis.cancel();
    },

    // 预加载语音（某些浏览器需要）
    preloadVoices: function() {
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
