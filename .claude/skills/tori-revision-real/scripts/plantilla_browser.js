/**
 * plantilla_browser.js — arnés de REVISIÓN EN NAVEGADOR REAL para TORI.
 * Sirve el HTML como lo sirve TORI.exe (vendor inyectado antes del tag CDN,
 * CDN bloqueado) y abre Chromium de verdad para hacer clics de usuario.
 *
 * Uso:  node plantilla_browser.js /ruta/TORI_Praga_v5_XX.html
 *
 * Reglas del ritual (skill tori-revision-real §2):
 *  - clics reales (page.click / keyboard.type) verificando el RESULTADO VISIBLE
 *  - al final: TORI.diagErrors === 0 y cero pageerror, o NO SE ENTREGA
 *  - correr también con prompt() lanzando el error de Electron
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/claude/lib/node_modules/playwright-core');

const HTML_PATH = process.argv[2];
if (!HTML_PATH) { console.error('Uso: node plantilla_browser.js /ruta/TORI_Praga_v5_XX.html'); process.exit(1); }
const VENDOR = path.join(__dirname, '..', '..', '..', '..', 'desktop', 'vendor');
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';

let pasos = 0, fallos = 0;
function ok(cond, msg) {
  if (cond) { pasos++; console.log('  ✔ ' + msg); }
  else { fallos++; console.log('  ✘ FALLO: ' + msg); }
}

async function arrancar() {
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
  await page.route('**cdnjs.cloudflare.com/**', r => r.abort());
  await page.goto('http://127.0.0.1:' + srv.address().port + '/tori.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  return { srv, browser, page, erroresJs };
}

// Revelar la interfaz del Motor sin subir macro (para pruebas):
//   await page.evaluate(() => { showScreen('motor');
//     document.getElementById('uploadScreen').style.display = 'none';
//     document.getElementById('appShell').classList.remove('hidden');
//     document.getElementById('motorTabsWrap').style.display = 'block'; });

async function cerrar({ srv, browser, page, erroresJs }) {
  const diag = await page.evaluate(() => ({
    errores: TORI.diagErrors || 0,
    log: (TORI.diagLog || []).filter(e => e.t !== 'manual').map(e => e.msg).slice(0, 3)
  }));
  ok(diag.errores === 0, 'panel de diagnóstico de TORI en 0' + (diag.errores ? ' — ' + JSON.stringify(diag.log) : ''));
  ok(erroresJs.length === 0, 'cero errores de página en Chromium' + (erroresJs.length ? ' — ' + erroresJs[0] : ''));
  await browser.close();
  srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos) + ' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ REVISIÓN EN NAVEGADOR REAL: las ' + pasos + ' verificaciones PASARON — se puede entregar');
  process.exit(0);
}

// ── EJEMPLO mínimo (reemplazar por los clics del cambio que se está entregando) ──
(async () => {
  const env = await arrancar();
  ok(await env.page.evaluate(() => typeof window.toriPrompt === 'function'), 'toriPrompt existe (nunca prompt() nativo)');
  // … aquí los page.click / keyboard.type del cambio nuevo, verificando lo VISIBLE …
  await cerrar(env);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
