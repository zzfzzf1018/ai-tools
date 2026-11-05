// 心晴岛桌面版主进程：直接用 loadFile 打开仓库内的静态页面，零构建、零改动源码
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#FFF6E8', // 与网页一致的明亮底色，避免启动白屏闪烁
    title: '心晴岛 · 儿童社会情绪学习',
    webPreferences: {
      nodeIntegration: false, // 网页不允许访问 Node，儿童安全
      contextIsolation: true, // 隔离页面与预加载上下文
    },
  });
  mainWindow = win;

  // 去掉默认英文菜单栏：儿童软件不需要
  Menu.setApplicationMenu(null);

  // 从应用根目录加载 index.html（打包进 asar 后同样由 Electron 读取）
  win.loadFile(path.join(__dirname, '..', 'index.html'));

  // 禁止一切新窗口/弹窗，防止外部链接被打开
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 只允许停留在本地 file:// 页面，阻止跳转到任何外部 URL
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // F11 切换全屏，忽略长按产生的重复按键
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11' && !input.isAutoRepeat) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  win.on('closed', () => { mainWindow = null; });
}

// 便携版双击两次时只保留一个实例，避免两个窗口同时写同一份本地存档
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    app.setAppUserModelId('com.sunnyisles.sel');
    createWindow();
  });
}

// Windows 常规：关闭全部窗口即退出应用
app.on('window-all-closed', () => {
  app.quit();
});
