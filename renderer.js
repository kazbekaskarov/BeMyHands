// renderer.js — MediaPipe FaceLandmarker + voice typing
import {
  FaceLandmarker,
  FilesetResolver,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

// Translation helper — falls back to the key itself if i18n not loaded yet.
const t  = (k)        => (window.i18n && window.i18n.t  ? window.i18n.t(k)  : k);
const tf = (k, p)     => (window.i18n && window.i18n.tf ? window.i18n.tf(k, p) : k);

// -------------------- DOM --------------------
const $ = (id) => document.getElementById(id);
const video = $('video');
const overlay = $('overlay');
const ctx = overlay.getContext('2d');
const statusEl = $('status');
const transcriptEl = $('transcript');

const toggleBtn = $('toggleControl');
const calibrateBtn = $('calibrate');
const trackerSel = $('tracker');
const smoothEl = $('smooth');
const sensXEl = $('sensX');
const sensYEl = $('sensY');
const blinkClickEl = $('g_mouth');     // legacy alias kept for code below
const mouthThreshEl = $('g_mouth_t');
const mouthValEl = $('g_mouth_v');
const dwellClickEl = $('dwellClick');
const modeIndicatorEl = $('modeIndicator');

// Hands-free controls
const autoStartEl     = $('autoStart');
const autoPauseEl     = $('autoPause');
const hotCornersEl    = $('hotCorners');
const voiceCommandsEl = $('voiceCommands');
const useModeBtn      = $('useMode');
const compactEl       = $('compactWidget');
const compactDot      = $('compactDot');
const compactText     = $('compactText');
const compactMode     = $('compactMode');

// All gesture controls (id prefix g_)
const gestureDefs = [
  { key: 'mouth',  on: 'g_mouth',  thr: 'g_mouth_t',  val: 'g_mouth_v',  shape: 'jawOpen',        action: 'click' },
  { key: 'brow',   on: 'g_brow',   thr: 'g_brow_t',   val: 'g_brow_v',   shape: 'browInnerUp',    action: 'rightClick' },
  { key: 'smile',  on: 'g_smile',  thr: 'g_smile_t',  val: 'g_smile_v',  shape: 'smile',          action: 'doubleClick' },
  { key: 'winkL',  on: 'g_winkL',  thr: 'g_winkL_t',  val: 'g_winkL_v',  shape: 'winkLeft',       action: 'holdDrag' },
  { key: 'winkR',  on: 'g_winkR',  thr: 'g_winkR_t',  val: 'g_winkR_v',  shape: 'winkRight',      action: 'holdScroll' },
];
for (const g of gestureDefs) {
  g.onEl  = document.getElementById(g.on);
  g.thrEl = document.getElementById(g.thr);
  g.valEl = document.getElementById(g.val);
  g.state = { was: false, lastFireAt: 0 };
}

const voiceBtn = $('toggleVoice');
const voiceLangEl = $('voiceLang');
const voiceEngineEl = $('voiceEngine');

// -------------------- State --------------------
let bootstrap = { screen: { width: 1920, height: 1080 }, hasOpenAIKey: false, platform: 'darwin' };
let faceLandmarker = null;
let running = false;
let controlEnabled = false;
let calibCenter = null; // {x, y} in normalized coords from camera image (unmirrored)
let smoothed = null;
let lastMoveAt = 0;
let lastMovePos = { x: 0, y: 0 };
let dwellTimer = null;
let mouthState = { openSince: 0, lastClickAt: 0, wasOpen: false };
// Rolling history of recent cursor positions to anchor the click before mouth-open jitter.
const posHistory = []; // { t, x, y }
let freezeUntil = 0;   // ignore cursor updates until this timestamp (ms)
// Modal states
let dragActive = false;
let scrollMode = false;
let scrollAccum = { x: 0, y: 0 };
let lastScrollAt = 0;

// Diagnostics: track frame throughput so we can tell whether camera/MP/face is the problem.
const diag = { frames: 0, faceFrames: 0, detectErrors: 0, startedAt: 0 };

// Precision mode: voice "точно" → 3 sec at ×0.25 sensitivity + on-screen crosshair.
let precisionUntil = 0;
let precisionTimer = null;
function activatePrecision(durationMs = 3000) {
  precisionUntil = performance.now() + durationMs;
  setMode('🎯 PRECISION', 'precision');
  try { window.yonie.crosshair.show(); } catch {}
  clearTimeout(precisionTimer);
  precisionTimer = setTimeout(() => {
    if (performance.now() >= precisionUntil) {
      try { window.yonie.crosshair.hide(); } catch {}
      // Don't clobber drag/scroll badges if those are now active.
      if (!dragActive && !scrollMode && !userPaused) setMode('', '');
    }
  }, durationMs + 60);
}

window.yonie.onBootstrap((b) => {
  bootstrap = b;
  if (!b.hasOpenAIKey) {
    voiceEngineEl.querySelector('option[value="whisper"]').disabled = true;
  }
  if (!b.hasLocalWhisper) {
    const opt = voiceEngineEl.querySelector('option[value="local"]');
    opt.textContent = t('d.voice_local_missing');
  } else {
    const opt = voiceEngineEl.querySelector('option[value="local"]');
    opt.textContent = tf('d.voice_local_ready', { model: b.whisperModel || 'large-v3' });
  }
  // Restore saved configuration (helper set this up earlier).
  applyConfig(b.config || {});

  // Локальная модель распознавания команд (TF-IDF, без сети) — мгновенная.
  if (window.yonie?.intent) {
    window.yonie.intent.warmup().then((res) => {
      if (res?.ok) appendTranscript(`[intent] локальный классификатор готов: ${res.status?.intents || 0} намерений\n`);
    });
  }
  // Auto-start cursor + voice ONLY when the user opted in via the checkbox.
  // Read straight from the DOM (applyConfig set it) so we always reflect the
  // current persisted state — even if b.config and the checkbox got out of sync.
  const wantAutoStart = Boolean(autoStartEl?.checked || (b.config && b.config.autoStart));
  console.log('[yonie] bootstrap →', {
    autoStart: wantAutoStart,
    hasCalib: Boolean(b.config && b.config.calibCenter),
    hasLocalWhisper: b.hasLocalWhisper,
  });

  if (wantAutoStart) {
    setTimeout(() => {
      autoStartAll();
      // If we didn't have calibration, nudge the user — voice may still be working.
      if (!calibCenter && statusEl) {
        statusEl.textContent = t('d.autostart_calib');
      }
    }, 1500);
  }
});

// ---- Persistent configuration -----------------------------------------------------

const PERSISTED_CONTROLS = [
  'tracker', 'smooth', 'sensX', 'sensY', 'dwellClick',
  'g_mouth', 'g_mouth_t', 'g_brow', 'g_brow_t', 'g_smile', 'g_smile_t',
  'g_winkL', 'g_winkL_t', 'g_winkR', 'g_winkR_t',
  'voiceLang', 'voiceEngine', 'continuousVoice',
  'autoStart', 'autoPause', 'hotCorners', 'voiceCommands',
];
let savedConfig = {};

function applyConfig(cfg) {
  savedConfig = { ...cfg };
  for (const id of PERSISTED_CONTROLS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (Object.prototype.hasOwnProperty.call(cfg, id)) {
      if (el.type === 'checkbox') el.checked = Boolean(cfg[id]);
      else el.value = cfg[id];
    }
  }
  if (cfg.calibCenter && typeof cfg.calibCenter.x === 'number') {
    calibCenter = { x: cfg.calibCenter.x, y: cfg.calibCenter.y };
    if (statusEl) statusEl.textContent = t('d.calib_loaded');
  }
  // Restore UI language (saved separately in localStorage by i18n.js, but we also
  // mirror it into the main config so it travels between machines if synced).
  if (cfg.uiLang && window.i18n) {
    try { window.i18n.setLang(cfg.uiLang); } catch {}
  }
}

let saveTimer = null;
function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const cfg = { ...savedConfig };
    for (const id of PERSISTED_CONTROLS) {
      const el = document.getElementById(id);
      if (!el) continue;
      cfg[id] = el.type === 'checkbox' ? el.checked : el.value;
    }
    if (calibCenter) cfg.calibCenter = calibCenter;
    // runMode now means "main settings window currently hidden" — track via mainWindow visibility
    // is impossible from renderer, so we just persist false; user can re-enable via "Use mode" btn.
    cfg.runMode = false;
    savedConfig = cfg;
    window.yonie.configSet(cfg);
  }, 300);
}

// Save on any control change.
for (const id of PERSISTED_CONTROLS) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', persistSoon);
}

