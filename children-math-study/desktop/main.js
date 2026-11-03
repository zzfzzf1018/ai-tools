const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SAVE_FILE = () => path.join(app.getPath('userData'), 'mathwonder-save.json');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

// 进度存取：渲染进程经 IPC 读写 userData 下的 JSON 文件
ipcMain.handle('save-load', async () => {
  try {
    return fs.readFileSync(SAVE_FILE(), 'utf-8');
  } catch (e) {
    return null;
  }
});

ipcMain.handle('save-write', async (_evt, json) => {
  try {
    fs.writeFileSync(SAVE_FILE(), json, 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
