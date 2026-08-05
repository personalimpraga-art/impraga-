/**
 * prueba_browser_v5_94.js — listas YUGIN (sin PG) / YUFUN (solo PG) en el
 * ENTORNO REAL: macro real, clics en los botones nuevos de la tarjeta
 * "Datos para China", y cada Excel descargado y RELEÍDO (regla del auditor).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const EJS = require('./lib/node_modules/exceljs');

const HTML_PATH = process.argv[2] || 'TORI_Praga_v5_94.html';
const VENDOR = '/home/user/impraga-/desktop/vendor';
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';

let pasos = 0, fallos = 0;
function ok(cond, msg) {
  if (cond) { pasos++; console.log('  ✔ ' + msg); }
  else { fallos++; console.log('  ✘ FALLO: ' + msg); }
}

async function releer(download, nombre) {
  const p = path.join(__dirname, nombre);
  await download.saveAs(p);
  const wb = new EJS.Workbook();
  await wb.xlsx.readFile(p);
  const ws = wb.worksheets[0];
  const refs = [];
  for (let r = 3; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).getCell(1).value;
    if (v != null && String(v).trim() !== '') refs.push(String(v).trim());
  }
  return { refs, head1: String(ws.getRow(1).getCell(1).value || ''), head2: String(ws.getRow(2).getCell(1).value || ''), archivo: download.suggestedFilename() };
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

  await page.click('.nav-item[data-screen="motor"]');
  await page.click('.motor-tab-btn[data-tab="tabFaltantes"]');
  await page.waitForTimeout(700);

  // Los 3 botones se VEN y los conteos cuadran
  const st = await page.evaluate(() => {
    const norm = s => String(s ?? '').toLowerCase().trim();
    const falt = window.STATE.chinaFaltan || [];
    const pg = falt.filter(r => norm(r.codigo).indexOf('pg') === 0).length;
    const byu = document.querySelector('[data-action="china-download-yugin"]');
    const byf = document.querySelector('[data-action="china-download-yufun"]');
    const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return { total: falt.length, pg, sinPg: falt.length - pg, tYu: byu ? byu.textContent : '', tYf: byf ? byf.textContent : '', visYu: vis(byu), visYf: vis(byf) };
  });
  ok(st.visYu && st.visYf, 'los botones YUGIN y YUFUN se VEN en la tarjeta Datos para China');
  ok(st.tYu.indexOf(st.sinPg.toLocaleString('es-CO')) >= 0 && st.tYf.indexOf(st.pg.toLocaleString('es-CO')) >= 0, 'los conteos de los botones cuadran en formato es-CO (sin PG: ' + st.sinPg.toLocaleString('es-CO') + ' · PG: ' + st.pg.toLocaleString('es-CO') + ')');

  // YUFUN (solo PG): descargar y releer
  let [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('[data-action="china-download-yufun"]')]);
  const yufun = await releer(d, 'china_yufun.xlsx');
  ok(yufun.archivo.indexOf('YUFUN_solo_PG') >= 0, 'el archivo YUFUN lleva su nombre (' + yufun.archivo + ')');
  ok(yufun.refs.length === st.pg && yufun.refs.every(r => /^pg/i.test(r)), 'Excel YUFUN releído: ' + yufun.refs.length + ' refs, TODAS empiezan por PG');
  ok(yufun.head1 === 'Referencia' && yufun.head2 === '货号', 'encabezados ES/CN intactos en YUFUN');

  // YUGIN (sin PG): descargar y releer
  [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('[data-action="china-download-yugin"]')]);
  const yugin = await releer(d, 'china_yugin.xlsx');
  ok(yugin.archivo.indexOf('YUGIN_sin_PG') >= 0, 'el archivo YUGIN lleva su nombre (' + yugin.archivo + ')');
  ok(yugin.refs.length === st.sinPg && yugin.refs.every(r => !/^pg/i.test(r)), 'Excel YUGIN releído: ' + yugin.refs.length + ' refs, NINGUNA empieza por PG');
  ok(yugin.refs.length + yufun.refs.length === st.total, 'YUGIN + YUFUN suman la lista completa (' + yugin.refs.length + '+' + yufun.refs.length + '=' + st.total + ')');

  // La lista completa de siempre sigue viva
  [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('[data-action="china-download"]')]);
  const todo = await releer(d, 'china_todo.xlsx');
  ok(todo.refs.length === st.total, 'la lista completa de siempre sigue igual (' + todo.refs.length + ' refs)');

  const diag = await page.evaluate(() => ({ errores: TORI.diagErrors || 0, log: (TORI.diagLog || []).filter(e => e.t !== 'manual').map(e => e.msg).slice(0, 3) }));
  ok(diag.errores === 0, 'panel de diagnóstico de TORI en 0' + (diag.errores ? ' — ' + JSON.stringify(diag.log) : ''));
  ok(erroresJs.length === 0, 'cero errores de página en Chromium' + (erroresJs.length ? ' — ' + erroresJs[0] : ''));

  await browser.close();
  srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos) + ' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ LISTAS YUGIN/YUFUN EN NAVEGADOR REAL: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
