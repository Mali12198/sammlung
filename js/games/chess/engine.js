// Schach: Regeln, Zuggenerator, Notation und Computergegner (Alpha-Beta).
// Feld 0 = a8, 63 = h1. Weiße Figuren groß, schwarze klein.

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const FILES = 'abcdefgh';
export const sqName = s => FILES[s & 7] + (8 - (s >> 3));
export const sqIndex = n => (8 - Number(n[1])) * 8 + FILES.indexOf(n[0]);
export const colorOf = p => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
export const typeOf = p => (p ? p.toUpperCase() : null);
const other = c => (c === 'w' ? 'b' : 'w');

export const PIECE_DE = { P: 'Bauer', N: 'Springer', B: 'Läufer', R: 'Turm', Q: 'Dame', K: 'König' };
export const PIECE_ART = { P: 'den Bauern', N: 'den Springer', B: 'den Läufer', R: 'den Turm', Q: 'die Dame', K: 'den König' };
const SAN_DE = { N: 'S', B: 'L', R: 'T', Q: 'D', K: 'K', P: '' };

export function fromFEN(fen) {
  const [pos, turn, castle, ep, half, full] = fen.split(/\s+/);
  const b = new Array(64).fill('');
  let i = 0;
  for (const ch of pos) {
    if (ch === '/') continue;
    if (/\d/.test(ch)) i += Number(ch);
    else b[i++] = ch;
  }
  return { b, turn, castle: castle === '-' ? '' : castle, ep: ep === '-' ? -1 : sqIndex(ep), half: Number(half) || 0, full: Number(full) || 1 };
}

export function toFEN(st, short = false) {
  let s = '';
  for (let r = 0; r < 8; r++) {
    let e = 0;
    for (let f = 0; f < 8; f++) {
      const p = st.b[r * 8 + f];
      if (!p) e++;
      else { if (e) { s += e; e = 0; } s += p; }
    }
    if (e) s += e;
    if (r < 7) s += '/';
  }
  s += ` ${st.turn} ${st.castle || '-'} ${st.ep >= 0 ? sqName(st.ep) : '-'}`;
  if (!short) s += ` ${st.half} ${st.full}`;
  return s;
}

export const cloneState = st => ({ b: st.b.slice(), turn: st.turn, castle: st.castle, ep: st.ep, half: st.half, full: st.full });

const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function attacked(b, sq, by) {
  const r = sq >> 3, f = sq & 7;
  // Bauern
  const pr = by === 'w' ? r + 1 : r - 1;
  const pawn = by === 'w' ? 'P' : 'p';
  if (pr >= 0 && pr < 8) {
    if (f > 0 && b[pr * 8 + f - 1] === pawn) return true;
    if (f < 7 && b[pr * 8 + f + 1] === pawn) return true;
  }
  const kn = by === 'w' ? 'N' : 'n', kg = by === 'w' ? 'K' : 'k';
  for (const [dr, df] of KN) {
    const rr = r + dr, ff = f + df;
    if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === kn) return true;
  }
  for (const [dr, df] of KG) {
    const rr = r + dr, ff = f + df;
    if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === kg) return true;
  }
  const bq = by === 'w' ? ['B', 'Q'] : ['b', 'q'];
  const rq = by === 'w' ? ['R', 'Q'] : ['r', 'q'];
  for (const [dr, df] of DIAG) {
    let rr = r + dr, ff = f + df;
    while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
      const p = b[rr * 8 + ff];
      if (p) { if (p === bq[0] || p === bq[1]) return true; break; }
      rr += dr; ff += df;
    }
  }
  for (const [dr, df] of ORTH) {
    let rr = r + dr, ff = f + df;
    while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
      const p = b[rr * 8 + ff];
      if (p) { if (p === rq[0] || p === rq[1]) return true; break; }
      rr += dr; ff += df;
    }
  }
  return false;
}

export function kingSq(b, c) {
  const k = c === 'w' ? 'K' : 'k';
  return b.indexOf(k);
}
export const inCheck = (st, c = st.turn) => attacked(st.b, kingSq(st.b, c), other(c));

