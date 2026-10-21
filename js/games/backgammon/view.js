// Backgammon – Oberfläche
import { h, svgEl, dialog, toast, sleep } from '../../ui.js';
import { load, save, remove, addResult, delay } from '../../store.js';
import {
  newState, cloneState, legalPaths, applyStep, winner, winFactor, pips, persp,
  chooseTurn, rankTurns, aiShouldDouble, aiShouldTake, winProb, turnText, explainTurn,
} from './engine.js';

const W = 380, H = 556, FR = 8, TRAY = 30, BAR = 26;
const COLW = (W - FR * 2 - TRAY - BAR) / 12;
const PL = 212; // Länge der Zungen
const CS = COLW - 1.5; // Steindurchmesser
const MIDY = H / 2;

function colX(col) { return FR + col * COLW + (col >= 6 ? BAR : 0); }
const BARX = FR + 6 * COLW;
const TRAYX = FR + 12 * COLW + BAR;

// Index → Spalte und Reihe (oben/unten)
function place(idx) {
  if (idx >= 12) return { col: idx - 12, top: true };
  return { col: 11 - idx, top: false };
}

function keyOf(s) { return s.pts.join(',') + '|' + s.bar.join(',') + '|' + s.off.join(','); }

export function mount(ui) {
  let g = load('save:backgammon');
  let sel = null, hintSteps = null, busy = false;

  function fresh(keepScore = true) {
    const old = g;
    g = {
      s: newState(), phase: 'start', dice: [], done: [], turnStart: null, paths: [], maxLen: 0,
      score: keepScore && old ? old.score : [0, 0], lastAi: '', over: null, openDice: null,
    };
    persist();
  }
  function persist() { save('save:backgammon', g); }

  // ---------- Aufbau ----------
  const info = h('div', { class: 'bg-info' });
  const boardBox = h('div', { class: 'bg-board' });
  const status = h('div', { class: 'statusline' });
  const controls = h('div', { class: 'bg-controls' });
  ui.stage.append(h('div', { class: 'bg-wrap' }, info, boardBox, status, controls));
  ui.root.style.setProperty('--coach-bottom', '96px');
  boardBox.addEventListener('click', onBoardClick);

  function sizeBoard() {
    const r = ui.stage.getBoundingClientRect();
    const w = Math.min(r.width - 12, (r.height - 150) * (W / H));
    boardBox.style.width = Math.max(260, w) + 'px';
    boardBox.style.height = Math.max(260, w) * (H / W) + 'px';
  }
  const ro = new ResizeObserver(sizeBoard);
  ro.observe(ui.stage);

  // ---------- Zeichnen ----------
  function checker(x, y, side, extra = '') {
    const fill = side === 0 ? '#f6efe1' : '#2b2f3a';
    const ring = side === 0 ? '#c9b48a' : '#c9a24b';
    return `<g ${extra}><circle cx="${x}" cy="${y}" r="${CS / 2}" fill="${fill}" stroke="rgba(0,0,0,.45)" stroke-width="1"/>
      <circle cx="${x}" cy="${y}" r="${CS / 2 - 3.5}" fill="none" stroke="${ring}" stroke-width="1.4" opacity=".9"/></g>`;
  }

  function dieSvg(x, y, v, side, used) {
    const sz = 30;
    const pipsAt = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v] || [];
    const bg = side === 0 ? '#fbf6ec' : '#2b2f3a', pc = side === 0 ? '#1b2130' : '#f4ecdd';
    return `<g opacity="${used ? 0.35 : 1}"><rect x="${x - sz / 2}" y="${y - sz / 2}" width="${sz}" height="${sz}" rx="6" fill="${bg}" stroke="rgba(0,0,0,.4)"/>
      ${pipsAt.map(([a, b]) => `<circle cx="${x + a * 8}" cy="${y + b * 8}" r="3" fill="${pc}"/>`).join('')}</g>`;
  }

  function render() {
    const s = g.s;
    const cands = g.phase === 'move' ? candidates() : [];
    const srcSet = new Set(cands.map(c => String(c.from)));
    const tgts = sel != null ? targetsFrom(sel) : [];
    const tgtSet = new Set(tgts.map(t => String(t.to)));
    const hintFrom = new Set((hintSteps || []).map(x => String(x.from)));
    const hintTo = new Set((hintSteps || []).map(x => String(x.to)));

    let out = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Backgammon-Brett">
    <defs>
      <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a3f2e"/><stop offset="1" stop-color="#3b2a20"/></linearGradient>
      <radialGradient id="fieldg" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#2c6b52"/><stop offset="1" stop-color="#18432f"/></radialGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="url(#wood)"/>
    <rect x="${FR}" y="${FR}" width="${6 * COLW}" height="${H - 2 * FR}" fill="url(#fieldg)"/>
    <rect x="${BARX + BAR}" y="${FR}" width="${6 * COLW}" height="${H - 2 * FR}" fill="url(#fieldg)"/>
    <rect x="${BARX}" y="${FR}" width="${BAR}" height="${H - 2 * FR}" fill="#3a281e"/>
    <rect x="${TRAYX + 2}" y="${FR}" width="${TRAY - 4}" height="${H - 2 * FR}" rx="4" fill="#2a1d16"/>`;

    // Zungen
    for (let idx = 0; idx < 24; idx++) {
      const { col, top } = place(idx);
      const x = colX(col);
      const y0 = top ? FR : H - FR;
      const y1 = top ? FR + PL : H - FR - PL;
      const dark = col % 2 === (top ? 0 : 1);
      const fill = dark ? '#8e1c2e' : '#e9dcc0';
      const isTgt = tgtSet.has(String(idx));
      const isSrc = sel === idx;
      const isHint = hintFrom.has(String(idx)) || hintTo.has(String(idx));
      out += `<path d="M${x + 1} ${y0} L${x + COLW - 1} ${y0} L${x + COLW / 2} ${y1} Z" fill="${fill}" opacity="${dark ? 0.92 : 0.9}"/>`;
      if (isTgt) out += `<path d="M${x + 1} ${y0} L${x + COLW - 1} ${y0} L${x + COLW / 2} ${y1} Z" fill="rgba(127,211,143,.55)"/>`;
      if (isHint) out += `<path d="M${x + 1} ${y0} L${x + COLW - 1} ${y0} L${x + COLW / 2} ${y1} Z" fill="none" stroke="#7fd38f" stroke-width="2.5"/>`;
      if (isSrc) out += `<path d="M${x + 1} ${y0} L${x + COLW - 1} ${y0} L${x + COLW / 2} ${y1} Z" fill="rgba(226,198,126,.35)" stroke="#e2c67e" stroke-width="2"/>`;
      // Punktnummer aus Sicht des Spielers
      const ny = top ? FR - 1.5 : H - 1.5;
      out += `<text x="${x + COLW / 2}" y="${top ? 6.8 : H - 1.2}" font-size="6.5" text-anchor="middle" fill="rgba(244,236,221,.55)" font-family="Jost, sans-serif">${idx + 1}</text>`;
      // Steine
      const n = Math.abs(s.pts[idx]);
      if (n) {
        const side = s.pts[idx] > 0 ? 0 : 1;
        const maxShow = 6;
        const step = n > maxShow ? (PL - CS) / (n - 1) : CS;
        for (let k = 0; k < n; k++) {
          const cy = top ? FR + CS / 2 + k * Math.min(step, CS) : H - FR - CS / 2 - k * Math.min(step, CS);
          out += checker(x + COLW / 2, cy, side);
        }
        if (n > maxShow) {
          const cy = top ? FR + CS / 2 + (n - 1) * step : H - FR - CS / 2 - (n - 1) * step;
          out += `<text x="${x + COLW / 2}" y="${cy + 4}" font-size="11" font-weight="700" text-anchor="middle" fill="${side === 0 ? '#1b2130' : '#f4ecdd'}">${n}</text>`;
        }
        if (srcSet.has(String(idx)) && sel == null && side === 0) {
          const k = n - 1;
          const cy = top ? FR + CS / 2 + Math.min(k, maxShow - 1) * (n > maxShow ? step : CS) : H - FR - CS / 2 - Math.min(k, maxShow - 1) * (n > maxShow ? step : CS);
          out += `<circle cx="${x + COLW / 2}" cy="${n > maxShow ? (top ? FR + CS / 2 + (n - 1) * step : H - FR - CS / 2 - (n - 1) * step) : cy}" r="${CS / 2 + 1.5}" fill="none" stroke="#e2c67e" stroke-width="2" opacity=".85"/>`;
        }
      }
      // Trefferfläche
      out += `<rect data-hit="${idx}" x="${x}" y="${top ? FR : MIDY}" width="${COLW}" height="${MIDY - FR}" fill="transparent"/>`;
    }

    // Bar
    const bx = BARX + BAR / 2;
    for (let k = 0; k < s.bar[1]; k++) out += checker(bx, MIDY - 40 - k * (CS - 4), 1);
    for (let k = 0; k < s.bar[0]; k++) out += checker(bx, MIDY + 40 + k * (CS - 4), 0, sel === 'bar' ? 'opacity="1"' : '');
    if (sel === 'bar') out += `<rect x="${BARX + 1}" y="${MIDY + 20}" width="${BAR - 2}" height="${MIDY - 30}" rx="4" fill="none" stroke="#e2c67e" stroke-width="2"/>`;
    if (srcSet.has('bar') && sel == null) out += `<rect x="${BARX + 1}" y="${MIDY + 20}" width="${BAR - 2}" height="${MIDY - 30}" rx="4" fill="none" stroke="#e2c67e" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    out += `<rect data-hit="bar" x="${BARX}" y="${MIDY}" width="${BAR}" height="${MIDY - FR}" fill="transparent"/>`;

    // Abgetragene Steine (Ablage)
    const tx = TRAYX + TRAY / 2;
    for (let k = 0; k < s.off[0]; k++) out += `<rect x="${TRAYX + 5}" y="${H - FR - 6 - k * 7}" width="${TRAY - 10}" height="5.5" rx="2" fill="#f6efe1" stroke="rgba(0,0,0,.3)" stroke-width=".6"/>`;
    for (let k = 0; k < s.off[1]; k++) out += `<rect x="${TRAYX + 5}" y="${FR + 1 + k * 7}" width="${TRAY - 10}" height="5.5" rx="2" fill="#2b2f3a" stroke="#c9a24b" stroke-width=".6"/>`;
    if (tgtSet.has('off')) out += `<rect x="${TRAYX + 2}" y="${MIDY}" width="${TRAY - 4}" height="${MIDY - FR}" rx="4" fill="rgba(127,211,143,.4)" stroke="#7fd38f" stroke-width="2"/>`;
    if (hintTo.has('off')) out += `<rect x="${TRAYX + 2}" y="${MIDY}" width="${TRAY - 4}" height="${MIDY - FR}" rx="4" fill="none" stroke="#7fd38f" stroke-width="2.5"/>`;
    out += `<rect data-hit="off" x="${TRAYX}" y="${MIDY}" width="${TRAY}" height="${MIDY - FR}" fill="transparent"/>`;

    // Doppelwürfel
    const cy = g.s.cubeOwner === -1 ? MIDY : g.s.cubeOwner === 0 ? MIDY + 70 : MIDY - 70;
    out += `<g><rect x="${tx - 12}" y="${cy - 12}" width="24" height="24" rx="4" fill="#f4ecdd" stroke="#8f6f2a" stroke-width="1.5"/>
      <text x="${tx}" y="${cy + 5}" font-size="${g.s.cube >= 10 || g.s.cubeOwner === -1 ? 10.5 : 13}" font-weight="700" text-anchor="middle" fill="#1b2130">${g.s.cubeOwner === -1 ? 64 : g.s.cube}</text></g>`;

    // Würfel
    if (g.phase === 'start' && g.openDice) {
      out += dieSvg(colX(2) + COLW / 2, MIDY, g.openDice[1], 1, false);
      out += dieSvg(colX(8) + COLW / 2, MIDY, g.openDice[0], 0, false);
    } else if (g.dice.length) {
      const side = g.phase === 'ai' ? 1 : 0;
      const baseX = side === 0 ? colX(9) : colX(3);
      const used = usedDice();
      const list = g.dice[0] === g.dice[1] ? [g.dice[0], g.dice[0], g.dice[0], g.dice[0]] : g.dice;
      const spacing = list.length > 2 ? 30 : 38;
      list.forEach((v, k) => {
        const x = baseX + (k - (list.length - 1) / 2) * spacing;
        out += dieSvg(x, MIDY, v, side, k < used.length ? used[k] : false);
      });
    }
    out += '</svg>';
    boardBox.innerHTML = out;
    renderInfo();
    renderControls();
  }

  function usedDice() {
    // markiert verbrauchte Würfel in Reihenfolge
    const list = g.dice[0] === g.dice[1] ? [g.dice[0], g.dice[0], g.dice[0], g.dice[0]] : g.dice.slice();
    const used = list.map(() => false);
    for (const st of g.done) {
      const k = list.findIndex((v, i) => !used[i] && v === st.die);
      if (k >= 0) used[k] = true;
    }
    return used;
  }

  function renderInfo() {
    const s = g.s;
    info.replaceChildren(
      h('span', {}, 'Du ', h('b', {}, String(g.score[0])), ' : ', h('b', {}, String(g.score[1])), ' Computer'),
      h('span', { class: 'pip' }, `noch ${pips(s, 0)} : ${pips(s, 1)} Augen`));
    ui.setSubtitle(`Computer ${ui.level()}`);
  }

  function renderControls() {
    const btns = [];
    let txt = '';
    if (g.phase === 'start') {
      txt = g.openDice ? (g.openDice[0] > g.openDice[1] ? 'Du beginnst mit diesem Wurf.' : 'Der Computer beginnt.') : 'Wer beginnt? Jeder würfelt einmal.';
      if (!g.openDice) btns.push(h('button', { class: 'btn btn-primary', onclick: openingRoll }, 'Auswürfeln'));
    } else if (g.phase === 'roll') {
      txt = 'Du bist dran.';
      const canDouble = (g.s.cubeOwner === -1 || g.s.cubeOwner === 0) && g.s.cube < 64;
      if (canDouble) btns.push(h('button', { class: 'btn', onclick: playerDoubles }, `Verdoppeln auf ${g.s.cube * 2}`));
      btns.push(h('button', { class: 'btn btn-primary', onclick: playerRoll }, 'Würfeln'));
    } else if (g.phase === 'move') {
      const left = g.maxLen - g.done.length;
      txt = sel != null ? 'Tippe auf ein grün markiertes Ziel.' : left > 0 ? `Wähle einen Stein – noch ${left} ${left === 1 ? 'Zug' : 'Züge'}.` : '';
      if (g.done.length) btns.push(h('button', { class: 'btn', onclick: resetTurn }, 'Rückgängig'));
    } else if (g.phase === 'confirm') {
      txt = 'Zug fertig.';
      btns.push(h('button', { class: 'btn', onclick: resetTurn }, 'Rückgängig'));
      btns.push(h('button', { class: 'btn btn-primary', onclick: confirmTurn }, 'Fertig'));
    } else if (g.phase === 'ai') {
      txt = g.lastAi ? `Computer: ${g.lastAi}` : 'Der Computer ist am Zug …';
    } else if (g.phase === 'over') {
      txt = g.over;
      btns.push(h('button', { class: 'btn btn-primary', onclick: () => { fresh(true); render(); } }, 'Nächste Partie'));
    }
    status.innerHTML = txt;
    controls.replaceChildren(...btns);
  }

  // ---------- Spielerzüge ----------
  function prefixMatches(path) {
    if (path.length < g.done.length) return false;
    for (let i = 0; i < g.done.length; i++) if (String(path[i].from) !== String(g.done[i].from) || String(path[i].to) !== String(g.done[i].to)) return false;
    return true;
  }
  function candidates() {
    const res = [], seen = new Set();
    for (const p of g.paths) {
      if (!prefixMatches(p) || p.length <= g.done.length) continue;
      const st = p[g.done.length];
      const k = st.from + '>' + st.to;
      if (!seen.has(k)) { seen.add(k); res.push(st); }
    }
    return res;
  }
  // Ziele inkl. kombinierter Züge desselben Steins
  function targetsFrom(from) {
    const res = new Map();
    for (const p of g.paths) {
      if (!prefixMatches(p)) continue;
      let cur = from; const seq = [];
      for (let i = g.done.length; i < p.length; i++) {
        const st = p[i];
        if (String(st.from) !== String(cur)) break;
        seq.push(st);
        const k = String(st.to);
        if (!res.has(k) || res.get(k).length > seq.length) res.set(k, seq.slice());
        if (st.to === 'off') break;
        cur = st.to;
      }
    }
    return [...res.entries()].map(([to, steps]) => ({ to: to === 'off' ? 'off' : Number(to), steps }));
  }

  function onBoardClick(e) {
    const hit = e.target.closest('[data-hit]');
    if (!hit || busy) return;
    if (g.phase === 'roll') { playerRoll(); return; }
    if (g.phase !== 'move') return;
    const v = hit.dataset.hit;
    const key = v === 'bar' || v === 'off' ? v : Number(v);
    hintSteps = null;
    if (sel != null) {
      const t = targetsFrom(sel).find(x => String(x.to) === String(key));
      if (t) { doSteps(t.steps); return; }
    }
    const cands = candidates();
    if (cands.some(c => String(c.from) === String(key))) {
      sel = sel === key ? null : key;
      // Nur ein Ziel? Dann sofort ziehen (bequem auf dem Handy)
      if (sel != null) {
        const ts = targetsFrom(sel);
        const singles = ts.filter(t => t.steps.length === 1);
        if (singles.length === 1 && ts.length === 1) { doSteps(singles[0].steps); return; }
      }
    } else sel = null;
    render();
  }

  function doSteps(steps) {
    for (const st of steps) { applyStep(g.s, 0, st); g.done.push(st); }
    sel = null;
    const more = candidates().length > 0;
    g.phase = more ? 'move' : 'confirm';
    // Auto-Auswahl bei Bar
    persist();
    render();
  }

  function resetTurn() {
    if (!g.turnStart) return;
    g.s = cloneState(g.turnStart);
    g.done = [];
    sel = null; hintSteps = null;
    g.phase = 'move';
    persist(); render();
  }

  async function confirmTurn() {
    if (ui.coachOn() && g.paths.length > 1) {
      const ranked = rankTurns(g.turnStart, 0, g.dice, ui.level() === 'schwer');
      const myKey = keyOf(g.s);
      const mine = ranked.find(x => keyOfP(x.t.P) === myKey);
      const best = ranked[0];
      if (mine && best && mine !== best && best.v - mine.v > 7) {
        const reasons = explainTurn(g.turnStart, 0, best.t);
        ui.coach.say({
          title: best.v - mine.v > 18 ? 'Das ist riskant' : 'Es gibt einen besseren Zug',
          kind: 'warn',
          text: [`Stärker wäre <b>${turnText(best.t.steps, 0)}</b>.`, reasons[0]],
          actions: [
            { label: 'Nochmal ziehen', primary: true, onClick: () => { resetTurn(); hintSteps = best.t.steps; render(); } },
            { label: 'So lassen', onClick: () => endPlayerTurn() },
          ],
          onClose: () => endPlayerTurn(),
        });
        return;
      }
      if (mine === best && g.done.some(x => x.hit)) ui.coach.say({ title: 'Treffer', kind: 'good', text: 'Gut – ein geschlagener Stein kostet den Gegner viele Augen.', ms: 2800 });
    }
    endPlayerTurn();
  }

  function keyOfP(P) {
    // Perspektive Seite 0 entspricht echten Indizes
    return P.p.join(',') + '|' + P.bar + ',' + P.obar + '|' + P.off + ',' + P.ooff;
  }

  async function endPlayerTurn() {
    g.done = []; g.dice = []; g.paths = []; g.turnStart = null; sel = null; hintSteps = null;
    if (checkWin()) return;
    g.phase = 'ai'; g.lastAi = '';
    persist(); render();
    await aiTurn();
  }

  function playerRoll() {
    if (g.phase !== 'roll' || busy) return;
    ui.coach.hide();
    startPlayerMove([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
  }

  function startPlayerMove(dice) {
    g.dice = dice;
    const lp = legalPaths(g.s, 0, dice);
    g.paths = lp.paths; g.maxLen = lp.maxLen; g.done = []; g.turnStart = cloneState(g.s);
    if (!lp.maxLen) {
      g.phase = 'move'; render();
      toast(g.s.bar[0] ? 'Du kannst nicht einwürfeln – alle Felder sind zu.' : 'Mit diesem Wurf ist kein Zug möglich.');
      setTimeout(() => endPlayerTurn(), delay(1400));
      persist();
      return;
    }
    g.phase = 'move';
    if (g.s.bar[0]) sel = 'bar';
    persist(); render();
  }

  async function playerDoubles() {
    if (busy) return;
    busy = true;
    await sleep(delay(500));
    const take = aiShouldTake(g.s, 1);
    busy = false;
    if (!take) {
      toast('Der Computer gibt auf.');
      finishGame(0, g.s.cube, 'Der Computer hat dein Verdoppeln abgelehnt');
      return;
    }
    g.s.cube *= 2; g.s.cubeOwner = 1;
    toast(`Der Computer nimmt an – es geht um ${g.s.cube}.`);
    persist(); render();
  }

  // ---------- Computer ----------
  async function aiTurn() {
    busy = true;
    await sleep(delay(500));
    if (ui.destroyed) return;
    // Verdoppeln?
    if (aiShouldDouble(g.s, 1, ui.level())) {
      const p = Math.round(winProb(g.s, 0) * 100);
      if (ui.coachOn()) ui.coach.say({ title: 'Verdoppeln – was nun?', text: [`Ich schätze deine Gewinnchance auf etwa <b>${p} %</b>.`, p >= 25 ? 'Ab etwa 25 % lohnt es sich anzunehmen.' : 'Unter 25 % ist Aufgeben meist günstiger.'] });
      const r = await dialog({
        title: `Der Computer verdoppelt auf ${g.s.cube * 2}`,
        body: `Nimmst du an, geht es um ${g.s.cube * 2} Punkte und du bekommst den Doppelwürfel. Gibst du auf, verlierst du ${g.s.cube}.`,
        buttons: [{ label: 'Aufgeben', value: 'drop' }, { label: 'Annehmen', value: 'take', primary: true }],
      });
      ui.coach.hide();
      if (r === 'drop') { busy = false; finishGame(1, g.s.cube, 'Du hast das Verdoppeln abgelehnt'); return; }
      g.s.cube *= 2; g.s.cubeOwner = 0;
      persist(); render();
      await sleep(delay(300));
    }
    g.dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    await runAiMove();
  }

  async function runAiMove() {
    g.done = [];
    render();
    await sleep(delay(700));
    const t = chooseTurn(g.s, 1, g.dice, ui.level());
    if (!t) {
      g.lastAi = `${g.dice.join('-')} – kein Zug möglich`;
    } else {
      for (const st of t.steps) {
        applyStep(g.s, 1, st);
        g.done.push(st);
        render();
        await sleep(delay(420));
        if (ui.destroyed) return;
      }
      g.lastAi = `${g.dice.join('-')}: ${turnText(t.steps, 1)}`;
    }
    busy = false;
    g.done = [];
    if (checkWin()) return;
    g.phase = 'roll';
    const hits = t ? t.steps.filter(x => x.hit).length : 0;
    persist(); render();
    // Hinweis des Trainers
    if (ui.coachOn() && hits) ui.coach.say({ title: 'Getroffen', kind: 'warn', text: 'Dein Stein liegt auf der Bar. Du musst ihn zuerst wieder im Heimfeld des Computers (oben rechts) einwürfeln, bevor du etwas anderes ziehen darfst.', ms: 6000 });
  }

  function checkWin() {
    const w = winner(g.s);
    if (w < 0) return false;
    const f = winFactor(g.s, w);
    finishGame(w, g.s.cube * f, f === 3 ? 'Backgammon!' : f === 2 ? 'Gammon!' : '');
    return true;
  }

  async function finishGame(w, points, why) {
    g.score[w] += points;
    g.phase = 'over';
    const txt = `${w === 0 ? 'Du gewinnst' : 'Der Computer gewinnt'} ${points} ${points === 1 ? 'Punkt' : 'Punkte'}${why ? ' – ' + why : ''}.`;
    g.over = txt;
    addResult('backgammon', w === 0);
    persist(); render();
    await sleep(400);
    const r = await dialog({
      title: w === 0 ? 'Gewonnen!' : 'Verloren',
      body: `${txt}<br>Stand: Du ${g.score[0]} : ${g.score[1]} Computer.`,
      buttons: [{ label: 'Brett ansehen', value: 'look' }, { label: 'Nächste Partie', value: 'next', primary: true }],
    });
    if (r === 'next') { fresh(true); render(); }
  }

  // ---------- Eröffnung ----------
  async function openingRoll() {
    let a, b;
    do { a = 1 + Math.floor(Math.random() * 6); b = 1 + Math.floor(Math.random() * 6); } while (a === b);
    g.openDice = [a, b];
    render();
    await sleep(delay(1300));
    if (ui.destroyed) return;
    g.openDice = null;
    if (a > b) startPlayerMove([a, b]);
    else { g.phase = 'ai'; g.dice = [a, b]; busy = true; persist(); await runAiMove(); }
  }

  // ---------- Tipp ----------
  function tip() {
    if (g.phase === 'roll') {
      const p = Math.round(winProb(g.s, 0) * 100);
      const canDouble = (g.s.cubeOwner === -1 || g.s.cubeOwner === 0) && g.s.cube < 64;
      ui.coach.say({ title: 'Lage vor dem Wurf', text: [
        `Deine Gewinnchance schätze ich auf etwa <b>${p} %</b> (Augen: du ${pips(g.s, 0)}, Computer ${pips(g.s, 1)}).`,
        canDouble ? (p >= 70 ? 'Das ist stark genug zum <b>Verdoppeln</b>.' : 'Zum Verdoppeln brauchst du etwa 70 %. Erst mal würfeln.') : 'Den Doppelwürfel hat gerade der Computer.'] });
      return;
    }
    if (g.phase !== 'move' && g.phase !== 'confirm') { ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du am Zug bist.', ms: 2500 }); return; }
    const ranked = rankTurns(g.turnStart, 0, g.dice, true);
    if (!ranked.length) return;
    const best = ranked[0].t;
    hintSteps = best.steps;
    render();
    ui.coach.say({
      title: 'Vorschlag: ' + turnText(best.steps, 0),
      text: explainTurn(g.turnStart, 0, best).slice(0, 2),
      actions: [{ label: 'Ausführen', primary: true, onClick: async () => {
        resetTurn();
        hintSteps = null;
        for (const st of best.steps) { doSteps([st]); await sleep(delay(250)); }
      } }],
    });
  }

  ui.onTip = tip;
  ui.onNew = async () => {
    const r = await dialog({ title: 'Neue Partie?', body: 'Die laufende Partie wird abgebrochen. Der Punktestand bleibt erhalten.', buttons: [{ label: 'Abbrechen', value: false }, { label: 'Neue Partie', value: true, primary: true }] });
    if (r) { ui.coach.hide(); fresh(true); busy = false; render(); }
  };
  ui.menuExtra = () => h('div', { class: 'btn-row', style: { justifyContent: 'flex-start', marginTop: '6px' } },
    h('button', { class: 'btn btn-quiet', onclick: e => { g.score = [0, 0]; persist(); render(); e.target.textContent = 'Punktestand ist zurückgesetzt'; } }, 'Punktestand zurücksetzen'));

  if (!g) fresh(false);
  // Laufender Computerzug nach Neustart: neu würfeln
  if (g.phase === 'ai') { g.phase = 'roll'; g.dice = []; g.done = []; persist(); setTimeout(() => { g.phase = 'ai'; aiTurn(); }, 300); }
  if (g.phase === 'start') g.openDice = null;
  render();
  requestAnimationFrame(sizeBoard);
  if (ui.coachOn() && g.phase === 'start' && g.score[0] + g.score[1] === 0) {
    ui.coach.say({ title: 'So geht’s', text: 'Du spielst die hellen Steine und ziehst gegen den Uhrzeigersinn nach unten rechts in dein Heimfeld. Tippe einen Stein an, dann das grüne Ziel.', ms: 9000 });
  }
  return () => ro.disconnect();
}
