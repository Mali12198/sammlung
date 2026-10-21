// Skat – Oberfläche
import { h, dialog, toast, sleep } from '../../ui.js';
import { load, save, remove, addResult, delay } from '../../store.js';
import { cardTable } from '../../cards/table.js';
import { cardEl } from '../../cards/render.js';
import { clone } from '../../util.js';
import {
  newRound, bidAction, aiBid, nextBid, takeSkat, declare, chooseDeclaration, chooseHandGame, legalFor, playCard,
  collectTrick, aiCard, policy, lookahead, sortHand, effSuit, isTrump, bidOptions, gameValue, BASE, GAME_NAME,
  SUIT_NAME, cardName, matadors, trickWinnerIdx, cardsPoints, nullValue,
} from './engine.js';

const NAMES = ['Du', 'Lotte', 'Karl'];
const POS = ['bottom', 'left', 'right'];
const suitIcon = t => (t && 'CSHD'.includes(t)) ? `<svg class="suit ${'HD'.includes(t) ? 'r' : 'b'}" viewBox="0 0 100 100"><use href="#s-${t}"/></svg>` : '';
const nameOf = p => NAMES[p];
const dat = p => (p === 0 ? 'dir' : nameOf(p));

export function gameLabel(gm) {
  if (!gm) return '';
  let s = GAME_NAME[gm.type];
  if (gm.type === 'N' && gm.ouvert) s += ' ouvert';
  if (gm.hand) s += ' Hand';
  if (gm.schwarz) s += ', Schwarz angesagt';
  else if (gm.schneider) s += ', Schneider angesagt';
  return s;
}

