// Einstieg: Startseite (Spieleregal) und Navigation zwischen den Spielen.
import { h, svgEl, openRulebook, iconButton, dialog } from './ui.js';
import { load, settings, setSetting, stats } from './store.js';
import { gameScreen } from './shell.js';

const GAMES = [
  { id: 'backgammon', name: 'Backgammon', tag: 'Würfeln, ziehen, auswürfeln. Gegen den Computer oder zu zweit.', color: 'var(--box-backgammon)', art: artBackgammon },
  { id: 'schach', name: 'Schach', tag: 'Die klassische Partie – gegen den Computer oder zu zweit.', color: 'var(--box-chess)', art: artChess },
  { id: 'kanaster', name: 'Kanaster', tag: 'Melden und Canastas bauen. Zu viert mit Partner oder zu zweit.', color: 'var(--box-canasta)', art: artCanasta },
  { id: 'doppelkopf', name: 'Doppelkopf', tag: 'Re oder Kontra? Zu viert, mit Computern oder Freunden.', color: 'var(--box-doko)', art: artDoko },
  { id: 'skat', name: 'Skat', tag: 'Reizen, drücken, ausspielen. Zu dritt, mit Computern oder Freunden.', color: 'var(--box-skat)', art: artSkat },
  { id: 'kniffel', name: 'Kniffel', tag: 'Drei Würfe, dreizehn Felder. Allein auf Bestwert oder bis zu sechst.', color: 'var(--box-kniffel)', art: artKniffel },
  { id: 'qwixx', name: 'Qwixx', tag: 'Kreuzen, was die Würfel hergeben. Zwei bis fünf Spieler.', color: 'var(--box-qwixx)', art: artQwixx },
];

const MODULES = {
  backgammon: () => import('./games/backgammon/view.js'),
  schach: () => import('./games/chess/view.js'),
  kanaster: () => import('./games/canasta/view.js'),
  doppelkopf: () => import('./games/doppelkopf/view.js'),
  skat: () => import('./games/skat/view.js'),
  kniffel: () => import('./games/kniffel/view.js'),
  qwixx: () => import('./games/qwixx/view.js'),
};
const RULES = {
  backgammon: () => import('./games/backgammon/rules.js'),
  schach: () => import('./games/chess/rules.js'),
  kanaster: () => import('./games/canasta/rules.js'),
  doppelkopf: () => import('./games/doppelkopf/rules.js'),
  skat: () => import('./games/skat/rules.js'),
  kniffel: () => import('./games/kniffel/rules.js'),
  qwixx: () => import('./games/qwixx/rules.js'),
};

const app = document.getElementById('app');
let cleanup = null;
let updateReady = false;   // neue Version installiert → beim nächsten Seitenwechsel neu laden

