'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yonie', {
  onBootstrap: (cb) => ipcRenderer.on('bootstrap', (_e, data) => cb(data)),
  setControlEnabled: (v) => ipcRenderer.invoke('control:set-enabled', v),
  moveCursor: (x, y) => ipcRenderer.invoke('cursor:move', { x, y }),
  click: (button) => ipcRenderer.invoke('cursor:click', button),
  doubleClick: (button) => ipcRenderer.invoke('cursor:doubleClick', button),
  press: (button) => ipcRenderer.invoke('cursor:press', button),
  release: (button) => ipcRenderer.invoke('cursor:release', button),
  scroll: (dx, dy) => ipcRenderer.invoke('cursor:scroll', { dx, dy }),
  typeText: (text) => ipcRenderer.invoke('keyboard:type', text),
  pressKey: (keyName) => ipcRenderer.invoke('keyboard:key', keyName),
  whisper: (base64, mime, lang) => ipcRenderer.invoke('whisper:transcribe', { base64, mime, lang }),
  whisperLocal: (wavBase64, lang) => ipcRenderer.invoke('whisper:local', { wavBase64, lang }),
  whisperStatus: () => ipcRenderer.invoke('whisper:status'),
  openSystemSettings: (pane) => ipcRenderer.invoke('app:open-system-settings', pane),
  dialog: (opts) => ipcRenderer.invoke('app:dialog', opts),
  // Hands-free helpers
  configGet: () => ipcRenderer.invoke('config:get'),
  configSet: (cfg) => ipcRenderer.invoke('config:set', cfg),
  windowShow: () => ipcRenderer.invoke('window:show'),
  windowSetMode: (mode) => ipcRenderer.invoke('window:setMode', mode),
  barStatus: (status) => ipcRenderer.invoke('bar:status', status),
  launch: (spec) => ipcRenderer.invoke('app:launch', spec),
  quit: () => ipcRenderer.invoke('app:quit'),
});

