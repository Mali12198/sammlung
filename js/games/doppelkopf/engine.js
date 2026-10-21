// Doppelkopf nach den Turnierregeln des DDV (48 Karten mit Neunen), mit Hausregel-Option
// „Zweite Dulle sticht die erste“. Spieler 0 = du, 1 links, 2 gegenüber, 3 rechts (im Uhrzeigersinn).
import { shuffle } from '../../util.js';

export const SUITS = ['C', 'S', 'H', 'D'];
export const RANKS = ['9', 'T', 'J', 'Q', 'K', 'A'];
export const PTS = { A: 11, T: 10, K: 4, Q: 3, J: 2, 9: 0 };
export const SUIT_NAME = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' };
const RANK_NAME = { 9: 'Neun', T: 'Zehn', J: 'Bube', Q: 'Dame', K: 'König', A: 'Ass' };
export const cardName = c => (c === 'HT' ? 'Herz-Zehn (Dulle)' : c === 'DA' ? 'Karo-Ass (Fuchs)' : c === 'CJ' ? 'Kreuz-Bube (Karlchen)' : `${SUIT_NAME[c[0]]}-${RANK_NAME[c[1]]}`);
export const pts = c => PTS[c[1]];
export const cardsPoints = cs => cs.reduce((a, c) => a + PTS[c[1]], 0);

export const GAME_NAME = {
  normal: 'Normalspiel', hochzeit: 'Hochzeit',
  'solo-Q': 'Damensolo', 'solo-J': 'Bubensolo', 'solo-C': 'Kreuzsolo', 'solo-S': 'Piksolo',
  'solo-H': 'Herzsolo', 'solo-D': 'Karosolo', 'solo-0': 'Fleischloser',
};
export const SOLOS = ['solo-Q', 'solo-J', 'solo-C', 'solo-S', 'solo-H', 'solo-D', 'solo-0'];
export const isSolo = t => t.startsWith('solo');
export const LEVEL_NAME = ['', null, 'keine 90', 'keine 60', 'keine 30', 'schwarz'];

export function newDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push(s + r, s + r);
  return d;
}
const DECK = newDeck();

// ---------------------------------------------------------------
// Trumpf und Rangfolge
// ---------------------------------------------------------------
const QJ = { C: 4, S: 3, H: 2, D: 1 };
const SUITRANK = { A: 4, T: 3, K: 2, 9: 1 };

// Trumpfrang (höher = stärker) oder -1
export function trumpRank(c, type) {
  const s = c[0], r = c[1];
  if (type === 'solo-0') return -1;
  if (type === 'solo-Q') return r === 'Q' ? 90 + QJ[s] : -1;
  if (type === 'solo-J') return r === 'J' ? 80 + QJ[s] : -1;
  if (c === 'HT') return 100;
  if (r === 'Q') return 90 + QJ[s];
  if (r === 'J') return 80 + QJ[s];
  const ts = type === 'solo-C' ? 'C' : type === 'solo-S' ? 'S' : type === 'solo-H' ? 'H' : 'D';
  if (s === ts) return 70 + SUITRANK[r];
  return -1;
}
export const isTrump = (c, type) => trumpRank(c, type) >= 0;
export const effSuit = (c, type) => (isTrump(c, type) ? 'T' : c[0]);

const FEHL = { A: 6, T: 5, K: 4, Q: 3, J: 2, 9: 1 };
export function power(c, type) {
  const t = trumpRank(c, type);
  return t >= 0 ? t : FEHL[c[1]];
}

// Gewinner eines (vollständigen) Stichs; lastTrick für die Dullenregel
export function trickWinnerIdx(cards, type, dulle2 = false, lastTrick = false) {
  let w = 0;
  for (let i = 1; i < cards.length; i++) {
    const a = cards[i], b = cards[w];
    const ea = effSuit(a, type), eb = effSuit(b, type);
    if (ea === eb) {
      const pa = power(a, type), pb = power(b, type);
      if (pa > pb) w = i;
      else if (pa === pb && a === 'HT' && dulle2 && !lastTrick && type !== 'solo-Q' && type !== 'solo-J' && type !== 'solo-0') w = i;
    } else if (ea === 'T') w = i;
  }
  return w;
}

