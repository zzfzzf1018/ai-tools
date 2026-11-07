#!/usr/bin/env node
/**
 * EXE 便携版真实浏览器端到端测试
 * ------------------------------------------------------------
 * 以 WM_HEADLESS=1 启动 dist/WordMemory.exe（Electron 只起服务、不建窗口），
 * 从 runtime.json 读取端口，用 Playwright 驱动系统 Chrome 访问它，验证：
 *   启动 → 8000 词内置词库 → 标记进度落盘到文件 → 新建账户 →
 *   导入自定义词库 → 切换 → 刷新后数据保持 → 退出
 *
 * 用法：npm run build:exe && npm run test:e2e:exe
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXE = path.join(ROOT, 'dist/WordMemory.exe');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-exe-e2e-'));

let failures = 0;
function check(ok, message, extra = '') {
  if (!ok) failures += 1;
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${message}${extra ? `  —— ${extra}` : ''}\n`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/** Electron GUI 程序 stdout 不可靠，主进程把端口写到数据目录 runtime.json */
async function waitRuntime(dataDir, timeout = 120000) {
  const file = path.join(dataDir, 'runtime.json');
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) {
      try {
        const info = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Number(info.port) > 0) return info;
      } catch {
        /* 写入中 */
      }
    }
    await sleep(200);
  }
  const logFile = path.join(dataDir, 'wordmemory.log');
  const tail = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').slice(-2000) : '';
  throw new Error(`EXE 未写出 runtime.json\n${tail}`);
}

async function main() {
  if (!fs.existsSync(EXE)) throw new Error('缺少 dist/WordMemory.exe，请先运行 npm run build:exe');
  const executablePath = chromePath();
  if (!executablePath) throw new Error('未找到 Chrome / Edge，可设置 CHROME_PATH');

  fs.rmSync(path.join(DATA, 'runtime.json'), { force: true });
  const childEnv = { ...process.env, WM_HEADLESS: '1', WM_DATA_DIR: DATA };
  // 从 Electron 宿主派生的终端可能带此变量，会让 EXE 退化成纯 Node
  delete childEnv.ELECTRON_RUN_AS_NODE;
  delete childEnv.ELECTRON_NO_ATTACH_CONSOLE;
  let output = '';
  const exe = spawn(EXE, [], {
    cwd: path.dirname(EXE),
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  exe.stdout.on('data', (b) => { output += b.toString('utf8'); });
  exe.stderr.on('data', (b) => { output += b.toString('utf8'); });

  let browser;
  try {
    const runtime = await waitRuntime(DATA);
    const port = runtime.port;
    const base = `http://127.0.0.1:${port}`;
    check(true, 'EXE 启动并监听本机端口', `端口 ${port} · engine=${runtime.engine || 'unknown'}`);
    check(runtime.engine === 'electron', '使用 Electron 引擎', `v${runtime.version || '—'}`);

    const html = await (await fetch(`${base}/`)).text();
    const token = JSON.parse(html.match(/__WM_PORTABLE__=(\{.*?\});<\/script>/s)[1]).token;
    const headers = { 'x-wm-token': token };
    const snapshot = async () => (await (await fetch(`${base}/api/snapshot`, { headers })).json()).kv;

    browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero', { timeout: 20000 });
    check(true, '页面在 EXE 服务下完成挂载');

    check((await page.locator('#book-select option').count()) === 1, '默认只有内置 8000 词库');
    check((await page.locator('#account-select option').count()) === 1, '默认只有一个账户');
    check((await page.locator('.topbar__mode').textContent()).includes('便携版'), '顶栏显示便携版存储模式');

    await page.click('[data-action="nav"][data-view="browse"]');
    await page.waitForSelector('.wordrow');
    const matched = await page.locator('span:has-text("匹配 8000 个词")').count();
    check(matched > 0, '内置词库加载出 8000 词');

    // 标记重点 → 触发落盘
    await page.locator('[data-action="toggle-star"]').first().click();
    await sleep(900);
    const kv1 = await snapshot();
    const progressKey = Object.keys(kv1).find((k) => k.startsWith('wm/v2/progress/'));
    check(!!progressKey && kv1[progressKey].includes('"star":1'), '学习记录写入 EXE 同目录文件', progressKey || '未找到');
    const files = fs.readdirSync(path.join(DATA, 'kv'));
    check(files.length >= 2, '便携目录生成了数据文件', `${files.length} 个`);

    // 新建账户
    await page.click('[data-action="nav"][data-view="settings"]');
    await page.click('[data-action="account-add"]');
    await page.fill('#modal-input', '小明');
    await page.click('[data-modal="ok"]');
    await page.waitForFunction(() => document.querySelectorAll('#account-select option').length === 2);
    const meta = JSON.parse((await snapshot())['wm/v2/meta']);
    check(meta.accounts.length === 2 && meta.activeAccountId === meta.accounts[1].id, '新账户已创建并自动切换');

    // 导入自定义词库
    await page.setInputFiles('#import-book-file', {
      name: 'fruit.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('apple,苹果\nbanana,香蕉\ncherry,樱桃\n', 'utf8'),
    });
    await page.waitForFunction(() => document.querySelectorAll('#book-select option').length === 2);
    check((await page.locator('#brand-sub').textContent()) === 'fruit', '导入 CSV 词库后自动切换');
    const metaAfterImport = JSON.parse((await snapshot())['wm/v2/meta']);
    const customBook = metaAfterImport.books.find((b) => !b.builtin);
    check((await page.locator('#book-select').inputValue()) === customBook.id, '词库下拉已选中新词库');

    // 刷新：账户、词库、进度都从文件恢复
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#account-select');
    check((await page.locator('#account-select option').count()) === 2, '刷新后账户仍在');
    check((await page.locator('#book-select option').count()) === 2, '刷新后自定义词库仍在');
    check((await page.locator('#account-select').inputValue()) === meta.accounts[1].id, '刷新后仍在新账户');
    const kv2 = await snapshot();
    check(JSON.parse(kv2['wm/v2/meta']).activeBook[meta.accounts[1].id] !== undefined, '账户与词库的绑定被持久化');

    check(errors.length === 0, '浏览器控制台无未捕获异常', errors.join(' | '));

    await fetch(`${base}/api/shutdown`, { method: 'POST', headers }).catch(() => null);
  } finally {
    if (browser) await browser.close();
    if (exe.exitCode === null) exe.kill();
    try {
      fs.rmSync(DATA, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  }

  process.stdout.write('\n');
  if (failures) {
    process.stderr.write(`EXE 端到端失败 ${failures} 项\n`);
    process.exit(1);
  }
  process.stdout.write('EXE 端到端全部通过\n');
}

main().catch((err) => {
  process.stderr.write(`EXE 端到端异常：${err.stack || err.message}\n`);
  process.exit(1);
});
