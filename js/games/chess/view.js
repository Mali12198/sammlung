// Schach – Oberfläche
import { h, svgEl, dialog, toast, sleep } from '../../ui.js';
import { load, save, remove, addResult, delay } from '../../store.js';
import {
  START_FEN, fromFEN, toFEN, cloneState, legalMoves, makeMove, gameStatus, san, inCheck, kingSq,
  aiMove, search, scoreMove, explainMove, hangingPieces, sqName, colorOf, typeOf, PIECE_DE, VAL, isMateScore, mateIn,
} from './engine.js';

const LEVEL_NAME = { leicht: 'leicht', mittel: 'mittel', schwer: 'schwer' };

function pieceSvg(p) {
  const white = colorOf(p) === 'w';
  return svgEl(`<svg class="piece ${white ? 'pw' : 'pb'}" viewBox="0 0 100 100" aria-hidden="true"><use href="#p-${typeOf(p)}"/></svg>`);
}

export function mount(ui) {
  let g = load('save:schach') || null;
  let st, sel = null, busy = false, hint = null, flipped = false;
  const ui$ = {};

  function fresh(color, mode = 'cpu', names = null, flip = false) {
    g = { fens: [START_FEN], sans: [], last: [], player: color, over: null, mode, names: names || { w: 'Weiß', b: 'Schwarz' }, flip };
    persist();
  }
  const two = () => g.mode === 'two';
  const COLOR_DE = { w: 'Weiß', b: 'Schwarz' };
  const nameOfColor = c => (two() ? g.names[c] : (c === g.player ? 'Du' : 'Computer'));
  function persist() { if (g && !g.over) save('save:schach', g); else remove('save:schach'); }
  const cur = () => fromFEN(g.fens[g.fens.length - 1]);
  const positions = () => g.fens.map(f => f.split(' ').slice(0, 4).join(' '));

  // ---------- Aufbau ----------
  const board = h('div', { class: 'chessboard', role: 'grid', 'aria-label': 'Schachbrett' });
  const topRow = h('div', { class: 'chess-player' });
  const botRow = h('div', { class: 'chess-player' });
  const moveList = h('div', { class: 'chess-moves', 'aria-label': 'Zugliste' });
  const status = h('div', { class: 'statusline' });
  const actions = h('div', { class: 'chess-actions' },
    h('button', { class: 'btn', onclick: () => undo() }, 'Zurücknehmen'),
    h('button', { class: 'btn btn-primary', onclick: () => tip() }, 'Tipp'));
  const wrap = h('div', { class: 'chess-wrap' }, topRow, board, botRow, status, moveList, actions);
  ui.stage.append(wrap);
  ui.root.style.setProperty('--coach-bottom', window.innerHeight < 740 ? '10px' : '120px');

  const squares = [];
  for (let i = 0; i < 64; i++) {
    const sq = h('div', { class: 'sq', role: 'gridcell' });
    sq.addEventListener('click', () => onSquare(Number(sq.dataset.i)));
    squares.push(sq);
    board.append(sq);
  }

  function sizeBoard() {
    const r = ui.stage.getBoundingClientRect();
    const avail = Math.min(r.width - 16, r.height - 230);
    board.style.setProperty('--bs', Math.max(240, Math.floor(avail / 8) * 8) + 'px');
  }
  const ro = new ResizeObserver(sizeBoard);
  ro.observe(ui.stage);

  // ---------- Darstellung ----------
  function render() {
    st = cur();
    flipped = two() ? (g.flip && st.turn === 'b') : g.player === 'b';
    const legal = sel != null ? legalMoves(st).filter(m => m.from === sel) : [];
    const last = g.last.length ? g.last[g.last.length - 1] : null;
    const chk = inCheck(st) ? kingSq(st.b, st.turn) : -1;
    for (let vi = 0; vi < 64; vi++) {
      const i = flipped ? 63 - vi : vi;
      const el = squares[vi];
      el.dataset.i = i;
      const r = i >> 3, f = i & 7;
      el.className = 'sq ' + ((r + f) % 2 ? 'dk' : 'lt');
      if (last && (last[0] === i || last[1] === i)) el.classList.add('last');
      if (sel === i) el.classList.add('sel');
      if (i === chk) el.classList.add('check');
      if (hint && (hint.from === i || hint.to === i)) el.classList.add('hint');
      const tgt = legal.find(m => m.to === i);
      if (tgt) el.classList.add(st.b[i] || tgt.flag === 'e' ? 'cap' : 'dot');
      el.replaceChildren();
      if (st.b[i]) el.append(pieceSvg(st.b[i]));
      const vr = vi >> 3, vf = vi & 7;
      if (vf === 0) el.append(h('span', { class: 'co co-r' }, String(8 - r)));
      if (vr === 7) el.append(h('span', { class: 'co co-f' }, 'abcdefgh'[f]));
      el.setAttribute('aria-label', sqName(i) + (st.b[i] ? ' ' + (colorOf(st.b[i]) === 'w' ? 'weißer ' : 'schwarzer ') + PIECE_DE[typeOf(st.b[i])] : ''));
    }
    renderPlayers();
    renderMoves();
    const stt = g.over;
    if (stt) status.innerHTML = `<b>${stt.reason}</b> – ${stt.result === '½-½' ? 'Remis' : two() ? `${nameOfColor(stt.result === '1-0' ? 'w' : 'b')} gewinnt` : (stt.result === '1-0') === (g.player === 'w') ? 'du hast gewonnen' : 'der Computer hat gewonnen'}`;
    else if (busy) status.textContent = 'Der Computer überlegt …';
    else if (two()) status.innerHTML = `${inCheck(st) ? '<b>Schach!</b> ' : ''}<b>${nameOfColor(st.turn)}</b> (${COLOR_DE[st.turn]}) ist am Zug.`;
    else status.innerHTML = st.turn === g.player ? (inCheck(st) ? '<b>Schach!</b> Du bist am Zug.' : 'Du bist am Zug.') : 'Der Computer ist am Zug.';
    ui.setSubtitle(two() ? 'Zu zweit' : `Computer ${LEVEL_NAME[ui.level()]}`);
  }

  function material(color) {
    const start = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
    const have = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
    for (const p of st.b) if (p && colorOf(p) === color && typeOf(p) !== 'K') have[typeOf(p)]++;
    const lost = [];
    for (const t of 'QRBNP') for (let k = have[t]; k < start[t]; k++) lost.push(t);
    const val = Object.entries(have).reduce((a, [t, n]) => a + n * VAL[t], 0);
    return { lost, val };
  }

  function renderPlayers() {
    const me = two() ? (flipped ? 'b' : 'w') : g.player, ai = me === 'w' ? 'b' : 'w';
    const mMe = material(me), mAi = material(ai);
    const row = (el, name, color, capturedFrom, diff) => {
      const caps = h('span', { class: 'caps' }, capturedFrom.lost.map(t => pieceSvg(color === 'w' ? t.toLowerCase() : t)));
      el.replaceChildren(
        h('span', { class: 'who' + (st.turn === color && !g.over ? ' on' : '') }, h('i', { class: 'swatch ' + color }), name),
        caps, diff > 0 ? h('span', { class: 'adv' }, '+' + Math.round(diff / 100)) : '');
    };
    row(topRow, nameOfColor(ai), ai, mMe, mAi.val - mMe.val);
    row(botRow, nameOfColor(me), me, mAi, mMe.val - mAi.val);
  }

  function renderMoves() {
    const items = [];
    const startFull = 1;
    for (let i = 0; i < g.sans.length; i++) {
      if (i % 2 === 0) items.push(h('span', { class: 'mn' }, (startFull + i / 2) + '.'));
      items.push(h('span', { class: 'mv' + (i === g.sans.length - 1 ? ' cur' : '') }, g.sans[i]));
    }
    moveList.replaceChildren(...(items.length ? items : [h('span', { class: 'mv muted' }, 'Noch keine Züge')]));
    moveList.scrollLeft = moveList.scrollWidth;
  }

  // ---------- Züge ----------
  async function onSquare(i) {
    if (busy || g.over) return;
    st = cur();
    if (!two() && st.turn !== g.player) { ui.coach.hide(); computerTurn(); return; }
    const p = st.b[i];
    if (sel != null) {
      const cands = legalMoves(st).filter(m => m.from === sel && m.to === i);
      if (cands.length) {
        let m = cands[0];
        if (cands.length > 1) {
          const t = await dialog({ title: 'Umwandlung', body: 'In welche Figur soll dein Bauer werden?', layout: 'list', buttons: [
            { label: 'Dame', value: 'Q', primary: true }, { label: 'Turm', value: 'R' }, { label: 'Läufer', value: 'B' }, { label: 'Springer', value: 'N' }] });
          m = cands.find(x => typeOf(x.promo) === (t || 'Q'));
        }
        sel = null; hint = null;
        await playerMove(m);
        return;
      }
    }
    if (p && colorOf(p) === (two() ? st.turn : g.player)) {
      sel = sel === i ? null : i;
      render();
    } else if (sel != null) { sel = null; render(); }
  }

  function apply(m) {
    const s = cur();
    const notation = san(s, m);
    makeMove(s, m);
    g.fens.push(toFEN(s));
    g.sans.push(notation);
    g.last.push([m.from, m.to]);
    const res = gameStatus(s, positions());
    if (res.over) g.over = res;
    persist();
    return notation;
  }

  async function playerMove(m) {
    const before = cur();
    let review = null;
    if (ui.coachOn() && g.sans.length >= 0) {
      busy = true; render(); await sleep(20);
      review = reviewMove(before, m);
      busy = false;
    }
    apply(m);
    render();
    if (g.over) return finish();
    if (review) {
      ui.coach.say(review);
      if (review.kind === 'warn') return; // Spieler entscheidet: zurücknehmen oder weiter
    } else ui.coach.hide();
    if (two()) { if (g.flip) toast(`${nameOfColor(cur().turn)} ist dran`, 1400); return; }
    await computerTurn();
  }

  function reviewMove(before, m) {
    const best = search(before, { depth: 3, timeMs: 450 });
    if (!best) return null;
    const bestScore = best.score;
    const same = best.move.from === m.from && best.move.to === m.to && best.move.promo === m.promo;
    const played = same ? bestScore : scoreMove(before, m, 3);
    const loss = bestScore - played;
    const bestSan = san(before, best.move);
    if (!same && loss >= 150 && !(isMateScore(played) && played > 0)) {
      const severe = loss >= 300;
      const reasons = explainMove(before, best.move);
      let why = '';
      const after = cloneState(before); makeMove(after, m);
      const hang = hangingPieces(after, before.turn);
      if (isMateScore(played) && played < 0) why = 'Danach kann der Computer dich mattsetzen.';
      else if (hang.length) why = `Danach steht ${hang.map(x => 'dein ' + PIECE_DE[typeOf(x.piece)] + ' auf ' + sqName(x.sq)).slice(0, 2).join(' und ')} ungeschützt.`;
      else why = severe ? 'Damit verlierst du Material.' : 'Es gibt einen deutlich besseren Zug.';
      return {
        title: severe ? 'Vorsicht, das kostet etwas' : 'Da geht mehr',
        kind: 'warn',
        text: [why, `Besser war <b>${bestSan}</b>.${reasons[0] ? ' ' + reasons[0] : ''}`],
        actions: [
          { label: 'Zurücknehmen', primary: true, onClick: () => { undo(1, true); } },
          { label: 'Trotzdem weiter', onClick: () => computerTurn() },
        ],
        onClose: () => computerTurn(),
      };
    }
    if (same || loss < 20) {
      const r = explainMove(before, m);
      if (r.length && (m.captured || /Gabel|Schach|Matt|Rochade/.test(r[0]))) return { title: 'Gut gespielt', kind: 'good', text: r[0], ms: 3500 };
    }
    return null;
  }

  async function computerTurn() {
    if (two()) return;
    st = cur();
    if (g.over || st.turn === g.player) return;
    busy = true; render();
    await sleep(delay(350));
    if (ui.destroyed) return;
    const m = aiMove(cur(), ui.level());
    busy = false;
    if (!m) return;
    apply(m);
    render();
    if (g.over) return finish();
    // Trainer: Bedrohungen melden
    if (ui.coachOn()) {
      const s = cur();
      const hang = hangingPieces(s, g.player).filter(x => VAL[typeOf(x.piece)] >= 300);
      if (inCheck(s)) ui.coach.say({ title: 'Schach!', kind: 'warn', text: 'Dein König wird angegriffen. Du kannst ihn wegziehen, dazwischenziehen oder den Angreifer schlagen.', ms: 5000 });
      else if (hang.length) ui.coach.say({ title: 'Achtung', kind: 'warn', text: `Dein ${PIECE_DE[typeOf(hang[0].piece)]} auf ${sqName(hang[0].sq)} ist angegriffen und nicht ausreichend gedeckt.`, ms: 6000 });
    }
  }

  function undo(n, silent) {
    if (busy) return;
    ui.coach.hide();
    if (g.over) g.over = null;
    // bis der Spieler wieder am Zug ist
    let steps = 0;
    if (two()) {
      if (g.fens.length > 1) { g.fens.pop(); g.sans.pop(); g.last.pop(); steps = 1; }
      if (!steps && !silent) toast('Nichts zum Zurücknehmen');
      sel = null; hint = null; persist(); render();
      return;
    }
    while (g.fens.length > 1 && (steps === 0 || fromFEN(g.fens[g.fens.length - 1]).turn !== g.player)) {
      g.fens.pop(); g.sans.pop(); g.last.pop(); steps++;
      if (n && steps >= n && fromFEN(g.fens[g.fens.length - 1]).turn === g.player) break;
    }
    if (!steps && !silent) toast('Nichts zum Zurücknehmen');
    sel = null; hint = null;
    persist(); render();
    if (cur().turn !== g.player) computerTurn();
  }

  function tip() {
    if (busy || g.over) return;
    st = cur();
    if (!two() && st.turn !== g.player) return;
    busy = true; render();
    setTimeout(() => {
      const r = search(st, { depth: 4, timeMs: 1200 });
      busy = false;
      if (!r) { render(); return; }
      hint = r.move; sel = null;
      render();
      const reasons = explainMove(st, r.move);
      const extra = isMateScore(r.score) && r.score > 0 ? `Du hast ein Matt in ${mateIn(r.score)}!` : null;
      ui.coach.say({
        title: 'Mein Vorschlag: ' + san(st, r.move),
        text: [reasons[0] || 'Dieser Zug verbessert deine Stellung am meisten – der Computer hat einige Züge vorausgerechnet.', extra].filter(Boolean),
        actions: [{ label: 'Ausführen', primary: true, onClick: () => { const m = hint; hint = null; playerMove(m); } }],
      });
    }, 30);
  }

  async function finish() {
    render();
    const o = g.over;
    const won = o.result !== '½-½' && (o.result === '1-0') === (g.player === 'w');
    if (two()) {
      remove('save:schach');
      await sleep(500);
      const winner = o.result === '½-½' ? null : (o.result === '1-0' ? 'w' : 'b');
      const r2 = await dialog({ title: winner ? `${nameOfColor(winner)} gewinnt!` : 'Remis', body: `${o.reason}.`, buttons: [{ label: 'Brett ansehen', value: 'look' }, { label: 'Neue Partie', value: 'new', primary: true }] });
      if (r2 === 'new') newGame();
      return;
    }
    addResult('schach', won);
    remove('save:schach');
    await sleep(500);
    const r = await dialog({
      title: o.result === '½-½' ? 'Remis' : won ? 'Gewonnen!' : 'Verloren',
      body: `${o.reason}. ${won ? 'Starke Partie!' : o.result === '½-½' ? 'Unentschieden.' : 'Schau dir im Regelheft die Tricks an – nächstes Mal klappt es.'}`,
      buttons: [{ label: 'Brett ansehen', value: 'look' }, { label: 'Neue Partie', value: 'new', primary: true }],
    });
    if (r === 'new') newGame();
  }

  async function newGame() {
    const c = await dialog({
      title: 'Neue Partie', body: 'Gegen den Computer – mit welcher Farbe? Weiß beginnt. Oder ihr spielt zu zweit an einem iPhone.', layout: 'list',
      buttons: [{ label: 'Weiß', sub: 'gegen den Computer', value: 'w', primary: true }, { label: 'Schwarz', sub: 'gegen den Computer', value: 'b' }, { label: 'Zufall', sub: 'gegen den Computer', value: 'r' },
        { label: 'Zu zweit', sub: 'zwei Menschen, ein iPhone', value: 'two' }, { label: 'Abbrechen', value: null, quiet: true }],
    });
    if (!c) return;
    if (c === 'two') {
      const names = await askNames();
      if (!names) return;
      ui.coach.hide();
      fresh('w', 'two', { w: names.w, b: names.b }, names.flip);
      sel = null; hint = null; busy = false;
      render();
      return;
    }
    ui.coach.hide();
    fresh(c === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : c);
    sel = null; hint = null; busy = false;
    render();
    if (g.player === 'b') computerTurn();
  }

  async function askNames() {
    const saved = load('playerNames', []);
    const wIn = h('input', { type: 'text', class: 'name-input', value: (g && two() ? g.names.w : saved[0]) || 'Spieler 1', maxlength: '12', 'aria-label': 'Name für Weiß' });
    const bIn = h('input', { type: 'text', class: 'name-input', value: (g && two() ? g.names.b : saved[1]) || 'Spieler 2', maxlength: '12', 'aria-label': 'Name für Schwarz' });
    const flip = h('input', { type: 'checkbox', class: 'switch' });
    flip.checked = !!(g && g.flip);
    const content = h('div', { class: 'players-form' },
      h('div', { class: 'player-row is-human' }, h('i', { class: 'swatch w' }), wIn, h('span', { class: 'small' }, 'Weiß')),
      h('div', { class: 'player-row is-human' }, h('i', { class: 'swatch b' }), bIn, h('span', { class: 'small' }, 'Schwarz')),
      h('label', { class: 'switch-row' }, h('span', {}, 'Brett mitdrehen', h('small', {}, 'Wer am Zug ist, sieht seine Figuren unten')), flip));
    const ok = await dialog({ title: 'Zu zweit', content, buttons: [{ label: 'Abbrechen', value: false }, { label: 'Los geht’s', value: true, primary: true }], dismissable: true });
    if (!ok) return null;
    return { w: wIn.value.trim() || 'Weiß', b: bIn.value.trim() || 'Schwarz', flip: flip.checked };
  }

  ui.onTip = tip;
  ui.onNew = newGame;
  ui.onUndo = () => undo();
  ui.canUndo = () => g && g.fens.length > 1;
  ui.onLevel = () => render();

  if (!g) { fresh('w'); render(); requestAnimationFrame(sizeBoard); }
  else { render(); requestAnimationFrame(sizeBoard); if (cur().turn !== g.player && !g.over) computerTurn(); }
  if (g.sans.length === 0 && ui.coachOn()) {
    ui.coach.say({ title: 'Los geht’s', text: 'Tippe eine deiner Figuren an, dann das Zielfeld. Über die Glühbirne oben bekommst du jederzeit einen Vorschlag.', ms: 7000 });
  }

  return () => { ro.disconnect(); };
}
