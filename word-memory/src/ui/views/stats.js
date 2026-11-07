/** 统计面板 */

import { heatmap, recentSeries, overview } from '../../core/stats.js';
import { STATUS, memoryStrength } from '../../core/srs.js';
import { percent, formatClock } from '../../core/util.js';
import { LEVEL_LABEL } from './browse.js';

function levelBreakdown({ wordbook, store }) {
  const records = store._rawWords();
  const acc = { 1: { total: 0, studied: 0, mastered: 0 }, 2: { total: 0, studied: 0, mastered: 0 }, 3: { total: 0, studied: 0, mastered: 0 }, 4: { total: 0, studied: 0, mastered: 0 } };
  for (let i = 0; i < wordbook.size; i += 1) {
    const row = wordbook.wordAt(i);
    if (!row) continue;
    const bucket = acc[row.level];
    if (!bucket) continue;
    bucket.total += 1;
    const st = records[i];
    if (!st) continue;
    if (st.s === STATUS.MASTERED) {
      bucket.mastered += 1;
      bucket.studied += 1;
    } else if (st.s !== STATUS.NEW) {
      bucket.studied += 1;
    }
  }
  return acc;
}

function strengthBuckets({ wordbook, store }) {
  const records = store._rawWords();
  const buckets = [0, 0, 0, 0, 0]; // 0-20%, 20-40%, ...
  for (let i = 0; i < wordbook.size; i += 1) {
    const st = records[i];
    if (!st || st.s === STATUS.NEW) continue;
    const s = memoryStrength(st);
    const idx = Math.min(4, Math.floor(s * 5));
    buckets[idx] += 1;
  }
  return buckets;
}

