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

/* ---------------------------------------------------------------- 规则写入串行队列
 *
 * content（点选确认）和 popup（启停 / 删除 / 导入 / 清空）都会写
 * chrome.storage.local.rules。它们各自 get→改→set，两个页面同时写就会用旧快照
 * 覆盖对方，规则静默丢失。这里把所有写操作收进 SW 的 Promise 链排队执行——
 * 任何时刻只有一个「读改写」在进行。
 */
let ruleWriteQueue = Promise.resolve();

function mutateRules(op) {
  const run = ruleWriteQueue.then(() => applyRuleOp(op || {}));
  ruleWriteQueue = run.then(
    () => {},
    () => {}
  );
  return run;
}

function applyRuleOp(op) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ rules: [] }, (saved) => {
      let rules = saved && Array.isArray(saved.rules) ? saved.rules : [];
      let changed = 0;
      if (op.kind === 'add' && op.rule) {
        rules = rules.concat([op.rule]);
        changed = 1;
      } else if (op.kind === 'addMany' && Array.isArray(op.rules)) {
        const known = new Set(rules.map((r) => r && r.id));
        const fresh = op.rules.filter((r) => r && r.id && !known.has(r.id));
        rules = rules.concat(fresh);
        changed = fresh.length;
      } else if (op.kind === 'update' && op.id && op.patch) {
        rules = rules.map((r) => (r && r.id === op.id ? Object.assign({}, r, op.patch) : r));
        changed = 1;
      } else if (op.kind === 'remove') {
        const before = rules.length;
        rules = rules.filter((r) => !r || r.id !== op.id);
        changed = before - rules.length;
      } else if (op.kind === 'removeHost') {
        const before = rules.length;
        rules = rules.filter((r) => !r || r.host !== op.host);
        changed = before - rules.length;
      }
      chrome.storage.local.set({ rules: rules }, () => resolve({ rules: rules, changed: changed }));
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'blk:state' && sender.tab) {
    setBadge(sender.tab.id, !!(msg.tabPaused || msg.sitePaused || msg.masterOff));
    return;
  }
  if (msg && msg.type === 'blk:rules:mutate') {
    mutateRules(msg.op).then(
      (res) => sendResponse({ ok: true, rules: res.rules, changed: res.changed }),
      (err) => sendResponse({ ok: false, error: String(err) }) // 明确失败，调用方不必等端口超时
    );
    return true; // 异步回复，保持消息通道
  }
});
