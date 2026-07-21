/**
 * prueba_backup.js — PRUEBA MAESTRA DEL BACKUP (§6 del mapa técnico).
 * Correr en CADA versión antes de entregar.
 *
 * Pasos:
 *   1. Sembrar handle FSA falso en praga_fsa_v1 ANTES del boot (createWritable captura lo escrito).
 *   2. Poblar TODO: facturas con meta y fotos, enCamino, sanBenito, prodChina con rows,
 *      macro, claves localStorage, PI2 catalogo+meta, store de fotos.
 *   3. _fsaInit() → _fsaWriteNow() → capturar archivo 1.
 *   4. TORI NUEVO vacío → restaurarBackupMaestro({text: async () => archivo1}) → _fsaWriteNow() → archivo 2.
 *   5. Comparación profunda de las 8 secciones (facturas ordenadas por nombre —
 *      la restauración ordena por fecha a propósito). Deben ser IDÉNTICAS.
 *
 * Uso:  node prueba_backup.js [dir_bloques]        (default /tmp/tori_bloques)
 * Sale con código 0 solo si las 8 secciones son idénticas.
 */
'use strict';
const path = require('path');
const { crearEntorno } = require('./entorno_tori');

const FOTO1 = 'data:image/jpeg;base64,/9j/FOTOPRUEBA_A==';
const FOTO2 = 'data:image/jpeg;base64,/9j/FOTOPRUEBA_B==';

/* ── Handle FSA falso que captura lo escrito ────────────────────────── */
function crearHandleFSA(capturas) {
  return {
    name: 'TORI_PRAGA_backup.json',
    kind: 'file',
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    createWritable: async () => ({
      write: async (data) => { capturas.push(String(data)); },
      close: async () => {},
    }),
  };
}

/* ── Datos de prueba: TODO lo que el backup debe llevar ─────────────── */
function poblarTodo(env) {
  const T = env.ctx.TORI;
  // Facturas con meta y fotos (los contenedores del Liquidador)
  T.facturas = [
    {
      name: 'CONT_2026_01.xlsx', loaded: '2026-01-10T08:00:00.000Z',
      params: { yd: 7.15, dp: 4150 }, meta: { contenedor: 'C-101', nota: 'llegó completo' },
      rows: [
        { REFERENCIA: '210-102', DESCRIPCION: 'BOLSO DAMA CUERO', UNIDADES: 120, FOTO: FOTO1 },
        { REFERENCIA: 'PG0001', DESCRIPCION: 'CORTINA DE BAÑO', UNIDADES: 60 },
      ],
    },
    {
      name: 'CONT_2026_02.xlsx', loaded: '2026-02-05T08:00:00.000Z',
      params: { yd: 7.2, dp: 4200 }, meta: { contenedor: 'C-102' },
      rows: [{ REFERENCIA: 'PG0002', DESCRIPCION: 'RIÑONERA DEPORTIVA', UNIDADES: 200, FOTO: FOTO2 }],
    },
  ];
  T.enCamino = ['CONT_2026_02.xlsx'];
  T.sanBenito = { fecha: '2026-03-01', items: { '210-102': { unidades: 50, nombre: 'BOLSO DAMA CUERO' } } };
  // Forma REAL de un doc de Producción China (ver handleProdChina en bloque 0):
  // items = mapa {ref normalizada → unidades}; nRefs/nUnids = totales.
  // Si items suma 0, _pcSelfHeal lo reconstruye desde rows[] (invariante 6).
  T.prodChina = [{
    id: 'prueba_pc_1', fileName: 'PEDIDO_YUGIN_MAR.xlsx', origen: 'DISTRIBUIDOR',
    fecha: '2026-03-10', items: { pg0003: 300 }, nRefs: 1, nUnids: 300,
    rows: [{ ref: 'PG0003', descripcion: 'BILLETERA HOMBRE', unidades: 300 }],
  }];
  T.macroRows = [
    { REFERENCIA: '210-102', NOMBRE: 'BOLSO DAMA CUERO', STOCK: 15, VENTAS: 40 },
    { REFERENCIA: 'PG0001', NOMBRE: 'CORTINA DE BAÑO PREMIUM', STOCK: 0, VENTAS: 22 },
  ];
  // params: preservar defaults y añadir los nuestros (la restauración hace merge)
  T.params = { ...(T.params || {}), yd: 7.2, dp: 4200, com: 3, env: 2, gan: 30 };
  env.localStorage.setItem('tori_params', JSON.stringify(T.params));
  // Claves localStorage del motor (incluye Distribuidor — invariante 8/9)
  const ls = {
    praga_cost_db_v1: { '210-102': { costo: 16885, liquidador: { precioSugerido: 45000 } } },
    praga_china_db_v1: { 'PG0001': { descCn: '浴帘', precioRMB: 12.5, proveedor: 'YUGIN', historial: [{ f: '2026-01', p: 12.5 }] } },
    praga_cubicaje_db_v1: { 'PG0001': { cbm: 0.08 } },
    praga_reorden_history_v1: [{ fecha: '2026-02-01', refs: 12 }],
    praga_reorden_params: { diasCobertura: 90 },
    praga_ext_files_log_v1: [{ archivo: 'macro_feb.xlsx', fecha: '2026-02-01' }],
    praga_cloud_url_v1: 'https://ejemplo.com/backup',
    tori_dist_overrides: { BOLSO: 12, 'CORTINA DE BAÑO': 20 },
    tori_dist_seeded: { v: 1 },
    tori_dist_nuevos: [{ ref: 'PG0009', dosis: 2 }],
  };
  for (const [k, v] of Object.entries(ls)) env.localStorage.setItem(k, JSON.stringify(v));
  // PI2: catalogo (keyPath 'ref') + meta con claves dinámicas
  env.idb.sembrar('PragaPI2', 'catalogo', 'PG0001', { ref: 'PG0001', nombre: 'CORTINA DE BAÑO', precio: 38000 });
  env.idb.sembrar('PragaPI2', 'catalogo', '210-102', { ref: '210-102', nombre: 'BOLSO DAMA', precio: 45000 });
  env.idb.sembrar('PragaPI2', 'meta', 'facturas', [{ n: 'F1' }]);
  env.idb.sembrar('PragaPI2', 'meta', 'params', { margen: 1.35 });
  // Store de fotos (ToriPragaDB) — _fsaWriteNow las reinyecta si la fila no trae FOTO
  env.idb.sembrar('ToriPragaDB', 'fotos', 'CONT_2026_01.xlsx::1', { _key: 'CONT_2026_01.xlsx::1', foto: FOTO2 });
}

