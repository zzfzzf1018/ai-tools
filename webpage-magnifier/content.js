/* global chrome */
'use strict';

/**
 * 网页区域放大器 - Content Script
 *
 * 核心流程：
 *  1. 用户激活「选区模式」(快捷键 Ctrl+Shift+M 或 popup 按钮)
 *  2. 在页面上拖拽矩形区域
 *  3. 松开鼠标后创建放大镜覆盖层，内含该区域 DOM 的克隆
 *  4. 覆盖层可拖动、可调节缩放比例、可切换层级
 *
 * 设计要点：
 *  - 仅 top frame 工作（manifest all_frames: false + 代码 window.top !== self 双重保护）
 *  - SPA 兼容：hook history.pushState/replaceState + 监听 popstate/hashchange
 *  - 选区 overlay 用 pointer-events:auto 捕获全部鼠标事件，彻底阻断穿透
 *  - 放大镜用 transform: scale 做视觉放大，keepInViewport 按视觉尺寸计算
 *  - 全局单例 magnifier：同一时刻只保留一个
 *  - 所有资源路径手动绝对化，绕过页面 <base> 影响
 *  - DOM 克隆后做安全清洗，移除 script/iframe/object/embed/base/link/meta refresh
 *  - Magnifier 实例通过 _listeners 数组保存所有监听器引用，destroy 时彻底清理
 */

// ===== 常量 =====
const Z_INDEX_TOP = 2147483647;
const Z_INDEX_BOTTOM = 1;
const DEFAULT_SCALE = 2.0;
const MIN_SCALE = 1.0;
const MAX_SCALE = 5.0;

// ===== 全局状态（仅 top frame 有效）=====
let magnifier = null;
let selectMode = false;
let selectOverlay = null;
let selectStart = null;
const MOVE_LISTENERS = { move: null, up: null, key: null };

// ===== 键盘监听器管理 =====
const KEYBOARD_LISTENERS = [];

function installKeyboardShortcut() {
  // 先清理已有的（防御重复注册）
  cleanupKeyboardListeners();
  const handler = (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      toggleSelectMode();
    }
  };
  KEYBOARD_LISTENERS.push(handler);
  document.addEventListener('keydown', handler, true);
}

function cleanupKeyboardListeners() {
  while (KEYBOARD_LISTENERS.length) {
    const h = KEYBOARD_LISTENERS.pop();
    document.removeEventListener('keydown', h, true);
  }
}

// ===== URL 工具 =====
// 基址：当前文档最终 URL 的目录部分（用于相对路径解析）
// 注意：SPA 导航后 URL 变了，需要 refreshUrlBase() 更新
function resolveBase() {
  try {
    // new URL('.', href) 可靠地得到目录 URL
    return new URL('.', window.location.href).href;
  } catch (_) {
    return window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');
  }
}
let URL_BASE = resolveBase();

function refreshUrlBase() {
  URL_BASE = resolveBase();
}

// 统一的 URL 绝对化函数
function absolutizeUrl(value, base) {
  if (!value) return value;
  const trimmed = String(value).trim();
  if (!trimmed) return value;
  // 跳过协议/scheme 已完备的 URL
  if (/^(data|blob|javascript|mailto|tel|about):/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return trimmed;
  if (trimmed.startsWith('#')) return trimmed;
  // 以 / 开头：相对于 origin 根
  if (trimmed.startsWith('/')) {
    try { return new URL(trimmed, window.location.origin).href; } catch (_) { return value; }
  }
  // 相对路径：用给定 base 或默认 URL_BASE
  const effectiveBase = base || URL_BASE;
  try { return new URL(trimmed, effectiveBase).href; } catch (_) { return value; }
}

// srcset 特殊处理（空格分隔 URL 和 size descriptor）
function absolutizeSrcset(value) {
  if (!value) return value;
  return String(value).split(',').map((part) => {
    const trimmed = part.trim();
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) return absolutizeUrl(trimmed);
    const urlPart = trimmed.slice(0, spaceIdx);
    const restPart = trimmed.slice(spaceIdx);
    return absolutizeUrl(urlPart) + restPart;
  }).join(', ');
}

