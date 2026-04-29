#!/usr/bin/env node
// scripts/bundle-whisper.js
// Self-contained bundler: рекурсивно собирает whisper-cli + все dylib-зависимости из Homebrew.
// Все non-system пути перезаписываются на @executable_path/libs/<name>.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VENDOR_DIR = path.join(ROOT, 'vendor', 'whisper');
const LIBS_DIR = path.join(VENDOR_DIR, 'libs');
const SRC_CLI = process.env.WHISPER_CLI_SRC || '/opt/homebrew/bin/whisper-cli';
const HOMEBREW_PREFIX = process.env.HOMEBREW_PREFIX || '/opt/homebrew';

function isSystem(libPath) {
  return libPath.startsWith('/usr/lib/') || libPath.startsWith('/System/');
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
  return r.stdout;
}

function listDeps(binPath) {
  const out = run('otool', ['-L', binPath]);
  return out.split('\n').slice(1)
    .map((l) => l.trim()).filter(Boolean)
    .map((l) => l.replace(/\s*\(compatibility.*$/, ''));
}

function getInstallId(libPath) {
  try {
    const out = run('otool', ['-D', libPath]);
    const lines = out.split('\n').filter(Boolean);
    return lines[1] || '';
  } catch { return ''; }
}

function getRpaths(binPath) {
  const out = run('otool', ['-l', binPath]);
  const rpaths = [];
  const lines = out.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('LC_RPATH')) {
      for (let j = i; j < Math.min(i + 5, lines.length); j++) {
        const m = lines[j].match(/^\s*path\s+(.+?)\s+\(offset/);
        if (m) { rpaths.push(m[1]); break; }
      }
    }
  }
  return rpaths;
}

function resolveRpath(rel, rpaths) {
  const name = rel.replace(/^@rpath\//, '');
  for (const rp of rpaths) {
    const candidate = path.join(rp, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  const guesses = [
    path.join(HOMEBREW_PREFIX, 'opt', 'whisper-cpp', 'lib', name),
    path.join(HOMEBREW_PREFIX, 'opt', 'ggml', 'lib', name),
    path.join(HOMEBREW_PREFIX, 'lib', name),
  ];
  for (const g of guesses) if (fs.existsSync(g)) return g;
  throw new Error(`Cannot resolve ${rel}`);
}

const visited = new Set();
const queue = [];

function processBinary(binSrc, binDst) {
  const rpaths = getRpaths(binSrc);
  const deps = listDeps(binSrc);
  const ownId = getInstallId(binSrc);

  for (const dep of deps) {
    if (isSystem(dep)) continue;
    if (dep === ownId) {
      const newId = `@executable_path/libs/${path.basename(dep)}`;
      run('install_name_tool', ['-id', newId, binDst]);
      continue;
    }

    let absSrc;
    if (dep.startsWith('@rpath/')) absSrc = resolveRpath(dep, rpaths);
    else if (dep.startsWith('/')) absSrc = dep;
    else throw new Error(`Unknown dep form: ${dep}`);

    const libName = path.basename(absSrc);
    const libDst = path.join(LIBS_DIR, libName);
    if (!visited.has(libName)) {
      visited.add(libName);
      const realSrc = fs.realpathSync(absSrc);
      fs.copyFileSync(realSrc, libDst);
      fs.chmodSync(libDst, 0o755);
      console.log(`  + ${libName}`);
      queue.push({ src: realSrc, dst: libDst });
    }

    const newRef = `@executable_path/libs/${libName}`;
    run('install_name_tool', ['-change', dep, newRef, binDst]);
  }
}

(function main() {
  if (!fs.existsSync(SRC_CLI)) {
    console.error(`✗ whisper-cli not found at ${SRC_CLI}. brew install whisper-cpp`);
    process.exit(1);
  }
  fs.rmSync(VENDOR_DIR, { recursive: true, force: true });
  fs.mkdirSync(LIBS_DIR, { recursive: true });

  const dstCli = path.join(VENDOR_DIR, 'whisper-cli');
  fs.copyFileSync(SRC_CLI, dstCli);
  fs.chmodSync(dstCli, 0o755);
  console.log('→ copied whisper-cli');

  console.log('→ resolving deps…');
  processBinary(SRC_CLI, dstCli);
  while (queue.length) {
    const item = queue.shift();
    processBinary(item.src, item.dst);
    spawnSync('codesign', ['--force', '--sign', '-', item.dst], { stdio: 'ignore' });
  }
  spawnSync('codesign', ['--force', '--sign', '-', dstCli], { stdio: 'ignore' });

  // Скопировать ggml backend-плагины (.so), которые ggml загружает через dlopen
  // (CPU/Metal/BLAS). На пользовательской машине зашитый homebrew-путь будет
  // отсутствовать, поэтому рантайм должен выставлять GGML_BACKEND_PATH=<libs>.
  console.log('→ copying ggml backend plugins (.so)…');
  const ggmlLibexec = path.join(HOMEBREW_PREFIX, 'opt', 'ggml', 'libexec');
  if (fs.existsSync(ggmlLibexec)) {
    for (const f of fs.readdirSync(ggmlLibexec)) {
      if (!f.endsWith('.so')) continue;
      const src = path.join(ggmlLibexec, f);
      const dst = path.join(LIBS_DIR, f);
      fs.copyFileSync(fs.realpathSync(src), dst);
      fs.chmodSync(dst, 0o755);
      // У этих плагинов тоже есть зависимости от libggml-base и системных — обработаем
      processBinary(src, dst);
      spawnSync('codesign', ['--force', '--sign', '-', dst], { stdio: 'ignore' });
      console.log(`  + ${f}`);
    }
  } else {
    console.warn(`  (no ggml libexec at ${ggmlLibexec} — пропускаю)`);
  }

  console.log('\n→ otool -L on bundled binary:');
  spawnSync('otool', ['-L', dstCli], { stdio: 'inherit' });
  console.log(`\n✓ vendor/whisper ready (${fs.readdirSync(LIBS_DIR).length} libs).`);
})();


