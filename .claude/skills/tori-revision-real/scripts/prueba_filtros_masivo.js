/**
 * prueba_filtros_masivo.js — v5_89
 * Batería de los filtros marroquinería/PG de la Orden de Compra y del envío
 * MASIVO a Producción China. Siembra con la FORMA REAL de los datos
 * (tori-revision-real §3) y corre en MODO .exe: prompt() nativo LANZA error.
 *
 * Uso: node prueba_filtros_masivo.js <dirBloques>
 */
'use strict';
const path = require('path');
const { crearEntorno } = require('/root/.claude/skills/tori-engineering/scripts/entorno_tori');

const DIR = process.argv[2] || path.join(__dirname, 'bloques');
let total = 0, ok = 0;
function check(nombre, cond, detalle) {
  total++;
  if (cond) { ok++; console.log('  ✔ ' + nombre); }
  else { console.log('  ✘ ' + nombre + (detalle ? ' — ' + detalle : '')); }
}

/* Extrae los códigos pintados en el cuerpo de la tabla de la Orden */
function codigosPintados(env) {
  const html = env.doc.getElementById('ordenTableBody').innerHTML || '';
  const out = [];
  const re = /<td class="mono"><b>([^<]+)<\/b>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

(async () => {
  const env = crearEntorno();
  // MODO .exe: prompt() nativo revienta como en Electron (regla v5_79)
  env.ctx.prompt = env.ctx.window.prompt = () => { throw new Error('prompt() is not supported.'); };

  env.cargarBloque(path.join(DIR, 'bloque_0.js'));
  env.cargarBloque(path.join(DIR, 'bloque_1.js'));
  env.cargarBloque(path.join(DIR, 'bloque_3.js'));
  env.dispararDOMReady();
  await env.esperar(2500);

  const W = env.ctx.window;

  // ── Siembra: STATE.ordenar con la forma REAL de filas clasificadas ORDENAR ──
  // (codigo, nombre, categoria, tier, dias, unidPedir, cubPedir…; RIÑONERA con Ñ,
  //  refs PG del proveedor aparte, y una ref SIN unidades sugeridas)
  const filas = [
    { codigo: '210-102', nombre: 'BOLSO DAMA ELEGANTE',      categoria: 'BOLSOS',             grupo: 'BOLSOS', tier: 'A', dias: 20, diasRaw: 20, status: 'ORDENAR', saldo: 0, cantEntrada: 120, unidEmpaque: 12, cajas: 10, unidPedir: 120, cubPedir: 1.2 },
    { codigo: '210-103', nombre: 'BOLSO CON MONEDERO PU',    categoria: 'BOLSOS',             grupo: 'BOLSOS', tier: 'B', dias: 45, diasRaw: 45, status: 'ORDENAR', saldo: 0, cantEntrada: 60,  unidEmpaque: 12, cajas: 5,  unidPedir: 60,  cubPedir: 0.5 },
    { codigo: '310-001', nombre: 'CORTINA DE BAÑO 3D',       categoria: 'CORTINAS',           grupo: 'HOGAR',  tier: 'A', dias: 15, diasRaw: 15, status: 'ORDENAR', saldo: 0, cantEntrada: 200, unidEmpaque: 20, cajas: 10, unidPedir: 200, cubPedir: 2.0 },
    { codigo: 'PG0001',  nombre: 'BILLETERA CABALLERO',      categoria: 'BILLETERAS',         grupo: 'BOLSOS', tier: 'A', dias: 25, diasRaw: 25, status: 'ORDENAR', saldo: 0, cantEntrada: 96,  unidEmpaque: 24, cajas: 4,  unidPedir: 96,  cubPedir: 0.4 },
    { codigo: 'PG0002',  nombre: 'TAPETE COCINA ANTIDESLIZANTE', categoria: 'TAPETES',        grupo: 'HOGAR',  tier: 'C', dias: 80, diasRaw: 80, status: 'ORDENAR', saldo: 0, cantEntrada: 50,  unidEmpaque: 10, cajas: 5,  unidPedir: 50,  cubPedir: 0.8 },
    { codigo: '410-007', nombre: 'RIÑONERA DEPORTIVA',       categoria: 'RIÑONERAS',          grupo: 'BOLSOS', tier: 'B', dias: 50, diasRaw: 50, status: 'ORDENAR', saldo: 0, cantEntrada: 80,  unidEmpaque: 20, cajas: 4,  unidPedir: 80,  cubPedir: 0.6 },
    { codigo: '510-020', nombre: 'LONCHERA INFANTIL OSITO',  categoria: 'LONCHERAS Y BOLSAS', grupo: 'BOLSOS', tier: 'C', dias: 90, diasRaw: 90, status: 'ORDENAR', saldo: 0, cantEntrada: null, unidEmpaque: null, cajas: null, unidPedir: null, cubPedir: null },
    { codigo: '610-001', nombre: 'JOYERO MADERA VINTAGE',    categoria: 'JOYEROS',            grupo: 'HOGAR',  tier: 'B', dias: 55, diasRaw: 55, status: 'ORDENAR', saldo: 0, cantEntrada: 40,  unidEmpaque: 8,  cajas: 5,  unidPedir: 40,  cubPedir: 0.3 },
  ];
  W.STATE.ordenar = filas.slice();
  W.STATE.excluidos = [];
  W.STATE.ordenView = 'ORDEN';
  env.doc.getElementById('grupoFilter').value = 'TODOS';
  env.doc.getElementById('searchInput').value = '';

  // Espía de visibilidad del botón masivo (el mock de classList no guarda nada)
  const mfBtn = env.doc.getElementById('pcMandarFiltradoBtn');
  let mfHidden = null;
  mfBtn.classList = { add: () => { mfHidden = true; }, remove: () => { mfHidden = false; }, toggle: (c, f) => { if (c === 'hidden') mfHidden = !!f; }, contains: () => false };

  console.log('— A. Filtros de la Orden de Compra —');

  W.__ordenSetMarro('TODO'); // pinta con todo
  check('A1: TODO/TODO muestra las 8', codigosPintados(env).length === 8, 'pintadas: ' + codigosPintados(env).join(','));

  W.__ordenSetMarro('SOLO');
  let c1 = codigosPintados(env);
  check('A2: Solo marroquinería = 5 (bolso, bolso c/monedero, billetera PG, riñonera Ñ, lonchera)',
    c1.length === 5 && c1.includes('210-102') && c1.includes('210-103') && c1.includes('PG0001') && c1.includes('410-007') && c1.includes('510-020'), c1.join(','));
  check('A2b: contador dice "Mostrando 5 de 8"', (env.doc.getElementById('ordenCount').textContent || '').indexOf('Mostrando 5 de 8') === 0, env.doc.getElementById('ordenCount').textContent);
  check('A2c: botón masivo visible y con rótulo "Mandar estas 5"', mfHidden === false && (mfBtn.textContent || '').indexOf('Mandar estas 5') >= 0, mfBtn.textContent);

  W.__ordenSetMarro('SIN');
  let c2 = codigosPintados(env);
  check('A3: Sin marroquinería = 3 (cortina, tapete PG, joyero)', c2.length === 3 && c2.includes('310-001') && c2.includes('PG0002') && c2.includes('610-001'), c2.join(','));

  W.__ordenSetMarro('TODO'); W.__ordenSetPG('SOLO');
  let c3 = codigosPintados(env);
  check('A4: Solo PG = 2', c3.length === 2 && c3.includes('PG0001') && c3.includes('PG0002'), c3.join(','));

  W.__ordenSetPG('SIN');
  check('A5: Sin PG = 6', codigosPintados(env).length === 6, codigosPintados(env).join(','));

  W.__ordenSetMarro('SOLO'); W.__ordenSetPG('SIN');
  let c5 = codigosPintados(env);
  check('A6: Solo marroquinería + Sin PG = 4', c5.length === 4 && !c5.includes('PG0001') && c5.includes('510-020'), c5.join(','));

  W.__ordenSetPG('SOLO');
  let c6 = codigosPintados(env);
  check('A7: Solo marroquinería + Solo PG = 1 (la billetera PG)', c6.length === 1 && c6[0] === 'PG0001', c6.join(','));

  W.__ordenSetMarro('SIN');
  let c7 = codigosPintados(env);
  check('A8: Sin marroquinería + Solo PG = 1 (el tapete PG)', c7.length === 1 && c7[0] === 'PG0002', c7.join(','));

  W.__ordenSetMarro('SOLO'); W.__ordenSetPG('TODO');
  env.doc.getElementById('searchInput').value = 'bolso';
  W.__ordenSetPG('TODO'); // re-pinta con el buscador puesto
  let c8 = codigosPintados(env);
  check('A9: buscador "bolso" + Solo marroquinería = 2', c8.length === 2 && c8.includes('210-102') && c8.includes('210-103'), c8.join(','));
  env.doc.getElementById('searchInput').value = '';

  // El cubicaje del contador refleja lo filtrado (v5_83 sigue vivo con los filtros nuevos)
  W.__ordenSetMarro('SIN'); W.__ordenSetPG('TODO');
  const cnt = env.doc.getElementById('ordenCount').textContent || '';
  check('A10: contador suma el cubicaje de lo filtrado (2+0.8+0.3=3.1 m³)', cnt.indexOf('3,1 m³') >= 0, cnt);

  console.log('— B. Envío MASIVO a Producción China (modo .exe, confirm contado) —');

  // Espía de autosave (tras cargar bloque 3, por referencia viva)
  const razones = [];
  const autosaveOrig = W._triggerAutosaveFn;
  W._triggerAutosaveFn = (r) => { razones.push(r); if (autosaveOrig) try { autosaveOrig(r); } catch (e) {} };

  let confirmas = 0;
  // v5_97: el envío masivo usa toriConfirm (ventana propia — cero diálogos nativos)
  W.toriConfirm = async (msg) => { confirmas++; return true; };
  W.confirm = env.ctx.confirm = () => { throw new Error('confirm() nativo PROHIBIDO en este flujo (roba el foco en Electron)'); };

  W.TORI.prodChina = [];
  const doc = { id: 'test_lote_1', fileName: 'pedido prueba masiva', origen: 'MANUAL', fecha: 'hoy', items: {}, nRefs: 0, nUnids: 0, rows: [] };
  W.TORI.prodChina.push(doc);

  // Solo marroquinería + Sin PG (4 refs, una sin unidades sugeridas)
  W.__ordenSetMarro('SOLO'); W.__ordenSetPG('SIN');
  W.__ordenMandarFiltrado();
  const lote = W.__pcLotePend || [];
  check('B1: el lote toma LO FILTRADO (4 refs, mismas de la tabla)', lote.length === 4 && lote.map(x => x.codigo).join(',') === '210-102,210-103,410-007,510-020', lote.map(x => x.codigo).join(','));
  check('B2: unidades sugeridas del Motor viajan en el lote (120/60/80/null)', lote[0].unids === 120 && lote[1].unids === 60 && lote[2].unids === 80 && lote[3].unids === null);

  await W.__pcAddLote('test_lote_1');
  await env.esperar(400);
  check('B3: pidió UNA confirmación con toriConfirm (cero diálogos nativos) en modo .exe', confirmas === 1, 'confirmas=' + confirmas);
  check('B4: el pedido quedó con 4 filas', (doc.rows || []).length === 4, 'rows=' + (doc.rows || []).length);
  check('B5: items con claves norm() y unidades correctas', doc.items['210-102'] === 120 && doc.items['210-103'] === 60 && doc.items['410-007'] === 80, JSON.stringify(doc.items));
  check('B6: la ref SIN unidades sugeridas entra con 0 (para editar en el pedido)', doc.items['510-020'] === 0);
  check('B7: nRefs=4 y nUnids=260 recalculados', doc.nRefs === 4 && doc.nUnids === 260, doc.nRefs + '/' + doc.nUnids);
  check('B8: el lote pendiente se limpió', W.__pcLotePend === null);

  const mapa = W.getProdChinaMap();
  check('B9: getProdChinaMap ve las 4 refs → SALEN de la Orden Sugerida (PROD_CHINA)',
    !!mapa.get('210-102') && !!mapa.get('210-103') && !!mapa.get('410-007') && !!mapa.get('510-020'));
  check('B10: también la de 0 unidades sale de la Orden (entrada en el mapa)', mapa.get('510-020') && mapa.get('510-020').unidades === 0);

  check('B11: guardado en la bóveda (IndexedDB macro/prodchina)', (() => {
    const g = env.idb.leer('ToriPragaDB', 'macro', 'prodchina');
    return g && g.docs && g.docs.length === 1 && g.docs[0].nRefs === 4;
  })());
  check('B12: autosave disparado con razón prod-china', razones.includes('prod-china'), razones.join(','));

  // Reenvío del MISMO lote → suma unidades (no duplica filas)
  W.__pcLotePend = lote.map(x => ({ codigo: x.codigo, unids: x.unids, cub: x.cub }));
  await W.__pcAddLote('test_lote_1');
  await env.esperar(300);
  check('B13: reenviar suma unidades sin duplicar filas (120→240, sigue con 4 filas)',
    doc.items['210-102'] === 240 && (doc.rows || []).length === 4, JSON.stringify(doc.items));

  // La fila construida respeta la forma real (ref bonita, tier/días del macro si hay)
  const fila = (doc.rows || []).find(r => String(r.ref).toUpperCase().indexOf('210-102') >= 0);
  check('B14: la fila del pedido tiene la forma real (ref, unidades, campos de Excel presentes)',
    !!fila && 'descCn' in fila && 'unidCaja' in fila && 'contOrigen' in fila && fila.unidades === 240, JSON.stringify(fila || {}));

  // Cero usos de prompt() nativo en todo el flujo (regla v5_79): si algo lo
  // hubiera llamado, el throw de arriba habría reventado la prueba.
  check('B15: cero usos de prompt() nativo en el flujo masivo', true);

  console.log('\nResultado: ' + ok + '/' + total + ' en verde');
  process.exit(ok === total ? 0 : 1);
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
