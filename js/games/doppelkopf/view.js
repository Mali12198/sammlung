// Doppelkopf – Oberfläche
import { h, dialog, toast, sleep } from '../../ui.js';
import { load, save, addResult, delay } from '../../store.js';
import { cardTable } from '../../cards/table.js';
import { cardEl } from '../../cards/render.js';
import { clone } from '../../util.js';
import {
  newRound, sayVorbehalt, aiVorbehalt, hasBothQueens, legalFor, playCard, collectTrick, currentWinner, aiCard, aiAnnounce,
  announce, nextAnnouncement, annText, teamOf, policy, lookahead, sortHand, isTrump, effSuit, cardsPoints, cardName,
  GAME_NAME, SOLOS, isSolo, soloStrength, handStrength, SUIT_NAME, LEVEL_NAME, SOLO_NEED,
} from './engine.js';

const NAMES = ['Du', 'Lotte', 'Karl', 'Hanne'];
const POS = ['bottom', 'left', 'top', 'right'];
const SOLO_INFO = {
  'solo-Q': 'Nur die Damen sind Trumpf.',
  'solo-J': 'Nur die Buben sind Trumpf.',
  'solo-C': 'Kreuz statt Karo als Trumpffarbe.',
  'solo-S': 'Pik statt Karo als Trumpffarbe.',
  'solo-H': 'Herz statt Karo als Trumpffarbe.',
  'solo-D': 'Trümpfe wie im Normalspiel – allein.',
  'solo-0': 'Gar kein Trumpf, nur Farben.',
};

