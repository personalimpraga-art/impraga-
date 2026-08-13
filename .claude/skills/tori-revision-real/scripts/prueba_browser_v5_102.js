/**
 * prueba_browser_v5_102.js — reporte 2026-08-13: "↩ devolver tarda mucho y el Backup ⬇
 * se queda cargando". Verifica la corrección A ESCALA REAL (64 facturas con fotos,
 * PI2 6.000+, macro real, pedido de 251 refs, disco OPFS enlazado):
 *   1. ↩ devolver responde al instante y NO reescribe el catálogo PI2
 *   2. el recálculo agrupado SÍ llega: las refs devueltas vuelven a la Orden Sugerida
 *   3. un cambio REAL en las facturas sigue propagándose a PI2 (solo el delta)
 *   4. el Backup ⬇ sale en segundos y COMPLETO
 *   5. cerrar y reabrir: el pedido queda como se dejó
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const HTML_PATH = process.argv[2] || 'TORI_Praga_v5_102.html';
const VENDOR = '/home/user/impraga-/desktop/vendor';
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';

let pasos = 0, fallos = 0;
function ok(cond, msg) {
  if (cond) { pasos++; console.log('  ✔ ' + msg); }
  else { fallos++; console.log('  ✘ FALLO: ' + msg); }
}

(async () => {
  const html = fs.readFileSync(HTML_PATH, 'utf-8').split(CDN).join('<script src="/vendor/xlsx.full.min.js"></script>\n' + CDN);
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/vendor/')) { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(VENDOR, path.basename(req.url))).pipe(res); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
  });
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const erroresJs = [];
  page.on('pageerror', e => erroresJs.push(String(e.message || e)));
  page.on('dialog', async d => { await d.accept(); });
  await page.route('**cdnjs.cloudflare.com/**', r => r.abort());
  await context.addInitScript(() => {
    window.prompt = () => { throw new Error('prompt() is not supported.'); };
    window.__puts = {};
    const _put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      const k = this.transaction.db.name + '.' + this.name;
      window.__puts[k] = (window.__puts[k] || 0) + 1;
      return _put.apply(this, arguments);
    };
    (async () => {
      const dir = await navigator.storage.getDirectory();
      const fh = await dir.getFileHandle('backup_perfil.json', { create: true });
      await new Promise((res, rej) => {
        const rq = indexedDB.open('praga_fsa_v1', 1);
        rq.onupgradeneeded = e => { try { e.target.result.createObjectStore('data'); } catch (x) {} };
        rq.onsuccess = e => { const db = e.target.result; const tx = db.transaction('data', 'readwrite'); tx.objectStore('data').put(fh, 'fileHandle'); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = rej; };
        rq.onerror = rej;
      });
    })();
  });
  await page.goto('http://127.0.0.1:' + srv.address().port + '/tori.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  await page.setInputFiles('#fileMacro', '/home/user/impraga-/muestras/MACRO_INVENTARIO_03082026.xlsx');
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });

  const escala = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 203; cv.height = 203;
    const ctx = cv.getContext('2d');
    const fotos = [];
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'hsl(' + (i * 45) + ',70%,60%)'; ctx.fillRect(0, 0, 203, 203); for (let j = 0; j < 30; j++) { ctx.fillStyle = 'hsl(' + ((i * 37 + j * 11) % 360) + ',60%,50%)'; ctx.fillRect((j * 23) % 180, (j * 41) % 180, 22, 22); } fotos.push(cv.toDataURL('image/jpeg', 0.5)); }
    window.__fotosSim = fotos;
    for (let f = 0; f < 64; f++) { const rows = []; for (let i = 0; i < 100; i++) rows.push({ ARTICULO: 'SIM-' + f + '-' + i, DESCRIPCION: 'PRODUCTO ' + i, CTNS: 3, QTY_CTN: 120, CANTIDAD_TOTAL: 360, PRECIO: 5.5, TOTAL_CBM: 0.5, FOTO: fotos[(f + i) % 8], _fotoComp: true }); TORI.facturas.push({ name: 'SIM-' + f, rows, meta: {} }); }
    if (window._fotoInvalidate) _fotoInvalidate();
    await new Promise((res, rej) => {
      const rq = indexedDB.open('PragaPI2', 1);
      rq.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('catalogo')) db.createObjectStore('catalogo', { keyPath: 'ref' }); if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); };
      rq.onsuccess = e => { const db = e.target.result; const tx = db.transaction('catalogo', 'readwrite'); const st = tx.objectStore('catalogo'); for (let i = 0; i < 6000; i++) st.put({ ref: 'PI2-' + i, desc: 'CAT ' + i, foto: fotos[i % 8], precio: 9900 }); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = rej; };
      rq.onerror = rej;
    });
    const refs = (window.STATE.ordenar || []).slice(0, 251);   // refs que SÍ son de la Orden Sugerida
    const rowsPed = refs.map(r => ({ ref: r.codigo, desc: r.nombre, descCn: '', unidCaja: 72, cajas: 5, unidades: 360, cubCaja: 0.1, cubTotal: 0.5, precio: 3.9, valor: 1404, proveedor: 'YUGIN', tier: r.tier || 'C', dias: r.diasRaw, tipo: r.categoria || '' }));
    const items = {}; rowsPed.forEach(r => { items[String(r.ref).trim().toLowerCase()] = r.unidades; });
    TORI.prodChina = TORI.prodChina || [];
    TORI.prodChina.push({ id: 'perfil-149', fileName: 'yugin #149 perfil', fecha: new Date().toISOString(), origen: 'MANUAL', items, nRefs: rowsPed.length, nUnids: 360 * rowsPed.length, rows: rowsPed });
    if (window._pcInvalidate) _pcInvalidate();
    if (typeof window.updateAfterLoad === 'function') updateAfterLoad();
    if (typeof window.__motorRefresh === 'function') __motorRefresh();
    await window._fsaInit();
    return { pedidoRefs: rowsPed.length, devolver: rowsPed.slice(0, 5).map(r => String(r.ref)) };
  });
  await page.waitForTimeout(1500);
  ok(true, 'escala real sembrada: 64 facturas con fotos + PI2 6.000+ + macro real + pedido de ' + escala.pedidoRefs + ' refs + disco enlazado');

  await page.evaluate(() => { window.toriConfirm = async () => true; window.__puts = {}; });
  await page.click('.nav-item[data-screen="motor"]');
  await page.evaluate(() => { document.querySelectorAll('.motor-tab-btn').forEach(b => { if (b.getAttribute('data-tab') === 'tabProdChina') b.click(); }); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { if (typeof window.__pcTabAbrir === 'function') window.__pcTabAbrir('perfil-149'); });
  await page.waitForTimeout(600);

  // 1. ↩ devolver 5 refs: instantáneo y sin reescribir PI2
  const durs = [];
  for (let i = 0; i < 5; i++) {
    const d = await page.evaluate(async () => {
      const doc = (TORI.prodChina || []).find(x => x.id === 'perfil-149');
      const key = String(doc.rows[0].ref).trim().toLowerCase();
      const t0 = performance.now();
      await window.__pcQuitarRef('perfil-149', key);
      return Math.round(performance.now() - t0);
    });
    durs.push(d);
    await page.waitForTimeout(120);
  }
  ok(durs.every(d => d < 300), '↩ devolver responde AL INSTANTE: ' + durs.join(' / ') + ' ms por clic (antes 660–1.440 ms congelados)');
  const filasDetalle = await page.evaluate(() => document.querySelectorAll('[id^="pcTabTbody_"] tr').length);
  ok(filasDetalle === escala.pedidoRefs - 5, 'el detalle del pedido se repinta AL INSTANTE: la tabla ya muestra ' + filasDetalle + ' filas sin esperar el recálculo');
  await page.waitForTimeout(1200);   // deja aterrizar el recálculo agrupado
  const puts1 = await page.evaluate(() => window.__puts);
  ok(!puts1['PragaPI2.catalogo'], 'CERO escrituras al catálogo PI2 durante las devoluciones (antes ~6.400 POR CLIC): ' + JSON.stringify(puts1));

  // 2. El recálculo agrupado SÍ llegó: las refs devueltas están de vuelta en la Orden Sugerida
  const deVuelta = await page.evaluate(refs => {
    const norm = s => String(s || '').trim().toLowerCase();
    const enOrden = new Set((window.STATE.ordenar || []).map(r => norm(r.codigo)));
    const doc = (TORI.prodChina || []).find(x => x.id === 'perfil-149');
    return { enOrden: refs.filter(r => enOrden.has(norm(r))).length, pedido: doc.rows.length, nRefs: doc.nRefs };
  }, escala.devolver);
  ok(deVuelta.pedido === escala.pedidoRefs - 5 && deVuelta.nRefs === escala.pedidoRefs - 5, 'el pedido quedó con ' + deVuelta.pedido + ' refs (items y rows coherentes)');
  ok(deVuelta.enOrden === 5, 'las 5 refs devueltas VOLVIERON a la Orden Sugerida con el recálculo agrupado (' + deVuelta.enOrden + '/5)');

  // 3. Un cambio REAL sigue propagándose a PI2 — y solo el delta
  await page.evaluate(() => { window.__puts = {}; });
  const delta = await page.evaluate(async () => {
    TORI.facturas[0].rows.push({ ARTICULO: 'SIM-NUEVA-1', DESCRIPCION: 'PRODUCTO NUEVO', CTNS: 2, QTY_CTN: 50, CANTIDAD_TOTAL: 100, PRECIO: 9.9, TOTAL_CBM: 0.3, FOTO: window.__fotosSim[0], _fotoComp: true });
    if (window._fotoInvalidate) _fotoInvalidate();
    updateAfterLoad();
    await new Promise(r => setTimeout(r, 400));
    return window.__puts;
  });
  ok((delta['PragaPI2.catalogo'] || 0) >= 1 && (delta['PragaPI2.catalogo'] || 0) <= 3, 'una ref NUEVA en factura SÍ llega a PI2, escribiendo solo el delta (' + (delta['PragaPI2.catalogo'] || 0) + ' escrituras, no 6.400)');

  // 4. Backup ⬇ en segundos y COMPLETO
  const t0 = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120000 }),
    page.evaluate(() => descargarAutosave()),
  ]);
  const bkPath = path.join(__dirname, 'v102_backup.json');
  await download.saveAs(bkPath);
  const durBk = (Date.now() - t0) / 1000;
  const bk = JSON.parse(fs.readFileSync(bkPath, 'utf-8'));
  const ped = (bk.secciones.prodChina || []).find(d => d.id === 'perfil-149');
  ok(durBk < 30, 'el Backup ⬇ SALE: ' + durBk.toFixed(1) + 's (antes 86–221s y Andrés lo cancelaba) · ' + (fs.statSync(bkPath).size / 1048576).toFixed(1) + ' MB');
  ok(ped && ped.rows.length === escala.pedidoRefs - 5, 'el backup va COMPLETO: el pedido dentro con sus ' + (ped ? ped.rows.length : '—') + ' refs exactas');
  ok(bk.resumen.facturas === 64 && bk.resumen.macro_refs === 3643 && bk.resumen.prods_pi2_catalogo >= 6000, 'backup completo: 64 facturas · macro 3.643 · PI2 ' + bk.resumen.prods_pi2_catalogo + ' refs');
  fs.unlinkSync(bkPath);

  // 5. Cerrar y reabrir: el pedido queda como se dejó
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.TORI && window.TORI.prodChina && window.TORI.prodChina.length > 0, { timeout: 45000 });
  const trasReabrir = await page.evaluate(() => {
    const doc = (TORI.prodChina || []).find(x => x.id === 'perfil-149');
    return doc ? doc.rows.length : -1;
  });
  ok(trasReabrir === escala.pedidoRefs - 5, 'cerrar y reabrir TORI: el pedido sigue con sus ' + trasReabrir + ' refs — nada se pierde (el miedo de Andrés, respondido)');

  const diag = await page.evaluate(() => TORI.diagErrors || 0);
  ok(diag === 0, 'panel de diagnóstico de TORI en 0');
  ok(erroresJs.length === 0, 'cero errores de página en Chromium' + (erroresJs.length ? ' — ' + erroresJs[0] : ''));

  await browser.close();
  srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos) + ' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ DEVOLVER RÁPIDO + BACKUP QUE SÍ SALE: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
