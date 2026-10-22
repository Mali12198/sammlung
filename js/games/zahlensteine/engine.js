// Zahlensteine – 106 Steine: Zahlen 1–13 in vier Farben (je zweimal) und zwei Joker. 2 bis 4 Spieler, je 14 Steine.
// Steine: 'r5' = rote Fünf, 'b13' = blaue Dreizehn, 'k1' = schwarze Eins, 'o7' = orange Sieben, 'J' = Joker.
// Serien: Gruppe (3–4 gleiche Zahlen, verschiedene Farben) oder Reihe (mind. 3 aufeinanderfolgende Zahlen einer Farbe, 1 bis 13).
// Erstes Auslegen: mindestens 30 Punkte aus eigenen Steinen. Danach darf der Tisch beliebig umgebaut werden,
// solange am Ende alle Serien gültig sind und mindestens ein eigener Stein dazukam.
import { shuffle } from '../../util.js';

export const COLORS = ['r', 'b', 'o', 'k'];
export const COLOR_NAME = { r: 'Rot', b: 'Blau', o: 'Orange', k: 'Schwarz' };
export const MIN_OUT = 30;
export const isJ = t => t === 'J';
export const col = t => t[0];
export const num = t => +t.slice(1);
export const tileName = t => (isJ(t) ? 'Joker' : `${COLOR_NAME[col(t)]} ${num(t)}`);
export const tileValue = t => (isJ(t) ? 30 : num(t));
export const rackPoints = ts => ts.reduce((a, t) => a + tileValue(t), 0);

export function newPool() {
  const p = [];
  for (let k = 0; k < 2; k++) for (const c of COLORS) for (let n = 1; n <= 13; n++) p.push(c + n);
  p.push('J', 'J');
  return p;
}

export function sortRack(rack, mode = 'color') {
  const key = mode === 'num'
    ? t => (isJ(t) ? 9999 : num(t) * 10 + COLORS.indexOf(col(t)))
    : t => (isJ(t) ? 9999 : COLORS.indexOf(col(t)) * 100 + num(t));
  return rack.slice().sort((a, b) => key(a) - key(b));
}

// ---------------------------------------------------------------
// Serien prüfen
// ---------------------------------------------------------------
// Liefert { kind:'group', n, tiles } | { kind:'run', c, lo, tiles } (tiles in Reihenfolge) oder null.
export function analyzeSet(tiles) {
  if (tiles.length < 3) return null;
  const nat = tiles.filter(t => !isJ(t));
  const J = tiles.length - nat.length;
  if (!nat.length) return null;
  if (nat.every(t => num(t) === num(nat[0]))) {
    const cs = new Set(nat.map(col));
    if (cs.size === nat.length && tiles.length <= 4) return { kind: 'group', n: num(nat[0]), tiles: nat.concat(Array(J).fill('J')) };
    if (nat.length > 1) return null;
  }
  if (!nat.every(t => col(t) === col(nat[0]))) return null;
  const ns = nat.map(num).sort((a, b) => a - b);
  if (new Set(ns).size !== ns.length) return null;
  const gaps = ns[ns.length - 1] - ns[0] + 1 - ns.length;
  if (gaps > J) return null;
  let extra = J - gaps;
  let hi = Math.min(13, ns[ns.length - 1] + extra);
  extra -= hi - ns[ns.length - 1];
  const lo = ns[0] - extra;
  if (lo < 1) return null;
  const c = col(nat[0]);
  const out = [];
  for (let n = lo; n <= hi; n++) out.push(nat.find(t => num(t) === n) || 'J');
  return { kind: 'run', c, lo, tiles: out };
}

export function setValue(s) {
  if (s.kind === 'group') return s.n * s.tiles.length;
  return s.tiles.reduce((a, _, i) => a + s.lo + i, 0);
}
export function describeSet(s) {
  if (s.kind === 'group') return `Gruppe ${s.n}er`;
  return `${COLOR_NAME[s.c]} ${s.lo}–${s.lo + s.tiles.length - 1}`;
}
export function jokerFor(s, i) {
  if (s.kind === 'run') return s.c + (s.lo + i);
  return 'any' + s.n;
}