export function legalCards(hand, trick, type) {
  if (!trick.length) return hand.slice();
  const led = effSuit(trick[0].c, type);
  const f = hand.filter(c => effSuit(c, type) === led);
  return f.length ? f : hand.slice();
}

function suitOrder(type) {
  if (type === 'solo-H') return ['C', 'D', 'S'];
  if (type === 'solo-C' || type === 'solo-S') return type === 'solo-C' ? ['S', 'H', 'D'] : ['C', 'H', 'D'];
  if (type === 'solo-Q' || type === 'solo-J' || type === 'solo-0') return ['C', 'H', 'S', 'D'];
  return ['C', 'H', 'S'];
}
export function sortHand(hand, type = 'normal') {
  const order = suitOrder(type);
  const key = c => {
    const t = trumpRank(c, type);
    if (t >= 0) return 1000 + t;
    return (10 - order.indexOf(c[0])) * 20 + FEHL[c[1]];
  };
  return hand.slice().sort((a, b) => key(b) - key(a));
}

// ---------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------
export function newRound(dealer, opts = {}, rnd = Math.random) {
  const d = shuffle(DECK.slice(), rnd);
  const hands = [0, 1, 2, 3].map(i => d.slice(i * 12, i * 12 + 12));
  const first = (dealer + 1) % 4;
  return {
    dealer, first, hands, opts: { dulle2: !!opts.dulle2 },
    phase: 'vorbehalt', vb: { turn: first, said: [null, null, null, null] },
    type: 'normal', soloist: -1, hochzeiter: -1, klaerung: -1,
    re: [false, false, false, false],
    known: [null, null, null, null],
    ann: { re: 0, kontra: 0 }, annLog: [],
    trick: [], leader: first, turn: -1, tricks: [], taken: [[], [], [], []], voids: [{}, {}, {}, {}],
    result: null,
  };
}

export const hasBothQueens = hand => hand.filter(c => c === 'CQ').length === 2;

// Vorbehalt: 'gesund' | 'hochzeit' | 'solo-…'
export function sayVorbehalt(s, p, what) {
  if (s.phase !== 'vorbehalt' || s.vb.turn !== p) throw new Error('nicht dran');
  if (what === 'hochzeit' && !hasBothQueens(s.hands[p])) throw new Error('keine Hochzeit möglich');
  s.vb.said[p] = what;
  const next = (p + 1) % 4;
  if (next !== s.first) { s.vb.turn = next; return; }
  // auflösen: erstes Solo in Sitzreihenfolge, sonst Hochzeit, sonst normal
  const order = [0, 1, 2, 3].map(k => (s.first + k) % 4);
  const solo = order.find(q => isSolo(s.vb.said[q]));
  const hz = order.find(q => s.vb.said[q] === 'hochzeit');
  if (solo !== undefined) {
    s.type = s.vb.said[solo]; s.soloist = solo;
    s.re = [0, 1, 2, 3].map(q => q === solo);
    s.known = s.re.map(x => (x ? 're' : 'kontra'));
  } else if (hz !== undefined) {
    s.type = 'hochzeit'; s.hochzeiter = hz;
    s.re = [0, 1, 2, 3].map(q => q === hz);
    s.known[hz] = 're';
  } else {
    s.type = 'normal';
    s.re = s.hands.map(h => h.includes('CQ'));
    // stille Hochzeit: einer hat beide Kreuz-Damen und sagt nichts → spielt allein (wie Solo gewertet)
    if (s.re.filter(Boolean).length === 1) s.silent = s.re.indexOf(true);
  }
  s.vb.turn = -1;
  s.phase = 'play';
  s.leader = s.turn = s.first;
}

export const teamOf = (s, p) => (s.re[p] ? 're' : 'kontra');

// ---------------------------------------------------------------
// Ansagen
// ---------------------------------------------------------------
// Nächste mögliche Ansage für p (Stufe 1 = Re/Kontra … 5 = schwarz) oder 0
export function nextAnnouncement(s, p) {
  if (s.phase !== 'play' && s.phase !== 'collect') return 0;
  if (s.type === 'hochzeit' && s.klaerung < 0) return 0;
  const team = teamOf(s, p);
  const other = team === 're' ? 'kontra' : 're';
  const L = s.ann[team] + 1;
  if (L > 5) return 0;
  const shift = s.type === 'hochzeit' ? s.klaerung + 1 : 0;
  let need = 12 - L - shift;
  if (L === 1 && s.ann[other] >= 1) need -= 1; // Erwiderung
  return s.hands[p].length >= need ? L : 0;
}