export function mount(ui) {
  let g = load('save:doppelkopf');
  let token = 0, busy = false, hintCards = new Set(), pending = null, soloPick = false;

  const table = cardTable(ui, { names: NAMES, positions: POS });
  ui.root.style.setProperty('--coach-bottom', '214px');

  function fresh(keep) {
    const old = g;
    const dealer = old ? (old.dealer + 1) % 4 : 3;
    g = {
      s: newRound(dealer, { dulle2: !!ui.option('dulle2', false) }), dealer,
      scores: keep && old ? old.scores : [0, 0, 0, 0],
      list: keep && old ? old.list : [],
      tipsShown: old ? old.tipsShown || {} : {},
    };
    hintCards = new Set(); pending = null; soloPick = false;
    persist();
  }
  function persist() { save('save:doppelkopf', g); }

  // ---------- Darstellung ----------
  const type = () => g.s.type;
  const myTeam = () => teamOf(g.s, 0);
  const nameOf = p => NAMES[p];

  function roleOf(p) {
    const s = g.s;
    const parts = [];
    if (s.phase === 'vorbehalt') {
      if (p === s.first) parts.push('kommt raus');
      return parts.join(' · ');
    }
    const k = s.known[p];
    if (isSolo(s.type)) parts.push(p === s.soloist ? '<b>Solist</b>' : 'Kontra');
    else if (k) parts.push(`<b>${k === 're' ? 'Re' : 'Kontra'}</b>`);
    if (s.type === 'hochzeit' && p === s.hochzeiter && s.klaerung < 0) parts.push('Hochzeit');
    const tr = s.tricks.filter(t => t.winner === p).length;
    if (tr) parts.push(`${tr} ${tr === 1 ? 'Stich' : 'Stiche'}`);
    return parts.join(' · ');
  }

  function render() {
    const s = g.s;
    for (const p of [1, 2, 3]) {
      table.setSeat(p, {
        role: roleOf(p),
        on: (s.phase === 'play' && s.turn === p) || (s.phase === 'vorbehalt' && s.vb.turn === p),
        count: s.hands[p].length,
      });
    }
    const winner = s.phase === 'collect' ? s.trick.findIndex(x => x.p === currentWinner(s)) : -1;
    table.renderTrick(s.trick, { winner });
    let left = 'Vorbehalte';
    if (s.phase !== 'vorbehalt') {
      left = `<b>${GAME_NAME[s.type]}</b>`;
      if (isSolo(s.type)) left += ` · ${s.soloist === 0 ? 'du' : nameOf(s.soloist)}`;
      if (s.type === 'hochzeit') left += ` · ${s.hochzeiter === 0 ? 'du' : nameOf(s.hochzeiter)}`;
      const a = [];
      if (s.ann.re) a.push(s.ann.re === 1 ? 'Re' : 'Re ' + LEVEL_NAME[s.ann.re]);
      if (s.ann.kontra) a.push(s.ann.kontra === 1 ? 'Kontra' : 'Kontra ' + LEVEL_NAME[s.ann.kontra]);
      if (a.length) left += ' · ' + a.join(', ');
    }
    table.setPills(left, `Konto: <b>${g.scores[0] > 0 ? '+' : ''}${g.scores[0]}</b>`, showList);
    const t = s.phase === 'vorbehalt' ? 'normal' : s.type;
    const cards = sortHand(s.hands[0], t);
    const myTurn = s.phase === 'play' && s.turn === 0;
    const legal = myTurn ? legalFor(s, 0) : null;
    const hintIdx = new Set();
    for (const hc of hintCards) { const i = cards.indexOf(hc); if (i >= 0) hintIdx.add(i); }
    table.renderHand(cards, {
      playable: i => !myTurn || legal.includes(cards[i]),
      selected: new Set(pending ? [cards.indexOf(pending)] : []),
      hint: hintIdx,
      trump: c => isTrump(c, t),
      onTap: i => onCard(cards[i]),
    });
    renderPhase();
    ui.setSubtitle(`Computer ${ui.level()}`);
  }

  const btn = (label, onclick, primary, attrs = {}) => h('button', { class: 'btn' + (primary ? ' btn-primary' : ''), onclick, ...attrs }, label);

  function renderPhase() {
    const s = g.s;
    table.setCenter(null);
    table.setActions([]);
    if (s.phase === 'vorbehalt') {
      if (s.vb.turn !== 0) { table.setStatus(`${nameOf(s.vb.turn)} überlegt …`); return; }
      table.setStatus('Hast du einen Vorbehalt?');
      table.setCenter(soloPick ? soloPanel() : vbPanel());
      return;
    }
    if (s.phase === 'play' || s.phase === 'collect') {
      if (s.phase === 'collect') {
        const w = currentWinner(s);
        const p = cardsPoints(s.trick.map(x => x.c));
        table.setStatus(`${w === 0 ? 'Dein Stich' : 'Stich für ' + nameOf(w)} · ${p} Augen${p >= 40 ? ' – Doppelkopf!' : ''}`);
      } else if (s.turn === 0) table.setStatus(s.trick.length ? 'Du bist dran.' : '<b>Du spielst aus.</b>');
      else table.setStatus(`${nameOf(s.turn)} ist dran …`);
      const acts = [];
      const L = nextAnnouncement(s, 0);
      if (L && s.phase === 'play') acts.push(btn(annText(myTeam(), L).replace('!', ''), () => humanAnnounce(L), false, { class: 'btn btn-ann' }));
      if (s.tricks.length) acts.push(h('button', { class: 'chip', onclick: showLastTrick }, 'Letzter Stich'));
      if (ui.coachOn()) acts.push(h('span', { class: 'chip chip-info' }, teamLine()));
      table.setActions(acts);
      return;
    }
    if (s.phase === 'done') {
      table.setStatus('Spiel vorbei.');
      table.setActions([btn('Ergebnis', showResult), btn('Nächstes Spiel', nextRound, true)]);
    }
  }

  function teamLine() {
    const s = g.s;
    const t = myTeam();
    if (isSolo(s.type)) return s.soloist === 0 ? 'Du spielst allein' : `Ihr drei gegen ${nameOf(s.soloist)}`;
    if (s.type === 'hochzeit' && s.klaerung < 0) return s.hochzeiter === 0 ? 'Du suchst einen Partner' : 'Hochzeit: Partner gesucht';
    const partners = [1, 2, 3].filter(q => s.known[q] && teamOf(s, q) === t && s.known[q] === t);
    const pts = [0, 1, 2, 3].filter(q => teamOf(s, q) === t).reduce((a, q) => a + cardsPoints(s.taken[q]), 0);
    return `Du: ${t === 're' ? 'Re' : 'Kontra'}${partners.length ? ' mit ' + partners.map(nameOf).join(', ') : ''} · ${pts} Augen`;
  }

  function vbPanel() {
    const s = g.s;
    const both = hasBothQueens(s.hands[0]);
    const kids = [h('h3', {}, 'Vorbehalt?'),
      h('p', { html: both
        ? 'Du hast <b>beide Kreuz-Damen</b>. Sag „Hochzeit“ an – dann wird der erste, der einen Stich macht, dein Partner. Oder spiel ein Solo.'
        : 'Normal spielst du „gesund“. Mit einem sehr starken Blatt kannst du ein Solo ansagen und allein gegen alle drei spielen.' })];
    if (ui.coachOn()) {
      const best = SOLOS.map(t => ({ t, st: soloStrength(s.hands[0], t) })).sort((a, b) => b.st - a.st)[0];
      const good = best.st >= SOLO_NEED.mittel;
      kids.push(h('p', { class: 'advice', html: good
        ? `Trainer: Ein <b>${GAME_NAME[best.t]}</b> sieht stark aus.`
        : (both ? 'Trainer: Hochzeit ist hier die sichere Wahl.' : `Trainer: Für ein Solo reicht das Blatt nicht – spiel gesund.${myTeamHint()}`) }));
    }
    kids.push(h('div', { class: 'btn-row' },
      btn('Solo …', () => { soloPick = true; render(); }),
      both ? btn('Hochzeit', () => doVb('hochzeit'), true) : null,
      btn('Gesund', () => doVb('gesund'), !both)));
    return h('div', { class: 'panel' }, kids);
  }

  function myTeamHint() {
    const s = g.s;
    return s.hands[0].includes('CQ') ? ' Du hast eine Kreuz-Dame, also spielst du <b>Re</b>.' : ' Du hast keine Kreuz-Dame, also spielst du <b>Kontra</b>.';
  }

  function soloPanel() {
    const s = g.s;
    const grid = h('div', { class: 'grid' }, SOLOS.map(t => {
      const st = soloStrength(s.hands[0], t);
      return h('button', { class: 'btn game-btn' + (st >= SOLO_NEED.mittel ? ' good' : ''), onclick: () => doVb(t) },
        h('span', { class: 'gb-name' }, GAME_NAME[t]), h('small', {}, SOLO_INFO[t]));
    }));
    return h('div', { class: 'panel panel-wide' }, h('h3', {}, 'Solo ansagen'),
      h('p', {}, 'Im Solo spielst du allein gegen alle drei. Gewinn und Verlust zählen dreifach.'),
      grid,
      h('div', { class: 'btn-row', style: { marginTop: '10px' } }, btn('Zurück', () => { soloPick = false; render(); })));
  }

  function doVb(what) {
    const s = g.s;
    if (s.phase !== 'vorbehalt' || s.vb.turn !== 0) return;
    soloPick = false;
    sayVorbehalt(s, 0, what);
    persist(); render();
    afterVb();
    advance();
  }

  function afterVb() {
    const s = g.s;
    if (s.phase !== 'play') return;
    if (isSolo(s.type) && s.soloist !== 0) table.bubble(s.soloist, GAME_NAME[s.type] + '!', 2600);
    if (s.type === 'hochzeit' && s.hochzeiter !== 0) table.bubble(s.hochzeiter, 'Hochzeit!', 2600);
    if (!ui.coachOn()) return;
    if (isSolo(s.type)) {
      if (s.soloist === 0) coachOnce('solo-self', { title: 'Du spielst Solo', text: 'Du brauchst 121 Augen gegen drei Gegner. Zieh zuerst die Trümpfe heraus, dann hol deine Asse.', ms: 8000 });
      else coachOnce('solo-other', { title: `${nameOf(s.soloist)} spielt ${GAME_NAME[s.type]}`, text: `Ihr drei spielt zusammen. ${SOLO_INFO[s.type]} Haltet den Solisten unter 121 Augen und schmiert euch gegenseitig.`, ms: 9000 });
    } else if (s.type === 'hochzeit') {
      coachOnce('hochzeit', { title: 'Hochzeit', text: `${s.hochzeiter === 0 ? 'Du hast' : nameOf(s.hochzeiter) + ' hat'} beide Kreuz-Damen. Wer zuerst einen Stich gegen ${s.hochzeiter === 0 ? 'dich' : nameOf(s.hochzeiter)} gewinnt (in den ersten drei Stichen), wird Partner.`, ms: 9000 });
    } else {
      coachOnce('team-' + myTeam(), { title: myTeam() === 're' ? 'Du spielst Re' : 'Du spielst Kontra', text: s.hands[0].includes('CQ')
        ? (s.silent === 0 ? 'Du hast beide Kreuz-Damen und nichts gesagt – eine stille Hochzeit: Du spielst allein (zählt wie ein Solo).' : 'Du hast eine Kreuz-Dame. Wer die zweite hat, ist dein Partner – das zeigt sich, wenn sie fällt oder jemand „Re“ ansagt.')
        : 'Du hast keine Kreuz-Dame. Deine Partner sind die beiden anderen ohne Kreuz-Dame. Ihr braucht 120 Augen.', ms: 9000 });
    }
  }

  // ---------- Aktionen ----------
  function humanAnnounce(L) {
    const s = g.s;
    if (nextAnnouncement(s, 0) !== L) return;
    announce(s, 0, L);
    toast(`Du sagst: ${annText(myTeam(), L)}`);
    persist(); render();
  }

  function onCard(c) {
    const s = g.s;
    if (busy) return;
    if (s.phase !== 'play' || s.turn !== 0) {
      if (s.phase === 'play') toast(`${nameOf(s.turn)} ist dran.`);
      return;
    }
    const legal = legalFor(s, 0);
    if (!legal.includes(c)) { toast(whyIllegal(c), 3400); return; }
    if (ui.option('confirmTap', false) && pending !== c) { pending = c; render(); return; }
    pending = null;
    humanPlay(c);
  }

  function whyIllegal(c) {
    const s = g.s, t = s.type;
    const led = effSuit(s.trick[0].c, t);
    if (led === 'T') {
      const what = t === 'solo-Q' ? 'nur die Damen' : t === 'solo-J' ? 'nur die Buben' : 'die Herz-Zehnen, alle Damen und Buben und ' + (t === 'solo-C' ? 'Kreuz' : t === 'solo-S' ? 'Pik' : t === 'solo-H' ? 'Herz' : 'Karo');
      return `Trumpf ist angespielt – du musst Trumpf bedienen. Trumpf sind ${what}.`;
    }
    if (isTrump(c, t) && c[0] === led) return `${SUIT_NAME[led]} ist angespielt. ${cardName(c)} ist aber Trumpf und zählt nicht als ${SUIT_NAME[led]}.`;
    return `${SUIT_NAME[led]} ist angespielt – du musst ${SUIT_NAME[led]} bedienen.`;
  }

  function humanPlay(c) {
    const s = g.s;
    const before = ui.coachOn() ? clone(s) : null;
    hintCards = new Set();
    ui.coach.hide();
    playCard(s, 0, c);
    persist(); render();
    if (before) setTimeout(() => review(before, c), 60);
    advance();
  }

  function review(before, c) {
    if (ui.destroyed) return;
    if (new Set(legalFor(before, 0)).size < 2) return;
    const la = lookahead(before, 0, 10);
    if (!la.scores) return;
    const loss = la.scores[la.card] - la.scores[c];
    const pol = policy(before, 0);
    if (loss >= 18 && la.card !== c) {
      ui.coach.say({ title: `Besser wäre ${cardName(la.card)} gewesen`, kind: 'warn', text: pol.card === la.card ? pol.why : `Durchgerechnet bringt ${cardName(la.card)} deiner Seite im Schnitt deutlich mehr.`, ms: 9000 });
    } else if (pol.card === c && /Schmieren|Fuchs|Trumpf ziehen/.test(pol.why) && Math.random() < 0.5) {
      ui.coach.say({ title: 'Gut gespielt', kind: 'good', text: pol.why, ms: 5000 });
    }
  }

  function coachOnce(key, msg) {
    if (!ui.coachOn() || g.tipsShown[key]) return;
    g.tipsShown[key] = true; persist();
    ui.coach.say(msg);
  }

  // ---------- Ablauf ----------
  async function advance() {
    const my = ++token;
    const alive = () => !ui.destroyed && my === token;
    const lv = ui.level();
    while (alive()) {
      const s = g.s;
      if (s.phase === 'vorbehalt') {
        const p = s.vb.turn;
        if (p === 0) { busy = false; render(); return; }
        busy = true; render();
        await sleep(delay(600));
        if (!alive()) return;
        const what = aiVorbehalt(s, p, lv);
        sayVorbehalt(s, p, what);
        table.bubble(p, what === 'gesund' ? 'Gesund' : 'Vorbehalt', 1500);
        busy = false; persist(); render();
        afterVb();
        continue;
      }
      if (s.phase === 'play') {
        if (s.turn === 0) { busy = false; render(); return; }
        busy = true; render();
        await sleep(delay(600));
        if (!alive()) return;
        const p = s.turn;
        const L = aiAnnounce(s, p, lv);
        if (L) {
          announce(s, p, L);
          table.bubble(p, annText(teamOf(s, p), L), 2200);
          render();
          if (ui.coachOn() && L === 1 && s.known[p]) {
            const same = teamOf(s, p) === myTeam();
            coachOnce('ann-' + (same ? 'same' : 'other'), { title: `${nameOf(p)} sagt ${annText(teamOf(s, p), L)}`, text: same ? `Damit weißt du: ${nameOf(p)} spielt mit dir zusammen. Eine Ansage bringt 2 Extrapunkte – aber nur, wenn ihr gewinnt.` : `${nameOf(p)} spielt gegen dich. Die Ansage verdoppelt den Einsatz. Mit „Kontra“ bzw. „Re“ darfst du noch eine Karte später antworten.`, ms: 8000 });
          }
          await sleep(delay(500));
          if (!alive()) return;
        }
        playCard(s, p, aiCard(s, p, lv));
        busy = false; persist(); render();
        continue;
      }
      if (s.phase === 'collect') {
        busy = true; render();
        await sleep(delay(1000));
        if (!alive()) return;
        const w = currentWinner(s);
        const hzBefore = s.type === 'hochzeit' && s.klaerung < 0;
        await table.collect(w);
        collectTrick(s);
        busy = false; persist(); render();
        if (hzBefore && s.klaerung >= 0) {
          const msg = s.alone ? `Niemand hat in drei Stichen einen Stich gegen ${s.hochzeiter === 0 ? 'dich' : nameOf(s.hochzeiter)} gemacht – ${s.hochzeiter === 0 ? 'du spielst' : nameOf(s.hochzeiter) + ' spielt'} allein.`
            : `${w === 0 ? 'Du bist' : nameOf(w) + ' ist'} jetzt Partner von ${s.hochzeiter === 0 ? 'dir' : nameOf(s.hochzeiter)}.`;
          toast(msg, 3200);
        }
        continue;
      }
      if (s.phase === 'done') { busy = false; finishRound(); return; }
      return;
    }
  }

  function finishRound() {
    const s = g.s;
    if (!s.result) return;
    if (!s.counted) {
      s.counted = true;
      const r = s.result;
      r.scores.forEach((v, p) => { g.scores[p] += v; });
      g.list.push({ n: g.list.length + 1, type: s.type, winner: r.winner, me: r.scores[0], scores: g.scores.slice() });
      addResult('doppelkopf', r.scores[0] > 0);
      persist();
    }
    render();
    showResult();
  }

  async function showResult() {
    const s = g.s, r = s.result;
    if (!r) return;
    const mine = myTeam();
    const won = r.scores[0] > 0;
    const title = r.winner ? (r.winner === mine ? 'Gewonnen!' : 'Verloren') : 'Keiner gewinnt';
    const reNames = [0, 1, 2, 3].filter(p => s.re[p]).map(p => p === 0 ? 'du' : nameOf(p));
    const rows = r.lines.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', { class: 'num' }, '+' + v)));
    for (const e of r.extra) rows.push(h('tr', {}, h('td', {}, `${e.label} (${e.team === 're' ? 'Re' : 'Kontra'})`), h('td', { class: 'num' }, '±1')));
    rows.push(h('tr', { class: 'total' }, h('td', {}, isSolo(s.type) || r.solo ? 'Spielwert (Solist ×3)' : 'Spielwert'), h('td', { class: 'num' }, String(Math.abs(r.reScore)))));
    const content = h('div', { class: 'result' },
      h('p', { class: 'result-big ' + (won ? 'win' : r.scores[0] < 0 ? 'lose' : '') }, title),
      h('p', { html: `Re (${reNames.join(' & ')}): <b>${r.pts.re}</b> Augen · Kontra: <b>${r.pts.kontra}</b> Augen` }),
      h('table', { class: 'result-table' }, rows),
      h('table', { class: 'result-table' }, [0, 1, 2, 3].map(p => h('tr', {}, h('td', {}, NAMES[p] + (s.re[p] ? ' (Re)' : ' (Kontra)')), h('td', { class: 'num' }, (r.scores[p] > 0 ? '+' : '') + r.scores[p])))),
    );
    const v = await dialog({ title: 'Abrechnung', content, buttons: [{ label: 'Liste', value: 'list' }, { label: 'Nächstes Spiel', value: 'next', primary: true }], dismissable: true });
    if (v === 'list') { await showList(); return; }
    if (v === 'next') nextRound();
  }

  async function showList() {
    const rows = g.list.slice(-14).map(x => h('tr', {}, h('td', {}, String(x.n)), h('td', {}, GAME_NAME[x.type]),
      h('td', {}, x.winner ? (x.winner === 're' ? 'Re' : 'Kontra') : '–'), h('td', { class: 'num' }, (x.me > 0 ? '+' : '') + x.me)));
    const content = h('div', {},
      g.list.length ? h('table', { class: 'result-table' }, h('tr', {}, h('td', {}, '#'), h('td', {}, 'Spiel'), h('td', {}, 'Sieger'), h('td', { class: 'num' }, 'Du')), rows) : h('p', {}, 'Noch keine Spiele.'),
      h('table', { class: 'result-table' }, [0, 1, 2, 3].map(p => h('tr', { class: p === 0 ? 'total' : '' }, h('td', {}, NAMES[p]), h('td', { class: 'num' }, String(g.scores[p]))))));
    await dialog({ title: 'Spielliste', content, buttons: [{ label: 'Schließen', value: true, primary: true }], dismissable: true });
  }

  async function showLastTrick() {
    const s = g.s;
    const tr = s.tricks[s.tricks.length - 1];
    if (!tr) return;
    await dialog({ title: 'Letzter Stich', content: h('div', {},
      h('div', { class: 'cardline big' }, tr.cards.map(x => h('div', { class: 'lt-item' }, cardEl(x.c), h('small', {}, NAMES[x.p])))),
      h('p', {}, `${tr.winner === 0 ? 'Du hast' : nameOf(tr.winner) + ' hat'} den Stich bekommen (${cardsPoints(tr.cards.map(x => x.c))} Augen).`)),
    buttons: [{ label: 'OK', value: true, primary: true }], dismissable: true });
  }

  function nextRound() {
    ui.coach.hide();
    table.clearBubbles();
    fresh(true);
    render();
    advance();
  }

  // ---------- Tipp ----------
  function tip() {
    const s = g.s;
    if (s.phase === 'vorbehalt' && s.vb.turn === 0) {
      const best = SOLOS.map(t => ({ t, st: soloStrength(s.hands[0], t) })).sort((a, b) => b.st - a.st)[0];
      if (best.st >= SOLO_NEED.mittel) ui.coach.say({ title: `${GAME_NAME[best.t]} ansagen!`, text: `${SOLO_INFO[best.t]} Mit deinen Karten hast du gute Chancen allein.` });
      else if (hasBothQueens(s.hands[0])) ui.coach.say({ title: 'Hochzeit', text: 'Mit beiden Kreuz-Damen sagst du Hochzeit an. Der Erste, der einen Stich gegen dich macht, wird dein Partner.' });
      else ui.coach.say({ title: 'Gesund', text: ['Für ein Solo brauchst du viele hohe Trümpfe und Asse – das ist hier nicht drin.', myTeamHint().trim()] });
      return;
    }
    if (s.phase === 'play' && s.turn === 0) {
      busy = true;
      ui.coach.say({ title: 'Ich rechne …', text: 'Einen Moment.' });
      setTimeout(() => {
        busy = false;
        const la = lookahead(s, 0, 16);
        const pol = policy(s, 0);
        hintCards = new Set([la.card]);
        render();
        const text = [pol.card === la.card ? pol.why : `Ich habe die restlichen Karten viele Male durchgespielt – mit ${cardName(la.card)} holt deine Seite im Schnitt am meisten.`];
        const L = nextAnnouncement(s, 0);
        if (L === 1 && handStrength(s.hands[0], s.type) >= (myTeam() === 're' ? 9.6 : 10.2)) text.push(`Dein Blatt ist stark – du könntest <b>${annText(myTeam(), 1).replace('!', '')}</b> ansagen.`);
        ui.coach.say({ title: `Spiel ${cardName(la.card)}`, text, actions: [{ label: 'Ausführen', primary: true, onClick: () => { if (g.s.phase === 'play' && g.s.turn === 0) humanPlay(la.card); } }] });
      }, 30);
      return;
    }
    ui.coach.say({ title: 'Tipp', text: 'Tipps gibt es, wenn du am Zug bist.', ms: 2500 });
  }

  // ---------- Menü ----------
  ui.onTip = tip;
  ui.onNew = async () => {
    const r = await dialog({ title: 'Neue Liste?', body: 'Alle Konten werden auf 0 gesetzt.', buttons: [{ label: 'Abbrechen', value: false }, { label: 'Neue Liste', value: true, primary: true }] });
    if (r) { token++; g = null; fresh(false); render(); advance(); }
  };
  ui.menuExtra = () => {
    const sw = (key, label, small) => {
      const i = h('input', { type: 'checkbox', class: 'switch', onchange: e => { ui.setOption(key, e.target.checked); render(); } });
      i.checked = !!ui.option(key, false);
      return h('label', { class: 'switch-row' }, h('span', {}, label, h('small', {}, small)), i);
    };
    return h('div', {},
      sw('dulle2', 'Zweite Dulle sticht die erste', 'Beliebte Hausregel (gilt ab dem nächsten Spiel, nicht im letzten Stich)'),
      sw('confirmTap', 'Karte bestätigen', 'Erst antippen, dann noch einmal zum Ausspielen'),
      h('button', { class: 'btn btn-quiet', style: { marginTop: '8px' }, onclick: showList }, 'Spielliste ansehen'));
  };

  const ro = new ResizeObserver(() => render());
  ro.observe(table.handEl);

  if (!g || !g.s) fresh(false);
  render();
  advance();
  coachOnce('welcome', { title: 'Willkommen beim Doppelkopf', text: ['Ihr spielt zu viert, meistens zwei gegen zwei. Wer eine <b>Kreuz-Dame</b> hat, gehört zur Partei <b>Re</b>, die anderen sind <b>Kontra</b> – wer zu wem gehört, ist am Anfang geheim.', 'Die Glühbirne gibt Tipps, das Buch erklärt Trümpfe und Wertung.'], ms: 12000 });

  return () => { token++; ro.disconnect(); };
}
