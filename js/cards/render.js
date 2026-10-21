// Darstellung von Spielkarten (französisches Blatt mit deutschen Bildbezeichnungen).
// Karten-Kürzel: Farbe C S H D (X = Joker) + Wert 2–9, T, J, Q, K, A.

export const SUIT_NAME = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo', X: 'Joker' };
export const RANK_LABEL = { T: '10', J: 'B', Q: 'D', K: 'K', A: 'A', X: '' };
export const RANK_NAME = { '2': 'Zwei', '3': 'Drei', '4': 'Vier', '5': 'Fünf', '6': 'Sechs', '7': 'Sieben', '8': 'Acht', '9': 'Neun', T: 'Zehn', J: 'Bube', Q: 'Dame', K: 'König', A: 'Ass', X: 'Joker' };

export const suitOf = c => c[0];
export const rankOf = c => c[1];
export const isRed = c => c[0] === 'H' || c[0] === 'D';

export function label(c) {
  const r = rankOf(c);
  return RANK_LABEL[r] ?? r;
}

export function cardName(c) {
  if (suitOf(c) === 'X') return 'Joker';
  return `${SUIT_NAME[suitOf(c)]}-${RANK_NAME[rankOf(c)]}`;
}

// Kurzschreibweise für Texte mit SVG-Symbol
export function cardHtml(c) {
  const s = suitOf(c);
  if (s === 'X') return '<b>Joker</b>';
  const cls = isRed(c) ? 'r' : 'b';
  return `<b class="${cls === 'r' ? 'red' : ''}" style="white-space:nowrap"><svg class="suit ${cls}" viewBox="0 0 100 100"><use href="#s-${s}"/></svg>${label(c)}</b>`;
}

const use = (s, extra = '') => `<svg viewBox="0 0 100 100" aria-hidden="true"${extra}><use href="#s-${s}"/></svg>`;

// Klassische Anordnung der Augen (x, y in Prozent der Bildfläche)
const L = 0, M = 50, R = 100;
const PIPS = {
  2: [[M, 0], [M, 100]],
  3: [[M, 0], [M, 50], [M, 100]],
  4: [[L, 0], [R, 0], [L, 100], [R, 100]],
  5: [[L, 0], [R, 0], [M, 50], [L, 100], [R, 100]],
  6: [[L, 0], [R, 0], [L, 50], [R, 50], [L, 100], [R, 100]],
  7: [[L, 0], [R, 0], [M, 25], [L, 50], [R, 50], [L, 100], [R, 100]],
  8: [[L, 0], [R, 0], [M, 25], [L, 50], [R, 50], [M, 75], [L, 100], [R, 100]],
  9: [[L, 0], [R, 0], [L, 33.3], [R, 33.3], [M, 50], [L, 66.7], [R, 66.7], [L, 100], [R, 100]],
  10: [[L, 0], [R, 0], [M, 16.7], [L, 33.3], [R, 33.3], [L, 66.7], [R, 66.7], [M, 83.3], [L, 100], [R, 100]],
};
const NUM = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10 };

export function cardEl(c, { w, faceDown = false, cls = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'card ' + cls;
  if (w) el.style.setProperty('--cw', w + 'px');
  if (faceDown || !c) {
    el.classList.add('back');
    el.setAttribute('aria-label', 'Verdeckte Karte');
    return el;
  }
  el.dataset.card = c;
  const s = suitOf(c), r = rankOf(c);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', cardName(c));
  if (s === 'X') {
    el.classList.add('joker', 'red');
    el.innerHTML = `<div class="idx"><b>J</b>${use('X')}</div><div class="court joker-face"><div class="half">${use('X')}<b>JOKER</b></div></div><div class="idx bot"><b>J</b>${use('X')}</div>`;
    return el;
  }
  if (isRed(c)) el.classList.add('red');
  const lab = label(c);
  const idx = `<b>${lab}</b>${use(s)}`;
  let center;
  if (r === 'J' || r === 'Q' || r === 'K') {
    const half = `<div class="half"><b>${lab}</b>${use(s)}</div>`;
    center = `<div class="court r-${r}">${half}${half.replace('class="half"', 'class="half flip"')}</div>`;
  } else if (r === 'A') {
    center = `<div class="pips ace">${use(s, ' style="left:50%;top:50%"')}</div>`;
  } else {
    const n = NUM[r] || 1;
    center = `<div class="pips">${(PIPS[n] || [[M, 50]]).map(([x, y]) => use(s, ` style="left:${x}%;top:${y}%"${y > 55 ? ' class="flip"' : ''}`)).join('')}</div>`;
  }
  el.innerHTML = `<div class="idx">${idx}</div>${center}<div class="idx bot">${idx}</div>`;
  return el;
}

// Berechnet Überlappung, damit n Karten in die verfügbare Breite passen.
export function fitHand(n, avail, maxW = 64, minVisible = 24) {
  let w = Math.min(maxW, Math.max(40, avail / 5.2));
  if (n <= 1) return { w, ov: 0 };
  // sichtbarer Streifen je Karte
  let strip = (avail - w) / (n - 1);
  strip = Math.min(strip, w * 0.78);
  if (strip < minVisible) {
    // Karten verkleinern
    w = Math.max(38, avail - minVisible * (n - 1));
    w = Math.min(w, maxW);
    strip = Math.max(14, (avail - w) / (n - 1));
  }
  return { w: Math.round(w), ov: Math.round(strip - w) };
}
