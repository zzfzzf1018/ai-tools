// Web to Markdown - 弹窗逻辑
// 职责：触发提取、调用共享转换模块、复制到剪贴板、下载 .md 文件、历史记录展示。

const $ = (id) => document.getElementById(id);
const output = $('output');
const statusEl = $('status');
const wordCount = $('word-count');
const btnArticle = $('btn-article');
const btnSelection = $('btn-selection');
const btnCopy = $('btn-copy');
const btnDownload = $('btn-download');
const btnSettings = $('btn-settings');
const historySection = $('history-section');
const historyList = $('history-list');
const btnClearHistory = $('btn-clear-history');

// 与 background.js 保持一致的注入脚本列表
const CONTENT_SCRIPTS = [
  'lib/readability.js',
  'lib/turndown.js',
  'lib/turndown-plugin-gfm.js',
  'lib/config.js',
  'lib/markdown-convert.js',
  'content/content.js'
];

let currentTitle = '';
let currentUrl = '';
let settings = null;

// === 初始化 ===

(async function init() {
  // 加载配置
  settings = await wmdConfig.load();

  // 设置按钮
  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 主按钮事件
  btnArticle.addEventListener('click', () => convert('article'));
  btnSelection.addEventListener('click', () => convert('selection'));
  btnCopy.addEventListener('click', copyMarkdown);
  btnDownload.addEventListener('click', downloadMarkdown);
  output.addEventListener('input', () => {
    updateButtons();
    updateCount();
  });

  // 历史记录
  btnClearHistory.addEventListener('click', () => {
    chrome.storage.local.remove('wmd-history', () => {
      renderHistory([]);
      showStatus('历史已清空', 'info');
    });
  });

  renderHistory();
})();

// === 主流程 ===

async function convert(mode) {
  hideStatus();
  setBusy(true);
  try {
    const tab = await getActiveTab();
    if (/^(edge|chrome|about|chrome-extension|edge-extension|devtools):/i.test(tab.url || '')) {
      throw new Error('浏览器内置页面不支持转换，请在普通网页上使用');
    }
    await ensureInjected(tab.id);

    // 如果启用了预览模式且是 article 模式，先高亮正文区域让用户确认
    if (settings.showArticlePreview && mode === 'article') {
      const confirmed = await showPreviewAndConfirm(tab.id);
      if (!confirmed) {
        showStatus('已取消转换', 'info');
        return;
      }
    }

    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'wmd:extract', mode });
    if (!resp || !resp.ok) {
      throw new Error((resp && resp.error) || '内容提取失败');
    }
    const { title, html, url } = resp.data;
    currentTitle = title;
    currentUrl = url;
    output.value = window.wmdToMarkdown(html, { title, url });

    // 保存到历史记录
    saveToHistory({ title, url, mode });
  } catch (e) {
    showStatus('转换失败：' + (e.message || e), 'error');
  } finally {
    setBusy(false);
    updateButtons();
    updateCount();
  }
}

// 在页面上高亮 Readability 识别的正文区域，返回用户是否确认
function showPreviewAndConfirm(tabId) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      chrome.runtime.onMessage.removeListener(listener);
      clearTimeout(timeoutId);
      resolve(result);
    };

    const listener = (msg, sender, sendResponse) => {
      if (msg && msg.type === 'wmd:preview-result') {
        sendResponse && sendResponse({ ok: true });
        finish(!!msg.confirmed);
      }
    };

    const timeoutId = setTimeout(() => {
      finish(false); // 超时自动取消
    }, 30000);

    // 先注册 listener，再发消息，避免竞态导致消息丢失
    chrome.runtime.onMessage.addListener(listener);

    chrome.tabs.sendMessage(tabId, { type: 'wmd:preview-start' }, (resp) => {
      if (chrome.runtime.lastError) {
        finish(true); // sendMessage 本身失败（tab 跳走了、content 挂了），跳过预览
        return;
      }
      if (!resp || !resp.ok) {
        finish(true); // content 启动预览失败，跳过预览直接转
      }
      // 正常情况下 content 收到 preview-start 后显示 overlay，用户点按钮才会发 preview-result
      // 现在静静等 listener 捕获就行
    });
  });
}

// === 工具函数 ===

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('未找到活动标签页');
  return tab;
}

async function ensureInjected(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: CONTENT_SCRIPTS
  });
}

// === 剪贴板 ===

async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(output.value);
    showStatus('已复制到剪贴板', 'info');
  } catch {
    output.select();
    document.execCommand('copy');
    showStatus('已复制到剪贴板', 'info');
  }
}

// === 下载 ===

function downloadMarkdown() {
  const blob = new Blob([output.value], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const filename = window.wmdResolveFilename(
    settings.filenameTemplate || '{{title}}',
    { title: currentTitle, url: currentUrl }
  );

  chrome.downloads.download(
    { url, filename: filename + '.md', saveAs: true },
    () => {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      if (chrome.runtime.lastError) {
        showStatus('下载失败：' + chrome.runtime.lastError.message, 'error');
      }
    }
  );
}

// === 历史记录 ===

function saveToHistory(item) {
  if (!settings.enableHistory) return;
  chrome.storage.local.get({ 'wmd-history': [] }, (result) => {
    let list = result['wmd-history'] || [];
    // 移除同一 URL 的旧记录
    list = list.filter(x => x.url !== item.url);
    // 新记录插入头部
    list.unshift(Object.assign({ time: Date.now() }, item));
    // 限制条数
    const max = settings.historyMaxItems || 10;
    list = list.slice(0, max);
    chrome.storage.local.set({ 'wmd-history': list }, () => renderHistory(list));
  });
}

function renderHistory(list) {
  if (!list) {
    chrome.storage.local.get({ 'wmd-history': [] }, (result) => {
      renderHistory(result['wmd-history'] || []);
    });
    return;
  }

  if (!list.length) {
    historySection.classList.add('hidden');
    return;
  }

  historySection.classList.remove('hidden');
  historyList.innerHTML = '';
  list.forEach((item) => {
    const li = document.createElement('li');
    const time = new Date(item.time).toLocaleString();
    li.innerHTML =
      '<div class="title">' + escapeHtml(item.title) + '</div>' +
      '<div class="url">' + escapeHtml(item.url) + ' · ' + time + '</div>';
    li.addEventListener('click', () => {
      // 点击历史记录：打开对应 URL
      chrome.tabs.create({ url: item.url });
    });
    li.title = '点击在新标签页打开';
    historyList.appendChild(li);
  });
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

// === UI 状态 ===

function setBusy(busy) {
  btnArticle.disabled = busy;
  btnSelection.disabled = busy;
  btnArticle.textContent = busy ? '转换中…' : '转换正文';
}

function updateButtons() {
  const hasContent = output.value.trim().length > 0;
  btnCopy.disabled = !hasContent;
  btnDownload.disabled = !hasContent;
}

function updateCount() {
  wordCount.textContent = output.value.length > 0 ? output.value.length + ' 字符' : '';
}

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = 'status ' + type;
}

function hideStatus() {
  statusEl.className = 'status hidden';
}
