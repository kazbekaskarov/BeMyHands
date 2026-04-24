'use strict';

require('dotenv').config();
const { app, BrowserWindow, ipcMain, screen, systemPreferences, dialog, shell, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Keep timers/JS at full speed even when the window is minimized or hidden.
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// nut-js loaded lazily so the app can still start if the native module fails on first run.
let nut = null;
function getNut() {
  if (nut) return nut;
  try {
    nut = require('@nut-tree-fork/nut-js');
    nut.mouse.config.mouseSpeed = 1500;
    nut.keyboard.config.autoDelayMs = 0;
  } catch (err) {
    console.error('[nut-js] failed to load:', err);
    nut = null;
  }
  return nut;
}

let mainWindow = null;
let barWindow = null;
let controlEnabled = false;

// ---- Config persistence -----------------------------------------------------------
function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); }
  catch { return {}; }
}
function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
    return true;
  } catch (e) { console.error('[config] save failed:', e); return false; }
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const cfg = loadConfig();
  const startHidden = Boolean(cfg.runMode); // runMode = boot straight to bar
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    title: 'BeMyHands — Face & Voice Control',
    backgroundColor: '#07090f',
    show: !startHidden,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  // Closing the main window just hides it — the bar stays so the user can re-open.
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.loadFile('index.html');

  // Prevent the renderer from being treated as "hidden" when minimized.
  mainWindow.webContents.setBackgroundThrottling(false);
  mainWindow.on('minimize', () => mainWindow.webContents.setBackgroundThrottling(false));
  mainWindow.on('hide', () => mainWindow.webContents.setBackgroundThrottling(false));

  // Pass real screen size + OpenAI key presence to renderer.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('bootstrap', {
      screen: { width: display.size.width, height: display.size.height },
      hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
      hasLocalWhisper: detectLocalWhisper().ok,
      whisperModel: process.env.WHISPER_MODEL || 'large-v3',
      platform: process.platform,
      config: loadConfig(),
    });
  });
}

// ---- Persistent floating bar window (always on top, bottom-center of screen) -------

