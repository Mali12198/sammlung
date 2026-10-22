// Skat: Regeln (ISkO), Reizen, Spielwert und Computergegner.
// Karten: 'CJ' = Kreuz-Bube, 'HT' = Herz-Zehn … Farben C S H D, Werte 7 8 9 T J Q K A.
// Spieler 0 = du, 1 = links, 2 = rechts. Gespielt wird im Uhrzeigersinn 0 → 1 → 2.
import { shuffle } from '../../util.js';

export const SUITS = ['C', 'S', 'H', 'D'];
export const RANKS = ['7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const PTS = { A: 11, T: 10, K: 4, Q: 3, J: 2, 9: 0, 8: 0, 7: 0 };
export const BASE = { C: 12, S: 11, H: 10, D: 9, G: 24 };
export const GAME_NAME = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo', G: 'Grand', N: 'Null', R: 'Ramsch' };
export const SUIT_NAME = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' };
export const RANK_NAME = { 7: 'Sieben', 8: 'Acht', 9: 'Neun', T: 'Zehn', J: 'Bube', Q: 'Dame', K: 'König', A: 'Ass' };
export const cardName = c => `${SUIT_NAME[c[0]]}-${RANK_NAME[c[1]]}`;

export const pts = c => PTS[c[1]];
export const cardsPoints = cs => cs.reduce((a, c) => a + PTS[c[1]], 0);

export function newDeck() { return SUITS.flatMap(s => RANKS.map(r => s + r)); }
const DECK = newDeck();

export const BID_VALUES = (() => {
  const s = new Set([23, 35, 46, 59]);
  for (const b of [9, 10, 11, 12, 24]) for (let m = 2; m <= 18; m++) s.add(b * m);
  return [...s].filter(v => v >= 18).sort((a, b) => a - b);
})();
export const nextBid = v => BID_VALUES.find(x => x > v);

// ---------------------------------------------------------------
// Grundlagen: Trumpf, Farbe, Stärke, Stich
// ---------------------------------------------------------------
export const isTrump = (c, t) => t !== 'N' && (c[1] === 'J' || c[0] === t);
export const effSuit = (c, t) => (isTrump(c, t) ? 'T' : c[0]);

const JACK = { C: 4, S: 3, H: 2, D: 1 };
const ORD = { 7: 1, 8: 2, 9: 3, Q: 4, K: 5, T: 6, A: 7, J: 0 };
const NULL_ORD = { 7: 1, 8: 2, 9: 3, T: 4, J: 5, Q: 6, K: 7, A: 8 };

export function power(c, t) {
  if (t === 'N') return NULL_ORD[c[1]];
  if (c[1] === 'J') return 20 + JACK[c[0]];
  return ORD[c[1]];
}

// a wurde nach b gespielt; b gewinnt bisher den Stich
export function beats(a, b, t) {
  const ea = effSuit(a, t), eb = effSuit(b, t);
  if (ea === eb) return power(a, t) > power(b, t);
  return ea === 'T';
}

export function trickWinnerIdx(cards, t) {
  let w = 0;
  for (let i = 1; i < cards.length; i++) if (beats(cards[i], cards[w], t)) w = i;
  return w;
}

export function legalCards(hand, trick, t) {
  if (!trick.length) return hand.slice();
  const led = effSuit(trick[0].c, t);
  const f = hand.filter(c => effSuit(c, t) === led);
  return f.length ? f : hand.slice();
}

// Sortierung für die Anzeige: Buben, Trumpf, dann abwechselnd schwarz/rot
function suitOrder(t) {
  if (!'CSHD'.includes(t || 'x')) return ['C', 'H', 'S', 'D'];
  const black = ['C', 'S'], red = ['H', 'D'];
  const same = black.includes(t) ? black : red, oth = black.includes(t) ? red : black;
  return [t, oth[0], same.find(s => s !== t), oth[1]];
}
export function sortHand(hand, t) {
  const order = suitOrder(t);
  const key = c => {
    if (t !== 'N' && c[1] === 'J') return 1000 + JACK[c[0]];
    return (10 - order.indexOf(c[0])) * 20 + (t === 'N' ? NULL_ORD[c[1]] : ORD[c[1]]);
  };
  return hand.slice().sort((a, b) => key(b) - key(a));
}

// ---------------------------------------------------------------
// Spielwert
// ---------------------------------------------------------------
export function trumpSequence(t) {
  const js = ['CJ', 'SJ', 'HJ', 'DJ'];
  if (t === 'G') return js;
  return js.concat(['A', 'T', 'K', 'Q', '9', '8', '7'].map(r => t + r));
}

// Spitzen: „mit n“ oder „ohne n“ (die Skatkarten zählen mit)
export function matadors(cards, t) {
  const seq = trumpSequence(t);
  const has = c => cards.includes(c);
  const mit = has(seq[0]);
  let n = 0;
  for (const c of seq) { if (has(c) === mit) n++; else break; }
  return { mit, n };
}

export function nullValue(g) { return g.ouvert ? (g.hand ? 59 : 46) : (g.hand ? 35 : 23); }

// Stufen eines Farb-/Grandspiels mit Erklärung
export function levels(g, cards12, { schneider = false, schwarz = false } = {}) {
  const m = matadors(cards12, g.type);
  const L = [[`${m.mit ? 'mit' : 'ohne'} ${m.n}`, m.n], ['Spiel', 1]];
  if (g.hand) L.push(['Hand', 1]);
  if (schneider || g.schneider || g.schwarz) L.push(['Schneider', 1]);
  if (g.schneider || g.schwarz) L.push(['Schneider angesagt', 1]);
  if (schwarz || g.schwarz) L.push(['Schwarz', 1]);
  if (g.schwarz) L.push(['Schwarz angesagt', 1]);
  if (g.ouvert) L.push(['Ouvert', 1]);
  return { lines: L, mult: L.reduce((a, x) => a + x[1], 0), mat: m };
}

export function gameValue(g, cards12, extra) {
  if (g.type === 'N') return nullValue(g);
  return BASE[g.type] * levels(g, cards12, extra).mult;
}

// ---------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------
// opts: { ramsch, kontra, bock } – Hausregeln (Ramsch statt Einpassen, Kontra/Re, Bockspiel zählt doppelt)
export function newRound(dealer, rnd = Math.random, opts = {}) {
  const d = shuffle(DECK.slice(), rnd);
  const V = (dealer + 1) % 3, M = (dealer + 2) % 3, H = dealer;
  return {
    dealer, V, M, H,
    opts: { ramsch: !!opts.ramsch, kontra: !!opts.kontra }, bock: !!opts.bock, kontra: null,
    hands: [d.slice(0, 10), d.slice(10, 20), d.slice(20, 30)],
    skat: d.slice(30),
    phase: 'bid',
    bid: { value: 0, stage: 1, sager: M, hoerer: V, turn: M, wait: 'say', passed: [false, false, false], said: {} },
    declarer: -1, game: null, skatTaken: false, put: null, decl12: null,
    trick: [], leader: V, turn: V, tricks: [], taken: [[], [], []],
    voids: [{}, {}, {}], result: null,
  };
}

// Reizen. action: 'say' (nächster Wert), 'pass', 'yes' (halten), 'play' (Vorhand spielt 18)
export function bidAction(s, p, action) {
  const b = s.bid;
  if (p !== b.turn) throw new Error('nicht am Zug beim Reizen');
  if (b.stage === 3) {
    if (action === 'play') { b.value = 18; b.said[p] = '18'; return finishBid(s, p); }
    b.said[p] = 'Passe'; b.passed[p] = true;
    if (s.opts && s.opts.ramsch) return startRamsch(s);
    s.phase = 'allpass';
    return;
  }
  if (b.wait === 'say') {
    if (action === 'say' && !nextBid(b.value)) action = 'pass';
    if (action === 'say') {
      b.value = nextBid(b.value);
      b.said[p] = String(b.value);
      b.wait = 'answer'; b.turn = b.hoerer;
    } else { b.said[p] = 'Passe'; b.passed[p] = true; stageDone(s, b.hoerer); }
  } else {
    if (action === 'yes') { b.said[p] = 'Ja'; b.wait = 'say'; b.turn = b.sager; }
    else { b.said[p] = 'Passe'; b.passed[p] = true; stageDone(s, b.sager); }
  }
}

function stageDone(s, winner) {
  const b = s.bid;
  if (b.stage === 1) {
    b.stage = 2; b.sager = s.H; b.hoerer = winner; b.wait = 'say'; b.turn = s.H;
    return;
  }
  if (b.value === 0) { b.stage = 3; b.turn = winner; b.wait = 'open'; return; }
  finishBid(s, winner);
}

function finishBid(s, p) {
  s.declarer = p;
  s.phase = 'skat';
  s.bid.turn = -1;
}

// Ramsch: alle haben gepasst. Nur Buben sind Trumpf, jeder spielt für sich, wer die meisten Augen hat, verliert.
// Der Skat geht an den Gewinner des letzten Stichs.
export function startRamsch(s) {
  s.game = { type: 'R' };
  s.declarer = -1;
  s.put = s.skat.slice();
  s.phase = 'play';
  s.leader = s.turn = s.V;
}

export function takeSkat(s) {
  s.hands[s.declarer].push(...s.skat);
  s.skatTaken = true;
  s.phase = 'declare';
}

// game: { type, hand, ouvert, schneider, schwarz }  put: zwei Karten (nur nach Skataufnahme)
export function declare(s, game, put) {
  const d = s.declarer;
  if (s.skatTaken) {
    if (!put || put.length !== 2) throw new Error('zwei Karten drücken');
    for (const c of put) {
      const i = s.hands[d].indexOf(c);
      if (i < 0) throw new Error('Karte nicht auf der Hand: ' + c);
      s.hands[d].splice(i, 1);
    }
    s.put = put.slice();
  } else s.put = s.skat.slice();
  s.game = { type: game.type, hand: !s.skatTaken, ouvert: !!game.ouvert, schneider: !!game.schneider, schwarz: !!game.schwarz };
  if (s.game.schwarz) s.game.schneider = true;
  s.decl12 = s.hands[d].concat(s.put);
  s.phase = 'play';
  s.leader = s.turn = s.V;
  if (s.opts && s.opts.kontra) s.kontra = { by: -1, re: false };
}

// Kontra: ein Gegenspieler, bevor er seine erste Karte spielt. Re: der Alleinspieler nach Kontra,
// bevor er seine zweite Karte spielt.
const playedBy = (s, p) => s.tricks.reduce((a, tr) => a + tr.cards.filter(x => x.p === p).length, 0) + s.trick.filter(x => x.p === p).length;
export function canKontra(s, p) {
  return !!s.kontra && s.kontra.by < 0 && s.phase === 'play' && p !== s.declarer && s.turn === p && playedBy(s, p) === 0;
}
export function canRe(s, p) {
  return !!s.kontra && s.kontra.by >= 0 && !s.kontra.re && s.phase === 'play' && p === s.declarer && s.turn === p && playedBy(s, p) < 2;
}
export function sayKontra(s, p) { if (!canKontra(s, p)) throw new Error('Kontra nicht möglich'); s.kontra.by = p; }
export function sayRe(s, p) { if (!canRe(s, p)) throw new Error('Re nicht möglich'); s.kontra.re = true; }
export const kontraFactor = s => (!s.kontra || s.kontra.by < 0 ? 1 : s.kontra.re ? 4 : 2);

export function legalFor(s, p) { return legalCards(s.hands[p], s.trick, s.game.type); }

export function playCard(s, p, c) {
  if (s.phase !== 'play' || s.turn !== p) throw new Error('nicht am Zug');
  const t = s.game.type;
  if (!legalFor(s, p).includes(c)) throw new Error('Karte nicht erlaubt: ' + c);
  s.hands[p].splice(s.hands[p].indexOf(c), 1);
  if (s.trick.length) {
    const led = effSuit(s.trick[0].c, t);
    if (effSuit(c, t) !== led) s.voids[p][led] = true;
  }
  s.trick.push({ p, c });
  if (s.trick.length === 3) { s.turn = -1; s.phase = 'collect'; }
  else s.turn = (p + 1) % 3;
}

export function collectTrick(s) {
  const t = s.game.type;
  const wi = trickWinnerIdx(s.trick.map(x => x.c), t);
  const winner = s.trick[wi].p;
  s.tricks.push({ cards: s.trick, winner });
  s.taken[winner].push(...s.trick.map(x => x.c));
  s.trick = [];
  s.leader = s.turn = winner;
  s.phase = 'play';
  const over = s.tricks.length === 10 || (t === 'N' && winner === s.declarer);
  if (over) { s.phase = 'done'; s.turn = -1; s.result = t === 'R' ? settleRamsch(s) : settle(s); }
  return winner;
}

export function settle(s) {
  const d = s.declarer, g = s.game, bid = s.bid.value;
  const decTricks = s.tricks.filter(x => x.winner === d).length;
  const decPts = cardsPoints(s.taken[d]) + cardsPoints(s.put);
  const r = { decPts, defPts: 120 - decPts, decTricks, bid, overbid: false, reasons: [] };
  if (g.type === 'N') {
    r.value = nullValue(g);
    r.won = decTricks === 0;
    r.lines = [[`Null${g.ouvert ? ' ouvert' : ''}${g.hand ? ' Hand' : ''}`, r.value]];
    if (!r.won) r.reasons.push('Der Alleinspieler hat einen Stich bekommen.');
    if (r.value < bid) { r.overbid = true; r.won = false; r.reasons.push(`Überreizt: gereizt ${bid}, das Spiel ist nur ${r.value} wert.`); }
  } else {
    const schwarz = decTricks === 10 || decTricks === 0;
    const schneider = decPts >= 90 || decPts <= 30;
    const L = levels(g, s.decl12, { schneider, schwarz });
    r.lines = L.lines; r.mult = L.mult; r.base = BASE[g.type];
    r.value = BASE[g.type] * L.mult;
    r.won = decPts >= 61;
    if (!r.won) r.reasons.push(`Der Alleinspieler hat nur ${decPts} Augen – 61 braucht er.`);
    if (g.schneider && decPts < 90) { if (r.won) r.reasons.push('Schneider war angesagt, aber nicht erreicht.'); r.won = false; }
    if (g.schwarz && decTricks < 10) { if (r.won) r.reasons.push('Schwarz war angesagt, aber nicht erreicht.'); r.won = false; }
    if (r.value < bid) {
      r.overbid = true; r.won = false;
      const v2 = BASE[g.type] * Math.ceil(bid / BASE[g.type]);
      r.reasons.push(`Überreizt: gereizt ${bid}, das Spiel ist nur ${r.value} wert. Gewertet wird ${v2}.`);
      r.value = v2;
    }
    r.schneider = schneider; r.schwarz = schwarz;
  }
  r.kontra = kontraFactor(s);
  r.bock = s.bock ? 2 : 1;
  r.score = (r.won ? r.value : -2 * r.value) * r.kontra * r.bock;
  return r;
}

// Ramsch-Abrechnung: Augen je Spieler (Skat an den letzten Stich), Verlierer bekommt seine Augen als Minus.
// Jungfrau (jemand ohne Stich): doppelt. Durchmarsch (alle Stiche): +120 für den Durchmarschierer.
export function settleRamsch(s) {
  const last = s.tricks[s.tricks.length - 1].winner;
  const pts = [0, 1, 2].map(p => cardsPoints(s.taken[p]) + (p === last ? cardsPoints(s.put) : 0));
  const tricks = [0, 1, 2].map(p => s.tricks.filter(x => x.winner === p).length);
  const bock = s.bock ? 2 : 1;
  const r = { ramsch: true, pts, tricks, skatTo: last, bock, scores: [0, 0, 0], losers: [], durchmarsch: -1, jungfrau: false };
  const dm = tricks.indexOf(10);
  if (dm >= 0) {
    r.durchmarsch = dm;
    r.scores[dm] = 120 * bock;
    return r;
  }
  const max = Math.max(...pts);
  r.losers = [0, 1, 2].filter(p => pts[p] === max);
  r.jungfrau = tricks.some(n => n === 0);
  for (const p of r.losers) r.scores[p] = -max * (r.jungfrau ? 2 : 1) * bock;
  return r;
}

// ---------------------------------------------------------------
// Handbewertung für Reizen und Spielwahl
// ---------------------------------------------------------------
function bySuit(hand, t) {
  const m = { C: [], S: [], H: [], D: [] };
  for (const c of hand) if (!isTrump(c, t)) m[c[0]].push(c[1]);
  return m;
}

// Stärke eines Farbspiels (t = C/S/H/D) oder Grands (G). Ca. 7 = solide spielbar.
export function strength(hand, t, put = []) {
  const trumps = hand.filter(c => isTrump(c, t));
  const jacks = hand.filter(c => c[1] === 'J').map(c => c[0]);
  const side = bySuit(hand, t);
  let s = 0;
  if (t === 'G') {
    s += jacks.length * 1.55;
    if (jacks.includes('C')) s += 0.6;
    if (jacks.includes('C') && jacks.includes('S')) s += 0.4;
    if (jacks.length <= 1) s -= 1.2;
    for (const su of SUITS) {
      const r = side[su];
      if (!r.length) { s += 0.25; continue; }
      const A = r.includes('A'), T = r.includes('T');
      if (A) s += 1.45;
      if (T) s += A ? 1.15 : (r.length >= 3 ? 0.45 : r.length === 2 && r.includes('K') ? 0.35 : -0.35);
      if (A && T && r.length > 3) s += 0.55 * (r.length - 3);
      if (A && T && r.includes('K')) s += 0.35;
      if (!A && !T) s -= 0.15 * r.length;
    }
  } else {
    for (const c of trumps) s += c[1] === 'J' ? 1.0 : 'AT'.includes(c[1]) ? 0.95 : 0.8;
    if (jacks.includes('C')) s += 1.0;
    if (jacks.includes('S')) s += 0.6;
    if (jacks.includes('H')) s += 0.3;
    if (jacks.includes('D')) s += 0.15;
    if (hand.includes(t + 'A')) s += 0.45;
    if (hand.includes(t + 'T')) s += 0.25;
    if (jacks.length === 0) s -= 0.6;
    for (const su of SUITS) {
      if (su === t) continue;
      const r = side[su];
      if (!r.length) { s += trumps.length >= 5 ? 0.65 : 0.25; continue; }
      const A = r.includes('A'), T = r.includes('T');
      if (A) s += 1.0;
      if (T) s += A ? 0.7 : (r.length >= 3 ? 0.15 : -0.45);
      if (r.length === 1 && !A) s += 0.15;
      if (r.length >= 3 && !A) s -= 0.25;
    }
  }
  s += cardsPoints(put) * 0.025;
  return s;
}

// Wie viele „gefährliche“ Karten hat ein Nullspiel?
export function nullRisk(hand) {
  let risk = 0;
  for (const su of SUITS) {
    const r = hand.filter(c => c[0] === su).map(c => NULL_ORD[c[1]] - 1).sort((a, b) => a - b);
    // sicher, wenn die i-te kleinste Karte höchstens den Rang 2i hat
    r.forEach((v, i) => { if (v > 2 * i) risk += v > 2 * i + 2 ? 1 : 0.6; });
  }
  return risk;
}

export const THRESH = { leicht: 6.7, mittel: 7.3, schwer: 7.2 };
export const GRAND_THRESH = { leicht: 6.2, mittel: 6.8, schwer: 6.7 };

// Bestes Spiel ohne Skat (zum Reizen). Liefert Kandidaten mit Wert.
export function bidOptions(hand, level = 'mittel', pos = 'M') {
  const res = [];
  const posBonus = pos === 'V' ? 0.3 : 0;
  for (const t of SUITS) {
    const st = strength(hand, t) + posBonus + 0.5; // Skat bringt im Schnitt etwas
    const m = matadors(hand, t);
    const n = m.mit ? m.n : Math.min(m.n, 3);
    res.push({ type: t, strength: st, margin: st - THRESH[level], value: BASE[t] * (n + 1), mat: m });
  }
  const gs = strength(hand, 'G') + posBonus + 0.4;
  const gm = matadors(hand, 'G');
  res.push({ type: 'G', strength: gs, margin: gs - GRAND_THRESH[level], value: 24 * ((gm.mit ? gm.n : Math.min(gm.n, 2)) + 1), mat: gm });
  const nr = nullRisk(hand);
  res.push({ type: 'N', strength: 0, margin: nr <= 0.6 ? 0.5 : nr <= 1.6 ? -0.2 : -3, value: nr === 0 ? 35 : 23, risk: nr });
  return res;
}

export function maxBid(hand, level = 'mittel', pos = 'M') {
  const opts = bidOptions(hand, level, pos).filter(o => o.margin >= 0);
  if (!opts.length) return 0;
  return Math.max(...opts.map(o => o.value));
}

// Nach Skataufnahme: bestes Spiel und Drücken wählen
export function chooseDeclaration(hand12, bid, level = 'mittel') {
  let best = null;
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
    const put = [hand12[i], hand12[j]];
    const rest = hand12.filter((_, k) => k !== i && k !== j);
    for (const t of ['C', 'S', 'H', 'D', 'G']) {
      // keine Buben drücken, keine Trümpfe im Farbspiel (meist schlecht)
      if (put.some(c => isTrump(c, t))) continue;
      const v = gameValue({ type: t, hand: false }, hand12, {});
      const st = strength(rest, t, put);
      let margin = st - (t === 'G' ? GRAND_THRESH[level] : THRESH[level]);
      if (v < bid) margin -= 4 + (bid - v) / 10;
      if (!best || margin > best.margin) best = { type: t, put, margin, value: v };
    }
    const nr = nullRisk(rest);
    const nm = (nr === 0 ? 1.2 : nr <= 0.6 ? 0.2 : -2 - nr) - (bid > 23 ? 9 : 0);
    if (!best || nm > best.margin) best = { type: 'N', put, margin: nm, value: 23 };
  }
  // Null ouvert, wenn absolut sicher und Reizwert es verlangt
  if (best.type === 'N' && bid > 23 && bid <= 46) {
    const rest = hand12.filter(c => !best.put.includes(c));
    if (nullRisk(rest) === 0) return { game: { type: 'N', ouvert: true }, put: best.put, margin: best.margin };
  }
  return { game: { type: best.type }, put: best.put, margin: best.margin };
}

