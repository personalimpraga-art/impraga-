/* KILL-TEST: reproduce el incidente — cerrar TORI a mitad del guardado de facturas.
   Uso: node kill_test.js <archivo.html>
   1) Siembra 40 facturas con fotos y guarda COMPLETO (baseline confirmada)
   2) Dispara OTRO guardado y mata la página a los 300ms (como cerrar la app)
   3) Reabre y cuenta qué sobrevivió                                          */
const { chromium } = require('playwright-core');
const file = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext(); // mismo contexto = misma IndexedDB entre páginas
  const url = 'http://127.0.0.1:8901/' + file;

  // ── 1. Sembrar y guardar completo ──
  let p = await ctx.newPage(); p.on('pageerror', () => {});
  await p.route('**cdnjs.cloudflare.com/**', r => r.abort());
  await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
  const seed = await p.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 420; cv.height = 420;
    const x = cv.getContext('2d');
    for (let i = 0; i < 30; i++) { x.fillStyle = `hsl(${i*12},60%,45%)`; x.fillRect((i*31)%390,(i*47)%390,60,60); }
    const foto = cv.toDataURL('image/jpeg', 0.8);
    TORI.facturas = [];
    for (let f = 0; f < 40; f++) {
      const rows = [];
      for (let r = 0; r < 40; r++) rows.push({ REF: `F${f}-${r}`, DESCRIPCION: 'PRUEBA', FOTO: foto });
      TORI.facturas.push({ name: 'FACTURA_' + f, loaded: '2026-08-01', params: {}, meta: { n: f }, rows });
    }
    await saveFacturasToStorage();  // guardado COMPLETO, esperado
    const facs = await _toriIDBGetAll('facturas');
    const fotos = await _toriIDBGetAll('fotos');
    return { facturas: facs.length, fotos: fotos.length };
  });
  console.log('BASELINE guardada →', JSON.stringify(seed));
  await p.close();

  // ── 2. Reabrir, disparar guardado y MATAR a los 300ms ──
  p = await ctx.newPage(); p.on('pageerror', () => {});
  await p.route('**cdnjs.cloudflare.com/**', r => r.abort());
  await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  await p.evaluate(() => {
    // como en el incidente: las facturas están en memoria y se re-guardan
    // (subir factura / restaurar dispara saveFacturasToStorage)
    if (!TORI.facturas.length) return loadFromStorage().then(() => { saveFacturasToStorage(); });
    saveFacturasToStorage();
  });
  await p.waitForTimeout(300);           // el guardado va a MITAD (fotos pesadas)
  await p.close({ runBeforeUnload: false }); // ← el cierre fatal

  // ── 3. Reabrir y contar ──
  p = await ctx.newPage(); p.on('pageerror', () => {});
  await p.route('**cdnjs.cloudflare.com/**', r => r.abort());
  await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
  const after = await p.evaluate(async () => {
    const facs = await _toriIDBGetAll('facturas');
    const fotos = await _toriIDBGetAll('fotos');
    return { facturas: facs.length, fotos: fotos.length };
  });
  console.log('TRAS EL CIERRE FATAL →', JSON.stringify(after));
  console.log(after.facturas === seed.facturas
    ? '★ SOBREVIVIÓ: las facturas quedaron intactas'
    : `✗ PÉRDIDA DE DATOS: quedaron ${after.facturas}/${seed.facturas} facturas y ${after.fotos}/${seed.fotos} fotos`);
  await b.close();
})();
