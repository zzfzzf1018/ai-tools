/**
 * 知乎左侧图标栏隐藏 —— content script
 *
 * 两条路：
 *  A. 自动识别：按「贴左 + 窄 + 高 + 图标多」的几何/结构特征找侧栏（知乎 class 是哈希的，写死必废）
 *  B. 点选：弹窗里点「点选侧栏」，在页面上单击那个栏，脚本生成一个尽量稳定的选择器存起来（优先级最高）
 *
 * 所有改动可逆：隐藏靠 data-zsh-hide 属性，补位靠内联样式并备份原值，关掉开关即还原。
 */
(() => {
  'use strict';
  if (window.__zshLoaded) return;
  window.__zshLoaded = true;

  const VERSION = '1.1.0';
  const HIDE_ATTR = 'data-zsh-hide';
  const STYLE_ID = 'zsh-injected-style';
  const STORAGE = chrome.storage && chrome.storage.local ? chrome.storage.local : null;
  const DEFAULTS = { enabled: true, reflow: true, extraSelectors: '' };

  // 自动识别阈值
  const RAIL_MAX_WIDTH = 200;
  const RAIL_MIN_HEIGHT_RATIO = 0.3;
  const RAIL_MAX_LEFT = 40;
  const RAIL_MAX_TEXT = 300;

  // 点选时允许的宽松阈值（手动点说明就是它，别太苛刻）
  const PICK_OPTS = {
    maxWidth: 320,
    minHeightRatio: 0.18,
    maxLeft: 48,
    maxText: 1500,
    minIcons: 2,
    maxTopRatio: 0.6,
  };

  let state = Object.assign({}, DEFAULTS);
  const hiddenEls = new Set();
  const styleBackup = new Map(); // el -> { prop: 原内联值 }
  let scheduled = false;
  let lastApplyAt = 0;

  /* ---------------------------------------------------------------- 工具 */

  const px = (v) => parseFloat(v) || 0;
  const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  function depthOf(el) {
    let d = 0;
    let n = el;
    while ((n = n.parentElement)) d++;
    return d;
  }

  function isVisible(el) {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && px(cs.opacity) > 0.05;
  }

  function setStyle(el, props) {
    if (!styleBackup.has(el)) styleBackup.set(el, {});
    const rec = styleBackup.get(el);
    for (const key of Object.keys(props)) {
      if (!(key in rec)) rec[key] = el.style.getPropertyValue(key);
      el.style.setProperty(key, props[key], 'important');
    }
  }

  function restoreStyles() {
    for (const [el, rec] of styleBackup.entries()) {
      for (const key of Object.keys(rec)) {
        const original = rec[key];
        if (original) el.style.setProperty(key, original);
        else el.style.removeProperty(key);
      }
    }
    styleBackup.clear();
  }

  /** 不依赖 manifest 的 css 注入，自己塞一个 <style>（老版本 Edge 对 content_scripts.css 支持有差异） */
  function ensureSheet() {
    try {
      if (document.getElementById && document.getElementById(STYLE_ID)) return;
      if (document.querySelector && document.querySelector('#' + STYLE_ID)) return;
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = '[' + HIDE_ATTR + ']{display:none !important;}';
      (document.head || document.documentElement).appendChild(s);
    } catch (err) {
      console.warn('[zsh] 样式注入失败', err);
    }
  }

  /* ---------------------------------------------------------- 自动识别 */

  function isAnchoredLeft(el, cs) {
    if (cs.position === 'fixed' || cs.position === 'sticky' || cs.position === 'absolute') return true;
    const parent = el.parentElement;
    if (!parent) return false;
    const pcs = getComputedStyle(parent);
    const isRowBox =
      (pcs.display.includes('flex') || pcs.display.includes('grid')) && pcs.flexDirection !== 'column';
    return isRowBox && parent.firstElementChild === el;
  }

  function looksLikeRail(el, opt) {
    const o = opt || {};
    const maxW = o.maxWidth || RAIL_MAX_WIDTH;
    const minHRatio = o.minHeightRatio || RAIL_MIN_HEIGHT_RATIO;
    const maxLeft = o.maxLeft || RAIL_MAX_LEFT;
    const maxText = o.maxText || RAIL_MAX_TEXT;
    const minIcons = o.minIcons || 3;
    const maxTopRatio = o.maxTopRatio || 0.5;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.width < 20 || r.width > maxW) return false;
    if (r.height < vh * minHRatio) return false;
    if (r.left > maxLeft) return false;
    if (r.top > vh * maxTopRatio) return false;
    if (!isVisible(el)) return false;
    if (el.querySelector('main, article, [role="main"]')) return false;
    if ((el.innerText || '').trim().length > maxText) return false;
    const iconCount = el.querySelectorAll('a,button,svg,img,li,[role="button"]').length;
    if (iconCount < minIcons) return false;
    return true;
  }

  function collectByHeuristic() {
    const out = [];
    if (!document.body) return out;
    for (const el of document.body.querySelectorAll('*')) {
      if (!looksLikeRail(el)) continue;
      if (!isAnchoredLeft(el, getComputedStyle(el))) continue;
      out.push(el);
    }
    // 嵌套候选只留最外层
    out.sort((a, b) => depthOf(a) - depthOf(b));
    const kept = [];
    for (const el of out) {
      if (kept.some((k) => k.contains(el))) continue;
      kept.push(el);
    }
    return kept;
  }

  function userSelectors() {
    return (state.extraSelectors || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function collectByUserSelectors() {
    const out = [];
    for (const sel of userSelectors()) {
      try {
        for (const el of document.querySelectorAll(sel)) if (!out.includes(el)) out.push(el);
      } catch (err) {
        console.warn('[zsh] 无效选择器：' + sel);
      }
    }
    return out;
  }

  /* ------------------------------------------------------------ 补位 */

  function reclaimReservedSpace(rail) {
    let node = rail.parentElement;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const pl = px(cs.paddingLeft);
      const ml = px(cs.marginLeft);
      if (pl >= 24 || ml >= 24) {
        const props = {};
        if (pl >= 24) props['padding-left'] = '0px';
        if (ml >= 24) props['margin-left'] = '0px';
        setStyle(node, props);
        return;
      }
      node = node.parentElement;
    }
  }

  function recenterMainContent(rails) {
    const vw = window.innerWidth;
    let best = null;
    let bestArea = 0;

    const queue = [];
    for (const child of document.body.children) queue.push([child, 1]);
    while (queue.length) {
      const [el, d] = queue.shift();
      if (d > 6) continue;
      if (!el.hasAttribute(HIDE_ATTR) && !rails.some((r) => r === el || r.contains(el))) {
        const r = el.getBoundingClientRect();
        if (r.width >= vw * 0.35 && r.width <= vw * 0.98) {
          const area = r.width * Math.min(r.height, window.innerHeight);
          if (area > bestArea) {
            bestArea = area;
            best = el;
          }
        }
      }
      for (const child of el.children) queue.push([child, d + 1]);
    }
    if (!best) return;

    const parent = best.parentElement;
    if (parent) {
      const pcs = getComputedStyle(parent);
      const isRowBox =
        (pcs.display.includes('flex') || pcs.display.includes('grid')) && pcs.flexDirection !== 'column';
      if (isRowBox && parent.children.length > 1) return; // 旁边还有右栏之类，别乱动 margin
    }
    const r = best.getBoundingClientRect();
    if (Math.abs(r.left - (vw - r.right)) > 40) {
      setStyle(best, { 'margin-left': 'auto', 'margin-right': 'auto' });
    }
  }

  /* -------------------------------------------------------------- 应用 */

  function clearAll() {
    for (const el of hiddenEls) el.removeAttribute(HIDE_ATTR);
    hiddenEls.clear();
    restoreStyles();
  }

  function apply() {
    try {
      applyNow();
    } finally {
      lastApplyAt = Date.now(); // 防止自己改样式把 MutationObserver 点着，形成死循环
    }
  }

  function applyNow() {
    ensureSheet();
    clearAll();
    if (!state.enabled || !document.body) return;

    const uniq = [];
    for (const el of collectByUserSelectors().concat(collectByHeuristic())) {
      if (uniq.includes(el)) continue;
      uniq.push(el);
      el.setAttribute(HIDE_ATTR, '1');
      hiddenEls.add(el);
    }
    if (!uniq.length) return;

    if (state.reflow) {
      for (const rail of uniq) reclaimReservedSpace(rail);
      recenterMainContent(uniq);
    }
  }

  function schedule(force) {
    if (!force && Date.now() - lastApplyAt < 800) return;
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      try {
        apply();
      } catch (err) {
        console.error('[zsh] apply failed', err);
      }
    }, 200);
  }

  /* ------------------------------------------------------ 选择器生成 */

  function isHashy(cls) {
    return (
      /^(css|sc|jsx|emotion|hoverable)-[a-z0-9]{3,}$/i.test(cls) ||
      /[0-9]{4,}/.test(cls) ||
      cls.length > 28 ||
      /^[a-z]_[a-z0-9]{5,}$/i.test(cls)
    );
  }

  function isUnique(sel, el) {
    let list;
    try {
      list = document.querySelectorAll(sel);
    } catch (err) {
      return false;
    }
    return list.length === 1 && list[0] === el;
  }

  function pathSelector(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && node.parentElement) {
      const parent = node.parentElement;
      const idx = Array.prototype.indexOf.call(parent.children, node) + 1;
      parts.unshift(node.tagName.toLowerCase() + ':nth-child(' + idx + ')');
      node = parent;
    }
    return 'body ' + parts.map((p) => '> ' + p).join(' ');
  }

  function buildSelector(el) {
    const tag = el.tagName.toLowerCase();
    if (el.id) {
      const sel = '#' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id);
      if (isUnique(sel, el)) return sel;
    }
    for (const key of Object.keys(el.dataset || {})) {
      if (/^zsh/.test(key)) continue;
      const val = el.dataset[key];
      if (!val || val.length > 48 || /[<>"']/g.test(val)) continue;
      const sel = tag + '[data-' + key.replace(/([A-Z])/g, '-$1').toLowerCase() + '="' + val + '"]';
      if (isUnique(sel, el)) return sel;
    }
    const classes = (typeof el.className === 'string' ? el.className : '')
      .trim()
      .split(/\s+/)
      .filter((c) => c && !isHashy(c));
    for (const cls of classes) {
      if (isUnique('.' + cls, el)) return '.' + cls;
    }
    if (classes.length >= 2 && isUnique(tag + '.' + classes.join('.'), el)) {
      return tag + '.' + classes.join('.');
    }
    return pathSelector(el);
  }

  function describe(el) {
    const r = el.getBoundingClientRect();
    const cls = (typeof el.className === 'string' ? el.className : '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      classes: cls,
      selectorSuggestion: buildSelector(el),
      box: {
        left: Math.round(r.left),
        top: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      },
      position: getComputedStyle(el).position,
      depth: depthOf(el),
    };
  }

  /* ------------------------------------------------------ 点选模式 */

  let picking = null; // { overlay, onMove, onDown, onBlock, onKey, done }

  function railFromPoint(el) {
    let node = el && el.nodeType === 1 ? el : null;
    if (!node) return null;
    let best = null;
    // 用户点的往往是栏里的小图标，所以要往上找：取「最高（最外层）的那个仍像侧栏的祖先」
    while (node && node !== document.body) {
      if (looksLikeRail(node, PICK_OPTS)) best = node;
      node = node.parentElement;
    }
    return best;
  }

  function startPick(callback) {
    if (picking) {
      picking.done({ ok: false, error: '已经在点选模式了，先按 Esc 取消。' });
      return;
    }
    ensureSheet();
    const overlay = document.createElement('div');
    overlay.style.setProperty('position', 'fixed', 'important');
    overlay.style.setProperty('left', '0', 'important');
    overlay.style.setProperty('top', '0', 'important');
    overlay.style.setProperty('width', '100%', 'important');
    overlay.style.setProperty('height', '100%', 'important');
    overlay.style.setProperty('z-index', '2147483646', 'important');
    overlay.style.setProperty('pointer-events', 'none', 'important');
    overlay.style.setProperty('background', 'rgba(22,119,255,0.16)', 'important');
    overlay.style.setProperty('outline', '2px solid #1677ff', 'important');
    overlay.style.setProperty('opacity', '0', 'important');
    (document.body || document.documentElement).appendChild(overlay);

    const onMove = (e) => {
      const target = railFromPoint(e.target);
      if (!target) {
        overlay.style.setProperty('opacity', '0');
        return;
      }
      const r = target.getBoundingClientRect();
      overlay.style.setProperty('opacity', '1');
      overlay.style.setProperty('left', Math.round(r.left) + 'px');
      overlay.style.setProperty('top', Math.round(r.top) + 'px');
      overlay.style.setProperty('width', Math.round(r.width) + 'px');
      overlay.style.setProperty('height', Math.round(r.height) + 'px');
    };

    const onBlock = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = railFromPoint(e.target);
      if (!target) {
        finishPick();
        callback({ ok: false, error: '点的位置不像侧栏（要贴左边、窄、高）。往左移一点再点。' });
        return;
      }
      const sel = buildSelector(target);
      const lines = userSelectors();
      if (!lines.includes(sel)) lines.push(sel);
      state.extraSelectors = lines.join('\n');
      if (STORAGE) STORAGE.set({ extraSelectors: state.extraSelectors });
      apply();
      finishPick();
      callback({ ok: true, selector: sel, box: describe(target).box });
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        finishPick();
        callback({ ok: false, error: '已取消点选。' });
      }
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('click', onBlock, true);
    document.addEventListener('keydown', onKey, true);

    picking = {
      overlay,
      done: callback,
      cleanup: () => {
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mousedown', onDown, true);
        document.removeEventListener('click', onBlock, true);
        document.removeEventListener('keydown', onKey, true);
        if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
      },
    };
    console.log('[zsh] 点选模式：单击左侧图标栏即可锁定，按 Esc 取消');
  }

  function finishPick() {
    if (!picking) return;
    picking.cleanup();
    picking = null;
  }

  /* ------------------------------------------------------------ 生命周期 */

  function readStorage() {
    return new Promise((resolve) => {
      if (!STORAGE) return resolve(state);
      try {
        STORAGE.get(DEFAULTS, (saved) => resolve(Object.assign({}, DEFAULTS, saved || {})));
      } catch (err) {
        resolve(state);
      }
    });
  }

  function observeSpa() {
    try {
      if (!document.documentElement) return;
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          const t = m.target;
          if (t === document.body || t === document.documentElement) {
            schedule(true); // 整页/路由级变化，立刻处理
            return;
          }
          if (t.nodeType === 1 && (styleBackup.has(t) || hiddenEls.has(t) || (t.closest && t.closest('[' + HIDE_ATTR + ']')))) {
            continue; // 自己写的样式，忽略
          }
          schedule(false);
          return;
        }
      }).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    } catch (err) {
      console.warn('[zsh] MutationObserver 未挂上，改用轮询兜底', err);
      setInterval(() => schedule(true), 3000);
    }
  }

  // 先用默认值跑起来，不等 storage 回调（避免回调不触发导致完全不生效）
  ensureSheet();
  apply();
  readStorage().then((loaded) => {
    state = loaded;
    schedule(true);
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area && area !== 'local') return;
      let dirty = false;
      for (const key of Object.keys(DEFAULTS)) {
        if (changes[key]) {
          state[key] = changes[key].newValue;
          dirty = true;
        }
      }
      if (dirty) schedule(true);
    });
  }

  observeSpa();
  document.addEventListener('DOMContentLoaded', () => schedule(true));
  window.addEventListener('load', () => schedule(true));
  window.addEventListener('popstate', () => schedule(true));
  window.addEventListener('hashchange', () => schedule(true));

  setInterval(() => {
    let stale = false;
    for (const el of hiddenEls) {
      if (!el.isConnected || !el.hasAttribute(HIDE_ATTR)) {
        stale = true;
        break;
      }
    }
    if (stale) schedule(true);
  }, 2000);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'zsh:ping') {
      sendResponse({ ok: true, version: VERSION, hidden: hiddenEls.size, enabled: state.enabled });
    } else if (msg.type === 'zsh:diagnose') {
      const rails = collectByUserSelectors().concat(collectByHeuristic());
      sendResponse({
        ok: true,
        version: VERSION,
        enabled: state.enabled,
        reflow: state.reflow,
        extraSelectors: state.extraSelectors,
        items: rails.map(describe),
        scanned: document.body ? document.body.querySelectorAll('*').length : 0,
      });
    } else if (msg.type === 'zsh:apply') {
      schedule(true);
      sendResponse({ ok: true });
    } else if (msg.type === 'zsh:pick') {
      startPick(sendResponse);
      return true; // 异步回复
    } else if (msg.type === 'zsh:cancelPick') {
      finishPick();
      sendResponse({ ok: true });
    }
  });

  console.log('[zsh] 知乎侧边栏隐藏 v' + VERSION + ' 已注入（弹窗里可点选侧栏）');
})();