export function announce(s, p, level) {
  const team = teamOf(s, p);
  if (nextAnnouncement(s, p) !== level) throw new Error('Ansage nicht erlaubt');
  s.ann[team] = level;
  s.annLog.push({ p, team, level });
  s.known[p] = team;
  inferTeams(s);
}

export function annText(team, level) {
  if (level === 1) return team === 're' ? 'Re!' : 'Kontra!';
  return LEVEL_NAME[level][0].toUpperCase() + LEVEL_NAME[level].slice(1) + '!';
}

function inferTeams(s) {
  if (isSolo(s.type) || s.silent >= 0) return;
  const nRe = s.known.filter(x => x === 're').length;
  const nKo = s.known.filter(x => x === 'kontra').length;
  const reCount = s.re.filter(Boolean).length;
  if (nRe === reCount) s.known = s.known.map(x => x || 'kontra');
  else if (nKo === 4 - reCount) s.known = s.known.map(x => x || 're');
}

// ---------------------------------------------------------------
// Stiche
// ---------------------------------------------------------------
export function legalFor(s, p) { return legalCards(s.hands[p], s.trick, s.type); }

export function playCard(s, p, c) {
  if (s.phase !== 'play' || s.turn !== p) throw new Error('nicht am Zug');
  if (!legalFor(s, p).includes(c)) throw new Error('Karte nicht erlaubt: ' + c);
  s.hands[p].splice(s.hands[p].indexOf(c), 1);
  if (s.trick.length) {
    const led = effSuit(s.trick[0].c, s.type);
    if (effSuit(c, s.type) !== led) s.voids[p][led] = true;
  }
  if (c === 'CQ' && (s.type === 'normal')) { s.known[p] = 're'; inferTeams(s); }
  s.trick.push({ p, c });
  if (s.trick.length === 4) { s.turn = -1; s.phase = 'collect'; }
  else s.turn = (p + 1) % 4;
}

export function currentWinner(s) {
  const last = s.tricks.length === 11;
  const wi = trickWinnerIdx(s.trick.map(x => x.c), s.type, s.opts.dulle2, last);
  return s.trick[wi].p;
}

export function collectTrick(s) {
  const winner = currentWinner(s);
  const cards = s.trick;
  s.tricks.push({ cards, winner });
  s.taken[winner].push(...cards.map(x => x.c));
  // Hochzeit: erster Fremdstich in den ersten drei Stichen
  if (s.type === 'hochzeit' && s.klaerung < 0) {
    const k = s.tricks.length - 1;
    if (winner !== s.hochzeiter) {
      s.re[winner] = true; s.klaerung = k;
      s.known[winner] = 're';
      s.known = s.known.map(x => x || 'kontra');
    } else if (k === 2) {
      s.klaerung = k; s.alone = true;
      s.known = s.known.map((x, q) => (q === s.hochzeiter ? 're' : 'kontra'));
    }
  }
  s.trick = [];
  s.leader = s.turn = winner;
  s.phase = 'play';
  if (s.tricks.length === 12) { s.phase = 'done'; s.turn = -1; s.result = settle(s); }
  return winner;
}

// ---------------------------------------------------------------
// Abrechnung
// ---------------------------------------------------------------
const THRESH = { 2: 90, 3: 60, 4: 30 };
function meets(level, oppPts, oppTricks) {
  if (level === 5) return oppTricks === 0;
  return oppPts < THRESH[level];
}

