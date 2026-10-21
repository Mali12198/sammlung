// Kanaster (Canasta) – klassische Regeln für vier Spieler in Partnerschaft und zwei Spieler.
// Karten: 'HK' = Herz-König, 'XX' = Joker. Zwei Blätter + 4 Joker = 108 Karten.
// Vier Spieler: 0 = du, 1 = links (Gegner), 2 = gegenüber (Partner), 3 = rechts (Gegner). Team = Spieler % 2.
// Zwei Spieler: 0 = du, 1 = Computer.
import { shuffle } from '../../util.js';

export const SUITS = ['C', 'S', 'H', 'D'];
export const ALL_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const MELD_RANKS = ['4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const RANK_NAME = { 3: 'Dreien', 4: 'Vieren', 5: 'Fünfen', 6: 'Sechsen', 7: 'Siebenen', 8: 'Achten', 9: 'Neunen', T: 'Zehnen', J: 'Buben', Q: 'Damen', K: 'Könige', A: 'Asse' };
export const RANK_ONE = { 2: 'Zwei', 3: 'Drei', 4: 'Vier', 5: 'Fünf', 6: 'Sechs', 7: 'Sieben', 8: 'Acht', 9: 'Neun', T: 'Zehn', J: 'Bube', Q: 'Dame', K: 'König', A: 'Ass' };
const SUIT_NAME = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' };
export const cardName = c => (c[0] === 'X' ? 'Joker' : `${SUIT_NAME[c[0]]}-${RANK_ONE[c[1]]}`);

export const isWild = c => c[0] === 'X' || c[1] === '2';
export const isRed3 = c => c[1] === '3' && (c[0] === 'H' || c[0] === 'D');
export const isBlack3 = c => c[1] === '3' && (c[0] === 'C' || c[0] === 'S');
export const isNatural = c => !isWild(c);

export function value(c) {
  if (c[0] === 'X') return 50;
  const r = c[1];
  if (r === '2' || r === 'A') return 20;
  if ('89TJQK'.includes(r)) return 10;
  return 5; // 3 bis 7
}
export const sumValue = cs => cs.reduce((a, c) => a + value(c), 0);

export function minimumFor(score) {
  if (score < 0) return 15;
  if (score < 1500) return 50;
  if (score < 3000) return 90;
  return 120;
}

export function newDeck() {
  const d = [];
  for (let k = 0; k < 2; k++) for (const s of SUITS) for (const r of ALL_RANKS) d.push(s + r);
  d.push('XX', 'XX', 'XX', 'XX');
  return d;
}

const RANK_ORDER = { 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, T: 7, J: 8, Q: 9, K: 10, A: 11, 2: 12, X: 13 };
export function sortHand(hand) {
  const key = c => (c[0] === 'X' ? 13 : RANK_ORDER[c[1]]) * 10 + SUITS.indexOf(c[0]);
  return hand.slice().sort((a, b) => key(a) - key(b));
}

// ---------------------------------------------------------------
// Runde
// ---------------------------------------------------------------
export function newRound({ n = 4, dealer = 0, totals = [0, 0], rnd = Math.random } = {}) {
  const deck = shuffle(newDeck(), rnd);
  const size = n === 4 ? 11 : 15;
  const hands = [];
  for (let p = 0; p < n; p++) hands.push(deck.splice(0, size));
  const s = {
    n, dealer, hands, stock: deck, pile: [], frozenStart: false,
    melds: [[], []], red3: [[], []], totals: totals.slice(),
    initial: [false, false], melded: new Array(n).fill(false),
    turn: (dealer + 1) % n, phase: 'draw',
    need: n === 4 ? 1 : 2, drawN: n === 4 ? 1 : 2,
    discards: [], turnStartMelded: false, goneOut: -1, result: null, events: [],
  };
  // Rote Dreien auslegen und ersetzen
  for (let p = 0; p < n; p++) {
    let i;
    while ((i = s.hands[p].findIndex(isRed3)) >= 0) {
      s.red3[p % 2].push(s.hands[p].splice(i, 1)[0]);
      s.hands[p].push(s.stock.pop());
      s.events.push({ type: 'red3', p });
    }
  }
  // Aufgedeckte Karte
  let up = s.stock.pop();
  s.pile.push(up);
  while (isWild(up) || isRed3(up)) {
    s.frozenStart = true;
    up = s.stock.pop();
    s.pile.push(up);
  }
  s.turnStartMelded = s.melded[s.turn];
  return s;
}

export const teamOf = p => p % 2;
export const pileTop = s => s.pile[s.pile.length - 1];
export const pileFrozen = s => s.frozenStart || s.pile.some(isWild);
export const frozenFor = (s, team) => pileFrozen(s) || !s.initial[team];
export const minimum = (s, team) => minimumFor(s.totals[team]);
export const canastas = (s, team) => s.melds[team].filter(m => m.cards.length >= 7);
export const isNaturalMeld = m => !m.cards.some(isWild);
export const canGoOut = (s, team) => canastas(s, team).length >= s.need;
export const partnerOf = (s, p) => (s.n === 4 ? (p + 2) % 4 : -1);

function removeCards(hand, cards) {
  const h = hand.slice();
  for (const c of cards) {
    const i = h.indexOf(c);
    if (i < 0) return null;
    h.splice(i, 1);
  }
  return h;
}

// ---------------------------------------------------------------
// Prüfen von Meldungen
// ---------------------------------------------------------------
// groups: [{ cards }] – jede Gruppe entweder neue Meldung oder Anlegen an eine Meldung gleichen Rangs.
// Liefert { ok, err, plan: [{ rank, cards, add }], hand }.
export function checkMelds(s, p, groups, { handOverride, extraValue = 0, afterTake = false } = {}) {
  const team = teamOf(p);
  const hand0 = handOverride || s.hands[p];
  const all = groups.flatMap(g => g.cards);
  const hand = removeCards(hand0, all);
  if (!hand) return { ok: false, err: 'Diese Karten hast du nicht.' };
  const byRank = new Map();
  for (const g of groups) {
    const nat = g.cards.filter(isNatural);
    if (g.cards.some(isRed3)) return { ok: false, err: 'Rote Dreien werden nie gemeldet – sie liegen schon als Bonus aus.' };
    const ranks = new Set(nat.map(c => c[1]));
    if (ranks.size > 1) return { ok: false, err: 'Eine Meldung besteht aus Karten <b>eines</b> Rangs (plus Joker und Zweien).' };
    let rank = [...ranks][0] || g.rank;
    if (!rank) {
      // nur Joker/Zweien: an eine Meldung anlegen
      if (!g.rank) return { ok: false, err: 'Joker und Zweien allein sind keine Meldung – leg sie an eine Meldung an.' };
      rank = g.rank;
    }
    if (g.rank && g.rank !== rank) return { ok: false, err: 'Die Karten passen nicht zu dieser Meldung.' };
    const cur = byRank.get(rank) || [];
    byRank.set(rank, cur.concat(g.cards));
  }
  const plan = [];
  let newValue = 0;
  const goingOut = hand.length === 0;
  const threes = byRank.get('3');
  byRank.delete('3');
  for (const [rank, cards] of byRank) {
    const existing = s.melds[team].find(m => m.rank === rank);
    const nat = cards.filter(isNatural).length;
    const wild = cards.length - nat;
    if (existing) {
      const w0 = existing.cards.filter(isWild).length;
      if (w0 + wild > 3) return { ok: false, err: 'Eine Meldung darf höchstens <b>drei</b> Joker oder Zweien enthalten.' };
      if (wild && existing.cards.length >= 7 && w0 === 0) return { ok: false, err: 'Eine reine (rote) Canasta bleibt rein – keine Joker oder Zweien mehr anlegen.' };
      plan.push({ rank, cards, add: true });
    } else {
      if (cards.length < 3) return { ok: false, err: `Eine neue Meldung braucht mindestens <b>drei Karten</b> (${RANK_NAME[rank]}).` };
      if (nat < 2) return { ok: false, err: 'Jede Meldung braucht mindestens <b>zwei echte</b> Karten.' };
      if (wild > 3) return { ok: false, err: 'Höchstens drei Joker oder Zweien pro Meldung.' };
      plan.push({ rank, cards, add: false });
      newValue += sumValue(cards);
    }
  }
  if (threes) {
    if (threes.some(isWild)) return { ok: false, err: 'Schwarze Dreien dürfen nicht mit Jokern oder Zweien gemeldet werden.' };
    if (threes.length < 3) return { ok: false, err: 'Mindestens drei schwarze Dreien.' };
    if (!(hand.length <= 1 && canGoOutAfter(s, team, plan))) return { ok: false, err: 'Schwarze Dreien darfst du nur beim <b>Ausgehen</b> melden.' };
    plan.push({ rank: '3', cards: threes, add: false });
    newValue += sumValue(threes);
  }
  if (!s.initial[team]) {
    if (plan.some(x => x.add)) return { ok: false, err: 'Vor der Erstmeldung kannst du nirgends anlegen.' };
    const min = minimum(s, team);
    if (newValue + extraValue < min) return { ok: false, err: `Für die <b>Erstmeldung</b> braucht ihr ${min} Punkte – das sind erst ${newValue + extraValue}.`, short: min - newValue - extraValue };
  }
  // Ausgehen?
  if (hand.length <= 1) {
    if (!canGoOutAfter(s, team, plan)) return { ok: false, err: s.need === 1 ? 'Ausgehen darfst du erst, wenn ihr eine <b>Canasta</b> habt. Behalte mindestens zwei Karten.' : 'Ausgehen darfst du erst mit <b>zwei Canastas</b>. Behalte mindestens zwei Karten.' };
  }
  return { ok: true, plan, hand, goingOut };
}

function canGoOutAfter(s, team, plan) {
  let n = 0;
  const ranks = new Set();
  for (const m of s.melds[team]) {
    const add = plan.filter(x => x.rank === m.rank).reduce((a, x) => a + x.cards.length, 0);
    if (m.cards.length + add >= 7) n++;
    ranks.add(m.rank);
  }
  for (const x of plan) if (!x.add && !ranks.has(x.rank) && x.cards.length >= 7) n++;
  return n >= s.need;
}

function applyPlan(s, p, plan) {
  const team = teamOf(p);
  for (const x of plan) {
    const m = s.melds[team].find(m => m.rank === x.rank);
    if (m) m.cards.push(...x.cards);
    else s.melds[team].push({ rank: x.rank, cards: x.cards.slice() });
    for (const c of x.cards) s.hands[p].splice(s.hands[p].indexOf(c), 1);
  }
  if (plan.length) { s.initial[team] = true; s.melded[p] = true; }
  sortMelds(s, team);
}

function sortMelds(s, team) {
  s.melds[team].sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank]);
  for (const m of s.melds[team]) m.cards.sort((a, b) => isWild(a) - isWild(b));
}

