'use strict';
/* v5_96 en el ENTORNO REAL: mandar refs a Producción China ya NO las saca de la
   lista "Datos para China" — el faltante se mantiene para pedirlo al proveedor,
   y las listas YUGIN/YUFUN lo heredan. Excel descargado y RELEÍDO. */
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const EJS = require('./lib/node_modules/exceljs');
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';
let pasos = 0, fallos = 0;
function ok(cond, msg) { if (cond) { pasos++; console.log('  ✔ ' + msg); } else { fallos++; console.log('  ✘ FALLO: ' + msg); } }
(async () => {
  const html = fs.readFileSync(process.argv[2] || 'TORI_Praga_v5_96.html', 'utf-8').split(CDN).join('<script src="/vendor/xlsx.full.min.js"></script>\n' + CDN);
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/vendor/')) { res.setHeader('Content-Type','application/javascript'); fs.createReadStream(path.join('/home/user/impraga-/desktop/vendor', path.basename(req.url))).pipe(res); return; }
    res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html);
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
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });
  await page.click('.nav-item[data-screen="motor"]');
  await page.waitForTimeout(500);

  const antes = await page.evaluate(() => ({ china: (window.STATE.chinaFaltan||[]).length, orden: window.STATE.ordenar.length }));
  ok(antes.china > 0, 'antes: ' + antes.china + ' faltantes de datos China · ' + antes.orden + ' en la orden');

  // mandar 105 refs (filtro "correa" + Solo marroquinería) a un pedido con el flujo masivo real
  await page.click('.motor-tab-btn[data-tab="tabOrden"]');
  await page.click('#marroFilterRow .pill[data-val="SOLO"]');
  await page.click('#searchInput');
  await page.keyboard.type('correa', { delay: 25 });
  await page.waitForTimeout(600);
  const nEnviar = await page.evaluate(() => parseInt((document.getElementById('ordenCount').textContent.match(/Mostrando ([\d.]+)/) || [])[1].replace(/\./g, ''), 10));
  await page.click('#pcMandarFiltradoBtn');
  await page.waitForTimeout(400);
  await page.click('#pcElegirOverlay button:has-text("Crear pedido nuevo")');
  await page.waitForSelector('#toriPromptInp', { timeout: 5000 });
  await page.fill('#toriPromptInp', 'pedido v5_96');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#toriConfirmOverlay', { timeout: 5000 });
  await page.click('#toriConfirmOkBtn');
  await page.waitForTimeout(1500);

  const despues = await page.evaluate(() => ({
    china: (window.STATE.chinaFaltan||[]).length,
    orden: window.STATE.ordenar.length,
    fabEnLista: (window.STATE.chinaFaltan||[]).filter(r => r.status === 'PROD_CHINA').length,
  }));
  ok(despues.orden === antes.orden - nEnviar, 'las ' + nEnviar + ' refs salieron de la Orden Sugerida (' + antes.orden + ' → ' + despues.orden + ')');
  ok(despues.china === antes.china, 'pero la lista Datos para China NO baja (' + antes.china + ' → ' + despues.china + ') — lo fabricándose sigue pendiente de pedir');
  ok(despues.fabEnLista === nEnviar, 'las ' + despues.fabEnLista + ' refs FABRICÁNDOSE están dentro de la lista de faltantes');

  // el Excel de la tarjeta las incluye (releído)
  await page.click('.motor-tab-btn[data-tab="tabFaltantes"]');
  await page.waitForTimeout(600);
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('[data-action="china-download"]')]);
  const p = path.join(__dirname, 'china_v5_96.xlsx');
  await d.saveAs(p);
  const wb = new EJS.Workbook();
  await wb.xlsx.readFile(p);
  const ws = wb.worksheets[0];
  let n = 0;
  for (let r = 3; r <= ws.rowCount; r++) { const v = ws.getRow(r).getCell(1).value; if (v != null && String(v).trim() !== '') n++; }
  ok(n === despues.china, 'Excel releído: trae las ' + n + ' refs (orden + fabricándose)');

  const diag = await page.evaluate(() => ({ errores: TORI.diagErrors || 0 }));
  ok(diag.errores === 0, 'panel de diagnóstico de TORI en 0');
  ok(erroresJs.length === 0, 'cero errores de página en Chromium');
  await browser.close(); srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS — NO SE ENTREGA'); process.exit(1); }
  console.log('★ FALTANTES CON FABRICÁNDOSE EN NAVEGADOR REAL: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
