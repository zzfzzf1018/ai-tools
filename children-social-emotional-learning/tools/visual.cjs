/* 视觉回归：用 Electron 离屏打开固定页面，和基线 PNG 做像素对比。
   用法：
     npm run visual           # 对比，超出阈值则失败并输出 actual/ 截图
     npm run visual:update    # 重新生成基线（仅在你确认视觉变化是有意的时候）
   说明：为了保证日期相关的文案不每天漂移，测试窗口用 preload 把时间冻结在 2026-01-15 10:00。 */
'use strict';

/* 必须由 Electron 运行时执行。若宿主环境导出了 ELECTRON_RUN_AS_NODE=1，
   process.versions.electron 仍然存在，但 require('electron') 只返回二进制路径，
   会在文件末尾报一个莫名的 "Cannot read properties of undefined"。提前识别并给出可操作提示。 */
let electron = null;
try { electron = require('electron'); } catch (e) { /* 纯 Node 环境 */ }
if (!process.versions.electron || !electron || !electron.app ||
    typeof electron.app.disableHardwareAcceleration !== 'function') {
  console.error('请用 `npm run visual` 运行，并确认没有设置 ELECTRON_RUN_AS_NODE=1。');
  console.error('Git Bash / macOS / Linux: unset ELECTRON_RUN_AS_NODE && npm run visual');
  console.error('PowerShell:              Remove-Item Env:ELECTRON_RUN_AS_NODE; npm run visual');
  process.exit(2);
}

const { app, BrowserWindow } = electron;
const fs = require('fs');
const path = require('path');
const png = require('./lib/png.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'visual');
const BASE = path.join(OUT, 'baseline');
const ACT = path.join(OUT, 'actual');
const UPDATE = process.argv.includes('--update');

const { seed } = require('./lib/seed.cjs');

const PAGES = [
  { name: 'home', hash: '#/home' },
  { name: 'map', hash: '#/map' },
  { name: 'checkin', hash: '#/checkin' },
  { name: 'strategies', hash: '#/strategies' },
  { name: 'parent', hash: '#/parent' },
  { name: 'garden', hash: '#/garden' },
  { name: 'report', hash: '#/report' },
  { name: 'level-choice', hash: '#/level/aw-3' },
  /* 固定情境卡 id，保证每次截到同一张卡（随机抽卡会让像素基线永远抖动） */
  { name: 'express', hash: '#/express/ex-1' }
];
const MOBILE_PAGES = [
  { name: 'home', hash: '#/home' },
  { name: 'map', hash: '#/map' },
  { name: 'checkin', hash: '#/checkin' },
  { name: 'parent', hash: '#/parent' },
  { name: 'report', hash: '#/report' },
  { name: 'express', hash: '#/express/ex-1' }
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function makeWindow(width, height) {
  const win = new BrowserWindow({
    width, height, useContentSize: true, show: false,
    backgroundColor: '#FFF6E8',
    webPreferences: {
      preload: path.join(__dirname, 'lib/freeze-time.cjs'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      zoomFactor: 1
    }
  });
  await win.loadFile(path.join(ROOT, 'index.html'));
  await win.webContents.executeJavaScript(`
    try {
      localStorage.setItem('sunny-isles-welcomed-v1', '1');
      localStorage.setItem('sunny-isles-save-v1', ${JSON.stringify(JSON.stringify(seed(ROOT)))});
      /* 视觉基线必须可重复：关掉「自动读题」，否则播报条上「正在读：…」
         会随系统有没有中文语音、读到第几句而变化。voice 保持开启，
         顶栏图标仍与真实默认状态一致。 */
      var save = JSON.parse(localStorage.getItem('sunny-isles-save-v1'));
      (save.profiles || []).forEach(function (p) {
        p.settings = p.settings || {};
        p.settings.autoRead = false;
      });
      localStorage.setItem('sunny-isles-save-v1', JSON.stringify(save));
      sessionStorage.setItem('sunny-parent-ok', '1');
    } catch (e) {}
  `);
  await win.loadFile(path.join(ROOT, 'index.html'));
  await sleep(500);
  await win.webContents.insertCSS('*{animation:none !important;transition:none !important;caret-color:transparent !important}html{scroll-behavior:auto !important}');
  return win;
}

async function capture(win, page) {
  await win.webContents.executeJavaScript(`
    location.hash = ${JSON.stringify(page.hash)};
    if (window.SEL && window.SEL.render) window.SEL.render();
  `);
  await sleep(450);
  const img = await win.capturePage();
  return img.toPNG();
}

function compare(aBuf, bBuf) {
  const a = png.decode(aBuf), b = png.decode(bBuf);
  if (a.width !== b.width || a.height !== b.height) {
    return { same: false, ratio: 1, reason: `尺寸不同 ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  const total = a.width * a.height;
  let diff = 0;
  const out = Buffer.alloc(total * 4);
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const d = Math.max(
      Math.abs(a.pixels[o] - b.pixels[o]),
      Math.abs(a.pixels[o + 1] - b.pixels[o + 1]),
      Math.abs(a.pixels[o + 2] - b.pixels[o + 2])
    );
    if (d > 12) {
      diff++;
      out[o] = 255; out[o + 1] = 60; out[o + 2] = 90; out[o + 3] = 255;
    } else {
      out[o] = 245; out[o + 1] = 245; out[o + 2] = 245; out[o + 3] = 255;
    }
  }
  return { same: diff / total <= 0.002, ratio: diff / total, diffPixels: diff, width: a.width, height: a.height, out };
}

async function run() {
  fs.mkdirSync(BASE, { recursive: true });
  fs.mkdirSync(ACT, { recursive: true });
  const failures = [];
  const sets = [
    { tag: 'desktop', win: await makeWindow(1280, 900), pages: PAGES },
    { tag: 'mobile', win: await makeWindow(390, 844), pages: MOBILE_PAGES }
  ];
  for (const set of sets) {
    for (const page of set.pages) {
      const file = `${set.tag}-${page.name}.png`;
      const buf = await capture(set.win, page);
      fs.writeFileSync(path.join(ACT, file), buf);
      const basePath = path.join(BASE, file);
      if (UPDATE || !fs.existsSync(basePath)) {
        fs.writeFileSync(basePath, buf);
        console.log(`  + 基线 ${file}`);
        continue;
      }
      const r = compare(fs.readFileSync(basePath), buf);
      if (r.same) {
        console.log(`  ✓ ${file}（差异 ${(r.ratio * 100).toFixed(2)}%）`);
      } else {
        if (r.out) fs.writeFileSync(path.join(OUT, 'diff-' + file), png.encode(r.width, r.height, r.out));
        console.log(`  x ${file}（差异 ${(r.ratio * 100).toFixed(2)}%，阈值 0.20%）`);
        failures.push(file + ' ' + (r.reason || `${(r.ratio * 100).toFixed(2)}%`));
      }
    }
    set.win.destroy();
  }

  if (failures.length) {
    console.log('\n视觉回归失败，截图在 tools/visual/actual/，差异图在 tools/visual/diff-*.png');
    failures.forEach((f) => console.log('  - ' + f));
    if (!UPDATE) console.log('确认改动符合预期后运行：npm run visual:update');
    process.exitCode = 1;
  } else {
    console.log('\n✅ 视觉基线一致');
  }
  app.quit();
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.whenReady().then(run).catch((e) => {
  console.error('视觉回归运行失败：', e);
  process.exitCode = 1;
  app.quit();
});
