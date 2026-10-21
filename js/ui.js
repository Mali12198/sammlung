// Gemeinsame UI-Bausteine: Elemente, Icons, Dialoge, Regelheft, Toast, Trainer.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function svgEl(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  book: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5c-.8 0-1.5.7-1.5 1.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5.7 1.5 1.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  more: '<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  undo: '<path d="M9 7H4V2M4.5 7A8 8 0 1 1 4 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  coach: '<path d="M4 5h16v10H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
};

export function icon(name) {
  return svgEl(`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`);
}

export function iconButton(name, label, onclick) {
  const b = h('button', { class: 'icon-btn', 'aria-label': label, title: label, onclick });
  b.append(icon(name));
  return b;
}

export function suitSvg(s, cls = '') {
  return `<svg class="suit ${cls}" viewBox="0 0 100 100" aria-hidden="true"><use href="#s-${s}"/></svg>`;
}

// ---------- Toast ----------
let toastTimer;
export function toast(msg, ms = 2200) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

// ---------- Dialog ----------
// buttons: [{label, value, primary, sub}]  layout: 'row' | 'list'
export function dialog({ title, body, buttons = [{ label: 'OK', value: true, primary: true }], layout = 'row', dismissable = false, content }) {
  return new Promise(resolve => {
    const close = v => { bd.remove(); resolve(v); };
    const wrap = h('div', { class: layout === 'list' ? 'choice-list' : 'btn-row' },
      buttons.map(b => h('button', {
        class: 'btn' + (b.primary ? ' btn-primary' : '') + (b.quiet ? ' btn-quiet' : ''),
        disabled: b.disabled,
        onclick: () => close(b.value),
      }, h('span', {}, b.label), b.sub ? h('small', {}, b.sub) : null)));
    const dlg = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' },
      title ? h('h2', {}, title) : null,
      body ? (typeof body === 'string' ? h('p', { html: body }) : body) : null,
      (typeof content === 'function' ? content(close) : content) || null,
      wrap);
    const bd = h('div', { class: 'dialog-backdrop', onclick: e => { if (dismissable && e.target === bd) close(null); } }, dlg);
    document.body.append(bd);
    const first = dlg.querySelector('.btn-primary') || dlg.querySelector('button');
    first && first.focus({ preventScroll: true });
  });
}

// ---------- Regelheft ----------
export function openRulebook(book, startTab) {
  const tabs = book.tabs;
  let cur = Math.max(0, tabs.findIndex(t => t.id === startTab));
  const body = h('div', { class: 'sheet-body' });
  const tabBar = h('div', { class: 'tabs', role: 'tablist' });
  const render = () => {
    tabBar.replaceChildren(...tabs.map((t, i) => h('button', {
      class: 'tab', role: 'tab', 'aria-selected': String(i === cur),
      onclick: () => { cur = i; render(); body.scrollTop = 0; },
    }, t.label)));
    body.replaceChildren(h('div', { class: 'rules', html: tabs[cur].html }));
  };
  const close = () => {
    sheet.classList.add('is-closing');
    bd.remove();
    setTimeout(() => sheet.remove(), 220);
  };
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': book.title },
    h('div', { class: 'sheet-grip' }),
    h('div', { class: 'sheet-head' }, h('h2', { class: 'sheet-title' }, book.title), iconButton('close', 'Schließen', close)),
    tabBar, body);
  const bd = h('div', { class: 'sheet-backdrop', onclick: close });
  render();
  document.body.append(bd, sheet);
  // Wischen nach unten schließt
  let y0 = null;
  sheet.querySelector('.sheet-head').addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
  sheet.querySelector('.sheet-head').addEventListener('touchend', e => {
    if (y0 != null && e.changedTouches[0].clientY - y0 > 60) close();
    y0 = null;
  });
  return close;
}

// ---------- Trainer ----------
export class Coach {
  constructor(parent) {
    this.el = h('div', { class: 'coach', hidden: true, role: 'status', 'aria-live': 'polite' });
    parent.append(this.el);
    this.timer = null;
  }
  // kind: 'tip' | 'warn' | 'good'
  say({ title = 'Trainer', text, kind = 'tip', actions = [], ms = 0, onClose = null }) {
    clearTimeout(this.timer);
    const paras = (Array.isArray(text) ? text : [text]).filter(Boolean).map(t => h('p', { html: t }));
    const close = h('button', { class: 'coach-close', 'aria-label': 'Schließen', onclick: () => { this.hide(); onClose && onClose(); } }, icon('close'));
    const acts = actions.length ? h('div', { class: 'coach-actions' }, actions.map(a =>
      h('button', { class: 'btn' + (a.primary ? ' btn-primary' : ''), onclick: () => { this.hide(); a.onClick && a.onClick(); } }, a.label))) : null;
    this.el.className = 'coach is-' + kind;
    this.el.replaceChildren(h('div', { class: 'coach-head' }, h('span', { class: 'dot' }), title), ...paras, acts || '', close);
    this.el.hidden = false;
    // Animation neu starten
    this.el.style.animation = 'none'; void this.el.offsetWidth; this.el.style.animation = '';
    if (ms) this.timer = setTimeout(() => this.hide(), ms);
  }
  hide() { clearTimeout(this.timer); this.el.hidden = true; }
  get visible() { return !this.el.hidden; }
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
