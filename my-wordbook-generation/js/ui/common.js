/* 单词书 · 界面通用工具 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const ui = WB.ui = WB.ui || {};
  let toastTimer = null;

  const ICONS = {
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8.5 8.5 0 0 1 0 12"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  function append(node, children) {
    children.forEach(function (child) {
      if (child == null || child === false) return;
      if (Array.isArray(child)) { append(node, child); return; }
      node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    });
  }

  function el(tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        const value = attrs[key];
        if (value == null || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'dataset') Object.keys(value).forEach(function (k) { node.dataset[k] = value[k]; });
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'selected') node[key] = value;
        else if (/^on/.test(key) && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
        else node.setAttribute(key, value === true ? '' : value);
      });
    }
    append(node, Array.prototype.slice.call(arguments, 2));
    return node;
  }

  function icon(name) {
    return el('span', { class: 'icon', html: ICONS[name] || '' });
  }

  function toast(message, kind) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.className = 'toast show' + (kind ? ' ' + kind : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.className = 'toast' + (kind ? ' ' + kind : '');
    }, 2400);
  }

  function speak(text) {
    if (WB.speech && WB.speech.speak(text)) return true;
    toast('当前环境不支持语音朗读', 'warn');
    return false;
  }

  function speakButton(word) {
    return el('button', {
      class: 'speak-btn',
      type: 'button',
      'aria-label': '朗读 ' + word,
      onclick: function () { speak(word); }
    }, icon('speaker'), '发音');
  }

  function chip(text, kind) {
    return el('span', { class: 'chip' + (kind ? ' ' + kind : '') }, text);
  }

  function empty(title, desc, actions) {
    return el('div', { class: 'empty' },
      el('div', { class: 'mark' }, '空'),
      el('h3', null, title),
      desc ? el('p', null, desc) : null,
      actions ? el('div', { class: 'row' }, actions) : null
    );
  }

  function num(value) {
    return Number(value || 0).toLocaleString('en-US');
  }

  function tierLabel(tier) { return WB.words ? WB.words.tierLabel(tier) : '日常对话'; }
  function tierTitle(tier) { return WB.words ? WB.words.tierTitle(tier) : '日常对话 · 2,000 词'; }

  function sourceLabel(source) {
    return { learn: '新词', review: '复习', manual: '手动', leech: '难词' }[source] || source || '';
  }

  function pageHead(title, subtitle, actions) {
    return el('div', { class: 'page-head' },
      el('div', null,
        el('h1', null, title),
        subtitle ? el('p', null, subtitle) : null
      ),
      actions ? el('div', { class: 'row' }, actions) : null
    );
  }

  function stat(label, value, hint) {
    return el('div', { class: 'stat' },
      el('div', { class: 'k' }, label),
      el('div', { class: 'v' }, value, hint ? el('small', null, ' ' + hint) : null)
    );
  }

  function confirm(message) {
    return window.confirm(message);
  }

  ui.el = el;
  ui.icon = icon;
  ui.toast = toast;
  ui.speak = speak;
  ui.speakButton = speakButton;
  ui.chip = chip;
  ui.empty = empty;
  ui.num = num;
  ui.tierLabel = tierLabel;
  ui.tierTitle = tierTitle;
  ui.sourceLabel = sourceLabel;
  ui.pageHead = pageHead;
  ui.stat = stat;
  ui.confirm = confirm;
})();