// Soll der Alleinspieler Hand spielen?
export function chooseHandGame(hand10, bid, level = 'mittel') {
  let best = null;
  for (const t of ['C', 'S', 'H', 'D', 'G']) {
    const st = strength(hand10, t);
    const v = BASE[t] * (matadors(hand10, t).n + 2);
    const margin = st - (t === 'G' ? GRAND_THRESH[level] : THRESH[level]) - 1.1;
    if (v >= bid && margin >= 0 && (!best || margin > best.margin)) best = { game: { type: t, hand: true }, margin };
  }
  const nr = nullRisk(hand10);
  if (nr === 0 && bid <= 35 && (!best || best.margin < 1)) best = { game: { type: 'N', hand: true }, margin: 1 };
  return best;
}

// ---------------------------------------------------------------
// Kartenspiel des Computers
// ---------------------------------------------------------------
function ctx(s, p) {
  const g = s.game, t = g.type;
  const hand = s.hands[p];
  const seen = new Set(hand);
  for (const tr of s.tricks) for (const x of tr.cards) seen.add(x.c);
  for (const x of s.trick) seen.add(x.c);
  if (p === s.declarer && s.put) for (const c of s.put) seen.add(c);
  let openHand = null;
  if (g.ouvert && p !== s.declarer) openHand = s.hands[s.declarer];
  const others = DECK.filter(c => !seen.has(c));
  const isDecl = p === s.declarer;
  return { s, p, t, hand, others, isDecl, partner: isDecl ? -1 : 3 - p - s.declarer, decl: s.declarer, openHand };
}

