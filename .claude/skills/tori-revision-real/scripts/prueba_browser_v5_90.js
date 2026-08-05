/**
 * prueba_browser_v5_90.js — caso yugin 147 en el ENTORNO REAL.
 * Chromium servido como el .exe (vendor xlsx + exceljs, CDN bloqueado, prompt roto),
 * macro y factura REALES de muestras/, un pedido guardado con CEROS (como el de
 * Andrés), y verificación de: vista 🏭 sanada + 📗 Excel generado y RELEÍDO.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const EJS = require('./lib/node_modules/exceljs');

const HTML_PATH = process.argv[2] || 'TORI_Praga_v5_90.html';
const VENDOR = '/home/user/impraga-/desktop/vendor';
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';

let pasos = 0, fallos = 0;
function ok(cond, msg) {
  if (cond) { pasos++; console.log('  ✔ ' + msg); }
  else { fallos++; console.log('  ✘ FALLO: ' + msg); }
}

(async () => {
  // vendor ANTES del CDN, y exceljs precargado igual que la cáscara del .exe
  const html = fs.readFileSync(HTML_PATH, 'utf-8')
    .split(CDN).join('<script src="/vendor/xlsx.full.min.js"></script>\n<script src="/vendor/exceljs.min.js"></script>\n' + CDN);
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/vendor/')) {
      res.setHeader('Content-Type', 'application/javascript');
      fs.createReadStream(path.join(VENDOR, path.basename(req.url))).pipe(res);
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  });
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  const erroresJs = [];
  page.on('pageerror', e => erroresJs.push(String(e.message || e)));
  page.on('dialog', async d => { await d.accept(); });
  await page.route('**cdnjs.cloudflare.com/**', r => r.abort());
  await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
  await page.goto('http://127.0.0.1:' + srv.address().port + '/tori.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });

  await page.setInputFiles('#fileMacro', '/home/user/impraga-/muestras/MACRO_INVENTARIO_03082026.xlsx');
  await page.waitForFunction(() => window.TORI.classified && window.TORI.classified.length > 0, { timeout: 45000 });
  await page.setInputFiles('#fileFacturas', '/home/user/impraga-/muestras/FACTURA_20260715_PRAGA145.xlsx');
  await page.waitForFunction(() => (window.TORI.facturas || []).length > 0, { timeout: 90000 });
  await page.waitForTimeout(2500);
  ok(true, 'TORI arrancó como el .exe con macro y factura REALES de muestras/');

  // ── Pedido guardado con CEROS (la situación exacta del pedido yugin 147) ──
  const antes = await page.evaluate(async () => {
    const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const refs = ['217-11', '217-15', '218-33'];
    const rows = refs.map(ref => {
      // unid/caja llena, cubicajes EN 0, sin precio, sin tipo — como salió su Excel
      let uc = null;
      for (const f of TORI.facturas) for (const r of (f.rows || [])) if (norm(r.ARTICULO) === norm(ref)) uc = parseFloat(r.QTY_CTN) || 0;
      return { ref, desc: 'PRUEBA ' + ref, descCn: '测试', unidCaja: uc || 100, cajas: 2, unidades: (uc || 100) * 2, cubCaja: 0, cubTotal: 0, precio: '', valor: 0, proveedor: '', tier: '', dias: '', tipo: '', contOrigen: '', isNew: false };
    });
    const doc = { id: 'caso147', fileName: 'pedido caso 147', origen: 'MANUAL', fecha: 'hoy', items: {}, nRefs: 0, nUnids: 0, rows };
    TORI.prodChina = TORI.prodChina || [];
    TORI.prodChina.push(doc);
    window._pcRecalcDoc ? _pcRecalcDoc(doc) : null;
    if (window._pcInvalidate) _pcInvalidate();
    await window.saveProdChina();
    return { nRefs: doc.nRefs, cub0: doc.rows.every(r => r.cubCaja === 0) };
  });
  ok(antes.nRefs === 3 && antes.cub0, 'pedido sembrado como el de Andrés: 3 refs con cubicaje EN 0 y sin precio');

  // ── La VISTA de la pestaña 🏭 muestra los datos sanados ──
  await page.click('.nav-item[data-screen="motor"]');
  await page.click('.motor-tab-btn[data-tab="tabProdChina"]');
  await page.waitForTimeout(600);
  await page.click('#pcTabRoot >> text=pedido caso 147');
  await page.waitForTimeout(800);
  const vista = await page.evaluate(() => {
    const cont = document.getElementById('pcTabRoot');
    const filas = Array.from(cont.querySelectorAll('tbody tr'));
    const celdas = filas.map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
    return { texto: cont.textContent, celdas: celdas.slice(0, 5) };
  });
  const texto217 = (vista.celdas.find(c => c.join('|').indexOf('217-15') >= 0) || []).join(' | ');
  ok(/0[.,]32|0[.,]16/.test(texto217), 'la fila 217-15 MUESTRA el cubicaje de la factura (0,32 m³ = 2 cajas × 0,16) en vez de 0 — [' + texto217.slice(0, 130) + ']');
  ok(vista.texto.indexOf('m³') > 0, 'los totales del pedido suman m³ (ya no 0)');

  // ── 📗 Excel real: generar, capturar la descarga y RELEER ──
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click('button:has-text("Excel FOTOS")'),
  ]);
  const xlsxPath = path.join(__dirname, 'excel_caso147.xlsx');
  await download.saveAs(xlsxPath);
  ok(fs.existsSync(xlsxPath) && fs.statSync(xlsxPath).size > 5000, 'el 📗 Excel se generó y descargó (' + Math.round(fs.statSync(xlsxPath).size / 1024) + 'KB)');

  const wb = new EJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.worksheets[0];
  const filas = {};
  for (let r = 3; r <= ws.rowCount; r++) {
    const g = c => { const v = ws.getRow(r).getCell(c).value; return v == null ? '' : v; };
    const ref = String(g(2)).trim();
    if (ref) filas[ref] = { uc: g(5), cajas: g(6), unds: g(7), cubC: g(8), cubT: g(9), precio: g(10), valor: g(11), cont: g(13) };
  }
  const f15 = filas['217-15'], f33 = filas['218-33'], f11 = filas['217-11'];
  ok(!!f15 && f15.cubC > 0 && f15.cubT > 0, 'Excel releído: 217-15 con cubicaje REAL (' + (f15 && f15.cubC) + ' m³/caja, total ' + (f15 && f15.cubT) + ') — antes salía 0');
  ok(!!f33 && f33.cubC > 0, 'Excel releído: 218-33 con cubicaje real (' + (f33 && f33.cubC) + ')');
  ok(!!f15 && f15.precio > 0 && f15.valor > 0, 'Excel releído: precio ¥ desde la FACTURA del Liquidador (' + (f15 && f15.precio) + ') y valor calculado');
  ok(!!f11 && String(f11.cont).trim() !== '' && String(f11.cont) !== 'pedido caso 147', 'Excel releído: contenedor de origen resuelto — macro primero, regla v5_88 (' + (f11 && f11.cont) + ')');
  ok(ws.getImages().length >= 3, 'Excel releído: fotos incrustadas (' + ws.getImages().length + ')');

  // ── Diagnóstico en CERO ──
  const diag = await page.evaluate(() => ({ errores: TORI.diagErrors || 0, log: (TORI.diagLog || []).filter(e => e.t !== 'manual').map(e => e.msg).slice(0, 3) }));
  ok(diag.errores === 0, 'panel de diagnóstico de TORI en 0' + (diag.errores ? ' — ' + JSON.stringify(diag.log) : ''));
  ok(erroresJs.length === 0, 'cero errores de página en Chromium' + (erroresJs.length ? ' — ' + erroresJs[0] : ''));

  await browser.close();
  srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos) + ' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ CASO 147 EN NAVEGADOR REAL: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
