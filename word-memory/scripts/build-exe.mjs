#!/usr/bin/env node
/**
 * 打包 Windows EXE 便携版（Electron 方案）
 * ------------------------------------------------------------
 * 产物：dist/WordMemory.exe —— 单文件、免安装，双击后打开真正的桌面窗口。
 *
 * 流程：
 *   1. 收集 dist/web 的全部静态资源，生成虚拟模块 virtual:assets
 *   2. esbuild 把 desktop/electron/main.mjs + HTTP 服务 + 资源打成自包含 CJS
 *      （electron 保持 external，由 Electron 运行时提供）
 *   3. 生成 dist/electron-app/{main.cjs,package.json,icon.ico}
 *   4. electron-builder --win portable 产出单文件 EXE
 *   5. 复制到 dist/WordMemory.exe 并写 dist/exe-info.json
 *
 * 数据目录由主进程决定：优先 electron-builder portable 的
 * PORTABLE_EXECUTABLE_DIR（用户放置 EXE 的目录），因此 U 盘携带有效。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const WEB = path.join(DIST, 'web');
const APP_DIR = path.join(DIST, 'electron-app');
const OUT_DIR = path.join(DIST, 'electron-out');
const BUILDER_CLI = path.join(ROOT, 'node_modules/electron-builder/out/cli/cli.js');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
/** CI 快速校验：只验证主进程可被 esbuild 打包，不产出 EXE、不要求 Windows */
const BUNDLE_ONLY = process.argv.includes('--bundle-only');

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

/**
 * 生成 256×256 32bpp ICO（蓝紫渐变圆角方块 + 白色 W）。
 * 不依赖图像处理库：直接拼 BMP-in-ICO 字节，保证构建可复现。
 */
function makeIcon(size = 256) {
  const pixels = Buffer.alloc(size * size * 4); // BGRA
  const put = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = b;
    pixels[i + 1] = g;
    pixels[i + 2] = r;
    pixels[i + 3] = a;
  };

  const radius = size * 0.22;
  const inRound = (x, y) => {
    const cx = Math.min(Math.max(x, radius), size - 1 - radius);
    const cy = Math.min(Math.max(y, radius), size - 1 - radius);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!inRound(x, y)) {
        put(x, y, 0, 0, 0, 0);
        continue;
      }
      const t = (x + y) / (2 * size);
      put(x, y, Math.round(96 + 70 * t), Math.round(126 - 16 * t), Math.round(255 - 46 * t));
    }
  }

  const width = Math.max(3, Math.round(size * 0.055));
  const line = (x0, y0, x1, y1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    for (let s = 0; s <= steps; s += 1) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const y = y0 + ((y1 - y0) * s) / steps;
      for (let ox = -width / 2; ox <= width / 2; ox += 1) {
        for (let oy = -width / 2; oy <= width / 2; oy += 1) {
          put(Math.round(x + ox), Math.round(y + oy), 255, 255, 255);
        }
      }
    }
  };
  const l = size * 0.25;
  const r = size * 0.75;
  const top = size * 0.29;
  const bottom = size * 0.71;
  const mid = size * 0.5;
  const center = size * 0.46;
  line(l, top, l + size * 0.1, bottom);
  line(l + size * 0.1, bottom, mid, center);
  line(mid, center, r - size * 0.1, bottom);
  line(r - size * 0.1, bottom, r, top);

  // ICO 里的 BMP 是自下而上的
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const src = (size - 1 - y) * size * 4;
    pixels.copy(xor, y * size * 4, src, src + size * 4);
  }
  const andMask = Buffer.alloc((size / 8) * size); // 全 0 = 不透明

  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // XOR + AND
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(xor.length + andMask.length, 20);
  const image = Buffer.concat([header, xor, andMask]);

  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2); // ico
  dir.writeUInt16LE(1, 4); // 1 张图
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([dir, entry, image]);
}

async function bundleMain(assets) {
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'desktop/electron/main.mjs')],
    outfile: path.join(APP_DIR, 'main.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: ['node20'],
    external: ['electron'],
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
}

