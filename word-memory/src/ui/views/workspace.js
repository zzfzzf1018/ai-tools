/** 账户与词库管理卡片（嵌入设置页） */

import { escapeHtml } from '../dom.js';

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function accountRows(info) {
  return info.accounts
    .map((a) => {
      const active = a.id === info.activeAccountId;
      return `
      <div class="ws-row ${active ? 'is-active' : ''}">
        <div class="ws-row__main">
          <div class="ws-row__name">
            ${escapeHtml(a.name)}
            ${active ? '<span class="tag tag--new">使用中</span>' : ''}
          </div>
          <div class="ws-row__meta">当前词库：${escapeHtml(a.activeBookName || '—')} · 创建于 ${fmtDate(a.createdAt)}</div>
        </div>
        <div class="ws-row__actions">
          ${active ? '' : `<button class="btn btn--sm btn--ghost" data-action="switch-account" data-id="${escapeHtml(a.id)}">切换</button>`}
          <button class="btn btn--sm btn--ghost" data-action="account-rename" data-id="${escapeHtml(a.id)}">重命名</button>
          <button class="btn btn--sm btn--danger" data-action="account-delete" data-id="${escapeHtml(a.id)}" ${info.accounts.length <= 1 ? 'disabled title="至少保留一个账户"' : ''}>删除</button>
        </div>
      </div>`;
    })
    .join('');
}

function bookRows(info) {
  return info.books
    .map((b) => {
      const active = b.id === info.activeBookId;
      return `
      <div class="ws-row ${active ? 'is-active' : ''}">
        <div class="ws-row__main">
          <div class="ws-row__name">
            ${escapeHtml(b.name)}
            ${b.builtin ? '<span class="tag">内置默认</span>' : '<span class="tag tag--learn">自定义</span>'}
            ${active ? '<span class="tag tag--new">当前</span>' : ''}
          </div>
          <div class="ws-row__meta">${b.count} 词 · ${b.builtin ? '随程序提供，不可删除' : `导入于 ${fmtDate(b.createdAt)}`}</div>
        </div>
        <div class="ws-row__actions">
          ${active ? '' : `<button class="btn btn--sm btn--ghost" data-action="switch-book" data-id="${escapeHtml(b.id)}">切换</button>`}
          <button class="btn btn--sm btn--ghost" data-action="book-rename" data-id="${escapeHtml(b.id)}">重命名</button>
          <button class="btn btn--sm btn--ghost" data-action="book-export" data-id="${escapeHtml(b.id)}">导出</button>
          <button class="btn btn--sm btn--danger" data-action="book-delete" data-id="${escapeHtml(b.id)}" ${b.builtin ? 'disabled title="内置词库不可删除"' : ''}>删除</button>
        </div>
      </div>`;
    })
    .join('');
}

/** 账户管理卡片 */
export function renderAccountsCard(info) {
  if (!info.enabled) return '';
  return `
    <div class="card" style="margin-bottom:14px">
      <div class="card__head">
        <div>
          <h2 class="card__title" style="margin-bottom:2px">账户</h2>
          <p class="faint" style="font-size:12.5px;margin:0">每个人拥有独立的学习记录、统计与设置，切换后互不干扰。</p>
        </div>
        <button class="btn btn--sm btn--primary" data-action="account-add">＋ 新建账户</button>
      </div>
      <div class="ws-list">${accountRows(info)}</div>
    </div>`;
}

/** 词库管理卡片 */
export function renderBooksCard(info) {
  if (!info.enabled) return '';
  return `
    <div class="card" style="margin-bottom:14px">
      <div class="card__head">
        <div>
          <h2 class="card__title" style="margin-bottom:2px">词库</h2>
          <p class="faint" style="font-size:12.5px;margin:0">
            内置 8000 词是默认词库；可导入多个自定义词库并随时切换，每个账户各自记住当前词库。
          </p>
        </div>
        <button class="btn btn--sm btn--primary" data-action="book-add">＋ 导入词库</button>
        <input type="file" id="import-book-file" accept=".json,.csv,.txt,.tsv" class="hidden" />
      </div>
      <div class="ws-list">${bookRows(info)}</div>
      <p class="faint" style="font-size:12px;line-height:1.8;margin:14px 0 0">
        支持格式：<span class="mono">.json</span>（本项目 words.json、对象数组、单词→释义映射）、
        <span class="mono">.csv / .txt</span>（每行「单词,释义」或「单词⇥释义」，可带音标与频段）。
        重复单词自动去重，未指定频段时按 1:2:2.5:2.5 自动分档。
      </p>
    </div>`;
}

/** 全量备份卡片内容（追加到「数据」卡片的 setting 行） */
export function renderBackupRows(info) {
  if (!info.enabled) return '';
  return `
    <div class="setting">
      <div>
        <div class="setting__label">导出全量备份</div>
        <div class="setting__desc">包含所有账户、全部自定义词库、设置与学习进度，适合换设备或迁移到便携版。</div>
      </div>
      <button class="btn btn--ghost" data-action="export-all">导出全部</button>
    </div>
    <div class="setting">
      <div>
        <div class="setting__label">导入全量备份</div>
        <div class="setting__desc">会覆盖当前整个工作区（账户、词库、进度），请谨慎操作。</div>
      </div>
      <button class="btn btn--ghost" data-action="import-all">选择文件</button>
      <input type="file" id="import-all-file" accept="application/json,.json" class="hidden" />
    </div>`;
}
