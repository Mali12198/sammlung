// Farbreihen: vier Farbreihen ankreuzen. Rot/Gelb von 2 bis 12, Grün/Blau von 12 bis 2.
export const COLORS = ['r', 'y', 'g', 'b'];
export const COLOR_NAME = { r: 'Rot', y: 'Gelb', g: 'Grün', b: 'Blau' };
export const ROW = {
  r: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], y: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  g: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2], b: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
};
export const POINTS = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78];
export const MAX_PEN = 4;
export const SK = { mittel: 1.6, schwer: 1.3, reroll: -2, fastShort: 0.6, fastEarly: 0.45, fastBoth: 0.25 };

// Hausregeln (alle aus = Originalregeln)
//  short:  Kurzes Spiel – Ende schon bei einer geschlossenen Reihe oder drei Fehlwürfen
//  reroll: Neuwurf-Joker – jeder darf einmal pro Partie direkt nach dem Würfeln alle Würfel neu werfen
//  early:  Früh abschließen – eine Reihe darf schon ab drei statt fünf Kreuzen abgeschlossen werden
export const RULES = ['short', 'reroll', 'early'];
const rule = (s, k) => !!(s.opts && s.opts[k]);
export const maxPen = s => (rule(s, 'short') ? 3 : MAX_PEN);
export const rowsToEnd = s => (rule(s, 'short') ? 1 : 2);
export const marksToClose = s => (rule(s, 'early') ? 3 : 5);

export function newSheet(joker = false) {
  const sh = { pen: 0, joker };
  for (const c of COLORS) sh[c] = { marks: new Array(11).fill(false), lock: false };
  return sh;
}

export function newGame(players, opts = {}) {
  const o = Object.fromEntries(RULES.map(k => [k, !!opts[k]]));
  return {
    players: players.map(p => ({ ...p })),
    opts: o,
    sheets: players.map(() => newSheet(o.reroll)),
    closed: { r: false, y: false, g: false, b: false },
    turn: 0, dice: null, phase: 'roll',
    pending: [],             // Spieler, die über die weiße Summe noch entscheiden
    activeMarked: false, log: [], round: 1,
  };
}

export const lastIdx = row => { for (let i = 10; i >= 0; i--) if (row.marks[i]) return i; return -1; };
export const markCount = row => row.marks.filter(Boolean).length + (row.lock ? 1 : 0);

export function rowScore(row) { return POINTS[Math.min(12, markCount(row))]; }
export function score(sh) {
  const rows = COLORS.map(c => rowScore(sh[c]));
  return { rows, pen: sh.pen * 5, total: rows.reduce((a, b) => a + b, 0) - sh.pen * 5 };
}

// Darf p in Reihe c die Zahl v ankreuzen?
export function canMark(s, p, c, v, closedSnapshot = s.closed) {
  if (closedSnapshot[c]) return false;
  const row = s.sheets[p][c];
  const i = ROW[c].indexOf(v);
  if (i < 0 || i <= lastIdx(row)) return false;
  if (i === 10 && row.marks.filter(Boolean).length < marksToClose(s)) return false;
  return true;
}

function doMark(s, p, c, v) {
  const row = s.sheets[p][c];
  const i = ROW[c].indexOf(v);
  row.marks[i] = true;
  if (i === 10) { row.lock = true; s.pendingClose = s.pendingClose || {}; s.pendingClose[c] = true; }
  s.log.push({ p, c, v, lock: i === 10 });
}

export function roll(s, rnd = Math.random) {
  if (s.phase !== 'roll') throw new Error('nicht in der Würfelphase');
  const d = () => 1 + Math.floor(rnd() * 6);
  s.dice = { w1: d(), w2: d() };
  for (const c of COLORS) s.dice[c] = s.closed[c] ? null : d();
  s.phase = 'white';
  const n = s.players.length;
  s.pending = Array.from({ length: n }, (_, k) => (s.turn + k) % n);
  s.whiteClosed = { ...s.closed };
  s.activeMarked = false;
  s.pendingClose = {};
  return s.dice;
}

export const whiteSum = s => s.dice.w1 + s.dice.w2;

// Neuwurf-Joker: nur der aktive Spieler, direkt nach dem Wurf (bevor jemand angekreuzt hat)
export const canReroll = s => rule(s, 'reroll') && s.phase === 'white' && s.pending.length === s.players.length && !!s.sheets[s.turn].joker;
export function reroll(s, rnd = Math.random) {
  if (!canReroll(s)) throw new Error('kein Neuwurf möglich');
  s.sheets[s.turn].joker = false;
  s.log.push({ p: s.turn, reroll: true });
  s.phase = 'roll';
  return roll(s, rnd);
}

