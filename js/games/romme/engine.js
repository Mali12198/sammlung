// Rommé – zwei Blätter à 52 Karten + 6 Joker (110 Karten), 2 bis 4 Spieler, je 13 Karten.
// Karten: 'H5' = Herz-Fünf, 'ST' = Pik-Zehn, 'XX' = Joker.
// Meldungen: Satz (3–4 gleiche Werte, verschiedene Farben) oder Folge (mind. 3 aufeinanderfolgende Karten einer Farbe).
// Ass hoch (D-K-A) oder niedrig (A-2-3), nicht „um die Ecke“. Joker ersetzen jede Karte.
// Rauskommen: erste Meldungen zusammen mindestens 40 Punkte. Danach darf man anlegen und Joker tauschen.
import { shuffle } from '../../util.js';

export const SUITS = ['C', 'S', 'H', 'D'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
export const SUIT_NAME = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' };
export const RANK_ONE = { A: 'Ass', 2: 'Zwei', 3: 'Drei', 4: 'Vier', 5: 'Fünf', 6: 'Sechs', 7: 'Sieben', 8: 'Acht', 9: 'Neun', T: 'Zehn', J: 'Bube', Q: 'Dame', K: 'König' };
export const RANK_MANY = { A: 'Asse', 2: 'Zweien', 3: 'Dreien', 4: 'Vieren', 5: 'Fünfen', 6: 'Sechsen', 7: 'Siebenen', 8: 'Achten', 9: 'Neunen', T: 'Zehnen', J: 'Buben', Q: 'Damen', K: 'Könige' };
export const isJoker = c => c === 'XX';
export const cardName = c => (isJoker(c) ? 'Joker' : `${SUIT_NAME[c[0]]}-${RANK_ONE[c[1]]}`);
export const MIN_OUT = 40;

const NUM = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13 };
const RANK_OF = n => (n === 14 ? 'A' : RANKS[n - 1]);
export const num = c => NUM[c[1]];

// Wert einer Karte in einer Meldung (Ass niedrig = 1) bzw. als Strafpunkte auf der Hand (Joker 20)
export function rankValue(n) { return n === 1 ? 1 : n === 14 ? 11 : n >= 10 ? 10 : n; }
export function handValue(c) { if (isJoker(c)) return 20; const n = num(c); return n === 1 ? 11 : n >= 10 ? 10 : n; }
export const handPoints = cs => cs.reduce((a, c) => a + handValue(c), 0);

export function newDeck() {
  const d = [];
  for (let k = 0; k < 2; k++) for (const s of SUITS) for (const r of RANKS) d.push(s + r);
  for (let k = 0; k < 6; k++) d.push('XX');
  return d;
}

export function sortHand(hand, mode = 'suit') {
  const key = mode === 'rank'
    ? c => (isJoker(c) ? 999 : num(c) * 10 + SUITS.indexOf(c[0]))
    : c => (isJoker(c) ? 999 : SUITS.indexOf(c[0]) * 20 + num(c));
  return hand.slice().sort((a, b) => key(a) - key(b));
}

// ---------------------------------------------------------------
// Meldungen erkennen
// ---------------------------------------------------------------
// Liefert { type:'set', rank, cards } oder { type:'run', suit, lo, cards } (cards in Reihenfolge lo..hi) oder null.
export function analyze(cards) {
  const nat = cards.filter(c => !isJoker(c));
  const J = cards.length - nat.length;
  if (cards.length < 3 || nat.length < 2 || J > nat.length) return null;
  // Satz
  if (nat.every(c => c[1] === nat[0][1])) {
    const suits = new Set(nat.map(c => c[0]));
    if (suits.size === nat.length && cards.length <= 4) return { type: 'set', rank: nat[0][1], cards: nat.concat(Array(J).fill('XX')) };
    return null;
  }
  // Folge
  if (!nat.every(c => c[0] === nat[0][0])) return null;
  const suit = nat[0][0];
  const hasAce = nat.some(c => c[1] === 'A');
  const highFirst = hasAce && nat.some(c => num(c) >= 9);
  for (const aceHigh of highFirst ? [true, false] : [false, true]) {
    if (!hasAce && aceHigh) continue;
    const ns = nat.map(c => (c[1] === 'A' && aceHigh ? 14 : num(c))).sort((a, b) => a - b);
    if (new Set(ns).size !== ns.length) return null;
    const lo0 = ns[0], hi0 = ns[ns.length - 1];
    const gaps = hi0 - lo0 + 1 - ns.length;
    if (gaps > J) continue;
    let extra = J - gaps;
    let hi = Math.min(14, hi0 + extra);
    extra -= hi - hi0;
    const lo = lo0 - extra;
    if (lo < 1 || (lo === 1 && hi === 14)) continue;
    const seq = [];
    for (let r = lo; r <= hi; r++) {
      const c = nat.find(x => (x[1] === 'A' ? (aceHigh ? 14 : 1) : num(x)) === r);
      seq.push(c || 'XX');
    }
    return { type: 'run', suit, lo, cards: seq };
  }
  return null;
}