export function settle(s) {
  const reP = [0, 1, 2, 3].filter(p => s.re[p]);
  const koP = [0, 1, 2, 3].filter(p => !s.re[p]);
  const pts = { re: reP.reduce((a, p) => a + cardsPoints(s.taken[p]), 0) };
  pts.kontra = 240 - pts.re;
  const tricks = { re: s.tricks.filter(t => s.re[t.winner]).length };
  tricks.kontra = 12 - tricks.re;
  const L = s.ann;
  const wins = X => {
    const O = X === 're' ? 'kontra' : 're';
    if (L[X] >= 2) return meets(L[X], pts[O], tricks[O]);
    if (L[O] >= 2) return !meets(L[O], pts[X], tricks[X]);
    if (X === 're') return pts.re >= ((L.kontra === 1 && L.re === 0) ? 120 : 121);
    return pts.kontra >= ((L.kontra === 1 && L.re === 0) ? 121 : 120);
  };
  const reWins = wins('re'), koWins = wins('kontra');
  const winner = reWins ? 're' : koWins ? 'kontra' : null;
  const solo = isSolo(s.type) || s.silent >= 0 || s.alone;
  const lines = [];
  let game = 0;
  if (winner) {
    const W = winner, Lo = W === 're' ? 'kontra' : 're';
    const add = (label, n = 1) => { lines.push([label, n]); game += n; };
    add('Gewonnen');
    if (W === 'kontra' && !solo) add('gegen die Alten');
    if (pts[Lo] < 90) add('unter 90');
    if (pts[Lo] < 60) add('unter 60');
    if (pts[Lo] < 30) add('unter 30');
    if (tricks[Lo] === 0) add('schwarz');
    if (L.re >= 1) add('Re angesagt', 2);
    if (L.kontra >= 1) add('Kontra angesagt', 2);
    for (const X of ['re', 'kontra']) for (let l = 2; l <= L[X]; l++) add(`${LEVEL_NAME[l]} abgesagt`);
    for (let l = 2; l <= L[Lo]; l++) {
      const reached = l === 5 ? tricks[W] > 0 : pts[W] >= THRESH[l];
      if (reached) add(l === 5 ? 'Stich gegen schwarz' : `${THRESH[l]} gegen ${LEVEL_NAME[l]}`);
    }
  }
  // Sonderpunkte (nur Normalspiel und Hochzeit mit Partner)
  const extra = [];
  if (!solo) {
    s.tricks.forEach((t, k) => {
      const wt = teamOf(s, t.winner);
      if (cardsPoints(t.cards.map(x => x.c)) >= 40) extra.push({ team: wt, label: 'Doppelkopf' });
      for (const x of t.cards) if (x.c === 'DA' && teamOf(s, x.p) !== wt) extra.push({ team: wt, label: 'Fuchs gefangen' });
      if (k === 11) {
        const wc = (t.cards.find(x => x.p === t.winner) || {}).c;
        if (wc === 'CJ') extra.push({ team: wt, label: 'Karlchen' });
      }
    });
  }
  const exRe = extra.filter(e => e.team === 're').length;
  const exKo = extra.length - exRe;
  const reScore = (winner === 're' ? game : winner === 'kontra' ? -game : 0) + exRe - exKo;
  const scores = [0, 1, 2, 3].map(p => {
    if (solo) return s.re[p] ? reScore * 3 : -reScore;
    return s.re[p] ? reScore : -reScore;
  });
  return { pts, tricks, winner, lines, game, extra, reScore, scores, solo };
}

// ---------------------------------------------------------------
// Computer: Vorbehalt und Ansagen
// ---------------------------------------------------------------
function trumpsOf(hand, type) { return hand.filter(c => isTrump(c, type)); }

export function soloStrength(hand, type) {
  const tr = trumpsOf(hand, type);
  // alle Trümpfe dieser Spielart, von oben nach unten
  const all = DECK.filter(c => isTrump(c, type)).sort((a, b) => trumpRank(b, type) - trumpRank(a, type));
  let s = 0;
  for (const c of tr) {
    const pos = all.indexOf(c); // 0 = höchster
    s += pos < 4 ? 1.3 : pos < 8 ? 1.05 : 0.8;
  }
  for (const su of SUITS) {
    const f = hand.filter(c => !isTrump(c, type) && c[0] === su);
    if (!f.length) { s += 0.7; continue; }
    const aces = f.filter(c => c[1] === 'A').length;
    const tens = f.filter(c => c[1] === 'T').length;
    s += aces * 1.0 + (aces === 2 ? Math.min(tens, 2) * 0.6 : 0);
    const losers = f.length - aces - (aces === 2 ? Math.min(tens, 2) : 0);
    s -= losers * 0.75;
  }
  return s;
}

export const SOLO_NEED = { leicht: 11.8, mittel: 12.8, schwer: 12.6 };

export function aiVorbehalt(s, p, level = 'mittel') {
  const hand = s.hands[p];
  let best = null;
  const need = SOLO_NEED[level] || SOLO_NEED.mittel;
  for (const t of SOLOS) {
    const st = soloStrength(hand, t);
    if (st >= need && (!best || st > best.st)) best = { t, st };
  }
  if (best) return best.t;
  if (hasBothQueens(hand)) return 'hochzeit';
  return 'gesund';
}

