/* 心晴岛 · 静态校验：数据契约、引用完整性、离线资源。运行：node tools/verify.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [], warns = [];
const E = (m) => errors.push(m);
const W = (m) => warns.push(m);

/* ---------- 载入课程数据 ---------- */
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'src/data/curriculum.js'), 'utf8'), sandbox, { filename: 'curriculum.js' });
const d = sandbox.window.SEL_DATA;
if (!d || typeof d !== 'object') { E('SEL_DATA 未定义'); console.log('FATAL'); process.exit(1); }

const TYPES = ['choice', 'match', 'order', 'slider', 'breathe', 'story', 'classify'];
const FACES = ['happy', 'sad', 'angry', 'scared', 'surprised', 'calm', 'proud', 'jealous', 'worried', 'lonely'];
const SCENES = ['school', 'playground', 'home', 'birthday', 'group', 'park', 'classroom', 'online'];
const ISLAND_IDS = ['awareness', 'management', 'social', 'relationship', 'decision'];
const STRATEGY_IDS = ['awareness', 'breathing', 'coping', 'distance', 'expression'];

const has = (o, k) => o && o[k] !== undefined && o[k] !== null && o[k] !== '';
const isArr = (a) => Array.isArray(a) && a.length > 0;

/* ---------- 顶层结构 ---------- */
if (!isArr(d.emotions)) E('emotions 缺失或为空');
if (!isArr(d.strategies)) E('strategies 缺失或为空');
if (!isArr(d.islands)) E('islands 缺失或为空');
if (!isArr(d.stories)) E('stories 缺失或为空');
if (!isArr(d.stickers)) E('stickers 缺失或为空');
if (!d.checkinReasons || typeof d.checkinReasons !== 'object') E('checkinReasons 缺失');
if (!d.parentTips || typeof d.parentTips !== 'object') E('parentTips 缺失');

const emotionIds = new Set((d.emotions || []).map(e => e.id));
const strategyIds = new Set((d.strategies || []).map(s => s.id));
const stickerIds = new Set((d.stickers || []).map(s => s.id));
const storyIds = new Set((d.stories || []).map(s => s.id));
const islandIds = new Set((d.islands || []).map(i => i.id));

STRATEGY_IDS.forEach(id => { if (!strategyIds.has(id)) E('缺少固定策略 id: ' + id); });
ISLAND_IDS.forEach(id => { if (!islandIds.has(id)) E('缺少固定岛屿 id: ' + id); });

(d.emotions || []).forEach(e => {
  if (!has(e, 'id') || !has(e, 'name')) E('情绪字段不全: ' + JSON.stringify(e).slice(0, 80));
  if (!FACES.includes(e.face)) E(`情绪 ${e.id} 的 face 非法: ${e.face}`);
  if (e.strategy && !strategyIds.has(e.strategy)) E(`情绪 ${e.id} 指向不存在的策略 ${e.strategy}`);
  if (!isArr(e.cues) || !isArr(e.words)) W(`情绪 ${e.id} 的 cues/words 偏少`);
  const rs = (d.checkinReasons || {})[e.id];
  if (!isArr(rs) || rs.length < 4) E(`checkinReasons.${e.id} 需要 4 条，实际 ${rs ? rs.length : 0}`);
});
(d.strategies || []).forEach(s => {
  if (!has(s, 'name') || !isArr(s.steps) || !has(s, 'muscle')) E(`策略 ${s.id} 字段不全`);
});
(d.stickers || []).forEach(s => {
  if (!has(s, 'id') || !has(s, 'name')) E('贴纸字段不全');
  if (s.island && !islandIds.has(s.island)) E(`贴纸 ${s.id} 指向不存在的岛屿 ${s.island}`);
});
ISLAND_IDS.forEach(id => {
  const t = (d.parentTips || {})[id];
  if (!isArr(t)) E(`parentTips.${id} 缺失`);
});

