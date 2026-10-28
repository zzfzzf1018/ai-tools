/**
 * 网页屏蔽器 —— content script
 *
 * 规则模型（存在 chrome.storage.local.rules 里，一条 = 一个被屏蔽区域）：
 *   { id, label, host, origin, path, scope:'site'|'page',
 *     selectors:[css...], mode:'hide'|'remove', enabled, createdAt }
 *
 * 两种落地方式都可逆：
 *   hide   → 打 data-blk 属性，配一条 [data-blk]{display:none}
 *   remove → 真从 DOM 摘掉，但记下 parent/next，规则删掉或关掉时插回去
 *
 * 点选拾取器：hover 高亮 → 单击锁定 → 底部确认条（可选「同时屏蔽同类」「整站生效」）→ 确认
 */
(() => {
  'use strict';
  if (window.__blkLoaded) return;
  window.__blkLoaded = true;

  const VERSION = '1.4.0';
  const ATTR = 'data-blk';
  const STYLE_ID = 'blk-injected-style';
  const TOAST_ID = 'blk-toast';
  const DEFAULTS = { masterEnabled: true, rules: [], pausedSites: [] };

  const STORAGE = chrome.storage && chrome.storage.local ? chrome.storage.local : null;

  let state = { masterEnabled: true, rules: [], pausedSites: [] };
  let tabPaused = false; // 只影响当前这份文档，刷新即恢复
  const hiddenEls = new Map(); // el -> ruleId
  const patched = new Map(); // el -> { prop: 原内联值 }，补位时改的父级样式
  let removedNodes = []; // { node, parent, next }
  let stats = {}; // ruleId -> 命中数
  let scheduled = false;
  let lastApplyAt = 0;
  let spaWatching = false;
  let toastTimer = 0;

  /* ---------------------------------------------------------------- 工具 */

  function ensureSheet() {
    try {
      if (document.querySelector && document.querySelector('#' + STYLE_ID)) return;
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = '[' + ATTR + ']{display:none !important;}';
      (document.head || document.documentElement).appendChild(s);
    } catch (err) {
      console.warn('[blk] 样式注入失败', err);
    }
  }

  function depthOf(el) {
    let d = 0;
    let n = el;
    while ((n = n.parentElement)) d++;
    return d;
  }

  /* ------------------------------------------------------ 选择器生成 */

  function isHashy(cls) {
    return (
      /^(css|sc|jsx|emotion|hoverable|ng|v-)[-_][a-z0-9]{3,}$/i.test(cls) ||
      /[0-9]{4,}/.test(cls) ||
      cls.length > 28 ||
      /^[a-z]_[a-z0-9]{5,}$/i.test(cls)
    );
  }

  function classList(el) {
    return (typeof el.className === 'string' ? el.className : '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function stableClasses(el) {
    return classList(el).filter((c) => !isHashy(c));
  }

  function queryAll(sel) {
    try {
      return Array.prototype.slice.call(document.querySelectorAll(sel));
    } catch (err) {
      return [];
    }
  }

  function isUnique(sel, el) {
    const list = queryAll(sel);
    return list.length === 1 && list[0] === el;
  }

  function pathSelector(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && node.parentElement) {
      const parent = node.parentElement;
      const idx = Array.prototype.indexOf.call(parent.children, node) + 1;
      parts.unshift(node.tagName.toLowerCase() + ':nth-child(' + idx + ')');
      node = parent;
    }
    return 'body ' + parts.map((p) => '> ' + p).join(' ');
  }

  /** 生成一个尽量稳定、且唯一命中 el 的选择器 */
  function buildSelector(el) {
    const tag = el.tagName.toLowerCase();
    if (el.id) {
      const sel = '#' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id);
      if (isUnique(sel, el)) return sel;
    }
    const ds = el.dataset || {};
    for (const key of Object.keys(ds)) {
      if (/^blk/.test(key)) continue;
      const val = ds[key];
      if (!val || typeof val !== 'string' || val.length > 48 || /[<>"'{}]/.test(val)) continue;
      const attr = 'data-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
      const sel = tag + '[' + attr + '="' + val + '"]';
      if (isUnique(sel, el)) return sel;
    }
    const stable = stableClasses(el);
    for (const cls of stable) {
      if (isUnique('.' + cls, el)) return '.' + cls;
    }
    if (stable.length && isUnique(tag + '.' + stable.join('.'), el)) {
      return tag + '.' + stable.join('.');
    }
    const all = classList(el);
    if (all.length && isUnique(tag + '.' + all.join('.'), el)) {
      return tag + '.' + all.join('.'); // 只剩哈希 class，也比结构路径稳
    }
    return pathSelector(el);
  }

  /** 同一父级下「长得一样」的兄弟（tag + 稳定 class 集合相同） */
  function siblingsLike(el) {
    const parent = el.parentElement;
    if (!parent) return [el];
    const sigOf = (n) => n.tagName.toLowerCase() + '|' + stableClasses(n).slice().sort().join(' ');
    const mine = sigOf(el);
    const same = Array.prototype.slice.call(parent.children).filter((c) => sigOf(c) === mine);
    return same.length >= 1 ? same : [el];
  }

  /** 能命中这批兄弟、又不会多杀的选择器；找不到就返回 null */
  function buildGroupSelector(el, group) {
    const want = new Set(group);
    const tag = el.tagName.toLowerCase();
    const stable = stableClasses(el).slice().sort();
    const candidates = [];
    if (stable.length) candidates.push(tag + '.' + stable.join('.'));
    if (stable.length) candidates.push('.' + stable.join('.'));
    if (el.parentElement) candidates.push(buildSelector(el.parentElement) + ' > ' + tag);
    for (const sel of candidates) {
      const hits = queryAll(sel);
      if (hits.length >= 2 && hits.every((h) => want.has(h)) && hits.indexOf(el) !== -1) return sel;
    }
    return null;
  }

  function describeEl(el) {
    const r = el.getBoundingClientRect();
    const stable = stableClasses(el);
    const sig = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (stable.length ? '.' + stable.slice(0, 2).join('.') : '');
    return {
      tag: el.tagName.toLowerCase(),
      summary: sig + ' · ' + Math.round(r.width) + '×' + Math.round(r.height),
      text: (el.innerText || '').trim().slice(0, 40),
      selector: buildSelector(el),
      depth: depthOf(el),
    };
  }

  /* ------------------------------------------------------ 规则匹配 */

  function isSitePaused(host) {
    const list = Array.isArray(state.pausedSites) ? state.pausedSites : [];
    return list.some((h) => h && (host === h || host.endsWith('.' + h)));
  }

  function pausedNow() {
    return tabPaused || isSitePaused(location.hostname);
  }

  function ruleMatches(rule) {
    if (!rule || rule.enabled === false) return false;
    if (!Array.isArray(rule.selectors) || !rule.selectors.length) return false;
    if (tabPaused || isSitePaused(location.hostname)) return false; // 快捷键暂停中
    if (rule.scope === 'page') {
      return (rule.origin || '') === location.origin && (rule.path || '/') === location.pathname;
    }
    const h = rule.host || '';
    return !!h && (location.hostname === h || location.hostname.endsWith('.' + h));
  }

  function activeRules() {
    if (!state.masterEnabled) return [];
    return state.rules.filter(ruleMatches);
  }

  function elementsForRule(rule) {
    const out = [];
    for (const sel of rule.selectors) {
      for (const el of queryAll(sel)) {
        if (el === document.body || el === document.documentElement) continue; // 别把整页干掉
        if (out.indexOf(el) === -1) out.push(el);
      }
    }
    return out;
  }

  /* -------------------------------------------------- 补位（收回留白） */

  /**
   * display:none / 真删节点本身就会让普通流里的后续内容上移、左移。
   * 之所以还留着一块空白，是因为空间是「父级」预留的：
   *   ① 父级的 padding-left / margin-left（fixed 侧栏最常见的补偿）
   *   ② 父级是 grid 且写了固定轨道（grid-template-columns: 220px 1fr），
   *      轨道不会因为元素消失而塌掉
   *   ③ 父级自己是 fixed/absolute 且带 left / top 偏移
   * 这里逐层往上找第一处「明显是为它留的」并清零，全部改动都备份，可一键还原。
   */
  const RECLAIM_RATIO = 0.65; // 预留值至少要是被屏蔽块尺寸的 65% 才动手，避免误伤正常留白
  const RECLAIM_FLOOR = 32; // 且不小于 32px

  const px = (v) => parseFloat(v) || 0;

  function worthReclaim(reserved, size) {
    return reserved >= Math.max(RECLAIM_FLOOR, size * RECLAIM_RATIO);
  }

  function patchStyle(el, props) {
    if (!patched.has(el)) patched.set(el, {});
    const rec = patched.get(el);
    for (const key of Object.keys(props)) {
      if (!(key in rec)) rec[key] = el.style.getPropertyValue(key);
      el.style.setProperty(key, props[key], 'important');
    }
  }

  function unpatchStyles() {
    for (const [el, rec] of patched.entries()) {
      for (const key of Object.keys(rec)) {
        const original = rec[key];
        if (original) el.style.setProperty(key, original);
        else el.style.removeProperty(key);
      }
    }
    patched.clear();
  }

  function tracksOf(value) {
    const s = (value || '').trim();
    if (!s || s === 'none') return [];
    return s.split(/\s+/).map(parseFloat).filter((n) => !isNaN(n));
  }

  /** grid 固定轨道：只处理「被屏蔽元素是第一个子元素」这种侧栏/顶栏布局 */
  function reclaimGridTrack(node, el, rect, props) {
    const cs = getComputedStyle(node);
    if ((cs.display || '').indexOf('grid') === -1) return false;
    if (node.firstElementChild !== el) return false;
    const cols = tracksOf(cs.gridTemplateColumns);
    if (cols.length >= 2 && worthReclaim(cols[0], rect.width)) {
      props['grid-template-columns'] = '0px ' + cols.slice(1).map((t) => t + 'px').join(' ');
      return true;
    }
    const rows = tracksOf(cs.gridTemplateRows);
    if (rows.length >= 2 && worthReclaim(rows[0], rect.height)) {
      props['grid-template-rows'] = '0px ' + rows.slice(1).map((t) => t + 'px').join(' ');
      return true;
    }
    return false;
  }

  function reclaim(el, rect, parent) {
    let node = parent;
    let hops = 0;
    while (node && node !== document.documentElement && hops < 6) {
      const cs = getComputedStyle(node);
      const props = {};
      if (worthReclaim(px(cs.paddingLeft), rect.width)) props['padding-left'] = '0px';
      if (worthReclaim(px(cs.marginLeft), rect.width)) props['margin-left'] = '0px';
      if (worthReclaim(px(cs.paddingRight), rect.width)) props['padding-right'] = '0px';
      if (worthReclaim(px(cs.marginRight), rect.width)) props['margin-right'] = '0px';
      if (worthReclaim(px(cs.paddingTop), rect.height)) props['padding-top'] = '0px';
      if (worthReclaim(px(cs.marginTop), rect.height)) props['margin-top'] = '0px';
      if (worthReclaim(px(cs.paddingBottom), rect.height)) props['padding-bottom'] = '0px';
      if (cs.position === 'fixed' || cs.position === 'absolute') {
        if (worthReclaim(px(cs.left), rect.width)) props['left'] = '0px';
        if (worthReclaim(px(cs.top), rect.height)) props['top'] = '0px';
      }
      reclaimGridTrack(node, el, rect, props);
      if (Object.keys(props).length) {
        patchStyle(node, props);
        return true; // 空间一般只由一层预留，找到就收工，避免层层清零把版面拆了
      }
      node = node.parentElement;
      hops++;
    }
    return false;
  }

  /* ---------------------------------------------------------- 应用 */

  function removeEl(el) {
    const parent = el.parentNode;
    if (!parent) return;
    removedNodes.push({ node: el, parent: parent, next: el.nextSibling });
    parent.removeChild(el);
  }

  function restoreRemoved() {
    for (let i = removedNodes.length - 1; i >= 0; i--) {
      const r = removedNodes[i];
      try {
        r.parent.insertBefore(r.node, r.next);
      } catch (err) {
        /* 父节点可能已被框架重建，忽略 */
      }
    }
    removedNodes = [];
  }

  function clearAll() {
    for (const el of hiddenEls.keys()) el.removeAttribute(ATTR);
    hiddenEls.clear();
    restoreRemoved();
    unpatchStyles();
  }

  function apply() {
    try {
      applyNow();
    } finally {
      lastApplyAt = Date.now(); // 自己改 DOM 也会触发 MutationObserver，记时间戳防死循环
      reportState();
    }
  }

  function applyNow() {
    ensureSheet();
    clearAll();
    stats = {};
    const rules = activeRules();
    if (!rules.length) return;
    for (const rule of rules) {
      const els = elementsForRule(rule);
      stats[rule.id] = els.length;
      // 先量尺寸再隐藏：grid 的「已用轨道值」和元素 rect 在 display:none 之后就取不到了
      const shots = els.map((el) => ({
        el,
        rect: el.getBoundingClientRect(),
        parent: el.parentElement,
      }));
      const doReflow = rule.reflow !== false;
      for (const s of shots) {
        if (rule.mode === 'remove') removeEl(s.el);
        else {
          s.el.setAttribute(ATTR, rule.id);
          hiddenEls.set(s.el, rule.id);
        }
        if (doReflow) reclaim(s.el, s.rect, s.parent);
      }
    }
    watchSpa();
  }

  function schedule(force) {
    if (!force && Date.now() - lastApplyAt < 600) return;
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      try {
        apply();
      } catch (err) {
        console.error('[blk] apply failed', err);
      }
    }, 150);
  }

  /** 只有存在规则时才挂 MutationObserver，避免在所有网站上白耗性能 */
  function watchSpa() {
    if (spaWatching) return;
    if (!state.rules.some(ruleMatches)) return;
    try {
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          const t = m.target;
          const added = m.addedNodes ? Array.prototype.slice.call(m.addedNodes) : [];
          const removed = m.removedNodes ? Array.prototype.slice.call(m.removedNodes) : [];
          const nodes = added.concat(removed);
          if (nodes.length && nodes.every(isInternalNode)) continue; // 我们自己的提示条/遮罩
          if (t === document.body || t === document.documentElement) {
            schedule(true);
            return;
          }
          if (t.nodeType === 1) {
            if (hiddenEls.has(t) || patched.has(t) || (t.closest && t.closest('[' + ATTR + ']'))) continue;
            if (removedNodes.some((r) => r.node === t || r.parent === t)) continue;
          }
          schedule(false);
          return;
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
      spaWatching = true;
    } catch (err) {
      console.warn('[blk] MutationObserver 挂载失败，改用轮询', err);
      setInterval(() => schedule(true), 3000);
    }
  }

  /* ---------------------------------------------- 页面内提示与状态上报 */

  function isInternalNode(n) {
    if (!n || n.nodeType !== 1) return false;
    if (n.id === TOAST_ID || n.id === STYLE_ID) return true;
    return !!(pick && (n === pick.bar || n === pick.hlHover || pick.hls.indexOf(n) !== -1));
  }

  /** 左下角小提示（快捷键没有弹窗可看，必须给反馈） */
  function toast(text) {
    try {
      let t = document.getElementById(TOAST_ID);
      if (!t) {
        t = mk('div');
        t.id = TOAST_ID;
        style(t, {
          position: 'fixed', left: '16px', bottom: '16px', 'z-index': '2147483645',
          background: '#1f2329', color: '#fff', padding: '8px 12px', 'border-radius': '8px',
          'font-family': 'system-ui, "Microsoft YaHei", sans-serif', 'font-size': '13px',
          'max-width': '380px', opacity: '0', 'pointer-events': 'none',
          transition: 'opacity .15s',
        });
        (document.body || document.documentElement).appendChild(t);
      }
      t.textContent = text;
      t.style.setProperty('opacity', '1');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.style.setProperty('opacity', '0'), 2000);
    } catch (err) {
      /* 忽略：提示失败不影响屏蔽逻辑 */
    }
  }

  function reportState() {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(
          {
            type: 'blk:state',
            tabPaused: tabPaused,
            sitePaused: isSitePaused(location.hostname),
            masterOff: state.masterEnabled === false,
          },
          () => void (chrome.runtime.lastError || 0) // 后台没起来时静默
        );
      }
    } catch (err) {
      /* 忽略 */
    }
  }

  /* ------------------------------------------------------ 点选拾取器 */

  let pick = null;

  function mk(tag, text) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    return el;
  }

  function style(el, props) {
    for (const k of Object.keys(props)) el.style.setProperty(k, props[k], 'important');
  }

  function startPick(done) {
    ensureSheet();
    if (pick) finishPick();

    const hlHover = mk('div'); // 跟随鼠标的虚线预览
    style(hlHover, {
      position: 'fixed', left: '0', top: '0', width: '0', height: '0',
      'z-index': '2147483646', 'pointer-events': 'none',
      background: 'rgba(217,64,64,0.08)', outline: '2px dashed #d94040', opacity: '0',
    });

    const bar = mk('div');
    style(bar, {
      position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)',
      'z-index': '2147483647', 'pointer-events': 'auto', background: '#1f2329',
      color: '#fff', padding: '12px 14px', 'border-radius': '10px',
      'font-family': 'system-ui, "Microsoft YaHei", sans-serif', 'font-size': '13px',
      'line-height': '1.6', 'max-width': '560px', 'box-shadow': '0 4px 16px rgba(0,0,0,.3)',
    });

    const sum = mk('div', '把鼠标移到要屏蔽的区域上（虚线预览），单击选中；按住 Ctrl 单击可连续追加多个区域');
    style(sum, { 'margin-bottom': '8px', 'word-break': 'break-all' });

    const cbGroup = mk('input');
    cbGroup.type = 'checkbox';
    const lbGroup = mk('label', ' 同时屏蔽同类区域');
    lbGroup.insertBefore(cbGroup, lbGroup.firstChild);
    const groupCount = mk('span', '');
    lbGroup.appendChild(groupCount);
    style(lbGroup, { display: 'block', cursor: 'pointer' });

    const cbSite = mk('input');
    cbSite.type = 'checkbox';
    cbSite.checked = true;
    const lbSite = mk('label', ' 整站生效（取消勾选 = 只在当前这个网址生效）');
    lbSite.insertBefore(cbSite, lbSite.firstChild);
    style(lbSite, { display: 'block', cursor: 'pointer', 'margin-bottom': '8px' });

    const cbReflow = mk('input');
    cbReflow.type = 'checkbox';
    cbReflow.checked = true;
    const lbReflow = mk('label', ' 收回留白（清掉父级为它预留的空白与固定栅格轨道，让其余内容自动补位）');
    lbReflow.insertBefore(cbReflow, lbReflow.firstChild);
    style(lbReflow, { display: 'block', cursor: 'pointer', 'margin-bottom': '8px' });

    const okBtn = mk('button', '确认屏蔽');
    okBtn.disabled = true;
    const cancelBtn = mk('button', '取消 (Esc)');
    for (const b of [okBtn, cancelBtn]) {
      style(b, {
        'margin-right': '8px', padding: '5px 12px', border: '1px solid #444',
        'border-radius': '6px', background: '#33383f', color: '#fff', cursor: 'pointer',
        'font-size': '13px',
      });
    }
    style(okBtn, { background: '#d94040', 'border-color': '#d94040' });

    const btnRow = mk('div');
    btnRow.appendChild(okBtn);
    btnRow.appendChild(cancelBtn);

    const hint = mk('div', '单击选中（再点别处 = 换成新区域）· Ctrl+单击 追加 / 移除 · ↑↓ 调鼠标所在的那块（↑ 父级 ↓ 子级）· Alt+点击 升一级 · Enter 确认 · Esc 取消');
    style(hint, { 'margin-top': '8px', color: '#9aa0a6', 'font-size': '11px' });

    bar.appendChild(sum);
    bar.appendChild(lbGroup);
    bar.appendChild(lbSite);
    bar.appendChild(lbReflow);
    bar.appendChild(btnRow);
    bar.appendChild(hint);

    pick = {
      done,
      bar,
      hlHover,
      hls: [], // 已选区域的实线高亮池（数量随选区增减）
      sel: [], // [{ el, selector, groupSel, groupSize, summary }]
      active: null, // ↑↓ / Alt+点击 的作用对象
      hoverEl: null,
      onMove,
      onDown,
      onClick,
      onKey,
    };

    function insideChrome(node) {
      if (node === hlHover || node === bar) return true;
      if (bar.contains && bar.contains(node)) return true;
      return pick.hls.indexOf(node) !== -1;
    }

    function findSel(el) {
      for (const s of pick.sel) if (s.el === el) return s;
      return null;
    }

    function makeItem(el) {
      const group = siblingsLike(el);
      const info = describeEl(el);
      return {
        el: el,
        selector: buildSelector(el),
        groupSel: group.length >= 2 ? buildGroupSelector(el, group) : null,
        groupSize: group.length,
        summary: info.summary,
      };
    }

    function placeBox(box, el, fill, ring) {
      const r = el.getBoundingClientRect();
      style(box, {
        opacity: '1',
        left: Math.round(r.left) + 'px',
        top: Math.round(r.top) + 'px',
        width: Math.round(r.width) + 'px',
        height: Math.round(r.height) + 'px',
        background: fill,
        outline: ring,
      });
    }

    function redraw() {
      while (pick.hls.length < pick.sel.length) {
        const box = mk('div');
        style(box, {
          position: 'fixed', left: '0', top: '0', width: '0', height: '0',
          'z-index': '2147483646', 'pointer-events': 'none', opacity: '0',
        });
        (document.body || document.documentElement).appendChild(box);
        pick.hls.push(box);
      }
      while (pick.hls.length > pick.sel.length) {
        const box = pick.hls.pop();
        if (box.parentElement) box.parentElement.removeChild(box);
      }
      pick.sel.forEach((item, i) => {
        placeBox(
          pick.hls[i],
          item.el,
          item.el === pick.active ? 'rgba(217,64,64,0.22)' : 'rgba(217,64,64,0.12)',
          '2px solid #d94040'
        );
      });
      const h = pick.hoverEl;
      if (h && !findSel(h)) {
        placeBox(hlHover, h, 'rgba(217,64,64,0.08)', '2px dashed #d94040');
      } else {
        hlHover.style.setProperty('opacity', '0');
      }
      updateSummary();
    }

    function updateSummary() {
      okBtn.disabled = pick.sel.length === 0;
      const heads = pick.sel
        .slice(0, 2)
        .map((s) => s.selector)
        .join('、');
      sum.textContent = pick.sel.length
        ? '已选 ' + pick.sel.length + ' 个区域：' + heads + (pick.sel.length > 2 ? ' 等' : '')
        : '把鼠标移到要屏蔽的区域上（虚线预览），单击选中；按住 Ctrl 单击可连续追加多个区域';
      const hasGroup = pick.sel.some((s) => s.groupSel);
      cbGroup.disabled = !hasGroup;
      if (!hasGroup) {
        cbGroup.checked = false;
        groupCount.textContent = '（没找到可安全批量匹配的同类元素）';
      } else {
        const total = pick.sel.reduce((n, s) => n + (s.groupSize || 1), 0);
        groupCount.textContent = '（勾选后约屏蔽 ' + total + ' 个）';
      }
    }

    function replaceSelection(node) {
      pick.sel = [makeItem(node)];
      pick.active = node;
    }

    function toggleSelection(node) {
      if (findSel(node)) {
        pick.sel = pick.sel.filter((s) => s.el !== node);
        if (pick.active === node) {
          pick.active = pick.sel.length ? pick.sel[pick.sel.length - 1].el : null;
        }
      } else {
        pick.sel.push(makeItem(node));
        pick.active = node;
      }
    }

    /** 把某块沿 DOM 树上移 / 下移一级（原地替换选区项，不增减选区数量）。
     *  base 优先取鼠标悬停的那块（若已选中），否则用最后点击的活动块。 */
    function stepActive(delta, base) {
      const from = base && findSel(base) ? base : pick.active;
      if (!from) return;
      let n = from;
      if (delta < 0) {
        const p = n.parentElement;
        if (p && p !== document.body && p !== document.documentElement) n = p;
      } else if (n.firstElementChild) {
        n = n.firstElementChild;
      }
      const i = pick.sel.findIndex((s) => s.el === from);
      if (findSel(n)) {
        if (i >= 0) pick.sel.splice(i, 1); // 目标已在选区里，去掉旧的避免重复
      } else if (i >= 0) {
        pick.sel[i] = makeItem(n);
      } else {
        pick.sel.push(makeItem(n));
      }
      pick.active = n;
    }

    function onMove(e) {
      if (insideChrome(e.target)) {
        pick.hoverEl = null;
        redraw();
        return;
      }
      const node = e.target && e.target.nodeType === 1 ? e.target : null;
      pick.hoverEl =
        node && node !== document.body && node !== document.documentElement ? node : null;
      redraw();
    }

    function onDown(e) {
      if (insideChrome(e.target)) return; // 让确认条上的点击正常通过
      e.preventDefault();
      e.stopPropagation();
      let node = e.target && e.target.nodeType === 1 ? e.target : null;
      if (!node || node === document.body || node === document.documentElement) return;
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd + 单击：追加 / 移除；再按 Alt 表示取它的父级
        if (e.altKey && node.parentElement && node.parentElement !== document.body) {
          node = node.parentElement;
        }
        toggleSelection(node);
      } else if (e.altKey && pick.sel.length && pick.active) {
        stepActive(-1, pick.hoverEl); // 已有选区时 Alt+点击 = 升一层（悬停哪块升哪块）
      } else {
        if (e.altKey && node.parentElement && node.parentElement !== document.body) {
          node = node.parentElement;
        }
        replaceSelection(node); // 普通单击 = 选中（再点别处则换成新区域）
      }
      redraw();
    }

    function onClick(e) {
      if (insideChrome(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        const d = pick.done;
        finishPick();
        if (d) d({ ok: false, error: '已取消。' });
      } else if (e.key === 'Enter' && pick && pick.sel.length) {
        e.preventDefault();
        confirmPick();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        stepActive(-1, pick.hoverEl);
        redraw();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        stepActive(1, pick.hoverEl);
        redraw();
      }
    }

    function confirmPick() {
      if (!pick || !pick.sel.length) {
        if (pick && pick.done) pick.done({ ok: false, error: '还没选中任何区域。' });
        return;
      }
      const selectors = [];
      for (const s of pick.sel) {
        if (selectors.indexOf(s.selector) === -1) selectors.push(s.selector);
        if (cbGroup.checked && s.groupSel && selectors.indexOf(s.groupSel) === -1) {
          selectors.push(s.groupSel);
        }
      }
      const scope = cbSite.checked ? 'site' : 'page';
      const first = pick.sel[0];
      const rule = {
        id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        label:
          pick.sel.length > 1
            ? pick.sel.length + ' 个区域 · ' + first.selector
            : first.summary,
        host: location.hostname,
        origin: location.origin,
        path: location.pathname,
        scope: scope,
        selectors: selectors,
        mode: 'hide',
        reflow: cbReflow.checked,
        enabled: true,
        createdAt: Date.now(),
      };
      const cb = pick.done;
      finishPick();
      saveRule(rule, () => {
        apply();
        if (cb) cb({ ok: true, rule: rule, hit: elementsForRule(rule).length });
      });
    }

    okBtn.addEventListener('click', confirmPick);
    cancelBtn.addEventListener('click', () => {
      const d = pick && pick.done;
      finishPick();
      if (d) d({ ok: false, error: '已取消。' });
    });

    (document.body || document.documentElement).appendChild(hlHover);
    (document.body || document.documentElement).appendChild(bar);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    console.log('[blk] 点选模式：单击选中 · Ctrl+单击 追加/移除 · ↑↓/Alt 调层级 · Enter 确认 / Esc 取消');
  }

  function finishPick() {
    if (!pick) return;
    document.removeEventListener('mousemove', pick.onMove, true);
    document.removeEventListener('mousedown', pick.onDown, true);
    document.removeEventListener('click', pick.onClick, true);
    document.removeEventListener('keydown', pick.onKey, true);
    for (const node of pick.hls.concat([pick.hlHover, pick.bar])) {
      if (node && node.parentElement) node.parentElement.removeChild(node);
    }
    pick = null;
  }

  function saveRule(rule, then) {
    if (!STORAGE) {
      state.rules = state.rules.concat([rule]);
      then();
      return;
    }
    STORAGE.get({ rules: [] }, (saved) => {
      const rules = (saved && saved.rules) || [];
      rules.push(rule);
      state.rules = rules;
      STORAGE.set({ rules: rules }, () => then());
    });
  }

  /* -------------------------------------------------------- 生命周期 */

  function readStorage() {
    return new Promise((resolve) => {
      if (!STORAGE) return resolve(state);
      try {
        STORAGE.get(DEFAULTS, (saved) => {
          const s = Object.assign({}, DEFAULTS, saved || {});
          resolve({
            masterEnabled: s.masterEnabled !== false,
            rules: Array.isArray(s.rules) ? s.rules : [],
            pausedSites: Array.isArray(s.pausedSites) ? s.pausedSites : [],
          });
        });
      } catch (err) {
        resolve(state);
      }
    });
  }

  ensureSheet();
  readStorage().then((loaded) => {
    state = loaded;
    schedule(true);
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area && area !== 'local') return;
      if (!changes.rules && !changes.masterEnabled && !changes.pausedSites) return;
      readStorage().then((loaded) => {
        state = loaded;
        schedule(true);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => schedule(true));
  window.addEventListener('load', () => schedule(true));
  window.addEventListener('popstate', () => schedule(true));
  window.addEventListener('hashchange', () => schedule(true));

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'blk:ping') {
      sendResponse({
        ok: true,
        version: VERSION,
        host: location.hostname,
        path: location.pathname,
        masterEnabled: state.masterEnabled,
        ruleCount: state.rules.length,
        siteRuleCount: activeRules().length,
        tabPaused: tabPaused,
        sitePaused: isSitePaused(location.hostname),
        pausedSites: state.pausedSites || [],
        stats: stats,
        picking: !!pick,
      });
    } else if (msg.type === 'blk:toggleTab') {
      tabPaused = !tabPaused;
      apply(); // 用户主动触发，立即生效，不走防抖
      toast(
        tabPaused
          ? '⏸ 已暂停本页屏蔽 —— 再按 Alt+Shift+B 恢复（刷新页面后也会自动恢复屏蔽）'
          : '▶ 已恢复本页屏蔽'
      );
      sendResponse({
        ok: true,
        tabPaused: tabPaused,
        sitePaused: isSitePaused(location.hostname),
        masterOff: state.masterEnabled === false,
      });
    } else if (msg.type === 'blk:toggleSite') {
      const host = location.hostname;
      const list = (state.pausedSites || []).slice();
      const i = list.indexOf(host);
      if (i >= 0) list.splice(i, 1);
      else list.push(host);
      state.pausedSites = list;
      if (STORAGE) STORAGE.set({ pausedSites: list });
      apply();
      toast(
        list.indexOf(host) >= 0
          ? '⏸ 已暂停 ' + host + ' 全站屏蔽 —— 再按 Alt+Shift+S 恢复（会记住）'
          : '▶ 已恢复 ' + host + ' 的屏蔽'
      );
      sendResponse({
        ok: true,
        tabPaused: tabPaused,
        sitePaused: isSitePaused(host),
        pausedSites: list,
        masterOff: state.masterEnabled === false,
      });
    } else if (msg.type === 'blk:setSitePaused') {
      const host = msg.host || location.hostname;
      const list = (state.pausedSites || []).slice();
      const i = list.indexOf(host);
      if (msg.paused && i === -1) list.push(host);
      if (!msg.paused && i >= 0) list.splice(i, 1);
      state.pausedSites = list;
      if (STORAGE) STORAGE.set({ pausedSites: list });
      apply();
      sendResponse({ ok: true, pausedSites: list, sitePaused: isSitePaused(location.hostname) });
    } else if (msg.type === 'blk:apply') {
      readStorage().then((loaded) => {
        state = loaded;
        schedule(true);
        sendResponse({ ok: true, stats: stats });
      });
    } else if (msg.type === 'blk:pick') {
      startPick(sendResponse);
      return true; // 异步回复
    } else if (msg.type === 'blk:cancelPick') {
      finishPick();
      sendResponse({ ok: true });
    }
  });

  console.log('[blk] 网页屏蔽器 v' + VERSION + ' 已就绪');
})();
