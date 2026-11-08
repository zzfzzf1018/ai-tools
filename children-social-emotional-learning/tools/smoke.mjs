/* 心晴岛 · 运行时冒烟测试（jsdom）。运行：node tools/smoke.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [], runtimeErrors = [];

const vc = new VirtualConsole();
vc.on('jsdomError', e => runtimeErrors.push('jsdomError: ' + (e.message || e)));
vc.on('error', (...a) => runtimeErrors.push('console.error: ' + a.join(' ')));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'http://localhost/sunny-isles/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc
});
const w = dom.window;
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {};
try { w.localStorage.setItem('sunny-isles-welcomed-v1', '1'); } catch (e) {}
try { w.sessionStorage.setItem('sunny-parent-ok', '1'); } catch (e) {}

/* v1.2.0：模拟系统中文语音。默认同步结束，让朗读队列一次跑完；
   第 28 组会临时关掉同步结束，用来验证「停掉后旧 utterance 不再推进队列」。 */
let syncEnd = true;
const utterances = [];
let cancelCount = 0;
function MockUtterance(text) {
  this.text = String(text);
  this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1;
  this.onend = null; this.onerror = null; this.onstart = null;
}
Object.defineProperty(w, 'SpeechSynthesisUtterance', { value: MockUtterance, configurable: true, writable: true });
Object.defineProperty(w, 'speechSynthesis', {
  configurable: true,
  value: {
    getVoices: () => [],
    addEventListener: (name, fn) => { if (name === 'voiceschanged') w.__voicesChanged = fn; },
    removeEventListener: () => {},
    cancel: () => { cancelCount++; },
    speak: (u) => {
      utterances.push(u);
      if (syncEnd && u.onend) u.onend();
    }
  }
});

/* 与 index.html 保持同一加载顺序 */
const scripts = [
  'src/data/curriculum.js', 'src/core/utils.js', 'src/core/audio.js', 'src/core/state.js',
  'src/core/screentime.js', 'src/ui/art.js', 'src/ui/components.js', 'src/ui/calm.js',
  'src/ui/games.js', 'src/ui/expression.js', 'src/ui/screens.js', 'src/main.js'
];
for (const f of scripts) {
  try { w.eval(fs.readFileSync(path.join(root, f), 'utf8')); }
  catch (e) { fails.push('脚本执行失败 ' + f + ': ' + e.message); }
}

