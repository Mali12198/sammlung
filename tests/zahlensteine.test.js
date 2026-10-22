import {
  analyzeSet, setValue, partition, newGame, play, checkPlay, finishTurn, drawTile, undoTurn, aiTurn, rackPoints, beginTurn, canFinish,
} from '../js/games/zahlensteine/engine.js';
import { seeded } from '../js/util.js';

export function aiFullTurn(s, level) {
  const p = s.turn;
  const steps = aiTurn(s, p, level);
  let played = false;
  for (const st of steps) {
    const r = play(s, p, st);
    if (!r.ok) throw new Error('KI-Zug ungültig: ' + st.join(',') + ' – ' + r.err);
    played = true;
  }
  if (played && canFinish(s).ok) finishTurn(s);
  else { if (played) undoTurn(s); drawTile(s); }
}

export function playGame(levels, rnd) {
  const s = newGame({ n: levels.length, rnd });
  let turns = 0;
  while (s.phase !== 'done' && turns < 800) {
    aiFullTurn(s, levels[s.turn]);
    turns++;
    const total = s.racks.flat().length + s.pool.length + s.table.reduce((a, x) => a + x.tiles.length, 0);
    if (total !== 106) throw new Error('Steinzahl ' + total);
    for (const x of s.table) if (!analyzeSet(x.tiles)) throw new Error('ungültige Serie ' + x.tiles.join(','));
  }
  return { s, turns };
}

export default function (t) {
  t('Serien', () => {
    t.eq(analyzeSet(['r5', 'b5', 'k5']).kind, 'group');
    t.eq(analyzeSet(['r5', 'r5', 'k5']), null);
    t.eq(analyzeSet(['o3', 'o4', 'o5']).kind, 'run');
    t.eq(analyzeSet(['o12', 'o13', 'o1']), null, 'nicht um die Ecke');
    t.eq(analyzeSet(['o3', 'J', 'o5']).tiles[1], 'J');
    t.eq(setValue(analyzeSet(['r10', 'r11', 'r12'])), 33);
  });
  t('Löser teilt den Tisch neu auf', () => {
    // Tisch: r3 r4 r5 · b5 k5 o5 – dazu r5: wird zu r3 r4 r5 + r5 b5 k5 o5? (Gruppe 4 Farben verschieden – r5 fehlt dort)
    const sol = partition(['r3', 'r4', 'r5', 'b5', 'k5', 'o5', 'r5']);
    t.ok(sol && sol.every(x => analyzeSet(x.tiles)), 'lösbar');
    t.eq(partition(['r3', 'r4', 'b9']), null);
    const big = partition(['r1', 'r2', 'r3', 'r4', 'r5', 'b5', 'k5', 'o5', 'J', 'b7', 'b8', 'k9', 'k10', 'k11', 'J']);
    t.ok(big && big.every(x => analyzeSet(x.tiles)), 'mit Jokern');
  });
  t('Erstes Auslegen braucht 30 Punkte', () => {
    const s = newGame({ n: 2, rnd: seeded(2) });
    s.racks[0] = ['r1', 'r2', 'r3', 'k10', 'b10', 'o10', 'k4', 'k6', 'b2', 'b3', 'o8', 'o9', 'r13', 'k13'];
    beginTurn(s);
    t.ok(play(s, 0, ['r1', 'r2', 'r3']).ok);
    t.ok(!canFinish(s).ok, '6 Punkte reichen nicht');
    t.ok(play(s, 0, ['k10', 'b10', 'o10']).ok);
    t.ok(canFinish(s).ok, '36 Punkte');
    finishTurn(s);
    t.ok(s.out[0]);
  });
  t('Anlegen und Umbauen', () => {
    const s = newGame({ n: 2, rnd: seeded(3) });
    s.out[0] = true;
    s.table = [analyzeSet(['r3', 'r4', 'r5']), analyzeSet(['b6', 'k6', 'o6'])];
    s.racks[0] = ['r6', 'r2', 'k9'];
    beginTurn(s);
    const r = play(s, 0, ['r6']);
    t.ok(r.ok && !r.rebuilt, 'einfach angelegt');
    t.eq(s.table.length, 2);
    t.ok(play(s, 0, ['r2']).ok);
    t.ok(!checkPlay(s, 0, ['k9']).ok, 'passt nirgends');
    undoTurn(s);
    t.eq(s.racks[0].length, 3);
  });
  t('Computer-Partien laufen durch', () => {
    const rnd = seeded(5);
    let turns = 0, blocked = 0;
    const N = 12;
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      const lv = [['mittel', 'mittel'], ['schwer', 'leicht', 'mittel'], ['mittel', 'leicht', 'mittel', 'schwer']][i % 3];
      const r = playGame(lv, rnd);
      if (r.s.phase !== 'done') throw new Error('Spiel endet nicht');
      turns += r.turns;
      if (r.s.result.blocked) blocked++;
      t.eq(r.s.result.scores.reduce((a, b) => a + b, 0), 0);
    }
    console.log(`       Ø ${Math.round(turns / N)} Züge je Spiel, ${blocked}× Stapel leer, ${Math.round((Date.now() - t0) / N)} ms je Spiel`);
  });
  t('Mittel schlägt Leicht', () => {
    const rnd = seeded(9);
    let w = 0; const N = 16;
    for (let i = 0; i < N; i++) {
      const lv = i % 2 ? ['mittel', 'leicht'] : ['leicht', 'mittel'];
      const r = playGame(lv, rnd);
      if (lv[r.s.result.winner] === 'mittel') w++;
    }
    console.log(`       Mittel gewinnt ${w}/${N}`);
    t.ok(w >= N * 0.5);
  });
}
