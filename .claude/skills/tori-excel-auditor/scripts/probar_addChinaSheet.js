/**
 * probar_addChinaSheet.js — Prueba REAL del export del Distribuidor (bloque 4)
 * y a la vez PLANTILLA del patrón de realms para auditar cualquier export de TORI:
 *
 *   1. EXTRAER la función y sus constantes del bloque (extraer_funcion.py).
 *   2. Evaluarla en el REALM HOST (eval), nunca en vm — ExcelJS falla cross-realm.
 *   3. Mockear solo sus dependencias externas (fotoOf, window._fotoThumbForExport).
 *   4. Generar con ExcelJS REAL → escribir a /tmp → RELEER → verificar:
 *      encabezados ES y CN por posición, valores de filas, imágenes, alto 76 (v5.101).
 *
 * Uso:  node probar_addChinaSheet.js [dir_bloques]     (default /tmp/tori_bloques)
 */
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const ExcelJS = require(process.env.TORI_LIB || '/home/claude/lib/node_modules/exceljs');

// JPEG 1x1 válido — para pruebas de embebido no importa el contenido visual
const JPEG_MIN = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';

async function main() {
  const dirBloques = process.argv[2] || '/tmp/tori_bloques';
  const aqui = __dirname;
  let ok = true;
  const check = (c, msg) => { console.log((c ? '✔ ' : '✘ ') + msg); ok = ok && !!c; };

  // 1. Extraer del bloque REAL (si el código cambió, esto trae la versión vigente)
  const codigo = execSync(
    `python3 ${path.join(aqui, 'extraer_funcion.py')} ${path.join(dirBloques, 'bloque_4.js')} ` +
    `CHINA_COLS CHINA_HES CHINA_HCN addChinaSheet`, { encoding: 'utf-8' });

  // 2+3. Evaluar en el realm host con mocks mínimos
  const fotos = { 'PG0001': 'data:image/jpeg;base64,' + JPEG_MIN }; // solo esta ref tiene foto
  const fotoOf = (ref) => fotos[ref] || null;
  const window = { _fotoThumbForExport: async (foto) => foto.split(',')[1] }; // passthrough base64
  // eval devuelve el valor de la última expresión — así sacamos la función
  // aunque el modo estricto le dé al eval su propio ámbito.
  const addChinaSheet = eval(codigo + '\naddChinaSheet;');

  // 4. Generar con datos de negocio realistas
  const prods = [
    { ref: 'PG0001', desc: 'CORTINA DE BAÑO PREMIUM', descCn: '浴帘', unidCaja: 20, cajas: 5, unidades: 100,
      cubCaja: 0.081, cubTotal: 0.405, precio: 12.5, valor: 1250.4, proveedor: 'YUGIN', tier: 'A', dias: 45, tipo: 'HOGAR' },
    { ref: '210-102', desc: 'BOLSO DAMA CUERO', descCn: '', unidCaja: 12, cajas: 1, unidades: 12,
      cubCaja: 0.12, cubTotal: 0.12, precio: 55, valor: 660, proveedor: '', isNew: true, tier: 'N', dias: '', tipo: 'BOLSOS' },
  ];
  const wb = new ExcelJS.Workbook();
  const conFoto = await addChinaSheet(wb, 'CONT 1', prods, 'CONTENEDOR 1', null);
  const salida = '/tmp/audit_addChinaSheet.xlsx';
  await wb.xlsx.writeFile(salida);

  // 5. RELEER y verificar (nunca confiar en lo escrito sin releerlo)
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(salida);
  const ws = wb2.getWorksheet('CONT 1');
  check(!!ws, 'la hoja "CONT 1" existe al releer');
  const fila = (r) => { const out = []; for (let c = 1; c <= 16; c++) out.push(ws.getRow(r).getCell(c).value); return out; };
  const CHINA_HES = eval(codigo + '\nCHINA_HES;');
  const CHINA_HCN = eval(codigo + '\nCHINA_HCN;');
  const h1 = fila(1), h2 = fila(2);
  const esOK = CHINA_HES.every((t, i) => h1[i] === t);
  const cnOK = CHINA_HCN.every((t, i) => h2[i] === t);
  check(esOK, 'encabezados ES: las 16 columnas coinciden celda a celda con CHINA_HES');
  check(cnOK, 'encabezados CN: las 16 columnas coinciden celda a celda con CHINA_HCN');
  check(/CJK|[\u4e00-\u9fff]/.test(h2.join('')), 'la fila 2 trae caracteres chinos de verdad');
  check(ws.getRow(1).getCell(2).font && ws.getRow(1).getCell(2).font.bold, 'encabezados en negrita');
  const f3 = fila(3);
  check(f3[1] === 'PG0001' && f3[2] === 'CORTINA DE BAÑO PREMIUM' && f3[3] === '浴帘', 'fila 3: ref, descripción y desc china correctas');
  check(f3[6] === 100 && f3[9] === 12.5 && f3[10] === 1250, 'fila 3: unidades 100, precio RMB 12.5, valor redondeado 1250');
  check(f3[11] === 'YUGIN' && f3[12] === 'CONTENEDOR 1' && f3[13] === 'A', 'fila 3: proveedor, contenedor y tier');
  const f4 = fila(4);
  check(f4[1] === '210-102' && f4[11] === 'NUEVO' && f4[13] === 'NUEVO', 'fila 4: mercancía nueva marcada NUEVO (proveedor y tier)');
  const imgs = ws.getImages();
  check(conFoto === 1 && imgs.length === 1, `exactamente 1 imagen embebida (conFoto=${conFoto}, ancladas=${imgs.length}) — la ref nueva NO lleva foto`);
  if (imgs.length) {
    const tl = imgs[0].range.tl;
    check((tl.nativeRow ?? tl.row) === 2 && (tl.nativeCol ?? tl.col) === 0, 'imagen anclada en col A de la fila 3 (anclaje EMU, invariante 10)');
  }
  // v5.101: foto nítida para el proveedor — 96px en celda (fila 76), resolución hasta 1200px
  check(ws.getRow(3).height === 76, 'alto de fila con foto = 76 (invariante 10, v5.101)');
  check(ws.getRow(4).height !== 76, 'la fila sin foto conserva alto normal');

  console.log(ok ? '\n★ AUDITORÍA addChinaSheet: PASÓ' : '\n★ AUDITORÍA addChinaSheet: FALLÓ');
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