// ---------------------------------------------------------------
// Löser: Steine vollständig in gültige Serien aufteilen
// ---------------------------------------------------------------
function toCounts(tiles) {
  const cnt = {};
  for (const c of COLORS) cnt[c] = new Array(15).fill(0);
  let J = 0;
  for (const t of tiles) { if (isJ(t)) J++; else cnt[col(t)][num(t)]++; }
  return { cnt, J };
}
const keyOf = (cnt, J) => COLORS.map(c => cnt[c].join('')).join('|') + '#' + J;

// Liefert Liste von Serien (wie analyzeSet) oder null. limit begrenzt die Suche.
export function partition(tiles, limit = 40000) {
  const { cnt, J: J0 } = toCounts(tiles);
  const failed = new Set();
  let nodes = 0;
  let aborted = false;
  function lowest() {
    for (let n = 1; n <= 13; n++) for (const c of COLORS) if (cnt[c][n]) return [c, n];
    return null;
  }
  function attachJokers(acc, J) {
    // übrige Joker an Serien hängen
    const sets = acc.map(s => ({ ...s, tiles: s.tiles.slice() }));
    let left = J;
    for (const s of sets) {
      while (left > 0) {
        if (s.kind === 'group' && s.tiles.length < 4) { s.tiles.push('J'); left--; continue; }
        if (s.kind === 'run') {
          const hi = s.lo + s.tiles.length - 1;
          if (hi < 13) { s.tiles.push('J'); left--; continue; }
          if (s.lo > 1) { s.tiles.unshift('J'); s.lo--; left--; continue; }
        }
        break;
      }
    }
    return left === 0 ? sets : null;
  }
  function rec(J, acc) {
    if (++nodes > limit) { aborted = true; return null; }
    const lo = lowest();
    if (!lo) return J === 0 ? acc : attachJokers(acc, J);
    const k = keyOf(cnt, J);
    if (failed.has(k)) return null;
    const [c, n] = lo;
    cnt[c][n]--;
    // a) Reihe ab dieser Zahl (evtl. mit Jokern davor). An jeder Stelle: echter Stein oder Joker.
    for (let pre = 0; pre <= Math.min(J, n - 1, 2); pre++) {
      const run = Array(pre).fill('J').concat([c + n]);
      const build = (m, j) => {
        if (run.length >= 3) {
          const r = rec(j, acc.concat([{ kind: 'run', c, lo: n - pre, tiles: run.slice() }]));
          if (r) return r;
        }
        if (m > 13) return null;
        if (cnt[c][m]) {
          cnt[c][m]--; run.push(c + m);
          const r = build(m + 1, j);
          run.pop(); cnt[c][m]++;
          if (r) return r;
        }
        if (j > 0) {
          run.push('J');
          const r = build(m + 1, j - 1);
          run.pop();
          if (r) return r;
        }
        return null;
      };
      const r = build(n + 1, J - pre);
      if (r) { cnt[c][n]++; return r; }
    }
    // b) Gruppe mit dieser Zahl
    const others = COLORS.filter(x => x !== c && cnt[x][n] > 0);
    for (let mask = (1 << others.length) - 1; mask >= 0; mask--) {
      const pick = others.filter((_, i) => mask & (1 << i));
      for (let jj = 0; jj <= J; jj++) {
        const size = 1 + pick.length + jj;
        if (size < 3 || size > 4) continue;
        for (const x of pick) cnt[x][n]--;
        const r = rec(J - jj, acc.concat([{ kind: 'group', n, tiles: [c + n, ...pick.map(x => x + n)].concat(Array(jj).fill('J')) }]));
        for (const x of pick) cnt[x][n]++;
        if (r) { cnt[c][n]++; return r; }
      }
    }
    cnt[c][n]++;
    if (!aborted) failed.add(k);
    return null;
  }
  if (!tiles.length) return [];
  return rec(J0, []);
}