export function handStrength(hand, type) {
  let s = 0;
  const tr = trumpsOf(hand, type);
  s += tr.length * 0.7;
  for (const c of tr) {
    const r = trumpRank(c, type);
    if (r >= 100) s += 1.1; else if (r >= 93) s += 0.8; else if (r >= 91) s += 0.5;
  }
  for (const su of SUITS) {
    const f = hand.filter(c => !isTrump(c, type) && c[0] === su);
    if (!f.length && su !== 'D') s += 0.6;
    if (f.some(c => c[1] === 'A')) s += su === 'H' ? 0.4 : 0.8;
  }
  return s;
}

export function aiAnnounce(s, p, level = 'mittel') {
  const L = nextAnnouncement(s, p);
  if (!L) return 0;
  const team = teamOf(s, p);
  const st = handStrength(s.hands[p], s.type);
  if (L === 1) {
    const need = (team === 're' ? 9.6 : 10.2) + (level === 'leicht' ? -0.6 : 0);
    if (isSolo(s.type)) return p === s.soloist && soloStrength(s.hands[p], s.type) >= 13 ? 1 : 0;
    if (s.hands[p].length === 12 || s.hands[p].length === 11) return st >= need ? 1 : 0;
    // später: wenn das eigene Team schon klar vorne liegt
    return 0;
  }
  if (L === 2) {
    const mine = [0, 1, 2, 3].filter(q => teamOf(s, q) === team).reduce((a, q) => a + cardsPoints(s.taken[q]), 0);
    return st >= 12.5 && mine >= 50 ? 2 : 0;
  }
  return 0;
}

// ---------------------------------------------------------------
// Computer: Kartenspiel
// ---------------------------------------------------------------
// Was p über Teams weiß: 're' | 'kontra' | null
export function viewTeams(s, p) {
  const mine = teamOf(s, p);
  const v = s.known.slice();
  v[p] = mine;
  if (isSolo(s.type)) return [0, 1, 2, 3].map(q => (s.re[q] ? 're' : 'kontra'));
  if (s.type === 'normal' && s.silent === undefined) {
    // Wer selbst Re ist und eine Kreuz-Dame hält: die andere ist noch draußen
    const nRe = v.filter(x => x === 're').length, nKo = v.filter(x => x === 'kontra').length;
    if (nRe === 2) return v.map(x => x || 'kontra');
    if (nKo === 2) return v.map(x => x || 're');
  }
  if (s.type === 'hochzeit' && s.klaerung >= 0) return [0, 1, 2, 3].map(q => (s.re[q] ? 're' : 'kontra'));
  return v;
}

function ctx(s, p) {
  const type = s.type;
  const seen = s.hands[p].slice();
  for (const t of s.tricks) for (const x of t.cards) seen.push(x.c);
  for (const x of s.trick) seen.push(x.c);
  // unbekannte Karten (Mehrfachmenge)
  const others = DECK.slice();
  for (const c of seen) { const i = others.indexOf(c); if (i >= 0) others.splice(i, 1); }
  const teams = viewTeams(s, p);
  return { s, p, type, hand: s.hands[p], others, teams, me: teams[p] };
}

const isT = (C, c) => isTrump(c, C.type);
const higherOut = (C, c) => C.others.filter(o => effSuit(o, C.type) === effSuit(c, C.type) && power(o, C.type) > power(c, C.type));

function afterMe(C) {
  const res = [];
  for (let k = 1; k <= 3 - C.s.trick.length; k++) res.push((C.p + k) % 4);
  return res;
}

// Kann jemand nach mir, der nicht sicher mein Partner ist, diese Karte schlagen?
function safeAgainst(C, c, led, players) {
  for (const q of players) {
    if (C.teams[q] && C.teams[q] === C.me) continue;
    const v = C.s.voids[q];
    if (!v[led]) {
      if (effSuit(c, C.type) === led && higherOut(C, c).length) return false;
      // Fehlfarbe: im zweiten Durchgang ist ein Abstechen wahrscheinlich
      if (led !== 'T' && effSuit(c, C.type) === led) {
        const playedInSuit = C.s.tricks.filter(t => effSuit(t.cards[0].c, C.type) === led).length;
        const left = C.others.filter(o => effSuit(o, C.type) === led).length;
        if (playedInSuit >= 1 || left < 2) {
          const tr = C.others.filter(o => isT(C, o));
          if (tr.length) return false;
        }
      }
    } else if (led !== 'T' && !v.T) {
      const tr = C.others.filter(o => isT(C, o));
      if (effSuit(c, C.type) === 'T' ? tr.some(o => power(o, C.type) > power(c, C.type)) : tr.length) return false;
    }
  }
  return true;
}

