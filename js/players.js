// Mehrspieler an einem Gerät: Spieler auswählen und das iPhone weiterreichen.
import { h, dialog } from './ui.js';
import { load, save } from './store.js';

export const CPU_NAMES = ['Lotte', 'Karl', 'Hanne', 'Otto', 'Grete', 'Paul'];

// Liefert [{ name, human }] oder null (abgebrochen).
// seats: feste Platzanzahl ODER min/max für eine wählbare Anzahl.
// lockedCpu: Plätze, die immer Computer sind (z. B. nie)
export function choosePlayers({ title = 'Wer spielt mit?', min = 2, max = 2, count, current, note, allowNoHuman = false, labels } = {}) {
  const saved = load('playerNames', []);
  let n = count || (current ? current.length : min);
  if (n < min) n = min; if (n > max) n = max;
  // Startwerte
  let seats = Array.from({ length: max }, (_, i) => {
    const cur = current && current[i];
    if (cur) return { ...cur };
    return { human: i === 0, name: i === 0 ? (saved[0] || 'Du') : CPU_NAMES[(i - 1) % CPU_NAMES.length] };
  });
  return new Promise(resolve => {
    const body = h('div', { class: 'players-form' });
    const render = () => {
      const rows = [];
      if (min !== max) {
        const seg = h('div', { class: 'seg' });
        for (let k = min; k <= max; k++) {
          seg.append(h('button', { 'aria-pressed': String(k === n), onclick: () => { n = k; render(); } }, String(k)));
        }
        rows.push(h('p', { class: 'field-label' }, 'Anzahl Spieler'), seg);
      }
      for (let i = 0; i < n; i++) {
        const s = seats[i];
        const input = h('input', { type: 'text', class: 'name-input', value: s.name, maxlength: '12', 'aria-label': `Name Spieler ${i + 1}`, oninput: e => { s.name = e.target.value; } });
        const tog = h('div', { class: 'seg seg-small' },
          h('button', { 'aria-pressed': String(s.human), onclick: () => { s.human = true; if (CPU_NAMES.includes(s.name) || s.name === '') s.name = saved[i] || (i === 0 ? 'Du' : `Spieler ${i + 1}`); render(); } }, 'Mensch'),
          h('button', { 'aria-pressed': String(!s.human), onclick: () => { s.human = false; s.name = CPU_NAMES[(i + CPU_NAMES.length - 1) % CPU_NAMES.length]; render(); } }, 'Computer'));
        rows.push(h('div', { class: 'player-row' + (s.human ? ' is-human' : '') },
          h('span', { class: 'seat-no' }, labels ? labels[i] : String(i + 1)), input, tog));
      }
      if (note) rows.push(h('p', { class: 'small', html: note }));
      body.replaceChildren(...rows);
    };
    render();
    dialog({
      title, content: body, dismissable: true,
      buttons: [{ label: 'Abbrechen', value: null }, { label: 'Los geht’s', value: 'go', primary: true }],
    }).then(v => {
      if (v !== 'go') return resolve(null);
      const res = seats.slice(0, n).map((s, i) => ({ human: !!s.human, name: (s.name || '').trim() || (s.human ? `Spieler ${i + 1}` : CPU_NAMES[i % CPU_NAMES.length]) }));
      if (!allowNoHuman && !res.some(p => p.human)) res[0].human = true;
      // Bei mehreren Menschen ist „Du“ kein guter Name
      if (res.filter(p => p.human).length > 1) res.forEach((p, i) => { if (p.human && /^du$/i.test(p.name)) p.name = `Spieler ${i + 1}`; });
      // doppelte Namen unterscheiden
      const seen = {};
      for (const p of res) { if (seen[p.name]) p.name += ' ' + (++seen[p.name]); else seen[p.name] = 1; }
      save('playerNames', res.map(p => (p.human ? p.name : null)).map((x, i) => x || saved[i] || null));
      resolve(res);
    });
  });
}

// Bildschirm zum Weiterreichen: verdeckt alles, bis der richtige Spieler tippt.
export function handover(name, sub = 'Die anderen schauen bitte weg.') {
  return new Promise(resolve => {
    document.querySelectorAll('.handover').forEach(n => n.remove());
    const el = h('div', { class: 'handover', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'handover-box' },
        h('div', { class: 'handover-icon', html: '<svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 18.5h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' }),
        h('p', { class: 'handover-small' }, 'Gib das iPhone weiter an'),
        h('h2', {}, name),
        h('p', { class: 'handover-small' }, sub),
        h('button', { class: 'btn btn-primary', onclick: () => { el.remove(); resolve(); } }, `Ich bin ${name} – los`)));
    document.body.append(el);
    el.querySelector('button').focus({ preventScroll: true });
  });
}

export const humanCount = players => players.filter(p => p.human).length;
