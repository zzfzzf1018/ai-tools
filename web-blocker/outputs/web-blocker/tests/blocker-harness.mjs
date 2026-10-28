/**
 * 网页屏蔽器 content.js 的假 DOM 集成测试
 * 覆盖：作用域匹配 / hide 与 remove / 真删后插回原位 / 同类批量 / 选择器稳定性 /
 *      无规则时不挂 MutationObserver / body 护栏 / 点选全流程 / Alt+Esc / 全局开关
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// 默认测上一级的 content.js；可用环境变量 BLK_SRC 指向别的文件（如变异测试用的残缺副本）
const SRC = process.env.BLK_SRC || fileURLToPath(new URL('../content.js', import.meta.url));

/* ------------------------------------------------------------ 迷你 DOM */

const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

class Style {
  constructor() { this.map = {}; }
  setProperty(k, v) { this.map[k] = v; }
  removeProperty(k) { delete this.map[k]; }
  getPropertyValue(k) { return this.map[k] || ''; }
}

class El {
  constructor(tag, o = {}) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attrs = Object.assign({}, o.attrs);
    this.style = new Style();
    this.id = o.id || '';
    this.className = o.className || '';
    this._text = o.text || '';
    this._rect = Object.assign({ left: 0, top: 0, width: 0, height: 0 }, o.rect);
    this._cs = Object.assign(
      {
        display: 'block', position: 'static', visibility: 'visible', opacity: '1',
        paddingLeft: '0px', paddingRight: '0px', paddingTop: '0px', paddingBottom: '0px',
        marginLeft: '0px', marginRight: '0px', marginTop: '0px', marginBottom: '0px',
        left: 'auto', top: 'auto', gridTemplateColumns: 'none', gridTemplateRows: 'none',
      },
      o.cs
    );
    this._ev = new Map();
  }
  get firstElementChild() { return this.children[0] || null; }
  get parentNode() { return this.parentElement; }
  get firstChild() { return this.children[0] || null; }
  get isConnected() { return true; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = v == null ? '' : String(v); }
  get nextSibling() {
    const p = this.parentElement;
    if (!p) return null;
    const i = p.children.indexOf(this);
    return i >= 0 ? p.children[i + 1] || null : null;
  }
  get dataset() {
    const out = {};
    for (const k of Object.keys(this.attrs)) {
      if (k.startsWith('data-')) out[camel(k.slice(5))] = this.attrs[k];
    }
    return out;
  }
  get innerText() {
    let t = this._text;
    for (const c of this.children) t += c.innerText;
    return t;
  }
  appendChild(c) { c.parentElement = this; this.children.push(c); return this; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentElement = null; return this; }
  insertBefore(node, ref) {
    node.parentElement = this;
    if (!ref) { this.children.push(node); return this; }
    const i = this.children.indexOf(ref);
    if (i === -1) this.children.push(node);
    else this.children.splice(i, 0, node);
    return this;
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  getBoundingClientRect() {
    const r = this._rect;
    return { ...r, right: r.left + r.width, bottom: r.top + r.height };
  }
  contains(n) { let p = n; while (p) { if (p === this) return true; p = p.parentElement; } return false; }
  closest(sel) { let p = this; while (p) { if (matchSimple(p, sel)) return p; p = p.parentElement; } return null; }
  querySelectorAll(sel) { return qsa(this, sel); }
  querySelector(sel) { return qsa(this, sel)[0] || null; }
  addEventListener(type, fn) {
    if (!this._ev.has(type)) this._ev.set(type, []);
    this._ev.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    this._ev.set(type, (this._ev.get(type) || []).filter((f) => f !== fn));
  }
  dispatch(type, ev = {}) {
    for (const fn of (this._ev.get(type) || []).slice()) fn(ev);
  }
}

