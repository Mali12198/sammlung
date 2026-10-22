import {
  BID_VALUES, matadors, beats, trickWinnerIdx, gameValue, newRound, bidAction, aiBid, takeSkat, declare,
  chooseDeclaration, chooseHandGame, playCard, collectTrick, aiCard, legalFor, cardsPoints, nullRisk, sortHand, policy,
  startRamsch, canKontra, canRe, sayKontra, sayRe, aiKontra, aiRe, settle,
} from '../js/games/skat/engine.js';
import { seeded } from '../js/util.js';

export function playRound(dealer, levels, rnd, log, opts = {}) {
  const s = newRound(dealer, rnd, opts);
  let guard = 0;
  while (s.phase === 'bid' && guard++ < 100) bidAction(s, s.bid.turn, aiBid(s, s.bid.turn, levels[s.bid.turn]));
  if (s.phase === 'allpass') return { s, allpass: true };
  if (s.phase === 'skat') {
    const d = s.declarer, lv = levels[d];
    const hg = chooseHandGame(s.hands[d], s.bid.value, lv);
    if (hg) declare(s, hg.game);
    else {
      takeSkat(s);
      const ch = chooseDeclaration(s.hands[d], s.bid.value, lv);
      declare(s, ch.game, ch.put);
    }
  }
  guard = 0;
  while (s.phase !== 'done' && guard++ < 100) {
    if (s.phase === 'collect') { collectTrick(s); continue; }
    const p = s.turn;
    if (canKontra(s, p) && aiKontra(s, p, levels[p], rnd)) sayKontra(s, p);
    if (canRe(s, p) && aiRe(s, p, levels[p], rnd)) sayRe(s, p);
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
  t('Ramsch: Augen, Verlierer, Skat an den letzten Stich', () => {
    const rnd = seeded(21);
    let jf = 0;
    for (let i = 0; i < 120; i++) {
      const s = newRound(i % 3, rnd, { ramsch: true, bock: i % 2 === 0 });
      startRamsch(s);
      const lv = i < 6 ? ['leicht', 'mittel', 'schwer'] : ['leicht', 'mittel', 'mittel'];
      while (s.phase !== 'done') {
        if (s.phase === 'collect') { collectTrick(s); continue; }
        const c = aiCard(s, s.turn, lv[s.turn], rnd);
        if (!legalFor(s, s.turn).includes(c)) throw new Error('illegale Karte');
        playCard(s, s.turn, c);
      }
      const r = s.result;
      t.eq(r.pts.reduce((a, b) => a + b, 0), 120);
      if (r.durchmarsch < 0) {
        const max = Math.max(...r.pts);
        t.ok(r.losers.length >= 1 && r.losers.every(p => r.pts[p] === max));
        for (const p of r.losers) t.eq(r.scores[p], -max * (r.jungfrau ? 2 : 1) * (i % 2 === 0 ? 2 : 1));
      }
      if (r.jungfrau) jf++;
    }
    console.log(`       120 Ramsch-Runden, ${jf}× Jungfrau`);
  });
  t('Alle passen: mit Hausregel Ramsch statt Einpassen', () => {
    const s = newRound(0, seeded(1), { ramsch: true });
    bidAction(s, s.bid.turn, 'pass'); bidAction(s, s.bid.turn, 'pass'); bidAction(s, s.bid.turn, 'pass');
    t.eq(s.game && s.game.type, 'R'); t.eq(s.phase, 'play'); t.eq(s.turn, s.V);
    const u = newRound(0, seeded(1));
    bidAction(u, u.bid.turn, 'pass'); bidAction(u, u.bid.turn, 'pass'); bidAction(u, u.bid.turn, 'pass');
    t.eq(u.phase, 'allpass');
  });
  t('Kontra und Re verdoppeln, Bock auch', () => {
    const s = newRound(2, seeded(3), { kontra: true, bock: true });
    s.declarer = 0; s.phase = 'skat'; s.bid.value = 18;
    takeSkat(s); declare(s, { type: 'G' }, s.hands[0].slice(0, 2));
    const def = s.turn === 0 ? 1 : s.turn;   // erster Gegenspieler am Zug
    while (s.turn !== def) playCard(s, s.turn, legalFor(s, s.turn)[0]);
    t.ok(canKontra(s, def)); sayKontra(s, def); t.ok(!canKontra(s, def));
    while (s.turn !== 0) { if (s.phase === 'collect') { collectTrick(s); continue; } playCard(s, s.turn, legalFor(s, s.turn)[0]); }
    if (canRe(s, 0)) sayRe(s, 0); else { s.kontra.re = true; }
    while (s.phase !== 'done') { if (s.phase === 'collect') { collectTrick(s); continue; } playCard(s, s.turn, legalFor(s, s.turn)[0]); }
    const r = s.result;
    t.eq(r.kontra, 4); t.eq(r.bock, 2);
    t.eq(r.score, (r.won ? r.value : -2 * r.value) * 8);
  });
  t('Hausregeln: 300 Computer-Runden laufen durch', () => {
    const rnd = seeded(77);
    let k = 0, ram = 0;
    for (let i = 0; i < 300; i++) {
      const { s, allpass } = playRound(i % 3, ['mittel', 'leicht', 'mittel'], rnd, null, { ramsch: true, kontra: true });
      if (allpass) throw new Error('mit Ramsch gibt es kein Einpassen');
      if (s.game.type === 'R') ram++;
      else if (s.kontra && s.kontra.by >= 0) k++;
    }
    console.log(`       ${ram} Ramsch, ${k}× Kontra`);
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
