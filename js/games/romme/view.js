// Rommé – Oberfläche (2 bis 4 Spieler, Menschen und Computer gemischt)
import { h, dialog, toast, sleep } from '../../ui.js';
import { load, save, addResult, delay } from '../../store.js';
import { cardEl, fitHand } from '../../cards/render.js';
import { choosePlayers, handover, rulesForm } from '../../players.js';
import {
  newRound, sortHand, pileTop, drawStock, takePile, canTakePile, undoTake, meldNew, checkNew, addTo, checkAdd, discard, canDiscard,
  analyze, meldValue, describeMeld, jokerStands, isJoker, cardName, handPoints, handValue, comeOutPlan,
  aiDraw, aiPlan, aiDiscard, whyNotMeld, MIN_OUT,
} from './engine.js';

const DEFAULT_PLAYERS = [{ name: 'Du', human: true }, { name: 'Lotte', human: false }, { name: 'Karl', human: false }];
const RULE_INFO = {
  out30: { label: 'Rauskommen mit 30', text: 'Für die ersten Meldungen reichen 30 statt 40 Punkte' },
  handDouble: { label: 'Hand-Rommé doppelt', text: 'Wer alle Karten auf einmal auslegt, ohne vorher draußen zu sein, lässt die anderen doppelt zahlen' },
};
const RULE_DEFAULTS = { out30: false, handDouble: true };
const TARGETS = [[0, 'Eine Runde'], [200, 'Bis 200'], [500, 'Bis 500']];