// 对一个元素的一组属性执行绝对化
function absolutizeElementAttrs(el, attrs) {
  for (const attr of attrs) {
    let val = null;
    try { val = el.getAttribute(attr); } catch (_) { continue; }
    if (val == null) continue;
    // srcset 特殊处理
    if (attr === 'srcset') {
      el.setAttribute(attr, absolutizeSrcset(val));
      continue;
    }
    // poster / action / src / href / xlink:href / data-src
    el.setAttribute(attr, absolutizeUrl(val));
  }
}

// ===== SPA 导航检测（必须在 content script 顶层立即执行，早于 DOMContentLoaded）=====
(function hookHistory() {
  try {
    if (window.__wpm_history_hooked) return;
    window.__wpm_history_hooked = true;

    const origPushState = window.history.pushState;
    const origReplaceState = window.history.replaceState;

    function dispatchNav() {
      try { window.dispatchEvent(new CustomEvent('__wpm_spa_nav__')); } catch (_) {}
    }

    if (typeof origPushState === 'function') {
      window.history.pushState = function (...args) {
        const result = origPushState.apply(this, args);
        dispatchNav();
        return result;
      };
    }
    if (typeof origReplaceState === 'function') {
      window.history.replaceState = function (...args) {
        const result = origReplaceState.apply(this, args);
        dispatchNav();
        return result;
      };
    }
  } catch (_) {
    // 某些受限页面可能 hook 失败，静默忽略
  }
})();

// ===== 初始化 =====
function init() {
  // 只在顶层 frame 注册所有能力，避免 iframe 嵌套时每个子 frame 也各自跑一遍
  if (window.top !== window.self) {
    return;
  }

  // 防御：清理可能在上次 init 残留的监听器
  cleanupKeyboardListeners();

  installKeyboardShortcut();
  chrome.runtime.onMessage.addListener(onMessage);

  // SPA 导航响应（history hook 已在顶层执行，这里只注册处理函数）
  window.addEventListener('popstate', handleSpaNav, true);
  window.addEventListener('hashchange', handleSpaNav, true);
  window.addEventListener('__wpm_spa_nav__', handleSpaNav, true);
}

function handleSpaNav() {
  if (window.top !== window.self) return;
  // 先刷新 URL_BASE，后续创建放大镜时资源绝对化需要用新的 base
  refreshUrlBase();
  // 销毁放大镜
  if (magnifier) {
    magnifier.destroy();
    magnifier = null;
  }
  // 退出选区模式
  if (selectMode) {
    selectMode = false;
    exitSelectMode();
  }
  // 通知 popup
  try {
    chrome.runtime.sendMessage({ type: 'SPA_NAVIGATED' });
  } catch (_) {}
}

// ===== 消息处理 =====
function onMessage(msg, sender, sendResponse) {
  // 子 frame 兜底：不响应 popup 的指令
  if (window.top !== window.self) {
    sendResponse({ ok: false, reason: 'not-top-frame' });
    return true;
  }

  switch (msg && msg.type) {
    case 'PING':
      sendResponse({ ok: true });
      break;
    case 'TOGGLE_SELECT_MODE': {
      const sm = toggleSelectMode();
      sendResponse({ ok: true, selectMode: sm });
      break;
    }
    case 'CREATE_MAGNIFIER': {
      const m = createMagnifier(msg.rect, msg.options || {});
      if (!m) {
        sendResponse({ ok: false, reason: 'invalid rect' });
        break;
      }
      sendResponse({ ok: true });
      break;
    }
    case 'DESTROY_ALL':
      destroyAllMagnifiers();
      sendResponse({ ok: true });
      break;
    case 'GET_STATUS':
      sendResponse({
        ok: true,
        selectMode,
        hasMagnifier: !!magnifier,
        scale: magnifier ? magnifier.scale : DEFAULT_SCALE,
        zIndexHigh: magnifier ? magnifier.zIndexHigh : true,
      });
      break;
    case 'SET_SCALE':
      if (magnifier) magnifier.setScale(msg.scale);
      sendResponse({ ok: true });
      break;
    case 'TOGGLE_Z_INDEX': {
      const newZ = magnifier ? magnifier.toggleZIndex() : true;
      sendResponse({ ok: true, zIndexHigh: newZ });
      break;
    }
    case 'DESTROY_CURRENT':
      if (magnifier) {
        magnifier.destroy();
        magnifier = null;
      }
      sendResponse({ ok: true });
      break;
    case 'RESPAWN':
      // SPA 导航后重新初始化（保留调用方自行销毁旧实例的责任）
      sendResponse({ ok: true });
      break;
    default:
      sendResponse({ ok: false, reason: msg ? 'unknown type' : 'empty message' });
  }
  return true;
}

