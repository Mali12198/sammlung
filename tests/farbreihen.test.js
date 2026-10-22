import { newGame, roll, markWhite, markColor, aiWhite, aiColor, aiReroll, reroll, canReroll, score, canMark, COLORS, ROW, lastIdx, standings, POINTS, maxPen } from '../js/games/farbreihen/engine.js';
import { seeded } from '../js/util.js';

export function playGame(levels, rnd, opts = {}) {
  const s = newGame(levels.map((l, i) => ({ name: 'P' + i, human: false, level: l })), opts);
  let turns = 0;
  while (s.phase !== 'done' && turns < 500) {
    roll(s, rnd);
    if (aiReroll(s, levels[s.turn])) reroll(s, rnd);
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
  t('Hausregel: früh abschließen', () => {
    const s = newGame([{ name: 'a' }, { name: 'b' }], { early: true });
    for (const i of [0, 1]) s.sheets[0].r.marks[i] = true;
    t.ok(!canMark(s, 0, 'r', 12), 'mit zwei Kreuzen noch nicht');
    s.sheets[0].r.marks[2] = true;
    t.ok(canMark(s, 0, 'r', 12), 'ab drei Kreuzen schon');
  });
  t('Hausregel: kurzes Spiel', () => {
    const s = newGame([{ name: 'a' }, { name: 'b' }], { short: true });
    t.eq(maxPen(s), 3);
    roll(s, () => 0.99); // alles Sechsen: weiß 12
    markWhite(s, 0, null); markWhite(s, 1, null);
    s.sheets[0].pen = 2;
    markColor(s, null);   // dritter Fehlwurf
    t.eq(s.phase, 'done', 'drei Fehlwürfe beenden das Spiel');
    const u = newGame([{ name: 'a' }, { name: 'b' }], { short: true });
    for (const i of [0, 1, 2, 3, 4]) u.sheets[0].r.marks[i] = true;
    roll(u, () => 0.99);
    markWhite(u, 0, 'r'); markWhite(u, 1, null);
    t.ok(u.closed.r, 'rot ist zu');
    markColor(u, null);
    t.eq(u.phase, 'done', 'eine geschlossene Reihe beendet das Spiel');
  });
  t('Hausregel: Neuwurf-Joker', () => {
    const s = newGame([{ name: 'a' }, { name: 'b' }], { reroll: true });
    roll(s, () => 0);
    t.ok(canReroll(s));
    reroll(s, () => 0.99);
    t.eq(s.dice.w1, 6); t.ok(!canReroll(s), 'nur einmal pro Partie');
    markWhite(s, 0, null); markWhite(s, 1, null); markColor(s, null);
    roll(s, () => 0.5);
    t.ok(canReroll(s), 'der zweite Spieler hat seinen Joker noch');
    markWhite(s, 1, null);
    t.ok(!canReroll(s), 'nicht mehr, sobald jemand entschieden hat');
    const n = newGame([{ name: 'a' }, { name: 'b' }]);
    roll(n, () => 0); t.ok(!canReroll(n), 'ohne Hausregel kein Joker');
  });
  t('Hausregeln: Computer-Partien laufen durch', () => {
    const rnd = seeded(11);
    for (const opts of [{ short: true }, { early: true }, { reroll: true }, { short: true, early: true, reroll: true }]) {
      let turns = 0;
      for (let i = 0; i < 60; i++) {
        const r = playGame(['mittel', 'schwer', 'leicht'].slice(0, 2 + (i % 2)), rnd, opts);
        if (r.s.phase !== 'done') throw new Error('Spiel endet nicht ' + JSON.stringify(opts));
        if (r.s.sheets.some(sh => sh.pen > maxPen(r.s))) throw new Error('zu viele Fehlwürfe');
        turns += r.turns;
      }
      console.log(`       ${JSON.stringify(opts)}: Ø ${Math.round(turns / 60)} Züge`);
    }
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
