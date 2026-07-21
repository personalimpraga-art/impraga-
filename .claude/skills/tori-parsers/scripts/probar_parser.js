/**
 * probar_parser.js — Pasa un Excel REAL (el que suba Andrés) por el parser REAL
 * de TORI y muestra campo por campo qué leyó, ANTES de que llegue a producción.
 *
 * Uso:
 *   node probar_parser.js prodchina ARCHIVO.xlsx [dirBloques]
 *       → parseProdChinaFile (bloque 0): detección de columnas POR ENCABEZADO,
 *         guard CJK, rechazo si n>0 refs con 0 unidades. Muestra refs y unidades.
 *
 *   node probar_parser.js china ARCHIVO.xlsx [dirBloques]
 *       → parser de Datos China (bloque 1) VÍA EL CABLEADO REAL (evento change
 *         del input chinaFileInput). Muestra la base ANTES y DESPUÉS por ref:
 *         descCn, precioRMB, proveedor, historial. Verifica la regla de archivos
 *         parciales (YUGIN): una fila vale con AL MENOS UN dato útil, y el
 *         precio existente NO se pisa si el archivo no trae precio.
 *
 * Para sembrar una base China previa (probar que no se pisa):
 *   TORI_CHINA_PREVIO='{"pg0001":{"descCn":"旧","precioRMB":9.9,...}}' node probar_parser.js china f.xlsx
 *
 * dirBloques default: /tmp/tori_bloques (correr antes extraer_bloques.py de tori-engineering).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { crearEntorno } = require('./entorno_tori');
const XLSX = require(process.env.TORI_LIB_XLSX || '/home/claude/lib/node_modules/xlsx');

function archivoFalso(ruta) {
  return { name: path.basename(ruta), _path: ruta, size: fs.statSync(ruta).size };
}

/** FileReader que lee del disco con fs (patrón §6 del mapa técnico) */
function FileReaderDisco() {
  const self = this;
  this.onload = null; this.onerror = null;
  this.readAsArrayBuffer = function (f) {
    queueMicrotask(() => {
      try {
        const buf = fs.readFileSync(f._path);
        self.result = new Uint8Array(buf);
        if (self.onload) self.onload({ target: { result: self.result } });
      } catch (e) { if (self.onerror) self.onerror(e); }
    });
  };
  this.readAsBinaryString = function (f) {
    queueMicrotask(() => {
      try {
        self.result = fs.readFileSync(f._path, 'binary');
        if (self.onload) self.onload({ target: { result: self.result } });
      } catch (e) { if (self.onerror) self.onerror(e); }
    });
  };
  this.readAsDataURL = function () {};
}

async function bootear(bloques, dirBloques) {
  const env = crearEntorno({ XLSX });
  env.ctx.FileReader = FileReaderDisco;
  env.ctx.window.FileReader = FileReaderDisco;
  for (const b of bloques) env.cargarBloque(path.join(dirBloques, `bloque_${b}.js`));
  env.dispararDOMReady(); // el bloque 1 cablea sus inputs en init() tras DOMContentLoaded
  await env.esperar(400);
  return env;
}

/* ── prodchina: parseProdChinaFile es global del bloque 0 ───────────── */
async function probarProdChina(ruta, dirBloques) {
  const env = await bootear([0], dirBloques);
  console.log(`\n═══ parseProdChinaFile · ${path.basename(ruta)} ═══`);
  try {
    const r = await env.ctx.parseProdChinaFile(archivoFalso(ruta));
    console.log(`✔ ACEPTADO: ${r.n} referencias · ${r.unids} unidades totales`);
    const items = Object.entries(r.items || {});
    console.log(`Refs leídas (${items.length}):`);
    for (const [ref, u] of items.slice(0, 30)) console.log(`  · ${ref} → ${u} unds`);
    if (items.length > 30) console.log(`  … y ${items.length - 30} más`);
    const enCero = items.filter(([, u]) => !u);
    if (enCero.length) console.log(`⚠ OJO: ${enCero.length} refs con 0 unidades: ${enCero.slice(0, 8).map(([k]) => k).join(', ')}`);
    return true;
  } catch (e) {
    console.log(`✘ RECHAZADO por el parser: ${e.message}`);
    console.log('  (Si el rechazo es correcto —p.ej. refs sin unidades— este es el comportamiento esperado.)');
    return false;
  }
}