// ===== 快捷键（兜底，比 service_worker 更实时）=====
// installKeyboardShortcut() 已在 init() 中调用

// ===== 选区模式 =====
function toggleSelectMode() {
  selectMode = !selectMode;
  if (selectMode) {
    enterSelectMode();
  } else {
    exitSelectMode();
  }
  chrome.runtime.sendMessage({ type: 'SELECT_MODE_CHANGED', selectMode }).catch(() => {});
  return selectMode;
}

function enterSelectMode() {
  // 先确保之前可能残留的监听器都被清掉
  cleanupSelectListeners();
  createSelectOverlay();
  selectOverlay.addEventListener('mousedown', onSelectMouseDown);
  selectOverlay.addEventListener('contextmenu', (e) => e.preventDefault());
  document.body.style.cursor = 'crosshair';
  // 禁止整个页面文本选择，避免拖拽选区时意外选中文字
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
}

function exitSelectMode() {
  cleanupSelectListeners();
  if (selectOverlay) {
    selectOverlay.remove();
    selectOverlay = null;
  }
  selectStart = null;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';
}

function cleanupSelectListeners() {
  if (selectOverlay) {
    selectOverlay.removeEventListener('mousedown', onSelectMouseDown);
  }
  if (MOVE_LISTENERS.move) {
    document.removeEventListener('mousemove', MOVE_LISTENERS.move, true);
    MOVE_LISTENERS.move = null;
  }
  if (MOVE_LISTENERS.up) {
    document.removeEventListener('mouseup', MOVE_LISTENERS.up, true);
    MOVE_LISTENERS.up = null;
  }
  if (MOVE_LISTENERS.key) {
    document.removeEventListener('keydown', MOVE_LISTENERS.key, true);
    MOVE_LISTENERS.key = null;
  }
}

function createSelectOverlay() {
  selectOverlay = document.createElement('div');
  selectOverlay.className = '__wpm_select_overlay';
  selectOverlay.innerHTML =
    '<div class="__wpm_select_box"></div>' +
    '<div class="__wpm_select_hint">按住鼠标拖拽选择区域 · Esc 取消</div>';
  document.body.appendChild(selectOverlay);
}

function onSelectMouseDown(e) {
  if (!selectMode) return;
  if (e.button !== 0) return;
  const box = selectOverlay.querySelector('.__wpm_select_box');
  box.style.display = 'none';
  selectStart = { x: e.clientX, y: e.clientY };

  MOVE_LISTENERS.move = onSelectMouseMove;
  MOVE_LISTENERS.up = onSelectMouseUp;
  MOVE_LISTENERS.key = onSelectKeyDown;

  document.addEventListener('mousemove', MOVE_LISTENERS.move, true);
  document.addEventListener('mouseup', MOVE_LISTENERS.up, true);
  document.addEventListener('keydown', MOVE_LISTENERS.key, true);
  e.preventDefault();
  e.stopPropagation();
}

function onSelectMouseMove(e) {
  if (!selectStart) return;
  const box = selectOverlay.querySelector('.__wpm_select_box');
  const x = Math.min(e.clientX, selectStart.x);
  const y = Math.min(e.clientY, selectStart.y);
  const w = Math.abs(e.clientX - selectStart.x);
  const h = Math.abs(e.clientY - selectStart.y);
  if (w < 2 && h < 2) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  box.style.left = x + 'px';
  box.style.top = y + 'px';
  box.style.width = w + 'px';
  box.style.height = h + 'px';
  e.preventDefault();
  e.stopPropagation();
}