function pushMove(list, from, to, piece, captured, flag, promo) {
  list.push({ from, to, piece, captured: captured || '', flag: flag || '', promo: promo || '' });
}

export function pseudoMoves(st, capturesOnly = false) {
  const { b, turn } = st;
  const list = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p || colorOf(p) !== turn) continue;
    const t = typeOf(p), r = sq >> 3, f = sq & 7;
    if (t === 'P') {
      const dir = turn === 'w' ? -1 : 1;
      const startR = turn === 'w' ? 6 : 1, lastR = turn === 'w' ? 0 : 7;
      const r1 = r + dir;
      if (r1 < 0 || r1 > 7) continue;
      const one = r1 * 8 + f;
      if (!b[one]) {
        if (r1 === lastR) for (const pr of 'QRBN') pushMove(list, sq, one, p, '', '', turn === 'w' ? pr : pr.toLowerCase());
        else if (!capturesOnly) {
          pushMove(list, sq, one, p);
          if (r === startR && !b[(r + 2 * dir) * 8 + f]) pushMove(list, sq, (r + 2 * dir) * 8 + f, p, '', 'd');
        }
      }
      for (const df of [-1, 1]) {
        const ff = f + df;
        if (ff < 0 || ff > 7) continue;
        const to = r1 * 8 + ff;
        if (b[to] && colorOf(b[to]) !== turn) {
          if (r1 === lastR) for (const pr of 'QRBN') pushMove(list, sq, to, p, b[to], '', turn === 'w' ? pr : pr.toLowerCase());
          else pushMove(list, sq, to, p, b[to]);
        } else if (to === st.ep) {
          pushMove(list, sq, to, p, turn === 'w' ? 'p' : 'P', 'e');
        }
      }
      continue;
    }
    if (t === 'N' || t === 'K') {
      for (const [dr, df] of (t === 'N' ? KN : KG)) {
        const rr = r + dr, ff = f + df;
        if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
        const to = rr * 8 + ff, q = b[to];
        if (q && colorOf(q) === turn) continue;
        if (capturesOnly && !q) continue;
        pushMove(list, sq, to, p, q);
      }
      if (t === 'K' && !capturesOnly) castleMoves(st, list, sq);
      continue;
    }
    const dirs = t === 'B' ? DIAG : t === 'R' ? ORTH : DIAG.concat(ORTH);
    for (const [dr, df] of dirs) {
      let rr = r + dr, ff = f + df;
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        const to = rr * 8 + ff, q = b[to];
        if (q) { if (colorOf(q) !== turn) pushMove(list, sq, to, p, q); break; }
        if (!capturesOnly) pushMove(list, sq, to, p);
        rr += dr; ff += df;
      }
    }
  }
  return list;
}

function castleMoves(st, list, sq) {
  const { b, turn, castle } = st;
  const opp = other(turn);
  if (turn === 'w' && sq === 60) {
    if (castle.includes('K') && b[63] === 'R' && !b[61] && !b[62] && !attacked(b, 60, opp) && !attacked(b, 61, opp) && !attacked(b, 62, opp)) pushMove(list, 60, 62, 'K', '', 'k');
    if (castle.includes('Q') && b[56] === 'R' && !b[59] && !b[58] && !b[57] && !attacked(b, 60, opp) && !attacked(b, 59, opp) && !attacked(b, 58, opp)) pushMove(list, 60, 58, 'K', '', 'q');
  }
  if (turn === 'b' && sq === 4) {
    if (castle.includes('k') && b[7] === 'r' && !b[5] && !b[6] && !attacked(b, 4, opp) && !attacked(b, 5, opp) && !attacked(b, 6, opp)) pushMove(list, 4, 6, 'k', '', 'k');
    if (castle.includes('q') && b[0] === 'r' && !b[3] && !b[2] && !b[1] && !attacked(b, 4, opp) && !attacked(b, 3, opp) && !attacked(b, 2, opp)) pushMove(list, 4, 2, 'k', '', 'q');
  }
}