// Persist UI language whenever the user switches it.
if (window.i18n && window.i18n.onChange) {
  window.i18n.onChange((lang) => {
    savedConfig = { ...savedConfig, uiLang: lang };
    try { window.yonie.configSet(savedConfig); } catch {}
    // Update dynamic strings that aren't covered by data-i18n.
    setBtnLabel(toggleBtn, controlEnabled ? t('overview.stop') : t('overview.start'));
    setBtnLabel(voiceBtn,  voiceActive    ? t('voice.stop')    : t('voice.start'));
    // Voice gate badge text follows the language too.
    const badge = document.getElementById('voiceGateBadge');
    if (badge) badge.textContent = voiceMuted ? t('voice.gate_state_muted') : t('voice.gate_state_listen');
    // Re-render the current status line so reason/mode badges follow the new language.
    try {
      const pill = document.getElementById('statusPill');
      const dot = pill && (pill.classList.contains('ok') ? 'ok'
                : pill.classList.contains('warn') ? 'warn'
                : pill.classList.contains('err') ? 'err' : '');
      if (userPaused)         setStatus(t('d.paused'),  'warn');
      else if (faceLost)      setStatus(t('d.mode_noface'), 'warn');
      else if (controlEnabled) setStatus(t('d.ctrl_active'), 'ok');
      else                    setStatus(t('d.ready_short'), dot || 'warn');
    } catch {}
  });
}

// Hands-free toggles persist *immediately* (no 300ms debounce) so closing the
// window right after toggling autoStart still saves the new value.
function persistNow() {
  clearTimeout(saveTimer);
  const cfg = { ...savedConfig };
  for (const id of PERSISTED_CONTROLS) {
    const el = document.getElementById(id);
    if (!el) continue;
    cfg[id] = el.type === 'checkbox' ? el.checked : el.value;
  }
  if (calibCenter) cfg.calibCenter = calibCenter;
  cfg.runMode = false;
  savedConfig = cfg;
  window.yonie.configSet(cfg);
}
for (const id of ['autoStart', 'autoPause', 'hotCorners', 'voiceCommands']) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', persistNow);
}

// -------------------- MediaPipe init --------------------
let mpFileset = null;
let mpDelegate = 'GPU';
let lastDetectError = null;

async function initFaceLandmarker() {
  statusEl.textContent = t('d.mp_loading');
  if (!mpFileset) {
    mpFileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
  }
  const buildOpts = (delegate) => ({
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate,
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
  });
  try {
    faceLandmarker = await FaceLandmarker.createFromOptions(mpFileset, buildOpts('GPU'));
    mpDelegate = 'GPU';
  } catch (e) {
    console.warn('[MediaPipe] GPU delegate failed, fallback to CPU:', e);
    statusEl.textContent = t('d.mp_gpu_fail');
    faceLandmarker = await FaceLandmarker.createFromOptions(mpFileset, buildOpts('CPU'));
    mpDelegate = 'CPU';
  }
  statusEl.textContent = tf('d.mp_loaded', { delegate: mpDelegate });
}

async function listCameras() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'videoinput');
  } catch { return []; }
}

let currentStream = null;
async function initCamera() {
  // Try preferred constraints first; if they fail, fall back to "any" videoinput.
  const attempts = [
    { video: { width: 640, height: 480, facingMode: 'user' }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
    { video: true, audio: false },
  ];
  let stream = null, lastErr = null;
  for (const c of attempts) {
    try { stream = await navigator.mediaDevices.getUserMedia(c); break; }
    catch (e) { lastErr = e; console.warn('[camera] getUserMedia failed for', c, e.name, e.message); }
  }
  if (!stream) {
    // Last resort: pick first available videoinput by deviceId.
    const cams = await listCameras();
    if (cams.length) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cams[0].deviceId } }, audio: false,
        });
      } catch (e) { lastErr = e; }
    }
  }
  if (!stream) {
    const reason = lastErr ? `${lastErr.name}: ${lastErr.message}` : t('d.cam_no_avail');
    throw new Error(tf('d.cam_open_fail', { reason }));
  }

  currentStream = stream;
  video.srcObject = stream;
  await new Promise((r) => (video.onloadedmetadata = r));
  await video.play();
  overlay.width = video.videoWidth || 640;
  overlay.height = video.videoHeight || 480;

  // If the OS yanks the stream (e.g., another app grabs the camera), try to recover.
  const track = stream.getVideoTracks()[0];
  if (track) {
    track.addEventListener('ended', () => {
      console.warn('[camera] track ended — попытка переподключения через 1с');
      statusEl.textContent = t('d.cam_disconnect');
      currentStream = null;
      setTimeout(() => initCamera().catch((e) => {
        statusEl.textContent = tf('d.cam_reconnect_fail', { msg: e.message });
      }), 1000);
    });
    track.addEventListener('mute', () => console.warn('[camera] track muted'));
    track.addEventListener('unmute', () => console.warn('[camera] track unmuted'));
  }

  statusEl.textContent = tf('d.cam_ready', { w: video.videoWidth, h: video.videoHeight });
}

// -------------------- Loop --------------------
// Use setInterval (not requestAnimationFrame) so the loop keeps running when
// the Electron window is minimized or hidden — rAF is paused by the OS/Chromium.
let loopTimer = null;
function startLoop() {
  if (loopTimer) return;
  loopTimer = setInterval(tick, 1000 / 60);
}
function stopLoop() {
  if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
}

function tick() {
  if (!running) return;
  if (video.readyState >= 2 && faceLandmarker) {
    const now = performance.now();
    let result;
    try {
      result = faceLandmarker.detectForVideo(video, now);
      diag.frames++;
    } catch (e) {
      // Surface the error so we know why detection isn't producing landmarks.
      lastDetectError = e;
      diag.detectErrors++;
      if (diag.detectErrors === 1 || diag.detectErrors % 60 === 0) {
        console.warn('[detectForVideo] error:', e);
      }
      return;
    }
    if (document.visibilityState === 'visible') drawOverlay(result);
    if (result && result.faceLandmarks && result.faceLandmarks.length) {
      diag.faceFrames++;
      handleFace(result, now);
    }
  }
}

