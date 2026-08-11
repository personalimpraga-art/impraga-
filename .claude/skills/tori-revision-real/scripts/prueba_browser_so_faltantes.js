/**
 * prueba_browser_so_faltantes.js — ¿las refs con 🔄 segunda oportunidad entran a FALTANTES?
 * Reproducción del reporte de Andrés (2026-08-11) en el entorno real: Chromium como
 * el .exe, macro REAL, clic de verdad en "🔄 Otra oportunidad" desde Rotación > límite,
 * y verificación de: hub de Faltantes (contador Datos para China + badge de la pestaña),
 * STATE.chinaFaltan, lista YUGIN/YUFUN, y el Excel "Datos para China" descargado y RELEÍDO.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const EJS = require('./lib/node_modules/exceljs');

const HTML_PATH = process.argv[2] || 'TORI_Praga_v5_100.html';
const VENDOR = '/home/user/impraga-/desktop/vendor';
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';

let pasos = 0, fallos = 0;
function ok(cond, msg) {
  if (cond) { pasos++; console.log('  ✔ ' + msg); }
  else { fallos++; console.log('  ✘ FALLO: ' + msg); }
}

(async () => {
  const html = fs.readFileSync(HTML_PATH, 'utf-8')
    .split(CDN).join('<script src="/vendor/xlsx.full.min.js"></script>\n' + CDN);
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
  await page.addInitScript(() => {
    window.prompt = () => { throw new Error('prompt() is not supported.'); };
  });
  await page.goto('http://127.0.0.1:' + srv.address().port + '/tori.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  await page.setInputFiles('#fileMacro', '/home/user/impraga-/muestras/MACRO_INVENTARIO_03082026.xlsx');
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });
  await page.click('.nav-item[data-screen="motor"]');
  await page.waitForTimeout(500);

  // Estado ANTES: elegir una ref de Rotación > límite SIN datos China completos
  const antes = await page.evaluate(() => {
    const lentas = window.STATE.classified.filter(r => r.status === 'ROTACION_LENTA');
    const cand = lentas.find(r => {
      const db = JSON.parse(localStorage.getItem('praga_china_db_v1') || '{}');
      const e = db[String(r.codigo).trim().toLowerCase()];
      return !(e && e.descripcionChina && e.precioRMB != null && e.proveedor);
    });
    return {
      cod: cand ? cand.codigo : null,
      esPG: cand ? /^pg/i.test(String(cand.codigo).trim()) : null,
      nLentas: lentas.length,
      nChinaFaltan: (window.STATE.chinaFaltan || []).length,
      yaEsta: cand ? (window.STATE.chinaFaltan || []).some(r => r.codigo === cand.codigo) : null,
      badge: document.getElementById('faltHubBadge').textContent,
    };
  });
  ok(!!antes.cod, 'candidata elegida: ' + antes.cod + ' (Rotación > límite, sin datos China; ' + antes.nLentas + ' lentas en total)');
  ok(antes.yaEsta === false, 'ANTES del 🔄 la ref NO está en Datos para China (correcto: no se va a pedir)');

  // Clic REAL en "🔄 Otra oportunidad" desde la vista Rotación > límite
  await page.click('.motor-tab-btn[data-tab="tabOrden"]');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll('#statusPills [data-view]')).find(x => x.getAttribute('data-view') === 'ROTACION_LENTA');
    p.click();
  });
  await page.waitForTimeout(500);
  await page.fill('#searchInput', antes.cod);
  await page.waitForTimeout(600);
  const btnVisible = await page.evaluate(() => {
    const b = document.querySelector('#ordenTableBody button[onclick*="__soDar"]');
    if (!b) return false;
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  ok(btnVisible, 'el botón "🔄 Otra oportunidad" se VE en la fila');
  await page.click('#ordenTableBody button[onclick*="__soDar"]');
  await page.waitForTimeout(400);
  // toriConfirm es ventana propia de TORI: clic REAL en Aceptar
  const confirmBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && /aceptar/i.test(b.textContent);
    });
    return btns.length;
  });
  ok(confirmBtn > 0, 'toriConfirm (ventana propia, no confirm() nativo) apareció con su botón Aceptar');
  await page.click('button:visible:has-text("Aceptar")');
  await page.waitForTimeout(800);

  // DESPUÉS: la ref está en la orden Y en Faltantes
  const despues = await page.evaluate(cod => {
    const norm = s => String(s || '').trim().toLowerCase();
    const enOrden = (window.STATE.ordenar || []).some(r => norm(r.codigo) === norm(cod));
    const enFaltan = (window.STATE.chinaFaltan || []).some(r => norm(r.codigo) === norm(cod));
    const soMark = (window.STATE.ordenar || []).find(r => norm(r.codigo) === norm(cod));
    return {
      enOrden, enFaltan,
      tieneSO: !!(soMark && soMark.segundaOport),
      nChinaFaltan: (window.STATE.chinaFaltan || []).length,
      badge: document.getElementById('faltHubBadge').textContent,
      enCub: (window.STATE.sinDatos || []).some(r => norm(r.codigo) === norm(cod)),
      enCosto: (window.STATE.costFaltan || []).some(r => norm(r.codigo) === norm(cod)),
    };
  }, antes.cod);
  ok(despues.enOrden && despues.tieneSO, 'tras el 🔄 la ref está en la Orden Sugerida con su marca 🔄');
  ok(despues.enFaltan, 'la ref ENTRÓ a Datos para China (STATE.chinaFaltan) — la información se va a pedir');
  ok(despues.nChinaFaltan === antes.nChinaFaltan + 1, 'el conteo de Datos para China subió en 1 (' + antes.nChinaFaltan + ' → ' + despues.nChinaFaltan + ')');
  ok(Number(despues.badge.replace(/\./g, '')) > Number(antes.badge.replace(/\./g, '')), 'el badge rojo de la pestaña Faltantes subió (' + antes.badge + ' → ' + despues.badge + ')');
  console.log('    (cubicaje faltante: ' + despues.enCub + ' · costo faltante: ' + despues.enCosto + ' — según lo que le falte a la ref)');

  // El hub de Faltantes MUESTRA el número nuevo en la tarjeta Datos para China
  await page.evaluate(() => { document.querySelector('.motor-tab-btn[data-tab="tabFaltantes"]').click(); });
  await page.waitForTimeout(500);
  const cardTxt = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#faltHubBody .card'));
    const c = cards.find(x => /Datos para China/.test(x.textContent));
    return c ? c.textContent : '';
  });
  ok(new RegExp(despues.nChinaFaltan.toString()).test(cardTxt.replace(/\./g, '')), 'la tarjeta Datos para China del hub muestra el conteo nuevo (' + despues.nChinaFaltan + ')');

  // Descargar la lista "Datos para China" del hub y RELEERLA: la ref 🔄 va adentro
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.evaluate(() => { document.querySelector('#faltHubBody [data-action="china-download"]').click(); }),
  ]);
  const xlsxPath = path.join(__dirname, 'faltantes_so.xlsx');
  await download.saveAs(xlsxPath);
  const wb = new EJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.worksheets[0];
  let encontrada = false, filas = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).getCell(1).value;
    if (v != null && String(v).trim() !== '') filas++;
    if (String(v).trim().toLowerCase() === String(antes.cod).trim().toLowerCase()) encontrada = true;
  }
  ok(encontrada, 'Excel "Datos para China" RELEÍDO: la ref ' + antes.cod + ' va adentro (' + filas + ' filas)');

  // La lista del proveedor que corresponde (YUGIN sin PG / YUFUN solo PG) también la lleva
  const accionProv = antes.esPG ? 'china-download-yufun' : 'china-download-yugin';
  const [d2] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.evaluate(a => { document.querySelector('#faltHubBody [data-action="' + a + '"]').click(); }, accionProv),
  ]);
  const xlsx2 = path.join(__dirname, 'faltantes_so_prov.xlsx');
  await d2.saveAs(xlsx2);
  const wb2 = new EJS.Workbook();
  await wb2.xlsx.readFile(xlsx2);
  const ws2 = wb2.worksheets[0];
  let enProv = false;
  for (let r = 2; r <= ws2.rowCount; r++) {
    if (String(ws2.getRow(r).getCell(1).value).trim().toLowerCase() === String(antes.cod).trim().toLowerCase()) enProv = true;
  }
  ok(enProv, 'la lista ' + (antes.esPG ? 'YUFUN · solo PG' : 'YUGIN · sin PG') + ' releída también lleva la ref');

  // Persistencia: cerrar y reabrir — la ref sigue en la orden y en Faltantes
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });
  const trasReabrir = await page.evaluate(cod => {
    const norm = s => String(s || '').trim().toLowerCase();
    return {
      enOrden: (window.STATE.ordenar || []).some(r => norm(r.codigo) === norm(cod)),
      enFaltan: (window.STATE.chinaFaltan || []).some(r => norm(r.codigo) === norm(cod)),
    };
  }, antes.cod);
  ok(trasReabrir.enOrden && trasReabrir.enFaltan, 'cerrar y reabrir TORI: la ref 🔄 sigue en la orden Y en Faltantes');

  const diag = await page.evaluate(() => ({ errores: TORI.diagErrors || 0, log: (TORI.diagLog || []).filter(e => e.t !== 'manual').map(e => e.msg).slice(0, 3) }));
  ok(diag.errores === 0, 'panel de diagnóstico de TORI en 0' + (diag.errores ? ' — ' + JSON.stringify(diag.log) : ''));
  ok(erroresJs.length === 0, 'cero errores de página en Chromium' + (erroresJs.length ? ' — ' + erroresJs[0] : ''));

  await browser.close();
  srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos)); process.exit(1); }
  console.log('★ SEGUNDA OPORTUNIDAD → FALTANTES: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
