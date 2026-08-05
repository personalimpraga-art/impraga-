/**
 * prueba_browser_v5_89.js — REVISIÓN EN NAVEGADOR REAL (ritual tori-revision-real §2)
 * Chromium de verdad, servido como el .exe (vendor local, CDN bloqueado), MODO
 * .exe (prompt() nativo lanza el error de Electron), macro REAL de muestras/,
 * clics de usuario sobre los filtros nuevos y el envío masivo, cerrar/reabrir.
 *
 * Uso: node prueba_browser_v5_89.js /ruta/TORI_Praga_v5_89.html
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const HTML_PATH = process.argv[2];
const VENDOR = '/home/user/impraga-/desktop/vendor';
const MACRO = '/home/user/impraga-/muestras/MACRO_INVENTARIO_03082026.xlsx';
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';
const MARRO_RE = /(BOLSO|BILLETERA|RIÑONERA|RINONERA|MORRAL|MONEDERO|COSMETIQUERA|CARTUCHERA|CORREA|LONCHERA)/i;

let pasos = 0, fallos = 0;
function ok(cond, msg) {
  if (cond) { pasos++; console.log('  ✔ ' + msg); }
  else { fallos++; console.log('  ✘ FALLO: ' + msg); }
}

function leerContador(txt) {
  const m = /Mostrando ([\d.]+) de ([\d.]+)/.exec(txt || '');
  return m ? { x: parseInt(m[1].replace(/\./g, ''), 10), y: parseInt(m[2].replace(/\./g, ''), 10) } : null;
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
  const base = 'http://127.0.0.1:' + srv.address().port + '/tori.html';

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const erroresJs = [];
  const dialogos = [];
  page.on('pageerror', e => erroresJs.push(String(e.message || e)));
  page.on('dialog', async d => { dialogos.push(d.message()); await d.accept(); });
  await page.route('**cdnjs.cloudflare.com/**', r => r.abort());
  // MODO .exe: prompt() nativo revienta como en Electron
  await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  ok(true, 'TORI arrancó servido como el .exe (vendor local, CDN bloqueado, prompt roto)');

  // ── Macro REAL por el input real ──
  await page.setInputFiles('#fileMacro', MACRO);
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });
  const nOrden = await page.evaluate(() => window.STATE.ordenar.length);
  ok(nOrden > 0, 'macro real de muestras/ procesado — ' + nOrden + ' refs en la Orden Sugerida');

  // ── A la Orden de Compra con clics de usuario ──
  await page.click('.nav-item[data-screen="motor"]');
  await page.click('.motor-tab-btn[data-tab="tabOrden"]');
  await page.waitForTimeout(600);

  // Visibilidad REAL de lo nuevo (lección v5_80: que se VEA, no solo que exista)
  ok(await page.evaluate(() => { const e = document.getElementById('marroFilterRow'); return !!(e && e.offsetParent !== null); }), 'los pills de marroquinería se VEN en la Orden de Compra');
  ok(await page.evaluate(() => { const e = document.getElementById('pgFilterRow'); return !!(e && e.offsetParent !== null); }), 'los pills de PG se VEN');

  const filasPintadas = () => page.evaluate(() => Array.from(document.querySelectorAll('#ordenTableBody tr')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return tds.length > 3 ? { codigo: tds[1].textContent.trim().replace(/[\u{1F500}-\u{1FAFF}☀-➿]/gu, '').trim(), nombre: tds[2].textContent.trim() } : null;
  }).filter(Boolean));
  const contador = async () => leerContador(await page.evaluate(() => document.getElementById('ordenCount').textContent));

  const base0 = await contador();
  ok(base0 && base0.x === base0.y && base0.y === nOrden, 'sin filtros: "Mostrando ' + nOrden + ' de ' + nOrden + '"');

  // ── Solo marroquinería ──
  await page.click('#marroFilterRow .pill[data-val="SOLO"]');
  await page.waitForTimeout(400);
  let f = await filasPintadas();
  let c = await contador();
  const todoMarro = f.length > 0 && f.every(r => MARRO_RE.test(r.nombre));
  ok(todoMarro, 'Solo marroquinería: las ' + f.length + ' filas visibles son de la lista de la junta');
  ok(c && c.x === f.length && c.y === nOrden, 'contador coherente: Mostrando ' + (c && c.x) + ' de ' + (c && c.y));
  const nMarro = f.length;
  const btnTxt = await page.evaluate(() => document.getElementById('pcMandarFiltradoBtn').textContent);
  const btnVisible = await page.evaluate(() => document.getElementById('pcMandarFiltradoBtn').offsetParent !== null);
  ok(btnVisible && btnTxt.indexOf(String(nMarro)) >= 0, 'botón 🏭 visible con el conteo del filtro: "' + btnTxt + '"');

  // ── Sin marroquinería ──
  await page.click('#marroFilterRow .pill[data-val="SIN"]');
  await page.waitForTimeout(400);
  f = await filasPintadas();
  ok(f.length > 0 && f.every(r => !MARRO_RE.test(r.nombre)), 'Sin marroquinería: ninguna de las ' + f.length + ' filas es marroquinería');
  c = await contador();
  ok(c && c.x + nMarro === nOrden, 'marroquinería + no-marroquinería suman toda la orden (' + c.x + '+' + nMarro + '=' + nOrden + ')');

  // ── PG ──
  await page.click('#marroFilterRow .pill[data-val="TODO"]');
  await page.click('#pgFilterRow .pill[data-val="SOLO"]');
  await page.waitForTimeout(400);
  f = await filasPintadas();
  const nPG = f.length;
  ok(f.every(r => /^PG/i.test(r.codigo)), 'Solo PG: las ' + nPG + ' filas visibles empiezan por PG');
  await page.click('#pgFilterRow .pill[data-val="SIN"]');
  await page.waitForTimeout(400);
  f = await filasPintadas();
  ok(f.length > 0 && f.every(r => !/^PG/i.test(r.codigo)), 'Sin PG: ninguna fila empieza por PG (' + f.length + ')');
  ok(f.length + nPG === nOrden, 'PG + no-PG suman toda la orden (' + nPG + '+' + f.length + '=' + nOrden + ')');

  // ── Combinado con el buscador (tecleo real) ──
  await page.click('#marroFilterRow .pill[data-val="SOLO"]');
  await page.click('#pgFilterRow .pill[data-val="TODO"]');
  await page.click('#searchInput');
  await page.keyboard.type('bolso', { delay: 40 });
  await page.waitForTimeout(500);
  f = await filasPintadas();
  ok(f.length > 0 && f.every(r => MARRO_RE.test(r.nombre) && /bolso/i.test(r.codigo + ' ' + r.nombre)), 'buscador "bolso" + Solo marroquinería: ' + f.length + ' filas, todas coherentes');
  c = await contador();
  ok(c && c.x === f.length && (await page.evaluate(() => document.getElementById('ordenCount').textContent)).indexOf('m³') > 0, 'contador con cubicaje de lo filtrado sigue vivo (v5_83)');

  // ── ENVÍO MASIVO: lo filtrado ("correa" + Solo marroquinería, incluye la ref
  //    real CON unid/caja del macro) → pedido NUEVO ──
  await page.fill('#searchInput', '');
  await page.keyboard.type('correa', { delay: 30 });
  await page.waitForTimeout(500);
  f = await filasPintadas();
  const nEnviar = f.length;
  const codigosEnviados = f.map(r => r.codigo);
  const undsSug = await page.evaluate(() => {
    const re = /(BOLSO|BILLETERA|RIÑONERA|RINONERA|MORRAL|MONEDERO|COSMETIQUERA|CARTUCHERA|CORREA|LONCHERA)/i;
    return window.STATE.ordenar
      .filter(r => re.test(r.nombre || '') && /correa/i.test((r.codigo || '') + ' ' + (r.nombre || '')))
      .reduce((s, r) => s + (r.unidPedir > 0 ? r.unidPedir : 0), 0);
  });
  ok(nEnviar > 0 && undsSug > 0, 'filtro "correa" + Solo marroquinería: ' + nEnviar + ' refs (' + undsSug + ' unds sugeridas reales del macro) para el envío masivo');

  const seVe = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);
  await page.click('#pcMandarFiltradoBtn');
  await page.waitForTimeout(300);
  ok(await seVe('#pcElegirOverlay'), 'el picker de pedido se VE al hacer clic en 🏭');
  const resumen = await page.evaluate(() => (document.getElementById('pcElegirOverlay') || {}).textContent || '');
  ok(resumen.indexOf(nEnviar + ' referencias') >= 0, 'el picker muestra el resumen del lote (' + nEnviar + ' referencias, unds, m³)');

  // Crear pedido nuevo con la ventana propia de TORI (toriPrompt — no prompt())
  await page.click('#pcElegirOverlay button:has-text("Crear pedido nuevo")');
  await page.waitForSelector('#toriPromptInp', { timeout: 5000 });
  ok(true, 'toriPrompt se abre para el nombre (cero prompt() nativo en modo .exe)');
  await page.fill('#toriPromptInp', 'pedido browser v5_89');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#toriConfirmOverlay', { timeout: 5000 });
  const confTxt = await page.evaluate(() => document.getElementById('toriConfirmOverlay').textContent);
  ok(confTxt.indexOf('Mandar ' + nEnviar) >= 0 && dialogos.length === 0, 'confirmación con toriConfirm (CERO diálogos nativos): "' + confTxt.slice(0, 60) + '…"');
  await page.click('#toriConfirmOkBtn');
  await page.waitForTimeout(800);

  const doc = await page.evaluate(() => (TORI.prodChina || []).find(d => d && d.fileName === 'pedido browser v5_89'));
  ok(!!doc && doc.nRefs === nEnviar, 'el pedido nuevo quedó con las ' + nEnviar + ' refs del filtro (nRefs=' + (doc && doc.nRefs) + ')');
  ok(!!doc && (doc.rows || []).length === nEnviar, 'con filas completas para el Excel FOTOS');
  ok(!!doc && doc.nUnids === undsSug, 'las unidades sugeridas del Motor viajaron al pedido (' + (doc && doc.nUnids) + ' = ' + undsSug + ')');

  // Las refs SALIERON de la Orden Sugerida (recalculo real del Motor)
  await page.waitForTimeout(800);
  const despues = await page.evaluate(() => window.STATE.ordenar.length);
  ok(despues === nOrden - nEnviar, 'salieron de la Orden Sugerida: ' + nOrden + ' → ' + despues);
  const enFabrica = await page.evaluate(cods => {
    const m = window.getProdChinaMap();
    return cods.every(cd => !!m.get(String(cd).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()));
  }, codigosEnviados);
  ok(enFabrica, 'las ' + nEnviar + ' refs están FABRICÁNDOSE (getProdChinaMap)');

  // La pestaña 🏭 muestra el pedido nuevo (visible de verdad)
  await page.click('.motor-tab-btn[data-tab="tabProdChina"]');
  await page.waitForTimeout(600);
  const cardVisible = await page.evaluate(() => {
    const root = document.getElementById('pcTabRoot');
    return !!(root && root.offsetParent !== null && root.textContent.indexOf('pedido browser v5_89') >= 0);
  });
  ok(cardVisible, 'la pestaña 🏭 Producción China muestra el pedido nuevo');

  // ── CERRAR Y REABRIR: la bóveda devuelve el pedido ──
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const doc2 = await page.evaluate(() => (TORI.prodChina || []).find(d => d && d.fileName === 'pedido browser v5_89'));
  ok(!!doc2 && doc2.nRefs === nEnviar, 'cerrar/reabrir: el pedido sigue en la bóveda con sus ' + nEnviar + ' refs');

  // ── Diagnóstico en CERO ──
  const diag = await page.evaluate(() => ({ errores: TORI.diagErrors || 0, log: (TORI.diagLog || []).filter(e => e.t !== 'manual').map(e => e.msg).slice(0, 3) }));
  ok(diag.errores === 0, 'panel de diagnóstico de TORI en 0' + (diag.errores ? ' — ' + JSON.stringify(diag.log) : ''));
  ok(erroresJs.length === 0, 'cero errores de página en Chromium' + (erroresJs.length ? ' — ' + erroresJs[0] : ''));

  await browser.close();
  srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos) + ' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ REVISIÓN EN NAVEGADOR REAL: las ' + pasos + ' verificaciones PASARON — se puede entregar');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
