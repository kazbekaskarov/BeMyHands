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
  // pressKey accepts either a string ('Enter') or { key: 'S', modifiers: ['cmd','shift'] }.
  pressKey: (keyOrSpec, modifiers) => {
    const payload = typeof keyOrSpec === 'string' && modifiers
      ? { key: keyOrSpec, modifiers }
      : keyOrSpec;
    return ipcRenderer.invoke('keyboard:key', payload);
  },
  whisper: (base64, mime, lang) => ipcRenderer.invoke('whisper:transcribe', { base64, mime, lang }),
  whisperLocal: (wavBase64, lang) => ipcRenderer.invoke('whisper:local', { wavBase64, lang }),
  whisperStatus: () => ipcRenderer.invoke('whisper:status'),
  whisperDownloadModel: (model) => ipcRenderer.invoke('whisper:download-model', { model }),
  onWhisperDownloadProgress: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('whisper:download-progress', listener);
    return () => ipcRenderer.removeListener('whisper:download-progress', listener);
  },
  intent: {
    classify: (text, opts) => ipcRenderer.invoke('intent:classify', { text, ...(opts || {}) }),
    status: () => ipcRenderer.invoke('intent:status'),
    warmup: () => ipcRenderer.invoke('intent:warmup'),
  },
  openSystemSettings: (pane) => ipcRenderer.invoke('app:open-system-settings', pane),
  dialog: (opts) => ipcRenderer.invoke('app:dialog', opts),
  // Hands-free helpers
  configGet: () => ipcRenderer.invoke('config:get'),
  configSet: (cfg) => ipcRenderer.invoke('config:set', cfg),
  windowShow: () => ipcRenderer.invoke('window:show'),
  windowSetMode: (mode) => ipcRenderer.invoke('window:setMode', mode),
  barStatus: (status) => ipcRenderer.invoke('bar:status', status),
  launch: (spec) => ipcRenderer.invoke('app:launch', spec),
  crosshair: {
    show: () => ipcRenderer.invoke('crosshair:show'),
    hide: () => ipcRenderer.invoke('crosshair:hide'),
    move: (x, y) => ipcRenderer.invoke('crosshair:move', { x, y }),
  },
  quit: () => ipcRenderer.invoke('app:quit'),
});

