// Skat – Oberfläche (1 bis 3 Menschen an einem iPhone, Rest Computer)
import { h, dialog, toast, sleep } from '../../ui.js';
import { load, save, addResult, delay } from '../../store.js';
import { cardTable } from '../../cards/table.js';
import { cardEl } from '../../cards/render.js';
import { choosePlayers, handover, rulesForm } from '../../players.js';
import { clone } from '../../util.js';
import {
  newRound, bidAction, aiBid, nextBid, takeSkat, declare, chooseDeclaration, chooseHandGame, legalFor, playCard,
  collectTrick, aiCard, policy, lookahead, sortHand, effSuit, isTrump, bidOptions, gameValue, BASE, GAME_NAME,
  SUIT_NAME, cardName, matadors, trickWinnerIdx, cardsPoints, nullValue,
  canKontra, canRe, sayKontra, sayRe, aiKontra, aiRe, declarerWinChance,
} from './engine.js';

// Hausregeln (auf dem Startbildschirm wählbar)
const RULE_INFO = {
  ramsch: { label: 'Ramsch', text: 'Passen alle, wird Ramsch gespielt: jeder für sich, wer die meisten Augen hat, verliert' },
  kontra: { label: 'Kontra und Re', text: 'Gegenspieler sagen „Kontra“ (Spiel zählt doppelt), der Alleinspieler antwortet mit „Re“ (vierfach)' },
  bock: { label: 'Bockrunden', text: 'Nach 60:60, einem Kontra-Spiel oder gewonnenem Grand Hand zählen die nächsten drei Spiele doppelt' },
};
const RULE_DEFAULTS = { ramsch: true, kontra: true, bock: true };

const N = 3;
const POS = ['bottom', 'left', 'right'];
const DEFAULT_PLAYERS = [{ name: 'Du', human: true }, { name: 'Lotte', human: false }, { name: 'Karl', human: false }];
const suitIcon = t => (t && 'CSHD'.includes(t)) ? `<svg class="suit ${'HD'.includes(t) ? 'r' : 'b'}" viewBox="0 0 100 100"><use href="#s-${t}"/></svg>` : '';

export function gameLabel(gm) {
  if (!gm) return '';
  if (gm.type === 'R') return 'Ramsch';
  let s = GAME_NAME[gm.type];
  if (gm.type === 'N' && gm.ouvert) s += ' ouvert';
  if (gm.hand) s += ' Hand';
  if (gm.schwarz) s += ', Schwarz angesagt';
  else if (gm.schneider) s += ', Schneider angesagt';
  return s;
}