// Weiße Summe: c = Farbe oder null (passen)
export function markWhite(s, p, c) {
  if (s.phase !== 'white' || s.pending[0] !== p) throw new Error('nicht dran');
  if (c) {
    if (!canMark(s, p, c, whiteSum(s), s.whiteClosed)) throw new Error('nicht erlaubt');
    doMark(s, p, c, whiteSum(s));
    if (p === s.turn) s.activeMarked = true;
  }
  s.pending.shift();
  if (!s.pending.length) {
    for (const k of Object.keys(s.pendingClose || {})) s.closed[k] = true;
    s.pendingClose = {};
    s.phase = 'color';
  }
}

// Kombinationen weiß + Farbe für den aktiven Spieler
export function colorOptions(s, p = s.turn) {
  const res = [];
  for (const c of COLORS) {
    if (s.closed[c] || s.dice[c] == null) continue;
    for (const w of ['w1', 'w2']) {
      const v = s.dice[w] + s.dice[c];
      if (canMark(s, p, c, v) && !res.some(o => o.c === c && o.v === v)) res.push({ c, v, w });
    }
  }
  return res;
}

export function whiteOptions(s, p) {
  return COLORS.filter(c => canMark(s, p, c, whiteSum(s), s.whiteClosed)).map(c => ({ c, v: whiteSum(s) }));
}

// Farbkombination ankreuzen (oder null = keine)
export function markColor(s, opt) {
  if (s.phase !== 'color') throw new Error('nicht in der Farbphase');
  const p = s.turn;
  if (opt) {
    if (!colorOptions(s).some(o => o.c === opt.c && o.v === opt.v)) throw new Error('nicht erlaubt');
    doMark(s, p, opt.c, opt.v);
    s.activeMarked = true;
    for (const k of Object.keys(s.pendingClose || {})) s.closed[k] = true;
    s.pendingClose = {};
  }
  let penalty = false;
  if (!s.activeMarked) { s.sheets[p].pen++; penalty = true; }
  endTurn(s);
  return { penalty };
}

function endTurn(s) {
  const closedN = COLORS.filter(c => s.closed[c]).length;
  if (closedN >= rowsToEnd(s) || s.sheets.some(sh => sh.pen >= maxPen(s))) { s.phase = 'done'; return; }
  s.turn = (s.turn + 1) % s.players.length;
  if (s.turn === 0) s.round++;
  s.phase = 'roll';
  s.dice = { ...s.dice };
}

