/* global chrome */
'use strict';

/**
 * Popup Script
 *
 * 职责：
 *  - 首次打开时探测当前 tab 的 content script 状态并保证其就绪
 *  - 提供选区开关、缩放调节、层级切换、关闭按钮
 *  - 所有 sendMessage 都带 try/catch，避免因 content 不可达而阻塞 UI
 *  - 监听来自 content 的状态广播，实时更新面板状态
 *
 * 消息协议（popup → content）：
 *   PING / TOGGLE_SELECT_MODE / GET_STATUS / SET_SCALE / TOGGLE_Z_INDEX
 *   DESTROY_CURRENT / DESTROY_ALL / CREATE_MAGNIFIER / RESPAWN
 *
 * 消息协议（content → popup，runtime.sendMessage）：
 *   SELECT_MODE_CHANGED / MAGNIFIER_CREATED / MAGNIFIER_DESTROYED / SPA_NAVIGATED
 */

const FILES = {
  js: 'content.js',
  css: 'content.css',
};

const DEFAULT_SCALE = 2.0;

// ===== DOM 引用 =====
const $toggleSelect = document.getElementById('toggleSelect');
const $selectIcon = document.getElementById('selectIcon');
const $selectText = document.getElementById('selectText');
const $controlSection = document.getElementById('controlSection');
const $scaleValue = document.getElementById('scaleValue');
const $scaleRange = document.getElementById('scaleRange');
const $scaleUp = document.getElementById('scaleUp');
const $scaleDown = document.getElementById('scaleDown');
const $scaleReset = document.getElementById('scaleReset');
const $toggleZ = document.getElementById('toggleZ');
const $destroy = document.getElementById('destroy');

// ===== 状态 =====
let selectMode = false;
let hasMagnifier = false;
let currentScale = DEFAULT_SCALE;
let zIndexHigh = true;

// ===== 工具 =====
async function getActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs && tabs[0] ? tabs[0] : null;
  } catch {
    return null;
  }
}

function isInjectableUrl(url) {
  if (!url) return false;
  const blocked = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'view-source:', 'chrome-ntp-icon'];
  return !blocked.some((b) => url.startsWith(b));
}

async function ensureContentScript(tab) {
  if (!tab || !isInjectableUrl(tab.url)) return false;
  try {
    // 先 PING
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    // 只有顶层 content 成功响应 ok=true 才视为已注入
    if (resp && resp.ok && !resp.reason) return true;
    // 如果返回 ok:false（如子 frame 的 not-top-frame）或空响应 → 都当作未注入，继续主动注入
  } catch (_) { /* 未注入，继续 */ }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [FILES.js],
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: [FILES.css],
    });
    return true;
  } catch (err) {
    console.warn('[WPM] 无法注入 content script：', err);
    return false;
  }
}

async function sendToContent(tabId, msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch (err) {
    console.warn('[WPM] 消息失败', msg && msg.type, err);
    return null;
  }
}

// ===== UI 状态 =====
function setStatusUnavailable() {
  $toggleSelect.disabled = true;
  $toggleSelect.innerHTML = '<span>⚠️ 当前页面不支持</span>';
  $toggleSelect.title = '浏览器内置页面（如 edge://、chrome://）不允许扩展注入';
  $controlSection.hidden = true;
}

function updateUI() {
  if (selectMode) {
    $toggleSelect.classList.add('active');
    $selectIcon.textContent = '⏹';
    $selectText.textContent = '取消选区 (Esc)';
  } else {
    $toggleSelect.classList.remove('active');
    $selectIcon.textContent = '🎯';
    $selectText.textContent = '开始选区 (Ctrl+Shift+Y)';
  }

  if (hasMagnifier) {
    $controlSection.hidden = false;
    $scaleRange.value = currentScale.toFixed(1);
    $scaleValue.textContent = (currentScale * 100).toFixed(0) + '%';
    $toggleZ.textContent = zIndexHigh ? '⬆️ 层级：置顶' : '⬇️ 层级：置底';
  } else {
    $controlSection.hidden = true;
  }
}

