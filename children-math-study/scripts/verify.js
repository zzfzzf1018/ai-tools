#!/usr/bin/env node
/* ===== 离线自检：语法 / 内容 / 单元递进 / 出题器 / 朗读文本 / 存档兜底 =====
   用法：node scripts/verify.js
   无第三方依赖，也不启动浏览器；把前端脚本放进 VM 沙箱后校验纯逻辑。
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let checks = 0;
const failures = [];

function ok(cond, label, detail) {
  checks++;
  if (!cond) failures.push(label + (detail ? ' → ' + detail : ''));
}
function section(title) { console.log('\n' + title); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- 1. 全部 JS 语法检查 ---------- */
section('1. JS 语法检查');
const jsFiles = [];
for (const dir of ['js', 'content', 'desktop']) {
  const full = path.join(ROOT, dir);
  for (const f of fs.readdirSync(full)) {
    if (f.endsWith('.js')) jsFiles.push(path.join(dir, f));
  }
}
jsFiles.push('scripts/verify.js');
for (const rel of jsFiles) {
  let err = null;
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' }); }
  catch (e) { err = String(e.stderr || e.message).slice(0, 200); }
  ok(!err, `node --check ${rel}`, err);
}
console.log(`   ${jsFiles.length} 个文件`);

/* ---------- 2. 载入全部前端脚本到沙箱 ---------- */
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
const documentStub = {
  readyState: 'loading',       // 阻止 app.js 自动 start()
  addEventListener() {},
  getElementById() { return null; },
  createElement() {
    return {
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      appendChild() {}, addEventListener() {}, style: {}, dataset: {}
    };
  }
};
const ctx = vm.createContext({
  console, setTimeout, clearTimeout, localStorage, document: documentStub,
  location: { hash: '' }, navigator: { userAgent: 'node' }
});
ctx.window = ctx;

const loadOrder = [
  'content/grade1.js', 'content/grade2.js', 'content/grade3.js', 'content/grade4.js', 'content/grade5.js',
  'js/save.js', 'js/speech.js', 'js/data.js', 'js/rewards.js', 'js/explore.js',
  'js/game.js', 'js/practice.js', 'js/variants.js', 'js/shop.js',
  'js/lesson.js', 'js/parent.js', 'js/app.js'
];
for (const rel of loadOrder) {
  let err = null;
  try { vm.runInContext(read(rel), ctx, { filename: rel }); }
  catch (e) { err = e.message; }
  ok(!err, `加载 ${rel}`, err);
  if (err) { console.error(err); process.exit(1); }
}
const { Data, Save, Speech, Practice, Variants, Shop, Game, Lesson, Parent, App, UI, Rewards, Explore } = ctx;
ok(!!(Data && Save && Speech && Practice && Variants && Shop && Game && Lesson && Parent && App && UI && Rewards && Explore),
  '全部模块挂载到 window');

// Data 的解锁判断只读 Save.data.completed，这里先放一个同步桩；
// 第 6 节再用真实 Save.init() 覆盖，验证完整存档链路。
Save.data = {
  player: { name: '测试', avatar: '🦊', createdAt: null },
  stars: {}, completed: {}, wrongBook: [], badges: [], exploreDone: {},
  unitPassed: {}, unitQuiz: {}, daily: {}, stats: { answers: 0, correct: 0 },
  settings: { lastGrade: null, lastLesson: null, sound: true, speech: true, autoRead: true,
    readOptions: true, speechRate: 0.9, speechPitch: 1.05, speechVoiceURI: '' }
};