function createBarWindow() {
  const d = screen.getPrimaryDisplay();
  const W = 220, H = 36;
  barWindow = new BrowserWindow({
    width: W,
    height: H,
    x: d.workArea.x + d.workArea.width - W - 12,
    y: d.workArea.y + d.workArea.height - H - 12,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#0d1220',
    webPreferences: {
      preload: path.join(__dirname, 'bar-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  // 'screen-saver' level keeps it above fullscreen apps too.
  barWindow.setAlwaysOnTop(true, 'screen-saver');
  barWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  barWindow.loadFile('bar.html');
  barWindow.on('close', (e) => {
    if (!app.isQuiting) { e.preventDefault(); /* never close the bar except on quit */ }
  });
}

// ---- Window control IPC ----------------------------------------------------------

ipcMain.handle('window:show', () => {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.handle('bar:show-main', () => {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
});

// Renderer broadcasts status -> we relay to the bar window.
ipcMain.handle('bar:status', (_e, status) => {
  if (barWindow && !barWindow.isDestroyed()) {
    barWindow.webContents.send('bar:status', status);
  }
});

ipcMain.handle('window:setMode', (_e, mode) => {
  if (!mainWindow) return;
  // 'compact' = hide the settings window (the floating bar stays visible).
  // 'normal'  = show + focus the settings window.
  if (mode === 'compact') {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:set', (_e, cfg) => saveConfig(cfg));
ipcMain.handle('app:quit', () => { app.isQuiting = true; app.quit(); });

// ---- Local Whisper (whisper.cpp) -------------------------------------------------

function detectLocalWhisper() {
  const cliCandidates = [
    process.env.WHISPER_CLI_PATH,
    '/opt/homebrew/bin/whisper-cli',
    '/usr/local/bin/whisper-cli',
  ].filter(Boolean);
  let cli = null;
  for (const p of cliCandidates) {
    try { if (fs.existsSync(p)) { cli = p; break; } } catch {}
  }
  const modelName = process.env.WHISPER_MODEL || 'large-v3';
  const modelPath = process.env.WHISPER_MODEL_PATH || path.join(__dirname, 'models', `ggml-${modelName}.bin`);
  const modelOk = fs.existsSync(modelPath);
  return { ok: Boolean(cli && modelOk), cli, modelPath, modelName };
}

const TMP_DIR = path.join(os.tmpdir(), 'yonie-whisper');
try { fs.mkdirSync(TMP_DIR, { recursive: true }); } catch {}

// macOS: request camera + microphone permissions up-front for a smoother UX.
async function ensureMediaPermissions() {
  if (process.platform !== 'darwin') return;
  for (const type of ['camera', 'microphone']) {
    try {
      const status = systemPreferences.getMediaAccessStatus(type);
      if (status !== 'granted') {
        await systemPreferences.askForMediaAccess(type);
      }
    } catch (e) {
      console.warn(`[perm] ${type}:`, e.message);
    }
  }
}

app.whenReady().then(async () => {
  await ensureMediaPermissions();
  // Prevent macOS from sleeping the display while the app runs.
  try { powerSaveBlocker.start('prevent-display-sleep'); } catch {}
  createWindow();
  createBarWindow();

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
    else { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('before-quit', () => { app.isQuiting = true; });

// Don't quit when the settings window is closed; the bar keeps the app alive.
app.on('window-all-closed', () => { /* no-op */ });

// --- IPC: cursor / clicks / typing -------------------------------------------------

ipcMain.handle('control:set-enabled', (_e, enabled) => {
  controlEnabled = Boolean(enabled);
  return controlEnabled;
});

ipcMain.handle('cursor:move', async (_e, { x, y }) => {
  if (!controlEnabled) return { ok: false, reason: 'disabled' };
  const n = getNut();
  if (!n) return { ok: false, reason: 'no-nut' };
  try {
    await n.mouse.setPosition(new n.Point(Math.round(x), Math.round(y)));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle('cursor:click', async (_e, button = 'left') => {
  if (!controlEnabled) return { ok: false, reason: 'disabled' };
  const n = getNut();
  if (!n) return { ok: false, reason: 'no-nut' };
  try {
    const btn = button === 'right' ? n.Button.RIGHT : button === 'middle' ? n.Button.MIDDLE : n.Button.LEFT;
    await n.mouse.click(btn);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle('cursor:doubleClick', async (_e, button = 'left') => {
  if (!controlEnabled) return { ok: false, reason: 'disabled' };
  const n = getNut();
  if (!n) return { ok: false, reason: 'no-nut' };
  try {
    const btn = button === 'right' ? n.Button.RIGHT : n.Button.LEFT;
    await n.mouse.doubleClick(btn);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle('cursor:press', async (_e, button = 'left') => {
  if (!controlEnabled) return { ok: false, reason: 'disabled' };
  const n = getNut();
  if (!n) return { ok: false, reason: 'no-nut' };
  try {
    const btn = button === 'right' ? n.Button.RIGHT : n.Button.LEFT;
    await n.mouse.pressButton(btn);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle('cursor:release', async (_e, button = 'left') => {
  if (!controlEnabled) return { ok: false, reason: 'disabled' };
  const n = getNut();
  if (!n) return { ok: false, reason: 'no-nut' };
  try {
    const btn = button === 'right' ? n.Button.RIGHT : n.Button.LEFT;
    await n.mouse.releaseButton(btn);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle('cursor:scroll', async (_e, { dx = 0, dy = 0 }) => {
  if (!controlEnabled) return { ok: false, reason: 'disabled' };
  const n = getNut();
  if (!n) return { ok: false, reason: 'no-nut' };
  try {
    // nut-js scroll* functions only accept positive amounts; pick direction by sign.
    if (dy > 0)      await n.mouse.scrollDown(dy);
    else if (dy < 0) await n.mouse.scrollUp(-dy);
    if (dx > 0)      await n.mouse.scrollRight(dx);
    else if (dx < 0) await n.mouse.scrollLeft(-dx);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle('keyboard:type', async (_e, text) => {
  const n = getNut();
  if (!n) return { ok: false, reason: 'no-nut' };
  try {
    await n.keyboard.type(String(text));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle('keyboard:key', async (_e, keyName) => {
  const n = getNut();
  if (!n) return { ok: false, reason: 'no-nut' };
  try {
    const key = n.Key[keyName];
    if (key === undefined) return { ok: false, reason: 'unknown-key' };
    await n.keyboard.pressKey(key);
    await n.keyboard.releaseKey(key);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

// --- Whisper (optional fallback for voice typing) ---------------------------------

ipcMain.handle('whisper:status', () => detectLocalWhisper());

ipcMain.handle('whisper:local', async (_e, { wavBase64, lang }) => {
  const det = detectLocalWhisper();
  if (!det.ok) {
    return { ok: false, reason: det.cli ? 'model-missing' : 'cli-missing', detail: det };
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const wavPath = path.join(TMP_DIR, `${id}.wav`);
  try {
    fs.writeFileSync(wavPath, Buffer.from(wavBase64, 'base64'));
    const args = [
      '-m', det.modelPath,
      '-f', wavPath,
      '-nt', // no timestamps in stdout
      '-np', // no special prints
      '-t', String(Math.max(2, Math.min(8, os.cpus().length - 2))),
      '-l', lang || 'auto',
      '-bs', '5',     // beam size
      '-bo', '5',     // best of
    ];
    // Allow translation to English via env if needed.
    if (process.env.WHISPER_TRANSLATE === '1') args.push('-tr');

    const text = await new Promise((resolve, reject) => {
      const p = spawn(det.cli, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '', err = '';
      p.stdout.on('data', (d) => { out += d.toString(); });
      p.stderr.on('data', (d) => { err += d.toString(); });
      p.on('error', reject);
      p.on('close', (code) => {
        if (code !== 0) return reject(new Error(`whisper-cli exited ${code}: ${err.split('\n').slice(-5).join(' ')}`));
        resolve(out);
      });
    });

    // Clean stdout: remove [BLANK_AUDIO], (...) tags, trim.
    const clean = text
      .replace(/\[[A-Z_ ]+\]/g, '')
      .replace(/\s+\n/g, '\n')
      .trim();

    return { ok: true, text: clean };
  } catch (err) {
    return { ok: false, reason: err.message };
  } finally {
    try { fs.unlinkSync(wavPath); } catch {}
  }
});

ipcMain.handle('whisper:transcribe', async (_e, { base64, mime, lang }) => {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, reason: 'no-api-key' };
  }
  try {
    const buf = Buffer.from(base64, 'base64');
    const form = new FormData();
    const blob = new Blob([buf], { type: mime || 'audio/webm' });
    form.append('file', blob, 'audio.webm');
    form.append('model', 'whisper-1');
    if (lang) form.append('language', lang);

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, reason: `openai ${res.status}: ${txt}` };
    }
    const json = await res.json();
    return { ok: true, text: json.text || '' };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle('app:open-system-settings', async (_e, pane) => {
  // Helps user grant Accessibility permission.
  const urls = {
    accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    camera: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
    microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  };
  await shell.openExternal(urls[pane] || urls.accessibility);
});

ipcMain.handle('app:dialog', async (_e, opts) => dialog.showMessageBox(mainWindow, opts));

// --- Launch URLs / macOS apps via voice commands ----------------------------------

ipcMain.handle('app:launch', async (_e, spec = {}) => {
  try {
    // 1) URL → open in default browser (works for https, mailto, tg://, spotify://, etc.)
    if (spec.url) {
      await shell.openExternal(spec.url);
      return { ok: true, kind: 'url' };
    }
    // 2) macOS application by name → `open -a "AppName"`
    if (spec.macApp) {
      if (process.platform !== 'darwin') {
        return { ok: false, reason: 'macApp only supported on darwin' };
      }
      const child = spawn('open', ['-a', spec.macApp], { detached: true, stdio: 'ignore' });
      child.on('error', () => {});
      child.unref();
      return { ok: true, kind: 'app' };
    }
    // 3) Generic shell.openPath fallback for files/folders.
    if (spec.path) {
      const err = await shell.openPath(spec.path);
      if (err) return { ok: false, reason: err };
      return { ok: true, kind: 'path' };
    }
    return { ok: false, reason: 'no-target' };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