export function renderStats(ctx) {
  const { wordbook, store, settings, now } = ctx;
  const o = overview({ wordbook, store, settings, now });
  const heat = heatmap(store, now, 13);
  const series = recentSeries(store, now, 14);
  const levels = levelBreakdown({ wordbook, store });
  const strength = strengthBuckets({ wordbook, store });
  const maxSeries = Math.max(1, ...series.map((d) => d.total));

  const weeks = [];
  for (let w = 0; w < heat.weeks; w += 1) {
    const cells = heat.cells.slice(w * 7, w * 7 + 7);
    const todayKey = new Date(now).toDateString();
    weeks.push(
      `<div class="heatmap__col">${cells
        .map((c) => {
          const isToday = new Date(c.ts).toDateString() === todayKey;
          return `<div class="heatmap__cell ${isToday ? 'is-today' : ''}" data-level="${c.level}"
            title="${c.key} · ${c.count} 张"></div>`;
        })
        .join('')}</div>`,
    );
  }

  const chart = series
    .map((d) => {
      const totalH = d.total === 0 ? 2 : Math.max(4, (d.total / maxSeries) * 100);
      const newPart = d.total ? (d.newLearned / d.total) * 100 : 0;
      const revPart = d.total ? (d.reviewed / d.total) * 100 : 0;
      const label = `${String(new Date(d.ts).getMonth() + 1)}/${new Date(d.ts).getDate()}`;
      return `<div class="chart__bar" title="${label}：新学 ${d.newLearned}，复习 ${d.reviewed}">
        <div style="flex:1;display:flex;align-items:flex-end;width:100%;justify-content:center">
          <div class="chart__stack" style="height:${totalH}%">
            <div class="chart__seg--rev" style="height:${revPart}%"></div>
            <div class="chart__seg--new" style="height:${newPart}%"></div>
          </div>
        </div>
        <span class="chart__label">${label}</span>
      </div>`;
    })
    .join('');

  const levelBars = [1, 2, 3, 4]
    .map((lv) => {
      const b = levels[lv];
      const studiedPct = b.total ? (b.studied / b.total) * 100 : 0;
      const masteredPct = b.total ? (b.mastered / b.total) * 100 : 0;
      return `<div>
        <div class="level-bar__head">
          <span>${LEVEL_LABEL[lv]} <span class="faint">(${b.total} 词)</span></span>
          <span class="faint">已学 ${b.studied} · 掌握 ${b.mastered}</span>
        </div>
        <div class="level-bar__track">
          <div class="level-bar__fill--mastered" style="width:${masteredPct}%;height:100%;background:var(--good)"></div>
          <div class="level-bar__fill" style="width:${Math.max(0, studiedPct - masteredPct)}%;height:100%"></div>
        </div>
      </div>`;
    })
    .join('');

  const strengthLabels = ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%'];
  const maxStrength = Math.max(1, ...strength);

  return `
  <div class="view">
    <div class="page-head">
      <div>
        <h1 class="page-title">学习统计</h1>
        <p class="page-desc">记录每一次回忆，用记忆强度而不是"学了几遍"衡量进度。</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat stat--accent">
        <div class="stat__label">已学词数</div>
        <div class="stat__value">${o.studied}<span class="stat__unit">/ ${o.total}</span></div>
        <div class="stat__foot">覆盖 ${percent(o.studied, o.total, 1)}</div>
      </div>
      <div class="stat stat--good">
        <div class="stat__label">已掌握</div>
        <div class="stat__value">${o.mastered}</div>
        <div class="stat__foot">手动标记，不再出现</div>
      </div>
      <div class="stat">
        <div class="stat__label">成熟词</div>
        <div class="stat__value">${o.mature}</div>
        <div class="stat__foot">复习间隔 ≥ 21 天</div>
      </div>
      <div class="stat">
        <div class="stat__label">累计正确率</div>
        <div class="stat__value">${o.accuracy ? percent(o.accuracy * 100, 100, 1) : '—'}</div>
        <div class="stat__foot">连续 ${o.streak} 天 · 累计 ${o.activeDays} 天</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <h2 class="card__title">今日</h2>
      <div style="display:flex;gap:26px;flex-wrap:wrap">
        <div><div class="stat__label">新学</div><div class="stat__value" style="font-size:20px">${o.today.newLearned}</div></div>
        <div><div class="stat__label">复习</div><div class="stat__value" style="font-size:20px">${o.today.reviewed}</div></div>
        <div><div class="stat__label">作答</div><div class="stat__value" style="font-size:20px">${o.today.answered}</div></div>
        <div><div class="stat__label">今日正确率</div><div class="stat__value" style="font-size:20px">${o.today.answered ? percent(o.today.correct, o.today.answered, 1) : '—'}</div></div>
        <div><div class="stat__label">专注时长</div><div class="stat__value" style="font-size:20px">${formatClock(o.today.ms)}</div></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <h2 class="card__title">学习热力图 · 最近 13 周</h2>
      <div class="heatmap">${weeks.join('')}</div>
      <div class="heat-legend">
        <span>少</span>
        <span class="box" style="background:var(--heat-0)"></span>
        <span class="box" style="background:var(--heat-1)"></span>
        <span class="box" style="background:var(--heat-2)"></span>
        <span class="box" style="background:var(--heat-3)"></span>
        <span class="box" style="background:var(--heat-4)"></span>
        <span>多</span>
        <span style="margin-left:auto">最近 13 周共 ${heat.total} 张</span>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h2 class="card__title" style="margin:0">最近 14 天</h2>
        <div class="heat-legend" style="margin:0">
          <span class="box" style="background:var(--primary)"></span><span>新学</span>
          <span class="box" style="background:var(--good);opacity:.75"></span><span>复习</span>
        </div>
      </div>
      <div class="chart">${chart}</div>
    </div>

    <div class="two-col">
      <div class="card">
        <h2 class="card__title">频段掌握情况</h2>
        <div class="level-bars">${levelBars}</div>
      </div>
      <div class="card">
        <h2 class="card__title">记忆强度分布</h2>
        <div style="display:flex;flex-direction:column;gap:9px">
          ${strength
            .map(
              (count, i) => `
            <div>
              <div class="level-bar__head" style="margin-bottom:4px">
                <span class="faint">${strengthLabels[i]}</span><span>${count} 词</span>
              </div>
              <div class="level-bar__track">
                <div style="height:100%;width:${((count / maxStrength) * 100).toFixed(1)}%;background:var(--primary);opacity:${0.35 + i * 0.16}"></div>
              </div>
            </div>`,
            )
            .join('')}
        </div>
        <p class="faint" style="font-size:12px;margin:14px 0 0">
          记忆强度综合了间隔长度、遗忘次数与正确率，用于估算真实记忆牢固程度。
        </p>
      </div>
    </div>
  </div>`;
}