/* ---------- 3. 内容完整性 ---------- */
section('2. 课程内容完整性');
Data.init();
ok(Data.grades.length === 5, '5 个年级', `实际 ${Data.grades.length}`);
let lessons = 0, questions = 0, units = 0;
const qIssues = [];
for (const g of Data.grades) {
  ok(g.semesters.length === 2, `${g.title} 有 2 个学期`);
  for (const sem of g.semesters) {
    units += sem.units.length;
    for (const unit of sem.units) {
      for (const L of unit.lessons) {
        lessons++;
        for (const game of L.games || []) {
          for (const q of game.questions || []) {
            questions++;
            const tag = `${L.id}/${q.id}`;
            if (!['choice', 'input', 'dragdrop', 'sequence'].includes(q.type)) qIssues.push(`${tag} 未知题型`);
            if (q.answer == null) qIssues.push(`${tag} 缺答案`);
            if (q.type === 'choice' && (!Array.isArray(q.options) || !q.options.map(String).includes(String(q.answer)))) {
              qIssues.push(`${tag} 选项不含答案`);
            }
            if (q.type === 'input' && !Number.isFinite(parseFloat(q.answer))) qIssues.push(`${tag} 输入答案非数字`);
            if (q.type === 'sequence' && (!Array.isArray(q.items) || !Array.isArray(q.answer))) qIssues.push(`${tag} 排序题缺 items/answer`);
            if (q.type === 'sequence' && Array.isArray(q.items) && Array.isArray(q.answer) && q.items.length !== q.answer.length) qIssues.push(`${tag} 排序项与答案数量不符`);
            if (q.type === 'dragdrop' && !String(q.template || '').includes('⬜')) qIssues.push(`${tag} 拖放题缺槽位模板`);
            if (q.type === 'dragdrop') {
              const holes = (String(q.template || '').match(/⬜/g) || []).length;
              const answers = Array.isArray(q.answer) ? q.answer : String(q.answer).split('|');
              const bank = Array.isArray(q.bank) ? q.bank : answers;
              if (holes !== answers.length || bank.length < answers.length) qIssues.push(`${tag} 槽位数/筹码数与答案数不符`);
            }
          }
        }
      }
    }
  }
}
ok(lessons >= 30, '至少 30 课（内容扩充后不误报）', `实际 ${lessons}`);
ok(questions >= 312, '至少 312 题（内容扩充后不误报）', `实际 ${questions}`);
ok(units >= 10, '单元数 >= 10', `实际 ${units}`);
ok(qIssues.length === 0, '题目字段全合法', qIssues.slice(0, 5).join(' | '));
console.log(`   ${Data.grades.length} 年级 / ${units} 单元 / ${lessons} 课 / ${questions} 题`);

/* ---------- 4. 单元递进与解锁链 ---------- */
section('3. 单元递进（跨单元、跨学期连续解锁）');
const keys = Data.allUnitKeys();
ok(new Set(keys).size === keys.length, '单元 key 全局唯一', `${keys.length} 个`);
for (const g of Data.grades) {
  const path = Data.pathOf(g.grade);
  ok(path.length === 6, `${g.title} 路径 6 课`, `实际 ${path.length}`);
  ok(path.every((e, i) => e.order === i), `${g.title} 路径序号连续`);
  ok(path.every(e => !!e.unitKey && e.semesterIndex >= 0), `${g.title} 每课带单元与学期信息`);
  ok(Data.isUnlocked(path[0].lesson.id), `${g.title} 第一课默认解锁`);
  ok(path.slice(1).every(e => !Data.isUnlocked(e.lesson.id)),
    `${g.title} 空进度时后续课程全部锁定（旧版跨单元重置的回归校验）`);
}
// 逐个完成，验证每一步只解锁下一课
Save.data.completed = {};
const p1 = Data.pathOf(1);
for (let i = 0; i < p1.length; i++) {
  const target = p1[i].lesson.id;
  ok(Data.isUnlocked(target), `一年级第 ${i + 1} 课按顺序解锁`, target);
  ok(Data.nextToLearn(1).lesson.id === target, `一年级推荐下一课 = 第 ${i + 1} 课`, target);
  Save.data.completed[target] = true;
}
ok(Data.nextToLearn(1).lesson.id === p1[p1.length - 1].lesson.id, '全部完成后推荐复习最后一课');

// 三年级有 2 个单元：验证"完成上一单元才解锁下一单元"
const p3 = Data.pathOf(3);
const u2first = p3.find(e => e.unitIndex === 1 && e.semesterIndex === 0);
ok(!!u2first, '三年级上存在第二单元');
if (u2first) {
  Save.data.completed = {};
  for (const e of p3.filter(x => x.semesterIndex === 0 && x.unitIndex === 0)) Save.data.completed[e.lesson.id] = true;
  ok(Data.isUnlocked(u2first.lesson.id), '完成上一单元后解锁下一单元第一课');
  const up1 = Data.unitProgress(p3[0].unitKey);
  ok(up1.allDone && up1.state === 'done', '第一单元状态 = 已通关');
  ok(Data.unitProgress(u2first.unitKey).state === 'ready', '第二单元状态 = 待开始（已解锁）');
  const quizQs = Data.unitQuestions(p3[0].unitKey, 2, 10);
  ok(quizQs.length > 0 && new Set(quizQs.map(q => q.id)).size === quizQs.length,
    '单元组卷抽题且题 id 不重复', `${quizQs.length} 题`);
}

