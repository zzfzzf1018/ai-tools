const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mathwonder', {
  isDesktop: true,
  loadSave: () => ipcRenderer.invoke('save-load'),
  writeSave: (json) => ipcRenderer.invoke('save-write', json)
});
