/**
 * prueba_browser_v5_101.js — FOTO NÍTIDA en los Excel de proveedor (reporte 2026-08-11:
 * "la foto se ve pero la resolución no alcanza para que ellos puedan ver el producto").
 *
 * Corre el MISMO flujo real en DOS versiones (la vieja de referencia y la nueva):
 * Chromium como el .exe, macro real + factura real PRAGA145 (fotos reales), refs de la
 * factura devueltas a la Orden Sugerida (se agotó el stock — escenario real de reorden),
 * clic en "📗 Excel con FOTOS" de la pestaña China, descarga RELEÍDA midiendo la
 * RESOLUCIÓN REAL en píxeles de cada imagen embebida (parser JPEG/PNG de cabeceras).
 *
 * Uso: node prueba_browser_v5_101.js <HTML_nuevo> [HTML_viejo_referencia]
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const EJS = require('./lib/node_modules/exceljs');

const HTML_NUEVO = process.argv[2] || 'TORI_Praga_v5_101.html';
const HTML_VIEJO = process.argv[3] || null;
const VENDOR = '/home/user/impraga-/desktop/vendor';
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';

let pasos = 0, fallos = 0;
function ok(cond, msg) {
  if (cond) { pasos++; console.log('  ✔ ' + msg); }
  else { fallos++; console.log('  ✘ FALLO: ' + msg); }
}

// Dimensiones de una imagen desde sus bytes (JPEG SOFn / PNG IHDR)
function dimensiones(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) {  // PNG
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), tipo: 'png' };
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8) {  // JPEG
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), tipo: 'jpeg' };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return { w: 0, h: 0, tipo: '?' };
}

async function correrFlujo(htmlPath, etiqueta) {
  const html = fs.readFileSync(htmlPath, 'utf-8')
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

  // Archivos REALES: factura con fotos + macro
  await page.setInputFiles('#fileFacturas', '/home/user/impraga-/muestras/FACTURA_20260715_PRAGA145.xlsx');
  await page.waitForFunction(() => window.TORI.facturas.length > 0 && window.TORI.facturas[0].rows.some(r => r.FOTO), { timeout: 60000 });
  await page.waitForFunction(() => !window._comprimiendoFotos, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);   // deja terminar la compresión de importación
  await page.setInputFiles('#fileMacro', '/home/user/impraga-/muestras/MACRO_INVENTARIO_03082026.xlsx');
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });

  // Escenario real de reorden: refs de la factura se AGOTARON → vuelven a la Orden Sugerida
  const seed = await page.evaluate(() => {
    const norm = s => String(s || '').trim().toLowerCase();
    const enFac = new Set();
    window.TORI.facturas.forEach(f => f.rows.forEach(r => { if (r.FOTO && r.ARTICULO) enFac.add(norm(r.ARTICULO)); }));
    let n = 0;
    (window.STATE.rows || []).forEach(r => {
      if (n >= 12) return;
      if (enFac.has(norm(r.codigo))) { r.saldo = 0; r.ocPend = 0; r.diasRaw = 30; n++; }
    });
    return { enFactura: enFac.size, devueltas: n };
  });
  // Recalcular el Motor con el hook real (Liquidador→Motor) y activar la pantalla
  await page.evaluate(() => { if (typeof window.__motorRefresh === 'function') window.__motorRefresh(); });
  await page.waitForTimeout(900);
  await page.click('.nav-item[data-screen="motor"]');
  await page.evaluate(() => { document.querySelectorAll('.motor-tab-btn').forEach(b => { if (b.getAttribute('data-tab') === 'tabOrden') b.click(); }); });
  await page.waitForTimeout(500);
  // Una ref DE LA ORDEN con foto BUENA (900px, como si el proveedor mandara mejor
  // calidad): la versión vieja la recorta a 480px; la nueva debe llevarla completa.
  const refBuena = await page.evaluate(() => {
    const norm = s => String(s || '').trim().toLowerCase();
    const rOrd = (window.STATE.ordenar || []).find(r => window.getFotoByCodigo(r.codigo));
    if (!rOrd) return null;
    let elegida = null;
    window.TORI.facturas.forEach(f => f.rows.forEach(row => {
      if (!elegida && row.FOTO && norm(row.ARTICULO) === norm(rOrd.codigo)) elegida = row;
    }));
    if (!elegida) return null;
    const cv = document.createElement('canvas'); cv.width = 900; cv.height = 900;
    const cx = cv.getContext('2d');
    const g = cx.createLinearGradient(0, 0, 900, 900); g.addColorStop(0, '#c33'); g.addColorStop(1, '#36c');
    cx.fillStyle = g; cx.fillRect(0, 0, 900, 900);
    cx.fillStyle = '#fff'; cx.font = 'bold 90px sans-serif'; cx.fillText('FOTO 900px', 90, 460);
    elegida.FOTO = cv.toDataURL('image/jpeg', 0.85);
    elegida._fotoComp = true;
    if (typeof window.updateAfterLoad === 'function') window.updateAfterLoad();   // invalida el caché de fotos (mecanismo real)
    return String(elegida.ARTICULO);
  });
  const overlap = await page.evaluate(() => {
    const conFoto = (window.STATE.ordenar || []).filter(r => window.getFotoByCodigo && window.getFotoByCodigo(r.codigo));
    return conFoto.length;
  });
  ok(!!refBuena, '[' + etiqueta + '] foto de 900px inyectada en la ref ' + refBuena + ' (que SÍ está en la orden) + caché invalidado');
  ok(seed.devueltas > 0 && overlap >= seed.devueltas, '[' + etiqueta + '] ' + seed.devueltas + ' refs reales de PRAGA145 devueltas a la orden — ' + overlap + ' refs de la orden con foto de factura');

  // Resolución GUARDADA en la bóveda (el techo de calidad disponible)
  const guardadas = await page.evaluate(async () => {
    const refs = (window.STATE.ordenar || []).filter(r => window.getFotoByCodigo(r.codigo)).slice(0, 12);
    const out = [];
    for (const r of refs) {
      const f = window.getFotoByCodigo(r.codigo);
      const dim = await new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 0, h: 0 }); i.src = f; });
      out.push({ ref: r.codigo, w: dim.w, len: f.length });
    }
    return out;
  });
  const maxGuardada = Math.max.apply(null, guardadas.map(g => g.w));
  console.log('    [' + etiqueta + '] fotos en la bóveda: ' + guardadas.slice(0, 4).map(g => g.ref + '=' + g.w + 'px').join(', ') + '… (máx ' + maxGuardada + 'px)');

  // Exportar el 📗 Excel con FOTOS de la pestaña China (clic real) y medir el tiempo
  await page.evaluate(() => { document.querySelectorAll('.motor-tab-btn').forEach(b => { if (b.getAttribute('data-tab') === 'tabChina') b.click(); }); });
  await page.waitForTimeout(600);
  const t0 = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 180000 }),
    page.click('#exportChinaExcelFotosBtn'),
  ]);
  const xlsxPath = path.join(__dirname, 'nitidez_' + etiqueta + '.xlsx');
  await download.saveAs(xlsxPath);
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  const mb = (fs.statSync(xlsxPath).size / 1048576).toFixed(1);

  // RELEER: imágenes embebidas con su resolución real + altos de fila
  const wb = new EJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.worksheets[0];
  const imgs = ws.getImages();
  const anchos = [];
  imgs.forEach(im => {
    const media = wb.model.media.find(m => m.index === im.imageId || String(m.index) === String(im.imageId));
    const buf = media ? media.buffer : (wb.media && wb.media[im.imageId] && wb.media[im.imageId].buffer);
    if (buf) anchos.push(dimensiones(Buffer.from(buf)));
  });
  const altos = [];
  imgs.forEach(im => { const r = (im.range.tl.nativeRow != null ? im.range.tl.nativeRow : im.range.tl.row) + 1; altos.push(ws.getRow(r).height); });
  const diag = await page.evaluate(() => ({ errores: TORI.diagErrors || 0, log: (TORI.diagLog || []).filter(e => e.t !== 'manual').map(e => e.msg).slice(0, 3) }));

  await browser.close();
  srv.close();
  return { etiqueta, overlap, imgs: imgs.length, anchos, altos, dur, mb, maxGuardada, guardadas, diag, erroresJs };
}

(async () => {
  let viejo = null;
  if (HTML_VIEJO) {
    console.log('— Referencia (versión vieja) —');
    viejo = await correrFlujo(HTML_VIEJO, 'v100');
    const maxV = Math.max.apply(null, viejo.anchos.map(a => a.w));
    console.log('    [v100] ' + viejo.imgs + ' fotos en el Excel, ancho máx ' + maxV + 'px, filas ' + viejo.altos[0] + 'pt, ' + viejo.mb + ' MB, ' + viejo.dur + 's');
    ok(maxV <= 480 && viejo.maxGuardada === 900, '[v100] REPRODUCIDO: la bóveda tiene una foto de ' + viejo.maxGuardada + 'px pero el Excel viejo la recorta a ' + maxV + 'px');
  }

  console.log('— Versión nueva —');
  const nuevo = await correrFlujo(HTML_NUEVO, 'v101');
  ok(nuevo.imgs >= nuevo.overlap && nuevo.imgs > 0, '[v101] el Excel lleva las ' + nuevo.imgs + ' fotos (refs con foto en la orden: ' + nuevo.overlap + ')');
  const maxN = Math.max.apply(null, nuevo.anchos.map(a => a.w));
  const minN = Math.min.apply(null, nuevo.anchos.map(a => a.w));
  ok(maxN === 900, '[v101] la foto buena (900px) va COMPLETA al Excel — ya no se recorta a 480px (máx embebido: ' + maxN + 'px)');
  ok(maxN === nuevo.maxGuardada, '[v101] la foto va TAL CUAL está en la bóveda — ' + maxN + 'px = resolución guardada (' + nuevo.maxGuardada + 'px), sin recompresión');
  ok(nuevo.altos.every(h => h === 76), '[v101] filas con foto a 76pt (foto visible a 96px, antes 64px) [' + nuevo.altos.slice(0, 3).join(', ') + ']');
  if (viejo) {
    ok(parseFloat(nuevo.dur) <= parseFloat(viejo.dur) + 3, '[v101] generar NO se puso lento: ' + nuevo.dur + 's vs ' + viejo.dur + 's de antes (' + nuevo.mb + ' MB vs ' + viejo.mb + ' MB)');
  }
  ok(nuevo.diag.errores === 0, '[v101] panel de diagnóstico en 0' + (nuevo.diag.errores ? ' — ' + JSON.stringify(nuevo.diag.log) : ''));
  ok(nuevo.erroresJs.length === 0, '[v101] cero errores de página' + (nuevo.erroresJs.length ? ' — ' + nuevo.erroresJs[0] : ''));

  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos) + ' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ FOTO NÍTIDA EN EXCEL DE PROVEEDOR: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