function matchSimple(el, rawSel) {
  const sel = rawSel.trim();
  if (sel === '*') return true;
  if (!/^([a-zA-Z][\w-]*)?(?:[#.][\w-]+|\[[^\]]+\]|:nth-child\(\d+\))*$/.test(sel)) {
    throw new Error('harness 不支持的选择器: ' + sel);
  }
  const tagPart = sel.match(/^([a-zA-Z][\w-]*)?/)[1];
  if (tagPart && el.tagName !== tagPart.toUpperCase()) return false;
  for (const p of sel.match(/[#.][\w-]+|\[[^\]]+\]|:nth-child\(\d+\)/g) || []) {
    if (p.startsWith('#')) { if (el.id !== p.slice(1)) return false; }
    else if (p.startsWith('.')) { if (!(' ' + el.className + ' ').includes(' ' + p.slice(1) + ' ')) return false; }
    else if (p.startsWith(':')) {
      const idx = Number(p.match(/\d+/)[0]);
      const parent = el.parentElement;
      if (!parent || parent.children.indexOf(el) + 1 !== idx) return false;
    } else {
      const inner = p.slice(1, -1);
      const eq = inner.indexOf('=');
      if (eq === -1) { if (!(inner.trim() in el.attrs)) return false; }
      else {
        const k = inner.slice(0, eq).trim();
        const v = inner.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (el.attrs[k] !== v) return false;
      }
    }
  }
  return true;
}

function walkDesc(root, fn) { for (const c of root.children) { fn(c); walkDesc(c, fn); } }
function qsa(root, sel) {
  const list = sel.split(',').map((s) => s.trim()).filter(Boolean);
  const out = [];
  walkDesc(root, (el) => { if (list.some((s) => matchSimple(el, s))) out.push(el); });
  return out;
}

/* ---------------------------------------------------------- 测试页面 */

const html = new El('html');
const head = new El('head');
const body = new El('body');
html.appendChild(head);
html.appendChild(body);

const app = new El('div', { id: 'app' });
body.appendChild(app);

const promo = new El('aside', { className: 'Promo css-9x8y7z', rect: { left: 900, top: 200, width: 300, height: 400 }, text: '广告位' });
app.appendChild(promo);

const feed = new El('div', { className: 'feed' });
const cards = [];
for (let i = 0; i < 3; i++) {
  const c = new El('div', { className: 'Card', attrs: { 'data-row': String(i + 1) }, rect: { left: 200, top: 100 + i * 120, width: 600, height: 110 }, text: '卡片' + i });
  cards.push(c);
  feed.appendChild(c);
}
app.appendChild(feed);

const weird = new El('div', { className: 'css-1a2b3c css-4d5e6f', rect: { left: 200, top: 600, width: 600, height: 80 }, text: '奇怪模块' });
app.appendChild(weird);

const footer = new El('div', { className: 'site-footer', rect: { left: 0, top: 900, width: 1200, height: 100 }, text: '页脚' });
app.appendChild(footer);

/* ------------------------------------------------------------ 环境 */

const location = { hostname: 'example.com', origin: 'https://example.com', pathname: '/feed' };
const storageData = { rules: [], masterEnabled: true };
const listeners = { onChanged: [], onMessage: null };
let moCount = 0;
const sentToBackground = [];

const doc = {
  body, head, documentElement: html, nodeType: 9,
  createElement: (t) => new El(t),
  createTextNode: (t) => { const e = new El('#text'); e._text = t; return e; },
  getElementById: (id) => { let h = null; walkDesc(html, (el) => { if (!h && el.id === id) h = el; }); return h; },
  querySelectorAll: (sel) => qsa(html, sel),
  querySelector: (sel) => qsa(html, sel)[0] || null,
  _listeners: new Map(),
  addEventListener(type, fn) {
    if (!doc._listeners.has(type)) doc._listeners.set(type, []);
    doc._listeners.get(type).push(fn);
  },
  removeEventListener(type, fn) {
    doc._listeners.set(type, (doc._listeners.get(type) || []).filter((f) => f !== fn));
  },
};
function fireDoc(type, ev = {}) {
  // 真实事件总带 preventDefault/stopPropagation，这里补默认实现
  const e = Object.assign({ preventDefault() {}, stopPropagation() {} }, ev);
  for (const fn of (doc._listeners.get(type) || []).slice()) fn(e);
}

const sandbox = {
  console, setTimeout, clearTimeout, setInterval: () => 0,
  Node: { DOCUMENT_FRAGMENT_NODE: 11 },
  CSS: { escape: (s) => s },
  getComputedStyle: (el) => {
    const cs = Object.assign({}, el._cs);
    for (const [k, v] of Object.entries(el.style.map)) cs[camel(k)] = v;
    return cs;
  },
  MutationObserver: class { constructor() { moCount++; } observe() {} disconnect() {} },
  location,
  document: doc,
  chrome: {
    storage: {
      local: {
        get: (def, cb) => cb({ ...JSON.parse(JSON.stringify(def)), ...JSON.parse(JSON.stringify(storageData)) }),
        set: (obj, cb) => { Object.assign(storageData, JSON.parse(JSON.stringify(obj))); if (cb) cb(); },
      },
      onChanged: { addListener: (fn) => listeners.onChanged.push(fn) },
    },
    runtime: {
      onMessage: { addListener: (fn) => { listeners.onMessage = fn; } },
      sendMessage: (m, cb) => { sentToBackground.push(m); if (cb) cb(); },
    },
  },
};
const winListeners = new Map();
sandbox.window = {
  CSS: sandbox.CSS, location, innerWidth: 1280, innerHeight: 900,
  addEventListener(type, fn) {
    if (!winListeners.has(type)) winListeners.set(type, []);
    winListeners.get(type).push(fn);
  },
};
function fireWindow(type) { for (const fn of (winListeners.get(type) || []).slice()) fn({}); }
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SRC, 'utf8'), sandbox, { filename: 'content.js' });

const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const msg = (payload) => new Promise((res) => listeners.onMessage(payload, {}, res));
function setRules(rules) {
  storageData.rules = rules;
  listeners.onChanged.forEach((fn) => fn({ rules: { newValue: rules } }, 'local'));
}
const mkRule = (o) => Object.assign({
  id: 'r' + Math.random().toString(36).slice(2, 7), label: 'test', host: 'example.com',
  origin: 'https://example.com', path: '/feed', scope: 'site', selectors: [], mode: 'hide', enabled: true,
}, o);

await tick(400);

/* ---------------------------------------- 1. 无规则时不打扰页面 */

assert.equal(moCount, 0, '没有任何规则时不应挂 MutationObserver');
assert.ok(doc.getElementById('blk-injected-style'), '样式表应已注入');
assert.ok(!promo.hasAttribute('data-blk'), '无规则时不应隐藏任何元素');

/* ---------------------------------------- 2. 多条规则并存 */

const rHide = mkRule({ selectors: ['.Promo'], label: '广告位' });
const rGroup = mkRule({ selectors: ['.Card'], label: '卡片组' });
const rRemove = mkRule({ selectors: ['.css-1a2b3c'], label: '奇怪模块', mode: 'remove' });
const rOtherPage = mkRule({ selectors: ['.site-footer'], scope: 'page', path: '/other', label: '别的页面' });
setRules([rHide, rGroup, rRemove, rOtherPage]);
await tick(400);

assert.equal(promo.getAttribute('data-blk'), rHide.id, 'hide 规则应打上所属规则 id');
assert.equal(cards.filter((c) => c.hasAttribute('data-blk')).length, 3, '同类 3 张卡片应全部被屏蔽');
assert.ok(!app.children.includes(weird), 'remove 规则应真的把节点从 DOM 摘掉');
assert.ok(!footer.hasAttribute('data-blk'), 'path 不匹配的「仅本页」规则不应生效');

const ping = await msg({ type: 'blk:ping' });
assert.equal(ping.stats[rGroup.id], 3, '命中数应回报给弹窗');
assert.equal(ping.siteRuleCount, 3, '本站生效规则数应为 3');

/* ---------------------------------------- 3. 作用域随地址变化 */

location.pathname = '/other';
fireWindow('popstate'); // 模拟 SPA 路由跳转
await tick(400);
assert.ok(footer.hasAttribute('data-blk'), '切到 /other 后，仅本页规则应生效');
assert.ok(promo.hasAttribute('data-blk'), '整站规则在任意 path 下都继续生效');
location.pathname = '/feed';
fireWindow('popstate');
await tick(400);
assert.ok(!footer.hasAttribute('data-blk'), '离开 /other 后该规则应自动还原');

/* ---------------------------------------- 4. 真删后可插回原位 */

const feedIdx = app.children.indexOf(feed);
setRules([rRemove]);
await tick(400);
assert.ok(!app.children.includes(weird), '只留 remove 规则时仍被摘除');
setRules([]);
await tick(400);
assert.ok(app.children.includes(weird), '删掉规则后节点应插回来');
assert.equal(app.children.indexOf(weird), feedIdx + 1, '且插回原来的位置');

/* ---------------------------------------- 5. 全局开关 */

setRules([rHide, rGroup]);
await tick(400);
assert.ok(promo.hasAttribute('data-blk'), '启用时应屏蔽');
storageData.masterEnabled = false;
listeners.onChanged.forEach((fn) => fn({ masterEnabled: { newValue: false } }, 'local'));
await tick(400);
assert.ok(!promo.hasAttribute('data-blk'), '全局停用后应还原');
assert.equal(moCount, 1, 'MutationObserver 全程只挂一次');
storageData.masterEnabled = true;
listeners.onChanged.forEach((fn) => fn({ masterEnabled: { newValue: true } }, 'local'));
await tick(400);
assert.ok(promo.hasAttribute('data-blk'), '重新启用后应再次屏蔽');

/* ---------------------------------------- 6. body 护栏 */

setRules([mkRule({ selectors: ['body', 'html'] })]);
await tick(400);
assert.ok(!body.hasAttribute('data-blk') && !html.hasAttribute('data-blk'), '命中 body/html 的选择器应被拦下');

/* ---------------------------------------- 7. 点选流程 */

setRules([]);
await tick(400);

let pickRes = null;
listeners.onMessage({ type: 'blk:pick' }, {}, (r) => { pickRes = r; });
await tick(50);

const bar = body.children.find((c) => c.style.map['z-index'] === '2147483647');
const chromeBoxes = () => body.children.filter((c) => c.style.map['z-index'] === '2147483646');
const hlHover = () => chromeBoxes()[0];
const pool = () => chromeBoxes().slice(1);
assert.ok(bar && hlHover(), '应同时出现确认条与 hover 预览框');

const card2 = cards[1];
const labelWith = (barEl, re) => barEl.children.find((c) => re.test(c.textContent));
const btnRowOf = (barEl) => barEl.children.find((c) => c.children.some((x) => /确认屏蔽/.test(x.textContent)));
const okBtn = btnRowOf(bar).children[0];
const lbGroup = labelWith(bar, /同时屏蔽同类/);
const cbGroup = lbGroup.children[0];
const cbSite = labelWith(bar, /整站生效/).children[0];
const cbReflow = labelWith(bar, /收回留白/).children[0];

assert.equal(okBtn.disabled, true, '还没选中时「确认屏蔽」应不可点');
assert.equal(cbSite.checked, true, '默认整站生效');
assert.ok(cbReflow, '确认条应有「收回留白」选项');
assert.equal(cbReflow.checked, true, '补位默认开启');

fireDoc('mousemove', { target: card2 });
assert.equal(hlHover().style.map['width'], '600px', 'hover 预览框宽度应等于卡片宽度');
assert.equal(hlHover().style.map['left'], '200px', '预览框应贴住卡片左缘');
assert.match(hlHover().style.map['outline'], /dashed/, 'hover 预览应为虚线');
assert.equal(pool().length, 0, '未选中时没有实线框');
assert.equal(okBtn.disabled, true, '仅 hover 预览不应允许确认');
assert.match(bar.children[0].textContent, /^把鼠标移到/, '未选中时应显示引导文案');

fireDoc('mousedown', { target: card2, preventDefault() {}, stopPropagation() {} });
assert.equal(pool().length, 1, '选中后应出现 1 个实线框');
assert.match(pool()[0].style.map['outline'], /solid/, '已选区域应为实线框');
assert.equal(pool()[0].style.map['width'], '600px', '实线框应套住卡片');
assert.match(bar.children[0].textContent, /^已选 1 个区域：div\[data-row="2"\]$/, '摘要应列出选择器');
assert.equal(okBtn.disabled, false, '选中后「确认屏蔽」才可点');

// hover 别的元素：预览框跟随，但选区不受影响
fireDoc('mousemove', { target: promo });
assert.equal(hlHover().style.map['width'], '300px', '预览框应跟随鼠标');
assert.match(bar.children[0].textContent, /^已选 1 个区域：div\[data-row="2"\]$/, '选区不受 hover 影响');

// Ctrl+单击：追加 → 移除 → 再追加
fireDoc('mousedown', { target: promo, ctrlKey: true, preventDefault() {}, stopPropagation() {} });
assert.equal(pool().length, 2, 'Ctrl+单击应追加区域');
assert.match(bar.children[0].textContent, /^已选 2 个区域：div\[data-row="2"\]、\.Promo$/, '摘要按顺序列出全部选区');
fireDoc('mousedown', { target: card2, ctrlKey: true, preventDefault() {}, stopPropagation() {} });
assert.equal(pool().length, 1, 'Ctrl+单击已选元素应把它移除');
fireDoc('mousedown', { target: card2, ctrlKey: true, preventDefault() {}, stopPropagation() {} });
assert.equal(pool().length, 2, '再 Ctrl+单击同一元素应重新加入');

assert.equal(cbGroup.disabled, false, '存在同类元素时「同时屏蔽同类」应可用');
assert.ok(/约屏蔽 4 个/.test(lbGroup.children[1].textContent), '应提示批量总数（3 卡片 + 1 广告位），实际：' + lbGroup.children[1].textContent);

// 普通单击 = 整个选区替换成新区域
fireDoc('mousemove', { target: feed });
fireDoc('mousedown', { target: feed, preventDefault() {}, stopPropagation() {} });
assert.equal(pool().length, 1, '普通单击应替换整个选区');
assert.match(bar.children[0].textContent, /^已选 1 个区域：\.feed$/, '普通单击后摘要只剩新区域');

// 重建两个选区
fireDoc('mousedown', { target: card2, preventDefault() {}, stopPropagation() {} });
fireDoc('mousedown', { target: promo, ctrlKey: true, preventDefault() {}, stopPropagation() {} });
assert.equal(pool().length, 2, '重建选区：1 个普通 + 1 个 Ctrl');

// ↑↓ 作用于鼠标悬停的那块（已选中），而不是固定调最后点的
fireDoc('mousemove', { target: card2 });
fireDoc('keydown', { key: 'ArrowUp' });
assert.equal(pool().length, 2, '↑ 只原地升级悬停块，不增减选区数量');
assert.match(bar.children[0].textContent, /^已选 2 个区域：\.feed、\.Promo$/, '↑ 应把悬停的 card2 升级为其父级 .feed，promo 不受影响');
fireDoc('mousemove', { target: feed });
fireDoc('keydown', { key: 'ArrowDown' });
assert.match(bar.children[0].textContent, /^已选 2 个区域：div\[data-row="1"\]、\.Promo$/, '↓ 应把悬停的 .feed 降为其第一个子元素');

// 再重建回 card2 + promo 后确认
fireDoc('mousedown', { target: card2, preventDefault() {}, stopPropagation() {} });
fireDoc('mousedown', { target: promo, ctrlKey: true, preventDefault() {}, stopPropagation() {} });
assert.equal(pool().length, 2, '确认前选区：card2 + promo');
cbGroup.checked = true;
okBtn.dispatch('click', {});
await tick(400);

assert.ok(pickRes && pickRes.ok, '点选应成功：' + JSON.stringify(pickRes));
assert.equal(pickRes.rule.scope, 'site');
// 注意：数组来自 vm realm，原型不同，用 join 比较内容
assert.equal(
  pickRes.rule.selectors.join('|'),
  'div[data-row="2"]|div.Card|.Promo',
  '多选应汇总各区域唯一定位 + 同类批量选择器（去重）'
);
assert.equal(pickRes.hit, 4, '两区域 + 同类批量应命中 4 处（3 卡片 + 1 广告位）');
assert.match(String(pickRes.rule.label), /^2 个区域 · /, '多选时标签应写明区域数');
assert.equal(storageData.rules.length, 1, '多条区域合并为一条规则');
assert.equal(cards.filter((c) => c.hasAttribute('data-blk')).length, 3, '卡片应被屏蔽');
assert.ok(promo.hasAttribute('data-blk'), '广告位也应被屏蔽');
assert.ok(!body.children.includes(bar), '确认后应退出点选模式');

/* ---------------------------------------- 8. 选择器稳定性（靠点选摘要行观察） */

const withId = new El('section', { id: 'topBanner', rect: { left: 0, top: 0, width: 300, height: 60 } });
const withData = new El('div', { className: 'Row', attrs: { 'data-row': '99' }, rect: { left: 0, top: 0, width: 300, height: 60 } });
const plain = new El('span', { rect: { left: 0, top: 0, width: 300, height: 60 } });
app.appendChild(withId);
app.appendChild(withData);
app.appendChild(plain);

await msg({ type: 'blk:apply' });
await tick(400);
listeners.onMessage({ type: 'blk:pick' }, {}, () => {});
await tick(50);
const bar2 = body.children.find((c) => c.style.map['z-index'] === '2147483647');
const sumLine = () => bar2.children[0].textContent.split('：')[1].trim();

fireDoc('mousedown', { target: withId, preventDefault() {}, stopPropagation() {} });
assert.equal(sumLine(), '#topBanner', '有 id 时优先用 id');

fireDoc('mousedown', { target: withData, preventDefault() {}, stopPropagation() {} });
assert.equal(sumLine(), 'div[data-row="99"]', '无 id 时用 data-* 属性');

fireDoc('mousedown', { target: weird, preventDefault() {}, stopPropagation() {} });
assert.equal(sumLine(), 'div.css-1a2b3c.css-4d5e6f', '只有哈希 class 时仍优先用 class 组合（比结构路径抗重排）');

fireDoc('mousedown', { target: plain, preventDefault() {}, stopPropagation() {} });
assert.match(sumLine(), /^body > div:nth-child\(\d+\) > span:nth-child\(\d+\)$/, '完全没特征时才退化为结构路径，实际：' + sumLine());

/* 已锁定状态下 Alt+点击 = 上移一层，而不是改选鼠标下的元素 */
fireDoc('mousedown', { target: cards[0], altKey: true, preventDefault() {}, stopPropagation() {} });
assert.equal(sumLine(), '#app', '已有选区时 Alt+点击应把当前块上移一层（当前选的是 plain，其父级为 #app）');
fireDoc('mousemove', { target: footer });
assert.equal(sumLine(), '#app', '有选区时掠过其他元素只改预览，不改选区');

fireDoc('keydown', { key: 'Escape' });
await tick(50);
assert.equal(storageData.rules.length, 1, '取消点选不应新增规则');
assert.ok(!body.children.includes(bar2), 'Esc 后应移除确认条');

/* ------------------------------------ 8b. 预览 → 锁定 → 方向键微调 → Enter 确认 */

listeners.onMessage({ type: 'blk:pick' }, {}, () => {});
await tick(50);
const bar4 = body.children.find((c) => c.style.map['z-index'] === '2147483647');
const sum4 = () => bar4.children[0].textContent.split('：')[1].trim();

fireDoc('mousemove', { target: cards[0] });
assert.match(bar4.children[0].textContent, /^把鼠标移到/, '新会话未选中时应显示引导文案');
assert.equal(btnRowOf(bar4).children[0].disabled, true, '预览态下「确认屏蔽」应不可点');
fireDoc('mousedown', { target: cards[0], preventDefault() {}, stopPropagation() {} });
assert.equal(sum4(), 'div[data-row="1"]', '单击应选中这张卡片');
fireDoc('keydown', { key: 'ArrowUp' });
assert.equal(sum4(), '.feed', '↑ 应上移一层到列表容器');
fireDoc('keydown', { key: 'ArrowDown' });
assert.equal(sum4(), 'div[data-row="1"]', '↓ 应下移一层回到卡片');
fireDoc('keydown', { key: 'ArrowUp' });
assert.equal(sum4(), '.feed', '再 ↑ 回到列表容器');
fireDoc('mousemove', { target: footer });
assert.equal(sum4(), '.feed', '微调后掠过其他元素只改预览，不改选区');

fireDoc('keydown', { key: 'Enter' });
await tick(400);
assert.equal(storageData.rules.length, 2, 'Enter 应等同点「确认屏蔽」并入库');
assert.equal(storageData.rules[1].selectors.join('|'), '.feed', 'Enter 确认的应是键盘微调后的目标');
assert.ok(feed.hasAttribute('data-blk'), '微调后的目标应被屏蔽');
assert.ok(!body.children.includes(bar4), '确认后应退出点选模式');

setRules([]);
await tick(400);

/* ---------------------------------------- 9. 快捷键：暂停本页 / 暂停本站 */

const rPause = mkRule({ selectors: ['div.Card'] });
setRules([rPause]);
await tick(400);
assert.equal(cards.filter((c) => c.hasAttribute('data-blk')).length, 3, '前置条件：卡片应被屏蔽');

const tabOff = await msg({ type: 'blk:toggleTab' });
assert.equal(tabOff.tabPaused, true, '应答回 tabPaused 状态给后台设角标');
assert.equal(cards.filter((c) => c.hasAttribute('data-blk')).length, 0, '暂停本页后应立即还原');
const toastEl = doc.getElementById('blk-toast');
assert.ok(toastEl, '快捷键要有页面内提示（弹窗此时已关闭）');
assert.match(toastEl.textContent, /Alt\+Shift\+B/, '提示里要写明怎么恢复');
const lastState = sentToBackground.filter((m) => m.type === 'blk:state').pop();
assert.ok(lastState && lastState.tabPaused === true, '应向后台上报状态以设置 ⏸ 角标');

const tabOn = await msg({ type: 'blk:toggleTab' });
assert.equal(tabOn.tabPaused, false, '再按一次恢复');
assert.equal(cards.filter((c) => c.hasAttribute('data-blk')).length, 3, '恢复后重新屏蔽');

const siteOff = await msg({ type: 'blk:toggleSite' });
assert.equal(siteOff.sitePaused, true, '暂停本站');
assert.equal(cards.filter((c) => c.hasAttribute('data-blk')).length, 0, '暂停本站后应还原');
assert.equal(storageData.pausedSites.join(','), 'example.com', '暂停站点应写入 storage');

await msg({ type: 'blk:apply' });
await tick(400);
assert.equal(cards.filter((c) => c.hasAttribute('data-blk')).length, 0, '重新加载后「暂停本站」仍生效（区别于临时暂停）');

const pingPaused = await msg({ type: 'blk:ping' });
assert.equal(pingPaused.sitePaused, true);
assert.equal(pingPaused.siteRuleCount, 0, '暂停时生效规则数应归零');

await msg({ type: 'blk:toggleSite' });
await tick(400);
assert.equal(cards.filter((c) => c.hasAttribute('data-blk')).length, 3, '再按 Alt+Shift+S 恢复屏蔽');
assert.equal((storageData.pausedSites || []).length, 0, '恢复后应清空该站点');

const addOther = await msg({ type: 'blk:setSitePaused', host: 'other.com', paused: true });
assert.equal(addOther.pausedSites.join(','), 'other.com', '弹窗应能管理其它已暂停站点');
assert.equal(addOther.sitePaused, false, '暂停别的站点不应影响当前站点');
assert.equal(cards.filter((c) => c.hasAttribute('data-blk')).length, 3, '当前站点屏蔽不受影响');

/* ---------------------------------------- 10. 补位：收回父级预留的空白 */

setRules([]);
await tick(400);

/* 场景 A：grid 固定轨道（240px 侧栏 + 900px 主内容）——轨道不会因元素消失而塌掉 */
const gridWrap = new El('div', {
  className: 'GridWrap',
  rect: { left: 0, top: 0, width: 1140, height: 800 },
  cs: { display: 'grid', gridTemplateColumns: '240px 900px' },
});
const side = new El('nav', { className: 'Side', rect: { left: 0, top: 0, width: 240, height: 800 }, text: '侧栏' });
const mainCol = new El('div', { className: 'MainCol', rect: { left: 240, top: 0, width: 900, height: 800 }, text: '正文' });
gridWrap.appendChild(side);
gridWrap.appendChild(mainCol);
body.appendChild(gridWrap);

const rGrid = mkRule({ selectors: ['.Side'] }); // 故意不带 reflow 字段：老规则应默认补位
setRules([rGrid]);
await tick(400);
assert.ok(side.hasAttribute('data-blk'), '侧栏应被屏蔽');
assert.equal(gridWrap.style.map['grid-template-columns'], '0px 900px', '固定栅格轨道应塌成 0，主内容左移补位');

/* 场景 B：父级 padding-left 预留（fixed 侧栏最常见的补偿） */
const padWrap = new El('div', {
  className: 'PadWrap',
  rect: { left: 0, top: 0, width: 1200, height: 800 },
  cs: { paddingLeft: '300px' },
});
const nav2 = new El('div', {
  className: 'FixedNav',
  rect: { left: 0, top: 0, width: 280, height: 700 },
  cs: { position: 'fixed' },
  text: '导航',
});
padWrap.appendChild(nav2);
body.appendChild(padWrap);

setRules([mkRule({ selectors: ['.FixedNav'] })]);
await tick(400);
assert.equal(padWrap.style.map['padding-left'], '0px', '父级为侧栏预留的 padding-left 应清零');

/* 场景 C：40px 只是正常留白（不足被屏蔽块高度 100px 的 65%）→ 不该乱动 */
const topWrap = new El('div', {
  className: 'TopWrap',
  rect: { left: 0, top: 0, width: 1200, height: 900 },
  cs: { paddingTop: '40px' },
});
const banner = new El('div', { className: 'Banner', rect: { left: 40, top: 0, width: 1100, height: 100 }, text: '横幅' });
topWrap.appendChild(banner);
body.appendChild(topWrap);

setRules([mkRule({ selectors: ['.Banner'] })]);
await tick(400);
assert.ok(banner.hasAttribute('data-blk'), '横幅应被屏蔽（正常流里本身上方内容会自动上移）');
assert.equal(topWrap.style.map['padding-top'], undefined, '正常留白不该被误清');

/* 关掉补位开关 → 只屏蔽不动父级 */
setRules([mkRule({ selectors: ['.FixedNav'], reflow: false })]);
await tick(400);
assert.ok(nav2.hasAttribute('data-blk'), 'reflow:false 时仍应屏蔽');
assert.equal(padWrap.style.map['padding-left'], undefined, 'reflow:false 时不该改动父级留白');

/* 规则清空 → 所有补位改动逐条还原 */
setRules([rGrid, mkRule({ selectors: ['.FixedNav'] })]);
await tick(400);
assert.equal(gridWrap.style.map['grid-template-columns'], '0px 900px', '前置：两条补位规则都已生效');
assert.equal(padWrap.style.map['padding-left'], '0px', '前置：padding 已清零');
setRules([]);
await tick(400);
assert.equal(gridWrap.style.map['grid-template-columns'], undefined, '删除规则后应还原栅格轨道');
assert.equal(padWrap.style.map['padding-left'], undefined, '删除规则后应还原 padding');
assert.ok(!side.hasAttribute('data-blk') && !nav2.hasAttribute('data-blk'), '元素应恢复显示');

console.log('✅ 网页屏蔽器全部断言通过：作用域 / hide+remove / 真删插回 / 同类批量 / 全局开关 / body 护栏 / 预览→选中 / Ctrl多选增删 / 键盘微调 / Enter 确认 / 选择器分级 / 快捷键暂停 / 补位收回留白');
