/** DOM 辅助：转义、查询、事件委托、提示条、确认框、发音 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/** 事件委托 */
export function delegate(root, type, selector, handler) {
  const listener = (event) => {
    const target = event.target.closest(selector);
    if (!target || !root.contains(target)) return;
    handler(event, target);
  };
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

let toastWrap = null;

export function toast(message, tone = '') {
  if (!toastWrap) {
    toastWrap = document.createElement('div');
    toastWrap.className = 'toast-wrap';
    document.body.appendChild(toastWrap);
  }
  const node = document.createElement('div');
  node.className = `toast${tone ? ` toast--${tone}` : ''}`;
  node.textContent = message;
  toastWrap.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .25s, transform .25s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    setTimeout(() => node.remove(), 260);
  }, 2200);
}

/**
 * 确认对话框（Promise）
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, body, confirmText = '确定', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 class="modal__title" id="modal-title">${escapeHtml(title)}</h2>
        <div class="modal__body">${body}</div>
        <div class="modal__actions">
          <button class="btn btn--ghost" data-modal="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-modal="ok">${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    const close = (result) => {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') close(false);
      if (event.key === 'Enter') close(true);
    };
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(false);
      const btn = event.target.closest('[data-modal]');
      if (!btn) return;
      close(btn.dataset.modal === 'ok');
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    const okBtn = backdrop.querySelector('[data-modal="ok"]');
    if (okBtn) okBtn.focus();
  });
}

/** 浏览器语音合成朗读 */
let voiceCache = null;

function pickVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  if (voiceCache) return voiceCache;
  const voices = window.speechSynthesis.getVoices() || [];
  const preferred =
    voices.find((v) => /en[-_]GB/i.test(v.lang) && /female|Google|Microsoft/i.test(v.name)) ||
    voices.find((v) => /en[-_]US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang));
  voiceCache = preferred || null;
  return voiceCache;
}

export function canSpeak() {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

export function speak(text) {
  if (!canSpeak() || !text) return false;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(String(text));
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    utter.lang = voice?.lang || 'en-US';
    utter.rate = 0.92;
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    return false;
  }
}

/** 触发文件下载 */
export function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