const CASTLE_CLEAR = { 60: 'KQ', 4: 'kq', 63: 'K', 56: 'Q', 7: 'k', 0: 'q' };

export function makeMove(st, m) {
  const u = { castle: st.castle, ep: st.ep, half: st.half, full: st.full, capSq: m.to };
  const b = st.b;
  b[m.from] = '';
  if (m.flag === 'e') {
    u.capSq = m.to + (st.turn === 'w' ? 8 : -8);
    b[u.capSq] = '';
  }
  b[m.to] = m.promo || m.piece;
  if (m.flag === 'k') { const rf = m.to + 1, rt = m.to - 1; b[rt] = b[rf]; b[rf] = ''; }
  if (m.flag === 'q') { const rf = m.to - 2, rt = m.to + 1; b[rt] = b[rf]; b[rf] = ''; }
  let c = st.castle;
  if (c) {
    for (const s of [m.from, m.to]) {
      const clr = CASTLE_CLEAR[s];
      if (clr) for (const ch of clr) c = c.replace(ch, '');
    }
  }
  st.castle = c;
  st.ep = m.flag === 'd' ? (m.from + m.to) >> 1 : -1;
  st.half = (typeOf(m.piece) === 'P' || m.captured) ? 0 : st.half + 1;
  if (st.turn === 'b') st.full++;
  st.turn = other(st.turn);
  return u;
}

export function unmakeMove(st, m, u) {
  st.turn = other(st.turn);
  const b = st.b;
  b[m.from] = m.piece;
  b[m.to] = '';
  if (m.captured) b[u.capSq] = m.captured;
  if (m.flag === 'k') { const rf = m.to + 1, rt = m.to - 1; b[rf] = b[rt]; b[rt] = ''; }
  if (m.flag === 'q') { const rf = m.to - 2, rt = m.to + 1; b[rf] = b[rt]; b[rt] = ''; }
  st.castle = u.castle; st.ep = u.ep; st.half = u.half; st.full = u.full;
}

export function legalMoves(st) {
  const res = [];
  const me = st.turn;
  for (const m of pseudoMoves(st)) {
    const u = makeMove(st, m);
    if (!attacked(st.b, kingSq(st.b, me), st.turn)) res.push(m);
    unmakeMove(st, m, u);
  }
  return res;
}

export function insufficient(b) {
  const pcs = b.filter(p => p && typeOf(p) !== 'K');
  if (pcs.length === 0) return true;
  if (pcs.length === 1 && (typeOf(pcs[0]) === 'B' || typeOf(pcs[0]) === 'N')) return true;
  if (pcs.every(p => typeOf(p) === 'B')) {
    const cols = new Set();
    b.forEach((p, i) => { if (p && typeOf(p) === 'B') cols.add(((i >> 3) + (i & 7)) % 2); });
    return cols.size === 1;
  }
  return false;
}

// Spielstand: { over, result: '1-0' | '0-1' | '½-½', reason }
export function gameStatus(st, positions = []) {
  const moves = legalMoves(st);
  if (moves.length === 0) {
    if (inCheck(st)) return { over: true, result: st.turn === 'w' ? '0-1' : '1-0', reason: 'Schachmatt' };
    return { over: true, result: '½-½', reason: 'Patt' };
  }
  if (st.half >= 100) return { over: true, result: '½-½', reason: '50-Züge-Regel' };
  if (insufficient(st.b)) return { over: true, result: '½-½', reason: 'Zu wenig Material zum Mattsetzen' };
  const key = toFEN(st, true);
  if (positions.filter(k => k === key).length >= 3) return { over: true, result: '½-½', reason: 'Dreimalige Stellungswiederholung' };
  return { over: false, moves };
}