export function meld(s, p, groups) {
  if (s.phase !== 'meld' || s.turn !== p) throw new Error('nicht in der Meldephase');
  const r = checkMelds(s, p, groups);
  if (!r.ok) return r;
  applyPlan(s, p, r.plan);
  s.events.push({ type: 'meld', p, plan: r.plan });
  if (s.hands[p].length === 0) endRound(s, p);
  return r;
}

// ---------------------------------------------------------------
// Ziehen und Stapel
// ---------------------------------------------------------------
export function drawStock(s, p) {
  if (s.phase !== 'draw' || s.turn !== p) throw new Error('nicht dran');
  const got = [];
  for (let k = 0; k < s.drawN; k++) {
    if (!s.stock.length) break;
    let c = s.stock.pop();
    while (isRed3(c)) {
      s.red3[teamOf(p)].push(c);
      s.events.push({ type: 'red3', p });
      if (!s.stock.length) { endRound(s, -1); return got; }
      c = s.stock.pop();
    }
    s.hands[p].push(c);
    got.push(c);
  }
  s.phase = 'meld';
  s.lastDraw = { p, from: 'stock', n: got.length };
  return got;
}

// Mögliche Arten, den Stapel zu nehmen. Für die Erstmeldung werden passende Zusatzmeldungen gesucht.
export function pilePlans(s, p) {
  const top = pileTop(s);
  if (!top || isWild(top) || isBlack3(top) || isRed3(top)) return [];
  const team = teamOf(p);
  const frozen = frozenFor(s, team);
  const hand = s.hands[p];
  const rank = top[1];
  const nats = hand.filter(c => isNatural(c) && c[1] === rank);
  const wilds = hand.filter(isWild);
  const plans = [];
  const existing = s.melds[team].find(m => m.rank === rank);
  if (existing && !frozen && (hand.length + s.pile.length - 1 >= 2 || canGoOut(s, team))) {
    plans.push({ kind: 'add', use: [], extra: [] });
  }
  if (!existing) {
    const restN = s.pile.length - 1;
    const tryUse = (use, kind) => {
      const handAfter = removeCards(hand, use);
      if (s.initial[team]) {
        if (handAfter.length + restN >= 2 || canGoOut(s, team)) plans.push({ kind, use, extra: [] });
        return;
      }
      const min = minimum(s, team);
      const base = value(top) + sumValue(use);
      if (base >= min) { if (handAfter.length + restN >= 2) plans.push({ kind, use, extra: [] }); return; }
      const extra = planMelds(handAfter, min - base, { keep: Math.max(0, 2 - restN), avoidRank: rank });
      if (extra) plans.push({ kind, use, extra });
    };
    if (nats.length >= 2) tryUse(nats.slice(), 'pair');
    if (!frozen && nats.length >= 1 && wilds.length >= 1) tryUse([nats[0], wilds[0]], 'wild');
  }
  return plans;
}

