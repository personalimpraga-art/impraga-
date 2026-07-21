/**
 * probar_motor_dist.js — Reglas de negocio con plata de por medio:
 *
 * PARTE 1 · REPETIDOS EN LA CADENA (bloque 1, función extraída al realm host):
 *   una referencia NO debe estar en 2+ eslabones (Stock / San Benito / En camino /
 *   Fábrica). Verifica detección, lugares correctos y cero falsos positivos.
 *
 * PARTE 2 · DISTRIBUIDOR (bloque 4 arrancado de verdad, API window.DIST):
 *   - Límites duros de la junta (D.overrides, ej. BOLSO=12/contenedor): ningún
 *     contenedor puede pasarse.
 *   - Capacidad efectiva respetada dentro de la tolerancia.
 *   - computeIntelligence: una descripción Tier A y rápida puntúa mejor que una
 *     Tier C y lenta; los límites quedan dentro de [minLimit, maxLimit].
 *
 * Uso:  node probar_motor_dist.js [dir_bloques]        (default /tmp/tori_bloques)
 */
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const { crearEntorno } = require('./entorno_tori');

let ok = true;
const check = (c, msg) => { console.log((c ? '✔ ' : '✘ ') + msg); ok = ok && !!c; };

/* ═══ PARTE 1: computeRepetidosCadena (extraída — es cómputo puro sobre window) ═══ */
function parteRepetidos(dirBloques) {
  console.log('── PARTE 1 · Repetidos en la cadena (bloque 1) ──');
  const codigo = execSync(
    `python3 ${path.join(__dirname, 'extraer_funcion.py')} ${path.join(dirBloques, 'bloque_1.js')} norm computeRepetidosCadena`,
    { encoding: 'utf-8' });

  // Mundo de prueba: 4 refs, 2 repetidas y 2 sanas
  const window = {
    TORI: {
      classified: [
        { codigo: '210-102', nombre: 'BOLSO DAMA', grupo: 'Bolsos', saldo: 15 }, // Stock + San Benito → REPETIDA
        { codigo: 'PG0001', nombre: 'CORTINA BAÑO', grupo: 'Hogar', saldo: 8 },  // solo Stock → sana
        { codigo: 'PG0002', nombre: 'RIÑONERA', grupo: 'Bolsos', saldo: 0 },     // saldo 0 = NO cuenta como stock
      ],
      sanBenito: { items: { '210-102': 50 } }, // valores NUMÉRICOS (forma real del parser SB)
    },
    getEnCaminoMap: () => new Map([['pg0002', { unidades: 200, facturas: ['CONT_02'] }]]),   // EC + Fábrica → REPETIDA
    getProdChinaMap: () => new Map([['pg0002', { unidades: 300, docs: ['PEDIDO_YUGIN'] }]]),
  };
  const computeRepetidosCadena = eval(codigo + '\ncomputeRepetidosCadena;');
  const rep = computeRepetidosCadena();
  const porRef = {};
  for (const r of rep) porRef[(r.codigo || '').toUpperCase()] = r;

  // Forma real de cada repetido: {codigo, nombre, categoria, combo, nLugares,
  //  stock, enCamino, enCaminoFacturas, sanBenito, prodChina, prodChinaDocs}
  const a = porRef['210-102'];
  check(!!a, '210-102 detectada como repetida (Stock + San Benito)');
  if (a) {
    check(a.combo === 'STOCK + SAN BENITO' && a.nLugares === 2,
      `  combo correcto: "${a.combo}" (${a.nLugares} lugares)`);
    check(a.stock === 15 && a.sanBenito === 50 && a.enCamino === 0 && a.prodChina === 0,
      `  unidades por eslabón correctas: stock ${a.stock} · SB ${a.sanBenito}`);
  }
  const b = porRef['PG0002'];
  check(!!b, 'PG0002 detectada como repetida (En camino + Fábrica) aunque su saldo en tienda es 0');
  if (b) {
    check(b.combo === 'EN CAMINO + PRODUCCIÓN CHINA' && b.stock === 0,
      `  combo correcto: "${b.combo}" (saldo 0 no cuenta como STOCK)`);
    check(b.enCamino === 200 && b.prodChina === 300 && b.enCaminoFacturas === 'CONT_02' && b.prodChinaDocs === 'PEDIDO_YUGIN',
      `  unidades y nombres de doc VISIBLES: EC ${b.enCamino} (${b.enCaminoFacturas}) · Fábrica ${b.prodChina} (${b.prodChinaDocs})`);
  }
  check(!porRef['PG0001'], 'PG0001 (solo Stock) NO sale como repetida — cero falsos positivos');
  check(rep.length === 2, `exactamente 2 repetidas (salieron ${rep.length})`);
}

