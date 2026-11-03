// Web to Markdown - 设置页面逻辑

const $ = (id) => document.getElementById(id);
const form = $('settings-form');

// 绑定 DOM ID -> 配置键
const FIELD_MAP = {
  includeMetaHeader: 'includeMetaHeader',
  obsidianFrontMatter: 'obsidianFrontMatter',
  headingStyle: 'headingStyle',
  codeBlockStyle: 'codeBlockStyle',
  bulletListMarker: 'bulletListMarker',
  emDelimiter: 'emDelimiter',
  detectCodeLanguage: 'detectCodeLanguage',
  fixHeadingLevels: 'fixHeadingLevels',
  preserveMath: 'preserveMath',
  imageHandling: 'imageHandling',
  imageDownloadDir: 'imageDownloadDir',
  filenameTemplate: 'filenameTemplate',
  enableHistory: 'enableHistory',
  historyMaxItems: 'historyMaxItems',
  showArticlePreview: 'showArticlePreview'
};

// 加载配置并填充表单
(async function init() {
  const settings = await wmdConfig.load();
  for (const [domId, key] of Object.entries(FIELD_MAP)) {
    const el = $(domId);
    if (!el) continue;
    if (el.type === 'checkbox') {
      el.checked = !!settings[key];
    } else {
      el.value = settings[key];
    }
  }
  bindConditional();
  updateHistoryInfo();
})();

// 根据值显隐条件字段
function bindConditional() {
  document.querySelectorAll('.conditional').forEach((el) => {
    const dep = el.dataset.dep;
    const val = el.dataset.val;
    const sourceEl = document.getElementById(dep);
    if (!sourceEl) return;

    const update = () => {
      let actualVal;
      if (sourceEl.type === 'checkbox') actualVal = sourceEl.checked ? 'true' : 'false';
      else actualVal = sourceEl.value;
      el.classList.toggle('hidden', actualVal !== val);
    };

    sourceEl.addEventListener('change', update);
    update();
  });
}

// 收集表单值 -> 配置对象
function collectForm() {
  const result = {};
  for (const [domId, key] of Object.entries(FIELD_MAP)) {
    const el = $(domId);
    if (!el) continue;
    if (el.type === 'checkbox') {
      result[key] = el.checked;
    } else if (el.type === 'number') {
      result[key] = parseInt(el.value, 10) || wmdConfig.DEFAULTS[key];
    } else {
      result[key] = el.value.trim() || wmdConfig.DEFAULTS[key];
    }
  }
  return result;
}

// 保存
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const settings = collectForm();
    await wmdConfig.save(settings);
    showStatus('设置已保存', false);
  } catch (err) {
    showStatus('保存失败：' + err.message, true);
  }
});

// 恢复默认
$('btn-reset').addEventListener('click', async () => {
  if (!confirm('确定恢复全部默认设置吗？')) return;
  await wmdConfig.reset();
  const settings = wmdConfig.getSync();
  for (const [domId, key] of Object.entries(FIELD_MAP)) {
    const el = $(domId);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!settings[key];
    else el.value = settings[key];
  }
  bindConditional();
  showStatus('已恢复默认', false);
});

// 清空历史
$('btn-clear-history').addEventListener('click', () => {
  if (!confirm('确定清空所有转换历史吗？此操作不可恢复。')) return;
  chrome.storage.local.remove('wmd-history', () => {
    updateHistoryInfo();
    showStatus('历史已清空', false);
  });
});

function showStatus(msg, isError) {
  const el = $('save-status');
  el.textContent = msg;
  el.className = 'save-status' + (isError ? ' error' : '');
  setTimeout(() => { el.textContent = ''; }, 3000);
}

function updateHistoryInfo() {
  chrome.storage.local.get({ 'wmd-history': [] }, (result) => {
    $('history-info').textContent = `当前 ${result['wmd-history'].length} 条记录`;
  });
}
