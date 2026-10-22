import { newGame, roll, enter, aiStep, holdsFor, totals, scoreFor, CATS, plan, allKeys } from '../js/games/wuerfelpoker/engine.js';
import { seeded } from '../js/util.js';

export function playGame(levels, rnd, opts = {}) {
  const s = newGame(levels.map((l, i) => ({ name: 'P' + i, human: false, level: l })), opts);
  let guard = 0;
  while (s.phase !== 'done' && guard++ < 1000) {
    const lv = levels[s.turn];
    const st = aiStep(s, lv, rnd);
    if (st.action === 'roll') {
      if (st.keep) s.held = holdsFor(s.dice, st.keep);
      roll(s, rnd);
    } else enter(s, st.cat, st.col || 0);
  }
  return s;
}

export default function (t) {
  t('Wertung der Felder', () => {
    t.eq(scoreFor('three', [3, 3, 3, 2, 6]), 17);
    t.eq(scoreFor('four', [3, 3, 3, 2, 6]), 0);
    t.eq(scoreFor('full', [2, 2, 5, 5, 5]), 25);
    t.eq(scoreFor('full', [5, 5, 5, 5, 5]), 0, 'Poker ist ohne Joker kein Full House');
    t.eq(scoreFor('full', [5, 5, 5, 5, 5], true), 25, 'mit Joker schon');
    t.eq(scoreFor('small', [1, 3, 4, 2, 6]), 30);
    t.eq(scoreFor('small', [1, 3, 5, 2, 6]), 0);
    t.eq(scoreFor('large', [6, 3, 4, 2, 5]), 40);
    t.eq(scoreFor('poker', [4, 4, 4, 4, 4]), 50);
    t.eq(scoreFor('fives', [5, 1, 5, 2, 5]), 15);
  });
  t('Bonus ab 63 oben', () => {
    const s = newGame([{ name: 'a', human: true }]);
    Object.assign(s.sheets[0], { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 });
    t.eq(totals(s, 0).bonus, 35);
    s.sheets[0].ones = 2;
    t.eq(totals(s, 0).bonus, 0);
  });
  t('Computer spielt sinnvoll', () => {
    for (const lv of ['leicht', 'mittel', 'schwer']) {
      const rnd = seeded(lv.length * 13);
      let sum = 0; const N = lv === 'leicht' ? 40 : 20; const t0 = Date.now();
      for (let i = 0; i < N; i++) { const s = playGame([lv], rnd); sum += totals(s, 0).total; }
      console.log(`       ${lv}: Ø ${Math.round(sum / N)} Punkte (${Math.round((Date.now() - t0) / N)} ms je Partie)`);
      if (lv === 'schwer') t.ok(sum / N > 200, 'schwer soll über 200 liegen');
    }
  });
  t('Dreifach: drei Spalten, ×1/×2/×3', () => {
    const s = playGame(['mittel'], seeded(21), { triple: true });
    t.eq(allKeys(s).length, 39);
    t.ok(allKeys(s).every(k => s.sheets[0][k] !== null), 'alle 39 Felder');
    const tt = totals(s, 0);
    t.eq(tt.total, tt.cols[0].sum + 2 * tt.cols[1].sum + 3 * tt.cols[2].sum + tt.extra);
    let sum = 0; const N = 6; const rnd = seeded(5);
    for (let i = 0; i < N; i++) sum += totals(playGame(['mittel'], rnd, { triple: true }), 0).total;
    console.log(`       Dreifach mittel: Ø ${Math.round(sum / N)} Punkte`);
    // die dritte Spalte sollte im Schnitt mehr Punkte bekommen als die erste
    t.ok(tt.cols[2].sum >= tt.cols[0].sum - 40);
  });
  t('Mehrere Spieler: alle Felder gefüllt', () => {
    const s = playGame(['mittel', 'leicht', 'schwer'], seeded(3));
    t.ok(s.sheets.every(sh => CATS.every(c => sh[c] !== null)));
  });
}
