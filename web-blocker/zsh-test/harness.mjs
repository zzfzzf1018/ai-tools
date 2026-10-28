/**
 * 用最小假 DOM 在 Node 里真实执行 content.js，验证：
 *  1) 自动识别命中左侧栏（排除三类诱饵、嵌套去重）
 *  2) 收回预留留白 + 主内容补位
 *  3) 关掉开关逐条还原
 *  4) 自定义选择器兜底
 *  5) 「点选侧栏」全流程：hover 小图标 → 往上锁定容器 → 生成稳定选择器 → 存盘 + 立即隐藏
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const SRC = process.env.ZSH_SRC || 'C:/Users/cnzhuzhe/.qwenworkcn/workspace/mvq7y8sqn6owhd69/outputs/zhihu-sidebar-hide/content.js';

/* ------------------------------------------------------------ 迷你 DOM */

const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const kebab = (k) => k.replace(/([A-Z])/g, (m) => '-' + m.toLowerCase());

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
    const r = Object.assign({ left: 0, top: 0, width: 0, height: 0 }, o.rect);
    this._rect = r;
    this._cs = Object.assign(
      {
        display: 'block', position: 'static', visibility: 'visible',
        opacity: '1', flexDirection: 'row', paddingLeft: '0px', marginLeft: '0px',
      },
      o.cs
    );
  }
  get firstElementChild() { return this.children[0] || null; }
  get isConnected() { return true; }
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
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  getBoundingClientRect() {
    return { ...this._rect, right: this._rect.left + this._rect.width, bottom: this._rect.top + this._rect.height };
  }
  contains(n) { let p = n; while (p) { if (p === this) return true; p = p.parentElement; } return false; }
  closest(sel) { let p = this; while (p) { if (matchSimple(p, sel)) return p; p = p.parentElement; } return null; }
  querySelectorAll(sel) { return qsa(this, sel); }
  querySelector(sel) { return qsa(this, sel)[0] || null; }
}

