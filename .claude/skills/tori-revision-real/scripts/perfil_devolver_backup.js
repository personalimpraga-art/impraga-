/**
 * perfil_devolver_backup.js — reporte 2026-08-13 de Andrés: "↩ devolver una ref a la
 * Orden Sugerida tarda mucho, y el Backup ⬇ se queda cargando y nunca sale".
 *
 * Mide EN CHROMIUM, a la escala real de Andrés (macro real 3.643 refs + 64 facturas
 * con fotos + PI2 con 6.000 fotos + pedido 🏭 de 251 refs + respaldo a disco OPFS
 * enlazado): (1) el costo de cada ↩ devolver, (2) la duración del Backup ⬇ y el
 * congelamiento máximo del hilo de la interfaz (latido de 50ms) en ambos.
 *
 * Uso: node perfil_devolver_backup.js <HTML> [nDevolver=5]
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const HTML_PATH = process.argv[2] || 'TORI_Praga_v5_101.html';
const N_DEV = parseInt(process.argv[3] || '5', 10);
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
  const erroresJs = [];
  page.on('pageerror', e => erroresJs.push(String(e.message || e)));
  page.on('dialog', async d => { await d.accept(); });
  await page.route('**cdnjs.cloudflare.com/**', r => r.abort());
  await page.addInitScript(() => {
    window.prompt = () => { throw new Error('prompt() is not supported.'); };
    window.__puts = {};
    const _put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      const k = this.transaction.db.name + '.' + this.name;
      window.__puts[k] = (window.__puts[k] || 0) + 1;
      return _put.apply(this, arguments);
    };
    window.__long = 0;
    try { new PerformanceObserver(l => { l.getEntries().forEach(e => { window.__long += e.duration; }); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
    // espía de escrituras al archivo de disco (OPFS): inicio, duración y tamaño
    window.__fsaLog = [];
    const _cw = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function () {
      const t0 = performance.now();
      const w = await _cw.apply(this, arguments);
      let bytes = 0;
      const ow = w.write.bind(w);
      w.write = async (d) => { bytes += (d && d.size) || (d && d.length) || 0; return ow(d); };
      const oc = w.close.bind(w);
      w.close = async () => { const r = await oc(); window.__fsaLog.push({ t0: Math.round(t0), dur: Math.round(performance.now() - t0), mb: Math.round(bytes / 1048576) }); return r; };
      return w;
    };
    // respaldo a disco ENLAZADO (OPFS) como en el .exe
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

  // ── Sembrar la escala de Andrés ──
  const escala = await page.evaluate(async () => {
    // foto tipo factura real: 203px, jpeg q0.5 (~6KB)
    const cv = document.createElement('canvas'); cv.width = 203; cv.height = 203;
    const ctx = cv.getContext('2d');
    const fotos = [];
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'hsl(' + (i * 45) + ',70%,60%)'; ctx.fillRect(0, 0, 203, 203);
      for (let j = 0; j < 30; j++) { ctx.fillStyle = 'hsl(' + ((i * 37 + j * 11) % 360) + ',60%,' + (30 + (j % 50)) + '%)'; ctx.fillRect((j * 23) % 180, (j * 41) % 180, 22, 22); }
      fotos.push(cv.toDataURL('image/jpeg', 0.5));
    }
    // 64 facturas × 100 filas con foto
    let bytesFac = 0;
    for (let f = 0; f < 64; f++) {
      const rows = [];
      for (let i = 0; i < 100; i++) { const foto = fotos[(f + i) % 8]; bytesFac += foto.length; rows.push({ ARTICULO: 'SIM-' + f + '-' + i, DESCRIPCION: 'PRODUCTO ' + i, CTNS: 3, QTY_CTN: 120, CANTIDAD_TOTAL: 360, PRECIO: 5.5, TOTAL_CBM: 0.5, FOTO: foto, _fotoComp: true }); }
      TORI.facturas.push({ name: 'SIM-' + f, rows, meta: {} });
    }
    if (window._fotoInvalidate) _fotoInvalidate();
    // PI2: 6.000 refs con foto
    let bytesPI2 = 0;
    await new Promise((res, rej) => {
      const rq = indexedDB.open('PragaPI2', 1);
      rq.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('catalogo')) db.createObjectStore('catalogo', { keyPath: 'ref' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      rq.onsuccess = e => {
        const db = e.target.result;
        const tx = db.transaction('catalogo', 'readwrite');
        const st = tx.objectStore('catalogo');
        for (let i = 0; i < 6000; i++) { const foto = fotos[i % 8]; bytesPI2 += foto.length; st.put({ ref: 'PI2-' + i, desc: 'CAT ' + i, foto, precio: 9900 }); }
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = rej;
      };
      rq.onerror = rej;
    });
    // pedido 🏭 de 251 refs del macro real
    const refs = (window.STATE.classified || []).slice(0, 251);
    const rowsPed = refs.map(r => ({ ref: r.codigo, desc: r.nombre, descCn: '', unidCaja: 72, cajas: 5, unidades: 360, cubCaja: 0.1, cubTotal: 0.5, precio: 3.9, valor: 1404, proveedor: 'YUGIN', tier: r.tier || 'C', dias: r.diasRaw, tipo: r.categoria || '' }));
    const items = {}; rowsPed.forEach(r => { items[String(r.ref).trim().toLowerCase()] = r.unidades; });
    TORI.prodChina = TORI.prodChina || [];
    TORI.prodChina.push({ id: 'perfil-149', fileName: 'yugin #149 perfil', fecha: new Date().toISOString(), origen: 'MANUAL', items, nRefs: rowsPed.length, nUnids: 360 * rowsPed.length, rows: rowsPed });
    if (window._pcInvalidate) _pcInvalidate();
    if (typeof window.updateAfterLoad === 'function') updateAfterLoad();
    if (typeof window.__motorRefresh === 'function') __motorRefresh();
    await window._fsaInit();
    return { facturas: TORI.facturas.length, mbFotosFac: Math.round(bytesFac / 1048576), mbPI2: Math.round(bytesPI2 / 1048576), pedidoRefs: rowsPed.length };
  });
  console.log('Escala: ' + escala.facturas + ' facturas (' + escala.mbFotosFac + ' MB fotos) · PI2 6.000 refs (' + escala.mbPI2 + ' MB) · macro real · pedido de ' + escala.pedidoRefs + ' refs');
  await page.waitForTimeout(1200);
  console.log('Puts tras sembrar: ' + JSON.stringify(await page.evaluate(() => window.__puts)));
  await page.evaluate(() => { window.__puts = {}; });

  // Latido anti-congelamiento (50ms): registra el bloqueo máximo del hilo UI
  await page.evaluate(() => {
    window.__lat = { last: performance.now(), max: 0 };
    setInterval(() => { const n = performance.now(); const gap = n - window.__lat.last - 50; if (gap > window.__lat.max) window.__lat.max = gap; window.__lat.last = n; }, 50);
    window.toriConfirm = async () => true;   // sin diálogo para medir solo el trabajo
  });

  // Abrir la pestaña 🏭 y el detalle del pedido
  await page.click('.nav-item[data-screen="motor"]');
  await page.evaluate(() => { document.querySelectorAll('.motor-tab-btn').forEach(b => { if (b.getAttribute('data-tab') === 'tabProdChina') b.click(); }); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { if (typeof window.__pcTabVer === 'function') window.__pcTabVer('perfil-149'); });
  await page.waitForTimeout(800);

  // ── (1) ↩ devolver N refs, midiendo cada clic ──
  const tiempos = [];
  for (let i = 0; i < N_DEV; i++) {
    const t = await page.evaluate(async (idx) => {
      window.__lat.max = 0;
      const doc = (TORI.prodChina || []).find(d => d.id === 'perfil-149');
      const key = String(doc.rows[0].ref).trim().toLowerCase();
      const t0 = performance.now();
      await window.__pcQuitarRef('perfil-149', key);
      const dur = Math.round(performance.now() - t0);
      await new Promise(r => setTimeout(r, 120));
      return { dur, freeze: Math.round(window.__lat.max) };
    }, i);
    tiempos.push(t);
    await page.waitForTimeout(250);
  }
  const durs = tiempos.map(t => t.dur), frz = tiempos.map(t => t.freeze);
  console.log('↩ devolver (' + N_DEV + ' clics): ' + durs.join(' / ') + ' ms · congelamiento máx por clic: ' + frz.join(' / ') + ' ms');
  console.log('Puts durante las devoluciones: ' + JSON.stringify(await page.evaluate(() => window.__puts)));
  await page.waitForTimeout(1500);   // deja pasar el recálculo agrupado si lo hay

  // ── (2) Backup ⬇ de la barra: duración total + congelamiento ──
  // Control: ¿cuánto tarda descargar un blob de 75 MB SIN TORI de por medio?
  const tC = Date.now();
  const [dlC] = await Promise.all([
    page.waitForEvent('download', { timeout: 300000 }),
    page.evaluate(() => {
      const s = 'x'.repeat(75 * 1048576);
      const url = URL.createObjectURL(new Blob([s], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'control.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }),
  ]);
  await dlC.saveAs(path.join(__dirname, 'control.json'));
  fs.unlinkSync(path.join(__dirname, 'control.json'));
  console.log('Control blob 75 MB sin TORI: ' + ((Date.now() - tC) / 1000).toFixed(1) + 's');

  // Cronómetro de las fases REALES del backup (envolviendo las dependencias globales)
  await page.evaluate(() => {
    window.__fases = {};
    const _b = window._buildSnapshotData;
    window._buildSnapshotData = async function () { const t = performance.now(); const r = await _b.apply(this, arguments); window.__fases.buildSnapshot = Math.round(performance.now() - t); return r; };
    const _p = window._idbPut;
    window._idbPut = async function () { const t = performance.now(); const r = await _p.apply(this, arguments); window.__fases.idbPut = (window.__fases.idbPut || 0) + Math.round(performance.now() - t); return r; };
    const _s = JSON.stringify.bind(JSON);
    const _os = JSON.stringify;
    JSON.stringify = function (v, rep, sp) { const t = performance.now(); const r = _os.call(JSON, v, rep, sp); const d = Math.round(performance.now() - t); if (d > 100) window.__fases['stringify' + (sp ? 'Indent' : '')] = (window.__fases['stringify' + (sp ? 'Indent' : '')] || 0) + d; return r; };
    const _u = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (b) { const t = performance.now(); const r = _u(b); window.__fases.createObjectURL = Math.round(performance.now() - t); return r; };
  });
  await page.evaluate(() => { window.__lat.max = 0; window.__puts = {}; window.__long = 0; });
  const t0 = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 300000 }),
    page.evaluate(() => descargarAutosave()),
  ]);
  const bkPath = path.join(__dirname, 'perfil_backup.json');
  await download.saveAs(bkPath);
  const durBk = ((Date.now() - t0) / 1000).toFixed(1);
  const mbBk = (fs.statSync(bkPath).size / 1048576).toFixed(1);
  const frzBk = await page.evaluate(() => Math.round(window.__lat.max));
  const espias = await page.evaluate(() => ({ puts: window.__puts, longMs: Math.round(window.__long) }));
  console.log('Backup ⬇: ' + durBk + 's · archivo ' + mbBk + ' MB · congelamiento máx: ' + frzBk + ' ms');
  console.log('Durante el backup — puts IDB: ' + JSON.stringify(espias.puts) + ' · tareas largas: ' + espias.longMs + ' ms');
  console.log('Fases reales: ' + JSON.stringify(await page.evaluate(() => window.__fases)));
  console.log('Escrituras a disco (FSA/OPFS): ' + JSON.stringify(await page.evaluate(() => window.__fsaLog)));

  // Completitud del backup descargado (que el miedo de Andrés quede respondido con datos)
  const bk = JSON.parse(fs.readFileSync(bkPath, 'utf-8'));
  const ped = (bk.secciones.prodChina || []).find(d => d.id === 'perfil-149');
  const okPed = ped && ped.rows.length === escala.pedidoRefs - N_DEV;
  console.log('Completitud: pedido en el backup con ' + (ped ? ped.rows.length : '—') + ' refs (esperadas ' + (escala.pedidoRefs - N_DEV) + ') → ' + (okPed ? 'OK' : 'MAL') +
    ' · facturas: ' + bk.resumen.facturas + ' · macro: ' + bk.resumen.macro_refs + ' · PI2: ' + bk.resumen.prods_pi2_catalogo);
  const diag = await page.evaluate(() => TORI.diagErrors || 0);
  console.log('Diagnóstico: ' + diag + ' · errores página: ' + erroresJs.length + (erroresJs.length ? ' — ' + erroresJs[0] : ''));

  fs.unlinkSync(bkPath);
  await browser.close();
  srv.close();
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });
