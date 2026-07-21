/**
 * generar_fixtures.js — Crea Excels de prueba que imitan los formatos REALES
 * que llegan de China, incluidos los casos frágiles:
 *
 *   fixtures/prodchina_ok.xlsx        — Producción China normal (Referencia/Unidades).
 *   fixtures/prodchina_sin_unids.xlsx — refs SIN columna de unidades → el parser
 *                                       DEBE rechazarlo con mensaje claro (invariante 6).
 *   fixtures/yugin_parcial.xlsx       — caso YUGIN: fila de encabezado chino (货号…),
 *                                       solo descripciones chinas y tiendas, SIN precios,
 *                                       ref numérica que debe quedar como texto.
 *
 * Uso:  node generar_fixtures.js [dirSalida=./fixtures]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require(process.env.TORI_LIB_XLSX || '/home/claude/lib/node_modules/xlsx');

const dir = process.argv[2] || path.join(__dirname, '..', 'fixtures');
fs.mkdirSync(dir, { recursive: true });

function escribir(nombre, filas) {
  const ws = XLSX.utils.aoa_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const ruta = path.join(dir, nombre);
  XLSX.writeFile(wb, ruta);
  console.log('✔ ' + ruta);
}

// 1. Producción China normal — columnas corridas a propósito (col extra al inicio):
//    el parser debe encontrarlas POR ENCABEZADO, no por posición.
escribir('prodchina_ok.xlsx', [
  ['NOTA INTERNA', 'Referencia', 'Descripción', 'Unidades', 'Observación'],
  ['', '210-102', 'BOLSO DAMA CUERO', 120, ''],
  ['', 'PG0001', 'CORTINA DE BAÑO', 60, 'urgente'],
  ['', '货号', '中文描述', '', ''],           // fila de encabezado chino intercalada → guard CJK
  ['', 'PG0002', 'RIÑONERA DEPORTIVA', 200, ''],
]);

// 2. Refs sin unidades (columna de cantidades ausente) → rechazo esperado.
escribir('prodchina_sin_unids.xlsx', [
  ['Referencia', 'Descripción'],
  ['210-102', 'BOLSO DAMA CUERO'],
  ['PG0001', 'CORTINA DE BAÑO'],
]);

// 3. YUGIN parcial: encabezado chino arriba, luego encabezado usable,
//    SIN columna de precio; una ref numérica (debe guardarse como texto).
escribir('yugin_parcial.xlsx', [
  ['REFERENCIA', 'DESCRIPCION CHINO', 'TIENDA'],
  ['货号', '中文描述', '供应商'],               // fila de encabezado chino INTERCALADA → guard CJK la salta
  ['PG0001', '浴帘 高级', 'YUGIN A-12'],
  ['210-102', '女士皮包', 'YUGIN A-12'],
  [30512, '运动腰包', 'YUGIN B-03'],
  ['PG0003', '', ''],                          // fila sin NINGÚN dato útil → debe descartarse
]);

console.log('Fixtures listos en ' + dir);
