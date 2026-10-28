/* 弹窗逻辑：读写设置、点选侧栏、自动识别诊断 */
const DEFAULTS = { enabled: true, reflow: true, extraSelectors: '' };

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const resultEl = $('result');

function setStatus(text, isError) {
  statusEl.textContent = text || '';
  statusEl.className = isError ? 'err' : '';
}

function activeTab() {
  return new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
}

function sendToTab(tab, payload) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab, payload, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(res);
    });
  });
}

function notInjected(err) {
  setStatus(
    '当前标签页没连上扩展。\n' +
      '· 地址必须是 *.zhihu.com\n' +
      '· 装完后要 Ctrl+Shift+R 强刷一次知乎页面\n' +
      '· 别在 edge:// 或扩展商店页面上打开本弹窗',
    true
  );
}

function renderSelectors(text) {
  $('extra').value = text || '';
}

/* 初始化：读设置 + ping 页面 */
chrome.storage.local.get(DEFAULTS, (saved) => {
  const s = Object.assign({}, DEFAULTS, saved || {});
  $('enabled').checked = !!s.enabled;
  $('reflow').checked = !!s.reflow;
  renderSelectors(s.extraSelectors);
  if (s.extraSelectors) setStatus('已锁定 ' + s.extraSelectors.split('\n').filter(Boolean).length + ' 条自定义选择器');
});

(async () => {
  try {
    const [tab] = await activeTab();
    const res = await sendToTab(tab.id, { type: 'zsh:ping' });
    $('ver').textContent =
      '页面脚本 v' + res.version + ' · 当前隐藏 ' + res.hidden + ' 个元素' + (res.enabled ? '' : '（已停用）');
  } catch (err) {
    $('ver').textContent = '页面脚本未连接';
    notInjected(err);
  }
})();

$('enabled').addEventListener('change', (e) => chrome.storage.local.set({ enabled: e.target.checked }));
$('reflow').addEventListener('change', (e) => chrome.storage.local.set({ reflow: e.target.checked }));

$('pick').addEventListener('click', async () => {
  resultEl.textContent = '';
  try {
    const [tab] = await activeTab();
    setStatus('把鼠标移到知乎页面左侧那个图标栏上（会高亮蓝框），单击它即可。按 Esc 取消。');
    const res = await sendToTab(tab.id, { type: 'zsh:pick' });
    if (res && res.ok) {
      renderSelectors((stateText() + '\n' + res.selector).split('\n').filter(Boolean).join('\n'));
      setStatus('已锁定：' + res.selector + '  （' + res.box.width + '×' + res.box.height + '）');
    } else {
      setStatus((res && res.error) || '点选失败，换个位置再点一次。', true);
    }
  } catch (err) {
    notInjected(err);
  }
});

function stateText() {
  return $('extra').value.trim();
}

$('save').addEventListener('click', async () => {
  const text = stateText();
  chrome.storage.local.set({ extraSelectors: text }, () => setStatus('已保存，正在重新应用…'));
  try {
    const [tab] = await activeTab();
    await sendToTab(tab.id, { type: 'zsh:apply' });
    setStatus(text ? '已保存并应用（' + text.split('\n').filter(Boolean).length + ' 条）' : '已清空，改用自动识别');
  } catch (err) {
    setStatus('设置已保存，但页面没响应 —— 刷新知乎页面后生效。', true);
  }
});

$('clear').addEventListener('click', () => {
  $('extra').value = '';
  chrome.storage.local.set({ extraSelectors: '' });
  resultEl.textContent = '';
  setStatus('已清空自定义选择器，恢复自动识别。');
});

$('diagnose').addEventListener('click', async () => {
  resultEl.textContent = '';
  setStatus('扫描中…');
  try {
    const [tab] = await activeTab();
    const res = await sendToTab(tab.id, { type: 'zsh:diagnose' });
    if (!res || !res.items || !res.items.length) {
      setStatus(
        '扫了 ' + (res ? res.scanned : '?') + ' 个元素，没找到符合特征的侧栏。\n请点「① 点选侧栏」，直接在页面上点它一下。',
        true
      );
      return;
    }
    setStatus('找到 ' + res.items.length + ' 个候选，点一条可加入自定义：');
    for (const item of res.items) {
      const box = item.box;
      const div = document.createElement('div');
      div.className = 'item';
      div.textContent = item.selectorSuggestion;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent =
        box.width + '×' + box.height + ' @ left ' + box.left + ', top ' + box.top + ' · ' + item.position;
      div.appendChild(meta);
      div.title = '点击写入自定义选择器';
      div.addEventListener('click', () => {
        const lines = stateText().split('\n').map((l) => l.trim()).filter(Boolean);
        if (!lines.includes(item.selectorSuggestion)) {
          lines.push(item.selectorSuggestion);
          renderSelectors(lines.join('\n'));
          setStatus('已加入输入框，点「③ 保存并应用」生效');
        }
      });
      resultEl.appendChild(div);
    }
  } catch (err) {
    notInjected(err);
  }
});