/* ── china: vía el cableado real del input chinaFileInput ───────────── */
async function probarChina(ruta, dirBloques) {
  const env = await bootear([0, 1], dirBloques); // el bloque 1 necesita el núcleo del 0
  // Base previa opcional (para verificar que lo existente NO se pisa)
  const previo = process.env.TORI_CHINA_PREVIO;
  if (previo) {
    env.localStorage.setItem('praga_china_db_v1', previo);
    if (env.ctx.STATE) env.ctx.STATE.chinaDB = JSON.parse(previo);
  }
  const antes = JSON.parse(env.localStorage.getItem('praga_china_db_v1') || '{}');

  const input = env.doc.getElementById('chinaFileInput');
  if (!(input._listeners.change || []).length) {
    console.log('✘ El input chinaFileInput no tiene listener change — ¿cambió el wiring del bloque 1?');
    return false;
  }
  console.log(`\n═══ Datos China (cableado real) · ${path.basename(ruta)} ═══`);
  input._disparar('change', { target: Object.assign(input, { files: [archivoFalso(ruta)] }) });
  await env.esperar(600);

  const despues = JSON.parse(env.localStorage.getItem('praga_china_db_v1') || '{}');
  const refs = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  let nuevas = 0, cambiadas = 0, intactas = 0;
  console.log('Ref · descCn · precioRMB · proveedor · historial');
  for (const ref of Array.from(refs).slice(0, 40)) {
    const a = antes[ref], d = despues[ref];
    if (!d) continue;
    const tag = !a ? 'NUEVA' : (JSON.stringify(a) !== JSON.stringify(d) ? 'CAMBIÓ' : 'igual');
    if (tag === 'NUEVA') nuevas++; else if (tag === 'CAMBIÓ') cambiadas++; else intactas++;
    // Esquema REAL de praga_china_db_v1 (verificado en el código): codigo,
    // descripcionChina, precioRMB, proveedor, historial[{precioRMB,fecha,fuente}], fecha, fuente.
    console.log(`  [${tag}] ${ref} · "${(d.descripcionChina || '·')}" · ${d.precioRMB ?? '·'} · ${d.proveedor || '·'} · ${(d.historial || []).length} precio(s) · fuente: ${d.fuente || '·'}`);
    if (a && a.precioRMB != null && d.precioRMB !== a.precioRMB && (d.precioRMB == null)) {
      console.log(`  ✘ ALERTA: la ref ${ref} PERDIÓ su precio (${a.precioRMB} → ${d.precioRMB}) — viola la regla de parciales`);
    }
  }
  console.log(`Resumen: ${nuevas} nuevas · ${cambiadas} actualizadas · ${intactas} intactas · total en base: ${Object.keys(despues).length}`);
  const errorUI = env.doc.getElementById('chinaError');
  if (errorUI && errorUI.textContent) console.log(`Mensaje de error en la UI: "${errorUI.textContent}"`);
  return Object.keys(despues).length >= Object.keys(antes).length;
}

async function main() {
  const [tipo, ruta, dirBloques = '/tmp/tori_bloques'] = process.argv.slice(2);
  if (!tipo || !ruta) { console.error('Uso: node probar_parser.js prodchina|china ARCHIVO.xlsx [dirBloques]'); process.exit(1); }
  if (!fs.existsSync(ruta)) { console.error('✘ No existe: ' + ruta); process.exit(1); }
  let ok;
  if (tipo === 'prodchina') ok = await probarProdChina(ruta, dirBloques);
  else if (tipo === 'china') ok = await probarChina(ruta, dirBloques);
  else { console.error('Tipo no soportado: ' + tipo + ' (usa prodchina o china)'); process.exit(1); }
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
