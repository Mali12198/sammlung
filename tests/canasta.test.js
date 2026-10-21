import {
  newRound, aiFullTurn, isWild, isNatural, checkMelds, minimumFor, pilePlans, takePile, drawStock, meld, discard, sumValue, value,
  planMelds, isRed3,
} from '../js/games/canasta/engine.js';
import { seeded } from '../js/util.js';

function count(s) {
  return s.hands.flat().length + s.stock.length + s.pile.length + s.melds.flat().reduce((a, m) => a + m.cards.length, 0) + s.red3.flat().length;
}
function checkInvariants(s) {
  if (count(s) !== 108) throw new Error('Kartenzahl ' + count(s));
  for (const t of [0, 1]) {
    const ranks = new Set();
    for (const m of s.melds[t]) {
      if (ranks.has(m.rank)) throw new Error('doppelte Meldung ' + m.rank);
      ranks.add(m.rank);
      const nat = m.cards.filter(isNatural).length, w = m.cards.length - nat;
      if (nat < 2 || w > 3 || m.cards.length < 3) throw new Error('ungültige Meldung ' + JSON.stringify(m));
      if (m.cards.some(c => isNatural(c) && c[1] !== m.rank)) throw new Error('falscher Rang in Meldung');
    }
  }
  if (s.hands.flat().some(isRed3)) throw new Error('rote Drei auf der Hand');
}

export function playRound(n, levels, rnd, totals = [0, 0]) {
  const s = newRound({ n, dealer: 0, totals, rnd });
  let turns = 0;
  while (s.phase !== 'done' && turns < 600) {
    aiFullTurn(s, s.turn, levels[s.turn], rnd);
    checkInvariants(s);
    turns++;
  }
  return { s, turns };
}

export default function (t) {
  t('Kartenwerte und Mindestmeldung', () => {
    t.eq([value('XX'), value('C2'), value('HA'), value('SK'), value('D7'), value('C3')], [50, 20, 20, 10, 5, 5]);
    t.eq([minimumFor(-10), minimumFor(0), minimumFor(1500), minimumFor(3000)], [15, 50, 90, 120]);
  });
  t('Meldungen prüfen', () => {
    const s = newRound({ n: 4, rnd: seeded(1) });
    s.phase = 'meld'; s.turn = 0;
    s.hands[0] = ['HK', 'SK', 'CK', 'XX', 'D7', 'C7', 'S9', 'H4', 'C2', 'D2', 'S2', 'HQ'];
    t.ok(checkMelds(s, 0, [{ cards: ['HK', 'SK', 'CK'] }]).ok === false, 'nur 30 – Erstmeldung zu klein');
    t.ok(checkMelds(s, 0, [{ cards: ['HK', 'SK', 'CK', 'XX'] }]).ok, '80 reicht');
    t.ok(!checkMelds(s, 0, [{ cards: ['HK', 'XX', 'C2'] }]).ok, 'zu wenige echte Karten');
    t.ok(!checkMelds(s, 0, [{ cards: ['HK', 'SK', 'XX', 'C2', 'D2', 'S2'] }]).ok, 'zu viele Joker');
    s.initial[0] = true;
    s.melds[0] = [{ rank: 'Q', cards: ['HQ', 'SQ', 'CQ', 'DQ', 'HQ', 'SQ', 'CQ'] }];
    s.hands[0] = ['DQ', 'XX', 'H4', 'S9'];
    t.ok(!checkMelds(s, 0, [{ cards: ['XX'], rank: 'Q' }]).ok, 'reine Canasta bleibt rein');
    t.ok(checkMelds(s, 0, [{ cards: ['DQ'], rank: 'Q' }]).ok, 'echte Dame anlegen');
  });
  t('Stapel eingefroren: nur mit echtem Paar', () => {
    const s = newRound({ n: 4, rnd: seeded(2) });
    s.turn = 0; s.phase = 'draw'; s.initial[0] = true; s.frozenStart = false;
    s.pile = ['C9', 'D2', 'HK'];
    s.hands[0] = ['SK', 'XX', 'H5', 'D6'];
    t.eq(pilePlans(s, 0).length, 0, 'eingefroren, kein Paar');
    s.hands[0] = ['SK', 'CK', 'H5', 'D6'];
    t.eq(pilePlans(s, 0).length, 1);
    s.pile = ['C9', 'D8', 'HK'];
    s.hands[0] = ['SK', 'XX', 'H5', 'D6'];
    t.eq(pilePlans(s, 0).map(x => x.kind), ['wild'], 'offen: König + Joker');
  });
  t('Erstmeldung beim Stapelnehmen sucht Zusatzmeldungen', () => {
    const s = newRound({ n: 4, rnd: seeded(3) });
    s.turn = 0; s.phase = 'draw'; s.frozenStart = false;
    s.pile = ['C9', 'H6'];
    s.hands[0] = ['S6', 'C6', 'HA', 'SA', 'CA', 'D4', 'S8'];
    const pl = pilePlans(s, 0);
    t.eq(pl.length, 1);
    t.eq(pl[0].extra.length, 1, 'Asse als Zusatzmeldung');
    takePile(s, 0, pl[0]);
    t.ok(s.initial[0] && s.melds[0].length === 2, 'zwei Meldungen');
    t.ok(s.hands[0].includes('C9'), 'Stapel aufgenommen');
  });
  t('200 Runden zu viert (Computer)', () => {
    const rnd = seeded(11);
    let out = 0, turns = 0, sumScore = 0, canastas = 0;
    for (let i = 0; i < 200; i++) {
      const r = playRound(4, ['mittel', 'mittel', 'mittel', 'mittel'], rnd);
      if (r.s.phase !== 'done') throw new Error('Runde endet nicht');
      if (r.s.goneOut >= 0) out++;
      turns += r.turns;
      sumScore += r.s.result[0].total + r.s.result[1].total;
      canastas += r.s.melds.flat().filter(m => m.cards.length >= 7).length;
    }
    console.log(`       ausgegangen: ${out}/200, Ø Züge ${Math.round(turns / 200)}, Ø Punkte je Team ${Math.round(sumScore / 400)}, Ø Canastas ${(canastas / 200).toFixed(1)}`);
    t.ok(out > 100, 'meist geht jemand aus');
  });
  t('100 Runden zu zweit (Computer)', () => {
    const rnd = seeded(12);
    let out = 0;
    for (let i = 0; i < 100; i++) {
      const r = playRound(2, ['mittel', 'leicht'], rnd);
      if (r.s.phase !== 'done') throw new Error('Runde endet nicht');
      if (r.s.goneOut >= 0) out++;
    }
    console.log(`       ausgegangen: ${out}/100`);
  });
  t('Mittel schlägt Leicht', () => {
    const rnd = seeded(21);
    let diff = 0;
    for (let i = 0; i < 80; i++) {
      const r = playRound(4, ['mittel', 'leicht', 'mittel', 'leicht'], rnd);
      diff += r.s.result[0].total - r.s.result[1].total;
    }
    console.log('       Punktvorsprung Mittel je Runde:', Math.round(diff / 80));
    t.ok(diff > 0);
  });
}
