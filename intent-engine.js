'use strict';

/**
 * Локальный классификатор намерений — без внешних зависимостей.
 * Char-n-gram TF-IDF (n=3..5) + cosine, max-sim к примеру.
 * Языконезависимый, мгновенный, без моделей и нативных бинарей.
 */

const { INTENTS } = require('./intents');

const DIACRITIC_RE = /[\u0300-\u036f]/g;
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(DIACRITIC_RE, '')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NGRAM_MIN = 3;
const NGRAM_MAX = 5;

function ngrams(text) {
  const s = ` ${text} `;
  const grams = [];
  for (let n = NGRAM_MIN; n <= NGRAM_MAX; n++) {
    if (s.length < n) continue;
    for (let i = 0; i <= s.length - n; i++) grams.push(s.slice(i, i + n));
  }
  return grams;
}

function termFreqs(text) {
  const tf = new Map();
  for (const g of ngrams(text)) tf.set(g, (tf.get(g) || 0) + 1);
  for (const w of text.split(/\s+/)) {
    if (w.length < 2) continue;
    const key = `__w:${w}`;
    tf.set(key, (tf.get(key) || 0) + 2);
  }
  return tf;
}

let index = null;

function buildIndex() {
  const docs = [];
  const dfMap = new Map();
  const items = INTENTS.map((it) => ({
    intent: it.intent, kind: it.kind,
    key: it.key, mods: it.mods, action: it.action, label: it.label,
    exampleTexts: it.examples.map(normalize),
    exampleVecs: [],
  }));
  for (let i = 0; i < items.length; i++) {
    for (const ex of items[i].exampleTexts) {
      const tf = termFreqs(ex);
      docs.push({ intentIdx: i, tf });
      for (const term of tf.keys()) dfMap.set(term, (dfMap.get(term) || 0) + 1);
    }
  }
  const N = docs.length;
  const idf = new Map();
  for (const [term, df] of dfMap) idf.set(term, Math.log((N + 1) / (df + 1)) + 1);

  for (const d of docs) {
    const v = new Map();
    let norm = 0;
    for (const [term, f] of d.tf) {
      const w = (1 + Math.log(f)) * (idf.get(term) || 1);
      v.set(term, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [k, w] of v) v.set(k, w / norm);
    items[d.intentIdx].exampleVecs.push(v);
  }
  index = { idf, items };
  return index;
}

function vectorize(text) {
  const tf = termFreqs(normalize(text));
  const v = new Map();
  let norm = 0;
  for (const [term, f] of tf) {
    const idfW = index.idf.get(term);
    if (!idfW) continue;
    const w = (1 + Math.log(f)) * idfW;
    v.set(term, w);
    norm += w * w;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [k, w] of v) v.set(k, w / norm);
  return v;
}

function cosineSparse(a, b) {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let s = 0;
  for (const [k, w] of small) {
    const w2 = big.get(k);
    if (w2) s += w * w2;
  }
  return s;
}

function isReady() { return Boolean(index); }
function getStatus() {
  if (!index) return { state: 'idle', error: null };
  const totalExamples = index.items.reduce((a, it) => a + it.exampleVecs.length, 0);
  return { state: 'ready', error: null, intents: index.items.length, examples: totalExamples };
}
async function loadPipeline() {
  if (!index) buildIndex();
  return index;
}

async function classify(text, opts = {}) {
  const threshold = typeof opts.threshold === 'number' ? opts.threshold : 0.42;
  const margin = typeof opts.margin === 'number' ? opts.margin : 0.06;
  const t = String(text || '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  if (!index) buildIndex();

  const v = vectorize(t);
  if (v.size === 0) return { ok: false, reason: 'no-known-terms' };

  let best = null, bestScore = -Infinity, bestExample = '';
  let second = -Infinity;

  for (const it of index.items) {
    let intentBest = -Infinity, intentBestEx = '';
    for (let i = 0; i < it.exampleVecs.length; i++) {
      const s = cosineSparse(v, it.exampleVecs[i]);
      if (s > intentBest) { intentBest = s; intentBestEx = it.exampleTexts[i]; }
    }
    if (intentBest > bestScore) {
      second = bestScore;
      bestScore = intentBest;
      best = it;
      bestExample = intentBestEx;
    } else if (intentBest > second) {
      second = intentBest;
    }
  }

  if (!best) return { ok: false, reason: 'no-intents' };
  if (bestScore < threshold) return { ok: false, reason: 'below-threshold', score: bestScore };
  if (bestScore - second < margin) return { ok: false, reason: 'ambiguous', score: bestScore, second };

  const { exampleVecs, exampleTexts, ...rest } = best;
  return { ok: true, intent: rest, score: bestScore, second, matched: bestExample };
}

module.exports = { loadPipeline, classify, isReady, getStatus };