const isT = (C, c) => isTrump(c, C.t);
const higherOut = (C, c) => C.others.filter(o => effSuit(o, C.t) === effSuit(c, C.t) && power(o, C.t) > power(c, C.t));
const isTop = (C, c) => higherOut(C, c).length === 0;
const othersTrumps = C => C.others.filter(c => isT(C, c));

function trickInfo(C) {
  const tr = C.s.trick;
  if (!tr.length) return null;
  const wi = trickWinnerIdx(tr.map(x => x.c), C.t);
  return { led: effSuit(tr[0].c, C.t), win: tr[wi], pts: cardsPoints(tr.map(x => x.c)), n: tr.length };
}

// Spieler, die nach mir in diesem Stich noch kommen
function afterMe(C) {
  const res = [];
  const left = 2 - C.s.trick.length;
  for (let k = 1; k <= left; k++) res.push((C.p + k) % 3);
  return res;
}

// Kann ein Gegner (der nach mir kommt) diese Karte noch überstechen?
function safeWin(C, c, led) {
  const t = C.t;
  for (const q of afterMe(C)) {
    if (q === C.partner) continue;
    const v = C.s.voids[q];
    if (C.openHand && q === C.decl) {
      const leg = legalCards(C.openHand, C.s.trick.concat([{ p: C.p, c }]), t);
      if (leg.some(o => beats(o, c, t))) return false;
      continue;
    }
    if (!v[led]) {
      if (effSuit(c, t) === led && C.others.some(o => effSuit(o, t) === led && power(o, t) > power(c, t))) return false;
    } else if (led !== 'T' && !v.T) {
      const tr = othersTrumps(C);
      if (effSuit(c, t) === 'T' ? tr.some(o => power(o, t) > power(c, t)) : tr.length) return false;
    }
  }
  return true;
}