/* ---------- 5. 动态口算出题器 ---------- */
/* ---------- 4. 复审回归：题目守卫 / 朗读实体 / 无语音降级 ---------- */
section('4. 复审回归：题目守卫与朗读兜底');
const NQ = Game._normalizeQuestion;
ok(NQ(null) === null, '空题被丢弃');
ok(NQ({ type: 'choice', prompt: 'x' }) === null, '缺答案的题被丢弃');
const inj = NQ({
  id: 'x', type: 'choice', prompt: '<img src=x onerror=alert(1)>',
  answer: '<b>5</b>', options: ['<b>5</b>', '6'], hints: ['<script>bad()</script>']
});
ok(inj && !/<img|<b>|<script/.test(inj.prompt + inj.options.join('') + inj.hints.join('')),
  '题目文本已转义，存档注入进不了 HTML');
ok(inj && inj.options.includes(inj.answer), '转义后答案仍与选项一致');
const c1 = NQ({ id: 'x', type: 'choice', answer: '7' });
ok(c1 && c1.options.includes('7') && c1.options.length >= 2, '选择题缺选项时自动补齐');
const i1 = NQ({ id: 'x', type: 'input', answer: '汉字' });
ok(i1 && i1.type === 'choice', '输入题非数字答案降级为可作答的选择题');
const s1 = NQ({ id: 'x', type: 'sequence', answer: ['1', '2'], items: ['1'] });
ok(s1 && s1.type === 'choice', '排序题长度不符时降级');
const d1 = NQ({ id: 'x', type: 'dragdrop', template: '⬜ + ⬜ = 5', answer: ['2'] });
ok(d1 && d1.type === 'choice', '拖放题槽位数与答案数不符时降级');
const d2 = NQ({ id: 'x', type: 'dragdrop', template: '3 + ⬜ = 7', answer: ['4'], bank: ['4', '5'] });
ok(d2 && d2.type === 'dragdrop', '合法拖放题原样保留');
ok(/乘/.test(Speech._toSpeakText('12 ✖ 3')), '✖ 不会被图形清洗规则吞掉');
ok(!/&lt;|&gt;/.test(Speech._toSpeakText('&lt;b&gt;有几颗&lt;/b&gt;')), 'HTML 实体还原后再去标签');
ok(Speech.supported === false && Speech.canAural() === false, '无 TTS 环境不会隐藏听算题目');
const emojiOpt = Speech.optionText('🍉🍉🍉🍉🍉');
ok(/5 个图案/.test(emojiOpt), '纯图形选项读出数量', emojiOpt);

section('5. 动态出题器（普通 / 听算）');
const genIssues = [];
let genCount = 0;
for (let g = 1; g <= 5; g++) {
  for (const aural of [false, true]) {
    for (let i = 0; i < 300; i++) {
      const q = Practice._buildQuestion(g, aural, i);
      genCount++;
      const tag = `g${g}/${aural ? '听算' : '普通'}/${i}`;
      const ans = String(q.answer);
      if (!Number.isFinite(parseFloat(ans))) genIssues.push(`${tag} 答案非数字：${ans}`);
      if (aural && (q.type !== 'input' || q.aural !== true)) genIssues.push(`${tag} 听算题必须是输入题`);
      if (aural && /下面哪个数/.test(q.prompt)) genIssues.push(`${tag} 听算题不应出现判断类题`);
      if (q.type === 'choice') {
        if (!Array.isArray(q.options) || q.options.length !== 4) genIssues.push(`${tag} 选项数不是 4`);
        else {
          if (!q.options.map(String).includes(ans)) genIssues.push(`${tag} 选项不含答案 ${ans}`);
          if (new Set(q.options.map(String)).size !== q.options.length) genIssues.push(`${tag} 选项重复`);
        }
        // 因数判断题：4 个选项里必须恰好一个真因数
        const m = q.prompt.match(/下面哪个数是 (\d+) 的因数/);
        if (m) {
          const n = Number(m[1]);
          const real = q.options.filter(x => n % Number(x) === 0);
          if (real.length !== 1 || String(real[0]) !== ans) genIssues.push(`${tag} 因数题选项不唯一：${q.options}`);
        }
      }
      if (!Array.isArray(q.hints) || q.hints.length < 2) genIssues.push(`${tag} 缺提示阶梯`);
    }
  }
}
ok(genIssues.length === 0, `${genCount} 道生成题全部合法`, genIssues.slice(0, 5).join(' | '));
const choiceQs = Practice._makeChoices('7', 4);
ok(choiceQs.length === 4 && choiceQs.includes('7') && new Set(choiceQs).size === 4, '干扰项不重复且含答案');
console.log(`   共生成 ${genCount} 道题`);