export function san(st, m) {
  let s;
  if (m.flag === 'k') s = 'O-O';
  else if (m.flag === 'q') s = 'O-O-O';
  else {
    const t = typeOf(m.piece);
    s = SAN_DE[t];
    if (t === 'P') {
      if (m.captured) s += FILES[m.from & 7] + 'x';
      s += sqName(m.to);
      if (m.promo) s += '=' + SAN_DE[typeOf(m.promo)];
    } else {
      const others = legalMoves(st).filter(x => x.to === m.to && x.piece === m.piece && x.from !== m.from);
      if (others.length) {
        const sameFile = others.some(x => (x.from & 7) === (m.from & 7));
        const sameRank = others.some(x => (x.from >> 3) === (m.from >> 3));
        if (!sameFile) s += FILES[m.from & 7];
        else if (!sameRank) s += String(8 - (m.from >> 3));
        else s += sqName(m.from);
      }
      if (m.captured) s += 'x';
      s += sqName(m.to);
    }
  }
  const u = makeMove(st, m);
  if (inCheck(st)) s += legalMoves(st).length ? '+' : '#';
  unmakeMove(st, m, u);
  return s;
}

// ------------------------------------------------------------------
// Bewertung
// ------------------------------------------------------------------
export const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const PST = {
  P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  KE: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
};

// Bewertung aus Sicht von Weiß
export function evaluate(b) {
  let score = 0, nonPawn = 0;
  for (let i = 0; i < 64; i++) { const p = b[i]; if (p && 'NBRQnbrq'.includes(p)) nonPawn += VAL[typeOf(p)]; }
  const endgame = nonPawn <= 1600;
  let wb = 0, bb = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const t = typeOf(p), w = p === t;
    const idx = w ? i : ((7 - (i >> 3)) * 8 + (i & 7));
    const tab = t === 'K' ? (endgame ? PST.KE : PST.K) : PST[t];
    const v = VAL[t] + tab[idx];
    score += w ? v : -v;
    if (t === 'B') { if (w) wb++; else bb++; }
  }
  if (wb >= 2) score += 30;
  if (bb >= 2) score -= 30;
  return score;
}

// ------------------------------------------------------------------
// Suche
// ------------------------------------------------------------------
const MATE = 100000;

function orderMoves(moves, pvMove, killers) {
  for (const m of moves) {
    let s = 0;
    if (m.captured) s += 10000 + VAL[typeOf(m.captured)] * 10 - VAL[typeOf(m.piece)];
    if (m.promo) s += 9000 + VAL[typeOf(m.promo)];
    if (killers && killers.some(k => k && k.from === m.from && k.to === m.to)) s += 5000;
    if (pvMove && pvMove.from === m.from && pvMove.to === m.to && pvMove.promo === m.promo) s += 100000;
    m._s = s;
  }
  moves.sort((a, b) => b._s - a._s);
}