function rankIn(C, c) { // 0 = schwächste Karte ihrer Farbe
  return power(c, C.t);
}

function winCost(C, c) { return (isT(C, c) ? 20 : 0) + rankIn(C, c) + (c[1] === 'J' ? 10 : 0); }

function keepValue(C, c) {
  const t = C.t;
  if (c[1] === 'J') return 12 + JACK[c[0]];
  if (isT(C, c)) return 4 + power(c, t) * 0.6;
  let k = 0;
  const declVoid = C.isDecl ? false : !!C.s.voids[C.decl][c[0]];
  if (isTop(C, c) && !declVoid) k += c[1] === 'A' ? 8 : c[1] === 'T' ? 6 : 3;
  const len = C.hand.filter(x => !isT(C, x) && x[0] === c[0]).length;
  if (len === 1) k -= 1.5;
  return k;
}

function lowest(C, cards) {
  return cards.slice().sort((a, b) => (pts(a) + keepValue(C, a)) - (pts(b) + keepValue(C, b)) || power(a, C.t) - power(b, C.t))[0];
}
function cheapestWinner(C, cards) { return cards.slice().sort((a, b) => winCost(C, a) - winCost(C, b))[0]; }
function bestSchmier(C, cards) {
  return cards.slice().sort((a, b) => (pts(b) - keepValue(C, b) * 0.7) - (pts(a) - keepValue(C, a) * 0.7))[0];
}

