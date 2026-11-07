#!/usr/bin/env node
/**
 * 构建脚本
 * ------------------------------------------------------------
 * 产物：
 *   dist/web/                —— 静态站点（index.html + assets + data）
 *   dist/word-memory.html    —— 单文件版，双击即可离线使用
 *   dist/version.json        —— 版本与构建指纹
 *
 * 设计：只有一份 HTML 模板（src/index.html），通过三个占位符
 * 分别注入"外链资源"或"内联资源"，保证两个版本行为完全一致。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DIST_WEB = path.join(DIST, 'web');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const MINIFY = !process.argv.includes('--no-minify');

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function kb(buf) {
  return `${(Buffer.byteLength(buf) / 1024).toFixed(1)} KB`;
}

/** JS/CSS 内联时避免提前闭合标签 */
function safeInline(text) {
  return text.replace(/<\/script/gi, '<\\/script').replace(/<\/style/gi, '<\\/style');
}

async function buildBundle() {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/main.js')],
    bundle: true,
    format: 'iife',
    target: ['es2019'],
    platform: 'browser',
    minify: MINIFY,
    sourcemap: false,
    legalComments: 'none',
    write: false,
    define: {
      __APP_VERSION__: JSON.stringify(VERSION),
    },
  });
  const js = result.outputFiles[0].text;
  return js;
}

async function buildStyles() {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/styles/main.css')],
    bundle: true,
    minify: MINIFY,
    write: false,
    target: ['chrome90', 'safari14', 'firefox90'],
  });
  return result.outputFiles[0].text;
}

function readTemplate() {
  return fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
}

function readData() {
  const file = path.join(ROOT, 'data/words.json');
  if (!fs.existsSync(file)) {
    throw new Error('缺少 data/words.json，请先运行：npm run data');
  }
  const text = fs.readFileSync(file, 'utf8');
  return { text, json: JSON.parse(text) };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  const t0 = Date.now();
  const [js, css] = await Promise.all([buildBundle(), buildStyles()]);
  const template = readTemplate();
  const { text: dataText, json: data } = readData();

  // 清理旧产物，避免残留文件造成困惑
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(path.join(DIST_WEB, 'assets'));
  ensureDir(path.join(DIST_WEB, 'data'));

  /* ---- Web 版 ---- */
  // 注意：必须用函数式替换，否则脚本里的 `$&`、`$'` 等会被当作替换模式
  const webHtml = template
    .replace('<!--APP_CSS-->', () => '<link rel="stylesheet" href="assets/app.css" />')
    .replace('<!--APP_DATA-->', () => '')
    .replace('<!--APP_JS-->', () => '<script src="assets/app.js"></script>');

  fs.writeFileSync(path.join(DIST_WEB, 'index.html'), webHtml, 'utf8');
  fs.writeFileSync(path.join(DIST_WEB, 'assets/app.js'), js, 'utf8');
  fs.writeFileSync(path.join(DIST_WEB, 'assets/app.css'), css, 'utf8');
  fs.writeFileSync(path.join(DIST_WEB, 'data/words.json'), dataText, 'utf8');

  /* ---- 单文件版 ---- */
  const inlineData = `<script>window.__WORD_DATA__=${safeInline(dataText)};</script>`;
  const singleHtml = template
    .replace('<!--APP_CSS-->', () => `<style>${safeInline(css)}</style>`)
    .replace('<!--APP_DATA-->', () => inlineData)
    .replace('<!--APP_JS-->', () => `<script>${safeInline(js)}</script>`);

  const singleFile = path.join(DIST, 'word-memory.html');
  fs.writeFileSync(singleFile, singleHtml, 'utf8');

  /* ---- 版本信息 ---- */
  const hash = crypto.createHash('sha256').update(singleHtml).digest('hex').slice(0, 16);
  const versionInfo = {
    name: pkg.name,
    version: VERSION,
    builtAt: new Date().toISOString(),
    wordCount: data.meta?.count || data.words.length,
    dataVersion: data.meta?.version || '',
    singleFileHash: hash,
    files: {
      'dist/word-memory.html': Buffer.byteLength(singleHtml),
      'dist/web/index.html': Buffer.byteLength(webHtml),
      'dist/web/assets/app.js': Buffer.byteLength(js),
      'dist/web/assets/app.css': Buffer.byteLength(css),
      'dist/web/data/words.json': Buffer.byteLength(dataText),
    },
  };
  fs.writeFileSync(path.join(DIST, 'version.json'), `${JSON.stringify(versionInfo, null, 2)}\n`, 'utf8');

  log('');
  log(`构建完成 v${VERSION}（${MINIFY ? '压缩' : '未压缩'}）`);
  log(`  dist/word-memory.html   ${kb(singleHtml)}  ← 单文件版，可直接双击打开`);
  log(`  dist/web/index.html     ${kb(webHtml)}`);
  log(`  dist/web/assets/app.js  ${kb(js)}`);
  log(`  dist/web/assets/app.css ${kb(css)}`);
  log(`  dist/web/data/words.json ${kb(dataText)}（${versionInfo.wordCount} 词）`);
  log(`  产物指纹 ${hash}`);
  log(`  耗时 ${Date.now() - t0} ms`);
}

main().catch((err) => {
  process.stderr.write(`构建失败：${err.stack || err.message}\n`);
  process.exit(1);
});
