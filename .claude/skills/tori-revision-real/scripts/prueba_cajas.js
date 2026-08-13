/**
 * prueba_cajas.js — v5_98 · editar CAJAS en el detalle de Producción China.
 * La cadena de la lógica de Andrés: cajas → unidades = cajas × und/caja →
 * m³ total = cajas × m³/caja → valor ¥ = unidades × precio. Modo .exe.
 */
'use strict';
const path = require('path');
const { crearEntorno } = require('/home/user/impraga-/.claude/skills/tori-engineering/scripts/entorno_tori');

const DIR = process.argv[2] || path.join(__dirname, 'bloques98');
let total = 0, ok = 0;
function check(nombre, cond, detalle) {
  total++;
  if (cond) { ok++; console.log('  ✔ ' + nombre); }
  else { console.log('  ✘ ' + nombre + (detalle ? ' — ' + detalle : '')); }
}

(async () => {
  const env = crearEntorno();
  env.ctx.prompt = env.ctx.window.prompt = () => { throw new Error('prompt() is not supported.'); };
  env.ctx.confirm = () => { throw new Error('confirm() nativo PROHIBIDO'); };
  env.cargarBloque(path.join(DIR, 'bloque_0.js'));
  env.cargarBloque(path.join(DIR, 'bloque_3.js'));
  env.dispararDOMReady();
  await env.esperar(2000);
  const W = env.ctx.window;

  const razones = [];
  const orig = W._triggerAutosaveFn;
  W._triggerAutosaveFn = (r) => { razones.push(r); if (orig) try { orig(r); } catch (e) {} };

  W.TORI.prodChina = [{
    id: 'cj1', fileName: 'pedido cajas', origen: 'MANUAL', fecha: 'hoy',
    items: { '313-122': 240, 'x-1': 100, 'y-2': 50 }, nRefs: 3, nUnids: 390,
    rows: [
      { ref: '313-122', desc: 'LAMPARA', descCn: '灯', unidCaja: 80, cajas: 3, unidades: 240, cubCaja: 0.2, cubTotal: 0.6, precio: 12, valor: 2880, proveedor: '6796', tier: 'B', dias: 39, tipo: 'LAMPARAS', contOrigen: '', isNew: false },
      { ref: 'X-1', desc: 'SIN EMPAQUE', descCn: '', unidCaja: '', cajas: '', unidades: 100, cubCaja: null, cubTotal: null, precio: '', valor: 0, proveedor: '', tier: '', dias: '', tipo: '', contOrigen: '', isNew: false },
      { ref: 'Y-2', desc: 'SIN PRECIO', descCn: '', unidCaja: 25, cajas: 2, unidades: 50, cubCaja: 0.1, cubTotal: 0.2, precio: '', valor: 0, proveedor: '', tier: '', dias: '', tipo: '', contOrigen: '', isNew: false },
    ],
  }];
  if (W._pcInvalidate) W._pcInvalidate();
  const doc = W.TORI.prodChina[0];
  const fila = doc.rows[0];

  console.log('— A. La cadena de la lógica al editar CAJAS —');
  await W.__pcSetCajas('cj1', '313-122', '5');
  check('A1: 5 cajas → unidades = 5 × 80 = 400', fila.cajas === 5 && fila.unidades === 400, JSON.stringify(fila));
  check('A2: m³ total = 5 × 0.2 = 1', fila.cubTotal === 1);
  check('A3: valor ¥ = 400 × 12 = 4800', fila.valor === 4800);
  check('A4: items/nUnids del pedido recalculados (400+100+50=550)', doc.items['313-122'] === 400 && doc.nUnids === 550, doc.nUnids);
  check('A5: guardado disparado (razón prod-china)', razones.includes('prod-china'), razones.join(','));

  await W.__pcSetCajas('cj1', '313-122', '2,5');
  check('A6: coma decimal a la colombiana: 2,5 cajas → 200 unidades, 0.5 m³', fila.cajas === 2.5 && fila.unidades === 200 && fila.cubTotal === 0.5, JSON.stringify(fila));

  const antes = JSON.stringify(fila);
  await W.__pcSetCajas('cj1', '313-122', 'abc');
  check('A7: cantidad inválida NO toca nada', JSON.stringify(fila) === antes);
  await W.__pcSetCajas('cj1', '313-122', '0');
  check('A8: cero tampoco (para sacar la ref está ↩/🚫)', JSON.stringify(fila) === antes);

  console.log('— B. Casos con datos incompletos —');
  const fx = doc.rows[1];
  await W.__pcSetCajas('cj1', 'x-1', '4');
  check('B1: sin und/caja en NINGUNA fuente → avisa y no cambia nada', fx.cajas === '' && fx.unidades === 100, JSON.stringify(fx));

  // ahora la base de cubicaje del Motor SÍ tiene el empaque → la cascada lo trae
  env.localStorage.setItem('praga_cubicaje_db_v1', JSON.stringify({ 'x-1': { unidEmpaque: 36, cubicaje: 0.15 } }));
  await new Promise(r => setTimeout(r, 600));
  await W.__pcSetCajas('cj1', 'x-1', '4');
  check('B2: con empaque en la base del Motor: 4 cajas → 144 unidades y empaque sanado en la fila', fx.cajas === 4 && fx.unidades === 144 && fx.unidCaja === 36, JSON.stringify(fx));
  check('B3: y el m³ total sale de la cascada (4 × 0.15 = 0.6)', fx.cubTotal === 0.6);

  const fy = doc.rows[2];
  await W.__pcSetCajas('cj1', 'y-2', '6');
  check('B4: sin precio: unidades y m³ se recalculan (150 und, 0.6 m³) y el valor queda quieto', fy.unidades === 150 && fy.cubTotal === 0.6 && fy.valor === 0, JSON.stringify(fy));

  console.log('— C. Editar unidades sigue vivo (cadena inversa) —');
  await W.__pcSetUnidades('cj1', '313-122', '160');
  check('C1: 160 unidades → 2 cajas (160/80), 0.4 m³, ¥1920', fila.unidades === 160 && fila.cajas === 2 && fila.cubTotal === 0.4 && fila.valor === 1920, JSON.stringify(fila));

  console.log('\nResultado: ' + ok + '/' + total + ' en verde');
  process.exit(ok === total ? 0 : 1);
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