const nm = c => `<b>${cardName(c)}</b>`;

export function policy(s, p) {
  const legal = legalFor(s, p);
  if (legal.length === 1) return { card: legal[0], why: 'Das ist deine einzige erlaubte Karte.' };
  const C = ctx(s, p);
  if (C.t === 'N') return nullPolicy(C, legal);
  if (C.t === 'R') return ramschPolicy(C, legal);
  const ti = trickInfo(C);
  if (!ti) return C.isDecl ? declLead(C, legal) : defLead(C, legal);
  return follow(C, legal, ti);
}

function declLead(C, legal) {
  const myT = legal.filter(c => isT(C, c));
  const oT = othersTrumps(C);
  if (myT.length && oT.length) {
    const top = myT.slice().sort((a, b) => power(b, C.t) - power(a, C.t))[0];
    if (isTop(C, top)) return { card: top, why: `Trumpf ziehen: ${nm(top)} ist der höchste Trumpf im Spiel. So holst du den Gegnern ihre Trümpfe raus, bevor sie deine Asse stechen.` };
    if (myT.length > oT.length - 1 || myT.length >= 5) {
      const low = myT.slice().sort((a, b) => (pts(a) + (a[1] === 'J' ? 8 + JACK[a[0]] : power(a, C.t))) - (pts(b) + (b[1] === 'J' ? 8 + JACK[b[0]] : power(b, C.t))))[0];
      return { card: low, why: `Trumpf ziehen: Du hast mehr Trümpfe als die Gegner. Ein kleiner Trumpf zwingt sie, ihre Trümpfe herzugeben.` };
    }
  }
  const sure = legal.filter(c => !isT(C, c) && isTop(C, c) && (!oT.length || !defVoid(C, c[0])));
  if (sure.length) {
    const c = sure.sort((a, b) => pts(b) - pts(a))[0];
    return { card: c, why: `${nm(c)} ist die höchste Karte ihrer Farbe – ein sicherer Stich${oT.length ? '' : ', die Gegner haben keine Trümpfe mehr'}.` };
  }
  const side = legal.filter(c => !isT(C, c));
  if (side.length) {
    const c = lowest(C, side);
    return { card: c, why: 'Eine kleine Karte abgeben: Hier ist kein sicherer Stich, also möglichst wenig Augen riskieren.' };
  }
  const c = myT.sort((a, b) => power(a, C.t) - power(b, C.t))[0];
  return { card: c, why: 'Nur noch Trümpfe – der kleinste reicht.' };
}

function defVoid(C, suit) { return [0, 1, 2].some(q => q !== C.p && C.s.voids[q][suit]); }