function click(el) {
  if (!el) throw new Error('找不到要点击的元素');
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function q(sel) { return w.document.querySelector(sel); }
function qa(sel) { return [...w.document.querySelectorAll(sel)]; }
function must(cond, msg) { if (!cond) fails.push(msg); }

function route(hash, label) {
  try {
    w.location.hash = hash;
    w.SEL.render();
    const s = q('#screen');
    const t = s ? s.innerHTML : '';
    if (!t || t.length < 80) fails.push(`${label || hash} 页面空白`);
    if (t.includes('这一页遇到一点小云朵')) fails.push(`${label || hash} 渲染抛错`);
    /* main.js 捕获 mount 异常时插入的是这句提示，不是「交互绑定出错」（那只在 console.error 里） */
    if (t.includes('这一页的小按钮需要重新加载一下')) fails.push(`${label || hash} 事件绑定抛错`);
    return t;
  } catch (e) { fails.push(`${label || hash} 异常: ${e.message}`); return ''; }
}

try {
  /* --- 1. 所有页面 --- */
  const pages = [
    '#/home', '#/map', '#/emotions', '#/checkin', '#/strategies',
    '#/garden', '#/stickers', '#/report', '#/parent', '#/profile', '#/settings', '#/help'
  ];
  pages.forEach(h => route(h));
  const helpHtml = route('#/help');
  must(helpHtml.includes((w.SEL_DATA.islands || []).length + ' 座小岛 ' + w.SEL.state.allLevels().length + ' 关'),
    '玩法说明页的小岛/关卡数量与数据不一致');
  const islands = (w.SEL_DATA.islands || []);
  islands.forEach(i => route('#/island/' + i.id, '岛屿 ' + i.id));

  /* --- 2. 未解锁的岛 / 关卡不能被 hash 直接绕过 --- */
  const lockedLevel = 'de-1';
  route('#/level/' + lockedLevel);
  must(!q('.game-card'), '未解锁关卡 ' + lockedLevel + ' 仍能进入游戏');
  must((q('#screen').textContent || '').includes('还没开门'), '未解锁关卡没有给出友好的锁定提示');
  route('#/island/decision');
  must(!q('.level-card'), '未解锁岛屿仍展示了关卡列表');

  /* --- 3. 每日签到完整 4 步 + 落库 --- */
  const before = w.SEL.state.current().checkins.length;
  route('#/checkin');
  click(q('[data-pick="0"]'));
  must(!!q('[data-next]'), '签到第 1 步后没有下一步按钮');
  click(q('[data-next]'));
  must(!!q('[data-range]'), '签到第 2 步缺强度滑块');
  const firstReason = q('[data-reason]');
  click(firstReason);
  const staleReason = firstReason.textContent;
  click(q('[data-next]'));
  must(!!q('[data-practice]'), '签到第 3 步缺策略练习入口');
  click(q('[data-next]'));
  must(!!q('[data-plant]'), '签到第 4 步缺种花按钮');
  must(!!q('[data-note]'), '签到第 4 步缺自由备注输入');
  q('[data-note]').value = '今天和小伙伴搭了积木';
  q('[data-note]').dispatchEvent(new w.Event('input', { bubbles: true }));
  click(q('[data-plant]'));
  const after = w.SEL.state.current().checkins.length;
  must(after === before + 1, `签到未写入存档: ${before} -> ${after}`);
  must(w.SEL.state.current().checkins[after - 1].note === '今天和小伙伴搭了积木', '签到备注没有写入存档');
  must(!!q('.modal'), '签到完成弹窗未出现');
  w.SEL.ui.closeModal();

  /* --- 4. 换情绪后，上一种情绪的原因不能残留 --- */
  route('#/checkin');
  click(q('[data-pick="0"]'));
  click(q('[data-next]'));
  click(q('[data-reason]'));
  click(q('[data-back]'));
  click(q('[data-pick="2"]'));   // 改选「生气」
  click(q('[data-next]'));
  click(q('[data-next]'));
  click(q('[data-next]'));
  const step4 = q('[data-checkin-body]').textContent || '';
  must(!step4.includes(staleReason), '切换情绪后仍带着上一种情绪的原因：' + staleReason);
  must(!!q('[data-plant]'), '换情绪后签到第 4 步缺种花按钮');

  /* --- 5. 解锁全部关卡，供后续玩法测试 --- */
  const all = [];
  islands.forEach(i => i.levels.forEach(l => all.push({ island: i, lv: l })));
  w.SEL.state.update(p => {
    p.stars = 999;
    all.forEach(({ lv }) => { p.levels[lv.id] = { done: true, stars: 3, attempts: 1, lastAt: '2026-01-01' }; });
  });
  all.forEach(({ lv }) => route('#/level/' + lv.id, '关卡 ' + lv.id));

  /* --- 6. 呼吸关：未开始不能领星；停下后必须能重新开始 --- */
  const breathe = all.find(x => x.lv.type === 'breathe');
  route('#/level/' + breathe.lv.id);
  click(q('[data-stop]'));
  must(!q('[data-finish]'), '呼吸关未开始就点「先停一下」也能直接领星');
  click(q('[data-start]'));
  must(q('[data-start]').disabled === true, '呼吸开始后开始按钮未禁用');
  click(q('[data-stop]'));
  must(!!q('[data-finish]'), '呼吸提前结束后没有完成按钮');
  must(q('[data-start]').disabled === false, '呼吸停下后开始按钮仍是禁用状态（无法重新开始）');
  click(q('[data-start]'));
  must(q('[data-start]').disabled === true, '呼吸停下后无法重新开始');
  must((q('[data-orb]').textContent || '').startsWith('吸气'), '重新开始后没有进入吸气阶段');
  click(q('[data-stop]'));

  /* --- 7. 情境选择：连点完成按钮只结算一次 --- */
  const choice = all.find(x => x.lv.type === 'choice');
  w.SEL.state.update(p => { delete p.levels[choice.lv.id]; });
  route('#/level/' + choice.lv.id);
  click(q('.option-btn'));
  must(!!q('.feedback-box'), '情境选择后没有即时反馈');
  must(!!q('[data-finish]'), '情境选择后没有完成按钮');
  const skillBefore = JSON.stringify(w.SEL.state.current().skills);
  click(q('[data-finish]'));
  const skillAfter1 = JSON.stringify(w.SEL.state.current().skills);
  must(q('[data-finish]').disabled === true, '结算后完成按钮没有锁住，误关弹窗再点会静默无反应');
  must((q('[data-finish]').textContent || '').includes('已收下星星'), '结算后完成按钮文案没有改成「已收下星星」');
  click(q('[data-finish]'));
  const skillAfter2 = JSON.stringify(w.SEL.state.current().skills);
  must(skillAfter1 !== skillBefore, '完成关卡后能力练习次数未增加');
  must(skillAfter1 === skillAfter2, '连点完成按钮导致能力练习次数重复累加');
  must(!!q('.modal'), '关卡完成弹窗未出现');
  must(!!q('[data-nav^="#/level/"]'), '完成后没有「下一关」入口');
  must((q('.modal').textContent || '').includes('新贴纸'), '首次完成关卡没有提示新贴纸');
  w.SEL.ui.closeModal();

  /* 重玩同一个关卡，不应该再提示「新贴纸」 */
  route('#/level/' + choice.lv.id);
  click(q('.option-btn'));
  click(q('[data-finish]'));
  must(!(q('.modal').textContent || '').includes('新贴纸'), '重玩已获得贴纸的关卡仍提示「新贴纸」');
  w.SEL.ui.closeModal();

  /* --- 8. 配对：逐对点击到全部完成 --- */
  const match = all.find(x => x.lv.type === 'match');
  route('#/level/' + match.lv.id);
  qa('.pair-item[data-side="L"]').forEach(l => {
    const key = l.getAttribute('data-key');
    click(l);
    click(q(`.pair-item[data-side="R"][data-key="${key}"]`));
  });
  must(!!q('[data-finish]'), '配对全部完成后没有完成按钮');

  /* --- 9. 排序：按正确答案重排 --- */
  const order = all.find(x => x.lv.type === 'order');
  route('#/level/' + order.lv.id);
  const list = q('[data-order-list]');
  order.lv.data.answer.forEach(id => {
    const el = qa('.order-item').find(x => x.getAttribute('data-id') === id);
    if (el) list.appendChild(el);
  });
  click(q('[data-check]'));
  must(!!q('[data-finish]'), '排序正确后没有完成按钮');
  const checkBtn = q('[data-check]');
  click(checkBtn);
  must(!!q('[data-finish]'), '排序成功后再点检查，完成按钮消失');

  /* --- 10. 分类：全部放好，且点击已放置卡片不应弹“先选一张卡片” --- */
  const classify = all.find(x => x.lv.type === 'classify');
  route('#/level/' + classify.lv.id);
  qa('.drag-item').forEach(item => {
    click(item);
    click(q(`.bucket[data-bucket-id="${item.getAttribute('data-bucket')}"]`));
  });
  must(!!q('[data-finish]'), '分类完成后没有完成按钮');
  const placed = q('.drag-item[data-placed]');
  if (placed) click(placed);
  must(!(q('.game-extra').textContent || '').includes('先选一张卡片'), '点击已放入篮子的卡片仍弹错误提示');

  /* --- 11. 滑块 / 故事 --- */
  const slider = all.find(x => x.lv.type === 'slider');
  route('#/level/' + slider.lv.id);
  click(q('[data-submit]'));
  must(!!q('[data-finish]'), '滑块提交后没有完成按钮');

  const story = all.find(x => x.lv.type === 'story');
  route('#/level/' + story.lv.id);
  for (let i = 0; i < 8 && !q('[data-finish]'); i++) {
    const opt = q('.option-btn:not([disabled])');
    if (!opt) break;
    click(opt);
    const go = q('[data-go]');
    if (go) click(go);
  }
  must(!!q('[data-finish]'), '故事走到结局后没有完成按钮');

  /* --- 12. 家长门：答错不放行，答对放行 --- */
  w.sessionStorage.removeItem('sunny-parent-ok');
  route('#/parent');
  must(!!q('.gate'), '家长门未出现');
  const expr = (q('.gate h3').textContent || '');
  const nums = expr.match(/(\d+)\s*\+\s*(\d+)/);
  if (!nums) fails.push('家长门算术题读取失败: ' + expr);
  else {
    const answer = Number(nums[1]) + Number(nums[2]);
    const input = q('[data-gate-input]');
    input.value = String(answer + 1);
    click(q('[data-gate-ok]'));
    must(!!q('.gate'), '家长门答错也放行了');
    input.value = String(answer);
    click(q('[data-gate-ok]'));
    must(!!q('.kpi-grid'), '家长门答对后未进入面板');
  }

  /* --- 13. 档案：新建 → 切换 → 删除 --- */
  route('#/profile');
  const profileCount = w.SEL.state.profiles().length;
  click(q('[data-avatar="fox"]'));
  must(q('[data-avatar="fox"]').classList.contains('active'), '头像选择无响应');
  q('[data-new-name]').value = '小测试';
  click(q('[data-create]'));
  must(w.SEL.state.profiles().length === profileCount + 1, '新建档案未写入');
  must(w.SEL.state.current().name === '小测试', '新建档案未切换为当前档案');
  click(q('[data-del-profile]'));
  must(!!q('[data-modal-act="yes"]'), '删除档案没有二次确认');
  click(q('[data-modal-act="yes"]'));
  must(w.SEL.state.profiles().length === profileCount, '删除档案未生效');

  /* --- 13b. 档案上限：一台电脑最多 12 个 --- */
  const baseIds = w.SEL.state.profiles().map(p => p.id);
  while (w.SEL.state.profiles().length < 12) {
    q('[data-new-name]').value = '小玩家';
    click(q('[data-create]'));
  }
  const atCap = w.SEL.state.profiles().length;
  q('[data-new-name]').value = '第十三个';
  click(q('[data-create]'));
  must(atCap === 12, '档案上限没有生效（应停在 12 个）');
  must(w.SEL.state.profiles().length === atCap, '超过 12 个后仍写入了新档案');
  w.SEL.state.profiles().filter(p => baseIds.indexOf(p.id) < 0)
    .forEach(p => w.SEL.state.removeProfile(p.id));
  must(w.SEL.state.profiles().length === profileCount, '档案上限测试后未能还原档案列表');
  w.SEL.render();

  /* --- 14. 设置开关 + 减少动效 --- */
  route('#/settings');
  const voiceBefore = w.SEL.state.current().settings.voice;
  click(q('[data-toggle="voice"]'));
  must(w.SEL.state.current().settings.voice !== voiceBefore, '设置开关未生效');
  click(q('[data-toggle="reduceMotion"]'));
  must(w.document.body.classList.contains('reduce-motion'), '减少动效开关未作用到页面');
  click(q('[data-toggle="reduceMotion"]'));

  /* --- 15. 存档：坏备份不能清空现有数据，残缺档案要能修好 --- */
  const snapshot = w.SEL.state.exportSave();
  let rejected = false;
  try { w.SEL.state.importSave('{}'); } catch (e) { rejected = true; }
  must(rejected, '导入空 JSON 未被拒绝');
  must(w.SEL.state.exportSave() === snapshot, '导入非法备份后现有存档被改动');
  w.SEL.state.importSave(JSON.stringify({
    profiles: [{ name: '测试娃', checkins: [null, { date: 'bad' }, { date: '2026-11-04', emotion: 'happy', intensity: 'x' }] }]
  }));
  must(w.SEL.state.current().name === '测试娃', '残缺档案未能恢复出可用档案');
  must(w.SEL.state.current().checkins.length === 1, '残缺签到记录未被清洗');
  must(w.SEL.state.current().checkins[0].intensity === 3, '非法签到强度未被修正为默认值');
  route('#/garden');
  route('#/parent');
  w.SEL.state.importSave(snapshot);

  /* --- 16. 花园 / 贴纸 / 工具箱 --- */
  route('#/garden');
  const flower = q('[data-flower]');
  if (flower) {
    click(flower);
    must(!!q('.modal'), '点击心情花没有打开详情');
    must((q('.modal').textContent || '').includes('今天和小伙伴搭了积木'), '花朵详情没有显示签到备注');
    w.SEL.ui.closeModal();
  }
  else fails.push('签到后花园里没有花');
  route('#/stickers');
  must(qa('.sticker-card').length === (w.SEL_DATA.stickers || []).length, '贴纸册数量与数据不一致');
  route('#/strategies');
  click(q('[data-practice]'));
  must(!!q('.modal'), '工具箱练习弹窗未打开');
  const startPractice = q('[data-modal-act="start"]');
  if (startPractice) click(startPractice);
  w.SEL.ui.closeModal();

  /* --- 17. 顶栏导航 --- */
  route('#/home');
  click(q('.brand'));
  must(!!q('#topbar'), '顶栏导航后顶栏消失');
  click(q('#topbar [data-nav="#/profile"]'));
  w.SEL.render();   // jsdom 的 hashchange 是异步派发，这里手动触发一次等价的渲染
  must((q('#screen').textContent || '').includes('小玩家档案'), '顶栏档案入口没有跳到档案页');

  /* --- 18. 发布后复查回归 --- */
  // 18a 弹窗焦点：打开移入、关闭还原
  route('#/strategies');
  const beforeFocus = w.document.activeElement;
  click(q('[data-practice]'));
  must(w.document.getElementById('overlay').contains(w.document.activeElement), '弹窗打开后焦点没有移入弹窗');
  w.SEL.ui.closeModal();
  must(w.document.activeElement === beforeFocus, '弹窗关闭后焦点没有还给原来的元素');

  // 18b 数量由数据驱动 + 文案不再承诺不存在的奖励
  const homeHtml = route('#/home');
  must(homeHtml.includes((w.SEL_DATA.islands || []).length + ' 座小岛'), '首页小岛数量没有从数据读取');
  must(homeHtml.includes((w.SEL_DATA.strategies || []).length + ' 个随时能用的小方法'), '首页方法数量没有从数据读取');
  must(!route('#/help').includes('小惊喜'), '玩法说明仍在承诺不存在的连续签到奖励');
  route('#/strategies');
  click(q('[data-practice]'));
  must(!(q('#overlay').textContent || '').includes('练过一点点也算数'), '练习弹窗文案与实际计次行为不一致');
  w.SEL.ui.closeModal();

  // 18c 坏档只备份一次，且主存档立刻修好（独立 window，避免污染主流程）
  {
    const dom2 = new JSDOM(html, {
      url: 'http://localhost/sunny-isles/', runScripts: 'outside-only',
      pretendToBeVisual: true, virtualConsole: vc
    });
    const w2 = dom2.window;
    w2.localStorage.setItem('sunny-isles-save-v1', '{坏档');
    for (let i = 0; i < 3; i++) {
      w2.eval(fs.readFileSync(path.join(root, 'src/data/curriculum.js'), 'utf8'));
      w2.eval(fs.readFileSync(path.join(root, 'src/core/utils.js'), 'utf8'));
      w2.eval(fs.readFileSync(path.join(root, 'src/core/state.js'), 'utf8'));
      w2.SEL.state.save();
    }
    const backupKeys = Object.keys(w2.localStorage).filter(k => k.startsWith('sunny-isles-save-v1-corrupt'));
    must(backupKeys.length === 1, '坏档每次启动都新生成一个备份 key（应固定为一个）');
    let repaired = null;
    try { repaired = JSON.parse(w2.localStorage.getItem('sunny-isles-save-v1')); } catch (e) {}
    must(!!(repaired && repaired.profiles && repaired.profiles.length), '坏档后主存档没有写回可用新档');
    w2.close();
  }

  // 18d 导入文本限长 + 超大备份拒绝
  const bare = () => ({ version: 1, activeId: 'p1', profiles: [{
    id: 'p1', name: '小玩家', avatar: 'cloud', checkins: [], flowers: [],
    levels: {}, stickers: [], skills: {}, strategyCount: {}, settings: {}
  }] });
  const longSave = bare();
  longSave.profiles[0].checkins.push({ date: '2026-11-05', emotion: 'happy', reason: '很'.repeat(200000) });
  w.SEL.state.importSave(JSON.stringify(longSave));
  must(w.SEL.state.current().checkins[0].reason.length <= 500, '导入的超长文本没有被截断');
  let tooBig = false;
  try { w.SEL.state.importSave('x'.repeat(5 * 1024 * 1024 + 1)); } catch (e) { tooBig = true; }
  must(tooBig, '超过 5MB 的备份文件没有被拒绝');

  // 18e 花园达到上限时如实提示
  const capSave = bare();
  for (let i = 0; i < 400; i++) {
    capSave.profiles[0].flowers.push({ id: 'f' + i, date: '2026-11-05', emotion: 'happy', color: '#FFC94A', petal: 1 });
  }
  w.SEL.state.importSave(JSON.stringify(capSave));
  must(w.SEL.state.current().flowers.length === 365, '心情花上限不是 365 朵');
  const gardenTxt = route('#/garden');
  must(gardenTxt.includes('最近 365 朵'), '花园达到上限时没有写明「最近 N 朵」');
  must(gardenTxt.includes('自动收进档案盒'), '花园达到上限时没有说明更早的花会被归档');

  // 18f 溢出记录自动归档：导出/导入保留，清空进度一并清掉
  const arcSave = bare();
  for (let i = 0; i < 402; i++) {
    arcSave.profiles[0].checkins.push({ date: '2026-11-05', emotion: 'happy', note: 'n' + i });
  }
  w.SEL.state.importSave(JSON.stringify(arcSave));
  const curId = w.SEL.state.current().id;
  const arcOf = () => (w.SEL.state.save().archive || {})[curId] || null;
  must(w.SEL.state.current().checkins.length === 400, '签到展示上限不是 400 条');
  must(!!arcOf() && arcOf().checkins.length === 2, '溢出签到没有被移入归档');
  must(arcOf() && arcOf().checkins[0].note === 'n0', '归档没有保留最早的记录');
  w.SEL.state.importSave(w.SEL.state.exportSave());
  must(!!arcOf() && arcOf().checkins.length === 2, '导出/导入后归档丢失');
  must((route('#/parent') || '').includes('已自动归档'), '家长面板没有提示归档记录');
  w.SEL.state.resetProfile(curId);
  must(!arcOf(), '清空进度后归档仍然存在');

  /* --- 19. 故事：能力点只在「继续故事」时结算，重玩不重复累加 --- */
  const story2 = all.find(x => x.lv.type === 'story');
  const sumSkills = () => Object.values(w.SEL.state.current().skills).reduce((a, b) => a + b, 0);
  const storyData = (w.SEL_DATA.stories || []).find(s => s.id === story2.lv.data.storyId);
  const startNode = storyData.nodes[storyData.start];
  const firstChoice = startNode.choices[0];
  const firstDelta = firstChoice.effect && firstChoice.effect.skill ? (firstChoice.effect.delta || 1) : 0;
  w.SEL.state.update(p => {
    p.stars = 999;
    all.forEach(({ lv }) => {
      if (lv.id !== story2.lv.id) p.levels[lv.id] = { done: true, stars: 3, attempts: 1, lastAt: '2026-01-01' };
    });
    delete p.levels[story2.lv.id];
  });
  route('#/level/' + story2.lv.id);
  const skillAtOpen = sumSkills();
  click(q('.option-btn'));
  must(sumSkills() === skillAtOpen, '只点开故事选项、还没继续，就把能力点写进了存档');
  click(q('[data-go]'));
  must(sumSkills() === skillAtOpen + firstDelta, `点「继续故事」后能力点结算不对（应为 +${firstDelta}）`);
  for (let i = 0; i < 8 && !q('[data-finish]'); i++) {
    const opt = q('.option-btn:not([disabled])');
    if (!opt) break;
    click(opt);
    const go = q('[data-go]');
    if (go) click(go);
  }
  must(!!q('[data-finish]'), '故事（首次）走到结局后没有完成按钮');
  click(q('[data-finish]'));
  w.SEL.ui.closeModal();
  route('#/level/' + story2.lv.id);
  const replaySkill = sumSkills();
  for (let i = 0; i < 8 && !q('[data-finish]'); i++) {
    const opt = q('.option-btn:not([disabled])');
    if (!opt) break;
    click(opt);
    const go = q('[data-go]');
    if (go) click(go);
  }
  must(sumSkills() === replaySkill, '重玩故事仍在重复累加能力点');

  /* --- 20. 第 401 条签到：必须自动归档而不是崩溃 --- */
  {
    const many = bare();
    many.profiles[0].id = 'p1';
    /* 用「今天」而不是写死的日期：这组断言的是「同一天第二次签到不给星」，
       写死 2026-11-05 会让测试在之后的每一天都误报（时间炸弹）。 */
    const overflowDay = w.SEL.utils.today();
    for (let i = 0; i < 400; i++) {
      many.profiles[0].checkins.push({ date: overflowDay, emotion: 'happy', note: 'n' + i });
    }
    many.profiles[0].flowers = Array.from({ length: 365 }, (_, i) => ({
      id: 'f' + i, date: overflowDay, emotion: 'happy', color: '#FFC94A', petal: 1
    }));
    w.SEL.state.importSave(JSON.stringify(many));
    const pid = w.SEL.state.current().id;
    let out = null, threw = null;
    try { out = w.SEL.state.addCheckin({ emotion: 'sad', intensity: 4, reason: '溢出一条' }); }
    catch (e) { threw = e; }
    must(!threw, '签到达到 400 条后再签到会抛错：' + (threw && threw.message));
    must(!!out && out.star === 0, '同一天第二次签到不应再给星');
    must(w.SEL.state.current().checkins.length === 400, '溢出后展示区签到数应保持 400');
    must(w.SEL.state.current().flowers.length === 365, '溢出后心情花应保持 365 朵');
    const slot = (w.SEL.state.save().archive || {})[pid] || null;
    must(!!slot && slot.checkins.length === 1, '第 401 条签到没有被移入归档');
    must(!!slot && slot.flowers.length === 1, '第 366 朵心情花没有被移入归档');
    must(w.SEL.state.stats().checkinsTotal === 401, '统计没有把归档记录算进总签到数');
    must(w.SEL.state.stats().emotionCount.happy === 400, '归档后情绪统计丢失了更早的记录');
    const parentTxt = route('#/parent');
    must(parentTxt.includes('401'), '家长面板的签到总数没有包含归档记录');
    must(parentTxt.includes('含归档'), '家长面板没有说明情绪次数包含归档记录');
  }

  /* --- 21. 导入的怪 id / HTML 昵称不能污染对象或注入 DOM --- */
  {
    w.SEL.state.importSave(JSON.stringify({
      profiles: [{
        id: '__proto__', name: '<img src=x onerror=alert(1)>', avatar: 'cloud',
        checkins: [], flowers: [], levels: {}, stickers: [], skills: {}, strategyCount: {}, settings: {}
      }]
    }));
    must(w.SEL.state.current().id !== '__proto__', '导入的 __proto__ 档案 id 未被清洗');
    must(({}).checkins === undefined, '导入的档案 id 污染了 Object.prototype');
    route('#/home');
    must(!q('#topbar img'), '昵称里的 HTML 没有被转义，顶栏出现注入元素');
    must((q('#topbar').textContent || '').includes('<img'), '昵称里的尖括号没有被当作普通文字显示');
    must((route('#/parent') || '').includes('还没有练习记录'), '零练习时雷达图没有给出「还没有练习记录」的说明');
  }

  /* --- 22. 未知路由与未知关卡要有兜底，不能白屏 --- */
  {
    const homeHtml = route('#/does-not-exist');
    must(homeHtml.includes('心里的小天气'), '未知路由没有回到首页');
    const badLevel = route('#/level/no-such-level');
    must(badLevel.includes('没找到这一关'), '未知关卡没有给出友好提示');
    const badIsland = route('#/island/no-such-island');
    must(badIsland.includes('没找到这座岛'), '未知岛屿没有给出友好提示');
  }

  /* --- 23. 换页后焦点落在新页面上（键盘/读屏可达） --- */
  {
    route('#/home');
    must(w.document.activeElement === q('#screen'), '换页后焦点没有交给新的 #screen');
  }
  /* --- 24. 新增：周报 / 趋势 / 策略有效性 / 建议 / 时长锁 / PIN / 故事探索 --- */
  {
    w.SEL.ui.closeModal();
    const fixed = bare();
    const today = w.SEL.utils.today();
    fixed.profiles[0].usage = { date: today, seconds: 16 * 60 };
    fixed.profiles[0].settings = {
      voice: true, sfx: true, reduceMotion: false,
      screenLimit: 15, bedtimeOn: false, bedtimeStart: '20:30', bedtimeEnd: '07:30'
    };
    fixed.profiles[0].checkins = [
      { date: w.SEL.utils.daysAgo(3), emotion: 'angry', intensity: 5, strategy: 'breathing', at: 'a' },
      { date: w.SEL.utils.daysAgo(2), emotion: 'calm', intensity: 3, strategy: 'coping', at: 'b' },
      { date: w.SEL.utils.daysAgo(1), emotion: 'calm', intensity: 2, strategy: '', at: 'c' },
      { date: today, emotion: 'happy', intensity: 2, strategy: '', at: 'd' }
    ];
    w.SEL.state.importSave(JSON.stringify(fixed));

    /* 时长上限：到点必须出现软锁，且不能挡住回首页 */
    route('#/home');
    must(q('#time-lock') && q('#time-lock').hidden === false, '使用时长达到上限后没有出现休息提醒');
    must((q('#time-lock').textContent || '').includes('15 分钟'), '时长锁没有说明约定的分钟数');
    must(q('#calm-fab').hidden === true, '时间锁出现时冷静角按钮仍显示');
    click(q('[data-time-unlock]'));
    must(!!q('.modal'), '时长锁的「请大人来解锁」没有打开家长门');
    const expr2 = (q('.modal h3') && q('.modal h3').textContent) || '';
    const nums2 = expr2.match(/(\d+)\s*\+\s*(\d+)/);
    must(!!nums2, '时长锁家长门没有出算术题');
    if (nums2) {
      q('[data-gate-input]').value = String(Number(nums2[1]) + Number(nums2[2]));
      click(q('[data-modal-act="ok"]'));
      must(q('#time-lock').hidden === true, '家长解锁后时间锁仍未消失');
      must(w.sessionStorage.getItem('sunny-time-ok') === today, '家长解锁后没有记下「今天不再提醒」');
      must(q('#calm-fab').hidden === false, '解锁后冷静角按钮没有恢复');
    }
    w.SEL.state.setSetting('screenLimit', 0);

    /* 情绪趋势 + 策略有效性 + 本周建议 */
    const parentHtml = route('#/parent');
    must(parentHtml.includes('情绪强度趋势'), '家长面板缺少情绪强度趋势卡片');
    must(parentHtml.includes('方法有没有帮上忙'), '家长面板缺少策略有效性卡片');
    must(parentHtml.includes('本周建议'), '家长面板缺少本周建议关卡');
    must(qa('.rec-item').length >= 1 && qa('.rec-item').length <= 3, '本周建议不是 1–3 关');
    must(qa('.effect-table tbody tr').length >= 1, '策略有效性没有根据签到记录生成任何一行');
    const chartBefore = (q('.trend-wrap svg') || {}).outerHTML || '';
    must(chartBefore.includes('<path'), '趋势折线没有绘制路径');
    click(q('[data-trend="30"]'));
    must(route('#/parent').includes('30 天'), '趋势区间切换到 30 天后没有保留选中状态');
    must(q('.trend-wrap svg'), '切换 30 天后趋势图消失');

    /* 周报：7 天格子 + 打印入口 + 数据统计 */
    const reportHtml = route('#/report');
    must(reportHtml.includes('本周成长卡'), '周报页缺少标题');
    must(qa('.wk-day').length === 7, '周报没有 7 天格子');
    must(!!q('[data-print]'), '周报缺少打印按钮');
    must(reportHtml.includes('记录天数'), '周报缺少统计项');

    /* 故事分支探索度 */
    const st2 = all.find(x => x.lv.type === 'story');
    const storyData2 = (w.SEL_DATA.stories || []).find(s => s.id === st2.lv.data.storyId);
    w.SEL.state.update(p => {
      p.stars = 999;
      all.forEach(({ lv }) => { if (lv.id !== st2.lv.id) p.levels[lv.id] = { done: true, stars: 3, attempts: 1, lastAt: '2026-01-01' }; });
    });
    route('#/level/' + st2.lv.id);
    for (let i = 0; i < 8 && !q('[data-finish]'); i++) {
      const opt = q('.option-btn:not([disabled])');
      if (!opt) break;
      click(opt);
      const go = q('[data-go]');
      if (go) click(go);
    }
    must(!!q('.story-explore'), '故事结局没有显示分支探索度');
    const exploreBox = q('.story-explore');
    must(!!exploreBox && (exploreBox.textContent || '').includes('/'), '故事探索度没有显示「已发现 / 总数」');
    const sp = w.SEL.state.storyProgress(st2.lv.data.storyId);
    must(sp.endingsSeen >= 1 && sp.endingsTotal >= 1, '故事结局没有被记进探索进度');
    w.SEL.ui.closeModal();

    /* 家长 PIN：设置 → 错误不放行 → 正确放行 → 连错锁定 → 清除 */
    w.SEL.state.clearPin();
    must(w.SEL.state.setPin('1234') === true, '设置 4 位 PIN 失败');
    must(w.SEL.state.pinSet() === true, '设置 PIN 后 pinSet 仍为 false');
    must(w.SEL.state.verifyPin('0000').ok === false, '错误 PIN 被放行');
    must(w.SEL.state.verifyPin('1234').ok === true, '正确 PIN 没有通过');
    w.sessionStorage.removeItem('sunny-parent-ok');
    route('#/parent');
    must(!!q('[data-gate-pin]'), '设置 PIN 后家长门仍是算术题');
    q('[data-gate-pin]').value = '1234';
    click(q('[data-gate-ok]'));
    must(!!q('.kpi-grid'), '输入正确 PIN 后没有进入家长面板');
    for (let i = 0; i < 5; i++) w.SEL.state.verifyPin('9999');
    must(w.SEL.state.verifyPin('1234').locked === true, '连续输错 5 次后没有锁定');
    w.SEL.state.clearPin();
    must(w.SEL.state.pinSet() === false, '清除 PIN 失败');
    w.sessionStorage.setItem('sunny-parent-ok', '1');
  }

  /* --- 25. 坏设置值不会绕过时长限制 --- */
  {
    const bad = bare();
    bad.profiles[0].settings = {
      voice: true, sfx: true, reduceMotion: false,
      screenLimit: -5, bedtimeOn: 'yes', bedtimeStart: '99:99', bedtimeEnd: 'x'
    };
    bad.profiles[0].usage = { date: w.SEL.utils.today(), seconds: 999999999 };
    w.SEL.state.importSave(JSON.stringify(bad));
    const se = w.SEL.state.current().settings;
    must(se.screenLimit === 0, '导入的负数时长上限没有被修正为 0');
    must(se.bedtimeOn === false, '导入的非布尔 bedtimeOn 没有被修正');
    must(/^\d{2}:\d{2}$/.test(se.bedtimeStart) && /^\d{2}:\d{2}$/.test(se.bedtimeEnd), '导入的非法睡前时间没有被修正');
    must(w.SEL.state.usageToday() <= 86400, '导入的超大使用时长没有被封顶');
  }
} catch (e) {
  fails.push('测试流程异常: ' + (e && e.stack || e));
}

/* --- 26. 情绪急救冷静角：不换页、不丢当前进度，60 秒倒计时可随时关掉 --- */
try {
  route('#/home');
  await new Promise(r => setTimeout(r, 80));   // 等上一轮 hashchange 派发完，否则会把刚打开的弹窗重绘掉
  const hashBefore = w.location.hash;
  must(q('#calm-fab') && q('#calm-fab').hidden === false, '首页没有显示情绪急救悬浮按钮');
  w.SEL.calm.open();
  must(!!q('[data-calm]'), '冷静角弹窗没有打开');
  must((q('.modal').textContent || '').includes('60'), '冷静角没有说明 60 秒');
  click(q('[data-modal-act="start"]'));
  await new Promise(r => setTimeout(r, 1150));
  const clockTxt = (q('[data-calm-clock]') || {}).textContent || '';
  must(/5[89] 秒/.test(clockTxt), '冷静角倒计时没有走动：' + clockTxt);
  w.SEL.ui.closeModal();
  must(w.location.hash === hashBefore, '关闭冷静角后页面被切走');
  must(!!q('.hero'), '关闭冷静角后首页内容丢失');
  route('#/report');
  must(q('#calm-fab').hidden === true, '周报（打印页）上不应显示悬浮的冷静角按钮');
} catch (e) {
  fails.push('冷静角测试异常: ' + (e && e.stack || e));
}


/* --- 20. 短暂计时器：弹窗关闭后必须停掉 --- */
try {
  /* 前面 route() 排队的 hashchange 会在下一轮事件循环里触发 render()，而 render 会清掉
     登记的计时器（这正是预期行为）。先等队列排空，否则对照项会被上一次渲染清掉。 */
  await new Promise(r => setTimeout(r, 100));
  let fired = false;
  w.SEL.ui.later(() => { fired = true; }, 60);
  w.SEL.ui.closeModal();
  let ticks = 0;
  w.SEL.ui.every(() => { ticks++; }, 40);
  w.SEL.ui.closeModal();
  let alive = 0;
  const stop2 = w.SEL.ui.every(() => { alive++; }, 40);
  await new Promise(r => setTimeout(r, 160));
  stop2();
  const aliveAfterStop = alive;
  await new Promise(r => setTimeout(r, 100));
  must(!fired, '弹窗关闭后，已登记的 setTimeout 仍然执行了');
  must(ticks === 0, '弹窗关闭后，已登记的 setInterval 仍在运行');
  must(aliveAfterStop >= 2, 'UI.every 正常计时路径没有生效（对照项失败）');
  must(alive === aliveAfterStop, '调用 stop 后 interval 仍在运行');
} catch (e) {
  fails.push('计时器测试异常: ' + (e && e.stack || e));
}

/* --- 27. 回归组：家长护栏跨「清空进度」存活 / 非法日期与归档键清洗 / 睡前锁全流程 / 日期工具 --- */
try {
  const bare = () => ({ version: 1, activeId: 'p1', profiles: [{
    id: 'p1', name: '小玩家', avatar: 'cloud', checkins: [], flowers: [],
    levels: {}, stickers: [], skills: {}, strategyCount: {}, settings: {}
  }] });
  // 27a 「清空进度」只清进度：家长的时长上限与睡前锁必须存活
  {
    const s = bare();
    s.profiles[0].settings = { voice: true, sfx: true, reduceMotion: false, screenLimit: 30, bedtimeOn: true, bedtimeStart: '21:00', bedtimeEnd: '07:00' };
    s.profiles[0].stars = 42;
    s.profiles[0].levels['aw-1'] = { done: true, stars: 3, attempts: 1, lastAt: '2026-11-01' };
    w.SEL.state.importSave(JSON.stringify(s));
    w.SEL.state.resetProfile(w.SEL.state.current().id);
    const se = w.SEL.state.current().settings;
    must(se.screenLimit === 30, '「清空进度」把每日时长上限也清掉了（家长护栏应跨清空存活）');
    must(se.bedtimeOn === true, '「清空进度」把睡前锁也关掉了');
    must(se.bedtimeStart === '21:00' && se.bedtimeEnd === '07:00', '「清空进度」把睡前时段清掉了');
    must(w.SEL.state.current().stars === 0, '「清空进度」没有清掉星星');
    must(!w.SEL.state.current().levels['aw-1'], '「清空进度」没有清掉关卡进度');
  }

  // 27b 语义非法日期（2026-99-99 / 2026-02-30）不能进存档、不能上屏
  {
    const s = bare();
    s.profiles[0].checkins.push({ date: '2026-99-99', emotion: 'happy', intensity: 3 });
    s.profiles[0].checkins.push({ date: '2026-02-30', emotion: 'sad', intensity: 2 });
    s.profiles[0].flowers.push({ id: 'fx', date: '2026-99-99', emotion: 'happy', color: '#FFC94A', petal: 0 });
    w.SEL.state.importSave(JSON.stringify(s));
    must(w.SEL.state.current().checkins.length === 0, '语义非法的签到日期（如 2026-99-99）混进了存档');
    must(w.SEL.state.current().flowers.length === 0, '语义非法的心情花日期混进了存档');
    const gardenHtml = route('#/garden');
    must(!gardenHtml.includes('99月99日'), '花园把非法日期显示成了「99月99日」');
  }

  // 27c 导入备份的归档键走白名单：__proto__ / constructor 不能污染对象原型
  {
    const evil = JSON.parse('{"profiles":[{"id":"p1","name":"小玩家","avatar":"cloud","checkins":[],"flowers":[],"levels":{},"stickers":[],"skills":{},"strategyCount":{},"settings":{}}],"archive":{"__proto__":{"checkins":[],"flowers":[]},"constructor":{"checkins":[],"flowers":[]}}}');
    w.SEL.state.importSave(JSON.stringify(evil));
    const arc = w.SEL.state.save().archive;
    /* jsdom 页面脚本跑在独立 realm，Object.prototype 不能跨 realm 直接比对；
       改查「污染后必从原型链泄漏」的键，断言与 realm 无关 */
    must(arc.checkins === undefined && arc.flowers === undefined, '导入备份的归档键 __proto__ 污染了归档对象（checkins/flowers 从原型链泄漏）');
    must(!Object.prototype.hasOwnProperty.call(arc, 'constructor'), '导入备份的保留键 constructor 被写进归档');
  }

  // 27d 睡前锁全流程：到点盖休息卡、挡住冷静角、家长门解锁后当天不再打扰
  {
    const U = w.SEL.utils;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const wrap = (m) => U.pad(Math.floor((((m % 1440) + 1440) % 1440) / 60)) + ':' + U.pad((((m % 1440) + 1440) % 1440) % 60);
    const start = wrap(cur - 30), end = wrap(cur + 30);
    must(start !== end, '睡前锁测试窗口构造异常');
    const s = bare();
    s.profiles[0].settings = { voice: true, sfx: true, reduceMotion: false, screenLimit: 0, bedtimeOn: true, bedtimeStart: start, bedtimeEnd: end };
    w.SEL.state.importSave(JSON.stringify(s));
    w.sessionStorage.removeItem('sunny-time-ok');
    route('#/home');
    must(q('#time-lock') && q('#time-lock').hidden === false, '睡前时段内没有出现休息提醒');
    must((q('#time-lock').textContent || '').includes('休息时间'), '睡前锁没有说明休息时段');
    must(q('#screen').getAttribute('aria-hidden') === 'true', '睡前锁没有把主内容标记为不可访问');
    must(q('#calm-fab').hidden === true, '睡前锁出现时冷静角按钮仍显示');
    click(q('[data-time-unlock]'));
    const expr = (q('.modal h3') && q('.modal h3').textContent) || '';
    const nums = expr.match(/(\d+)\s*\+\s*(\d+)/);
    must(!!nums, '睡前锁的「请大人来解锁」没有出算术题');
    if (nums) {
      q('[data-gate-input]').value = String(Number(nums[1]) + Number(nums[2]));
      click(q('[data-modal-act="ok"]'));
      must(q('#time-lock').hidden === true, '家长解锁后睡前锁仍未消失');
      must(w.sessionStorage.getItem('sunny-time-ok') === U.today(), '家长解锁后没有记下「今天不再提醒」');
    }
    w.sessionStorage.removeItem('sunny-time-ok');
  }

  // 27e 签到强度滑块的选择要落库
  {
    w.SEL.state.importSave(JSON.stringify(bare()));
    route('#/checkin');
    click(q('[data-pick="0"]'));
    click(q('[data-next]'));
    const range = q('[data-range]');
    range.value = '5';
    range.dispatchEvent(new w.Event('input', { bubbles: true }));
    must((q('[data-val]').textContent || '') === '5', '签到强度滑块没有更新显示');
    click(q('[data-next]'));
    click(q('[data-next]'));
    click(q('[data-plant]'));
    const c = w.SEL.state.current().checkins;
    must(c.length === 1 && c[0].intensity === 5, '签到选择的强度没有写进存档');
    w.SEL.ui.closeModal();
  }

  // 27f 日期工具单元：周一为一周开始、跨月跨年运算、睡前锁跨午夜判断
  {
    const U = w.SEL.utils;
    must(U.weekStart('2026-11-05') === '2026-11-02', 'weekStart 没有回到本周一（周四应归到周一）');
    must(U.weekStart('2026-11-02') === '2026-11-02', 'weekStart 把周一本身归到了上周');
    must(U.weekStart('2026-11-01') === '2026-10-26', 'weekStart 把周日（一周最后一天）当成了本周一');
    must(U.addDays('2026-11-30', 1) === '2026-12-01', 'addDays 跨月加一天出错');
    must(U.dayDiff('2026-12-31', '2027-01-01') === 1, 'dayDiff 跨年差一天计算出错');
    const f = w.SEL.screentime.inBedtime;
    const mk = (h, m) => new Date(2026, 0, 1, h, m);
    must(f({ bedtimeOn: true, bedtimeStart: '21:00', bedtimeEnd: '07:00' }, mk(23, 0)) === true, '睡前锁跨午夜（深夜段）判断错误');
    must(f({ bedtimeOn: true, bedtimeStart: '21:00', bedtimeEnd: '07:00' }, mk(6, 0)) === true, '睡前锁跨午夜（清晨段）判断错误');
    must(f({ bedtimeOn: true, bedtimeStart: '21:00', bedtimeEnd: '07:00' }, mk(12, 0)) === false, '睡前锁把白天误判成休息时间');
  }

  // 收尾：还原成干净档案，不把测试数据留给下一次运行
  w.SEL.state.importSave(JSON.stringify(bare()));
  route('#/home');
} catch (e) {
  fails.push('回归组27异常: ' + (e && e.stack || e));
}

/* ==================== 28. v1.2.0：全关卡朗读 + 说一说 ==================== */
let backup28 = null;
try {
  const A = w.SEL.audio;
  const U = w.SEL.utils;
  backup28 = w.SEL.state.exportSave();
  const levels = w.SEL.state.allLevels();
  const spoken = () => utterances.map(u => u.text);
  const choiceLv = levels.find(x => x.level.type === 'choice').level;

  w.SEL.state.clearPin();
  w.SEL.state.update(p => {
    p.stars = 999;
    levels.forEach(x => { p.levels[x.level.id] = { done: true, stars: 3, attempts: 1, lastAt: '2026-01-01' }; });
  });
  w.SEL.state.setSetting('voice', true);
  w.SEL.state.setSetting('autoRead', true);
  w.SEL.state.setSetting('voiceRate', 0.9);
  function freshRoute(hash) {
    utterances.length = 0;
    A.clearLog();
    route(hash);
    return spoken();
  }

  // 28a 19 关的每一段静态文字（题干 / 说明 / 全部选项卡片）都进了自动朗读
  // 期望值必须直接从课程数据取，不能拿 readScript 自己的输出自证，
  // 否则「连一连漏念左侧线索」这类问题它一个都发现不了。
  function mustReadForLevel(lv) {
    const d = lv.data || {};
    const out = [lv.title, lv.intro];
    switch (lv.type) {
      case 'choice':
        if (d.prompt) out.push(d.prompt);
        (d.options || []).forEach(o => { if (o.text) out.push(o.text); });
        break;
      case 'match':
        if (d.instruction) out.push(d.instruction);
        (d.pairs || []).forEach(p => {
          if (p.left && p.left.label) out.push(p.left.label);
          if (p.right && p.right.label) out.push(p.right.label);
        });
        break;
      case 'order':
        if (d.instruction) out.push(d.instruction);
        (d.items || []).forEach(i => { if (i.text) out.push(i.text); });
        break;
      case 'slider':
        if (d.prompt) out.push(d.prompt);
        if (d.minLabel) out.push(d.minLabel);
        if (d.maxLabel) out.push(d.maxLabel);
        break;
      case 'breathe':
        if (d.title) out.push(d.title);
        (d.cues || []).forEach(c => out.push(c));
        break;
      case 'classify':
        if (d.instruction) out.push(d.instruction);
        (d.buckets || []).forEach(b => { if (b.label) out.push(b.label); });
        (d.items || []).forEach(i => { if (i.text) out.push(i.text); });
        break;
      case 'story': {
        const st = (w.SEL_DATA.stories || []).filter(s => s.id === d.storyId)[0];
        const n = st && st.nodes && st.nodes[st.start];
        if (n) {
          if (n.text) out.push(n.text);
          (n.choices || []).forEach(c => { if (c.text) out.push(c.text); });
        }
        break;
      }
    }
    return out.filter(Boolean).map(t => String(t).trim()).filter(Boolean);
  }
  {
    const missing = [];
    levels.forEach(({ level: lv }) => {
      const script = w.SEL.games.readScript(lv);
      const texts = freshRoute('#/level/' + lv.id);
      const joined = texts.join('|');
      script.head.concat(script.options).map(t => String(t).trim()).filter(Boolean).forEach(t => {
        if (!joined.includes(t)) missing.push(lv.id + ' → ' + t.slice(0, 18));
      });
      mustReadForLevel(lv).forEach(t => {
        if (!joined.includes(t)) missing.push(lv.id + ' [数据] → ' + t.slice(0, 18));
      });
    });
    must(missing.length === 0, '自动读题漏字: ' + missing.slice(0, 6).join(' / '));
    const bar = q('[data-voice-bar]');
    must(!!bar && !!q('[data-voice-replay]') && !!q('[data-voice-stop]'), '关卡缺少朗读播报条或重听/停止按钮');
  }

  // 28b 朗读队列串行；停掉后旧 utterance 的 onend 不得继续推进队列
  {
    utterances.length = 0;
    A.speakSequence(['第一句', '第二句', '第三句']);
    must(spoken().join('|') === '第一句|第二句|第三句', '朗读队列没有按顺序连读');
    syncEnd = false;
    utterances.length = 0;
    cancelCount = 0;
    A.speakSequence(['甲', '乙']);
    must(spoken().length === 1, '异步语音下队列不应一次把两句都念出来');
    A.stopSpeak();
    must(cancelCount > 0, '停止朗读没有调用 speechSynthesis.cancel');
    const old = utterances[0];
    if (old && old.onend) old.onend();
    must(spoken().length === 1, '停掉后旧朗读的 onend 仍推进了队列（会串到下一页念）');
    syncEnd = true;
  }

  // 28c 自动读题开关 / 总开关 / 语速
  {
    w.SEL.state.setSetting('autoRead', false);
    const quiet = freshRoute('#/level/' + choiceLv.id);
    must(!quiet.some(t => t.includes(choiceLv.data.prompt)), '关掉自动读题后仍在读题');
    utterances.length = 0;
    click(q('[data-voice-replay]'));
    must(spoken().some(t => t.includes(choiceLv.data.prompt)), '关掉自动读题后手动「再听一遍」也被静音了');
    w.SEL.state.setSetting('voice', false);
    utterances.length = 0;
    click(q('[data-voice-replay]'));
    must(spoken().length === 0, '总开关关掉后手动重听仍然出声');
    w.SEL.state.setSetting('voice', true);
    w.SEL.state.setSetting('autoRead', true);
    w.SEL.state.setSetting('voiceRate', 1.2);
    utterances.length = 0;
    A.speak('试听一句');
    must(utterances[0] && Math.abs(utterances[0].rate - 1.2) < 0.001, '朗读语速设置没有生效');
    w.SEL.state.setSetting('voiceRate', 0.9);
  }

  // 28d 结算弹窗把「今天学到 / 给大人」也念出来
  {
    freshRoute('#/level/' + choiceLv.id);
    click(q('.option-btn'));
    utterances.length = 0;
    click(q('[data-finish]'));
    const done = spoken().join('|');
    must(done.includes('今天学到'), '结算弹窗没有朗读「今天学到」');
    must(done.includes('给大人'), '结算弹窗没有朗读给大人的话');
    w.SEL.ui.closeModal();
  }

  // 28e 说一说：示范朗读、计次、勇气星、首枚贴纸、鼓励语
  {
    freshRoute('#/level/' + choiceLv.id);
    must(!!q('[data-say-card]'), '关卡页缺少「说一说」卡片');
    must(!!q('[data-say-hide]'), '关卡页的说一说卡片不能收起');
    const before = w.SEL.state.expressionStats().total;
    const starsBefore = w.SEL.state.current().stars;
    utterances.length = 0;
    click(q('[data-say-demo]'));
    must(spoken().length > 0, '「听示范」没有朗读示范句');
    click(q('[data-say-done]'));
    must(w.SEL.state.expressionStats().total === before + 1, '说一说没有累计次数');
    must(w.SEL.state.current().stars === starsBefore + 1, '第一次开口没有给勇气星');
    must((w.SEL.state.current().stickers || []).includes('st-voice-first'), '首次开口没有解锁「开口第一句」贴纸');
    must((q('[data-say-feedback]').textContent || '').includes('勇气星'), '说一说没有给出反馈');
    must(spoken().length > 1, '说完后没有朗读鼓励语');
    must(q('[data-say-done]').disabled === true, '说完后按钮没锁住，连点会重复计次');
  }

  // 28f 每天最多 3 颗勇气星，超出仍累计次数；未知话题不写库
  {
    const topics = w.SEL_DATA.expression.prompts;
    for (let i = 0; i < 3; i++) w.SEL.state.recordExpression(topics[i].id, 'feel');
    const st = w.SEL.state.expressionStats();
    must(st.todayStars === w.SEL_DATA.expression.dailyStarCap,
      '每日勇气星上限没有生效，实际 ' + st.todayStars);
    const r = w.SEL.state.recordExpression(topics[3].id, 'hope');
    must(r && r.star === 0 && r.capped === true, '超过每日上限后仍然发星');
    must(w.SEL.state.expressionStats().total === st.total + 1, '超过上限后开口次数没有继续累计');
    must(w.SEL.state.recordExpression('__proto__', 'feel') === null, '未知话题仍能写进存档');
    must(w.SEL.state.recordExpression('ex-not-exist', 'feel') === null, '伪造话题仍能写进存档');
  }

  // 28g 独立练习页：换卡生效且不会叠加监听器导致重复计次
  {
    const html = route('#/express');
    must(html.includes('勇气小话筒'), '说一说独立页没有渲染');
    must(!!q('[data-say-next]') && !!q('[data-say-who]'), '独立页缺换卡或说话对象选择');
    const firstTopic = q('[data-say-card]').getAttribute('data-topic');
    click(q('[data-say-next]'));
    const secondTopic = q('[data-say-card]').getAttribute('data-topic');
    must(secondTopic && secondTopic !== firstTopic, '换一张情境卡后题目没变');
    const before = w.SEL.state.expressionStats().total;
    click(q('[data-say-done]'));
    must(w.SEL.state.expressionStats().total === before + 1, '换卡后事件监听器叠加，点一次记了多次');
    utterances.length = 0;   /* 不清空的话这条断言会被前面的朗读填成恒真 */
    click(q('[data-say-frames]'));
    const exFrames = w.SEL_DATA.expression.frames;
    must(spoken().length === exFrames.length, '「听一遍三句话」没有逐句朗读');
    must(spoken()[0] === exFrames[0].example, '「听一遍三句话」念的不是句式例句');
  }

  // 28h 家长面板与成长周报能看到开口统计
  {
    w.SEL.state.clearPin();
    const parentHtml = route('#/parent');
    must(parentHtml.includes('开口表达'), '家长面板缺少开口表达统计');
    must(parentHtml.includes('不保存孩子说过'), '家长面板没有写明不保存说过的话');
    const reportHtml = route('#/report');
    must(reportHtml.includes('这周把心里的话大声说出了'), '成长周报缺少表达统计');
  }

  // 28i 导入清洗：非法日期 / 负数 / 未知键 / 原型污染 / 非法设置
  {
    const backup = JSON.parse(w.SEL.state.exportSave());
    const dirty = JSON.parse('{"total":-99,"days":[{"date":"2026-99-99","count":5}],' +
      '"frames":{"__proto__":5,"feel":3,"fake":9},"prompts":{"__proto__":2,"ex-1":4},' +
      '"todayStars":{"date":"2026-13-01","count":99},"lastAt":"bad"}');
    dirty.days.push({ date: U.today(), count: 999999 });
    backup.profiles[0].expression = dirty;
    backup.profiles[0].settings.autoRead = 'yes';
    backup.profiles[0].settings.voiceRate = 99;
    w.SEL.state.importSave(JSON.stringify(backup));
    const e = w.SEL.state.current().expression;
    must(e.total === 0, '导入的非法 total 没有清洗');
    must(e.days.length === 1 && e.days[0].date === U.today(), '导入的非法日期没有清洗');
    must(Object.getPrototypeOf(e.frames) === null, 'frames 不是无原型对象，可能被污染');
    must(!('__proto__' in e.frames) && !('fake' in e.frames), '未知句式键没有清洗');
    must(!('__proto__' in e.prompts), '未知话题键没有清洗');
    must(e.todayStars.date === '', '非法今日星星日期没有清洗');
    must(w.SEL.state.current().settings.autoRead === true, '非法 autoRead 没有回落默认值');
    must(w.SEL.state.current().settings.voiceRate === 1.2, '语速没有 clamp 到 1.2');
  }

  // 28j 清空进度：表达记录清掉，声音偏好保留
  {
    w.SEL.state.setSetting('autoRead', false);
    w.SEL.state.setSetting('voiceRate', 0.8);
    w.SEL.state.recordExpression('ex-2', 'hope');
    w.SEL.state.resetProfile(w.SEL.state.current().id);
    must(w.SEL.state.current().settings.autoRead === false, '清空进度把自动读题偏好也清掉了');
    must(w.SEL.state.current().settings.voiceRate === 0.8, '清空进度把语速偏好也清掉了');
    must(w.SEL.state.expressionStats().total === 0, '清空进度没有清掉开口记录');
  }

  w.SEL.state.setSetting('voice', true);
  w.SEL.state.setSetting('autoRead', true);
  w.SEL.state.setSetting('voiceRate', 0.9);
  w.SEL.state.importSave(backup28);
  syncEnd = true;
} catch (e) {
  fails.push('回归组28异常: ' + (e && e.stack || e));
} finally {
  /* 中途抛异常也必须还原全局钩子与存档，否则会污染 29/30 组 */
  syncEnd = true;
  try { if (backup28) w.SEL.state.importSave(backup28); } catch (e2) {}
  try { w.SEL.ui.setReadMode(false); w.SEL.ui.clearHighlight(); } catch (e3) {}
}

/* ==================== 29. 封板深度终审：打断 / 降级 / 状态机 / 配置边界 ==================== */
/* 这些是全局钩子/配置，必须在 finally 里无条件还原，否则会污染后续用例 */
let cap29 = 3, shuffle29 = null, ctor29 = null, backup29 = null;
try {
  const A = w.SEL.audio;
  const U = w.SEL.utils;
  backup29 = w.SEL.state.exportSave();
  const levels29 = w.SEL.state.allLevels();
  const spoken = () => utterances.map(u => u.text);
  const choiceLv = levels29.find(x => x.level.type === 'choice').level;
  const storyLv = levels29.find(x => x.level.type === 'story').level;
  const orderLv = levels29.find(x => x.level.type === 'order').level;
  cap29 = w.SEL_DATA.expression.dailyStarCap;
  shuffle29 = U.shuffle;
  ctor29 = w.SpeechSynthesisUtterance;

  w.SEL.state.update(p => {
    p.stars = 999;
    levels29.forEach(x => { p.levels[x.level.id] = { done: true, stars: 3, attempts: 1, lastAt: '2026-01-01' }; });
  });
  w.SEL.state.setSetting('voice', true);
  w.SEL.state.setSetting('autoRead', true);
  function freshRoute(hash) {
    utterances.length = 0;
    A.clearLog();
    route(hash);
    return spoken();
  }

  // 29a 读题被反馈打断后，播报条不能永远停在「正在读…」
  {
    syncEnd = false;
    freshRoute('#/level/' + choiceLv.id);
    const bar = q('[data-voice-bar]');
    must(!!bar && bar.classList.contains('speaking'), '开始读题时播报条没有进入 speaking 状态');
    click(q('.option-btn'));
    must(!bar.classList.contains('speaking'), '反馈朗读打断读题后，播报条 speaking 状态残留');
    must((q('[data-voice-label]').textContent || '').includes('团团'), '打断后播报条文案没有复位');
    A.stopSpeak();
    syncEnd = true;
  }

  // 29b 交互短提示排队：不切碎正在念的一句，且只保留最新一条
  {
    syncEnd = false;
    A.speakSequence(['正在念的一整句']);
    const cur = utterances[utterances.length - 1];
    utterances.length = 0;
    A.readAutoTail('提示一');
    A.readAutoTail('提示二');
    must(utterances.length === 0, '短提示把正在念的那一句切断了（会听到残句）');
    if (cur && cur.onend) cur.onend();
    must(spoken().length === 1 && spoken()[0] === '提示二', '排队中的旧提示没有被最新一条替换');
    A.stopSpeak();
    syncEnd = true;
  }

  // 29c 无中文语音环境：不排队、不抛错、界面状态正常
  {
    delete w.SpeechSynthesisUtterance;
    let threw = null;
    try {
      A.readQuestion(['降级测试题目']);
      A.speak('手动小喇叭');
    } catch (e) { threw = e; }
    must(!threw, '没有 SpeechSynthesisUtterance 时朗读抛错: ' + (threw && threw.message));
    must(!A.isSpeaking(), '无语音环境仍留下未清理的朗读队列');
    must(A.recent().includes('降级测试题目'), '无语音环境没有记录待朗读文本');
    w.SpeechSynthesisUtterance = ctor29;
  }

  // 29d 「听选项」只念选项；「再听一遍」念整道题；Alt+R 在弹窗打开时不应打断结算语音
  {
    freshRoute('#/level/' + choiceLv.id);
    utterances.length = 0;
    click(q('[data-voice-options]'));
    must(spoken().length === choiceLv.data.options.length, '「听选项」念的数量与选项数不一致');
    utterances.length = 0;
    click(q('[data-voice-replay]'));
    must(spoken().some(t => t.includes(choiceLv.data.prompt)), '「再听一遍」没有念题干');
    utterances.length = 0;
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'R', altKey: true, bubbles: true }));
    must(spoken().length > 0, 'Alt+R 没有触发题目重听');
    w.SEL.ui.modal({ title: '测试弹窗', body: '<p>结算语音测试中</p>',
      actions: [{ label: '关闭', cls: 'ghost', close: true }] }, function () {});
    utterances.length = 0;
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'R', altKey: true, bubbles: true }));
    must(spoken().length === 0, '弹窗打开时 Alt+R 仍去点背后关卡的重听按钮');
    w.SEL.ui.closeModal();
  }

  // 29e 故事走到第二个节点后，「再听一遍」指向当前节点
  {
    freshRoute('#/level/' + storyLv.id);
    click(q('.option-btn'));
    const go = q('[data-go]');
    if (go) click(go);
    const nodeText = (q('.story-text') && q('.story-text').textContent || '').trim();
    must(nodeText.length > 8, '故事没能走到下一个节点');
    utterances.length = 0;
    click(q('[data-voice-replay]'));
    must(spoken().some(t => t.includes(nodeText.slice(0, 12))), '故事重听仍指向首个节点，不是当前节点');
  }

  // 29f 排序题朗读：即使 shuffle 恰好还原成数据顺序，也不能照着答案念
  {
    U.shuffle = function (a) { return a.slice(); };
    const script = w.SEL.games.readScript(orderLv);
    U.shuffle = shuffle29;
    const firstItemText = (orderLv.data.items[0] || {}).text || '';
    must(!script.options[0].includes(firstItemText), '排序题朗读按正确顺序念出了第一步（泄答案）');
    must(script.options.length === orderLv.data.items.length, '排序题朗读漏念了卡片');
  }

  // 29g 说一说卡片状态机：折叠 / 展开 / 指定情境卡 / 说话对象 / 统计与贴纸即时刷新
  {
    freshRoute('#/level/' + choiceLv.id);
    click(q('[data-say-hide]'));
    must(q('[data-say-card]').classList.contains('folded'), '「今天先不说」没有收起卡片');
    click(q('[data-say-unhide]'));
    must(!q('[data-say-card]').classList.contains('folded'), '收起后无法展开卡片');

    route('#/express/ex-1');
    must(q('[data-say-card]').getAttribute('data-topic') === 'ex-1', '#/express/<id> 没有锁定指定情境卡');
    must(!q('[data-say-hide]') && !q('[data-say-unhide]'), '独立页渲染了永远用不到的折叠按钮');
    const sel = q('[data-say-who]');
    sel.value = '2';
    sel.dispatchEvent(new w.Event('change', { bubbles: true }));
    const audience = w.SEL_DATA.expression.audiences[2];
    must((q('[data-say-target]').textContent || '').includes(audience), '选择说话对象后卡片上的对象没变');

    const statsBefore = q('[data-say-stat-slot]').textContent;
    must(!!q('[data-say-badge-slot]'), '独立页缺少勇气贴纸进度容器');
    click(q('[data-say-done]'));
    must(q('[data-say-stat-slot]').textContent !== statsBefore, '说完后统计条没有即时刷新');
    click(q('[data-say-again]'));
    must(!!q('[data-say-done]') && q('[data-say-done]').disabled === false, '「再说一次」没有恢复可点击状态');
  }

  // 29h 每日星星上限跟随配置（不能只在默认 3 时正确）
  {
    w.SEL_DATA.expression.dailyStarCap = 5;
    w.SEL.state.update(p => { p.expression.todayStars = { date: '', count: 0 }; });
    const stars0 = w.SEL.state.current().stars;
    for (let i = 1; i <= 6; i++) w.SEL.state.recordExpression('ex-' + i, 'feel');
    must(w.SEL.state.current().stars === stars0 + 5, 'dailyStarCap=5 时发星数量不对（清洗把计数夹回 3 会无限发星）');
    must(w.SEL.state.expressionStats().todayStars === 5, 'dailyStarCap=5 时今日星星计数不对');
    must(route('#/express/ex-1').includes('/5'), 'dailyStarCap=5 时统计条的分母没有跟着变');
    w.SEL_DATA.expression.dailyStarCap = cap29;
    w.SEL.state.update(p => { p.expression.todayStars = { date: '', count: 0 }; });
  }

  // 29i 清空进度不能把「今天已玩多久」归零（家长护栏）
  {
    w.SEL.state.update(p => { p.usage = { date: U.today(), seconds: 600 }; });
    w.SEL.state.resetProfile(w.SEL.state.current().id);
    must(w.SEL.state.current().usage.seconds === 600, '清空进度把当天已用时长归零，可绕过每日上限');
  }

  w.SEL.state.importSave(backup29);
} catch (e) {
  fails.push('回归组29异常: ' + (e && e.stack || e));
} finally {
  syncEnd = true;
  try { if (shuffle29) w.SEL.utils.shuffle = shuffle29; } catch (e) {}
  try { w.SEL_DATA.expression.dailyStarCap = cap29; } catch (e) {}
  try { if (ctor29) w.SpeechSynthesisUtterance = ctor29; } catch (e) {}
  try { w.SEL.audio.stopSpeak(); } catch (e) {}
  try { if (backup29) w.SEL.state.importSave(backup29); } catch (e) {}
}

