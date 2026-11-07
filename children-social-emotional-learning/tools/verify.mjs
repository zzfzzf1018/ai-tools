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

/* ---------- 主键唯一性：重复 id 会让存档、贴纸、跳转静默串档 ---------- */
const dupes = (list, key, label) => {
  const seen = new Set(), dup = new Set();
  (list || []).forEach(x => {
    const v = x && x[key];
    if (v === undefined || v === null || v === '') return;
    if (seen.has(v)) dup.add(v); else seen.add(v);
  });
  if (dup.size) E(`${label} 存在重复 id: ${[...dup].join(', ')}`);
};
dupes(d.emotions, 'id', 'emotions');
dupes(d.strategies, 'id', 'strategies');
dupes(d.islands, 'id', 'islands');
dupes(d.stickers, 'id', 'stickers');
dupes(d.stories, 'id', 'stories');

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

/* ---------- 最低星路径：孩子一路选非最优 / 呼吸中途停止，会不会被卡住 ---------- */
const MIN_STARS = { choice: 2, match: 2, order: 2, slider: 3, breathe: 1, story: 3, classify: 2 };
let minStars = 0;
(d.islands || []).forEach(island => {
  if (typeof island.unlockAt === 'number' && island.unlockAt > minStars) {
    W(`岛屿 ${island.id} 需 ${island.unlockAt} 星，一路拿最低星只攒到 ${minStars} 星，孩子得重玩前面的关卡补星才能继续`);
  }
  (island.levels || []).forEach(lv => { minStars += MIN_STARS[lv.type] || 2; });
});

/* ---------- 贴纸可获得性：关卡奖励 或 「说一说」开口里程碑 ---------- */
const rewarded = new Set(allLevels.map(x => x.lv.reward && x.lv.reward.sticker).filter(Boolean));
const badgeIds = new Set(((d.expression || {}).badges || []).map(b => b.id));
(d.stickers || []).forEach(s => {
  if (!rewarded.has(s.id) && !badgeIds.has(s.id)) {
    E(`贴纸 ${s.id} 既不是关卡奖励、也不是「说一说」里程碑，孩子永远拿不到`);
  }
});

/* ---------- 说一说 · 勇气小话筒：数据契约 ---------- */
const ex = d.expression;
if (!ex || typeof ex !== 'object') E('expression 缺失');
else {
  if (!isArr(ex.frames) || ex.frames.length < 3) E('expression.frames 需要 3 个句式');
  if (!isArr(ex.prompts) || ex.prompts.length < 8) E('expression.prompts 至少 8 张情境卡');
  if (!isArr(ex.cheers) || ex.cheers.length < 4) E('expression.cheers 至少 4 句鼓励语');
  if (!isArr(ex.audiences) || ex.audiences.length < 2) E('expression.audiences 缺失');
  if (!isArr(ex.badges) || !ex.badges.length) E('expression.badges 缺失');
  const cap = Number(ex.dailyStarCap);
  if (!(Number.isInteger(cap) && cap >= 1 && cap <= 10)) E('expression.dailyStarCap 需为 1–10 的整数');
  dupes(ex.frames, 'id', 'expression.frames');
  dupes(ex.prompts, 'id', 'expression.prompts');
  dupes(ex.badges, 'id', 'expression.badges');
  const frameIds = new Set((ex.frames || []).map(f => f.id));
  (ex.frames || []).forEach(f => {
    ['id', 'label', 'hint', 'example', 'emoji'].forEach(k => { if (!has(f, k)) E(`expression.frames ${f.id} 缺 ${k}`); });
  });
  (ex.prompts || []).forEach(p => {
    ['id', 'scene', 'who', 'demo', 'feeling', 'emoji'].forEach(k => { if (!has(p, k)) E(`expression.prompts ${p.id} 缺 ${k}`); });
    if (p.frame && !frameIds.has(p.frame)) E(`expression.prompts ${p.id} 指向未知句式 ${p.frame}`);
    if (!/我觉得/.test(p.demo) || !/因为/.test(p.demo) || !/我希望/.test(p.demo)) {
      W(`expression.prompts ${p.id} 的示范句没有完整覆盖「我觉得…因为…我希望…」`);
    }
  });
  const levelIds = new Set(allLevels.map(x => x.lv.id));
  const lp = ex.levelPrompts || {};
  allLevels.forEach(({ lv }) => {
    const t = lp[lv.id];
    if (!t || !has(t, 'scene') || !has(t, 'demo') || !has(t, 'who')) {
      E(`expression.levelPrompts 缺少关卡 ${lv.id} 的说一说话题`);
    } else if (!/我觉得/.test(t.demo)) W(`levelPrompts.${lv.id} 示范句没有以「我觉得」开头`);
  });
  Object.keys(lp).forEach(k => { if (!levelIds.has(k)) E(`expression.levelPrompts 存在未知关卡 ${k}`); });
  (ex.badges || []).forEach(b => {
    if (!stickerIds.has(b.id)) E(`expression.badges ${b.id} 没有对应的贴纸`);
    if (!(Number.isInteger(b.at) && b.at >= 1 && b.at <= 100)) E(`expression.badges ${b.id} 的 at 非法`);
  });
}

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
      if (c.effect) {
        const d = c.effect.delta;
        if (!(typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 3)) {
          W(`故事 ${s.id}/${k} effect.delta 应是 1–3 的整数，当前为 ${d}`);
        }
      }
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
if (!pkg.main || !fs.existsSync(path.join(root, pkg.main))) E('package.json 的 main 入口不存在: ' + pkg.main);
if (!(pkg.build && Array.isArray(pkg.build.files) && pkg.build.files.includes('index.html') && pkg.build.files.includes('src/**/*'))) {
  E('build.files 没有包含 index.html 与 src/**/*，打包后会缺少运行文件');
}