function defLead(C, legal) {
  const v = C.s.voids[C.decl];
  const side = legal.filter(c => !isT(C, c));
  const aces = side.filter(c => c[1] === 'A' && !v[c[0]]);
  if (aces.length) {
    const c = aces.sort((a, b) => C.hand.filter(x => x[0] === a[0]).length - C.hand.filter(x => x[0] === b[0]).length)[0];
    return { card: c, why: `Ass abziehen: Solange der Alleinspieler ${C.t === 'G' ? 'die Farbe' : 'noch'} bedienen muss, bringt ${nm(c)} sicher 11 Augen.` };
  }
  const tens = side.filter(c => c[1] === 'T' && isTop(C, c) && !v[c[0]]);
  if (tens.length) return { card: tens[0], why: `Das Ass dieser Farbe ist schon gefallen – jetzt ist ${nm(tens[0])} die höchste Karte.` };
  const pv = C.s.voids[C.partner];
  const forPartner = side.filter(c => pv[c[0]] && !pv.T && !v[c[0]]);
  if (forPartner.length) {
    const c = lowest(C, forPartner);
    return { card: c, why: `Dein Mitspieler hat diese Farbe nicht mehr und kann stechen.` };
  }
  const declNext = (C.p + 1) % 3 === C.decl;
  const groups = {};
  for (const c of side) (groups[c[0]] = groups[c[0]] || []).push(c);
  let suits = Object.keys(groups).filter(su => !v[su]);
  if (!suits.length) suits = Object.keys(groups);
  if (suits.length) {
    suits.sort((a, b) => declNext ? groups[b].length - groups[a].length : groups[a].length - groups[b].length);
    const g = groups[suits[0]].filter(c => !(c[1] === 'T' && groups[suits[0]].length <= 2 && higherOut(C, c).length));
    const c = lowest(C, g.length ? g : groups[suits[0]]);
    return { card: c, why: declNext
      ? 'Kurzer Weg, lange Farbe: Der Alleinspieler sitzt direkt hinter dir – spiel deine lange Farbe an.'
      : 'Langer Weg, kurze Farbe: Der Alleinspieler sitzt hinten – spiel deine kurze Farbe, damit dein Mitspieler später stechen kann.' };
  }
  const c = legal.slice().sort((a, b) => power(a, C.t) - power(b, C.t))[0];
  return { card: c, why: 'Nur noch Trümpfe übrig.' };
}

function follow(C, legal, ti) {
  const partnerWins = !C.isDecl && ti.win.p === C.partner;
  const last = ti.n === 2;
  const winners = legal.filter(c => beats(c, ti.win.c, C.t));
  if (partnerWins) {
    const safe = last || safeWin({ ...C, p: ti.win.p, partner: C.p }, ti.win.c, ti.led);
    if (safe) {
      const c = bestSchmier(C, legal);
      if (pts(c) >= 3) return { card: c, why: `Schmieren: Dein Mitspieler bekommt den Stich sicher – gib ihm mit ${nm(c)} viele Augen mit.` };
      return { card: lowest(C, legal), why: 'Dein Mitspieler gewinnt den Stich – du musst nichts tun.' };
    }
    return { card: lowest(C, legal), why: 'Dein Mitspieler liegt vorne, aber der Alleinspieler kommt noch. Lieber nichts Wertvolles zugeben.' };
  }
  if (winners.length) {
    if (last) {
      const c = cheapestWinner(C, winners);
      const worth = !isT(C, c) || ti.pts + pts(c) >= 10 || (c[1] !== 'J' && ti.pts >= 3) || (C.isDecl && ti.pts >= 2);
      if (worth) return { card: c, why: `Du sitzt hinten: Mit ${nm(c)} holst du den Stich (${ti.pts} Augen liegen drin).` };
    } else {
      const safe = winners.filter(c => safeWin(C, c, ti.led));
      if (safe.length) {
        const c = cheapestWinner(C, safe);
        const worth = !isT(C, c) || ti.pts + pts(c) >= 10 || (c[1] !== 'J' && ti.pts >= 4);
        if (worth) return { card: c, why: `${nm(c)} kann niemand mehr überstechen – der Stich gehört dir.` };
      }
      if (!C.isDecl && ti.win.p === C.decl && afterMe(C).includes(C.partner)) {
        return { card: lowest(C, legal), why: 'Dein Mitspieler sitzt hinter dir und kann den Stich noch holen. Gib erst einmal wenig.' };
      }
    }
  }
  const c = lowest(C, legal);
  const canFollow = legal.some(x => effSuit(x, C.t) === ti.led);
  return { card: c, why: canFollow ? 'Den Stich bekommst du nicht – gib die kleinste Karte zu.' : 'Du kannst nicht bedienen. Wirf eine Karte ab, die dir am wenigsten fehlt – am besten aus einer kurzen Farbe.' };
}