/* ---------- 关卡 ---------- */
const allLevels = [];
const typeCount = {};
(d.islands || []).forEach(island => {
  if (!isArr(island.levels)) { E(`岛屿 ${island.id} 没有关卡`); return; }
  if (typeof island.unlockAt !== 'number') W(`岛屿 ${island.id} 缺 unlockAt`);
  island.levels.forEach((lv, idx) => {
    allLevels.push({ island, lv, idx });
    typeCount[lv.type] = (typeCount[lv.type] || 0) + 1;
    const tag = `${island.id}/${lv.id}`;
    if (!TYPES.includes(lv.type)) E(`${tag} 题型非法: ${lv.type}`);
    ['title', 'intro', 'teach', 'tip'].forEach(k => { if (!has(lv, k)) E(`${tag} 缺 ${k}`); });
    if (!lv.data || typeof lv.data !== 'object') { E(`${tag} 缺 data`); return; }
    if (!lv.reward || !stickerIds.has(lv.reward.sticker)) E(`${tag} 贴纸引用无效: ${lv.reward && lv.reward.sticker}`);
    const x = lv.data;
    switch (lv.type) {
      case 'choice':
        if (!isArr(x.options) || x.options.length < 3) E(`${tag} choice 需要 >=3 个选项`);
        else {
          if (!x.options.some(o => o.good === true)) E(`${tag} choice 没有 good 选项`);
          x.options.forEach((o, i) => {
            if (!has(o, 'text')) E(`${tag} 选项 ${i} 缺 text`);
            if (!has(o, 'outcome') || !has(o, 'feedback')) W(`${tag} 选项 ${i} 缺 outcome/feedback`);
          });
        }
        if (x.scene && !SCENES.includes(x.scene)) E(`${tag} scene 非法: ${x.scene}`);
        if (!has(x, 'prompt')) E(`${tag} choice 缺 prompt`);
        break;
      case 'match':
        if (!isArr(x.pairs) || x.pairs.length < 4) E(`${tag} match 需要 >=4 对`);
        (x.pairs || []).forEach((p, i) => {
          if (!p.left || !p.right) E(`${tag} 第 ${i} 对缺 left/right`);
          else {
            if (p.left.id !== p.right.id) E(`${tag} 第 ${i} 对 id 不一致`);
            if (p.left.face && !FACES.includes(p.left.face)) E(`${tag} 第 ${i} 对 face 非法`);
            if (!has(p.right, 'label')) E(`${tag} 第 ${i} 对缺右侧文字`);
          }
        });
        break;
      case 'order': {
        const ids = (x.items || []).map(i => i.id);
        if (!isArr(x.items) || ids.length < 3) E(`${tag} order 需要 >=3 项`);
        if (!isArr(x.answer)) E(`${tag} order 缺 answer`);
        else {
          if (x.answer.length !== ids.length) E(`${tag} order.answer 长度与 items 不符`);
          if (ids.slice().sort().join('|') !== x.answer.slice().sort().join('|')) E(`${tag} order.answer 未覆盖全部 item id`);
        }
        break;
      }
      case 'slider':
        if (!has(x, 'prompt')) E(`${tag} slider 缺 prompt`);
        if (!x.answer || typeof x.answer.min !== 'number' || typeof x.answer.max !== 'number') E(`${tag} slider.answer 非法`);
        else if (x.answer.min < 1 || x.answer.max > 5 || x.answer.min > x.answer.max) E(`${tag} slider.answer 超出 1-5`);
        break;
      case 'breathe':
        if (!['balloon', 'box', '478'].includes(x.pattern)) E(`${tag} breathe.pattern 非法`);
        if (!isArr(x.cues) || x.cues.length < 2) W(`${tag} breathe.cues 偏少`);
        break;
      case 'story':
        if (!storyIds.has(x.storyId)) E(`${tag} 引用不存在的故事 ${x.storyId}`);
        break;
      case 'classify': {
        const bIds = (x.buckets || []).map(b => b.id);
        if (bIds.length !== 2) E(`${tag} classify 需要 2 个篮子`);
        if (!isArr(x.items) || x.items.length < 4) E(`${tag} classify 卡片太少`);
        (x.items || []).forEach(i => { if (!bIds.includes(i.bucket)) E(`${tag} 卡片 ${i.id} 指向不存在的篮子 ${i.bucket}`); });
        break;
      }
    }
  });
});

