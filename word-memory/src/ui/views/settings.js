/** 设置面板 */

import { escapeHtml } from '../dom.js';
import { LEVEL_LABEL } from './browse.js';
import { renderAccountsCard, renderBooksCard, renderBackupRows } from './workspace.js';

function stepper(key, value, min, max, step = 1) {
  return `<div class="stepper">
    <button data-action="bump" data-key="${key}" data-delta="-${step}" aria-label="减少">−</button>
    <input type="number" value="${value}" min="${min}" max="${max}" data-setting="${key}" aria-label="${key}" />
    <button data-action="bump" data-key="${key}" data-delta="${step}" aria-label="增加">+</button>
  </div>`;
}

function toggle(key, checked, label) {
  return `<button class="switch" role="switch" aria-checked="${checked}" data-action="toggle" data-key="${key}" aria-label="${escapeHtml(label)}"></button>`;
}

export function renderSettings(ctx) {
  const { settings, wordbook, version, workspaceInfo } = ctx;
  const meta = wordbook.meta || {};
  const ws = workspaceInfo || { enabled: false };

  const levelChips = [1, 2, 3, 4]
    .map(
      (lv) =>
        `<button class="chip" data-action="level-toggle" data-level="${lv}" aria-pressed="${settings.levels.includes(lv)}">${LEVEL_LABEL[lv]}</button>`,
    )
    .join('');

  return `
  <div class="view">
    <div class="page-head">
      <div>
        <h1 class="page-title">设置</h1>
        <p class="page-desc">参数改动会立即保存，并影响下一轮学习。</p>
      </div>
    </div>

    ${renderAccountsCard(ws)}
    ${renderBooksCard(ws)}

    <div class="card" style="margin-bottom:14px">
      <h2 class="card__title">学习计划</h2>
      <div class="setting">
        <div>
          <div class="setting__label">每日新词上限</div>
          <div class="setting__desc">建议 10–30。贪多会让复习任务在几天后堆积，反而难以坚持。</div>
        </div>
        ${stepper('newPerDay', settings.newPerDay, 0, 500)}
      </div>
      <div class="setting">
        <div>
          <div class="setting__label">每日复习上限</div>
          <div class="setting__desc">到期词超过上限时会顺延到明天。时间紧张时调低它，比放弃复习更有效。</div>
        </div>
        ${stepper('reviewPerDay', settings.reviewPerDay, 20, 2000, 10)}
      </div>
      <div class="setting">
        <div>
          <div class="setting__label">每轮卡片数</div>
          <div class="setting__desc">一次会话最多包含多少张卡，学完可以再来一轮。</div>
        </div>
        ${stepper('sessionSize', settings.sessionSize, 5, 200, 5)}
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <h2 class="card__title">学习内容</h2>
      <div class="setting">
        <div>
          <div class="setting__label">参与的频段</div>
          <div class="setting__desc">核心 1–1000、常用 1001–3000、进阶 3001–5500、拓展 5501–8000。</div>
        </div>
        <div class="chip-row">${levelChips}</div>
      </div>
      <div class="setting">
        <div>
          <div class="setting__label">新词出现顺序</div>
          <div class="setting__desc">按词频由高到低最贴合"最常用优先"；乱序可避免长时间停留在简单词。</div>
        </div>
        <select class="select" data-select="order">
          <option value="frequency" ${settings.order === 'frequency' ? 'selected' : ''}>按词频</option>
          <option value="random" ${settings.order === 'random' ? 'selected' : ''}>乱序</option>
          <option value="new-first" ${settings.order === 'new-first' ? 'selected' : ''}>新词优先</option>
        </select>
      </div>
      <div class="setting">
        <div>
          <div class="setting__label">题型</div>
          <div class="setting__desc">混合模式会交替出现选义、选词与拼写，强化不同方向的提取。</div>
        </div>
        <select class="select" data-select="answerMode">
          <option value="mixed" ${settings.answerMode === 'mixed' ? 'selected' : ''}>混合</option>
          <option value="choice" ${settings.answerMode === 'choice' ? 'selected' : ''}>只做选择题</option>
          <option value="spell" ${settings.answerMode === 'spell' ? 'selected' : ''}>只做拼写题</option>
        </select>
      </div>
      <div class="setting">
        <div>
          <div class="setting__label">显示音标</div>
          <div class="setting__desc">在卡片与词库中展示英式音标。</div>
        </div>
        ${toggle('showPhonetic', settings.showPhonetic, '显示音标')}
      </div>
      <div class="setting">
        <div>
          <div class="setting__label">自动朗读</div>
          <div class="setting__desc">翻到答案时用系统语音朗读单词（依赖浏览器语音引擎）。</div>
        </div>
        ${toggle('autoPlay', settings.autoPlay, '自动朗读')}
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <h2 class="card__title">外观</h2>
      <div class="setting">
        <div>
          <div class="setting__label">主题</div>
          <div class="setting__desc">深色适合夜间，浅色在强光下更清晰。</div>
        </div>
        <select class="select" data-select="theme">
          <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>深色</option>
          <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>浅色</option>
        </select>
      </div>
    </div>

    <div class="card danger-zone" style="margin-bottom:14px">
      <h2 class="card__title">数据</h2>
      ${renderBackupRows(ws)}
      <div class="setting">
        <div>
          <div class="setting__label">导出当前词库进度</div>
          <div class="setting__desc">仅导出「当前账户 × 当前词库」的学习记录，可用于单库迁移。</div>
        </div>
        <button class="btn btn--ghost" data-action="export">导出</button>
      </div>
      <div class="setting">
        <div>
          <div class="setting__label">导入学习数据</div>
          <div class="setting__desc">导入会覆盖当前进度，建议先导出备份。</div>
        </div>
        <button class="btn btn--ghost" data-action="import">选择文件</button>
        <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
      </div>
      <div class="setting">
        <div>
          <div class="setting__label" style="color:var(--bad)">清空学习进度</div>
          <div class="setting__desc">删除所有卡片状态与统计，设置会保留。此操作不可撤销。</div>
        </div>
        <button class="btn btn--danger" data-action="reset">清空进度</button>
      </div>
    </div>

    <div class="card">
      <h2 class="card__title">关于</h2>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px" class="muted">
        <div style="display:flex;justify-content:space-between"><span>应用版本</span><span class="mono">${escapeHtml(version)}</span></div>
        ${ws.enabled ? `<div style="display:flex;justify-content:space-between"><span>当前账户</span><span class="mono">${escapeHtml((ws.accounts.find((a) => a.id === ws.activeAccountId) || {}).name || '—')}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between"><span>当前词库</span><span class="mono">${escapeHtml(meta.name || '内置词库')}</span></div>
        <div style="display:flex;justify-content:space-between"><span>词库词条</span><span class="mono">${wordbook.size}</span></div>
        <div style="display:flex;justify-content:space-between"><span>词库版本</span><span class="mono">${escapeHtml(meta.version || '—')}</span></div>
        <div style="display:flex;justify-content:space-between"><span>数据来源</span><span class="mono">${escapeHtml(meta.source || '—')}</span></div>
        <div style="display:flex;justify-content:space-between"><span>数据指纹</span><span class="mono">${escapeHtml(meta.sourceHash || '—')}</span></div>
      </div>
      <p class="faint" style="font-size:12px;margin:16px 0 0;line-height:1.7">
        采用 SM-2 间隔重复算法：每张卡根据你的回忆难度计算下一次出现时间，
        间隔从分钟级逐步拉长到数月，用最少的复习次数换取最长久的记忆。
      </p>
      <div style="margin-top:14px;font-size:12px" class="faint">
        快捷键：<kbd>1</kbd>–<kbd>4</kbd> 评分 · <kbd>空格</kbd> 看答案 · <kbd>A</kbd>–<kbd>D</kbd> 选项 · <kbd>S</kbd> 朗读 · <kbd>Esc</kbd> 结束本轮
      </div>
    </div>
  </div>`;
}
