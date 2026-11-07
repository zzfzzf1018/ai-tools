/**
 * 应用主控制器
 * ------------------------------------------------------------
 * 职责：装配数据 → 维护界面状态 → 渲染视图 → 处理交互。
 * 视图本身是纯字符串渲染函数（src/ui/views/*），这里负责把
 * 状态与事件粘起来，避免视图之间互相引用。
 */

import { createStore, createLocalAdapter, createMemoryAdapter } from '../core/store.js';
import { createWordbook } from '../core/wordbook.js';
import { buildQueue } from '../core/scheduler.js';
import { createSession } from '../core/session.js';
import { buildQuestion, checkAnswer } from '../core/quiz.js';
import { overview } from '../core/stats.js';
import { GRADE, STATUS } from '../core/srs.js';
import { dateKey } from '../core/util.js';
import { qs, qsa, delegate, toast, confirmDialog, speak, downloadFile, escapeHtml } from './dom.js';
import { icon } from './icons.js';
import { renderToday } from './views/today.js';
import { renderStudy } from './views/study.js';
import { renderBrowse } from './views/browse.js';
import { renderStats } from './views/stats.js';
import { renderSettings } from './views/settings.js';

const NAV = [
  { key: 'today', label: '今日', icon: 'today' },
  { key: 'study', label: '学习', icon: 'study' },
  { key: 'browse', label: '词库', icon: 'book' },
  { key: 'stats', label: '统计', icon: 'chart' },
  { key: 'settings', label: '设置', icon: 'settings' },
];

const VIEWS = {
  today: renderToday,
  study: renderStudy,
  browse: renderBrowse,
  stats: renderStats,
  settings: renderSettings,
};

function resolveAdapter() {
  try {
    const storage = window.localStorage;
    const probe = '__wm_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return createLocalAdapter(storage);
  } catch {
    return createMemoryAdapter();
  }
}