// Welche Karte vertritt ein Joker? (Folge: genaue Karte; Satz: Wert, Farbe offen)
export function jokerStands(m, i) {
  if (m.type === 'run') return m.suit + RANK_OF(m.lo + i);
  return 'any' + m.rank;
}

export function meldValue(m) {
  if (m.type === 'set') return m.cards.length * rankValue(NUM[m.rank] === 1 ? 14 : NUM[m.rank]);
  return m.cards.reduce((a, _, i) => a + rankValue(m.lo + i), 0);
}

export function describeMeld(m) {
  if (m.type === 'set') return `${m.cards.length} ${RANK_MANY[m.rank]}`;
  const hi = m.lo + m.cards.length - 1;
  return `${SUIT_NAME[m.suit]} ${RANK_ONE[RANK_OF(m.lo)]} bis ${RANK_ONE[RANK_OF(hi)]}`;
}

// Karten an eine liegende Meldung anlegen (Joker bleiben an ihrem Platz). Liefert neue Meldung oder null.
export function extendMeld(m, add) {
  const nat = add.filter(c => !isJoker(c));
  let J = add.length - nat.length;
  if (m.type === 'set') {
    const total = m.cards.length + add.length;
    if (total > 4) return null;
    if (!nat.every(c => c[1] === m.rank)) return null;
    const used = new Set(m.cards.filter(c => !isJoker(c)).map(c => c[0]));
    for (const c of nat) { if (used.has(c[0])) return null; used.add(c[0]); }
    const naturals = m.cards.filter(c => !isJoker(c)).length + nat.length;
    const jokers = total - naturals;
    if (jokers > naturals) return null;
    return { ...m, cards: m.cards.filter(c => !isJoker(c)).concat(nat, Array(jokers).fill('XX')) };
  }
  if (!nat.every(c => c[0] === m.suit)) return null;
  const lo = m.lo, hi = m.lo + m.cards.length - 1;
  // Ass: an das nähere Ende (oben als 14, unten als 1)
  const pos = nat.map(c => (c[1] !== 'A' ? num(c) : (14 - hi - 1 <= lo - 2 ? 14 : 1)));
  if (new Set(pos).size !== pos.length) return null;
  for (const r of pos) if (r >= lo && r <= hi) return null; // Platz schon belegt (Tausch statt Anlegen)
  const newLo = Math.min(lo, ...pos), newHi = Math.max(hi, ...pos);
  if (newLo < 1 || newHi > 14 || (newLo === 1 && newHi === 14)) return null;
  const need = (newHi - newLo + 1) - m.cards.length - pos.length;
  if (need > J) return null;
  J -= need;
  let lo2 = newLo, hi2 = newHi;
  while (J > 0 && hi2 < 14 && !(lo2 === 1 && hi2 + 1 === 14)) { hi2++; J--; }
  while (J > 0 && lo2 > 1 && !(lo2 - 1 === 1 && hi2 === 14)) { lo2--; J--; }
  if (J > 0) return null;
  const cards = [];
  for (let r = lo2; r <= hi2; r++) {
    if (r >= lo && r <= hi) cards.push(m.cards[r - lo]);
    else { const k = pos.indexOf(r); cards.push(k >= 0 ? nat[k] : 'XX'); }
  }
  const naturals = cards.filter(c => !isJoker(c)).length;
  if (cards.length - naturals > naturals) return null;
  return { ...m, lo: lo2, cards };
}