export function takePile(s, p, plan) {
  if (s.phase !== 'draw' || s.turn !== p) throw new Error('nicht dran');
  const team = teamOf(p);
  const top = s.pile.pop();
  const rest = s.pile.splice(0);
  for (const c of plan.use) s.hands[p].splice(s.hands[p].indexOf(c), 1);
  const m = s.melds[team].find(x => x.rank === top[1]);
  if (m) m.cards.push(top, ...plan.use);
  else s.melds[team].push({ rank: top[1], cards: [top, ...plan.use] });
  for (const g of plan.extra) {
    for (const c of g) s.hands[p].splice(s.hands[p].indexOf(c), 1);
    const r = g.find(isNatural)[1];
    const mm = s.melds[team].find(x => x.rank === r);
    if (mm) mm.cards.push(...g); else s.melds[team].push({ rank: r, cards: g.slice() });
  }
  for (const c of rest) {
    if (isRed3(c)) { s.red3[team].push(c); s.events.push({ type: 'red3', p }); }
    else s.hands[p].push(c);
  }
  s.initial[team] = true;
  s.melded[p] = true;
  s.frozenStart = false;
  sortMelds(s, team);
  s.phase = 'meld';
  s.lastDraw = { p, from: 'pile', n: rest.length + 1, top };
  s.events.push({ type: 'take', p, n: rest.length + 1 });
  if (s.hands[p].length === 0) {
    if (canGoOut(s, team)) endRound(s, p);
  }
}

