/**
 * 应用入口
 * 负责加载词库数据、准备存储后端（工作区）并启动界面。
 *
 * 词库数据来源：
 *   1. 单文件版：构建时注入 window.__WORD_DATA__
 *   2. Web 版 / EXE 便携版：同目录下 data/words.json
 *
 * 存储后端：
 *   1. Web 版 / 单文件版：浏览器 IndexedDB（降级 localStorage / 内存）
 *   2. EXE 便携版：内置本地服务的文件存储（window.__WM_PORTABLE__）
 */

import { createApp } from './ui/app.js';
import { createBrowserKV, createHttpKV } from './core/kv.js';
import { createWorkspace } from './core/workspace.js';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0-dev';

async function loadPayload() {
  if (window.__WORD_DATA__) return window.__WORD_DATA__;
  const url = new URL('data/words.json', document.baseURI);
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`词库加载失败（HTTP ${res.status}）`);
  return res.json();
}

/** 准备 KV 后端与工作区；旧版 v1 存档会在这里自动迁移 */
async function bootWorkspace(builtinPayload) {
  const portableFlag = window.__WM_PORTABLE__;
  let kv;
  let legacy = null;
  let portable = null;

  if (portableFlag) {
    const http = createHttpKV({ base: '/api', token: portableFlag.token || '' });
    kv = await http.load();
    portable = {
      dataDir: portableFlag.dataDir || '',
      ping: () => http.ping(),
      beacon: () => {
        try {
          if (navigator.sendBeacon) navigator.sendBeacon('/api/ping', '');
        } catch {
          /* 忽略 */
        }
      },
    };
  } else {
    const result = await createBrowserKV();
    kv = result.kv;
    legacy = result.legacy;
  }

  const workspace = createWorkspace({ kv, builtinPayload, legacy });
  return { workspace, portable };
}

function showFatal(root, message) {
  root.innerHTML = `
    <div class="boot boot--error">
      <div>
        <div style="font-size:15px;margin-bottom:8px">无法启动 WordMemory</div>
        <div style="font-size:13px;color:var(--text-faint)">${message}</div>
        <div style="font-size:12.5px;color:var(--text-faint);margin-top:14px">
          若是直接双击打开 HTML，请改用单文件版（dist/word-memory.html）或 EXE 便携版；
          Web 版需要通过 HTTP 访问。
        </div>
      </div>
    </div>`;
}

async function boot() {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = '<div class="boot">正在加载词库与学习记录…</div>';
  try {
    const payload = await loadPayload();
    const { workspace, portable } = await bootWorkspace(payload);
    createApp({ root, payload, version: VERSION, workspace, portable });
  } catch (err) {
    console.error(err);
    showFatal(root, String(err?.message || err));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
