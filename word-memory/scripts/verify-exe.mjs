#!/usr/bin/env node
/**
 * EXE 便携版冒烟测试
 * ------------------------------------------------------------
 * 以 WM_HEADLESS=1 启动 dist/WordMemory.exe（Electron 只起服务、不建窗口），
 * 从数据目录的 runtime.json 读取随机端口，再用真实 HTTP 请求验证：
 * 静态资源、令牌校验、快照读写、数据落盘、退出。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXE = path.join(ROOT, 'dist/WordMemory.exe');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-exe-test-'));

const checks = [];
const failures = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? `：${detail}` : ''}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 用原始 HTTP 请求显式设置 Host（fetch 不允许覆盖该头） */
function rawStatus(port, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/api/snapshot', method: 'GET', headers },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function waitExit(child, timeout = 10000) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => resolve(child.exitCode !== null), timeout);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

/**
 * Electron 是 GUI 子系统程序，stdout 可能拿不到日志，因此主进程把
 * { port, url, token?… } 写到数据目录的 runtime.json，这里轮询读取。
 */
async function waitForRuntime(dataDir, timeout = 120000) {
  const file = path.join(dataDir, 'runtime.json');
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) {
      try {
        const info = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Number(info.port) > 0) return info;
      } catch {
        /* 文件正在写入，下一轮再读 */
      }
    }
    await sleep(200);
  }
  const logFile = path.join(dataDir, 'wordmemory.log');
  const tail = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').slice(-2000) : '';
  throw new Error(`服务未在 ${timeout}ms 内写出 runtime.json\n${tail}`);
}

async function main() {
  if (!fs.existsSync(EXE)) throw new Error(`缺少 ${EXE}，请先运行 npm run build:exe`);

  // 避免读到上一次运行残留的 runtime.json
  fs.rmSync(path.join(DATA, 'runtime.json'), { force: true });

  let output = '';
  let logTail = '';
  const childEnv = { ...process.env, WM_HEADLESS: '1', WM_DATA_DIR: DATA };
  // 从 Electron 宿主派生的终端可能带此变量，会让 EXE 退化成纯 Node
  delete childEnv.ELECTRON_RUN_AS_NODE;
  delete childEnv.ELECTRON_NO_ATTACH_CONSOLE;
  const child = spawn(EXE, [], {
    cwd: path.dirname(EXE),
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (b) => { output += b.toString('utf8'); });
  child.stderr.on('data', (b) => { output += b.toString('utf8'); });

  let port;
  try {
    const runtime = await waitForRuntime(DATA);
    port = runtime.port;
    check('EXE 可启动并监听本机端口', port > 0, `端口 ${port} · engine=${runtime.engine || 'unknown'}`);
    check('Electron 引擎与版本正确', runtime.engine === 'electron' && runtime.version === JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, `v${runtime.version || '—'}`);
    const base = `http://127.0.0.1:${port}`;

    const indexRes = await fetch(`${base}/`);
    const html = await indexRes.text();
    check('首页可访问且注入便携版标记', indexRes.ok && html.includes('__WM_PORTABLE__') && html.includes('WordMemory'));

    const tokenMatch = html.match(/__WM_PORTABLE__=(\{.*?\});<\/script>/s);
    let token = '';
    if (tokenMatch) {
      try {
        token = JSON.parse(tokenMatch[1]).token;
      } catch {
        token = '';
      }
    }
    check('注入了会话令牌', !!token);

    const dataRes = await fetch(`${base}/data/words.json`);
    const payload = await dataRes.json();
    check('内置 8000 词库可通过服务读取', dataRes.ok && payload.words.length === 8000, `${payload.words.length} 词`);

    const jsRes = await fetch(`${base}/assets/app.js`);
    check('应用脚本可访问', jsRes.ok && (await jsRes.text()).length > 50000);

    const noToken = await fetch(`${base}/api/snapshot`);
    check('无令牌的 API 请求被拒绝', noToken.status === 401, `HTTP ${noToken.status}`);

    const headers = { 'x-wm-token': token };
    const snap0 = await fetch(`${base}/api/snapshot`, { headers });
    const snapJson = await snap0.json();
    check('快照接口可用', snap0.ok && snapJson.ok && typeof snapJson.kv === 'object');

    const write = await fetch(`${base}/api/kv`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'wm/v2/meta', value: '{"hello":"portable"}' }),
    });
    check('数据写入接口可用', (await write.json()).ok === true);

    const files = fs.readdirSync(path.join(DATA, 'kv'));
    check('数据已落盘到便携目录', files.some((f) => f.endsWith('.json')), files.join(', '));

    const snap1 = await (await fetch(`${base}/api/snapshot`, { headers })).json();
    check('写入后可重新读回', snap1.kv['wm/v2/meta'] === '{"hello":"portable"}');

    const badHost = await rawStatus(port, { ...headers, host: 'evil.example.com' });
    check('非法 Host 被拒绝', badHost === 403, `HTTP ${badHost}`);

    await fetch(`${base}/api/shutdown`, { method: 'POST', headers }).catch(() => null);
    const exited = await waitExit(child);
    check('可正常退出', exited, `exitCode=${child.exitCode}`);
  } catch (err) {
    check('冒烟流程无异常', false, err.message);
  } finally {
    const logFile = path.join(DATA, 'wordmemory.log');
    if (fs.existsSync(logFile)) {
      try {
        logTail = fs.readFileSync(logFile, 'utf8').slice(-3000);
      } catch {
        /* 忽略 */
      }
    }
    if (child.exitCode === null) child.kill();
    try {
      fs.rmSync(DATA, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  }

  process.stdout.write('\nEXE 便携版冒烟测试\n');
  for (const c of checks) {
    process.stdout.write(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? `  —— ${c.detail}` : ''}\n`);
  }
  process.stdout.write('\n');
  if (failures.length) {
    process.stderr.write(`失败 ${failures.length} 项：\n${failures.map((f) => `  - ${f}`).join('\n')}\n`);
    if (output) process.stderr.write(`\n--- EXE 输出 ---\n${output.slice(-3000)}\n`);
    if (logTail) process.stderr.write(`\n--- 应用日志 ---\n${logTail}\n`);
    process.exit(1);
  }
  process.stdout.write(`全部 ${checks.length} 项通过\n`);
}

main().catch((err) => {
  process.stderr.write(`冒烟测试异常：${err.stack || err.message}\n`);
  process.exit(1);
});