export function search(st0, { depth = 3, timeMs = 1000, noise = 0, rnd = Math.random } = {}) {
  const st = cloneState(st0);
  const deadline = Date.now() + timeMs;
  let nodes = 0, aborted = false;
  const killers = [];

  function quiesce(alpha, beta, ply) {
    nodes++;
    const sign = st.turn === 'w' ? 1 : -1;
    const stand = sign * evaluate(st.b);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (ply > 8) return alpha;
    const moves = pseudoMoves(st, true);
    orderMoves(moves);
    const me = st.turn;
    for (const m of moves) {
      const u = makeMove(st, m);
      if (attacked(st.b, kingSq(st.b, me), st.turn)) { unmakeMove(st, m, u); continue; }
      const sc = -quiesce(-beta, -alpha, ply + 1);
      unmakeMove(st, m, u);
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function negamax(d, alpha, beta, ply) {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) aborted = true;
    if (aborted) return 0;
    if (st.half >= 100) return 0;
    const check = inCheck(st);
    if (d <= 0 && !check) return quiesce(alpha, beta, 0);
    const moves = pseudoMoves(st);
    orderMoves(moves, null, killers[ply]);
    const me = st.turn;
    let legal = 0, best = -Infinity;
    for (const m of moves) {
      const u = makeMove(st, m);
      if (attacked(st.b, kingSq(st.b, me), st.turn)) { unmakeMove(st, m, u); continue; }
      legal++;
      const sc = -negamax(d - 1, -beta, -alpha, ply + 1);
      unmakeMove(st, m, u);
      if (aborted) return 0;
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) {
        if (!m.captured) { killers[ply] = killers[ply] || []; killers[ply].unshift(m); killers[ply].length = 2; }
        break;
      }
    }
    if (!legal) return check ? -MATE + ply : 0;
    return best;
  }

  const rootMoves = legalMoves(st);
  if (!rootMoves.length) return null;
  let bestMove = rootMoves[0], bestScore = -Infinity, scored = [];
  let pv = null;
  for (let d = 1; d <= depth; d++) {
    orderMoves(rootMoves, pv);
    let alpha = -Infinity, iterBest = null, iterScore = -Infinity;
    const iterScored = [];
    for (const m of rootMoves) {
      const u = makeMove(st, m);
      let sc = -negamax(d - 1, -Infinity, noise ? Infinity : -alpha, 1);
      unmakeMove(st, m, u);
      if (aborted) break;
      if (noise) sc += (rnd() * 2 - 1) * noise;
      iterScored.push({ m, sc });
      if (sc > iterScore) { iterScore = sc; iterBest = m; }
      if (sc > alpha) alpha = sc;
    }
    if (aborted && !iterBest) break;
    if (!aborted || iterScore > bestScore) {
      bestMove = iterBest; bestScore = iterScore; pv = iterBest;
      if (!aborted) scored = iterScored;
    }
    if (aborted) break;
    if (Math.abs(bestScore) > MATE - 100) break;
  }
  return { move: bestMove, score: bestScore, nodes, scored };
}

// Bewertet einen konkreten Zug (aus Sicht des Ziehenden) mit fester Tiefe.
export function scoreMove(st0, m, depth = 2) {
  const st = cloneState(st0);
  const u = makeMove(st, m);
  const r = search(st, { depth: Math.max(1, depth - 1), timeMs: 600 });
  unmakeMove(st, m, u);
  if (!r) { // Gegner hat keine Züge
    const s2 = cloneState(st0); makeMove(s2, m);
    return inCheck(s2) ? MATE : 0;
  }
  return -r.score;
}

export const isMateScore = s => Math.abs(s) > MATE - 200;
export const mateIn = s => Math.ceil((MATE - Math.abs(s)) / 2);

export const LEVEL_CFG = {
  leicht: { depth: 2, timeMs: 300, noise: 70, blunder: 0.2 },
  mittel: { depth: 4, timeMs: 1000, noise: 15, blunder: 0 },
  schwer: { depth: 6, timeMs: 2500, noise: 0, blunder: 0 },
};

export function aiMove(st, level = 'mittel', rnd = Math.random) {
  const cfg = LEVEL_CFG[level] || LEVEL_CFG.mittel;
  const moves = legalMoves(st);
  if (!moves.length) return null;
  if (cfg.blunder && rnd() < cfg.blunder) {
    // gelegentlich ein plausibler, aber nicht bester Zug
    const caps = moves.filter(m => m.captured);
    const pool = caps.length && rnd() < 0.5 ? caps : moves;
    return pool[Math.floor(rnd() * pool.length)];
  }
  const r = search(st, { depth: cfg.depth, timeMs: cfg.timeMs, noise: cfg.noise, rnd });
  return r ? r.move : moves[0];
}

// ------------------------------------------------------------------
// Erklärungen für Tipps und Trainer
// ------------------------------------------------------------------
function attackersOf(b, sq, by) {
  // grobe Liste der angreifenden Figurtypen
  const res = [];
  const st = { b, turn: by, castle: '', ep: -1, half: 0, full: 1 };
  for (const m of pseudoMoves(st, true)) if (m.to === sq) res.push(typeOf(m.piece));
  return res;
}

