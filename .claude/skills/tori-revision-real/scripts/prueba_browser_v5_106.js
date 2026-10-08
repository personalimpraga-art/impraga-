/**
 * prueba_browser_v5_106.js — GEMELOS CON "/" (regla de Andrés, 2026-10-08):
 * 225-96 y 225-96/Q168 son el MISMO producto. Lo de antes de la "/" es el producto;
 * códigos con 2+ barras no aplican. TODA la cadena debe reconocerlos como uno.
 * Macro REAL 07/10/2026 (4.212 refs, 117 con "/"). Clics y tecleo reales en Chromium.
 *   node prueba_browser_v5_106.js TORI.html MACRO.xlsx [--antes]
 */
'use strict';
const http = require('http'); const fs = require('fs'); const path = require('path');
const W = process.env.TORI_WORK || '/home/claude/work';
const { chromium } = require(W + '/node_modules/playwright-core');
const HTML_PATH = process.argv[2], MACRO = process.argv[3], ANTES = process.argv.includes('--antes');
const VENDOR = '/home/user/impraga-/desktop/vendor';
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';
let pasos = 0, fallos = 0;
const ok = (c, m) => { if (c) { pasos++; console.log('  ✔ ' + m); } else { fallos++; console.log('  ✘ FALLO: ' + m); } };
// La regla, implementada APARTE (independiente del código bajo prueba)
const base = c => { const s = String(c == null ? '' : c).trim(); const p = s.split('/'); return p.length === 2 && p[0].trim() ? p[0].trim().toLowerCase() : s.toLowerCase(); };