export function discard(s, p, c) {
  if (s.phase !== 'meld' || s.turn !== p) throw new Error('nicht dran');
  const i = s.hands[p].indexOf(c);
  if (i < 0) throw new Error('Karte fehlt');
  if (s.hands[p].length === 1 && !canGoOut(s, teamOf(p))) throw new Error('Ausgehen nicht erlaubt');
  s.hands[p].splice(i, 1);
  s.pile.push(c);
  s.discards.push({ p, c });
  s.events.push({ type: 'discard', p, c });
  if (s.hands[p].length === 0) { endRound(s, p); return; }
  nextTurn(s);
}

export function canDiscard(s, p, c) {
  if (s.hands[p].length === 1 && !canGoOut(s, teamOf(p))) return false;
  return s.hands[p].includes(c);
}

function nextTurn(s) {
  s.turn = (s.turn + 1) % s.n;
  s.phase = 'draw';
  s.turnStartMelded = s.melded[s.turn];
  if (!s.stock.length && !pilePlans(s, s.turn).length) endRound(s, -1);
}

// Muss die Runde enden, weil der Stapel leer ist?
export function stockEmpty(s) { return s.stock.length === 0; }

// ---------------------------------------------------------------
// Abrechnung
// ---------------------------------------------------------------
function endRound(s, outP) {
  s.phase = 'done';
  s.goneOut = outP;
  const res = [0, 1].map(team => {
    const melds = s.melds[team];
    const nat = melds.filter(m => m.cards.length >= 7 && isNaturalMeld(m)).length;
    const mix = melds.filter(m => m.cards.length >= 7 && !isNaturalMeld(m)).length;
    const r3n = s.red3[team].length;
    let r3 = r3n === 4 ? 800 : r3n * 100;
    if (!s.initial[team]) r3 = -r3;
    const out = outP >= 0 && teamOf(outP) === team ? (!s.turnStartMelded && concealedOk(s, outP) ? 200 : 100) : 0;
    const melded = melds.reduce((a, m) => a + sumValue(m.cards), 0);
    const players = [...Array(s.n).keys()].filter(p => teamOf(p) === team);
    const inHand = players.reduce((a, p) => a + sumValue(s.hands[p]), 0);
    const lines = [];
    if (nat) lines.push([`${nat} reine Canasta${nat > 1 ? 's' : ''}`, nat * 500]);
    if (mix) lines.push([`${mix} gemischte Canasta${mix > 1 ? 's' : ''}`, mix * 300]);
    if (r3n) lines.push([`${r3n} rote Drei${r3n > 1 ? 'en' : ''}${r3 < 0 ? ' (ohne Meldung: minus)' : ''}`, r3]);
    if (out) lines.push([out === 200 ? 'Verdeckt ausgegangen' : 'Ausgegangen', out]);
    lines.push(['Gemeldete Karten', melded]);
    if (inHand) lines.push(['Karten auf der Hand', -inHand]);
    const total = nat * 500 + mix * 300 + r3 + out + melded - inHand;
    return { team, total, lines };
  });
  s.result = res;
  s.totals = s.totals.map((t, i) => t + res[i].total);
}