/* ==================== 30. v1.3.0：逐句点读 / 角色语音 / 双示范 ==================== */
let getVoices30 = null, backup30 = null;
try {
  const A = w.SEL.audio;
  const UI30 = w.SEL.ui;
  backup30 = w.SEL.state.exportSave();
  getVoices30 = w.speechSynthesis.getVoices;
  const spoken = () => utterances.map(u => u.text);
  const levels30 = w.SEL.state.allLevels();
  const choiceLv = levels30.find(x => x.level.type === 'choice').level;
  const storyLv = levels30.find(x => x.level.type === 'story').level;
  w.SEL.state.clearPin();
  w.SEL.state.update(p => {
    p.stars = 999;
    levels30.forEach(x => { p.levels[x.level.id] = { done: true, stars: 3, attempts: 1, lastAt: '2026-01-01' }; });
  });
  w.SEL.state.setSetting('voice', true);
  w.SEL.state.setSetting('autoRead', true);
  w.SEL.state.setSetting('voiceRate', 0.9);
  w.SEL.state.setSetting('voiceRoles', true);
  function freshRoute(hash) {
    utterances.length = 0;
    A.clearLog();
    route(hash);
    return spoken();
  }

  // 30a 数据：31 组双示范 + 三位角色音高各不相同
  {
    const exD = w.SEL_DATA.expression;
    must(exD.prompts.every(p => p.demoAdult && p.demoAdult !== p.demo), '情境卡缺少「对大人说」示范');
    const keys = Object.keys(exD.levelPrompts);
    must(keys.length === 19, '关卡话题数量不对');
    must(keys.every(k => exD.levelPrompts[k].demoAdult && exD.levelPrompts[k].demoAdult !== exD.levelPrompts[k].demo),
      '关卡话题缺少「对大人说」示范');
    const vr = w.SEL_DATA.voiceRoles;
    must(new Set(['cloud', 'owl', 'fox'].map(k => vr[k].pitch)).size === 3 &&
      new Set(['cloud', 'owl', 'fox'].map(k => vr[k].rate)).size === 3, '三位角色的音高/语速没区分开');
    must(A.roleForSpeaker('咕咕老师') === 'owl' && A.roleForSpeaker('小火苗') === 'fox' &&
      A.roleForSpeaker('团团') === 'cloud', '说话人到角色的映射不对');
  }

  // 30b 逐句点读：非交互文本随时可点并高亮；交互选项只在点读模式下才读
  {
    freshRoute('#/level/' + choiceLv.id);
    const prompt = q('.game-prompt');
    const option = q('.option-btn');
    must(!!prompt && prompt.hasAttribute('data-read'), '题干没有标成可点读');
    must(!!prompt && prompt.hasAttribute('data-say'), '非交互题干应随时可点读');
    must(!!option && option.hasAttribute('data-read') && !option.hasAttribute('data-say'),
      '交互选项不该在正常模式下抢朗读');
    syncEnd = false;
    utterances.length = 0;
    click(prompt);
    must(spoken().some(t => t.includes(String(choiceLv.data.prompt).slice(0, 8))), '点题干没有朗读');
    must(prompt.classList.contains('reading'), '点读后没有高亮当前句');
    A.stopSpeak();
    must(!prompt.classList.contains('reading'), '打断朗读后高亮没有清除');
    syncEnd = true;
  }

  // 30c 自动读题时高亮跟着一句一句走；打断后清除
  {
    syncEnd = false;
    freshRoute('#/level/' + choiceLv.id);
    must(!!q('.reading'), '自动读题没有高亮正在读的句子');
    A.stopSpeak();
    must(!q('.reading'), '打断自动读题后仍残留高亮');
    syncEnd = true;
    freshRoute('#/level/' + choiceLv.id);
    const opt = q('.option-btn');
    const optText = opt.getAttribute('data-read');
    must(!!optText && optText.indexOf('做法') < 0, '可点读文本仍带着选项装饰文字');
    UI30.highlight('做法 1：' + optText);
    must(opt.classList.contains('reading'), '读到选项时没有高亮对应选项（前缀/emoji 匹配失败）');
    UI30.clearHighlight();
    utterances.length = 0;
    click(q('.game-prompt'));
    must(spoken().length === 1, '点一句非交互文本触发了不止一次朗读');
    must(q('.game-prompt').getAttribute('data-role') === 'cloud', '手动点读没有默认用团团的声音');
    const gpPitch = utterances[0] && utterances[0].pitch;
    must(gpPitch === w.SEL_DATA.voiceRoles.cloud.pitch, '手动点读没有应用角色音高');
  }

  // 30d 点读模式：点选项只念不选，退出后恢复正常交互
  {
    freshRoute('#/level/' + choiceLv.id);
    click(q('[data-read-toggle]'));
    must(UI30.isReadMode(), '点读模式没有打开');
    utterances.length = 0;
    click(q('.option-btn'));
    must(!q('.feedback-box'), '点读模式下点选项仍然触发了选择');
    must(spoken().length > 0, '点读模式下点选项没有朗读');
    click(q('[data-read-toggle]'));
    must(!UI30.isReadMode(), '点读模式没有退出');
    click(q('.option-btn'));
    must(!!q('.feedback-box'), '退出点读模式后选项点不动了');
    route('#/home');
  }

  // 30d-2 点读模式不能吞掉结算按钮 / 篮子 / 说一说提交 / 返回按钮
  {
    const sliderLv = levels30.find(x => x.level.type === 'slider').level;
    const classifyLv = levels30.find(x => x.level.type === 'classify').level;
    freshRoute('#/level/' + sliderLv.id);
    click(q('[data-submit]'));
    must(!!q('[data-finish]'), '温度计关没有出现「收下星星」按钮');
    click(q('[data-read-toggle]'));
    const attemptsBefore = w.SEL.state.current().levels[sliderLv.id].attempts;
    click(q('[data-finish]'));
    must(w.SEL.state.current().levels[sliderLv.id].attempts === attemptsBefore + 1,
      '点读模式吞掉了「收下星星」，关卡无法结算');
    w.SEL.ui.closeModal();

    freshRoute('#/level/' + classifyLv.id);
    click(q('.drag-item'));
    click(q('[data-read-toggle]'));
    const placedBefore = qa('.drag-item[data-placed]').length;
    click(q('.bucket'));
    must(qa('.drag-item[data-placed]').length === placedBefore, '点读模式下点篮子仍触发了放置');
    click(q('[data-read-toggle]'));

    freshRoute('#/level/' + choiceLv.id);
    click(q('[data-read-toggle]'));
    const totalBefore = w.SEL.state.expressionStats().total;
    click(q('[data-say-done]'));
    must(w.SEL.state.expressionStats().total === totalBefore + 1, '点读模式吞掉了「我说出来啦」');
    const back = q('[data-nav^="#/island/"]');
    click(back);
    must(String(w.location.hash).indexOf('#/island/') === 0, '点读模式下返回按钮失灵');
    w.SEL.render();   // jsdom 的 hashchange 是异步的，显式触发一次路由重绘
    must(!UI30.isReadMode(), '换页后点读模式没退出');
  }

  // 30e 角色音高/语速、逐句角色、家长关闭开关
  {
    const pitches = {}, rates = {};
    ['cloud', 'owl', 'fox'].forEach(id => {
      utterances.length = 0;
      A.speak('测试声音', { role: id });
      pitches[id] = utterances[0].pitch;
      rates[id] = utterances[0].rate;
    });
    must(new Set(Object.values(pitches)).size === 3, '三位角色音高没有区别');
    must(new Set(Object.values(rates)).size === 3, '三位角色语速没有区别');
    utterances.length = 0;
    A.speakSequence([{ text: '团团说', role: 'cloud' }, { text: '咕咕说', role: 'owl' }]);
    must(utterances.length === 2 && utterances[0].pitch !== utterances[1].pitch, '逐句角色没有生效');
    w.SEL.state.setSetting('voiceRoles', false);
    utterances.length = 0;
    A.speak('测试声音', { role: 'fox' });
    must(utterances[0].pitch === 1.12, '关掉角色化语音后仍用了角色音高');
    w.SEL.state.setSetting('voiceRoles', true);
    w.SEL.state.setSetting('voiceRate', 1.2);
    utterances.length = 0;
    A.readAutoOne('试听', { role: 'fox' });
    must(Math.abs(utterances[0].rate - 1.2 * w.SEL_DATA.voiceRoles.fox.rate) < 0.001,
      '自动朗读没有把家长语速与角色倍率相乘');
    w.SEL.state.setSetting('voiceRate', 0.9);
  }

  // 30f 中文语音状态三态 + 家长提示 + 设置页试听
  {
    w.speechSynthesis.getVoices = () => [{ lang: 'en-US', name: 'English' }];
    must(A.voiceStatus().state === 'missing', '只有英文语音时应报 missing');
    const hint = UI30.voiceHint(false);
    must(hint.includes('Windows') && hint.includes('试听一句'), '缺语音时没有给家长安装指引');
    route('#/settings');
    must(!!q('[data-voice-status]'), '设置页缺少中文语音状态卡');
    must(qa('[data-role-test]').length === 3, '设置页没有三个角色试听按钮');
    utterances.length = 0;
    click(q('[data-voice-test]'));
    must(spoken().length > 0, '家长试听按钮没有朗读');
    w.speechSynthesis.getVoices = () => [{ lang: 'zh-CN', name: 'Huihui' }];
    must(A.voiceStatus().state === 'ok', '检测到中文语音时应报 ok');
    must(UI30.voiceHint(false) === '', '有中文语音时仍显示缺语音提示');
    w.speechSynthesis.getVoices = () => [];
    must(A.voiceStatus().state === 'unknown', '语音清单为空时应报 unknown');
    must(UI30.voiceHint(false) === '', 'unknown 状态不该误报给家长');

    /* voiceschanged 常常晚到：关卡页与设置页都要局部刷新，且不能整页重绘掐断试听 */
    freshRoute('#/level/' + choiceLv.id);
    must(!q('[data-voice-hint]'), 'unknown 时关卡页不该显示语音提示');
    w.speechSynthesis.getVoices = () => [{ lang: 'en-US', name: 'English' }];
    if (w.__voicesChanged) w.__voicesChanged();
    must(!!q('[data-voice-hint]'), 'voiceschanged 后关卡页没有出现家长提示');
    w.speechSynthesis.getVoices = () => [{ lang: 'zh-CN', name: 'Huihui' }];
    if (w.__voicesChanged) w.__voicesChanged();
    must(!q('[data-voice-hint]'), '语音就绪后关卡页的提示没有撤掉');

    route('#/settings');
    w.speechSynthesis.getVoices = () => [{ lang: 'en-US', name: 'English' }];
    if (w.__voicesChanged) w.__voicesChanged();
    must(!!q('[data-voice-status] [data-voice-hint]'), '设置页状态卡没有随 voiceschanged 局部刷新');
    w.speechSynthesis.getVoices = () => [{ lang: 'zh-CN', name: 'Huihui' }];
    if (w.__voicesChanged) w.__voicesChanged();
    must(!q('[data-voice-status] [data-voice-hint]'), '语音就绪后设置页提示没有撤掉');
  }

  // 30g 双示范切换：文本/点读/朗读/计次/家长统计全链路
  {
    route('#/express/ex-1');
    const card = q('[data-say-card]');
    must(card.getAttribute('data-variant') === 'peer', '默认示范不是「对同伴说」');
    const demoP = q('[data-say-demo-text]');
    const peerText = demoP.textContent;
    click(q('[data-variant="adult"]'));
    must(card.getAttribute('data-variant') === 'adult', '没有切到「对大人说」');
    must(demoP.textContent !== peerText, '切换后示范句没有变');
    must(demoP.getAttribute('data-read') === demoP.textContent, '切换示范后逐句点读文本没更新');
    utterances.length = 0;
    click(q('[data-say-demo]'));
    must(spoken()[0] === demoP.textContent, '听示范读的不是当前选中的那一句');
    const beforeAdult = w.SEL.state.expressionStats().variants.adult;
    click(q('[data-say-done]'));
    must(w.SEL.state.expressionStats().variants.adult === beforeAdult + 1, '没有记下 adult 变体');
    const parentHtml = route('#/parent');
    must(parentHtml.includes('对大人说'), '家长面板没有显示双示范统计');
    route('#/level/' + choiceLv.id);
    must(!!q('[data-say-card] [data-variant="adult"]'), '关卡页的说一说卡缺少双示范切换');
  }

  // 30h 导入清洗 / 偏好保留 / 换页复位
  {
    const backup = JSON.parse(w.SEL.state.exportSave());
    backup.profiles[0].expression.variants = JSON.parse('{"peer":-5,"adult":999999,"__proto__":7}');
    backup.profiles[0].settings.voiceRoles = 'yes';
    w.SEL.state.importSave(JSON.stringify(backup));
    const v = w.SEL.state.current().expression.variants;
    must(Object.keys(v).join(',') === 'peer,adult', 'variants 里混入了未知键');
    must(v.peer === 0, 'variants 负数没有清洗');
    must(w.SEL.state.current().settings.voiceRoles === true, '非法 voiceRoles 没有回落默认值');
    w.SEL.state.setSetting('voiceRoles', false);
    w.SEL.state.resetProfile(w.SEL.state.current().id);
    must(w.SEL.state.current().settings.voiceRoles === false, '清空进度把角色化语音偏好也清掉了');
    UI30.setReadMode(true);
    route('#/home');
    must(!UI30.isReadMode(), '换页后点读模式没有自动退出');
    must(!q('.reading'), '换页后仍残留高亮');
  }

  w.SEL.state.importSave(backup30);
} catch (e) {
  fails.push('回归组30异常: ' + (e && e.stack || e));
} finally {
  syncEnd = true;
  try { if (getVoices30) w.speechSynthesis.getVoices = getVoices30; } catch (e) {}
  try { w.SEL.state.setSetting('voiceRoles', true); } catch (e) {}
  try { w.SEL.ui.setReadMode(false); w.SEL.ui.clearHighlight(); } catch (e) {}
  try { w.SEL.audio.stopSpeak(); } catch (e) {}
  try { if (backup30) w.SEL.state.importSave(backup30); } catch (e) {}
}

