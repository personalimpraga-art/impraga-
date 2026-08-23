/**
 * prueba_browser_v5_104.js — Guía de Viaje China: buscar por PROVEEDOR.
 * Macro REAL de muestras/ + pedido de Producción China con proveedor propio
 * (para probar la cascada). Clics y tecleo de usuario sobre la guía DESCARGADA.
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
  // MODO .exe: prompt() nativo REVIENTA (lección v5_79)
  await page.addInitScript(()=>{ window.prompt = ()=>{ throw new Error('prompt() is not supported.'); }; });
  await page.goto('http://127.0.0.1:'+srv.address().port+'/tori.html', { waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>!!window.TORI, { timeout:20000 });
  await page.setInputFiles('#fileMacro', MACRO);
  await page.waitForFunction(()=>window.STATE&&window.STATE.ordenar&&window.STATE.ordenar.length>0, { timeout:60000 });
  ok(true, 'TORI arrancó como el .exe con el macro REAL ('+await page.evaluate(()=>window.STATE.ordenar.length)+' refs en Orden Sugerida)');

  // Datos China parcial (como en producción) + un PEDIDO de Producción China cuyo
  // proveedor NO está en Datos China → prueba la cascada de v5.104.
  const sem = await page.evaluate(()=>{
    const norm = s=>String(s||'').trim().toLowerCase();
    const uniq = Array.from(new Set((window.STATE.classified||[]).map(r=>r.codigo).filter(Boolean)));
    const db = {}; const provs = ['YUGIN','YUFUN','1-G1-11855','GUANGZHOU LI'];
    uniq.slice(0,300).forEach((c,i)=>{ db[norm(c)] = { codigo:c, descripcionChina:'手袋'+i, precioRMB:5+i%20, proveedor:provs[i%4], historial:[] }; });
    localStorage.setItem('praga_china_db_v1', JSON.stringify(db));
    window.STATE.chinaDB = db;
    // refs que NO están en Datos China, pero SÍ en un pedido con proveedor propio
    const soloPedido = uniq.slice(500, 512);
    window.TORI.prodChina = [{ id:'p1', fileName:'PEDIDO YUGIN 147', items:{},
      rows: soloPedido.map(c=>({ ref:c, desc:'X', proveedor:'FABRICA SHENZHEN', unidades:10 })) }];
    return { conProv:Object.keys(db).length, soloPedido, total:uniq.length };
  });
  ok(true, 'Sembrado: '+sem.conProv+' refs con proveedor en Datos China + 12 refs SOLO en un pedido (FABRICA SHENZHEN)');

  const [dl] = await Promise.all([ page.waitForEvent('download',{timeout:120000}), page.evaluate(()=>window.exportChinaTrip()) ]);
  const out = '/tmp/guia104.html';
  await dl.saveAs(out);
  ok(/^PRAGA_VIAJE_CHINA_/.test(dl.suggestedFilename()), 'la guía se descarga: '+dl.suggestedFilename());

  // ── Abrir la guía como Andrés y usarla de verdad ──
  const g = await ctx.newPage();
  const errG = []; g.on('pageerror', e=>errG.push(String(e.message||e)));
  await g.goto('file://'+out, { waitUntil:'domcontentloaded' });
  await g.waitForFunction(()=>document.querySelectorAll('.card').length>0, { timeout:60000 });
  const tot = await g.evaluate(()=>ITEMS.length);

  // 1) CASCADA: las 12 refs que solo están en el pedido llegan con su proveedor
  const nCascada = await g.evaluate(cods=>ITEMS.filter(it=>cods.indexOf(it.c)>=0 && it.prov==='FABRICA SHENZHEN').length, sem.soloPedido);
  ok(nCascada === 12, 'CASCADA: las 12 refs sin Datos China llegan con el proveedor del pedido ('+nCascada+'/12)');

  // 2) BUSCADOR por proveedor — el reporte de Andrés
  await g.click('#q'); await g.type('#q','yugin',{delay:40});
  await g.waitForTimeout(400);
  const nY = await g.evaluate(()=>document.querySelectorAll('#grid .card').length);
  const esperadoY = await g.evaluate(()=>ITEMS.filter(it=>(it.prov||'').toLowerCase().indexOf('yugin')>=0).length);
  ok(nY > 0 && nY === esperadoY, 'teclear "yugin" en 🔍 muestra las '+nY+' refs de ese proveedor (antes: 0)');

  // el contador lo dice
  const cnt = await g.textContent('#count');
  ok(/Mostrando/.test(cnt) && cnt.indexOf(nY.toLocaleString('es-CO'))>=0, 'el contador dice "'+cnt+'"');

  // 3) Distingue YUGIN de YUFUN (no los mezcla)
  await g.fill('#q',''); await g.type('#q','yufun',{delay:40}); await g.waitForTimeout(350);
  const nF = await g.evaluate(()=>document.querySelectorAll('#grid .card').length);
  const soloYufun = await g.evaluate(()=>Array.prototype.every.call(document.querySelectorAll('#grid .provchip'), ch=>ch.getAttribute('data-p')==='YUFUN'));
  ok(nF > 0 && soloYufun, 'buscar "yufun" trae solo YUFUN ('+nF+' refs) — no lo mezcla con YUGIN');

  // 4) El buscador SIGUE funcionando por referencia y por nombre (no se rompió nada)
  const unCod = await g.evaluate(()=>ITEMS[0].c);
  await g.fill('#q',''); await g.type('#q',unCod,{delay:30}); await g.waitForTimeout(350);
  ok(await g.evaluate(()=>document.querySelectorAll('#grid .card').length) >= 1, 'buscar por referencia "'+unCod+'" sigue funcionando');
  await g.fill('#q',''); await g.type('#q','bolso',{delay:30}); await g.waitForTimeout(350);
  const nB = await g.evaluate(()=>document.querySelectorAll('#grid .card').length);
  ok(nB > 0, 'buscar por nombre "bolso" sigue funcionando ('+nB+' refs)');

  // 5) CHIP CLICABLE: tocar el proveedor de una tarjeta filtra por él
  await g.fill('#q',''); await g.waitForTimeout(400);
  const chipProv = await g.evaluate(()=>{ const c = document.querySelector('#grid .provchip'); return c ? c.getAttribute('data-p') : null; });
  ok(!!chipProv, 'el proveedor sale como chip morado tocable en la tarjeta ('+chipProv+')');
  const visible = await g.evaluate(()=>{ const c=document.querySelector('#grid .provchip'); const r=c.getBoundingClientRect(); return r.width>0 && r.height>0; });
  ok(visible, 'el chip es VISIBLE de verdad (no solo existe en el HTML)');
  await g.click('#grid .provchip');
  await g.waitForTimeout(400);
  const trasClic = await g.evaluate(()=>({ sel: document.getElementById('prov').value, n: document.querySelectorAll('#grid .card').length,
    todos: Array.prototype.every.call(document.querySelectorAll('#grid .provchip'), ch=>ch.getAttribute('data-p')===document.getElementById('prov').value) }));
  ok(trasClic.sel === chipProv && trasClic.todos, 'tocar el chip deja SOLO ese proveedor ('+trasClic.n+' refs) y el desplegable queda en '+trasClic.sel);

  // 6) DESPLEGABLE con conteo y los que más refs tienen primero
  const opts = await g.evaluate(()=>Array.prototype.map.call(document.querySelectorAll('#prov option'), o=>o.textContent));
  ok(/\(\d/.test(opts[1]), 'el desplegable trae el CONTEO por proveedor: '+JSON.stringify(opts.slice(1,4)));
  const nums = await g.evaluate(()=>Array.prototype.slice.call(document.querySelectorAll('#prov option')).slice(1)
    .filter(o=>o.value!=='SIN PROVEEDOR').map(o=>parseInt((o.textContent.match(/\(([\d.]+)\)/)||[0,'0'])[1].replace(/\./g,''),10)));
  ok(nums.every((v,i)=>i===0||nums[i-1]>=v), 'los proveedores con MÁS referencias salen primero: '+JSON.stringify(nums));
  const ultimo = opts[opts.length-1];
  ok(/SIN PROVEEDOR/.test(ultimo), '"SIN PROVEEDOR" queda de último, no estorbando: '+ultimo);

  // 7) El desplegable sigue filtrando (mecanismo viejo intacto)
  await g.selectOption('#prov','YUGIN'); await g.waitForTimeout(400);
  const soloY = await g.evaluate(()=>Array.prototype.every.call(document.querySelectorAll('#grid .provchip'), ch=>ch.getAttribute('data-p')==='YUGIN'));
  ok(soloY, 'el desplegable de proveedores sigue filtrando igual que antes');

  // 8) Combinar proveedor + chip de ganadores (los filtros conviven)
  await g.click('#chips .chip[data-f="GANADOR"]'); await g.waitForTimeout(400);
  const comb = await g.evaluate(()=>({ n: document.querySelectorAll('#grid .card').length,
    ok: Array.prototype.every.call(document.querySelectorAll('#grid .card'), c=>{ const ch=c.querySelector('.provchip'); return ch && ch.getAttribute('data-p')==='YUGIN' && c.className.indexOf('gan')>=0; }) }));
  ok(comb.ok, 'proveedor YUGIN + ⭐ Ganadores se combinan ('+comb.n+' refs, todas ganadoras de YUGIN)');

  // 9) Ordenar "Por proveedor" sigue vivo
  await g.click('#chips .chip[data-f="TODOS"]'); await g.selectOption('#prov','TODOS');
  await g.selectOption('#sort','prov'); await g.waitForTimeout(500);
  const ordenado = await g.evaluate(()=>{ const ps=Array.prototype.map.call(document.querySelectorAll('#grid .card'), c=>{ const ch=c.querySelector('.provchip'); return ch?ch.getAttribute('data-p'):'zzz'; }).slice(0,60);
    return ps.every((v,i)=>i===0||ps[i-1].localeCompare(v)<=0); });
  ok(ordenado, 'ordenar "Por proveedor" sigue agrupando bien');

  // 10) Sin conexión: la guía no pide NADA a internet
  ok(!fs.readFileSync(out,'utf-8').match(/src="https?:\/\//), 'la guía sigue funcionando sin internet (0 recursos externos)');

  // 11) Diagnóstico limpio
  const diag = await page.evaluate(()=>({ e: TORI.diagErrors||0, log:(TORI.diagLog||[]).filter(x=>x.t!=='manual').map(x=>x.msg).slice(0,3) }));
  ok(diag.e === 0, 'panel de diagnóstico de TORI en 0'+(diag.e?' — '+JSON.stringify(diag.log):''));
  ok(erroresJs.length === 0, 'cero errores de página en TORI'+(erroresJs.length?' — '+erroresJs[0]:''));
  ok(errG.length === 0, 'cero errores de página en la GUÍA descargada'+(errG.length?' — '+errG[0]:''));

  await browser.close(); srv.close();
  console.log('');
  if (fallos) { console.log('✘ '+fallos+' FALLOS de '+(pasos+fallos)+' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ REVISIÓN EN NAVEGADOR REAL: las '+pasos+' verificaciones PASARON');
})().catch(e=>{ console.error('✘ ERROR FATAL:', e); process.exit(1); });
