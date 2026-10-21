// Kanaster – Oberfläche (zu viert mit Partnern oder zu zweit; Menschen und Computer gemischt)
import { h, dialog, toast, sleep } from '../../ui.js';
import { load, save, addResult, delay } from '../../store.js';
import { cardEl, fitHand } from '../../cards/render.js';
import { choosePlayers, handover } from '../../players.js';
import {
  newRound, sortHand, teamOf, pileTop, pileFrozen, frozenFor, minimum, canastas, isNaturalMeld, canGoOut,
  drawStock, pilePlans, takePile, meld, checkMelds, discard, canDiscard, isWild, isNatural, isBlack3, sumValue, value,
  aiDraw, aiMelds, aiGoOut, aiDiscard, RANK_NAME, RANK_ONE, cardName,
} from './engine.js';

const TARGET = 5000;
const ART = { A: 'das', K: 'den', Q: 'die', J: 'den', X: 'den' };
const ART1 = { A: 'Das', K: 'Der', Q: 'Die', J: 'Der', X: 'Der' };
const art = (c, nom) => (nom ? ART1 : ART)[c[0] === 'X' ? 'X' : c[1]] || (nom ? 'Die' : 'die');
const DEFAULTS = {
  4: [{ name: 'Du', human: true }, { name: 'Lotte', human: false }, { name: 'Karl', human: false }, { name: 'Hanne', human: false }],
  2: [{ name: 'Du', human: true }, { name: 'Lotte', human: false }],
};