function miniCard(x, y, rot, rank, suit, red) {
  const col = red ? '#b3261e' : '#1b2130';
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <rect x="-17" y="-24" width="34" height="48" rx="4" fill="#f7f0e2" stroke="rgba(0,0,0,.25)"/>
    <text x="-12" y="-9" font-family="Young Serif, Georgia, serif" font-size="13" fill="${col}">${rank}</text>
    <svg x="-9" y="-2" width="18" height="18" viewBox="0 0 100 100" fill="${col}"><use href="#s-${suit}"/></svg>
  </g>`;
}

function artSkat() {
  return `<svg viewBox="0 0 100 90">${miniCard(34, 50, -16, 'B', 'C', false)}${miniCard(50, 44, 0, 'B', 'S', false)}${miniCard(66, 50, 16, 'B', 'H', true)}</svg>`;
}
function artDoko() {
  return `<svg viewBox="0 0 100 90">${miniCard(40, 46, -10, 'D', 'C', false)}${miniCard(60, 46, 10, 'D', 'C', false)}</svg>`;
}
function artCanasta() {
  return `<svg viewBox="0 0 100 90">${miniCard(28, 52, -22, '7', 'H', true)}${miniCard(42, 46, -8, '7', 'D', true)}${miniCard(58, 46, 8, '7', 'S', false)}
  <g transform="translate(74 52) rotate(22)"><rect x="-17" y="-24" width="34" height="48" rx="4" fill="#f7f0e2" stroke="rgba(0,0,0,.25)"/>
  <svg x="-12" y="-12" width="24" height="24" viewBox="0 0 100 100" fill="#b3261e"><use href="#s-X"/></svg></g></svg>`;
}
function artBackgammon() {
  let tri = '';
  for (let i = 0; i < 5; i++) {
    const x = 4 + i * 18;
    tri += `<path d="M${x} 4 L${x + 16} 4 L${x + 8} 46 Z" fill="${i % 2 ? 'rgba(244,236,221,.85)' : 'rgba(244,236,221,.32)'}"/>`;
  }
  const die = (x, y, r, pips) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-13" y="-13" width="26" height="26" rx="5" fill="#f7f0e2" stroke="rgba(0,0,0,.3)"/>${pips.map(([a, b]) => `<circle cx="${a}" cy="${b}" r="2.8" fill="#1b2130"/>`).join('')}</g>`;
  return `<svg viewBox="0 0 100 90">${tri}${die(36, 66, -12, [[-6, -6], [0, 0], [6, 6]])}${die(66, 64, 10, [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, 0]])}</svg>`;
}
function die(x, y, r, v, fill = '#f7f0e2', pip = '#1b2130') {
  const P = { 1: [[0, 0]], 2: [[-6, -6], [6, 6]], 3: [[-6, -6], [0, 0], [6, 6]], 4: [[-6, -6], [6, -6], [-6, 6], [6, 6]], 5: [[-6, -6], [6, -6], [0, 0], [-6, 6], [6, 6]], 6: [[-6, -7], [6, -7], [-6, 0], [6, 0], [-6, 7], [6, 7]] }[v];
  return `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-13" y="-13" width="26" height="26" rx="5" fill="${fill}" stroke="rgba(0,0,0,.3)"/>${P.map(([a, b]) => `<circle cx="${a}" cy="${b}" r="2.7" fill="${pip}"/>`).join('')}</g>`;
}
function artKniffel() {
  return `<svg viewBox="0 0 100 90">${die(22, 58, -14, 6)}${die(44, 40, 8, 6)}${die(66, 60, -6, 6)}${die(84, 34, 16, 6)}${die(50, 72, 20, 6, '#e9cf8a')}</svg>`;
}
function artQwixx() {
  const rows = [['#c8322d', 0], ['#e3b31d', 1], ['#2e8b4a', 2], ['#2b5fa8', 3]];
  let o = '';
  for (const [col, k] of rows) {
    const y = 10 + k * 18;
    o += `<rect x="6" y="${y}" width="88" height="15" rx="3" fill="${col}"/>`;
    for (let i = 0; i < 6; i++) {
      const x = 10 + i * 14;
      o += `<rect x="${x}" y="${y + 2}" width="11" height="11" rx="2" fill="rgba(255,255,255,.85)"/>`;
      if ((k + i) % 3 === 0 || (k === 1 && i < 3)) o += `<path d="M${x + 2.5} ${y + 4.5} l6 6 M${x + 8.5} ${y + 4.5} l-6 6" stroke="#1b2130" stroke-width="1.8" stroke-linecap="round"/>`;
    }
  }
  return `<svg viewBox="0 0 100 90">${o}</svg>`;
}
function artChess() {
  return `<svg viewBox="0 0 100 90"><svg x="22" y="0" width="74" height="86" viewBox="0 0 100 100" fill="#f4ecdd"><use href="#p-N"/></svg>
  <svg x="0" y="34" width="44" height="52" viewBox="0 0 100 100" fill="rgba(244,236,221,.55)"><use href="#p-P"/></svg></svg>`;
}

