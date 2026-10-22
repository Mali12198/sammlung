import {
  newRound, sayVorbehalt, aiVorbehalt, playCard, collectTrick, aiCard, legalFor, trickWinnerIdx, trumpRank,
  nextAnnouncement, announce, aiAnnounce, cardsPoints, settle, policy, sortHand, isTrump,
  armutAnswer, armutReturn, aiArmutAccept, aiArmutReturn, canArmut, rankType,
} from '../js/games/doppelkopf/engine.js';
import { seeded } from '../js/util.js';

export function playRound(dealer, levels, rnd, { force, dulle2 = false, schwein = false, armut = false, bock = false } = {}) {
  const s = newRound(dealer, { dulle2, schwein, armut, bock }, rnd);
  while (s.phase === 'vorbehalt') {
    const p = s.vb.turn;
    sayVorbehalt(s, p, force && force[p] ? force[p] : aiVorbehalt(s, p, levels[p]));
  }
  while (s.phase === 'armut') {
    if (s.arm.stage === 'offer') armutAnswer(s, s.arm.turn, aiArmutAccept(s, s.arm.turn, levels[s.arm.turn]));
    else armutReturn(s, s.arm.partner, aiArmutReturn(s, s.arm.partner));
  }
  if (s.phase === 'redeal') return s;
  let g = 0;
  while (s.phase !== 'done' && g++ < 200) {
    if (s.phase === 'collect') { collectTrick(s); continue; }
    const p = s.turn;
    const L = aiAnnounce(s, p, levels[p]);
    if (L) announce(s, p, L);
    const c = aiCard(s, p, levels[p], rnd);
    if (!legalFor(s, p).includes(c)) throw new Error('illegal ' + c);
    playCard(s, p, c);
  }
  return s;
}