function drawOverlay(result) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (!result.faceLandmarks || !result.faceLandmarks.length) return;
  const lm = result.faceLandmarks[0];
  // Draw nose tip + eye centers
  const points = [1, 33, 263]; // nose tip, left eye outer, right eye outer
  ctx.fillStyle = '#16a34a';
  for (const i of points) {
    const p = lm[i];
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x * overlay.width, p.y * overlay.height, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Center marker if calibrated
  if (calibCenter) {
    ctx.strokeStyle = '#2c6cf6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(calibCenter.x * overlay.width, calibCenter.y * overlay.height, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function handleFace(result, now) {
  const lm = result.faceLandmarks[0];
  const tracker = trackerSel.value;
  let pt;
  if (tracker === 'eyes') {
    const a = lm[33], b = lm[263];
    pt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  } else {
    pt = { x: lm[1].x, y: lm[1].y };
  }

  if (!calibCenter) return;

  // Sensitivity & mirroring (camera is mirrored visually; invert x so head-right → cursor-right).
  const sensX = parseFloat(sensXEl.value);
  const sensY = parseFloat(sensYEl.value);
  // Precision mode → quarter sensitivity for ~3 sec for pixel-perfect aiming.
  const precisionActive = now < precisionUntil;
  const sensMul = precisionActive ? 0.25 : 1;
  let dx = -(pt.x - calibCenter.x) * sensX * sensMul; // invert
  let dy = (pt.y - calibCenter.y) * sensY * sensMul;

  // Map deltas to absolute screen coordinates around screen center.
  const sw = bootstrap.screen.width;
  const sh = bootstrap.screen.height;
  let targetX = sw / 2 + dx * sw;
  let targetY = sh / 2 + dy * sh;
  targetX = Math.max(1, Math.min(sw - 2, targetX));
  targetY = Math.max(1, Math.min(sh - 2, targetY));

  // EMA smoothing
  const a = parseFloat(smoothEl.value);
  if (!smoothed) smoothed = { x: targetX, y: targetY };
  smoothed.x = a * smoothed.x + (1 - a) * targetX;
  smoothed.y = a * smoothed.y + (1 - a) * targetY;

  // Throttle to ~90Hz
  if (controlEnabled && now - lastMoveAt > 11) {
    lastMoveAt = now;
    const moved = Math.hypot(smoothed.x - lastMovePos.x, smoothed.y - lastMovePos.y);
    lastMovePos = { x: smoothed.x, y: smoothed.y };

    // Record history for click anchoring (keep last ~500ms).
    posHistory.push({ t: now, x: smoothed.x, y: smoothed.y });
    while (posHistory.length && now - posHistory[0].t > 500) posHistory.shift();

    if (scrollMode) {
      // In scroll mode: head movement scrolls, cursor stays put.
      // Use RAW head delta (not multiplied by cursor sensitivity), so scroll feel is independent
      // of the cursor sensitivity sliders.
      if (now - lastScrollAt > 40) {
        lastScrollAt = now;
        const rawDx = -(pt.x - calibCenter.x);
        const rawDy =  (pt.y - calibCenter.y);
        const DEAD = 0.03;
        const ramp = (v) => {
          const a = Math.abs(v);
          if (a < DEAD) return 0;
          // Up to 25 wheel ticks per call; quadratic so small tilts stay slow, big tilts fly.
          const t = (a - DEAD) / 0.18;
          const ticks = Math.min(25, Math.max(5, Math.round(5 + t * t * 20)));
          return v < 0 ? -ticks : ticks;
        };
        const sx = ramp(rawDx);
        const sy = ramp(rawDy);
        if (sx || sy) window.yonie.scroll(sx, sy);
      }
    } else if (now >= freezeUntil) {
      window.yonie.moveCursor(smoothed.x, smoothed.y);
      if (precisionActive) {
        try { window.yonie.crosshair.move(smoothed.x, smoothed.y); } catch {}
      }
    }

    // Dwell click (only when not in special modes).
    if (dwellClickEl.checked && !scrollMode && !dragActive && now >= freezeUntil) {
      if (moved < 4) {
        if (!dwellTimer) {
          dwellTimer = setTimeout(() => {
            window.yonie.click('left');
            dwellTimer = null;
          }, 1200);
        }
      } else if (dwellTimer) {
        clearTimeout(dwellTimer);
        dwellTimer = null;
      }
    }
  }

  // ---- Gestures (blendshape-driven) ----
  if (result.faceBlendshapes && result.faceBlendshapes.length) {
    handleGestures(result.faceBlendshapes[0].categories, now);
  }
}

function handleGestures(cats, now) {
  // Build a fast lookup of blendshape scores.
  const m = {};
  for (const c of cats) m[c.categoryName] = c.score;

  const blinkL = m.eyeBlinkLeft || 0;
  const blinkR = m.eyeBlinkRight || 0;

  // Derived shapes for the simple gestures.
  const shapes = {
    jawOpen:     m.jawOpen || 0,
    browInnerUp: Math.max(m.browInnerUp || 0, ((m.browOuterUpLeft || 0) + (m.browOuterUpRight || 0)) / 2),
    smile:       ((m.mouthSmileLeft || 0) + (m.mouthSmileRight || 0)) / 2,
    // For winks we expose just the asymmetry as the "score" so the live bar is meaningful,
    // but the actual trigger uses an additional absolute closed-eye check (see below).
    winkLeft:    Math.max(0, blinkL - blinkR),
    winkRight:   Math.max(0, blinkR - blinkL),
  };

  for (const g of gestureDefs) {
    const score = shapes[g.shape] || 0;
    if (g.valEl) {
      g.valEl.textContent = score.toFixed(2);
      g.valEl.classList.toggle('hot', score > parseFloat(g.thrEl.value));
    }
    if (!g.onEl.checked || !controlEnabled) {
      // If we were holding drag/scroll, release it cleanly.
      if (g.state.was) {
        if (g.action === 'holdDrag' && dragActive) {
          dragActive = false; window.yonie.release('left'); setMode('', '');
        } else if (g.action === 'holdScroll' && scrollMode) {
          scrollMode = false; setMode('', '');
        }
      }
      g.state.was = false;
      continue;
    }

    const thr = parseFloat(g.thrEl.value);
    let active = score > thr;

    // Extra guard for winks: the "closed" eye must really be closed (>0.45),
    // and the "open" eye must be reasonably open (<0.55). This prevents misfires
    // on full blinks, head turns and side-glances.
    if (g.key === 'winkL') active = active && blinkL > 0.45 && blinkR < 0.55;
    if (g.key === 'winkR') active = active && blinkR > 0.45 && blinkL < 0.55;

    const wasActive = g.state.was;

    // Hysteresis for hold-style gestures: once active, stay active until score
    // drops well below the threshold AND the absolute closed-eye check relaxes.
    // This prevents flicker while the user tilts their head with one eye closed.
    if ((g.action === 'holdDrag' || g.action === 'holdScroll') && wasActive) {
      const exitThr = thr * 0.4;
      let stillHeld = score > exitThr;
      if (g.key === 'winkL') stillHeld = stillHeld && blinkL > 0.30;
      if (g.key === 'winkR') stillHeld = stillHeld && blinkR > 0.30;
      active = stillHeld;
    }

    g.state.was = active;

    if (g.action === 'holdDrag' || g.action === 'holdScroll') {
      // Hold-style: react to edges in both directions, no debounce.
      if (active && !wasActive) {
        if (g.action === 'holdDrag') {
          if (!dragActive) {
            dragActive = true;
            window.yonie.press('left');
            setMode('🖱 DRAG', 'drag');
          }
        } else { // holdScroll
          if (!scrollMode) {
            scrollMode = true;
            setMode('↕ SCROLL', 'scroll');
          }
        }
      } else if (!active && wasActive) {
        if (g.action === 'holdDrag') {
          if (dragActive) {
            dragActive = false;
            window.yonie.release('left');
            setMode('', '');
          }
        } else {
          if (scrollMode) {
            scrollMode = false;
            setMode('', '');
          }
        }
      }
      continue;
    }

    // Rising edge with debounce (700ms between fires) for tap-style gestures.
    if (active && !wasActive && now - g.state.lastFireAt > 700) {
      g.state.lastFireAt = now;
      fireGesture(g.action, now);
    }
  }
}

function setMode(label, cls) {
  if (!modeIndicatorEl) return;
  modeIndicatorEl.className = 'badge';
  if (label) {
    modeIndicatorEl.classList.add('show', cls);
    modeIndicatorEl.textContent = label;
  } else {
    modeIndicatorEl.textContent = '';
  }
}

function clickAtAnchor(button = 'left', double = false) {
  // Anchor to position ~180ms before the gesture (before any face-wobble).
  const anchorT = performance.now() - 180;
  let anchor = posHistory[0] || (smoothed ? { x: smoothed.x, y: smoothed.y } : null);
  if (!anchor) return;
  for (const p of posHistory) { if (p.t <= anchorT) anchor = p; else break; }

  window.yonie.moveCursor(anchor.x, anchor.y).then(() => {
    if (double) window.yonie.doubleClick(button);
    else        window.yonie.click(button);
  });
  freezeUntil = performance.now() + 450;
  smoothed = { x: anchor.x, y: anchor.y };
  lastMovePos = { x: anchor.x, y: anchor.y };
}

function fireGesture(action, now) {
  switch (action) {
    case 'click':       clickAtAnchor('left', false);  break;
    case 'rightClick':  clickAtAnchor('right', false); break;
    case 'doubleClick': clickAtAnchor('left', true);   break;
    // holdDrag / holdScroll handled in handleGestures (edge-based, not rising-edge)
  }
}

// -------------------- UI: cursor control --------------------
// Helper: update a button's text label without wiping its SVG icon child.
function setBtnLabel(btn, text) {
  // Find an existing <span> inside the button (icons are <svg>, label is <span>).
  let label = btn.querySelector('span:not(.ico)');
  if (!label) {
    label = document.createElement('span');
    btn.appendChild(label);
  }
  label.textContent = text;
}

toggleBtn.addEventListener('click', async () => {
  controlEnabled = !controlEnabled;
  await window.yonie.setControlEnabled(controlEnabled);
  toggleBtn.classList.toggle('active', controlEnabled);
  setBtnLabel(toggleBtn, controlEnabled ? t('overview.stop') : t('overview.start'));
  if (!controlEnabled) {
    if (dragActive) { try { await window.yonie.release('left'); } catch {} dragActive = false; }
    scrollMode = false;
    setMode('', '');
  }
  if (controlEnabled && !calibCenter) {
    statusEl.textContent = t('d.calib_first');
  }
});

calibrateBtn.addEventListener('click', () => {
  if (!faceLandmarker || !video.videoWidth) return;
  const result = faceLandmarker.detectForVideo(video, performance.now() + 0.001);
  if (!result.faceLandmarks || !result.faceLandmarks.length) {
    statusEl.textContent = t('d.no_face');
    return;
  }
  const lm = result.faceLandmarks[0];
  if (trackerSel.value === 'eyes') {
    const a = lm[33], b = lm[263];
    calibCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  } else {
    calibCenter = { x: lm[1].x, y: lm[1].y };
  }
  smoothed = null;
  statusEl.textContent = t('d.calibrated');
  persistSoon();
});

// Voice-triggered calibration with a 3-2-1 countdown so the user has time to
// sit upright and look straight ahead before the snapshot is taken.
let calibrationCountdown = null;
function voiceCalibrate() {
  if (calibrationCountdown) return;
  setMode(t('d.calibration'), 'precision');
  let n = 3;
  setStatus(`${t('d.calib_in')} ${n}${t('d.calib_in_look')}`, 'warn');
  calibrationCountdown = setInterval(() => {
    n -= 1;
    if (n > 0) {
      setStatus(`${t('d.calib_in')} ${n}…`, 'warn');
    } else {
      clearInterval(calibrationCountdown);
      calibrationCountdown = null;
      calibrateBtn.click();
      setTimeout(() => {
        if (!dragActive && !scrollMode && !userPaused && performance.now() >= precisionUntil) {
          setMode('', '');
        }
      }, 400);
    }
  }, 1000);
}

document.querySelectorAll('.help button[data-pane]').forEach((b) => {
  b.addEventListener('click', () => window.yonie.openSystemSettings(b.dataset.pane));
});

// -------------------- Voice typing --------------------
let recognition = null;
let mediaRecorder = null;
let recChunks = [];
let voiceActive = false;

// Local Whisper state
let audioCtx = null;
let micStream = null;
let micSource = null;
let micProcessor = null;
let pcmBuffer = []; // Float32 chunks at 16 kHz
let vad = { speakingSince: 0, silenceSince: 0, lastSampleAt: 0, voiced: false, gateMs: 0 };
const continuousVoiceEl = document.getElementById('continuousVoice');

voiceBtn.addEventListener('click', async () => {
  if (voiceActive) { stopVoice(); return; }
  const eng = voiceEngineEl.value;
  if (eng === 'local')      await startLocalWhisper();
  else if (eng === 'whisper') await startWhisper();
  else                        startWebSpeech();
});

function setVoiceUI(on) {
  voiceActive = on;
  voiceBtn.classList.toggle('active', on);
  setBtnLabel(voiceBtn, on ? t('voice.stop') : t('voice.start'));
}

function startWebSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    appendTranscript(t('d.webspeech_missing') + '\n');
    return;
  }
  recognition = new SR();
  recognition.lang = voiceLangEl.value;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (ev) => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      if (res.isFinal) {
        const text = res[0].transcript.trim();
        if (text) {
          appendTranscript(text + ' ');
          typeOrCommand(text + ' ');
        }
      }
    }
  };
  recognition.onerror = (e) => appendTranscript(tf('d.recog_err', { err: e.error }) + '\n');
  recognition.onend = () => { if (voiceActive) recognition.start(); };
  try {
    recognition.start();
    setVoiceUI(true);
  } catch (e) {
    appendTranscript(tf('d.start_fail', { err: e.message }) + '\n');
  }
}

