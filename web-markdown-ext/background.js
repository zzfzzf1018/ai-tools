// Web to Markdown - Service Worker
// 职责：注册右键菜单、调度快捷键/菜单事件、按需注入内容脚本、图片下载。

const MENU_PAGE = 'wmd-page';
const MENU_SELECTION = 'wmd-selection';
const MENU_LINK = 'wmd-link';  // 链接右键：转换链接指向的页面

// 按需注入到页面的脚本（顺序即依赖顺序）
const CONTENT_SCRIPTS = [
  'lib/readability.js',
  'lib/turndown.js',
  'lib/turndown-plugin-gfm.js',
  'lib/config.js',
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
    chrome.contextMenus.create({
      id: MENU_LINK,
      title: '转换此链接页面为 Markdown',
      contexts: ['link']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_PAGE) {
    convertInPage(tab, 'article');
  } else if (info.menuItemId === MENU_SELECTION) {
    convertInPage(tab, 'selection');
  } else if (info.menuItemId === MENU_LINK && info.linkUrl) {
    // 链接右键：新标签页打开链接，等待加载后转换
    convertLinkPage(info.linkUrl);
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

// 处理 content script 发来的图片下载请求
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'wmd:download-image' && msg.url && msg.filename) {
    // 触发下载（静默方式，用户不会看到每个图片的保存对话框）
    chrome.downloads.download({
      url: msg.url,
      filename: msg.filename,
      conflictAction: 'uniquify',
      saveAs: false
    }, () => {
      // 静默忽略下载结果
    });
    if (sendResponse) sendResponse({ ok: true });
    return true;
  }
});

// === 核心方法 ===

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

// 链接右键：打开新标签页，等待加载后注入并转换
function convertLinkPage(url) {
  // #7 URL 协议校验：只处理 http(s) 和 file
  if (!/^(https?:|file:)/i.test(url)) {
    notify('Web to Markdown', '此链接类型不支持转换（仅支持 http/https/file）。');
    return;
  }

  chrome.tabs.create({ url, active: false }, (newTab) => {
    // #6 防御：受限 URL（如 chrome-scheme 被拒、跨域）下 newTab 可能为 undefined
    if (!newTab) {
      notify('Web to Markdown', '无法打开此链接页面。');
      return;
    }
    const tabId = newTab.id;

    // 等待页面加载完成
    let fired = false;
    const listener = (id, changeInfo) => {
      if (id !== tabId) return;
      if (changeInfo.status === 'complete' && !fired) {
        fired = true;
        chrome.tabs.onUpdated.removeListener(listener);
        // 延迟一下确保 Readability 能正确工作
        setTimeout(() => {
          convertInPage({ id: tabId }, 'article');
        }, 1500);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);

    // 20 秒超时兜底
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      if (!fired) {
        // #8 超时后关闭孤立的新 tab（如果用户还没看到的话）
        // 用 query 查一下 tab 是否还存在（用户可能已手动处理）
        chrome.tabs.get(tabId, (t) => {
          if (!chrome.runtime.lastError && t && !t.active) {
            chrome.tabs.remove(tabId);
          }
        });
      }
    }, 20000);
  });
}

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message
  });
}
