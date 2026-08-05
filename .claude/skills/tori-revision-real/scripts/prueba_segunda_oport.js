/**
 * prueba_segunda_oport.js — v5_95 · 🔄 Segunda oportunidad (Rotación > límite)
 * La regla de Andrés: devolver refs ELEGIDAS a la Orden Sugerida, válido por la
 * importación vigente — al llegar entrada NUEVA la oportunidad se consume sola
 * y solo un toque manual la revive. Modo .exe (prompt roto), confirm contado.
 */
'use strict';
const path = require('path');
const { crearEntorno } = require('/root/.claude/skills/tori-engineering/scripts/entorno_tori');

const DIR = process.argv[2] || path.join(__dirname, 'bloques95');
let total = 0, ok = 0;
function check(nombre, cond, detalle) {
  total++;
  if (cond) { ok++; console.log('  ✔ ' + nombre); }
  else { console.log('  ✘ ' + nombre + (detalle ? ' — ' + detalle : '')); }
}
const esperar = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const env = crearEntorno();
  env.ctx.prompt = env.ctx.window.prompt = () => { throw new Error('prompt() is not supported.'); };
  env.cargarBloque(path.join(DIR, 'bloque_0.js'));
  env.cargarBloque(path.join(DIR, 'bloque_1.js'));
  env.cargarBloque(path.join(DIR, 'bloque_3.js'));
  env.dispararDOMReady();
  await env.esperar(2200);
  const W = env.ctx.window;

  let confirmas = 0, confirmaTxt = '';
  // v5_97: __soDar usa toriConfirm (ventana propia — cero diálogos nativos)
  W.toriConfirm = async (m) => { confirmas++; confirmaTxt = String(m); return true; };
  W.confirm = env.ctx.confirm = () => { throw new Error('confirm() nativo PROHIBIDO en este flujo (roba el foco en Electron)'); };

  console.log('— A. classifyMotorRow (bloque 0) —');
  const fila = { codigo: '313-99', nombre: 'FLOR ARTIFICIAL PREMIUM', grupo: 'PRAGA', saldo: 0, ocPend: 0, diasRaw: 120, fEntrada: new env.ctx.Date('2026-01-15T10:00:00Z'), cantEntrada: 300, unidEmpaque: 100, cubicaje: 0.2 };
  let r = env.ctx.classifyMotorRow(fila);
  check('A1: sin oportunidad → ROTACIÓN LENTA (120 días > límite)', r.status === 'ROTACION_LENTA' && !r.segundaOport, r.status);

  env.localStorage.setItem('tori_segunda_oport_v1', JSON.stringify({ '313-99': { codigo: '313-99', fecha: '4/8/2026', fEntradaBase: '2026-01-15' } }));
  await esperar(600);   // el caché del bloque 0 vive 500ms
  r = env.ctx.classifyMotorRow(fila);
  check('A2: con oportunidad → ORDENAR, Tier C, con la marca', r.status === 'ORDENAR' && r.tier === 'C' && !!r.segundaOport, r.status + '/' + r.tier);
  check('A3: cajas y unidades sugeridas calculadas como cualquier ref de la orden (3 cajas × 100)', r.cajas === 3 && r.unidPedir === 300 && r.cubPedir === 0.6, r.cajas + '/' + r.unidPedir + '/' + r.cubPedir);

  const filaNueva = Object.assign({}, fila, { fEntrada: new env.ctx.Date('2026-04-05T10:00:00Z'), diasRaw: 95 });
  r = env.ctx.classifyMotorRow(filaNueva);
  check('A4: LLEGÓ ENTRADA NUEVA y volvió a pasar el límite → ROTACIÓN LENTA (la oportunidad NO revive sola)', r.status === 'ROTACION_LENTA' && !r.segundaOport, r.status);

  const filaVendeBien = Object.assign({}, fila, { fEntrada: new env.ctx.Date('2026-04-05T10:00:00Z'), diasRaw: 30 });
  r = env.ctx.classifyMotorRow(filaVendeBien);
  check('A5: si el ciclo nuevo vende BIEN entra a la orden por regla normal (Tier A, sin oportunidad)', r.status === 'ORDENAR' && r.tier === 'A' && !r.segundaOport, r.status + '/' + r.tier);

  console.log('— B. Flujo del Motor (bloque 1): dar, ver, consumir, quitar —');
  env.localStorage.removeItem('tori_segunda_oport_v1');
  await esperar(600);
  W.STATE.params = Object.assign({}, W.STATE.params, { maxDias: 90, cutA: 30, cutB: 60 });
  W.STATE.rows = [
    { codigo: '313-99', nombre: 'FLOR ARTIFICIAL PREMIUM', grupo: 'PRAGA', saldo: 0, ocPend: 0, diasRaw: 120, fEntrada: new env.ctx.Date('2026-01-15T10:00:00Z'), cantEntrada: 300, unidEmpaque: 100, cubicaje: 0.2 },
    { codigo: '210-102', nombre: 'BOLSO DAMA', grupo: 'PRAGA', saldo: 0, ocPend: 0, diasRaw: 20, fEntrada: new env.ctx.Date('2026-03-01T10:00:00Z'), cantEntrada: 120, unidEmpaque: 12, cubicaje: 0.1 },
  ];
  env.doc.getElementById('grupoFilter').value = 'TODOS';
  env.doc.getElementById('searchInput').value = '';
  W.__ntQuitar('zzz-inexistente');   // fuerza computeAndRender con la siembra
  await esperar(200);
  let excl = (W.STATE.excluidos || []).filter(x => x.status === 'ROTACION_LENTA').map(x => x.codigo);
  check('B1: 313-99 arranca en Rotación > límite y 210-102 en la orden', excl.includes('313-99') && (W.STATE.ordenar || []).some(x => x.codigo === '210-102'), excl.join(','));

  W.STATE.ordenView = 'ROTACION_LENTA';
  W.__ordenSetMarro('TODO');
  const bodyExcl = env.doc.getElementById('ordenTableBody').innerHTML;
  check('B2: la vista Rotación > límite muestra el botón 🔄 Otra oportunidad', bodyExcl.indexOf('Otra oportunidad') >= 0 && bodyExcl.indexOf('__soDar') >= 0);

  W.__soDar('313-99');
  await esperar(200);
  check('B3: pidió confirmación con la regla explicada (toriConfirm — cero diálogos nativos)', confirmas === 1 && confirmaTxt.indexOf('se consume sola') >= 0, 'confirmas=' + confirmas);
  check('B4: 313-99 quedó en la Orden Sugerida con Tier C y marca 🔄', (W.STATE.ordenar || []).some(x => x.codigo === '313-99' && x.tier === 'C' && x.segundaOport), JSON.stringify((W.STATE.ordenar || []).map(x => x.codigo)));
  const db1 = W.getSegundaOportDB();
  check('B5: guardada en tori_segunda_oport_v1 con la fecha de entrada base (2026-01-15)', db1['313-99'] && db1['313-99'].fEntradaBase === '2026-01-15', JSON.stringify(db1));

  W.STATE.ordenView = 'ORDEN';
  W.__ordenSetMarro('TODO');
  const bodyOrden = env.doc.getElementById('ordenTableBody').innerHTML;
  check('B6: la fila en la orden lleva la marca 🔄 (clic = quitarla)', bodyOrden.indexOf('__soQuitar') >= 0 && bodyOrden.indexOf('🔄') >= 0);

  // re-render SIN entrada nueva → la oportunidad persiste
  W.__ntQuitar('zzz-inexistente');
  await esperar(200);
  check('B7: mientras NO llegue mercancía nueva, la oportunidad persiste en cada recálculo', (W.STATE.ordenar || []).some(x => x.codigo === '313-99'));

  // LLEGA la mercancía nueva (macro con entrada más reciente) y vuelve a ser lenta
  W.STATE.rows[0] = Object.assign({}, W.STATE.rows[0], { fEntrada: new env.ctx.Date('2026-04-05T10:00:00Z'), diasRaw: 95 });
  W.__ntQuitar('zzz-inexistente');
  await esperar(300);
  excl = (W.STATE.excluidos || []).filter(x => x.status === 'ROTACION_LENTA').map(x => x.codigo);
  check('B8: llegó entrada nueva y también pasó el límite → vuelve a Rotación > límite SOLA', excl.includes('313-99'), excl.join(','));
  const db2 = W.getSegundaOportDB();
  check('B9: la oportunidad consumida se PODÓ de la base (requiere toque manual otra vez)', !db2['313-99'], JSON.stringify(db2));

  // darla otra vez y quitarla a mano
  W.__soDar('313-99');
  await esperar(200);
  check('B10: segundo toque manual la devuelve (con la entrada nueva como base)', (W.STATE.ordenar || []).some(x => x.codigo === '313-99') && W.getSegundaOportDB()['313-99'].fEntradaBase === '2026-04-05');
  W.__soQuitar('313-99');
  await esperar(200);
  excl = (W.STATE.excluidos || []).filter(x => x.status === 'ROTACION_LENTA').map(x => x.codigo);
  check('B11: quitarla a mano la regresa a Rotación > límite', excl.includes('313-99') && !W.getSegundaOportDB()['313-99']);

  console.log('— C. Persistencia —');
  const razones = [];
  const orig = W._triggerAutosaveFn;
  W._triggerAutosaveFn = (rz) => { razones.push(rz); if (orig) try { orig(rz); } catch (e) {} };
  W.__soDar('313-99');
  await esperar(200);
  check('C1: guardar la oportunidad dispara autosave (razón segunda-oport)', razones.includes('segunda-oport'), razones.join(','));
  const snap = await W._buildSnapshotData();
  check('C2: la clave viaja en el snapshot del backup', snap.secciones && snap.secciones.motor && ('tori_segunda_oport_v1' in snap.secciones.motor), Object.keys((snap.secciones || {}).motor || {}).join(','));

  console.log('\nResultado: ' + ok + '/' + total + ' en verde');
  process.exit(ok === total ? 0 : 1);
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