async function startWhisper() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    recChunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (!recChunks.length) return;
      const blob = new Blob(recChunks, { type: 'audio/webm' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      const b64 = bufferToBase64(buf);
      appendTranscript(t('d.send_oai') + '\n');
      const r = await window.yonie.whisper(b64, 'audio/webm', voiceLangEl.value.split('-')[0]);
      if (r.ok) {
        appendTranscript(r.text + '\n');
        if (r.text) await typeOrCommand(r.text + ' ');
      } else {
        appendTranscript(tf('d.whisper_err', { reason: r.reason }) + '\n');
      }
    };
    mediaRecorder.start();
    setVoiceUI(true);
  } catch (e) {
    appendTranscript(tf('d.mic_unavailable', { err: e.message }) + '\n');
  }
}

// ---- Local Whisper (whisper.cpp via main process) ---------------------------------

async function startLocalWhisper() {
  // Check that the binary + model are present.
  const st = await window.yonie.whisperStatus();
  if (!st.ok) {
    if (!st.cli) {
      appendTranscript(t('d.local_no_cli') + '\n');
    } else {
      appendTranscript(tf('d.local_no_model', { path: st.modelPath }) + '\n');
    }
    return;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    // AudioContext at 16 kHz so the browser auto-resamples for us.
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    micSource = audioCtx.createMediaStreamSource(micStream);
    // ScriptProcessorNode is deprecated but works reliably in Electron Chromium.
    micProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
    micSource.connect(micProcessor);
    micProcessor.connect(audioCtx.destination);

    pcmBuffer = [];
    vad = { speakingSince: 0, silenceSince: 0, lastSampleAt: performance.now(), voiced: false, gateMs: 0 };
    const continuous = continuousVoiceEl?.checked;

    // VAD parameters
    const SILENCE_RMS = 0.012;     // below this is "silent"
    const VOICE_RMS = 0.022;       // above this counts as voiced
    const MIN_UTTER_MS = 350;      // minimum speech length to bother transcribing
    const SILENCE_TAIL_MS = 700;   // close utterance after this much trailing silence
    const MAX_UTTER_MS = 12000;    // hard cap per chunk

    micProcessor.onaudioprocess = (ev) => {
      const data = ev.inputBuffer.getChannelData(0);
      // Always accumulate (we'll trim later on flush).
      pcmBuffer.push(new Float32Array(data));

      // Compute RMS for VAD.
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      const now = performance.now();
      const dtMs = (data.length / 16000) * 1000;
      vad.lastSampleAt = now;

      if (continuous) {
        if (rms > VOICE_RMS) {
          if (!vad.voiced) { vad.voiced = true; vad.speakingSince = now - dtMs; }
          vad.silenceSince = 0;
        } else if (rms < SILENCE_RMS) {
          if (vad.voiced) {
            if (!vad.silenceSince) vad.silenceSince = now;
            const tail = now - vad.silenceSince;
            const dur = now - vad.speakingSince;
            if ((tail >= SILENCE_TAIL_MS && dur >= MIN_UTTER_MS) || dur >= MAX_UTTER_MS) {
              flushUtterance();
            }
          } else {
            // No active utterance — keep buffer small (last ~600ms as pre-roll).
            const keepSamples = Math.ceil(0.6 * 16000);
            let total = 0;
            for (const c of pcmBuffer) total += c.length;
            while (total - pcmBuffer[0].length > keepSamples) {
              total -= pcmBuffer[0].length;
              pcmBuffer.shift();
            }
          }
        }
        // Hard cap regardless of silence.
        if (vad.voiced && (now - vad.speakingSince) >= MAX_UTTER_MS) flushUtterance();
      }
    };

    setVoiceUI(true);
    appendTranscript((continuous ? t('d.local_ready_cont') : t('d.local_ready_once')) + '\n');
  } catch (e) {
    appendTranscript(tf('d.mic_unavailable', { err: e.message }) + '\n');
    teardownLocalWhisper();
  }
}

let flushing = false;
async function flushUtterance() {
  if (flushing || !pcmBuffer.length) return;
  flushing = true;

  // Snapshot and reset buffer / VAD state.
  const chunks = pcmBuffer;
  pcmBuffer = [];
  vad.voiced = false;
  vad.speakingSince = 0;
  vad.silenceSince = 0;

  // Concatenate.
  let total = 0;
  for (const c of chunks) total += c.length;
  const merged = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }

  try {
    const wav = encodeWav16k(merged);
    const b64 = bufferToBase64(wav);
    const lang = voiceLangEl.value.split('-')[0]; // ru / en / kk
    const r = await window.yonie.whisperLocal(b64, lang);
    if (r.ok && r.text) {
      const out = r.text.replace(/\s+/g, ' ').trim();
      if (out) {
        appendTranscript(out + ' ');
        await typeOrCommand(out + ' ');
      }
    } else if (!r.ok) {
      appendTranscript(tf('d.whisper_err', { reason: r.reason }) + '\n');
    }
  } catch (e) {
    appendTranscript(tf('d.send_err', { err: e.message }) + '\n');
  } finally {
    flushing = false;
  }
}

