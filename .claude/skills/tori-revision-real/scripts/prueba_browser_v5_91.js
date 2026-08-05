/**
 * prueba_browser_v5_91.js — columna Proveedor en el ENTORNO REAL.
 * Chromium como el .exe, macro REAL de muestras/, base Datos China sembrada en la
 * bóveda (praga_china_db_v1 — la fuente real del proveedor), clics de usuario en
 * el encabezado Proveedor (▲▼) y Excel de la orden descargado y RELEÍDO.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const EJS = require('./lib/node_modules/exceljs');

const HTML_PATH = process.argv[2] || 'TORI_Praga_v5_91.html';
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
    // base Datos China real en la bóveda: proveedores para refs del macro de muestras
    localStorage.setItem('praga_china_db_v1', JSON.stringify({
      '152-98': { codigo: '152-98', descripcionChina: '夹子', precioRMB: 2.1, proveedor: 'YUGIN', historial: [] },
      '300-72': { codigo: '300-72', descripcionChina: '油壶', precioRMB: 3.5, proveedor: 'ALIBABA-ZHANG', historial: [] },
      '312-61': { codigo: '312-61', descripcionChina: '托盘', precioRMB: 4.2, proveedor: 'YUGIN', historial: [] },
    }));
  });
  await page.goto('http://127.0.0.1:' + srv.address().port + '/tori.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  await page.setInputFiles('#fileMacro', '/home/user/impraga-/muestras/MACRO_INVENTARIO_03082026.xlsx');
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });
  ok(true, 'TORI arrancó como el .exe con el macro real y la base Datos China en la bóveda');

  await page.click('.nav-item[data-screen="motor"]');
  await page.click('.motor-tab-btn[data-tab="tabOrden"]');
  await page.waitForTimeout(700);

  // La columna se VE
  const th = await page.evaluate(() => {
    const t = document.querySelector('th[data-sort="proveedorChina"]');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { texto: t.textContent.trim(), visible: r.width > 0 && r.height > 0 };
  });
  ok(!!th && th.visible && th.texto.indexOf('Proveedor') >= 0, 'la columna Proveedor se VE en la Orden de Compra');

  const provCol = () => page.evaluate(() => Array.from(document.querySelectorAll('#ordenTableBody tr')).map(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length <= 17) return null;
    // v5_100: la celda puede llevar el recuadrito ×N — el nombre del proveedor es el primer nodo de texto
    const prov = (tds[16].childNodes[0] && tds[16].childNodes[0].textContent || tds[16].textContent).trim();
    return { codigo: tds[1].textContent.trim().split(' ')[0], prov };
  }).filter(Boolean));

  let f = await provCol();
  const conProv = f.filter(r => r.prov && r.prov !== '—');
  ok(conProv.some(r => r.prov === 'YUGIN') && conProv.some(r => r.prov === 'ALIBABA-ZHANG'), 'las celdas muestran los proveedores de la base China (YUGIN, ALIBABA-ZHANG)');

  // Clic REAL en el encabezado → ▲ (agrupa por proveedor, sin proveedor al final)
  await page.click('th[data-sort="proveedorChina"]');
  await page.waitForTimeout(700);
  f = await provCol();
  const primeros = f.slice(0, 3).map(r => r.prov);
  ok(primeros[0] === 'ALIBABA-ZHANG' && primeros[1] === 'YUGIN' && primeros[2] === 'YUGIN', '▲ orden alfabético: ALIBABA-ZHANG, YUGIN, YUGIN arriba — los del MISMO proveedor quedan JUNTOS [' + primeros.join(', ') + ']');
  ok(f[f.length - 1].prov === '—', 'las refs sin proveedor quedan al final');
  ok(await page.evaluate(() => document.querySelector('th[data-sort="proveedorChina"] .sort-arrow') !== null), 'la flecha ▲ se VE en el encabezado');

  // Segundo clic → ▼ (invertido, sin proveedor sigue al final)
  await page.click('th[data-sort="proveedorChina"]');
  await page.waitForTimeout(700);
  f = await provCol();
  ok(f[0].prov === 'YUGIN' && f[1].prov === 'YUGIN' && f[2].prov === 'ALIBABA-ZHANG', '▼ invierte: YUGIN, YUGIN, ALIBABA-ZHANG [' + f.slice(0, 3).map(r => r.prov).join(', ') + ']');
  ok(f[f.length - 1].prov === '—', 'sin proveedor sigue al final al invertir');

  // v5_93: el buscador también encuentra por PROVEEDOR (tecleo real)
  const ph = await page.evaluate(() => document.getElementById('searchInput').placeholder);
  ok(ph.indexOf('proveedor') >= 0, 'el placeholder del buscador anuncia proveedor ("' + ph + '")');
  await page.click('#searchInput');
  await page.keyboard.type('yugin', { delay: 40 });
  await page.waitForTimeout(600);
  f = await provCol();
  ok(f.length === 2 && f.every(r => r.prov === 'YUGIN'), 'teclear "yugin" deja SOLO las refs de ese proveedor (' + f.length + ')');
  await page.fill('#searchInput', '');
  await page.waitForTimeout(400);

  // El resto sigue vivo: filtros v5_89 + contador
  await page.click('#marroFilterRow .pill[data-val="SOLO"]');
  await page.waitForTimeout(500);
  const cnt = await page.evaluate(() => document.getElementById('ordenCount').textContent);
  ok(/Mostrando 581 de/.test(cnt), 'filtro Solo marroquinería sigue vivo con la columna nueva (' + cnt.slice(0, 30) + '…)');
  await page.click('#marroFilterRow .pill[data-val="TODO"]');
  await page.waitForTimeout(400);

  // Excel de la orden: descargar y RELEER (con la columna Proveedor / Tienda)
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click('#exportExcelBtn'),
  ]);
  const xlsxPath = path.join(__dirname, 'orden_v5_91.xlsx');
  await download.saveAs(xlsxPath);
  const wb = new EJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.worksheets[0];
  const head = ws.getRow(1).values;
  const iProv = head.indexOf('Proveedor / Tienda');
  ok(iProv > 0, 'Excel releído: encabezado "Proveedor / Tienda" presente (col ' + iProv + ')');
  let provsExcel = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).getCell(iProv).value;
    if (v === 'YUGIN' || v === 'ALIBABA-ZHANG') provsExcel++;
  }
  ok(provsExcel >= 2, 'Excel releído: los proveedores sembrados van en las filas (' + provsExcel + ' celdas)');

  const diag = await page.evaluate(() => ({ errores: TORI.diagErrors || 0, log: (TORI.diagLog || []).filter(e => e.t !== 'manual').map(e => e.msg).slice(0, 3) }));
  ok(diag.errores === 0, 'panel de diagnóstico de TORI en 0' + (diag.errores ? ' — ' + JSON.stringify(diag.log) : ''));
  ok(erroresJs.length === 0, 'cero errores de página en Chromium' + (erroresJs.length ? ' — ' + erroresJs[0] : ''));

  await browser.close();
  srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos) + ' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ COLUMNA PROVEEDOR EN NAVEGADOR REAL: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
