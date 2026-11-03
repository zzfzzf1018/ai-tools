/* 网页屏蔽器 —— 弹窗：规则管理 + 点选入口 + 导入导出 */
const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const listEl = $('list');

let rules = [];
let stats = {};
let siteHost = '';
let showAll = false;
let pauseState = { tabPaused: false, sitePaused: false };

function setStatus(text, kind) {
  statusEl.textContent = text || '';
  statusEl.className = kind || '';
}

function activeTab() {
  return new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
}

function send(tabId, payload) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(res);
    });
  });
}

/* 所有规则写操作都走 background 的串行队列（content 点选入库也走同一条队列），
 * 避免弹窗拿着旧快照整组回写，把别的页面刚加的规则覆盖掉。 */
function mutate(op, then) {
  chrome.runtime.sendMessage({ type: 'blk:rules:mutate', op }, (res) => {
    if (chrome.runtime.lastError || !res || !res.ok) {
      setStatus('写入失败：' + ((chrome.runtime.lastError && chrome.runtime.lastError.message) || (res && res.error) || '后台无响应'), 'err');
      render(); // 回滚勾选框/下拉框等控件到改动前状态，避免界面与存储脱节
      return;
    }
    rules = res.rules || [];
    sortRules();
    render();
    if (then) then(res);
  });
}

function ruleScopeText(rule) {
  return rule.scope === 'page' ? '仅本页 · ' + (rule.path || '/') : '整站 · ' + (rule.host || '');
}

function render() {
  listEl.textContent = '';
  const shown = showAll ? rules : rules.filter((r) => r.host === siteHost || siteHost.endsWith('.' + (r.host || '')));
  if (!shown.length) {
    const div = document.createElement('div');
    div.className = 'empty';
    div.textContent = showAll
      ? '还没有任何规则。到网页上点「在此页面上点选屏蔽」，单击要屏蔽的区域即可。'
      : '这个站点还没有规则。点上面的「在此页面上点选屏蔽」开始添加。';
    listEl.appendChild(div);
    return;
  }
  shown.forEach((rule) => {
    const box = document.createElement('div');
    box.className = 'rule';

    const top = document.createElement('div');
    top.className = 'top';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = rule.label || rule.selectors[0];
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = ruleScopeText(rule);
    top.appendChild(name);
    top.appendChild(badge);

    const sel = document.createElement('div');
    sel.className = 'sel';
    sel.textContent = rule.selectors.join('\n');

    const acts = document.createElement('div');
    acts.className = 'acts';

    const enable = document.createElement('label');
    enable.style.cssText = 'display:flex;align-items:center;gap:4px';
    const enableBox = document.createElement('input');
    enableBox.type = 'checkbox';
    enableBox.checked = rule.enabled !== false;
    enableBox.addEventListener('change', () => {
      mutate({ kind: 'update', id: rule.id, patch: { enabled: enableBox.checked } });
    });
    enable.appendChild(enableBox);
    enable.appendChild(document.createTextNode('启用'));

    const mode = document.createElement('select');
    [['hide', '隐藏（会收拢）'], ['remove', '真删除节点']].forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = t;
      if ((rule.mode || 'hide') === v) o.selected = true;
      mode.appendChild(o);
    });
    mode.addEventListener('change', () => {
      mutate({ kind: 'update', id: rule.id, patch: { mode: mode.value } });
    });

    const reflow = document.createElement('label');
    reflow.style.cssText = 'display:flex;align-items:center;gap:4px';
    reflow.title = '清掉父级为它预留的 padding / margin / 固定栅格轨道，让其余内容自动补位';
    const reflowBox = document.createElement('input');
    reflowBox.type = 'checkbox';
    reflowBox.checked = rule.reflow !== false;
    reflowBox.addEventListener('change', () => {
      mutate({ kind: 'update', id: rule.id, patch: { reflow: reflowBox.checked } });
    });
    reflow.appendChild(reflowBox);
    reflow.appendChild(document.createTextNode('收回留白'));

    const hit = document.createElement('span');
    const n = stats[rule.id];
    hit.className = 'hit' + (n ? '' : ' zero');
    hit.textContent = n ? '命中 ' + n + ' 处' : '当前页面未命中';

    const del = document.createElement('button');
    del.textContent = '删除';
    del.className = 'danger';
    del.style.marginLeft = 'auto';
    del.addEventListener('click', () => {
      mutate({ kind: 'remove', id: rule.id }, () => setStatus('已删除 1 条规则，页面已还原。', 'ok'));
    });

    acts.appendChild(enable);
    acts.appendChild(mode);
    acts.appendChild(reflow);
    acts.appendChild(hit);
    acts.appendChild(del);

    box.appendChild(top);
    box.appendChild(sel);
    box.appendChild(acts);
    listEl.appendChild(box);
  });
}

