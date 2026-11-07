#!/usr/bin/env node
/**
 * 产物校验（构建后运行）
 * ------------------------------------------------------------
 * 对 dist 做端到端冒烟：
 *   1. 单文件版体积、内联完整性、无外部依赖
 *   2. 用 jsdom 真实加载单文件版并执行脚本，确认界面能渲染出 8000 词
 *   3. Web 版资源引用正确、数据文件完整
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SINGLE = path.join(DIST, 'word-memory.html');
const WEB = path.join(DIST, 'web');

const failures = [];
const checks = [];

function check(name, fn) {
  try {
    const detail = fn();
    checks.push({ name, ok: true, detail });
  } catch (err) {
    checks.push({ name, ok: false, detail: err.message });
    failures.push(`${name}：${err.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

async function main() {
  assert(fs.existsSync(DIST), '缺少 dist 目录，请先运行 npm run build');

  /* ---------- 单文件版 ---------- */
  check('单文件版存在', () => {
    assert(fs.existsSync(SINGLE), 'dist/word-memory.html 不存在');
    const size = fs.statSync(SINGLE).size;
    assert(size > 400 * 1024, `体积 ${(size / 1024).toFixed(1)}KB 偏小，可能数据未内联`);
    assert(size < 3 * 1024 * 1024, `体积 ${(size / 1024).toFixed(1)}KB 过大`);
    return `${(size / 1024).toFixed(1)} KB`;
  });

  const html = fs.existsSync(SINGLE) ? read(SINGLE) : '';

  check('单文件版内联了词库数据', () => {
    assert(html.includes('window.__WORD_DATA__'), '缺少内联数据');
    const match = html.match(/window\.__WORD_DATA__=(\{.*?\});<\/script>/s);
    assert(match, '内联数据格式异常');
    const payload = JSON.parse(match[1]);
    assert(payload.words.length === 8000, `内联词条 ${payload.words.length} 条，期望 8000`);
    return '8000 词';
  });

  check('单文件版无外部资源依赖', () => {
    const externalScript = /<script[^>]+src=/i.test(html);
    const externalCss = /<link[^>]+rel=["']stylesheet/i.test(html);
    const remote = /(?:src|href)=["']https?:\/\//i.test(html);
    assert(!externalScript, '存在外部 script 引用');
    assert(!externalCss, '存在外部样式表引用');
    assert(!remote, '存在远程资源引用，离线不可用');
    return '完全离线';
  });

  check('单文件版脚本与样式已内联', () => {
    assert(/<style>/.test(html), '缺少内联样式');
    assert(/<script>/.test(html), '缺少内联脚本');
    assert(html.includes('WordMemory'), '缺少应用标识');
  });

  /* ---------- 真实加载 ---------- */
  let bootOk = false;
  let bootDetail = '';
  try {
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      url: 'https://example.com/word-memory.html',
    });
    const doc = dom.window.document;
    const deadline = Date.now() + 15000;
    let mounted = false;
    while (Date.now() < deadline) {
      if (doc.querySelector('.brand__name') && doc.querySelector('.hero')) {
        mounted = true;
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50));
    }
    assert(mounted, '应用未在 15 秒内完成挂载');
    const navCount = doc.querySelectorAll('.nav__item').length;
    assert(navCount === 5, `导航项数量 ${navCount}，期望 5`);
    const title = doc.querySelector('.hero__title');
    assert(title && title.textContent.trim().length > 0, '今日视图标题为空');
    bootOk = true;
    bootDetail = '界面挂载成功';

    // 点进词库确认 8000 词可用
    const browseBtn = doc.querySelector('[data-action="nav"][data-view="browse"]');
    browseBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    const rows = doc.querySelectorAll('.wordrow').length;
    assert(rows === 50, `词库首屏 ${rows} 行，期望 50`);
    bootDetail += `，词库渲染 ${rows} 行`;
    dom.window.close();
  } catch (err) {
    bootDetail = err.message;
  }
  checks.push({ name: '单文件版可独立启动', ok: bootOk, detail: bootDetail });
  if (!bootOk) failures.push(`单文件版可独立启动：${bootDetail}`);

  /* ---------- Web 版 ---------- */
  check('Web 版资源引用完整', () => {
    assert(fs.existsSync(path.join(WEB, 'index.html')), '缺少 dist/web/index.html');
    const webHtml = read(path.join(WEB, 'index.html'));
    assert(webHtml.includes('assets/app.js'), '缺少 app.js 引用');
    assert(webHtml.includes('assets/app.css'), '缺少 app.css 引用');
    assert(!webHtml.includes('__WORD_DATA__'), 'Web 版不应内联数据');
    assert(fs.existsSync(path.join(WEB, 'assets/app.js')), '缺少 app.js 文件');
    assert(fs.existsSync(path.join(WEB, 'assets/app.css')), '缺少 app.css 文件');
    const data = JSON.parse(read(path.join(WEB, 'data/words.json')));
    assert(data.words.length === 8000, 'Web 版数据不完整');
    return 'index.html + assets + data';
  });

  /* ---------- 版本信息 ---------- */
  check('version.json 与产物一致', () => {
    const info = JSON.parse(read(path.join(DIST, 'version.json')));
    assert(info.version === JSON.parse(read(path.join(ROOT, 'package.json'))).version, '版本号不一致');
    assert(info.wordCount === 8000, '版本信息中的词数错误');
    assert(/^[0-9a-f]{16}$/.test(info.singleFileHash), '产物指纹格式异常');
    return `v${info.version} · ${info.singleFileHash}`;
  });

  /* ---------- 报告 ---------- */
  process.stdout.write('\n产物校验\n');
  for (const c of checks) {
    process.stdout.write(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? `  —— ${c.detail}` : ''}\n`);
  }
  process.stdout.write('\n');

  if (failures.length) {
    process.stderr.write(`校验失败 ${failures.length} 项：\n${failures.map((f) => `  - ${f}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`全部 ${checks.length} 项校验通过\n`);
}

main().catch((err) => {
  process.stderr.write(`校验异常：${err.stack || err.message}\n`);
  process.exit(1);
});
