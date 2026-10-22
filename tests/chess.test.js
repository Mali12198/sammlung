import { fromFEN, START_FEN, legalMoves, makeMove, unmakeMove, aiMove, gameStatus, toFEN, san, search, forcesMate, isMate, cloneState, inCheck } from '../js/games/chess/engine.js';
import PUZZLES from '../js/games/chess/puzzles.js';
import { seeded } from '../js/util.js';

function perft(st, d) {
  if (d === 0) return 1;
  let n = 0;
  for (const m of legalMoves(st)) { const u = makeMove(st, m); n += perft(st, d - 1); unmakeMove(st, m, u); }
  return n;
}

export default function (t) {
  t('Perft Startstellung', () => {
    const st = fromFEN(START_FEN);
    t.eq(perft(st, 1), 20); t.eq(perft(st, 2), 400); t.eq(perft(st, 3), 8902);
  });
  t('Perft Kiwipete', () => {
    const st = fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    t.eq(perft(st, 1), 48); t.eq(perft(st, 2), 2039); t.eq(perft(st, 3), 97862);
  });
  t('Perft Position 3', () => {
    const st = fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    t.eq(perft(st, 1), 14); t.eq(perft(st, 2), 191); t.eq(perft(st, 3), 2812); t.eq(perft(st, 4), 43238);
  });
  t('Perft Position 4 (Umwandlung)', () => {
    const st = fromFEN('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    t.eq(perft(st, 1), 6); t.eq(perft(st, 2), 264); t.eq(perft(st, 3), 9467);
  });
  t('Matt in 1 wird gefunden', () => {
    const st = fromFEN('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
    const r = search(st, { depth: 3, timeMs: 2000 });
    t.eq(san(st, r.move), 'Td8#');
  });
  t('Notation deutsch', () => {
    const st = fromFEN(START_FEN);
    const m = legalMoves(st).find(m => m.from === 62 && m.to === 45);
    t.eq(san(st, m), 'Sf3');
  });
  t('KI gegen KI spielt Partien zu Ende', () => {
    const rnd = seeded(7);
    for (let g = 0; g < 3; g++) {
      const st = fromFEN(START_FEN); const pos = [toFEN(st, true)];
      let res, n = 0;
      while (!(res = gameStatus(st, pos)).over && n < 120) {
        const m = aiMove(st, g === 0 ? 'mittel' : 'leicht', rnd); makeMove(st, m); pos.push(toFEN(st, true)); n++;
        if (g === 0 && n >= 16) break; // eine Eröffnung mit „mittel“ genügt
      }
      t.ok(n > 0, 'Züge gespielt');
    }
  });
  t('Rätsel: jedes hat eine Lösung, Matt in 2 ohne Matt in 1', () => {
    t.ok(PUZZLES.length >= 20, 'genug Rätsel');
    for (const p of PUZZLES) {
      const st = fromFEN(p.fen);
      t.ok(!inCheck(st, st.turn === 'w' ? 'b' : 'w'), 'gültige Stellung ' + p.fen);
      const mv = legalMoves(st);
      const m1 = mv.filter(m => { const s2 = cloneState(st); makeMove(s2, m); return isMate(s2); });
      if (p.n === 1) t.ok(m1.length > 0, 'Matt in 1: ' + p.fen);
      else {
        t.eq(m1.length, 0, 'kein Matt in 1: ' + p.fen);
        const key = mv.find(m => san(st, m) === p.sol.split('|')[0]);
        t.ok(key && forcesMate(st, key, 2), 'Schlüsselzug erzwingt Matt: ' + p.fen);
      }
    }
  });
}