export function standings(s) {
  return s.players.map((p, i) => ({ i, ...score(s.sheets[i]) })).sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------
// Computer
// ---------------------------------------------------------------
function progress(s) {
  // 0 am Anfang, ~1 gegen Ende
  const marks = s.sheets.map(sh => COLORS.reduce((a, c) => a + markCount(sh[c]), 0));
  const closed = COLORS.filter(c => s.closed[c]).length;
  const short = rule(s, 'short'), early = rule(s, 'early');
  const full = (short ? 18 : 26) - (early ? 4 : 0);
  return Math.min(1, Math.max(...marks) / full + closed * (0.6 / rowsToEnd(s)) + Math.max(...s.sheets.map(sh => sh.pen)) * (0.48 / maxPen(s)));
}

// Wert eines einzelnen Kreuzes (positiv = gut)
export function markValue(s, p, c, v, level = 'mittel') {
  const row = s.sheets[p][c];
  const i = ROW[c].indexOf(v);
  const skip = i - lastIdx(row) - 1;
  const n = markCount(row);
  const prog = progress(s);
  // In kurzen Partien sind Lücken billiger – es gibt ohnehin weniger Kreuze.
  const sh = rule(s, 'short'), ea = rule(s, 'early');
  const fast = level === 'leicht' ? 1 : sh && ea ? SK.fastBoth : sh ? SK.fastShort : ea ? SK.fastEarly : 1;
  const skipCost = (level === 'leicht' ? 0.9 : level === 'schwer' ? SK.schwer : SK.mittel) * fast * (1 - prog * 0.6);
  let val = 1 + n * 0.45 - skip * skipCost * (1 + n * 0.08);
  if (i === 10) {
    // Abschließen: Reihe zählt +1, und sie ist für alle zu
    const me = score(s.sheets[p]).total;
    const best = Math.max(...s.sheets.map((sh, k) => (k === p ? -999 : score(sh).total)));
    const after = me + POINTS[Math.min(12, n + 2)] - POINTS[Math.min(12, n)];
    const closedAfter = COLORS.filter(k => k === c || s.closed[k] || (s.pendingClose && s.pendingClose[k])).length;
    if (closedAfter >= rowsToEnd(s)) val += after > best ? 12 : -10;   // beendet das Spiel
    else val += 3 + (me >= best ? 4 : -3);
  }
  // Mitte (7) ist häufig – frühe Kreuze an den Rändern sind wertvoll
  if (n === 0 && skip === 0) val += 0.5;
  return { val, skip };
}

function better(a, b) { return !b || a.val > b.val; }

// Was kostet ein Fehlwurf für p? Beendet er das Spiel, kommt es darauf an, wer vorne liegt.
function penaltyCost(s, p) {
  const sh = s.sheets[p];
  if (sh.pen + 1 >= maxPen(s)) {
    const me = score(sh).total - 5;
    const best = Math.max(...s.sheets.map((x, k) => (k === p ? -999 : score(x).total)));
    return me > best ? 0 : 40;
  }
  return 5 + sh.pen * 1.5;
}

// Entscheidung über die weiße Summe
export function aiWhite(s, p, level = 'mittel', rnd = Math.random) {
  const opts = whiteOptions(s, p);
  let best = null;
  for (const o of opts) {
    const m = markValue(s, p, o.c, o.v, level);
    const cand = { ...o, val: m.val, skip: m.skip };
    if (better(cand, best)) best = cand;
  }
  const active = p === s.turn;
  const need = active ? 0.2 : 0.35;
  if (level === 'leicht' && rnd() < 0.2) return opts.length ? opts[Math.floor(rnd() * opts.length)] : null;
  if (best && best.val >= need) return best;
  if (best && active) {
    // Droht ein Fehlwurf? Dann lieber die weiße Summe nehmen, wenn keine Farbe besser passt.
    let bestColor = -Infinity;
    for (const o of colorOptions(s, p)) bestColor = Math.max(bestColor, markValue(s, p, o.c, o.v, level).val);
    const pc = penaltyCost(s, p);
    if (bestColor < 0.3 && best.val > -pc * 0.8 && best.val >= bestColor) return best;
  }
  return null;
}

// Farbphase: beste Kombination oder null (dann ggf. Fehlwurf)
export function aiColor(s, level = 'mittel', rnd = Math.random) {
  const p = s.turn;
  const opts = colorOptions(s, p);
  let best = null;
  for (const o of opts) {
    const m = markValue(s, p, o.c, o.v, level);
    const cand = { ...o, val: m.val, skip: m.skip };
    if (better(cand, best)) best = cand;
  }
  if (level === 'leicht' && rnd() < 0.2) return opts.length ? opts[Math.floor(rnd() * opts.length)] : null;
  const pc = s.activeMarked ? 0 : penaltyCost(s, p);
  if (!best) return null;
  if (best.val > 0.3) return best;
  // Fehlwurf vermeiden, wenn das Kreuz weniger kostet als der Fehlwurf
  if (!s.activeMarked && best.val > -pc * 0.8) return best;
  return null;
}

// Neuwurf-Joker: lohnt sich ein neuer Wurf? (nur direkt nach dem eigenen Wurf)
export function rollQuality(s, p, level = 'mittel') {
  let best = -Infinity;
  for (const o of whiteOptions(s, p)) best = Math.max(best, markValue(s, p, o.c, o.v, level).val);
  for (const o of colorOptions(s, p)) best = Math.max(best, markValue(s, p, o.c, o.v, level).val);
  if (best === -Infinity) best = -penaltyCost(s, p) * 0.8;   // nichts passt: Fehlwurf droht
  return Math.max(best, -penaltyCost(s, p) * 0.8);
}
export function aiReroll(s, level = 'mittel') {
  if (!canReroll(s)) return false;
  const q = rollQuality(s, s.turn, level);
  if (level === 'leicht') return q <= -penaltyCost(s, s.turn) * 0.8 && penaltyCost(s, s.turn) > 0;
  // Am Ende der Partie lieber einsetzen als verfallen lassen
  const thr = SK.reroll + progress(s) * 1.2;
  return q < thr;
}

// Erklärung für Tipps
export function describe(o, s, p) {
  const row = s.sheets[p][o.c];
  const i = ROW[o.c].indexOf(o.v);
  const skip = i - lastIdx(row) - 1;
  const parts = [`${COLOR_NAME[o.c]} ${o.v}`];
  if (i === 10) parts.push('schließt die Reihe ab');
  else if (skip === 0) parts.push('ohne Lücke');
  else parts.push(`lässt ${skip} ${skip === 1 ? 'Feld' : 'Felder'} aus`);
  return parts.join(' – ');
}