function matchSimple(el, rawSel) {
  const sel = rawSel.trim();
  if (sel === '*') return true;
  const m = sel.match(/^([a-zA-Z][\w-]*)?((?:[#.][\w-]+|\[[^\]]+\])*)$/);
  if (!m) throw new Error('harness 不支持的选择器: ' + sel);
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  for (const p of (m[2] || '').match(/[#.][\w-]+|\[[^\]]+\]/g) || []) {
    if (p[0] === '#') { if (el.id !== p.slice(1)) return false; }
    else if (p[0] === '.') { if (!(' ' + el.className + ' ').includes(' ' + p.slice(1) + ' ')) return false; }
    else {
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

function walkDesc(root, fn) {
  for (const c of root.children) { fn(c); walkDesc(c, fn); }
}
function qsa(root, sel) {
  const list = sel.split(',').map((s) => s.trim()).filter(Boolean);
  const out = [];
  walkDesc(root, (el) => { if (list.some((s) => matchSimple(el, s))) out.push(el); });
  return out;
}

/* ---------------------------------------------------------- 组装页面 */

const VW = 1920, VH = 1080;
const html = new El('html');
const head = new El('head');
const body = new El('body', { rect: { width: VW, height: VH } });
html.appendChild(head);
html.appendChild(body);

const root = new El('div', { id: 'root', rect: { left: 0, width: VW, height: VH }, cs: { paddingLeft: '88px' } });
body.appendChild(root);

const rail = new El('aside', {
  className: 'AppAside css-1q2w3e',
  rect: { left: 0, top: 0, width: 64, height: VH },
  cs: { position: 'fixed' },
});
for (const name of ['首页', '关注', '热榜', '专栏', '圈子', '盐选', '福利']) {
  const a = new El('a', { rect: { left: 8, top: 60, width: 48, height: 48 }, text: name });
  a.appendChild(new El('svg', { rect: { left: 14, top: 66, width: 32, height: 32 } }));
  rail.appendChild(a);
}
root.appendChild(rail);

const main = new El('div', { className: 'AppContents', rect: { left: 88, top: 0, width: 1000, height: 2000 } });
const feed = new El('div', { rect: { left: 88, top: 0, width: 640, height: 2000 } });
feed.appendChild(new El('article', { rect: { left: 88, top: 0, width: 640, height: 400 }, text: '正文正文正文' }));
main.appendChild(feed);
const rightCol = new El('div', { className: 'rightColumn', rect: { left: 760, top: 0, width: 320, height: 1200 } });
main.appendChild(rightCol);
root.appendChild(main);

// 诱饵 1：形状像侧栏但含正文
const decoyArticle = new El('div', {
  className: 'decoy-with-article',
  rect: { left: 0, top: 0, width: 64, height: VH },
  cs: { position: 'fixed' },
});
for (let i = 0; i < 3; i++) decoyArticle.appendChild(new El('a', { rect: { left: 0, top: i * 40, width: 60, height: 40 } }));
decoyArticle.appendChild(new El('article', { rect: { left: 0, top: 120, width: 60, height: 400 }, text: 'x' }));
body.appendChild(decoyArticle);

// 诱饵 2：顶部横向导航条
const topbar = new El('div', { className: 'PageHeader', rect: { left: 0, top: 0, width: VW, height: 52 }, cs: { position: 'fixed' } });
topbar.appendChild(new El('a')); topbar.appendChild(new El('a')); topbar.appendChild(new El('a'));
body.appendChild(topbar);

// 诱饵 3：很窄但长文本
const longText = new El('div', { className: 'narrow-long', rect: { left: 0, top: 0, width: 64, height: VH }, cs: { position: 'fixed' }, text: '字'.repeat(400) });
longText.appendChild(new El('a')); longText.appendChild(new El('a')); longText.appendChild(new El('a'));
body.appendChild(longText);

// 嵌套在 rail 里的内层容器（故意也做成 fixed，触发去重）
const railInner = new El('nav', { rect: { left: 0, top: 0, width: 64, height: VH }, cs: { position: 'fixed' } });
railInner.appendChild(new El('a')); railInner.appendChild(new El('a')); railInner.appendChild(new El('a'));
rail.appendChild(railInner);

/* ------------------------------------------------------------ 环境 */

const storageData = {};
const listeners = { onChanged: [], onMessage: null, dom: new Map() };
let moCallback = null;

const doc = {
  body,
  head,
  documentElement: html,
  nodeType: 9,
  createElement: (t) => new El(t),
  getElementById: (id) => {
    let hit = null;
    walkDesc(html, (el) => { if (!hit && el.id === id) hit = el; });
    return hit;
  },
  querySelectorAll: (sel) => qsa(html, sel),
  querySelector: (sel) => qsa(html, sel)[0] || null,
  addEventListener: (type, fn) => {
    if (!doc._listeners.has(type)) doc._listeners.set(type, []);
    doc._listeners.get(type).push(fn);
  },
  removeEventListener: (type, fn) => {
    const arr = doc._listeners.get(type) || [];
    doc._listeners.set(type, arr.filter((f) => f !== fn));
  },
  _listeners: new Map(),
};

function fire(type, event) {
  for (const fn of (doc._listeners.get(type) || []).slice()) fn(event);
}

const sandbox = {
  console,
  setTimeout, clearTimeout,
  setInterval: () => 0,
  Node: { DOCUMENT_FRAGMENT_NODE: 11 },
  CSS: { escape: (s) => s },
  MutationObserver: class { constructor(cb) { moCallback = cb; } observe() {} disconnect() {} },
  getComputedStyle: (el) => {
    const cs = Object.assign({}, el._cs);
    for (const [k, v] of Object.entries(el.style.map)) cs[camel(k)] = v;
    return cs;
  },
  document: doc,
  chrome: {
    storage: {
      local: {
        get: (def, cb) => cb(Object.assign({}, def, storageData)),
        set: (obj, cb) => { Object.assign(storageData, obj); if (cb) cb(); },
      },
      onChanged: { addListener: (fn) => listeners.onChanged.push(fn) },
    },
    runtime: { onMessage: { addListener: (fn) => { listeners.onMessage = fn; } } },
  },
};
sandbox.window = {
  innerWidth: VW, innerHeight: VH,
  CSS: sandbox.CSS,
  addEventListener: () => {},
  getComputedStyle: sandbox.getComputedStyle,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SRC, 'utf8'), sandbox, { filename: 'content.js' });

const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const fireChanged = (patch) => listeners.onChanged.forEach((fn) => fn(patch, 'local'));

/* ------------------------------------------------------------ 断言 */

await tick(500);

assert.ok(doc.getElementById('zsh-injected-style'), '应自行注入 <style>（不依赖 manifest css）');
assert.ok(rail.hasAttribute('data-zsh-hide'), 'rail 应被隐藏');
assert.ok(!decoyArticle.hasAttribute('data-zsh-hide'), '含 article 的诱饵不应被隐藏');
assert.ok(!topbar.hasAttribute('data-zsh-hide'), '顶部横向导航不应被隐藏');
assert.ok(!longText.hasAttribute('data-zsh-hide'), '长文本窄栏不应被隐藏');
assert.equal(root.style.map['padding-left'], '0px', '应清掉 #root 为侧栏预留的 88px 左内边距');
assert.equal(main.style.map['margin-left'], 'auto', '主内容应被补位居中');
assert.ok(!feed.hasAttribute('data-zsh-hide') && !main.hasAttribute('data-zsh-hide'), '正文不应被误伤');

const diag = await new Promise((res) => listeners.onMessage({ type: 'zsh:diagnose' }, {}, res));
assert.equal(diag.items.length, 1, 'diagnose 只应报告 1 个候选（嵌套已去重）');
assert.equal(diag.items[0].selectorSuggestion, '.AppAside', '应生成稳定 class 选择器，而不是哈希 class');
assert.equal(diag.items[0].box.width, 64);

const ping = await new Promise((res) => listeners.onMessage({ type: 'zsh:ping' }, {}, res));
assert.equal(ping.ok, true);
assert.ok(ping.hidden >= 1, 'ping 应报告已隐藏数量');

// 关闭开关 → 还原
fireChanged({ enabled: { newValue: false } });
await tick(500);
assert.ok(!rail.hasAttribute('data-zsh-hide'), '关闭后应移除隐藏属性');
assert.equal(root.style.map['padding-left'], undefined, '关闭后应还原 padding-left');
assert.equal(main.style.map['margin-left'], undefined, '关闭后应还原 margin');

// 重新打开 → 再次生效
fireChanged({ enabled: { newValue: true } });
await tick(500);
assert.ok(rail.hasAttribute('data-zsh-hide'), '重新开启后应再次隐藏');

// 自定义选择器兜底
fireChanged({ extraSelectors: { newValue: '.rightColumn' } });
await tick(500);
assert.ok(rightCol.hasAttribute('data-zsh-hide'), '自定义选择器应命中右栏');
fireChanged({ extraSelectors: { newValue: '' } });
await tick(500);
assert.ok(!rightCol.hasAttribute('data-zsh-hide'), '清空后右栏应恢复');

/* ---------- 点选侧栏：hover 小图标 → 锁定外层容器 → 存盘 + 隐藏 ---------- */

assert.ok(!railInner.hasAttribute('data-zsh-hide'), '内层 nav 不应被单独锁定（去重）');

let pickRes = null;
listeners.onMessage({ type: 'zsh:pick' }, {}, (r) => { pickRes = r; });
await tick(50);

const iconLink = rail.children[0]; // 用户鼠标实际落在小图标 <a> 上
fire('mousemove', { target: iconLink });
const overlay = body.children.find((c) => c.style.map['z-index'] === '2147483646');
assert.ok(overlay, '点选模式应插入高亮遮罩');
assert.equal(overlay.style.map['opacity'], '1', 'hover 到侧栏图标时应高亮');
assert.equal(overlay.style.map['width'], '64px', '高亮框应是整个侧栏容器的宽度，而不是图标宽度');

let prevented = false;
fire('mousedown', {
  target: iconLink,
  preventDefault: () => { prevented = true; },
  stopPropagation: () => { prevented = true; },
});
await tick(50);

assert.ok(pickRes && pickRes.ok, '点选应成功：' + JSON.stringify(pickRes));
assert.equal(pickRes.selector, '.AppAside', '点选应生成 .AppAside 而不是哈希 class 或路径');
assert.equal(storageData.extraSelectors, '.AppAside', '选择器应写入 storage');
assert.ok(rail.hasAttribute('data-zsh-hide'), '点选后应立刻隐藏');
assert.ok(prevented, '点选时应拦截默认跳转');
assert.ok(!body.children.includes(overlay), '退出点选模式应移除遮罩');

// 点错位置：主内容区 → 报错但不写入
let pickRes2 = null;
listeners.onMessage({ type: 'zsh:pick' }, {}, (r) => { pickRes2 = r; });
await tick(50);
fire('mousedown', { target: feed, preventDefault() {}, stopPropagation() {} });
await tick(50);
assert.ok(pickRes2 && !pickRes2.ok, '点在主内容上应返回失败提示');
assert.equal(storageData.extraSelectors, '.AppAside', '失败的点选不应污染已存选择器');

console.log('✅ 全部断言通过：自动识别 / 诱饵排除 / 嵌套去重 / 补位 / 还原 / 开关 / 自定义选择器 / 点选锁定');