// Kann Karte c einen Joker in Meldung m ersetzen? Liefert Index oder -1.
export function jokerSwapIndex(m, c) {
  if (isJoker(c)) return -1;
  if (m.type === 'run') {
    if (c[0] !== m.suit) return -1;
    return m.cards.findIndex((x, i) => isJoker(x) && jokerStands(m, i) === c);
  }
  if (c[1] !== m.rank) return -1;
  if (m.cards.some(x => !isJoker(x) && x[0] === c[0])) return -1;
  return m.cards.findIndex(isJoker);
}

// ---------------------------------------------------------------
// Runde
// ---------------------------------------------------------------
export function newRound({ n = 2, dealer = 0, rnd = Math.random, minOut = MIN_OUT } = {}) {
  const stock = shuffle(newDeck(), rnd);
  const hands = [];
  for (let p = 0; p < n; p++) hands.push(stock.splice(0, 13));
  const pile = [stock.pop()];
  return {
    n, dealer, hands, stock, pile, melds: [],
    out: new Array(n).fill(false), meldedBefore: new Array(n).fill(false),
    turn: (dealer + 1) % n, phase: 'draw', minOut,
    took: null, turnMelds: [], wentOut: -1, handRomme: false, result: null, log: [],
    taken: Array.from({ length: n }, () => []),   // was jeder von der Ablage genommen hat (für die KI)
  };
}

export const pileTop = s => s.pile[s.pile.length - 1] || null;

function refillStock(s) {
  if (s.stock.length) return;
  const top = s.pile.pop();
  s.stock = shuffle(s.pile, Math.random);
  s.pile = top ? [top] : [];
}

export function drawStock(s, p) {
  if (s.phase !== 'draw' || s.turn !== p) throw new Error('nicht dran');
  refillStock(s);
  const c = s.stock.pop();
  s.hands[p].push(c);
  s.took = null;
  s.phase = 'play';
  s.turnMelds = [];
  return c;
}

// Ablage nehmen: wer noch nicht draußen ist, muss mit der Karte in diesem Zug rauskommen.
export function canTakePile(s, p) {
  const top = pileTop(s);
  if (!top || s.phase !== 'draw' || s.turn !== p) return false;
  if (s.out[p]) return true;
  return !!comeOutPlan(s.hands[p].concat(top), s.minOut, top);
}

export function takePile(s, p) {
  if (!canTakePile(s, p)) throw new Error('Ablage nicht erlaubt');
  const c = s.pile.pop();
  s.hands[p].push(c);
  s.took = c;
  s.taken[p].push(c);
  s.phase = 'play';
  s.turnMelds = [];
  return c;
}

// Aufgenommene Ablagekarte zurücklegen (nur solange noch nichts gemeldet wurde) und stattdessen ziehen.
export function undoTake(s, p) {
  if (!s.took || s.turnMelds.length || s.turn !== p) throw new Error('nicht möglich');
  const i = s.hands[p].lastIndexOf(s.took);
  s.hands[p].splice(i, 1);
  s.pile.push(s.took);
  s.taken[p].pop();
  s.took = null;
  s.phase = 'draw';
}

function removeCards(hand, cards) {
  const h = hand.slice();
  for (const c of cards) { const i = h.indexOf(c); if (i < 0) return null; h.splice(i, 1); }
  return h;
}

// Neue Meldungen auslegen. groups: [[karten], …]. Wer noch nicht draußen ist, braucht zusammen ≥ minOut.
export function checkNew(s, p, groups) {
  const ms = groups.map(analyze);
  const bad = ms.findIndex(m => !m);
  if (bad >= 0) return { ok: false, err: whyNotMeld(groups[bad]) };
  const rest = removeCards(s.hands[p], groups.flat());
  if (!rest) return { ok: false, err: 'Diese Karten hast du nicht.' };
  if (!s.out[p]) {
    const v = ms.reduce((a, m) => a + meldValue(m), 0);
    if (v < s.minOut) return { ok: false, short: s.minOut - v, value: v, err: `Zum Rauskommen brauchst du ${s.minOut} Punkte – das sind erst ${v}.` };
    if (s.took && !groups.flat().includes(s.took)) return { ok: false, err: 'Die aufgenommene Ablagekarte muss in deinen ersten Meldungen liegen.' };
  }
  return { ok: true, melds: ms, rest };
}