// ---------------------------------------------------------------
// Spiel
// ---------------------------------------------------------------
export function newGame({ n = 2, rnd = Math.random, first = 0 } = {}) {
  const pool = shuffle(newPool(), rnd);
  const racks = [];
  for (let p = 0; p < n; p++) racks.push(pool.splice(0, 14));
  const g = {
    n, racks, pool, table: [], out: new Array(n).fill(false),
    turn: first, phase: 'play', passes: 0,
    turnStart: null, played: [], fresh: [],   // fresh: Indizes neuer/geänderter Serien in diesem Zug
    initialThisTurn: false, result: null, log: [],
  };
  beginTurn(g);
  return g;
}

function snapshot(s) {
  return { table: s.table.map(x => ({ ...x, tiles: x.tiles.slice() })), rack: s.racks[s.turn].slice(), out: s.out[s.turn] };
}

export function beginTurn(s) {
  s.turnStart = snapshot(s);
  s.played = [];
  s.fresh = [];
  s.initialThisTurn = false;
}

function removeTiles(rack, tiles) {
  const r = rack.slice();
  for (const t of tiles) { const i = r.indexOf(t); if (i < 0) return null; r.splice(i, 1); }
  return r;
}

// Neue Serien nur aus eigenen Steinen (ohne den Tisch)
export function trySetsOnly(tiles) { return partition(tiles, 20000); }

// Steine legen. Wer noch nicht draußen ist: nur eigene neue Serien, zusammen ≥ 30 Punkte in diesem Zug.
// Draußen: Steine an den Tisch – erst ohne Umbau versuchen, sonst den ganzen Tisch neu aufteilen.
export function checkPlay(s, p, tiles) {
  if (s.phase !== 'play' || s.turn !== p) return { ok: false, err: 'Du bist nicht dran.' };
  if (!tiles.length) return { ok: false, err: 'Wähle zuerst Steine aus.' };
  const rack = removeTiles(s.racks[p], tiles);
  if (!rack) return { ok: false, err: 'Diese Steine hast du nicht.' };
  if (!s.out[p]) {
    const sets = trySetsOnly(tiles);
    if (!sets) return { ok: false, err: whyNot(tiles) };
    return { ok: true, rack, newSets: sets, value: sets.reduce((a, x) => a + setValue(x), 0) };
  }
  if (s.initialThisTurn) {
    const own = trySetsOnly(tiles);
    if (own) return { ok: true, rack, newSets: own };
    return { ok: false, err: 'Im Zug deines ersten Auslegens darfst du nur eigene neue Serien legen – anlegen und umbauen geht ab dem nächsten Zug.' };
  }
  // 1. eigene neue Serien
  const own = trySetsOnly(tiles);
  if (own) return { ok: true, rack, newSets: own };
  // 2. ohne Umbau anhängen (jeder Stein an ein Ende/eine Gruppe), Rest als neue Serien
  const simple = attachSimple(s.table, tiles);
  if (simple) return { ok: true, rack, table: simple.table, changed: simple.changed };
  // 3. nur die betroffenen Serien neu aufteilen
  const loc = localRebuild(s.table, tiles, 30000);
  if (loc) return { ok: true, rack, table: loc.table, changed: loc.changed, rebuilt: false, local: true };
  // 4. ganzen Tisch neu aufteilen
  const all = s.table.flatMap(x => x.tiles).concat(tiles);
  const sets = partition(all, 60000);
  if (!sets) return { ok: false, err: 'Das geht nicht auf: Mit diesen Steinen lässt sich der Tisch nicht in gültige Serien aufteilen.' };
  return { ok: true, rack, table: sets, rebuilt: true };
}