function encodeWav16k(float32) {
  // 16-bit PCM mono @ 16 kHz
  const sampleRate = 16000;
  const numSamples = float32.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  let off = 44;
  for (let i = 0; i < numSamples; i++, off += 2) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function teardownLocalWhisper() {
  try { micProcessor && micProcessor.disconnect(); } catch {}
  try { micSource && micSource.disconnect(); } catch {}
  try { audioCtx && audioCtx.close(); } catch {}
  try { micStream && micStream.getTracks().forEach((t) => t.stop()); } catch {}
  micProcessor = micSource = audioCtx = micStream = null;
  pcmBuffer = [];
}

function stopVoice() {
  if (recognition) { try { recognition.stop(); } catch {} recognition = null; }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (micProcessor) {
    // Local Whisper: flush any remaining audio (non-continuous mode), then teardown.
    const tail = pcmBuffer;
    if (tail.length) {
      // Force a flush as if utterance ended.
      vad.voiced = true;
      vad.speakingSince = performance.now() - 1000;
      flushUtterance().finally(teardownLocalWhisper);
    } else {
      teardownLocalWhisper();
    }
  }
  setVoiceUI(false);
}

function appendTranscript(s) {
  transcriptEl.textContent += s;
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function bufferToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// -------------------- Hands-free UX: use mode, hot-corners, voice commands, auto-pause --------------------

let lastFaceSeenAt = performance.now();
let faceLost = false;
let userPaused = false; // pause state explicitly toggled by user (voice/hot-corner)

function effectiveControlEnabled() {
  return controlEnabled && !userPaused && !faceLost;
}

function setStatus(text, dotClass) {
  if (statusEl) statusEl.textContent = text;
  if (compactText) compactText.textContent = text;
  if (compactDot) {
    compactDot.classList.remove('ok', 'warn', 'err');
    if (dotClass) compactDot.classList.add(dotClass);
  }
  // Update the header status pill (new design).
  const pill = document.getElementById('statusPill');
  if (pill) {
    pill.classList.remove('ok', 'warn', 'err');
    if (dotClass) pill.classList.add(dotClass);
  }
  // Update camera card glow.
  const camWrap = document.getElementById('camWrap');
  if (camWrap) {
    camWrap.classList.remove('face-ok', 'face-lost');
    if (faceLost)        camWrap.classList.add('face-lost');
    else if (diag.faceFrames > 0 && !userPaused) camWrap.classList.add('face-ok');
  }
  // Build mode badge for both compact widget and the floating bar window.
  let modeCls = '', modeText = '';
  if (userPaused)        { modeCls = 'paused'; modeText = t('d.mode_pause'); }
  else if (scrollMode)   { modeCls = 'scroll'; modeText = t('d.mode_scroll'); }
  else if (dragActive)   { modeCls = 'drag';   modeText = t('d.mode_drag'); }
  else if (faceLost)     { modeCls = '';       modeText = t('d.mode_noface'); }

  if (compactMode) {
    compactMode.className = 'compact-badge ' + modeCls;
    compactMode.textContent = modeText;
  }
  // Broadcast to the always-on-top bar window.
  try { window.yonie.barStatus({ text, dot: dotClass || '', mode: modeCls, modeText }); } catch {}
}

// ---- Use mode toggle (hide settings window; floating bar stays visible) ----
function enterUseMode(silent) {
  // Settings window hides; floating bar always remains visible at the bottom of the screen.
  if (compactEl) compactEl.hidden = true; // legacy in-window widget no longer used
  window.yonie.windowSetMode('compact');  // → main process hides mainWindow
  if (!silent) persistSoon();
  setStatus(controlEnabled ? t('d.ctrl_active') : t('d.ready_short'), controlEnabled ? 'ok' : 'warn');
}
function exitUseMode() {
  if (compactEl) compactEl.hidden = true;
  window.yonie.windowSetMode('normal');
  persistSoon();
}
if (useModeBtn) useModeBtn.addEventListener('click', () => enterUseMode(false));
const exitUseModeBtn = document.getElementById('exitUseMode');
if (exitUseModeBtn) exitUseModeBtn.addEventListener('click', () => exitUseMode());

// ---- Auto-pause when face is lost ----
function noteFaceSeen() { lastFaceSeenAt = performance.now(); if (faceLost) { faceLost = false; setStatus(t('d.face_back'), 'ok'); } }
function checkFaceLoss() {
  if (!autoPauseEl?.checked) { faceLost = false; return; }
  const since = performance.now() - lastFaceSeenAt;
  if (since > 2000 && !faceLost) {
    faceLost = true;
    // Release any held mouse button so we don't get stuck.
    if (dragActive) { dragActive = false; window.yonie.release('left'); }
    setMode('', '');
    const reason = (video.videoWidth === 0)
      ? t('d.reason_no_video')
      : (diag.detectErrors > 0 && lastDetectError)
        ? tf('d.reason_mp_err', { msg: lastDetectError.message })
        : t('d.reason_face_out');
    setStatus(tf('d.autopause', { reason }), 'warn');
  }
}
setInterval(checkFaceLoss, 500);

// ---- Hot-corners (cursor in screen corners → app actions) ----
let cornerDwell = { which: null, since: 0 };
function checkHotCorners(now, x, y) {
  if (!hotCornersEl?.checked || !smoothed) return;
  const sw = bootstrap.screen.width, sh = bootstrap.screen.height;
  const M = 30;
  let which = null;
  if (x > sw - M && y < M) which = 'TR';
  else if (x < M && y < M) which = 'TL';
  else if (x > sw - M && y > sh - M) which = 'BR';
  else if (x < M && y > sh - M) which = 'BL';
  if (which !== cornerDwell.which) cornerDwell = { which, since: now };
  if (which && now - cornerDwell.since > 1200) {
    cornerDwell = { which: null, since: 0 };
    fireCorner(which);
  }
}
async function fireCorner(which) {
  switch (which) {
    case 'TR': window.yonie.windowShow(); exitUseMode(); break;       // bring app forward
    case 'TL': togglePause(); break;                                   // pause/resume
    case 'BR': // emergency stop everything
      userPaused = true;
      if (dragActive) { dragActive = false; await window.yonie.release('left'); }
      scrollMode = false;
      setMode('', '');
      setStatus(t('d.estop'), 'err');
      break;
    case 'BL': /* reserved */ break;
  }
}
function togglePause() {
  userPaused = !userPaused;
  if (userPaused) {
    if (dragActive) { dragActive = false; window.yonie.release('left'); }
    scrollMode = false;
    setMode('', '');
    setStatus(t('d.paused'), 'warn');
  } else {
    setStatus(t('d.resumed'), 'ok');
  }
}

// ---- Voice commands ----
// "voiceMute" / "voiceListen" — отдельная пара для отключения именно ПЕЧАТИ С ГОЛОСА
// (курсор остаётся работать). "пауза" / "продолжи" по-прежнему управляют курсором.
let voiceMuted = false;

// Initial paint of the gate badge (listening state).
queueMicrotask(() => {
  const b = document.getElementById('voiceGateBadge');
  if (b) b.classList.add('listening');
});

const VOICE_COMMANDS = {
  pause:        [/^\s*пауза\b/i,        /^\s*остановись\b/i,
                  /^\s*pause\b/i,
                  /^\s*кідір/i,
                  /^\s*duraklat\b/i],
  resume:       [/^\s*продолж/i,         /^\s*старт\b/i,
                  /^\s*resume\b/i,       /^\s*start\b/i,
                  /^\s*жалғастыр/i,      /^\s*бастау\b/i,      /^\s*іске қос/i,
                  /^\s*devam\b/i,        /^\s*başla\b/i],

  // ↓ NEW: voice typing on/off
  voiceMute:    [/^\s*стоп\s*$/i,        /^\s*стой\s*$/i,        /^\s*молчи\s*$/i,
                  /^\s*хватит\s*$/i,
                  /^\s*stop\s*$/i,        /^\s*mute\s*$/i,        /^\s*shh+\s*$/i,
                  /^\s*тоқта\s*$/i,       /^\s*үндеме\s*$/i,      /^\s*тыңдама\s*$/i,
                  /^\s*dur\s*$/i,         /^\s*sus\s*$/i],
  voiceListen:  [/^\s*слушай\s*$/i,      /^\s*слышишь\s*$/i,
                  /^\s*listen\s*$/i,      /^\s*unmute\s*$/i,
                  /^\s*тыңда\s*$/i,       /^\s*тыңдашы\s*$/i,
                  /^\s*dinle\s*$/i],

  recalibrate:  [/^\s*калибровк/i,       /^\s*откалибруй/i,    /^\s*калибруй/i,
                  /^\s*центр\b/i,         /^\s*центрируй/i,
                  /^\s*recalibrate\b/i,   /^\s*recenter\b/i,    /^\s*calibrate\b/i,
                  /^\s*center\b/i,
                  /^\s*калибрле/i,        /^\s*ортаға\b/i,
                  /^\s*kalibre/i,         /^\s*merkez\b/i],
  click:        [/^\s*клик\s*$/i,        /^\s*нажми\s*$/i,
                  /^\s*click\s*$/i,
                  /^\s*бас\s*$/i,         /^\s*басу\s*$/i,      /^\s*шерт\s*$/i,
                  /^\s*tıkla\s*$/i,       /^\s*tıklat\s*$/i],
  rightClick:   [/^\s*правый клик/i,     /^\s*правая кнопка/i,
                  /^\s*right click/i,
                  /^\s*оң басу/i,         /^\s*оң шерт/i,
                  /^\s*sağ tıkla/i],
  doubleClick:  [/^\s*двойной клик/i,    /^\s*двойной\s*$/i,
                  /^\s*double click/i,
                  /^\s*екі рет басу/i,    /^\s*қос шерт/i,
                  /^\s*çift tıkla/i],
  scrollUp:     [/^\s*вверх\b/i,         /^\s*scroll up/i,
                  /^\s*жоғары\b/i,
                  /^\s*yukarı\b/i],
  scrollDown:   [/^\s*вниз\b/i,          /^\s*scroll down/i,
                  /^\s*төмен\b/i,
                  /^\s*aşağı\b/i],
  enter:        [/^\s*ввод\s*$/i,        /^\s*энтер\s*$/i,
                  /^\s*enter\s*$/i,       /^\s*return\s*$/i,
                  /^\s*енгізу\s*$/i,
                  /^\s*giriş\s*$/i],
  delete:       [/^\s*удали\s*$/i,       /^\s*стереть\s*$/i,    /^\s*бэкспейс\s*$/i,
                  /^\s*backspace\s*$/i,   /^\s*delete\s*$/i,
                  /^\s*жою\s*$/i,         /^\s*өшір\s*$/i,
                  /^\s*sil\s*$/i,         /^\s*geri sil\s*$/i],
  space:        [/^\s*пробел\s*$/i,      /^\s*space\s*$/i,
                  /^\s*бос орын\s*$/i,
                  /^\s*boşluk\s*$/i],
  showWindow:   [/^\s*покажи окно/i,     /^\s*настройки\b/i,
                  /^\s*show settings/i,
                  /^\s*параметрлер\b/i,   /^\s*терезе\b/i,
                  /^\s*ayarlar\b/i,       /^\s*pencere\b/i],
  quit:         [/^\s*вы(йти|ход)\b/i,   /^\s*закрой\b/i,
                  /^\s*quit\b/i,          /^\s*exit\b/i,
                  /^\s*шығу\b/i,
                  /^\s*çık\b/i,           /^\s*kapat\b/i],
};

// Returns the command name if matched, else null.
function parseVoiceCommand(text) {
  const t = (text || '').trim();
  if (!t) return null;
  for (const [name, regs] of Object.entries(VOICE_COMMANDS)) {
    for (const r of regs) if (r.test(t)) return name;
  }
  return null;
}

async function executeVoiceCommand(cmd) {
  appendTranscript(tf('d.cmd_log', { cmd }) + '\n');
  switch (cmd) {
    case 'pause':       userPaused = true;  setStatus(t('d.paused') + ' (voice)', 'warn'); break;
    case 'resume':      userPaused = false; setStatus(t('d.resumed'), 'ok'); break;
    case 'voiceMute':   setVoiceMuted(true);  break;
    case 'voiceListen': setVoiceMuted(false); break;
    case 'recalibrate': voiceCalibrate(); break;
    case 'click':       window.yonie.click('left'); break;
    case 'rightClick':  window.yonie.click('right'); break;
    case 'doubleClick': window.yonie.doubleClick('left'); break;
    case 'scrollUp':    window.yonie.scroll(0, -5); break;
    case 'scrollDown':  window.yonie.scroll(0, 5); break;
    case 'enter':       window.yonie.pressKey('Enter'); break;
    case 'delete':      window.yonie.pressKey('Backspace'); break;
    case 'space':       window.yonie.pressKey('Space'); break;
    case 'showWindow':  window.yonie.windowShow(); exitUseMode(); break;
    case 'quit':        window.yonie.quit(); break;
  }
}

// Update UI badge + transcript message when voice typing is muted/unmuted.
function setVoiceMuted(muted) {
  voiceMuted = muted;
  const badge = document.getElementById('voiceGateBadge');
  if (badge) {
    badge.textContent = muted ? t('voice.gate_state_muted') : t('voice.gate_state_listen');
    badge.classList.toggle('muted', muted);
    badge.classList.toggle('listening', !muted);
  }
  appendTranscript((muted ? t('d.muted') : t('d.listening')) + '\n');
}

// Hook the voice command parser into the typing pipeline.
// IMPORTANT: window.yonie is frozen (contextBridge), so we cannot mutate it.
// Instead, all voice paths call typeOrCommand() which checks for a command first.
async function typeOrCommand(text) {
  // Voice mute gate: when muted, NOTHING is typed and only "слушай / listen" is acted on.
  // Everything else gets logged to the transcript with a [muted] marker.
  if (voiceMuted) {
    const cmd = parseVoiceCommand(text);
    if (cmd === 'voiceListen') {
      await executeVoiceCommand(cmd);
      return { ok: true, command: cmd };
    }
    appendTranscript(tf('d.muted_log', { text: text.trim() }) + '\n');
    return { ok: true, muted: true };
  }

  if (voiceCommandsEl?.checked) {
    const cmd = parseVoiceCommand(text);
    if (cmd) {
      await executeVoiceCommand(cmd);
      return { ok: true, command: cmd };
    }
    // Editor / system shortcuts (save, undo, find, command palette, …)
    const ed = parseEditorCommand(text);
    if (ed) {
      if (ed.action === 'precision') {
        activatePrecision();
        appendTranscript(`[${ed.label}]\n`);
        return { ok: true, editor: ed.label };
      }
      appendTranscript(`[${ed.label}]\n`);
      await window.yonie.pressKey({ key: ed.key, modifiers: ed.mods || [] });
      return { ok: true, editor: ed.label };
    }
    // Then try app/URL launchers (открой ютуб, найди коты, открой telegram…)
    const launch = parseLaunchCommand(text);
    if (launch) {
      appendTranscript(tf('d.launch_log', { label: launch.label }) + '\n');
      await window.yonie.launch(launch.spec);
      return { ok: true, launched: launch.label };
    }
    // ---- Semantic fallback: спрашиваем локальную модель «по смыслу» ----
    const sem = await classifySemantic(text);
    if (sem) return sem;
  }
  return window.yonie.typeText(text);
}

// Локальная семантическая классификация (transformers.js / MiniLM) — фолбэк
// после промаха всех регекс-парсеров. Вызывается только если voiceCommands включены
// и пользователь не отключил semantic в настройках.
async function classifySemantic(text) {
  if (!window.yonie?.intent?.classify) return null;
  if (semanticIntentsEnabled === false) return null;
  try {
    const res = await window.yonie.intent.classify(text, {
      threshold: semanticThreshold,
      margin: 0.06,
    });
    if (!res?.ok) return null;
    const it = res.intent;
    const scoreTag = `~${(res.score * 100).toFixed(0)}%`;
    if (it.kind === 'voice') {
      appendTranscript(`[${it.intent} ${scoreTag}]\n`);
      await executeVoiceCommand(it.intent);
      return { ok: true, command: it.intent, semantic: true, score: res.score };
    }
    if (it.kind === 'editor') {
      if (it.action === 'precision') {
        activatePrecision();
        appendTranscript(`[${it.label} ${scoreTag}]\n`);
        return { ok: true, editor: it.label, semantic: true };
      }
      appendTranscript(`[${it.label} ${scoreTag}]\n`);
      await window.yonie.pressKey({ key: it.key, modifiers: it.mods || [] });
      return { ok: true, editor: it.label, semantic: true };
    }
  } catch (e) {
    console.warn('[intent] classify failed:', e);
  }
  return null;
}

// Default semantic settings (могут переопределяться из window.yonie.configGet позже).
let semanticIntentsEnabled = true;
let semanticThreshold = 0.42;

// ---- Editor / system shortcut commands -------------------------------------------
//
// Каждая команда → конкретное сочетание клавиш (через nut-js → ОС).
// Работает в любом активном приложении (VS Code, Safari, Notes, Figma, …).
// `key` использует имена nut-js (S, Z, F, Space, Left, Grave, LeftBracket…).

const EDITOR_COMMANDS = [
  // ---- Files / project ----
  { match: [/^сохрани(ть)?\b/i, /^сейв\b/i, /^save\b/i, /^сақта/i, /^kaydet/i],
    key: 'S', mods: ['cmd'], label: '💾 Save (⌘S)' },
  { match: [/^сохрани всё/i, /^save all/i, /^барлығын сақта/i, /^tümünü kaydet/i],
    key: 'S', mods: ['cmd', 'alt'], label: '💾 Save All (⌥⌘S)' },
  { match: [/^открой файл/i, /^файл\b/i, /^open file/i, /^quick open/i,
            /^файл аш/i, /^файлды аш/i, /^dosya aç/i, /^dosyayı aç/i],
    key: 'P', mods: ['cmd'], label: '📂 Quick Open (⌘P)' },
  { match: [/^команд[ау]\b/i, /^палитр[ау]/i, /^command palette/i, /^команда\s*$/i,
            /^komut/i, /^komut paleti/i, /^әмір\b/i],
    key: 'P', mods: ['cmd', 'shift'], label: '⌘ Command Palette (⇧⌘P)' },

  // ---- Edit ----
  { match: [/^отмен[аи]?\b/i, /^undo\b/i, /^болдырмау/i, /^қайтар/i, /^geri al/i],
    key: 'Z', mods: ['cmd'], label: '↶ Undo (⌘Z)' },
  { match: [/^верни?\b/i, /^повтори\b/i, /^redo\b/i, /^қайтадан/i, /^yinele/i, /^tekrar yap/i],
    key: 'Z', mods: ['cmd', 'shift'], label: '↷ Redo (⇧⌘Z)' },
  { match: [/^вырежи\b/i, /^cut\b/i, /^қию\b/i, /^kes\b/i],
    key: 'X', mods: ['cmd'], label: '✂ Cut (⌘X)' },
  { match: [/^скопируй\b/i, /^копир(уй|овать)\b/i, /^copy\b/i, /^көшір/i, /^kopyala/i],
    key: 'C', mods: ['cmd'], label: '⎘ Copy (⌘C)' },
  { match: [/^вставь\b/i, /^paste\b/i, /^қой\s*$/i, /^yapıştır/i],
    key: 'V', mods: ['cmd'], label: '⎗ Paste (⌘V)' },
  { match: [/^выдели всё/i, /^select all/i, /^барлығын таңда/i, /^tümünü seç/i],
    key: 'A', mods: ['cmd'], label: '⌷ Select All (⌘A)' },
  { match: [/^дублируй (строку|линию)/i, /^duplicate line/i, /^жолды қайтала/i, /^satırı çoğalt/i],
    key: 'Down', mods: ['shift', 'alt'], label: '↧ Duplicate line (⇧⌥↓)' },
  { match: [/^удали строку/i, /^delete line/i, /^жолды жой/i, /^satırı sil/i],
    key: 'K', mods: ['cmd', 'shift'], label: '✗ Delete line (⇧⌘K)' },
  { match: [/^комментарий\b/i, /^закомментируй\b/i, /^comment\b/i, /^toggle comment/i,
            /^түсініктеме/i, /^yorum/i],
    key: 'Slash', mods: ['cmd'], label: '// Toggle comment (⌘/)' },
  { match: [/^отступ\b/i, /^indent\b/i, /^шегініс\b/i, /^girinti/i],
    key: 'Tab', label: '→ Indent (Tab)' },
  { match: [/^разотступ\b/i, /^outdent\b/i, /^убери отступ/i, /^geri girinti/i],
    key: 'Tab', mods: ['shift'], label: '← Outdent (⇧Tab)' },

  // ---- Find / replace ----
  { match: [/^найди\b/i, /^поиск\b/i, /^find\b/i, /^тап\s*$/i, /^іздеу\b/i, /^bul\b/i, /^ara\b/i],
    key: 'F', mods: ['cmd'], label: '🔍 Find (⌘F)' },
  { match: [/^замени\b/i, /^замена\b/i, /^replace\b/i, /^алмастыр/i, /^değiştir/i],
    key: 'F', mods: ['cmd', 'alt'], label: '⇄ Replace (⌥⌘F)' },
  { match: [/^найди в файлах/i, /^find in files/i, /^global find/i,
            /^файлдардан тап/i, /^dosyalarda ara/i],
    key: 'F', mods: ['cmd', 'shift'], label: '🔍 Find in files (⇧⌘F)' },
  { match: [/^следующее( совпадение)?$/i, /^find next/i, /^келесі\s*$/i, /^sonraki\s*$/i],
    key: 'G', mods: ['cmd'], label: '↓ Next match (⌘G)' },
  { match: [/^предыдущее( совпадение)?$/i, /^find previous/i,
            /^алдыңғы\s*$/i, /^önceki\s*$/i],
    key: 'G', mods: ['cmd', 'shift'], label: '↑ Prev match (⇧⌘G)' },

  // ---- Tabs / windows ----
  { match: [/^новая вкладка/i, /^new tab/i, /^жаңа қойынды/i, /^yeni sekme/i],
    key: 'T', mods: ['cmd'], label: '➕ New tab (⌘T)' },
  { match: [/^закрой вкладку/i, /^закрой окно/i, /^close tab/i, /^close window/i,
            /^қойынды жабу/i, /^sekmeyi kapat/i, /^pencereyi kapat/i],
    key: 'W', mods: ['cmd'], label: '✕ Close tab (⌘W)' },
  { match: [/^верни вкладку/i, /^reopen tab/i, /^қойындыны қайтар/i, /^sekmeyi geri aç/i],
    key: 'T', mods: ['cmd', 'shift'], label: '↩ Reopen tab (⇧⌘T)' },
  { match: [/^следующая вкладка/i, /^next tab/i, /^келесі қойынды/i, /^sonraki sekme/i],
    key: 'Right', mods: ['cmd', 'alt'], label: '→ Next tab (⌥⌘→)' },
  { match: [/^предыдущая вкладка/i, /^prev(ious)? tab/i,
            /^алдыңғы қойынды/i, /^önceki sekme/i],
    key: 'Left', mods: ['cmd', 'alt'], label: '← Prev tab (⌥⌘←)' },
  { match: [/^следующее окно/i, /^next window/i, /^cmd tab/i,
            /^келесі терезе/i, /^sonraki pencere/i],
    key: 'Tab', mods: ['cmd'], label: '⇄ Next window (⌘Tab)' },

  // ---- Navigation ----
  { match: [/^назад\b/i, /^back\b/i, /^артқа\b/i, /^geri\b/i],
    key: 'LeftBracket', mods: ['cmd'], label: '← Back (⌘[)' },
  { match: [/^вперёд\b/i, /^вперед\b/i, /^forward\b/i, /^алға\b/i, /^ileri\b/i],
    key: 'RightBracket', mods: ['cmd'], label: '→ Forward (⌘])' },
  { match: [/^обнови\b/i, /^перезагрузи\b/i, /^reload\b/i, /^refresh\b/i,
            /^жаңарт/i, /^yenile/i],
    key: 'R', mods: ['cmd'], label: '↻ Reload (⌘R)' },

  // ---- Terminal / system ----
  { match: [/^терминал\b/i, /^консоль\b/i, /^terminal\b/i, /^toggle terminal/i],
    key: 'Grave', mods: ['ctrl'], label: '▷_ Toggle terminal (⌃`)' },
  { match: [/^spotlight\b/i, /^споt?лайт\b/i, /^прожектор\b/i],
    key: 'Space', mods: ['cmd'], label: '🔎 Spotlight (⌘Space)' },
  { match: [/^скриншот\b/i, /^screenshot\b/i, /^экран суреті/i, /^ekran görüntüsü/i],
    key: '4', mods: ['cmd', 'shift'], label: '📸 Screenshot (⇧⌘4)' },
  { match: [/^mission control/i, /^экспозе\b/i, /^экспоза\b/i],
    key: 'Up', mods: ['ctrl'], label: '🗂 Mission Control (⌃↑)' },
  { match: [/^спрячь окно/i, /^hide window/i, /^скрой окно/i,
            /^терезені жасыр/i, /^pencereyi gizle/i],
    key: 'H', mods: ['cmd'], label: '↧ Hide app (⌘H)' },

  // ---- Special: precision mode ----
  { match: [/^точно\b/i, /^точность\b/i, /^прицел\b/i, /^precision\b/i,
            /^дәл\b/i, /^нысан\b/i,
            /^hassas\b/i, /^nişan\b/i],
    action: 'precision', label: '🎯 Precision mode' },
];

function parseEditorCommand(rawText) {
  const t = normalizePhrase(rawText);
  if (!t) return null;
  for (const c of EDITOR_COMMANDS) {
    for (const r of c.match) if (r.test(t)) return c;
  }
  return null;
}

// ---- Launch (open URL / app) commands --------------------------------------------
//
// Распознаём фразы вида:
//   «открой ютуб» / «open youtube»     → https://youtube.com
//   «найди коты в шапках» / «search …» → https://google.com/search?q=…
//   «открой телеграм»                  → tg://
//   «открой <macOS app name>»          → open -a <App>
//
// Источники: единый словарь LAUNCH_TARGETS (можно расширять).

// Site / protocol shortcuts: ключ — нормализованная фраза без «открой/open»,
// значение — что отправлять в shell.openExternal.
const LAUNCH_TARGETS = [
  // browser / search
  { match: /^(браузер|сафари|safari|browser)$/i,        spec: { macApp: 'Safari' },                label: 'Safari' },
  { match: /^(хром|chrome)$/i,                          spec: { macApp: 'Google Chrome' },         label: 'Chrome' },
  { match: /^(firefox|фай[ае]рфокс|фф)$/i,              spec: { macApp: 'Firefox' },               label: 'Firefox' },
  { match: /^(arc|арк)$/i,                              spec: { macApp: 'Arc' },                   label: 'Arc' },
  { match: /^(гугл|google)$/i,                          spec: { url: 'https://google.com' },       label: 'Google' },
  { match: /^(ютуб|youtube|ютьюб)$/i,                   spec: { url: 'https://youtube.com' },      label: 'YouTube' },
  { match: /^(почт[ау]|mail|почта)$/i,                  spec: { macApp: 'Mail' },                  label: 'Mail' },
  { match: /^(gmail|джи?мейл)$/i,                       spec: { url: 'https://mail.google.com' },  label: 'Gmail' },
  { match: /^(карт[ыа]|maps|карты)$/i,                  spec: { url: 'https://maps.google.com' },  label: 'Google Maps' },
  { match: /^(переводчик|translator|translate)$/i,      spec: { url: 'https://translate.google.com' }, label: 'Translator' },
  { match: /^(github|гит\s?хаб|гитхаб)$/i,              spec: { url: 'https://github.com' },       label: 'GitHub' },
  { match: /^(twitter|x|твиттер|икс)$/i,                spec: { url: 'https://x.com' },            label: 'X / Twitter' },
  { match: /^(reddit|реддит)$/i,                        spec: { url: 'https://reddit.com' },       label: 'Reddit' },
  { match: /^(википедия|wiki(pedia)?)$/i,               spec: { url: 'https://wikipedia.org' },    label: 'Wikipedia' },
  { match: /^(stack ?overflow|стак\s?оверфло)$/i,       spec: { url: 'https://stackoverflow.com' }, label: 'StackOverflow' },
  { match: /^(chat ?gpt|чат ?гпт|gpt)$/i,               spec: { url: 'https://chat.openai.com' },  label: 'ChatGPT' },
  { match: /^(claude|клод)$/i,                          spec: { url: 'https://claude.ai' },        label: 'Claude' },

  // chat / messengers
  { match: /^(telegram|телеграм(м)?|тг)$/i,             spec: { macApp: 'Telegram' },              label: 'Telegram' },
  { match: /^(whatsapp|вотс?ап|ватсап)$/i,              spec: { macApp: 'WhatsApp' },              label: 'WhatsApp' },
  { match: /^(discord|дискорд)$/i,                      spec: { macApp: 'Discord' },               label: 'Discord' },
  { match: /^(slack|слак)$/i,                           spec: { macApp: 'Slack' },                 label: 'Slack' },
  { match: /^(zoom|зум)$/i,                             spec: { macApp: 'zoom.us' },               label: 'Zoom' },

  // media
  { match: /^(spotify|спотифай)$/i,                     spec: { macApp: 'Spotify' },               label: 'Spotify' },
  { match: /^(музыка|music|apple music|эпл\s?мьюзик)$/i, spec: { macApp: 'Music' },                label: 'Music' },
  { match: /^(netflix|нетфликс)$/i,                     spec: { url: 'https://netflix.com' },      label: 'Netflix' },

  // dev / system
  { match: /^(терминал|terminal)$/i,                    spec: { macApp: 'Terminal' },              label: 'Terminal' },
  { match: /^(iterm|айтерм)$/i,                         spec: { macApp: 'iTerm' },                 label: 'iTerm' },
  { match: /^(vs ?code|вс ?код|вэс ?код|студия|visual studio code)$/i,
                                                        spec: { macApp: 'Visual Studio Code' },    label: 'VS Code' },
  { match: /^(xcode|икскод)$/i,                         spec: { macApp: 'Xcode' },                 label: 'Xcode' },
  { match: /^(finder|файнд?ер|проводник)$/i,            spec: { macApp: 'Finder' },                label: 'Finder' },
  { match: /^(notes|заметки)$/i,                        spec: { macApp: 'Notes' },                 label: 'Notes' },
  { match: /^(reminders|напоминания)$/i,                spec: { macApp: 'Reminders' },             label: 'Reminders' },
  { match: /^(calendar|календарь)$/i,                   spec: { macApp: 'Calendar' },              label: 'Calendar' },
  { match: /^(calculator|калькулятор)$/i,               spec: { macApp: 'Calculator' },            label: 'Calculator' },
  { match: /^(system ?settings|настройки маc?ос)$/i,    spec: { macApp: 'System Settings' },       label: 'System Settings' },
];

// Strip trailing punctuation, leading/trailing spaces, common filler endings.
function normalizePhrase(s) {
  return String(s || '')
    .replace(/[«»"'`.,!?…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseLaunchCommand(rawText) {
  const text = normalizePhrase(rawText);
  if (!text) return null;

  // 1) «найди / поиск / search / google ...» / «тап / іздеу» / «ara / bul» → google search
  const searchM = text.match(/^(найди|найти|поищи|поиск|загугли|search|google|тап|іздеу|ara|bul)\s+(.{2,})$/i);
  if (searchM) {
    const q = searchM[2].trim();
    return {
      label: tf('d.search_label', { q }),
      spec: { url: 'https://www.google.com/search?q=' + encodeURIComponent(q) },
    };
  }

  // 2) «открой / запусти / open / launch / start / аш / aç <X>»
  const openM = text.match(/^(открой|открыть|запусти|запуск|включи|open|launch|start|run|аш|ашу|іске қос|aç|başlat|çalıştır)\s+(.{2,})$/i);
  if (!openM) return null;

  let target = openM[2].trim();
  // Drop common prefix words that aren't part of the app name.
  target = target.replace(/^(the|сайт|приложение|приложуху|app|application|программу|программа|сайтын|қолданба|uygulama|site|sitesi)\s+/i, '').trim();

  // 2a) Direct URL?
  if (/^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(target)) {
    const url = /^https?:\/\//i.test(target) ? target : 'https://' + target.replace(/^www\./, '');
    return { label: url, spec: { url } };
  }

  // 2b) Known shortcut from LAUNCH_TARGETS
  for (const t of LAUNCH_TARGETS) {
    if (t.match.test(target)) return { label: t.label, spec: t.spec };
  }

  // 2c) Fallback — assume macOS application name as spoken.
  const macApp = target.charAt(0).toUpperCase() + target.slice(1);
  return { label: macApp, spec: { macApp } };
}

// ---- Auto-start (hands-free boot) ----
async function autoStartAll() {
  if (!controlEnabled) {
    toggleBtn.click();
  }
  // Auto-start voice in continuous local-whisper mode if available.
  if (!voiceActive && bootstrap.hasLocalWhisper) {
    voiceEngineEl.value = 'local';
    if (continuousVoiceEl) continuousVoiceEl.checked = true;
    // Sync recognition language with the UI language if user hasn't picked one.
    if (window.i18n) {
      const map = { ru: 'ru-RU', en: 'en-US', kk: 'kk-KZ', tr: 'tr-TR' };
      const want = map[window.i18n.getLang()];
      if (want) voiceLangEl.value = want;
    }
    voiceBtn.click();
  }
  setStatus(t('d.autostart_all'), 'ok');
}

// ---- Wire face-detection + hot-corner check into the existing tick loop ----
// Monkey-patch handleFace to add face-presence + hot-corner logic on top of cursor/gestures.
const _origHandleFace = handleFace;
handleFace = function (result, now) {
  noteFaceSeen();
  if (userPaused || faceLost) return; // block movement & gestures, but keep face detection alive
  _origHandleFace.call(this, result, now);
  if (smoothed) checkHotCorners(now, smoothed.x, smoothed.y);
};
(async () => {
  try {
    await initFaceLandmarker();
    await initCamera();
    running = true;
    diag.startedAt = performance.now();
    startLoop();

    // Self-diagnose: if after 5s the camera/MediaPipe didn't produce anything, say why.
    setTimeout(() => {
      const info = diagnose();
      console.log('[yonie] diagnose:', info);
      if (diag.frames === 0) {
        statusEl.textContent = tf('d.diag_no_frames', { w: info.videoW, r: info.ready });
      } else if (diag.faceFrames === 0) {
        const tail = lastDetectError ? ` (${lastDetectError.message})` : '';
        statusEl.textContent = tf('d.diag_no_face', { n: diag.frames, e: diag.detectErrors, tail });
      } else {
        statusEl.textContent = tf('d.diag_ok', { f: diag.faceFrames, n: diag.frames, d: mpDelegate });
      }
    }, 5000);
  } catch (e) {
    statusEl.textContent = tf('d.init_err', { msg: e.message });
    console.error(e);
  }
})();

// Public diagnostic helper — call yonieDiag() from DevTools console.
function diagnose() {
  return {
    videoW: video.videoWidth,
    videoH: video.videoHeight,
    ready: video.readyState,
    streamActive: !!(currentStream && currentStream.active),
    tracks: currentStream ? currentStream.getVideoTracks().map((t) => ({
      label: t.label, enabled: t.enabled, muted: t.muted, readyState: t.readyState,
    })) : [],
    faceLandmarker: !!faceLandmarker,
    delegate: mpDelegate,
    running, controlEnabled, calibCenter, faceLost, userPaused,
    frames: diag.frames, faceFrames: diag.faceFrames,
    detectErrors: diag.detectErrors,
    lastDetectError: lastDetectError ? lastDetectError.message : null,
  };
}
window.yonieDiag = diagnose;

// ---- Live UI chips (delegate / fps / face) ----
let lastChipFrames = 0, lastChipFaceFrames = 0, lastChipAt = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = (now - lastChipAt) / 1000;
  const fps     = Math.round((diag.frames     - lastChipFrames)     / dt);
  const faceFps = Math.round((diag.faceFrames - lastChipFaceFrames) / dt);
  lastChipFrames = diag.frames;
  lastChipFaceFrames = diag.faceFrames;
  lastChipAt = now;

  const cd = document.getElementById('chipDelegate');
  const cf = document.getElementById('chipFps');
  const cF = document.getElementById('chipFace');
  if (cd) cd.textContent = `${mpDelegate || '—'}`;
  if (cf) cf.textContent = video.videoWidth
    ? `${video.videoWidth}×${video.videoHeight} · ${fps}fps`
    : t('d.chip_no_stream');
  if (cF) cF.textContent = faceFps > 0 ? tf('d.chip_face', { n: faceFps }) : t('d.chip_no_face');

  // Overview stat tiles
  const ssState = document.getElementById('stat-state');
  const ssFps   = document.getElementById('stat-fps');
  const ssModel = document.getElementById('stat-model');
  if (ssState) {
    let s = t('d.s_ready');
    if (userPaused)             s = t('d.s_paused');
    else if (faceLost)          s = t('d.s_noface');
    else if (controlEnabled)    s = t('d.s_active');
    ssState.textContent = s;
  }
  if (ssFps) ssFps.textContent = video.videoWidth ? `${faceFps}/${fps}` : '—';
  if (ssModel) ssModel.textContent = `MediaPipe · ${mpDelegate || '—'}`;

  // Keep camera card glow in sync even between explicit setStatus() calls.
  const camWrap = document.getElementById('camWrap');
  if (camWrap) {
    camWrap.classList.remove('face-ok', 'face-lost');
    if (faceLost)             camWrap.classList.add('face-lost');
    else if (faceFps > 0 && !userPaused) camWrap.classList.add('face-ok');
  }
}, 1000);