/* ---------- PWA：manifest / Service Worker / 图标 ---------- */
const manifestPath = path.join(root, 'manifest.webmanifest');
if (!fs.existsSync(manifestPath)) E('缺少 manifest.webmanifest，Web 版无法安装到桌面');
else {
  let mf = null;
  try { mf = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { E('manifest.webmanifest 不是合法 JSON'); }
  if (mf) {
    ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color'].forEach(k => {
      if (!has(mf, k)) E('manifest 缺少字段: ' + k);
    });
    if (mf.display !== 'standalone') E('manifest.display 应为 standalone，否则装到桌面后仍带浏览器地址栏');
    if (!Array.isArray(mf.icons) || !mf.icons.length) E('manifest 没有图标');
    (mf.icons || []).forEach((ic, i) => {
      if (!ic || !ic.src) { E('manifest 图标 ' + i + ' 缺 src'); return; }
      if (/^(https?:)?\/\//.test(ic.src)) E('manifest 图标不能引用外部地址: ' + ic.src);
      const p = path.join(root, ic.src);
      if (!fs.existsSync(p)) E('manifest 引用的图标不存在: ' + ic.src);
      else if (!/^\d+x\d+$/.test(String(ic.sizes || ''))) E('manifest 图标 sizes 非法: ' + ic.sizes);
    });
  }
}
if (!/rel="manifest"/.test(html)) E('index.html 没有声明 manifest，浏览器不会提示安装');
const cspForPwa = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/i) || [])[1] || '';
if (!/manifest-src\s+'self'/.test(cspForPwa)) E('CSP 缺少 manifest-src，PWA 清单会被拦截');
if (!/worker-src\s+'self'/.test(cspForPwa)) E('CSP 缺少 worker-src，Service Worker 无法注册');