/* ---------- 6. 语音朗读文本清洗 ---------- */
section('6. 语音朗读文本清洗');
const t1 = Speech._toSpeakText('3 + ⬜ = 7');
ok(/加/.test(t1) && /等于/.test(t1) && /几/.test(t1), '算式符号转中文读法', t1);
ok(!/⬜/.test(t1), '填空位已转成「几」', t1);
ok(/3 点 1 4/.test(Speech._toSpeakText('3.14')), '小数逐位读', Speech._toSpeakText('3.14'));
ok(/2 分之 1/.test(Speech._toSpeakText('1/2')), '分数按中文语序读', Speech._toSpeakText('1/2'));
ok(/乘/.test(Speech._toSpeakText('12 × 3 = 36')), '乘号读法');
ok(/除以/.test(Speech._toSpeakText('24 ÷ 6 = 4')), '除号读法');
ok(Speech._toSpeakText('🍓🍓🍓 <b>有几颗</b>？').replace(/[\s，。？]/g, '').length <= 4,
  'emoji / HTML 标签已清理', Speech._toSpeakText('🍓🍓🍓 <b>有几颗</b>？'));
ok(Speech.supported === false, 'Node 环境无 TTS 时安全降级（supported=false）');
ok(Speech._toSpeakText('').length === 0, '空文本不报错');

/* ---------- 7. 存档兜底与统计 ---------- */
/* ---------- 7. 错题同类题变式 + 星星商店 ---------- */
section('7. 错题同类题变式与星星商店');
const DV = Variants._deriveFromQuestion;
const vd1 = DV({ prompt: '算一算：3 + 5 = ⬜', answer: '8' });
ok(vd1 && /算一算/.test(vd1.prompt) && Number.isFinite(parseFloat(vd1.answer)),
  '算式题保留原措辞、替换数字并重算答案', vd1 && vd1.prompt);
ok(vd1 && vd1.prompt !== '算一算：3 + 5 = ⬜', '变形确实换了一组数字');
const vd2 = DV({ prompt: '凑十：8 + ⬜ = 10', answer: '2' });
ok(vd2 && vd2.prompt.includes('⬜') && Number.isFinite(parseFloat(vd2.answer)), '缺数算式保留填空位');
ok(DV({ prompt: '一共有几颗草莓？', answer: '6' }) === null, '情景题不做硬替换，交给知识点池');
ok(Variants._conceptsToKinds('小数的意义与加减法', 4).includes('decimalAdd'), '知识点映射到同结构生成器');
const vWrong = {
  lessonId: 'g1l1', qid: 'q1', type: 'choice', prompt: '一共有几颗草莓？',
  answer: '6', options: ['5', '6', '7'], hints: []
};
const vSet = Variants._forWrong(vWrong);
ok(vSet.questions.length >= 3, '单题变式生成足量题目', String(vSet.questions.length));
ok(vSet.questions.every(q => q.type === 'choice'
  ? (Array.isArray(q.options) && q.options.map(String).includes(String(q.answer)))
  : Number.isFinite(parseFloat(q.answer))), '变式题答案可作答且选项含答案');
ok(vSet.questions.every(q => Array.isArray(q.hints) && q.hints.length >= 2), '变式题带提示阶梯');
const allV = Variants._forAll([
  vWrong,
  { lessonId: 'g2l1', qid: 'q1', type: 'input', prompt: '算一算：4 × 5 = ⬜', answer: '20', hints: [] }
]);
ok(allV.questions.length >= 4 &&
  new Set(allV.questions.map(q => q.id)).size === allV.questions.length,
  '多知识点组卷题 id 不重复', String(allV.questions.length));
ok(Shop.items.length >= 12 &&
  Shop.items.every(it => it.id && it.type && Number.isFinite(it.price) && it.price >= 0),
  '商店商品结构合法');