function concealedOk(s, p) { return !s.turnStartMelded; }

// ---------------------------------------------------------------
// Computer
// ---------------------------------------------------------------
function groupsOf(hand) {
  const g = {};
  for (const c of hand) {
    if (isWild(c) || isRed3(c)) continue;
    (g[c[1]] = g[c[1]] || []).push(c);
  }
  return g;
}

// Sucht Meldungen aus der Hand mit mindestens `need` Punkten (für die Erstmeldung).
// keep: so viele Karten müssen übrig bleiben.
export function planMelds(hand, need, { keep = 2, avoidRank = null } = {}) {
  const g = groupsOf(hand);
  const wilds = hand.filter(isWild).sort((a, b) => value(a) - value(b));
  const cands = [];
  for (const [r, cs] of Object.entries(g)) {
    if (r === '3' || r === avoidRank) continue;
    if (cs.length >= 3) cands.push({ cards: cs.slice(), wild: 0 });
    else if (cs.length === 2) cands.push({ cards: cs.slice(), wild: 1 });
  }
  // zuerst reine Meldungen, dann solche mit Joker/Zwei, nach Wert
  cands.sort((a, b) => a.wild - b.wild || sumValue(b.cards) - sumValue(a.cards));
  const chosen = [];
  let total = 0, usedW = 0, used = 0;
  for (const c of cands) {
    if (total >= need) break;
    if (c.wild > wilds.length - usedW) continue;
    const grp = c.cards.concat(wilds.slice(usedW, usedW + c.wild));
    if (hand.length - used - grp.length < keep) continue;
    usedW += c.wild;
    used += grp.length;
    chosen.push(grp);
    total += sumValue(grp);
  }
  // noch zu wenig? Joker an eine gewählte Meldung hängen
  while (total < need && usedW < wilds.length && chosen.length && hand.length - used - 1 >= keep) {
    const grp = chosen.find(x => x.filter(isWild).length < 3);
    if (!grp) break;
    grp.push(wilds[usedW]); total += value(wilds[usedW]); usedW++; used++;
  }
  return total >= need && chosen.length ? chosen : null;
}

// Komplette Planung eines Zugs für Spieler p (auch als Tipp für dich)
export function aiDraw(s, p, level = 'mittel', rnd = Math.random) {
  const plans = pilePlans(s, p);
  if (!plans.length) return { take: null, why: s.stock.length ? 'Die Ablage lässt sich gerade nicht nehmen – also vom Talon ziehen.' : '' };
  const pileN = s.pile.length;
  // bevorzugt ohne Joker
  plans.sort((a, b) => (a.kind === 'wild') - (b.kind === 'wild') || a.extra.length - b.extra.length);
  const best = plans[0];
  if (level === 'leicht' && rnd() < 0.35) return { take: null, why: '' };
  if (best.kind === 'wild' && pileN < 4) return { take: null, why: 'Für so eine kleine Ablage lohnt es sich nicht, einen Joker herzugeben.' };
  const kn = `${pileN} ${pileN === 1 ? 'Karte' : 'Karten'}`;
  const why = best.kind === 'add' ? `Die oberste Karte passt an eure Meldung – nimm die Ablage (${kn})!`
    : best.kind === 'pair' ? `Du hast ein Paar ${RANK_NAME[pileTop(s)[1]]} – damit darfst du die Ablage (${kn}) nehmen.`
      : `Mit einer ${RANK_ONE[pileTop(s)[1]]} und einem Joker/einer Zwei kannst du die Ablage (${kn}) nehmen.`;
  return { take: best, why: why + (best.extra.length ? ' Die Erstmeldung schaffst du zusammen mit weiteren Karten aus der Hand.' : '') };
}

