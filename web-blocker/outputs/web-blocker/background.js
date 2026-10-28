/**
 * 网页屏蔽器 —— 后台：快捷键命令分发 + 图标角标
 *
 * Alt+Shift+B  → 临时暂停/恢复「当前页面」（刷新即恢复屏蔽）
 * Alt+Shift+S  → 暂停/恢复「整个站点」（写进 storage，跨页面记住）
 *
 * 角标 ⏸ 由 content script 上报状态后设置，页面重载时 content script 会重新上报，
 * 所以不会出现「角标残留」的问题。
 */

const TOGGLE_MESSAGE = {
  'toggle-tab': 'blk:toggleTab',
  'toggle-site': 'blk:toggleSite',
};

function setBadge(tabId, paused) {
  if (typeof tabId !== 'number') return;
  chrome.action.setBadgeText({ tabId: tabId, text: paused ? '⏸' : '' });
  if (paused) chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#d94040' });
}

chrome.commands.onCommand.addListener((command) => {
  const type = TOGGLE_MESSAGE[command];
  if (!type) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { type: type }, (res) => {
      if (chrome.runtime.lastError || !res) {
        // 页面还没注入脚本（新标签页 / 不支持的页面）——什么也不做
        return;
      }
      setBadge(tab.id, res.tabPaused || res.sitePaused || res.masterOff);
    });
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'blk:state' && sender.tab) {
    setBadge(sender.tab.id, !!(msg.tabPaused || msg.sitePaused || msg.masterOff));
  }
});
