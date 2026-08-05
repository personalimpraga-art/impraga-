/**
 * prueba_browser_v5_100.js — recuadrito morado ×N del proveedor en la Orden de Compra.
 * Chromium como el .exe (vendor local, CDN bloqueado, prompt() lanzando error),
 * macro REAL de muestras/, base Datos China sembrada DINÁMICAMENTE con refs que
 * SÍ están en la Orden Sugerida (3 refs YUGIN + 1 ALIBABA-ZHANG), y verificación
 * VISIBLE: el ×3 se ve, con los tonos morados del pill de versión, el proveedor
 * único NO lleva recuadrito, y el conteo de CADA badge coincide con el conteo
 * real calculado a mano sobre STATE.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

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
  await page.setInputFiles('#fileMacro', '/home/user/impraga-/muestras/MACRO_INVENTIO_03082026.xlsx'.replace('INVENTIO', 'INVENTARIO'));
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });
  ok(true, 'TORI arrancó como el .exe con el macro real (' + await page.evaluate(() => window.STATE.ordenar.length) + ' refs en Orden Sugerida)');

  // Sembrar la base Datos China con refs QUE SÍ ESTÁN en la Orden Sugerida:
  // las 3 primeras → YUGIN (repetido) · la 4ª → ALIBABA-ZHANG (único)
  const codigos = await page.evaluate(() => {
    const cods = window.STATE.ordenar.slice(0, 4).map(r => r.codigo);
    const norm = s => String(s || '').trim().toLowerCase();
    const db = {};
    cods.forEach((c, i) => {
      db[norm(c)] = { codigo: c, descripcionChina: '测试' + i, precioRMB: 2 + i, proveedor: i < 3 ? 'YUGIN' : 'ALIBABA-ZHANG', historial: [] };
    });
    localStorage.setItem('praga_china_db_v1', JSON.stringify(db));
    return cods;
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });
  await page.click('.nav-item[data-screen="motor"]');
  await page.click('.motor-tab-btn[data-tab="tabOrden"]');
  await page.waitForTimeout(700);
  ok(true, 'base Datos China sembrada con refs vivas de la orden: YUGIN ×3 (' + codigos.slice(0, 3).join(', ') + ') + ALIBABA-ZHANG ×1 (' + codigos[3] + ')');

  // Lector de la columna Proveedor: texto, badge y estilos COMPUTADOS (visibilidad real)
  const leerProv = () => page.evaluate(() => Array.from(document.querySelectorAll('#ordenTableBody tr')).map(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 18) return null;
    const td = tds[16];
    const badge = td.querySelector('span[title*="referencias en esta orden"]');
    let b = null;
    if (badge) {
      const cs = getComputedStyle(badge);
      const rect = badge.getBoundingClientRect();
      b = { texto: badge.textContent.trim(), title: badge.getAttribute('title'), bg: cs.backgroundColor, color: cs.color, radio: cs.borderRadius, visible: rect.width > 0 && rect.height > 0 };
    }
    return { codigo: tds[1].textContent.trim().split(' ')[0], prov: (td.childNodes[0] && td.childNodes[0].textContent || td.textContent).trim(), badge: b };
  }).filter(Boolean));

  let filas = await leerProv();
  const yugin = filas.filter(r => r.prov === 'YUGIN');
  const alibaba = filas.filter(r => r.prov === 'ALIBABA-ZHANG');
  const sinProv = filas.filter(r => r.prov === '—');

  // 1. El recuadrito ×3 SE VE en las 3 filas YUGIN
  ok(yugin.length === 3, 'las 3 refs YUGIN están en la tabla (' + yugin.length + ')');
  ok(yugin.every(r => r.badge && r.badge.visible && r.badge.texto === '×3'), 'el recuadrito ×3 SE VE al lado de YUGIN en las 3 filas [' + yugin.map(r => r.badge ? r.badge.texto : 'sin badge').join(', ') + ']');

  // 2. Tonos morados de TORI (los del pill de versión: #efeaff / #6C5CE7) + forma de pill
  const b0 = yugin[0] && yugin[0].badge;
  ok(!!b0 && b0.bg === 'rgb(239, 234, 255)', 'fondo morado claro #efeaff real en pantalla (' + (b0 && b0.bg) + ')');
  ok(!!b0 && b0.color === 'rgb(108, 92, 231)', 'texto morado #6C5CE7 real en pantalla (' + (b0 && b0.color) + ')');
  ok(!!b0 && parseFloat(b0.radio) > 20, 'forma de pill redondeada como el resto de TORI (radius ' + (b0 && b0.radio) + ')');
  ok(!!b0 && /YUGIN tiene 3 referencias en esta orden/.test(b0.title), 'tooltip explica el número: "' + (b0 && b0.title) + '"');

  // 3. Proveedor ÚNICO: nombre limpio, SIN recuadrito
  ok(alibaba.length === 1 && !alibaba[0].badge, 'ALIBABA-ZHANG (1 sola ref) NO lleva recuadrito — solo se marca lo repetido');

  // 4. Refs sin proveedor siguen con el guion gris de siempre
  ok(sinProv.length > 0 && sinProv.every(r => !r.badge), 'las refs sin proveedor siguen con "—" y sin recuadrito (' + sinProv.length + ' filas)');

  // 5. El conteo de CADA badge coincide con el conteo real calculado a mano sobre STATE
  const cruce = await page.evaluate(() => {
    const cnt = {};
    window.STATE.ordenar.forEach(r => { const p = (r.proveedorChina || '').trim(); if (p) cnt[p] = (cnt[p] || 0) + 1; });
    return cnt;
  });
  ok(cruce['YUGIN'] === 3 && cruce['ALIBABA-ZHANG'] === 1, 'cruce a mano sobre STATE.ordenar: YUGIN=3, ALIBABA-ZHANG=1 — los badges dicen la verdad');

  // 6. Al FILTRAR el recuadrito conserva el conteo de TODA la orden (no del filtro)
  await page.click('#searchInput');
  await page.keyboard.type(codigos[0], { delay: 30 });
  await page.waitForTimeout(600);
  filas = await leerProv();
  ok(filas.length === 1 && filas[0].badge && filas[0].badge.texto === '×3', 'filtrando a 1 sola fila, el recuadrito sigue diciendo ×3 (el conteo es de TODA la orden)');
  await page.fill('#searchInput', '');
  await page.waitForTimeout(500);

  // 7. Ordenar por Proveedor (clic real en el encabezado) convive con el recuadrito
  await page.click('th[data-sort="proveedorChina"]');
  await page.waitForTimeout(700);
  filas = await leerProv();
  const arriba = filas.slice(0, 4);
  ok(arriba[0].prov === 'ALIBABA-ZHANG' && arriba[1].prov === 'YUGIN' && arriba[2].prov === 'YUGIN' && arriba[3].prov === 'YUGIN', 'clic en el encabezado ▲: agrupa por proveedor con los recuadritos puestos [' + arriba.map(r => r.prov).join(', ') + ']');
  ok(arriba.slice(1).every(r => r.badge && r.badge.texto === '×3'), 'los ×3 siguen en las filas YUGIN tras ordenar');
  await page.click('th[data-sort="proveedorChina"]');
  await page.waitForTimeout(500);

  // 8. Las vistas excluidas (sin columna Proveedor) siguen pintando sin errores
  await page.evaluate(() => { const p = document.querySelector('#statusPills .pill[data-view="TIENE_INV"], #statusPills [data-view="TIENE_INV"]'); if (p) p.click(); });
  await page.waitForTimeout(600);
  const filasExcl = await page.evaluate(() => document.querySelectorAll('#ordenTableBody tr').length);
  ok(filasExcl > 0, 'la vista "Tiene inventario" (sin columna Proveedor) pinta normal (' + filasExcl + ' filas)');
  await page.evaluate(() => { const p = document.querySelector('#statusPills [data-view="ORDEN"]'); if (p) p.click(); });
  await page.waitForTimeout(600);

  // 9. Diagnóstico en CERO + cero errores de página (modo .exe todo el rato)
  const diag = await page.evaluate(() => ({ errores: TORI.diagErrors || 0, log: (TORI.diagLog || []).filter(e => e.t !== 'manual').map(e => e.msg).slice(0, 3) }));
  ok(diag.errores === 0, 'panel de diagnóstico de TORI en 0' + (diag.errores ? ' — ' + JSON.stringify(diag.log) : ''));
  ok(erroresJs.length === 0, 'cero errores de página en Chromium' + (erroresJs.length ? ' — ' + erroresJs[0] : ''));

  await browser.close();
  srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos) + ' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ RECUADRITO ×N DE PROVEEDOR EN NAVEGADOR REAL: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