export function hangingPieces(st, color) {
  // Figuren von color, die angegriffen und nicht (ausreichend) gedeckt sind
  const res = [];
  const opp = other(color);
  for (let i = 0; i < 64; i++) {
    const p = st.b[i];
    if (!p || colorOf(p) !== color || typeOf(p) === 'K') continue;
    const att = attackersOf(st.b, i, opp);
    if (!att.length) continue;
    const b2 = st.b.slice(); b2[i] = opp === 'w' ? 'P' : 'p'; // tun als stünde eine gegnerische Figur dort
    const defended = attacked(b2, i, color);
    const cheapest = Math.min(...att.map(t => VAL[t] || 0));
    if (!defended || cheapest < VAL[typeOf(p)]) res.push({ sq: i, piece: p });
  }
  return res;
}

export function explainMove(st0, m) {
  const st = cloneState(st0);
  const reasons = [];
  const t = typeOf(m.piece);
  const name = PIECE_DE[t];
  const hangBefore = hangingPieces(st, st.turn);
  const u = makeMove(st, m);
  const check = inCheck(st);
  const mate = check && legalMoves(st).length === 0;
  if (mate) { reasons.push('Das ist <b>Schachmatt</b>!'); unmakeMove(st, m, u); return reasons; }
  if (m.flag === 'k' || m.flag === 'q') reasons.push('Die <b>Rochade</b> bringt den König in Sicherheit und den Turm ins Spiel.');
  if (m.promo) reasons.push(`Der Bauer wird zur <b>${PIECE_DE[typeOf(m.promo)]}</b> umgewandelt.`);
  if (m.captured) {
    const capT = typeOf(m.captured);
    const defended = attacked(st.b, m.to, st.turn);
    if (!defended) reasons.push(`Schlägt ${PIECE_ART[capT]} auf ${sqName(m.to)} – er war <b>ungedeckt</b>.`);
    else if (VAL[capT] > VAL[t]) reasons.push(`Schlägt ${PIECE_ART[capT]} mit einer schwächeren Figur – ein <b>Materialgewinn</b>.`);
    else reasons.push(`Schlägt ${PIECE_ART[capT]} auf ${sqName(m.to)}.`);
  }
  if (check) reasons.push('Gibt <b>Schach</b> – der Gegner muss reagieren.');
  // Gabel: bewegte Figur greift zwei wertvolle Figuren an
  const me = other(st.turn);
  const targets = [];
  const st2 = { b: st.b, turn: me, castle: '', ep: -1, half: 0, full: 1 };
  for (const mv of pseudoMoves(st2, true)) {
    if (mv.from !== m.to) continue;
    const vt = typeOf(mv.captured);
    if (vt === 'K' || VAL[vt] > VAL[typeOf(m.promo || m.piece)] || !attacked(st.b, mv.to, st.turn)) targets.push(vt);
  }
  if (targets.length >= 2) reasons.push(`<b>Gabel</b>: ${name === 'Dame' ? 'die Dame' : 'der ' + name} greift ${targets.slice(0, 2).map(x => x === 'K' ? 'den König' : PIECE_ART[x]).join(' und ')} gleichzeitig an.`);
  if (hangBefore.some(hp => hp.sq === m.from) && !m.captured) reasons.push(`Bringt die bedrohte Figur (${name}) in Sicherheit.`);
  if (!reasons.length) {
    const fromR = m.from >> 3;
    const backRank = me === 'w' ? 7 : 0;
    if ((t === 'N' || t === 'B') && fromR === backRank && st0.full <= 12) reasons.push(`<b>Entwickelt</b> ${PIECE_ART[t]} – Leichtfiguren gehören früh ins Spiel.`);
    else if (t === 'P' && ['d4', 'e4', 'd5', 'e5', 'c4', 'c5'].includes(sqName(m.to)) && st0.full <= 10) reasons.push('Besetzt das <b>Zentrum</b> und schafft Platz für Läufer und Dame.');
    else if (t === 'R' && openFile(st.b, m.to & 7)) reasons.push('Stellt den Turm auf eine <b>offene Linie</b>.');
  }
  unmakeMove(st, m, u);
  return reasons;
}

function openFile(b, f) {
  for (let r = 0; r < 8; r++) { const p = b[r * 8 + f]; if (p && typeOf(p) === 'P') return false; }
  return true;
}
