/**
 * EXE 便携版内置 HTTP 服务（零第三方依赖）
 * ------------------------------------------------------------
 * 职责：
 *   1. 提供打包进 EXE 的静态资源（HTML / JS / CSS / 内置词库）
 *   2. 提供 /api/snapshot 与 /api/kv，把工作区数据写到 EXE 同目录
 *   3. 只监听 127.0.0.1，并用随机令牌校验所有 API 请求
 *
 * 安全考虑：本地服务若被其它网页随意调用会造成数据泄露，因此
 *   - 每次启动生成新 token，只注入到本程序打开的页面
 *   - 校验 Host，避免 DNS rebinding
 *   - 只接受本机回环地址
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const MAX_BODY = 25 * 1024 * 1024;

function extOf(name) {
  return path.extname(name).toLowerCase();
}

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  res.writeHead(status, {
    'content-type': contentType,
    'content-length': buf.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(buf);
}

function json(res, status, data) {
  send(res, status, JSON.stringify(data));
}

function requestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function hostAllowed(req, port) {
  const host = String(req.headers.host || '').toLowerCase();
  if (!host) return false;
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]' || name === '::1' || (port && host === `127.0.0.1:${port}`);
}

export function createPortableServer({
  assets = {},
  dataDir,
  token,
  version = 'dev',
  logger = () => {},
  onCloseRequest = () => {},
} = {}) {
  if (!dataDir) throw new TypeError('缺少 dataDir');
  const kvDir = path.join(dataDir, 'kv');
  fs.mkdirSync(kvDir, { recursive: true });
  const sessionToken = token || crypto.randomBytes(24).toString('hex');
  let lastPing = Date.now();
  let closing = false;

  const keyFile = (key) => path.join(kvDir, `${crypto.createHash('sha1').update(key).digest('hex')}.json`);

  /** 读取全部 KV（每个键一个 JSON 文件，附带键名便于人工排查） */
  function snapshot() {
    const out = {};
    let files = [];
    try {
      files = fs.readdirSync(kvDir);
    } catch {
      return out;
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const row = JSON.parse(fs.readFileSync(path.join(kvDir, file), 'utf8'));
        if (row && typeof row.key === 'string' && typeof row.value === 'string') out[row.key] = row.value;
      } catch (err) {
        logger(`跳过损坏的数据文件 ${file}：${err.message}`);
      }
    }
    return out;
  }

  /** 原子写入：先写 .tmp 再 rename，避免断电产生半截文件 */
  function writeKV(key, value) {
    if (typeof key !== 'string' || !key.startsWith('wm/') || key.includes('..')) {
      throw new Error('非法的数据键名');
    }
    const file = keyFile(key);
    if (value === null || value === undefined) {
      try {
        fs.rmSync(file, { force: true });
      } catch {
        /* 不存在即可 */
      }
      return;
    }
    if (typeof value !== 'string') throw new Error('数据值必须是字符串');
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ key, value }), 'utf8');
    fs.renameSync(tmp, file);
  }

  function injectFlag(html) {
    const script = `<script>window.__WM_PORTABLE__=${JSON.stringify({
      token: sessionToken,
      dataDir,
      version,
    })};</script>`;
    return html.includes('</head>') ? html.replace('</head>', `${script}\n</head>`) : `${script}\n${html}`;
  }

  const server = http.createServer((req, res) => {
    (async () => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);

      if (!hostAllowed(req, server.address()?.port)) {
        json(res, 403, { ok: false, error: '仅允许本机访问' });
        return;
      }

      /* ---------- API ---------- */
      if (pathname.startsWith('/api/')) {
        if (req.headers['x-wm-token'] !== sessionToken) {
          json(res, 401, { ok: false, error: '令牌无效' });
          return;
        }
        lastPing = Date.now();

        if (pathname === '/api/snapshot' && req.method === 'GET') {
          json(res, 200, { ok: true, kv: snapshot(), dataDir, version });
          return;
        }

        if (pathname === '/api/kv' && req.method === 'POST') {
          let payload;
          try {
            payload = JSON.parse(await requestBody(req));
          } catch (err) {
            json(res, 400, { ok: false, error: `请求无效：${err.message}` });
            return;
          }
          try {
            writeKV(payload.key, payload.value);
            json(res, 200, { ok: true });
          } catch (err) {
            json(res, 400, { ok: false, error: err.message });
          }
          return;
        }

        if (pathname === '/api/ping' && req.method === 'POST') {
          json(res, 200, { ok: true, idleMs: Date.now() - lastPing });
          return;
        }

        if (pathname === '/api/shutdown' && req.method === 'POST') {
          json(res, 200, { ok: true });
          // 留出时间把响应发完，避免 closeAllConnections 截断
          setTimeout(() => {
            close();
            try {
              onCloseRequest();
            } catch (err) {
              logger(`退出回调异常：${err.message}`);
            }
          }, 150).unref?.();
          return;
        }

        json(res, 404, { ok: false, error: '未知接口' });
        return;
      }

      /* ---------- 静态资源 ---------- */
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        json(res, 405, { ok: false, error: '不支持的方法' });
        return;
      }
      const rel = (pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')).replace(/\\/g, '/');
      if (rel.includes('..') || !Object.prototype.hasOwnProperty.call(assets, rel)) {
        send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
        return;
      }
      const content = rel === 'index.html' ? injectFlag(String(assets[rel])) : String(assets[rel]);
      send(res, 200, content, MIME[extOf(rel)] || 'application/octet-stream');
    })().catch((err) => {
      logger(`请求处理失败：${err.stack || err.message}`);
      if (!res.headersSent) json(res, 500, { ok: false, error: err.message });
    });
  });

  function listen(port = 0) {
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve(server.address().port);
      });
    });
  }

  function close() {
    if (closing) return;
    closing = true;
    try {
      // fetch 默认使用 keep-alive，不等它自然断开，否则退出会被挂住
      server.closeAllConnections?.();
    } catch {
      /* 忽略 */
    }
    try {
      server.close();
    } catch {
      /* 忽略 */
    }
  }

  return {
    server,
    listen,
    close,
    snapshot,
    writeKV,
    injectFlag,
    get token() {
      return sessionToken;
    },
    get dataDir() {
      return dataDir;
    },
    get idleMs() {
      return Date.now() - lastPing;
    },
    get isClosing() {
      return closing;
    },
    touch() {
      lastPing = Date.now();
    },
  };
}
