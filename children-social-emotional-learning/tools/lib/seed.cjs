/* 视觉回归与人工检查共用的示例存档。时间固定为 2026-01-15，
   保证截图里的日期、周报区间、连续天数不会随真实日期漂移。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FIXED_ISO = '2026-01-15T10:00:00';
const TODAY = '2026-01-15';

function day(n) {
  const d = new Date(FIXED_ISO);
  d.setDate(d.getDate() + n);
  const p = (x) => (x < 10 ? '0' + x : '' + x);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function levelRecords(root) {
  const src = fs.readFileSync(path.join(root, 'src/data/curriculum.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const out = {};
  (sandbox.window.SEL_DATA.islands || []).forEach((is) => {
    (is.levels || []).slice(0, 3).forEach((lv, i) => {
      out[lv.id] = { done: true, stars: i === 1 ? 2 : 3, attempts: 1, lastAt: '2026-01-10' };
    });
  });
  return out;
}

function seed(root) {
  const emos = ['happy', 'calm', 'worried', 'angry', 'sad', 'happy', 'proud', 'calm'];
  const strategies = ['breathing', 'coping', 'expression', 'distance', 'awareness'];
  const checkins = [];
  const flowers = [];
  for (let i = -13; i <= 0; i++) {
    if (i === -11 || i === -7 || i === -3) continue;   // 留几个空档，折线才有断点
    const date = day(i);
    const em = emos[(i + 13) % emos.length];
    const intensity = 2 + ((i + 13) % 4);
    const st = (i + 13) % 3 === 0 ? '' : strategies[(i + 13) % strategies.length];
    checkins.push({
      date, emotion: em, intensity, strategy: st,
      reason: em === 'happy' ? '和同学一起玩了' : '今天有点小事',
      note: i % 4 === 0 ? '今天体育课跑了第一名' : '',
      at: date + 'T09:00:00.000Z'
    });
    flowers.push({ id: 'f' + (i + 20), date, emotion: em, color: '#FFC94A', petal: (i + 20) % 5 });
  }
  return {
    version: 1,
    activeId: 'p1',
    gate: { salt: '', hash: '', fails: 0, lockUntil: 0 },
    archive: {},
    profiles: [{
      id: 'p1', name: '小雨', avatar: 'fox', createdAt: '2025-12-20',
      stars: 46,
      skills: { awareness: 14, management: 9, social: 5, relationship: 3, decision: 7 },
      levels: levelRecords(root),
      stickers: ['st-magnifier', 'st-cloud', 'st-bubble', 'st-bridge'],
      checkins, flowers,
      strategyCount: { breathing: 6, coping: 3, expression: 2, distance: 1, awareness: 4 },
      usage: { date: TODAY, seconds: 320 },
      stories: { 'story-1': { nodes: ['n1', 'n2'], endings: [] } },
      settings: {
        voice: true, sfx: true, reduceMotion: false,
        screenLimit: 0, bedtimeOn: false, bedtimeStart: '20:30', bedtimeEnd: '07:30'
      },
      lastVisit: TODAY
    }]
  };
}

module.exports = { seed, levelRecords, FIXED_ISO, TODAY, day };