const dupe = allLevels.map(x => x.lv.id).filter((v, i, a) => a.indexOf(v) !== i);
if (dupe.length) E('关卡 id 重复: ' + [...new Set(dupe)].join(', '));
TYPES.forEach(t => { if ((typeCount[t] || 0) < 2) W(`题型 ${t} 只出现 ${typeCount[t] || 0} 次`); });

/* ---------- 解锁链路可达性：星星上限必须够开下一座岛 ---------- */
let reachableStars = 0;
(d.islands || []).forEach(island => {
  if (typeof island.unlockAt === 'number' && island.unlockAt > reachableStars) {
    E(`岛屿 ${island.id} 需要 ${island.unlockAt} 星，但此前最多只能拿到 ${reachableStars} 星，永远无法解锁`);
  }
  reachableStars += (island.levels || []).length * 3;
});

/* ---------- 贴纸可获得性：每张贴纸都必须至少作为一次关卡奖励出现 ---------- */
const rewarded = new Set(allLevels.map(x => x.lv.reward && x.lv.reward.sticker).filter(Boolean));
(d.stickers || []).forEach(s => {
  if (!rewarded.has(s.id)) E(`贴纸 ${s.id} 没有出现在任何关卡奖励里，孩子永远拿不到`);
});

/* ---------- 签到原因表必须与情绪一一对应 ---------- */
Object.keys(d.checkinReasons || {}).forEach(id => {
  if (!emotionIds.has(id)) E(`checkinReasons 存在未知情绪键: ${id}`);
});

/* ---------- 故事可达性 ---------- */
(d.stories || []).forEach(s => {
  const nodes = s.nodes || {};
  if (!nodes[s.start]) E(`故事 ${s.id} 的 start 节点不存在`);
  Object.keys(nodes).forEach(k => {
    const n = nodes[k];
    const ending = n.ending === true || !isArr(n.choices);
    if (!has(n, 'text')) E(`故事 ${s.id}/${k} 缺 text`);
    if (!FACES.includes(n.emotion)) W(`故事 ${s.id}/${k} emotion 非法: ${n.emotion}`);
    if (!ending) n.choices.forEach(c => {
      if (!has(c, 'text')) E(`故事 ${s.id}/${k} 选项缺 text`);
      if (!nodes[c.next]) E(`故事 ${s.id}/${k} 死链 -> ${c.next}`);
      if (c.effect && !ISLAND_IDS.includes(c.effect.skill)) E(`故事 ${s.id}/${k} effect.skill 非法`);
    });
    else if (!has(n, 'moral')) W(`故事 ${s.id}/${k} 结局缺 moral`);
  });
  /* 从 start 做一次可达性遍历 */
  const seen = new Set(), q = [s.start];
  while (q.length) {
    const k = q.shift();
    if (seen.has(k) || !nodes[k]) continue;
    seen.add(k);
    (nodes[k].choices || []).forEach(c => q.push(c.next));
  }
  const unreachable = Object.keys(nodes).filter(k => !seen.has(k));
  if (unreachable.length) E(`故事 ${s.id} 有不可达节点: ${unreachable.join(', ')}`);
});

/* ---------- 文案否定词抽查 ---------- */
const badRe = /答错|你错了|做错了|不对|真笨|好笨|不许哭|生气是坏|不许生气|太差了/;
const badHits = [];
function walkText(v, loc) {
  if (typeof v === 'string') { if (badRe.test(v)) badHits.push(loc + ': ' + v.slice(0, 70)); }
  else if (Array.isArray(v)) v.forEach((x, i) => walkText(x, loc + '[' + i + ']'));
  else if (v && typeof v === 'object') Object.keys(v).forEach(k => walkText(v[k], loc + '.' + k));
}
walkText(d, 'SEL_DATA');
badHits.slice(0, 12).forEach(h => W('疑似否定式文案 → ' + h));
if (badHits.length > 12) W('另有 ' + (badHits.length - 12) + ' 条类似命中');