(async () => {
  const html = fs.readFileSync(HTML_PATH,'utf-8').split(CDN).join('<script src="/vendor/xlsx.full.min.js"></script>\n'+CDN);
  const srv = http.createServer((req,res)=>{ if(req.url.startsWith('/vendor/')){ res.setHeader('Content-Type','application/javascript'); fs.createReadStream(path.join(VENDOR, path.basename(req.url))).pipe(res); return; } res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html); });
  await new Promise(r=>srv.listen(0,r));
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const erroresJs = []; page.on('pageerror', e=>erroresJs.push(String(e.message||e)));
  page.on('dialog', async d=>{ await d.accept(); });
  await page.route('**cdnjs.cloudflare.com/**', r=>r.abort());
  await page.addInitScript(()=>{ window.prompt = ()=>{ throw new Error('prompt() is not supported.'); }; });
  const URL0 = 'http://127.0.0.1:'+srv.address().port+'/tori.html';
  await page.goto(URL0, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>!!window.TORI, { timeout:20000 });
  await page.setInputFiles('#fileMacro', MACRO);
  await page.waitForFunction(()=>window.STATE&&window.STATE.ordenar&&window.STATE.ordenar.length>0, { timeout:90000 });

  // ── 1. EL MACRO: un producto = una fila ──
  const m = await page.evaluate(()=>({ crudo: TORI.macroRows.map(r=>String(r.codigo)), filas: STATE.rows.map(r=>String(r.codigo)), hub: TORI.classified.map(r=>String(r.codigo)) }));
  const prods = new Set(m.crudo.map(base)).size;
  const conBarra = m.crudo.filter(c=>c.indexOf('/')>=0).length;
  console.log('\n Macro real: '+m.crudo.length+' filas, '+conBarra+' con "/" → '+prods+' productos según la regla');
  ok(m.crudo.length === 4212 && conBarra === 117, 'el macro GUARDADO queda crudo, tal cual llegó (4.212 filas, 117 con "/") — el backup no pierde nada');
  ok(m.filas.length === prods, 'el Motor ve '+m.filas.length+' productos (esperado '+prods+': cada gemelo cuenta UNA vez)');
  ok(m.hub.length === prods, 'el Hub/Liquidador ve los mismos '+m.hub.length+' productos');
  const variantesSueltas = m.filas.filter(c=>c.split('/').length === 2);
  ok(variantesSueltas.length === 0, 'ningún código "base/variante" queda suelto en el Motor'+(variantesSueltas.length?' — '+variantesSueltas.slice(0,5).join(', '):''));

  // ── 2. TU EJEMPLO: 225-96 = 225-96/Q168 ──
  const r96 = await page.evaluate(()=>{ const rs = STATE.rows.filter(r=>/^225-96(\/|$)/i.test(String(r.codigo).trim()));
    const o = STATE.ordenar.filter(r=>/^225-96(\/|$)/i.test(String(r.codigo).trim()));
    return { n: rs.length, cod: rs[0] && rs[0].codigo, gem: rs[0] && rs[0].gemelos, salidas: rs[0] && rs[0].unidSalidas, enOrden: o.length, tier: o[0] && o[0].tier }; });
  ok(r96.n === 1 && r96.cod === '225-96' && JSON.stringify(r96.gem) === '["225-96/Q168"]', '225-96 y 225-96/Q168 son UNA sola referencia: '+r96.cod+' = '+JSON.stringify(r96.gem));
  ok(r96.salidas === 792, 'las ventas se SUMAN: 432 + 360 = '+r96.salidas+' unidades vendidas');
  ok(r96.enOrden === 1, '225-96 entra a la Orden Sugerida UNA sola vez (antes: 2) · Tier '+r96.tier);

  // ── 3. CERO pedidos dobles en toda la orden ──
  const dob = await page.evaluate(()=>{ const c = {}; STATE.ordenar.forEach(r=>{ const k = window.toriRefKey ? toriRefKey(r.codigo) : String(r.codigo).split('/')[0].toLowerCase(); c[k]=(c[k]||0)+1; });
    return Object.keys(c).filter(k=>c[k]>1); });
  ok(dob.length === 0, 'CERO productos pedidos dos veces en la Orden Sugerida (antes: 18)'+(dob.length?' — '+dob.slice(0,6).join(', '):''));

  // ── 4. Lo que tiene stock NO se pide (210-57, 229-136) ──
  const st = await page.evaluate(()=>['210-57','229-136'].map(c=>{ const r = STATE.classified.find(x=>String(x.codigo)===c);
    const enO = STATE.ordenar.filter(x=>String(x.codigo).split('/')[0].trim()===c).length; return { c, saldo: r && r.saldo, status: r && r.status, enO }; }));
  st.forEach(s=>ok(s.status === 'EN_STOCK' && s.enO === 0, s.c+': '+s.saldo+' en stock → '+s.status+', 0 pedidos de sus gemelos (antes se pedían)'));

  // ── 5. Lo que NO se une ──
  const sep = await page.evaluate(()=>({ pg24: STATE.rows.some(r=>r.codigo==='PG0024'), pg25: STATE.rows.some(r=>r.codigo==='PG0025'),
    sets: ['8814/8813/8811/301','PG0125/TF1806/TF1805','PG0127/TF701/TF702'].map(c=>STATE.rows.some(r=>String(r.codigo)===c)),
    pg127: STATE.rows.filter(r=>r.codigo==='PG0127').map(r=>r.gemelos) }));
  ok(sep.pg24 && sep.pg25, 'PG0024 y PG0025 siguen siendo productos DISTINTOS aunque compartan código de fábrica (YM88153)');
  ok(sep.sets.every(Boolean) && (!sep.pg127[0] || !sep.pg127[0].length), 'los 3 códigos de DOS barras (sets) NO se tocan — PG0127/TF701/TF702 no se pega a PG0127');

  // ── 6. 261-16/XY890 + 261-16/XY-890 (sin base en el macro) = un producto ──
  const x16 = await page.evaluate(()=>STATE.rows.filter(r=>String(r.codigo).split('/')[0].trim()==='261-16').map(r=>({c:r.codigo, g:r.gemelos, sal:r.unidSalidas})));
  ok(x16.length === 1 && x16[0].c === '261-16' && x16[0].g.length === 2 && x16[0].sal === 360, '261-16/XY890 y 261-16/XY-890 → un producto "261-16" (180+180 = '+(x16[0]&&x16[0].sal)+' vendidas)');

  // ── 7. TODA LA CADENA: un gemelo en otro eslabón bloquea al producto ──
  const cad = await page.evaluate(async ()=>{
    const foto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    // En camino: una factura con el código gemelo, marcada en camino
    TORI.facturas.push({ name: 'PRUEBA-GEMELOS', loaded: '2026-10-08', params: getParams(), rows: [
      { ARTICULO: 'PG0021/YL600C', CANTIDAD_TOTAL: 240, PRECIO: 3, TOTAL_CBM: 1, CTNS: 2, QTY_CTN: 120, FOTO: foto } ] });
    TORI.enCamino = ['PRUEBA-GEMELOS'];
    // San Benito: el gemelo de 225-96 y uno de 210-57 (que tiene stock)
    TORI.sanBenito = { items: { '225-96/q168': 50, '210-57/te-06': 20 } };
    // Fábrica: un pedido subido con el código gemelo
    TORI.prodChina = [{ id: 'tg1', fileName: 'PEDIDO GEMELOS', fecha: '2026-10-08', items: { '210-148/2206': 100 }, nRefs: 1, nUnids: 100 }];
    _ecInvalidate(); _sbInvalidate(); _pcInvalidate(); _fotoInvalidate();
    window.__motorBridge(TORI.macroRows, 'prueba');
    const st = c => { const r = STATE.classified.find(x=>String(x.codigo)===c); return r ? r.status : 'NO ESTÁ'; };
    const rep = (typeof computeRepetidosCadena === 'function') ? null : null;
    return { ec: st('PG0021'), sb: st('225-96'), pc: st('210-148'),
      enOrden: ['PG0021','225-96','210-148'].map(c=>STATE.ordenar.some(x=>String(x.codigo).split('/')[0].trim()===c)),
      foto: !!window.getFotoByCodigo('PG0021'), fotoVar: !!window.getFotoByCodigo('PG0021/YL600C') };
  });
  ok(cad.ec === 'EN_CAMINO', 'EN CAMINO: la factura trae "PG0021/YL600C" → el producto PG0021 queda EN_CAMINO (status '+cad.ec+')');
  ok(cad.sb === 'BODEGA_SB', 'SAN BENITO: la bodega tiene "225-96/Q168" → 225-96 queda BODEGA_SB (status '+cad.sb+')');
  ok(cad.pc === 'PROD_CHINA', 'FÁBRICA: un pedido con "210-148/2206" → 210-148 queda FABRICÁNDOSE (status '+cad.pc+')');
  ok(cad.enOrden.every(x=>!x), 'ninguno de los tres se vuelve a pedir — la orden los saca solos');
  ok(cad.foto && cad.fotoVar, 'la FOTO que llegó con el código gemelo sirve al producto (PG0021 ve la foto de PG0021/YL600C)');

  // Repetidos: 210-57 en STOCK + su gemelo en SAN BENITO = 2 eslabones
  await page.click('.nav-item[data-screen="motor"]');
  await page.click('.motor-tab-btn[data-tab="tabOrden"]');
  await page.waitForTimeout(500);
  const rep = await page.evaluate(()=>{ const l = STATE.repetidosCadena || [];
    const r = l.find(x=>String(x.codigo).split('/')[0].trim()==='210-57');
    const r96 = l.find(x=>String(x.codigo).split('/')[0].trim()==='225-96');
    return { n: l.length, r: r ? { cod: r.codigo, combo: r.combo, stock: r.stock, sb: r.sanBenito } : null, r96: r96 ? r96.combo : null }; });
  ok(rep.r && rep.r.combo === 'STOCK + SAN BENITO' && rep.r.stock === 150 && rep.r.sb === 20,
     'REPETIDOS (vista oficial): '+(rep.r ? rep.r.cod+' = '+rep.r.combo+' ('+rep.r.stock+' en stock + '+rep.r.sb+' de 210-57/TE-06 en bodega)' : 'NO lo detecta'));
  ok(rep.r96 === null, 'y 225-96 (0 en stock, su gemelo solo en bodega) NO es falso repetido');

  // ── 8. VETO de un gemelo veta al producto · quitarlo desde el producto lo libera ──
  const vt = await page.evaluate(()=>{
    const o = STATE.ordenar.find(r=>r.gemelos && r.gemelos.length && r.status==='ORDENAR');
    if (!o) return null;
    const cod = o.codigo, gem = o.gemelos[0];
    localStorage.setItem('praga_no_traer_v1', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('praga_no_traer_v1')||'{}'), { [gem.toLowerCase()]: { codigo: gem, motivo: 'Defectos (prueba)', fecha: '2026-10-08' } })));
    window.__motorBridge(TORI.macroRows, 'prueba');
    const s1 = STATE.classified.find(x=>x.codigo===cod).status;
    window.__ntQuitar(cod);
    const s2 = STATE.classified.find(x=>x.codigo===cod).status;
    const quedan = Object.keys(JSON.parse(localStorage.getItem('praga_no_traer_v1')||'{}')).filter(k=>k.split('/')[0]===cod.toLowerCase());
    return { cod, gem, s1, s2, quedan: quedan.length };
  });
  ok(vt && vt.s1 === 'NO_TRAER', 'VETO: vetar "'+(vt&&vt.gem)+'" veta al producto '+(vt&&vt.cod)+' (status '+(vt&&vt.s1)+')');
  ok(vt && vt.s2 === 'ORDENAR' && vt.quedan === 0, 'quitar el veto desde '+(vt&&vt.cod)+' borra también el del gemelo → vuelve a ORDENAR');

  // ── 9. DATOS CHINA guardados con el código gemelo ──
  const dc = await page.evaluate(()=>{
    const o = STATE.ordenar.find(r=>r.gemelos && r.gemelos.length);
    const db = JSON.parse(localStorage.getItem('praga_china_db_v1')||'{}');
    db[o.gemelos[0].toLowerCase()] = { codigo: o.gemelos[0], descripcionChina: '风扇', precioRMB: 12.5, proveedor: 'YUGIN', historial: [] };
    localStorage.setItem('praga_china_db_v1', JSON.stringify(db));
    window.__pragaApplyAll();
    const r = STATE.ordenar.find(x=>x.codigo===o.codigo);
    const db2 = JSON.parse(localStorage.getItem('praga_china_db_v1')||'{}');
    return { cod: o.codigo, prov: r && r.proveedorChina, rmb: r && r.precioRMB, cn: r && r.descripcionChina, claves: Object.keys(db2).filter(k=>k.split('/')[0]===o.codigo.toLowerCase()) };
  });
  ok(dc.prov === 'YUGIN' && dc.rmb === 12.5 && dc.cn === '风扇', 'DATOS CHINA guardados como gemelo llegan al producto '+dc.cod+': YUGIN · ¥12,5 · 风扇');
  ok(dc.claves.length === 1 && dc.claves[0].indexOf('/') > 0, 'la base Datos China NO se reescribe ni se migra (sigue con su clave original)');

  // ── 10. BUSCADOR: teclear el código de fábrica encuentra el producto ──
  await page.click('.motor-tab-btn[data-tab="tabOrden"]');
  await page.evaluate(()=>{ STATE.ordenView = 'ORDEN'; if (typeof window.__ordenSetMarro==='function') window.__ordenSetMarro('TODO'); });
  await page.waitForTimeout(400);
  const gemEj = await page.evaluate(()=>{ const o = STATE.ordenar.find(r=>r.status==='ORDENAR' && r.gemelos && r.gemelos.length); return o ? { cod: o.codigo, suf: o.gemelos[0].split('/')[1] } : null; });
  await page.fill('#searchInput', '');
  await page.type('#searchInput', gemEj.suf, { delay: 40 });
  await page.waitForTimeout(600);
  const busq = await page.evaluate(()=>Array.prototype.map.call(document.querySelectorAll('#ordenTableBody tr'), tr=>tr.innerText.replace(/\s+/g,' ')).slice(0,5));
  ok(busq.some(t=>t.indexOf(gemEj.cod) >= 0), 'teclear "'+gemEj.suf+'" (código de fábrica) en el buscador encuentra '+gemEj.cod);
  const marca = await page.evaluate(cod=>{ const td = Array.prototype.find.call(document.querySelectorAll('#ordenTableBody td.mono'), t=>t.innerText.indexOf(cod)===0);
    const d = td && td.querySelector('div'); if (!d) return null; const r = d.getBoundingClientRect(); return { txt: d.innerText, vis: r.width>0 && r.height>0 }; }, gemEj.cod);
  ok(marca && marca.vis && marca.txt.indexOf('/') > 0, 'la fila muestra VISIBLE el gemelo que lleva adentro: "'+(marca&&marca.txt)+'"');

  // ── 11. CERRAR Y REABRIR: la unión se mantiene (sale de la bóveda) ──
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>window.STATE&&window.STATE.rows&&window.STATE.rows.length>0, { timeout:90000 });
  await page.waitForTimeout(1200);
  const re = await page.evaluate(()=>({ filas: STATE.rows.length, crudo: (TORI.macroRows||[]).length, r96: STATE.rows.filter(r=>/^225-96(\/|$)/i.test(String(r.codigo))).length,
    hub: (TORI.classified||[]).length }));
  ok(re.crudo === 4212 && re.filas === prods && re.hub === prods && re.r96 === 1, 'al cerrar y reabrir TORI: bóveda con el macro crudo (4.212) y el Motor/Hub otra vez con '+prods+' productos, 225-96 una vez');

  // ── 12. Diagnóstico ──
  const diag = await page.evaluate(()=>({ e: TORI.diagErrors||0, log:(TORI.diagLog||[]).filter(x=>x.t!=='manual').map(x=>x.msg).slice(0,3) }));
  ok(diag.e === 0, 'panel de diagnóstico de TORI en 0'+(diag.e?' — '+JSON.stringify(diag.log):''));
  ok(erroresJs.length === 0, 'cero errores de página en Chromium (modo .exe: prompt() revienta)'+(erroresJs.length?' — '+erroresJs[0]:''));

  await browser.close(); srv.close();
  console.log('');
  if (fallos) { console.log('✘ '+fallos+' FALLOS de '+(pasos+fallos)+(ANTES ? ' (versión ANTERIOR: se esperaba que fallara)' : ' — NO SE ENTREGA')); process.exit(ANTES ? 0 : 1); }
  console.log('★ GEMELOS CON "/" EN TODA LA CADENA: las '+pasos+' verificaciones PASARON');
})().catch(e=>{ console.error('✘ ERROR FATAL:', e.message || e); process.exit(1); });
