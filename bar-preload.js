'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bar', {
  showMain: () => ipcRenderer.invoke('bar:show-main'),
  quit:     () => ipcRenderer.invoke('app:quit'),
  onStatus: (cb) => ipcRenderer.on('bar:status', (_e, s) => cb(s)),
});

