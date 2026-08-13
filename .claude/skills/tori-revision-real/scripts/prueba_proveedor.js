/**
 * prueba_proveedor.js — v5_91
 * Columna Proveedor en la Orden de Compra: visible, con el dato de la base
 * Datos China, ordenable ▲▼ (agrupa por proveedor), sin proveedor al final,
 * y conviviendo con los filtros de marroquinería/PG de v5_89.
 */
'use strict';
const path = require('path');
const { crearEntorno } = require('/home/user/impraga-/.claude/skills/tori-engineering/scripts/entorno_tori');

const DIR = process.argv[2] || path.join(__dirname, 'bloques91');
let total = 0, ok = 0;
function check(nombre, cond, detalle) {
  total++;
  if (cond) { ok++; console.log('  ✔ ' + nombre); }
  else { console.log('  ✘ ' + nombre + (detalle ? ' — ' + detalle : '')); }
}

function filas(env) {
  const html = env.doc.getElementById('ordenTableBody').innerHTML || '';
  const out = [];
  const re = /<td class="mono"><b>([^<]+)<\/b>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

(async () => {
  const env = crearEntorno();
  env.ctx.prompt = env.ctx.window.prompt = () => { throw new Error('prompt() is not supported.'); };
  // Base Datos China REAL (praga_china_db_v1) con proveedores — claves norm()
  env.localStorage.setItem('praga_china_db_v1', JSON.stringify({
    '210-102': { codigo: '210-102', descripcionChina: '手袋', precioRMB: 5, proveedor: 'YUGIN', historial: [] },
    '310-001': { codigo: '310-001', descripcionChina: '浴帘', precioRMB: 3, proveedor: 'ALIBABA-ZHANG', historial: [] },
    'pg0001':  { codigo: 'PG0001', descripcionChina: '钱包', precioRMB: 4, proveedor: 'PG SHOP', historial: [] },
    '610-001': { codigo: '610-001', descripcionChina: '首饰盒', precioRMB: 7, proveedor: 'YUGIN', historial: [] },
  }));
  env.cargarBloque(path.join(DIR, 'bloque_0.js'));
  env.cargarBloque(path.join(DIR, 'bloque_1.js'));
  env.cargarBloque(path.join(DIR, 'bloque_3.js'));
  env.dispararDOMReady();
  await env.esperar(2200);
  const W = env.ctx.window;

  W.STATE.ordenar = [
    { codigo: '210-102', nombre: 'BOLSO DAMA', categoria: 'BOLSOS', tier: 'A', dias: 20, status: 'ORDENAR', unidPedir: 120, cubPedir: 1.2, cajas: 10 },
    { codigo: '310-001', nombre: 'CORTINA DE BAÑO', categoria: 'CORTINAS', tier: 'A', dias: 15, status: 'ORDENAR', unidPedir: 200, cubPedir: 2.0, cajas: 10 },
    { codigo: 'PG0001', nombre: 'BILLETERA CABALLERO', categoria: 'BILLETERAS', tier: 'A', dias: 25, status: 'ORDENAR', unidPedir: 96, cubPedir: 0.4, cajas: 4 },
    { codigo: '610-001', nombre: 'JOYERO MADERA', categoria: 'JOYEROS', tier: 'B', dias: 55, status: 'ORDENAR', unidPedir: 40, cubPedir: 0.3, cajas: 5 },
    { codigo: '999-99', nombre: 'ESPEJO PARED', categoria: 'ESPEJOS', tier: 'C', dias: 80, status: 'ORDENAR', unidPedir: 30, cubPedir: 0.2, cajas: 3 },
  ];
  W.STATE.excluidos = [];
  W.STATE.ordenView = 'ORDEN';
  env.doc.getElementById('grupoFilter').value = 'TODOS';
  env.doc.getElementById('searchInput').value = '';

  W.__ordenSetMarro('TODO'); // pinta

  const head = env.doc.getElementById('ordenTableHead').innerHTML;
  check('P1: el encabezado tiene la columna Proveedor ORDENABLE (data-sort=proveedorChina)', head.indexOf('data-sort="proveedorChina"') >= 0 && head.indexOf('>Proveedor<') >= 0);
  check('P2: Proveedor va entre Contenedor y 🏭', head.indexOf('data-sort="contenedor"') < head.indexOf('data-sort="proveedorChina"'));

  const body = env.doc.getElementById('ordenTableBody').innerHTML;
  check('P3: las celdas muestran el proveedor de la base China (YUGIN, ALIBABA-ZHANG, PG SHOP)',
    body.indexOf('YUGIN') >= 0 && body.indexOf('ALIBABA-ZHANG') >= 0 && body.indexOf('PG SHOP') >= 0);
  check('P4: la ref sin proveedor muestra —', /999-99[\s\S]*?C7C7CC/.test(body));
  const nCols = (env.doc.getElementById('ordenTableHead').innerHTML.match(/<th/g) || []).length;
  const nTds = ((body.match(/<td/g) || []).length) / 5;
  check('P5: cada fila tiene tantas celdas como columnas el encabezado (' + nCols + ')', nTds === nCols, 'tds/fila=' + nTds);

  // Orden por proveedor: clic = STATE.sort (mismo mecanismo de los demás encabezados)
  W.STATE.sort = { field: 'proveedorChina', dir: 1 };
  W.__ordenSetMarro('TODO'); // re-pinta
  let orden = filas(env);
  check('P6: ▲ agrupa por proveedor alfabético: ALIBABA-ZHANG → PG SHOP → YUGIN,YUGIN → sin proveedor al final',
    orden.join(',') === '310-001,PG0001,210-102,610-001,999-99', orden.join(','));
  check('P7: los dos de YUGIN quedan JUNTOS', Math.abs(orden.indexOf('210-102') - orden.indexOf('610-001')) === 1);

  W.STATE.sort = { field: 'proveedorChina', dir: -1 };
  W.__ordenSetMarro('TODO');
  orden = filas(env);
  check('P8: ▼ invierte (YUGIN primero) y el sin-proveedor sigue al final',
    orden[0] === '210-102' || orden[0] === '610-001', orden.join(','));
  check('P9: sin proveedor SIEMPRE al final aunque se invierta', orden[orden.length - 1] === '999-99', orden.join(','));

  // Convive con los filtros v5_89
  W.STATE.sort = { field: 'proveedorChina', dir: 1 };
  W.__ordenSetMarro('SOLO');
  orden = filas(env);
  check('P10: Solo marroquinería + orden por proveedor: PG SHOP → YUGIN (bolso) → sin prov', orden.join(',') === 'PG0001,210-102', orden.join(','));
  W.__ordenSetMarro('TODO');
  // (el Excel de la orden con la columna Proveedor se verifica en el browser, releyendo el archivo)

  // v5_93: el buscador también encuentra por PROVEEDOR
  W.STATE.sort = { field: null, dir: 1 };
  env.doc.getElementById('searchInput').value = 'yugin';
  W.__ordenSetPG('TODO'); // re-pinta con el buscador puesto
  let porProv = filas(env);
  check('P11: buscar "yugin" filtra por proveedor (las 2 refs de YUGIN)',
    porProv.length === 2 && porProv.includes('210-102') && porProv.includes('610-001'), porProv.join(','));
  env.doc.getElementById('searchInput').value = 'pg shop';
  W.__ordenSetPG('TODO');
  porProv = filas(env);
  check('P12: buscar "pg shop" da la ref de ese proveedor', porProv.length === 1 && porProv[0] === 'PG0001', porProv.join(','));
  env.doc.getElementById('searchInput').value = 'espejo';
  W.__ordenSetPG('TODO');
  porProv = filas(env);
  check('P13: buscar por nombre sigue igual ("espejo" → 999-99)', porProv.length === 1 && porProv[0] === '999-99', porProv.join(','));
  env.doc.getElementById('searchInput').value = 'yugin';
  W.__ordenSetMarro('SOLO');
  porProv = filas(env);
  check('P14: proveedor + Solo marroquinería combinan (solo el bolso de YUGIN)', porProv.length === 1 && porProv[0] === '210-102', porProv.join(','));
  env.doc.getElementById('searchInput').value = '';
  W.__ordenSetMarro('TODO');

  console.log('\nResultado: ' + ok + '/' + total + ' en verde');
  process.exit(ok === total ? 0 : 1);
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