// Meldungen nach dem Ziehen
export function aiMelds(s, p, level = 'mittel') {
  const team = teamOf(p);
  let hand = s.hands[p].slice();
  const groups = [];
  const why = [];
  if (!s.initial[team]) {
    const pl = planMelds(hand, minimum(s, team), { keep: 2 });
    if (!pl) return { groups: [], why: [] };
    for (const g of pl) groups.push({ cards: g });
    why.push(`Erstmeldung: Zusammen ${pl.reduce((a, g) => a + sumValue(g), 0)} Punkte – mindestens ${minimum(s, team)} sind nötig.`);
    return finishMelds(s, p, groups, why, level);
  }
  const g = groupsOf(hand);
  for (const [r, cs] of Object.entries(g)) {
    if (r === '3') continue;
    const existing = s.melds[team].find(m => m.rank === r);
    if (existing) { groups.push({ cards: cs.slice(), rank: r }); why.push(`${RANK_NAME[r]} an eure Meldung anlegen.`); }
    else if (cs.length >= 3) { groups.push({ cards: cs.slice() }); why.push(`Drei ${RANK_NAME[r]} – eine neue Meldung.`); }
  }
  return finishMelds(s, p, groups, why, level);
}

function finishMelds(s, p, groups, why, level = 'mittel') {
  const team = teamOf(p);
  // Joker/Zweien zum Vervollständigen von Canastas
  let hand = removeCards(s.hands[p], groups.flatMap(x => x.cards)) || s.hands[p].slice();
  const wilds = hand.filter(isWild);
  if (s.initial[team] || groups.length) {
    const sizes = new Map(s.melds[team].map(m => [m.rank, { n: m.cards.length, w: m.cards.filter(isWild).length }]));
    for (const g0 of groups) {
      const r = g0.rank || g0.cards.find(isNatural)[1];
      const cur = sizes.get(r) || { n: 0, w: 0 };
      sizes.set(r, { n: cur.n + g0.cards.length, w: cur.w + g0.cards.filter(isWild).length });
    }
    const haveCanasta = [...sizes.values()].filter(x => x.n >= 7).length;
    for (const [r, sz] of sizes) {
      if (!wilds.length) break;
      if (sz.n >= 7) continue;
      const needW = 7 - sz.n;
      const wantCanasta = haveCanasta < s.need || level === 'schwer';
      if (needW <= 2 && needW <= wilds.length && sz.w + needW <= 3 && wantCanasta && hand.length - needW >= 2) {
        const add = wilds.splice(0, needW);
        groups.push({ cards: add, rank: r });
        hand = removeCards(hand, add);
        why.push(`Mit ${add.length === 1 ? 'einem Joker/einer Zwei' : 'Jokern/Zweien'} wird die ${RANK_NAME[r]}-Meldung zur Canasta.`);
        sz.n += needW; sz.w += needW;
      }
    }
  }
  // Ausgehen möglich?
  const test = checkMelds(s, p, merge(groups));
  if (!test.ok) {
    // Zu viel gemeldet? Gruppen schrittweise zurücknehmen
    const ok = [];
    for (const g of groups) {
      const t2 = checkMelds(s, p, merge(ok.concat([g])));
      if (t2.ok) ok.push(g);
    }
    return { groups: merge(ok), why: ok.length ? why : [] };
  }
  return { groups: merge(groups), why };
}

function merge(groups) {
  const byKey = new Map();
  for (const g of groups) {
    const r = g.rank || (g.cards.find(isNatural) || [])[1];
    const k = r || Math.random();
    const cur = byKey.get(k);
    if (cur) cur.cards = cur.cards.concat(g.cards);
    else byKey.set(k, { cards: g.cards.slice(), rank: g.rank || r });
  }
  return [...byKey.values()];
}

