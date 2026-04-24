#!/usr/bin/env node
// scripts/setup-whisper.js
// Verifies that whisper-cli is available and the chosen GGML model is downloaded.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const MODELS_DIR = path.join(ROOT, 'models');

const MODEL = process.env.WHISPER_MODEL || 'large-v3'; // large-v3 (best), large-v3-turbo, medium, small, base
const MODEL_FILE = `ggml-${MODEL}.bin`;
const MODEL_PATH = path.join(MODELS_DIR, MODEL_FILE);
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_FILE}`;

function ensureWhisperCli() {
  // Try PATH first.
  let r = spawnSync('which', ['whisper-cli']);
  if (r.status === 0 && r.stdout.toString().trim()) {
    console.log('✓ whisper-cli found:', r.stdout.toString().trim());
    return r.stdout.toString().trim();
  }
  // Try Homebrew default location.
  for (const p of ['/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli']) {
    if (fs.existsSync(p)) {
      console.log('✓ whisper-cli found:', p);
      return p;
    }
  }
  console.error('\n✗ whisper-cli not found.');
  console.error('  Install it with Homebrew (one command):');
  console.error('    brew install whisper-cpp\n');
  console.error('  If you do not have Homebrew yet:');
  console.error('    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"\n');
  process.exit(1);
}

function fmtBytes(n) {
  if (n > 1e9) return (n / 1e9).toFixed(2) + ' GB';
  if (n > 1e6) return (n / 1e6).toFixed(1) + ' MB';
  return (n / 1e3).toFixed(0) + ' KB';
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const tmp = dest + '.part';
    const file = fs.createWriteStream(tmp);
    let received = 0;
    let total = 0;
    let lastPct = -1;

    const req = (u) => https.get(u, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        return req(res.headers.location);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
      }
      total = parseInt(res.headers['content-length'] || '0', 10);
      console.log(`  Downloading ${path.basename(dest)} (${fmtBytes(total)})…`);
      res.on('data', (chunk) => {
        received += chunk.length;
        if (total) {
          const pct = Math.floor((received / total) * 100);
          if (pct !== lastPct && pct % 2 === 0) {
            process.stdout.write(`\r    ${pct}%  ${fmtBytes(received)} / ${fmtBytes(total)}`);
            lastPct = pct;
          }
        }
      });
      res.pipe(file);
      file.on('finish', () => file.close(() => {
        process.stdout.write('\n');
        fs.renameSync(tmp, dest);
        resolve();
      }));
    });
    req(url).on('error', reject);
  });
}

(async () => {
  ensureWhisperCli();
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

  if (fs.existsSync(MODEL_PATH)) {
    const sz = fs.statSync(MODEL_PATH).size;
    console.log(`✓ Model already present: ${MODEL_FILE} (${fmtBytes(sz)})`);
    return;
  }
  console.log(`→ Downloading model ${MODEL}…`);
  console.log(`  ${MODEL_URL}`);
  await download(MODEL_URL, MODEL_PATH);
  console.log(`✓ Model ready: ${MODEL_PATH}`);
})().catch((e) => {
  console.error('Setup failed:', e.message);
  process.exit(1);
});