function sortRules() {
  rules.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/* 初始化 */
chrome.storage.local.get({ masterEnabled: true, rules: [] }, (saved) => {
  rules = Array.isArray(saved.rules) ? saved.rules : [];
  sortRules();
  $('master').checked = saved.masterEnabled !== false;
  render();
});

function renderPause() {
  const el = $('pauseState');
  const on = [];
  if (pauseState.tabPaused) on.push('本页已暂停');
  if (pauseState.sitePaused) on.push('本站已暂停');
  el.textContent = on.length ? on.join(' + ') : '屏蔽中';
  el.style.color = on.length ? 'var(--warn)' : 'var(--ok)';
  $('pauseTab').textContent = pauseState.tabPaused ? '恢复本页' : '暂停本页';
  $('pauseSite').textContent = pauseState.sitePaused ? '恢复本站' : '暂停本站';
}

function renderPauseList(sites) {
  const box = $('pausedSites');
  box.textContent = '';
  if (!sites.length) {
    box.style.display = 'none';
    return;
  }
  box.style.display = '';
  box.appendChild(document.createTextNode('已暂停站点（点 ✕ 恢复）：'));
  sites.forEach((h) => {
    const b = document.createElement('button');
    b.textContent = h + ' ✕';
    b.style.marginLeft = '6px';
    b.addEventListener('click', async () => {
      try {
        const [tab] = await activeTab();
        const res = await send(tab.id, { type: 'blk:setSitePaused', host: h, paused: false });
        renderPauseList((res && res.pausedSites) || sites.filter((x) => x !== h));
        setStatus('已恢复 ' + h + ' 的屏蔽。', 'ok');
      } catch (err) {
        setStatus('当前页面未注入脚本，改不了暂停列表。', 'err');
      }
    });
    box.appendChild(b);
  });
}

$('pauseTab').addEventListener('click', async () => {
  try {
    const [tab] = await activeTab();
    const res = await send(tab.id, { type: 'blk:toggleTab' });
    pauseState.tabPaused = !!res.tabPaused;
    pauseState.sitePaused = !!res.sitePaused;
    renderPause();
    setStatus(res.tabPaused ? '已暂停本页屏蔽；刷新页面后会自动恢复屏蔽。' : '已恢复本页屏蔽。', 'ok');
  } catch (err) {
    setStatus('当前页面未注入脚本，无法暂停。', 'err');
  }
});

$('pauseSite').addEventListener('click', async () => {
  try {
    const [tab] = await activeTab();
    const res = await send(tab.id, { type: 'blk:toggleSite' });
    pauseState.sitePaused = !!res.sitePaused;
    renderPause();
    setStatus(res.sitePaused ? '已暂停本站屏蔽（会记住，换页面也生效）。' : '已恢复本站屏蔽。', 'ok');
  } catch (err) {
    setStatus('当前页面未注入脚本，无法暂停。', 'err');
  }
});

$('master').addEventListener('change', (e) => {
  chrome.storage.local.set({ masterEnabled: e.target.checked }, () => {
    setStatus(e.target.checked ? '已全局启用' : '已全局停用，页面恢复原样');
  });
});

$('toggleAll').addEventListener('click', () => {
  showAll = !showAll;
  $('toggleAll').textContent = showAll ? '只看本站规则' : '显示全部规则';
  render();
});

$('reapply').addEventListener('click', async () => {
  try {
    const [tab] = await activeTab();
    const res = await send(tab.id, { type: 'blk:apply' });
    stats = (res && res.stats) || {};
    render();
    setStatus('已重新扫描页面。', 'ok');
  } catch (err) {
    setStatus('这个页面没连上扩展（file:// 或扩展页面不支持），刷新一次再试。', 'err');
  }
});

$('pick').addEventListener('click', async () => {
  try {
    const [tab] = await activeTab();
    setStatus('去页面上：移动鼠标高亮 → 单击锁定 → 在底部确认条里点「确认屏蔽」。');
    const res = await send(tab.id, { type: 'blk:pick' });
    if (res && res.ok) {
      rules.push(res.rule);
      sortRules();
      render();
      setStatus('已添加规则，当前命中 ' + res.hit + ' 处。', res.hit ? 'ok' : '');
    } else {
      setStatus((res && res.error) || '点选未完成。', 'err');
    }
  } catch (err) {
    setStatus('当前标签页不支持注入（扩展自身页面 / file:// / 商店页）。', 'err');
  }
});

$('export').addEventListener('click', () => {
  $('io').value = JSON.stringify(rules, null, 2);
  setStatus('已导出 ' + rules.length + ' 条规则到文本框。');
});

$('copy').addEventListener('click', async () => {
  const text = $('io').value || JSON.stringify(rules, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    setStatus('已复制到剪贴板。', 'ok');
  } catch (err) {
    $('io').select();
    setStatus('自动复制失败，已全选文本框内容，按 Ctrl+C。');
  }
});

$('import').addEventListener('click', () => {
  let parsed;
  try {
    parsed = JSON.parse($('io').value);
  } catch (err) {
    setStatus('JSON 解析失败，检查格式。', 'err');
    return;
  }
  if (!Array.isArray(parsed)) {
    setStatus('导入内容必须是数组。', 'err');
    return;
  }
  const clean = parsed.filter((r) => r && r.id && Array.isArray(r.selectors) && r.selectors.length);
  const skipped = parsed.length - clean.length;
  mutate({ kind: 'addMany', rules: clean }, (res) =>
    setStatus('导入成功 ' + (res.changed || 0) + ' 条' + (skipped ? '，跳过 ' + skipped + ' 条无效规则' : ''), 'ok')
  );
});

$('clearSite').addEventListener('click', () => {
  mutate({ kind: 'removeHost', host: siteHost }, (res) =>
    setStatus('已清空本站 ' + (res.changed || 0) + ' 条规则。', 'ok')
  );
});

/* 拉取当前标签页与命中统计 */
(async () => {
  try {
    const [tab] = await activeTab();
    if (tab && tab.url) {
      try {
        const u = new URL(tab.url);
        siteHost = u.hostname;
      } catch (err) {
        siteHost = '';
      }
    }
    $('ver').textContent = siteHost ? '当前站点：' + siteHost : '当前页面不支持注入';
    const res = await send(tab.id, { type: 'blk:ping' });
    if (res && res.ok) {
      stats = res.stats || {};
      pauseState.tabPaused = !!res.tabPaused;
      pauseState.sitePaused = !!res.sitePaused;
      renderPause();
      renderPauseList(res.pausedSites || []);
      $('ver').textContent =
        '当前站点：' + res.host + res.path + ' · 脚本 v' + res.version + ' · 本站生效规则 ' + res.siteRuleCount + ' 条';
      render();
    }
  } catch (err) {
    $('ver').textContent = '当前页面未连接扩展脚本';
  }
})();