/* ── Comparación profunda (insensible al orden de claves) ───────────── */
function deepEqual(a, b, ruta, difs) {
  if (a === b) return;
  if (typeof a !== typeof b || a === null || b === null) { difs.push(`${ruta}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); return; }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { difs.push(`${ruta}: largo ${a.length} ≠ ${b.length}`); return; }
    a.forEach((x, i) => deepEqual(x, b[i], `${ruta}[${i}]`, difs));
    return;
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    for (const k of new Set([...ka, ...kb])) deepEqual(a[k], b[k], `${ruta}.${k}`, difs);
    return;
  }
  difs.push(`${ruta}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}

async function bootear(dirBloques, capturas) {
  const env = crearEntorno();
  env.idb.sembrar('praga_fsa_v1', 'data', 'fileHandle', crearHandleFSA(capturas)); // paso 1: ANTES del boot
  env.cargarBloque(path.join(dirBloques, 'bloque_0.js'));
  env.cargarBloque(path.join(dirBloques, 'bloque_3.js'));
  await env.esperar(400); // dejar correr los inits
  return env;
}

async function main() {
  const dirBloques = process.argv[2] || '/tmp/tori_bloques';
  let ok = true;

  // ── ENTORNO A: poblar y escribir archivo 1 ──
  const capA = [];
  const envA = await bootear(dirBloques, capA);
  poblarTodo(envA);
  await envA.ctx._fsaInit();
  await envA.esperar(300);
  await envA.ctx._fsaWriteNow();
  await envA.esperar(300);
  if (!capA.length) { console.log('✘ PASO 3: _fsaWriteNow no escribió nada'); process.exit(1); }
  const archivo1 = capA[capA.length - 1];
  const snap1 = JSON.parse(archivo1);
  console.log(`✔ Archivo 1 escrito (${(archivo1.length / 1024).toFixed(1)}KB, tipo ${snap1.tipo})`);

  // ── ENTORNO B: TORI nuevo vacío → restaurar → escribir archivo 2 ──
  const capB = [];
  const envB = await bootear(dirBloques, capB);
  await envB.ctx.restaurarBackupMaestro({ text: async () => archivo1 });
  await envB.esperar(500);
  await envB.ctx._fsaWriteNow();
  await envB.esperar(300);
  if (!capB.length) { console.log('✘ PASO 4: _fsaWriteNow (B) no escribió nada'); process.exit(1); }
  const snap2 = JSON.parse(capB[capB.length - 1]);
  console.log(`✔ Archivo 2 escrito tras restaurar (${(capB[capB.length - 1].length / 1024).toFixed(1)}KB)`);

  // ── PASO 5a: COMPLETITUD del archivo 1 — todo lo poblado debe ESTAR ──
  // (el round-trip solo no basta: una clave que nunca entra al snapshot
  //  falta en AMBOS archivos y pasaría en falso — clase de bug histórico)
  const s1 = snap1.secciones;
  const compl = [];
  const debe = (cond, msg) => compl.push([!!cond, msg]);
  debe(s1.liquidador.facturas.length === 2, '2 facturas presentes');
  debe(s1.liquidador.facturas.every(f => 'meta' in f && f.meta !== undefined), "campo 'meta' presente en las facturas (invariante 3)");
  debe(s1.liquidador.enCamino.includes('CONT_2026_02.xlsx'), 'enCamino presente');
  debe(s1.sanBenito && s1.sanBenito.items && s1.sanBenito.items['210-102'], 'San Benito presente');
  debe(Array.isArray(s1.prodChina) && s1.prodChina.length === 1 && s1.prodChina[0].rows.length === 1, 'Producción China con rows[] presente');
  const clavesMotor = ['tori_params', 'praga_cost_db_v1', 'praga_china_db_v1', 'praga_cubicaje_db_v1',
    'praga_reorden_history_v1', 'praga_reorden_params', 'praga_ext_files_log_v1', 'praga_cloud_url_v1',
    'tori_dist_overrides', 'tori_dist_seeded', 'tori_dist_nuevos', 'tori_macro_live'];
  for (const k of clavesMotor) debe(k in s1.motor, `motor.${k} presente en el backup`);
  debe((s1.pi2.catalogo || []).length === 2, 'PI2 catálogo completo');
  debe(s1.pi2.meta && 'facturas' in s1.pi2.meta && 'params' in s1.pi2.meta, 'PI2 meta con claves dinámicas (invariante 5)');
  const conFoto = JSON.stringify(s1.liquidador.facturas);
  debe(conFoto.includes('FOTOPRUEBA_A') && conFoto.includes('FOTOPRUEBA_B'), 'fotos (inline y reinyectada de IDB) en el archivo 1');
  const fallosCompl = compl.filter(([c]) => !c);
  if (fallosCompl.length) {
    ok = false;
    console.log(`✘ COMPLETITUD: ${fallosCompl.length} dato(s) poblado(s) NO llegaron al backup:`);
    fallosCompl.forEach(([, m]) => console.log('   · falta: ' + m));
  } else {
    console.log(`✔ Completitud: los ${compl.length} datos poblados están en el archivo 1`);
  }

  // ── PASO 5b: comparación profunda de las 8 secciones ──
  const ordenar = (s) => {
    s.secciones.liquidador.facturas = [...s.secciones.liquidador.facturas].sort((a, b) => a.name.localeCompare(b.name));
    return s;
  };
  ordenar(snap1); ordenar(snap2);
  const secciones = [
    ['liquidador.facturas', s => s.secciones.liquidador.facturas],
    ['liquidador.params', s => s.secciones.liquidador.params],
    ['liquidador.enCamino', s => s.secciones.liquidador.enCamino],
    ['sanBenito', s => s.secciones.sanBenito],
    ['prodChina', s => s.secciones.prodChina],
    ['motor', s => s.secciones.motor],
    ['pi2.catalogo', s => s.secciones.pi2.catalogo],
    ['pi2.meta', s => s.secciones.pi2.meta],
  ];
  for (const [nombre, get] of secciones) {
    const difs = [];
    deepEqual(get(snap1), get(snap2), nombre, difs);
    if (difs.length) {
      ok = false;
      console.log(`✘ Sección ${nombre}: ${difs.length} diferencia(s)`);
      difs.slice(0, 5).forEach(d => console.log('   · ' + d));
    } else {
      console.log(`✔ Sección ${nombre}: idéntica`);
    }
  }
  // Verificación extra: las fotos sobrevivieron el viaje
  const facs2 = snap2.secciones.liquidador.facturas;
  const fotosOK = facs2.some(f => f.rows.some(r => r.FOTO === FOTO1)) &&
                  facs2.some(f => f.rows.some(r => r.FOTO === FOTO2));
  console.log(fotosOK ? '✔ Fotos presentes en el archivo restaurado' : '✘ Se PERDIERON fotos en el round-trip');
  if (!fotosOK) ok = false;

  console.log(ok ? '\n★ PRUEBA MAESTRA DEL BACKUP: PASÓ (round-trip idéntico)' : '\n★ PRUEBA MAESTRA DEL BACKUP: FALLÓ');
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
