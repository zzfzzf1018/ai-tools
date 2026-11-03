/* 趣味英语乐园 · Electron 桌面版主进程 */
'use strict';

const { app, BrowserWindow, Menu, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const APP_ID = 'com.zzf.kidsenglish';
const ROOT = path.join(__dirname, '..');
const TITLE = '趣味英语乐园';

let mainWindow = null;
let isQuitting = false;

app.setName(TITLE);
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', function () {
    showWindow();
  });

  app.whenReady().then(function () {
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
    createWindow();

    app.on('activate', function () {
      showWindow();
    });
  });

  app.on('before-quit', function () {
    isQuitting = true;
    saveState();
  });

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });
}

function statePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function readState() {
  const fallback = { width: 1180, height: 820, maximized: false };
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch (e) {
    return fallback;
  }
  if (!raw || typeof raw !== 'object') return fallback;
  const state = Object.assign({}, fallback);
  if (Number.isFinite(raw.width) && Number.isFinite(raw.height)) {
    state.width = Math.max(900, Math.min(Math.round(raw.width), 3600));
    state.height = Math.max(640, Math.min(Math.round(raw.height), 2400));
  }
  if (Number.isFinite(raw.x) && Number.isFinite(raw.y)) {
    state.x = Math.round(raw.x);
    state.y = Math.round(raw.y);
  }
  state.maximized = !!raw.maximized;
  return onScreen(state) ? state : fallback;
}

// 记忆的位置可能来自已拔掉的显示器，需要确认窗口仍可见。
function onScreen(state) {
  if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) return true;
  return screen.getAllDisplays().some(function (display) {
    const area = display.workArea;
    const width = Math.min(state.x + state.width, area.x + area.width) - Math.max(state.x, area.x);
    const height = Math.min(state.y + state.height, area.y + area.height) - Math.max(state.y, area.y);
    return width >= 320 && height >= 240;
  });
}

function saveState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.isMaximized() ? mainWindow.getNormalBounds() : mainWindow.getBounds();
  const data = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    maximized: mainWindow.isMaximized()
  };
  try {
    fs.mkdirSync(path.dirname(statePath()), { recursive: true });
    fs.writeFileSync(statePath(), JSON.stringify(data));
  } catch (e) { /* 状态记忆失败不影响使用 */ }
}

function createWindow() {
  const state = readState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 640,
    title: TITLE,
    backgroundColor: '#FFE5EC',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webviewTag: false
    }
  });

  mainWindow.loadFile(path.join(ROOT, 'index.html'));

  mainWindow.once('ready-to-show', function () {
    if (state.maximized) mainWindow.maximize();
    mainWindow.show();
  });

  // 桌面版不产生子窗口；http(s) 链接交给系统浏览器。
  mainWindow.webContents.setWindowOpenHandler(function (details) {
    openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', function (event, url) {
    if (url.startsWith('file://')) return;
    event.preventDefault();
    openExternal(url);
  });

  mainWindow.on('close', function () {
    if (isQuitting) return;
    saveState();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function openExternal(url) {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