// Serien, die mit den neuen Steinen zu tun haben (gleiche Zahl, gleiche Farbe in der Nähe, Joker), neu aufteilen.
export function localRebuild(table, tiles, limit = 20000) {
  const nat = tiles.filter(t => !isJ(t));
  const near = x => x.tiles.some(u => isJ(u) || nat.some(t => num(u) === num(t) || (col(u) === col(t) && Math.abs(num(u) - num(t)) <= 3)));
  const idx = table.map((x, i) => (near(x) ? i : -1)).filter(i => i >= 0);
  if (!idx.length) return null;
  if (!quickPossible(idx.flatMap(i => table[i].tiles).concat(tiles), nat)) return null;
  const sets = partition(idx.flatMap(i => table[i].tiles).concat(tiles), limit);
  if (!sets) return null;
  const keep = table.filter((_, i) => !idx.includes(i));
  return { table: keep.concat(sets), changed: sets.map((_, k) => keep.length + k) };
}

// Schnelltest: kann jeder neue Stein überhaupt in einer Gruppe oder Reihe landen?
function quickPossible(all, nat) {
  const J = all.filter(isJ).length;
  const has = new Set(all);
  for (const t of nat) {
    const c = col(t), n = num(t);
    const colors = COLORS.filter(x => has.has(x + n)).length;
    if (colors + J >= 3) continue;
    let ok = false;
    for (let a = Math.max(1, n - 2); a <= Math.min(n, 11) && !ok; a++) {
      let miss = 0;
      for (let k = a; k < a + 3; k++) if (!has.has(c + k)) miss++;
      if (miss <= J) ok = true;
    }
    if (!ok) return false;
  }
  return true;
}

function attachSimple(table, tiles) {
  const t2 = table.map(x => ({ ...x, tiles: x.tiles.slice() }));
  const changed = new Set();
  const rest = [];
  for (const t of tiles) {
    let done = false;
    for (let i = 0; i < t2.length && !done; i++) {
      // Reihen: an beiden Enden probieren
      const opts = t2[i].kind === 'run' ? [t2[i].tiles.concat([t]), [t].concat(t2[i].tiles)] : [t2[i].tiles.concat([t])];
      for (const o of opts) {
        const a = analyzeSet(o);
        if (a && a.kind === t2[i].kind && keepsJokers(t2[i], a)) { t2[i] = a; changed.add(i); done = true; break; }
      }
    }
    if (!done) rest.push(t);
  }
  if (rest.length) {
    if (rest.length < 3) return null;
    const own = partition(rest, 8000);
    if (!own) return null;
    for (const x of own) { t2.push(x); changed.add(t2.length - 1); }
  }
  return { table: t2, changed: [...changed] };
}
// Joker dürfen beim einfachen Anlegen nicht „wandern“ (z. B. 5-J-7 + 6 ist ein Umbau)
function keepsJokers(before, after) {
  if (before.kind === 'group') return true;
  const jb = before.tiles.map((t, i) => (isJ(t) ? before.lo + i : null)).filter(x => x !== null);
  const ja = after.tiles.map((t, i) => (isJ(t) ? after.lo + i : null)).filter(x => x !== null);
  return jb.every(x => ja.includes(x));
}

export function play(s, p, tiles) {
  const r = checkPlay(s, p, tiles);
  if (!r.ok) return r;
  s.racks[p] = r.rack;
  s.played.push(...tiles);
  if (r.newSets) {
    for (const x of r.newSets) { s.table.push(x); s.fresh.push(s.table.length - 1); }
  } else {
    s.table = r.table;
    if (r.rebuilt) s.fresh = s.table.map((_, i) => i);
    else for (const i of r.changed) if (!s.fresh.includes(i)) s.fresh.push(i);
  }
  if (!s.out[p]) {
    const v = turnNewValue(s);
    if (v >= MIN_OUT) { s.out[p] = true; s.initialThisTurn = true; }
  }
  s.log.push({ p, type: 'play', n: tiles.length });
  return { ok: true, rebuilt: !!r.rebuilt, out: s.out[p] };
}

