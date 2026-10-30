const { app, BrowserWindow, dialog, session } = require('electron');
const path = require('node:path');

app.setAppUserModelId('com.typingisland.app');
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  const createWindow = () => {
    const window = new BrowserWindow({
      width: 1360,
      height: 900,
      minWidth: 850,
      minHeight: 650,
      title: '打字小岛 · Typing Island',
      backgroundColor: '#f7fbfa',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    window.webContents.on('will-prevent-unload', (event) => {
      const choice = dialog.showMessageBoxSync(window, {
        type: 'question',
        title: '离开打字小岛？',
        message: '这次练习还没有完成，退出后需要重新开始。',
        buttons: ['退出练习', '继续学习'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      if (choice === 0) event.preventDefault();
    });
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  };
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
