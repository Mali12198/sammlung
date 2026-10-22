// Farbreihen – Oberfläche
import { h, dialog, toast, sleep } from '../../ui.js';
import { load, save, addResult, delay } from '../../store.js';
import { choosePlayers } from '../../players.js';
import { dieSvg } from '../wuerfelpoker/view.js';
import {
  newGame, roll, markWhite, markColor, whiteOptions, colorOptions, whiteSum, aiWhite, aiColor, score, standings, describe,
  markValue, lastIdx, markCount, COLORS, COLOR_NAME, ROW, maxPen, rowsToEnd,
  canReroll, reroll, aiReroll,
} from './engine.js';

// Hausregeln: Schalter auf dem Startbildschirm
const RULE_INFO = {
  short: { label: 'Kurzes Spiel', short: 'Kurz', text: 'Ende schon bei einer geschlossenen Reihe oder drei Fehlwürfen' },
  reroll: { label: 'Neuwurf-Joker', short: 'Joker', text: 'Jeder darf einmal pro Partie direkt nach seinem Wurf alle Würfel neu werfen' },
  early: { label: 'Früh abschließen', short: 'Ab 3', text: 'Eine Reihe darf schon ab drei statt fünf Kreuzen abgeschlossen werden' },
};

export function mount(ui) {
  let g = load('save:farbreihen');
  let token = 0, busy = false, hint = null; // hint: { c, v }

  function fresh(players, keep = true, rules = null) {
    const pl = players || (g && g.s.players) || [{ name: 'Du', human: true }, { name: 'Lotte', human: false }, { name: 'Karl', human: false }];
    g = { s: newGame(pl, rules || ui.option('rules', {})), counted: false };
    hint = null;
    if (keep) persist();
  }
  function persist() { save('save:farbreihen', g); }

  const wrap = h('div', { class: 'dice-game farbreihen' });
  const top = h('div', { class: 'dg-top' });
  const chips = h('div', { class: 'dg-chips' });
  const sheetBox = h('div', { class: 'qx-sheet-box' });
  const status = h('div', { class: 'statusline' });
  const tray = h('div', { class: 'dice-tray qx-dice' });
  const controls = h('div', { class: 'dg-controls' });
  wrap.append(top, chips, sheetBox, h('div', { class: 'dg-bottom' }, status, tray, controls));
  ui.stage.append(wrap);
  ui.root.style.setProperty('--coach-bottom', '210px');

  const S = () => g.s;
  const humans = () => S().players.map((p, i) => (p.human ? i : -1)).filter(i => i >= 0);
  const multiHuman = () => humans().length > 1;
  const nameOf = i => (S().players[i].human && !multiHuman() ? 'Du' : S().players[i].name);

  // Wer muss gerade entscheiden?
  function decider() {
    const s = S();
    if (s.phase === 'roll') return s.turn;
    if (s.phase === 'white') return s.pending[0];
    if (s.phase === 'color') return s.turn;
    return -1;
  }
  // Wessen Blatt zeigen wir?
  function viewer() {
    const d = decider();
    if (d >= 0 && S().players[d].human) return d;
    const hs = humans();
    if (hs.length === 1) return hs[0];
    return hs.includes(S().turn) ? S().turn : (hs[0] ?? 0);
  }

  // ---------- Darstellung ----------
  function render() {
    const s = S();
    const closed = COLORS.filter(c => s.closed[c]);
    top.replaceChildren(...[
      h('span', { class: 'trump-pill static' }, s.phase === 'done' ? 'Spiel beendet' : `Runde ${s.round}`),
      closed.length ? h('span', { class: 'trump-pill static' }, 'Abgeschlossen: ', ...closed.map(c => h('i', { class: 'qx-dot qx-' + c }))) : null,
      activeRules().length ? h('button', { class: 'trump-pill static qx-rules-pill', onclick: showRules, 'aria-label': 'Aktive Hausregeln' },
        activeRules().map(k => RULE_INFO[k].short).join(' · ')) : null,
    ].filter(Boolean));
    chips.replaceChildren(...s.players.map((p, i) => {
      const sc = score(s.sheets[i]);
      return h('button', { class: 'dg-chip' + (i === s.turn && s.phase !== 'done' ? ' on' : '') + (i === viewer() ? ' viewing' : ''), onclick: () => showSheets() },
        h('span', { class: 'turn-dot' }), h('b', {}, nameOf(i)), h('span', { class: 'pts' }, String(sc.total)),
        s.sheets[i].pen ? h('span', { class: 'pen' }, '✕'.repeat(s.sheets[i].pen)) : null,
        s.opts && s.opts.reroll && s.sheets[i].joker ? h('span', { class: 'qx-joker-badge', title: 'Joker noch frei' }, 'J') : null);
    }));
    renderSheet();
    renderDice();
    renderControls();
    ui.setSubtitle(s.players.some(p => !p.human) ? `Computer ${ui.level()}` : `${s.players.length} Spieler`);
  }

  function currentOptions() {
    const s = S();
    const d = decider();
    if (busy || d < 0 || !s.players[d].human) return [];
    if (s.phase === 'white') return whiteOptions(s, d);
    if (s.phase === 'color') return colorOptions(s, d);
    return [];
  }

  function sheetEl(p, { interactive = false, compact = false } = {}) {
    const s = S();
    const sh = s.sheets[p];
    const opts = interactive ? currentOptions() : [];
    const rows = COLORS.map(c => {
      const row = sh[c];
      const li = lastIdx(row);
      const boxes = ROW[c].map((v, i) => {
        const marked = row.marks[i];
        const opt = opts.find(o => o.c === c && o.v === v);
        const cls = ['qx-box'];
        if (marked) cls.push('x');
        else if (i < li) cls.push('gone');
        if (opt) cls.push('opt');
        if (hint && hint.c === c && hint.v === v && interactive) cls.push('is-hint');
        if (i === 10) cls.push('last');
        const b = h(opt ? 'button' : 'span', { class: cls.join(' '), 'aria-label': `${COLOR_NAME[c]} ${v}${marked ? ' angekreuzt' : ''}` }, String(v));
        if (opt) b.addEventListener('click', () => onMark(opt));
        return b;
      });
      const lock = h('span', { class: 'qx-lock' + (row.lock ? ' x' : '') + (s.closed[c] ? ' closed' : ''), html: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>' });
      return h('div', { class: `qx-row qx-${c}` + (s.closed[c] ? ' is-closed' : '') }, h('div', { class: 'qx-boxes' }, boxes), lock,
        compact ? h('span', { class: 'qx-cnt' }, String(markCount(row))) : null);
    });
    const sc = score(sh);
    const pen = h('div', { class: 'qx-pen' }, h('span', {}, 'Fehlwürfe'), ...Array.from({ length: maxPen(s) }, (_, k) => h('span', { class: 'qx-pbox' + (k < sh.pen ? ' x' : '') }, k < sh.pen ? '✕' : '')));
    const sum = h('div', { class: 'qx-sum' }, ...COLORS.map(c => h('span', { class: 'qx-s qx-' + c }, String(sc.rows[COLORS.indexOf(c)]))), h('span', {}, `− ${sc.pen}`), h('b', {}, `= ${sc.total}`));
    return h('div', { class: 'qx-sheet' + (compact ? ' compact' : '') }, ...rows, h('div', { class: 'qx-foot' }, pen, sum));
  }

  function renderSheet() {
    const v = viewer();
    const label = multiHuman() || !S().players[v].human ? h('div', { class: 'qx-owner' }, `Blatt von ${S().players[v].name}`) : null;
    sheetBox.replaceChildren(...[label, sheetEl(v, { interactive: true })].filter(Boolean));
  }

  function renderDice(rollingFaces) {
    const s = S();
    if (!s.dice) { tray.replaceChildren(...['w1', 'w2', 'r', 'y', 'g', 'b'].map(k => h('span', { class: 'die blank qx-' + k, html: dieSvg(0) }))); return; }
    const d = rollingFaces || s.dice;
    const items = ['w1', 'w2', ...COLORS].filter(k => k.startsWith('w') || d[k] != null || !s.closed[k]);
    tray.replaceChildren(...items.map(k => h('span', { class: 'die qx-' + k + (s.closed[k] ? ' gone' : '') + (rollingFaces ? ' rolling' : ''), html: dieSvg(d[k] || 0) })));
  }

  function renderControls() {
    const s = S();
    const acts = [];
    let txt = '';
    const d = decider();
    if (s.phase === 'done') {
      const st = standings(s);
      txt = `<b>${nameOf(st[0].i)}</b> ${nameOf(st[0].i) === 'Du' ? 'gewinnst' : 'gewinnt'} mit ${st[0].total} Punkten.`;
      acts.push(h('button', { class: 'btn', onclick: showResult }, 'Ergebnis'), h('button', { class: 'btn btn-primary', onclick: () => startNew(true) }, 'Neues Spiel'));
    } else if (busy || d < 0 || !s.players[d].human) {
      txt = s.phase === 'roll' ? `${nameOf(s.turn)} würfelt …` : `${nameOf(d)} überlegt …`;
    } else {
      const who = multiHuman() ? `<b>${s.players[d].name}</b>: ` : '';
      if (s.phase === 'roll') {
        txt = who + 'Du bist dran – würfle!';
        acts.push(h('button', { class: 'btn btn-primary roll-btn', onclick: onRoll }, 'Würfeln'));
      } else if (s.phase === 'white') {
        const n = whiteOptions(s, d).length;
        txt = who + `Weiße Summe <b>${whiteSum(s)}</b>${d === s.turn ? '' : ' – darfst du mitnutzen'}. ${n ? 'Tippe ein leuchtendes Feld an.' : 'Passt nirgends.'}`;
        if (canReroll(s) && d === s.turn) acts.push(h('button', { class: 'btn qx-joker-btn', onclick: onReroll }, h('span', { class: 'qx-joker-badge' }, 'J'), 'Joker: neu würfeln'));
        acts.push(h('button', { class: 'btn', onclick: () => onMark(null) }, n ? 'Nicht ankreuzen' : 'Weiter'));
      } else {
        const n = colorOptions(s, d).length;
        txt = who + (n ? 'Jetzt darfst du <b>weiß + Farbe</b> kombinieren.' : 'Keine Farbkombination möglich.');
        acts.push(h('button', { class: 'btn' + (!s.activeMarked ? ' btn-danger' : ''), onclick: () => onMark(null) }, s.activeMarked ? (n ? 'Kein weiteres Kreuz' : 'Weiter') : 'Fehlwurf nehmen'));
      }
    }
    status.innerHTML = txt;
    controls.replaceChildren(...acts);
  }

  // ---------- Aktionen ----------
  async function animateRoll() {
    const s = S();
    const t0 = Date.now();
    while (Date.now() - t0 < delay(450)) {
      const r = () => 1 + Math.floor(Math.random() * 6);
      const faces = { w1: r(), w2: r() };
      for (const c of COLORS) faces[c] = s.closed[c] ? null : r();
      renderDice(faces);
      await sleep(70);
    }
  }

  async function onRoll() {
    const s = S();
    if (busy || s.phase !== 'roll' || !s.players[s.turn].human) return;
    busy = true; hint = null; ui.coach.hide(); renderControls();
    await animateRoll();
    roll(s);
    busy = false;
    persist(); render();
    coachOnce('white', { title: 'Zwei Schritte', text: ['1. Die Summe der <b>weißen</b> Würfel dürfen <b>alle</b> Spieler in einer beliebigen Reihe ankreuzen.', '2. Danach darf nur der Würfelnde zusätzlich <b>einen weißen + einen farbigen</b> Würfel in der passenden Farbe ankreuzen.'], ms: 10000 });
    advance();
  }

  async function onReroll() {
    const s = S();
    if (busy || !canReroll(s) || !s.players[s.turn].human) return;
    busy = true; hint = null; ui.coach.hide(); renderControls();
    await animateRoll();
    reroll(s);
    busy = false;
    persist(); render();
    toast('Joker eingesetzt – neuer Wurf!', 1600);
  }

  function onMark(opt) {
    const s = S();
    const d = decider();
    if (busy || d < 0 || !s.players[d].human) return;
    hint = null; ui.coach.hide();
    if (opt) coachSkip(d, opt);
    if (s.phase === 'white') {
      markWhite(s, d, opt ? opt.c : null);
    } else if (s.phase === 'color') {
      const res = markColor(s, opt ? { c: opt.c, v: opt.v } : null);
      if (res.penalty) toast(`${nameOf(d)} nimmt einen Fehlwurf (−5).`, 2400);
    }
    persist();
    render();
    if (s.phase === 'done') return finish();
    advance();
  }

  function coachSkip(p, opt) {
    if (!ui.coachOn()) return;
    const s = S();
    const row = s.sheets[p][opt.c];
    const i = ROW[opt.c].indexOf(opt.v);
    const skip = i - lastIdx(row) - 1;
    if (skip >= 3) ui.coach.say({ title: 'Viele Felder übersprungen', kind: 'warn', text: `Damit sind ${skip} Felder in ${COLOR_NAME[opt.c]} für immer weg. Am Anfang lohnt es sich meist, nur ein bis zwei Felder auszulassen.`, ms: 7000 });
    else if (i === 10) ui.coach.say({ title: 'Reihe abgeschlossen!', kind: 'good', text: `${COLOR_NAME[opt.c]} ist jetzt für alle zu – und das Schloss zählt als zusätzliches Kreuz.`, ms: 6000 });
  }

  // ---------- Computer ----------
  async function advance() {
    const my = ++token;
    const alive = () => !ui.destroyed && my === token;
    while (alive()) {
      const s = S();
      if (s.phase === 'done') { busy = false; return finish(); }
      const d = decider();
      if (s.players[d].human) { busy = false; render(); return; }
      busy = true; render();
      const lv = s.players[d].level || ui.level();
      if (s.phase === 'roll') {
        await sleep(delay(500));
        if (!alive()) return;
        await animateRoll();
        roll(s);
        persist(); render();
        await sleep(delay(500));
        if (aiReroll(s, lv)) {
          if (!alive()) return;
          toast(`${nameOf(d)} setzt den Joker ein und würfelt neu.`, 1800);
          await sleep(delay(500));
          await animateRoll();
          reroll(s);
          persist(); render();
          await sleep(delay(500));
        }
        continue;
      }
      await sleep(delay(550));
      if (!alive()) return;
      if (s.phase === 'white') {
        const o = aiWhite(s, d, lv);
        markWhite(s, d, o ? o.c : null);
        if (o) toast(`${nameOf(d)}: ${COLOR_NAME[o.c]} ${o.v}${ROW[o.c].indexOf(o.v) === 10 ? ' – abgeschlossen!' : ''}`, 1600);
      } else {
        const o = aiColor(s, lv);
        const res = markColor(s, o ? { c: o.c, v: o.v } : null);
        if (o) toast(`${nameOf(d)}: ${COLOR_NAME[o.c]} ${o.v}${ROW[o.c].indexOf(o.v) === 10 ? ' – abgeschlossen!' : ''}`, 1600);
        if (res.penalty) toast(`${nameOf(d)} nimmt einen Fehlwurf.`, 1800);
      }
      persist(); render();
    }
  }

  function finish() {
    const s = S();
    busy = false;
    render();
    if (!g.counted) {
      g.counted = true;
      const hs = humans();
      if (hs.length === 1) {
        const st = standings(s);
        addResult('farbreihen', st[0].i === hs[0] || st[0].total === score(s.sheets[hs[0]]).total);
      }
      persist();
    }
    showResult();
  }

  async function showResult() {
    const s = S();
    const st = standings(s);
    const why = s.sheets.some(sh => sh.pen >= maxPen(s)) ? `Jemand hat den ${maxPen(s) === 3 ? 'dritten' : 'vierten'} Fehlwurf genommen.` : rowsToEnd(s) === 1 ? 'Eine Reihe ist abgeschlossen.' : 'Zwei Reihen sind abgeschlossen.';
    const content = h('div', { class: 'result' },
      h('p', { class: 'result-big win' }, `${nameOf(st[0].i)} ${nameOf(st[0].i) === 'Du' ? 'gewinnst' : 'gewinnt'}!`),
      h('p', {}, why),
      h('table', { class: 'result-table' }, st.map((x, k) => h('tr', { class: k === 0 ? 'total' : '' },
        h('td', {}, `${k + 1}. ${nameOf(x.i)}`), h('td', { class: 'small' }, `${x.rows.join(' + ')} − ${x.pen}`), h('td', { class: 'num' }, String(x.total))))));
    const v = await dialog({ title: 'Endstand', content, buttons: [{ label: 'Blätter ansehen', value: 'sheets' }, { label: 'Neues Spiel', value: 'new', primary: true }], dismissable: true });
    if (v === 'sheets') showSheets();
    if (v === 'new') startNew(true);
  }

  async function showSheets() {
    const s = S();
    const content = h('div', { class: 'qx-all' }, s.players.map((p, i) => h('div', {}, h('h4', {}, `${nameOf(i)} · ${score(s.sheets[i]).total} Punkte`), sheetEl(i, { compact: true }))));
    await dialog({ title: 'Alle Blätter', content, buttons: [{ label: 'Schließen', value: true, primary: true }], dismissable: true });
  }

  function rulesForm() {
    const cur = { ...ui.option('rules', {}) };
    const box = h('div', { class: 'qx-rules-form' }, h('p', { class: 'field-label' }, 'Hausregeln'));
    for (const k of Object.keys(RULE_INFO)) {
      const i = h('input', { type: 'checkbox', class: 'switch', onchange: e => { cur[k] = e.target.checked; } });
      i.checked = !!cur[k];
      box.append(h('label', { class: 'switch-row' }, h('span', {}, RULE_INFO[k].label, h('small', {}, RULE_INFO[k].text)), i));
    }
    return { el: box, value: () => cur };
  }

  async function startNew(ask = true, entry = false) {
    let players = S().players;
    let rules = null;
    if (ask) {
      const running = entry && hadSave && S().phase !== 'done';
      const form = rulesForm();
      const r = await choosePlayers({ title: 'Farbreihen – wer spielt?', min: 2, max: 5, current: S().players, entry,
        resume: running ? 'Weiterspielen' : null, resumeSub: running ? `Runde ${S().round}${activeRules().length ? ' · ' + activeRules().map(k => RULE_INFO[k].short).join(' · ') : ''}` : '',
        note: 'Menschen und Computer gemischt – das iPhone wird reihum weitergegeben.', extra: form.el });
      if (r === 'resume') { advance(); welcome(); return; }
      if (!r) { if (entry) location.hash = '#/'; return; }
      players = r;
      rules = form.value();
      ui.setOption('rules', rules);
    }
    token++; ui.coach.hide();
    fresh(players, true, rules);
    render();
    advance();
    welcome();
  }

  // ---------- Tipp ----------
  function tip() {
    const s = S();
    const d = decider();
    if (busy || d < 0 || !s.players[d].human) { ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du entscheiden darfst.', ms: 2500 }); return; }
    if (s.phase === 'roll') { ui.coach.say({ title: 'Würfeln', text: 'Du bist der aktive Spieler: Würfle alle sechs Würfel.', actions: [{ label: 'Würfeln', primary: true, onClick: onRoll }] }); return; }
    if (canReroll(s) && d === s.turn && aiReroll(s, 'schwer')) {
      ui.coach.say({ title: 'Joker einsetzen?', text: ['Dieser Wurf passt schlecht zu deinem Blatt – du müsstest viele Felder auslassen oder einen Fehlwurf nehmen.', 'Mit dem Joker würfelst du alle Würfel neu. Du hast ihn nur einmal pro Partie.'],
        actions: [{ label: 'Neu würfeln', primary: true, onClick: onReroll }] });
      return;
    }
    const opts = s.phase === 'white' ? whiteOptions(s, d) : colorOptions(s, d);
    const best = s.phase === 'white' ? aiWhite(s, d, 'schwer') : aiColor(s, 'schwer');
    const list = opts.map(o => describe(o, s, d)).slice(0, 4);
    if (!best) {
      const pen = s.phase === 'color' && !s.activeMarked;
      ui.coach.say({ title: pen ? 'Lieber Fehlwurf' : 'Nichts ankreuzen', text: [
        opts.length ? `Möglich wäre: ${list.join('; ')}.` : 'Es passt gerade nichts.',
        pen ? 'Ein Fehlwurf kostet 5 Punkte – das ist hier billiger, als viele Felder zu verschenken.' : 'Jedes übersprungene Feld fehlt dir später. Warte lieber auf eine bessere Zahl.'],
      actions: [{ label: pen ? 'Fehlwurf nehmen' : 'Nicht ankreuzen', primary: true, onClick: () => onMark(null) }] });
      return;
    }
    hint = { c: best.c, v: best.v };
    renderSheet();
    const m = markValue(s, d, best.c, best.v, 'schwer');
    ui.coach.say({ title: `Kreuze ${COLOR_NAME[best.c]} ${best.v} an`, text: [
      describe(best, s, d) + '.',
      m.skip === 0 ? 'Kein Feld geht verloren – perfekt.' : `Das kostet ${m.skip} ${m.skip === 1 ? 'Feld' : 'Felder'}, lohnt sich aber${s.phase === 'color' && !s.activeMarked ? ' – sonst droht ein Fehlwurf' : ''}.`],
    actions: [{ label: 'Ankreuzen', primary: true, onClick: () => onMark(best) }] });
  }

  const activeRules = () => Object.keys(RULE_INFO).filter(k => S().opts && S().opts[k]);
  async function showRules() {
    const content = h('div', {}, activeRules().map(k => h('p', {}, h('b', {}, RULE_INFO[k].label + ': '), RULE_INFO[k].text + '.')),
      h('p', { class: 'small' }, 'Hausregeln wählst du beim Start einer neuen Partie.'));
    await dialog({ title: 'Hausregeln in dieser Partie', content, buttons: [{ label: 'OK', value: true, primary: true }], dismissable: true });
  }

  function coachOnce(key, msg) {
    if (!ui.coachOn()) return;
    const k = 'farbreihen:tip:' + key;
    if (load(k, false)) return;
    save(k, true);
    ui.coach.say(msg);
  }

  ui.onTip = tip;
  ui.onNew = () => startNew(true);
  ui.menuExtra = () => h('button', { class: 'btn btn-quiet', style: { marginTop: '6px' }, onclick: showSheets }, 'Alle Blätter ansehen');

  function welcome() {
    if (S().round === 1 && S().phase === 'roll' && S().turn === 0) coachOnce('welcome', { title: 'Willkommen bei Farbreihen', text: ['Kreuze in jeder Farbreihe von <b>links nach rechts</b> an – was du überspringst, ist verloren.', `Je mehr Kreuze in einer Reihe, desto mehr Punkte. Das Spiel endet, wenn ${rowsToEnd(S()) === 1 ? 'eine Reihe' : 'zwei Reihen'} abgeschlossen ${rowsToEnd(S()) === 1 ? 'ist' : 'sind'} oder jemand ${maxPen(S()) === 3 ? 'drei' : 'vier'} Fehlwürfe hat.`], ms: 12000 });
  }

  // Zuerst immer der Startbildschirm: Weiterspielen oder neu (gegen Computer / Menschen).
  const hadSave = !!(g && g.s);
  if (!hadSave) fresh(null, false);
  render();
  startNew(true, true);

  return () => { token++; };
}
