// Würfelpoker: Regeln, Wertung und Computer (Erwartungswert über die verbleibenden Würfe).
export const CATS = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'three', 'four', 'full', 'small', 'large', 'poker', 'chance'];
export const UPPER = CATS.slice(0, 6);
export const LOWER = CATS.slice(6);
export const CAT_NAME = {
  ones: 'Einer', twos: 'Zweier', threes: 'Dreier', fours: 'Vierer', fives: 'Fünfer', sixes: 'Sechser',
  three: 'Dreierpasch', four: 'Viererpasch', full: 'Full House', small: 'Kleine Straße', large: 'Große Straße', poker: 'Poker', chance: 'Chance',
};
export const CAT_HINT = {
  ones: 'Summe aller Einser', twos: 'Summe aller Zweier', threes: 'Summe aller Dreier', fours: 'Summe aller Vierer', fives: 'Summe aller Fünfer', sixes: 'Summe aller Sechser',
  three: 'Drei gleiche – alle Augen zählen', four: 'Vier gleiche – alle Augen zählen', full: 'Drei + zwei gleiche: 25',
  small: 'Vier in Folge: 30', large: 'Fünf in Folge: 40', poker: 'Fünf gleiche: 50', chance: 'Alle Augen zählen',
};
export const FACE = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
// Durchschnittswerte bei guter Spielweise – „was ein Feld später noch wert wäre“
export const BASE = { ones: 1.9, twos: 5.3, threes: 8.6, fours: 12.2, fives: 15.7, sixes: 19.2, three: 21.7, four: 13.1, full: 22.6, small: 29.5, large: 32.7, poker: 16.9, chance: 22.0 };

export function countsOf(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}
const sumC = c => c[1] + 2 * c[2] + 3 * c[3] + 4 * c[4] + 5 * c[5] + 6 * c[6];
const maxC = c => Math.max(c[1], c[2], c[3], c[4], c[5], c[6]);
const hasRun = (c, from, len) => { for (let i = from; i < from + len; i++) if (!c[i]) return false; return true; };

export function scoreC(cat, c, joker = false) {
  const f = FACE[cat];
  if (f) return c[f] * f;
  const mx = maxC(c);
  switch (cat) {
    case 'three': return mx >= 3 ? sumC(c) : 0;
    case 'four': return mx >= 4 ? sumC(c) : 0;
    case 'full': return joker || (mx === 3 && c.some((x, i) => i && x === 2)) ? 25 : 0;
    case 'small': return joker || hasRun(c, 1, 4) || hasRun(c, 2, 4) || hasRun(c, 3, 4) ? 30 : 0;
    case 'large': return joker || hasRun(c, 1, 5) || hasRun(c, 2, 5) ? 40 : 0;
    case 'poker': return mx === 5 ? 50 : 0;
    case 'chance': return sumC(c);
  }
  return 0;
}
export const scoreFor = (cat, dice, joker) => scoreC(cat, countsOf(dice), joker);
export const isPoker = dice => dice.length === 5 && dice.every(d => d === dice[0]);

// ---------------------------------------------------------------
// Spiel. Dreifach-Variante: drei Spalten (×1, ×2, ×3), jede Runde ein Feld in einer beliebigen Spalte.
// Feldschlüssel: 'ones' (Spalte 1), 'ones1' (Spalte 2), 'ones2' (Spalte 3).
// ---------------------------------------------------------------
export const colKey = (cat, k) => (k ? cat + k : cat);
export const nCols = s => (s.opts && s.opts.triple ? 3 : 1);
export const allKeys = s => CATS.flatMap(c => [...Array(nCols(s)).keys()].map(k => colKey(c, k)));
export const roundsTotal = s => 13 * nCols(s);
const anyCol = (s, sh, f) => [...Array(nCols(s)).keys()].some(k => f(sh[colKey('poker', k)]));

