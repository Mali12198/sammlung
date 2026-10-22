import {
  analyze, extendMeld, jokerSwapIndex, meldValue, newRound, drawStock, takePile, canTakePile, meldNew, addTo, discard,
  aiDraw, aiPlan, aiDiscard, bestMelds, handPoints, pileTop,
} from '../js/games/romme/engine.js';
import { seeded } from '../js/util.js';

export function playTurn(s, p, level) {
  const d = aiDraw(s, p, level);
  if (d.pile) takePile(s, p); else drawStock(s, p);
  for (const a of aiPlan(s, p, level)) {
    if (s.phase === 'done') break;
    const r = a.kind === 'new' ? meldNew(s, p, a.groups) : addTo(s, p, a.idx, a.kind === 'swap' ? [a.card] : a.cards);
    if (!r.ok) throw new Error('KI-Aktion ungültig: ' + JSON.stringify(a) + ' ' + r.err);
  }
  if (s.phase !== 'done') discard(s, p, aiDiscard(s, p, level).card);
}

export function playRound(levels, rnd, opts = {}) {
  const s = newRound({ n: levels.length, dealer: 0, rnd, ...opts });
  let turns = 0;
  while (s.phase !== 'done' && turns < 600) {
    playTurn(s, s.turn, levels[s.turn]);
    turns++;
    const total = s.hands.flat().length + s.stock.length + s.pile.length + s.melds.reduce((a, m) => a + m.cards.length, 0);
    if (total !== 110) throw new Error('Kartenzahl ' + total);
    for (const m of s.melds) if (!analyze(m.cards.slice())) { /* Joker-Positionen sind fest – nur grob prüfen */ if (m.cards.length < 3) throw new Error('Meldung zu kurz'); }
  }
  return { s, turns };
}

export default function (t) {
  t('Sätze und Folgen', () => {
    t.eq(analyze(['H5', 'S5', 'C5']).type, 'set');
    t.eq(analyze(['H5', 'H5', 'C5']), null, 'gleiche Farbe zweimal im Satz');
    t.eq(analyze(['HQ', 'HK', 'HA']).lo, 12, 'Ass hoch');
    t.eq(analyze(['HA', 'H2', 'H3']).lo, 1, 'Ass niedrig');
    t.eq(analyze(['HK', 'HA', 'H2']), null, 'nicht um die Ecke');
    t.eq(analyze(['H5', 'XX', 'H7']).cards[1], 'XX');
    t.eq(analyze(['XX', 'XX', 'H7']), null, 'mindestens zwei echte Karten');
  });
  t('Werte', () => {
    t.eq(meldValue(analyze(['HQ', 'HK', 'HA'])), 31);
    t.eq(meldValue(analyze(['HA', 'H2', 'H3'])), 6);
    t.eq(meldValue(analyze(['H5', 'S5', 'XX'])), 15);
    t.eq(handPoints(['XX', 'SA', 'DK', 'H7']), 48);
  });
  t('Anlegen und Joker tauschen', () => {
    const m = analyze(['H5', 'H6', 'H7']);
    t.eq(extendMeld(m, ['H8']).cards.length, 4);
    t.eq(extendMeld(m, ['H4', 'H3']).lo, 3);
    t.eq(extendMeld(m, ['S8']), null);
    t.eq(extendMeld(analyze(['HJ', 'HQ', 'HK']), ['HA']).lo, 11);
    t.eq(jokerSwapIndex(analyze(['H5', 'XX', 'H7']), 'H6'), 1);
    t.eq(jokerSwapIndex(analyze(['H5', 'S5', 'XX']), 'C5'), 2);
    t.eq(jokerSwapIndex(analyze(['H5', 'S5', 'XX']), 'H5'), -1);
  });
  t('Rauskommen braucht 40 Punkte', () => {
    const s = newRound({ n: 2, rnd: seeded(1) });
    s.hands[s.turn] = ['H2', 'H3', 'H4', 'S9', 'C9', 'D9', 'HK', 'SK', 'CK', 'D5', 'D6', 'C2', 'S3', 'H8'];
    s.phase = 'play';
    const p = s.turn;
    t.ok(!meldNew(s, p, [['H2', 'H3', 'H4']]).ok, '9 Punkte reichen nicht');
    t.ok(meldNew(s, p, [['S9', 'C9', 'D9'], ['HK', 'SK', 'CK']]).ok, '57 Punkte');
    t.ok(s.out[p]);
    t.ok(meldNew(s, p, [['H2', 'H3', 'H4']]).ok, 'danach geht alles');
  });
  t('Bestes Melden findet Kombinationen', () => {
    const b = bestMelds(['H2', 'H3', 'H4', 'H5', 'S5', 'C5', 'XX', 'DK', 'DQ']);
    t.ok(b.value >= 30, 'Wert ' + b.value);
  });
  t('Computer-Runden laufen durch', () => {
    const rnd = seeded(7);
    let turns = 0, hr = 0;
    const N = 30;
    for (let i = 0; i < N; i++) {
      const lv = [['mittel', 'mittel'], ['mittel', 'leicht', 'schwer'], ['schwer', 'mittel', 'leicht', 'mittel']][i % 3];
      const r = playRound(lv, rnd);
      if (r.s.phase !== 'done') throw new Error('Runde endet nicht');
      turns += r.turns;
      if (r.s.result.handRomme) hr++;
      t.ok(r.s.result.penalties[r.s.result.winner] === 0);
    }
    console.log(`       Ø ${Math.round(turns / N)} Züge je Runde, ${hr}× Hand-Rommé`);
  });
  t('Mittel schlägt Leicht', () => {
    const rnd = seeded(11);
    let w = 0; const N = 40;
    for (let i = 0; i < N; i++) {
      const lv = i % 2 ? ['mittel', 'leicht'] : ['leicht', 'mittel'];
      const r = playRound(lv, rnd);
      if (lv[r.s.result.winner] === 'mittel') w++;
    }
    console.log(`       Mittel gewinnt ${w}/${N} Runden`);
    t.ok(w > N * 0.55);
  });
}