export function meldNew(s, p, groups) {
  const r = checkNew(s, p, groups);
  if (!r.ok) return r;
  const firstTime = !s.out[p];
  for (const m of r.melds) s.melds.push({ ...m, owner: p });
  s.hands[p] = r.rest;
  s.out[p] = true;
  s.turnMelds.push(...r.melds.map(() => s.melds.length - 1));
  s.log.push({ p, type: 'meld', n: r.melds.length });
  if (firstTime) s.firstOutTurn = p;
  if (!s.hands[p].length) endRound(s, p);
  return { ok: true };
}

export function checkAdd(s, p, idx, cards) {
  if (!s.out[p]) return { ok: false, err: 'Anlegen darfst du erst, wenn du draußen bist (40 Punkte gemeldet).' };
  const m = s.melds[idx];
  if (!m) return { ok: false, err: 'Diese Meldung gibt es nicht.' };
  if (!removeCards(s.hands[p], cards)) return { ok: false, err: 'Diese Karten hast du nicht.' };
  if (cards.length === 1) {
    const k = jokerSwapIndex(m, cards[0]);
    if (k >= 0) return { ok: true, swap: k };
  }
  const nm = extendMeld(m, cards);
  if (!nm) return { ok: false, err: 'Das passt nicht an diese Meldung.' };
  return { ok: true, meld: nm };
}

// Anlegen oder Joker tauschen
export function addTo(s, p, idx, cards) {
  const r = checkAdd(s, p, idx, cards);
  if (!r.ok) return r;
  const m = s.melds[idx];
  if (r.swap !== undefined) {
    m.cards = m.cards.slice();
    m.cards[r.swap] = cards[0];
    s.hands[p] = removeCards(s.hands[p], cards);
    s.hands[p].push('XX');
    s.log.push({ p, type: 'swap', c: cards[0] });
    return { ok: true, swap: true };
  }
  s.melds[idx] = { ...r.meld, owner: m.owner };
  s.hands[p] = removeCards(s.hands[p], cards);
  s.log.push({ p, type: 'add', n: cards.length });
  if (!s.hands[p].length) endRound(s, p);
  return { ok: true };
}

export function canDiscard(s, p, c) {
  if (s.phase !== 'play' || s.turn !== p) return { ok: false, err: 'Du bist nicht dran.' };
  if (!s.hands[p].includes(c)) return { ok: false, err: 'Diese Karte hast du nicht.' };
  if (s.took && !s.out[p]) return { ok: false, err: 'Du hast die Ablagekarte genommen – damit musst du jetzt rauskommen. Oder leg sie zurück.' };
  if (s.took && c === s.took && s.hands[p].filter(x => x === c).length === 1 && s.hands[p].length > 1) return { ok: false, err: 'Die eben aufgenommene Karte darfst du nicht gleich wieder ablegen.' };
  return { ok: true };
}

export function discard(s, p, c) {
  const r = canDiscard(s, p, c);
  if (!r.ok) throw new Error(r.err);
  s.hands[p].splice(s.hands[p].indexOf(c), 1);
  s.pile.push(c);
  s.log.push({ p, type: 'discard', c });
  if (!s.hands[p].length) return endRound(s, p);
  if (s.out[p]) s.meldedBefore[p] = true;
  s.took = null;
  s.turn = (p + 1) % s.n;
  s.phase = 'draw';
  s.turnMelds = [];
}

function endRound(s, p) {
  s.wentOut = p;
  s.handRomme = !s.meldedBefore[p];
  const mult = s.handRomme ? 2 : 1;
  const pen = s.hands.map((h, q) => (q === p ? 0 : handPoints(h) * mult));
  s.result = { winner: p, penalties: pen, handRomme: s.handRomme };
  s.phase = 'done';
  s.turn = -1;
}

