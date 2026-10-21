// Kleine, DOM-freie Helfer (auch in Node-Tests nutzbar).

export function shuffle(a, rnd = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Reproduzierbarer Zufall für Tests: mulberry32
export function seeded(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const clone = o => JSON.parse(JSON.stringify(o));
export const sum = (arr, f = x => x) => arr.reduce((a, x) => a + f(x), 0);
export const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];
export const count = (arr, f) => arr.reduce((a, x) => a + (f(x) ? 1 : 0), 0);