// Ausgehen: alles melden, was geht, bis höchstens eine Karte übrig ist
export function aiGoOut(s, p) {
  const team = teamOf(p);
  if (!s.initial[team]) return null;
  const hand = s.hands[p];
  const g = groupsOf(hand);
  const groups = [];
  const wilds = hand.filter(isWild);
  for (const [r, cs] of Object.entries(g)) {
    const existing = s.melds[team].find(m => m.rank === r);
    if (existing || cs.length >= 3 || (r === '3' && cs.length >= 3)) groups.push({ cards: cs.slice(), rank: existing ? r : undefined });
  }
  for (const w of wilds) {
    const target = s.melds[team].find(m => m.cards.filter(isWild).length < 3 && !(m.cards.length >= 7 && isNaturalMeld(m)));
    if (target) groups.push({ cards: [w], rank: target.rank });
  }
  const mg = merge(groups);
  const r = checkMelds(s, p, mg);
  if (r.ok && r.hand.length <= 1) return { groups: mg, discard: r.hand[0] || null };
  return null;
}

// Abwurf wählen
export function aiDiscard(s, p, level = 'mittel', rnd = Math.random) {
  const hand = s.hands[p];
  const team = teamOf(p);
  const opp = 1 - team;
  const next = (p + 1) % s.n;
  const pileN = s.pile.length;
  const frozenNext = frozenFor(s, opp) || pileFrozen(s);
  const g = groupsOf(hand);
  const oppDiscarded = new Set(s.discards.filter(d => teamOf(d.p) === opp).map(d => d.c[1]));
  const cands = hand.slice();
  if (level === 'leicht' && rnd() < 0.3) {
    const nw = cands.filter(c => !isWild(c));
    const c = (nw.length ? nw : cands)[Math.floor(rnd() * (nw.length ? nw.length : cands.length))];
    return { card: c, why: '' };
  }
  let best = null;
  for (const c of cands) {
    let score = 0;
    let why = '';
    if (isWild(c)) {
      score += 60;
      if (level !== 'leicht' && pileN >= 10 && !frozenNext && s.initial[opp]) { score -= 70; why = `Die Ablage ist groß (${pileN} Karten). Mit einer Zwei/einem Joker frierst du sie ein – die Gegner brauchen dann ein echtes Paar.`; }
    } else if (isBlack3(c)) {
      score -= 30; why = 'Eine schwarze Drei blockiert die Ablage: Der nächste Spieler kann sie nicht nehmen.';
    } else {
      const r = c[1];
      const n = (g[r] || []).length;
      if (n >= 2) score += 18 + n * 4; // Paare behalten
      if (s.melds[team].some(m => m.rank === r)) score += 25; // hätte man anlegen können
      const oppMeld = s.melds[opp].some(m => m.rank === r);
      if (oppMeld && !frozenNext) { score += 50 + pileN * 3; }
      if (oppDiscarded.has(r)) { score -= 12; if (!why) why = `Die Gegner haben selbst schon ${RANK_NAME[r]} abgeworfen – sie sammeln sie wohl nicht.`; }
      // spätes Spiel: hohe Karten loswerden
      score -= value(c) * (s.stock.length < 20 ? 0.4 : 0.1);
      if (!why) why = n === 1 ? `Eine einzelne ${RANK_ONE[r]} – die brauchst du am wenigsten.` : '';
    }
    if (!best || score < best.score) best = { card: c, score, why };
  }
  return { card: best.card, why: best.why || 'Diese Karte hilft dir am wenigsten und den Gegnern kaum.' };
}

// Ein ganzer Computerzug (für Simulationen und Tests)
export function aiFullTurn(s, p, level = 'mittel', rnd = Math.random) {
  if (s.phase !== 'draw') return;
  let d = aiDraw(s, p, level, rnd);
  if (!d.take && !s.stock.length) { const pl = pilePlans(s, p); if (pl.length) d = { take: pl[0] }; }
  if (d.take) takePile(s, p, d.take);
  else if (s.stock.length) drawStock(s, p);
  else { endRound(s, -1); return; }
  if (s.phase === 'done') return;
  const out = aiGoOut(s, p);
  if (out) {
    if (out.groups.length) meld(s, p, out.groups);
    if (s.phase === 'done') return;
    if (out.discard) { discard(s, p, out.discard); return; }
  }
  const m = aiMelds(s, p, level);
  if (m.groups.length) {
    const r = meld(s, p, m.groups);
    if (!r.ok) { /* sollte nicht passieren */ }
  }
  if (s.phase === 'done') return;
  const dc = aiDiscard(s, p, level, rnd);
  discard(s, p, dc.card);
}
