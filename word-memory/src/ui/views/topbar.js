/** 顶部工作区切换条：账户 / 词库随时可切 */

import { escapeHtml } from '../dom.js';

const MODE_LABEL = {
  http: '便携版 · 文件存储',
  idb: '浏览器 · IndexedDB',
  local: '浏览器 · localStorage',
  memory: '临时内存（关闭即丢失）',
  snapshot: '本地服务',
};

export function renderTopbar(info) {
  if (!info || !info.enabled) return '';
  const accountOptions = info.accounts
    .map(
      (a) =>
        `<option value="${escapeHtml(a.id)}" ${a.id === info.activeAccountId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`,
    )
    .join('');
  const bookOptions = info.books
    .map(
      (b) =>
        `<option value="${escapeHtml(b.id)}" ${b.id === info.activeBookId ? 'selected' : ''}>${escapeHtml(b.name)} · ${b.count} 词</option>`,
    )
    .join('');

  return `
    <div class="topbar__inner">
      <div class="topbar__group">
        <span class="topbar__label">账户</span>
        <select id="account-select" class="select select--sm" aria-label="切换账户">${accountOptions}</select>
      </div>
      <div class="topbar__group">
        <span class="topbar__label">词库</span>
        <select id="book-select" class="select select--sm" aria-label="切换词库">${bookOptions}</select>
      </div>
      <div class="topbar__spacer"></div>
      <span class="topbar__mode" title="数据存储位置">${escapeHtml(MODE_LABEL[info.dataMode] || '本地存储')}</span>
      <button class="btn btn--sm btn--ghost" data-action="nav" data-view="settings">管理</button>
    </div>`;
}