// Wert der in diesem Zug neu gelegten Serien (für das erste Auslegen)
export function turnNewValue(s) {
  return s.fresh.reduce((a, i) => a + (s.table[i] ? setValue(s.table[i]) : 0), 0);
}

export function undoTurn(s) {
  const t = s.turnStart;
  if (!t) return;
  s.table = t.table.map(x => ({ ...x, tiles: x.tiles.slice() }));
  s.racks[s.turn] = t.rack.slice();
  s.out[s.turn] = t.out;
  s.played = []; s.fresh = []; s.initialThisTurn = false;
}

// Zug beenden: entweder Steine gelegt (bei erstem Auslegen ≥ 30) oder einen Stein ziehen.
export function canFinish(s) {
  if (!s.played.length) return { ok: false, err: 'Leg mindestens einen Stein – oder zieh einen.' };
  if (!s.turnStart.out && !s.out[s.turn]) return { ok: false, err: `Fürs erste Auslegen brauchst du ${MIN_OUT} Punkte – das sind erst ${turnNewValue(s)}. Leg mehr oder nimm zurück.` };
  return { ok: true };
}

export function finishTurn(s) {
  const r = canFinish(s);
  if (!r.ok) throw new Error(r.err);
  s.passes = 0;
  if (!s.racks[s.turn].length) return endGame(s, s.turn);
  nextTurn(s);
}

export function drawTile(s) {
  if (s.played.length) throw new Error('Du hast schon gelegt.');
  const p = s.turn;
  let t = null;
  if (s.pool.length) { t = s.pool.pop(); s.racks[p].push(t); s.passes = 0; }
  else {
    s.passes++;
    if (s.passes >= s.n) return endGame(s, -1);
  }
  s.log.push({ p, type: 'draw' });
  nextTurn(s);
  return t;
}

function nextTurn(s) {
  s.turn = (s.turn + 1) % s.n;
  beginTurn(s);
}

function endGame(s, winner) {
  const pts = s.racks.map(rackPoints);
  let w = winner;
  if (w < 0) { const min = Math.min(...pts); w = pts.indexOf(min); }
  const scores = pts.map((v, p) => (p === w ? 0 : -v));
  scores[w] = -scores.reduce((a, b) => a + b, 0);
  s.result = { winner: w, pts, scores, blocked: winner < 0 };
  s.phase = 'done';
}

export function whyNot(tiles) {
  if (tiles.length < 3) return 'Eine Serie braucht mindestens drei Steine.';
  const nat = tiles.filter(t => !isJ(t));
  if (nat.every(t => num(t) === num(nat[0]))) return tiles.length > 4 ? 'Eine Gruppe hat höchstens vier Steine.' : 'In einer Gruppe muss jede Farbe verschieden sein.';
  if (nat.every(t => col(t) === col(nat[0]))) return 'Für diese Reihe fehlen Zahlen dazwischen – oder ein Joker.';
  return 'Das sind keine gültigen Serien: Gruppen haben gleiche Zahlen in verschiedenen Farben, Reihen aufeinanderfolgende Zahlen einer Farbe.';
}

// ---------------------------------------------------------------
// Computer
// ---------------------------------------------------------------
// Beste Serien nur aus dem eigenen Bänkchen (Kandidaten + Suche)
function candidates(rack) {
  const J = rack.filter(isJ).length;
  const res = [];
  const nat = rack.filter(t => !isJ(t));
  for (let n = 1; n <= 13; n++) {
    const cs = [...new Set(nat.filter(t => num(t) === n).map(col))];
    const k = cs.length;
    for (let mask = 1; mask < (1 << k); mask++) {
      const pick = cs.filter((_, i) => mask & (1 << i)).map(c => c + n);
      for (let j = 0; j <= J; j++) if (pick.length + j >= 3 && pick.length + j <= 4) res.push(pick.concat(Array(j).fill('J')));
    }
  }
  for (const c of COLORS) {
    const have = new Set(nat.filter(t => col(t) === c).map(num));
    for (let lo = 1; lo <= 11; lo++) {
      for (let hi = lo + 2; hi <= 13; hi++) {
        let miss = 0; const ts = [];
        for (let n = lo; n <= hi; n++) { if (have.has(n)) ts.push(c + n); else { miss++; ts.push('J'); } }
        if (miss > J) break;
        if (ts.length - miss < 1) continue;
        res.push(ts);
      }
    }
  }
  return res;
}

