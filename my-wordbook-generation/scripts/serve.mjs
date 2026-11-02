/* 单词书 · 本地静态服务（仅监听 127.0.0.1） */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }

  let relative = pathname.replace(/^\/+/, '');
  if (!relative || relative === '/') relative = 'index.html';
  if (relative.endsWith('/')) relative += 'index.html';

  const target = path.resolve(ROOT, relative);
  const inside = target === ROOT || target.startsWith(ROOT + path.sep);
  if (!inside) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  if (!existsSync(target) || statSync(target).isDirectory()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
  response.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-cache'
  });
  createReadStream(target).pipe(response);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    process.exit(0);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`单词书服务已启动：http://127.0.0.1:${PORT}`);
});