function onSelectMouseUp(e) {
  const hadStart = !!selectStart;
  cleanupSelectListeners();

  if (!hadStart) return;

  const rect = {
    left: Math.min(e.clientX, selectStart.x),
    top: Math.min(e.clientY, selectStart.y),
    width: Math.abs(e.clientX - selectStart.x),
    height: Math.abs(e.clientY - selectStart.y),
  };
  selectStart = null;

  // 无论选区多小都退出选区模式（但太小则不创建放大镜）
  selectMode = false;
  exitSelectMode();
  chrome.runtime.sendMessage({ type: 'SELECT_MODE_CHANGED', selectMode }).catch(() => {});

  if (rect.width < 4 || rect.height < 4) {
    return;
  }

  createMagnifier(rect);
}

function onSelectKeyDown(e) {
  if (e.key === 'Escape') {
    selectMode = false;
    exitSelectMode();
    chrome.runtime.sendMessage({ type: 'SELECT_MODE_CHANGED', selectMode }).catch(() => {});
  }
}

// ===== 放大镜工厂 =====
function createMagnifier(rect, options) {
  // 参数校验：防止外部传入无效 rect 导致 NaN 写入 DOM
  if (!rect || typeof rect !== 'object') return null;
  const required = ['left', 'top', 'width', 'height'];
  for (const k of required) {
    if (typeof rect[k] !== 'number' || !isFinite(rect[k])) return null;
  }
  if (rect.width <= 0 || rect.height <= 0) return null;

  options = options || {};
  const scale = clamp(typeof options.scale === 'number' ? options.scale : DEFAULT_SCALE, MIN_SCALE, MAX_SCALE);
  if (magnifier) magnifier.destroy();
  magnifier = new Magnifier(rect, scale);
  return magnifier;
}

function destroyAllMagnifiers() {
  if (magnifier) magnifier.destroy();
  magnifier = null;
}

