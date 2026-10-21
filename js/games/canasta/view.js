// Kanaster – Oberfläche
import { h, dialog, toast, sleep } from '../../ui.js';
import { load, save, addResult, delay } from '../../store.js';
import { cardEl, fitHand } from '../../cards/render.js';
import {
  newRound, sortHand, teamOf, pileTop, pileFrozen, frozenFor, minimum, canastas, isNaturalMeld, canGoOut,
  drawStock, pilePlans, takePile, meld, checkMelds, discard, canDiscard, isWild, isNatural, isBlack3, sumValue, value,
  aiDraw, aiMelds, aiGoOut, aiDiscard, RANK_NAME, RANK_ONE, cardName,
} from './engine.js';

const TARGET = 5000;
const ART = { A: 'das', K: 'den', Q: 'die', J: 'den', X: 'den' };
const ART1 = { A: 'Das', K: 'Der', Q: 'Die', J: 'Der', X: 'Der' };
const art = (c, nom) => (nom ? ART1 : ART)[c[0] === 'X' ? 'X' : c[1]] || (nom ? 'Die' : 'die');

export function mount(ui) {
  let g = load('save:kanaster');
  let sel = new Set();      // Indizes in der sortierten Hand
  let staged = [];          // Erstmeldung im Aufbau: [{cards}]
  let token = 0, busy = false;
  let hint = null;          // { stock?, pile?, cards?:[], meld?: rank }

  const N = () => g.s.n;
  const NAMES4 = ['Du', 'Lotte', 'Karl', 'Hanne'];
  const NAMES2 = ['Du', 'Lotte'];
  const nameOf = p => (N() === 4 ? NAMES4 : NAMES2)[p];

  function fresh(keepTotals) {
    const old = g;
    const n = ui.option('players', 4);
    const totals = keepTotals && old && old.s.n === n ? old.s.totals : [0, 0];
    const dealer = old ? (old.s.dealer + 1) % n : n - 1;
    g = { s: newRound({ n, dealer, totals }), round: keepTotals && old ? (old.round || 1) + 1 : 1, tipsShown: old ? old.tipsShown || {} : {}, over: null };
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
  const hand = () => sortHand(g.s.hands[0]);
  const selCards = () => { const hd = hand(); return [...sel].sort((a, b) => a - b).map(i => hd[i]); };
  const stagedCards = () => staged.flatMap(x => x.cards);
  // Hand ohne vorgemerkte Erstmeldung
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
    const el = h('div', { class: 'meld' + (isCan ? ' canasta' + (nat ? ' natural' : '') : '') + (pending ? ' pending' : '') + (hint && hint.meld === m.rank && team === 0 ? ' is-hint' : ''), role: 'button', 'aria-label': `${n} ${RANK_NAME[m.rank]}${isCan ? (nat ? ', reine Canasta' : ', gemischte Canasta') : ''}` },
      show.map(c => cardEl(c, { w: 30 })),
      h('span', { class: 'cnt' }, isCan ? (nat ? 'Rein' : 'Gem.') + ' ' + n : String(n)));
    if (team === myTeam() && !pending) el.addEventListener('click', () => onMeldTap(m));
    return el;
  }

  const myTeam = () => 0;

  function teamZone(team) {
    const s = g.s;
    const melds = s.melds[team];
    const r3 = s.red3[team];
    const label = team === 0 ? (N() === 4 ? 'Wir (du & Karl)' : 'Du') : (N() === 4 ? 'Sie (Lotte & Hanne)' : 'Lotte');
    const pts = melds.reduce((a, m) => a + sumValue(m.cards), 0);
    const can = canastas(s, team).length;
    const head = h('div', { class: 'can-team-head' },
      h('span', {}, h('b', {}, label), ` · ${can} Canasta${can === 1 ? '' : 's'} · ${pts} P.`),
      r3.length ? h('span', { class: 'red3-chip', title: 'Rote Dreien' }, `${r3.length} × rote 3`) : null);
    const list = h('div', { class: 'melds' });
    for (const m of melds) list.append(meldEl(m, team));
    if (team === 0) for (const st of staged) list.append(meldEl({ rank: st.cards.find(isNatural)[1], cards: st.cards }, 0, { pending: true }));
    if (!list.children.length) {
      const min = minimum(s, team);
      list.append(h('div', { class: 'meld empty-hint' }, team === 0 ? `Noch keine Meldung · Erstmeldung: ${min} Punkte` : `Noch keine Meldung (braucht ${min})`));
    }
    return [head, list];
  }

  function render() {
    const s = g.s;
    // Kopf
    pills.replaceChildren(
      h('span', { class: 'trump-pill static' }, `Runde ${g.round || 1}`),
      h('button', { class: 'trump-pill static score', onclick: showScores }, h('b', {}, N() === 4 ? 'Wir ' : 'Du '), String(s.totals[0]), ' : ', String(s.totals[1]), h('b', {}, N() === 4 ? ' Sie' : ' Lotte')));
    // Mitspieler
    const others = N() === 4 ? [1, 2, 3] : [1];
    oppRow.replaceChildren(...others.map(p => h('div', { class: 'can-player' + (s.turn === p && s.phase !== 'done' ? ' on' : '') + (teamOf(p) === 0 ? ' partner' : '') },
      h('span', { class: 'turn-dot' }), h('b', {}, nameOf(p)), h('span', { class: 'cc', 'aria-label': `${s.hands[p].length} Karten` }, h('i', { class: 'mini-back' }), String(s.hands[p].length)), h('span', { class: 'bubble-slot', 'data-p': p }))));
    theirZone.replaceChildren(...teamZone(1));
    ourZone.replaceChildren(...teamZone(0));
    // Mitte: Talon und Ablage
    const myDraw = s.turn === 0 && s.phase === 'draw' && !busy;
    const top = pileTop(s);
    const frozen = pileFrozen(s);
    const stockEl = h('div', { class: 'pile-slot' + (myDraw && s.stock.length ? ' can-act' : '') + (hint && hint.stock ? ' is-hint' : ''), role: 'button', 'aria-label': 'Talon: Karte ziehen', onclick: onStock },
      h('div', { class: 'stack' }, s.stock.length ? cardEl(null, { faceDown: true }) : h('div', { class: 'card empty' })), h('span', {}, `Talon · ${s.stock.length}`));
    const under = s.pile.length > 1 ? s.pile.slice(0, -1).filter(isWild).slice(-1)[0] : null;
    const pileEl = h('div', { class: 'pile-slot' + (myDraw && pilePlans(s, 0).length ? ' can-act' : '') + (hint && hint.pile ? ' is-hint' : ''), role: 'button', 'aria-label': 'Ablagestapel nehmen', onclick: () => onPile() },
      h('div', { class: 'stack' + (frozen ? ' frozen' : '') }, under ? cardEl(under, { cls: 'frozen-card' }) : null, top ? cardEl(top) : h('div', { class: 'card empty' })),
      h('span', {}, `Ablage · ${s.pile.length}${frozen ? ' · eingefroren' : ''}`));
    mid.replaceChildren(stockEl, pileEl);
    renderHand();
    renderActions();
    ui.setSubtitle(`Computer ${ui.level()}`);
  }

  function renderHand() {
    const vis = visibleHand();
    const avail = Math.max(260, (handEl.clientWidth || 390) - 20);
    const rows = vis.length > 15 ? 2 : 1;
    const per = Math.ceil(vis.length / rows);
    const { w, ov } = fitHand(per, avail, 62, 24);
    handEl.style.setProperty('--hcw', w + 'px');
    handEl.style.setProperty('--ov', ov + 'px');
    const myMeld = g.s.turn === 0 && g.s.phase === 'meld';
    const hintSet = new Set(hint && hint.cards ? hint.cards : []);
    const hintUsed = [];
    const rowEls = [];
    for (let r = 0; r < rows; r++) {
      const part = vis.slice(r * per, (r + 1) * per);
      rowEls.push(h('div', { class: 'hand-row' }, part.map(({ c, i }) => {
        const el = cardEl(c, { w });
        if (sel.has(i)) el.classList.add('is-sel');
        if (hintSet.has(c) && hintUsed.filter(x => x === c).length < (hint.cards || []).filter(x => x === c).length) { el.classList.add('is-hint'); hintUsed.push(c); }
        if (!myMeld && g.s.turn === 0 && g.s.phase === 'draw') el.classList.add('is-soft');
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
    } else if (s.turn !== 0) {
      txt = `${nameOf(s.turn)} ist dran …`;
    } else if (s.phase === 'draw') {
      txt = s.stock.length ? 'Zieh vom Talon oder nimm die Ablage.' : 'Der Talon ist leer – nimm die Ablage.';
      if (s.stock.length) acts.push(btn(s.drawN === 2 ? 'Zwei Karten ziehen' : 'Karte ziehen', onStock, true));
      acts.push(btn('Ablage nehmen', () => onPile(), !s.stock.length, !pilePlans(s, 0).length));
    } else {
      const n = sel.size;
      const team = 0;
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
    const slot = oppRow.querySelector(`.bubble-slot[data-p="${p}"]`);
    if (!slot) return;
    slot.replaceChildren(h('span', { class: 'bubble' }, text));
    setTimeout(() => { if (slot.isConnected) slot.replaceChildren(); }, ms);
  }

  // ---------- Eingaben ----------
  function onCard(i) {
    const s = g.s;
    if (busy || s.turn !== 0 || s.phase !== 'meld') {
      if (s.turn === 0 && s.phase === 'draw') toast('Zuerst ziehen: Talon oder Ablage.');
      return;
    }
    hint = null;
    if (sel.has(i)) sel.delete(i); else sel.add(i);
    render();
  }

  function onStock() {
    const s = g.s;
    if (busy || s.turn !== 0 || s.phase !== 'draw') return;
    if (!s.stock.length) { toast('Der Talon ist leer.'); return; }
    hint = null;
    const r3 = s.red3[0].length;
    const got = drawStock(s, 0);
    persist();
    if (s.red3[0].length > r3) {
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
    hd.forEach((c, i) => { const k = want.indexOf(c); if (k >= 0) { want.splice(k, 1); const el = handEl.querySelectorAll('.card')[visibleHand().findIndex(x => x.i === i)]; if (el) el.classList.add('is-new'); } });
  }

  async function onPile(confirm = true) {
    const s = g.s;
    if (busy || s.turn !== 0 || s.phase !== 'draw') return;
    const plans = pilePlans(s, 0);
    if (!plans.length) { toast(whyNoPile(), 4200); return; }
    plans.sort((a, b) => (a.kind === 'wild') - (b.kind === 'wild'));
    let plan = plans[0];
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
    takePile(s, 0, plan);
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
    const team = 0;
    const r = RANK_NAME[top[1]];
    if (!s.initial[team]) return `Ihr habt noch keine Erstmeldung. Du brauchst zwei echte ${r} zur oberen Karte und zusammen mindestens ${minimum(s, team)} Punkte.`;
    if (pileFrozen(s)) return `Die Ablage ist eingefroren (ein Joker oder eine Zwei liegt darin). Du brauchst ein echtes Paar ${r}.`;
    return `Du brauchst zwei ${r} (oder eine ${RANK_ONE[top[1]]} und einen Joker bzw. eine Zwei) – oder eine eigene ${r}-Meldung.`;
  }

  function groupSelection(cards, targetRank) {
    const nat = cards.filter(isNatural);
    const wild = cards.filter(isWild);
    if (targetRank) return { groups: [{ cards, rank: targetRank }] };
    const byRank = {};
    for (const c of nat) (byRank[c[1]] = byRank[c[1]] || []).push(c);
    const ranks = Object.keys(byRank);
    if (!ranks.length) return { err: 'Joker und Zweien allein sind keine Meldung. Tippe danach auf eine eurer Meldungen, um sie anzulegen.' };
    if (wild.length && ranks.length > 1) return { err: 'Bei mehreren Rängen weiß ich nicht, wohin die Joker sollen. Melde die Ränge einzeln.' };
    const groups = ranks.map(r => ({ cards: byRank[r].concat(ranks.length === 1 ? wild : []) }));
    return { groups };
  }

  function onMeld() {
    const s = g.s;
    if (busy || s.turn !== 0 || s.phase !== 'meld' || !sel.size) return;
    const cards = selCards();
    const gs = groupSelection(cards);
    if (gs.err) { toast(gs.err, 3600); return; }
    if (!s.initial[0]) {
      // Erstmeldung schrittweise aufbauen
      const all = staged.concat(gs.groups);
      const r = checkMelds(s, 0, all);
      if (r.ok) { commitMelds(all); return; }
      if (r.short) {
        // nur die Mindestpunktzahl fehlt: vormerken
        const single = checkMelds({ ...s, initial: [true, true] }, 0, all);
        if (!single.ok) { toast(single.err.replace(/<[^>]+>/g, ''), 3800); return; }
        staged = all; sel = new Set();
        render();
        toast(`Vorgemerkt. Es fehlen noch ${r.short} Punkte für die Erstmeldung.`, 3000);
        return;
      }
      toast(r.err.replace(/<[^>]+>/g, ''), 3800);
      return;
    }
    const r = checkMelds(s, 0, gs.groups);
    if (!r.ok) { toast(r.err.replace(/<[^>]+>/g, ''), 3800); return; }
    commitMelds(gs.groups);
  }

  function onMeldTap(m) {
    const s = g.s;
    if (busy || s.turn !== 0 || s.phase !== 'meld') return;
    if (!sel.size) { toast(`${m.cards.length} ${RANK_NAME[m.rank]}${m.cards.length >= 7 ? ' – eine Canasta' : `, noch ${7 - m.cards.length} bis zur Canasta`}.`); return; }
    const cards = selCards();
    const r = checkMelds(s, 0, [{ cards, rank: m.rank }]);
    if (!r.ok) { toast(r.err.replace(/<[^>]+>/g, ''), 3800); return; }
    commitMelds([{ cards, rank: m.rank }]);
  }

  function commitMelds(groups) {
    const s = g.s;
    const before = canastas(s, 0).length;
    const wasInitial = s.initial[0];
    const r = meld(s, 0, groups);
    if (!r.ok) { toast(r.err.replace(/<[^>]+>/g, ''), 3800); return; }
    staged = []; sel = new Set(); hint = null;
    persist();
    if (s.phase === 'done') return roundOver();
    if (!wasInitial) toast('Erstmeldung geschafft!');
    if (canastas(s, 0).length > before) {
      toast('Canasta! 🎉', 2200);
      coachOnce('canasta', { title: 'Eure erste Canasta', text: s.need === 1 ? 'Jetzt dürft ihr ausgehen. Wer zuerst alle Karten los ist, bekommt 100 Punkte – aber die Karten auf der Hand des Partners zählen dann minus.' : 'Zu zweit braucht ihr zwei Canastas, um auszugehen.', ms: 8000 });
    }
    render();
  }

  function onDiscard() {
    const s = g.s;
    if (busy || s.turn !== 0 || s.phase !== 'meld' || sel.size !== 1) return;
    const c = selCards()[0];
    if (staged.length) { staged = []; toast('Die vorgemerkte Erstmeldung hat nicht gereicht – die Karten bleiben auf der Hand.'); }
    if (!canDiscard(s, 0, c)) { toast(s.need === 1 ? 'Mit der letzten Karte gehst du aus – dafür braucht ihr erst eine Canasta.' : 'Zum Ausgehen braucht ihr zwei Canastas.', 3600); return; }
    const before = pileFrozen(s);
    sel = new Set(); hint = null;
    discard(s, 0, c);
    persist();
    if (s.phase === 'done') return roundOver();
    if (!before && pileFrozen(s)) coachOnce('freeze', { title: 'Ablage eingefroren', text: 'Mit einer Zwei oder einem Joker auf der Ablage ist sie eingefroren: Wer sie nehmen will, braucht jetzt ein echtes Paar zur obersten Karte.', ms: 8000 });
    render();
    advance();
  }

  // ---------- Computer ----------
  async function advance() {
    const my = ++token;
    const alive = () => !ui.destroyed && my === token;
    const lv = ui.level();
    while (alive()) {
      const s = g.s;
      if (s.phase === 'done') { busy = false; roundOver(); return; }
      if (s.turn === 0) { busy = false; render(); maybeCoachDraw(); return; }
      busy = true; render();
      const p = s.turn;
      await sleep(delay(700));
      if (!alive()) return;
      let d = aiDraw(s, p, lv);
      if (!d.take && !s.stock.length) { const pl = pilePlans(s, p); if (pl.length) d = { take: pl[0] }; }
      const r3 = s.red3[teamOf(p)].length;
      if (d.take) {
        const n = s.pile.length;
        takePile(s, p, d.take);
        bubble(p, `nimmt ${n} Karten!`, 2200);
        if (n >= 8 && teamOf(p) === 1 && ui.coachOn()) coachOnce('bigpile', { title: 'Große Ablage weg', text: 'Eine große Ablage ist viel wert. Halte die Ablage klein oder friere sie mit einer Zwei ein, wenn die Gegner passende Paare haben könnten.', ms: 8000 });
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
    if (!ui.coachOn() || s.phase !== 'draw' || s.turn !== 0) return;
    const pl = pilePlans(s, 0);
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
        g.over = s.totals[0] >= s.totals[1] ? 'win' : 'lose';
        addResult('kanaster', g.over === 'win');
      }
      persist();
    }
    render();
    showResult();
  }

  async function showResult() {
    const s = g.s;
    if (!s.result) return;
    const col = r => h('div', { class: 'res-col' },
      h('h4', {}, r.team === 0 ? (N() === 4 ? 'Wir' : 'Du') : (N() === 4 ? 'Sie' : 'Lotte')),
      h('table', { class: 'result-table' }, r.lines.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', { class: 'num' }, (v > 0 ? '+' : '') + v))),
        h('tr', { class: 'total' }, h('td', {}, 'Runde'), h('td', { class: 'num' }, String(r.total)))));
    const how = s.goneOut >= 0 ? `${s.goneOut === 0 ? 'Du bist' : nameOf(s.goneOut) + ' ist'} ausgegangen.` : 'Der Talon ist aufgebraucht.';
    const title = g.over ? (g.over === 'win' ? 'Spiel gewonnen!' : 'Spiel verloren') : 'Rundenende';
    const content = h('div', { class: 'result' },
      g.over ? h('p', { class: 'result-big ' + (g.over === 'win' ? 'win' : 'lose') }, g.over === 'win' ? `${N() === 4 ? 'Ihr habt' : 'Du hast'} ${TARGET} Punkte erreicht!` : `${N() === 4 ? 'Die Gegner haben' : 'Lotte hat'} ${TARGET} Punkte erreicht.`) : null,
      h('p', {}, how),
      h('div', { class: 'res-cols' }, col(s.result[0]), col(s.result[1])),
      h('p', { html: `Gesamt: <b>${s.totals[0]}</b> : <b>${s.totals[1]}</b> (Ziel ${TARGET})` }));
    const v = await dialog({ title, content, buttons: [{ label: 'Tisch ansehen', value: 'look' }, { label: g.over ? 'Neues Spiel' : 'Nächste Runde', value: 'next', primary: true }], dismissable: true });
    if (v === 'next') nextRound();
  }

  async function showScores() {
    const s = g.s;
    await dialog({ title: 'Punktestand', content: h('div', {},
      h('table', { class: 'result-table' },
        h('tr', {}, h('td', {}, N() === 4 ? 'Wir (du & Karl)' : 'Du'), h('td', { class: 'num' }, String(s.totals[0]))),
        h('tr', {}, h('td', {}, N() === 4 ? 'Sie (Lotte & Hanne)' : 'Lotte'), h('td', { class: 'num' }, String(s.totals[1])))),
      h('p', { class: 'small' }, `Gespielt wird bis ${TARGET}. Eure nächste Erstmeldung braucht ${minimum(s, 0)} Punkte.`)),
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
    if (s.turn !== 0 || s.phase === 'done' || busy) { ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du am Zug bist.', ms: 2500 }); return; }
    if (s.phase === 'draw') {
      const d = aiDraw(s, 0, 'schwer');
      hint = d.take ? { pile: true } : { stock: true };
      render();
      ui.coach.say({ title: d.take ? 'Nimm die Ablage' : 'Zieh vom Talon', text: d.why || 'Hier lohnt sich die Ablage nicht – zieh lieber vom Talon.',
        actions: [{ label: 'Ausführen', primary: true, onClick: () => (d.take ? onPile(false) : onStock()) }] });
      return;
    }
    staged = []; sel = new Set();
    const out = aiGoOut(s, 0);
    if (out) {
      hint = { cards: out.groups.flatMap(x => x.cards) };
      render();
      ui.coach.say({ title: 'Du kannst ausgehen!', text: 'Melde alle Karten (die letzte darfst du abwerfen). Ausgehen bringt 100 Punkte und beendet die Runde.', actions: [{ label: 'Ausführen', primary: true, onClick: () => {
        if (out.groups.length) { const r = meld(s, 0, out.groups); if (!r.ok) return; }
        if (s.phase !== 'done' && out.discard) discard(s, 0, out.discard);
        persist();
        if (s.phase === 'done') roundOver(); else { render(); advance(); }
      } }] });
      return;
    }
    const m = aiMelds(s, 0, 'schwer');
    if (m.groups.length) {
      hint = { cards: m.groups.flatMap(x => x.cards), meld: m.groups.find(x => x.rank && s.melds[0].some(mm => mm.rank === x.rank))?.rank };
      render();
      ui.coach.say({ title: 'Melden', text: m.why.slice(0, 3), actions: [{ label: 'Ausführen', primary: true, onClick: () => commitMelds(m.groups) }] });
      return;
    }
    const dc = aiDiscard(s, 0, 'schwer');
    hint = { cards: [dc.card] };
    render();
    const minInfo = !s.initial[0] ? ` Für eine Erstmeldung (${minimum(s, 0)} Punkte) reicht deine Hand noch nicht.` : '';
    ui.coach.say({ title: `Wirf ${cardName(dc.card)} ab`, text: dc.why + minInfo, actions: [{ label: 'Ausführen', primary: true, onClick: () => {
      const i = hand().indexOf(dc.card);
      sel = new Set([i]);
      onDiscard();
    } }] });
  }

  // ---------- Menü ----------
  ui.onTip = tip;
  ui.onNew = async () => {
    const r = await dialog({ title: 'Neues Spiel', body: 'Wie viele spielen mit? Der Punktestand beginnt bei 0.', layout: 'list', buttons: [
      { label: 'Zu viert', sub: 'Du und Karl gegen Lotte und Hanne', value: 4, primary: ui.option('players', 4) === 4 },
      { label: 'Zu zweit', sub: 'Du gegen Lotte – je 15 Karten, zwei Canastas zum Ausgehen', value: 2, primary: ui.option('players', 4) === 2 },
      { label: 'Abbrechen', value: null, quiet: true }] });
    if (!r) return;
    ui.setOption('players', r);
    token++; g = null; fresh(false); render(); advance();
  };

  const ro = new ResizeObserver(() => renderHand());
  ro.observe(handEl);

  if (!g || !g.s) fresh(false);
  render();
  advance();
  coachOnce('welcome', { title: 'Willkommen beim Kanaster', text: [
    `Sammelt Karten gleichen Rangs und meldet sie. Sieben gleiche sind eine <b>Canasta</b> – erst mit ${g.s.need === 1 ? 'einer' : 'zwei'} Canasta${g.s.need === 1 ? '' : 's'} darf man ausgehen.`,
    'Joker und Zweien sind Joker. Pro Zug: ziehen (oder die Ablage nehmen), melden, eine Karte abwerfen.'], ms: 12000 });

  return () => { token++; ro.disconnect(); };
}