// ---------------------------------------------------------------
// Meldungen finden (für Computer und Tipps)
// ---------------------------------------------------------------
function candidates(hand) {
  const jokers = hand.filter(isJoker).length;
  const res = [];
  const nat = hand.filter(c => !isJoker(c));
  // Sätze
  for (const r of RANKS) {
    const bySuit = [...new Set(nat.filter(c => c[1] === r).map(c => c[0]))].map(su => su + r);
    const k = bySuit.length;
    if (k < 2) continue;
    const subsets = [];
    const rec = (i, cur) => { if (i === k) { if (cur.length >= 2) subsets.push(cur.slice()); return; } rec(i + 1, cur); cur.push(bySuit[i]); rec(i + 1, cur); cur.pop(); };
    rec(0, []);
    for (const sub of subsets) {
      for (let j = 0; j <= Math.min(jokers, 4 - sub.length, sub.length); j++) {
        if (sub.length + j < 3) continue;
        res.push(sub.concat(Array(j).fill('XX')));
      }
    }
  }
  // Folgen
  for (const su of SUITS) {
    const have = new Set(nat.filter(c => c[0] === su).map(c => num(c)));
    if (have.has(1)) have.add(14);
    for (let lo = 1; lo <= 12; lo++) {
      for (let hi = lo + 2; hi <= 14; hi++) {
        if (lo === 1 && hi === 14) continue;
        let naturals = 0, missing = 0;
        const cards = [];
        for (let r = lo; r <= hi; r++) {
          if (have.has(r)) { naturals++; cards.push(su + RANK_OF(r)); } else { missing++; cards.push('XX'); }
        }
        if (missing > jokers) break;
        if (naturals < 2 || missing > naturals) continue;
        res.push(cards);
      }
    }
  }
  return res;
}

// Beste disjunkte Auswahl an Meldungen: höchster Wert (= wenigste Strafpunkte auf der Hand)
export function bestMelds(hand, { limit = 25000, include = null } = {}) {
  const cands = candidates(hand).map(cards => ({ cards, m: analyze(cards) })).filter(x => x.m);
  for (const x of cands) x.v = meldValue(x.m) + x.cards.filter(c => !isJoker(c)).length * 0.01;
  cands.sort((a, b) => b.v - a.v);
  let best = { groups: [], value: 0 };
  let nodes = 0;
  const count = {};
  for (const c of hand) count[c] = (count[c] || 0) + 1;
  for (const x of cands) { x.need = {}; for (const c of x.cards) x.need[c] = (x.need[c] || 0) + 1; }
  const fits = x => { for (const c in x.need) if ((count[c] || 0) < x.need[c]) return false; return true; };
  const rec = (start, chosen, value) => {
    if (++nodes > limit) return;
    const okInc = !include || chosen.some(g => g.includes(include));
    if (okInc && value > best.value) best = { groups: chosen.map(g => g.slice()), value };
    for (let i = start; i < cands.length; i++) {
      const cd = cands[i];
      if (!fits(cd)) continue;
      for (const c in cd.need) count[c] -= cd.need[c];
      chosen.push(cd.cards);
      rec(i + 1, chosen, value + meldValue(cd.m));
      chosen.pop();
      for (const c in cd.need) count[c] += cd.need[c];
    }
  };
  rec(0, [], 0);
  best.value = Math.round(best.value);
  return best;
}

// Plan zum Rauskommen (≥ need Punkte), optional mit Pflichtkarte
export function comeOutPlan(hand, need = MIN_OUT, include = null) {
  const b = bestMelds(hand, { include, limit: 12000 });
  const v = b.groups.reduce((a, g) => a + meldValue(analyze(g)), 0);
  if (!b.groups.length || v < need) return null;
  if (include && !b.groups.some(g => g.includes(include))) return null;
  return { groups: b.groups, value: v };
}

// Karten, die irgendwo angelegt werden können: [{ idx, cards }]
export function layoffs(s, hand) {
  const res = [];
  const left = hand.slice();
  let changed = true;
  const melds = s.melds.map(m => ({ ...m, cards: m.cards.slice() }));
  while (changed) {
    changed = false;
    for (let i = 0; i < left.length; i++) {
      const c = left[i];
      if (isJoker(c)) continue;
      for (let k = 0; k < melds.length; k++) {
        if (jokerSwapIndex(melds[k], c) >= 0) continue; // Tausch wird extra behandelt
        const nm = extendMeld(melds[k], [c]);
        if (nm) { res.push({ idx: k, cards: [c] }); melds[k] = { ...nm, owner: melds[k].owner }; left.splice(i, 1); changed = true; break; }
      }
      if (changed) break;
    }
  }
  return { list: res, left };
}