export function createApp({ root, payload, version = '1.0.0' }) {
  const wordbook = createWordbook(payload);
  const adapter = resolveAdapter();
  const store = createStore({ adapter, key: 'word-memory/v1' });
  const loadResult = store.load();

  // 词库版本对齐
  if (!store.dataVersion) {
    store._setDataVersion(wordbook.dataVersion);
    store.flush();
  }

  const state = {
    view: 'today',
    session: null,
    question: null,
    phase: 'quiz',
    picked: '',
    feedback: null,
    browse: { query: '', filter: 'all', level: 0, page: 0, pageSize: 50 },
  };

  function viewFromHash() {
    const key = String(window.location.hash || '').replace(/^#\/?/, '');
    return VIEWS[key] ? key : null;
  }

  function setView(view) {
    if (!VIEWS[view]) return;
    state.view = view;
    if (viewFromHash() !== view) {
      try {
        window.location.hash = view;
      } catch {
        /* file:// 等环境可能不支持，忽略即可 */
      }
    }
  }

  let mainEl = null;
  let viewRoot = null;
  let navEls = [];
  let badgeEl = null;

  /* ---------------- 渲染 ---------------- */

  function mount() {
    root.innerHTML = `
      <div class="app">
        <aside class="sidebar">
          <div class="brand">
            <div class="brand__mark">W</div>
            <div class="brand__text">
              <span class="brand__name">WordMemory</span>
              <span class="brand__sub">8000 核心词</span>
            </div>
          </div>
          <nav class="nav" aria-label="主导航">
            ${NAV.map(
              (item) => `
              <button class="nav__item" data-action="nav" data-view="${item.key}" aria-current="false">
                ${icon(item.icon, 'nav__icon')}
                <span class="nav__text">${item.label}</span>
                ${item.key === 'study' ? '<span class="nav__badge hidden" id="nav-badge">0</span>' : ''}
              </button>`,
            ).join('')}
          </nav>
          <div class="sidebar__footer">
            v${escapeHtml(version)}<br />
            间隔重复 · 本地存储
          </div>
        </aside>
        <main class="main" id="main"><div id="view-root"></div></main>
      </div>`;
    mainEl = qs('#main', root);
    viewRoot = qs('#view-root', root);
    navEls = qsa('.nav__item', root);
    badgeEl = qs('#nav-badge', root);
  }

  function buildCtx() {
    const now = Date.now();
    const settings = store.settings;
    const hasSession = !!state.session && !state.session.finished;
    return {
      now,
      version,
      wordbook,
      store,
      settings,
      overview: overview({ wordbook, store, settings, now }),
      session: state.session,
      question: state.question,
      phase: state.phase,
      picked: state.picked,
      feedback: state.feedback,
      hasSession,
      filter: state.browse.filter,
      query: state.browse.query,
      level: state.browse.level,
      page: state.browse.page,
      pageSize: state.browse.pageSize,
    };
  }

  function render() {
    const scroll = mainEl ? mainEl.scrollTop : 0;
    const active = document.activeElement;
    const activeId = active && active.id ? active.id : null;
    let selection = null;
    try {
      if (activeId && typeof active.selectionStart === 'number') selection = active.selectionStart;
    } catch {
      selection = null;
    }

    const ctx = buildCtx();
    document.documentElement.dataset.theme = ctx.settings.theme;
    viewRoot.innerHTML = VIEWS[state.view](ctx);

    if (mainEl) mainEl.scrollTop = scroll;
    updateNav(ctx);

    if (activeId) {
      const el = document.getElementById(activeId);
      if (el && typeof el.focus === 'function') {
        el.focus();
        if (selection !== null && typeof el.setSelectionRange === 'function') {
          try {
            el.setSelectionRange(selection, selection);
          } catch {
            /* 忽略不支持的元素 */
          }
        }
      }
    }

    afterRender(ctx);
  }

  function updateNav(ctx) {
    for (const el of navEls) {
      el.setAttribute('aria-current', el.dataset.view === state.view ? 'page' : 'false');
    }
    if (badgeEl) {
      const due = ctx.overview.dueNow;
      badgeEl.textContent = due > 999 ? '999+' : String(due);
      badgeEl.classList.toggle('hidden', due === 0);
    }
  }

  function afterRender(ctx) {
    if (state.view !== 'study') return;
    const input = document.getElementById('spell-input');
    if (input && state.phase === 'quiz') {
      input.focus();
      if (state.picked) input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  /* ---------------- 会话 ---------------- */

  function loadCard() {
    const card = state.session && !state.session.finished ? state.session.current() : null;
    if (!card) {
      state.question = null;
      state.phase = 'quiz';
      state.picked = '';
      state.feedback = null;
      return;
    }
    const mode = store.settings.answerMode;
    state.question = buildQuestion({ wordbook, index: card.index, mode });
    state.phase = 'quiz';
    state.picked = '';
    state.feedback = null;
  }

  function startSession() {
    if (state.session && !state.session.finished) {
      setView('study');
      render();
      return;
    }
    state.session = null;
    const settings = store.settings;
    const built = buildQueue({ wordbook, store, settings, now: Date.now() });
    if (!built.queue.length) {
      setView('study');
      toast('当前没有需要学习的词，试试调整每日上限或学习范围', 'err');
      render();
      return;
    }
    state.session = createSession({
      wordbook,
      store,
      settings,
      queue: built.queue,
    });
    setView('study');
    loadCard();
    render();
    maybeAutoPlay();
  }

  function maybeAutoPlay() {
    if (!store.settings.autoPlay) return;
    const card = state.session?.current();
    if (card) speak(card.word.word);
  }

  function submitAnswer(response) {
    if (!state.question || state.phase !== 'quiz') return;
    const correct = checkAnswer(state.question, response);
    state.picked = typeof response === 'string' ? response : response.key;
    state.feedback = correct ? 'correct' : 'wrong';
    state.phase = 'reveal';
    render();
  }

  function submitGrade(grade) {
    if (!state.session || state.session.finished) return;
    if (state.phase !== 'reveal') return;
    state.session.submit(grade);
    if (state.session.finished) {
      state.session.end();
      state.question = null;
      render();
      return;
    }
    loadCard();
    render();
    maybeAutoPlay();
  }

  function endSession() {
    if (!state.session) return;
    state.session.finish();
    state.question = null;
    render();
  }

  /* ---------------- 动作分发 ---------------- */

  const actions = {
    nav(el) {
      const target = el.dataset.view;
      if (!VIEWS[target]) return;
      if (state.view === 'study' && target !== 'study' && state.session && !state.session.finished) {
        // 离开学习页时保存进度
        store.flush();
      }
      setView(target);
      render();
    },
    start() {
      startSession();
    },
    'end-session'() {
      endSession();
    },
    reveal() {
      if (state.phase !== 'quiz') return;
      state.phase = 'reveal';
      state.feedback = null;
      render();
      if (store.settings.autoPlay) {
        const card = state.session?.current();
        if (card) speak(card.word.word);
      }
    },
    pick(el) {
      submitAnswer({ key: el.dataset.key });
    },
    grade(el) {
      submitGrade(Number(el.dataset.grade));
    },
    skip() {
      if (!state.session) return;
      state.session.skip();
      if (state.session.finished) {
        state.session.end();
        state.question = null;
      } else {
        loadCard();
      }
      render();
    },
    speak(el) {
      speak(el.dataset.text);
    },
    star(el) {
      const index = Number(el.dataset.index);
      const next = store.toggleStar(index);
      toast(next.star ? '已标记为重点' : '已取消重点');
      render();
    },
    master(el) {
      const index = Number(el.dataset.index);
      store.setMastered(index, true);
      if (state.view === 'study' && state.session && !state.session.finished) {
        state.session.drop();
        if (state.session.finished) {
          state.session.end();
          state.question = null;
        } else {
          loadCard();
        }
      }
      toast('已标记为掌握，不再出现');
      render();
    },
    'toggle-star'(el) {
      store.toggleStar(Number(el.dataset.index));
      render();
    },
    'toggle-mastered'(el) {
      const index = Number(el.dataset.index);
      const st = store.getState(index);
      store.setMastered(index, st.s !== STATUS.MASTERED);
      render();
    },
    filter(el) {
      state.browse.filter = el.dataset.filter;
      state.browse.page = 0;
      render();
    },
    level(el) {
      state.browse.level = Number(el.dataset.level);
      state.browse.page = 0;
      render();
    },
    'clear-filter'() {
      state.browse = { query: '', filter: 'all', level: 0, page: 0, pageSize: state.browse.pageSize };
      render();
    },
    page(el) {
      state.browse.page = Math.max(0, Number(el.dataset.page));
      render();
      if (mainEl) mainEl.scrollTop = 0;
    },
    bump(el) {
      const key = el.dataset.key;
      const delta = Number(el.dataset.delta);
      const cur = Number(store.settings[key]) || 0;
      store.updateSettings({ [key]: cur + delta });
      render();
    },
    toggle(el) {
      const key = el.dataset.key;
      const cur = !!store.settings[key];
      store.updateSettings({ [key]: !cur });
      render();
    },
    'level-toggle'(el) {
      const lv = Number(el.dataset.level);
      const levels = new Set(store.settings.levels);
      if (levels.has(lv)) {
        if (levels.size === 1) {
          toast('至少保留一个频段', 'err');
          return;
        }
        levels.delete(lv);
      } else {
        levels.add(lv);
      }
      store.updateSettings({ levels: [...levels] });
      render();
    },
    async export() {
      const json = store.export();
      const name = `wordmemory-backup-${dateKey()}.json`;
      downloadFile(name, json);
      toast('已导出备份文件', 'ok');
    },
    import() {
      const input = document.getElementById('import-file');
      if (input) input.click();
    },
    async reset() {
      const ok = await confirmDialog({
        title: '清空学习进度？',
        body: '所有卡片状态、复习记录与统计都会被删除，此操作无法撤销。<br/>建议先导出备份。',
        confirmText: '确认清空',
        danger: true,
      });
      if (!ok) return;
      store.reset({ keepSettings: true });
      state.session = null;
      state.question = null;
      toast('已清空学习进度', 'ok');
      render();
    },
  };

  /* ---------------- 事件绑定 ---------------- */

  delegate(root, 'click', '[data-action]', (event, el) => {
    const action = el.dataset.action;
    const fn = actions[action];
    if (!fn) return;
    event.preventDefault();
    try {
      fn(el);
    } catch (err) {
      console.error(err);
      toast(`操作失败：${err.message}`, 'err');
    }
  });

  delegate(root, 'input', '#search-input', (event, el) => {
    state.browse.query = el.value;
    state.browse.page = 0;
    render();
  });

  delegate(root, 'input', '#spell-input', (event) => {
    state.picked = event.target.value;
  });

  delegate(root, 'input', '[data-setting]', (event, el) => {
    const key = el.dataset.key || el.getAttribute('data-setting');
    const value = Number(el.value);
    if (!Number.isFinite(value)) return;
    store.updateSettings({ [key]: value });
  });

  delegate(root, 'change', '[data-select]', (event, el) => {
    store.updateSettings({ [el.dataset.select]: el.value });
    render();
  });

  delegate(root, 'change', '#import-file', (event, el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = store.import(String(reader.result));
      if (result.ok) {
        toast(`已导入 ${result.count} 条学习记录`, 'ok');
        state.session = null;
        state.question = null;
        render();
      } else {
        toast(result.error || '导入失败', 'err');
      }
    };
    reader.onerror = () => toast('文件读取失败', 'err');
    reader.readAsText(file);
    el.value = '';
  });

  delegate(root, 'keydown', '#spell-input', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitAnswer(event.target.value);
    }
  });

  document.addEventListener('keydown', (event) => {
    const tag = (event.target && event.target.tagName) || '';
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (event.key === 'Escape') {
      if (state.view === 'study' && state.session && !state.session.finished) {
        endSession();
      }
      return;
    }
    if (isTyping) return;
    if (state.view !== 'study' || !state.session || state.session.finished) return;

    if (state.phase === 'quiz') {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        actions.reveal();
        return;
      }
      const key = event.key.toLowerCase();
      if (['a', 'b', 'c', 'd'].includes(key) && state.question && state.question.options.length) {
        const idx = ['a', 'b', 'c', 'd'].indexOf(key);
        const opt = state.question.options[idx];
        if (opt) {
          event.preventDefault();
          submitAnswer({ key: opt.key });
        }
      }
      if (key === 's') {
        const card = state.session.current();
        if (card) speak(card.word.word);
      }
      return;
    }

    if (state.phase === 'reveal') {
      if (['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        submitGrade(Number(event.key) - 1);
      } else if (event.key === ' ') {
        event.preventDefault();
        submitGrade(GRADE.GOOD);
      } else if (event.key.toLowerCase() === 's') {
        const card = state.session.current();
        if (card) speak(card.word.word);
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      store.flush();
    } else if (state.view === 'today') {
      render();
    }
  });

  window.addEventListener('hashchange', () => {
    const view = viewFromHash();
    if (!view || view === state.view) return;
    state.view = view;
    render();
  });

  window.addEventListener('beforeunload', () => {
    store.flush();
  });

  // pagehide 在移动端与 bfcache 场景比 beforeunload 更可靠
  window.addEventListener('pagehide', () => {
    store.flush();
  });

  /* ---------------- 启动 ---------------- */

  mount();
  const initialView = viewFromHash();
  if (initialView) state.view = initialView;
  render();

  if (loadResult.fresh) {
    toast('欢迎使用 WordMemory，从今日任务开始吧', 'ok');
  } else if (!loadResult.ok) {
    toast('本地存档损坏，已重新开始（原数据仍保留在浏览器中）', 'err');
  }
  if (!store.isPersistent) {
    setTimeout(() => toast('当前环境无法自动保存进度，请在设置中导出备份', 'err'), 2600);
  }

  return { store, wordbook, state, render };
}