export function mount(ui) {
  let g = load('save:romme');
  let sel = new Set();        // Indizes in der sortierten Hand
  let staged = [];            // vorgemerkte Meldungen zum Rauskommen: [[karten]]
  let token = 0, busy = false, hint = null, viewer = 0;

  const N = () => g.s.n;
  const players = () => (g && g.players) || DEFAULT_PLAYERS;
  const isHuman = p => !!players()[p].human;
  const humans = () => [...Array(N()).keys()].filter(isHuman);
  const multi = () => humans().length > 1;
  const isYou = p => !multi() && isHuman(p);
  const nameOf = p => (isYou(p) ? 'Du' : players()[p].name);
  const sortMode = () => ui.option('sort', 'suit');

  function fresh(keepTotals, newPlayers, rules, target) {
    const old = g;
    const pl = newPlayers || (old && old.players) || DEFAULT_PLAYERS;
    const n = pl.length;
    const r = rules || (old && old.rules) || ui.option('rules', RULE_DEFAULTS);
    const tg = target !== undefined ? target : (old && old.target !== undefined ? old.target : ui.option('target', 200));
    const dealer = old && keepTotals ? (old.s.dealer + 1) % n : n - 1;
    g = {
      s: newRound({ n, dealer, minOut: r.out30 ? 30 : MIN_OUT }),
      players: pl, rules: r, target: tg,
      totals: keepTotals && old ? old.totals : new Array(n).fill(0),
      round: keepTotals && old ? (old.round || 1) + 1 : 1,
      tipsShown: old ? old.tipsShown || {} : {}, over: false,
    };
    viewer = humans()[0] ?? 0;
    sel = new Set(); staged = []; hint = null;
    persist();
  }
  function persist() { save('save:romme', g); }

  // ---------- Aufbau ----------
  const felt = h('div', { class: 'felt can-felt rm-felt' });
  const pills = h('div', { class: 'can-pills' });
  const oppRow = h('div', { class: 'can-players' });
  const tableZone = h('div', { class: 'rm-table' });
  const mid = h('div', { class: 'can-mid' });
  const status = h('div', { class: 'statusline' });
  const actions = h('div', { class: 'action-row' });
  const handEl = h('div', { class: 'can-hand' });
  const scroll = h('div', { class: 'can-scroll' }, oppRow, tableZone, mid);
  felt.append(pills, scroll, h('div', { class: 'can-hand-zone' }, status, actions, handEl));
  ui.stage.append(felt);
  ui.root.style.setProperty('--coach-bottom', '230px');

  const myTurn = () => g.s.turn === viewer && isHuman(viewer) && !busy;
  const hand = () => sortHand(g.s.hands[viewer], sortMode());
  const selCards = () => { const hd = hand(); return [...sel].sort((a, b) => a - b).map(i => hd[i]); };
  const stagedCards = () => staged.flat();
  function visibleHand() {
    const hd = hand();
    const rest = stagedCards().slice();
    return hd.map((c, i) => ({ c, i })).filter(({ c }) => { const k = rest.indexOf(c); if (k >= 0) { rest.splice(k, 1); return false; } return true; });
  }

  // ---------- Darstellung ----------
  function meldEl(m, idx, { pending = false } = {}) {
    const el = h('div', { class: 'meld rm-meld' + (pending ? ' pending' : '') + (hint && hint.meld === idx ? ' is-hint' : ''), role: 'button', 'aria-label': describeMeld(m) },
      m.cards.map(c => cardEl(c, { w: 30 })));
    if (!pending) el.addEventListener('click', () => onMeldTap(idx));
    return el;
  }

  let veiled = true;
  function render() {
    if (!g || !g.s || (veiled && multi())) return;
    const s = g.s;
    const me = viewer;
    pills.replaceChildren(
      h('span', { class: 'trump-pill static' }, `Runde ${g.round || 1}${g.target ? ' · bis ' + g.target : ''}`),
      h('button', { class: 'trump-pill static score', onclick: showScores }, h('b', {}, (multi() ? players()[me].name : 'Du') + ': '), String(g.totals[me]), ' Strafpunkte'));
    const others = [...Array(N() - 1).keys()].map(k => (me + 1 + k) % N());
    oppRow.replaceChildren(...others.map(p => h('div', { class: 'can-player' + (s.turn === p && s.phase !== 'done' ? ' on' : '') },
      h('span', { class: 'turn-dot' }), h('b', {}, nameOf(p)),
      h('span', { class: 'cc', 'aria-label': `${s.hands[p].length} Karten` }, h('i', { class: 'mini-back' }), String(s.hands[p].length)),
      s.out[p] ? h('span', { class: 'rm-out', title: 'ist draußen' }, 'draußen') : null,
      h('span', { class: 'bubble-slot', 'data-p': p }))));
    const list = h('div', { class: 'melds rm-melds' });
    s.melds.forEach((m, i) => list.append(meldEl(m, i)));
    for (const st of staged) { const m = analyze(st); if (m) list.append(meldEl(m, -1, { pending: true })); }
    if (!list.children.length) list.append(h('div', { class: 'meld empty-hint' }, `Noch nichts ausgelegt · Rauskommen ab ${s.minOut} Punkten`));
    tableZone.replaceChildren(list);
    const myDraw = myTurn() && s.phase === 'draw';
    const top = pileTop(s);
    const stockEl = h('div', { class: 'pile-slot' + (myDraw ? ' can-act' : '') + (hint && hint.stock ? ' is-hint' : ''), role: 'button', 'aria-label': 'Stapel: Karte ziehen', onclick: onStock },
      h('div', { class: 'stack' }, cardEl(null, { faceDown: true })), h('span', {}, `Stapel · ${s.stock.length}`));
    const pileEl = h('div', { class: 'pile-slot' + (myDraw && canTakePile(s, me) ? ' can-act' : '') + (hint && hint.pile ? ' is-hint' : ''), role: 'button', 'aria-label': 'Ablage', onclick: onPile },
      h('div', { class: 'stack' }, top ? cardEl(top) : h('div', { class: 'card empty' })), h('span', {}, `Ablage · ${s.pile.length}`));
    mid.replaceChildren(stockEl, pileEl);
    renderHand();
    renderActions();
    ui.setSubtitle(humans().length === N() ? `${N()} Spieler` : `Computer ${ui.level()}`);
  }

  function renderHand() {
    if (!g || !g.s || (veiled && multi())) return;
    const vis = visibleHand();
    const avail = Math.max(260, (handEl.clientWidth || 390) - 20);
    const rows = vis.length > 15 ? 2 : 1;
    const per = Math.ceil(vis.length / rows);
    const { w, ov } = fitHand(per, avail, 62, 24);
    handEl.style.setProperty('--hcw', w + 'px');
    handEl.style.setProperty('--ov', ov + 'px');
    const hintList = hint && hint.cards ? hint.cards.slice() : [];
    const rowEls = [];
    for (let r = 0; r < rows; r++) {
      const part = vis.slice(r * per, (r + 1) * per);
      rowEls.push(h('div', { class: 'hand-row' }, part.map(({ c, i }) => {
        const el = cardEl(c, { w });
        if (sel.has(i)) el.classList.add('is-sel');
        const k = hintList.indexOf(c);
        if (k >= 0) { el.classList.add('is-hint'); hintList.splice(k, 1); }
        if (myTurn() && g.s.phase === 'draw') el.classList.add('is-soft');
        if (g.s.took && c === g.s.took && myTurn()) el.classList.add('is-new');
        el.addEventListener('click', () => onCard(i));
        return el;
      })));
    }
    handEl.replaceChildren(...rowEls);
  }

  const btn = (label, onclick, primary, disabled) => h('button', { class: 'btn' + (primary ? ' btn-primary' : ''), onclick, disabled: !!disabled }, label);

  function renderActions() {
    const s = g.s;
    const acts = [];
    let txt = '';
    if (s.phase === 'done') {
      txt = 'Runde vorbei.';
      acts.push(btn('Ergebnis', showResult), btn(g.over ? 'Neues Spiel' : 'Nächste Runde', nextRound, true));
    } else if (!myTurn()) {
      txt = `${nameOf(s.turn)} ist dran …`;
    } else if (s.phase === 'draw') {
      txt = 'Zieh eine Karte vom Stapel – oder nimm die oberste Karte der Ablage.';
      acts.push(btn('Karte ziehen', onStock, true), btn('Ablage nehmen', onPile));
    } else {
      const me = viewer;
      const n = sel.size;
      if (!s.out[me]) {
        const tot = staged.reduce((a, g2) => a + meldValue(analyze(g2)), 0);
        txt = staged.length ? `Rauskommen: <b>${tot}</b> von ${s.minOut} Punkten vorgemerkt.` : `Lege Meldungen aus (zusammen ${s.minOut} Punkte) oder lege eine Karte ab.`;
        if (staged.length) acts.push(btn('Zurück', () => { staged = []; sel = new Set(); render(); }));
        if (s.took && !staged.length) acts.push(btn('Karte zurücklegen', onUndoTake));
      } else txt = n ? `${n} ${n === 1 ? 'Karte' : 'Karten'} gewählt – auslegen, an eine Meldung tippen oder ablegen.` : 'Wähle Karten zum Auslegen oder eine zum Ablegen.';
      acts.push(btn('Auslegen', onMeld, false, n < 3));
      acts.push(btn('Ablegen', onDiscard, true, n !== 1));
    }
    acts.push(h('button', { class: 'chip', onclick: toggleSort, title: 'Sortierung' }, sortMode() === 'suit' ? 'Nach Farbe' : 'Nach Wert'));
    status.innerHTML = txt;
    actions.replaceChildren(...acts);
  }

  function bubble(p, text, ms = 1800) {
    const el = oppRow.querySelector(`.bubble-slot[data-p="${p}"]`);
    if (!el) return;
    el.replaceChildren(h('span', { class: 'bubble' }, text));
    setTimeout(() => { if (el.isConnected) el.replaceChildren(); }, ms);
  }

  // ---------- Eingaben ----------
  function toggleSort() {
    const hd = hand();
    const keep = selCards();
    ui.setOption('sort', sortMode() === 'suit' ? 'rank' : 'suit');
    // Auswahl mitnehmen
    const nh = hand();
    sel = new Set();
    const used = new Set();
    for (const c of keep) { const i = nh.findIndex((x, k) => x === c && !used.has(k)); if (i >= 0) { sel.add(i); used.add(i); } }
    void hd;
    render();
  }

  function onCard(i) {
    const s = g.s;
    if (!myTurn() || s.phase !== 'play') {
      if (myTurn() && s.phase === 'draw') toast('Zuerst ziehen: Stapel oder Ablage.');
      return;
    }
    hint = null;
    if (sel.has(i)) sel.delete(i); else sel.add(i);
    render();
  }

  function onStock() {
    const s = g.s;
    if (!myTurn() || s.phase !== 'draw') return;
    hint = null;
    const c = drawStock(s, viewer);
    persist(); render();
    flashNew(c);
  }

  function flashNew(c) {
    const vis = visibleHand();
    const k = vis.findIndex(x => x.c === c);
    const el = handEl.querySelectorAll('.card')[k];
    if (el) el.classList.add('is-new');
  }

  function onPile() {
    const s = g.s;
    if (!myTurn() || s.phase !== 'draw') return;
    const top = pileTop(s);
    if (!top) { toast('Die Ablage ist leer.'); return; }
    if (!canTakePile(s, viewer)) {
      toast(`Die ${cardName(top)} darfst du nur nehmen, wenn du damit sofort rauskommst (${s.minOut} Punkte). Zieh lieber vom Stapel.`, 4200);
      return;
    }
    hint = null;
    takePile(s, viewer);
    persist(); render();
    if (!s.out[viewer]) {
      const plan = comeOutPlan(s.hands[viewer], s.minOut, top);
      if (plan) coachOnce('took', { title: 'Jetzt rauskommen', text: `Mit ${cardName(top)} kannst du ${plan.value} Punkte auslegen. Wähle die Karten und tippe „Auslegen“ – die Glühbirne zeigt dir, wie.`, ms: 7000 });
    }
  }

  function onUndoTake() {
    const s = g.s;
    if (!myTurn() || !s.took || staged.length) return;
    undoTake(s, viewer);
    sel = new Set();
    persist(); render();
    toast('Karte zurückgelegt – zieh jetzt vom Stapel.');
  }

  function onMeld() {
    const s = g.s;
    if (!myTurn() || s.phase !== 'play') return;
    const cards = selCards();
    if (cards.length < 3) { toast('Eine Meldung braucht mindestens drei Karten. Einzelne Karten tippst du an eine liegende Meldung.', 3400); return; }
    const m = analyze(cards);
    if (!m) { toast(whyNotMeld(cards), 3800); return; }
    if (!s.out[viewer]) {
      const all = staged.concat([cards]);
      const r = checkNew(s, viewer, all);
      if (r.ok) return commitNew(all);
      if (r.short) {
        staged = all; sel = new Set();
        render();
        toast(`Vorgemerkt: ${describeMeld(m)} (${meldValue(m)} Punkte). Es fehlen noch ${r.short} Punkte.`, 3200);
        return;
      }
      toast(r.err, 3800);
      return;
    }
    commitNew([cards]);
  }

  function commitNew(groups) {
    const s = g.s;
    const first = !s.out[viewer];
    const r = meldNew(s, viewer, groups);
    if (!r.ok) { toast(r.err, 3800); return; }
    staged = []; sel = new Set(); hint = null;
    persist();
    if (s.phase === 'done') return roundOver();
    if (first) {
      toast('Du bist draußen!', 1800);
      coachOnce('out', { title: 'Du bist draußen', text: 'Ab jetzt darfst du Karten an alle Meldungen anlegen (Karte wählen, dann auf die Meldung tippen) und Joker gegen die passende Karte tauschen.', ms: 9000 });
    }
    render();
  }

  function onMeldTap(idx) {
    const s = g.s;
    const m = s.melds[idx];
    if (!m) return;
    const info = () => {
      const j = m.cards.map((c, i) => (isJoker(c) ? jokerStands(m, i) : null)).filter(Boolean);
      const jt = j.length ? ` Joker: ${j.map(x => (x.startsWith('any') ? 'eine beliebige fehlende Farbe' : cardName(x))).join(', ')}.` : '';
      toast(`${describeMeld(m)} (${meldValue(m)} Punkte).${jt}`, 3600);
    };
    if (!myTurn() || s.phase !== 'play' || !sel.size) { info(); return; }
    const cards = selCards();
    const r = checkAdd(s, viewer, idx, cards);
    if (!r.ok) { toast(r.err, 3600); return; }
    addTo(s, viewer, idx, cards);
    sel = new Set(); hint = null;
    persist();
    if (s.phase === 'done') return roundOver();
    if (r.swap !== undefined) {
      toast('Joker getauscht – er ist jetzt auf deiner Hand!', 2600);
      coachOnce('swap', { title: 'Joker erobert', text: 'Den Joker kannst du in einer neuen Meldung oder beim Anlegen verwenden. Auf der Hand zählt er am Ende 20 Strafpunkte – also bald loswerden.', ms: 8000 });
    }
    render();
  }

  function onDiscard() {
    const s = g.s;
    if (!myTurn() || s.phase !== 'play' || sel.size !== 1) return;
    const c = selCards()[0];
    if (staged.length) { staged = []; toast('Die vorgemerkten Meldungen haben nicht gereicht – die Karten bleiben auf der Hand.'); }
    const ok = canDiscard(s, viewer, c);
    if (!ok.ok) { toast(ok.err, 3800); return; }
    sel = new Set(); hint = null;
    discard(s, viewer, c);
    persist();
    if (s.phase === 'done') return roundOver();
    render();
    advance();
  }

  // ---------- Ablauf ----------
  async function advance() {
    const my = ++token;
    const alive = () => !ui.destroyed && my === token;
    const lv = ui.level();
    while (alive()) {
      const s = g.s;
      if (s.phase === 'done') { busy = false; roundOver(); return; }
      const p = s.turn;
      if (isHuman(p)) {
        if (p !== viewer) {
          busy = true; ui.coach.hide();
          if (multi()) {
            render();
            await handover(players()[p].name, 'Deine Karten werden gleich aufgedeckt. Die anderen schauen bitte weg.');
            if (!alive()) return;
          }
          viewer = p; sel = new Set(); staged = []; hint = null;
        }
        busy = false; render();
        return;
      }
      busy = true; render();
      await sleep(delay(700));
      if (!alive()) return;
      const d = aiDraw(s, p, lv);
      if (d.pile) { const c = pileTop(s); takePile(s, p); bubble(p, `nimmt ${cardName(c)}`, 1800); }
      else { drawStock(s, p); bubble(p, 'zieht', 900); }
      persist(); render();
      await sleep(delay(600));
      if (!alive()) return;
      const plan = aiPlan(s, p, lv);
      for (const a of plan) {
        if (s.phase === 'done') break;
        const wasOut = s.out[p];
        const r = a.kind === 'new' ? meldNew(s, p, a.groups) : addTo(s, p, a.idx, a.kind === 'swap' ? [a.card] : a.cards);
        if (!r.ok) break;
        bubble(p, a.kind === 'new' ? (wasOut ? 'legt aus' : 'kommt raus!') : a.kind === 'swap' ? 'tauscht einen Joker' : 'legt an', 1400);
        persist(); render();
        await sleep(delay(550));
        if (!alive()) return;
      }
      if (s.phase === 'done') continue;
      const dc = aiDiscard(s, p, lv);
      discard(s, p, dc.card);
      persist(); render();
    }
  }

  function coachOnce(key, msg) {
    if (!ui.coachOn() || g.tipsShown[key]) return;
    g.tipsShown[key] = true; persist();
    ui.coach.say(msg);
  }

  // ---------- Rundenende ----------
  function roundOver() {
    const s = g.s;
    busy = false;
    if (!s.counted && s.result) {
      s.counted = true;
      const r = s.result;
      const pens = r.penalties.map(v => (r.handRomme && !g.rules.handDouble ? v / 2 : v));
      r.final = pens;
      pens.forEach((v, p) => { g.totals[p] += v; });
      const maxT = Math.max(...g.totals);
      if (!g.target || maxT >= g.target) {
        g.over = true;
        const min = Math.min(...g.totals);
        g.winners = [...Array(N()).keys()].filter(p => g.totals[p] === min);
        if (humans().length === 1) addResult('romme', g.winners.includes(humans()[0]));
      }
      persist();
    }
    render();
    showResult();
  }

  async function showResult() {
    const s = g.s, r = s.result;
    if (!r) return;
    const pens = r.final || r.penalties;
    const rows = [...Array(N()).keys()].map(p => h('tr', { class: p === r.winner ? 'total' : '' },
      h('td', {}, nameOf(p)), h('td', { class: 'small' }, p === r.winner ? 'raus' : `${s.hands[p].length} Karten`),
      h('td', { class: 'num' }, p === r.winner ? '0' : '+' + pens[p]), h('td', { class: 'num' }, String(g.totals[p]))));
    let big = null;
    if (g.over) {
      const w = g.winners || [];
      const names = w.map(nameOf).join(' & ');
      const good = multi() || w.some(p => isHuman(p));
      big = h('p', { class: 'result-big ' + (good ? 'win' : 'lose') }, `${names} ${w.length > 1 ? 'gewinnen' : names === 'Du' ? 'gewinnst' : 'gewinnt'}!`);
    }
    const left = [...Array(N()).keys()].filter(p => p !== r.winner && s.hands[p].length);
    const content = h('div', { class: 'result' }, big,
      h('p', { html: `${isYou(r.winner) ? 'Du bist' : nameOf(r.winner) + ' ist'} ausgegangen.${r.handRomme ? ' <b>Hand-Rommé!</b> Alles auf einmal ausgelegt' + (g.rules.handDouble ? ' – die anderen zahlen doppelt.' : '.') : ''}` }),
      h('table', { class: 'result-table' }, h('tr', {}, h('td', {}, 'Spieler'), h('td', {}, ''), h('td', { class: 'num' }, 'Runde'), h('td', { class: 'num' }, 'Gesamt')), rows),
      ...left.slice(0, 3).map(p => h('div', {}, h('p', { class: 'small' }, `${nameOf(p)} hatte noch (${handPoints(s.hands[p])} Punkte):`), h('div', { class: 'cardline' }, sortHand(s.hands[p]).map(c => cardEl(c, { w: 34 }))))),
      h('p', { class: 'small' }, `Strafpunkte: Joker 20, Ass 11, Bilder 10, sonst der Zahlenwert.${g.target ? ` Wer ${g.target} erreicht, beendet das Spiel – es gewinnt, wer die wenigsten Strafpunkte hat.` : ''}`));
    const v = await dialog({ title: g.over ? 'Spielende' : `Runde ${g.round || 1} vorbei`, content, buttons: [{ label: 'Tisch ansehen', value: 'look' }, { label: g.over ? 'Neues Spiel' : 'Nächste Runde', value: 'next', primary: true }], dismissable: true });
    if (v === 'next') nextRound();
  }

  async function showScores() {
    await dialog({ title: 'Strafpunkte', content: h('div', {},
      h('table', { class: 'result-table' }, [...Array(N()).keys()].map(p => h('tr', { class: p === viewer ? 'total' : '' }, h('td', {}, nameOf(p)), h('td', { class: 'num' }, String(g.totals[p]))))),
      h('p', { class: 'small' }, g.target ? `Gespielt wird, bis jemand ${g.target} Strafpunkte hat. Wenige Punkte sind gut.` : 'Gespielt wird eine Runde.'),
      h('p', { class: 'small' }, 'Hausregeln: ' + (Object.keys(RULE_INFO).filter(k => g.rules && g.rules[k]).map(k => RULE_INFO[k].label).join(', ') || 'keine') + '.')),
    buttons: [{ label: 'OK', value: true, primary: true }], dismissable: true });
  }

  function nextRound() {
    ui.coach.hide();
    if (g.over) { g.over = false; g.totals = g.totals.map(() => 0); g.round = 0; }
    fresh(true);
    render();
    advance();
  }

  // ---------- Tipp ----------
  function tip() {
    const s = g.s;
    const me = viewer;
    if (!myTurn() || s.phase === 'done') { ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du am Zug bist.', ms: 2500 }); return; }
    if (s.phase === 'draw') {
      const d = aiDraw(s, me, 'schwer');
      hint = d.pile ? { pile: true } : { stock: true };
      render();
      ui.coach.say({ title: d.pile ? 'Nimm die Ablage' : 'Zieh vom Stapel', text: d.why || 'Die Ablagekarte bringt dir nichts – zieh lieber eine neue Karte.',
        actions: [{ label: 'Ausführen', primary: true, onClick: () => (d.pile ? onPile() : onStock()) }] });
      return;
    }
    staged = []; sel = new Set();
    const plan = aiPlan(s, me, 'schwer');
    if (plan.length) {
      const a = plan[0];
      if (a.kind === 'new') {
        hint = { cards: a.groups.flat() };
        render();
        const tot = a.groups.reduce((x, gr) => x + meldValue(analyze(gr)), 0);
        ui.coach.say({ title: s.out[me] ? 'Auslegen' : 'Du kannst rauskommen!', text: [
          `Lege ${a.groups.map(gr => describeMeld(analyze(gr))).join(' und ')} aus (${tot} Punkte).`,
          s.out[me] ? 'Jede ausgelegte Karte zählt am Ende nicht mehr als Strafpunkt.' : `Zum Rauskommen brauchst du ${s.minOut} Punkte – das reicht.`],
        actions: [{ label: 'Ausführen', primary: true, onClick: () => commitNew(a.groups) }] });
        return;
      }
      const card = a.kind === 'swap' ? a.card : a.cards[0];
      hint = { cards: [card], meld: a.idx };
      render();
      ui.coach.say({ title: a.kind === 'swap' ? 'Joker tauschen!' : 'Anlegen', text: a.kind === 'swap'
        ? `${cardName(card)} ersetzt den Joker in „${describeMeld(s.melds[a.idx])}“ – der Joker kommt auf deine Hand.`
        : `${cardName(card)} passt an „${describeMeld(s.melds[a.idx])}“.`,
      actions: [{ label: 'Ausführen', primary: true, onClick: () => {
        const r = addTo(s, me, a.idx, [card]);
        if (!r.ok) return;
        hint = null; persist();
        if (s.phase === 'done') roundOver(); else render();
      } }] });
      return;
    }
    const dc = aiDiscard(s, me, 'schwer');
    hint = { cards: [dc.card] };
    render();
    const outInfo = !s.out[me] ? ` Zum Rauskommen (${s.minOut} Punkte) reicht deine Hand noch nicht.` : '';
    ui.coach.say({ title: `Lege ${cardName(dc.card)} ab`, text: dc.why + outInfo, actions: [{ label: 'Ausführen', primary: true, onClick: () => {
      sel = new Set([hand().indexOf(dc.card)]);
      onDiscard();
    } }] });
  }

  // ---------- Menü ----------
  ui.onTip = tip;
  ui.onNew = () => setup(false);

  const ro = new ResizeObserver(() => renderHand());
  ro.observe(handEl);

  function welcome() {
    if (!multi()) coachOnce('welcome', { title: 'Willkommen beim Rommé', text: [
      'Sammle <b>Sätze</b> (3–4 gleiche Werte in verschiedenen Farben) und <b>Folgen</b> (mindestens drei aufeinanderfolgende Karten einer Farbe). Joker ersetzen jede Karte.',
      `Pro Zug: eine Karte ziehen, auslegen oder anlegen, eine Karte ablegen. Deine ersten Meldungen müssen zusammen ${g.s.minOut} Punkte haben. Wer zuerst keine Karten mehr hat, gewinnt die Runde.`], ms: 13000 });
  }

  async function resumeGame() {
    const p = isHuman(g.s.turn) ? g.s.turn : (humans()[0] ?? 0);
    if (multi()) {
      await handover(players()[p].name, 'Deine Karten werden gleich aufgedeckt. Die anderen schauen bitte weg.');
      if (ui.destroyed) return;
    }
    viewer = p; sel = new Set(); staged = []; hint = null; veiled = false;
    render(); advance(); welcome();
  }

  function targetRow(cur) {
    let val = cur;
    const seg = h('div', { class: 'seg' });
    const paint = () => seg.replaceChildren(...TARGETS.map(([v, l]) => h('button', { 'aria-pressed': String(v === val), onclick: () => { val = v; paint(); } }, l)));
    paint();
    return { el: h('div', {}, h('p', { class: 'field-label' }, 'Spiellänge (Strafpunkte)'), seg), value: () => val };
  }

  async function setup(entry) {
    const running = !!(g && g.s && !g.over);
    const form = rulesForm(RULE_INFO, (g && g.rules) || ui.option('rules', RULE_DEFAULTS));
    const tr = targetRow((g && g.target !== undefined) ? g.target : ui.option('target', 200));
    const extra = h('div', {}, h('div', { class: 'rules-form' }, tr.el), form.el);
    const pl = await choosePlayers({ title: entry ? 'Rommé – wer spielt?' : 'Neues Spiel – wer spielt?', min: 2, max: 4, current: players(), entry,
      resume: entry && running ? 'Weiterspielen' : null, resumeSub: entry && running ? `Runde ${g.round || 1}` : '',
      note: 'Zwei bis vier Spieler, Menschen und Computer gemischt – das iPhone wird reihum weitergegeben.', extra });
    if (pl === 'resume') { await resumeGame(); return; }
    if (!pl) { if (entry) location.hash = '#/'; return; }
    const rules = form.value();
    ui.setOption('rules', rules); ui.setOption('target', tr.value());
    token++; ui.coach.hide();
    veiled = false; g = null; fresh(false, pl, rules, tr.value()); render(); advance(); welcome();
  }

  if (g && g.s && !multi()) { viewer = humans()[0] ?? 0; render(); }
  setup(true);

  return () => { token++; ro.disconnect(); };
}
