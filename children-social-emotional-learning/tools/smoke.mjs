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

function must(cond, msg) { if (!cond) fails.push(msg); }

try {
  /* --- 所有页面 --- */
  const pages = [
    '#/home', '#/map', '#/emotions', '#/checkin', '#/strategies',
    '#/garden', '#/stickers', '#/parent', '#/profile', '#/settings'
  ];
  pages.forEach(h => route(h));
  const islands = (w.SEL_DATA.islands || []);
  islands.forEach(i => route('#/island/' + i.id, '岛屿 ' + i.id));

  /* --- 所有关卡都能渲染 + 挂载 --- */
  const levels = [];
  islands.forEach(i => (i.levels || []).forEach(l => levels.push({ island: i, lv: l })));
  levels.forEach(({ lv }) => route('#/level/' + lv.id, '关卡 ' + lv.id));

  /* --- 每日签到完整 4 步 --- */
  const before = w.SEL.state.current().checkins.length;
  route('#/checkin');
  click(q('[data-pick="0"]'));
  must(!!q('[data-next]'), '签到第 1 步后没有下一步按钮');
  click(q('[data-next]'));
  must(!!q('[data-range]'), '签到第 2 步缺强度滑块');
  click(q('[data-next]'));
  must(!!q('[data-practice]'), '签到第 3 步缺策略练习入口');
  click(q('[data-next]'));
  must(!!q('[data-plant]'), '签到第 4 步缺种花按钮');
  click(q('[data-plant]'));
  const after = w.SEL.state.current().checkins.length;
  must(after === before + 1, `签到未写入存档: ${before} -> ${after}`);
  must(!!q('.modal'), '签到完成弹窗未出现');
  w.SEL.ui.closeModal();

  /* --- 情境选择关卡：选择 → 反馈 → 收星星 → 存档 --- */
  const choiceLv = levels.find(x => x.lv.type === 'choice');
  if (choiceLv) {
    const starsBefore = w.SEL.state.current().stars;
    route('#/level/' + choiceLv.lv.id);
    click(q('.option-btn'));
    must(!!q('.feedback-box'), '情境选择后没有即时反馈');
    must(!!q('[data-finish]'), '情境选择后没有完成按钮');
    click(q('[data-finish]'));
    must(w.SEL.state.current().stars > starsBefore, '完成关卡后星星未增加');
    must(!!q('.modal'), '关卡完成弹窗未出现');
    w.SEL.ui.closeModal();
  } else fails.push('没有情境选择关卡');

  /* --- 配对关卡：逐对点击 --- */
  const matchLv = levels.find(x => x.lv.type === 'match');
  if (matchLv) {
    route('#/level/' + matchLv.lv.id);
    qa('.pair-item[data-side="L"]').forEach(l => {
      const key = l.getAttribute('data-key');
      click(l);
      click(q(`.pair-item[data-side="R"][data-key="${key}"]`));
    });
    must(!!q('[data-finish]'), '配对全部完成后没有完成按钮');
  } else fails.push('没有配对关卡');

  /* --- 排序关卡：按正确答案重排 --- */
  const orderLv = levels.find(x => x.lv.type === 'order');
  if (orderLv) {
    route('#/level/' + orderLv.lv.id);
    const answer = orderLv.lv.data.answer;
    const list = q('[data-order-list]');
    answer.forEach(id => {
      const el = qa('.order-item').find(x => x.getAttribute('data-id') === id);
      if (el) list.appendChild(el);
    });
    click(q('[data-check]'));
    must(!!q('[data-finish]'), '排序正确后没有完成按钮');
  } else fails.push('没有排序关卡');

  /* --- 滑块 / 分类 / 呼吸 / 故事 --- */
  const byType = t => levels.find(x => x.lv.type === t);
  ['slider', 'classify', 'breathe', 'story'].forEach(t => {
    const x = byType(t);
    if (!x) { fails.push('缺少题型 ' + t); return; }
    route('#/level/' + x.lv.id, '题型 ' + t);
    if (t === 'slider') { click(q('[data-submit]')); must(!!q('[data-finish]'), '滑块提交后没有完成按钮'); }
    if (t === 'classify') {
      qa('.drag-item').forEach(item => {
        click(item);
        click(q(`.bucket[data-bucket-id="${item.getAttribute('data-bucket')}"]`));
      });
      must(!!q('[data-finish]'), '分类完成后没有完成按钮');
    }
    if (t === 'breathe') { click(q('[data-stop]')); must(!!q('[data-finish]'), '呼吸提前结束后没有完成按钮'); }
    if (t === 'story') {
      for (let i = 0; i < 6 && !q('[data-finish]'); i++) {
        const opt = q('.option-btn:not([disabled])');
        if (!opt) break;
        click(opt);
        const go = q('[data-go]');
        if (go) click(go);
      }
      must(!!q('[data-finish]'), '故事走到结局后没有完成按钮');
    }
  });

  /* --- 家长面板 / 档案 / 设置 --- */
  route('#/parent');
  must(!!q('.kpi-grid'), '家长面板未渲染');
  route('#/profile');
  click(q('[data-avatar="fox"]'));
  must(q('[data-avatar="fox"]').classList.contains('active'), '头像选择无响应');
  route('#/settings');
  const voiceBefore = w.SEL.state.current().settings.voice;
  click(q('[data-toggle="voice"]'));
  must(w.SEL.state.current().settings.voice !== voiceBefore, '设置开关未生效');

  /* --- 顶栏导航 --- */
  route('#/home');
  click(q('.brand'));
  must(!!q('#topbar'), '顶栏导航后顶栏消失');
} catch (e) {
  fails.push('测试流程异常: ' + (e && e.stack || e));
}

console.log('=== 心晴岛 运行时冒烟测试 ===');
console.log('页面/关卡覆盖: 10 页 + ' + (w.SEL_DATA.islands || []).length + ' 岛 + ' +
  (w.SEL_DATA.islands || []).reduce((a, i) => a + i.levels.length, 0) + ' 关');
if (runtimeErrors.length) {
  console.log(`\n--- 运行时报错 (${runtimeErrors.length}) ---`);
  [...new Set(runtimeErrors)].slice(0, 15).forEach(e => console.log('  x ' + e));
}
if (fails.length) {
  console.log(`\n--- 失败 (${fails.length}) ---`);
  [...new Set(fails)].forEach(f => console.log('  x ' + f));
} else if (!runtimeErrors.length) {
  console.log('\n✅ 全部页面、19 个关卡、签到闭环、7 种题型交互、家长面板与存档均通过');
}
process.exit(fails.length || runtimeErrors.length ? 1 : 0);
