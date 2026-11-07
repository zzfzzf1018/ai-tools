/**
 * 应用入口
 * 负责加载词库数据并启动界面。
 * 数据来源有两种：
 *   1. 单文件版：构建时注入 window.__WORD_DATA__
 *   2. Web 版：同目录下 data/words.json
 */

import { createApp } from './ui/app.js';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0-dev';

async function loadPayload() {
  if (window.__WORD_DATA__) return window.__WORD_DATA__;
  const url = new URL('data/words.json', document.baseURI);
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`词库加载失败（HTTP ${res.status}）`);
  return res.json();
}

function showFatal(root, message) {
  root.innerHTML = `
    <div class="boot boot--error">
      <div>
        <div style="font-size:15px;margin-bottom:8px">无法启动 WordMemory</div>
        <div style="font-size:13px;color:var(--text-faint)">${message}</div>
        <div style="font-size:12.5px;color:var(--text-faint);margin-top:14px">
          若是直接双击打开 HTML，请改用单文件版（dist/word-memory.html）；
          Web 版需要通过 HTTP 访问。
        </div>
      </div>
    </div>`;
}

async function boot() {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = '<div class="boot">正在加载 8000 个单词…</div>';
  try {
    const payload = await loadPayload();
    createApp({ root, payload, version: VERSION });
  } catch (err) {
    console.error(err);
    showFatal(root, String(err.message || err));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