export function mount(ui) {
  let g = load('save:kanaster');
  let sel = new Set();      // Indizes in der sortierten Hand
  let staged = [];          // Erstmeldung im Aufbau: [{cards}]
  let token = 0, busy = false;
  let hint = null;          // { stock?, pile?, cards?:[], meld?: rank }
  let viewer = 0;

  const N = () => g.s.n;
  const players = () => (g && g.players && g.players.length === N() ? g.players : DEFAULTS[N()]);
  const isHuman = p => !!players()[p].human;
  const humans = () => [...Array(N()).keys()].filter(isHuman);
  const multi = () => humans().length > 1;
  const isYou = p => !multi() && isHuman(p);
  const nameOf = p => (isYou(p) ? 'Du' : players()[p].name);
  const V = () => viewer;
  const myTeam = () => teamOf(viewer);
  const theirTeam = () => 1 - myTeam();
  const teamLabel = (t, long) => {
    const mem = [...Array(N()).keys()].filter(p => teamOf(p) === t);
    if (N() === 2) return nameOf(mem[0]);
    const names = mem.map(p => (p === viewer ? 'du' : nameOf(p)));
    if (t === myTeam()) return long ? `Wir (${names.sort((a, b) => (a === 'du' ? -1 : b === 'du' ? 1 : 0)).join(' & ')})` : 'Wir';
    return long ? `Sie (${names.join(' & ')})` : 'Sie';
  };

  function fresh(keepTotals, newPlayers) {
    const old = g;
    const n = newPlayers ? newPlayers.length : (old ? old.s.n : ui.option('players', 4));
    const totals = keepTotals && old && old.s.n === n ? old.s.totals : [0, 0];
    const dealer = old && keepTotals ? (old.s.dealer + 1) % n : n - 1;
    g = {
      s: newRound({ n, dealer, totals }),
      players: newPlayers || (old && old.players && old.players.length === n ? old.players : DEFAULTS[n]),
      round: keepTotals && old ? (old.round || 1) + 1 : 1, tipsShown: old ? old.tipsShown || {} : {}, over: null,
    };
    viewer = humans()[0] ?? 0;
    sel = new Set(); staged = []; hint = null;
    persist();
  }
  function persist() { save('save:kanaster', g); }

  // ---------- Aufbau ----------
  const felt = h('div', { class: 'felt can-felt' });
  const pills = h('div', { class: 'can-pills' });
  const oppRow = h('div', { class: 'can-players' });
  const theirZone = h('div', { class: 'can-team them' });
  const mid = h('div', { class: 'can-mid' });
  const ourZone = h('div', { class: 'can-team us' });
  const status = h('div', { class: 'statusline' });
  const actions = h('div', { class: 'action-row' });
  const handEl = h('div', { class: 'can-hand' });
  const scroll = h('div', { class: 'can-scroll' }, oppRow, theirZone, mid, ourZone);
  felt.append(pills, scroll, h('div', { class: 'can-hand-zone' }, status, actions, handEl));
  ui.stage.append(felt);
  ui.root.style.setProperty('--coach-bottom', '230px');

  // ---------- Hilfen ----------
  const myTurn = () => g.s.turn === viewer && isHuman(viewer) && !busy;
  const hand = () => sortHand(g.s.hands[viewer]);
  const selCards = () => { const hd = hand(); return [...sel].sort((a, b) => a - b).map(i => hd[i]); };
  const stagedCards = () => staged.flatMap(x => x.cards);
  function visibleHand() {
    const hd = hand();
    const rest = stagedCards().slice();
    return hd.map((c, i) => ({ c, i })).filter(({ c }) => { const k = rest.indexOf(c); if (k >= 0) { rest.splice(k, 1); return false; } return true; });
  }

  function meldEl(m, team, { pending = false } = {}) {
    const n = m.cards.length;
    const isCan = n >= 7;
    const nat = isNaturalMeld(m);
    const show = isCan ? [m.cards.find(isNatural) || m.cards[0]] : m.cards;
    const el = h('div', { class: 'meld' + (isCan ? ' canasta' + (nat ? ' natural' : '') : '') + (pending ? ' pending' : '') + (hint && hint.meld === m.rank && team === myTeam() ? ' is-hint' : ''), role: 'button', 'aria-label': `${n} ${RANK_NAME[m.rank]}${isCan ? (nat ? ', reine Canasta' : ', gemischte Canasta') : ''}` },
      show.map(c => cardEl(c, { w: 30 })),
      h('span', { class: 'cnt' }, isCan ? (nat ? 'Rein' : 'Gem.') + ' ' + n : String(n)));
    if (team === myTeam() && !pending) el.addEventListener('click', () => onMeldTap(m));
    return el;
  }

  function teamZone(team) {
    const s = g.s;
    const melds = s.melds[team];
    const r3 = s.red3[team];
    const pts = melds.reduce((a, m) => a + sumValue(m.cards), 0);
    const can = canastas(s, team).length;
    const head = h('div', { class: 'can-team-head' },
      h('span', {}, h('b', {}, teamLabel(team, true)), ` · ${can} Canasta${can === 1 ? '' : 's'} · ${pts} P.`),
      r3.length ? h('span', { class: 'red3-chip', title: 'Rote Dreien' }, `${r3.length} × rote 3`) : null);
    const list = h('div', { class: 'melds' });
    for (const m of melds) list.append(meldEl(m, team));
    if (team === myTeam()) for (const st of staged) list.append(meldEl({ rank: st.cards.find(isNatural)[1], cards: st.cards }, team, { pending: true }));
    if (!list.children.length) {
      const min = minimum(s, team);
      list.append(h('div', { class: 'meld empty-hint' }, team === myTeam() ? `Noch keine Meldung · Erstmeldung: ${min} Punkte` : `Noch keine Meldung (braucht ${min})`));
    }
    return [head, list];
  }

  // Solange der Startbildschirm offen ist und mehrere Menschen spielen, bleiben die Karten verdeckt.
  let veiled = true;
  function render() {
    if (!g || !g.s || (veiled && multi())) return;
    const s = g.s;
    const mt = myTeam(), ot = theirTeam();
    pills.replaceChildren(
      h('span', { class: 'trump-pill static' }, `Runde ${g.round || 1}`),
      h('button', { class: 'trump-pill static score', onclick: showScores }, h('b', {}, teamLabel(mt) + ' '), String(s.totals[mt]), ' : ', String(s.totals[ot]), h('b', {}, ' ' + teamLabel(ot))));
    const others = [...Array(N() - 1).keys()].map(k => (viewer + 1 + k) % N());
    oppRow.replaceChildren(...others.map(p => h('div', { class: 'can-player' + (s.turn === p && s.phase !== 'done' ? ' on' : '') + (teamOf(p) === mt ? ' partner' : '') },
      h('span', { class: 'turn-dot' }), h('b', {}, nameOf(p)), h('span', { class: 'cc', 'aria-label': `${s.hands[p].length} Karten` }, h('i', { class: 'mini-back' }), String(s.hands[p].length)), h('span', { class: 'bubble-slot', 'data-p': p }))));
    theirZone.replaceChildren(...teamZone(ot));
    ourZone.replaceChildren(...teamZone(mt));
    const myDraw = myTurn() && s.phase === 'draw';
    const top = pileTop(s);
    const frozen = pileFrozen(s);
    const stockEl = h('div', { class: 'pile-slot' + (myDraw && s.stock.length ? ' can-act' : '') + (hint && hint.stock ? ' is-hint' : ''), role: 'button', 'aria-label': 'Talon: Karte ziehen', onclick: onStock },
      h('div', { class: 'stack' }, s.stock.length ? cardEl(null, { faceDown: true }) : h('div', { class: 'card empty' })), h('span', {}, `Talon · ${s.stock.length}`));
    const under = s.pile.length > 1 ? s.pile.slice(0, -1).filter(isWild).slice(-1)[0] : null;
    const pileEl = h('div', { class: 'pile-slot' + (myDraw && pilePlans(s, viewer).length ? ' can-act' : '') + (hint && hint.pile ? ' is-hint' : ''), role: 'button', 'aria-label': 'Ablagestapel nehmen', onclick: () => onPile() },
      h('div', { class: 'stack' + (frozen ? ' frozen' : '') }, under ? cardEl(under, { cls: 'frozen-card' }) : null, top ? cardEl(top) : h('div', { class: 'card empty' })),
      h('span', {}, `Ablage · ${s.pile.length}${frozen ? ' · eingefroren' : ''}`));
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
    const hintSet = new Set(hint && hint.cards ? hint.cards : []);
    const hintUsed = [];
    const rowEls = [];
    for (let r = 0; r < rows; r++) {
      const part = vis.slice(r * per, (r + 1) * per);
      rowEls.push(h('div', { class: 'hand-row' }, part.map(({ c, i }) => {
        const el = cardEl(c, { w });
        if (sel.has(i)) el.classList.add('is-sel');
        if (hintSet.has(c) && hintUsed.filter(x => x === c).length < (hint.cards || []).filter(x => x === c).length) { el.classList.add('is-hint'); hintUsed.push(c); }
        if (myTurn() && g.s.phase === 'draw') el.classList.add('is-soft');
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
      txt = s.stock.length ? 'Zieh vom Talon oder nimm die Ablage.' : 'Der Talon ist leer – nimm die Ablage.';
      if (s.stock.length) acts.push(btn(s.drawN === 2 ? 'Zwei Karten ziehen' : 'Karte ziehen', onStock, true));
      acts.push(btn('Ablage nehmen', () => onPile(), !s.stock.length, !pilePlans(s, viewer).length));
    } else {
      const n = sel.size;
      const team = myTeam();
      if (!s.initial[team]) {
        const tot = sumValue(stagedCards());
        txt = staged.length ? `Erstmeldung: <b>${tot}</b> von ${minimum(s, team)} Punkten` : `Melde Karten (Erstmeldung ${minimum(s, team)}) oder wirf eine ab.`;
        if (staged.length) acts.push(btn('Zurück', () => { staged = []; sel = new Set(); render(); }));
      } else txt = n ? `${n} ${n === 1 ? 'Karte' : 'Karten'} gewählt – melden, an eine Meldung tippen oder abwerfen.` : 'Wähle Karten zum Melden oder eine zum Abwerfen.';
      acts.push(btn('Melden', onMeld, false, !n));
      acts.push(btn('Abwerfen', onDiscard, true, n !== 1));
    }
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
  function onCard(i) {
    const s = g.s;
    if (!myTurn() || s.phase !== 'meld') {
      if (myTurn() && s.phase === 'draw') toast('Zuerst ziehen: Talon oder Ablage.');
      return;
    }
    hint = null;
    if (sel.has(i)) sel.delete(i); else sel.add(i);
    render();
  }

  function onStock() {
    const s = g.s;
    if (!myTurn() || s.phase !== 'draw') return;
    if (!s.stock.length) { toast('Der Talon ist leer.'); return; }
    hint = null;
    const t = myTeam();
    const r3 = s.red3[t].length;
    const got = drawStock(s, viewer);
    persist();
    if (s.red3[t].length > r3) {
      toast(`Rote Drei! Sie kommt als Bonus (+100) auf den Tisch, du ziehst eine Ersatzkarte.`, 3200);
      coachOnce('red3', { title: 'Rote Drei', text: 'Rote Dreien zählen 100 Punkte (alle vier: 800). Aber Achtung: Hat euer Team am Ende nichts gemeldet, zählen sie minus.', ms: 8000 });
    }
    if (s.phase === 'done') return roundOver();
    render();
    if (got.length) flashNew(got);
  }

  function flashNew(cards) {
    const hd = hand();
    const want = cards.slice();
    const vis = visibleHand();
    const els = handEl.querySelectorAll('.card');
    hd.forEach((c, i) => { const k = want.indexOf(c); if (k >= 0) { want.splice(k, 1); const el = els[vis.findIndex(x => x.i === i)]; if (el) el.classList.add('is-new'); } });
  }

  async function onPile(confirm = true) {
    const s = g.s;
    if (!myTurn() || s.phase !== 'draw') return;
    const plans = pilePlans(s, viewer);
    if (!plans.length) { toast(whyNoPile(), 4200); return; }
    plans.sort((a, b) => (a.kind === 'wild') - (b.kind === 'wild'));
    const plan = plans[0];
    const top = pileTop(s);
    const desc = plan.kind === 'add' ? `${art(top, true)} ${cardName(top)} kommt an eure ${RANK_NAME[top[1]]}.`
      : `Du meldest ${art(top)} ${cardName(top)} mit ${plan.use.map(cardName).join(', ')}.`;
    const extra = plan.extra.length ? ` Für die Erstmeldung legst du außerdem aus: ${plan.extra.map(gr => gr.map(cardName).join(', ')).join(' / ')}.` : '';
    const ok = !confirm || await dialog({
      title: `Ablage nehmen (${s.pile.length} ${s.pile.length === 1 ? 'Karte' : 'Karten'})?`,
      content: h('div', {}, h('p', { html: desc + extra }), h('div', { class: 'cardline' }, [top, ...plan.use, ...plan.extra.flat()].map(c => cardEl(c)))),
      buttons: [{ label: 'Abbrechen', value: false }, { label: 'Nehmen', value: true, primary: true }],
    });
    if (!ok) return;
    hint = null; staged = []; sel = new Set();
    takePile(s, viewer, plan);
    persist();
    if (s.phase === 'done') return roundOver();
    render();
  }

  function whyNoPile() {
    const s = g.s;
    const top = pileTop(s);
    if (!top) return 'Die Ablage ist leer.';
    if (isWild(top)) return 'Oben liegt ein Joker oder eine Zwei – so kann niemand die Ablage nehmen.';
    if (isBlack3(top)) return 'Oben liegt eine schwarze Drei: Sie blockiert die Ablage für diesen Zug.';
    const team = myTeam();
    const r = RANK_NAME[top[1]];
    if (!s.initial[team]) return `Ihr habt noch keine Erstmeldung. Du brauchst zwei echte ${r} zur oberen Karte und zusammen mindestens ${minimum(s, team)} Punkte.`;
    if (pileFrozen(s)) return `Die Ablage ist eingefroren (ein Joker oder eine Zwei liegt darin). Du brauchst ein echtes Paar ${r}.`;
    return `Du brauchst zwei ${r} (oder eine ${RANK_ONE[top[1]]} und einen Joker bzw. eine Zwei) – oder eine eigene ${r}-Meldung.`;
  }

  function groupSelection(cards) {
    const nat = cards.filter(isNatural);
    const wild = cards.filter(isWild);
    const byRank = {};
    for (const c of nat) (byRank[c[1]] = byRank[c[1]] || []).push(c);
    const ranks = Object.keys(byRank);
    if (!ranks.length) return { err: 'Joker und Zweien allein sind keine Meldung. Tippe danach auf eine eurer Meldungen, um sie anzulegen.' };
    if (wild.length && ranks.length > 1) return { err: 'Bei mehreren Rängen weiß ich nicht, wohin die Joker sollen. Melde die Ränge einzeln.' };
    return { groups: ranks.map(r => ({ cards: byRank[r].concat(ranks.length === 1 ? wild : []) })) };
  }

  const plain = err => err.replace(/<[^>]+>/g, '');

  function onMeld() {
    const s = g.s;
    if (!myTurn() || s.phase !== 'meld' || !sel.size) return;
    const gs = groupSelection(selCards());
    if (gs.err) { toast(gs.err, 3600); return; }
    if (!s.initial[myTeam()]) {
      const all = staged.concat(gs.groups);
      const r = checkMelds(s, viewer, all);
      if (r.ok) { commitMelds(all); return; }
      if (r.short) {
        const single = checkMelds({ ...s, initial: [true, true] }, viewer, all);
        if (!single.ok) { toast(plain(single.err), 3800); return; }
        staged = all; sel = new Set();
        render();
        toast(`Vorgemerkt. Es fehlen noch ${r.short} Punkte für die Erstmeldung.`, 3000);
        return;
      }
      toast(plain(r.err), 3800);
      return;
    }
    const r = checkMelds(s, viewer, gs.groups);
    if (!r.ok) { toast(plain(r.err), 3800); return; }
    commitMelds(gs.groups);
  }

  function onMeldTap(m) {
    const s = g.s;
    if (!myTurn() || s.phase !== 'meld') return;
    if (!sel.size) { toast(`${m.cards.length} ${RANK_NAME[m.rank]}${m.cards.length >= 7 ? ' – eine Canasta' : `, noch ${7 - m.cards.length} bis zur Canasta`}.`); return; }
    const cards = selCards();
    const r = checkMelds(s, viewer, [{ cards, rank: m.rank }]);
    if (!r.ok) { toast(plain(r.err), 3800); return; }
    commitMelds([{ cards, rank: m.rank }]);
  }

  function commitMelds(groups) {
    const s = g.s;
    const t = myTeam();
    const before = canastas(s, t).length;
    const wasInitial = s.initial[t];
    const r = meld(s, viewer, groups);
    if (!r.ok) { toast(plain(r.err), 3800); return; }
    staged = []; sel = new Set(); hint = null;
    persist();
    if (s.phase === 'done') return roundOver();
    if (!wasInitial) toast('Erstmeldung geschafft!');
    if (canastas(s, t).length > before) {
      toast('Canasta! 🎉', 2200);
      coachOnce('canasta', { title: 'Eure erste Canasta', text: s.need === 1 ? 'Jetzt dürft ihr ausgehen. Wer zuerst alle Karten los ist, bekommt 100 Punkte – aber die Karten auf der Hand des Partners zählen dann minus.' : 'Zu zweit braucht ihr zwei Canastas, um auszugehen.', ms: 8000 });
    }
    render();
  }

  function onDiscard() {
    const s = g.s;
    if (!myTurn() || s.phase !== 'meld' || sel.size !== 1) return;
    const c = selCards()[0];
    if (staged.length) { staged = []; toast('Die vorgemerkte Erstmeldung hat nicht gereicht – die Karten bleiben auf der Hand.'); }
    if (!canDiscard(s, viewer, c)) { toast(s.need === 1 ? 'Mit der letzten Karte gehst du aus – dafür braucht ihr erst eine Canasta.' : 'Zum Ausgehen braucht ihr zwei Canastas.', 3600); return; }
    const before = pileFrozen(s);
    sel = new Set(); hint = null;
    discard(s, viewer, c);
    persist();
    if (s.phase === 'done') return roundOver();
    if (!before && pileFrozen(s)) coachOnce('freeze', { title: 'Ablage eingefroren', text: 'Mit einer Zwei oder einem Joker auf der Ablage ist sie eingefroren: Wer sie nehmen will, braucht jetzt ein echtes Paar zur obersten Karte.', ms: 8000 });
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
        busy = false; render(); maybeCoachDraw();
        return;
      }
      busy = true; render();
      await sleep(delay(700));
      if (!alive()) return;
      let d = aiDraw(s, p, lv);
      if (!d.take && !s.stock.length) { const pl = pilePlans(s, p); if (pl.length) d = { take: pl[0] }; }
      const r3 = s.red3[teamOf(p)].length;
      if (d.take) {
        const n = s.pile.length;
        takePile(s, p, d.take);
        bubble(p, `nimmt ${n} Karten!`, 2200);
        if (n >= 8 && teamOf(p) !== myTeam() && ui.coachOn()) coachOnce('bigpile', { title: 'Große Ablage weg', text: 'Eine große Ablage ist viel wert. Halte die Ablage klein oder friere sie mit einer Zwei ein, wenn die Gegner passende Paare haben könnten.', ms: 8000 });
      } else if (s.stock.length) {
        drawStock(s, p);
        bubble(p, s.drawN === 2 ? 'zieht zwei' : 'zieht', 1000);
      }
      if (s.red3[teamOf(p)].length > r3) toast(`${nameOf(p)} legt eine rote Drei aus (+100).`);
      persist(); render();
      if (s.phase === 'done') continue;
      await sleep(delay(650));
      if (!alive()) return;
      const out = aiGoOut(s, p);
      if (out) {
        if (out.groups.length) meld(s, p, out.groups);
        persist(); render();
        if (s.phase !== 'done' && out.discard) {
          await sleep(delay(500));
          if (!alive()) return;
          discard(s, p, out.discard);
        }
        bubble(p, 'geht aus!', 2500);
        persist(); render();
        continue;
      }
      const m = aiMelds(s, p, lv);
      if (m.groups.length) {
        meld(s, p, m.groups);
        bubble(p, 'meldet', 1200);
        persist(); render();
        if (s.phase === 'done') continue;
        await sleep(delay(650));
        if (!alive()) return;
      }
      const dc = aiDiscard(s, p, lv);
      discard(s, p, dc.card);
      persist(); render();
    }
  }

  function maybeCoachDraw() {
    const s = g.s;
    if (!ui.coachOn() || s.phase !== 'draw' || !myTurn()) return;
    const pl = pilePlans(s, viewer);
    if (pl.length && s.pile.length >= 3) ui.coach.say({ title: 'Die Ablage wartet', text: `Du könntest die Ablage nehmen – ${s.pile.length} Karten. Viele Karten heißt: mehr Meldungen und schneller zur Canasta.`, ms: 6000 });
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
    if (!s.counted) {
      s.counted = true;
      if (s.totals[0] >= TARGET || s.totals[1] >= TARGET) {
        g.over = true;
        g.winTeam = s.totals[0] >= s.totals[1] ? 0 : 1;
        if (humans().length === 1) addResult('kanaster', g.winTeam === teamOf(humans()[0]));
      }
      persist();
    }
    render();
    showResult();
  }

  async function showResult() {
    const s = g.s;
    if (!s.result) return;
    const mt = myTeam(), ot = theirTeam();
    const col = r => h('div', { class: 'res-col' },
      h('h4', {}, teamLabel(r.team)),
      h('table', { class: 'result-table' }, r.lines.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', { class: 'num' }, (v > 0 ? '+' : '') + v))),
        h('tr', { class: 'total' }, h('td', {}, 'Runde'), h('td', { class: 'num' }, String(r.total)))));
    const how = s.goneOut >= 0 ? `${isYou(s.goneOut) ? 'Du bist' : nameOf(s.goneOut) + ' ist'} ausgegangen.` : 'Der Talon ist aufgebraucht.';
    let title = 'Rundenende', big = null;
    if (g.over) {
      if (g.winTeam === undefined) g.winTeam = s.totals[0] >= s.totals[1] ? 0 : 1;
      const w = g.winTeam;
      const names = [...Array(N()).keys()].filter(p => teamOf(p) === w).map(nameOf).join(' & ');
      const verb = names.includes('&') ? 'haben' : names === 'Du' ? 'hast' : 'hat';
      title = multi() ? `${names} ${names.includes('&') ? 'gewinnen' : 'gewinnt'}` : (w === mt ? 'Spiel gewonnen!' : 'Spiel verloren');
      big = h('p', { class: 'result-big ' + (multi() || w === mt ? 'win' : 'lose') }, `${names} ${verb} ${TARGET} Punkte erreicht!`);
    }
    const content = h('div', { class: 'result' }, big, h('p', {}, how),
      h('div', { class: 'res-cols' }, col(s.result[mt]), col(s.result[ot])),
      h('p', { html: `Gesamt: ${teamLabel(mt)} <b>${s.totals[mt]}</b> : <b>${s.totals[ot]}</b> ${teamLabel(ot)} (Ziel ${TARGET})` }));
    const v = await dialog({ title, content, buttons: [{ label: 'Tisch ansehen', value: 'look' }, { label: g.over ? 'Neues Spiel' : 'Nächste Runde', value: 'next', primary: true }], dismissable: true });
    if (v === 'next') nextRound();
  }

  async function showScores() {
    const s = g.s;
    const mt = myTeam(), ot = theirTeam();
    await dialog({ title: 'Punktestand', content: h('div', {},
      h('table', { class: 'result-table' },
        h('tr', {}, h('td', {}, teamLabel(mt, true)), h('td', { class: 'num' }, String(s.totals[mt]))),
        h('tr', {}, h('td', {}, teamLabel(ot, true)), h('td', { class: 'num' }, String(s.totals[ot])))),
      h('p', { class: 'small' }, `Gespielt wird bis ${TARGET}. Eure nächste Erstmeldung braucht ${minimum(s, mt)} Punkte.`)),
    buttons: [{ label: 'OK', value: true, primary: true }], dismissable: true });
  }

  function nextRound() {
    ui.coach.hide();
    if (g.over) { g.over = null; g.s.totals = [0, 0]; g.round = 0; }
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
      hint = d.take ? { pile: true } : { stock: true };
      render();
      ui.coach.say({ title: d.take ? 'Nimm die Ablage' : 'Zieh vom Talon', text: d.why || 'Hier lohnt sich die Ablage nicht – zieh lieber vom Talon.',
        actions: [{ label: 'Ausführen', primary: true, onClick: () => (d.take ? onPile(false) : onStock()) }] });
      return;
    }
    staged = []; sel = new Set();
    const out = aiGoOut(s, me);
    if (out) {
      hint = { cards: out.groups.flatMap(x => x.cards) };
      render();
      ui.coach.say({ title: 'Du kannst ausgehen!', text: 'Melde alle Karten (die letzte darfst du abwerfen). Ausgehen bringt 100 Punkte und beendet die Runde.', actions: [{ label: 'Ausführen', primary: true, onClick: () => {
        if (out.groups.length) { const r = meld(s, me, out.groups); if (!r.ok) return; }
        if (s.phase !== 'done' && out.discard) discard(s, me, out.discard);
        persist();
        if (s.phase === 'done') roundOver(); else { render(); advance(); }
      } }] });
      return;
    }
    const m = aiMelds(s, me, 'schwer');
    if (m.groups.length) {
      hint = { cards: m.groups.flatMap(x => x.cards), meld: m.groups.find(x => x.rank && s.melds[myTeam()].some(mm => mm.rank === x.rank))?.rank };
      render();
      ui.coach.say({ title: 'Melden', text: m.why.slice(0, 3), actions: [{ label: 'Ausführen', primary: true, onClick: () => commitMelds(m.groups) }] });
      return;
    }
    const dc = aiDiscard(s, me, 'schwer');
    hint = { cards: [dc.card] };
    render();
    const minInfo = !s.initial[myTeam()] ? ` Für eine Erstmeldung (${minimum(s, myTeam())} Punkte) reicht deine Hand noch nicht.` : '';
    ui.coach.say({ title: `Wirf ${cardName(dc.card)} ab`, text: dc.why + minInfo, actions: [{ label: 'Ausführen', primary: true, onClick: () => {
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
    if (!multi()) coachOnce('welcome', { title: 'Willkommen beim Kanaster', text: [
      `Sammelt Karten gleichen Rangs und meldet sie. Sieben gleiche sind eine <b>Canasta</b> – erst mit ${g.s.need === 1 ? 'einer' : 'zwei'} Canasta${g.s.need === 1 ? '' : 's'} darf man ausgehen.`,
      'Joker und Zweien sind Joker. Pro Zug: ziehen (oder die Ablage nehmen), melden, eine Karte abwerfen. Mit Freunden spielen: Menü → „Neues Spiel“.'], ms: 12000 });
  }

  // Weiterspielen: bei mehreren Menschen erst das iPhone übergeben, dann aufdecken.
  async function resumeGame() {
    const p = isHuman(g.s.turn) ? g.s.turn : (humans()[0] ?? 0);
    if (multi()) {
      await handover(players()[p].name, 'Deine Karten werden gleich aufgedeckt. Die anderen schauen bitte weg.');
      if (ui.destroyed) return;
    }
    viewer = p; sel = new Set(); staged = []; hint = null; veiled = false;
    render(); advance(); welcome();
  }

  async function setup(entry) {
    const running = !!(g && g.s && !g.over);
    for (;;) {
      const n0 = g && g.s ? g.s.n : ui.option('players', 4);
      const resume = entry && running;
      const r = await dialog({
        title: entry ? 'Kanaster – wie wollt ihr spielen?' : 'Neues Spiel',
        body: resume ? '' : 'Wie viele spielen mit? Der Punktestand beginnt bei 0.',
        layout: 'list', dismissable: !entry, buttons: [
          ...(resume ? [{ label: 'Weiterspielen', sub: `Runde ${g.round || 1} · Stand ${g.s.totals[teamOf(viewer)]} : ${g.s.totals[1 - teamOf(viewer)]}`, value: 'resume', primary: true }] : []),
          { label: resume ? 'Neu zu viert' : 'Zu viert', sub: 'zwei Teams mit Partner', value: 4, primary: !resume && n0 === 4 },
          { label: resume ? 'Neu zu zweit' : 'Zu zweit', sub: resume ? 'je 15 Karten' : 'je 15 Karten, zwei Canastas zum Ausgehen', value: 2, primary: !resume && n0 === 2 },
          { label: entry ? 'Zur Sammlung' : 'Abbrechen', value: null, quiet: true }] });
      if (r === 'resume') { await resumeGame(); return; }
      if (!r) { if (entry) location.hash = '#/'; return; }
      const cur = g && g.players && g.players.length === r ? g.players : DEFAULTS[r];
      const pl = await choosePlayers({ title: r === 4 ? 'Kanaster zu viert' : 'Kanaster zu zweit', min: r, max: r, current: cur,
        note: r === 4 ? 'Platz 1 & 3 spielen gegen Platz 2 & 4. Freie Plätze übernimmt der Computer.' : 'Zu zweit: Mensch gegen Computer oder zwei Menschen an einem iPhone.' });
      if (!pl) { if (entry) continue; return; }   // zurück zur Auswahl
      ui.setOption('players', r);
      token++; ui.coach.hide();
      veiled = false; g = null; fresh(false, pl); render(); advance(); welcome();
      return;
    }
  }

  // Hinter dem Startbildschirm den Tisch zeigen – aber keine Karten, wenn mehrere Menschen spielen.
  if (g && g.s && !multi()) { viewer = humans()[0] ?? 0; render(); }
  setup(true);

  return () => { token++; ro.disconnect(); };
}