export function newGame(players, opts = {}) {
  const g = {
    players: players.map(p => ({ ...p })),
    extra: players.map(() => 0),     // weitere Poker (je 50 Bonus)
    turn: 0, round: 1,
    dice: [1, 2, 3, 4, 5], held: [false, false, false, false, false], rollsLeft: 3,
    phase: 'roll', opts: { joker: opts.joker !== false, triple: !!opts.triple }, log: [],
  };
  g.sheets = players.map(() => Object.fromEntries(allKeys(g).map(c => [c, null])));
  return g;
}

export function roll(s, rnd = Math.random) {
  if (s.phase !== 'roll' || s.rollsLeft <= 0) throw new Error('kein Wurf mehr');
  if (s.rollsLeft === 3) s.held = [false, false, false, false, false];
  s.dice = s.dice.map((d, i) => (s.held[i] ? d : 1 + Math.floor(rnd() * 6)));
  s.rollsLeft--;
  return s.dice;
}

export const hasRolled = s => s.rollsLeft < 3;

export function jokerActive(s, p = s.turn) {
  return s.opts.joker && isPoker(s.dice) && anyCol(s, s.sheets[p], v => v !== null);
}

export function options(s, p = s.turn) {
  const joker = jokerActive(s, p);
  const c = countsOf(s.dice);
  const res = [];
  for (let k = 0; k < nCols(s); k++) for (const cat of CATS) if (s.sheets[p][colKey(cat, k)] === null) res.push({ cat, col: k, key: colKey(cat, k), score: scoreC(cat, c, joker) });
  return res;
}

export function enter(s, cat, col = 0) {
  const p = s.turn;
  const key = colKey(cat, col);
  if (!hasRolled(s)) throw new Error('erst würfeln');
  if (s.sheets[p][key] !== null) throw new Error('Feld schon belegt');
  const joker = jokerActive(s, p);
  if (s.opts.joker && isPoker(s.dice) && anyCol(s, s.sheets[p], v => v === 50)) s.extra[p]++;
  const v = scoreC(cat, countsOf(s.dice), joker);
  s.sheets[p][key] = v;
  s.log.push({ p, cat, col, v, dice: s.dice.slice() });
  // nächster Spieler
  s.held = [false, false, false, false, false];
  s.rollsLeft = 3;
  s.turn = (p + 1) % s.players.length;
  if (s.turn === 0) s.round++;
  if (s.sheets.every(sh => allKeys(s).every(c => sh[c] !== null))) { s.phase = 'done'; s.round = roundsTotal(s); }
  return v;
}

function colTotals(sh, k) {
  const upper = UPPER.reduce((a, c) => a + (sh[colKey(c, k)] || 0), 0);
  const bonus = upper >= 63 ? 35 : 0;
  const lower = LOWER.reduce((a, c) => a + (sh[colKey(c, k)] || 0), 0);
  return { upper, bonus, lower, sum: upper + bonus + lower, mult: k + 1 };
}

export function totals(s, p) {
  const sh = s.sheets[p];
  const cols = [...Array(nCols(s)).keys()].map(k => colTotals(sh, k));
  const extra = s.extra[p] * 50;
  const total = cols.reduce((a, c) => a + c.sum * c.mult, 0) + extra;
  return { upper: cols[0].upper, bonus: cols[0].bonus, lower: cols[0].lower, extra, total, cols };
}

// Ist der Bonus (63 oben) in Spalte k noch erreichbar?
export function bonusReachable(sh, k = 0) {
  let have = 0, max = 0;
  for (const c of UPPER) { const v = sh[colKey(c, k)]; if (v !== null && v !== undefined) have += v; else max += FACE[c] * 5; }
  return have >= 63 || have + max >= 63;
}

// ---------------------------------------------------------------
// Computer
// ---------------------------------------------------------------
const keyOf = c => c[1] + c[2] * 6 + c[3] * 36 + c[4] * 216 + c[5] * 1296 + c[6] * 7776;

