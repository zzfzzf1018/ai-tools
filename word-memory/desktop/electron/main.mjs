/**
 * Electron 主进程
 * ------------------------------------------------------------
 * 与 SEA 版（desktop/main.mjs）的区别：
 *   - 用 BrowserWindow 提供真正的桌面窗口，没有控制台、没有地址栏
 *   - 数据目录优先取 electron-builder portable 的 PORTABLE_EXECUTABLE_DIR
 *   - 窗口关闭即退出，由 app 生命周期管理，不再需要心跳计时器
 *
 * 复用的部分：desktop/server.mjs 的零依赖 HTTP 服务与文件 KV 完全不变，
 * 因此前端仍是同一份 dist/web，令牌、Host 校验、原子写、全量备份等
 * 已验证的能力原样保留。
 *
 * 由 scripts/build-exe.mjs 用 esbuild 打包为 CJS（electron 保持 external）。
 */

import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { ASSETS } from 'virtual:assets';
import { createPortableServer } from '../server.mjs';
import { resolveDataDir } from '../env.mjs';

const VERSION = typeof __WM_VERSION__ !== 'undefined' ? __WM_VERSION__ : 'dev';
/** 自动化测试：只起服务不建窗口，把端口写入 runtime.json */
const HEADLESS = process.env.WM_HEADLESS === '1';
/** 开发/测试时允许并行实例 */
const NO_SINGLETON = HEADLESS || process.env.WM_NO_SINGLETON === '1';

// 若继承了 ELECTRON_RUN_AS_NODE=1（常见于从 Electron 应用派生的终端），
// electron.exe 会退化成纯 Node，require('electron') 只返回可执行文件路径。
if (!app || typeof app.whenReady !== 'function') {
  process.stderr.write('[WordMemory] 需要以 Electron 主进程启动；请清除 ELECTRON_RUN_AS_NODE 环境变量。\n');
  process.exit(1);
}

// CI / 无桌面环境的 headless 模式不需要 GPU 与沙箱
if (HEADLESS) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('no-sandbox');
}

let service = null;
let mainWindow = null;
let runtimeFile = '';
let currentUrl = '';
let currentDataDir = '';
let logFn = () => {};

function makeLogger(dataDir) {
  const file = path.join(dataDir, 'wordmemory.log');
  return (message) => {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    try {
      if (fs.existsSync(file) && fs.statSync(file).size > 1024 * 1024) fs.writeFileSync(file, '');
      fs.appendFileSync(file, line);
    } catch {
      /* 日志失败不影响运行 */
    }
    try {
      process.stdout.write(`[WordMemory] ${line}`);
    } catch {
      /* GUI 子系统可能没有 stdout */
    }
  };
}

function windowStateFile(dataDir) {
  return path.join(dataDir, 'window-state.json');
}

function readWindowState(dataDir) {
  try {
    const state = JSON.parse(fs.readFileSync(windowStateFile(dataDir), 'utf8'));
    if (Number.isFinite(state.width) && Number.isFinite(state.height)) return state;
  } catch {
    /* 首次运行或文件损坏 */
  }
  return null;
}

function saveWindowState(dataDir, win) {
  try {
    fs.writeFileSync(windowStateFile(dataDir), JSON.stringify(win.getBounds()), 'utf8');
  } catch {
    /* 忽略 */
  }
}

function createWindow(url, dataDir) {
  const saved = readWindowState(dataDir);
  mainWindow = new BrowserWindow({
    width: Math.max(900, saved?.width || 1180),
    height: Math.max(600, saved?.height || 820),
    x: saved?.x,
    y: saved?.y,
    minWidth: 900,
    minHeight: 600,
    title: `WordMemory v${VERSION}`,
    backgroundColor: '#0d0f13',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('close', () => {
    if (mainWindow) saveWindowState(dataDir, mainWindow);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 应用内只允许访问本机服务；外链交给系统浏览器
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(url)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });

  mainWindow.loadURL(url);
  return mainWindow;
}

function buildMenu(dataDir) {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开数据目录',
          click: () => shell.openPath(dataDir),
        },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '实际大小', role: 'resetZoom' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 WordMemory',
          click: () =>
            dialog.showMessageBox({
              type: 'info',
              title: '关于 WordMemory',
              message: `WordMemory v${VERSION}`,
              detail: `多账户 / 多词库间隔重复记忆工具\n\n数据目录：${dataDir}\n所有学习记录都保存在本机，不上传任何服务器。`,
              buttons: ['确定'],
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function start() {
  await app.whenReady();

  const dataDir = resolveDataDir({
    portableDir: process.env.PORTABLE_EXECUTABLE_DIR || '',
    execPath: app.isPackaged ? app.getPath('exe') : process.execPath,
    home: app.getPath('home'),
    env: process.env,
    packaged: app.isPackaged,
  });
  currentDataDir = dataDir;
  logFn = makeLogger(dataDir);

  service = createPortableServer({
    assets: ASSETS,
    dataDir,
    version: VERSION,
    logger: (message) => logFn(`[服务] ${message}`),
    onCloseRequest: () => {
      app.quit();
      // headless 无窗口时 app.quit() 偶尔不会立即结束，兜底强退
      const timer = setTimeout(() => {
        cleanup();
        app.exit(0);
      }, 2500);
      if (typeof timer === 'object' && 'unref' in timer) timer.unref();
    },
  });

  const port = await service.listen(0);
  currentUrl = `http://127.0.0.1:${port}/`;

  runtimeFile = path.join(dataDir, 'runtime.json');
  fs.writeFileSync(
    runtimeFile,
    JSON.stringify(
      {
        pid: process.pid,
        port,
        url: currentUrl,
        version: VERSION,
        dataDir,
        startedAt: Date.now(),
        headless: HEADLESS,
        engine: 'electron',
      },
      null,
      2,
    ),
    'utf8',
  );

  logFn(`启动 v${VERSION} · ${currentUrl} · 数据目录 ${dataDir}${HEADLESS ? ' · headless' : ''}`);

  if (HEADLESS) {
    // 不创建窗口：进程由 HTTP 服务保持存活，测试通过 /api/shutdown 结束
    return;
  }

  buildMenu(dataDir);
  createWindow(currentUrl, dataDir);
}

function cleanup() {
  try {
    service?.close();
  } catch {
    /* 忽略 */
  }
  if (runtimeFile) {
    try {
      fs.rmSync(runtimeFile, { force: true });
    } catch {
      /* 忽略 */
    }
  }
}

app.on('before-quit', cleanup);
app.on('window-all-closed', () => {
  if (!HEADLESS) app.quit();
});
app.on('activate', () => {
  if (!HEADLESS && BrowserWindow.getAllWindows().length === 0 && currentUrl) {
    createWindow(currentUrl, currentDataDir);
  }
});

function fatal(err) {
  const message = err?.stack || String(err);
  logFn(`启动失败：${message}`);
  try {
    process.stderr.write(`${message}\n`);
  } catch {
    /* 忽略 */
  }
  if (!HEADLESS) dialog.showErrorBox('WordMemory 启动失败', message);
  app.exit(1);
}

if (NO_SINGLETON) {
  start().catch(fatal);
} else {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } else if (currentUrl && !HEADLESS) {
        createWindow(currentUrl, currentDataDir);
      }
    });
    start().catch(fatal);
  }
}