async function refreshStatus() {
  const tab = await getActiveTab();
  if (!tab) return;
  const resp = await sendToContent(tab.id, { type: 'GET_STATUS' });
  if (!resp || !resp.ok) return;
  selectMode = resp.selectMode;
  hasMagnifier = resp.hasMagnifier;
  currentScale = typeof resp.scale === 'number' ? resp.scale : DEFAULT_SCALE;
  zIndexHigh = typeof resp.zIndexHigh === 'boolean' ? resp.zIndexHigh : true;
  updateUI();
}

// ===== 事件绑定 =====
function bindEvents(tab) {
  $toggleSelect.addEventListener('click', async () => {
    const t = await getActiveTab();
    if (!t) return;
    const resp = await sendToContent(t.id, { type: 'TOGGLE_SELECT_MODE' });
    if (resp && typeof resp.selectMode === 'boolean') {
      selectMode = resp.selectMode;
    }
    updateUI();
    // 切到选区模式后关闭 popup，让用户在页面上拖拽
    if (selectMode) window.close();
  });

  $scaleRange.addEventListener('input', async (e) => {
    const val = parseFloat(e.target.value);
    currentScale = val;
    $scaleValue.textContent = (val * 100).toFixed(0) + '%';
    const t = await getActiveTab();
    await sendToContent(t.id, { type: 'SET_SCALE', scale: val });
  });

  $scaleUp.addEventListener('click', async () => {
    const next = Math.min(5.0, currentScale + 0.2);
    await applyScale(next);
  });

  $scaleDown.addEventListener('click', async () => {
    const next = Math.max(1.0, currentScale - 0.2);
    await applyScale(next);
  });

  $scaleReset.addEventListener('click', async () => {
    await applyScale(DEFAULT_SCALE);
  });

  async function applyScale(val) {
    currentScale = val;
    $scaleRange.value = val.toFixed(1);
    $scaleValue.textContent = (val * 100).toFixed(0) + '%';
    const t = await getActiveTab();
    await sendToContent(t.id, { type: 'SET_SCALE', scale: val });
  }

  $toggleZ.addEventListener('click', async () => {
    const t = await getActiveTab();
    const resp = await sendToContent(t.id, { type: 'TOGGLE_Z_INDEX' });
    if (resp && typeof resp.zIndexHigh === 'boolean') {
      zIndexHigh = resp.zIndexHigh;
    } else {
      zIndexHigh = !zIndexHigh;
    }
    updateUI();
  });

  $destroy.addEventListener('click', async () => {
    const t = await getActiveTab();
    await sendToContent(t.id, { type: 'DESTROY_CURRENT' });
    hasMagnifier = false;
    updateUI();
  });

  // 监听来自 content 的状态广播
  // 注意：这里不检查 sender.tab —— 只处理 content 发送的消息
  // （background SW 也可能发来消息，但目前 background 不发 runtime.sendMessage，无需区分）
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg.type !== 'string') return;
    switch (msg.type) {
      case 'SELECT_MODE_CHANGED':
        selectMode = !!msg.selectMode;
        updateUI();
        break;
      case 'MAGNIFIER_CREATED':
        hasMagnifier = true;
        if (typeof msg.scale === 'number') currentScale = msg.scale;
        zIndexHigh = true;
        updateUI();
        break;
      case 'MAGNIFIER_DESTROYED':
      case 'SPA_NAVIGATED':
        hasMagnifier = false;
        selectMode = false;
        updateUI();
        break;
    }
  });
}

// ===== 启动 =====
async function init() {
  const tab = await getActiveTab();
  if (!tab || !isInjectableUrl(tab.url)) {
    setStatusUnavailable();
    return;
  }
  const ok = await ensureContentScript(tab);
  if (!ok) {
    setStatusUnavailable();
    return;
  }
  await refreshStatus();
  bindEvents(tab);
}

init();
