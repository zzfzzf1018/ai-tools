/** 词库浏览 */

import { escapeHtml } from '../dom.js';
import { icon } from '../icons.js';
import { STATUS } from '../../core/srs.js';

export const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'new', label: '未学习' },
  { key: 'learning', label: '学习中' },
  { key: 'review', label: '复习中' },
  { key: 'mastered', label: '已掌握' },
  { key: 'star', label: '重点' },
];

export const LEVEL_LABEL = { 1: '核心', 2: '常用', 3: '进阶', 4: '拓展' };

/** 根据筛选条件算出可见词条索引 */
export function collectIndices({ wordbook, store, filter = 'all', query = '', level = 0 }) {
  const q = String(query || '').trim();
  const base = q ? wordbook.search(q, wordbook.size) : wordbook.allIndices();
  const records = store._rawWords();
  const out = [];

  for (const i of base) {
    const row = wordbook.wordAt(i);
    if (!row) continue;
    if (level && row.level !== level) continue;
    const st = records[i];
    switch (filter) {
      case 'new':
        if (st && st.s !== STATUS.NEW) continue;
        break;
      case 'learning':
        if (!st || st.s !== STATUS.LEARNING) continue;
        break;
      case 'review':
        if (!st || st.s !== STATUS.REVIEW) continue;
        break;
      case 'mastered':
        if (!st || st.s !== STATUS.MASTERED) continue;
        break;
      case 'star':
        if (!st || !st.star) continue;
        break;
      default:
        break;
    }
    out.push(i);
  }
  return out;
}

function stateTag(state) {
  if (!state) return '';
  if (state.star) {
    return `<span class="tag tag--star" title="重点记忆">重点</span>`;
  }
  if (state.s === STATUS.MASTERED) return `<span class="tag">已掌握</span>`;
  if (state.s === STATUS.LEARNING) return `<span class="tag tag--learn">学习中</span>`;
  if (state.s === STATUS.REVIEW) {
    const days = state.iv || 0;
    return `<span class="tag tag--review">${days >= 21 ? '成熟' : `间隔 ${days} 天`}</span>`;
  }
  return '';
}

export function renderBrowse(ctx) {
  const { wordbook, store, filter, query, level, page, pageSize } = ctx;
  const indices = collectIndices({ wordbook, store, filter, query, level });
  const totalPages = Math.max(1, Math.ceil(indices.length / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = indices.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const records = store._rawWords();

  const rows = slice
    .map((i) => {
      const row = wordbook.wordAt(i);
      const st = records[i];
      const starred = !!(st && st.star);
      const mastered = !!(st && st.s === STATUS.MASTERED);
      return `
      <div class="wordrow" style="${mastered ? 'opacity:.58' : ''}">
        <div class="wordrow__rank">${i + 1}</div>
        <div class="wordrow__main">
          <div class="wordrow__head">
            <span class="wordrow__word">${escapeHtml(row.word)}</span>
            ${row.phonetic ? `<span class="wordrow__phonetic">/${escapeHtml(row.phonetic)}/</span>` : ''}
            ${stateTag(st)}
            <span class="tag">${LEVEL_LABEL[row.level]}</span>
          </div>
          <div class="wordrow__meaning">${escapeHtml(row.meaning)}</div>
        </div>
        <div class="wordrow__actions">
          <button class="icon-btn" data-action="speak" data-text="${escapeHtml(row.word)}" title="朗读" aria-label="朗读 ${escapeHtml(row.word)}">${icon('speak')}</button>
          <button class="icon-btn icon-btn--star ${starred ? 'is-active' : ''}" data-action="toggle-star" data-index="${i}"
                  title="${starred ? '取消重点' : '标记为重点'}" aria-label="标记重点" aria-pressed="${starred}">${icon('star')}</button>
          <button class="icon-btn icon-btn--check ${mastered ? 'is-active' : ''}" data-action="toggle-mastered" data-index="${i}"
                  title="${mastered ? '取消已掌握' : '标记已掌握（不再出现）'}" aria-label="标记已掌握" aria-pressed="${mastered}">${icon('check')}</button>
        </div>
      </div>`;
    })
    .join('');

  const filterChips = FILTERS.map(
    (f) => `<button class="chip" data-action="filter" data-filter="${f.key}" aria-pressed="${filter === f.key}">${f.label}</button>`,
  ).join('');

  const levelChips = [0, 1, 2, 3, 4]
    .map(
      (lv) =>
        `<button class="chip" data-action="level" data-level="${lv}" aria-pressed="${level === lv}">${lv === 0 ? '全部频段' : `${LEVEL_LABEL[lv]} ${['', '1-1000', '1001-3000', '3001-5500', '5501-8000'][lv]}`}</button>`,
    )
    .join('');

  return `
  <div class="view">
    <div class="page-head">
      <div>
        <h1 class="page-title">词库</h1>
        <p class="page-desc">共 ${wordbook.size} 个高频词，按 COCA 使用频率排序。可以手动标记重点或跳过。</p>
      </div>
    </div>

    <div class="toolbar">
      <div class="search">
        ${icon('search')}
        <input id="search-input" type="search" placeholder="搜索英文单词或中文释义…" value="${escapeHtml(query)}"
               autocomplete="off" aria-label="搜索词库" />
      </div>
      <button class="btn btn--ghost" data-action="clear-filter">重置条件</button>
    </div>

    <div class="chip-row" style="margin-bottom:8px">${filterChips}</div>
    <div class="chip-row" style="margin-bottom:16px">${levelChips}</div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span class="faint" style="font-size:12.5px">匹配 ${indices.length} 个词</span>
      <span class="faint" style="font-size:12.5px">第 ${safePage + 1} / ${totalPages} 页</span>
    </div>

    <div class="wordlist">
      ${rows || `<div class="empty"><div class="empty__title">没有匹配的词</div><p>换个关键词或筛选条件试试。</p></div>`}
      ${indices.length > pageSize
        ? `<div class="pager">
            <button class="btn btn--sm btn--ghost" data-action="page" data-page="${safePage - 1}" ${safePage === 0 ? 'disabled' : ''}>上一页</button>
            <span>${safePage + 1} / ${totalPages}</span>
            <button class="btn btn--sm btn--ghost" data-action="page" data-page="${safePage + 1}" ${safePage >= totalPages - 1 ? 'disabled' : ''}>下一页</button>
          </div>`
        : ''}
    </div>
  </div>`;
}
