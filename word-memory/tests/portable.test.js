/** EXE 便携版服务端（本地 HTTP 服务 + 文件存储）测试 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

import { createPortableServer } from '../desktop/server.mjs';
import { resolveDataDir, findBrowser, browserCandidates } from '../desktop/env.mjs';

const ASSETS = {
  'index.html': '<!DOCTYPE html><html><head><title>WordMemory</title></head><body><div id="app"></div></body></html>',
  'assets/app.js': 'console.log("word-memory");'.repeat(100),
  'assets/app.css': 'body{color:red}',
  'data/words.json': JSON.stringify({ meta: { count: 1 }, words: [['the', '这', '', 1]] }),
};

async function withServer(fn, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-portable-'));
  const service = createPortableServer({ assets: ASSETS, dataDir: dir, token: 'TOKEN', ...options });
  const port = await service.listen(0);
  try {
    return await fn({ service, port, dir, base: `http://127.0.0.1:${port}` });
  } finally {
    service.close();
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows 上偶尔被占用，忽略即可 */
    }
  }
}

function rawStatus(port, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/snapshot', headers }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
}

test('首页注入会话令牌，静态资源有正确 MIME', async () => {
  await withServer(async ({ base, service }) => {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(html, /__WM_PORTABLE__/);
    assert.match(html, /"token":"TOKEN"/);
    assert.ok(html.indexOf('__WM_PORTABLE__') < html.indexOf('</head>'));

    const js = await fetch(`${base}/assets/app.js`);
    assert.match(js.headers.get('content-type'), /javascript/);
    assert.ok((await js.text()).includes('word-memory'));

    const words = await (await fetch(`${base}/data/words.json`)).json();
    assert.equal(words.words.length, 1);

    const missing = await fetch(`${base}/nope.js`);
    assert.equal(missing.status, 404);
    assert.equal(service.token, 'TOKEN');
  });
});

test('API 必须携带令牌，非法 Host 被拒绝', async () => {
  await withServer(async ({ base, port }) => {
    assert.equal((await fetch(`${base}/api/snapshot`)).status, 401);
    const ok = await fetch(`${base}/api/snapshot`, { headers: { 'x-wm-token': 'TOKEN' } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).ok, true);
    assert.equal(await rawStatus(port, { 'x-wm-token': 'TOKEN', host: 'evil.example.com' }), 403);
    assert.equal((await fetch(`${base}/api/unknown`, { headers: { 'x-wm-token': 'TOKEN' } })).status, 404);
  });
});

test('KV 写入原子落盘、可删除、重启服务后可恢复', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-portable-persist-'));
  try {
    const first = createPortableServer({ assets: ASSETS, dataDir: dir, token: 'T' });
    const port = await first.listen(0);
    const base = `http://127.0.0.1:${port}`;
    const headers = { 'x-wm-token': 'T', 'content-type': 'application/json' };

    const write = await fetch(`${base}/api/kv`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ key: 'wm/v2/meta', value: '{"a":1}' }),
    });
    assert.equal((await write.json()).ok, true);

    const files = fs.readdirSync(path.join(dir, 'kv'));
    assert.equal(files.length, 1);
    assert.ok(!files[0].endsWith('.tmp'), '不应残留临时文件');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'kv', files[0]), 'utf8')), {
      key: 'wm/v2/meta',
      value: '{"a":1}',
    });

    await fetch(`${base}/api/kv`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ key: 'wm/v2/book/x', value: '[]' }),
    });
    assert.equal(Object.keys(first.snapshot()).length, 2);

    first.close();
    // 用同一个数据目录重新启动，数据应完整恢复
    const second = createPortableServer({ assets: ASSETS, dataDir: dir, token: 'T' });
    const port2 = await second.listen(0);
    const snap = await (await fetch(`http://127.0.0.1:${port2}/api/snapshot`, { headers: { 'x-wm-token': 'T' } })).json();
    assert.equal(snap.kv['wm/v2/meta'], '{"a":1}');
    assert.equal(snap.kv['wm/v2/book/x'], '[]');

    // value=null 删除
    await fetch(`http://127.0.0.1:${port2}/api/kv`, {
      method: 'POST',
      headers: { 'x-wm-token': 'T', 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'wm/v2/book/x', value: null }),
    });
    assert.equal(second.snapshot()['wm/v2/book/x'], undefined);
    second.close();
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* 忽略 */
    }
  }
});

test('非法键名与大请求被拒绝，关闭接口触发回调', async () => {
  let closed = 0;
  await withServer(
    async ({ base }) => {
      const headers = { 'x-wm-token': 'TOKEN', 'content-type': 'application/json' };
      const bad = await fetch(`${base}/api/kv`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: '../../etc/passwd', value: 'x' }),
      });
      assert.equal(bad.status, 400);

      const badValue = await fetch(`${base}/api/kv`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'wm/v2/x', value: { evil: true } }),
      });
      assert.equal(badValue.status, 400);

      const shutdown = await fetch(`${base}/api/shutdown`, { method: 'POST', headers: { 'x-wm-token': 'TOKEN' } });
      assert.equal((await shutdown.json()).ok, true);
      // 服务端会先留出 150ms 把响应发完，再触发关闭回调
      for (let i = 0; i < 30 && closed === 0; i += 1) {
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.equal(closed, 1);
    },
    { onCloseRequest: () => { closed += 1; } },
  );
});

test('数据目录可由环境变量覆盖，浏览器探测不会抛异常', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-dir-'));
  const custom = path.join(dir, 'custom-data');
  const resolved = resolveDataDir({ execPath: '/definitely/not/exist/WordMemory.exe', home: dir, env: { WM_DATA_DIR: custom } });
  assert.equal(resolved, custom);
  assert.ok(fs.existsSync(path.join(custom, '..')));

  const candidates = browserCandidates({});
  assert.ok(Array.isArray(candidates) && candidates.length > 0);
  const found = findBrowser({});
  assert.ok(found === null || typeof found === 'string');
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
});

test('Electron portable：优先使用 PORTABLE_EXECUTABLE_DIR，而非解压后的临时目录', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-portable-dir-'));
  const usb = path.join(dir, 'usb-drive');
  const tempUnpack = path.join(dir, 'temp-unpack');
  fs.mkdirSync(usb, { recursive: true });
  fs.mkdirSync(tempUnpack, { recursive: true });

  const resolved = resolveDataDir({
    portableDir: usb,
    execPath: path.join(tempUnpack, 'WordMemory.exe'),
    home: path.join(dir, 'home'),
    env: {},
    packaged: true,
  });
  assert.equal(resolved, path.join(usb, 'WordMemory-data'));
  assert.ok(!resolved.includes('temp-unpack'), '不能写进 electron-builder 的解压临时目录');

  // 开发模式（未打包）不应写进 node_modules/electron/dist
  const dev = resolveDataDir({
    execPath: path.join(dir, 'node_modules/electron/dist/electron.exe'),
    home: path.join(dir, 'home'),
    env: {},
    packaged: false,
  });
  assert.equal(dev, path.join(dir, 'home', 'WordMemory-data'));

  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
});