export function mount(ui) {
  let g = load('save:skat');
  let sel = new Set();          // gedrückte Karten (Kartennamen)
  let handMode = false;         // Spielwahl bei Handspiel
  let ann = { schneider: false, schwarz: false };
  let hintCards = new Set();
  let pending = null;           // Karte für Doppeltipp
  let token = 0;
  let busy = false;

  const table = cardTable(ui, { names: NAMES, positions: POS });
  ui.root.style.setProperty('--coach-bottom', '214px');
  applyFourColor();

  function fresh(keepList) {
    const old = g;
    const dealer = old ? (old.dealer + 1) % 3 : Math.floor(Math.random() * 3);
    g = {
      s: newRound(dealer), dealer,
      scores: keepList && old ? old.scores : [0, 0, 0],
      list: keepList && old ? old.list : [],
      tipsShown: old ? old.tipsShown || {} : {},
    };
    sel = new Set(); handMode = false; ann = { schneider: false, schwarz: false }; hintCards = new Set(); pending = null;
    persist();
  }
  function persist() { save('save:skat', g); }

  function applyFourColor() {
    ui.root.classList.toggle('four-color', !!ui.option('fourColor', false));
  }

  // ---------- Darstellung ----------
  function handSorted() {
    const s = g.s;
    const t = s.game ? s.game.type : null;
    return sortHand(s.hands[0], t);
  }

  function roleOf(p) {
    const s = g.s;
    const pos = p === s.V ? 'Vorhand' : p === s.M ? 'Mittelhand' : 'Hinterhand';
    if (s.declarer === p && s.phase !== 'bid') return `<b>Alleinspieler</b>`;
    if (s.phase === 'bid' || s.phase === 'allpass') return pos;
    const tricks = s.tricks.filter(x => x.winner === p).length;
    return tricks ? `${tricks} ${tricks === 1 ? 'Stich' : 'Stiche'}` : (s.declarer >= 0 ? 'Gegenspieler' : pos);
  }

  function render() {
    const s = g.s;
    const t = s.game ? s.game.type : null;
    for (const p of [1, 2]) {
      const open = s.game && s.game.ouvert && s.declarer === p && (s.phase === 'play' || s.phase === 'collect');
      table.setSeat(p, {
        role: roleOf(p),
        on: (s.phase === 'play' && s.turn === p) || (s.phase === 'bid' && s.bid.turn === p),
        count: s.hands[p].length,
        openCards: open ? sortHand(s.hands[p], 'N') : null,
      });
    }
    // Stich
    const winIdx = s.phase === 'collect' ? trickWinnerIdx(s.trick.map(x => x.c), t) : -1;
    table.renderTrick(s.trick, { winner: winIdx });
    // Pillen
    let left = '';
    if (s.phase === 'bid') left = `Reizen${s.bid.value ? ' · ' + s.bid.value : ''}`;
    else if (s.game) left = `${suitIcon(t)}<b>${gameLabel(s.game)}</b> · ${s.declarer === 0 ? 'du' : nameOf(s.declarer)} (${s.bid.value})`;
    else if (s.declarer >= 0) left = `${s.declarer === 0 ? 'Du spielst' : nameOf(s.declarer) + ' spielt'} · ${s.bid.value}`;
    table.setPills(left, `Liste: <b>${g.scores[0]}</b>`, showBlock);
    // Hand
    const cards = handSorted();
    const myTurn = s.phase === 'play' && s.turn === 0;
    const legal = myTurn ? legalFor(s, 0) : null;
    table.renderHand(cards, {
      playable: i => !myTurn || legal.includes(cards[i]),
      selected: new Set(cards.map((c, i) => (sel.has(c) || pending === c) ? i : -1).filter(i => i >= 0)),
      hint: new Set(cards.map((c, i) => hintCards.has(c) ? i : -1).filter(i => i >= 0)),
      trump: c => t && t !== 'N' && isTrump(c, t),
      onTap: i => onCard(cards[i]),
    });
    renderPhase();
    ui.setSubtitle(`Computer ${ui.level()}`);
  }

  function btn(label, onclick, primary, extra = {}) {
    return h('button', { class: 'btn' + (primary ? ' btn-primary' : ''), onclick, ...extra }, label);
  }

  function renderPhase() {
    const s = g.s;
    table.setCenter(null);
    table.setActions([]);
    if (s.phase === 'bid') {
      const b = s.bid;
      if (b.turn !== 0) { table.setStatus(`${nameOf(b.turn)} ${b.wait === 'answer' ? 'überlegt' : 'reizt'} …`); return; }
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
      if (s.declarer !== 0) { table.setStatus(`${nameOf(s.declarer)} hat das Reizen gewonnen …`); return; }
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
      if (s.declarer !== 0) { table.setStatus(`${nameOf(s.declarer)} drückt …`); return; }
      table.setStatus(sel.size < 2 ? `Tippe ${2 - sel.size === 2 ? 'zwei Karten' : 'noch eine Karte'} zum Drücken an.` : 'Jetzt das Spiel ansagen.');
      table.setCenter(gamePanel(false));
      return;
    }
    if (s.phase === 'play' || s.phase === 'collect') {
      if (s.phase === 'collect') {
        const w = s.trick[trickWinnerIdx(s.trick.map(x => x.c), s.game.type)].p;
        const p = cardsPoints(s.trick.map(x => x.c));
        table.setStatus(`${w === 0 ? 'Dein Stich' : 'Stich für ' + nameOf(w)} · ${p} ${p === 1 ? 'Auge' : 'Augen'}`);
      } else if (s.turn === 0) {
        table.setStatus(s.trick.length ? 'Du bist dran.' : '<b>Du spielst aus.</b>');
      } else table.setStatus(`${nameOf(s.turn)} ist dran …`);
      const acts = [];
      if (s.tricks.length) acts.push(h('button', { class: 'chip', onclick: showLastTrick }, 'Letzter Stich'));
      if (ui.coachOn() && s.declarer >= 0) acts.push(h('span', { class: 'chip chip-info' }, pointsLine()));
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
    const dp = cardsPoints(s.taken[d]);
    const op = cardsPoints(s.taken[(d + 1) % 3]) + cardsPoints(s.taken[(d + 2) % 3]);
    return d === 0 ? `Augen: du ${dp} · Gegner ${op}` : `Augen: ${nameOf(d)} ${dp} · ihr ${op}`;
  }

  // ---------- Reizen ----------
  function bidAdvice() {
    const s = g.s;
    const pos = s.V === 0 ? 'V' : s.M === 0 ? 'M' : 'H';
    const opts = bidOptions(s.hands[0], 'mittel', pos).filter(o => o.type !== 'N');
    opts.sort((a, b) => b.margin - a.margin);
    const best = opts[0];
    const m = best.mat;
    const full = BASE[best.type] * (m.n + 1);
    const calc = `${GAME_NAME[best.type]} ${m.mit ? 'mit' : 'ohne'} ${m.n}: ${BASE[best.type]} × ${m.n + 1} = <b>${full}</b>${!m.mit && m.n > 3 ? ' (Vorsicht: Liegt ein hoher Bube im Skat, sinkt der Wert stark)' : ''}`;
    const value = best.value;
    const verdict = best.margin >= 0.6 ? 'gut spielbar' : best.margin >= 0 ? 'knapp spielbar' : 'eher zu schwach';
    const nul = bidOptions(s.hands[0], 'mittel', pos).find(o => o.type === 'N');
    return { best, calc, verdict, nul, max: best.margin >= 0 ? value : (nul.margin >= 0 ? 23 : 0) };
  }

  function bidPanel() {
    const s = g.s, b = s.bid;
    const kids = [];
    let title, text, buttons;
    if (b.stage === 3) {
      title = 'Alle haben gepasst';
      text = 'Du bist Vorhand und darfst für 18 spielen – oder einpassen, dann wird neu gegeben.';
      buttons = [btn('Einpassen', () => doBid('pass')), btn('Für 18 spielen', () => doBid('play'), true)];
    } else if (b.wait === 'say') {
      const nb = nextBid(b.value);
      title = 'Reizen';
      text = b.value ? `${nameOf(b.hoerer)} hält ${b.value}. Gehst du höher?` : `Du sagst ${b.hoerer === 0 ? 'dir' : nameOf(b.hoerer)} an. Mit welchem Wert beginnst du?`;
      buttons = [btn('Passe', () => doBid('pass')), btn(`${nb} sagen`, () => doBid('say'), true)];
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
    if (s.phase !== 'bid' || s.bid.turn !== 0) return;
    hintCards = new Set();
    bidAction(s, 0, action);
    persist();
    render();
    advance();
  }

  // ---------- Spielansage ----------
  function gamePanel(hand) {
    const s = g.s;
    const cards12 = hand ? s.hands[0] : s.hands[0];
    const ready = hand || sel.size === 2;
    const mk = (type, extra = {}) => {
      const gm = { type, hand, ...(type === 'N' ? { ouvert: !!extra.ouvert } : ann) };
      const v = gameValue(gm, cards12, {});
      const low = v < s.bid.value;
      const blocked = type === 'N' && low;
      const label = type === 'N' ? (extra.ouvert ? 'Null ouvert' : 'Null') : GAME_NAME[type];
      const b = h('button', {
        class: 'btn game-btn' + (low ? ' warn' : ''),
        disabled: !ready || blocked,
        onclick: () => announce(gm),
        title: low ? 'Überreizt – dieser Wert reicht nicht' : '',
      }, h('span', { class: 'gb-name', html: suitIcon(type) + label }), h('small', {}, (hand && type !== 'N' ? 'ca. ' : '') + v + (low ? ' – zu wenig' : '')));
      return b;
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
    if (s.phase === 'skat') {
      if (gm.type !== 'N') gm = { ...gm, ...ann };
      declare(s, { ...gm, hand: true });
      bubbleGame(0);
    } else {
      if (sel.size !== 2) return;
      declare(s, gm, [...sel]);
    }
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

  function bubbleGame(p) {
    const gm = g.s.game;
    table.bubble(p, gameLabel(gm), 2600);
  }

  // ---------- Karten tippen ----------
  function onCard(c) {
    const s = g.s;
    if (busy) return;
    if (s.phase === 'declare' && s.declarer === 0) {
      if (sel.has(c)) sel.delete(c);
      else { if (sel.size >= 2) sel.delete([...sel][0]); sel.add(c); }
      hintCards = new Set();
      render();
      return;
    }
    if (s.phase !== 'play' || s.turn !== 0) {
      if (s.phase === 'play') toast(`${nameOf(s.turn)} ist dran.`);
      return;
    }
    const legal = legalFor(s, 0);
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
    const before = ui.coachOn() ? clone(s) : null;
    hintCards = new Set();
    ui.coach.hide();
    playCard(s, 0, c);
    persist();
    render();
    if (before) setTimeout(() => review(before, c), 60);
    advance();
  }

  function review(before, c) {
    if (ui.destroyed) return;
    const legal = legalFor(before, 0);
    if (legal.length < 2) return;
    const la = lookahead(before, 0, 14);
    const sc = la.scores;
    if (!sc) return;
    const loss = sc[la.card] - sc[c];
    const pol = policy(before, 0);
    if (loss >= 12 && la.card !== c) {
      const why = pol.card === la.card ? pol.why : `Ich habe die übrigen Karten mehrfach durchgespielt: Mit ${cardName(la.card)} holt deine Seite im Schnitt deutlich mehr.`;
      ui.coach.say({ title: `Besser wäre ${cardName(la.card)} gewesen`, kind: 'warn', text: why, ms: 9000 });
    } else if (pol.card === c && /Schmieren|Trumpf ziehen|Kurzer Weg|Langer Weg|Ass abziehen/.test(pol.why) && Math.random() < 0.5) {
      ui.coach.say({ title: 'Gut gespielt', kind: 'good', text: pol.why, ms: 5000 });
    }
  }

  // ---------- Ablauf ----------
  async function advance() {
    const my = ++token;
    const alive = () => !ui.destroyed && my === token;
    const lv = ui.level();
    while (alive()) {
      const s = g.s;
      if (s.phase === 'bid') {
        const p = s.bid.turn;
        if (p === 0) { render(); maybeBidCoach(); return; }
        busy = true; render();
        await sleep(delay(750));
        if (!alive()) return;
        const a = aiBid(s, p, lv);
        bidAction(s, p, a);
        table.bubble(p, s.bid.said[p], 1700);
        busy = false; persist(); render();
        continue;
      }
      if (s.phase === 'allpass') { render(); return; }
      if (s.phase === 'skat') {
        if (s.declarer === 0) { render(); maybeDeclCoach(); return; }
        busy = true; render();
        await sleep(delay(900));
        if (!alive()) return;
        const d = s.declarer;
        const hg = chooseHandGame(s.hands[d], s.bid.value, lv);
        if (hg) declare(s, hg.game);
        else {
          takeSkat(s);
          table.bubble(d, 'Nimmt den Skat', 1200);
          render();
          await sleep(delay(1000));
          if (!alive()) return;
          const ch = chooseDeclaration(s.hands[d], s.bid.value, lv);
          declare(s, ch.game, ch.put);
        }
        bubbleGame(d);
        busy = false; persist(); render();
        if (ui.coachOn() && s.game) coachDefense();
        await sleep(delay(900));
        continue;
      }
      if (s.phase === 'declare') { render(); return; }
      if (s.phase === 'play') {
        if (s.turn === 0) { busy = false; render(); return; }
        busy = true; render();
        await sleep(delay(650));
        if (!alive()) return;
        const p = s.turn;
        const c = aiCard(s, p, lv);
        playCard(s, p, c);
        busy = false; persist(); render();
        continue;
      }
      if (s.phase === 'collect') {
        busy = true; render();
        await sleep(delay(1000));
        if (!alive()) return;
        const w = s.trick[trickWinnerIdx(s.trick.map(x => x.c), s.game.type)].p;
        await table.collect(w);
        collectTrick(s);
        busy = false; persist(); render();
        continue;
      }
      if (s.phase === 'done') { busy = false; finishRound(); return; }
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
    if (s.declarer === 0) return;
    const t = s.game.type;
    const partner = 3 - s.declarer;
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
      g.scores[s.declarer] += r.score;
      g.list.push({ n: g.list.length + 1, decl: s.declarer, game: gameLabel(s.game), bid: s.bid.value, value: r.value, score: r.score, won: r.won, scores: g.scores.slice() });
      const humanWon = s.declarer === 0 ? r.won : !r.won;
      addResult('skat', humanWon);
      persist();
    }
    render();
    showResult();
  }

  async function showResult() {
    const s = g.s, r = s.result;
    if (!r) return;
    const d = s.declarer;
    const me = d === 0;
    const humanWon = me ? r.won : !r.won;
    const title = me ? (r.won ? 'Gewonnen!' : 'Verloren') : (r.won ? `${nameOf(d)} gewinnt` : `${nameOf(d)} verliert`);
    const rows = [];
    if (s.game.type !== 'N') {
      for (const [k, v] of r.lines) rows.push(h('tr', {}, h('td', {}, k), h('td', { class: 'num' }, '+' + v)));
      rows.push(h('tr', { class: 'total' }, h('td', {}, `${r.mult} × ${GAME_NAME[s.game.type]} (${BASE[s.game.type]})`), h('td', { class: 'num' }, String(r.mult * BASE[s.game.type]))));
    } else rows.push(h('tr', { class: 'total' }, h('td', {}, gameLabel(s.game)), h('td', { class: 'num' }, String(nullValue(s.game)))));
    const content = h('div', { class: 'result' },
      h('p', { class: 'result-big ' + (humanWon ? 'win' : 'lose') }, title),
      h('p', { html: s.game.type === 'N'
        ? (r.won ? `${me ? 'Du hast' : nameOf(d) + ' hat'} keinen Stich bekommen.` : `${me ? 'Du hast' : nameOf(d) + ' hat'} einen Stich bekommen.`)
        : `${me ? 'Du' : nameOf(d)}: <b>${r.decPts}</b> Augen · Gegenspieler: <b>${r.defPts}</b> Augen` }),
      ...r.reasons.map(x => h('p', { class: 'small' }, x)),
      h('table', { class: 'result-table' }, rows),
      h('p', {}, `Gewertet: ${r.won ? '+' : ''}${r.score} für ${me ? 'dich' : nameOf(d)}${r.won ? '' : ' (verlorene Spiele zählen doppelt)'}.`),
      h('p', { class: 'small' }, s.skatTaken ? 'Gedrückt:' : 'Im Skat lagen:'),
      h('div', { class: 'cardline' }, (s.put || []).map(c => cardEl(c))),
    );
    const v = await dialog({ title: 'Abrechnung', content, buttons: [{ label: 'Skatblock', value: 'block' }, { label: 'Nächstes Spiel', value: 'next', primary: true }], dismissable: true });
    if (v === 'block') { await showBlock(); return; }
    if (v === 'next') nextRound(true);
  }

  async function showBlock() {
    const rows = g.list.slice(-14).map(x => h('tr', {},
      h('td', {}, String(x.n)), h('td', {}, x.decl === 0 ? 'Du' : nameOf(x.decl)), h('td', {}, x.game),
      h('td', { class: 'num' }, (x.score > 0 ? '+' : '') + x.score)));
    const content = h('div', {},
      g.list.length ? h('table', { class: 'result-table' }, h('tr', {}, h('td', {}, '#'), h('td', {}, 'Wer'), h('td', {}, 'Spiel'), h('td', { class: 'num' }, 'Punkte')), rows) : h('p', {}, 'Noch keine Spiele in dieser Liste.'),
      h('table', { class: 'result-table' }, [0, 1, 2].map(p => h('tr', { class: p === 0 ? 'total' : '' }, h('td', {}, NAMES[p]), h('td', { class: 'num' }, String(g.scores[p]))))),
      h('p', { class: 'small' }, 'Gewonnene Spiele zählen ihren Wert, verlorene den doppelten Wert als Minus (einfache Liste).'));
    await dialog({ title: 'Skatblock', content, buttons: [{ label: 'Schließen', value: true, primary: true }], dismissable: true });
  }

  async function showLastTrick() {
    const s = g.s;
    const tr = s.tricks[s.tricks.length - 1];
    if (!tr) return;
    const content = h('div', {},
      h('div', { class: 'cardline big' }, tr.cards.map(x => h('div', { class: 'lt-item' }, cardEl(x.c), h('small', {}, NAMES[x.p])))),
      h('p', {}, `${tr.winner === 0 ? 'Du hast' : nameOf(tr.winner) + ' hat'} den Stich bekommen (${cardsPoints(tr.cards.map(x => x.c))} Augen).`));
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
    if (s.phase === 'bid' && s.bid.turn === 0) {
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
    if (s.phase === 'skat' && s.declarer === 0 && !handMode) {
      const hg = chooseHandGame(s.hands[0], s.bid.value, 'mittel');
      ui.coach.say({ title: hg ? 'Hand spielen!' : 'Skat aufnehmen', text: hg ? `Dein Blatt ist stark genug für ${gameLabel(hg.game)}. Hand bringt eine Stufe mehr.` : 'Mit dem Skat bekommst du zwei Karten dazu und kannst zwei schlechte wegdrücken – das macht dein Spiel sicherer.' });
      return;
    }
    if ((s.phase === 'declare' || (s.phase === 'skat' && handMode)) && s.declarer === 0) {
      if (s.phase === 'skat') {
        const hg = chooseHandGame(s.hands[0], s.bid.value, 'mittel');
        ui.coach.say({ title: 'Vorschlag', text: hg ? `Spiel ${gameLabel(hg.game)}.` : 'Ehrlich gesagt: Für ein Handspiel ist das Blatt knapp. Nimm lieber den Skat auf.' });
        return;
      }
      const ch = chooseDeclaration(s.hands[0], s.bid.value, 'mittel');
      sel = new Set(ch.put);
      hintCards = new Set(ch.put);
      render();
      const pushed = cardsPoints(ch.put);
      const why = [];
      if (ch.game.type === 'N') why.push('Drücke die beiden gefährlichsten hohen Karten – dann ist dein Null fast sicher.');
      else {
        if (ch.put.some(c => c[1] === 'T')) why.push('Blanke Zehnen drücken: Sie würden sonst vom Ass gefangen.');
        const suits = new Set(ch.put.map(c => c[0]));
        const voids = [...suits].filter(su => !s.hands[0].some(c => c[0] === su && !isTrump(c, ch.game.type) && !ch.put.includes(c)));
        if (voids.length) why.push(`Danach hast du kein ${voids.map(v => SUIT_NAME[v]).join(' und kein ')} mehr und kannst stechen.`);
        if (pushed >= 10) why.push(`Die ${pushed} gedrückten Augen zählen sicher für dich.`);
      }
      const m = ch.game.type !== 'N' ? matadors(s.hands[0], ch.game.type) : null;
      ui.coach.say({ title: `Vorschlag: ${GAME_NAME[ch.game.type]}${ch.game.ouvert ? ' ouvert' : ''}`, text: [`Drücke ${ch.put.map(cardName).join(' und ')} (markiert).${m ? ` ${GAME_NAME[ch.game.type]} ${m.mit ? 'mit' : 'ohne'} ${m.n} ist ${gameValue(ch.game, s.hands[0], {})} wert.` : ''}`, ...why] });
      return;
    }
    if (s.phase === 'play' && s.turn === 0) {
      busy = true;
      ui.coach.say({ title: 'Ich rechne …', text: 'Einen Moment.' });
      setTimeout(() => {
        busy = false;
        const la = lookahead(s, 0, 28);
        const pol = policy(s, 0);
        hintCards = new Set([la.card]);
        render();
        const why = pol.card === la.card ? pol.why : `Ich habe die restlichen Karten viele Male durchgespielt – mit ${cardName(la.card)} holt deine Seite im Schnitt die meisten Augen.`;
        ui.coach.say({ title: `Spiel ${cardName(la.card)}`, text: why, actions: [{ label: 'Ausführen', primary: true, onClick: () => { if (g.s.phase === 'play' && g.s.turn === 0) humanPlay(la.card); } }] });
      }, 30);
      return;
    }
    ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du am Zug bist.', ms: 2500 });
  }

  // ---------- Menü ----------
  ui.onTip = tip;
  ui.onNew = async () => {
    const r = await dialog({ title: 'Neue Liste?', body: 'Der Skatblock wird geleert und alle fangen bei 0 an.', buttons: [{ label: 'Abbrechen', value: false }, { label: 'Neue Liste', value: true, primary: true }] });
    if (r) { token++; g = null; fresh(false); render(); advance(); }
  };
  ui.menuExtra = () => {
    const sw = (key, label, small, on) => {
      const i = h('input', { type: 'checkbox', class: 'switch', onchange: e => { ui.setOption(key, e.target.checked); on && on(); render(); } });
      i.checked = !!ui.option(key, false);
      return h('label', { class: 'switch-row' }, h('span', {}, label, h('small', {}, small)), i);
    };
    return h('div', {},
      sw('fourColor', 'Turnierbild', 'Vierfarbiges Blatt: Pik grün, Karo orange', applyFourColor),
      sw('confirmTap', 'Karte bestätigen', 'Erst antippen, dann noch einmal zum Ausspielen'),
      h('button', { class: 'btn btn-quiet', style: { marginTop: '8px' }, onclick: showBlock }, 'Skatblock ansehen'));
  };

  const ro = new ResizeObserver(() => render());
  ro.observe(table.handEl);

  if (!g || !g.s) fresh(false);
  render();
  advance();
  coachOnce('welcome', { title: 'Willkommen am Skattisch', text: ['Du spielst gegen Lotte (links) und Karl (rechts). Erst wird gereizt, dann spielt der Gewinner allein gegen die beiden anderen.', 'Die Glühbirne oben gibt dir jederzeit einen Tipp, das Buch erklärt alle Regeln.'], ms: 10000 });

  return () => { token++; ro.disconnect(); };
}
