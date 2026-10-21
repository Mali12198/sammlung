// Gemeinsamer Kartentisch für Stichspiele (Skat, Doppelkopf):
// Sitzplätze, Stichmitte, eigene Hand als Fächer, Status- und Aktionszeile.
import { h } from '../ui.js';
import { cardEl, fitHand } from './render.js';

const DIR = { bottom: [0, 170], left: [-170, -10], right: [170, -10], top: [0, -170] };

export function cardTable(ui, { names, positions }) {
  const n = names.length;
  const four = n === 4;
  const felt = h('div', { class: 'felt ' + (four ? 'four-seats' : 'three-seats') });
  const seatsEl = h('div', { class: 'seats' });
  const trickEl = h('div', { class: 'trick' + (four ? ' four' : '') });
  const pillL = h('div', { class: 'trump-pill', hidden: true });
  const pillR = h('button', { class: 'trump-pill score-pill', hidden: true });
  const center = h('div', { class: 'table-center-msg', hidden: true });
  const status = h('div', { class: 'statusline', 'aria-live': 'polite' });
  const actions = h('div', { class: 'action-row' });
  const handEl = h('div', { class: 'hand fan', role: 'list', 'aria-label': 'Deine Karten' });
  const handZone = h('div', { class: 'hand-zone' }, status, actions, handEl);

  const seats = [];
  for (let i = 1; i < n; i++) {
    const nameEl = h('span', { class: 'name' }, h('span', { class: 'turn-dot' }), h('span', { class: 'nm' }, names[i]));
    const role = h('div', { class: 'role' });
    const mini = h('div', { class: 'mini-hand' });
    const open = h('div', { class: 'open-hand' });
    const bubbleSlot = h('div', { class: 'bubble-slot' });
    const el = h('div', { class: 'seat ' + positions[i] }, nameEl, role, mini, open, bubbleSlot);
    seats[i] = { el, role, mini, open, bubbleSlot, nameEl, count: -1, timer: null };
    seatsEl.append(el);
  }
  seatsEl.append(trickEl, pillL, pillR, center);
  felt.append(seatsEl, handZone);
  ui.stage.append(felt);

  const api = {
    felt, handEl, status, actions, center, pillL, pillR, trickEl, positions,
    // Namen je Sitzplatz (Index = Platz auf dem Bildschirm, 0 = unten)
    setNames(list) {
      for (let i = 1; i < n; i++) {
        const st = seats[i];
        st.nameEl.querySelector('.nm').textContent = list[i];
        st.count = -1;
        st.bubbleSlot.replaceChildren();
      }
      trickEl.replaceChildren();
    },
    setSeat(i, { role, on, count, open, openCards }) {
      const s = seats[i];
      if (!s) return;
      s.el.classList.toggle('on', !!on);
      if (role !== undefined) s.role.innerHTML = role || '';
      if (count !== undefined && count !== s.count) {
        s.count = count;
        s.mini.replaceChildren(...Array.from({ length: Math.min(count, 12) }, () => cardEl(null, { faceDown: true })));
      }
      if (openCards !== undefined) {
        s.open.replaceChildren(...(openCards || []).map(c => cardEl(c, { w: 26 })));
        s.mini.hidden = !!(openCards && openCards.length);
      }
    },
    bubble(i, text, ms = 1800) {
      const s = seats[i];
      if (!s) return;
      clearTimeout(s.timer);
      s.bubbleSlot.replaceChildren(text ? h('div', { class: 'bubble' }, text) : '');
      if (text && ms) s.timer = setTimeout(() => s.bubbleSlot.replaceChildren(), ms);
    },
    clearBubbles() { for (const s of seats) if (s) { clearTimeout(s.timer); s.bubbleSlot.replaceChildren(); } },
    // trick: [{p, c}]
    renderTrick(trick, { winner = -1, animateLast = true } = {}) {
      trickEl.classList.remove('collect');
      const have = [...trickEl.children].map(x => x.dataset.key);
      const want = trick.map(x => x.p + ':' + x.c);
      if (have.join('|') === want.join('|')) return;
      trickEl.replaceChildren(...trick.map((x, k) => {
        const el = cardEl(x.c, { cls: 'from-' + x.p });
        el.dataset.key = x.p + ':' + x.c;
        el.style.zIndex = String(k + 1);
        if (!(animateLast && k === trick.length - 1 && !have.includes(el.dataset.key))) el.style.animation = 'none';
        if (k === winner) el.classList.add('is-win');
        return el;
      }));
    },
    collect(winner) {
      return new Promise(res => {
        const [dx, dy] = DIR[positions[winner]] || [0, 0];
        trickEl.style.setProperty('--cx', dx + 'px');
        trickEl.style.setProperty('--cy', dy + 'px');
        trickEl.classList.add('collect');
        setTimeout(() => { trickEl.replaceChildren(); trickEl.classList.remove('collect'); res(); }, 380);
      });
    },
    // cards: Array; opts: { playable(i)->bool, selected:Set<i>, hint:Set<i>, onTap(i), trump(c)->bool, dimAll }
    renderHand(cards, opts = {}) {
      const avail = Math.max(240, (handEl.clientWidth || 390) - 40);
      const nCards = cards.length;
      const { w, ov } = fitHand(nCards, avail, 68, 27);
      handEl.style.setProperty('--hcw', w + 'px');
      handEl.style.setProperty('--ov', ov + 'px');
      const els = cards.map((c, i) => {
        const el = cardEl(c, { w });
        el.setAttribute('role', 'listitem');
        const mid = (nCards - 1) / 2;
        const off = i - mid;
        el.style.setProperty('--rot', (off * Math.min(1.7, 14 / Math.max(1, nCards))).toFixed(2) + 'deg');
        el.style.setProperty('--arc', (Math.abs(off) ** 2 * Math.min(0.7, 6 / Math.max(1, nCards))).toFixed(1) + 'px');
        const playable = opts.playable ? opts.playable(i) : true;
        if (!playable || opts.dimAll) el.classList.add('is-dim');
        if (opts.selected && opts.selected.has(i)) el.classList.add('is-sel');
        if (opts.hint && opts.hint.has(i)) el.classList.add('is-hint');
        if (opts.trump && opts.trump(c)) el.classList.add('is-trump');
        if (opts.onTap) el.addEventListener('click', () => opts.onTap(i, el));
        return el;
      });
      handEl.replaceChildren(...els);
    },
    setStatus(html) { status.innerHTML = html || ''; },
    setActions(nodes) { actions.replaceChildren(...(nodes || []).filter(Boolean)); },
    setCenter(node) {
      center.hidden = !node;
      center.replaceChildren(...(node ? [node] : []));
    },
    setPills(left, right, onRight) {
      pillL.hidden = !left; pillL.innerHTML = left || '';
      pillR.hidden = !right; pillR.innerHTML = right || '';
      pillR.onclick = onRight || null;
    },
  };
  return api;
}