ok(Shop.items.filter(it => it.price === 0).length === 2, '两件免费基础款恒定拥有');
ok(new Set(Shop.items.map(it => it.id)).size === Shop.items.length, '商品 id 唯一');
ok(Rewards.badges.length >= 12, '勋章体系已扩展', String(Rewards.badges.length));

// 全库抽样：真实题目里「保留措辞换数字」的覆盖率与公式正确性
let vHit = 0, vFormula = 0;
const formulaIssues = [];
const fOne = Variants._formulas.one, fTwo = Variants._formulas.two;
for (const g of Data.grades) {
  for (const sem of g.semesters) for (const unit of sem.units) for (const L of unit.lessons) {
    for (const game of (L.games || [])) for (const q of (game.questions || [])) {
      const d = Variants._deriveFromQuestion(q);
      if (!d) continue;
      vHit++;
      if (!d.prompt || d.prompt === q.prompt || !Number.isFinite(parseFloat(d.answer))) {
        formulaIssues.push(`${L.id}/${q.id} 变形结果异常`);
      }
      if (d._formula && d._nums) {
        vFormula++;
        const f = d._nums.length === 1
          ? fOne.find(x => x.k === d._formula)
          : fTwo.find(x => x.k === d._formula);
        const computed = f ? (d._nums.length === 1 ? f.f(d._nums[0]) : f.f(d._nums[0], d._nums[1])) : NaN;
        if (!f || computed !== Number(d.answer)) {
          formulaIssues.push(`${L.id}/${q.id} 公式 ${d._formula} 与答案不符`);
        }
      }
    }
  }
}
ok(vHit >= 78, '同结构变形覆盖足够多的真实题目（>=25%）', `${vHit}/312`);
ok(vFormula >= 30, '情景题通过唯一算术关系反推变形', `${vFormula} 道`);
ok(formulaIssues.length === 0, '所有变形题答案与公式一致', formulaIssues.slice(0, 3).join(' | '));
console.log(`   ${vHit}/312 道原题可直接变形（其中 ${vFormula} 道为情景题语义反推）`);

