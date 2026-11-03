// Web to Markdown - Service Worker
// 职责：注册右键菜单、调度快捷键/菜单事件、按需注入内容脚本；不做实际转换。

const MENU_PAGE = 'wmd-page';
const MENU_SELECTION = 'wmd-selection';

// 按需注入到页面的脚本（顺序即依赖顺序）
const CONTENT_SCRIPTS = [
  'lib/readability.js',
  'lib/turndown.js',
  'lib/turndown-plugin-gfm.js',
  'lib/markdown-convert.js',
  'content/content.js'
];

// 安装/更新时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_PAGE,
      title: '转换整个网页为 Markdown',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: MENU_SELECTION,
      title: '转换选中内容为 Markdown',
      contexts: ['selection']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_PAGE) {
    convertInPage(tab, 'article');
  } else if (info.menuItemId === MENU_SELECTION) {
    convertInPage(tab, 'selection');
  }
});

// 快捷键（Alt+M）：转换选区
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'convert-selection') return;
  if (!tab) {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = active;
  }
  convertInPage(tab, 'selection');
});

// 向页面注入脚本并派发转换指令；转换与复制在 content script 内完成
async function convertInPage(tab, mode) {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: CONTENT_SCRIPTS
    });
    await chrome.tabs.sendMessage(tab.id, { type: 'wmd:convert', mode });
  } catch (err) {
    // 注入失败通常是受限页面（edge://、chrome:// 等），无法注入 Toast，改用系统通知
    notify('Web to Markdown', '该页面不支持转换（浏览器内置页面或受限页面）。');
  }
}

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message
  });
}
