import { newGame, roll, markWhite, markColor, aiWhite, aiColor, score, canMark, COLORS, ROW, lastIdx, standings, POINTS } from '../js/games/qwixx/engine.js';
import { seeded } from '../js/util.js';

export function playGame(levels, rnd) {
  const s = newGame(levels.map((l, i) => ({ name: 'P' + i, human: false, level: l })));
  let turns = 0;
  while (s.phase !== 'done' && turns < 500) {
    roll(s, rnd);
    while (s.phase === 'white') { const p = s.pending[0]; const o = aiWhite(s, p, levels[p], rnd); markWhite(s, p, o ? o.c : null); }
    const o = aiColor(s, levels[s.turn], rnd);
    markColor(s, o);
    turns++;
  }
  return { s, turns };
}

export default function (t) {
  t('Wertung', () => { t.eq(POINTS[5], 15); t.eq(POINTS[12], 78); });
  t('Reihenfolge und Abschließen', () => {
    const s = newGame([{ name: 'a' }, { name: 'b' }]);
    t.ok(canMark(s, 0, 'r', 5));
    s.sheets[0].r.marks[4] = true; // rote 6
    t.ok(!canMark(s, 0, 'r', 5), 'links davon nicht mehr');
    t.ok(!canMark(s, 0, 'r', 12), 'abschließen erst ab 5 Kreuzen');
    for (const i of [5, 6, 7, 8]) s.sheets[0].r.marks[i] = true;
    t.ok(canMark(s, 0, 'r', 12));
    t.ok(canMark(s, 0, 'g', 12) && !canMark(s, 0, 'g', 2), 'grün absteigend');
  });
  t('Computer-Partien laufen durch', () => {
    const rnd = seeded(5);
    let tot = 0, turns = 0, ends = { locks: 0, pen: 0 };
    for (let i = 0; i < 200; i++) {
      const n = 2 + (i % 4);
      const r = playGame(Array(n).fill('mittel'), rnd);
      if (r.s.phase !== 'done') throw new Error('Spiel endet nicht');
      for (const sh of r.s.sheets) for (const c of COLORS) {
        // keine Kreuze links von einer Lücke, die später kamen – nur Prüfung: Schloss nur mit Kreuz auf letztem Feld
        if (sh[c].lock && !sh[c].marks[10]) throw new Error('Schloss ohne letztes Feld');
      }
      if (r.s.sheets.some(sh => sh.pen >= 4)) ends.pen++; else ends.locks++;
      tot += standings(r.s)[0].total; turns += r.turns;
    }
    console.log(`       Ø Siegerpunkte ${Math.round(tot / 200)}, Ø Züge ${Math.round(turns / 200)}, Ende durch Schlösser ${ends.locks}, durch Fehlwürfe ${ends.pen}`);
  });
  t('Mittel schlägt Leicht', () => {
    const rnd = seeded(8); let w = 0; const N = 200;
    for (let i = 0; i < N; i++) {
      const lv = i % 2 ? ['mittel', 'leicht'] : ['leicht', 'mittel'];
      const r = playGame(lv, rnd);
      const sc = r.s.sheets.map(sh => score(sh).total);
      const mi = lv.indexOf('mittel');
      if (sc[mi] > sc[1 - mi]) w++;
    }
    console.log(`       Mittel gewinnt ${w}/${N}`);
    t.ok(w > N * 0.55);
  });
}
