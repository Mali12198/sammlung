// Zahlensteine – Oberfläche (2 bis 4 Spieler, Menschen und Computer gemischt)
import { h, dialog, toast, sleep } from '../../ui.js';
import { load, save, addResult, delay } from '../../store.js';
import { choosePlayers, handover } from '../../players.js';
import {
  newGame, beginTurn, play, checkPlay, undoTurn, canFinish, finishTurn, drawTile, aiTurn, sortRack, analyzeSet, setValue,
  describeSet, jokerFor, isJ, col, num, tileName, turnNewValue, MIN_OUT,
} from './engine.js';

const DEFAULT_PLAYERS = [{ name: 'Du', human: true }, { name: 'Lotte', human: false }];

export function tileEl(t, { cls = '' } = {}) {
  if (isJ(t)) return h('div', { class: 'tile joker ' + cls, 'aria-label': 'Joker', html: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.4" fill="currentColor"/><circle cx="15" cy="10" r="1.4" fill="currentColor"/><path d="M8 14.5c2.2 2.4 5.8 2.4 8 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' });
  return h('div', { class: `tile t-${col(t)} ${cls}`, 'aria-label': tileName(t) }, h('b', {}, String(num(t))), h('i', {}));
}

export function mount(ui) {
  let g = load('save:zahlensteine');
  let sel = new Set();
  let token = 0, busy = false, hint = null, viewer = 0;

  const N = () => g.s.n;
  const players = () => (g && g.players) || DEFAULT_PLAYERS;
  const isHuman = p => !!players()[p].human;
  const humans = () => [...Array(N()).keys()].filter(isHuman);
  const multi = () => humans().length > 1;
  const isYou = p => !multi() && isHuman(p);
  const nameOf = p => (isYou(p) ? 'Du' : players()[p].name);
  const sortMode = () => ui.option('sort', 'color');

  function fresh(keep, newPlayers) {
    const old = g;
    const pl = newPlayers || (old && old.players) || DEFAULT_PLAYERS;
    const n = pl.length;
    const first = keep && old ? ((old.first || 0) + 1) % n : 0;
    g = {
      s: newGame({ n, first }), players: pl, first,
      totals: keep && old ? old.totals : new Array(n).fill(0),
      game: keep && old ? (old.game || 1) + 1 : 1,
      tipsShown: old ? old.tipsShown || {} : {},
    };
    viewer = humans()[0] ?? 0;
    sel = new Set(); hint = null;
    persist();
  }
  function persist() { save('save:zahlensteine', g); }

  // ---------- Aufbau ----------
  const felt = h('div', { class: 'felt can-felt rk-felt' });
  const pills = h('div', { class: 'can-pills' });
  const oppRow = h('div', { class: 'can-players' });
  const tableZone = h('div', { class: 'rk-table' });
  const status = h('div', { class: 'statusline' });
  const actions = h('div', { class: 'action-row' });
  const rackEl = h('div', { class: 'rk-rack' });
  const scroll = h('div', { class: 'can-scroll' }, oppRow, tableZone);
  felt.append(pills, scroll, h('div', { class: 'can-hand-zone rk-rack-zone' }, status, actions, rackEl));
  ui.stage.append(felt);
  ui.root.style.setProperty('--coach-bottom', '250px');

  const myTurn = () => g.s.turn === viewer && isHuman(viewer) && !busy && g.s.phase === 'play';
  const rack = () => sortRack(g.s.racks[viewer], sortMode());
  const selTiles = () => { const r = rack(); return [...sel].sort((a, b) => a - b).map(i => r[i]); };

  let veiled = true;
  function render() {
    if (!g || !g.s || (veiled && multi())) return;
    const s = g.s;
    const me = viewer;
    pills.replaceChildren(
      h('span', { class: 'trump-pill static' }, `Spiel ${g.game || 1} · Stapel ${s.pool.length}`),
      h('button', { class: 'trump-pill static score', onclick: showScores }, h('b', {}, (multi() ? players()[me].name : 'Du') + ': '), (g.totals[me] > 0 ? '+' : '') + g.totals[me]));
    const others = [...Array(N() - 1).keys()].map(k => (me + 1 + k) % N());
    oppRow.replaceChildren(...others.map(p => h('div', { class: 'can-player' + (s.turn === p && s.phase !== 'done' ? ' on' : '') },
      h('span', { class: 'turn-dot' }), h('b', {}, nameOf(p)),
      h('span', { class: 'cc', 'aria-label': `${s.racks[p].length} Steine` }, h('i', { class: 'mini-tile' }), String(s.racks[p].length)),
      s.out[p] ? h('span', { class: 'rm-out' }, 'draußen') : null,
      h('span', { class: 'bubble-slot', 'data-p': p }))));
    const list = h('div', { class: 'rk-sets' });
    s.table.forEach((x, i) => {
      const el = h('div', { class: 'rk-set' + (s.fresh.includes(i) ? ' fresh' : ''), role: 'button', 'aria-label': describeSet(x) }, x.tiles.map(t => tileEl(t, { cls: 'sm' })));
      el.addEventListener('click', () => setInfo(x));
      list.append(el);
    });
    if (!s.table.length) list.append(h('div', { class: 'meld empty-hint' }, `Noch nichts ausgelegt · Erstes Auslegen ab ${MIN_OUT} Punkten`));
    tableZone.replaceChildren(list);
    renderRack();
    renderActions();
    ui.setSubtitle(humans().length === N() ? `${N()} Spieler` : `Computer ${ui.level()}`);
  }

  function renderRack() {
    if (!g || !g.s || (veiled && multi())) return;
    const r = rack();
    const hl = hint ? hint.slice() : [];
    rackEl.replaceChildren(...r.map((t, i) => {
      const k = hl.indexOf(t);
      const el = tileEl(t, { cls: (sel.has(i) ? 'is-sel ' : '') + (k >= 0 ? 'is-hint' : '') });
      if (k >= 0) hl.splice(k, 1);
      el.addEventListener('click', () => onTile(i));
      return el;
    }));
  }

  const btn = (label, onclick, primary, disabled) => h('button', { class: 'btn' + (primary ? ' btn-primary' : ''), onclick, disabled: !!disabled }, label);

  function renderActions() {
    const s = g.s;
    const acts = [];
    let txt = '';
    if (s.phase === 'done') {
      txt = 'Spiel vorbei.';
      acts.push(btn('Ergebnis', showResult), btn('Nächstes Spiel', nextGame, true));
    } else if (!myTurn()) {
      txt = `${nameOf(s.turn)} ist dran …`;
    } else {
      const me = viewer;
      const played = s.played.length;
      if (!s.out[me] && !s.turnStart.out) {
        const v = turnNewValue(s);
        txt = played ? `Erstes Auslegen: <b>${v}</b> von ${MIN_OUT} Punkten.` : `Leg Serien aus deinen Steinen (zusammen ${MIN_OUT} Punkte) – oder zieh einen Stein.`;
      } else txt = played ? `${played} ${played === 1 ? 'Stein' : 'Steine'} gelegt. Mehr legen oder „Fertig“.` : (sel.size ? 'Tippe „Legen“ – ich suche den passenden Platz und baue den Tisch bei Bedarf um.' : 'Wähle Steine zum Legen – oder zieh einen.');
      acts.push(btn('Legen', onPlay, !played || sel.size > 0, !sel.size));
      if (played) {
        acts.push(btn('Zurück', onUndo));
        acts.push(btn('Fertig', onFinish, !sel.size));
      } else acts.push(btn('Ziehen', onDraw));
    }
    acts.push(h('button', { class: 'chip', onclick: toggleSort }, sortMode() === 'color' ? 'Nach Farbe' : 'Nach Zahl'));
    status.innerHTML = txt;
    actions.replaceChildren(...acts);
  }

  function bubble(p, text, ms = 1800) {
    const el = oppRow.querySelector(`.bubble-slot[data-p="${p}"]`);
    if (!el) return;
    el.replaceChildren(h('span', { class: 'bubble' }, text));
    setTimeout(() => { if (el.isConnected) el.replaceChildren(); }, ms);
  }

  function setInfo(x) {
    const j = x.tiles.map((t, i) => (isJ(t) ? jokerFor(x, i) : null)).filter(Boolean);
    const jt = j.length ? ` Joker: ${j.map(v => (v.startsWith('any') ? 'eine fehlende Farbe' : tileName(v))).join(', ')}.` : '';
    toast(`${describeSet(x)} (${setValue(x)} Punkte).${jt}`, 3000);
  }

  // ---------- Eingaben ----------
  function toggleSort() {
    const keep = selTiles();
    ui.setOption('sort', sortMode() === 'color' ? 'num' : 'color');
    const r = rack();
    sel = new Set();
    const used = new Set();
    for (const t of keep) { const i = r.findIndex((x, k) => x === t && !used.has(k)); if (i >= 0) { sel.add(i); used.add(i); } }
    render();
  }

  function onTile(i) {
    if (!myTurn()) { if (g.s.phase === 'play') toast(`${nameOf(g.s.turn)} ist dran.`); return; }
    hint = null;
    if (sel.has(i)) sel.delete(i); else sel.add(i);
    render();
  }

  function onPlay() {
    const s = g.s;
    if (!myTurn() || !sel.size) return;
    const tiles = selTiles();
    const wasOut = s.out[viewer];
    const r = play(s, viewer, tiles);
    if (!r.ok) { toast(r.err, 4000); return; }
    sel = new Set(); hint = null;
    persist(); render();
    if (r.rebuilt) toast('Ich habe den Tisch für dich umgebaut.', 2200);
    if (!wasOut && s.out[viewer]) {
      toast(`${MIN_OUT} Punkte – geschafft! Tippe „Fertig“.`, 2400);
      coachOnce('out', { title: 'Du bist draußen', text: 'Ab deinem nächsten Zug darfst du Steine an alle Serien anlegen und den Tisch umbauen. Wähle einfach Steine und tippe „Legen“ – ich suche die passende Aufteilung.', ms: 9000 });
    }
  }

  function onUndo() {
    if (!myTurn()) return;
    undoTurn(g.s);
    sel = new Set(); hint = null;
    persist(); render();
  }

  function onFinish() {
    const s = g.s;
    if (!myTurn()) return;
    const c = canFinish(s);
    if (!c.ok) { toast(c.err, 4000); return; }
    sel = new Set(); hint = null;
    finishTurn(s);
    persist();
    if (s.phase === 'done') return gameOver();
    render();
    advance();
  }

  function onDraw() {
    const s = g.s;
    if (!myTurn() || s.played.length) return;
    sel = new Set(); hint = null;
    const t = drawTile(s);
    persist();
    if (s.phase === 'done') return gameOver();
    if (t) toast(`Gezogen: ${tileName(t)}`, 1600);
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
      if (s.phase === 'done') { busy = false; gameOver(); return; }
      const p = s.turn;
      if (isHuman(p)) {
        if (p !== viewer) {
          busy = true; ui.coach.hide();
          if (multi()) {
            render();
            await handover(players()[p].name, 'Deine Steine werden gleich aufgedeckt. Die anderen schauen bitte weg.');
            if (!alive()) return;
          }
          viewer = p; sel = new Set(); hint = null;
        }
        busy = false; render();
        return;
      }
      busy = true; render();
      await sleep(delay(800));
      if (!alive()) return;
      const steps = aiTurn(s, p, lv);
      let n = 0;
      for (const st of steps) {
        const r = play(s, p, st);
        if (!r.ok) break;
        n += st.length;
        persist(); render();
        await sleep(delay(450));
        if (!alive()) return;
      }
      if (n && canFinish(s).ok) {
        bubble(p, `legt ${n} ${n === 1 ? 'Stein' : 'Steine'}`, 1600);
        const fr = s.fresh.slice();
        finishTurn(s);
        lastFresh = fr;
      } else {
        if (n) undoTurn(s);
        drawTile(s);
        bubble(p, 'zieht', 1000);
      }
      persist(); render();
      if (lastFresh) { highlight(lastFresh); lastFresh = null; }
      await sleep(delay(300));
    }
  }
  let lastFresh = null;
  function highlight(idx) {
    const els = tableZone.querySelectorAll('.rk-set');
    for (const i of idx) if (els[i]) els[i].classList.add('fresh');
  }

  function coachOnce(key, msg) {
    if (!ui.coachOn() || g.tipsShown[key]) return;
    g.tipsShown[key] = true; persist();
    ui.coach.say(msg);
  }

  // ---------- Ende ----------
  function gameOver() {
    const s = g.s;
    busy = false;
    if (!s.counted && s.result) {
      s.counted = true;
      s.result.scores.forEach((v, p) => { g.totals[p] += v; });
      if (humans().length === 1) addResult('zahlensteine', s.result.winner === humans()[0]);
      persist();
    }
    render();
    showResult();
  }

  async function showResult() {
    const s = g.s, r = s.result;
    if (!r) return;
    const w = r.winner;
    const good = multi() || isHuman(w);
    const rows = [...Array(N()).keys()].map(p => h('tr', { class: p === w ? 'total' : '' },
      h('td', {}, nameOf(p)), h('td', { class: 'small' }, `${s.racks[p].length} Steine · ${r.pts[p]} P.`),
      h('td', { class: 'num' }, (r.scores[p] > 0 ? '+' : '') + r.scores[p]), h('td', { class: 'num' }, String(g.totals[p]))));
    const left = [...Array(N()).keys()].filter(p => s.racks[p].length && p !== w);
    const content = h('div', { class: 'result' },
      h('p', { class: 'result-big ' + (good ? 'win' : 'lose') }, `${nameOf(w)} ${nameOf(w) === 'Du' ? 'gewinnst' : 'gewinnt'}!`),
      h('p', {}, r.blocked ? 'Der Stapel ist leer und niemand konnte mehr legen – es gewinnt, wer die wenigsten Punkte übrig hat.' : `${isYou(w) ? 'Du hast' : nameOf(w) + ' hat'} alle Steine gelegt.`),
      h('table', { class: 'result-table' }, h('tr', {}, h('td', {}, 'Spieler'), h('td', {}, ''), h('td', { class: 'num' }, 'Spiel'), h('td', { class: 'num' }, 'Gesamt')), rows),
      ...left.slice(0, 3).map(p => h('div', {}, h('p', { class: 'small' }, `${nameOf(p)} hatte noch:`), h('div', { class: 'rk-line' }, sortRack(s.racks[p]).map(t => tileEl(t, { cls: 'sm' }))))),
      h('p', { class: 'small' }, 'Wertung: Jeder zahlt die Summe seiner Steine (Joker 30), der Gewinner bekommt alles zusammen.'));
    const v = await dialog({ title: 'Spielende', content, buttons: [{ label: 'Tisch ansehen', value: 'look' }, { label: 'Nächstes Spiel', value: 'next', primary: true }], dismissable: true });
    if (v === 'next') nextGame();
  }

  async function showScores() {
    await dialog({ title: 'Punkte', content: h('div', {},
      h('table', { class: 'result-table' }, [...Array(N()).keys()].map(p => h('tr', { class: p === viewer ? 'total' : '' }, h('td', {}, nameOf(p)), h('td', { class: 'num' }, String(g.totals[p]))))),
      h('p', { class: 'small' }, 'Pluspunkte für Siege, Minuspunkte für übrige Steine – über alle Spiele zusammengezählt.')),
    buttons: [{ label: 'OK', value: true, primary: true }], dismissable: true });
  }

  function nextGame() {
    ui.coach.hide();
    fresh(true);
    render();
    advance();
  }

  // ---------- Tipp ----------
  function tip() {
    const s = g.s;
    const me = viewer;
    if (!myTurn()) { ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du am Zug bist.', ms: 2500 }); return; }
    if (s.played.length) {
      const more = aiTurn(s, me, 'schwer');
      if (more.length && canFinish(s).ok === false && !s.out[me]) {
        hint = more.flat(); render();
        ui.coach.say({ title: 'Noch mehr legen', text: canFinish(s).err, actions: [{ label: 'Ausführen', primary: true, onClick: () => { for (const st of more) { if (!play(s, me, st).ok) break; } hint = null; persist(); render(); } }] });
        return;
      }
      const ok = canFinish(s).ok;
      ui.coach.say({ title: ok ? 'Fertig?' : 'Zurücknehmen?', text: ok ? 'Du hast gelegt – tippe „Fertig“, oder leg noch mehr.' : canFinish(s).err,
        actions: [ok ? { label: 'Fertig', primary: true, onClick: onFinish } : { label: 'Zurück', primary: true, onClick: onUndo }] });
      return;
    }
    sel = new Set();
    const steps = aiTurn(s, me, 'schwer');
    if (!steps.length) {
      hint = null; render();
      ui.coach.say({ title: 'Zieh einen Stein', text: s.out[me] ? 'Ich finde keinen Platz für deine Steine – auch nicht mit Umbauen.' : `Für das erste Auslegen brauchst du ${MIN_OUT} Punkte aus eigenen Serien. Das reicht noch nicht.`, actions: [{ label: 'Ziehen', primary: true, onClick: onDraw }] });
      return;
    }
    const all = steps.flat();
    hint = all;
    render();
    const first = steps[0];
    const sets = first.length >= 3 ? (analyzeSet(first) ? [analyzeSet(first)] : null) : null;
    const text = [];
    if (!s.out[me]) text.push(`Du kannst rauskommen: ${steps.map(st => st.length).reduce((a, b) => a + b, 0)} Steine, mindestens ${MIN_OUT} Punkte.`);
    else text.push(`Du kannst ${all.length} ${all.length === 1 ? 'Stein' : 'Steine'} legen${steps.length > 1 ? ' (teils mit Umbau des Tisches)' : ''}.`);
    if (sets) text.push(`Zum Beispiel: ${describeSet(sets[0])}.`);
    text.push('Hohe Steine zuerst loswerden – sie zählen am Ende am meisten.');
    ui.coach.say({ title: 'Legen!', text, actions: [{ label: 'Ausführen', primary: true, onClick: () => {
      for (const st of steps) { const r = play(s, me, st); if (!r.ok) break; }
      hint = null; persist(); render();
    } }] });
  }

  // ---------- Menü ----------
  ui.onTip = tip;
  ui.onNew = () => setup(false);

  function welcome() {
    if (!multi()) coachOnce('welcome', { title: 'Willkommen bei den Zahlensteinen', text: [
      'Leg <b>Gruppen</b> (3–4 gleiche Zahlen in verschiedenen Farben) und <b>Reihen</b> (mindestens drei aufeinanderfolgende Zahlen einer Farbe).',
      `Das erste Auslegen braucht ${MIN_OUT} Punkte. Danach darfst du an alles anlegen und den Tisch umbauen – wähle Steine und tippe „Legen“, ich finde die Aufteilung. Kannst du nicht legen, ziehst du einen Stein.`], ms: 14000 });
  }

  async function resumeGame() {
    const p = isHuman(g.s.turn) ? g.s.turn : (humans()[0] ?? 0);
    if (multi()) {
      await handover(players()[p].name, 'Deine Steine werden gleich aufgedeckt. Die anderen schauen bitte weg.');
      if (ui.destroyed) return;
    }
    viewer = p; sel = new Set(); hint = null; veiled = false;
    if (!g.s.turnStart) beginTurn(g.s);
    render(); advance(); welcome();
  }

  async function setup(entry) {
    const running = !!(g && g.s && g.s.phase !== 'done');
    const pl = await choosePlayers({ title: entry ? 'Zahlensteine – wer spielt?' : 'Neues Spiel – wer spielt?', min: 2, max: 4, current: players(), entry,
      resume: entry && running ? 'Weiterspielen' : null, resumeSub: entry && running ? `Spiel ${g.game || 1} · Stapel ${g.s.pool.length}` : '',
      note: 'Zwei bis vier Spieler, Menschen und Computer gemischt – das iPhone wird reihum weitergegeben.' });
    if (pl === 'resume') { await resumeGame(); return; }
    if (!pl) { if (entry) location.hash = '#/'; return; }
    token++; ui.coach.hide();
    veiled = false; g = null; fresh(false, pl); render(); advance(); welcome();
  }

  if (g && g.s && !multi()) { viewer = humans()[0] ?? 0; render(); }
  setup(true);

  return () => { token++; };
}