export function mount(ui) {
  let g = load('save:skat');
  let sel = new Set();          // gedrückte Karten
  let handMode = false;         // Spielwahl bei Handspiel
  let ann = { schneider: false, schwarz: false };
  let hintCards = new Set();
  let pending = null;           // Karte für Doppeltipp
  let token = 0;
  let busy = false;
  let viewer = 0;               // Platz, der unten gezeigt wird

  // ---------- Spieler ----------
  const players = () => (g && g.players) || DEFAULT_PLAYERS;
  const isHuman = p => !!players()[p].human;
  const humans = () => [0, 1, 2].filter(isHuman);
  const multi = () => humans().length > 1;
  const isYou = p => !multi() && isHuman(p);
  const nameOf = p => (isYou(p) ? 'Du' : players()[p].name);
  const hat = p => (isYou(p) ? 'Du hast' : `${nameOf(p)} hat`);
  const slot = p => (p - viewer + N) % N;
  const seatAt = sl => (sl + viewer) % N;

  const table = cardTable(ui, { names: ['', '', ''], positions: POS });
  ui.root.style.setProperty('--coach-bottom', '214px');
  applyFourColor();

  function setViewer(p) {
    viewer = p;
    table.setNames([0, 1, 2].map(sl => nameOf(seatAt(sl))));
    sel = new Set(); hintCards = new Set(); pending = null;
  }

  function fresh(keepList, newPlayers, newRules) {
    const old = g;
    const dealer = old && keepList ? (old.dealer + 1) % 3 : Math.floor(Math.random() * 3);
    const rules = newRules || (old && old.rules) || ui.option('rules', RULE_DEFAULTS);
    const bock = keepList && old ? old.bock || 0 : 0;
    g = {
      s: newRound(dealer, Math.random, { ramsch: rules.ramsch, kontra: rules.kontra, bock: rules.bock && bock > 0 }), dealer,
      players: newPlayers || (old && old.players) || DEFAULT_PLAYERS,
      scores: keepList && old ? old.scores : [0, 0, 0],
      list: keepList && old ? old.list : [],
      tipsShown: old ? old.tipsShown || {} : {},
      rules, bock,
    };
    handMode = false; ann = { schneider: false, schwarz: false };
    setViewer(humans()[0] ?? 0);
    persist();
  }
  function persist() { save('save:skat', g); }

  function applyFourColor() {
    ui.root.classList.toggle('four-color', !!ui.option('fourColor', false));
  }

  // Wer muss gerade handeln?
  function actor() {
    const s = g.s;
    if (s.phase === 'bid') return s.bid.turn;
    if (s.phase === 'skat' || s.phase === 'declare') return s.declarer;
    if (s.phase === 'play') return s.turn;
    return -1;
  }
  const myAction = () => actor() === viewer && isHuman(viewer) && !busy;

  // ---------- Darstellung ----------
  function handSorted() {
    const s = g.s;
    const t = s.game ? s.game.type : null;
    return sortHand(s.hands[viewer], t);
  }

  function roleOf(p) {
    const s = g.s;
    const pos = p === s.V ? 'Vorhand' : p === s.M ? 'Mittelhand' : 'Hinterhand';
    if (s.declarer === p && s.phase !== 'bid') return `<b>Alleinspieler</b>`;
    if (s.phase === 'bid' || s.phase === 'allpass') return pos;
    const tricks = s.tricks.filter(x => x.winner === p).length;
    return tricks ? `${tricks} ${tricks === 1 ? 'Stich' : 'Stiche'}` : (s.declarer >= 0 ? 'Gegenspieler' : pos);
  }

  // Solange der Startbildschirm offen ist und mehrere Menschen spielen, bleiben die Karten verdeckt.
  let veiled = true;
  function render() {
    if (!g || !g.s || (veiled && multi())) return;
    const s = g.s;
    const t = s.game ? s.game.type : null;
    for (let sl = 1; sl < N; sl++) {
      const p = seatAt(sl);
      const open = s.game && s.game.ouvert && s.declarer === p && (s.phase === 'play' || s.phase === 'collect');
      table.setSeat(sl, {
        role: roleOf(p),
        on: (s.phase === 'play' && s.turn === p) || (s.phase === 'bid' && s.bid.turn === p),
        count: s.hands[p].length,
        openCards: open ? sortHand(s.hands[p], 'N') : null,
      });
    }
    const winIdx = s.phase === 'collect' ? trickWinnerIdx(s.trick.map(x => x.c), t) : -1;
    table.renderTrick(s.trick.map(x => ({ p: slot(x.p), c: x.c })), { winner: winIdx });
    let left = '';
    const kon = s.kontra && s.kontra.by >= 0 ? ` · <b class="tag-kontra">${s.kontra.re ? 'Re' : 'Kontra'}</b>` : '';
    const bk = s.bock ? ' · <b class="tag-bock">Bock</b>' : '';
    if (s.phase === 'bid') left = `Reizen${s.bid.value ? ' · ' + s.bid.value : ''}${bk}`;
    else if (t === 'R') left = `<b>Ramsch</b>${bk}`;
    else if (s.game) left = `${suitIcon(t)}<b>${gameLabel(s.game)}</b> · ${s.declarer === viewer ? 'du' : nameOf(s.declarer)} (${s.bid.value})${kon}${bk}`;
    else if (s.declarer >= 0) left = `${s.declarer === viewer ? 'Du spielst' : nameOf(s.declarer) + ' spielt'} · ${s.bid.value}${bk}`;
    table.setPills(left, `${multi() ? players()[viewer].name : 'Liste'}: <b>${g.scores[viewer]}</b>`, showBlock);
    const cards = handSorted();
    const myTurn = s.phase === 'play' && s.turn === viewer && isHuman(viewer);
    const legal = myTurn ? legalFor(s, viewer) : null;
    table.renderHand(cards, {
      playable: i => !myTurn || legal.includes(cards[i]),
      selected: new Set(cards.map((c, i) => (sel.has(c) || pending === c) ? i : -1).filter(i => i >= 0)),
      hint: new Set(cards.map((c, i) => hintCards.has(c) ? i : -1).filter(i => i >= 0)),
      trump: c => t && t !== 'N' && isTrump(c, t),
      onTap: i => onCard(cards[i]),
    });
    renderPhase();
    ui.setSubtitle(humans().length === 3 ? 'Zu dritt' : `Computer ${ui.level()}`);
  }

  function btn(label, onclick, primary, extra = {}) {
    return h('button', { class: 'btn' + (primary ? ' btn-primary' : ''), onclick, ...extra }, label);
  }

  function renderPhase() {
    const s = g.s;
    const me = viewer;
    const t = s.game ? s.game.type : null;
    table.setCenter(null);
    table.setActions([]);
    if (s.phase === 'bid') {
      const b = s.bid;
      if (b.turn !== me || busy) { table.setStatus(`${nameOf(b.turn)} ${b.wait === 'answer' ? 'überlegt' : 'reizt'} …`); return; }
      table.setStatus('Du bist beim Reizen dran.');
      table.setCenter(bidPanel());
      return;
    }
    if (s.phase === 'allpass') {
      table.setStatus('Alle haben gepasst.');
      table.setCenter(h('div', { class: 'panel' }, h('h3', {}, 'Eingepasst'), h('p', {}, 'Niemand wollte spielen. Die Karten werden neu gegeben.'),
        h('div', { class: 'btn-row' }, btn('Neu geben', () => nextRound(true), true))));
      return;
    }
    if (s.phase === 'skat') {
      if (s.declarer !== me || busy) { table.setStatus(`${hat(s.declarer)} das Reizen gewonnen …`); return; }
      if (handMode) { table.setStatus('Wähle dein Handspiel.'); table.setCenter(gamePanel(true)); return; }
      table.setStatus(`Du hast das Reizen mit ${s.bid.value} gewonnen.`);
      table.setCenter(h('div', { class: 'panel' },
        h('h3', {}, 'Du spielst!'),
        h('p', { html: 'Nimm den Skat auf und drücke zwei Karten – oder spiel <b>Hand</b>, ohne in den Skat zu schauen. Hand zählt eine Stufe mehr.' }),
        h('div', { class: 'btn-row' },
          btn('Hand spielen', () => { handMode = true; render(); }),
          btn('Skat aufnehmen', () => { takeSkat(s); persist(); render(); coachOnce('druecken', { title: 'Drücken', text: 'Tippe zwei Karten an, die in den Skat sollen. Ihre Augen zählen am Ende für dich. Gute Kandidaten: blanke Zehnen und Karten aus kurzen Farben – so wirst du frei und kannst stechen.' }); }, true))));
      return;
    }
    if (s.phase === 'declare') {
      if (s.declarer !== me || busy) { table.setStatus(`${nameOf(s.declarer)} drückt …`); return; }
      table.setStatus(sel.size < 2 ? `Tippe ${2 - sel.size === 2 ? 'zwei Karten' : 'noch eine Karte'} zum Drücken an.` : 'Jetzt das Spiel ansagen.');
      table.setCenter(gamePanel(false));
      return;
    }
    if (s.phase === 'play' || s.phase === 'collect') {
      if (s.phase === 'collect') {
        const w = s.trick[trickWinnerIdx(s.trick.map(x => x.c), s.game.type)].p;
        const p = cardsPoints(s.trick.map(x => x.c));
        table.setStatus(`${w === me ? 'Dein Stich' : 'Stich für ' + nameOf(w)} · ${p} ${p === 1 ? 'Auge' : 'Augen'}`);
      } else if (s.turn === me && isHuman(me)) {
        table.setStatus(s.trick.length ? 'Du bist dran.' : '<b>Du spielst aus.</b>');
      } else table.setStatus(`${nameOf(s.turn)} ist dran …`);
      const acts = [];
      if (s.phase === 'play' && !busy && isHuman(me) && canKontra(s, me)) acts.push(h('button', { class: 'chip chip-call', onclick: () => call('kontra') }, 'Kontra!'));
      if (s.phase === 'play' && !busy && isHuman(me) && canRe(s, me)) acts.push(h('button', { class: 'chip chip-call', onclick: () => call('re') }, 'Re!'));
      if (s.tricks.length) acts.push(h('button', { class: 'chip', onclick: showLastTrick }, 'Letzter Stich'));
      if (ui.coachOn() && (s.declarer >= 0 || t === 'R')) acts.push(h('span', { class: 'chip chip-info' }, pointsLine()));
      table.setActions(acts);
      return;
    }
    if (s.phase === 'done') {
      table.setStatus('Spiel vorbei.');
      table.setActions([btn('Ergebnis', showResult), btn('Nächstes Spiel', () => nextRound(true), true)]);
    }
  }

  function pointsLine() {
    const s = g.s;
    const d = s.declarer;
    if (s.game && s.game.type === 'R') return 'Augen: ' + [viewer, seatAt(1), seatAt(2)].map(p => `${p === viewer ? 'du' : nameOf(p)} ${cardsPoints(s.taken[p])}`).join(' · ');
    const dp = cardsPoints(s.taken[d]);
    const op = cardsPoints(s.taken[(d + 1) % 3]) + cardsPoints(s.taken[(d + 2) % 3]);
    return d === viewer ? `Augen: du ${dp} · Gegner ${op}` : `Augen: ${nameOf(d)} ${dp} · ihr ${op}`;
  }

  // ---------- Reizen ----------
  function bidAdvice() {
    const s = g.s;
    const me = viewer;
    const pos = s.V === me ? 'V' : s.M === me ? 'M' : 'H';
    const opts = bidOptions(s.hands[me], 'mittel', pos).filter(o => o.type !== 'N');
    opts.sort((a, b) => b.margin - a.margin);
    const best = opts[0];
    const m = best.mat;
    const full = BASE[best.type] * (m.n + 1);
    const calc = `${GAME_NAME[best.type]} ${m.mit ? 'mit' : 'ohne'} ${m.n}: ${BASE[best.type]} × ${m.n + 1} = <b>${full}</b>${!m.mit && m.n > 3 ? ' (Vorsicht: Liegt ein hoher Bube im Skat, sinkt der Wert stark)' : ''}`;
    const value = best.value;
    const verdict = best.margin >= 0.6 ? 'gut spielbar' : best.margin >= 0 ? 'knapp spielbar' : 'eher zu schwach';
    const nul = bidOptions(s.hands[me], 'mittel', pos).find(o => o.type === 'N');
    return { best, calc, verdict, nul, max: best.margin >= 0 ? value : (nul.margin >= 0 ? 23 : 0) };
  }

  function bidPanel() {
    const s = g.s, b = s.bid;
    const kids = [];
    let title, text, buttons;
    if (b.stage === 3) {
      title = 'Alle haben gepasst';
      const ram = s.opts && s.opts.ramsch;
      text = ram ? 'Du bist Vorhand und darfst für 18 spielen – sonst wird <b>Ramsch</b> gespielt: jeder für sich, wer die meisten Augen hat, verliert.'
        : 'Du bist Vorhand und darfst für 18 spielen – oder einpassen, dann wird neu gegeben.';
      buttons = [btn(ram ? 'Ramsch' : 'Einpassen', () => doBid('pass')), btn('Für 18 spielen', () => doBid('play'), true)];
    } else if (b.wait === 'say') {
      const nb = nextBid(b.value);
      title = 'Reizen';
      text = b.value ? `${nameOf(b.hoerer)} hält ${b.value}. Gehst du höher?` : `Du sagst ${nameOf(b.hoerer)} an. Mit welchem Wert beginnst du?`;
      buttons = nb ? [btn('Passe', () => doBid('pass')), btn(`${nb} sagen`, () => doBid('say'), true)] : [btn('Passe', () => doBid('pass'), true)];
    } else {
      title = 'Reizen';
      text = `${nameOf(b.sager)} sagt <b>${b.value}</b>. Hältst du mit?`;
      buttons = [btn('Passe', () => doBid('pass')), btn(`Ja (${b.value})`, () => doBid('yes'), true)];
    }
    kids.push(h('h3', {}, title), h('p', { html: text }));
    if (ui.coachOn()) {
      const a = bidAdvice();
      kids.push(h('p', { class: 'advice', html: `Reizhilfe: ${a.calc} – ${a.verdict}.${a.nul.margin >= 0 ? ' Ein Null (23) wäre auch drin.' : ''}` }));
    }
    kids.push(h('div', { class: 'btn-row' }, buttons));
    return h('div', { class: 'panel' }, kids);
  }

  function doBid(action) {
    const s = g.s;
    if (s.phase !== 'bid' || s.bid.turn !== viewer || busy) return;
    hintCards = new Set();
    const p = viewer;
    bidAction(s, p, action);
    if (multi()) toast(`${players()[p].name}: ${s.bid.said[p]}`, 1500);
    persist();
    render();
    advance();
  }

  // ---------- Spielansage ----------
  function gamePanel(hand) {
    const s = g.s;
    const cards12 = s.hands[viewer];
    const ready = hand || sel.size === 2;
    const mk = (type, extra = {}) => {
      const gm = { type, hand, ...(type === 'N' ? { ouvert: !!extra.ouvert } : ann) };
      const v = gameValue(gm, cards12, {});
      const low = v < s.bid.value;
      const blocked = type === 'N' && low;
      const label = type === 'N' ? (extra.ouvert ? 'Null ouvert' : 'Null') : GAME_NAME[type];
      return h('button', {
        class: 'btn game-btn' + (low ? ' warn' : ''),
        disabled: !ready || blocked,
        onclick: () => announce(gm),
        title: low ? 'Überreizt – dieser Wert reicht nicht' : '',
      }, h('span', { class: 'gb-name', html: suitIcon(type) + label }), h('small', {}, (hand && type !== 'N' ? 'ca. ' : '') + v + (low ? ' – zu wenig' : '')));
    };
    const kids = [h('h3', {}, hand ? 'Handspiel ansagen' : 'Spiel ansagen')];
    if (!hand) kids.push(h('p', {}, sel.size < 2 ? 'Tippe zuerst zwei Karten zum Drücken an.' : `Gedrückt: ${[...sel].map(cardName).join(' und ')} (${cardsPoints([...sel])} Augen für dich).`));
    else kids.push(h('p', {}, 'Die Spitzen zählen am Ende mit den Skatkarten – der Wert kann sich noch ändern.'));
    kids.push(h('div', { class: 'grid' }, mk('C'), mk('S'), mk('H'), mk('D'), mk('G'), mk('N'), mk('N', { ouvert: true })));
    if (hand) {
      const chip = (k, label) => h('button', { class: 'chip', 'aria-pressed': String(!!ann[k]), onclick: () => {
        ann[k] = !ann[k];
        if (k === 'schwarz' && ann.schwarz) ann.schneider = true;
        if (k === 'schneider' && !ann.schneider) ann.schwarz = false;
        render();
      } }, label);
      kids.push(h('div', { class: 'opt-row' }, chip('schneider', 'Schneider ansagen'), chip('schwarz', 'Schwarz ansagen')));
      kids.push(h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-quiet', onclick: () => { handMode = false; ann = { schneider: false, schwarz: false }; render(); } }, 'Doch Skat aufnehmen?')));
    }
    kids.push(h('p', { class: 'advice small' }, `Gereizt: ${s.bid.value}. Der Spielwert muss mindestens so hoch sein.`));
    return h('div', { class: 'panel panel-wide' }, kids);
  }

  function announce(gm) {
    const s = g.s;
    if (s.declarer !== viewer || busy) return;
    if (s.phase === 'skat') {
      if (gm.type !== 'N') gm = { ...gm, ...ann };
      declare(s, { ...gm, hand: true });
    } else {
      if (sel.size !== 2) return;
      declare(s, gm, [...sel]);
    }
    if (multi()) toast(`${players()[viewer].name} spielt ${gameLabel(s.game)}`, 2200);
    sel = new Set(); handMode = false; hintCards = new Set();
    persist();
    render();
    if (ui.coachOn()) {
      const t = s.game.type;
      const tip = t === 'N' ? 'Im Null darfst du keinen Stich bekommen. Spiel kleine Karten und bleib beim Bedienen unter der höchsten Karte im Stich.'
        : t === 'G' ? 'Im Grand sind nur die vier Buben Trumpf. Zieh mit deinen Buben die gegnerischen Buben heraus und hol dann deine Asse und Zehnen.'
          : 'Als Alleinspieler gilt meistens: erst Trumpf ziehen, bis die Gegner keine mehr haben – dann sind deine Asse und Zehnen sicher.';
      coachOnce('decl-' + t, { title: 'Dein Plan', text: tip, ms: 8000 });
    }
    advance();
  }

  // ---------- Kontra / Re ----------
  function call(kind) {
    const s = g.s;
    const me = viewer;
    if (busy) return;
    if (kind === 'kontra' && canKontra(s, me)) sayKontra(s, me);
    else if (kind === 're' && canRe(s, me)) sayRe(s, me);
    else return;
    table.bubble(0, kind === 'kontra' ? 'Kontra!' : 'Re!', 1800);
    toast(kind === 'kontra' ? 'Kontra! Das Spiel zählt jetzt doppelt.' : 'Re! Das Spiel zählt jetzt vierfach.', 2200);
    persist(); render();
  }

  // ---------- Karten tippen ----------
  function onCard(c) {
    const s = g.s;
    if (busy) return;
    if (s.phase === 'declare' && s.declarer === viewer) {
      if (sel.has(c)) sel.delete(c);
      else { if (sel.size >= 2) sel.delete([...sel][0]); sel.add(c); }
      hintCards = new Set();
      render();
      return;
    }
    if (s.phase !== 'play' || s.turn !== viewer || !isHuman(viewer)) {
      if (s.phase === 'play') toast(`${nameOf(s.turn)} ist dran.`);
      return;
    }
    const legal = legalFor(s, viewer);
    if (!legal.includes(c)) { toast(whyIllegal(c), 3200); return; }
    if (ui.option('confirmTap', false) && pending !== c) { pending = c; render(); return; }
    pending = null;
    humanPlay(c);
  }

  function whyIllegal(c) {
    const s = g.s, t = s.game.type;
    const led = effSuit(s.trick[0].c, t);
    if (t === 'N') return `${SUIT_NAME[led]} ist angespielt – du musst bedienen. Im Null gehören die Buben zu ihrer Farbe.`;
    if (led === 'T') return `Trumpf ist angespielt – du musst Trumpf bedienen. Denk dran: Alle Buben sind Trumpf${t !== 'G' ? ', dazu die ' + SUIT_NAME[t] + '-Karten' : ''}.`;
    if (c[1] === 'J' && c[0] === led) return `${SUIT_NAME[led]} ist angespielt. Der ${cardName(c)} gehört nicht zu ${SUIT_NAME[led]} – er ist Trumpf. Du musst ${SUIT_NAME[led]} bedienen.`;
    return `${SUIT_NAME[led]} ist angespielt – du musst ${SUIT_NAME[led]} bedienen (Farbzwang).`;
  }

  function humanPlay(c) {
    const s = g.s;
    const p = viewer;
    if (s.phase !== 'play' || s.turn !== p) return;
    const before = ui.coachOn() ? clone(s) : null;
    hintCards = new Set();
    ui.coach.hide();
    playCard(s, p, c);
    persist();
    render();
    if (before) setTimeout(() => review(before, c, p), 60);
    advance();
  }

  function review(before, c, p) {
    if (ui.destroyed || viewer !== p) return;
    const legal = legalFor(before, p);
    if (legal.length < 2) return;
    const la = lookahead(before, p, 14);
    const sc = la.scores;
    if (!sc) return;
    const loss = sc[la.card] - sc[c];
    const pol = policy(before, p);
    if (loss >= 12 && la.card !== c) {
      const why = pol.card === la.card ? pol.why : `Ich habe die übrigen Karten mehrfach durchgespielt: Mit ${cardName(la.card)} holt deine Seite im Schnitt deutlich mehr.`;
      ui.coach.say({ title: `Besser wäre ${cardName(la.card)} gewesen`, kind: 'warn', text: why, ms: 9000 });
    } else if (pol.card === c && /Schmieren|Trumpf ziehen|Kurzer Weg|Langer Weg|Ass abziehen/.test(pol.why) && Math.random() < 0.5) {
      ui.coach.say({ title: 'Gut gespielt', kind: 'good', text: pol.why, ms: 5000 });
    }
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
      if (s.game && s.game.type === 'R' && !s.ramschShown) {
        s.ramschShown = true; persist();
        toast('Alle haben gepasst – es wird Ramsch gespielt!', 2600);
        coachOnce('ramsch', { title: 'Ramsch', text: ['Jeder spielt für sich, nur die Buben sind Trumpf. Wer am Ende die <b>meisten Augen</b> hat, verliert – so viele Minuspunkte. Der Skat geht an den, der den letzten Stich macht.', 'Tipp: Bleib unter den Karten der anderen und wirf deine Asse und Zehnen ab, wenn du nicht bedienen kannst.'], ms: 12000 });
      }
      if (a >= 0 && isHuman(a) && s.phase !== 'collect') {
        if (!(await waitForHuman(a, alive))) return;
        busy = false; render();
        if (s.phase === 'bid') maybeBidCoach();
        if (s.phase === 'skat') maybeDeclCoach();
        if (s.phase === 'play' && canKontra(s, viewer)) coachOnce('kontra', { title: 'Kontra?', text: 'Glaubst du, dass der Alleinspieler verliert? Dann tippe vor deiner ersten Karte auf <b>Kontra!</b> – das Spiel zählt doppelt. Er kann mit „Re“ antworten (vierfach).', ms: 9000 });
        if (s.phase === 'play' && canRe(s, viewer)) coachOnce('re', { title: 'Re?', text: 'Die Gegner haben Kontra gesagt. Bist du dir sicher, dass du gewinnst? Mit <b>Re!</b> zählt das Spiel vierfach – im Guten wie im Schlechten.', ms: 9000 });
        return;
      }
      if (s.phase === 'bid') {
        const p = s.bid.turn;
        busy = true; render();
        await sleep(delay(750));
        if (!alive()) return;
        bidAction(s, p, aiBid(s, p, lv));
        table.bubble(slot(p), s.bid.said[p], 1700);
        busy = false; persist(); render();
        continue;
      }
      if (s.phase === 'allpass') { busy = false; render(); return; }
      if (s.phase === 'skat') {
        busy = true; render();
        await sleep(delay(900));
        if (!alive()) return;
        const d = s.declarer;
        const hg = chooseHandGame(s.hands[d], s.bid.value, lv);
        if (hg) declare(s, hg.game);
        else {
          takeSkat(s);
          table.bubble(slot(d), 'Nimmt den Skat', 1200);
          render();
          await sleep(delay(1000));
          if (!alive()) return;
          const ch = chooseDeclaration(s.hands[d], s.bid.value, lv);
          declare(s, ch.game, ch.put);
        }
        table.bubble(slot(d), gameLabel(s.game), 2600);
        busy = false; persist(); render();
        if (ui.coachOn() && s.game) coachDefense();
        await sleep(delay(900));
        continue;
      }
      if (s.phase === 'play') {
        busy = true; render();
        await sleep(delay(650));
        if (!alive()) return;
        const p = s.turn;
        if (canKontra(s, p) && aiKontra(s, p, lv)) {
          sayKontra(s, p); table.bubble(slot(p), 'Kontra!', 2000); persist(); render();
          await sleep(delay(900)); if (!alive()) return;
        }
        if (canRe(s, p) && aiRe(s, p, lv)) {
          sayRe(s, p); table.bubble(slot(p), 'Re!', 2000); persist(); render();
          await sleep(delay(900)); if (!alive()) return;
        }
        playCard(s, p, aiCard(s, p, lv));
        busy = false; persist(); render();
        continue;
      }
      if (s.phase === 'collect') {
        busy = true; render();
        await sleep(delay(1000));
        if (!alive()) return;
        const w = s.trick[trickWinnerIdx(s.trick.map(x => x.c), s.game.type)].p;
        await table.collect(slot(w));
        collectTrick(s);
        busy = false; persist(); render();
        continue;
      }
      if (s.phase === 'done') { busy = false; finishRound(); return; }
      busy = false;
      return;
    }
  }

  function coachOnce(key, msg) {
    if (!ui.coachOn() || g.tipsShown[key]) return;
    g.tipsShown[key] = true; persist();
    ui.coach.say(msg);
  }

  function maybeBidCoach() {
    coachOnce('bid', {
      title: 'Reizen – so geht’s',
      text: ['Beim Reizen bieten die Spieler, wie viel ihr Spiel wert ist. Wert = <b>Grundwert</b> der Spielart × <b>(Spitzen + 1)</b>.',
        'Grundwerte: Karo 9, Herz 10, Pik 11, Kreuz 12, Grand 24. Die Reizhilfe im Kasten rechnet dir dein bestes Spiel aus.'],
    });
  }
  function maybeDeclCoach() {
    coachOnce('skat', { title: 'Skat oder Hand?', text: 'Fast immer lohnt es sich, den Skat aufzunehmen: zwei Karten mehr zur Auswahl. Hand spielst du nur mit einem sehr starken Blatt – es bringt eine Stufe mehr.', ms: 9000 });
  }
  function coachDefense() {
    const s = g.s;
    if (s.declarer === viewer || !isHuman(viewer)) return;
    const t = s.game.type;
    const partner = 3 - s.declarer - viewer;
    const txt = t === 'N'
      ? `${nameOf(s.declarer)} spielt Null und darf keinen Stich bekommen. Spielt kleine Karten an und bleibt unter seinen Karten, damit er drüber muss.`
      : `Du spielst mit ${nameOf(partner)} gegen ${nameOf(s.declarer)}. Ihr braucht zusammen 60 Augen. Gewinnt ${nameOf(partner)} einen Stich, gib Augen dazu („schmieren“).`;
    coachOnce('def-' + (t === 'N' ? 'N' : 'S'), { title: 'Ihr spielt zu zweit', text: txt, ms: 9000 });
  }

  function finishRound() {
    const s = g.s;
    if (!s.result) return;
    if (!s.counted) {
      s.counted = true;
      const r = s.result;
      if (r.ramsch) {
        for (let p = 0; p < 3; p++) g.scores[p] += r.scores[p];
        const who = r.durchmarsch >= 0 ? r.durchmarsch : r.losers[0];
        const label = r.durchmarsch >= 0 ? 'Ramsch – Durchmarsch' : `Ramsch${r.losers.length > 1 ? ' (geteilt)' : ''}${r.jungfrau ? ', Jungfrau' : ''}`;
        g.list.push({ n: g.list.length + 1, decl: who, game: label, score: r.scores[who], won: r.durchmarsch >= 0, scores: g.scores.slice() });
        if (humans().length === 1) {
          const me = humans()[0];
          addResult('skat', r.durchmarsch >= 0 ? r.durchmarsch === me : !r.losers.includes(me));
        }
      } else {
        g.scores[s.declarer] += r.score;
        g.list.push({ n: g.list.length + 1, decl: s.declarer, game: gameLabel(s.game) + (r.kontra > 1 ? (r.kontra === 4 ? ', Re' : ', Kontra') : ''), bid: s.bid.value, value: r.value, score: r.score, won: r.won, scores: g.scores.slice() });
        if (humans().length === 1) {
          const me = humans()[0];
          addResult('skat', s.declarer === me ? r.won : !r.won);
        }
      }
      // Bockrunden
      if (s.bock) g.bock = Math.max(0, (g.bock || 0) - 1);
      s.bockWhy = [];
      if (g.rules && g.rules.bock && !r.ramsch) {
        if (r.decPts === 60) s.bockWhy.push('60 zu 60');
        if (r.kontra > 1) s.bockWhy.push(r.kontra === 4 ? 'Kontra und Re' : 'Kontra');
        if (s.game.type === 'G' && s.game.hand && r.won) s.bockWhy.push('Grand Hand gewonnen');
        if (s.bockWhy.length) g.bock = (g.bock || 0) + 3;
      }
      persist();
    }
    render();
    showResult();
  }

  async function showResult() {
    const s = g.s, r = s.result;
    if (!r) return;
    if (r.ramsch) return showRamschResult();
    const d = s.declarer;
    const you = isYou(d);
    const goodForViewer = d === viewer ? r.won : (isHuman(d) && multi() ? r.won : !r.won);
    const title = you ? (r.won ? 'Gewonnen!' : 'Verloren') : (r.won ? `${nameOf(d)} gewinnt` : `${nameOf(d)} verliert`);
    const rows = [];
    if (s.game.type !== 'N') {
      for (const [k, v] of r.lines) rows.push(h('tr', {}, h('td', {}, k), h('td', { class: 'num' }, '+' + v)));
      rows.push(h('tr', { class: 'total' }, h('td', {}, `${r.mult} × ${GAME_NAME[s.game.type]} (${BASE[s.game.type]})`), h('td', { class: 'num' }, String(r.mult * BASE[s.game.type]))));
    } else rows.push(h('tr', { class: 'total' }, h('td', {}, gameLabel(s.game)), h('td', { class: 'num' }, String(nullValue(s.game)))));
    if (r.kontra > 1) rows.push(h('tr', {}, h('td', {}, r.kontra === 4 ? 'Kontra und Re' : 'Kontra'), h('td', { class: 'num' }, '× ' + r.kontra)));
    if (r.bock > 1) rows.push(h('tr', {}, h('td', {}, 'Bockspiel'), h('td', { class: 'num' }, '× 2')));
    const content = h('div', { class: 'result' },
      h('p', { class: 'result-big ' + (goodForViewer ? 'win' : 'lose') }, title),
      h('p', { html: s.game.type === 'N'
        ? `${hat(d)} ${r.won ? 'keinen' : 'einen'} Stich bekommen.`
        : `${nameOf(d)}: <b>${r.decPts}</b> Augen · Gegenspieler: <b>${r.defPts}</b> Augen` }),
      ...r.reasons.map(x => h('p', { class: 'small' }, x)),
      h('table', { class: 'result-table' }, rows),
      h('p', {}, `Gewertet: ${r.won ? '+' : ''}${r.score} für ${you ? 'dich' : nameOf(d)}${r.won ? '' : ' (verlorene Spiele zählen doppelt)'}.`),
      bockNote(),
      h('p', { class: 'small' }, s.skatTaken ? 'Gedrückt:' : 'Im Skat lagen:'),
      h('div', { class: 'cardline' }, (s.put || []).map(c => cardEl(c))),
    );
    const v = await dialog({ title: 'Abrechnung', content, buttons: [{ label: 'Skatblock', value: 'block' }, { label: 'Nächstes Spiel', value: 'next', primary: true }], dismissable: true });
    if (v === 'block') { await showBlock(); return; }
    if (v === 'next') nextRound(true);
  }

  function bockNote() {
    const s = g.s;
    if (!s.bockWhy || !s.bockWhy.length) return null;
    return h('p', { class: 'advice', html: `<b>Bockrunde!</b> Wegen ${s.bockWhy.join(' und ')} zählen die nächsten Spiele doppelt (noch ${g.bock}).` });
  }

  async function showRamschResult() {
    const s = g.s, r = s.result;
    const order = [0, 1, 2].sort((a, b) => r.pts[a] - r.pts[b]);
    let title, good;
    const humanIdx = humans();
    if (r.durchmarsch >= 0) { title = isYou(r.durchmarsch) ? 'Durchmarsch!' : `${nameOf(r.durchmarsch)}: Durchmarsch!`; good = humanIdx.includes(r.durchmarsch); }
    else if (r.losers.length > 1) { title = `${r.losers.map(nameOf).join(' und ')} verlieren`; good = !r.losers.some(p => humanIdx.includes(p)); }
    else { title = isYou(r.losers[0]) ? 'Du verlierst den Ramsch' : `${nameOf(r.losers[0])} verliert`; good = !humanIdx.includes(r.losers[0]); }
    const rows = order.map(p => h('tr', { class: r.losers.includes(p) || r.durchmarsch === p ? 'total' : '' },
      h('td', {}, nameOf(p)), h('td', { class: 'small' }, `${r.tricks[p]} ${r.tricks[p] === 1 ? 'Stich' : 'Stiche'}`),
      h('td', { class: 'num' }, `${r.pts[p]} Augen`), h('td', { class: 'num' }, r.scores[p] ? (r.scores[p] > 0 ? '+' : '') + r.scores[p] : '–')));
    const notes = [];
    notes.push(`Der Skat (${cardsPoints(s.put)} Augen) ging an ${s.tricks[9].winner === viewer && !multi() ? 'dich' : nameOf(s.tricks[9].winner)} – letzter Stich.`);
    if (r.durchmarsch >= 0) notes.push('Alle zehn Stiche gemacht: +120 Punkte.');
    if (r.jungfrau) notes.push('Jungfrau: Jemand hat keinen einzigen Stich gemacht – der Verlierer zahlt doppelt.');
    if (r.bock > 1) notes.push('Bockspiel: zählt doppelt.');
    const content = h('div', { class: 'result' },
      h('p', { class: 'result-big ' + (good ? 'win' : 'lose') }, title),
      h('table', { class: 'result-table' }, rows),
      ...notes.map(x => h('p', { class: 'small' }, x)),
      h('div', { class: 'cardline' }, (s.put || []).map(c => cardEl(c))));
    const v = await dialog({ title: 'Ramsch – Abrechnung', content, buttons: [{ label: 'Skatblock', value: 'block' }, { label: 'Nächstes Spiel', value: 'next', primary: true }], dismissable: true });
    if (v === 'block') { await showBlock(); return; }
    if (v === 'next') nextRound(true);
  }

  async function showBlock() {
    const rows = g.list.slice(-14).map(x => h('tr', {},
      h('td', {}, String(x.n)), h('td', {}, nameOf(x.decl)), h('td', {}, x.game),
      h('td', { class: 'num' }, (x.score > 0 ? '+' : '') + x.score)));
    const content = h('div', {},
      g.list.length ? h('table', { class: 'result-table' }, h('tr', {}, h('td', {}, '#'), h('td', {}, 'Wer'), h('td', {}, 'Spiel'), h('td', { class: 'num' }, 'Punkte')), rows) : h('p', {}, 'Noch keine Spiele in dieser Liste.'),
      h('table', { class: 'result-table' }, [0, 1, 2].map(p => h('tr', { class: isHuman(p) && !multi() ? 'total' : '' }, h('td', {}, nameOf(p)), h('td', { class: 'num' }, String(g.scores[p]))))),
      h('p', { class: 'small' }, 'Gewonnene Spiele zählen ihren Wert, verlorene den doppelten Wert als Minus (einfache Liste).'),
      g.bock ? h('p', { class: 'small', html: `<b class="tag-bock">Bock:</b> noch ${g.bock} ${g.bock === 1 ? 'Spiel zählt' : 'Spiele zählen'} doppelt.` } ) : null,
      h('p', { class: 'small' }, 'Hausregeln: ' + (Object.keys(RULE_INFO).filter(k => g.rules && g.rules[k]).map(k => RULE_INFO[k].label).join(', ') || 'keine') + '.'));
    await dialog({ title: 'Skatblock', content, buttons: [{ label: 'Schließen', value: true, primary: true }], dismissable: true });
  }

  async function showLastTrick() {
    const s = g.s;
    const tr = s.tricks[s.tricks.length - 1];
    if (!tr) return;
    const content = h('div', {},
      h('div', { class: 'cardline big' }, tr.cards.map(x => h('div', { class: 'lt-item' }, cardEl(x.c), h('small', {}, x.p === viewer ? 'Du' : players()[x.p].name)))),
      h('p', {}, `${tr.winner === viewer ? 'Du hast' : nameOf(tr.winner) + ' hat'} den Stich bekommen (${cardsPoints(tr.cards.map(x => x.c))} Augen).`));
    await dialog({ title: 'Letzter Stich', content, buttons: [{ label: 'OK', value: true, primary: true }], dismissable: true });
  }

  function nextRound(keep) {
    ui.coach.hide();
    table.clearBubbles();
    fresh(keep);
    render();
    advance();
  }

  // ---------- Tipp ----------
  function tip() {
    const s = g.s;
    const me = viewer;
    if (!isHuman(me) || busy) { ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du am Zug bist.', ms: 2500 }); return; }
    if (s.phase === 'bid' && s.bid.turn === me) {
      const a = bidAdvice();
      const b = s.bid;
      const val = b.stage === 3 ? 18 : b.wait === 'say' ? nextBid(b.value) : b.value;
      const go = a.max >= val;
      ui.coach.say({
        title: go ? (b.wait === 'answer' ? 'Halten!' : 'Weiterreizen!') : 'Lieber passen',
        text: [`Dein bestes Spiel: ${a.calc} (${a.verdict}).`,
          go ? `Bis ${a.max} kannst du mitgehen.` : a.best.margin < 0 && a.nul.margin < 0 ? 'Dein Blatt ist zu schwach für ein eigenes Spiel – hier ist Passen richtig.' : `${val} ist mehr, als dein Spiel sicher wert ist – wer überreizt, verliert.`,
          'Spitzen: Hast du den Kreuz-Buben, spielst du „mit“ so vielen Trümpfen in ununterbrochener Folge von oben. Fehlt er, spielst du „ohne“ so viele, wie dir von oben fehlen.'],
      });
      return;
    }
    if (s.phase === 'skat' && s.declarer === me && !handMode) {
      const hg = chooseHandGame(s.hands[me], s.bid.value, 'mittel');
      ui.coach.say({ title: hg ? 'Hand spielen!' : 'Skat aufnehmen', text: hg ? `Dein Blatt ist stark genug für ${gameLabel(hg.game)}. Hand bringt eine Stufe mehr.` : 'Mit dem Skat bekommst du zwei Karten dazu und kannst zwei schlechte wegdrücken – das macht dein Spiel sicherer.' });
      return;
    }
    if ((s.phase === 'declare' || (s.phase === 'skat' && handMode)) && s.declarer === me) {
      if (s.phase === 'skat') {
        const hg = chooseHandGame(s.hands[me], s.bid.value, 'mittel');
        ui.coach.say({ title: 'Vorschlag', text: hg ? `Spiel ${gameLabel(hg.game)}.` : 'Ehrlich gesagt: Für ein Handspiel ist das Blatt knapp. Nimm lieber den Skat auf.' });
        return;
      }
      const ch = chooseDeclaration(s.hands[me], s.bid.value, 'mittel');
      sel = new Set(ch.put);
      hintCards = new Set(ch.put);
      render();
      const pushed = cardsPoints(ch.put);
      const why = [];
      if (ch.game.type === 'N') why.push('Drücke die beiden gefährlichsten hohen Karten – dann ist dein Null fast sicher.');
      else {
        if (ch.put.some(c => c[1] === 'T')) why.push('Blanke Zehnen drücken: Sie würden sonst vom Ass gefangen.');
        const suits = new Set(ch.put.map(c => c[0]));
        const voids = [...suits].filter(su => !s.hands[me].some(c => c[0] === su && !isTrump(c, ch.game.type) && !ch.put.includes(c)));
        if (voids.length) why.push(`Danach hast du kein ${voids.map(v => SUIT_NAME[v]).join(' und kein ')} mehr und kannst stechen.`);
        if (pushed >= 10) why.push(`Die ${pushed} gedrückten Augen zählen sicher für dich.`);
      }
      const m = ch.game.type !== 'N' ? matadors(s.hands[me], ch.game.type) : null;
      ui.coach.say({ title: `Vorschlag: ${GAME_NAME[ch.game.type]}${ch.game.ouvert ? ' ouvert' : ''}`, text: [`Drücke ${ch.put.map(cardName).join(' und ')} (markiert).${m ? ` ${GAME_NAME[ch.game.type]} ${m.mit ? 'mit' : 'ohne'} ${m.n} ist ${gameValue(ch.game, s.hands[me], {})} wert.` : ''}`, ...why] });
      return;
    }
    if (s.phase === 'play' && s.turn === me) {
      busy = true;
      ui.coach.say({ title: 'Ich rechne …', text: 'Einen Moment.' });
      setTimeout(() => {
        busy = false;
        if (canKontra(s, me) || canRe(s, me)) {
          const wc = declarerWinChance(s, me, 32);
          if (canKontra(s, me) && wc < 0.35) {
            ui.coach.say({ title: 'Sag Kontra!', text: [`Ich habe das Spiel viele Male durchgespielt: ${nameOf(s.declarer)} gewinnt nur in etwa ${Math.round(wc * 100)} % der Fälle.`, 'Mit Kontra zählt sein Spiel doppelt – verliert er, kostet es ihn richtig viel.'], actions: [{ label: 'Kontra sagen', primary: true, onClick: () => call('kontra') }] });
            return;
          }
          if (canRe(s, me) && wc > 0.8) {
            ui.coach.say({ title: 'Sag Re!', text: [`Du gewinnst nach meiner Rechnung in etwa ${Math.round(wc * 100)} % der Fälle.`, 'Mit Re zählt das Spiel vierfach.'], actions: [{ label: 'Re sagen', primary: true, onClick: () => call('re') }] });
            return;
          }
        }
        const la = lookahead(s, me, 28);
        const pol = policy(s, me);
        hintCards = new Set([la.card]);
        render();
        const why = pol.card === la.card ? pol.why : `Ich habe die restlichen Karten viele Male durchgespielt – mit ${cardName(la.card)} holt deine Seite im Schnitt die meisten Augen.`;
        ui.coach.say({ title: `Spiel ${cardName(la.card)}`, text: why, actions: [{ label: 'Ausführen', primary: true, onClick: () => { if (g.s.phase === 'play' && g.s.turn === me) humanPlay(la.card); } }] });
      }, 30);
      return;
    }
    ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du am Zug bist.', ms: 2500 });
  }

  // ---------- Menü ----------
  ui.onTip = tip;
  ui.onNew = () => setup(false);
  ui.menuExtra = () => {
    const sw = (key, label, small, on) => {
      const i = h('input', { type: 'checkbox', class: 'switch', onchange: e => { ui.setOption(key, e.target.checked); on && on(); render(); } });
      i.checked = !!ui.option(key, false);
      return h('label', { class: 'switch-row' }, h('span', {}, label, h('small', {}, small)), i);
    };
    return h('div', {},
      sw('fourColor', 'Turnierbild', 'Vierfarbiges Blatt: Pik grün, Karo orange', applyFourColor),
      sw('confirmTap', 'Karte bestätigen', 'Erst antippen, dann noch einmal zum Ausspielen'),
      h('p', { class: 'small', style: { marginTop: '8px' } }, 'Hausregeln: ' + (Object.keys(RULE_INFO).filter(k => g && g.rules && g.rules[k]).map(k => RULE_INFO[k].label).join(', ') || 'keine') + ' – änderbar bei „Neues Spiel“.'),
      h('button', { class: 'btn btn-quiet', style: { marginTop: '8px' }, onclick: showBlock }, 'Skatblock ansehen'));
  };

  const ro = new ResizeObserver(() => render());
  ro.observe(table.handEl);

  function welcome() {
    if (!multi()) coachOnce('welcome', { title: 'Willkommen am Skattisch', text: [`Du spielst gegen ${nameOf(seatAt(1))} (links) und ${nameOf(seatAt(2))} (rechts). Erst wird gereizt, dann spielt der Gewinner allein gegen die beiden anderen.`, 'Mit Freunden spielen: Menü → „Neues Spiel“ und Plätze auf „Mensch“ stellen. Die Glühbirne gibt Tipps, das Buch erklärt alle Regeln.'], ms: 11000 });
  }

  async function setup(entry) {
    const running = !!(g && g.s);
    const form = rulesForm(RULE_INFO, (g && g.rules) || ui.option('rules', RULE_DEFAULTS));
    const pl = await choosePlayers({ title: entry ? 'Skat – wer spielt?' : 'Neue Liste – wer spielt?', min: 3, max: 3, current: players(), entry,
      resume: entry && running ? 'Weiterspielen' : null, resumeSub: entry && running ? `${g.list.length + 1}. Spiel im Skatblock` : '',
      note: 'Skat spielt man zu dritt. Freie Plätze übernimmt der Computer. Neu starten beginnt einen neuen Skatblock.', extra: form.el });
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
