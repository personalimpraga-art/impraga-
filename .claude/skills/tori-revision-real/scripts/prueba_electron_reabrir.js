/**
 * prueba_electron_reabrir.js — v5_79: LA PRUEBA DEL .EXE Y DEL "CERRAR Y VOLVER A ABRIR".
 * 1. Simula TORI.exe de verdad: window.prompt() LANZA el error de Electron
 *    ("prompt() is not supported") — el bug que reportó Andrés.
 * 2. Ejecuta los flujos con la ventana toriPrompt nueva: vetar desde la Orden de
 *    Compra, vetar/quitar/renombrar/agregar desde Producción China, cancelar.
 * 3. CIERRA TORI (muere el contexto) y lo VUELVE A ABRIR con la misma bóveda del
 *    PC (IndexedDB + localStorage) → verifica que TODO sigue ahí y el Motor
 *    vuelve a excluir lo correcto.
 */
'use strict';
const vm = require('vm');
const { crearEntorno } = require('/home/user/impraga-/.claude/skills/tori-engineering/scripts/entorno_tori');
// Uso: node prueba_electron_reabrir.js /dir/de/bloques  (extraidos con extraer_bloques.py)
const B = process.argv[2] || '/home/claude/work/bloques';

let pasos = 0, fallos = 0;
function ok(cond, msg) {
  if (cond) { pasos++; console.log('  ✔ ' + msg); }
  else { fallos++; console.log('  ✘ FALLO: ' + msg); }
}
const SEMILLA_MOTOR = `
    window.STATE.rows = [
      { codigo:'210-102', nombre:'BOLSO DAMA GRANDE', grupo:'GENERAL', categoria:'BOLSOS',
        saldo:0, ocPend:0, diasRaw:20, unidEmpaque:12, cantEntrada:480, cubicaje:0.08, fEntrada:new Date(), fSalida:new Date(), unidSalidas:480 },
      { codigo:'PG0001', nombre:'CORTINA DE BA\\u00d1O FLORES', grupo:'GENERAL', categoria:'HOGAR',
        saldo:0, ocPend:0, diasRaw:35, unidEmpaque:24, cantEntrada:240, cubicaje:0.05, fEntrada:new Date(), fSalida:new Date(), unidSalidas:240 },
      { codigo:'313-94', nombre:'BANDEJA REDONDA', grupo:'GENERAL', categoria:'BANDEJAS',
        saldo:0, ocPend:0, diasRaw:27, unidEmpaque:50, cantEntrada:400, cubicaje:0.31, fEntrada:new Date(), fSalida:new Date(), unidSalidas:400 }
    ];
    document.getElementById('grupoFilter').value = 'TODOS';
    document.getElementById('searchInput').value = '';
`;