function keep(C, c) {
  let k = 0;
  if (isT(C, c)) {
    const r = trumpRank(c, C.type);
    k += 3 + (r - 66) * 0.25;
    if (c === 'CJ' && C.s.type === 'normal') k += 3; // Karlchen aufheben
  } else {
    if (c[1] === 'A') {
      const roundsPlayed = C.s.tricks.filter(t => effSuit(t.cards[0].c, C.type) === c[0]).length;
      k += roundsPlayed === 0 ? 7 : 1;
    }
    const len = C.hand.filter(x => !isT(C, x) && x[0] === c[0]).length;
    if (len === 1) k -= 1.2;
  }
  return k;
}
const cost = (C, c) => pts(c) + keep(C, c) + (c === 'DA' && C.s.type !== 'solo-0' ? 6 : 0);
const lowest = (C, cs) => cs.slice().sort((a, b) => cost(C, a) - cost(C, b) || power(a, C.type) - power(b, C.type))[0];
const cheapestWinner = (C, cs) => cs.slice().sort((a, b) => (isT(C, a) - isT(C, b)) || power(a, C.type) - power(b, C.type) || pts(a) - pts(b))[0];
const schmier = (C, cs) => cs.slice().sort((a, b) => (pts(b) - keep(C, b) * 0.6 + (b === 'DA' ? 6 : 0)) - (pts(a) - keep(C, a) * 0.6 + (a === 'DA' ? 6 : 0)))[0];

const nm = c => `<b>${cardName(c)}</b>`;

export function policy(s, p) {
  const legal = legalFor(s, p);
  if (legal.length === 1) return { card: legal[0], why: 'Das ist deine einzige erlaubte Karte.' };
  const C = ctx(s, p);
  if (!s.trick.length) return lead(C, legal);
  return follow(C, legal);
}

function lead(C, legal) {
  const s = C.s, type = C.type;
  const fehl = legal.filter(c => !isT(C, c));
  const tr = legal.filter(c => isT(C, c));
  const isSoloist = isSolo(type) && s.soloist === C.p;
  // Asse im ersten Durchgang
  const roundsOf = su => s.tricks.filter(t => !isT(C, t.cards[0].c) && t.cards[0].c[0] === su).length;
  const aces = fehl.filter(c => c[1] === 'A' && roundsOf(c[0]) === 0 && !anyOppVoid(C, c[0]));
  if (aces.length && !(isSoloist && tr.length >= 7)) {
    const c = aces.sort((a, b) => (a[0] === 'H') - (b[0] === 'H'))[0];
    return { card: c, why: `Ass anspielen: Im ersten Durchgang einer Farbe kann meist jeder bedienen – ${nm(c)} bringt sicher Augen.` };
  }
  const strongTrumps = tr.filter(c => trumpRank(c, type) >= 89).length;
  const reTeam = C.me === 're';
  if (tr.length && (isSoloist || (reTeam && tr.length >= 6 && strongTrumps >= 2))) {
    const top = tr.slice().sort((a, b) => power(b, type) - power(a, type))[0];
    if (!higherOut(C, top).length) return { card: top, why: `Trumpf ziehen: ${nm(top)} ist der höchste Trumpf im Spiel. ${isSoloist ? 'Als Solist holst du so die Trümpfe der Gegner.' : 'Re spielt Trumpf – so findet dein Partner zu dir und die Gegner verlieren ihre Trümpfe.'}` };
    const mid = tr.filter(c => c !== 'DA' && trumpRank(c, type) < 89).sort((a, b) => power(a, type) - power(b, type));
    if (mid.length) return { card: mid[mid.length - 1], why: 'Trumpf ziehen: Mit vielen Trümpfen lohnt es sich, den Gegnern ihre Trümpfe abzuziehen.' };
  }
  // Farbe, die der Partner nicht mehr hat
  const partners = [0, 1, 2, 3].filter(q => q !== C.p && C.teams[q] === C.me);
  for (const c of fehl) {
    if (partners.some(q => s.voids[q][c[0]] && !s.voids[q].T)) {
      const opp = [0, 1, 2, 3].filter(q => q !== C.p && C.teams[q] && C.teams[q] !== C.me);
      if (!opp.some(q => s.voids[q][c[0]])) return { card: lowest(C, fehl.filter(x => x[0] === c[0])), why: 'Dein Partner hat diese Farbe nicht mehr und kann stechen.' };
    }
  }
  if (fehl.length) {
    const groups = {};
    for (const c of fehl) (groups[c[0]] = groups[c[0]] || []).push(c);
    const su = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length)[0];
    const c = lowest(C, groups[su]);
    return { card: c, why: C.me === 'kontra' ? 'Kontra spielt Farbe: Damit zwingst du Re, Trümpfe zu opfern.' : 'Eine kleine Fehlkarte abgeben – ohne viel zu riskieren.' };
  }
  const c = tr.filter(x => x !== 'DA').sort((a, b) => power(a, type) - power(b, type))[0] || tr[0];
  return { card: c, why: 'Ein kleiner Trumpf zum Ausspielen – den Fuchs behältst du lieber.' };
}

