/** 学习会话视图 */

import { escapeHtml } from '../dom.js';
import { icon } from '../icons.js';
import { GRADE_META, STATUS } from '../../core/srs.js';
import { QUESTION_TYPE } from '../../core/quiz.js';
import { humanizeDuration, formatClock } from '../../core/util.js';

const STATUS_TAG = {
  [STATUS.NEW]: { cls: 'tag--new', text: '新词' },
  [STATUS.LEARNING]: { cls: 'tag--learn', text: '学习中' },
  [STATUS.REVIEW]: { cls: 'tag--review', text: '复习' },
};

function header(session) {
  const done = session.done;
  const total = done + session.remaining;
  const ratio = total > 0 ? (done / total) * 100 : 0;
  return `
    <div class="study__top">
      <div class="study__progress">
        <div class="progress-row" style="margin-bottom:6px">
          <span>本轮进度</span>
          <span class="study__count">${done} / ${total}</span>
        </div>
        <div class="progress"><div class="progress__bar" style="width:${ratio.toFixed(1)}%"></div></div>
      </div>
      <button class="btn btn--sm btn--ghost" data-action="end-session">结束本轮</button>
    </div>`;
}

function tags(card) {
  const st = STATUS_TAG[card.state.s] || STATUS_TAG[STATUS.NEW];
  return `<div class="flashcard__tag">
    <span class="tag ${st.cls}">${st.text}</span>
    ${card.state.star ? `<span class="tag tag--star">重点</span>` : ''}
    ${card.attempt > 1 ? `<span class="tag">第 ${card.attempt} 次</span>` : ''}
    <span class="tag">${card.word.level === 1 ? '核心' : card.word.level === 2 ? '常用' : card.word.level === 3 ? '进阶' : '拓展'}</span>
  </div>`;
}

function speakBtn(text, label = '朗读') {
  return `<button class="speak-btn" data-action="speak" data-text="${escapeHtml(text)}" aria-label="${label}" title="${label}">${icon('speak')}</button>`;
}

function renderQuiz(ctx) {
  const { session, question, phase, picked, feedback, settings } = ctx;
  const card = session.current();
  const word = card.word;

  let prompt;
  if (question.type === QUESTION_TYPE.EN2ZH) {
    prompt = `
      <div class="flashcard__word">${escapeHtml(word.word)}</div>
      ${settings.showPhonetic && word.phonetic ? `<div class="flashcard__phonetic">/${escapeHtml(word.phonetic)}/</div>` : ''}
      ${speakBtn(word.word)}
      <div class="flashcard__divider"></div>
      <div class="flashcard__prompt">选择正确的中文释义</div>`;
  } else if (question.type === QUESTION_TYPE.ZH2EN) {
    prompt = `
      <div class="flashcard__word" style="font-size:clamp(20px,4.2vw,28px);line-height:1.5">${escapeHtml(word.meaning)}</div>
      <div class="flashcard__divider"></div>
      <div class="flashcard__prompt">选择对应的英文单词</div>`;
  } else {
    prompt = `
      <div class="flashcard__word" style="font-size:clamp(20px,4.2vw,28px);line-height:1.5">${escapeHtml(word.meaning)}</div>
      ${settings.showPhonetic && word.phonetic ? `<div class="flashcard__phonetic">/${escapeHtml(word.phonetic)}/</div>` : ''}
      <div class="flashcard__divider"></div>
      <div class="flashcard__prompt">拼写这个单词</div>`;
  }

  const body = phase === 'quiz' ? renderAnswers(question, picked, feedback) : renderRevealed(ctx, question);
  const promptBlock = phase === 'quiz' ? prompt : '';

  return `
    <div class="study">
      ${header(session)}
      <div class="study__body">
        <div class="flashcard">
          ${tags(card)}
          ${promptBlock}
          ${body}
        </div>
        ${phase === 'quiz' ? renderQuizFooter(question) : renderGradeRow(ctx)}
      </div>
    </div>`;
}

function renderAnswers(question, picked, feedback) {
  if (question.type === QUESTION_TYPE.SPELL) {
    const cls = feedback === 'correct' ? 'is-correct' : feedback === 'wrong' ? 'is-wrong' : '';
    return `
      <div class="spell-box">
        <input class="spell-input ${cls}" id="spell-input" type="text" autocomplete="off"
               autocapitalize="off" spellcheck="false" placeholder="输入英文单词后回车"
               value="${escapeHtml(picked || '')}" aria-label="拼写答案" />
        <div class="spell-hint">${escapeHtml(question.hint)} · 按 Enter 提交</div>
      </div>`;
  }
  return `<div class="options">${question.options
    .map(
      (opt, i) => `
      <button class="option" data-action="pick" data-key="${escapeHtml(opt.key)}">
        <span class="option__key">${'ABCD'[i]}</span>
        <span class="option__body">
          <span>${escapeHtml(opt.text)}</span>
          ${opt.meta ? `<span class="option__meta">/${escapeHtml(opt.meta)}/</span>` : ''}
        </span>
      </button>`,
    )
    .join('')}</div>`;
}