(async () => {
  /* ══ SESIÓN 1: TORI.exe abierto (prompt roto como en Electron) ══ */
  const env = crearEntorno();
  env.cargarBloque(B + '/bloque_0.js');
  env.cargarBloque(B + '/bloque_1.js');
  env.cargarBloque(B + '/bloque_3.js');
  env.dispararDOMReady();
  await env.esperar(2200);
  const ctx = env.ctx;
  // EXACTAMENTE como Electron: prompt() explota
  ctx.prompt = function() { throw new Error('prompt() is not supported.'); };

  vm.runInContext(SEMILLA_MOTOR + `
    TORI.classified = window.STATE.rows.map(classifyMotorRow);
    TORI.prodChina = [];
    _pcInvalidate();
  `, ctx);
  ctx.window.__motorRefresh();
  await env.esperar(150);
  const S = ctx.window.STATE;
  const enOrden = () => (S.ordenar || []).map(r => r.codigo);
  const st = (cod) => { const r = (S.classified || []).find(x => x.codigo === cod); return r ? r.status : '(no está)'; };
  ok(enOrden().length === 3, 'Motor arriba con 3 refs en la Orden Sugerida (y prompt() ROTO como en el .exe)');

  console.log('\nE1 · El bug de Andrés: 🚫 vetar desde la Orden de Compra — ahora con la ventana TORI');
  const pVeto = ctx.window.__ntVetar('313-94');           // lo que hace el botón 🚫 de la fila
  await env.esperar(120);
  const overlay = env.doc.body.children[env.doc.body.children.length - 1];
  ok(overlay && overlay.id === 'toriPromptOverlay' && overlay.innerHTML.includes('Motivo del veto para 313-94'),
     'se abre la ventana propia de TORI pidiendo el motivo (SIN el error de Electron)');
  ok(overlay.innerHTML.includes('Aceptar') && overlay.innerHTML.includes('Cancelar') && overlay.innerHTML.includes("event.key==='Enter'"),
     'con Aceptar/Cancelar y Enter/Escape');
  env.doc.getElementById('toriPromptInp').value = 'Defectos de pintura';
  ctx.window.__toriPromptFin(true);
  await pVeto;
  await env.esperar(150);
  ok(st('313-94') === 'NO_TRAER' && !enOrden().includes('313-94'), '313-94 vetada: salió de la orden → 🚫 No traer');
  const nt1 = JSON.parse(env.lsData['praga_no_traer_v1'] || '{}');
  ok(nt1['313-94'] && nt1['313-94'].motivo === 'Defectos de pintura', 'guardada en la lista NO TRAER con su motivo');

  console.log('\nE2 · Cancelar la ventana = NO pasa nada (igual que el prompt original)');
  const pCancel = ctx.window.__ntVetar('PG0001');
  await env.esperar(120);
  ctx.window.__toriPromptFin(false);
  await pCancel;
  await env.esperar(120);
  ok(enOrden().includes('PG0001') && !JSON.parse(env.lsData['praga_no_traer_v1'])['pg0001'],
     'PG0001 sigue en la orden y NO entró a la lista (canceló)');

  console.log('\nE3 · Producción China con la ventana nueva: crear pedido + agregar + vetar');
  let colaFin = [];
  const responder = async (valor) => { await env.esperar(120); env.doc.getElementById('toriPromptInp').value = valor; ctx.window.__toriPromptFin(true); };
  let p = ctx.window.__pcElegirNuevo('210-102', 480);      // pide nombre y luego cantidad
  await responder('pedido wang agosto');
  await responder('480');
  await p;
  await env.esperar(200);
  const doc = ctx.TORI.prodChina.find(d => d.origen === 'MANUAL');
  ok(!!doc && doc.items['210-102'] === 480, 'pedido creado y 210-102 × 480 adentro (2 ventanas seguidas)');
  ok(!enOrden().includes('210-102') && st('210-102') === 'PROD_CHINA', 'y desapareció de la Orden Sugerida');
  p = ctx.window.__pcVetarRef(doc.id, norm(ctx, '210-102'));
  await responder('Mala calidad de tela');
  await p;
  await env.esperar(200);
  ok(st('210-102') === 'NO_TRAER' && doc.nRefs === 0, 'vetada DESDE el pedido: salió del pedido → 🚫 No traer');
  // devolverla: quitar veto (sin ventana) y verificar que vuelve
  ctx.window.__ntQuitar('210-102');
  await env.esperar(150);
  ok(enOrden().includes('210-102'), 'quitando el veto vuelve a la Orden Sugerida');
  // renombrar el pedido con la ventana nueva
  p = ctx.window.__pcRenombrar(doc.id);
  await responder('PRAGA151 contenedor 3');
  await p;
  await env.esperar(150);
  ok(doc.fileName === 'PRAGA151 contenedor 3', 'renombrado con la ventana nueva');
  // dejar un estado rico para la reapertura: PG0001 al pedido
  p = ctx.window.__pcAddPick(doc.id, 'PG0001', 240);
  await responder('240');
  await p;
  await env.esperar(300);
  ok(doc.items['pg0001'] === 240 && st('PG0001') === 'PROD_CHINA', 'PG0001 × 240 al pedido (sale de la orden)');

  console.log('\nE4 · CERRAR TORI y VOLVERLO A ABRIR con la misma bóveda del PC');
  // "se cierra el exe": el contexto muere. La bóveda (IndexedDB) y localStorage quedan en el PC.
  const bovedaPedidos = env.idb.leer('ToriPragaDB', 'macro', 'prodchina');
  const lsCopia = JSON.parse(JSON.stringify(env.lsData));
  const env2 = crearEntorno();
  env2.idb.sembrar('ToriPragaDB', 'macro', 'prodchina', JSON.parse(JSON.stringify(bovedaPedidos)));
  Object.keys(lsCopia).forEach(k => { env2.lsData[k] = lsCopia[k]; });
  env2.cargarBloque(B + '/bloque_0.js');
  env2.cargarBloque(B + '/bloque_1.js');
  env2.cargarBloque(B + '/bloque_3.js');
  env2.dispararDOMReady();
  await env2.esperar(2500);
  const T2 = env2.ctx.TORI;
  ok((T2.prodChina || []).length === 1 && T2.prodChina[0].fileName === 'PRAGA151 contenedor 3',
     'al reabrir, el pedido está: "PRAGA151 contenedor 3" (cargado solo desde la bóveda)');
  ok(T2.prodChina[0].items['pg0001'] === 240, 'con PG0001 × 240 adentro');
  const nt2 = JSON.parse(env2.lsData['praga_no_traer_v1'] || '{}');
  ok(nt2['313-94'] && nt2['313-94'].motivo === 'Defectos de pintura' && !nt2['210-102'],
     'la lista NO TRAER también está: 313-94 vetada, 210-102 (des-vetada) fuera');
  // y el Motor recalcula EXACTAMENTE igual que antes de cerrar
  vm.runInContext(SEMILLA_MOTOR, env2.ctx);
  env2.ctx.window.__motorRefresh();
  await env2.esperar(200);
  const S2 = env2.ctx.window.STATE;
  const st2 = (cod) => { const r = (S2.classified || []).find(x => x.codigo === cod); return r ? r.status : '(no está)'; };
  ok(st2('PG0001') === 'PROD_CHINA', 'al reabrir: PG0001 sigue FABRICÁNDOSE (fuera de la orden)');
  ok(st2('313-94') === 'NO_TRAER', 'al reabrir: 313-94 sigue vetada');
  ok(st2('210-102') === 'ORDENAR' && (S2.ordenar || []).some(r => r.codigo === '210-102'),
     'al reabrir: 210-102 (devuelta) sigue en la Orden Sugerida');
  const badge2 = env2.doc.getElementById('pcTabBadge');
  env2.ctx.renderProdChinaTab();
  ok(badge2.textContent === '1', 'la pestaña 🏭 del Motor muestra su badge = 1 al reabrir');

  console.log('');
  if (fallos) { console.log('✘ ' + fallos + ' FALLOS de ' + (pasos + fallos)); process.exit(1); }
  console.log('★ .EXE + REABRIR: las ' + pasos + ' verificaciones PASARON');
  process.exit(0);
})().catch(e => { console.error('✘ ERROR FATAL:', e); process.exit(1); });

function norm(ctx, s) { return vm.runInContext('norm(' + JSON.stringify(s) + ')', ctx); }
