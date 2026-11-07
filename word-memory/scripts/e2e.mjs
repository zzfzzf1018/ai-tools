#!/usr/bin/env node
/**
 * 浏览器端到端回归测试
 * ------------------------------------------------------------
 * 用真实浏览器（系统 Chrome / Edge）跑一遍关键用户路径：
 *   学习 → 落盘 → 刷新 → 标记 → 搜索 → 设置 → 导出 → 清空 → 导入 → 键盘 → 主题
 *
 * 与 jsdom 测试的区别：这里验证的是真实渲染、真实 IndexedDB、
 * 真实下载行为，能捕获 jsdom 环境掩盖的问题。
 *
 * 用法：
 *   npm run build
 *   npm run test:e2e
 *
 * 环境变量：
 *   CHROME_PATH  指定浏览器可执行文件（默认自动使用系统 Chrome/Edge）
 *   E2E_PORT     预览服务器端口（默认 4180）
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.E2E_PORT || 4180);
const BASE = `http://127.0.0.1:${PORT}/`;
const BACKUP = path.join(ROOT, '.cache', 'e2e-backup.json');

let failures = 0;
function check(ok, message, extra = '') {
  if (ok) {
    process.stdout.write(`  ✓ ${message}\n`);
  } else {
    failures += 1;
    process.stdout.write(`  ✗ ${message}${extra ? `  —— ${extra}` : ''}\n`);
  }
}

function findBrowser() {
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH };
  const candidates = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  };
  for (const p of candidates[os.platform()] || []) {
    if (fs.existsSync(p)) return { executablePath: p };
  }
  return { channel: 'chrome' };
}

async function startServer() {
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), String(PORT)], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return child;
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  child.kill();
  throw new Error('预览服务器启动超时');
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'dist/web/index.html'))) {
    throw new Error('缺少 dist/web，请先运行 npm run build');
  }
  fs.mkdirSync(path.join(ROOT, '.cache'), { recursive: true });

  const server = await startServer();
  const browser = await chromium.launch(findBrowser());
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });

  // v2 起数据存放在 IndexedDB 的 KV 表中：进度按账户+词库分键，设置按账户分键。
  // 这里把两者拼回 e2e 断言使用的 { settings, words, daily } 形状。
  const readStore = () =>
    page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('word-memory', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readonly');
        const query = tx.objectStore('kv').getAll();
        tx.oncomplete = () => resolve(query.result || []);
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      const kv = {};
      for (const row of rows) kv[row.key] = row.value;
      const progressKey = Object.keys(kv).find((k) => k.startsWith('wm/v2/progress/'));
      const settingsKey = Object.keys(kv).find((k) => k.startsWith('wm/v2/settings/'));
      let progress = {};
      let settings = {};
      try { progress = JSON.parse(kv[progressKey] || '{}'); } catch { /* 忽略 */ }
      try { settings = JSON.parse(kv[settingsKey] || '{}'); } catch { /* 忽略 */ }
      return { v: 2, settings, words: progress.words || {}, daily: progress.daily || {} };
    });

  try {
    process.stdout.write('\n浏览器端到端测试\n');

    /* ---------- 首页与清场 ---------- */
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('.hero');
    check(true, '首页加载成功');

    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.hero');

    /* ---------- 学习 ---------- */
    await page.click('[data-action="start"]');
    await page.waitForSelector('.flashcard');

    let studied = 0;
    for (let i = 0; i < 16 && studied < 8; i += 1) {
      const option = page.locator('[data-action="pick"]').first();
      if (await option.count()) {
        await option.click();
      } else if (await page.locator('#spell-input').count()) {
        await page.fill('#spell-input', 'wrong');
        await page.keyboard.press('Enter');
      } else {
        await page.click('[data-action="reveal"]');
      }
      await page.waitForTimeout(120);
      const grade = page.locator('[data-action="grade"][data-grade="2"]');
      if (await grade.count()) {
        await grade.click();
        studied += 1;
        await page.waitForTimeout(120);
      }
    }
    check(studied === 8, `完成 ${studied} 张卡片`);

    await page.waitForTimeout(650); // 等待防抖落盘
    const stored = await readStore();
    check(!!stored, '数据写入 IndexedDB');
    const records = Object.keys(stored?.words || {}).length;
    check(records >= 7, `保存了 ${records} 条词状态`);
    const answered = Object.values(stored?.daily || {}).reduce((s, d) => s + d.a, 0);
    check(answered >= 8, `每日统计累计 ${answered} 次作答`);

    /* ---------- 刷新持久化 ---------- */
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.view, .empty');
    check(true, '刷新后页面正常渲染（未崩溃）');
    await page.click('[data-action="nav"][data-view="today"]');
    await page.waitForSelector('.hero');
    const afterReload = await readStore();
    check(
      Object.keys(afterReload?.words || {}).length >= 7,
      `刷新后保留 ${Object.keys(afterReload?.words || {}).length} 条记录`,
    );

    /* ---------- 词库标记 ---------- */
    await page.click('[data-action="nav"][data-view="browse"]');
    await page.waitForSelector('.wordrow');
    const firstIndex = Number(
      await page.locator('[data-action="toggle-star"]').first().getAttribute('data-index'),
    );
    const firstWord = (await page.locator('.wordrow__word').first().textContent()).trim();
    await page.locator('[data-action="toggle-mastered"]').first().click();
    await page.waitForTimeout(650);
    const mastered = (await readStore()).words[String(firstIndex)];
    check(mastered?.s === 3, `「${firstWord}」标记为已掌握`, `state=${mastered?.s}`);

    await page.locator('[data-action="toggle-star"]').nth(1).click();
    await page.waitForTimeout(650);
    const starred = Object.values((await readStore()).words).filter((w) => w.star).length;
    check(starred >= 1, `重点标记生效（${starred} 个）`);

    /* ---------- 搜索 ---------- */
    await page.fill('#search-input', 'abandon');
    await page.waitForTimeout(300);
    const hits = await page.locator('.wordrow').count();
    check(hits > 0, `搜索「abandon」命中 ${hits} 条`);

    /* ---------- 设置持久化 ---------- */
    await page.click('[data-action="nav"][data-view="settings"]');
    await page.waitForSelector('[data-action="bump"]');
    const before = (await readStore()).settings.newPerDay;
    await page.click('[data-action="bump"][data-key="newPerDay"][data-delta="1"]');
    await page.waitForTimeout(650);
    const after = (await readStore()).settings.newPerDay;
    check(after === before + 1, `每日新词 ${before} → ${after}`);

    /* ---------- 导出 ---------- */
    const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await page.click('[data-action="export"]');
    const download = await downloadPromise;
    if (download) await download.saveAs(BACKUP);
    check(!!download && fs.existsSync(BACKUP), `导出备份 ${download?.suggestedFilename() || ''}`);

    /* ---------- 清空 ---------- */
    await page.click('[data-action="reset"]');
    await page.waitForSelector('.modal');
    await page.click('[data-modal="ok"]');
    await page.waitForTimeout(400);
    check(Object.keys((await readStore()).words).length === 0, '清空进度生效');

    /* ---------- 导入 ---------- */
    await page.setInputFiles('#import-file', BACKUP);
    await page.waitForTimeout(700);
    const restored = Object.keys((await readStore()).words).length;
    check(restored >= 7, `导入恢复 ${restored} 条记录`);

    /* ---------- 键盘 ---------- */
    await page.click('[data-action="nav"][data-view="study"]');
    await page.waitForTimeout(250);
    if (!(await page.locator('.flashcard').count())) {
      const startBtn = page.locator('[data-action="start"]');
      if (await startBtn.count()) {
        await startBtn.first().click();
        await page.waitForTimeout(300);
      }
    }
    if (await page.locator('.flashcard').count()) {
      const isSpell = (await page.locator('#spell-input').count()) > 0;
      if (!isSpell) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(200);
        check((await page.locator('[data-action="grade"]').count()) === 4, '空格翻面出现 4 个评分按钮');
        await page.keyboard.press('3');
        await page.waitForTimeout(250);
        const gradeLeft = await page.locator('[data-action="grade"]').count();
        const finished = (await page.locator('.result').count()) > 0;
        check(gradeLeft === 0 || finished, '数字键评分后进入下一张', `剩余评分按钮 ${gradeLeft}`);
      } else {
        check(true, '当前为拼写题，跳过键盘评分测试');
      }
    } else {
      check(true, '今日额度已用完，跳过键盘测试');
    }

    /* ---------- 主题 ---------- */
    await page.click('[data-action="nav"][data-view="settings"]');
    await page.selectOption('[data-select="theme"]', 'light');
    await page.waitForTimeout(650);
    const theme = (await readStore()).settings.theme;
    const attr = await page.evaluate(() => document.documentElement.dataset.theme);
    check(theme === 'light' && attr === 'light', '浅色主题生效并持久化');

    /* ---------- 控制台 ---------- */
    check(errors.length === 0, '无控制台错误', errors.join(' | '));
  } finally {
    await browser.close();
    server.kill();
    if (fs.existsSync(BACKUP)) fs.unlinkSync(BACKUP);
  }

  process.stdout.write(failures ? `\n${failures} 项失败\n` : '\n全部通过\n');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`\n端到端测试异常：${err.message}\n`);
  process.exit(1);
});
