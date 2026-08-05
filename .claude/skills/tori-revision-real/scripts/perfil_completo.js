/**
 * perfil_completo.js — el flujo REAL de Andrés medido de punta a punta:
 * macro real + facturas con fotos a escala + respaldo a disco ENLAZADO de verdad,
 * mandando refs una por una con 🏭. Cuenta escrituras de disco, congelamientos
 * y el costo de cada "Aceptar".
 * Uso: node perfil_completo.js <html> <nFact> <filas> <nRefs>
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const HTML_PATH = process.argv[2] || 'TORI_Praga_v5_91.html';
const N_FACT = parseInt(process.argv[3] || '40', 10);
const N_ROWS = parseInt(process.argv[4] || '80', 10);
const N_REFS = parseInt(process.argv[5] || '6', 10);
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
  // el handle queda sembrado en IDB ANTES del boot (como en el .exe, que lo
  // restaura al arrancar con _fsaInit) — un handle OPFS sí es clonable a IDB
  await page.addInitScript(() => {
    window.__fsaEscrituras = [];
    window.showSaveFilePicker = window.showSaveFilePicker || (async () => { throw new Error('no picker'); });
    const orig = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function () {
      const t0 = performance.now();
      const w = await orig.apply(this, arguments);
      const oc = w.close.bind(w);
      w.close = async () => { const r = await oc(); window.__fsaEscrituras.push(Math.round(performance.now() - t0)); return r; };
      return w;
    };
    (async () => {
      const dir = await navigator.storage.getDirectory();
      const fh = await dir.getFileHandle('backup_perfil.json', { create: true });
      await new Promise((res, rej) => {
        const rq = indexedDB.open('praga_fsa_v1', 1);
        rq.onupgradeneeded = e => { try { e.target.result.createObjectStore('data'); } catch (x) {} };
        rq.onsuccess = e => { const db = e.target.result; const tx = db.transaction('data', 'readwrite'); tx.objectStore('data').put(fh, 'fileHandle'); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = rej; };
        rq.onerror = rej;
      });
    })();
  });
  await page.goto('http://127.0.0.1:' + srv.address().port + '/tori.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TORI, { timeout: 20000 });
  await page.setInputFiles('#fileMacro', '/home/user/impraga-/muestras/MACRO_INVENTARIO_03082026.xlsx');
  await page.waitForFunction(() => window.STATE && window.STATE.ordenar && window.STATE.ordenar.length > 0, { timeout: 45000 });

  const carga = await page.evaluate(async ({ nF, nR }) => {
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 480;
    const ctx = cv.getContext('2d');
    const fotos = [];
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'hsl(' + (i * 45) + ',70%,60%)'; ctx.fillRect(0, 0, 480, 480);
      for (let j = 0; j < 60; j++) { ctx.fillStyle = 'hsl(' + ((i * 37 + j * 11) % 360) + ',60%,' + (30 + (j % 50)) + '%)'; ctx.fillRect((j * 53) % 440, (j * 97) % 440, 40, 40); }
      fotos.push(cv.toDataURL('image/jpeg', 0.8));
    }
    let bytes = 0;
    for (let f = 0; f < nF; f++) {
      const rows = [];
      for (let i = 0; i < nR; i++) { const foto = fotos[(f + i) % 8]; bytes += foto.length; rows.push({ ARTICULO: 'SIM-' + f + '-' + i, DESCRIPCION: 'X', CTNS: 3, QTY_CTN: 120, CANTIDAD_TOTAL: 360, PRECIO: 5.5, TOTAL_CBM: 0.5, FOTO: foto }); }
      TORI.facturas.push({ name: 'SIM-' + f, rows, meta: {} });
    }
    if (window._fotoInvalidate) _fotoInvalidate();
    if (window._pcInvalidate) _pcInvalidate();
    await window._fsaInit();   // re-enlaza por si el sembrado del handle perdió la carrera del boot
    // pedido destino + contadores
    TORI.prodChina = TORI.prodChina || [];
    TORI.prodChina.push({ id: 'perfil', fileName: 'pedido perfil', origen: 'MANUAL', fecha: 'hoy', items: {}, nRefs: 0, nUnids: 0, rows: [] });
    window.__nMotor = 0;
    const om = window.__motorRefresh; window.__motorRefresh = function () { window.__nMotor++; return om.apply(this, arguments); };
    // traza: autosaves disparados y el timer de 10s del respaldo (agendado/reseteado/disparado)
    window.__log = [];
    const t00 = performance.now();
    const origTA = window.triggerAutosave;
    if (origTA) window.triggerAutosave = function (r) { window.__log.push('TA:' + r + '@' + Math.round((performance.now() - t00) / 100) / 10 + 's'); return origTA.apply(this, arguments); };
    const origST = window.setTimeout;
    window.setTimeout = function (fn, ms) {
      if (ms === 10000) {
        window.__log.push('fsa-agendada@' + Math.round((performance.now() - t00) / 100) / 10 + 's');
        const w = function () { window.__log.push('fsa-DISPARA@' + Math.round((performance.now() - t00) / 100) / 10 + 's'); return fn.apply(this, arguments); };
        return origST(w, ms);
      }
      return origST.apply(window, arguments);
    };
    window.__latidos = [];
    let last = performance.now();
    setInterval(() => { const t = performance.now(); if (t - last > 250) window.__latidos.push(Math.round(t - last)); last = t; }, 50);
    return { MB: Math.round(bytes / 1048576) };
  }, { nF: N_FACT, nR: N_ROWS });
  console.log('Escala:', carga.MB, 'MB de fotos ·', N_FACT, 'facturas');
  await page.waitForTimeout(4500);
  await page.evaluate(() => { window.__latidos.length = 0; window.__fsaEscrituras.length = 0; window.__nMotor = 0; });

  // ── mandar N refs una por una, con ~4s entre clics (como un usuario) ──
  const tTot0 = Date.now();
  for (let i = 0; i < N_REFS; i++) {
    const t0 = Date.now();
    await page.evaluate(async ({ i }) => {
      const ref = window.STATE.ordenar[i * 3].codigo;
      const p = window.__pcAddPick('perfil', ref, 120);
      await new Promise(r => setTimeout(r, 100));
      if (document.getElementById('toriPromptInp')) window.__toriPromptFin(true);
      await p;
    }, { i });
    console.log('  ref', i + 1, '→ Aceptar tardó', Date.now() - t0, 'ms');
    await page.waitForTimeout(parseInt(process.env.PAUSA||"4000",10));   // pausa de usuario
  }
  await page.waitForTimeout(parseInt(process.env.COLA||"8000",10));
  const res = await page.evaluate(() => ({ escrituras: window.__fsaEscrituras, congel: window.__latidos, motor: window.__nMotor }));
  console.log('\nTotal del flujo (' + N_REFS + ' refs):', Math.round((Date.now() - tTot0) / 1000), 's');
  console.log('Escrituras COMPLETAS del respaldo a disco:', res.escrituras.length, '→', res.escrituras.map(m => m + 'ms').join(', '));
  console.log('Recálculos completos del Motor:', res.motor);
  console.log('Congelamientos >250ms:', res.congel.length, '→', res.congel.join(' ms, ') + (res.congel.length ? ' ms' : ''));
  const mb = await page.evaluate(async () => {
    const dir = await navigator.storage.getDirectory();
    const fh = await dir.getFileHandle('backup_perfil.json');
    const f = await fh.getFile();
    return Math.round(f.size / 1048576);
  });
  console.log('Respaldo en disco al final:', mb, 'MB (debe estar COMPLETO)');
  const compl = await page.evaluate(async () => {
    const dir = await navigator.storage.getDirectory();
    const fh = await dir.getFileHandle('backup_perfil.json');
    const txt = await (await fh.getFile()).text();
    const j = JSON.parse(txt);
    const pc = (j.secciones && j.secciones.prodChina) || [];
    const doc = pc.find(d => d && d.fileName === 'pedido perfil');
    return { tipo: j.tipo, fotos: !!j.incluye_fotos, pedidoEnBackup: !!doc, refsEnBackup: doc ? doc.nRefs : 0, facturas: (j.secciones.liquidador.facturas || []).length };
  });
  console.log('Completitud del respaldo:', JSON.stringify(compl));
  console.log('Traza:', JSON.stringify(await page.evaluate(() => window.__log)));
  await browser.close(); srv.close(); process.exit(0);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
