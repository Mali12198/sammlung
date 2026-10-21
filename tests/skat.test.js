import {
  BID_VALUES, matadors, beats, trickWinnerIdx, gameValue, newRound, bidAction, aiBid, takeSkat, declare,
  chooseDeclaration, chooseHandGame, playCard, collectTrick, aiCard, legalFor, cardsPoints, nullRisk, sortHand, policy,
} from '../js/games/skat/engine.js';
import { seeded } from '../js/util.js';

export function playRound(dealer, levels, rnd, log) {
  const s = newRound(dealer, rnd);
  let guard = 0;
  while (s.phase === 'bid' && guard++ < 100) bidAction(s, s.bid.turn, aiBid(s, s.bid.turn, levels[s.bid.turn]));
  if (s.phase === 'allpass') return { s, allpass: true };
  const d = s.declarer, lv = levels[d];
  const hg = chooseHandGame(s.hands[d], s.bid.value, lv);
  if (hg) declare(s, hg.game);
  else {
    takeSkat(s);
    const ch = chooseDeclaration(s.hands[d], s.bid.value, lv);
    declare(s, ch.game, ch.put);
  }
  guard = 0;
  while (s.phase !== 'done' && guard++ < 100) {
    if (s.phase === 'collect') { collectTrick(s); continue; }
    const p = s.turn;
    const c = aiCard(s, p, levels[p], rnd);
    if (!legalFor(s, p).includes(c)) throw new Error('illegale Karte ' + c);
    playCard(s, p, c);
  }
  if (log) log(s);
  return { s };
}

export default function (t) {
  t('Reizwerte', () => t.eq(BID_VALUES.slice(0, 12), [18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44]));
  t('Spitzen zählen', () => {
    t.eq(matadors(['CJ', 'SJ', 'DJ', 'HA'], 'H'), { mit: true, n: 2 });
    t.eq(matadors(['HJ', 'DJ', 'HA'], 'H'), { mit: false, n: 2 });
    t.eq(matadors(['CJ', 'SJ', 'HJ', 'DJ', 'CA', 'CT', 'CK'], 'C'), { mit: true, n: 7 });
  });
  t('Stichregeln', () => {
    t.ok(beats('DJ', 'HA', 'H'), 'Bube sticht Trumpf-Ass');
    t.ok(!beats('CA', 'S7', 'H'), 'Abwerfen gewinnt nicht');
    t.ok(beats('H7', 'CA', 'H'), 'Trumpf sticht Fehl');
    t.eq(trickWinnerIdx(['ST', 'SA', 'S7'], 'G'), 1);
    t.eq(trickWinnerIdx(['ST', 'SJ', 'SA'], 'N'), 2);
    t.ok(beats('CT', 'C9', 'N') && beats('CJ', 'CT', 'N'), 'Null: Zehn unter Bube');
  });
  t('Spielwert', () => {
    t.eq(gameValue({ type: 'C', hand: true, schneider: true }, ['CJ', 'SJ']), 12 * 6);
    t.eq(gameValue({ type: 'G' }, ['CJ', 'SJ', 'HJ']), 24 * 4);
    t.eq(gameValue({ type: 'N', ouvert: true }, []), 46);
    t.eq(gameValue({ type: 'D' }, ['DA']), 9 * 5, 'ohne 4');
  });
  t('Nullrisiko', () => {
    t.eq(nullRisk(['C7', 'C9', 'CJ', 'S7', 'H8', 'H7', 'D7', 'D9', 'S9', 'SJ']), 0);
    t.ok(nullRisk(['CA', 'C9', 'CJ', 'S7', 'H8', 'H7', 'D7', 'D9', 'S9', 'SJ']) > 0);
  });
  t('Sortierung', () => t.eq(sortHand(['H7', 'CJ', 'HA', 'SA', 'DJ'], 'H'), ['CJ', 'DJ', 'HA', 'H7', 'SA']));
  t('300 Computer-Runden: Regeln und Augen stimmen', () => {
    const rnd = seeded(42);
    let played = 0, won = 0, pass = 0;
    const types = {};
    for (let i = 0; i < 300; i++) {
      const { s, allpass } = playRound(i % 3, ['mittel', 'mittel', 'mittel'], rnd);
      if (allpass) { pass++; continue; }
      played++;
      const total = cardsPoints(s.taken.flat()) + cardsPoints(s.put);
      if (total !== 120) throw new Error('Augen ≠ 120: ' + total);
      if (s.game.type !== 'N' && s.tricks.length !== 10) throw new Error('nicht 10 Stiche');
      if (s.result.won) won++;
      types[s.game.type] = (types[s.game.type] || 0) + 1;
    }
    console.log(`       ${played} Spiele, ${pass} eingepasst, Alleinspieler gewinnt ${Math.round(won / played * 100)} %`, JSON.stringify(types));
    t.ok(won / played > 0.45 && won / played < 0.92, 'plausible Gewinnquote');
  });
  t('Tipp liefert immer eine Begründung', () => {
    const rnd = seeded(9);
    for (let i = 0; i < 20; i++) {
      const s = newRound(0, rnd);
      while (s.phase === 'bid') bidAction(s, s.bid.turn, aiBid(s, s.bid.turn, 'leicht'));
      if (s.phase === 'allpass') continue;
      takeSkat(s); const ch = chooseDeclaration(s.hands[s.declarer], s.bid.value); declare(s, ch.game, ch.put);
      while (s.phase !== 'done') {
        if (s.phase === 'collect') { collectTrick(s); continue; }
        const r = policy(s, s.turn);
        if (!r.why) throw new Error('keine Begründung');
        playCard(s, s.turn, r.card);
      }
    }
  });
}
