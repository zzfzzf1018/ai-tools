/* 心晴岛 · 通用工具。零依赖，可在 file:// 下运行。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function today(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function prettyDate(s) {
    var p = String(s || '').split('-');
    if (p.length !== 3) return s || '';
    return Number(p[1]) + '月' + Number(p[2]) + '日';
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function daysAgo(n) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return today(d);
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* 事件委托：root 内点击匹配 selector 的元素时触发 */
  function delegate(root, evt, selector, handler) {
    root.addEventListener(evt, function (e) {
      var t = e.target;
      while (t && t !== root) {
        if (t.matches && t.matches(selector)) { handler(e, t); return; }
        t = t.parentNode;
      }
    });
  }

  /* 按字符（而不是 UTF-16 码元）截断，避免把 emoji 从中间切开办成乱码 */
  function cut(s, n) {
    var chars = Array.from(String(s == null ? '' : s));
    return chars.length > n ? chars.slice(0, n).join('') + '…' : chars.join('');
  }

  /* 把字符串数组拼成适合朗读的一句话 */
  function joinSay(parts) {
    return parts.filter(Boolean).join('。').replace(/。+/g, '。');
  }

  window.SEL.utils = {
    esc: esc, shuffle: shuffle, clamp: clamp, pad: pad, today: today,
    prettyDate: prettyDate, uid: uid, daysAgo: daysAgo, cut: cut,
    $: $, $$: $$, delegate: delegate, joinSay: joinSay
  };
})();
