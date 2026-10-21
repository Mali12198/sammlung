// Kniffel – Oberfläche
import { h, dialog, toast, sleep } from '../../ui.js';
import { load, save, addResult, delay } from '../../store.js';
import { choosePlayers } from '../../players.js';
import {
  newGame, roll, enter, options, totals, hasRolled, plan, holdsFor, aiStep, explainKeep, jokerActive,
  CATS, UPPER, CAT_NAME, CAT_HINT, BASE, FACE, isKniffel, bonusReachable,
} from './engine.js';

const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]] };
export const dieSvg = v => `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="4" y="4" width="92" height="92" rx="20" class="die-face"/>${(PIPS[v] || []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5" class="die-pip"/>`).join('')}</svg>`;

export function mount(ui) {
  let g = load('save:kniffel');
  let token = 0, busy = false, hint = null; // hint: { holds:[bool], cat }

  function fresh(players, keep = true) {
    const pl = players || (g && g.s.players) || [{ name: 'Du', human: true }, { name: 'Lotte', human: false }];
    g = { s: newGame(pl, { joker: ui.option('joker', true) }), counted: false };
    hint = null;
    if (keep) persist();
  }
  function persist() { save('save:kniffel', g); }

  // ---------- Aufbau ----------
  const wrap = h('div', { class: 'dice-game kniffel' });
  const top = h('div', { class: 'dg-top' });
  const chips = h('div', { class: 'dg-chips' });
  const sheetBox = h('div', { class: 'kn-sheet-box' });
  const status = h('div', { class: 'statusline' });
  const tray = h('div', { class: 'dice-tray' });
  const controls = h('div', { class: 'dg-controls' });
  wrap.append(top, chips, sheetBox, h('div', { class: 'dg-bottom' }, status, tray, controls));
  ui.stage.append(wrap);
  ui.root.style.setProperty('--coach-bottom', '200px');

  const S = () => g.s;
  const cur = () => S().players[S().turn];
  const humanTurn = () => S().phase !== 'done' && cur().human;
  const multiHuman = () => S().players.filter(p => p.human).length > 1;
  const youName = p => (S().players[p].human && !multiHuman() ? 'Du' : S().players[p].name);

  // ---------- Darstellung ----------
  function render() {
    const s = S();
    top.replaceChildren(...[
      h('span', { class: 'trump-pill static' }, s.phase === 'done' ? 'Spiel beendet' : `Runde ${Math.min(s.round, 13)} von 13`),
      s.players.length === 1 ? h('span', { class: 'trump-pill static' }, `Bestwert: ${load('kniffel:best', 0) || '–'}`) : null].filter(Boolean));
    chips.replaceChildren(...s.players.map((p, i) => h('div', { class: 'dg-chip' + (i === s.turn && s.phase !== 'done' ? ' on' : '') + (p.human ? ' human' : '') },
      h('span', { class: 'turn-dot' }), h('b', {}, youName(i)), h('span', { class: 'pts' }, String(totals(s, i).total)))));
    renderSheet();
    renderDice();
    renderControls();
    ui.setSubtitle(s.players.some(p => !p.human) ? `Computer ${ui.level()}` : `${s.players.length} Spieler`);
  }

  function renderSheet() {
    const s = S();
    const n = s.players.length;
    const opts = humanTurn() && hasRolled(s) && !busy ? Object.fromEntries(options(s).map(o => [o.cat, o.score])) : {};
    const table = h('table', { class: 'kn-sheet' + (n > 3 ? ' many' : '') });
    const head = h('tr', {}, h('th', { class: 'cat' }, ''), ...s.players.map((p, i) => h('th', { class: i === s.turn ? 'cur' : '' }, youName(i))));
    table.append(head);
    const row = (cat) => {
      const tr = h('tr', { class: 'r-' + cat + (hint && hint.cat === cat ? ' is-hint' : '') });
      tr.append(h('td', { class: 'cat', title: CAT_HINT[cat], onclick: () => toast(`${CAT_NAME[cat]}: ${CAT_HINT[cat]}`, 2600) }, CAT_NAME[cat]));
      for (let i = 0; i < n; i++) {
        const v = s.sheets[i][cat];
        const td = h('td', { class: 'num' + (i === s.turn ? ' cur' : '') });
        if (v !== null) { td.textContent = String(v); if (v === 0) td.classList.add('zero'); }
        else if (i === s.turn && cat in opts) {
          td.classList.add('opt');
          td.textContent = String(opts[cat]);
          if (opts[cat] === 0) td.classList.add('zero');
          td.addEventListener('click', () => onEnter(cat));
          td.setAttribute('role', 'button');
          td.setAttribute('aria-label', `${CAT_NAME[cat]}: ${opts[cat]} Punkte eintragen`);
        }
        tr.append(td);
      }
      return tr;
    };
    const sumRow = (label, f, cls = '') => h('tr', { class: 'sum ' + cls }, h('td', { class: 'cat' }, label), ...s.players.map((_, i) => h('td', { class: 'num' + (i === s.turn ? ' cur' : '') }, String(f(i)))));
    for (const c of UPPER) table.append(row(c));
    table.append(sumRow('Summe oben', i => totals(s, i).upper));
    table.append(sumRow('Bonus (ab 63)', i => { const t = totals(s, i); return t.bonus ? '+35' : (bonusReachable(s.sheets[i]) ? '' : '–'); }, 'bonus'));
    for (const c of CATS.slice(6)) table.append(row(c));
    if (s.opts.joker) table.append(sumRow('Extra-Kniffel', i => (s.extra[i] ? '+' + s.extra[i] * 50 : '')));
    table.append(sumRow('Gesamt', i => totals(s, i).total, 'total'));
    sheetBox.replaceChildren(table);
  }

  function renderDice() {
    const s = S();
    const rolled = hasRolled(s);
    const canHold = humanTurn() && rolled && s.rollsLeft > 0 && !busy;
    tray.replaceChildren(...s.dice.map((v, i) => {
      const held = s.held[i] && rolled;
      const b = h('button', {
        class: 'die' + (held ? ' held' : '') + (!rolled ? ' blank' : '') + (hint && hint.holds && hint.holds[i] ? ' is-hint' : ''),
        'aria-label': rolled ? `Würfel ${v}${held ? ', gehalten' : ''}` : 'Würfel',
        'aria-pressed': String(held), disabled: !canHold,
        html: dieSvg(rolled ? v : 0),
        onclick: () => { s.held[i] = !s.held[i]; hint = hint && hint.cat ? hint : null; persist(); renderDice(); },
      });
      return b;
    }));
  }

  function renderControls() {
    const s = S();
    let txt;
    const acts = [];
    if (s.phase === 'done') {
      txt = winnerText();
      acts.push(h('button', { class: 'btn', onclick: showResult }, 'Ergebnis'), h('button', { class: 'btn btn-primary', onclick: () => startNew(true) }, 'Neues Spiel'));
    } else if (!cur().human || busy) {
      txt = `${youName(s.turn)} würfelt …`;
    } else {
      const who = multiHuman() ? `<b>${cur().name}</b>: ` : '';
      if (!hasRolled(s)) txt = who + 'Würfle!';
      else if (s.rollsLeft > 0) txt = who + 'Tippe Würfel zum Halten an – oder trag oben ein Ergebnis ein.';
      else txt = who + 'Trag dein Ergebnis in ein freies Feld ein.';
      const dots = '●'.repeat(3 - s.rollsLeft) + '○'.repeat(s.rollsLeft);
      acts.push(h('button', { class: 'btn btn-primary roll-btn', disabled: s.rollsLeft === 0, onclick: onRoll },
        s.rollsLeft === 3 ? 'Würfeln' : s.rollsLeft ? `Nochmal würfeln` : 'Keine Würfe mehr', h('small', {}, dots)));
    }
    status.innerHTML = txt;
    controls.replaceChildren(...acts);
  }

  function winnerText() {
    const s = S();
    const tot = s.players.map((_, i) => totals(s, i).total);
    const best = Math.max(...tot);
    const ws = s.players.map((p, i) => i).filter(i => tot[i] === best);
    if (s.players.length === 1) return `Fertig: <b>${best}</b> Punkte.`;
    return ws.length > 1 ? `Unentschieden mit ${best} Punkten.` : `<b>${youName(ws[0])}</b> ${youName(ws[0]) === 'Du' ? 'gewinnst' : 'gewinnt'} mit ${best} Punkten.`;
  }

  // ---------- Spielzüge ----------
  async function animateRoll() {
    const s = S();
    const dice = [...tray.querySelectorAll('.die')];
    const rolling = dice.filter((_, i) => !(s.held[i] && hasRolled(s)) || s.rollsLeft === 3);
    rolling.forEach(d => d.classList.add('rolling'));
    const t0 = Date.now();
    while (Date.now() - t0 < delay(420)) {
      rolling.forEach(d => { d.innerHTML = dieSvg(1 + Math.floor(Math.random() * 6)); });
      await sleep(70);
    }
  }

  async function onRoll() {
    const s = S();
    if (busy || !humanTurn() || s.rollsLeft === 0) return;
    busy = true; hint = null; ui.coach.hide();
    renderControls();
    await animateRoll();
    roll(s);
    busy = false;
    persist(); render();
    if (isKniffel(s.dice)) toast(s.sheets[s.turn].kniffel === 50 && s.opts.joker ? 'Noch ein Kniffel! +50 Bonus' : 'KNIFFEL!', 2600);
    coachOnce('hold', { title: 'Würfel halten', text: 'Tippe die Würfel an, die du behalten willst – sie rutschen hoch. Dann wirf den Rest neu. Du hast drei Würfe pro Runde.', ms: 7000 });
  }

  function onEnter(cat) {
    const s = S();
    if (busy || !humanTurn() || !hasRolled(s)) return;
    const before = totals(s, s.turn);
    const p = s.turn;
    const sugg = ui.coachOn() ? plan(s, 'schwer') : null;
    const v = enter(s, cat);
    hint = null;
    persist();
    feedback(p, cat, v, before, sugg);
    afterMove();
  }

  function feedback(p, cat, v, before, sugg) {
    const s = S();
    if (!ui.coachOn() || !s.players[p].human) return;
    const after = totals(s, p);
    if (!before.bonus && after.bonus) { ui.coach.say({ title: 'Bonus geschafft!', kind: 'good', text: 'Oben hast du 63 Punkte erreicht – das bringt 35 Bonuspunkte.', ms: 5000 }); return; }
    if (sugg && sugg.action === 'enter' && sugg.cat !== cat && s.sheets[p][sugg.cat] === null) {
      ui.coach.say({ title: 'Kleiner Hinweis', kind: 'tip', text: `${CAT_NAME[sugg.cat]} wäre langfristig besser gewesen. ${whyCat(sugg.cat, p)}`, ms: 7000 });
      return;
    }
    if (FACE[cat] && v < FACE[cat] * 3 && bonusReachable(s.sheets[p]) && !after.bonus) {
      coachOnce('par', { title: 'Der Bonus-Trick', text: `Für den Bonus brauchst du oben 63 Punkte – das sind genau <b>drei gleiche</b> pro Zahl. Jetzt fehlen dir noch ${63 - after.upper}.`, ms: 8000 });
    }
  }

  function whyCat(cat, p) {
    const s = S();
    const sc = options(s, p).find(o => o.cat === cat);
    if (sc && sc.score === 0) return `Eine 0 tut dort am wenigsten weh – im Schnitt bringt ${CAT_NAME[cat]} nur etwa ${Math.round(BASE[cat])} Punkte.`;
    if (FACE[cat]) return `${sc ? sc.score : ''} bei den ${CAT_NAME[cat]} hilft dir beim Bonus (Ziel: ${FACE[cat] * 3}).`;
    return `${sc ? sc.score : ''} Punkte sind für dieses Feld ein gutes Ergebnis.`;
  }

  function afterMove() {
    const s = S();
    render();
    if (s.phase === 'done') return finish();
    if (cur().human && multiHuman()) toast(`${cur().name} ist dran`, 1800);
    advance();
  }

  // ---------- Computer ----------
  async function advance() {
    const my = ++token;
    const alive = () => !ui.destroyed && my === token;
    while (alive()) {
      const s = S();
      if (s.phase === 'done' || cur().human) { busy = false; render(); return; }
      busy = true; render();
      await sleep(delay(500));
      if (!alive()) return;
      const lv = cur().level || ui.level();
      const st = aiStep(s, lv);
      if (st.action === 'roll') {
        if (st.keep) { s.held = holdsFor(s.dice, st.keep); renderDice(); await sleep(delay(450)); if (!alive()) return; }
        await animateRoll();
        roll(s);
        persist(); renderDice();
        await sleep(delay(600));
        continue;
      }
      // eintragen – kurz zeigen, wo
      hint = { cat: st.cat };
      renderSheet();
      await sleep(delay(700));
      if (!alive()) return;
      hint = null;
      const p = s.turn;
      const v = enter(s, st.cat);
      persist();
      if (v === 50 && st.cat === 'kniffel') toast(`${s.players[p].name} würfelt einen Kniffel!`);
      render();
      if (s.phase === 'done') { busy = false; return finish(); }
    }
  }

  function finish() {
    const s = S();
    busy = false;
    render();
    if (!g.counted) {
      g.counted = true;
      const tot = s.players.map((_, i) => totals(s, i).total);
      const humans = s.players.map((p, i) => (p.human ? i : -1)).filter(i => i >= 0);
      if (humans.length === 1) {
        const me = humans[0];
        addResult('kniffel', s.players.length === 1 ? true : tot[me] === Math.max(...tot));
        if (tot[me] > load('kniffel:best', 0)) { save('kniffel:best', tot[me]); toast(`Neuer Bestwert: ${tot[me]}!`, 3000); }
      }
      persist();
    }
    showResult();
  }

  async function showResult() {
    const s = S();
    const order = s.players.map((p, i) => ({ i, t: totals(s, i) })).sort((a, b) => b.t.total - a.t.total);
    const content = h('div', { class: 'result' },
      h('p', { class: 'result-big win', html: winnerText() }),
      h('table', { class: 'result-table' }, order.map((x, k) => h('tr', { class: k === 0 ? 'total' : '' },
        h('td', {}, `${k + 1}. ${youName(x.i)}`), h('td', { class: 'small' }, `oben ${x.t.upper}${x.t.bonus ? ' +35' : ''} · unten ${x.t.lower}${x.t.extra ? ' +' + x.t.extra : ''}`),
        h('td', { class: 'num' }, String(x.t.total))))));
    const v = await dialog({ title: 'Endstand', content, buttons: [{ label: 'Block ansehen', value: 'look' }, { label: 'Neues Spiel', value: 'new', primary: true }], dismissable: true });
    if (v === 'new') startNew(true);
  }

  async function startNew(ask = true, entry = false) {
    let players = S().players;
    if (ask) {
      const running = entry && hadSave && S().phase !== 'done';
      const r = await choosePlayers({ title: 'Kniffel – wer spielt?', min: 1, max: 6, current: S().players, entry,
        resume: running ? 'Weiterspielen' : null, resumeSub: running ? `Runde ${S().round} von 13` : '',
        note: 'Allein spielst du auf Bestwert. Gemischt geht auch: Menschen und Computer am selben iPhone.' });
      if (r === 'resume') { advance(); welcome(); return; }
      if (!r) { if (entry) location.hash = '#/'; return; }
      players = r;
    }
    token++; ui.coach.hide();
    fresh(players);
    render();
    advance();
    welcome();
  }

  // ---------- Tipp ----------
  function tip() {
    const s = S();
    if (!humanTurn() || busy) { ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du am Zug bist.', ms: 2500 }); return; }
    if (!hasRolled(s)) { ui.coach.say({ title: 'Erst würfeln', text: 'Am Anfang jeder Runde wirfst du alle fünf Würfel.', actions: [{ label: 'Würfeln', primary: true, onClick: onRoll }] }); return; }
    const pl = plan(s, 'schwer');
    if (pl.action === 'roll') {
      hint = { holds: holdsFor(s.dice, pl.keep) };
      s.held = hint.holds.slice();
      persist(); render();
      ui.coach.say({ title: 'Würfel halten', text: [explainKeep(s.dice, pl.keep, s), `Die markierten Würfel habe ich für dich festgehalten. Jetzt neu würfeln.${pl.now > -Infinity ? '' : ''}`],
        actions: [{ label: 'Würfeln', primary: true, onClick: onRoll }] });
      return;
    }
    hint = { cat: pl.cat };
    render();
    const sc = options(s).find(o => o.cat === pl.cat).score;
    const text = [sc === 0 ? `Streiche ${CAT_NAME[pl.cat]}. ${whyCat(pl.cat, s.turn)}` : `Trage ${sc} bei ${CAT_NAME[pl.cat]} ein. ${whyCat(pl.cat, s.turn)}`];
    if (s.rollsLeft > 0) text.push('Weiterwürfeln lohnt sich hier nicht – das Ergebnis ist schon gut.');
    if (jokerActive(s)) text.push('Joker: Dieser zweite Kniffel zählt auch als Full House oder Straße.');
    ui.coach.say({ title: sc === 0 ? 'Feld streichen' : 'Eintragen', text, actions: [{ label: 'Eintragen', primary: true, onClick: () => onEnter(pl.cat) }] });
  }

  // ---------- Menü ----------
  ui.onTip = tip;
  ui.onNew = () => startNew(true);
  ui.menuExtra = () => {
    const i = h('input', { type: 'checkbox', class: 'switch', onchange: e => ui.setOption('joker', e.target.checked) });
    i.checked = !!ui.option('joker', true);
    return h('div', {},
      h('label', { class: 'switch-row' }, h('span', {}, 'Extra-Kniffel', h('small', {}, 'Jeder weitere Kniffel: +50 und Joker für Full House und Straßen (ab dem nächsten Spiel)')), i),
      h('button', { class: 'btn btn-quiet', style: { marginTop: '8px' }, onclick: () => { save('kniffel:best', 0); toast('Bestwert gelöscht'); render(); } }, 'Bestwert zurücksetzen'));
  };

  function welcome() {
    if (!hasRolled(S()) && S().round === 1 && S().turn === 0) coachOnce('welcome', { title: 'Willkommen beim Kniffel', text: ['Pro Runde hast du drei Würfe. Danach trägst du das Ergebnis in ein freies Feld des Blocks ein – jedes Feld nur einmal.', 'Ziel: möglichst viele Punkte nach 13 Runden. Die Glühbirne sagt dir, was du halten solltest.'], ms: 11000 });
  }

  // Zuerst immer der Startbildschirm: Weiterspielen oder neu (gegen Computer / Menschen).
  const hadSave = !!(g && g.s);
  if (!hadSave) fresh(null, false);
  render();
  startNew(true, true);

  function coachOnce(key, msg) {
    if (!ui.coachOn()) return;
    const k = 'kniffel:tip:' + key;
    if (load(k, false)) return;
    save(k, true);
    ui.coach.say(msg);
  }

  return () => { token++; };
}