function clamp(v, min, max) {
  const n = Number(v);
  if (!isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// ===== Magnifier 类 =====
class Magnifier {
  constructor(rect, scale) {
    this.destroyed = false;
    this.sourceRect = rect;
    this.scale = scale;
    this.zIndexHigh = true;
    this.dragState = null;
    this._listeners = [];  // 保存所有 addEventListener 引用便于 destroy

    this.dragMoveHandler = null;
    this.dragEndHandler = null;

    this.build();
  }

  _addListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._listeners.push({ target, type, handler, options });
  }

  build() {
    // 防御：sourceRect 必须有效（虽然 createMagnifier 已校验，此处再加一道保险）
    if (!this.sourceRect || !isFinite(this.sourceRect.left) || !isFinite(this.sourceRect.width) || !isFinite(this.sourceRect.height)) {
      // 强制进入 empty 状态
      this.el = document.createElement('div');
      this.el.className = '__wpm_magnifier';
      this.scaleWrap = document.createElement('div');
      this.scaleWrap.innerHTML = '<div class="__wpm_empty">区域数据异常</div>';
      this.el.appendChild(this.scaleWrap);
      document.body.appendChild(this.el);
      return;
    }

    const pageRect = this.sourceRectToPage(this.sourceRect);
    const contentNode = this.captureContent(pageRect);

    this.el = document.createElement('div');
    this.el.className = '__wpm_magnifier';
    this.el.style.left = this.sourceRect.left + 'px';
    this.el.style.top = this.sourceRect.top + 'px';
    // 放大镜外层自身尺寸也要按 scale 扩大，保持"视觉尺寸 = 外层 rect"
    this.el.style.width = (this.sourceRect.width * this.scale) + 'px';
    this.el.style.height = (this.sourceRect.height * this.scale) + 'px';

    this.scaleWrap = document.createElement('div');
    this.scaleWrap.className = '__wpm_scale_wrap';
    this.scaleWrap.style.width = this.sourceRect.width + 'px';
    this.scaleWrap.style.height = this.sourceRect.height + 'px';

    if (contentNode) {
      this.scaleWrap.appendChild(contentNode);
    } else {
      this.scaleWrap.innerHTML =
        '<div class="__wpm_empty">未能捕获该区域内容，请尝试其他选区</div>';
    }

    this.el.appendChild(this.scaleWrap);

    this.panel = this.buildPanel();
    this.el.appendChild(this.panel);

    this.applyScale();
    this.applyZIndex();
    this.bindEvents();

    document.body.appendChild(this.el);

    // 初始化位置校正
    this.keepInViewport();

    // 通知 popup 放大镜已创建
    try {
      chrome.runtime.sendMessage({ type: 'MAGNIFIER_CREATED', scale: this.scale });
    } catch (_) {}
  }

  sourceRectToPage(rect) {
    const sy = window.scrollY || window.pageYOffset || 0;
    const sx = window.scrollX || window.pageXOffset || 0;
    return {
      left: rect.left + sx,
      top: rect.top + sy,
      right: rect.left + sx + rect.width,
      bottom: rect.top + sy + rect.height,
      width: rect.width,
      height: rect.height,
    };
  }

  /**
   * 选区内容捕获：
   *  - 在选区中心找起点元素
   *  - 向上找 bounding rect 能完整覆盖选区的最近祖先
   *  - 深克隆并通过负偏移对齐到选区，外层 clip 裁切
   */
  captureContent(pageRect) {
    const cx = pageRect.left + pageRect.width / 2;
    const cy = pageRect.top + pageRect.height / 2;
    const viewportX = cx - (window.scrollX || 0);
    const viewportY = cy - (window.scrollY || 0);
    let el = document.elementFromPoint(viewportX, viewportY);

    // 退一步：若中心点没元素（选区落在空白上），取四角/中点的第一个
    if (!el) {
      const candidates = [
        [pageRect.left - (window.scrollX || 0) + 2, pageRect.top - (window.scrollY || 0) + 2],
        [pageRect.right - (window.scrollX || 0) - 2, pageRect.bottom - (window.scrollY || 0) - 2],
      ];
      for (const [x, y] of candidates) {
        el = document.elementFromPoint(x, y);
        if (el) break;
      }
    }

    if (!el) return null;

    // 向上找覆盖整个选区的祖先
    let container = el;
    while (container && container.nodeType === 1 && container !== document.body && container !== document.documentElement) {
      const r = container.getBoundingClientRect();
      const absL = r.left + (window.scrollX || 0);
      const absT = r.top + (window.scrollY || 0);
      const absR = r.right + (window.scrollX || 0);
      const absB = r.bottom + (window.scrollY || 0);
      if (absL <= pageRect.left && absT <= pageRect.top && absR >= pageRect.right && absB >= pageRect.bottom) {
        break;
      }
      container = container.parentElement;
    }
    if (!container || container === document.documentElement) {
      container = el;
    }

    const clone = container.cloneNode(true);
    const origBR = container.getBoundingClientRect();
    const absLeft = origBR.left + (window.scrollX || 0);
    const absTop = origBR.top + (window.scrollY || 0);

    clone.style.position = 'absolute';
    clone.style.left = (absLeft - pageRect.left) + 'px';
    clone.style.top = (absTop - pageRect.top) + 'px';
    clone.style.margin = '0';
    clone.style.padding = '0';
    clone.style.width = origBR.width + 'px';
    clone.style.height = origBR.height + 'px';

    // ===== 安全清洗 =====
    // 1. 移除可执行/插件/跳转类元素
    clone.querySelectorAll('script, iframe, link[rel=stylesheet], object, embed, base').forEach((n) => n.remove());
    clone.querySelectorAll('meta[http-equiv]').forEach((n) => {
      const equiv = (n.getAttribute('http-equiv') || '').toLowerCase();
      if (equiv === 'refresh') n.remove();
    });

    // 2. 去除所有内联事件处理器（on* 属性）
    clone.querySelectorAll('*').forEach((n) => {
      if (!n.attributes) return;
      for (const attr of Array.from(n.attributes)) {
        if (attr.name.length > 2 && attr.name.startsWith('on')) n.removeAttribute(attr.name);
      }
    });

    // 3. 修复相对路径图片/资源（手动绝对化，绕过页面 <base> 影响）
    const targets = [
      // 图片
      ['img', ['src', 'data-src', 'srcset']],
      // 视频/音频
      ['video', ['src', 'poster', 'data-src']],
      ['audio', ['src', 'data-src']],
      // source
      ['source', ['src', 'srcset']],
      // SVG image / use
      ['image', ['href', 'xlink:href']],
      ['use', ['href', 'xlink:href']],
      // form
      ['form', ['action']],
      // link（rel=stylesheet 已移除，但 rel=icon 等需要绝对化）
      ['link', ['href']],
      // a href（去掉 javascript: 和 # 的已在 absolutizeUrl 里跳过）
      ['a', ['href']],
      // 通用 data-src
      ['[data-src]', ['data-src']],
    ];
    for (const [selector, attrs] of targets) {
      clone.querySelectorAll(selector).forEach((n) => {
        try { absolutizeElementAttrs(n, attrs); } catch (_) {}
      });
    }

    // 4. 处理 a[target="_blank"] 安全加固
    clone.querySelectorAll('a[target="_blank"]').forEach((a) => {
      const rel = a.getAttribute('rel') || '';
      if (!/\bnoopener\b/.test(rel)) {
        a.setAttribute('rel', (rel + ' noopener').trim());
      }
    });
    // 5. 移除 download 属性防止下载劫持
    clone.querySelectorAll('a[download]').forEach((a) => {
      a.removeAttribute('download');
    });

    // 6. 修复 id，防止与原页面冲突
    let idCounter = 0;
    clone.querySelectorAll('[id]').forEach((n) => {
      n.setAttribute('id', '__wpm_cloned_' + idCounter++);
    });

    const clip = document.createElement('div');
    clip.className = '__wpm_clip';
    clip.style.position = 'relative';
    clip.style.width = '100%';
    clip.style.height = '100%';
    clip.style.overflow = 'hidden';
    clip.appendChild(clone);
    return clip;
  }

  buildPanel() {
    const panel = document.createElement('div');
    panel.className = '__wpm_panel';
    panel.innerHTML =
      '<div class="__wpm_panel_drag" title="拖动放大镜">⋮⋮</div>' +
      '<div class="__wpm_panel_body">' +
      '<label class="__wpm_scale_label">缩放 <span class="__wpm_scale_value">' + (this.scale * 100).toFixed(0) + '%</span></label>' +
      '<input class="__wpm_scale_range" type="range" min="' + MIN_SCALE + '" max="' + MAX_SCALE + '" step="0.1" value="' + this.scale + '" />' +
      '<div class="__wpm_panel_buttons">' +
      '<button class="__wpm_btn __wpm_btn_z" type="button">置顶</button>' +
      '<button class="__wpm_btn __wpm_btn_close" type="button" title="关闭">✕</button>' +
      '</div></div>';
    return panel;
  }

  bindEvents() {
    const handle = this.panel.querySelector('.__wpm_panel_drag');
    this._addListener(handle, 'mousedown', (e) => this.startDrag(e));

    const range = this.panel.querySelector('.__wpm_scale_range');
    this._addListener(range, 'input', (e) => {
      const v = parseFloat(e.target.value);
      this.setScale(v);
    });

    const zBtn = this.panel.querySelector('.__wpm_btn_z');
    this._addListener(zBtn, 'click', () => this.toggleZIndex());

    const closeBtn = this.panel.querySelector('.__wpm_btn_close');
    this._addListener(closeBtn, 'click', () => this.destroy());

    // 阻止面板事件穿透到下面的克隆内容
    this._addListener(this.panel, 'mousedown', (e) => e.stopPropagation());
    this._addListener(this.panel, 'click', (e) => e.stopPropagation());
    this._addListener(this.el, 'mousedown', (e) => e.stopPropagation());
  }

  startDrag(e) {
    if (this.destroyed || e.button !== 0) return;
    const rect = this.el.getBoundingClientRect();
    this.dragState = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    this.dragMoveHandler = (ev) => this._onDragMove(ev);
    this.dragEndHandler = () => this._onDragEnd();
    document.addEventListener('mousemove', this.dragMoveHandler, true);
    document.addEventListener('mouseup', this.dragEndHandler, true);
    e.preventDefault();
    e.stopPropagation();
  }

  _onDragMove(e) {
    if (!this.dragState) return;
    const x = e.clientX - this.dragState.offsetX;
    const y = e.clientY - this.dragState.offsetY;
    this.el.style.left = x + 'px';
    this.el.style.top = y + 'px';
  }

  _onDragEnd() {
    this.dragState = null;
    if (this.dragMoveHandler) {
      document.removeEventListener('mousemove', this.dragMoveHandler, true);
      this.dragMoveHandler = null;
    }
    if (this.dragEndHandler) {
      document.removeEventListener('mouseup', this.dragEndHandler, true);
      this.dragEndHandler = null;
    }
    // 松手后强制回视口内
    this.keepInViewport();
  }

  setScale(scale) {
    if (this.destroyed) return;
    const prevW = this.sourceRect.width * this.scale;
    const prevH = this.sourceRect.height * this.scale;
    this.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
    const nextW = this.sourceRect.width * this.scale;
    const nextH = this.sourceRect.height * this.scale;

    // 保持右上角锚点，让面板始终可见
    const rect = this.el.getBoundingClientRect();
    const right = rect.right;
    const bottom = rect.bottom;
    this.el.style.left = (right - nextW) + 'px';
    this.el.style.top = (bottom - nextH) + 'px';
    this.el.style.width = nextW + 'px';
    this.el.style.height = nextH + 'px';

    this.applyScale();
    this.keepInViewport();

    const val = this.panel.querySelector('.__wpm_scale_value');
    if (val) val.textContent = (this.scale * 100).toFixed(0) + '%';
    const range = this.panel.querySelector('.__wpm_scale_range');
    if (range) range.value = this.scale;
  }

  applyScale() {
    this.scaleWrap.style.transformOrigin = 'top left';
    this.scaleWrap.style.transform = 'scale(' + this.scale + ')';
  }

  toggleZIndex() {
    if (this.destroyed) return this.zIndexHigh;
    this.zIndexHigh = !this.zIndexHigh;
    this.applyZIndex();
    const zBtn = this.panel.querySelector('.__wpm_btn_z');
    if (zBtn) {
      zBtn.textContent = this.zIndexHigh ? '置顶' : '置底';
      zBtn.title = this.zIndexHigh
        ? '当前：置顶（在所有页面元素之上）'
        : '当前：置底（在大部分页面元素之下）';
    }
    return this.zIndexHigh;
  }

  applyZIndex() {
    this.el.style.zIndex = this.zIndexHigh ? Z_INDEX_TOP : Z_INDEX_BOTTOM;
  }

  keepInViewport() {
    const rect = this.el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const MARGIN = 8;
    let x = rect.left;
    let y = rect.top;

    if (rect.width > vw - MARGIN * 2) x = MARGIN;
    else if (rect.right > vw - MARGIN) x = vw - rect.width - MARGIN;
    if (rect.height > vh - MARGIN * 2) y = MARGIN;
    else if (rect.bottom > vh - MARGIN) y = vh - rect.height - MARGIN;
    if (x < MARGIN) x = MARGIN;
    if (y < MARGIN) y = MARGIN;

    this.el.style.left = x + 'px';
    this.el.style.top = y + 'px';
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    // 1. 清理所有实例注册的监听器
    this._listeners.forEach(({ target, type, handler, options }) => {
      try { target.removeEventListener(type, handler, options); } catch (_) {}
    });
    this._listeners.length = 0;

    // 2. 清理 document 级拖拽监听器
    if (this.dragMoveHandler) {
      document.removeEventListener('mousemove', this.dragMoveHandler, true);
      this.dragMoveHandler = null;
    }
    if (this.dragEndHandler) {
      document.removeEventListener('mouseup', this.dragEndHandler, true);
      this.dragEndHandler = null;
    }
    this.dragState = null;

    // 3. 移除 DOM
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this.el = null;
    this.scaleWrap = null;
    this.panel = null;

    // 4. 清理全局引用
    if (magnifier === this) magnifier = null;

    // 5. 通知 popup
    try {
      chrome.runtime.sendMessage({ type: 'MAGNIFIER_DESTROYED' });
    } catch (_) {}
  }
}

// ===== 启动 =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