function writeAppPackage() {
  const electronPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/electron/package.json'), 'utf8'));
  fs.writeFileSync(
    path.join(APP_DIR, 'package.json'),
    `${JSON.stringify(
      {
        name: 'word-memory',
        productName: 'WordMemory',
        version: VERSION,
        description: '多账户 / 多词库间隔重复记忆工具',
        main: 'main.cjs',
        private: true,
        devDependencies: { electron: electronPkg.version },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return electronPkg.version;
}

function runBuilder() {
  if (!fs.existsSync(BUILDER_CLI)) throw new Error('缺少 electron-builder，请先 npm install');
  execFileSync(process.execPath, [BUILDER_CLI, '--win', '--config', 'electron-builder.yml'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      // 使用本地已安装的 Electron，禁止重复联网下载
      ELECTRON_OVERRIDE_DIST_PATH: path.join(ROOT, 'node_modules/electron/dist'),
    },
  });
}

async function main() {
  if (!fs.existsSync(path.join(WEB, 'index.html'))) {
    throw new Error('缺少 dist/web，请先运行 npm run build');
  }
  if (process.platform !== 'win32' && !BUNDLE_ONLY) {
    throw new Error('EXE 便携版只支持在 Windows 上构建');
  }

  const t0 = Date.now();
  fs.rmSync(APP_DIR, { recursive: true, force: true });
  if (!BUNDLE_ONLY) {
    // 只删最终产物；win-unpacked 等中间目录交给 electron-builder 自己重建
    fs.rmSync(path.join(OUT_DIR, 'WordMemory.exe'), { force: true });
    fs.rmSync(path.join(DIST, 'WordMemory.exe'), { force: true });
  }
  fs.mkdirSync(APP_DIR, { recursive: true });

  const assets = collectAssets(WEB);
  for (const name of ['index.html', 'assets/app.js', 'assets/app.css', 'data/words.json']) {
    if (!assets[name]) throw new Error(`Web 产物缺少 ${name}`);
  }
  log(`  静态资源 ${Object.keys(assets).length} 个（含 8000 词库）`);

  fs.writeFileSync(path.join(APP_DIR, 'icon.ico'), makeIcon(256));
  await bundleMain(assets);
  const electronVersion = writeAppPackage();
  log(`  Electron 主进程打包完成（Electron ${electronVersion}）`);

  if (BUNDLE_ONLY) {
    log(`  --bundle-only：跳过 electron-builder（${mb(fs.statSync(path.join(APP_DIR, 'main.cjs')).size)}）`);
    return;
  }

  log('  electron-builder 正在生成 portable EXE…');
  runBuilder();

  const built = path.join(OUT_DIR, 'WordMemory.exe');
  if (!fs.existsSync(built)) {
    const found = fs.existsSync(OUT_DIR)
      ? fs.readdirSync(OUT_DIR).filter((f) => f.toLowerCase().endsWith('.exe'))
      : [];
    if (found.length === 1) fs.copyFileSync(path.join(OUT_DIR, found[0]), built);
    else throw new Error(`未找到 portable EXE，dist/electron-out 内容：${found.join(', ') || '空'}`);
  }

  const exeFile = path.join(DIST, 'WordMemory.exe');
  fs.copyFileSync(built, exeFile);
  const stat = fs.statSync(exeFile);
  if (stat.size < 40 * 1024 * 1024) throw new Error('生成的 EXE 体积异常，可能打包失败');

  const info = {
    name: 'WordMemory Portable',
    engine: 'electron',
    version: VERSION,
    electronVersion,
    builtAt: new Date().toISOString(),
    node: process.version,
    exe: 'dist/WordMemory.exe',
    exeSize: stat.size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(exeFile)).digest('hex'),
    dataDir: 'WordMemory-data/（与 EXE 同目录，由 PORTABLE_EXECUTABLE_DIR 定位）',
    headlessEnv: 'WM_HEADLESS=1（只起服务不建窗口，供自动化测试）',
    assets: Object.keys(assets),
  };
  fs.writeFileSync(path.join(DIST, 'exe-info.json'), `${JSON.stringify(info, null, 2)}\n`, 'utf8');

  log('');
  log(`  Electron 便携版构建完成 v${VERSION}`);
  log(`  dist/WordMemory.exe  ${mb(stat.size)}  ← 双击即可运行`);
  log(`  SHA-256 ${info.sha256.slice(0, 24)}…`);
  log(`  数据目录：EXE 同目录的 WordMemory-data/`);
  log(`  耗时 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

main().catch((err) => {
  process.stderr.write(`EXE 构建失败：${err.stack || err.message}\n`);
  process.exit(1);
});
