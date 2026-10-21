// Minimaler Testläufer ohne Abhängigkeiten.
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['chess', 'backgammon', 'skat', 'doppelkopf', 'canasta'];
let fail = 0, pass = 0;
for (const f of files) {
  let mod;
  try { mod = await import(`./${f}.test.js`); } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') continue; throw e; }
  const t = (name, fn) => {
    const t0 = Date.now();
    try { fn(); pass++; console.log(`  ok   ${f}: ${name} (${Date.now() - t0} ms)`); }
    catch (e) { fail++; console.log(`  FAIL ${f}: ${name}\n       ${e.stack.split('\n').slice(0, 4).join('\n       ')}`); }
  };
  t.eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} erwartet ${JSON.stringify(b)}, bekommen ${JSON.stringify(a)}`); };
  t.ok = (v, msg) => { if (!v) throw new Error(msg || 'nicht erfüllt'); };
  await mod.default(t);
}
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
