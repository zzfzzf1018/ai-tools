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

/* 与 index.html 保持同一加载顺序 */
const scripts = [
  'src/data/curriculum.js', 'src/core/utils.js', 'src/core/audio.js', 'src/core/state.js',
  'src/ui/art.js', 'src/ui/components.js', 'src/ui/games.js', 'src/ui/screens.js', 'src/main.js'
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
    if (t.includes('交互绑定出错')) fails.push(`${label || hash} 事件绑定抛错`);
    return t;
  } catch (e) { fails.push(`${label || hash} 异常: ${e.message}`); return ''; }
}

try {
  /* --- 1. 所有页面 --- */
  const pages = [
    '#/home', '#/map', '#/emotions', '#/checkin', '#/strategies',
    '#/garden', '#/stickers', '#/parent', '#/profile', '#/settings', '#/help'
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
} catch (e) {
  fails.push('测试流程异常: ' + (e && e.stack || e));
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

const levelCount = (w.SEL_DATA.islands || []).reduce((a, i) => a + i.levels.length, 0);
console.log('=== 心晴岛 运行时冒烟测试 ===');
console.log(`页面/关卡覆盖: 11 页 + ${(w.SEL_DATA.islands || []).length} 岛 + ${levelCount} 关`);
if (runtimeErrors.length) {
  console.log(`\n--- 运行时报错 (${runtimeErrors.length}) ---`);
  [...new Set(runtimeErrors)].slice(0, 15).forEach(e => console.log('  x ' + e));
}
if (fails.length) {
  console.log(`\n--- 失败 (${fails.length}) ---`);
  [...new Set(fails)].forEach(f => console.log('  x ' + f));
} else if (!runtimeErrors.length) {
  console.log(`\n✅ 全部页面、${levelCount} 个关卡、签到闭环、7 种题型、解锁链路、存档导入与家长面板均通过`);
}
process.exit(fails.length || runtimeErrors.length ? 1 : 0);
