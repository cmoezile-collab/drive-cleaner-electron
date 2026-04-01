const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('driveCleaner', {
  getInitialState: () => ipcRenderer.invoke('app:init'),
  refreshDrives: () => ipcRenderer.invoke('drives:list'),
  startClean: (payload) => ipcRenderer.invoke('clean:start', payload),
  startFormat: (payload) => ipcRenderer.invoke('format:start', payload),
  stopTask: () => ipcRenderer.invoke('task:stop'),
  windowAction: (action) => ipcRenderer.send('window:action', action),
  onEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('drive-cleaner:event', listener);
    return () => ipcRenderer.removeListener('drive-cleaner:event', listener);
  }
});
