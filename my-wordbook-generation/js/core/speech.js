/* 单词书 · 浏览器语音朗读 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  let voices = [];

  function refresh() {
    try {
      voices = synth ? synth.getVoices() || [] : [];
    } catch (e) {
      voices = [];
    }
  }

  function pickVoice() {
    const english = voices.filter(function (voice) {
      return /^en([-_]|$)/i.test(voice.lang || '');
    });
    if (!english.length) return null;
    const preferred = english.find(function (voice) {
      return /(Aria|Jenny|Samantha|Google US English|Microsoft.*English.*United States|US English)/i.test(voice.name || '');
    });
    return preferred || english[0];
  }

  function speak(text) {
    if (!synth || !text) return false;
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text));
      utterance.lang = 'en-US';
      utterance.rate = 0.92;
      utterance.pitch = 1;
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      synth.speak(utterance);
      return true;
    } catch (e) {
      return false;
    }
  }

  refresh();
  if (synth) {
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', refresh);
    } else {
      synth.onvoiceschanged = refresh;
    }
  }

  WB.speech = {
    available: !!synth,
    speak: speak,
    refresh: refresh
  };
})();
