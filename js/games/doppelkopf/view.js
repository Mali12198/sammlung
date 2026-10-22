// Doppelkopf – Oberfläche (1 bis 4 Menschen an einem iPhone, Rest Computer)
import { h, dialog, toast, sleep } from '../../ui.js';
import { load, save, addResult, delay } from '../../store.js';
import { cardTable } from '../../cards/table.js';
import { cardEl } from '../../cards/render.js';
import { choosePlayers, handover, rulesForm } from '../../players.js';
import { clone } from '../../util.js';
import {
  newRound, sayVorbehalt, aiVorbehalt, hasBothQueens, legalFor, playCard, collectTrick, currentWinner, aiCard, aiAnnounce,
  announce, nextAnnouncement, annText, teamOf, policy, lookahead, sortHand, isTrump, effSuit, cardsPoints, cardName,
  GAME_NAME, SOLOS, isSolo, soloStrength, handStrength, SUIT_NAME, LEVEL_NAME, SOLO_NEED,
  rankType, canArmut, armutAnswer, armutReturn, aiArmutAccept, aiArmutReturn,
} from './engine.js';

// Hausregeln (auf dem Startbildschirm wählbar)
const RULE_INFO = {
  schwein: { label: 'Schweinchen', text: 'Wer beide Karo-Asse hat, macht sie zu den höchsten Trümpfen – noch über den Dullen' },
  armut: { label: 'Armut', text: 'Mit höchstens drei Trümpfen gibst du drei Karten ab; wer sie annimmt, spielt mit dir (Re)' },
  bock: { label: 'Bockrunden', text: 'Nach 120:120, einem Nullspiel oder einer verlorenen Ansage zählen die nächsten vier Spiele doppelt' },
};
const RULE_DEFAULTS = { schwein: true, armut: true, bock: true };

const N = 4;
const POS = ['bottom', 'left', 'top', 'right'];
const DEFAULT_PLAYERS = [{ name: 'Du', human: true }, { name: 'Lotte', human: false }, { name: 'Karl', human: false }, { name: 'Hanne', human: false }];
const SOLO_INFO = {
  'solo-Q': 'Nur die Damen sind Trumpf.',
  'solo-J': 'Nur die Buben sind Trumpf.',
  'solo-C': 'Kreuz statt Karo als Trumpffarbe.',
  'solo-S': 'Pik statt Karo als Trumpffarbe.',
  'solo-H': 'Herz statt Karo als Trumpffarbe.',
  'solo-D': 'Trümpfe wie im Normalspiel – allein.',
  'solo-0': 'Gar kein Trumpf, nur Farben.',
};

