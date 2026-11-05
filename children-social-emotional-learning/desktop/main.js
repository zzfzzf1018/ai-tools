// 心晴岛桌面版主进程：直接用 loadFile 打开仓库内的静态页面，零构建、零改动源码
const { app, BrowserWindow, Menu, session } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

let mainWindow = null;

const APP_DIR = path.join(__dirname, '..');
const INDEX_FILE = path.join(APP_DIR, 'index.html');
/* 只允许停留在应用自己的目录里；hash 路由不会触发 will-navigate，不受影响 */
const APP_DIR_URL = pathToFileURL(APP_DIR + path.sep).href;

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
      sandbox: true, // 渲染进程沙箱（Electron 20+ 默认开启，这里显式写明）
      spellcheck: false, // 关掉拼写检查，避免 Chromium 去下载词典（本软件承诺完全离线）
    },
  });
  mainWindow = win;

  // 去掉默认英文菜单栏：儿童软件不需要
  Menu.setApplicationMenu(null);

  // 从应用根目录加载 index.html（打包进 asar 后同样由 Electron 读取）
  win.loadFile(INDEX_FILE);

  // 禁止一切新窗口/弹窗，防止外部链接被打开
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 只允许停留在应用自己的目录，阻止跳转到任何外部 URL 或本机其它文件
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_DIR_URL)) {
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
    /* 本软件不需要摄像头、麦克风、定位、通知等任何权限，一律拒绝 */
    try {
      session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
      session.defaultSession.setPermissionCheckHandler(() => false);
    } catch (e) {}
    createWindow();
  });
}

/* 页面里即使出现 <webview> 也不允许挂载 */
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

// Windows 常规：关闭全部窗口即退出应用
app.on('window-all-closed', () => {
  app.quit();
});
