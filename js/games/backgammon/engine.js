// Backgammon: Regeln, Zuggenerator, Bewertung und Computergegner.
// pts[i] > 0: Steine des Spielers (Seite 0), < 0: Computer (Seite 1).
// Seite 0 zieht von Index 23 Richtung 0 (Punkt 24 → 1), Seite 1 umgekehrt.
// Schritte in echten Koordinaten: from = Zahl | 'bar', to = Zahl | 'off'.

export function newState() {
  const pts = new Array(24).fill(0);
  pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5;
  pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5;
  return { pts, bar: [0, 0], off: [0, 0], turn: 0, dice: [], cube: 1, cubeOwner: -1 };
}

export const cloneState = s => ({ ...s, pts: s.pts.slice(), bar: s.bar.slice(), off: s.off.slice(), dice: s.dice.slice() });

// ---------- Perspektive ----------
// P: { p: Array(24) eigene > 0, bar, obar, off, ooff } – man zieht von 23 nach 0.
export function persp(s, side) {
  const p = new Array(24);
  if (side === 0) for (let i = 0; i < 24; i++) p[i] = s.pts[i];
  else for (let i = 0; i < 24; i++) p[i] = -s.pts[23 - i];
  return { p, bar: s.bar[side], obar: s.bar[1 - side], off: s.off[side], ooff: s.off[1 - side] };
}
const toReal = (i, side) => (side === 0 ? i : 23 - i);
const P_BAR = 24, P_OFF = -1;

function realStep(st, side) {
  return {
    from: st.from === P_BAR ? 'bar' : toReal(st.from, side),
    to: st.to === P_OFF ? 'off' : toReal(st.to, side),
    die: st.die, hit: st.hit,
  };
}

function clonePersp(P) { return { p: P.p.slice(), bar: P.bar, obar: P.obar, off: P.off, ooff: P.ooff }; }

function allHome(P) {
  if (P.bar) return false;
  for (let i = 6; i < 24; i++) if (P.p[i] > 0) return false;
  return true;
}

// Einzelschritte für einen Würfel (Perspektive)
function singleSteps(P, d) {
  const res = [];
  if (P.bar > 0) {
    const t = 24 - d;
    if (P.p[t] >= -1) res.push({ from: P_BAR, to: t, die: d, hit: P.p[t] === -1 });
    return res;
  }
  const home = allHome(P);
  let highest = -1;
  if (home) for (let i = 5; i >= 0; i--) if (P.p[i] > 0) { highest = i; break; }
  for (let i = 0; i < 24; i++) {
    if (P.p[i] <= 0) continue;
    const t = i - d;
    if (t >= 0) {
      if (P.p[t] >= -1) res.push({ from: i, to: t, die: d, hit: P.p[t] === -1 });
    } else if (home && (t === -1 || i === highest)) {
      res.push({ from: i, to: P_OFF, die: d, hit: false });
    }
  }
  return res;
}

function applyP(P, st) {
  if (st.from === P_BAR) P.bar--; else P.p[st.from]--;
  if (st.to === P_OFF) P.off++;
  else {
    if (P.p[st.to] === -1) { P.p[st.to] = 0; P.obar++; }
    P.p[st.to]++;
  }
}

const keyP = P => P.p.join(',') + '|' + P.bar + '|' + P.obar + '|' + P.off;

// Alle erlaubten Zugfolgen. Liefert Pfade in Perspektive (paths) + eindeutige Endstellungen (turns).
export function genTurns(P, dice) {
  const seqs = dice[0] === dice[1] ? [[dice[0], dice[0], dice[0], dice[0]]] : [[dice[0], dice[1]], [dice[1], dice[0]]];
  const paths = [];
  let maxLen = 0;
  const seen = new Set();
  function dfs(Q, rest, path) {
    let moved = false;
    if (rest.length) {
      const d = rest[0];
      const steps = singleSteps(Q, d);
      for (const st of steps) {
        const R = clonePersp(Q);
        applyP(R, st);
        moved = true;
        dfs(R, rest.slice(1), path.concat([st]));
      }
    }
    if (!moved) {
      // Pfad endet hier
      const k = path.map(s => s.from + '>' + s.to).join(' ');
      if (seen.has(k)) return;
      seen.add(k);
      if (path.length > maxLen) maxLen = path.length;
      paths.push({ steps: path, end: Q });
    }
  }
  for (const seq of seqs) dfs(P, seq, []);
  let legal = paths.filter(x => x.steps.length === maxLen);
  if (maxLen === 1 && dice[0] !== dice[1]) {
    const big = Math.max(dice[0], dice[1]);
    if (legal.some(x => x.steps[0].die === big)) legal = legal.filter(x => x.steps[0].die === big);
  }
  const byEnd = new Map();
  for (const x of legal) { const k = keyP(x.end); if (!byEnd.has(k)) byEnd.set(k, x); }
  return { paths: legal, turns: [...byEnd.values()], maxLen };
}

