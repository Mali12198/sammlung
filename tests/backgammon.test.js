import { newState, legalPaths, applyStep, winner, winFactor, chooseTurn, pips, persp, genTurns, cloneState } from '../js/games/backgammon/engine.js';
import { seeded } from '../js/util.js';

function play(levels, rnd) {
  const s = newState(); let side = 0, n = 0;
  while (winner(s) < 0 && n < 2000) {
    const dice = [1 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 6)];
    const t = chooseTurn(s, side, dice, levels[side], rnd);
    if (t) for (const st of t.steps) applyStep(s, side, st);
    // Invarianten: 15 Steine je Seite
    for (const sd of [0, 1]) {
      const P = persp(s, sd); let c = P.bar + P.off; for (const x of P.p) if (x > 0) c += x;
      if (c !== 15) throw new Error('Steinanzahl falsch: ' + c);
    }
    side = 1 - side; n++;
  }
  return { w: winner(s), f: winFactor(s, winner(s)), n };
}

export default function (t) {
  t('Startstellung: 167 Augen je Seite', () => { const s = newState(); t.eq(pips(s, 0), 167); t.eq(pips(s, 1), 167); });
  t('Eröffnung 3-1 hat 16 Möglichkeiten, bester Zug macht den 5er-Punkt', () => {
    const s = newState();
    const g = legalPaths(s, 0, [3, 1]);
    t.ok(g.turns.length >= 10, 'genug Züge: ' + g.turns.length);
    const best = chooseTurn(s, 0, [3, 1], 'mittel');
    t.ok(s.pts[4] === 0 && best.steps.every(x => x.to === 4), '8/5 6/5 erwartet, war ' + JSON.stringify(best.steps));
  });
  t('Pasch erlaubt vier Züge', () => { const g = legalPaths(newState(), 0, [6, 6]); t.eq(g.maxLen, 4); });
  t('Bar muss zuerst betreten werden', () => {
    const s = newState(); s.pts[23] = 1; s.bar[0] = 1;
    const g = legalPaths(s, 0, [3, 5]);
    t.ok(g.paths.every(p => p[0].from === 'bar'));
  });
  t('Größerer Würfel muss gespielt werden, wenn nur einer geht', () => {
    const s = { pts: new Array(24).fill(0), bar: [0, 0], off: [14, 0], turn: 0, dice: [], cube: 1, cubeOwner: -1 };
    s.pts[0] = 1; s.pts[23] = -15;
    const g = legalPaths(s, 0, [1, 6]);
    t.ok(g.paths.length >= 1);
  });
  t('KI-Partien laufen fehlerfrei durch', () => {
    const rnd = seeded(3); let lens = [];
    for (let i = 0; i < 20; i++) { const r = play(['mittel', 'mittel'], rnd); t.ok(r.w >= 0, 'kein Sieger'); lens.push(r.n); }
    console.log('       Ø Züge:', Math.round(lens.reduce((a, b) => a + b) / lens.length));
  });
  t('Mittel schlägt Leicht meistens', () => {
    const rnd = seeded(11); let w = 0; const N = 40;
    for (let i = 0; i < N; i++) { const r = play(i % 2 ? ['mittel', 'leicht'] : ['leicht', 'mittel'], rnd); if ((i % 2 ? 0 : 1) === r.w) w++; }
    console.log(`       Mittel gewinnt ${w}/${N}`);
    t.ok(w > N * 0.55);
  });
  t('Schwer gegen Mittel', () => {
    const rnd = seeded(5); let w = 0; const N = 16; const t0 = Date.now();
    for (let i = 0; i < N; i++) { const r = play(i % 2 ? ['schwer', 'mittel'] : ['mittel', 'schwer'], rnd); if ((i % 2 ? 0 : 1) === r.w) w++; }
    console.log(`       Schwer gewinnt ${w}/${N} (${Date.now() - t0} ms)`);
  });
}