// Ausgänge für n neu geworfene Würfel: [{ c, p }]
const DIST = (() => {
  const res = [];
  for (let n = 0; n <= 5; n++) {
    const m = new Map();
    const total = 6 ** n;
    for (let x = 0; x < total; x++) {
      const c = [0, 0, 0, 0, 0, 0, 0];
      let y = x;
      for (let k = 0; k < n; k++) { c[1 + (y % 6)]++; y = Math.floor(y / 6); }
      const k = keyOf(c);
      const e = m.get(k);
      if (e) e.p += 1 / total; else m.set(k, { c, p: 1 / total });
    }
    res.push([...m.values()]);
  }
  return res;
})();

function keepsOf(c) {
  const res = [];
  const k = [0, 0, 0, 0, 0, 0, 0];
  const rec = i => {
    if (i === 7) { res.push(k.slice()); return; }
    for (let v = 0; v <= c[i]; v++) { k[i] = v; rec(i + 1); }
    k[i] = 0;
  };
  rec(1);
  return res;
}

// Wert eines Eintrags für den Computer (Punkte minus das, was das Feld später im Schnitt brächte)
export function makeValuer(s, p, level = 'mittel') {
  const sh = s.sheets[p];
  const cols = [...Array(nCols(s)).keys()];
  const open = [];
  for (const k of cols) for (const cat of CATS) if (sh[colKey(cat, k)] === null) open.push({ cat, k });
  const upperHave = cols.map(k => UPPER.reduce((a, c) => a + (sh[colKey(c, k)] || 0), 0));
  const reach = cols.map(k => upperHave[k] < 63 && bonusReachable(sh, k));
  const bw = level === 'leicht' ? 0.05 : level === 'mittel' ? 0.25 : 0.6;
  const poker50 = s.opts.joker && anyCol(s, sh, v => v === 50);
  const pokerFilled = s.opts.joker && anyCol(s, sh, v => v !== null);
  const turnsLeft = open.length;
  return function value(c) {
    const isK = maxC(c) === 5;
    const joker = isK && pokerFilled;
    let best = -Infinity, bestCat = null, bestCol = 0;
    for (const { cat, k } of open) {
      const sc = scoreC(cat, c, joker);
      const m = k + 1;
      let v = sc - BASE[cat] * (turnsLeft > 1 ? 1 : 0);
      const f = FACE[cat];
      if (f && reach[k]) {
        v += (sc - 3 * f) * bw;
        if (upperHave[k] + sc >= 63) v += level === 'schwer' ? 22 : level === 'mittel' ? 8 : 0;
      }
      if (cat === 'poker' && sc === 50) v += 8;
      v *= m;
      if (v > best) { best = v; bestCat = cat; bestCol = k; }
    }
    if (isK && poker50) best += 50;
    return { v: best, cat: bestCat, col: bestCol };
  };
}