/* ═══ PARTE 2: Distribuidor de verdad (bloques 0 + 4 en el entorno) ═══ */
async function parteDistribuidor(dirBloques) {
  console.log('\n── PARTE 2 · Distribuidor (bloque 4, API window.DIST) ──');
  const env = crearEntorno();
  env.cargarBloque(path.join(dirBloques, 'bloque_0.js'));
  env.cargarBloque(path.join(dirBloques, 'bloque_4.js'));
  env.dispararDOMReady();
  await env.esperar(400);

  const DIST = env.ctx.DIST;
  check(!!DIST && typeof DIST._distributeGroup === 'function', 'window.DIST arrancó y expone _distributeGroup');
  if (!DIST) return;
  const D = DIST._state;

  // Límite duro de la junta: BOLSO DAMA CUERO = 12 por contenedor
  D.overrides = { 'BOLSO DAMA CUERO': 12 };

  // 40 bolsos (misma descripción) + relleno de hogar para llenar contenedores
  const prods = [];
  for (let i = 0; i < 40; i++) prods.push({
    ref: 'B' + String(i).padStart(3, '0'), desc: 'BOLSO DAMA CUERO', tipo: 'BOLSOS',
    cubTotal: 0.6, valor: 700, dias: 40, tier: 'A', isNew: false, proveedor: 'PROV-A',
  });
  for (let i = 0; i < 60; i++) prods.push({
    ref: 'H' + String(i).padStart(3, '0'), desc: 'ORGANIZADOR HOGAR', tipo: 'HOGAR',
    cubTotal: 0.8, valor: 300, dias: 150, tier: 'C', isNew: false, proveedor: 'PROV-B',
  });

  const CAP = 70; // m³ efectivos
  D.containers = []; // distributeGroup EMPUJA aquí y devuelve el siguiente número
  DIST._distributeGroup(prods, 'PRUEBA', 1, CAP);
  const conts = D.containers;
  check(Array.isArray(conts) && conts.length >= 1, `distribuyó en ${conts.length} contenedor(es)`);

  const maxBolsos = Math.max(...conts.map(c => c.descCounts['BOLSO DAMA CUERO'] || 0));
  check(maxBolsos <= 12, `límite de la junta respetado: máx ${maxBolsos} bolsos/contenedor (tope 12)`);
  const totalColocados = conts.reduce((s, c) => s + c.products.length, 0);
  console.log(`  (colocados ${totalColocados}/${prods.length} productos · cbm por contenedor: ${conts.map(c => c.totalCbm.toFixed(1)).join(', ')})`);
  const techo = CAP * 1.25 + 0.51; // techo de fase 1.25×cap + tolerancia de llenado
  check(conts.every(c => c.totalCbm <= techo), `ningún contenedor supera el techo de capacidad (${techo.toFixed(1)} m³)`);
  const sinPerder = totalColocados <= prods.length;
  check(sinPerder && conts.every(c => c.products.every(p => p.desc)), 'ningún producto duplicado ni corrupto en los contenedores');

  // computeIntelligence: A-rápida debe puntuar mejor que C-lenta
  const intel = DIST._computeIntelligence(prods);
  const iA = intel['BOLSO DAMA CUERO'], iC = intel['ORGANIZADOR HOGAR'];
  check(iA && iC && iA.rawScore > iC.rawScore,
    `inteligencia: Tier A rápida (${iA && iA.rawScore.toFixed(2)}) > Tier C lenta (${iC && iC.rawScore.toFixed(2)})`);
  const limites = Object.values(intel).map(x => x.limit).filter(v => v != null);
  if (limites.length) {
    check(limites.every(l => l >= 2 && l <= 25), `límites sugeridos dentro de [2, 25]: ${limites.join(', ')}`);
  }
}

async function main() {
  const dirBloques = process.argv[2] || '/tmp/tori_bloques';
  parteRepetidos(dirBloques);
  await parteDistribuidor(dirBloques);
  console.log(ok ? '\n★ MOTOR + DISTRIBUIDOR: PASÓ' : '\n★ MOTOR + DISTRIBUIDOR: FALLÓ');
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