// Echte Zustände
export function legalPaths(s, side, dice) {
  const g = genTurns(persp(s, side), dice);
  return {
    maxLen: g.maxLen,
    paths: g.paths.map(x => x.steps.map(st => realStep(st, side))),
    turns: g.turns.map(x => ({ steps: x.steps.map(st => realStep(st, side)), P: x.end })),
  };
}

export function applyStep(s, side, step) {
  const sign = side === 0 ? 1 : -1;
  if (step.from === 'bar') s.bar[side]--; else s.pts[step.from] -= sign;
  if (step.to === 'off') s.off[side]++;
  else {
    if (s.pts[step.to] === -sign) { s.pts[step.to] = 0; s.bar[1 - side]++; }
    s.pts[step.to] += sign;
  }
}

export function winner(s) {
  if (s.off[0] === 15) return 0;
  if (s.off[1] === 15) return 1;
  return -1;
}

// 1 = einfach, 2 = Gammon, 3 = Backgammon
export function winFactor(s, w) {
  const l = 1 - w;
  if (s.off[l] > 0) return 1;
  const P = persp(s, l);
  // Steine des Verlierers auf der Bar oder im Heimfeld des Gewinners (aus Sicht des Verlierers Index 18–23)
  if (P.bar > 0) return 3;
  for (let i = 18; i < 24; i++) if (P.p[i] > 0) return 3;
  return 2;
}

export function pips(s, side) {
  const P = persp(s, side);
  let n = P.bar * 25;
  for (let i = 0; i < 24; i++) if (P.p[i] > 0) n += P.p[i] * (i + 1);
  return n;
}

// ---------- Bewertung ----------
const POINT_VALUE = [2, 4, 6, 8, 13, 11, 10, 6, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 5, 6, 5, 3, 3, 3];

function isContact(P) {
  if (P.bar || P.obar) return true;
  let myRear = -1, oppRear = 24;
  for (let i = 23; i >= 0; i--) if (P.p[i] > 0) { myRear = i; break; }
  for (let i = 0; i < 24; i++) if (P.p[i] < 0) { oppRear = i; break; }
  return myRear > oppRear;
}

// Wie viele der 36 Würfe treffen meinen Stein auf Index i? (Gegner zieht aufwärts)
export function shotsOn(P, i) {
  const from = [];
  for (let j = 0; j < i; j++) if (P.p[j] < 0) from.push(j);
  if (P.obar) from.push(-1);
  if (!from.length) return 0;
  const blocked = k => k >= 0 && k < 24 && P.p[k] >= 2;
  let hits = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      let hit = false;
      for (const j of from) {
        const dist = i - j;
        if (dist === a || dist === b) { hit = true; break; }
        if (a !== b) {
          if (dist === a + b && (!blocked(j + a) || !blocked(j + b))) { hit = true; break; }
        } else {
          for (let k = 2; k <= 4; k++) {
            if (dist === a * k) {
              let ok = true;
              for (let m = 1; m < k; m++) if (blocked(j + a * m)) { ok = false; break; }
              if (ok) { hit = true; break; }
            }
          }
          if (hit) break;
        }
      }
      if (hit) hits += a === b ? 1 : 2;
    }
  }
  return hits;
}

