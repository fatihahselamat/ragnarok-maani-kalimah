import { WORDS, zoneWords } from './data.js';

export const MAX_LV = 20;
export const xpNeed = (lv) => 40 + lv * 25;
export const hpMax = (lv) => 60 + lv * 10;

const shuffle = (a) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Pilih kalimah dalam zon, utamakan yang belum dikuasai.
export function pickWord(zoneId, prog = {}) {
  const pool = zoneWords(zoneId);
  if (!pool.length) return null;
  const weights = pool.map((w) => {
    const p = prog[w.ar] || {};
    return 3 - Math.min(2, p.c || 0) + (p.w ? 1 : 0);
  });
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}

export function makeQuestion(word, opts = {}) {
  const type = Math.random() < 0.7 ? 'w2m' : 'm2w';
  const key = type === 'w2m' ? 'mean' : 'ar';
  const correct = word[key];
  const same = shuffle(WORDS.filter((w) => w.zone === word.zone && w.ar !== word.ar));
  const other = shuffle(WORDS.filter((w) => w.zone !== word.zone));
  const seen = new Set([correct]);
  const wrong = [];
  for (const w of [...same, ...other]) {
    if (!seen.has(w[key])) {
      seen.add(w[key]);
      wrong.push(w[key]);
    }
    if (wrong.length >= (opts.reduce ? 2 : 3)) break;
  }
  const options = shuffle([{ text: correct, ok: true }, ...wrong.map((t) => ({ text: t, ok: false }))]);
  return {
    type,
    prompt: type === 'w2m' ? word.ar : word.mean,
    options,
    answer: correct,
    word,
  };
}