/* ---------- 朗读链路：入口、脚本清单、离线安全 ---------- */
const audioSrc = fs.readFileSync(path.join(root, 'src/core/audio.js'), 'utf8');
['speakSequence', 'readQuestion', 'readAuto', 'stopSpeak', 'voiceRate'].forEach(k => {
  if (!audioSrc.includes(k)) E('audio.js 缺少朗读队列能力: ' + k);
});
const gamesSrc = fs.readFileSync(path.join(root, 'src/ui/games.js'), 'utf8');
['readScript', 'voiceBarHtml', 'startReading'].forEach(k => {
  if (!gamesSrc.includes(k)) E('games.js 缺少全关卡朗读能力: ' + k);
});
const htmlScripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const swForScripts = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
htmlScripts.forEach(s => {
  if (!fs.existsSync(path.join(root, s))) E('index.html 引用的脚本不存在: ' + s);
  if (!swForScripts.includes("'./" + s + "'")) E('sw.js 没有预缓存页面脚本 ' + s + '，装到桌面后离线会缺文件');
});
if (!/media-src\s+'none'/.test(cspForPwa)) E('CSP 应继续禁止媒体源：说一说不录音、不申请麦克风');
if (!/connect-src\s+'none'/.test(cspForPwa)) E('CSP 应继续禁止外部连接（完全离线承诺）');
['choice', 'match', 'order', 'slider', 'breathe', 'story', 'classify'].forEach(t => {
  if (!new RegExp("case '" + t + "'").test(gamesSrc)) E('readScript 漏了题型: ' + t);
});
if (!/shuffled\.every/.test(gamesSrc)) E('排序题朗读缺少「打乱后恰好等于答案」的保护，会泄露答案');
const stateSrc = fs.readFileSync(path.join(root, 'src/core/state.js'), 'utf8');
const exprSrc = fs.readFileSync(path.join(root, 'src/ui/expression.js'), 'utf8');
if (!/function dailyCap\(\)/.test(stateSrc)) E('state.js 缺少统一的每日勇气星上限函数');
if (/intIn\(ts\.count,\s*0,\s*3,/.test(stateSrc)) E('导入清洗把每日星星计数写死夹到 3，与可配置上限不一致');
if (/todayStars\s*\+\s*'\/3'/.test(exprSrc)) E('统计条把每日星星上限写死成 3');
if (!/function fixedTopic\(/.test(exprSrc)) E('说一说独立页缺少可指定情境卡的能力（视觉基线需要确定性）');
const visualSrc = fs.readFileSync(path.join(root, 'tools/visual.cjs'), 'utf8');
if (!/#\/express\/ex-1/.test(visualSrc)) E('视觉基线没有覆盖说一说独立页');
if (!/p\.settings\.autoRead\s*=\s*false/.test(visualSrc)) E('视觉基线未关闭自动读题，播报条文案会随语音状态漂移');
const swPath = path.join(root, 'sw.js');
if (!fs.existsSync(swPath)) E('缺少 sw.js，Web 版无法离线启动');
else {
  const sw = fs.readFileSync(swPath, 'utf8');
  const cacheVer = (sw.match(/var CACHE = 'sunny-isles-([^']+)'/) || [])[1];
  if (!cacheVer) E('sw.js 缺少可识别的 CACHE 版本号');
  else if (cacheVer !== pkg.version) E(`sw.js 的缓存版本 (${cacheVer}) 与 package.json (${pkg.version}) 不一致，升级后会继续用旧资源`);
  const assets = [...sw.matchAll(/'(\.\/[^']*)'/g)].map(m => m[1]);
  if (assets.length < 10) E('sw.js 预缓存列表过短，可能漏掉脚本');
  assets.forEach(a => {
    const rel = a.replace(/^\.\//, '') || 'index.html';
    if (!fs.existsSync(path.join(root, rel))) E('sw.js 预缓存了不存在的文件: ' + a);
  });
  ['index.html', 'src/styles.css', 'src/main.js', 'src/core/state.js', 'icons/icon-192.png'].forEach(k => {
    if (!sw.includes(k)) E('sw.js 预缓存列表缺少关键文件: ' + k);
  });
}
if (!(pkg.build && Array.isArray(pkg.build.files) && pkg.build.files.includes('manifest.webmanifest') && pkg.build.files.includes('sw.js') && pkg.build.files.includes('icons/**/*'))) {
  E('build.files 没有包含 manifest.webmanifest / sw.js / icons，桌面版会缺少 PWA 资源');
}
// Web 发布包（release.cjs 的 Compress-Archive 清单）同样必须带上 PWA 三件套，
// 否则用户下到的 zip 能打开、却装不了也离线不了。
const releaseSrc = fs.readFileSync(path.join(root, 'scripts/release.cjs'), 'utf8');
['manifest.webmanifest', 'sw.js', "'icons'"].forEach(k => {
  if (!releaseSrc.includes(k)) E('release.cjs 的 Web 打包清单缺少 ' + k.replace(/'/g, '') + '，发布出的 web.zip 会没有 PWA 能力');
});
/* 封板时人工打 tag 并推送是常见操作；prepare 必须能复用指向同一提交的 tag */
if (!/taggedSha/.test(releaseSrc)) {
  W('release.cjs 的 prepare 缺少「同名 tag 已存在且指向本次提交」的幂等处理，人工打 tag 会让 CI 发布失败');
}
// 预览服务必须给 .webmanifest 正确的 MIME，否则 Chrome 不认安装清单
const serveMimeSrc = fs.readFileSync(path.join(root, 'desktop/serve.mjs'), 'utf8');
if (!/\.webmanifest'\s*:\s*'application\/manifest\+json/.test(serveMimeSrc)) {
  E("desktop/serve.mjs 没有为 .webmanifest 配置 application/manifest+json");
}

/* ---------- Electron 安全基线：这些开关一旦被改掉，儿童安全承诺就失效了 ---------- */
const mainSrc = fs.readFileSync(path.join(root, 'desktop/main.js'), 'utf8');
const security = [
  ['nodeIntegration: false', /nodeIntegration\s*:\s*false/, '页面能访问 Node'],
  ['contextIsolation: true', /contextIsolation\s*:\s*true/, '页面与预加载上下文未隔离'],
  ['sandbox: true', /sandbox\s*:\s*true/, '渲染进程未开启沙箱'],
  ['spellcheck: false', /spellcheck\s*:\s*false/, '拼写检查可能触发在线词典下载，破坏完全离线承诺'],
  ['setWindowOpenHandler -> deny', /setWindowOpenHandler\s*\(\s*\(\)\s*=>\s*\(\{\s*action\s*:\s*'deny'/, '未禁止新窗口/弹窗'],
  ['will-navigate', /will-navigate/, '未拦截外部导航'],
  ['will-attach-webview', /will-attach-webview/, '未阻止 <webview> 挂载'],
  ['setPermissionRequestHandler', /setPermissionRequestHandler/, '未统一拒绝摄像头/麦克风等权限申请'],
];
security.forEach(([label, re, why]) => { if (!re.test(mainSrc)) E(`Electron 安全基线缺失（${why}）：main.js 未见 ${label}`); });
/* 开发预览服务会按路径开放整个项目目录，必须只监听本机回环地址 */
const serveSrc = fs.readFileSync(path.join(root, 'desktop/serve.mjs'), 'utf8');
if (!/server\.listen\(\s*PORT\s*,\s*HOST\s*,/.test(serveSrc) || !/127\.0\.0\.1/.test(serveSrc)) {
  E('desktop/serve.mjs 未绑定 127.0.0.1，局域网内其他设备可读取整个项目目录');
}
if (!(pkg.build && Array.isArray(pkg.build.files) && pkg.build.files.includes('!desktop/serve.mjs'))) {
  W('构建白名单未排除 desktop/serve.mjs，便携版会附带开发服务器');
}
if (!/http-equiv="Content-Security-Policy"/i.test(html)) E('index.html 缺少 Content-Security-Policy，Electron 会告警');
else {
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/i) || [])[1] || '';
  if (/unsafe-eval/i.test(csp)) E('CSP 不应允许 unsafe-eval');
  if (/(?:^|;)\s*script-src[^;]*unsafe-inline/i.test(csp)) E('CSP 的 script-src 不应允许 unsafe-inline');
}
/* 样式表最基本的结构检查：删错一行很容易把 @keyframes 的头丢掉，浏览器会静默失效 */
const cssSrc = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const openBraces = (cssSrc.match(/{/g) || []).length;
const closeBraces = (cssSrc.match(/}/g) || []).length;
if (openBraces !== closeBraces) E(`styles.css 花括号不配对（{ ${openBraces} 个 / } ${closeBraces} 个）`);
if (/@keyframes\s*\{/.test(cssSrc)) E('styles.css 存在没有名字的 @keyframes');

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