export function mount(ui) {
  let g = load('save:doppelkopf');
  let token = 0, busy = false, hintCards = new Set(), pending = null, soloPick = false;
  let armSel = new Set();   // Karten, die bei Armut zurückgegeben werden
  let viewer = 0;

  const players = () => (g && g.players) || DEFAULT_PLAYERS;
  const isHuman = p => !!players()[p].human;
  const humans = () => [0, 1, 2, 3].filter(isHuman);
  const multi = () => humans().length > 1;
  const isYou = p => !multi() && isHuman(p);
  const nameOf = p => (isYou(p) ? 'Du' : players()[p].name);
  const slot = p => (p - viewer + N) % N;
  const seatAt = sl => (sl + viewer) % N;

  const table = cardTable(ui, { names: ['', '', '', ''], positions: POS });
  ui.root.style.setProperty('--coach-bottom', '214px');

  function setViewer(p) {
    viewer = p;
    table.setNames([0, 1, 2, 3].map(sl => nameOf(seatAt(sl))));
    hintCards = new Set(); pending = null; soloPick = false; armSel = new Set();
  }

  function fresh(keep, newPlayers, newRules, sameDealer = false) {
    const old = g;
    const dealer = old && keep ? (sameDealer ? old.dealer : (old.dealer + 1) % 4) : 3;
    const rules = newRules || (old && old.rules) || ui.option('rules', RULE_DEFAULTS);
    const bock = keep && old ? old.bock || 0 : 0;
    g = {
      s: newRound(dealer, { dulle2: !!ui.option('dulle2', false), schwein: rules.schwein, armut: rules.armut, bock: rules.bock && bock > 0 }), dealer,
      players: newPlayers || (old && old.players) || DEFAULT_PLAYERS,
      scores: keep && old ? old.scores : [0, 0, 0, 0],
      list: keep && old ? old.list : [],
      tipsShown: old ? old.tipsShown || {} : {},
      rules, bock,
    };
    setViewer(humans()[0] ?? 0);
    persist();
  }
  function persist() { save('save:doppelkopf', g); }

  function actor() {
    const s = g.s;
    if (s.phase === 'vorbehalt') return s.vb.turn;
    if (s.phase === 'armut') return s.arm.stage === 'offer' ? s.arm.turn : s.arm.stage === 'return' ? s.arm.partner : -1;
    if (s.phase === 'play') return s.turn;
    return -1;
  }
  const myTeam = () => teamOf(g.s, viewer);

  // ---------- Darstellung ----------
  function roleOf(p) {
    const s = g.s;
    const parts = [];
    if (s.phase === 'vorbehalt' || s.phase === 'redeal') {
      if (p === s.first) parts.push('kommt raus');
      return parts.join(' · ');
    }
    if (s.phase === 'armut') return p === s.armer ? '<b>Armut</b>' : p === s.arm.partner ? 'nimmt an' : '';
    const k = s.known[p];
    if (isSolo(s.type)) parts.push(p === s.soloist ? '<b>Solist</b>' : 'Kontra');
    else if (k) parts.push(`<b>${k === 're' ? 'Re' : 'Kontra'}</b>`);
    if (s.type === 'hochzeit' && p === s.hochzeiter && s.klaerung < 0) parts.push('Hochzeit');
    const tr = s.tricks.filter(t => t.winner === p).length;
    if (tr) parts.push(`${tr} ${tr === 1 ? 'Stich' : 'Stiche'}`);
    return parts.join(' · ');
  }

  // Solange der Startbildschirm offen ist und mehrere Menschen spielen, bleiben die Karten verdeckt.
  let veiled = true;
  function render() {
    if (!g || !g.s || (veiled && multi())) return;
    const s = g.s;
    for (let sl = 1; sl < N; sl++) {
      const p = seatAt(sl);
      table.setSeat(sl, {
        role: roleOf(p),
        on: (s.phase === 'play' && s.turn === p) || (s.phase === 'vorbehalt' && s.vb.turn === p) || (s.phase === 'armut' && actor() === p),
        count: s.hands[p].length,
      });
    }
    const winner = s.phase === 'collect' ? s.trick.findIndex(x => x.p === currentWinner(s)) : -1;
    table.renderTrick(s.trick.map(x => ({ p: slot(x.p), c: x.c })), { winner });
    let left = s.phase === 'redeal' ? 'Neu geben' : 'Vorbehalte';
    if (s.phase !== 'vorbehalt' && s.phase !== 'redeal') {
      left = `<b>${GAME_NAME[s.type]}</b>`;
      if (isSolo(s.type)) left += ` · ${s.soloist === viewer ? 'du' : nameOf(s.soloist)}`;
      if (s.type === 'hochzeit') left += ` · ${s.hochzeiter === viewer ? 'du' : nameOf(s.hochzeiter)}`;
      if (s.type === 'armut') left += ` · ${s.armer === viewer ? 'du' : nameOf(s.armer)}${s.arm.partner >= 0 ? ' & ' + (s.arm.partner === viewer ? 'du' : nameOf(s.arm.partner)) : ''}`;
      if (s.schwein >= 0) left += ' · Schwein';
      const a = [];
      if (s.ann.re) a.push(s.ann.re === 1 ? 'Re' : 'Re ' + LEVEL_NAME[s.ann.re]);
      if (s.ann.kontra) a.push(s.ann.kontra === 1 ? 'Kontra' : 'Kontra ' + LEVEL_NAME[s.ann.kontra]);
      if (a.length) left += ' · ' + a.join(', ');
    }
    if (s.bock) left += ' · <b class="tag-bock">Bock</b>';
    const sc = g.scores[viewer];
    table.setPills(left, `${multi() ? players()[viewer].name : 'Konto'}: <b>${sc > 0 ? '+' : ''}${sc}</b>`, showList);
    const t = s.phase === 'vorbehalt' || s.phase === 'armut' || s.phase === 'redeal' ? 'normal' : rankType(s);
    const cards = sortHand(s.hands[viewer], t);
    const myTurn = s.phase === 'play' && s.turn === viewer && isHuman(viewer);
    const legal = myTurn ? legalFor(s, viewer) : null;
    const hintIdx = new Set();
    for (const hc of hintCards) { const i = cards.indexOf(hc); if (i >= 0) hintIdx.add(i); }
    table.renderHand(cards, {
      playable: i => !myTurn || legal.includes(cards[i]),
      selected: armSelIdx(cards, pending),
      hint: hintIdx,
      trump: c => isTrump(c, t),
      onTap: i => onCard(cards[i]),
    });
    renderPhase();
    ui.setSubtitle(humans().length === 4 ? 'Zu viert' : `Computer ${ui.level()}`);
  }

  function armSelIdx(cards, pend) {
    const res = new Set();
    if (pend) res.add(cards.indexOf(pend));
    const used = new Set();
    for (const c of armSel) { const i = cards.findIndex((x, k) => x === c && !used.has(k)); if (i >= 0) { res.add(i); used.add(i); } }
    return res;
  }

  const btn = (label, onclick, primary, attrs = {}) => h('button', { class: 'btn' + (primary ? ' btn-primary' : ''), onclick, ...attrs }, label);

  function renderPhase() {
    const s = g.s;
    const me = viewer;
    table.setCenter(null);
    table.setActions([]);
    if (s.phase === 'vorbehalt') {
      if (s.vb.turn !== me || busy) { table.setStatus(`${nameOf(s.vb.turn)} überlegt …`); return; }
      table.setStatus('Hast du einen Vorbehalt?');
      table.setCenter(soloPick ? soloPanel() : vbPanel());
      return;
    }
    if (s.phase === 'armut') {
      const a = actor();
      if (a !== me || busy || !isHuman(me)) { table.setStatus(`${nameOf(a)} überlegt …`); return; }
      if (s.arm.stage === 'offer') { table.setStatus('Nimmst du die Armut?'); table.setCenter(armutOfferPanel()); return; }
      table.setStatus(armSel.size < 3 ? `Tippe ${3 - armSel.size === 1 ? 'noch eine Karte' : (3 - armSel.size) + ' Karten'} zum Zurückgeben an.` : 'Jetzt zurückgeben.');
      table.setCenter(armutReturnPanel());
      return;
    }
    if (s.phase === 'redeal') {
      table.setStatus('Niemand nimmt die Armut.');
      table.setCenter(h('div', { class: 'panel' }, h('h3', {}, 'Neu geben'), h('p', {}, `Niemand wollte mit ${nameOf(s.armer)} spielen. Die Karten werden neu gegeben – derselbe Geber.`),
        h('div', { class: 'btn-row' }, btn('Neu geben', () => nextRound(true), true))));
      return;
    }
    if (s.phase === 'play' || s.phase === 'collect') {
      if (s.phase === 'collect') {
        const w = currentWinner(s);
        const p = cardsPoints(s.trick.map(x => x.c));
        table.setStatus(`${w === me ? 'Dein Stich' : 'Stich für ' + nameOf(w)} · ${p} Augen${p >= 40 ? ' – Doppelkopf!' : ''}`);
      } else if (s.turn === me && isHuman(me)) table.setStatus(s.trick.length ? 'Du bist dran.' : '<b>Du spielst aus.</b>');
      else table.setStatus(`${nameOf(s.turn)} ist dran …`);
      const acts = [];
      const L = isHuman(me) ? nextAnnouncement(s, me) : 0;
      if (L && s.phase === 'play' && !busy) acts.push(btn(annText(myTeam(), L).replace('!', ''), () => humanAnnounce(L), false, { class: 'btn btn-ann' }));
      if (s.tricks.length) acts.push(h('button', { class: 'chip', onclick: showLastTrick }, 'Letzter Stich'));
      if (ui.coachOn() && isHuman(me)) acts.push(h('span', { class: 'chip chip-info' }, teamLine()));
      table.setActions(acts);
      return;
    }
    if (s.phase === 'done') {
      table.setStatus('Spiel vorbei.');
      table.setActions([btn('Ergebnis', showResult), btn('Nächstes Spiel', () => nextRound(), true)]);
    }
  }

  function teamLine() {
    const s = g.s;
    const me = viewer;
    const t = myTeam();
    if (isSolo(s.type)) return s.soloist === me ? 'Du spielst allein' : `Ihr drei gegen ${nameOf(s.soloist)}`;
    if (s.type === 'hochzeit' && s.klaerung < 0) return s.hochzeiter === me ? 'Du suchst einen Partner' : 'Hochzeit: Partner gesucht';
    // nur bekannte Partner zählen mit – sonst würde die Anzeige verraten, wer zu wem gehört
    const partners = [0, 1, 2, 3].filter(q => q !== me && s.known[q] === t);
    const pts = [me, ...partners].reduce((a, q) => a + cardsPoints(s.taken[q]), 0);
    return `Du: ${t === 're' ? 'Re' : 'Kontra'}${partners.length ? ' mit ' + partners.map(nameOf).join(', ') : ''} · ${pts} Augen`;
  }

  function myTeamHint() {
    return g.s.hands[viewer].includes('CQ') ? ' Du hast eine Kreuz-Dame, also spielst du <b>Re</b>.' : ' Du hast keine Kreuz-Dame, also spielst du <b>Kontra</b>.';
  }

  function vbPanel() {
    const s = g.s;
    const hand = s.hands[viewer];
    const both = hasBothQueens(hand);
    const kids = [h('h3', {}, 'Vorbehalt?'),
      h('p', { html: both
        ? 'Du hast <b>beide Kreuz-Damen</b>. Sag „Hochzeit“ an – dann wird der erste, der einen Stich macht, dein Partner. Oder spiel ein Solo.'
        : 'Normal spielst du „gesund“. Mit einem sehr starken Blatt kannst du ein Solo ansagen und allein gegen alle drei spielen.' })];
    if (ui.coachOn()) {
      const best = SOLOS.map(t => ({ t, st: soloStrength(hand, t) })).sort((a, b) => b.st - a.st)[0];
      const good = best.st >= SOLO_NEED.mittel;
      kids.push(h('p', { class: 'advice', html: good
        ? `Trainer: Ein <b>${GAME_NAME[best.t]}</b> sieht stark aus.`
        : (both ? 'Trainer: Hochzeit ist hier die sichere Wahl.' : `Trainer: Für ein Solo reicht das Blatt nicht – spiel gesund.${myTeamHint()}`) }));
    }
    const arm = canArmut(s, viewer);
    if (arm && !both) kids.push(h('p', { class: 'advice', html: `Du hast nur ${hand.filter(c => isTrump(c, 'normal')).length} Trümpfe – du darfst <b>Armut</b> ansagen: Deine Trümpfe gehen an einen Partner, der dir drei Karten zurückgibt.` }));
    kids.push(h('div', { class: 'btn-row' },
      btn('Solo …', () => { soloPick = true; render(); }),
      both ? btn('Hochzeit', () => doVb('hochzeit'), true) : null,
      arm && !both ? btn('Armut', () => doVb('armut'), true) : null,
      btn('Gesund', () => doVb('gesund'), !both && !arm)));
    return h('div', { class: 'panel' }, kids);
  }

  function armutOfferPanel() {
    const s = g.s;
    const kids = [h('h3', {}, `${nameOf(s.armer)} hat Armut`),
      h('p', { html: `${nameOf(s.armer)} hat höchstens drei Trümpfe und gibt dir drei Karten (darunter <b>${s.arm.trumps} ${s.arm.trumps === 1 ? 'Trumpf' : 'Trümpfe'}</b>). Nimmst du an, spielt ihr zusammen <b>Re</b> – du gibst danach drei Karten zurück.` })];
    if (ui.coachOn()) {
      const ok = aiArmutAccept(s, viewer, 'mittel');
      kids.push(h('p', { class: 'advice' }, ok ? 'Trainer: Mit deinen Trümpfen kannst du die Armut gut tragen – annehmen!' : 'Trainer: Dafür hast du zu wenige starke Trümpfe – lieber ablehnen.'));
    }
    kids.push(h('div', { class: 'btn-row' }, btn('Nein', () => doArmut(false)), btn('Annehmen', () => doArmut(true), true)));
    return h('div', { class: 'panel' }, kids);
  }

  function armutReturnPanel() {
    const s = g.s;
    return h('div', { class: 'panel' },
      h('h3', {}, 'Drei Karten zurückgeben'),
      h('p', { html: `Du hast die Karten von ${nameOf(s.armer)} bekommen. Gib ihm drei beliebige Karten zurück – am besten Fehlkarten, damit du Farben blank bekommst. <b>Hohe Trümpfe behältst du.</b>` }),
      h('div', { class: 'btn-row' },
        btn('Vorschlag', () => { armSel = new Set(aiArmutReturn(s, viewer)); render(); }),
        btn('Zurückgeben', () => doArmutReturn(), true, { disabled: armSel.size !== 3 })));
  }

  function doArmut(yes) {
    const s = g.s;
    if (s.phase !== 'armut' || actor() !== viewer || busy) return;
    armutAnswer(s, viewer, yes);
    table.bubble(0, yes ? 'Ich nehme!' : 'Nein', 1400);
    if (yes) armSel = new Set();
    persist(); render(); advance();
  }

  function doArmutReturn() {
    const s = g.s;
    if (s.phase !== 'armut' || s.arm.stage !== 'return' || s.arm.partner !== viewer || armSel.size !== 3) return;
    armutReturn(s, viewer, [...armSel]);
    toast(`Zurückgegeben: ${s.arm.back} ${s.arm.back === 1 ? 'Trumpf' : 'Trümpfe'}.`, 2200);
    armSel = new Set();
    persist(); render(); afterVb(); advance();
  }

  function soloPanel() {
    const s = g.s;
    const grid = h('div', { class: 'grid' }, SOLOS.map(t => {
      const st = soloStrength(s.hands[viewer], t);
      return h('button', { class: 'btn game-btn' + (st >= SOLO_NEED.mittel ? ' good' : ''), onclick: () => doVb(t) },
        h('span', { class: 'gb-name' }, GAME_NAME[t]), h('small', {}, SOLO_INFO[t]));
    }));
    return h('div', { class: 'panel panel-wide' }, h('h3', {}, 'Solo ansagen'),
      h('p', {}, 'Im Solo spielst du allein gegen alle drei. Gewinn und Verlust zählen dreifach.'),
      grid,
      h('div', { class: 'btn-row', style: { marginTop: '10px' } }, btn('Zurück', () => { soloPick = false; render(); })));
  }

  function doVb(what) {
    const s = g.s;
    if (s.phase !== 'vorbehalt' || s.vb.turn !== viewer || busy) return;
    soloPick = false;
    const p = viewer;
    sayVorbehalt(s, p, what);
    if (multi()) toast(`${players()[p].name}: ${what === 'gesund' ? 'gesund' : 'Vorbehalt'}`, 1400);
    persist(); render();
    afterVb();
    advance();
  }

  function afterVb() {
    const s = g.s;
    if (s.phase === 'armut' && s.arm.stage === 'offer' && !s.armShown) {
      s.armShown = true;
      if (s.armer !== viewer) table.bubble(slot(s.armer), 'Armut!', 2400);
      toast(`${nameOf(s.armer)} ${isYou(s.armer) ? 'hast' : 'hat'} Armut – ${s.arm.trumps} ${s.arm.trumps === 1 ? 'Trumpf' : 'Trümpfe'} gehen an einen Partner.`, 2800);
      coachOnce('armut', { title: 'Armut', text: 'Wer höchstens drei Trümpfe hat, gibt drei Karten (alle Trümpfe) ab. Reihum darf jeder annehmen – wer annimmt, spielt mit ihm zusammen Re und gibt drei Karten zurück. Nimmt keiner an, wird neu gegeben.', ms: 10000 });
      return;
    }
    if (s.phase !== 'play') return;
    if (s.schwein >= 0 && !s.schweinShown) {
      s.schweinShown = true;
      if (s.schwein !== viewer || multi()) table.bubble(slot(s.schwein), 'Schweinchen!', 2600);
      toast(`${nameOf(s.schwein)} ${isYou(s.schwein) ? 'hast' : 'hat'} beide Karo-Asse: Schweinchen! Sie sind jetzt die höchsten Trümpfe.`, 3200);
    }
    if (s.type === 'armut' && s.arm.partner >= 0 && !s.armDone) {
      s.armDone = true;
      toast(`${nameOf(s.arm.partner)} ${isYou(s.arm.partner) ? 'spielst' : 'spielt'} mit ${nameOf(s.armer)} (Re). Zurück kamen ${s.arm.back} ${s.arm.back === 1 ? 'Trumpf' : 'Trümpfe'}.`, 3200);
    }
    if (isSolo(s.type)) { if (s.soloist !== viewer) table.bubble(slot(s.soloist), GAME_NAME[s.type] + '!', 2600); if (multi()) toast(`${nameOf(s.soloist)} spielt ${GAME_NAME[s.type]}!`, 2600); }
    if (s.type === 'hochzeit') { if (s.hochzeiter !== viewer) table.bubble(slot(s.hochzeiter), 'Hochzeit!', 2600); if (multi()) toast(`${nameOf(s.hochzeiter)} hat Hochzeit!`, 2600); }
    if (!ui.coachOn() || multi()) return;
    const me = viewer;
    if (isSolo(s.type)) {
      if (s.soloist === me) coachOnce('solo-self', { title: 'Du spielst Solo', text: 'Du brauchst 121 Augen gegen drei Gegner. Zieh zuerst die Trümpfe heraus, dann hol deine Asse.', ms: 8000 });
      else coachOnce('solo-other', { title: `${nameOf(s.soloist)} spielt ${GAME_NAME[s.type]}`, text: `Ihr drei spielt zusammen. ${SOLO_INFO[s.type]} Haltet den Solisten unter 121 Augen und schmiert euch gegenseitig.`, ms: 9000 });
    } else if (s.type === 'hochzeit') {
      coachOnce('hochzeit', { title: 'Hochzeit', text: `${s.hochzeiter === me ? 'Du hast' : nameOf(s.hochzeiter) + ' hat'} beide Kreuz-Damen. Wer zuerst einen Stich gegen ${s.hochzeiter === me ? 'dich' : nameOf(s.hochzeiter)} gewinnt (in den ersten drei Stichen), wird Partner.`, ms: 9000 });
    } else {
      coachOnce('team-' + myTeam(), { title: myTeam() === 're' ? 'Du spielst Re' : 'Du spielst Kontra', text: s.hands[me].includes('CQ')
        ? (s.silent === me ? 'Du hast beide Kreuz-Damen und nichts gesagt – eine stille Hochzeit: Du spielst allein (zählt wie ein Solo).' : 'Du hast eine Kreuz-Dame. Wer die zweite hat, ist dein Partner – das zeigt sich, wenn sie fällt oder jemand „Re“ ansagt.')
        : 'Du hast keine Kreuz-Dame. Deine Partner sind die beiden anderen ohne Kreuz-Dame. Ihr braucht 120 Augen.', ms: 9000 });
    }
  }

  // ---------- Aktionen ----------
  function humanAnnounce(L) {
    const s = g.s;
    if (nextAnnouncement(s, viewer) !== L) return;
    announce(s, viewer, L);
    toast(`${multi() ? players()[viewer].name : 'Du'} ${multi() ? 'sagt' : 'sagst'}: ${annText(myTeam(), L)}`);
    persist(); render();
  }

  function onCard(c) {
    const s = g.s;
    if (busy) return;
    if (s.phase === 'armut' && s.arm.stage === 'return' && s.arm.partner === viewer) {
      if (armSel.has(c)) armSel.delete(c);
      else { if (armSel.size >= 3) armSel.delete([...armSel][0]); armSel.add(c); }
      render();
      return;
    }
    if (s.phase !== 'play' || s.turn !== viewer || !isHuman(viewer)) {
      if (s.phase === 'play') toast(`${nameOf(s.turn)} ist dran.`);
      return;
    }
    const legal = legalFor(s, viewer);
    if (!legal.includes(c)) { toast(whyIllegal(c), 3400); return; }
    if (ui.option('confirmTap', false) && pending !== c) { pending = c; render(); return; }
    pending = null;
    humanPlay(c);
  }

  function whyIllegal(c) {
    const s = g.s, t = s.type;
    const led = effSuit(s.trick[0].c, t);
    if (led === 'T') {
      const what = t === 'solo-Q' ? 'nur die Damen' : t === 'solo-J' ? 'nur die Buben' : 'die Herz-Zehnen, alle Damen und Buben und ' + (t === 'solo-C' ? 'Kreuz' : t === 'solo-S' ? 'Pik' : t === 'solo-H' ? 'Herz' : 'Karo');
      return `Trumpf ist angespielt – du musst Trumpf bedienen. Trumpf sind ${what}.`;
    }
    if (isTrump(c, t) && c[0] === led) return `${SUIT_NAME[led]} ist angespielt. ${cardName(c)} ist aber Trumpf und zählt nicht als ${SUIT_NAME[led]}.`;
    return `${SUIT_NAME[led]} ist angespielt – du musst ${SUIT_NAME[led]} bedienen.`;
  }

  function humanPlay(c) {
    const s = g.s;
    const p = viewer;
    if (s.phase !== 'play' || s.turn !== p) return;
    const before = ui.coachOn() ? clone(s) : null;
    hintCards = new Set();
    ui.coach.hide();
    playCard(s, p, c);
    persist(); render();
    if (before) setTimeout(() => review(before, c, p), 60);
    advance();
  }

  function review(before, c, p) {
    if (ui.destroyed || viewer !== p) return;
    if (new Set(legalFor(before, p)).size < 2) return;
    const la = lookahead(before, p, 10);
    if (!la.scores) return;
    const loss = la.scores[la.card] - la.scores[c];
    const pol = policy(before, p);
    if (loss >= 18 && la.card !== c) {
      ui.coach.say({ title: `Besser wäre ${cardName(la.card)} gewesen`, kind: 'warn', text: pol.card === la.card ? pol.why : `Durchgerechnet bringt ${cardName(la.card)} deiner Seite im Schnitt deutlich mehr.`, ms: 9000 });
    } else if (pol.card === c && /Schmieren|Fuchs|Trumpf ziehen/.test(pol.why) && Math.random() < 0.5) {
      ui.coach.say({ title: 'Gut gespielt', kind: 'good', text: pol.why, ms: 5000 });
    }
  }

  function coachOnce(key, msg) {
    if (!ui.coachOn() || g.tipsShown[key]) return;
    g.tipsShown[key] = true; persist();
    ui.coach.say(msg);
  }

  // ---------- Ablauf ----------
  async function waitForHuman(p, alive) {
    if (p === viewer) return true;
    busy = true;
    ui.coach.hide();
    if (multi()) {
      render();
      await handover(players()[p].name, 'Deine Karten werden gleich aufgedeckt. Die anderen schauen bitte weg.');
      if (!alive()) return false;
    }
    setViewer(p);
    busy = false;
    return true;
  }

  async function advance() {
    const my = ++token;
    const alive = () => !ui.destroyed && my === token;
    const lv = ui.level();
    while (alive()) {
      const s = g.s;
      const a = actor();
      if (a >= 0 && isHuman(a)) {
        if (!(await waitForHuman(a, alive))) return;
        busy = false; render();
        return;
      }
      if (s.phase === 'vorbehalt') {
        const p = s.vb.turn;
        busy = true; render();
        await sleep(delay(600));
        if (!alive()) return;
        const what = aiVorbehalt(s, p, lv);
        sayVorbehalt(s, p, what);
        table.bubble(slot(p), what === 'gesund' ? 'Gesund' : 'Vorbehalt', 1500);
        busy = false; persist(); render();
        afterVb();
        continue;
      }
      if (s.phase === 'armut') {
        busy = true; render();
        await sleep(delay(900));
        if (!alive()) return;
        if (s.arm.stage === 'offer') {
          const p = s.arm.turn;
          const yes = aiArmutAccept(s, p, lv);
          armutAnswer(s, p, yes);
          table.bubble(slot(p), yes ? 'Ich nehme!' : 'Nein', 1500);
        } else {
          const p = s.arm.partner;
          armutReturn(s, p, aiArmutReturn(s, p));
          table.bubble(slot(p), 'Gibt 3 Karten zurück', 1500);
        }
        busy = false; persist(); render();
        afterVb();
        continue;
      }
      if (s.phase === 'redeal') { busy = false; render(); return; }
      if (s.phase === 'play') {
        busy = true; render();
        await sleep(delay(600));
        if (!alive()) return;
        const p = s.turn;
        const L = aiAnnounce(s, p, lv);
        if (L) {
          announce(s, p, L);
          table.bubble(slot(p), annText(teamOf(s, p), L), 2200);
          render();
          if (ui.coachOn() && !multi() && L === 1 && s.known[p]) {
            const same = teamOf(s, p) === myTeam();
            coachOnce('ann-' + (same ? 'same' : 'other'), { title: `${nameOf(p)} sagt ${annText(teamOf(s, p), L)}`, text: same ? `Damit weißt du: ${nameOf(p)} spielt mit dir zusammen. Eine Ansage bringt 2 Extrapunkte – aber nur, wenn ihr gewinnt.` : `${nameOf(p)} spielt gegen dich. Die Ansage verdoppelt den Einsatz. Mit „Kontra“ bzw. „Re“ darfst du noch eine Karte später antworten.`, ms: 8000 });
          }
          await sleep(delay(500));
          if (!alive()) return;
        }
        playCard(s, p, aiCard(s, p, lv));
        busy = false; persist(); render();
        continue;
      }
      if (s.phase === 'collect') {
        busy = true; render();
        await sleep(delay(1000));
        if (!alive()) return;
        const w = currentWinner(s);
        const hzBefore = s.type === 'hochzeit' && s.klaerung < 0;
        await table.collect(slot(w));
        collectTrick(s);
        busy = false; persist(); render();
        if (hzBefore && s.klaerung >= 0) {
          const hz = s.hochzeiter;
          const msg = s.alone ? `Niemand hat in drei Stichen einen Stich gegen ${nameOf(hz)} gemacht – ${nameOf(hz)} spielt allein.`
            : `${nameOf(w)} ${isYou(w) ? 'bist' : 'ist'} jetzt Partner von ${nameOf(hz)}.`;
          toast(msg, 3200);
        }
        continue;
      }
      if (s.phase === 'done') { busy = false; finishRound(); return; }
      busy = false;
      return;
    }
  }

  function finishRound() {
    const s = g.s;
    if (!s.result) return;
    if (!s.counted) {
      s.counted = true;
      const r = s.result;
      r.scores.forEach((v, p) => { g.scores[p] += v; });
      g.list.push({ n: g.list.length + 1, type: s.type, winner: r.winner, scores: r.scores.slice(), totals: g.scores.slice(), bock: s.bock });
      if (humans().length === 1) addResult('doppelkopf', r.scores[humans()[0]] > 0);
      if (s.bock) g.bock = Math.max(0, (g.bock || 0) - 1);
      s.bockWhy = [];
      if (g.rules && g.rules.bock) {
        if (r.pts.re === 120) s.bockWhy.push('120 zu 120');
        else if (r.reScore === 0) s.bockWhy.push('Nullspiel');
        if (s.ann.re >= 1 && r.winner !== 're') s.bockWhy.push('Re angesagt und verloren');
        if (s.ann.kontra >= 1 && r.winner !== 'kontra') s.bockWhy.push('Kontra angesagt und verloren');
        if (s.bockWhy.length) g.bock = (g.bock || 0) + 4;
      }
      persist();
    }
    render();
    showResult();
  }

  async function showResult() {
    const s = g.s, r = s.result;
    if (!r) return;
    const me = viewer;
    const mine = teamOf(s, me);
    const won = r.scores[me] > 0;
    const title = multi() ? (r.winner ? `${r.winner === 're' ? 'Re' : 'Kontra'} gewinnt` : 'Keiner gewinnt') : (r.winner ? (r.winner === mine ? 'Gewonnen!' : 'Verloren') : 'Keiner gewinnt');
    const reNames = [0, 1, 2, 3].filter(p => s.re[p]).map(p => (isYou(p) ? 'du' : nameOf(p)));
    const rows = r.lines.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', { class: 'num' }, '+' + v)));
    for (const e of r.extra) rows.push(h('tr', {}, h('td', {}, `${e.label} (${e.team === 're' ? 'Re' : 'Kontra'})`), h('td', { class: 'num' }, '±1')));
    if (r.bock > 1) rows.push(h('tr', {}, h('td', {}, 'Bockspiel'), h('td', { class: 'num' }, '× 2')));
    rows.push(h('tr', { class: 'total' }, h('td', {}, isSolo(s.type) || r.solo ? 'Spielwert (Solist ×3)' : 'Spielwert'), h('td', { class: 'num' }, String(Math.abs(r.reScore)))));
    const content = h('div', { class: 'result' },
      h('p', { class: 'result-big ' + (multi() ? 'win' : won ? 'win' : r.scores[me] < 0 ? 'lose' : '') }, title),
      h('p', { html: `Re (${reNames.join(' & ')}): <b>${r.pts.re}</b> Augen · Kontra: <b>${r.pts.kontra}</b> Augen` }),
      h('table', { class: 'result-table' }, rows),
      h('table', { class: 'result-table' }, [0, 1, 2, 3].map(p => h('tr', {}, h('td', {}, nameOf(p) + (s.re[p] ? ' (Re)' : ' (Kontra)')), h('td', { class: 'num' }, (r.scores[p] > 0 ? '+' : '') + r.scores[p])))),
      s.schwein >= 0 ? h('p', { class: 'small' }, `Schweinchen bei ${nameOf(s.schwein)} – die Karo-Asse zählen nicht als Fuchs.`) : null,
      s.bockWhy && s.bockWhy.length ? h('p', { class: 'advice', html: `<b>Bockrunde!</b> Auslöser: ${s.bockWhy.join(', ')}. Die nächsten ${g.bock} Spiele zählen doppelt.` }) : null,
    );
    const v = await dialog({ title: 'Abrechnung', content, buttons: [{ label: 'Liste', value: 'list' }, { label: 'Nächstes Spiel', value: 'next', primary: true }], dismissable: true });
    if (v === 'list') { await showList(); return; }
    if (v === 'next') nextRound();
  }

  async function showList() {
    const me = humans()[0] ?? 0;
    const rows = g.list.slice(-14).map(x => h('tr', {}, h('td', {}, String(x.n)), h('td', {}, GAME_NAME[x.type]),
      h('td', {}, x.winner ? (x.winner === 're' ? 'Re' : 'Kontra') : '–'),
      ...(multi() ? [] : [h('td', { class: 'num' }, ((x.scores ? x.scores[me] : x.me) > 0 ? '+' : '') + (x.scores ? x.scores[me] : x.me))])));
    const content = h('div', {},
      g.list.length ? h('table', { class: 'result-table' }, h('tr', {}, h('td', {}, '#'), h('td', {}, 'Spiel'), h('td', {}, 'Sieger'), multi() ? null : h('td', { class: 'num' }, 'Du')), rows) : h('p', {}, 'Noch keine Spiele.'),
      h('table', { class: 'result-table' }, [0, 1, 2, 3].map(p => h('tr', { class: isYou(p) ? 'total' : '' }, h('td', {}, nameOf(p)), h('td', { class: 'num' }, String(g.scores[p]))))),
      g.bock ? h('p', { class: 'small', html: `<b class="tag-bock">Bock:</b> noch ${g.bock} ${g.bock === 1 ? 'Spiel zählt' : 'Spiele zählen'} doppelt.` }) : null,
      h('p', { class: 'small' }, 'Hausregeln: ' + (Object.keys(RULE_INFO).filter(k => g.rules && g.rules[k]).map(k => RULE_INFO[k].label).join(', ') || 'keine') + '.'));
    await dialog({ title: 'Spielliste', content, buttons: [{ label: 'Schließen', value: true, primary: true }], dismissable: true });
  }

  async function showLastTrick() {
    const s = g.s;
    const tr = s.tricks[s.tricks.length - 1];
    if (!tr) return;
    await dialog({ title: 'Letzter Stich', content: h('div', {},
      h('div', { class: 'cardline big' }, tr.cards.map(x => h('div', { class: 'lt-item' }, cardEl(x.c), h('small', {}, x.p === viewer ? 'Du' : players()[x.p].name)))),
      h('p', {}, `${tr.winner === viewer ? 'Du hast' : nameOf(tr.winner) + ' hat'} den Stich bekommen (${cardsPoints(tr.cards.map(x => x.c))} Augen).`)),
    buttons: [{ label: 'OK', value: true, primary: true }], dismissable: true });
  }

  function nextRound(sameDealer = false) {
    ui.coach.hide();
    table.clearBubbles();
    fresh(true, null, null, sameDealer === true);
    render();
    advance();
  }

  // ---------- Tipp ----------
  function tip() {
    const s = g.s;
    const me = viewer;
    if (!isHuman(me) || busy) { ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du am Zug bist.', ms: 2500 }); return; }
    if (s.phase === 'vorbehalt' && s.vb.turn === me) {
      const best = SOLOS.map(t => ({ t, st: soloStrength(s.hands[me], t) })).sort((a, b) => b.st - a.st)[0];
      if (best.st >= SOLO_NEED.mittel) ui.coach.say({ title: `${GAME_NAME[best.t]} ansagen!`, text: `${SOLO_INFO[best.t]} Mit deinen Karten hast du gute Chancen allein.` });
      else if (hasBothQueens(s.hands[me])) ui.coach.say({ title: 'Hochzeit', text: 'Mit beiden Kreuz-Damen sagst du Hochzeit an. Der Erste, der einen Stich gegen dich macht, wird dein Partner.' });
      else if (canArmut(s, me)) ui.coach.say({ title: 'Armut ansagen', text: 'Mit so wenigen Trümpfen hast du allein kaum eine Chance. Bei Armut übernimmt ein Partner deine Trümpfe und gibt dir drei Karten zurück.', actions: [{ label: 'Armut', primary: true, onClick: () => doVb('armut') }] });
      else ui.coach.say({ title: 'Gesund', text: ['Für ein Solo brauchst du viele hohe Trümpfe und Asse – das ist hier nicht drin.', myTeamHint().trim()] });
      return;
    }
    if (s.phase === 'armut' && actor() === me) {
      if (s.arm.stage === 'offer') {
        const ok = aiArmutAccept(s, me, 'mittel');
        ui.coach.say({ title: ok ? 'Annehmen' : 'Ablehnen', text: ok ? 'Mit den abgegebenen Trümpfen hast du danach genug Trümpfe, um mit deinem Partner zu gewinnen.' : 'Du hättest auch danach zu wenige hohe Trümpfe. Lass lieber jemand anderen ran.', actions: [{ label: ok ? 'Annehmen' : 'Ablehnen', primary: true, onClick: () => doArmut(ok) }] });
      } else {
        armSel = new Set(aiArmutReturn(s, me)); render();
        ui.coach.say({ title: 'Diese drei zurückgeben', text: 'Ich habe Fehlkarten aus deinen kürzesten Farben markiert – so wirst du frei und kannst später stechen. Hohe Trümpfe behältst du.', actions: [{ label: 'Zurückgeben', primary: true, onClick: doArmutReturn }] });
      }
      return;
    }
    if (s.phase === 'play' && s.turn === me) {
      busy = true;
      ui.coach.say({ title: 'Ich rechne …', text: 'Einen Moment.' });
      setTimeout(() => {
        busy = false;
        const la = lookahead(s, me, 16);
        const pol = policy(s, me);
        hintCards = new Set([la.card]);
        render();
        const text = [pol.card === la.card ? pol.why : `Ich habe die restlichen Karten viele Male durchgespielt – mit ${cardName(la.card)} holt deine Seite im Schnitt am meisten.`];
        const L = nextAnnouncement(s, me);
        if (L === 1 && handStrength(s.hands[me], s.type) >= (myTeam() === 're' ? 9.6 : 10.2)) text.push(`Dein Blatt ist stark – du könntest <b>${annText(myTeam(), 1).replace('!', '')}</b> ansagen.`);
        ui.coach.say({ title: `Spiel ${cardName(la.card)}`, text, actions: [{ label: 'Ausführen', primary: true, onClick: () => { if (g.s.phase === 'play' && g.s.turn === me) humanPlay(la.card); } }] });
      }, 30);
      return;
    }
    ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du am Zug bist.', ms: 2500 });
  }

  // ---------- Menü ----------
  ui.onTip = tip;
  ui.onNew = () => setup(false);
  ui.menuExtra = () => {
    const sw = (key, label, small) => {
      const i = h('input', { type: 'checkbox', class: 'switch', onchange: e => { ui.setOption(key, e.target.checked); render(); } });
      i.checked = !!ui.option(key, false);
      return h('label', { class: 'switch-row' }, h('span', {}, label, h('small', {}, small)), i);
    };
    return h('div', {},
      sw('dulle2', 'Zweite Dulle sticht die erste', 'Beliebte Hausregel (gilt ab dem nächsten Spiel, nicht im letzten Stich)'),
      sw('confirmTap', 'Karte bestätigen', 'Erst antippen, dann noch einmal zum Ausspielen'),
      h('p', { class: 'small', style: { marginTop: '8px' } }, 'Hausregeln: ' + (Object.keys(RULE_INFO).filter(k => g && g.rules && g.rules[k]).map(k => RULE_INFO[k].label).join(', ') || 'keine') + ' – änderbar bei „Neues Spiel“.'),
      h('button', { class: 'btn btn-quiet', style: { marginTop: '8px' }, onclick: showList }, 'Spielliste ansehen'));
  };

  const ro = new ResizeObserver(() => render());
  ro.observe(table.handEl);

  function welcome() {
    if (!multi()) coachOnce('welcome', { title: 'Willkommen beim Doppelkopf', text: ['Ihr spielt zu viert, meistens zwei gegen zwei. Wer eine <b>Kreuz-Dame</b> hat, gehört zur Partei <b>Re</b>, die anderen sind <b>Kontra</b> – wer zu wem gehört, ist am Anfang geheim.', 'Mit Freunden spielen: Menü → „Neues Spiel“. Die Glühbirne gibt Tipps, das Buch erklärt Trümpfe und Wertung.'], ms: 12000 });
  }

  async function setup(entry) {
    const running = !!(g && g.s);
    const form = rulesForm(RULE_INFO, (g && g.rules) || ui.option('rules', RULE_DEFAULTS));
    const pl = await choosePlayers({ title: entry ? 'Doppelkopf – wer spielt?' : 'Neue Liste – wer spielt?', min: 4, max: 4, current: players(), entry,
      resume: entry && running ? 'Weiterspielen' : null, resumeSub: entry && running ? `${g.list.length + 1}. Spiel der Liste` : '',
      note: 'Doppelkopf spielt man zu viert. Freie Plätze übernimmt der Computer. Neu starten setzt alle Konten auf 0.', extra: form.el });
    if (pl === 'resume') { await resumeGame(); return; }
    if (!pl) { if (entry) location.hash = '#/'; return; }
    const rules = form.value();
    ui.setOption('rules', rules);
    token++; ui.coach.hide(); table.clearBubbles();
    veiled = false; g = null; fresh(false, pl, rules); render(); advance(); welcome();
  }

  // Weiterspielen: bei mehreren Menschen erst das iPhone übergeben, dann aufdecken.
  async function resumeGame() {
    const a = actor();
    const p = a >= 0 && isHuman(a) ? a : (humans()[0] ?? 0);
    if (multi()) {
      await handover(players()[p].name, 'Deine Karten werden gleich aufgedeckt. Die anderen schauen bitte weg.');
      if (ui.destroyed) return;
    }
    veiled = false; setViewer(p); render(); advance(); welcome();
  }

  // Hinter dem Startbildschirm den Tisch zeigen – aber keine Karten, wenn mehrere Menschen spielen.
  if (g && g.s && !multi()) { setViewer(humans()[0] ?? 0); render(); }
  setup(true);

  return () => { token++; ro.disconnect(); };
}
