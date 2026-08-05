/**
 * prueba_browser_v5_95.js — 🔄 Segunda oportunidad en el ENTORNO REAL.
 * Macro real, clic en la pastilla Rotación > límite, clic 🔄 en una ref,
 * verificación VISIBLE en la Orden Sugerida, cerrar/reabrir, y quitar.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const HTML_PATH = process.argv[2] || 'TORI_Praga_v5_95.html';
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
  const dialogos = [];
  page.on('pageerror', e => erroresJs.push(String(e.message || e)));
  page.on('dialog', async d => { dialogos.push(d.message()); await d.accept(); });
  await page.route('**cdnjs.cloudflare.com/**', r => r.abort());
  await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
  await page.goto('http://127.0.0.1:' + srv.address().port + '/tori.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  await page.setInputFiles('#fileMacro', '/home/user/impraga-/muestras/MACRO_INVENTARIO_03082026.xlsx');
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });

  await page.click('.nav-item[data-screen="motor"]');
  await page.click('.motor-tab-btn[data-tab="tabOrden"]');
  await page.waitForTimeout(600);

  const antes = await page.evaluate(() => ({
    orden: window.STATE.ordenar.length,
    lentas: window.STATE.excluidos.filter(r => r.status === 'ROTACION_LENTA').length,
  }));
  ok(antes.lentas > 0, 'macro real: ' + antes.orden + ' en la orden · ' + antes.lentas + ' en Rotación > límite');

  // a la vista Rotación > límite con clic real en la pastilla
  await page.click('#statusPills .pill[data-view="ROTACION_LENTA"]');
  await page.waitForTimeout(800);
  const primera = await page.evaluate(() => {
    const btn = document.querySelector('#ordenTableBody button[onclick*="__soDar"]');
    if (!btn) return null;
    const tr = btn.closest('tr');
    const r = btn.getBoundingClientRect();
    return { codigo: tr.querySelectorAll('td')[1].textContent.trim(), visible: r.width > 0 && r.height > 0 };
  });
  ok(!!primera && primera.visible, 'el botón 🔄 Otra oportunidad se VE en las filas de Rotación > límite');

  // clic real en el botón de la primera fila
  await page.click('#ordenTableBody button[onclick*="__soDar"]');
  await page.waitForSelector('#toriConfirmOverlay', { timeout: 5000 });
  const confSO = await page.evaluate(() => document.getElementById('toriConfirmOverlay').textContent);
  ok(confSO.indexOf('se consume sola') >= 0 && dialogos.length === 0, 'confirmación con toriConfirm y la regla explicada (CERO diálogos nativos)');
  await page.click('#toriConfirmOkBtn');
  await page.waitForTimeout(900);

  const despues = await page.evaluate(cod => ({
    orden: window.STATE.ordenar.length,
    enOrden: window.STATE.ordenar.some(r => r.codigo === cod),
    fila: window.STATE.ordenar.find(r => r.codigo === cod) || null,
    db: window.getSegundaOportDB(),
  }), primera.codigo);
  ok(despues.enOrden && despues.orden === antes.orden + 1, primera.codigo + ' pasó a la Orden Sugerida (' + antes.orden + ' → ' + despues.orden + ')');
  ok(despues.fila && despues.fila.tier === 'C' && !!despues.fila.segundaOport, 'con Tier C y la marca de segunda oportunidad');
  ok(!!despues.db[primera.codigo.toLowerCase()] && !!despues.db[primera.codigo.toLowerCase()].fEntradaBase, 'guardada con su fecha de entrada base (' + (despues.db[primera.codigo.toLowerCase()] || {}).fEntradaBase + ')');

  // la marca 🔄 se VE en la Orden Sugerida
  await page.click('#statusPills .pill[data-view="ORDEN"]');
  await page.waitForTimeout(800);
  await page.fill('#searchInput', primera.codigo);
  await page.waitForTimeout(600);
  const marca = await page.evaluate(() => {
    const el = document.querySelector('#ordenTableBody span[onclick*="__soQuitar"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { visible: r.width > 0 && r.height > 0 };
  });
  ok(!!marca && marca.visible, 'la marca 🔄 se VE en la fila dentro de la Orden Sugerida');

  // cerrar y reabrir: persiste
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  await page.waitForTimeout(3000);
  const trasReabrir = await page.evaluate(cod => ({
    enOrden: (window.STATE && window.STATE.ordenar || []).some(r => r.codigo === cod),
    db: window.getSegundaOportDB ? window.getSegundaOportDB() : {},
  }), primera.codigo);
  ok(!!trasReabrir.db[primera.codigo.toLowerCase()], 'cerrar/reabrir: la oportunidad sigue guardada en la bóveda');
  ok(trasReabrir.enOrden, 'y ' + primera.codigo + ' sigue en la Orden Sugerida');

  // quitarla con el clic en la marca
  await page.click('.nav-item[data-screen="motor"]');
  await page.click('.motor-tab-btn[data-tab="tabOrden"]');
  await page.waitForTimeout(600);
  await page.fill('#searchInput', primera.codigo);
  await page.waitForTimeout(600);
  await page.click('#ordenTableBody span[onclick*="__soQuitar"]');
  await page.waitForTimeout(900);
  const final = await page.evaluate(cod => ({
    enOrden: window.STATE.ordenar.some(r => r.codigo === cod),
    lenta: window.STATE.excluidos.some(r => r.codigo === cod && r.status === 'ROTACION_LENTA'),
    db: window.getSegundaOportDB(),
  }), primera.codigo);
  ok(!final.enOrden && final.lenta && !final.db[primera.codigo.toLowerCase()], 'clic en la marca 🔄 la quita: vuelve a Rotación > límite y sale de la base');

  const diag = await page.evaluate(() => ({ errores: TORI.diagErrors || 0, log: (TORI.diagLog || []).filter(e => e.t !== 'manual').map(e => e.msg).slice(0, 3) }));
  ok(diag.errores === 0, 'panel de diagnóstico de TORI en 0' + (diag.errores ? ' — ' + JSON.stringify(diag.log) : ''));
  ok(erroresJs.length === 0, 'cero errores de página en Chromium' + (erroresJs.length ? ' — ' + erroresJs[0] : ''));

  await browser.close();
  srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos) + ' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ SEGUNDA OPORTUNIDAD EN NAVEGADOR REAL: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
