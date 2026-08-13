/** Fases del Backup ⬇ a escala: construir snapshot / guardar en IDB / stringify / blob. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const HTML_PATH = process.argv[2];
const VENDOR = '/home/user/impraga-/desktop/vendor';
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';

(async () => {
  const html = fs.readFileSync(HTML_PATH, 'utf-8').split(CDN).join('<script src="/vendor/xlsx.full.min.js"></script>\n' + CDN);
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/vendor/')) { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(VENDOR, path.basename(req.url))).pipe(res); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
  });
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('dialog', async d => { await d.accept(); });
  await page.route('**cdnjs.cloudflare.com/**', r => r.abort());
  await page.goto('http://127.0.0.1:' + srv.address().port + '/tori.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  await page.setInputFiles('#fileMacro', '/home/user/impraga-/muestras/MACRO_INVENTARIO_03082026.xlsx');
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });

  await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 203; cv.height = 203;
    const ctx = cv.getContext('2d');
    const fotos = [];
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'hsl(' + (i * 45) + ',70%,60%)'; ctx.fillRect(0, 0, 203, 203); for (let j = 0; j < 30; j++) { ctx.fillStyle = 'hsl(' + ((i * 37 + j * 11) % 360) + ',60%,50%)'; ctx.fillRect((j * 23) % 180, (j * 41) % 180, 22, 22); } fotos.push(cv.toDataURL('image/jpeg', 0.5)); }
    for (let f = 0; f < 64; f++) { const rows = []; for (let i = 0; i < 100; i++) rows.push({ ARTICULO: 'SIM-' + f + '-' + i, DESCRIPCION: 'PRODUCTO ' + i, CTNS: 3, QTY_CTN: 120, CANTIDAD_TOTAL: 360, PRECIO: 5.5, TOTAL_CBM: 0.5, FOTO: fotos[(f + i) % 8], _fotoComp: true }); TORI.facturas.push({ name: 'SIM-' + f, rows, meta: {} }); }
    await new Promise((res, rej) => {
      const rq = indexedDB.open('PragaPI2', 1);
      rq.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('catalogo')) db.createObjectStore('catalogo', { keyPath: 'ref' }); if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); };
      rq.onsuccess = e => { const db = e.target.result; const tx = db.transaction('catalogo', 'readwrite'); const st = tx.objectStore('catalogo'); for (let i = 0; i < 6000; i++) st.put({ ref: 'PI2-' + i, desc: 'CAT ' + i, foto: fotos[i % 8], precio: 9900 }); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = rej; };
      rq.onerror = rej;
    });
  });
  await page.waitForTimeout(800);

  const fases = await page.evaluate(async () => {
    const out = {};
    let t = performance.now();
    const snap = await _buildSnapshotData();
    out.buildSnapshot = Math.round(performance.now() - t);
    t = performance.now();
    await _idbPut('praga_autosave_v1', 'ultimo', snap);
    out.idbPut = Math.round(performance.now() - t);
    t = performance.now();
    const j1 = JSON.stringify(snap);
    out.stringifyPlano = Math.round(performance.now() - t);
    out.mbPlano = Math.round(j1.length / 1048576);
    t = performance.now();
    const j2 = JSON.stringify(snap, null, 2);
    out.stringifyIndentado = Math.round(performance.now() - t);
    out.mbIndentado = Math.round(j2.length / 1048576);
    t = performance.now();
    const b = new Blob([j2], { type: 'application/json' });
    out.blob = Math.round(performance.now() - t);
    out.pi2Items = (snap.secciones.pi2.catalogo || []).length;
    return out;
  });
  console.log(JSON.stringify(fases));
  await browser.close();
  srv.close();
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