function anyOppVoid(C, su) {
  return [0, 1, 2, 3].some(q => q !== C.p && C.teams[q] !== C.me && C.s.voids[q][su]);
}

function follow(C, legal) {
  const s = C.s, type = C.type;
  const tr = s.trick;
  const last = tr.length === 3;
  const wi = trickWinnerIdx(tr.map(x => x.c), type, s.opts.dulle2, s.tricks.length === 11);
  const win = tr[wi];
  const led = effSuit(tr[0].c, type);
  const tp = cardsPoints(tr.map(x => x.c));
  const partnerWins = C.teams[win.p] && C.teams[win.p] === C.me;
  const beats = c => {
    const t2 = tr.map(x => x.c).concat([c]);
    return trickWinnerIdx(t2, type, s.opts.dulle2, s.tricks.length === 11) === t2.length - 1;
  };
  const winners = legal.filter(beats);
  const rest = afterMe(C);
  if (partnerWins) {
    const safe = last || safeAgainst(C, win.c, led, rest);
    if (safe) {
      const c = schmier(C, legal);
      if (pts(c) >= 10) return { card: c, why: `Schmieren: Dein Partner bekommt den Stich sicher – gib ihm ${nm(c)} mit.${c === 'DA' ? ' So bringt ihr den Fuchs nach Hause.' : ''}` };
      return { card: lowest(C, legal), why: 'Dein Partner liegt vorne – gib eine billige Karte zu.' };
    }
    return { card: lowest(C, legal), why: 'Dein Partner liegt vorne, aber nach dir kommen noch Gegner. Lieber nichts Wertvolles riskieren.' };
  }
  if (winners.length) {
    const safeW = winners.filter(c => last || safeAgainst(C, c, led, rest));
    if (safeW.length) {
      const c = cheapestWinner(C, safeW);
      const worth = !isT(C, c) || tp + pts(c) >= 10 || trumpRank(c, type) < 80 || (last && tp >= 4) || s.tricks.length === 11;
      if (worth) {
        const fox = tr.some(x => x.c === 'DA') ? ' Damit fängst du den Fuchs!' : '';
        return { card: c, why: `${last ? 'Du sitzt hinten: ' : ''}Mit ${nm(c)} gewinnst du den Stich (${tp} Augen liegen drin).${fox}` };
      }
    }
    if (!last && tp >= 14) {
      const strong = winners.filter(c => trumpRank(c, type) >= 89 || !isT(C, c));
      if (strong.length) {
        const c = cheapestWinner(C, strong);
        return { card: c, why: `Im Stich liegen schon ${tp} Augen – mit ${nm(c)} hast du gute Chancen, ihn zu holen.` };
      }
    }
  }
  const c = lowest(C, legal);
  const canFollow = legal.some(x => effSuit(x, type) === led);
  return { card: c, why: canFollow ? 'Den Stich holst du nicht sicher – bediene mit einer billigen Karte.' : 'Du kannst nicht bedienen: Wirf eine Karte mit wenig Augen ab.' };
}

