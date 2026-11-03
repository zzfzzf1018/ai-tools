// Web to Markdown - 弹窗逻辑
// 职责：触发提取、调用共享转换模块、复制到剪贴板、下载 .md 文件。

const $ = (id) => document.getElementById(id);
const output = $('output');
const statusEl = $('status');
const wordCount = $('word-count');
const btnArticle = $('btn-article');
const btnSelection = $('btn-selection');
const btnCopy = $('btn-copy');
const btnDownload = $('btn-download');

// 与 background.js 保持一致的注入脚本列表
const CONTENT_SCRIPTS = [
  'lib/readability.js',
  'lib/turndown.js',
  'lib/turndown-plugin-gfm.js',
  'lib/markdown-convert.js',
  'content/content.js'
];

let currentTitle = '';

btnArticle.addEventListener('click', () => convert('article'));
btnSelection.addEventListener('click', () => convert('selection'));
btnCopy.addEventListener('click', copyMarkdown);
btnDownload.addEventListener('click', downloadMarkdown);
output.addEventListener('input', () => {
  updateButtons();
  updateCount();
});

// 主流程：注入脚本 -> 提取 HTML -> 转换为 Markdown -> 展示
async function convert(mode) {
  hideStatus();
  setBusy(true);
  try {
    const tab = await getActiveTab();
    if (/^(edge|chrome|about|chrome-extension|edge-extension|devtools):/i.test(tab.url || '')) {
      throw new Error('浏览器内置页面不支持转换，请在普通网页上使用');
    }
    await ensureInjected(tab.id);
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'wmd:extract', mode });
    if (!resp || !resp.ok) {
      throw new Error((resp && resp.error) || '内容提取失败');
    }
    const { title, html, url } = resp.data;
    currentTitle = title;
    output.value = window.wmdToMarkdown(html, { title, url });
  } catch (e) {
    showStatus('转换失败：' + (e.message || e), 'error');
  } finally {
    setBusy(false);
    updateButtons();
    updateCount();
  }
}

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

// 复制到剪贴板，失败时回退 execCommand
async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(output.value);
  } catch {
    output.select();
    document.execCommand('copy');
  }
  showStatus('已复制到剪贴板', 'info');
}

// 通过 chrome.downloads 下载，用户可选择保存位置
function downloadMarkdown() {
  const blob = new Blob([output.value], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download(
    { url, filename: sanitizeFilename(currentTitle) + '.md', saveAs: true },
    () => {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      if (chrome.runtime.lastError) {
        showStatus('下载失败：' + chrome.runtime.lastError.message, 'error');
      }
    }
  );
}

// 文件名清洗：移除非法字符，限制长度
function sanitizeFilename(name) {
  const clean = (name || 'page')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return clean || 'page';
}

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