/* ==================== 31. 封板故障注入：异步语音 / 禁用控件 / 弹窗 / 畸形数据 ==================== */
let backup31 = null, frames31 = null, prompts31 = null, cap31 = 3;
try {
  const A = w.SEL.audio;
  const UI31 = w.SEL.ui;
  const U31 = w.SEL.utils;
  backup31 = w.SEL.state.exportSave();
  frames31 = w.SEL_DATA.expression.frames;
  prompts31 = w.SEL_DATA.expression.prompts;
  cap31 = w.SEL_DATA.expression.dailyStarCap;
  const spoken = () => utterances.map(u => u.text);
  const levels31 = w.SEL.state.allLevels();
  const choiceLv = levels31.find(x => x.level.type === 'choice').level;
  const matchLv = levels31.find(x => x.level.type === 'match').level;
  const storyLv = levels31.find(x => x.level.type === 'story').level;
  w.SEL.state.clearPin();
  w.SEL.state.update(p => {
    p.stars = 999;
    levels31.forEach(x => { p.levels[x.level.id] = { done: true, stars: 3, attempts: 1, lastAt: '2026-01-01' }; });
  });
  w.SEL.state.setSetting('voice', true);
  w.SEL.state.setSetting('autoRead', true);
  w.SEL.state.setSetting('voiceRate', 0.9);
  w.SEL.state.setSetting('voiceRoles', true);
  function freshRoute(hash) {
    utterances.length = 0;
    A.clearLog();
    route(hash);
    return spoken();
  }

  // 31a 真实异步语音：onend 推进队列，onerror 也要能推进，不能卡死
  {
    syncEnd = false;
    utterances.length = 0;
    A.speakSequence(['A句', 'B句', 'C句']);
    must(spoken().length === 1, '异步语音下队列一次把三句全念了');
    utterances[0].onend();
    must(spoken().length === 2 && spoken()[1] === 'B句', 'onend 没有推进到第二句');
    utterances[1].onerror();
    must(spoken().length === 3 && spoken()[2] === 'C句', 'onerror 没有推进到第三句');
    utterances[2].onend();
    A.stopSpeak();
    syncEnd = true;
  }

  // 31b 慢速语音的 watchdog 估算：rate 越低，超时应该越长（不能固定 300ms/字）
  {
    w.SEL.state.setSetting('voiceRate', 0.7);
    utterances.length = 0;
    A.speak('很长的一句话'.repeat(10), { role: 'owl' });
    must(utterances[0].rate < 0.7, '慢速 + 咕咕老师没有真正降低语速');
    A.stopSpeak();
    w.SEL.state.setSetting('voiceRate', 0.9);
  }

  // 31c disabled 选项：点读模式要临时解除禁用，退出后恢复
  {
    freshRoute('#/level/' + choiceLv.id);
    const opts = qa('.option-btn');
    opts.forEach(b => { b.disabled = true; });
    click(q('[data-read-toggle]'));
    must(opts.every(b => !b.disabled), '点读模式没有解除 disabled，禁用按钮无法点读');
    utterances.length = 0;
    click(opts[1]);
    must(spoken().length === 1, '点读模式下点已禁用选项没有朗读');
    must(!q('.feedback-box'), '点读模式下点已禁用选项仍触发了选择');
    click(q('[data-read-toggle]'));
    must(opts.every(b => b.disabled), '退出点读模式后没有恢复禁用状态');
  }

  // 31d emoji 装饰清理与高亮打分
  {
    freshRoute('#/level/' + matchLv.id);
    const right = q('.pair-item[data-side="R"]');
    const rightText = right.getAttribute('data-read');
    must(!!rightText && rightText.indexOf('😊') < 0, '右侧卡片文本仍带着 emoji，高亮会漏命中');
    UI31.highlight('答案：' + rightText);
    must(right.classList.contains('reading'), '念「答案：…」时没有高亮右侧卡片');
    UI31.clearHighlight();
    UI31.highlight('就一种');
    must(!right.classList.contains('reading'), '短公共子串误高亮了不相关元素');
    UI31.clearHighlight();
  }

  // 31e 故事：role 只挂正文区，反馈框可点读
  {
    freshRoute('#/level/' + storyLv.id);
    must(!!q('.story-top').getAttribute('data-role'), '故事正文区没有角色标记');
    must(!q('[data-story]').hasAttribute('data-role'), '角色挂到整个 panel 会被做法继承');
    const choices = qa('.story-choices .option-btn');
    if (choices.length) {
      must(choices.every(b => b.getAttribute('data-role') === 'cloud'), '故事做法没有统一用团团的声音');
      click(choices[0]);
      const fb = q('.feedback-box');
      must(!!fb && fb.hasAttribute('data-read'), '故事反馈框没有标成可点读');
    }
  }

  // 31f 键盘逐句点读
  {
    freshRoute('#/level/' + choiceLv.id);
    const gp = q('.game-prompt');
    must(gp.getAttribute('tabindex') === '0' && gp.getAttribute('role') === 'button',
      '非交互文本对键盘/读屏不可达');
    utterances.length = 0;
    gp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    must(spoken().length === 1, 'Enter 没有触发逐句点读');
  }

  // 31g 弹窗 / 时间锁出现时，朗读、高亮、点读模式都要复位
  {
    freshRoute('#/level/' + choiceLv.id);
    UI31.highlight(String(choiceLv.title));
    UI31.setReadMode(true);
    must(!!q('.reading') && UI31.isReadMode(), '前置条件：高亮与点读模式未生效');
    w.SEL.ui.modal({ title: '测试弹窗', body: '<p>x</p>',
      actions: [{ label: '关闭', cls: 'ghost', close: true }] }, function () {});
    must(!UI31.isReadMode(), '弹窗打开后点读模式没退出');
    must(!q('.reading'), '弹窗打开后仍残留高亮');
    w.SEL.ui.closeModal();

    UI31.highlight(String(choiceLv.title));
    UI31.setReadMode(true);
    w.SEL.state.setSetting('screenLimit', 15);
    w.SEL.state.addUsage(16 * 60);
    w.SEL.render();
    const lock = q('#time-lock');
    must(!!lock && !lock.hidden, '前置条件：时间锁没盖上');
    must(!UI31.isReadMode() && !q('.reading'), '时间锁盖上后仍残留朗读状态/高亮/点读模式');
    w.SEL.state.setSetting('screenLimit', 0);
    w.SEL.render();
  }

  // 31h 未来日期清洗与「本周」上界
  {
    const future = U31.addDays(U31.today(), 30);
    const b = JSON.parse(w.SEL.state.exportSave());
    b.profiles[0].expression.days = [{ date: U31.today(), count: 2 }, { date: future, count: 99 }];
    w.SEL.state.importSave(JSON.stringify(b));
    must(w.SEL.state.expressionStats().week === 2, '未来日期被算进本周次数');
    must((w.SEL.state.current().expression.days || []).length === 1, '导入时没有丢弃未来日期');
  }

  // 31i 课程数据畸形：合法话题不能被静默拒写；UI 按钮不能永久锁死
  {
    w.SEL_DATA.expression.frames = { feel: true };
    must(!!w.SEL.state.recordExpression('ex-1', 'feel', 'peer'), 'frames 畸形把合法话题一起拒写了');
    w.SEL_DATA.expression.frames = frames31;

    route('#/express/ex-1');
    const done = q('[data-say-done]');
    w.SEL_DATA.expression.prompts = [];
    click(done);
    must(!done.disabled, '课程数据异常时「我说出来啦」按钮永久锁死');
    w.SEL_DATA.expression.prompts = prompts31;
  }

  // 31j 上限文案与口径：改配置后家长面板也要跟着变
  {
    w.SEL_DATA.expression.dailyStarCap = 5;
    const ph = route('#/parent');
    must(ph.includes('同一天最多 5 颗勇气星'), '家长面板把每日上限写死成 3');
    must(w.SEL.state.dailyCap() === 5, 'state.dailyCap() 没有读到新配置');
    w.SEL_DATA.expression.dailyStarCap = cap31;
  }

  w.SEL.state.importSave(backup31);
} catch (e) {
  fails.push('回归组31异常: ' + (e && e.stack || e));
} finally {
  syncEnd = true;
  try { w.SEL_DATA.expression.frames = frames31 || w.SEL_DATA.expression.frames; } catch (e) {}
  try { w.SEL_DATA.expression.prompts = prompts31 || w.SEL_DATA.expression.prompts; } catch (e) {}
  try { w.SEL_DATA.expression.dailyStarCap = cap31; } catch (e) {}
  try { w.SEL.state.setSetting('screenLimit', 0); } catch (e) {}
  try { w.SEL.ui.setReadMode(false); w.SEL.ui.clearHighlight(); w.SEL.audio.stopSpeak(); } catch (e) {}
  try { if (backup31) w.SEL.state.importSave(backup31); } catch (e) {}
}

const levelCount = (w.SEL_DATA.islands || []).reduce((a, i) => a + i.levels.length, 0);
console.log('=== 心晴岛 运行时冒烟测试 ===');
console.log(`页面/关卡覆盖: 12 页 + ${(w.SEL_DATA.islands || []).length} 岛 + ${levelCount} 关`);
if (runtimeErrors.length) {
  console.log(`\n--- 运行时报错 (${runtimeErrors.length}) ---`);
  [...new Set(runtimeErrors)].slice(0, 15).forEach(e => console.log('  x ' + e));
}
if (fails.length) {
  console.log(`\n--- 失败 (${fails.length}) ---`);
  [...new Set(fails)].forEach(f => console.log('  x ' + f));
} else if (!runtimeErrors.length) {
  console.log(`\n✅ 全部页面、${levelCount} 个关卡、签到闭环、7 种题型、解锁链路、存档导入、家长面板，1.1.x / 1.2.0 功能与 1.3.x 朗读 / 点读 / 角色语音 / 双示范 / 故障注入均通过`);
}
process.exit(fails.length || runtimeErrors.length ? 1 : 0);
