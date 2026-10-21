// Lokale Speicherung: Einstellungen, laufende Partien, Statistik.

const PREFIX = 'spiele:';

export function load(key, fallback = null) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* voll oder gesperrt */ }
}

export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* egal */ }
}

const DEFAULTS = { coach: true, speed: 'normal' };

export function settings() {
  return { ...DEFAULTS, ...load('settings', {}) };
}
export function setSetting(k, v) {
  const s = settings(); s[k] = v; save('settings', s);
}

export function gameSettings(game, defaults = {}) {
  return { level: 'mittel', ...defaults, ...load('opt:' + game, {}) };
}
export function setGameSetting(game, k, v) {
  const s = load('opt:' + game, {}); s[k] = v; save('opt:' + game, s);
}

export function stats(game) { return load('stats:' + game, { played: 0, won: 0 }); }
export function addResult(game, won) {
  const s = stats(game); s.played++; if (won) s.won++; save('stats:' + game, s);
}

export function delay(base) {
  const sp = settings().speed;
  return sp === 'schnell' ? base * 0.45 : sp === 'langsam' ? base * 1.6 : base;
}