section('8. 存档兜底与统计');
(async () => {
  await Save.init();
  const s = Save.data.settings;
  ok(s.speech === true && s.autoRead === true && s.readOptions === true, '语音设置默认值正确');
  ok(Number(s.speechRate) >= 0.5 && Number(s.speechRate) <= 1.6, '语速在合法区间');
  ok(Save.data.unitPassed && Save.data.unitQuiz && Save.data.daily && Save.data.stats, '新增存档字段齐全');

  // 脏存档：非法日期键、settings 被置空、unitQuiz 变数组
  await Save.importSave({
    settings: { speech: null, speechRate: 99, speechVoiceURI: 123 },
    daily: { 'not-a-date': { answers: 5 }, '2026-11-06': { answers: 3, correct: 2 } },
    unitQuiz: [], unitPassed: null, stats: null, wrongBook: [{ lessonId: 'x', qid: 'y' }]
  });
  ok(typeof Save.data.settings.speech === 'boolean', '脏 settings.speech 被兜底');
  ok(Save.data.settings.speechRate <= 1.6, '越界语速被夹到合法区间', String(Save.data.settings.speechRate));
  ok(typeof Save.data.settings.speechVoiceURI === 'string', '音色字段被兜底为字符串');
  ok(!('not-a-date' in Save.data.daily), '非法日期键被剔除');
  ok(!Array.isArray(Save.data.unitQuiz) && typeof Save.data.unitPassed === 'object', '单元记录被兜底为对象');

  await Save.reset();
  ok(Save.data.stats.answers === 0 && Object.keys(Save.data.daily).length === 0, '重置后统计清零');
  await Save.recordAnswer(true);
  await Save.recordAnswer(false);
  ok(Save.data.stats.answers === 2 && Save.data.stats.correct === 1, '答题累计统计正确');
  const todayRec = Save.data.daily[Save.todayKey()];
  ok(todayRec && todayRec.answers === 2 && todayRec.correct === 1, '当日打卡记录正确');
  ok(Save.streak() === 1, '连续打卡天数 = 1', String(Save.streak()));
  await Save.recordPractice('daily', { seconds: 42 });
  ok(todayRec.sessions === 1 && todayRec.seconds === 42 && todayRec.daily === 1, '练习记录正确');
  ok(Save.lastDays(7).length === 7, '近 7 日数组长度 = 7');
  await Save.markUnitPassed('g1s1u1');
  ok(Save.data.unitPassed['g1s1u1'] === true, '单元通行证已记录');
  await Save.saveUnitQuiz('g1s1u1', { stars: 3, correct: 8, total: 8 });
  ok(Save.data.unitQuiz['g1s1u1'].stars === 3, '单元小测成绩已记录');
  await Save.setName('  小小明  ');
  ok(Save.data.player.name === '小小明', '孩子姓名保存并去空格', Save.data.player.name);

  // 复审回归：导入被篡改 / 旧版存档时，渲染层依赖的字段必须全部收敛
  await Save.importSave({
    unitQuiz: { g1s0u0: { stars: -1, correct: '<b>', total: 8 } },
    unitPassed: { g1s0u0: 'yes' },
    stats: { answers: 1, correct: 5 },
    wrongBook: [{ lessonId: 'g1l1', qid: 'q1', prompt: '<img>', count: '9' }],
    completed: { fakeLesson: true },
    daily: { 'bad-day': { answers: 3 } },
    badges: [123, 'perfect']
  });
  ok(Save.data.unitQuiz['g1s0u0'].stars === 0, '小测负星级被夹到 0（不会让 repeat 抛 RangeError）');
  ok(Number.isFinite(Save.data.unitQuiz['g1s0u0'].correct), '小测答对数被收敛为数字');
  ok(Save.data.stats.correct <= Save.data.stats.answers, '正确数不会超过答题数（正确率不超 100%）');
  ok(!('bad-day' in Save.data.daily), '非法日期键被剔除');
  ok(typeof Save.data.wrongBook[0].count === 'number' && Save.data.wrongBook[0].count === 9,
    '错题计次被收敛为数字');
  ok(Save.data.wrongBook[0].answer === undefined, '缺答案的脏题不伪造答案（由题目守卫丢弃）');
  ok(Save.data.badges.every(x => typeof x === 'string'), '勋章列表过滤非字符串');
  // 星星商店：余额 / 购买 / 重复购买 / 佩戴 / 扩展勋章
  Save.data.stars = { g1l1: 3, g1l2: 3, g1l3: 3 };
  ok(Save.availableStars() === 9, '可用星星 = 累计 - 已消费', String(Save.availableStars()));
  ok((await Save.buy('avatar-cat', 5)) === true && Save.owns('avatar-cat'), '余额足够时购买成功');
  ok(Save.availableStars() === 4, '购买后余额正确扣减', String(Save.availableStars()));
  ok((await Save.buy('avatar-cat', 5)) === false, '已拥有商品不能重复购买');
  ok((await Save.buy('avatar-crown', 30)) === false, '余额不足时购买被拒绝');
  await Save.equip('avatar', '🐱');
  await Save.equip('accessory', '✨');
  ok(Save.data.player.avatar === '🐱' && Save.data.player.accessory === '✨', '头像与挂件佩戴生效');
  ok(Shop.avatarText() === '🐱✨', '顶栏头像文本组合正确', Shop.avatarText());
  const vDay = Save.todayKey();
  Save.data.daily[vDay] = {
    answers: 6, correct: 6, sessions: 2, seconds: 30,
    daily: 0, aural: 3, quiz: 0, wrong: 0, variant: 0
  };
  Save.data.stats.variantSessions = 5;
  Save.data.unitQuiz = {
    a: { stars: 3, correct: 5, total: 5, seconds: 10, at: vDay },
    b: { stars: 3, correct: 5, total: 5, seconds: 10, at: vDay },
    c: { stars: 3, correct: 5, total: 5, seconds: 10, at: vDay }
  };
  const freshBadges = await Rewards.checkBadges();
  ok(freshBadges.includes('aural-fan'), '听算勋章条件生效');
  ok(freshBadges.includes('quiz-master'), '单元小测王条件生效');
  ok(freshBadges.includes('variant-hero'), '变式小能手条件生效');

  await Save.setName('小小明');   // 导入会按默认存档重置资料，这里重新设置后再验证 reset
  await Save.reset();
  ok(Save.data.player.name === '小小明', '重置进度保留孩子姓名', Save.data.player.name);
  ok(Save.data.stats.answers === 0 && Object.keys(Save.data.unitQuiz).length === 0, '重置后新字段一并清空');

  /* ---------- 汇总 ---------- */
  console.log('\n' + '='.repeat(52));
  if (failures.length) {
    console.log(`FAILED: ${failures.length}/${checks} 项未通过`);
    failures.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log(`ALL-PASS: ${checks} 项校验全部通过`);
})();
