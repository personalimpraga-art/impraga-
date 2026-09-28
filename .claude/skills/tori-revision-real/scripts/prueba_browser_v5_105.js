/**
 * prueba_browser_v5_105.js — "⬇ CSV Completo" no puede llevar fotos (es texto plano);
 * el botón 📗 Excel Completo (FOTOS) entrega lo mismo en .xlsx CON la foto en la fila.
 * Factura REAL de muestras/ (PRAGA145, con fotos). El .xlsx se RELEE con ExcelJS.
 */
'use strict';
const http = require('http'); const fs = require('fs'); const path = require('path');
const W = '/home/claude/work';
const { chromium } = require(W + '/node_modules/playwright-core');
const ExcelJS = require(W + '/node_modules/exceljs');
const XLSX = require(W + '/node_modules/xlsx');
const HTML_PATH = process.argv[2];
const VENDOR = '/home/user/impraga-/desktop/vendor';
const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';
const FACTURA = '/home/user/impraga-/muestras/FACTURA_20260715_PRAGA145.xlsx';
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
  const erroresJs = []; page.on('pageerror', e=>erroresJs.push(String(e.message||e)));
  page.on('dialog', async d=>{ await d.accept(); });
  await page.route('**cdnjs.cloudflare.com/**', r=>r.abort());   // CDN BLOQUEADO como el .exe
  await page.addInitScript(()=>{ window.prompt = ()=>{ throw new Error('prompt() is not supported.'); }; });
  await page.goto('http://127.0.0.1:'+srv.address().port+'/tori.html', { waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>!!window.TORI, { timeout:20000 });

  // ExcelJS offline (el .exe lo trae en vendor/): el export NO puede depender de internet
  const vendorExcel = path.join(VENDOR,'exceljs.min.js');
  ok(fs.existsSync(vendorExcel), 'ExcelJS está en vendor/ — el .exe lo tiene offline');
  await page.addScriptTag({ content: fs.readFileSync(vendorExcel,'utf-8') });

  // ── Subir la FACTURA REAL al Liquidador ──
  await page.setInputFiles('#fileFacturas', FACTURA);
  await page.waitForFunction(()=>window.TORI.facturas && window.TORI.facturas.length>0, { timeout:60000 });
  const info = await page.evaluate(()=>({ name: TORI.facturas[0].name, n: TORI.facturas[0].rows.length }));
  ok(info.n > 0, 'factura REAL cargada: "'+info.name+'" con '+info.n+' artículos');

  // Fotos reales de la factura
  const nFotos = await page.evaluate(()=>TORI.facturas[0].rows.filter(r=>!!window.getFotoByCodigo(r.ARTICULO)).length);
  ok(nFotos > 0, nFotos+' de los '+info.n+' artículos tienen foto guardada en la bóveda');

  // Abrir la pantalla del Liquidador y la factura (como hace Andrés)
  await page.click('.nav-item[data-screen="liq"]');
  await page.waitForTimeout(800);
  await page.waitForSelector('#facXlsBtn', { timeout:30000 });

  // ── LO QUE PASA HOY: el CSV Completo NO lleva fotos (es texto plano) ──
  const [dlCsv] = await Promise.all([ page.waitForEvent('download',{timeout:60000}),
    page.click('button[onclick*="\'completo\'"]') ]);
  const csvPath = W + '/completo.csv'; await dlCsv.saveAs(csvPath);
  const csvTxt = fs.readFileSync(csvPath,'utf-8');
  ok(!/data:image|\x89PNG|\xff\xd8\xff/.test(csvTxt), 'confirmado: el CSV Completo no contiene ninguna imagen (es texto plano)');
  const csvCols = csvTxt.split('\n')[0].replace(/^﻿/,'').trim().split(';');
  ok(csvCols.length === 16, 'el CSV Completo tiene sus 16 columnas de siempre');

  // ── EL CAMBIO: Excel Completo con FOTOS, por clic real en el botón ──
  await page.waitForSelector('#facXlsBtn', { timeout:10000 });
  const btnVis = await page.evaluate(()=>{ const b=document.getElementById('facXlsBtn'); const r=b.getBoundingClientRect(); return r.width>0&&r.height>0; });
  ok(btnVis, 'el botón 📗 Excel Completo (FOTOS) está VISIBLE junto a los CSV');
  const t0 = Date.now();
  const [dlX] = await Promise.all([ page.waitForEvent('download',{timeout:180000}), page.click('#facXlsBtn') ]);
  const xlsPath = W + '/completo_fotos.xlsx'; await dlX.saveAs(xlsPath);
  const seg = ((Date.now()-t0)/1000).toFixed(1);
  ok(/_completo_CON_FOTOS\.xlsx$/.test(dlX.suggestedFilename()), 'se descarga "'+dlX.suggestedFilename()+'" en '+seg+'s ('+(fs.statSync(xlsPath).size/1048576).toFixed(1)+' MB)');
  const btnVuelve = await page.evaluate(()=>{ const b=document.getElementById('facXlsBtn'); return !b.disabled && b.textContent.indexOf('Excel Completo')>=0; });
  ok(btnVuelve, 'el botón vuelve a su texto normal al terminar (no queda en ⏳)');

  // ══ RELEER EL ARCHIVO GENERADO (nunca declarar probado sin releerlo) ══
  const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.readFile(xlsPath);
  const ws2 = wb2.getWorksheet('Completo con fotos');
  ok(!!ws2, 'el Excel abre y trae la hoja "Completo con fotos"');

  const hdrLeidos = ws2.getRow(1).values.slice(1).map(v=>String(v));
  ok(hdrLeidos[0] === 'FOTO', 'la 1ª columna del Excel es FOTO');
  const faltan = csvCols.filter(c=>hdrLeidos.indexOf(c) < 0);
  ok(faltan.length === 0, 'el Excel trae las MISMAS 16 columnas del CSV Completo, con el mismo nombre'+(faltan.length?' — faltan '+JSON.stringify(faltan):''));
  ok(ws2.rowCount === info.n + 1, 'una fila por artículo: '+(ws2.rowCount-1)+' filas + encabezado (la factura tiene '+info.n+')');

  // ¡LAS FOTOS!
  const imgs = ws2.getImages();
  ok(imgs.length === nFotos, 'FOTOS INCRUSTADAS en el archivo: '+imgs.length+' (los '+nFotos+' artículos que tienen foto)');
  ok(imgs.every(im=>im.range.tl.nativeCol === 0), 'todas las fotos están en la columna FOTO, ninguna corrida');
  const filasImg = imgs.map(im=>im.range.tl.nativeRow).sort((a,b)=>a-b);
  ok(new Set(filasImg).size === imgs.length, 'una foto por fila, ninguna encima de otra');
  const media = wb2.model.media || [];
  ok(media.length > 0 && media.every(m=>m.buffer && m.buffer.length > 100), 'las '+media.length+' imágenes llevan datos reales dentro del archivo (no celdas vacías)');

  // Los NÚMEROS: comparar el Excel contra el CSV fila por fila (misma verdad)
  const csvFilas = csvTxt.replace(/^﻿/,'').trim().split('\n').slice(1).map(l=>l.split(';'));
  let malos = 0, ejemplo = '';
  for (let i = 0; i < csvFilas.length; i++) {
    const cs = csvFilas[i], xr = ws2.getRow(i+2);
    const art = String(xr.getCell(3).value||'').trim();
    const pvpX = Number(xr.getCell(15).value), pvpC = Number(cs[13]);
    const cantX = Number(xr.getCell(7).value), cantC = Number(cs[5]);
    if (art !== cs[1].trim() || pvpX !== pvpC || cantX !== cantC) { malos++; if(!ejemplo) ejemplo = art+' pvp '+pvpX+'≠'+pvpC; }
  }
  ok(malos === 0, 'los '+csvFilas.length+' artículos traen EXACTAMENTE los mismos números que el CSV (artículo, cantidad y PVP)'+(malos?' — '+ejemplo:''));

  // Muestra legible de lo que verá Andrés
  const r2 = ws2.getRow(2);
  console.log('    → fila 2: '+r2.getCell(3).value+' · '+String(r2.getCell(4).value).slice(0,28)+' · PVP '+r2.getCell(15).value+' ('+r2.getCell(15).numFmt+')');
  ok(r2.getCell(15).numFmt === '$#,##0' && r2.getCell(8).numFmt === '¥#,##0.00', 'el PVP sale en pesos ($) y el precio China en yuanes (¥)');
  ok(ws2.getRow(2).height === 76 && ws2.getColumn(1).width === 14, 'la fila mide 76 y la columna FOTO 14 — la foto se VE (invariante 10)');
  ok(ws2.views && ws2.views[0] && ws2.views[0].state === 'frozen', 'títulos y referencia congelados: al bajar no se pierde de vista qué columna es cuál');

  // ── Que el archivo nuevo SE PUEDA VOLVER A SUBIR (PI2 y Motor leen por nombre) ──
  const reLeido = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(xlsPath),{type:'buffer'}).Sheets['Completo con fotos'], {header:1, defval:''});
  const H = reLeido[0].map(x=>String(x).toUpperCase().trim());
  const ci = n => H.findIndex(x=>x.includes(n));
  ok(ci('ARTICULO')>=0 && ci('PVP')>=0, 'el parser de PI2 reconoce el archivo (encuentra ARTICULO y PVP)');
  ok(ci('QTY/CTN')>=0 && ci('CTNS')>=0 && ci('TOTAL CBM')>=0, 'y encuentra QTY/CTN, CTNS y TOTAL CBM — se puede volver a subir como el CSV');
  const filaDato = reLeido[1];
  ok(String(filaDato[ci('ARTICULO')]).trim().length>0 && Number(filaDato[ci('PVP')])>0, 'al releerlo con el lector de TORI, la 1ª fila trae referencia y PVP válidos');

  // ── El CSV Completo quedó INTACTO (v5.103 no se tocó) ──
  ok(!/\n\s*\n/.test(csvTxt) && csvFilas.every(f=>f.length===16), 'el CSV Completo sigue igual: 1 fila por producto, 16 columnas (arreglo de v5.103 intacto)');

  // ── Diagnóstico ──
  const diag = await page.evaluate(()=>({ e: TORI.diagErrors||0, log:(TORI.diagLog||[]).filter(x=>x.t!=='manual').map(x=>x.msg).slice(0,3) }));
  ok(diag.e === 0, 'panel de diagnóstico de TORI en 0'+(diag.e?' — '+JSON.stringify(diag.log):''));
  ok(erroresJs.length === 0, 'cero errores de página en Chromium'+(erroresJs.length?' — '+erroresJs[0]:''));

  await browser.close(); srv.close();
  console.log('');
  if (fallos) { console.log('✘ '+fallos+' FALLOS de '+(pasos+fallos)+' — NO SE ENTREGA'); process.exit(1); }
  console.log('★ EXCEL COMPLETO CON FOTOS: las '+pasos+' verificaciones PASARON');
})().catch(e=>{ console.error('✘ ERROR FATAL:', e); process.exit(1); });