// Joker, die man mit Handkarten freitauschen kann: [{ idx, card }]
export function swaps(s, hand) {
  const res = [];
  const used = [];
  for (let k = 0; k < s.melds.length; k++) {
    for (const c of new Set(hand)) {
      if (isJoker(c)) continue;
      if (used.filter(x => x === c).length >= hand.filter(x => x === c).length) continue;
      if (jokerSwapIndex(s.melds[k], c) >= 0) { res.push({ idx: k, card: c }); used.push(c); break; }
    }
  }
  return res;
}

// Wie nützlich ist eine Karte für künftige Meldungen?
function usefulness(hand, c, s) {
  if (isJoker(c)) return 100;
  let u = 0;
  const others = hand.filter(x => x !== c || false);
  const sameRank = new Set(hand.filter(x => !isJoker(x) && x[1] === c[1] && x[0] !== c[0]).map(x => x[0])).size;
  u += sameRank * 3;
  const n = num(c);
  for (const d of [-2, -1, 1, 2]) {
    let r = n + d;
    if (n === 1 && d < 0) r = 14 + d;
    const has = hand.some(x => !isJoker(x) && x[0] === c[0] && (num(x) === r || (x[1] === 'A' && r === 14)));
    if (has) u += Math.abs(d) === 1 ? 3 : 1.5;
  }
  // Karten, die an Tischmeldungen passen, sind für alle anderen interessant
  if (s && s.melds.some(m => extendMeld(m, [c]) || jokerSwapIndex(m, c) >= 0)) u += 4;
  void others;
  return u;
}

// ---------------------------------------------------------------
// Computer
// ---------------------------------------------------------------
export function aiDraw(s, p, level = 'mittel') {
  const top = pileTop(s);
  if (!top || level === 'leicht' && Math.random() < 0.5) return { pile: false };
  if (!canTakePile(s, p)) return { pile: false, why: '' };
  const hand = s.hands[p];
  if (isJoker(top)) return { pile: true, why: 'Oben liegt ein Joker – den nimmst du immer mit.' };
  if (!s.out[p]) return { pile: true, why: `Mit ${cardName(top)} kommst du sofort raus (mindestens ${s.minOut} Punkte).` };
  const before = bestMelds(hand).value;
  const after = bestMelds(hand.concat(top)).value;
  if (after - before >= 3) return { pile: true, why: `${cardName(top)} macht eine neue Meldung möglich.` };
  if (s.melds.some(m => extendMeld(m, [top]) || jokerSwapIndex(m, top) >= 0)) return { pile: true, why: `${cardName(top)} kannst du gleich anlegen – eine Karte weniger auf der Hand.` };
  return { pile: false, why: `${cardName(top)} hilft dir nicht weiter – lieber eine neue Karte vom Stapel.` };
}

