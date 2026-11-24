/* global chrome */
'use strict';

/**
 * Background Service Worker
 *
 * 职责：
 *  1. 处理 chrome.commands 快捷键（快捷键的唯一来源，content 内不再监听组合键）
 *  2. content script 未就绪时主动注入
 *  3. 注入后等待 content script 就绪（PING 轮询）再发送指令，避免竞态
 *
 * 文件列表必须与 manifest.json 声明的 content_scripts 和 popup.js 使用的列表保持一致。
 */

const FILES = {
  js: 'content.js',
  css: 'content.css',
};

const BLOCKED_PROTOCOLS = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'devtools://',
  'about:',
  'view-source:',
  'https://chromewebstore.google.com',
  'https://microsoftedge.microsoft.com/addons',
];

function isInjectable(url) {
  if (!url) return false;
  return !BLOCKED_PROTOCOLS.some((b) => url.startsWith(b));
}

async function ensureInjected(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [FILES.js],
    });
  } catch (err) {
    console.warn('[WPM] 后台注入 JS 失败：', err);
    throw err;
  }

  // CSS 注入单独容错：样式失败不应判定整体注入失败（功能仍可用）
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: [FILES.css],
    });
  } catch (err) {
    console.warn('[WPM] 后台注入 CSS 失败（忽略）：', err);
  }
}

/**
 * 等待 content script 就绪：每 100ms 发一次 PING，超时返回 false
 * 解决 executeScript 注入后 content script 的 init() 可能尚未完成
 * chrome.runtime.onMessage.addListener 注册的竞态问题
 */
async function waitForContent(tabId, timeout = 2000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tryPing = async () => {
      try {
        const resp = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        if (resp && resp.ok) { resolve(true); return; }
      } catch (_) { /* 未就绪，继续重试 */ }
      if (Date.now() - start >= timeout) { resolve(false); return; }
      setTimeout(tryPing, 100);
    };
    tryPing();
  });
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-select-mode') return;

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs[0] || !isInjectable(tabs[0].url)) return;
  const tab = tabs[0];

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SELECT_MODE' });
  } catch (_) {
    // content 尚未就绪 → 主动注入
    try {
      await ensureInjected(tab.id);
      const ready = await waitForContent(tab.id, 2000);
      if (!ready) {
        console.warn('[WPM] content script 注入后 2s 内未就绪，放弃快捷键执行');
        return;
      }
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SELECT_MODE' });
    } catch (e) {
      console.warn('[WPM] 快捷键执行失败：', e);
    }
  }
});