/* ---------- 本地资源 / 离线检查 ---------- */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
refs.forEach(r => {
  if (/^(https?:)?\/\//.test(r)) E('index.html 引用了外部资源: ' + r);
  else if (/^(data:|#)/.test(r)) { /* 内联图标与锚点，不产生请求 */ }
  else if (!fs.existsSync(path.join(root, r))) E('index.html 引用的本地文件不存在: ' + r);
});

/* ---------- 版本一致性：package.json / 页面 meta / CHANGELOG 最新条目 ---------- */
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const metaVersion = (html.match(/<meta name="app-version" content="([^"]+)"/) || [])[1];
const changelogLatest = (fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
  .match(/^##\s+\[([0-9]+\.[0-9]+\.[0-9]+)\]/m) || [])[1];
if (!pkg.version) E('package.json 缺少 version');
if (metaVersion !== pkg.version) E(`index.html 的 app-version (${metaVersion || '缺失'}) 与 package.json (${pkg.version}) 不一致`);
if (changelogLatest !== pkg.version) E(`CHANGELOG 最新条目 (${changelogLatest || '缺失'}) 与 package.json (${pkg.version}) 不一致`);
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
if (lock.version !== pkg.version || (lock.packages && lock.packages[''] && lock.packages[''].version !== pkg.version)) {
  E(`package-lock.json 版本 (${lock.version}) 与 package.json (${pkg.version}) 不一致`);
}
const winIcon = pkg.build && pkg.build.win && pkg.build.win.icon;
if (winIcon && !fs.existsSync(path.join(root, winIcon))) E('构建配置引用的应用图标不存在: ' + winIcon);
if (!/http-equiv="Content-Security-Policy"/i.test(html)) E('index.html 缺少 Content-Security-Policy，Electron 会告警');
else {
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/i) || [])[1] || '';
  if (/unsafe-eval/i.test(csp)) E('CSP 不应允许 unsafe-eval');
  if (/(?:^|;)\s*script-src[^;]*unsafe-inline/i.test(csp)) E('CSP 的 script-src 不应允许 unsafe-inline');
}

function listFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    // 只校验会被打进安装包的文件（与 package.json 的 build.files 对齐）。
    // 跳过依赖、产物、工具脚本，以及含赞助/仓库链接的项目元数据（非运行时外网请求）。
    if (['node_modules', 'dist', '.git', 'tools', '.workbuddy'].includes(e.name)) continue;
    if (e.name === 'package.json' || e.name === 'package-lock.json') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, out);
    else if (/\.(js|mjs|css|html|json)$/.test(e.name)) out.push(p);
  }
  return out;
}
const urlRe = /https?:\/\/[^\s"'<>)]+/g;
let external = 0;
listFiles(root).forEach(f => {
  const txt = fs.readFileSync(f, 'utf8');
  for (const m of txt.matchAll(urlRe)) {
    if (/w3\.org/.test(m[0]) || /localhost/i.test(m[0])) continue; // SVG 命名空间 & 本地服务地址，非外网请求
    E('存在外部 URL: ' + path.relative(root, f) + ' → ' + m[0].slice(0, 90));
    external++;
  }
});
if (/<script[^>]+src="https?:/.test(html)) E('index.html 有外部 script');

/* ---------- 报告 ---------- */
console.log('=== 心晴岛 静态校验 ===');
console.log(`岛屿 ${d.islands.length} · 关卡 ${allLevels.length} · 故事 ${d.stories.length} · 情绪 ${d.emotions.length} · 策略 ${d.strategies.length} · 贴纸 ${d.stickers.length}`);
console.log('题型分布:', Object.entries(typeCount).map(([k, v]) => `${k}×${v}`).join('  '));
console.log('本地脚本引用:', refs.length, '· 外部 URL:', external);
if (warns.length) { console.log(`\n--- 提醒 (${warns.length}) ---`); warns.forEach(w => console.log('  ! ' + w)); }
if (errors.length) { console.log(`\n--- 错误 (${errors.length}) ---`); errors.forEach(e => console.log('  x ' + e)); }
else console.log('\n✅ 数据契约、引用完整性、离线资源全部通过');
process.exit(errors.length ? 1 : 0);