// Bester Plan: Halten (Zählvektor) oder sofort eintragen
export function plan(s, level = 'mittel') {
  const p = s.turn;
  const valuer = makeValuer(s, p, level);
  const memo = new Map();
  const maxR = level === 'leicht' ? 1 : 2;
  function E(c, r) {
    const key = keyOf(c) * 3 + r;
    const m = memo.get(key);
    if (m !== undefined) return m;
    let res;
    if (r === 0) res = valuer(c).v;
    else {
      res = -Infinity;
      for (const k of keepsOf(c)) {
        const n = 5 - (k[1] + k[2] + k[3] + k[4] + k[5] + k[6]);
        let e = 0;
        for (const o of DIST[n]) {
          const t = [0, k[1] + o.c[1], k[2] + o.c[2], k[3] + o.c[3], k[4] + o.c[4], k[5] + o.c[5], k[6] + o.c[6]];
          e += o.p * E(t, r - 1);
        }
        if (e > res) res = e;
      }
    }
    memo.set(key, res);
    return res;
  }
  const c = countsOf(s.dice);
  const now = valuer(c);
  if (s.rollsLeft === 0) return { action: 'enter', cat: now.cat, col: now.col, value: now.v };
  const r = Math.min(s.rollsLeft, maxR);
  let best = { k: null, e: -Infinity };
  const all = [];
  for (const k of keepsOf(c)) {
    const n = 5 - (k[1] + k[2] + k[3] + k[4] + k[5] + k[6]);
    let e = 0;
    for (const o of DIST[n]) {
      const t = [0, k[1] + o.c[1], k[2] + o.c[2], k[3] + o.c[3], k[4] + o.c[4], k[5] + o.c[5], k[6] + o.c[6]];
      e += o.p * E(t, r - 1);
    }
    all.push({ k, e, n });
    if (e > best.e) best = { k, e, n };
  }
  if (now.v >= best.e - 1e-9 || best.n === 0) return { action: 'enter', cat: now.cat, col: now.col, value: now.v, rollValue: best.e };
  return { action: 'roll', keep: best.k, e: best.e, now: now.v, nowCat: now.cat, nowCol: now.col, all };
}

// Haltevektor → welche Würfel (Indizes) gehalten werden
export function holdsFor(dice, keep) {
  const k = keep.slice();
  return dice.map(d => { if (k[d] > 0) { k[d]--; return true; } return false; });
}

export function aiStep(s, level = 'mittel', rnd = Math.random) {
  if (!hasRolled(s)) return { action: 'roll' };
  const pl = plan(s, level);
  if (level === 'leicht' && pl.action === 'roll') {
    // gelegentlich zu früh eintragen oder planlos halten
    const x = rnd();
    if (x < 0.15) return { action: 'enter', cat: pl.nowCat, col: pl.nowCol };
    if (x < 0.4) { const k = [0, 0, 0, 0, 0, 0, 0]; for (const d of s.dice) if (rnd() < 0.5) k[d]++; return { action: 'roll', keep: k }; }
  }
  return pl;
}

// Erklärung eines Halte-Vorschlags
export function explainKeep(dice, keep, s) {
  const kept = [];
  for (let f = 1; f <= 6; f++) for (let i = 0; i < keep[f]; i++) kept.push(f);
  const n = kept.length;
  if (!n) return 'Nichts Brauchbares dabei – alle Würfel neu werfen.';
  const c = keep;
  const mx = Math.max(...c.slice(1));
  const face = c.indexOf(mx);
  const distinct = c.filter((x, i) => i && x).length;
  const sh = s.sheets[s.turn];
  if (mx >= 2 && distinct === 1) {
    const goals = [];
    if (sh[UPPER[face - 1]] === null) goals.push(CAT_NAME[UPPER[face - 1]]);
    if (sh.three === null && mx < 3) goals.push('Dreierpasch');
    if (sh.four === null) goals.push('Viererpasch');
    if (sh.poker === null || sh.poker === 50 || (nCols(s) > 1 && (sh.poker1 === null || sh.poker2 === null))) goals.push('Poker');
    return `Sammle ${face}er: Mit ${mx} gleichen bist du auf dem Weg zu ${goals.slice(0, 3).join(', ') || 'einem Pasch'}.`;
  }
  if (distinct === n && n >= 3) {
    const run = kept.join('-');
    return `Halte ${run} für eine Straße${sh.large === null ? ' – die große bringt 40 Punkte' : ''}.`;
  }
  if (mx === 3 && distinct === 2) return 'Ein Full House fehlt noch – halte Drilling und Paar.';
  if (mx === 2 && distinct === 2 && n === 4) return 'Zwei Paare: Ein passender Würfel macht das Full House (1 zu 3 pro Wurf).';
  return `Halte ${kept.join(', ')} – das ergibt im Schnitt die meisten Punkte.`;
}