export function features(P) {
  let myPips = P.bar * 25, oppPips = P.obar * 25;
  for (let i = 0; i < 24; i++) {
    if (P.p[i] > 0) myPips += P.p[i] * (i + 1);
    else if (P.p[i] < 0) oppPips += -P.p[i] * (24 - i);
  }
  let myHome = 0, oppHome = 0;
  for (let i = 0; i < 6; i++) if (P.p[i] >= 2) myHome++;
  for (let i = 18; i < 24; i++) if (P.p[i] <= -2) oppHome++;
  let prime = 0, run = 0;
  for (let i = 0; i < 18; i++) { if (P.p[i] >= 2) { run++; prime = Math.max(prime, run); } else run = 0; }
  const blots = [];
  for (let i = 0; i < 24; i++) if (P.p[i] === 1) blots.push(i);
  return { myPips, oppPips, myHome, oppHome, prime, blots, contact: isContact(P) };
}

export function evaluate(P, f = features(P)) {
  if (P.off === 15) return 10000;
  if (!f.contact) {
    // reines Wettrennen: Gegner ist als Nächstes am Zug (≈ 4 Augen wert)
    let s = (f.oppPips - f.myPips - 4) * 1.6;
    // Steine weit hinten im Heimfeld kosten beim Abtragen Zeit
    let waste = 0;
    for (let i = 0; i < 6; i++) if (P.p[i] > 0) waste += P.p[i] * (i < 2 ? 0.6 : 0);
    s -= waste;
    s += (P.off - P.ooff) * 1.5;
    return s;
  }
  let s = (f.oppPips - f.myPips) * 1.0;
  for (let i = 0; i < 24; i++) {
    if (P.p[i] >= 2) s += POINT_VALUE[i];
    if (P.p[i] > 3) s -= (P.p[i] - 3) * 1.5;
  }
  if (f.prime >= 3) s += (f.prime - 2) * (f.prime - 2) * 3;
  // hintere Steine im gegnerischen Heimfeld werden leicht eingesperrt
  for (let i = 18; i < 24; i++) {
    if (P.p[i] <= 0) continue;
    let blockers = 0;
    for (let j = i - 6; j < i; j++) if (P.p[j] <= -2) blockers++;
    s -= P.p[i] * (1.5 + blockers * 1.6);
  }
  const homeFactor = 1 + f.oppHome * 0.18;
  for (const i of f.blots) {
    const shots = shotsOn(P, i);
    if (!shots) continue;
    const loss = (24 - i) * 0.9 + 8;
    s -= (shots / 36) * loss * homeFactor;
  }
  s += P.obar * (7 + 3.5 * f.myHome);
  s -= P.bar * (7 + 3.5 * f.oppHome);
  s += (P.off - P.ooff) * 2;
  return s;
}

// Schätzung der Gewinnwahrscheinlichkeit für den Spieler am Zug (vor dem Wurf)
export function winProb(s, side) {
  const P = persp(s, side);
  const f = features(P);
  if (!f.contact) {
    const lead = (f.oppPips - f.myPips + 4) / Math.max(1, f.myPips);
    return Math.max(0.02, Math.min(0.98, 0.5 + lead * 2.5));
  }
  const e = evaluate(P, f) + 6; // am Zug zu sein ist ein Vorteil
  return 1 / (1 + Math.exp(-e / 22));
}

// ---------- Computer ----------
function bestReplyValue(P) {
  // P aus meiner Sicht; der Gegner würfelt. Erwartungswert über 21 Würfe.
  const O = { p: P.p.map(x => -x).reverse(), bar: P.obar, obar: P.bar, off: P.ooff, ooff: P.off };
  let total = 0;
  for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) {
    const w = a === b ? 1 : 2;
    const { turns } = genTurns(O, [a, b]);
    let best = -Infinity;
    if (!turns.length) best = evaluate(O);
    for (const t of turns) { const v = evaluate(t.end); if (v > best) best = v; }
    total += w * best;
  }
  return -total / 36;
}

export function chooseTurn(s, side, dice, level = 'mittel', rnd = Math.random) {
  const { turns } = legalPaths(s, side, dice);
  if (!turns.length) return null;
  const scored = turns.map(t => ({ t, v: evaluate(t.P) }));
  scored.sort((a, b) => b.v - a.v);
  if (level === 'leicht') {
    // meist ein ordentlicher, aber oft nicht der beste Zug
    const k = Math.min(scored.length, Math.max(1, Math.ceil(scored.length * 0.6)));
    return rnd() < 0.35 ? scored[0].t : scored[Math.floor(rnd() * k)].t;
  }
  if (level === 'schwer' && scored.length > 1) {
    const top = scored.slice(0, 6);
    for (const x of top) x.v2 = bestReplyValue(x.t.P);
    top.sort((a, b) => b.v2 - a.v2);
    return top[0].t;
  }
  return scored[0].t;
}

