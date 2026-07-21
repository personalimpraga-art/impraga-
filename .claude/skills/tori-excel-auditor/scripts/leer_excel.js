/**
 * leer_excel.js — AUDITOR: relee un Excel generado y reporta lo que un humano
 * verificaría a mano: hojas, encabezados por posición, primeras filas, fills
 * (fgColor.argb), imágenes por hoja y alturas de fila.
 *
 * Uso:  node leer_excel.js archivo.xlsx [filasAMostrar=5]
 *
 * Regla de la skill: NUNCA declarar un export como "probado" sin releerlo.
 * Este script es la relectura. Compara su salida contra lo esperado.
 */
'use strict';
const path = require('path');
const ExcelJS = require(process.env.TORI_LIB || '/home/claude/lib/node_modules/exceljs');

async function main() {
  const archivo = process.argv[2];
  if (!archivo) { console.error('Uso: node leer_excel.js archivo.xlsx [filas]'); process.exit(1); }
  const nFilas = parseInt(process.argv[3] || '5', 10);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(archivo);

  console.log(`ARCHIVO: ${path.basename(archivo)} · ${wb.worksheets.length} hoja(s)`);
  for (const ws of wb.worksheets) {
    console.log(`\n═══ HOJA "${ws.name}" · ${ws.rowCount} filas · ${ws.columnCount} columnas ═══`);
    const imgs = ws.getImages();
    console.log(`Imágenes ancladas: ${imgs.length}` + (imgs.length
      ? ` (filas: ${imgs.slice(0, 12).map(i => (i.range.tl.nativeRow ?? i.range.tl.row) + 1).join(', ')}${imgs.length > 12 ? '…' : ''})` : ''));
    for (let r = 1; r <= Math.min(nFilas + 2, ws.rowCount); r++) {
      const row = ws.getRow(r);
      const celdas = [];
      for (let cIdx = 1; cIdx <= ws.columnCount; cIdx++) {
        const cel = row.getCell(cIdx);
        let v = cel.value;
        if (v && typeof v === 'object') v = v.result !== undefined ? v.result : (v.richText ? v.richText.map(t => t.text).join('') : JSON.stringify(v));
        let extra = '';
        const fill = cel.fill;
        if (fill && fill.fgColor && fill.fgColor.argb) extra = `⟨${fill.fgColor.argb}⟩`;
        if (cel.font && cel.font.bold) extra += 'ᴮ';
        celdas.push((v === null || v === undefined ? '·' : String(v).slice(0, 22)) + extra);
      }
      const h = row.height ? ` (alto ${row.height})` : '';
      console.log(`  F${r}${h}: ${celdas.join(' | ')}`);
    }
    if (ws.rowCount > nFilas + 2) console.log(`  … (${ws.rowCount - nFilas - 2} filas más)`);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
