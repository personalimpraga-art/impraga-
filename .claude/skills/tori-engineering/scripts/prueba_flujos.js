/**
 * prueba_flujos.js — FLUJOS VIVOS (§6): llamar funciones REALES y verificar que
 * cada acción dispara el autosave y que el archivo de disco refleja el cambio
 * (lo subido está, lo borrado no está, lo cambiado quedó).
 *
 * Flujos probados:
 *   A. saveToriParams (inputs seteados en el DOM) → autosave 'liq-params' + params en el archivo.
 *   B. deleteLiqFactura (confirm mockeado en true) → autosave 'factura-eliminada' + la factura YA NO está.
 *
 * Uso:  node prueba_flujos.js [dir_bloques]        (default /tmp/tori_bloques)
 */
'use strict';
const path = require('path');
const { crearEntorno } = require('./entorno_tori');

async function main() {
  const dirBloques = process.argv[2] || '/tmp/tori_bloques';
  let ok = true;
  const capturas = [];
  const razones = [];

  const env = crearEntorno();
  env.idb.sembrar('praga_fsa_v1', 'data', 'fileHandle', {
    name: 'TORI_PRAGA_backup.json', kind: 'file',
    queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    createWritable: async () => ({ write: async d => capturas.push(String(d)), close: async () => {} }),
  });
  env.cargarBloque(path.join(dirBloques, 'bloque_0.js'));
  env.cargarBloque(path.join(dirBloques, 'bloque_3.js'));
  await env.esperar(400);

  // Espía sobre el autosave real (patrón del §6: envolver _triggerAutosaveFn)
  const orig = env.ctx._triggerAutosaveFn;
  env.ctx.window._triggerAutosaveFn = function (razon) { razones.push(razon); if (orig) orig(razon); };

  const T = env.ctx.TORI;
  T.facturas = [
    { name: 'F_BORRAR.xlsx', loaded: '2026-01-01T00:00:00Z', params: {}, meta: null, rows: [{ REFERENCIA: 'X1', UNIDADES: 5 }] },
    { name: 'F_QUEDA.xlsx', loaded: '2026-01-02T00:00:00Z', params: {}, meta: null, rows: [{ REFERENCIA: 'X2', UNIDADES: 9 }] },
  ];
  env.ctx.window._toriDatosListos = true;

  // ── FLUJO A: saveToriParams con inputs reales ──
  const set = (id, v) => { env.doc.getElementById(id).value = String(v); };
  set('pYuanDolar', 7.33); set('pDolarPeso', 4321); set('pComision', 4); set('pEnvio', 2.5); set('pGanancia', 33);
  env.ctx.saveToriParams();
  const pOK = T.params && Math.abs(T.params.yd - 7.33) < 1e-9 && T.params.dp === 4321;
  const lsOK = JSON.parse(env.localStorage.getItem('tori_params') || '{}').dp === 4321;
  const razonA = razones.includes('liq-params');
  console.log(pOK ? '✔ A1: saveToriParams actualizó TORI.params EN MEMORIA (invariante 2)' : '✘ A1: TORI.params no se actualizó → ' + JSON.stringify(T.params));
  console.log(lsOK ? '✔ A2: tori_params en localStorage coincide' : '✘ A2: localStorage desincronizado');
  console.log(razonA ? "✔ A3: disparó autosave 'liq-params'" : '✘ A3: no disparó autosave (razones: ' + razones.join(',') + ')');
  ok = ok && pOK && lsOK && razonA;

  // ── FLUJO B: deleteLiqFactura con confirm=true ──
  env.ctx.window.confirm = () => true;
  await env.ctx.deleteLiqFactura('F_BORRAR.xlsx');
  await env.esperar(300);
  const borrada = !T.facturas.some(f => f.name === 'F_BORRAR.xlsx');
  const queda = T.facturas.some(f => f.name === 'F_QUEDA.xlsx');
  const razonB = razones.includes('factura-eliminada');
  console.log(borrada ? '✔ B1: la factura borrada YA NO está en memoria' : '✘ B1: la factura sigue viva');
  console.log(queda ? '✔ B2: la otra factura sigue intacta' : '✘ B2: se borró de más');
  console.log(razonB ? "✔ B3: disparó autosave 'factura-eliminada'" : '✘ B3: no disparó autosave (razones: ' + razones.join(',') + ')');
  ok = ok && borrada && queda && razonB;

  // ── El archivo de disco refleja el estado final ──
  await env.ctx._fsaWriteNow();
  await env.esperar(300);
  const snap = JSON.parse(capturas[capturas.length - 1] || '{}');
  const facs = ((snap.secciones || {}).liquidador || {}).facturas || [];
  const discoOK = !facs.some(f => f.name === 'F_BORRAR.xlsx') && facs.some(f => f.name === 'F_QUEDA.xlsx')
    && snap.secciones.liquidador.params.dp === 4321;
  console.log(discoOK ? '✔ C1: el archivo de disco refleja el cambio (borrada fuera, params nuevos dentro)' : '✘ C1: el archivo de disco NO refleja el estado');
  ok = ok && discoOK;

  console.log(ok ? '\n★ FLUJOS VIVOS: PASARON' : '\n★ FLUJOS VIVOS: FALLARON');
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
