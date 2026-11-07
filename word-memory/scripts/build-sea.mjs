#!/usr/bin/env node
/**
 * 打包 Windows EXE 便携版（Node SEA 旧方案，备用）
 * ------------------------------------------------------------
 * v2.1 起主方案改为 Electron（scripts/build-exe.mjs）。
 * 本脚本保留作为无 Electron 依赖时的轻量备选，命令：npm run build:sea
 *
 * 产物：dist/sea/WordMemory.exe —— 单文件、免安装、免装 Node，双击即用。
 *
 * 原理（Node 22 Single Executable Application）：
 *   1. 把 dist/web 的全部静态资源生成成 JS 常量（虚拟模块）
 *   2. esbuild 把 desktop/main.mjs + 服务 + 资源打包为单个 CJS
 *   3. node --experimental-sea-config 生成 SEA blob
 *   4. 复制当前 node.exe，用 postject 把 blob 注入 PE 资源节
 *
 * 运行时数据写入 EXE 同目录的 WordMemory-data/，因此整个目录
 * 可以放在 U 盘里随身带走（真正的便携）。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as esbuild from 'esbuild';
import postject from 'postject';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const WEB = path.join(DIST, 'web');
const EXE_BUILD = path.join(DIST, 'sea');
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 递归收集静态资源，键为相对 dist/web 的 POSIX 路径 */
function collectAssets(dir, base = '', out = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectAssets(full, rel, out);
    else out[rel] = fs.readFileSync(full, 'utf8');
  }
  return out;
}

async function bundleServer(assets) {
  const outfile = path.join(EXE_BUILD, 'app.cjs');
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'desktop/main.mjs')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: ['node18'],
    minify: true,
    legalComments: 'none',
    define: { __WM_VERSION__: JSON.stringify(VERSION) },
    plugins: [
      {
        name: 'virtual-assets',
        setup(build) {
          build.onResolve({ filter: /^virtual:assets$/ }, () => ({ path: 'virtual:assets', namespace: 'wm-assets' }));
          build.onLoad({ filter: /.*/, namespace: 'wm-assets' }, () => ({
            contents: `export const ASSETS = ${JSON.stringify(assets)};`,
            loader: 'js',
          }));
        },
      },
    ],
  });
  return outfile;
}

async function main() {
  if (!fs.existsSync(path.join(WEB, 'index.html'))) {
    throw new Error('缺少 dist/web，请先运行 npm run build');
  }
  if (process.platform !== 'win32') {
    throw new Error('EXE 便携版目前只支持在 Windows 上构建');
  }

  const t0 = Date.now();
  fs.rmSync(EXE_BUILD, { recursive: true, force: true });
  fs.mkdirSync(EXE_BUILD, { recursive: true });

  const assets = collectAssets(WEB);
  const required = ['index.html', 'assets/app.js', 'assets/app.css', 'data/words.json'];
  for (const name of required) {
    if (!assets[name]) throw new Error(`Web 产物缺少 ${name}`);
  }
  log(`  静态资源 ${Object.keys(assets).length} 个（含 8000 词库）`);

  const mainFile = await bundleServer(assets);
  log(`  服务端 bundle ${mb(fs.statSync(mainFile).size)}`);

  const blobFile = path.join(EXE_BUILD, 'sea.blob');
  const configFile = path.join(EXE_BUILD, 'sea-config.json');
  fs.writeFileSync(
    configFile,
    JSON.stringify(
      {
        main: mainFile,
        output: blobFile,
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: false,
      },
      null,
      2,
    ),
    'utf8',
  );

  log('  生成 SEA blob…');
  execFileSync(process.execPath, ['--experimental-sea-config', configFile], { stdio: 'pipe' });
  const blob = fs.readFileSync(blobFile);

  const exeFile = path.join(EXE_BUILD, 'WordMemory.exe');
  fs.copyFileSync(process.execPath, exeFile);
  log(`  注入 blob 到 ${path.basename(exeFile)}…`);
  await postject.inject(exeFile, 'NODE_SEA_BLOB', blob, {
    sentinelFuse: SEA_FUSE,
    overwrite: true,
  });

  const stat = fs.statSync(exeFile);
  if (stat.size < 40 * 1024 * 1024) throw new Error('生成的 EXE 体积异常，可能注入失败');

  const info = {
    name: 'WordMemory Portable',
    version: VERSION,
    builtAt: new Date().toISOString(),
    node: process.version,
    exe: 'dist/sea/WordMemory.exe',
    exeSize: stat.size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(exeFile)).digest('hex'),
    dataDir: 'WordMemory-data/（与 EXE 同目录，自动生成）',
    assets: Object.keys(assets),
  };
  fs.writeFileSync(path.join(EXE_BUILD, 'sea-info.json'), `${JSON.stringify(info, null, 2)}\n`, 'utf8');

  log('');
  log(`  SEA 便携版（备用）构建完成 v${VERSION}`);
  log(`  dist/sea/WordMemory.exe  ${mb(stat.size)}  ← 双击即可运行，无需安装 Node`);
  log(`  SHA-256 ${info.sha256.slice(0, 24)}…`);
  log(`  数据目录：EXE 同目录的 WordMemory-data/`);
  log(`  耗时 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

main().catch((err) => {
  process.stderr.write(`EXE 构建失败：${err.stack || err.message}\n`);
  process.exit(1);
});