export function bestSets(rack, limit = 20000, byValue = false) {
  const cands = candidates(rack).map(ts => ({ ts, s: analyzeSet(ts) })).filter(x => x.s);
  for (const x of cands) { x.v = x.ts.filter(t => !isJ(t)).length * 100 + setValue(x.s); x.need = {}; for (const t of x.ts) x.need[t] = (x.need[t] || 0) + 1; }
  if (byValue) for (const x of cands) x.v = setValue(x.s);
  cands.sort((a, b) => b.v - a.v);
  const count = {};
  for (const t of rack) count[t] = (count[t] || 0) + 1;
  let best = { sets: [], tiles: 0, value: 0 };
  let nodes = 0;
  const fits = x => { for (const t in x.need) if ((count[t] || 0) < x.need[t]) return false; return true; };
  const rec = (start, chosen, tiles, value) => {
    if (++nodes > limit) return;
    const better = byValue ? value > best.value || (value === best.value && tiles > best.tiles) : tiles > best.tiles || (tiles === best.tiles && value > best.value);
    if (better) best = { sets: chosen.slice(), tiles, value };
    for (let i = start; i < cands.length; i++) {
      const x = cands[i];
      if (!fits(x)) continue;
      for (const t in x.need) count[t] -= x.need[t];
      chosen.push(x.ts);
      rec(i + 1, chosen, tiles + x.ts.length, value + setValue(x.s));
      chosen.pop();
      for (const t in x.need) count[t] += x.need[t];
    }
  };
  rec(0, [], 0, 0);
  return best;
}

// Bester Plan für den Zug: Liste von Steingruppen, die nacheinander gelegt werden. Leer = ziehen.
export function aiTurn(s, p, level = 'mittel') {
  const rack = s.racks[p].slice();
  const steps = [];
  if (!s.out[p]) {
    const b = bestSets(rack, 20000, true);
    const val = b.sets.reduce((a, ts) => a + setValue(analyzeSet(ts)), 0);
    if (val >= MIN_OUT) steps.push(b.sets.flat());
    return steps;
  }
  let r = rack;
  let table = s.table.map(x => ({ ...x, tiles: x.tiles.slice() }));
  // 1. eigene Serien
  const b = bestSets(r);
  if (b.sets.length) {
    const tiles = b.sets.flat();
    const own = partition(tiles, 20000);
    if (own) { steps.push(tiles); r = removeTiles(r, tiles); table = table.concat(own); }
  }
  // 2. einzelne Steine anlegen bzw. Tisch umbauen
  const tryOne = t => {
    const simple = attachSimple(table, [t]);
    if (simple) return simple.table;
    if (level === 'leicht') return null;
    const loc = localRebuild(table, [t], level === 'schwer' ? 8000 : 4000);
    if (loc) return loc.table;
    if (level !== 'schwer') return null;
    const all = table.flatMap(x => x.tiles).concat([t]);
    if (!quickPossible(all, [t])) return null;
    return partition(all, 3000);
  };
  let progress = true;
  while (progress && r.length) {
    progress = false;
    const order = sortRack(r, 'num').filter(t => !isJ(t)).reverse();   // hohe Steine zuerst loswerden
    for (const t of order) {
      const nt = tryOne(t);
      if (nt) { steps.push([t]); table = nt; r = removeTiles(r, [t]); progress = true; break; }
    }
  }
  // 3. Joker zum Schluss loswerden, wenn sonst nichts übrig ist
  if (r.length && r.every(isJ)) {
    const nt = attachSimple(table, r);
    if (nt) { steps.push(r.slice()); r = []; }
  }
  return steps;
}

