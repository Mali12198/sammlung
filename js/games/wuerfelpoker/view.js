// Würfelpoker – Oberfläche
import { h, dialog, toast, sleep } from '../../ui.js';
import { load, save, addResult, delay } from '../../store.js';
import { choosePlayers, rulesForm } from '../../players.js';
import {
  newGame, roll, enter, options, totals, hasRolled, plan, holdsFor, aiStep, explainKeep, jokerActive,
  CATS, UPPER, CAT_NAME, CAT_HINT, BASE, FACE, isPoker, bonusReachable, colKey, nCols, roundsTotal,
} from './engine.js';

const RULE_INFO = {
  triple: { label: 'Dreifach', text: 'Drei Spalten, die einfach, doppelt und dreifach zählen – 39 Runden, viel mehr Taktik' },
};

const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]] };
export const dieSvg = v => `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="4" y="4" width="92" height="92" rx="20" class="die-face"/>${(PIPS[v] || []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5" class="die-pip"/>`).join('')}</svg>`;

export function mount(ui) {
  let g = load('save:wuerfelpoker');
  let token = 0, busy = false, hint = null; // hint: { holds:[bool], cat }

  function fresh(players, keep = true, rules = null) {
    const pl = players || (g && g.s.players) || [{ name: 'Du', human: true }, { name: 'Lotte', human: false }];
    const triple = rules ? !!rules.triple : (g && g.s ? !!g.s.opts.triple : !!ui.option('triple', false));
    g = { s: newGame(pl, { joker: ui.option('joker', true), triple }), counted: false };
    hint = null;
    if (keep) persist();
  }
  function persist() { save('save:wuerfelpoker', g); }

  // ---------- Aufbau ----------
  const wrap = h('div', { class: 'dice-game wuerfelpoker' });
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
  const bestKey = () => (g && g.s && nCols(g.s) > 1 ? 'wuerfelpoker:best3' : 'wuerfelpoker:best');
  const cur = () => S().players[S().turn];
  const humanTurn = () => S().phase !== 'done' && cur().human;
  const multiHuman = () => S().players.filter(p => p.human).length > 1;
  const youName = p => (S().players[p].human && !multiHuman() ? 'Du' : S().players[p].name);

  // ---------- Darstellung ----------
  function render() {
    const s = S();
    top.replaceChildren(...[
      h('span', { class: 'trump-pill static' }, s.phase === 'done' ? 'Spiel beendet' : `Runde ${Math.min(s.round, roundsTotal(s))} von ${roundsTotal(s)}${nCols(s) > 1 ? ' · Dreifach' : ''}`),
      s.players.length === 1 ? h('span', { class: 'trump-pill static' }, `Bestwert: ${load(bestKey(), 0) || '–'}`) : null].filter(Boolean));
    chips.replaceChildren(...s.players.map((p, i) => h('div', { class: 'dg-chip' + (i === s.turn && s.phase !== 'done' ? ' on' : '') + (p.human ? ' human' : '') },
      h('span', { class: 'turn-dot' }), h('b', {}, youName(i)), h('span', { class: 'pts' }, String(totals(s, i).total)))));
    renderSheet();
    renderDice();
    renderControls();
    ui.setSubtitle(s.players.some(p => !p.human) ? `Computer ${ui.level()}` : `${s.players.length} Spieler`);
  }

  function renderSheet() {
    const s = S();
    if (nCols(s) > 1) return renderTripleSheet();
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
    if (s.opts.joker) table.append(sumRow('Extra-Poker', i => (s.extra[i] ? '+' + s.extra[i] * 50 : '')));
    table.append(sumRow('Gesamt', i => totals(s, i).total, 'total'));
    sheetBox.replaceChildren(table);
  }

  // Dreifach: die drei Spalten des Spielers, der gerade dran ist
  function renderTripleSheet() {
    const s = S();
    const p = s.phase === 'done' ? (s.players.findIndex(x => x.human) >= 0 ? s.players.findIndex(x => x.human) : 0) : s.turn;
    const sh = s.sheets[p];
    const mine = p === s.turn && humanTurn() && hasRolled(s) && !busy;
    const opts = mine ? Object.fromEntries(options(s).map(o => [o.key, o.score])) : {};
    const tt = totals(s, p);
    const table = h('table', { class: 'kn-sheet triple' });
    table.append(h('tr', {}, h('th', { class: 'cat' }, youName(p)), ...[0, 1, 2].map(k => h('th', { class: 'cur' }, `× ${k + 1}`))));
    const row = cat => {
      const tr = h('tr', { class: 'r-' + cat });
      tr.append(h('td', { class: 'cat', onclick: () => toast(`${CAT_NAME[cat]}: ${CAT_HINT[cat]}`, 2600) }, CAT_NAME[cat]));
      for (let k = 0; k < 3; k++) {
        const key = colKey(cat, k);
        const v = sh[key];
        const td = h('td', { class: 'num' + (hint && hint.cat === cat && hint.col === k ? ' hint-cell' : '') });
        if (v !== null) { td.textContent = String(v); if (v === 0) td.classList.add('zero'); }
        else if (key in opts) {
          td.classList.add('opt');
          td.textContent = String(opts[key]);
          if (opts[key] === 0) td.classList.add('zero');
          td.addEventListener('click', () => onEnter(cat, k));
          td.setAttribute('role', 'button');
          td.setAttribute('aria-label', `${CAT_NAME[cat]}, Spalte ${k + 1}: ${opts[key]} Punkte eintragen`);
        }
        tr.append(td);
      }
      return tr;
    };
    const sumRow = (label, f, cls = '') => h('tr', { class: 'sum ' + cls }, h('td', { class: 'cat' }, label), ...[0, 1, 2].map(k => h('td', { class: 'num' }, String(f(k)))));
    for (const c of UPPER) table.append(row(c));
    table.append(sumRow('Summe oben', k => tt.cols[k].upper));
    table.append(sumRow('Bonus (ab 63)', k => (tt.cols[k].bonus ? '+35' : bonusReachable(sh, k) ? '' : '–'), 'bonus'));
    for (const c of CATS.slice(6)) table.append(row(c));
    table.append(sumRow('Spalte', k => tt.cols[k].sum));
    table.append(sumRow('Gewertet', k => tt.cols[k].sum * (k + 1)));
    if (s.opts.joker && s.extra[p]) table.append(h('tr', { class: 'sum' }, h('td', { class: 'cat' }, 'Extra-Poker'), h('td', { class: 'num', colspan: '3' }, '+' + s.extra[p] * 50)));
    table.append(h('tr', { class: 'sum total' }, h('td', { class: 'cat' }, 'Gesamt'), h('td', { class: 'num', colspan: '3' }, String(tt.total))));
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
    if (isPoker(s.dice)) toast(s.sheets[s.turn].poker === 50 && s.opts.joker ? 'Noch ein Poker! +50 Bonus' : 'POKER!', 2600);
    coachOnce('hold', { title: 'Würfel halten', text: 'Tippe die Würfel an, die du behalten willst – sie rutschen hoch. Dann wirf den Rest neu. Du hast drei Würfe pro Runde.', ms: 7000 });
  }

  function onEnter(cat, col = 0) {
    const s = S();
    if (busy || !humanTurn() || !hasRolled(s)) return;
    const before = totals(s, s.turn);
    const p = s.turn;
    const sugg = ui.coachOn() ? plan(s, 'schwer') : null;
    const v = enter(s, cat, col);
    hint = null;
    persist();
    feedback(p, cat, v, before, sugg, col);
    afterMove();
  }

  const colName = k => (nCols(S()) > 1 ? ` (Spalte ×${k + 1})` : '');

  function feedback(p, cat, v, before, sugg, col = 0) {
    const s = S();
    if (!ui.coachOn() || !s.players[p].human) return;
    const after = totals(s, p);
    if (after.cols.some((c, k) => c.bonus && !before.cols[k].bonus)) { ui.coach.say({ title: 'Bonus geschafft!', kind: 'good', text: 'Oben hast du 63 Punkte erreicht – das bringt 35 Bonuspunkte.', ms: 5000 }); return; }
    if (sugg && sugg.action === 'enter' && (sugg.cat !== cat || (sugg.col || 0) !== col) && s.sheets[p][colKey(sugg.cat, sugg.col || 0)] === null) {
      ui.coach.say({ title: 'Kleiner Hinweis', kind: 'tip', text: `${CAT_NAME[sugg.cat]}${colName(sugg.col || 0)} wäre langfristig besser gewesen. ${whyCat(sugg.cat, p, sugg.col || 0)}`, ms: 7000 });
      return;
    }
    if (FACE[cat] && v < FACE[cat] * 3 && bonusReachable(s.sheets[p], col) && !after.cols[col].bonus) {
      coachOnce('par', { title: 'Der Bonus-Trick', text: `Für den Bonus brauchst du oben 63 Punkte – das sind genau <b>drei gleiche</b> pro Zahl. Jetzt fehlen dir noch ${63 - after.cols[col].upper}.`, ms: 8000 });
    }
  }

  function whyCat(cat, p, col = 0) {
    const s = S();
    const sc = options(s, p).find(o => o.cat === cat && o.col === col);
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
      hint = { cat: st.cat, col: st.col || 0 };
      renderSheet();
      await sleep(delay(700));
      if (!alive()) return;
      hint = null;
      const p = s.turn;
      const v = enter(s, st.cat, st.col || 0);
      persist();
      if (v === 50 && st.cat === 'poker') toast(`${s.players[p].name} würfelt einen Poker!`);
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
        addResult('wuerfelpoker', s.players.length === 1 ? true : tot[me] === Math.max(...tot));
        if (tot[me] > load(bestKey(), 0)) { save(bestKey(), tot[me]); toast(`Neuer Bestwert: ${tot[me]}!`, 3000); }
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
        h('td', {}, `${k + 1}. ${youName(x.i)}`), h('td', { class: 'small' }, nCols(s) > 1 ? x.t.cols.map(c => `${c.sum}×${c.mult}`).join(' + ') + (x.t.extra ? ' +' + x.t.extra : '') : `oben ${x.t.upper}${x.t.bonus ? ' +35' : ''} · unten ${x.t.lower}${x.t.extra ? ' +' + x.t.extra : ''}`),
        h('td', { class: 'num' }, String(x.t.total))))));
    const v = await dialog({ title: 'Endstand', content, buttons: [{ label: 'Block ansehen', value: 'look' }, { label: 'Neues Spiel', value: 'new', primary: true }], dismissable: true });
    if (v === 'new') startNew(true);
  }

  async function startNew(ask = true, entry = false) {
    let players = S().players;
    let rules = null;
    if (ask) {
      const running = entry && hadSave && S().phase !== 'done';
      const form = rulesForm(RULE_INFO, { triple: !!ui.option('triple', false) }, 'Variante');
      const r = await choosePlayers({ title: 'Würfelpoker – wer spielt?', min: 1, max: 6, current: S().players, entry,
        resume: running ? 'Weiterspielen' : null, resumeSub: running ? `Runde ${S().round} von ${roundsTotal(S())}` : '',
        note: 'Allein spielst du auf Bestwert. Gemischt geht auch: Menschen und Computer am selben iPhone.', extra: form.el });
      if (r === 'resume') { advance(); welcome(); return; }
      if (!r) { if (entry) location.hash = '#/'; return; }
      players = r;
      rules = form.value();
      ui.setOption('triple', !!rules.triple);
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
    const col = pl.col || 0;
    hint = { cat: pl.cat, col };
    render();
    const sc = options(s).find(o => o.cat === pl.cat && o.col === col).score;
    const where = `${CAT_NAME[pl.cat]}${colName(col)}`;
    const text = [sc === 0 ? `Streiche ${where}. ${whyCat(pl.cat, s.turn, col)}` : `Trage ${sc} bei ${where} ein. ${whyCat(pl.cat, s.turn, col)}`];
    if (nCols(s) > 1) text.push(col === 2 ? 'Gute Ergebnisse gehören in die ×3-Spalte.' : col === 0 && sc < BASE[pl.cat] ? 'Schwache Würfe und Nullen kommen in die ×1-Spalte – dort kosten sie am wenigsten.' : '');
    if (s.rollsLeft > 0) text.push('Weiterwürfeln lohnt sich hier nicht – das Ergebnis ist schon gut.');
    if (jokerActive(s)) text.push('Joker: Dieser zweite Poker zählt auch als Full House oder Straße.');
    ui.coach.say({ title: sc === 0 ? 'Feld streichen' : 'Eintragen', text: text.filter(Boolean), actions: [{ label: 'Eintragen', primary: true, onClick: () => onEnter(pl.cat, col) }] });
  }

  // ---------- Menü ----------
  ui.onTip = tip;
  ui.onNew = () => startNew(true);
  ui.menuExtra = () => {
    const i = h('input', { type: 'checkbox', class: 'switch', onchange: e => ui.setOption('joker', e.target.checked) });
    i.checked = !!ui.option('joker', true);
    return h('div', {},
      h('label', { class: 'switch-row' }, h('span', {}, 'Extra-Poker', h('small', {}, 'Jeder weitere Poker: +50 und Joker für Full House und Straßen (ab dem nächsten Spiel)')), i),
      h('button', { class: 'btn btn-quiet', style: { marginTop: '8px' }, onclick: () => { save(bestKey(), 0); toast('Bestwert gelöscht'); render(); } }, 'Bestwert zurücksetzen'));
  };

  function welcome() {
    if (!hasRolled(S()) && S().round === 1 && S().turn === 0) coachOnce('welcome', { title: 'Willkommen beim Würfelpoker', text: ['Pro Runde hast du drei Würfe. Danach trägst du das Ergebnis in ein freies Feld des Blocks ein – jedes Feld nur einmal.', nCols(S()) > 1 ? 'Dreifach: Jede Zeile gibt es dreimal – ×1, ×2 und ×3. Gute Würfe in die ×3-Spalte, schwache in die ×1-Spalte. 39 Runden.' : 'Ziel: möglichst viele Punkte nach 13 Runden. Die Glühbirne sagt dir, was du halten solltest.'], ms: 11000 });
  }

  // Zuerst immer der Startbildschirm: Weiterspielen oder neu (gegen Computer / Menschen).
  const hadSave = !!(g && g.s);
  if (!hadSave) fresh(null, false);
  render();
  startNew(true, true);

  function coachOnce(key, msg) {
    if (!ui.coachOn()) return;
    const k = 'wuerfelpoker:tip:' + key;
    if (load(k, false)) return;
    save(k, true);
    ui.coach.say(msg);
  }

  return () => { token++; };
}
