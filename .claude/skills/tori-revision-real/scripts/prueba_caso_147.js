/**
 * prueba_caso_147.js — v5_90
 * Caso yugin 147: "en Producción China no aparece mucha información y ya está
 * en el Liquidador". Reproduce la forma REAL del bug (macro con cubicaje 0,
 * filas guardadas con 0, precio solo en la factura) y verifica la corrección.
 *
 * Uso: node prueba_caso_147.js <dirBloques>
 */
'use strict';
const path = require('path');
const { crearEntorno } = require('/home/user/impraga-/.claude/skills/tori-engineering/scripts/entorno_tori');

const DIR = process.argv[2] || path.join(__dirname, 'bloques90');
let total = 0, ok = 0;
function check(nombre, cond, detalle) {
  total++;
  if (cond) { ok++; console.log('  ✔ ' + nombre); }
  else { console.log('  ✘ ' + nombre + (detalle ? ' — ' + detalle : '')); }
}

(async () => {
  const env = crearEntorno();
  env.ctx.prompt = env.ctx.window.prompt = () => { throw new Error('prompt() is not supported.'); };
  env.cargarBloque(path.join(DIR, 'bloque_0.js'));
  env.cargarBloque(path.join(DIR, 'bloque_1.js'));
  env.cargarBloque(path.join(DIR, 'bloque_3.js'));
  env.dispararDOMReady();
  await env.esperar(2000);
  const W = env.ctx.window;

  // ── Siembra con la FORMA REAL del caso ──
  // Macro (bloque 0, TORI.classified): cubicaje EN 0, unidEmpaque null — como el
  // macro real de Andrés para las 145 refs del pedido 147. SIN categoria (así es
  // TORI.classified de verdad; la categoría vive en el bloque 1).
  W.TORI.classified = [
    { codigo: '302-22', nombre: 'BILLETERA DAMA', grupo: 'PRAGA', saldo: 0, ocPend: 0, diasRaw: 25, tier: 'A', status: 'ORDENAR', cubicaje: 0, unidEmpaque: null, contenedor: '0134', cantEntrada: 480 },
    { codigo: '218-33', nombre: 'BOLSO PLAYERO', grupo: 'PRAGA', saldo: 0, ocPend: 0, diasRaw: 40, tier: 'B', status: 'ORDENAR', cubicaje: 0.35, unidEmpaque: 50, contenedor: '0140', cantEntrada: 100 },
    { codigo: '400-77', nombre: 'JARRON DECORATIVO', grupo: 'PRAGA', saldo: 0, ocPend: 0, diasRaw: 60, tier: 'C', status: 'ORDENAR', cubicaje: 0, unidEmpaque: 0, contenedor: '', cantEntrada: null },
  ];
  // Bloque 1 (STATE.rows) SÍ trae categoria — _pcMacroMap debe anexarla
  W.STATE.rows = [
    { codigo: '302-22', nombre: 'BILLETERA DAMA', categoria: 'BILLETERAS' },
    { codigo: '218-33', nombre: 'BOLSO PLAYERO', categoria: 'BOLSOS' },
  ];
  // Facturas del Liquidador (forma real): el dato COMPLETO vive aquí
  W.TORI.facturas = [{
    name: 'FACTURA 2026-01-26 PRAGA-134',
    rows: [
      { ARTICULO: '302-22', DESCRIPCION: 'BILLETERA', CTNS: 2, QTY_CTN: 240, CANTIDAD_TOTAL: 480, PRECIO: 4.6, TOTAL_CBM: 0.31 },
      { ARTICULO: '400-77', DESCRIPCION: 'JARRON', CTNS: 5, QTY_CTN: 36, CANTIDAD_TOTAL: 180, PRECIO: 12.5, TOTAL_CBM: 1.05 },
    ],
  }];
  // Base de cubicaje del Motor con un 0 guardado (también debe tratarse como hueco)
  env.localStorage.setItem('praga_cubicaje_db_v1', JSON.stringify({ '400-77': { cubicaje: 0, unidEmpaque: 0 } }));
  if (typeof W._fotoInvalidate === 'function') W._fotoInvalidate();
  if (typeof W._pcInvalidate === 'function') W._pcInvalidate();

  console.log('— A. La cascada ya no se atora en el 0 del macro —');
  const casc = W._pcEmpaqueDe('302-22', W.TORI.classified[0]);
  check('A1: cubicaje llega desde la FACTURA pese al 0 del macro (0.31/2 = 0.155)', casc.cubCaja === 0.155, JSON.stringify(casc));
  check('A2: unid/caja de la factura (240) y contenedor de origen', casc.unidCaja === 240 && casc.contFac === 'FACTURA 2026-01-26 PRAGA-134');
  check('A3: el precio ¥ de la factura entra a la cascada (4.6)', casc.precioFac === 4.6);

  const casc2 = W._pcEmpaqueDe('218-33', W.TORI.classified[1]);
  check('A4: un macro CON dato real sigue mandando (0.35, 50) — cero cambios donde no hay bug', casc2.cubCaja === 0.35 && casc2.unidCaja === 50, JSON.stringify(casc2));

  const casc3 = W._pcEmpaqueDe('400-77', W.TORI.classified[2]);
  check('A5: el 0 de la base de cubicaje también es hueco → factura (1.05/5 = 0.21)', casc3.cubCaja === 0.21 && casc3.unidCaja === 36, JSON.stringify(casc3));

  console.log('— B. El refresco SANA las filas guardadas con 0 (el pedido de Andrés) —');
  const doc = {
    id: 'yugin147', fileName: 'orden compra yugin#147', fecha: 'hoy',
    items: { '302-22': 480, '218-33': 100, '400-77': 180 }, nRefs: 3, nUnids: 760,
    rows: [
      // así quedaron guardadas: unid/caja llena, cubicajes EN 0, sin precio, sin tipo
      { ref: '302-22', desc: 'BILLETERA', descCn: '款式如图', unidCaja: 240, cajas: 2, unidades: 480, cubCaja: 0, cubTotal: 0, precio: '', valor: 0, proveedor: '', tier: 'A', dias: 25, tipo: '', contOrigen: '', isNew: false },
      // esta tiene TODO real — no se puede pisar NADA
      { ref: '218-33', desc: 'BOLSO PLAYERO', descCn: '', unidCaja: 50, cajas: 2, unidades: 100, cubCaja: 0.4, cubTotal: 0.8, precio: 14, valor: 1400, proveedor: '10332', tier: 'B', dias: 40, tipo: 'BOLSOS', contOrigen: '0140', isNew: false },
      { ref: '400-77', desc: 'JARRON', descCn: '', unidCaja: 0, cajas: 0, unidades: 180, cubCaja: 0, cubTotal: 0, precio: 0, valor: 0, proveedor: '', tier: 'C', dias: 60, tipo: '', contOrigen: '', isNew: false },
    ],
  };
  W._pcRefrescarRows(doc);
  const r1 = doc.rows[0], r2 = doc.rows[1], r3 = doc.rows[2];
  check('B1: 302-22 cubicaje sanado desde la factura (0.155 / caja)', r1.cubCaja === 0.155, JSON.stringify(r1));
  check('B2: 302-22 cubicaje TOTAL recalculado (2 cajas × 0.155 = 0.31)', r1.cubTotal === 0.31);
  check('B3: 302-22 precio ¥ desde la factura (4.6) y valor 480×4.6 = 2208', r1.precio === 4.6 && r1.valor === 2208);
  check('B4: 302-22 tipo de producto desde la categoría del Motor (BILLETERAS)', r1.tipo === 'BILLETERAS');
  check('B5: 218-33 INTACTA — ni cubicaje (0.4) ni precio (14) ni valor ni tipo se pisaron',
    r2.cubCaja === 0.4 && r2.cubTotal === 0.8 && r2.precio === 14 && r2.valor === 1400 && r2.tipo === 'BOLSOS' && r2.proveedor === '10332');
  check('B6: 400-77 sanada completa: unid/caja 36, cajas 5, cub 0.21/1.05, precio 12.5',
    r3.unidCaja === 36 && r3.cajas === 5 && r3.cubCaja === 0.21 && r3.cubTotal === 1.05 && r3.precio === 12.5 && r3.valor === 2250, JSON.stringify(r3));
  check('B7: las unidades NUNCA cambian en el refresco (480/100/180)', r1.unidades === 480 && r2.unidades === 100 && r3.unidades === 180);

  console.log('— C. La VISTA de la pestaña 🏭 tampoco acepta el 0 guardado —');
  const filaConCeros = { ref: '302-22', unidCaja: 240, cajas: 2, unidades: 480, cubCaja: 0, cubTotal: 0, tier: '', dias: '' };
  const info = W._pcTabInfoRef(W._pcMacroMap())(filaConCeros);
  check('C1: la vista resuelve cub/caja 0.155 y m³ 0.31 (antes pintaba 0)', info.cubCaja === 0.155 && info.cubTotal === 0.31, JSON.stringify(info));
  check('C2: tier y días frescos del macro (A, 25)', info.tier === 'A' && info.dias === 25);

  console.log('— D. Fila nueva (_pcBuildRow) con precio de factura —');
  const fila = W._pcBuildRow('400-77', 180, W._pcMacroMap(), W._pcChinaDB(), W._pcEmpCtx());
  check('D1: fila nueva sale completa: 36 und/caja, 5 cajas, 0.21 m³/caja, ¥12.5, valor 2250',
    fila.unidCaja === 36 && fila.cajas === 5 && fila.cubCaja === 0.21 && fila.precio === 12.5 && fila.valor === 2250, JSON.stringify(fila));
  check('D2: contenedor de origen de la factura en la fila nueva', fila.contOrigen === 'FACTURA 2026-01-26 PRAGA-134');

  console.log('\nResultado: ' + ok + '/' + total + ' en verde');
  process.exit(ok === total ? 0 : 1);
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
