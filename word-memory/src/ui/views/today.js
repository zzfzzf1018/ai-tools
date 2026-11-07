/** 今日面板 */

import { escapeHtml } from '../dom.js';
import { icon } from '../icons.js';
import { forecast } from '../../core/stats.js';
import { percent } from '../../core/util.js';

function greeting(hour) {
  if (hour < 5) return '夜深了，注意休息';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function weekdayLabel(ts) {
  const names = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function renderToday(ctx) {
  const { overview: o, settings, store, now, hasSession } = ctx;
  const date = new Date(now);
  const newLeft = Math.max(0, settings.newPerDay - o.today.newLearned);
  const doneToday = o.today.newLearned + o.today.reviewed;
  const remaining = o.dueNow + Math.min(newLeft, Math.max(0, o.newCount));
  const goal = doneToday + remaining;
  const ratio = goal > 0 ? Math.min(1, doneToday / goal) : 1;

  let title;
  let subtitle;
  if (o.dueNow > 0) {
    title = `${o.dueNow} 个词等着复习`;
    subtitle = newLeft > 0
      ? `另有 ${newLeft} 个新词可以认识，先复习再学新更牢。`
      : '先把到期的词过一遍，记忆才不会断。';
  } else if (newLeft > 0 && o.newCount > 0) {
    title = '今天没有到期复习';
    subtitle = `正好适合认识 ${newLeft} 个新词，间隔重复会让它们牢牢记住。`;
  } else if (goal > 0) {
    title = '今天的任务完成啦';
    subtitle = '记忆需要巩固，明天回来复习效果最好。';
  } else {
    title = '词库已全部标记完成';
    subtitle = '可以在词库里取消部分标记，或调整学习范围继续。';
  }

  const canStart = remaining > 0 || hasSession;
  const startLabel = hasSession ? '继续学习' : o.dueNow > 0 ? '开始复习' : '开始学习';

  const forecastData = forecast(store, now, 7);
  const maxForecast = Math.max(1, ...forecastData);
  const hasForecast = forecastData.some((v) => v > 0);
  const dayBase = new Date(now);
  dayBase.setHours(0, 0, 0, 0);

  const bars = forecastData
    .map((count, i) => {
      const ts = dayBase.getTime() + i * 86400000;
      const h = Math.max(3, Math.round((count / maxForecast) * 68));
      return `<div class="bars__item" title="${count} 个词到期">
        <div class="bars__value">${count || ''}</div>
        <div class="bars__col ${count ? 'bars__col--fill' : ''}" style="height:${h}px"></div>
        <div class="bars__label">${i === 0 ? '今天' : weekdayLabel(ts)}</div>
      </div>`;
    })
    .join('');

  return `
  <div class="view">
    <div class="hero">
      <div class="hero__greet">${greeting(date.getHours())} · ${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日</div>
      <h1 class="hero__title">${escapeHtml(title)}</h1>
      <p class="hero__sub">${escapeHtml(subtitle)}</p>
      <div class="hero__actions">
        <button class="btn btn--primary" data-action="start" ${canStart ? '' : 'disabled'}>
          ${icon('play')} ${startLabel}
        </button>
        <button class="btn btn--ghost" data-action="nav" data-view="browse">浏览词库</button>
      </div>
      <div style="margin-top:22px;position:relative;z-index:1">
        <div class="progress-row">
          <span>今日进度</span>
          <span><strong style="color:var(--text)">${doneToday}</strong> / ${goal} 张</span>
        </div>
        <div class="progress"><div class="progress__bar" style="width:${(ratio * 100).toFixed(1)}%"></div></div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat stat--accent">
        <div class="stat__label">待复习</div>
        <div class="stat__value">${o.dueNow}<span class="stat__unit">词</span></div>
        <div class="stat__foot">${o.learning ? `其中学习中 ${o.learning}` : '全部已排期'}</div>
      </div>
      <div class="stat">
        <div class="stat__label">今日新词</div>
        <div class="stat__value">${o.today.newLearned}<span class="stat__unit">/ ${settings.newPerDay}</span></div>
        <div class="stat__foot">剩余额度 ${newLeft}</div>
      </div>
      <div class="stat stat--good">
        <div class="stat__label">已掌握</div>
        <div class="stat__value">${o.mastered}<span class="stat__unit">词</span></div>
        <div class="stat__foot">占全库 ${percent(o.mastered, o.total, 1)}</div>
      </div>
      <div class="stat stat--warn">
        <div class="stat__label">连续打卡</div>
        <div class="stat__value">${o.streak}<span class="stat__unit">天</span></div>
        <div class="stat__foot">累计学习 ${o.activeDays} 天</div>
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <h2 class="card__title">未来 7 天到期预测</h2>
        ${hasForecast
          ? `<div class="bars">${bars}</div>
             <p class="faint" style="font-size:12px;margin:12px 0 0">
               间隔重复会把复习分散到不同日期，今天多学一点，明天的负担也不会骤增。
             </p>`
          : `<div style="height:104px;display:grid;place-items:center;text-align:center">
               <div>
                 <div style="font-size:13px;color:var(--text-dim)">还没有排期的复习</div>
                 <div style="font-size:12px;margin-top:4px" class="faint">学完今天的卡片后，这里会显示未来一周的复习节奏</div>
               </div>
             </div>`}
      </div>
      <div class="card">
        <h2 class="card__title">学习概况</h2>
        <div style="display:flex;flex-direction:column;gap:12px;font-size:13.5px">
          <div style="display:flex;justify-content:space-between">
            <span class="muted">已学词数</span><strong>${o.studied}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span class="muted">进入复习阶段</span><strong>${o.reviewing}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span class="muted">成熟词（≥21 天）</span><strong>${o.mature}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span class="muted">累计作答正确率</span><strong>${o.accuracy ? percent(o.accuracy * 100, 100, 1) : '—'}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span class="muted">重点标记</span><strong>${o.starred} 词</strong>
          </div>
        </div>
        ${o.studied === 0 ? `<p class="faint" style="font-size:12px;margin:14px 0 0">
          第一次使用？建议从默认的每日 ${settings.newPerDay} 个新词开始，坚持比冲刺更重要。
        </p>` : ''}
      </div>
    </div>
  </div>`;
}
