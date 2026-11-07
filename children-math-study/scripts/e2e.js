#!/usr/bin/env node
/* ===== 浏览器端到端回归 =====
   用法：npm run e2e
   用 Edge/Chrome headless 加载 scripts/e2e.html，读取页面内 #e2e-out 的断言结果。
   无第三方依赖；找不到浏览器时打印 SKIP 并以 0 退出，不阻塞发版。
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const HTML = path.join(__dirname, 'e2e.html');
const PROFILE_ROOT = path.join(os.tmpdir(), 'mathwonder-e2e-' + process.pid);

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium'
];
const browser = candidates.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!browser) {
  console.log('SKIP: 未找到 Edge/Chrome headless，端到端回归跳过（不视为失败）');
  process.exit(0);
}

fs.mkdirSync(PROFILE_ROOT, { recursive: true });
const domFile = path.join(PROFILE_ROOT, 'dom.html');
const fileUrl = 'file:///' + HTML.replace(/\\/g, '/');

function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

try {
  const stdout = execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--virtual-time-budget=90000',
    '--user-data-dir=' + path.join(PROFILE_ROOT, 'profile'),
    '--dump-dom', fileUrl
  ], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(domFile, stdout);
} catch (e) {
  console.error('E2E 启动浏览器失败：' + e.message);
  process.exitCode = 1;
}

const dom = fs.existsSync(domFile) ? fs.readFileSync(domFile, 'utf8') : '';
const m = dom.match(/<pre id="e2e-out">([\s\S]*?)<\/pre>/);
if (!m) {
  console.error('E2E 未产出结果（页面脚本可能未跑完），DOM 字节数：' + dom.length);
  process.exit(1);
}

let O;
try { O = JSON.parse(decode(m[1])); }
catch (e) {
  console.error('E2E 结果解析失败：' + e.message);
  console.error(m[1].slice(0, 500));
  process.exit(1);
}

const total = O.info.totalChecks || Object.keys(O.checks).length;
console.log(`E2E 断言：${total - O.fails.length}/${total} 通过，JS 错误 ${O.errors.length} 条`);
if (O.info.questionCount) {
  console.log(`  完整通关 ${O.info.questionCount} 题（实际作答 ${O.info.answered}）· 单元小测抽题 ${O.info.quizQuestions} 道`);
}
if (O.errors.length) O.errors.forEach(e => console.log('  ✗ ' + e));
if (O.fails.length) O.fails.forEach(f => console.log('  ✗ ' + f));

try { fs.rmSync(PROFILE_ROOT, { recursive: true, force: true }); } catch (e) { /* ignore */ }

if (O.errors.length || O.fails.length) process.exit(1);
console.log('E2E ALL-PASS');
