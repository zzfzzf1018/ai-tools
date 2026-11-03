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

/* 存储设计
 *
 * 双写：所有业务键同时存在 chrome.storage.local 和 chrome.storage.sync。
 *       sync 数据会随 Chrome/Edge 账号自动上云，卸载扩展后重装会从云端自动拉回。
 *       local 仍然是主读路径（快），local 为空时 fallback 到 sync（重装后第一次启动就是这个场景）。
 *       未登录 / 断网 / sync 配额超限 → sync 写入静默降级，local 不受影响。
 *
 * 隐藏键 __autoBackup_v1（还原前自动备份）不进 sync——它是一次性撤销用的，不需要跨设备同步。
 *
 * 业务键只有三个：
 */
const BLK_KEYS = ['rules', 'masterEnabled', 'pausedSites'];
const AUTO_BACKUP_KEY = '__autoBackup_v1';

/* ---------- 存储工具（local + sync 双写封装） ---------- */

function localGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function localSet(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}
function localRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}
function syncGet(keys) {
  return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
}
function syncSet(data) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set(data, () => {
        resolve(!chrome.runtime.lastError);
      });
    } catch { resolve(false); }
  });
}
function syncRemove(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.remove(keys, () => resolve(!chrome.runtime.lastError));
    } catch { resolve(false); }
  });
}

// local 优先读，local 没有则 fallback sync 拉回（卸载重装后首次启动走这里）
async function getPersisted(keys) {
  const localRes = await localGet(keys);
  const result = {};
  let needPull = [];
  (Array.isArray(keys) ? keys : [keys]).forEach((k) => {
    if (localRes && Object.prototype.hasOwnProperty.call(localRes, k)) {
      result[k] = localRes[k];
    } else {
      needPull.push(k);
    }
  });
  if (needPull.length) {
    const syncRes = await syncGet(needPull);
    const merged = {};
    let pullOne = false;
    needPull.forEach((k) => {
      if (syncRes && Object.prototype.hasOwnProperty.call(syncRes, k)) {
        result[k] = syncRes[k];
        merged[k] = syncRes[k];
        pullOne = true;
      }
    });
    if (pullOne) await localSet(merged); // 同步回 local，后续读就快了
  }
  return result;
}

// 写 local，同时镜像写 sync（sync 失败静默降级）
async function setPersisted(data) {
  await localSet(data);
  const syncData = {};
  Object.keys(data).forEach((k) => { if (BLK_KEYS.includes(k)) syncData[k] = data[k]; });
  if (Object.keys(syncData).length) {
    await syncSet(syncData); // 返回 boolean 表示 sync 成功与否，不影响主流程
  }
}

// 删 local，同时镜像删 sync
async function removePersisted(keys) {
  await localRemove(keys);
  const syncKeys = keys.filter((k) => BLK_KEYS.includes(k));
  if (syncKeys.length) await syncRemove(syncKeys);
}

function mutateRules(op) {
  const run = ruleWriteQueue.then(() => applyRuleOp(op || {}));
  ruleWriteQueue = run.then(
    () => {},
    () => {}
  );
  return run;
}

function applyRuleOp(op) {
  return getPersisted(['rules']).then((saved) => {
    let rules = saved.rules && Array.isArray(saved.rules) ? saved.rules : [];
    let changed = 0;
    if (op.kind === 'add' && op.rule) {
      // 新规则默认启用，兼容旧代码点选时没填 enabled 的情况
      if (op.rule.enabled === undefined) op.rule.enabled = true;
      rules = rules.concat([op.rule]);
      changed = 1;
    } else if (op.kind === 'addMany' && Array.isArray(op.rules)) {
      const known = new Set(rules.map((r) => r && r.id));
      const fresh = op.rules
        .filter((r) => r && r.id && !known.has(r.id))
        .map((r) => (r.enabled === undefined ? Object.assign({}, r, { enabled: true }) : r));
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
    return setPersisted({ rules: rules }).then(() => ({ rules: rules, changed: changed }));
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
  return getPersisted(BLK_KEYS).then((snap) => ({
    format: 'web-blocker-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    data: snap,
  }));
}

function importBackup(payload) {
  const run = stateWriteQueue.then(() => doImport(payload));
  stateWriteQueue = run.then(() => {}, () => {});
  return run;
}

async function doImport(payload) {
  if (!payload || !payload.data || typeof payload.data !== 'object') {
    throw new Error('备份文件缺少 data 字段');
  }
  // 还原前自动备份，留一条后悔路（autoBackup 是 local-only，不进 sync）
  const before = await localGet(null);
  const autoSnap = { format: 'web-blocker-rollback', createdAt: new Date().toISOString(), data: {} };
  BLK_KEYS.forEach((k) => { if (k in before) autoSnap.data[k] = before[k]; });
  await localSet({ [AUTO_BACKUP_KEY]: autoSnap });
  await localRemove(['__autoBackup_v0']); // 清掉旧残留

  // 写业务键 → setPersisted 会同时写 local + sync
  const setData = {};
  BLK_KEYS.forEach((k) => { if (k in payload.data) setData[k] = payload.data[k]; });
  if (Object.keys(setData).length) await setPersisted(setData);

  const final = await getPersisted(['masterEnabled', 'rules', 'pausedSites']);
  return {
    ok: true,
    restoredKeys: BLK_KEYS.filter((k) => k in payload.data),
    preRestoreBackup: { createdAt: autoSnap.createdAt, rollbackKey: AUTO_BACKUP_KEY },
    rulesCount: (final.rules || []).length,
    pausedSitesCount: (final.pausedSites || []).length,
    masterEnabled: final.masterEnabled !== false,
  };
}

async function rollbackBackup() {
  const snap = await localGet(AUTO_BACKUP_KEY);
  const s = snap[AUTO_BACKUP_KEY];
  if (!s) throw new Error('没有可撤销的还原');
  const data = s.data || {};
  const setData = {};
  BLK_KEYS.forEach((k) => { if (k in data) setData[k] = data[k]; });
  await setPersisted(setData);
  await localRemove([AUTO_BACKUP_KEY]);
  return { ok: true, rolledBackKeys: Object.keys(data) };
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
    localGet(AUTO_BACKUP_KEY).then((snap) => {
      const s = snap[AUTO_BACKUP_KEY];
      sendResponse({ ok: true, has: !!s, createdAt: s && s.createdAt });
    });
    return true;
  }
  if (msg && msg.type === 'blk:state:get') {
    getPersisted(BLK_KEYS).then((state) => sendResponse({ ok: true, state }));
    return true;
  }
  if (msg && msg.type === 'blk:state:setMaster') {
    setPersisted({ masterEnabled: !!msg.value }).then(() => sendResponse({ ok: true }));
    return true;
  }
});