export default function (t) {
  t('Trumpfreihenfolge Normalspiel', () => {
    const order = ['HT', 'CQ', 'SQ', 'HQ', 'DQ', 'CJ', 'SJ', 'HJ', 'DJ', 'DA', 'DT', 'DK', 'D9'];
    for (let i = 1; i < order.length; i++) t.ok(trumpRank(order[i - 1], 'normal') > trumpRank(order[i], 'normal'), order[i - 1] + ' > ' + order[i]);
    t.ok(!isTrump('HA', 'normal') && !isTrump('CA', 'normal'), 'Fehl');
    t.ok(isTrump('HA', 'solo-H') && isTrump('HT', 'solo-H') && !isTrump('DA', 'solo-H'), 'Herzsolo');
    t.ok(!isTrump('HT', 'solo-Q') && isTrump('DQ', 'solo-Q'), 'Damensolo');
  });
  t('Gleiche Karten: die erste gewinnt, Dullen-Hausregel', () => {
    t.eq(trickWinnerIdx(['CA', 'CA', 'C9', 'CK'], 'normal'), 0);
    t.eq(trickWinnerIdx(['HT', 'D9', 'HT', 'CQ'], 'normal', false), 0);
    t.eq(trickWinnerIdx(['HT', 'D9', 'HT', 'CQ'], 'normal', true), 2);
    t.eq(trickWinnerIdx(['HT', 'D9', 'HT', 'CQ'], 'normal', true, true), 0, 'nicht im letzten Stich');
    t.eq(trickWinnerIdx(['HA', 'H9', 'D9', 'HK'], 'normal'), 2, 'Karo-9 sticht');
  });
  t('Ansagefristen', () => {
    const s = newRound(3, {}, seeded(1));
    while (s.phase === 'vorbehalt') sayVorbehalt(s, s.vb.turn, 'gesund');
    if (s.type !== 'normal') return;
    t.eq(nextAnnouncement(s, 0), 1);
    s.hands[0] = s.hands[0].slice(0, 10);
    t.eq(nextAnnouncement(s, 0), 0, 'mit 10 Karten zu spät für Re');
    s.ann[s.re[1] === s.re[0] ? 're' : 'kontra'] = 0;
    s.ann[s.re[0] ? 'kontra' : 're'] = 1;
    t.eq(nextAnnouncement(s, 0), 1, 'Erwiderung noch mit 10 Karten');
  });
  t('Wertung: Re gewinnt knapp, Kontra gegen die Alten', () => {
    const s = newRound(3, {}, seeded(2));
    while (s.phase === 'vorbehalt') sayVorbehalt(s, s.vb.turn, 'gesund');
    if (s.type !== 'normal') return;
    // künstliches Ergebnis: Re bekommt alle Karten außer 119 Augen
    const re = [0, 1, 2, 3].filter(p => s.re[p]);
    s.tricks = Array.from({ length: 12 }, (_, k) => ({ cards: [], winner: re[0] }));
    s.taken = [[], [], [], []];
    s.taken[re[0]] = ['CA', 'CA', 'CT', 'CT', 'SA', 'SA', 'ST', 'ST', 'HA', 'HA', 'D9'];
    const pr = cardsPoints(s.taken[re[0]]);
    t.eq(pr, 106);
    let r = settle(s);
    t.eq(r.winner, 'kontra');
    t.ok(r.lines.some(l => l[0] === 'gegen die Alten'), 'gegen die Alten');
    t.ok(!r.lines.some(l => l[0] === 'unter 90'), 'Re hat über 90');
    t.eq(r.scores.reduce((a, b) => a + b, 0), 0, 'Nullsumme');
  });
  t('400 Computer-Runden: 240 Augen, 12 Stiche, Nullsumme', () => {
    const rnd = seeded(5);
    const types = {}; let reWins = 0, n = 0, ann = 0;
    for (let i = 0; i < 400; i++) {
      const s = playRound(i % 4, ['mittel', 'mittel', 'mittel', 'mittel'], rnd, { dulle2: i % 2 === 0 });
      const tot = cardsPoints(s.taken.flat());
      if (tot !== 240) throw new Error('Augen ' + tot);
      if (s.tricks.length !== 12) throw new Error('Stiche');
      const sum = s.result.scores.reduce((a, b) => a + b, 0);
      if (sum !== 0) throw new Error('keine Nullsumme: ' + JSON.stringify(s.result.scores));
      types[s.type] = (types[s.type] || 0) + 1;
      if (s.result.winner === 're') reWins++;
      if (s.ann.re || s.ann.kontra) ann++;
      n++;
    }
    console.log(`       Re gewinnt ${Math.round(reWins / n * 100)} %, Ansagen in ${Math.round(ann / n * 100)} %`, JSON.stringify(types));
  });
  t('Hochzeit und Soli laufen durch', () => {
    const rnd = seeded(8);
    for (const solo of ['solo-Q', 'solo-J', 'solo-H', 'solo-C', 'solo-0', 'solo-D']) {
      const s = playRound(3, ['mittel', 'mittel', 'mittel', 'mittel'], rnd, { force: { 0: solo } });
      t.eq(s.type, solo);
      t.eq(s.result.scores.reduce((a, b) => a + b, 0), 0);
      t.eq(s.result.extra.length, 0, 'keine Sonderpunkte im Solo');
    }
    let found = 0;
    for (let i = 0; i < 300 && found < 5; i++) {
      const s = playRound(i % 4, ['mittel', 'mittel', 'mittel', 'mittel'], rnd);
      if (s.type === 'hochzeit') {
        found++;
        t.ok(s.klaerung >= 0 && s.klaerung <= 2, 'Klärung');
        t.ok(s.re.filter(Boolean).length === (s.alone ? 1 : 2), 'Teams');
      }
    }
    t.ok(found > 0, 'mindestens eine Hochzeit');
  });
  t('Schweinchen: beide Karo-Asse über den Dullen', () => {
    t.ok(trumpRank('DA', 'normal*') > trumpRank('HT', 'normal*'));
    t.eq(trickWinnerIdx(['HT', 'DA', 'CQ', 'D9'], 'normal*'), 1);
    t.eq(trickWinnerIdx(['DA', 'DA', 'HT', 'D9'], 'normal*'), 0, 'gleiche Karte: die erste');
    const rnd = seeded(31);
    let found = 0;
    for (let i = 0; i < 200 && found < 8; i++) {
      const s = playRound(i % 4, ['mittel', 'mittel', 'mittel', 'mittel'], rnd, { schwein: true });
      if (s.phase === 'redeal' || s.schwein < 0) continue;
      found++;
      t.eq(rankType(s), s.type + '*');
      t.ok(!s.result.extra.some(e => e.label === 'Fuchs gefangen'), 'Schweine sind keine Füchse');
    }
    t.ok(found > 0, 'Schweinchen kommt vor');
  });
  t('Armut: Abgabe, Annahme, Teams', () => {
    const rnd = seeded(12);
    let armut = 0, redeal = 0;
    for (let i = 0; i < 600 && armut < 12; i++) {
      const s = playRound(i % 4, ['mittel', 'mittel', 'mittel', 'mittel'], rnd, { armut: true });
      if (s.phase === 'redeal') { redeal++; t.ok(s.hands.every(h => h.length === 12), 'Karten zurück'); continue; }
      if (s.type !== 'armut') continue;
      armut++;
      t.eq(s.arm.cards.length, 3);
      t.ok(s.re.filter(Boolean).length === 2 && s.re[s.armer] && s.re[s.arm.partner]);
      t.eq(s.result.pts.re + s.result.pts.kontra, 240);
      t.eq(s.result.scores.reduce((a, b) => a + b, 0), 0);
    }
    console.log(`       ${armut} Armut-Spiele, ${redeal}× nicht angenommen`);
    t.ok(armut > 0, 'Armut kommt vor');
  });
  t('Bockspiel zählt doppelt', () => {
    const rnd = seeded(5), rnd2 = seeded(5);
    const a = playRound(1, ['mittel', 'mittel', 'mittel', 'mittel'], rnd);
    const b = playRound(1, ['mittel', 'mittel', 'mittel', 'mittel'], rnd2, { bock: true });
    t.eq(b.result.scores, a.result.scores.map(x => x * 2));
  });
  t('Sortierung', () => t.eq(sortHand(['D9', 'CA', 'HT', 'SQ', 'H9', 'CJ']), ['HT', 'SQ', 'CJ', 'D9', 'CA', 'H9']));
  t('Begründungen vorhanden', () => {
    const rnd = seeded(4);
    const s = newRound(0, {}, rnd);
    while (s.phase === 'vorbehalt') sayVorbehalt(s, s.vb.turn, 'gesund');
    while (s.phase !== 'done') {
      if (s.phase === 'collect') { collectTrick(s); continue; }
      const r = policy(s, s.turn);
      if (!r.why) throw new Error('ohne Begründung');
      playCard(s, s.turn, r.card);
    }
  });
}