function renderHome() {
  document.title = 'Spielesammlung';
  const shelf = h('div', { class: 'shelf' }, GAMES.map(g => {
    const saved = load('save:' + g.id);
    const st = stats(g.id);
    const box = h('div', { class: 'box', style: { '--box': g.color }, role: 'button', tabindex: '0', 'aria-label': g.name + ' spielen' });
    const rulesBtn = h('button', { class: 'box-rules', onclick: async e => {
      e.stopPropagation();
      const m = await RULES[g.id]();
      openRulebook(m.default);
    } }, 'Regelheft');
    const lid = h('div', { class: 'box-lid' },
      h('div', {},
        h('h2', { class: 'box-name' }, g.name),
        h('p', { class: 'box-tag' }, g.tag),
        h('div', { class: 'box-meta' },
          saved ? h('span', { class: 'box-badge' }, 'Partie läuft') : (st.played ? h('span', { class: 'box-badge' }, `${st.won} von ${st.played} gewonnen`) : null),
          rulesBtn)),
      h('div', { class: 'box-art' }, svgEl(g.art())));
    box.append(lid, h('div', { class: 'box-edge' }));
    const go = () => { location.hash = '#/' + g.id; };
    box.addEventListener('click', go);
    box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    return box;
  }));

  const page = h('div', { class: 'home' },
    h('div', { class: 'home-head' },
      h('div', {},
        h('h1', { class: 'home-title' }, 'Spielesammlung'),
        h('p', { class: 'home-sub' }, 'Sieben Klassiker gegen den Computer oder mit Freunden an einem iPhone. Mit Regelheft und einem Trainer, der dir über die Schulter schaut.')),
      iconButton('gear', 'Einstellungen', openSettings)),
    shelf,
    h('p', { class: 'home-foot' }, 'Tipp: Über „Teilen → Zum Home-Bildschirm“ wird die Sammlung zur App auf deinem iPhone.'));
  app.replaceChildren(page);
}

async function openSettings() {
  const s = settings();
  const sw = h('input', { type: 'checkbox', class: 'switch', onchange: e => setSetting('coach', e.target.checked) });
  sw.checked = s.coach;
  const content = h('div', {},
    h('label', { class: 'switch-row' }, h('span', {}, 'Trainer', h('small', {}, 'Hinweise und Warnungen während des Spiels')), sw),
    h('p', { class: 'field-label' }, 'Tempo der Computerzüge'),
    (() => {
      const seg = h('div', { class: 'seg' });
      for (const [v, l] of [['langsam', 'Ruhig'], ['normal', 'Normal'], ['schnell', 'Flott']]) {
        seg.append(h('button', { 'aria-pressed': String(s.speed === v), onclick: e => {
          seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
          e.currentTarget.setAttribute('aria-pressed', 'true');
          setSetting('speed', v);
        } }, l));
      }
      return seg;
    })());
  await dialog({ title: 'Einstellungen', content, buttons: [{ label: 'Fertig', value: true, primary: true }], dismissable: true });
}

async function renderGame(id) {
  const g = GAMES.find(x => x.id === id);
  if (!g) { location.hash = '#/'; return; }
  document.title = g.name;
  const [mod, rules] = await Promise.all([MODULES[id](), RULES[id]()]);
  const screen = gameScreen({ id, title: g.name, book: rules.default, color: g.color });
  app.replaceChildren(screen.root);
  const stop = mod.mount(screen);
  cleanup = () => { screen.destroyed = true; stop && stop(); };
}

async function route() {
  // Nach einem Update komplett neu laden, damit nie alte und neue Dateien gemischt werden.
  if (updateReady) { location.reload(); return; }
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  document.querySelectorAll('.sheet, .sheet-backdrop, .dialog-backdrop, .handover, .toast').forEach(n => n.remove());
  const id = (location.hash.replace(/^#\/?/, '') || '').split('/')[0];
  window.scrollTo(0, 0);
  if (!id) renderHome();
  else {
    try { await renderGame(id); }
    catch (e) {
      console.error(e);
      app.replaceChildren(h('div', { class: 'home' }, h('h1', { class: 'home-title' }, 'Das Spiel ließ sich nicht laden'),
        h('p', { class: 'home-sub' }, String(e.message || e)), h('button', { class: 'btn', onclick: () => { location.hash = '#/'; } }, 'Zur Sammlung')));
    }
  }
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; }   // Erstinstallation: alles ist schon aktuell
    if (updateReady) return;
    updateReady = true;
    // Auf der Startseite sofort neu laden, im Spiel erst beim nächsten Seitenwechsel (Spielstand ist gespeichert).
    if (!location.hash.replace(/^#\/?/, '')) location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
