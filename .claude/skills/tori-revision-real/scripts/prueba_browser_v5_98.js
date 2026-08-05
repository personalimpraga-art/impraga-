/**
 * prueba_browser_v5_98.js — CAJAS editables + guardar al cerrar, en el ENTORNO REAL.
 * Macro real, pedido real por el flujo masivo, tecleo en la celda CAJAS del
 * detalle 🏭 (recalculo visible), beforeunload dispara los guardados pendientes,
 * y cerrar/reabrir conserva la edición.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const HTML_PATH = process.argv[2] || 'TORI_Praga_v5_98.html';
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
  const page = await browser.newPage();
  const erroresJs = [];
  page.on('pageerror', e => erroresJs.push(String(e.message || e)));
  await page.route('**cdnjs.cloudflare.com/**', r => r.abort());
  await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
  await page.goto('http://127.0.0.1:' + srv.address().port + '/tori.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  await page.setInputFiles('#fileMacro', '/home/user/impraga-/muestras/MACRO_INVENTARIO_03082026.xlsx');
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });
  await page.setInputFiles('#fileFacturas', '/home/user/impraga-/muestras/FACTURA_20260715_PRAGA145.xlsx');
  await page.waitForFunction(() => (window.TORI.facturas || []).length > 0, { timeout: 90000 });
  await page.waitForTimeout(2000);

  // pedido con una ref CON empaque (de la factura real: 217-15, 240 und/caja)
  await page.evaluate(async () => {
    const macro = window._pcMacroMap(), china = window._pcChinaDB(), emp = window._pcEmpCtx();
    const doc = { id: 'v598', fileName: 'pedido cajas v5_98', origen: 'MANUAL', fecha: 'hoy', items: {}, nRefs: 0, nUnids: 0, rows: [window._pcBuildRow('217-15', 480, macro, china, emp)] };
    TORI.prodChina = TORI.prodChina || [];
    TORI.prodChina.push(doc);
    window._pcRecalcDoc(doc);
    if (window._pcInvalidate) _pcInvalidate();
    await window.saveProdChina();
  });

  await page.click('.nav-item[data-screen="motor"]');
  await page.click('.motor-tab-btn[data-tab="tabProdChina"]');
  await page.waitForTimeout(600);
  await page.click('#pcTabRoot >> text=pedido cajas v5_98');
  await page.waitForTimeout(800);

  const celda = await page.evaluate(() => {
    const inp = document.querySelector('#pcTabRoot input[onchange*="__pcSetCajas"]');
    if (!inp) return null;
    const r = inp.getBoundingClientRect();
    return { visible: r.width > 0 && r.height > 0, valor: inp.value };
  });
  ok(!!celda && celda.visible, 'la celda CAJAS es un input y se VE (valor actual: ' + (celda && celda.valor) + ')');
  // v5_99: las unidades NO son editables cuando hay und/caja (se calculan solas)
  const unidInput = await page.evaluate(() => !!document.querySelector('#pcTabRoot input[onchange*="__pcSetUnidades"]'));
  ok(!unidInput, 'las UNIDADES no son editables a mano (se calculan: cajas × und/caja)');

  // teclear 5 cajas y confirmar con Enter
  await page.fill('#pcTabRoot input[onchange*="__pcSetCajas"]', '5');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  const fila = await page.evaluate(() => {
    const doc = (TORI.prodChina || []).find(d => d && d.id === 'v598');
    const r = doc.rows[0];
    return { cajas: r.cajas, unidades: r.unidades, cubTotal: r.cubTotal, valor: r.valor, unidCaja: r.unidCaja, precio: r.precio, texto: document.getElementById('pcTabRoot').textContent };
  });
  ok(fila.cajas === 5 && fila.unidades === 5 * fila.unidCaja, '5 cajas → unidades = 5 × ' + fila.unidCaja + ' = ' + fila.unidades + ' (la lógica completa)');
  ok(fila.cubTotal > 0 && Math.abs(fila.cubTotal - 5 * 0.1603) < 0.01, 'm³ total recalculado (' + fila.cubTotal + ' = 5 × 0,16 de la factura)');
  ok(fila.precio > 0 && fila.valor === fila.unidades * fila.precio, 'valor ¥ recalculado (' + fila.valor + ' = ' + fila.unidades + ' × ¥' + fila.precio + ')');
  ok(fila.texto.indexOf(Number(fila.unidades).toLocaleString('es-CO')) >= 0, 'las unidades nuevas se VEN en la tabla');

  // guardar ANTES de cerrar: hay debounce pendiente → beforeunload lo dispara
  const flush = await page.evaluate(async () => {
    // leer el snapshot del navegador ANTES
    const leer = () => new Promise(res => {
      const rq = indexedDB.open('praga_autosave_v1');
      rq.onsuccess = e => { const db = e.target.result; try { const tx = db.transaction('data'); tx.objectStore('data').get('snapshot').onsuccess = ev => res(ev.target.result || null); } catch (x) { res(null); } };
      rq.onerror = () => res(null);
    });
    const doc = (TORI.prodChina || []).find(d => d && d.id === 'v598');
    doc.rows[0].unidades = 9999;   // cambio fresco sin esperar el debounce
    window._pcRecalcDoc(doc);
    await window.saveProdChina();  // bóveda al instante + arma el debounce
    window.dispatchEvent(new Event('beforeunload'));   // como al cerrar TORI
    await new Promise(r => setTimeout(r, 900));
    const snap = await leer();
    const pc = snap && snap.secciones && snap.secciones.prodChina || [];
    const d2 = pc.find(d => d && d.id === 'v598');
    return { enSnapshot: !!d2, unidades: d2 ? (d2.rows && d2.rows[0] ? d2.rows[0].unidades : d2.nUnids) : null };
  });
  ok(flush.enSnapshot && flush.unidades === 9999, 'al "cerrar", el guardado pendiente se disparó YA — el snapshot trae el cambio fresco (' + flush.unidades + ' unds)');

  // cerrar y reabrir de verdad: la edición persiste
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const tras = await page.evaluate(() => {
    const doc = (TORI.prodChina || []).find(d => d && d.id === 'v598');
    return doc ? doc.rows[0].unidades : null;
  });
  ok(tras === 9999, 'cerrar/reabrir: la edición sigue en la bóveda (' + tras + ' unds)');

  const diag = await page.evaluate(() => ({ errores: TORI.diagErrors || 0, log: (TORI.diagLog || []).filter(e => e.t !== 'manual').map(e => e.msg).slice(0, 3) }));
  ok(diag.errores === 0, 'panel de diagnóstico de TORI en 0' + (diag.errores ? ' — ' + JSON.stringify(diag.log) : ''));
  ok(erroresJs.length === 0, 'cero errores de página en Chromium' + (erroresJs.length ? ' — ' + erroresJs[0] : ''));

  await browser.close();
  srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos) + ' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ CAJAS EDITABLES + GUARDAR AL CERRAR EN NAVEGADOR REAL: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
