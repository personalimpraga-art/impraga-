/**
 * prueba_browser_v5_107.js — Guía de Viaje China: Datos China de GEMELOS con "/"
 * se juntan CAMPO POR CAMPO (como "Datos para China"). Macro REAL de muestras/,
 * guía DESCARGADA y abierta como la usa Andrés.
 */
'use strict';
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('/home/claude/lib/node_modules/playwright-core');
const HTML_PATH = process.argv[2];
const VENDOR = '/home/user/impraga-/desktop/vendor';
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';
const MACRO = '/home/user/impraga-/muestras/MACRO_INVENTARIO_03082026.xlsx';
let pasos = 0, fallos = 0;
const ok = (c, m) => { if (c) { pasos++; console.log('  ✔ ' + m); } else { fallos++; console.log('  ✘ FALLO: ' + m); } };

(async () => {
  const html = fs.readFileSync(HTML_PATH,'utf-8').split(CDN).join('<script src="/vendor/xlsx.full.min.js"></script>\n'+CDN);
  const srv = http.createServer((req,res)=>{
    if(req.url.startsWith('/vendor/')){ res.setHeader('Content-Type','application/javascript');
      fs.createReadStream(path.join(VENDOR, path.basename(req.url))).pipe(res); return; }
    res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html);
  });
  await new Promise(r=>srv.listen(0,r));
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ acceptDownloads:true });
  const page = await ctx.newPage();
  const erroresJs = [];
  page.on('pageerror', e=>erroresJs.push(String(e.message||e)));
  page.on('dialog', async d=>{ await d.accept(); });
  await page.route('**cdnjs.cloudflare.com/**', r=>r.abort());
  await page.addInitScript(()=>{
    window.prompt = ()=>{ throw new Error('prompt() is not supported.'); };
    if (sessionStorage.getItem('seed107')) return; sessionStorage.setItem('seed107','1');
    const db = {}; const put = (c,o)=>{ db[c.toLowerCase()] = Object.assign({ codigo:c, historial:[] }, o); };
    put('210-57/TE-06', { descripcionChina:'包A', precioRMB:8.5, proveedor:'YUGIN' });   // todo en el gemelo
    put('225-97',       { descripcionChina:'包B' });                                     // repartido
    put('225-97/L2024', { precioRMB:3, proveedor:'YUFUN' });
    put('300-86',       { descripcionChina:'包C', precioRMB:7, proveedor:'BASE' });      // base completa manda
    put('300-86/SC-20', { descripcionChina:'包X', precioRMB:99, proveedor:'GEMELO' });
    put('S-2911/101-2', { precioRMB:2 });                                                // incompleto
    localStorage.setItem('praga_china_db_v1', JSON.stringify(db));
  });
  await page.goto('http://127.0.0.1:'+srv.address().port+'/tori.html', { waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>!!window.TORI, { timeout:20000 });
  await page.setInputFiles('#fileMacro', MACRO);
  await page.waitForFunction(()=>window.STATE&&window.STATE.ordenar&&window.STATE.ordenar.length>0, { timeout:60000 });
  ok(true, 'TORI arrancó como el .exe con el macro REAL');

  const [dl] = await Promise.all([ page.waitForEvent('download',{timeout:120000}), page.evaluate(()=>window.exportChinaTrip()) ]);
  const out = '/tmp/guia107.html'; await dl.saveAs(out);
  ok(/^PRAGA_VIAJE_CHINA_/.test(dl.suggestedFilename()), 'la guía se descarga: '+dl.suggestedFilename());

  const g = await ctx.newPage();
  const errG = []; g.on('pageerror', e=>errG.push(String(e.message||e)));
  await g.goto('file://'+out, { waitUntil:'domcontentloaded' });
  await g.waitForFunction(()=>document.querySelectorAll('.card').length>0, { timeout:60000 });
  const it = await g.evaluate(()=>{ const f=c=>ITEMS.find(x=>x.c===c)||null; const k={}; ITEMS.forEach(x=>{ const b=String(x.c).split('/')[0].toLowerCase(); if(String(x.c).split('/').length<=2) k[b]=(k[b]||0)+1; });
    return { a:f('210-57'), b:f('225-97'), c:f('300-86'), d:f('S-2911'), dup:Object.keys(k).filter(x=>k[x]>1).length, gem:ITEMS.filter(x=>/^225-97\//.test(x.c)).length }; });
  ok(it.dup === 0 && it.gem === 0, 'una sola tarjeta por producto (0 gemelos sueltos, 0 duplicados)');
  ok(it.a && it.a.cn==='包A' && it.a.rmb===8.5 && it.a.prov==='YUGIN', '210-57: datos guardados SOLO en 210-57/TE-06 llegan completos ('+JSON.stringify(it.a&&[it.a.cn,it.a.rmb,it.a.prov])+')');
  ok(it.b && it.b.cn==='包B' && it.b.rmb===3 && it.b.prov==='YUFUN', '225-97: REPARTIDO (desc en la base, precio+proveedor en el gemelo) → tarjeta completa ('+JSON.stringify(it.b&&[it.b.cn,it.b.rmb,it.b.prov])+')');
  ok(it.c && it.c.cn==='包C' && it.c.rmb===7 && it.c.prov==='BASE', '300-86: la base completa MANDA, el gemelo no la pisa ('+JSON.stringify(it.c&&[it.c.cn,it.c.rmb,it.c.prov])+')');
  ok(it.d && it.d.rmb===2 && !it.d.cn, 'S-2911: solo precio en el gemelo → precio ¥2, sin inventar descripción');

  // la tarjeta VISIBLE muestra el precio de 225-97 al buscarla
  await g.fill('#q', '225-97').catch(()=>{});
  await g.waitForTimeout(400);
  const txt = await g.evaluate(()=>{ const cs=[...document.querySelectorAll('.card')].filter(c=>c.offsetParent!==null && /225-97/.test(c.textContent)); return cs.length ? cs[0].innerText : ''; });
  ok(/包B/.test(txt) && /3/.test(txt) && /YUFUN/.test(txt), 'tarjeta visible de 225-97 muestra 包B · ¥3 · YUFUN');

  const diag = await page.evaluate(()=>({ errores: (window.TORI && TORI.diagErrors) || 0 }));
  ok(diag.errores === 0, 'panel de diagnóstico de TORI en 0');
  ok(erroresJs.length === 0 && errG.length === 0, 'cero errores de página (TORI y guía) '+erroresJs.concat(errG).join(' | '));
  await browser.close(); srv.close();
  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS — NO SE ENTREGA'); process.exit(1); }
  console.log('★ GUÍA DE VIAJE CON GEMELOS CAMPO POR CAMPO: las ' + pasos + ' verificaciones PASARON');
})();
