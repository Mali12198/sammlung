// Spielbildschirm: Kopfzeile mit Zurück, Regelheft, Tipp und Menü.
import { h, iconButton, openRulebook, dialog, Coach } from './ui.js';
import { settings, setSetting, gameSettings, setGameSetting } from './store.js';

export const LEVELS = [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['schwer', 'Schwer']];

export function gameScreen({ id, title, book, color }) {
  const api = {
    onTip: null,       // () => void
    onNew: null,       // () => void
    onUndo: null,      // () => void | null
    canUndo: () => false,
    menuExtra: null,   // () => Node  (spielspezifische Optionen)
    onLevel: null,
    destroyed: false,
  };

  const sub = h('small', {});
  const tipBtn = iconButton('bulb', 'Tipp zeigen', () => api.onTip && api.onTip());
  const root = h('div', { class: 'screen', style: { '--game': color } },
    h('header', { class: 'topbar' },
      iconButton('back', 'Zur Sammlung', () => { location.hash = '#/'; }),
      h('h1', { class: 'topbar-title' }, title, sub),
      iconButton('book', 'Regelheft', () => openRulebook(book)),
      tipBtn,
      iconButton('more', 'Menü', () => openMenu())),
    h('main', { class: 'stage' }));
  const stage = root.querySelector('.stage');
  const coach = new Coach(root);

  api.root = root;
  api.stage = stage;
  api.coach = coach;
  api.tipBtn = tipBtn;
  api.setSubtitle = t => { sub.textContent = t || ''; };
  api.level = () => gameSettings(id).level;
  api.coachOn = () => settings().coach;
  api.option = (k, d) => { const v = gameSettings(id)[k]; return v === undefined ? d : v; };
  api.setOption = (k, v) => setGameSetting(id, k, v);
  api.openRules = tab => openRulebook(book, tab);

  async function openMenu() {
    const lvl = api.level();
    const seg = (items, cur, on) => h('div', { class: 'seg', role: 'group' }, items.map(([v, l]) =>
      h('button', { 'aria-pressed': String(v === cur), onclick: e => {
        e.currentTarget.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        on(v);
      } }, l)));
    const coachSw = h('input', { type: 'checkbox', class: 'switch', 'aria-label': 'Trainer', onchange: e => setSetting('coach', e.target.checked) });
    coachSw.checked = settings().coach;
    const content = h('div', {},
      h('p', { class: 'field-label' }, 'Stärke des Computers'),
      seg(LEVELS, lvl, v => { setGameSetting(id, 'level', v); api.onLevel && api.onLevel(v); }),
      h('p', { class: 'field-label' }, 'Tempo der Computerzüge'),
      seg([['langsam', 'Ruhig'], ['normal', 'Normal'], ['schnell', 'Flott']], settings().speed, v => setSetting('speed', v)),
      h('label', { class: 'switch-row' },
        h('span', {}, 'Trainer', h('small', {}, 'Kommentiert deine Züge und warnt vor Fehlern')),
        coachSw),
      api.menuExtra ? api.menuExtra() : null);
    const buttons = [];
    if (api.onUndo) buttons.push({ label: 'Zug zurücknehmen', value: 'undo', disabled: !api.canUndo() });
    buttons.push({ label: 'Neues Spiel', value: 'new', primary: true });
    buttons.push({ label: 'Schließen', value: null, quiet: true });
    const r = await dialog({ title: 'Spiel', content, buttons, layout: 'list', dismissable: true });
    if (r === 'new') api.onNew && api.onNew();
    if (r === 'undo') api.onUndo && api.onUndo();
  }
  api.openMenu = openMenu;
  return api;
}