// ---------------------------------------------------------------
// Vorausschau (Spielstärke „schwer“, Tipps)
// ---------------------------------------------------------------
function cloneForSim(s) {
  return {
    ...s, hands: s.hands.map(h => h.slice()), trick: s.trick.slice(), tricks: s.tricks.slice(),
    taken: s.taken.map(x => x.slice()), voids: s.voids.map(v => ({ ...v })), known: s.known.slice(), re: s.re.slice(),
    ann: { ...s.ann }, annLog: s.annLog.slice(), result: null,
  };
}

export function sampleWorld(s, p, rnd = Math.random) {
  const C = ctx(s, p);
  const type = s.type;
  const players = [0, 1, 2, 3].filter(q => q !== p);
  const pool = C.others.slice();
  // Wer muss eine Kreuz-Dame haben, wer darf keine?
  const normal = type === 'normal' && s.silent === undefined;
  const needQ = [], noQ = new Set();
  if (normal) {
    for (const q of players) {
      const playedQ = s.tricks.some(t => t.cards.some(x => x.p === q && x.c === 'CQ')) || s.trick.some(x => x.p === q && x.c === 'CQ');
      if (C.teams[q] === 're' && !playedQ) needQ.push(q);
      if (C.teams[q] === 'kontra') noQ.add(q);
    }
    // Ich bin Kontra: beide Damen sind bei anderen; wer nicht bekannt ist, kann eine haben
  }
  if (type === 'hochzeit') {
    const hz = s.hochzeiter;
    if (hz !== p) needQ.push(hz, hz);
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    const hands = {};
    for (const q of players) hands[q] = [];
    let cards = shuffle(pool.slice(), rnd);
    let fail = false;
    // Kreuz-Damen zuerst
    const qs = cards.filter(c => c === 'CQ');
    cards = cards.filter(c => c !== 'CQ');
    for (const q of needQ) {
      if (!qs.length) break;
      hands[q].push(qs.pop());
    }
    for (const c of qs) cards.push(c);
    const ok = (q, c) => hands[q].length < s.hands[q].length && (attempt > 40 || !s.voids[q][effSuit(c, type)]) && !(c === 'CQ' && noQ.has(q));
    cards.sort((a, b) => players.filter(q => ok(q, a)).length - players.filter(q => ok(q, b)).length);
    for (const c of cards) {
      const el = players.filter(q => ok(q, c));
      if (!el.length) { fail = true; break; }
      hands[el[Math.floor(rnd() * el.length)]].push(c);
    }
    if (fail) continue;
    const w = cloneForSim(s);
    for (const q of players) w.hands[q] = hands[q];
    if (normal) {
      w.re = w.hands.map((h, q) => h.includes('CQ') || s.tricks.some(t => t.cards.some(x => x.p === q && x.c === 'CQ')) || s.trick.some(x => x.p === q && x.c === 'CQ'));
      if (w.re.filter(Boolean).length !== 2) continue;
    }
    return w;
  }
  return cloneForSim(s);
}

function utility(w, p) {
  const r = settle(w);
  const team = teamOf(w, p);
  const my = r.pts[team];
  return my + (r.winner === team ? 70 : 0) + (team === 're' ? r.reScore : -r.reScore) * 4;
}

function rollout(w, p) {
  let g = 0;
  while (w.phase !== 'done' && g++ < 80) {
    if (w.phase === 'collect') { collectTrick(w); continue; }
    playCard(w, w.turn, policy(w, w.turn).card);
  }
  return utility(w, p);
}

export function lookahead(s, p, samples = 16, rnd = Math.random) {
  const legal = [...new Set(legalFor(s, p))];
  if (legal.length === 1) return { card: legal[0], scores: null };
  const tot = new Map(legal.map(c => [c, 0]));
  for (let k = 0; k < samples; k++) {
    const world = sampleWorld(s, p, rnd);
    for (const c of legal) {
      const w = cloneForSim(world);
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
  if (new Set(legal).size === 1) return legal[0];
  if (level === 'leicht') {
    if (rnd() < 0.3) return legal[Math.floor(rnd() * legal.length)];
    return policy(s, p).card;
  }
  if (level === 'schwer' && s.hands[p].length > 1) return lookahead(s, p, 12, rnd).card;
  return policy(s, p).card;
}