// Ganzer Melde-Teil des Zugs: Liste von Aktionen [{ kind:'new', groups } | { kind:'add', idx, cards } | { kind:'swap', idx, card }]
export function aiPlan(s, p, level = 'mittel') {
  const acts = [];
  const w = { ...s, melds: s.melds.map(m => ({ ...m, cards: m.cards.slice() })), hands: s.hands.map(h => h.slice()), out: s.out.slice() };
  let hand = w.hands[p];
  if (!w.out[p]) {
    const plan = comeOutPlan(hand, s.minOut, s.took);
    if (!plan) return acts;
    // Mit wenigen Karten nicht alles auf einmal zeigen? Einfach: rauskommen, sobald es geht.
    acts.push({ kind: 'new', groups: plan.groups });
    for (const g of plan.groups) hand = removeCards(hand, g);
    for (const g of plan.groups) w.melds.push({ ...analyze(g), owner: p });
    w.out[p] = true;
  } else {
    const b = bestMelds(hand);
    if (b.groups.length) {
      acts.push({ kind: 'new', groups: b.groups });
      for (const g of b.groups) { hand = removeCards(hand, g); w.melds.push({ ...analyze(g), owner: p }); }
    }
  }
  // Joker tauschen
  if (level !== 'leicht') {
    for (let round = 0; round < 3; round++) {
      const sw = swaps(w, hand);
      if (!sw.length) break;
      const x = sw[0];
      acts.push({ kind: 'swap', idx: x.idx, card: x.card });
      const m = w.melds[x.idx];
      m.cards[jokerSwapIndex(m, x.card)] = x.card;
      hand = removeCards(hand, [x.card]); hand.push('XX');
      const b = bestMelds(hand);
      if (b.groups.length) {
        acts.push({ kind: 'new', groups: b.groups });
        for (const g of b.groups) { hand = removeCards(hand, g); w.melds.push({ ...analyze(g), owner: p }); }
      }
    }
  }
  // Anlegen
  const lo = layoffs(w, hand);
  for (const x of lo.list) {
    // die letzte Karte nicht anlegen, wenn man sie lieber abwirft? Egal – raus ist raus.
    acts.push({ kind: 'add', idx: x.idx, cards: x.cards });
  }
  hand = lo.left;
  // Joker auf der Hand an eine eigene Folge hängen, wenn sonst nichts geht und die Hand klein ist
  if (hand.length <= 2 && hand.some(isJoker)) {
    for (let k = 0; k < w.melds.length && hand.some(isJoker); k++) {
      const nm = extendMeld(w.melds[k], ['XX']);
      if (nm && hand.length > 1) { acts.push({ kind: 'add', idx: k, cards: ['XX'] }); w.melds[k] = { ...nm, owner: w.melds[k].owner }; hand = removeCards(hand, ['XX']); }
    }
  }
  return acts;
}

export function aiDiscard(s, p, level = 'mittel', rnd = Math.random) {
  const hand = s.hands[p];
  const legal = hand.filter(c => canDiscard(s, p, c).ok);
  if (!legal.length) return { card: hand[0], why: '' };
  if (level === 'leicht' && rnd() < 0.3) return { card: legal[Math.floor(rnd() * legal.length)], why: '' };
  // Karten aus der besten Meldungsauswahl schützen (wenn noch nicht draußen)
  const keep = new Set();
  const b = bestMelds(hand, { limit: 6000 });
  for (const g of b.groups) for (const c of g) keep.add(c);
  const nextP = (p + 1) % s.n;
  const wanted = new Set(level === 'schwer' ? s.taken[nextP] : []);
  let best = null;
  for (const c of legal) {
    if (isJoker(c)) continue;
    let score = handValue(c) * 0.6 - usefulness(hand, c, s) * 2 - (keep.has(c) ? 25 : 0);
    if (wanted.size) for (const w of wanted) if (!isJoker(w) && (w[1] === c[1] || (w[0] === c[0] && Math.abs(num(w) - num(c)) <= 2))) score -= 4;
    if (!best || score > best.score) best = { card: c, score };
  }
  if (!best) best = { card: legal[0] };
  const c = best.card;
  const why = keep.has(c) ? `${cardName(c)} gehört zwar zu einer möglichen Meldung, aber alles andere brauchst du noch mehr.`
    : handValue(c) >= 10 ? `${cardName(c)} passt zu nichts und zählt ${handValue(c)} Strafpunkte – weg damit.`
      : `${cardName(c)} passt zu keiner deiner Karten.`;
  return { card: c, why };
}

export function whyNotMeld(cards) {
  const nat = cards.filter(c => !isJoker(c));
  const J = cards.length - nat.length;
  if (cards.length < 3) return 'Eine Meldung braucht mindestens drei Karten.';
  if (nat.length < 2) return 'Eine Meldung braucht mindestens zwei echte Karten.';
  if (J > nat.length) return 'Zu viele Joker – höchstens so viele Joker wie echte Karten.';
  if (nat.every(c => c[1] === nat[0][1])) {
    if (cards.length > 4) return 'Ein Satz hat höchstens vier Karten.';
    return 'In einem Satz muss jede Farbe verschieden sein.';
  }
  if (nat.every(c => c[0] === nat[0][0])) return 'Für diese Folge fehlen Karten dazwischen – oder ein Joker.';
  return 'Das ist weder ein Satz (gleicher Wert, verschiedene Farben) noch eine Folge (gleiche Farbe, aufeinanderfolgend).';
}