function nullPolicy(C, legal) {
  const t = 'N';
  const ti = trickInfo(C);
  const higher = c => C.others.filter(o => o[0] === c[0] && NULL_ORD[o[1]] > NULL_ORD[c[1]]).length;
  const lower = c => C.others.filter(o => o[0] === c[0] && NULL_ORD[o[1]] < NULL_ORD[c[1]]).length;
  if (C.isDecl) {
    if (!ti) {
      // Karte, die ein Gegner sicher überstechen kann
      const c = legal.slice().sort((a, b) => (lower(a) - higher(a) * 0.5) - (lower(b) - higher(b) * 0.5) || NULL_ORD[a[1]] - NULL_ORD[b[1]])[0];
      return { card: c, why: 'Im Nullspiel spielst du Karten an, die die Gegner überstechen müssen.' };
    }
    const win = ti.win.c;
    const follows = legal.filter(c => c[0] === ti.led);
    if (follows.length) {
      const under = follows.filter(c => !beats(c, win, t));
      if (under.length) return { card: under.sort((a, b) => NULL_ORD[b[1]] - NULL_ORD[a[1]])[0], why: 'Drunterbleiben: die höchste Karte, die den Stich noch nicht gewinnt.' };
      return { card: follows.sort((a, b) => NULL_ORD[a[1]] - NULL_ORD[b[1]])[0], why: 'Du musst höher bedienen – hoffentlich sticht noch jemand drüber.' };
    }
    const c = legal.slice().sort((a, b) => (higher(a) - higher(b)) || NULL_ORD[b[1]] - NULL_ORD[a[1]])[0];
    return { card: c, why: 'Nicht bedienen können ist im Null ein Geschenk: Wirf deine gefährlichste Karte ab.' };
  }
  // Gegenspieler: den Alleinspieler zum Stich zwingen
  const dv = C.s.voids[C.decl];
  if (!ti) {
    const cands = legal.filter(c => !dv[c[0]]);
    const pool = cands.length ? cands : legal;
    const c = pool.slice().sort((a, b) => NULL_ORD[a[1]] - NULL_ORD[b[1]])[0];
    return { card: c, why: 'Gegen ein Nullspiel spielst du kleine Karten an – der Alleinspieler soll drüber müssen.' };
  }
  const declPlayed = C.s.trick.some(x => x.p === C.decl);
  const win = ti.win;
  if (declPlayed && win.p === C.decl) {
    const under = legal.filter(c => !beats(c, win.c, t));
    if (under.length) return { card: under.sort((a, b) => NULL_ORD[b[1]] - NULL_ORD[a[1]])[0], why: 'Der Alleinspieler liegt vorne – bleib drunter, dann muss er den Stich nehmen!' };
  }
  const c = legal.slice().sort((a, b) => NULL_ORD[a[1]] - NULL_ORD[b[1]])[0];
  if (!declPlayed) return { card: c, why: 'Der Alleinspieler kommt noch: Gib klein zu, damit er drüber muss.' };
  const high = legal.slice().sort((a, b) => NULL_ORD[b[1]] - NULL_ORD[a[1]])[0];
  return { card: high, why: 'Den Stich bekommt ihr ohnehin – nutze ihn, um eine hohe Karte loszuwerden.' };
}

// Ramsch: möglichst wenig Augen nehmen. Drunterbleiben, hohe Karten loswerden, früh Farben blank machen.
function ramschPolicy(C, legal) {
  const t = 'R';
  const ti = trickInfo(C);
  const higher = c => C.others.filter(o => effSuit(o, t) === effSuit(c, t) && power(o, t) > power(c, t)).length;
  const lenOf = c => C.hand.filter(x => effSuit(x, t) === effSuit(c, t)).length;
  if (!ti) {
    // Anspielen: eine Karte, die sicher überstochen wird – gern aus einer kurzen Farbe
    const score = c => (c[1] === 'J' ? -6 : 0) + Math.min(higher(c), 3) * 2 - pts(c) * 0.25 - lenOf(c) * 0.4 - (higher(c) === 0 ? 8 : 0);
    const c = legal.slice().sort((a, b) => score(b) - score(a))[0];
    return { card: c, why: higher(c) ? 'Im Ramsch willst du keine Stiche: Spiel eine kleine Karte an, die sicher überstochen wird – am besten aus einer kurzen Farbe, damit du sie bald nicht mehr hast.' : 'Leider hast du nur noch Karten, die gewinnen könnten – nimm die mit den wenigsten Augen.' };
  }
  const win = ti.win.c;
  const last = ti.n === 2;
  const follows = legal.filter(c => effSuit(c, t) === ti.led);
  if (follows.length) {
    const under = follows.filter(c => !beats(c, win, t));
    if (under.length) {
      const c = under.sort((a, b) => power(b, t) - power(a, t))[0];
      return { card: c, why: `Drunterbleiben: ${nm(c)} ist deine höchste Karte, die den Stich nicht gewinnt – so wirst du sie gefahrlos los.` };
    }
    if (last) {
      const c = follows.sort((a, b) => power(b, t) - power(a, t))[0];
      return { card: c, why: 'Den Stich musst du nehmen – dann wenigstens mit deiner höchsten Karte dieser Farbe, die dir später sonst wieder einen Stich einbrockt.' };
    }
    const c = follows.sort((a, b) => power(a, t) - power(b, t))[0];
    return { card: c, why: 'Du musst höher bedienen – nimm die kleinste Karte, vielleicht sticht noch jemand drüber.' };
  }
  // Nicht bedienen: dicke Karten abwerfen (die Augen bekommt ein anderer), Buben möglichst behalten
  const side = legal.filter(c => c[1] !== 'J');
  if (side.length) {
    const c = side.sort((a, b) => (pts(b) * 2 + power(b, t)) - (pts(a) * 2 + power(a, t)))[0];
    return { card: c, why: `Du kannst nicht bedienen: Wirf ${nm(c)} ab – die Augen landen bei einem anderen.` };
  }
  const under = legal.filter(c => !beats(c, win, t));
  const c = (under.length ? under : legal).sort((a, b) => power(a, t) - power(b, t))[0];
  return { card: c, why: 'Nur noch Buben – der kleinste reicht.' };
}