export function rankTurns(s, side, dice, deep = false) {
  const { turns } = legalPaths(s, side, dice);
  const scored = turns.map(t => ({ t, v: evaluate(t.P) }));
  scored.sort((a, b) => b.v - a.v);
  if (deep && scored.length > 1) {
    const top = scored.slice(0, 6);
    for (const x of top) x.v = bestReplyValue(x.t.P);
    for (const x of scored.slice(6)) x.v = -Infinity;
    scored.sort((a, b) => b.v - a.v);
  }
  return scored;
}

// Verdoppeln: Computer bietet an / nimmt an
export function aiShouldDouble(s, side, level = 'mittel') {
  if (s.cubeOwner !== -1 && s.cubeOwner !== side) return false;
  if (s.cube >= 64) return false;
  const p = winProb(s, side);
  const lo = level === 'leicht' ? 0.78 : 0.7;
  return p >= lo && p < 0.92;
}
export function aiShouldTake(s, side) {
  // side ist der, der die Annahme entscheidet; der Gegner ist am Zug
  const pOpp = winProb(s, 1 - side);
  return pOpp <= 0.76;
}

// ---------- Notation ----------
export function stepText(st, side) {
  const num = i => (side === 0 ? i + 1 : 24 - i);
  const f = st.from === 'bar' ? 'Bar' : num(st.from);
  const t = st.to === 'off' ? 'raus' : num(st.to);
  return `${f}/${t}${st.hit ? '*' : ''}`;
}
export const turnText = (steps, side) => steps.map(st => stepText(st, side)).join('  ');

// Erklärung eines Zuges (für Tipps)
export function explainTurn(s, side, turn) {
  const before = persp(s, side);
  const fb = features(before);
  const after = turn.P;
  const fa = features(after);
  const r = [];
  const hits = turn.steps.filter(x => x.hit).length;
  if (hits) r.push(hits > 1 ? `Schlägt <b>${hits} Steine</b> des Gegners – sie müssen zurück auf die Bar.` : 'Schlägt einen <b>einzelnen Stein</b> des Gegners – er muss ganz von vorne beginnen.');
  const made = [];
  for (let i = 0; i < 24; i++) if (after.p[i] >= 2 && before.p[i] < 2) made.push(i + 1);
  if (made.length) {
    const nice = made.map(n => n === 5 ? 'den wichtigen 5er-Punkt' : n === 7 ? 'den Bar-Punkt (7)' : n <= 6 ? `den ${n}er-Punkt im Heimfeld` : `den ${n}er-Punkt`);
    r.push(`Baut ${nice.join(' und ')} – ein besetzter Punkt blockiert den Gegner.`);
  }
  if (fa.prime >= 4 && fa.prime > fb.prime) r.push(`Damit stehen <b>${fa.prime} Punkte</b> am Stück – eine starke Mauer (Prime).`);
  const riskBefore = fb.blots.reduce((a, i) => a + shotsOn(before, i), 0);
  const riskAfter = fa.blots.reduce((a, i) => a + shotsOn(after, i), 0);
  if (!fa.blots.length && fb.blots.length) r.push('Lässt <b>keine einzelnen Steine</b> (Blots) mehr stehen.');
  else if (riskAfter === 0 && fa.contact) r.push('Kein Stein kann direkt getroffen werden.');
  else if (riskAfter < riskBefore - 6) r.push('Verringert das Risiko, getroffen zu werden.');
  const backBefore = before.p.slice(18).reduce((a, x) => a + Math.max(0, x), 0) + before.bar;
  const backAfter = after.p.slice(18).reduce((a, x) => a + Math.max(0, x), 0) + after.bar;
  if (backAfter < backBefore && !hits) r.push('Bringt einen hinteren Stein in Sicherheit nach vorne.');
  if (after.off > before.off) r.push(`Trägt ${after.off - before.off === 1 ? 'einen Stein' : (after.off - before.off) + ' Steine'} ab.`);
  if (!fa.contact && fb.contact) r.push('Jetzt ist es ein reines <b>Wettrennen</b> – keine Berührung mehr.');
  if (!r.length) r.push('Bringt die Steine am sichersten und effizientesten nach vorne.');
  return r;
}
