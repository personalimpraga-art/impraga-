/**
 * prueba_browser_v5_103.js — reporte 2026-08-21 (PRAGA-138): el "⬇ CSV Precios"
 * corta las palabras/referencias cuando la descripción trae SALTOS DE LÍNEA dentro
 * de la celda (así vienen los Excel de proveedor: "BOTELLA \n PLASTICA") — la fila
 * queda partida en dos y el precio suelto; las empleadas se confunden.
 *
 * Corre el flujo real en DOS versiones: reproduce el corte en la vieja y verifica
 * en la nueva que CADA fila del CSV descargado sale COMPLETA (3 columnas exactas,
 * palabras enteras, precio en su lugar). También audita el CSV Completo.
 *
 * Uso: node prueba_browser_v5_103.js <HTML_nuevo> [HTML_viejo_referencia]
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const HTML_NUEVO = process.argv[2] || 'TORI_Praga_v5_103.html';
const HTML_VIEJO = process.argv[3] || null;
const VENDOR = '/home/user/impraga-/desktop/vendor';
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';

let pasos = 0, fallos = 0;
function ok(cond, msg) {
  if (cond) { pasos++; console.log('  ✔ ' + msg); }
  else { fallos++; console.log('  ✘ FALLO: ' + msg); }
}

// Las filas con la FORMA REAL del bug (calcadas del CSV roto de Andrés, PRAGA-138)
const FILAS = [
  { CAJA: '4-6', ARTICULO: '300-65', DESCRIPCION: 'BOTELLA', CTNS: 1, QTY_CTN: 80, CANTIDAD_TOTAL: 80, PRECIO: 5.8, TOTAL_CBM: 0.3 },
  { CAJA: 'N/A', ARTICULO: '210-87', DESCRIPCION: 'BOTELLA \n PLASTICA', CTNS: 2, QTY_CTN: 60, CANTIDAD_TOTAL: 120, PRECIO: 4.1, TOTAL_CBM: 0.4 },
  { CAJA: 'N/A', ARTICULO: '276-132', DESCRIPCION: 'SET PARA\n  PALETAS', CTNS: 3, QTY_CTN: 100, CANTIDAD_TOTAL: 300, PRECIO: 2.6, TOTAL_CBM: 0.5 },
  { CAJA: 'N/A', ARTICULO: '210-90', DESCRIPCION: 'BOTELLA \r\n PLASTICA GRANDE', CTNS: 1, QTY_CTN: 50, CANTIDAD_TOTAL: 50, PRECIO: 8.2, TOTAL_CBM: 0.2 },
  { CAJA: 'N/A', ARTICULO: '225-181', DESCRIPCION: 'SET CUCHARONES; Y ESPATULAS', CTNS: 2, QTY_CTN: 100, CANTIDAD_TOTAL: 200, PRECIO: 7.8, TOTAL_CBM: 0.4 },
];

async function exportar(htmlPath, etiqueta) {
  const html = fs.readFileSync(htmlPath, 'utf-8').split(CDN).join('<script src="/vendor/xlsx.full.min.js"></script>\n' + CDN);
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/vendor/')) { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(VENDOR, path.basename(req.url))).pipe(res); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
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

  // Factura sembrada con la forma real del bug + clic REAL en ⬇ CSV Precios
  await page.evaluate(filas => {
    TORI.facturas.push({ name: 'PRAGA-138-PRUEBA', loaded: '2026-06-09', params: null, meta: {}, rows: filas });
    if (typeof window.renderFacturas === 'function') try { renderFacturas(); } catch (e) {}
    if (typeof window.updateAfterLoad === 'function') try { updateAfterLoad(); } catch (e) {}
  }, FILAS);
  const bajar = async (tipo) => {
    const [d] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.evaluate(t => exportCSVFac('PRAGA-138-PRUEBA', t), tipo),
    ]);
    const p = path.join(__dirname, 'csv_' + etiqueta + '_' + tipo + '.csv');
    await d.saveAs(p);
    const texto = fs.readFileSync(p, 'utf-8').replace(/^﻿/, '');
    fs.unlinkSync(p);
    return texto.split('\n').filter(l => l.trim() !== '');
  };
  const precios = await bajar('precios');
  const completo = await bajar('completo');
  const diag = await page.evaluate(() => TORI.diagErrors || 0);
  await browser.close();
  srv.close();
  return { precios, completo, diag, erroresJs };
}

(async () => {
  if (HTML_VIEJO) {
    console.log('— Referencia (versión vieja) —');
    const v = await exportar(HTML_VIEJO, 'viejo');
    ok(v.precios.length > 1 + FILAS.length, '[viejo] REPRODUCIDO: el CSV Precios sale con ' + v.precios.length + ' líneas para ' + FILAS.length + ' productos — las filas con salto de línea se PARTEN');
    ok(v.precios.some(l => /^\s*PLASTICA;/.test(l)), '[viejo] REPRODUCIDO: hay una línea que empieza con la palabra cortada (" PLASTICA;…") — el corte del reporte');
  }

  console.log('— Versión nueva —');
  const n = await exportar(HTML_NUEVO, 'nuevo');

  // CSV Precios: 1 línea por producto, 3 columnas exactas, palabras completas
  ok(n.precios.length === 1 + FILAS.length, 'CSV Precios: ' + FILAS.length + ' productos = ' + (n.precios.length - 1) + ' filas — NINGUNA fila partida');
  ok(n.precios[0] === 'ARTICULO;DESCRIPCION;PVP SUGERIDO', 'encabezado intacto');
  const datos = n.precios.slice(1).map(l => l.split(';'));
  ok(datos.every(c => c.length === 3), 'todas las filas tienen EXACTAMENTE 3 columnas (ref; descripción; precio)');
  ok(datos.every(c => /^\d+$/.test(c[2])), 'el precio SIEMPRE queda en su columna, como número entero');
  const d87 = datos.find(c => c[0] === '210-87');
  ok(!!d87 && d87[1] === 'BOTELLA PLASTICA', '210-87: "BOTELLA \\n PLASTICA" salió como "BOTELLA PLASTICA" — palabra COMPLETA en una sola fila (' + (d87 ? d87.join(' | ') : '—') + ')');
  const d132 = datos.find(c => c[0] === '276-132');
  ok(!!d132 && d132[1] === 'SET PARA PALETAS', '276-132: "SET PARA\\n  PALETAS" salió como "SET PARA PALETAS" (' + (d132 ? d132.join(' | ') : '—') + ')');
  const d90 = datos.find(c => c[0] === '210-90');
  ok(!!d90 && d90[1] === 'BOTELLA PLASTICA GRANDE', '210-90: también con \\r\\n de Windows sale completa');
  const d181 = datos.find(c => c[0] === '225-181');
  ok(!!d181 && d181[1] === 'SET CUCHARONES, Y ESPATULAS', 'un ";" dentro de la descripción se vuelve "," y no rompe columnas');
  const refs = datos.map(c => c[0]);
  ok(FILAS.every(f => refs.includes(f.ARTICULO)), 'las 5 referencias salen COMPLETAS y sin cortar: ' + refs.join(', '));

  // CSV Completo: mismas garantías (16 columnas)
  ok(n.completo.length === 1 + FILAS.length, 'CSV Completo: también 1 línea por producto (' + (n.completo.length - 1) + '/' + FILAS.length + ')');
  ok(n.completo.slice(1).every(l => l.split(';').length === 16), 'CSV Completo: todas las filas con sus 16 columnas exactas');

  ok(n.diag === 0, 'panel de diagnóstico de TORI en 0');
  ok(n.erroresJs.length === 0, 'cero errores de página en Chromium');

  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos) + ' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ CSV SIN CORTES: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