// Kontra/Re des Computers: Gewinnchance des Alleinspielers per Simulation schätzen
// Aus Sicht eines Gegenspielers: nur Verteilungen, bei denen der Alleinspieler sein Spiel auch ansagen würde.
function plausibleForDeclarer(w) {
  const t = w.game.type, d = w.declarer;
  const cards = w.hands[d].concat(w.put || []);
  if (t === 'N') return nullRisk(w.hands[d]) <= 1;
  const st = strength(w.hands[d], t, w.put || []);
  return st >= (t === 'G' ? GRAND_THRESH.mittel : THRESH.mittel) - 0.8 && (t === 'G' || cards.filter(c => isTrump(c, t)).length >= 5);
}
export function declarerWinChance(s, p, samples = 24, rnd = Math.random) {
  let wins = 0;
  for (let k = 0; k < samples; k++) {
    let w = sampleWorld(s, p, rnd);
    if (p !== s.declarer) for (let a = 0; a < 30 && !plausibleForDeclarer(w); a++) w = sampleWorld(s, p, rnd);
    rolloutState(w);
    if (w.result && w.result.won) wins++;
  }
  return wins / samples;
}
function rolloutState(w) {
  let guard = 0;
  while (w.phase !== 'done' && guard++ < 60) {
    if (w.phase === 'collect') { collectTrick(w); continue; }
    playCard(w, w.turn, policy(w, w.turn).card);
  }
  if (w.phase === 'done' && !w.result) w.result = settle(w);
}
export function aiKontra(s, p, level = 'mittel', rnd = Math.random) {
  if (!canKontra(s, p) || level === 'leicht') return false;
  return declarerWinChance(s, p, level === 'schwer' ? 32 : 20, rnd) < (level === 'schwer' ? 0.3 : 0.25);
}
export function aiRe(s, p, level = 'mittel', rnd = Math.random) {
  if (!canRe(s, p) || level === 'leicht') return false;
  return declarerWinChance(s, p, level === 'schwer' ? 32 : 20, rnd) > 0.8;
}

// ---------------------------------------------------------------
// Vorausschau per Simulation (Spielstärke „schwer“ und Tipps)
// ---------------------------------------------------------------
function cloneForSim(s) {
  return {
    ...s,
    hands: s.hands.map(h => h.slice()), trick: s.trick.slice(), tricks: s.tricks.slice(),
    taken: s.taken.map(x => x.slice()), voids: s.voids.map(v => ({ ...v })), put: s.put ? s.put.slice() : null,
    game: s.game, bid: s.bid, result: null,
  };
}

// Verteilt die unbekannten Karten passend zu den bekannten Fehlfarben
export function sampleWorld(s, p, rnd = Math.random) {
  const C = ctx(s, p);
  const t = s.game.type;
  const slots = [];
  for (let q = 0; q < 3; q++) {
    if (q === p) continue;
    if (C.openHand && q === s.declarer) continue;
    slots.push({ q, n: s.hands[q].length, cards: [] });
  }
  const skatUnknown = p !== s.declarer;
  if (skatUnknown) slots.push({ q: 'skat', n: 2, cards: [] });
  const pool = C.others.filter(c => !(C.openHand && C.openHand.includes(c)));
  for (let attempt = 0; attempt < 40; attempt++) {
    for (const sl of slots) sl.cards = [];
    const cards = shuffle(pool.slice(), rnd);
    const ok = q => c => q === 'skat' || !s.voids[q][effSuit(c, t)];
    cards.sort((a, b) => slots.filter(sl => ok(sl.q)(a)).length - slots.filter(sl => ok(sl.q)(b)).length);
    let fail = false;
    for (const c of cards) {
      const el = slots.filter(sl => sl.cards.length < sl.n && (attempt > 30 || ok(sl.q)(c)));
      if (!el.length) { fail = true; break; }
      el[Math.floor(rnd() * el.length)].cards.push(c);
    }
    if (!fail) {
      const w = cloneForSim(s);
      for (const sl of slots) {
        if (sl.q === 'skat') w.put = sl.cards;
        else w.hands[sl.q] = sl.cards;
      }
      return w;
    }
  }
  return cloneForSim(s);
}

function finalUtility(w, p) {
  if (w.game.type === 'R') {
    const r = settleRamsch(w);
    return 120 - r.pts[p] - (r.losers.includes(p) ? 40 : 0) + (r.durchmarsch === p ? 150 : 0);
  }
  const r = settle(w);
  const mine = p === w.declarer;
  if (w.game.type === 'N') return (r.won === mine) ? 100 : 0;
  const myPts = mine ? r.decPts : r.defPts;
  return myPts + ((r.won === mine) ? 60 : 0) + (mine ? (r.decPts >= 90 ? 15 : 0) : (r.decPts <= 30 ? 15 : 0)) + (mine ? (r.decPts > 30 ? 10 : 0) : (r.decPts < 90 ? 10 : 0));
}

function rollout(w, p) {
  let guard = 0;
  while (w.phase !== 'done' && guard++ < 60) {
    if (w.phase === 'collect') { collectTrick(w); continue; }
    const q = w.turn;
    playCard(w, q, policy(w, q).card);
  }
  return finalUtility(w, p);
}

export function lookahead(s, p, samples = 24, rnd = Math.random) {
  const legal = legalFor(s, p);
  if (legal.length === 1) return { card: legal[0], scores: null };
  const tot = new Map(legal.map(c => [c, 0]));
  for (let k = 0; k < samples; k++) {
    const world = sampleWorld(s, p, rnd);
    for (const c of legal) {
      const w = cloneForSim(world);
      w.hands = world.hands.map(h => h.slice());
      w.taken = world.taken.map(x => x.slice());
      w.voids = world.voids.map(v => ({ ...v }));
      playCard(w, p, c);
      tot.set(c, tot.get(c) + rollout(w, p));
    }
  }
  let best = legal[0];
  for (const c of legal) if (tot.get(c) > tot.get(best)) best = c;
  return { card: best, scores: Object.fromEntries([...tot].map(([c, v]) => [c, v / samples])) };
}

export function aiCard(s, p, level = 'mittel', rnd = Math.random) {
  const legal = legalFor(s, p);
  if (legal.length === 1) return legal[0];
  if (level === 'leicht') {
    if (rnd() < 0.3) return legal[Math.floor(rnd() * legal.length)];
    return policy(s, p).card;
  }
  if (level === 'schwer' && s.hands[p].length > 1) return lookahead(s, p, 20, rnd).card;
  return policy(s, p).card;
}

// Reiz-Entscheidung des Computers
export function aiBid(s, p, level = 'mittel') {
  const b = s.bid;
  const pos = p === s.V ? 'V' : p === s.M ? 'M' : 'H';
  const max = maxBid(s.hands[p], level, pos);
  if (b.stage === 3) return max >= 18 ? 'play' : 'pass';
  if (b.wait === 'say') return nextBid(b.value) <= max ? 'say' : 'pass';
  return b.value <= max ? 'yes' : 'pass';
}
