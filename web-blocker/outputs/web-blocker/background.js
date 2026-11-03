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
let stateWriteQueue = Promise.resolve();

const ALL_KEYS = ['rules', 'masterEnabled', 'pausedSites'];
const AUTO_BACKUP_KEY = '__autoBackup_v1';

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

/* 备份 / 还原
 *
 * 备份 = 全量 storage.local 快照（rules / masterEnabled / pausedSites）+ 版本号 + 时间戳。
 * 还原 = 把快照写回 storage.local；还原前**必须**自动保存一份当前状态到 __autoBackup_v1，
 *       一旦用户后悔可以点「撤销刚才的还原」——避免"还原文件坏了 / 还原了错误版本"
 *       导致数据全无。
 */
function exportBackup() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (all) => {
      const snap = {};
      ALL_KEYS.forEach((k) => {
        if (k in all) snap[k] = all[k];
      });
      resolve({
        format: 'web-blocker-backup',
        version: 1,
        createdAt: new Date().toISOString(),
        data: snap,
      });
    });
  });
}

function importBackup(payload) {
  const run = stateWriteQueue.then(() => doImport(payload));
  stateWriteQueue = run.then(() => {}, () => {});
  return run;
}

function doImport(payload) {
  return new Promise((resolve, reject) => {
    if (!payload || !payload.data || typeof payload.data !== 'object') {
      reject(new Error('备份文件缺少 data 字段'));
      return;
    }
    // 还原前自动备份，留一条后悔路
    chrome.storage.local.get(null, (before) => {
      const autoSnap = { format: 'web-blocker-rollback', createdAt: new Date().toISOString(), data: {} };
      ALL_KEYS.forEach((k) => { if (k in before) autoSnap.data[k] = before[k]; });
      const setData = { [AUTO_BACKUP_KEY]: autoSnap };
      ALL_KEYS.forEach((k) => { if (k in payload.data) setData[k] = payload.data[k]; });
      chrome.storage.local.set(setData, () => {
        // 清掉用户可能残留的旧 autoBackup，只保留最新一份
        chrome.storage.local.remove(['__autoBackup_v0'], () => {
          const snap = {};
          ALL_KEYS.forEach((k) => { if (k in payload.data) snap[k] = payload.data[k]; });
          // 回填默认值，避免某些键缺失时 content 拿到 undefined
          chrome.storage.local.get({ masterEnabled: true, rules: [], pausedSites: [] }, (final) => {
            resolve({
              ok: true,
              restoredKeys: ALL_KEYS.filter((k) => k in payload.data),
              preRestoreBackup: { createdAt: autoSnap.createdAt, rollbackKey: AUTO_BACKUP_KEY },
              rulesCount: (final.rules || []).length,
              pausedSitesCount: (final.pausedSites || []).length,
              masterEnabled: final.masterEnabled !== false,
            });
          });
        });
      });
    });
  });
}

function rollbackBackup() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(AUTO_BACKUP_KEY, (snap) => {
      if (!snap[AUTO_BACKUP_KEY]) { reject(new Error('没有可撤销的还原')); return; }
      const data = snap[AUTO_BACKUP_KEY].data || {};
      const setData = {};
      ALL_KEYS.forEach((k) => { if (k in data) setData[k] = data[k]; });
      chrome.storage.local.set(setData, () => {
        chrome.storage.local.remove([AUTO_BACKUP_KEY], () => resolve({ ok: true, rolledBackKeys: Object.keys(data) }));
      });
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
      (err) => sendResponse({ ok: false, error: String(err) })
    );
    return true;
  }
  if (msg && msg.type === 'blk:backup:export') {
    exportBackup().then(
      (res) => sendResponse({ ok: true, backup: res }),
      (err) => sendResponse({ ok: false, error: String(err) })
    );
    return true;
  }
  if (msg && msg.type === 'blk:backup:import') {
    importBackup(msg.backup).then(
      (res) => sendResponse(res),
      (err) => sendResponse({ ok: false, error: String(err) })
    );
    return true;
  }
  if (msg && msg.type === 'blk:backup:rollback') {
    rollbackBackup().then(
      (res) => sendResponse(res),
      (err) => sendResponse({ ok: false, error: String(err) })
    );
    return true;
  }
  if (msg && msg.type === 'blk:backup:hasAuto') {
    chrome.storage.local.get(AUTO_BACKUP_KEY, (snap) => {
      const s = snap[AUTO_BACKUP_KEY];
      sendResponse({ ok: true, has: !!s, createdAt: s && s.createdAt });
    });
    return true;
  }
});
