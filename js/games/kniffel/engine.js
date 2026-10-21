// Kniffel: Regeln, Wertung und Computer (Erwartungswert über die verbleibenden Würfe).
export const CATS = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'three', 'four', 'full', 'small', 'large', 'kniffel', 'chance'];
export const UPPER = CATS.slice(0, 6);
export const LOWER = CATS.slice(6);
export const CAT_NAME = {
  ones: 'Einer', twos: 'Zweier', threes: 'Dreier', fours: 'Vierer', fives: 'Fünfer', sixes: 'Sechser',
  three: 'Dreierpasch', four: 'Viererpasch', full: 'Full House', small: 'Kleine Straße', large: 'Große Straße', kniffel: 'Kniffel', chance: 'Chance',
};
export const CAT_HINT = {
  ones: 'Summe aller Einser', twos: 'Summe aller Zweier', threes: 'Summe aller Dreier', fours: 'Summe aller Vierer', fives: 'Summe aller Fünfer', sixes: 'Summe aller Sechser',
  three: 'Drei gleiche – alle Augen zählen', four: 'Vier gleiche – alle Augen zählen', full: 'Drei + zwei gleiche: 25',
  small: 'Vier in Folge: 30', large: 'Fünf in Folge: 40', kniffel: 'Fünf gleiche: 50', chance: 'Alle Augen zählen',
};
export const FACE = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
// Durchschnittswerte bei guter Spielweise – „was ein Feld später noch wert wäre“
export const BASE = { ones: 1.9, twos: 5.3, threes: 8.6, fours: 12.2, fives: 15.7, sixes: 19.2, three: 21.7, four: 13.1, full: 22.6, small: 29.5, large: 32.7, kniffel: 16.9, chance: 22.0 };

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
    case 'kniffel': return mx === 5 ? 50 : 0;
    case 'chance': return sumC(c);
  }
  return 0;
}
export const scoreFor = (cat, dice, joker) => scoreC(cat, countsOf(dice), joker);
export const isKniffel = dice => dice.length === 5 && dice.every(d => d === dice[0]);

// ---------------------------------------------------------------
// Spiel
// ---------------------------------------------------------------
export function newGame(players, opts = {}) {
  return {
    players: players.map(p => ({ ...p })),
    sheets: players.map(() => Object.fromEntries(CATS.map(c => [c, null]))),
    extra: players.map(() => 0),     // weitere Kniffel (je 50 Bonus)
    turn: 0, round: 1,
    dice: [1, 2, 3, 4, 5], held: [false, false, false, false, false], rollsLeft: 3,
    phase: 'roll', opts: { joker: opts.joker !== false }, log: [],
  };
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
  return s.opts.joker && isKniffel(s.dice) && s.sheets[p].kniffel !== null;
}

export function options(s, p = s.turn) {
  const joker = jokerActive(s, p);
  const c = countsOf(s.dice);
  return CATS.filter(cat => s.sheets[p][cat] === null).map(cat => ({ cat, score: scoreC(cat, c, joker) }));
}

export function enter(s, cat) {
  const p = s.turn;
  if (!hasRolled(s)) throw new Error('erst würfeln');
  if (s.sheets[p][cat] !== null) throw new Error('Feld schon belegt');
  const joker = jokerActive(s, p);
  if (s.opts.joker && isKniffel(s.dice) && s.sheets[p].kniffel === 50) s.extra[p]++;
  const v = scoreC(cat, countsOf(s.dice), joker);
  s.sheets[p][cat] = v;
  s.log.push({ p, cat, v, dice: s.dice.slice() });
  // nächster Spieler
  s.held = [false, false, false, false, false];
  s.rollsLeft = 3;
  s.turn = (p + 1) % s.players.length;
  if (s.turn === 0) s.round++;
  if (s.sheets.every(sh => CATS.every(c => sh[c] !== null))) { s.phase = 'done'; s.round = 13; }
  return v;
}

export function totals(s, p) {
  const sh = s.sheets[p];
  const upper = UPPER.reduce((a, c) => a + (sh[c] || 0), 0);
  const bonus = upper >= 63 ? 35 : 0;
  const lower = LOWER.reduce((a, c) => a + (sh[c] || 0), 0);
  const extra = s.extra[p] * 50;
  return { upper, bonus, lower, extra, total: upper + bonus + lower + extra };
}

// Ist der Bonus (63 oben) noch erreichbar?
export function bonusReachable(sh) {
  let have = 0, max = 0;
  for (const c of UPPER) { if (sh[c] !== null) have += sh[c]; else max += FACE[c] * 5; }
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
  const open = CATS.filter(c => sh[c] === null);
  const upperHave = UPPER.reduce((a, c) => a + (sh[c] || 0), 0);
  const reach = upperHave < 63 && bonusReachable(sh);
  const bw = level === 'leicht' ? 0.05 : level === 'mittel' ? 0.25 : 0.6;
  const kniffel50 = sh.kniffel === 50 && s.opts.joker;
  const kniffelFilled = sh.kniffel !== null && s.opts.joker;
  const turnsLeft = open.length;
  return function value(c) {
    const isK = maxC(c) === 5;
    const joker = isK && kniffelFilled;
    let best = -Infinity, bestCat = null;
    for (const cat of open) {
      const sc = scoreC(cat, c, joker);
      let v = sc - BASE[cat] * (turnsLeft > 1 ? 1 : 0);
      const f = FACE[cat];
      if (f && reach) {
        v += (sc - 3 * f) * bw;
        if (upperHave + sc >= 63) v += level === 'schwer' ? 22 : level === 'mittel' ? 8 : 0;
      }
      if (cat === 'kniffel' && sc === 50) v += 8;
      if (v > best) { best = v; bestCat = cat; }
    }
    if (isK && kniffel50) best += 50;
    return { v: best, cat: bestCat };
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
  if (s.rollsLeft === 0) return { action: 'enter', cat: now.cat, value: now.v };
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
  if (now.v >= best.e - 1e-9 || best.n === 0) return { action: 'enter', cat: now.cat, value: now.v, rollValue: best.e };
  return { action: 'roll', keep: best.k, e: best.e, now: now.v, nowCat: now.cat, all };
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
    if (x < 0.15) return { action: 'enter', cat: pl.nowCat };
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
    if (sh.kniffel === null || sh.kniffel === 50) goals.push('Kniffel');
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