function renderRevealed(ctx, question) {
  const { session, picked, feedback } = ctx;
  const card = session.current();
  const word = card.word;
  const isSpell = question.type === QUESTION_TYPE.SPELL;

  // 拼写题与选择题的"你的作答"提示
  let pickedNote = '';
  if (isSpell) {
    pickedNote = `<div class="flashcard__phonetic" style="color:${feedback === 'correct' ? 'var(--good)' : 'var(--bad)'}">
      你的拼写：${escapeHtml(picked || '（空）')}
    </div>`;
  } else if (feedback === 'wrong' && picked) {
    const chosen = question.options.find((o) => o.key === picked);
    pickedNote = `<div class="flashcard__phonetic" style="color:var(--bad)">
      你选了：${escapeHtml(chosen ? chosen.text : picked)}
    </div>`;
  }

  return `
    <div class="flashcard__divider"></div>
    <div class="flashcard__word" style="font-size:clamp(26px,5.4vw,38px)">${escapeHtml(word.word)}</div>
    ${word.phonetic ? `<div class="flashcard__phonetic">/${escapeHtml(word.phonetic)}/</div>` : ''}
    <div style="display:flex;gap:10px;align-items:center;margin-top:4px">
      ${speakBtn(word.word)}
    </div>
    <div class="flashcard__meaning">${escapeHtml(word.meaning)}</div>
    ${pickedNote}`;
}

function renderQuizFooter(question) {
  const isSpell = question.type === QUESTION_TYPE.SPELL;
  return `
    <div class="study__footer">
      ${isSpell
        ? '<span><kbd>Enter</kbd> 提交</span>'
        : '<span><kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd> 选择</span>'}
      <span>·</span>
      <button class="btn btn--sm btn--ghost" data-action="reveal">直接看答案</button>
      <span>·</span>
      <button class="btn btn--sm btn--ghost" data-action="skip">跳过这个词</button>
    </div>`;
}

function renderGradeRow(ctx) {
  const card = ctx.session.current();
  const preview = card.preview;
  return `
    <div class="grade-row">
      ${GRADE_META.map((meta, grade) => {
        const p = preview[grade];
        const hint = p ? humanizeDuration(p.ms) : '';
        return `<button class="grade grade--${meta.tone}" data-action="grade" data-grade="${grade}">
          <span class="grade__label">${meta.label}</span>
          <span class="grade__hint">${hint}</span>
          <span class="grade__key">${grade + 1}</span>
        </button>`;
      }).join('')}
    </div>
    <div class="study__footer">
      <span><kbd>1</kbd>–<kbd>4</kbd> 自评</span>
      <span>·</span>
      <button class="btn btn--sm btn--ghost" data-action="star" data-index="${card.index}">
        ${card.state.star ? '取消重点' : '标记重点'}
      </button>
      <span>·</span>
      <button class="btn btn--sm btn--ghost" data-action="master" data-index="${card.index}">已掌握，不再出现</button>
    </div>`;
}

function renderEmpty(ctx) {
  const finished = !!(ctx && ctx.session && ctx.session.finished);
  return `
    <div class="view">
      <div class="empty" style="padding-top:100px">
        <div style="font-size:34px;margin-bottom:12px">${finished ? '🎉' : '📚'}</div>
        <div class="empty__title">${finished ? '本轮学习已完成' : '还没有开始本轮学习'}</div>
        <p style="max-width:420px;margin:0 auto;line-height:1.8">
          ${finished
            ? '可以开始新一轮，或者去词库挑选想重点攻克的词。'
            : '点击下方按钮，系统会按今天的到期情况和每日上限自动安排一组卡片。'}
        </p>
        <div style="margin-top:22px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn--primary" data-action="start">开始学习</button>
          <button class="btn btn--ghost" data-action="nav" data-view="browse">去词库挑词</button>
          <button class="btn btn--ghost" data-action="nav" data-view="settings">调整计划</button>
        </div>
      </div>
    </div>`;
}

function renderResult(ctx) {
  const summary = ctx.session.summary();
  const acc = Math.round(summary.accuracy * 100);
  return `
    <div class="view">
      <div class="result">
        <div class="result__icon">${icon('checkPlain')}</div>
        <h1 class="result__title">本轮完成</h1>
        <p class="result__sub">${summary.answered} 张卡片，用时 ${formatClock(summary.durationMs)}</p>
        <div class="result-grid">
          <div class="stat"><div class="stat__label">正确率</div><div class="stat__value">${acc}%</div></div>
          <div class="stat"><div class="stat__label">新学</div><div class="stat__value">${summary.newLearned}</div></div>
          <div class="stat"><div class="stat__label">复习</div><div class="stat__value">${summary.reviewed}</div></div>
          <div class="stat"><div class="stat__label">忘记</div><div class="stat__value">${summary.again}</div></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn--primary" data-action="start">再来一轮</button>
          <button class="btn btn--ghost" data-action="nav" data-view="today">回到今日</button>
          <button class="btn btn--ghost" data-action="nav" data-view="stats">查看统计</button>
        </div>
      </div>
    </div>`;
}

export function renderStudy(ctx) {
  if (!ctx.session) return renderEmpty(ctx);
  if (ctx.session.finished) return renderResult(ctx);
  return `<div class="view">${renderQuiz(ctx)}</div>`;
}
