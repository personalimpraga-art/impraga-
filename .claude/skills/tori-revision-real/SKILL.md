---
name: tori-revision-real
description: Revisión de TORI en el ENTORNO REAL antes de entregar + el diccionario de las formas REALES de los datos de producción. Usar SIEMPRE antes de entregar cualquier versión de TORI_Praga_v5_XX.html, al escribir pruebas nuevas (para sembrar datos con la forma real, no la idealizada), y al tocar funciones que crucen datos entre módulos (Liquidador ↔ Motor ↔ Producción China ↔ Distribuidor). Nació de 4 bugs reales pagados el 2026-08-03 en producción.
---

# TORI · Revisión en el entorno real (lecciones pagadas el 2026-08-03)

En una sola sesión se escaparon 4 bugs que TODAS las pruebas de lógica pasaban
en verde. Los 4 tenían la misma raíz: **probar en un entorno o con datos que no
eran los de Andrés**. Esta skill existe para no repetirlos.

## 1. Los 4 bugs y su lección

| Bug | Causa raíz | Lección/regla |
|---|---|---|
| `prompt() is not supported` al vetar (v5_79) | `window.prompt()` NO existe en Electron; en Chrome sí, y las pruebas mockeaban un prompt que funcionaba | Flujos interactivos se prueban con `prompt()` LANZANDO el error (`throw`). `alert`/`confirm` sí existen. TODA captura de texto usa `toriPrompt` (bloque 0). Prohibido `prompt()` nativo — verificar 0 usos en cada versión |
| Clic en foto "no hacía nada" (v5_80) | El visor #lightbox vivía DENTRO de la pantalla PI2 (oculta desde el Motor): la lógica corría, pero invisible | No basta con que la función se ejecute: verificar VISIBILIDAD REAL en Chromium (`offsetParent`, `getBoundingClientRect`). Los overlays globales viven junto a #toast/#liqFacManager, nunca dentro de una pantalla |
| Días en "—" en toda la app (v5_84) | Las pruebas sembraban `dias` pero el macro REAL clasificado por el bloque 0 trae `diasRaw` | Sembrar pruebas con la FORMA REAL de los datos (§3), idealmente con los archivos de `muestras/`. Si un dato sale vacío en producción pero lleno en pruebas, sospechar del NOMBRE del campo |
| Cubicaje "—" con el dato en el Liquidador (v5_87) | El enriquecimiento solo miraba el macro; el dato vivía en las facturas | Los datos de TORI viven en VARIAS fuentes: todo lookup nuevo debe ser una CASCADA (§4). Si Andrés ve el dato en una pantalla y no en otra, es integración faltante, no dato faltante |

## 1b. Lecciones pagadas el 2026-08-04 (sesión v5_89 → v5_99)

| Bug/reporte | Causa raíz | Lección/regla |
|---|---|---|
| "No aparece la información y ya está en el Liquidador" (yugin 147: 145/190 refs con cubicaje 0) | El macro traía cubicaje EN 0 y la cascada tomaba el 0 como dato válido — se detenía sin llegar a la factura; los 0 GUARDADOS en filas tampoco se sanaban | **0 no es dato** en cubicaje/unid-caja/cajas/precio: es hueco y la cascada sigue. Al sembrar pruebas, incluir el caso "celda en 0" además de "celda vacía" |
| "Tarda mucho en guardar / se tilda" al mandar refs 🏭 una por una | Cada Aceptar recalculaba TODO el Motor (0,5–1,7s) y re-agendaba el respaldo a disco CON TODAS las fotos | MEDIR antes de arreglar (latido de 50ms para congelamientos + contador de escrituras). El respaldo con fotos jamás se reescribe por clic. No leer el archivo de respaldo A MITAD de escritura: parece viejo (falsa alarma de datos perdidos) |
| "Queda congelado para buscar" tras el envío masivo (solo en el .exe) | `confirm()` NATIVO en Electron roba el foco del teclado al cerrarse — en Chrome no pasa, la simulación no lo reproducía | Ningún diálogo nativo en flujos repetitivos: `toriConfirm`/`toriPrompt`. En los arneses de esos flujos, stubear `confirm` para que LANCE error |
| Falsos fallos del propio arnés | `offsetParent` es null en elementos `position:fixed`; los conteos van formateados es-CO ("1.577") | Visibilidad de overlays con `getBoundingClientRect().width>0`; comparar conteos con `toLocaleString('es-CO')` |
| Clave nueva de persistencia no llegaba al archivo de disco | Hay TRES listas lsKeys en el archivo (formatos distintos) | Extender SIEMPRE la prueba round-trip con la clave nueva ANTES de entregar — en v5_95 la prueba extendida atrapó la 3ª lista |

## 2. El ritual de revisión ANTES de entregar (además de validar_todo.sh)

1. **Chromium real** con TORI servido como el .exe: vendor inyectado antes del tag
   CDN, CDN bloqueado (`page.route('**cdnjs**', abort)`). Plantilla:
   `scripts/plantilla_browser.js` (recibe el HTML por argumento).
2. **Clics de usuario de verdad** sobre lo nuevo (`page.click`, `keyboard.type`),
   verificando el RESULTADO VISIBLE (orden de filas en pantalla, foco conservado,
   elemento visible), no solo el estado interno.
3. **Panel de diagnóstico en CERO**: `TORI.diagErrors === 0` al final de la sesión
   de clics + `page.on('pageerror')` vacío. Si hay 1 error, NO se entrega.
4. **Modo .exe**: correr también con `window.prompt = () => { throw ... }`.
5. **Cerrar y reabrir**: para cambios de persistencia, segundo entorno con la misma
   bóveda (IndexedDB + localStorage copiados) → los datos deben volver idénticos.
6. Para revelar la UI del Motor sin subir macro (pruebas browser):
   `uploadScreen.style.display='none'; appShell.classList.remove('hidden'); motorTabsWrap.style.display='block'`.

## 3. FORMAS REALES de los datos (sembrar pruebas con ESTO, no con lo bonito)

- **`TORI.classified`** (macro clasificado por el bloque 0): `{ codigo, nombre,
  grupo, categoria, saldo, ocPend, `**`diasRaw`**` (NO dias), tier, status, cajas,
  unidPedir, cubPedir, unidEmpaque, cubicaje, `**`contenedor`**` (origen, ej. "0165"),
  fEntrada (Date), cantEntrada }`. El bloque 1 (`STATE.classified`) sí agrega `dias`.
- **Filas de factura del Liquidador** (`TORI.facturas[].rows[]`): `{ ARTICULO,
  DESCRIPCION, CTNS, QTY_CTN (und/caja), CANTIDAD_TOTAL, PRECIO (¥), TOTAL_CBM,
  FOTO (dataURL), GANANCIA }`. Cubicaje por caja = `TOTAL_CBM / CTNS`. El nombre
  de la factura (`f.name`) es el contenedor de origen (ej. "2026-01-07 PRAGA-132").
- **Doc de Producción China**: `{ id, fileName, fecha, origen?
  ('DISTRIBUIDOR'|'MANUAL'|ausente=archivo), items: {refNorm→unds} (¡claves con
  norm(), minúsculas!), nRefs, nUnids, rows?: [{ref, desc, descCn, unidCaja, cajas,
  unidades, cubCaja, cubTotal, precio, valor, proveedor, tier, dias, tipo,
  contOrigen, isNew}] }`. items SIEMPRE se recalcula desde rows tras editar.
- **`praga_china_db_v1`**: `{ refNorm: { codigo (bonito), descripcionChina,
  precioRMB, fecha, fuente, historial[], proveedor } }`.
- **`praga_cubicaje_db_v1`**: `{ refNorm: { cubicaje (por caja), unidEmpaque } }`.
- **`praga_no_traer_v1`**: `{ refNorm: { codigo, nombre, motivo, fecha } }`.
- **`tori_dist_overrides`**: `{ 'BOLSO': 12, ... }` (claves MAYÚSCULAS; defaults
  junta: BOLSO/BILLETERA/CORREA/RIÑONERA=12, CORTINA DE BAÑO=20).
- Mejor aún: usar los archivos REALES de `muestras/` (factura PRAGA145 con fotos,
  macro 03/08/2026) pasándolos por los parsers reales.

## 4. La cascada de fuentes (regla de integración)

Para CUALQUIER dato de una referencia, el orden es: **lo que la fila guardada ya
trae (nunca pisarlo) → macro vigente → base del Motor correspondiente
(china/cubicaje/costos) → facturas del Liquidador**. Ya implementado en el bloque 0:
`_pcEmpaqueDe` (unidCaja/cubCaja/contFac, con caché `_pcEmpCacheMap` invalidado en
`_fotoInvalidate`), `_pcTabInfoRef` (tier/dias/empaque resueltos), `_pcRefrescarRows`
(refresca Tier/Días y rellena huecos antes de cada Excel). Reusar estos helpers;
no inventar lookups de una sola fuente.

## 5. Trampa de nueva_version.py (anclas de parche)

El bump renumera TODO comentario que diga la versión corriente (un comentario
"v5.84" escrito en v5_84 se vuelve "v5.85", "v5.86"… en cada bump). Regla: las
anclas de parche NO deben incluir comentarios con número de versión — o buscarlos
con regex `v5\.\d+`. Y los comentarios nuevos que uno escribe van a driftear:
no anclarse a ellos en versiones futuras.

## 5b. Arneses listos en `scripts/` (sesión 2026-08-04 — reusar, no reconstruir)

Todos reciben el HTML o el dir de bloques por argumento (`node <script> <ruta>`):
- `prueba_browser_v5_89.js` filtros marroquinería/PG + envío masivo 🏭 (29 checks)
- `prueba_browser_v5_90.js` caso 147: vista sanada + 📗 Excel releído (12)
- `prueba_browser_v5_91.js` columna/orden/buscador por proveedor + Excel (15)
- `prueba_browser_v5_94.js` listas YUGIN/YUFUN releídas (11)
- `prueba_browser_v5_95.js` segunda oportunidad 🔄 punta a punta (12)
- `prueba_browser_v5_96.js` faltantes incluyen lo fabricándose (7)
- `prueba_browser_v5_98.js` cajas editables + guardar al cerrar (10)
- Baterías Node (entorno_tori de tori-engineering): `prueba_filtros_masivo.js` (27),
  `prueba_caso_147.js` (16), `prueba_proveedor.js` (14), `prueba_segunda_oport.js` (18),
  `prueba_cajas.js` (13), `prueba_backup_ext.js` (round-trip CON tori_segunda_oport_v1)
- `perfil_completo.js` perfilador de rendimiento: macro real + fotos sintéticas a
  escala + respaldo OPFS enlazado (siembra el handle en IDB praga_fsa_v1 ANTES del
  boot), latido anti-congelamiento y contador de escrituras (PAUSA/COLA por env)
- En este entorno: playwright en `/opt/node22/lib/node_modules/playwright`,
  Chromium en `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, exceljs local
  con `npm install exceljs --prefix ./lib`

## 6. Infraestructura ya montada (no reconstruir de cero)

- Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` + `playwright-core`
  (instalar en `/home/claude/lib` si falta, igual que `exceljs`).
- Vendor offline para servir como el .exe: `desktop/vendor/` del repo.
- `scripts/plantilla_browser.js` (esta skill): arneses de servidor+Chromium listos.
- `scripts/prueba_electron_reabrir.js` (esta skill): patrón "prompt roto + cerrar
  y reabrir con la misma bóveda" — adaptar rutas de bloques por argumento.
- Las baterías de la sesión 2026-08-03 (editor, coherencia, guardado, filtros,
  cascada…) quedaron descritas en CLAUDE.md §6 (v5_76 a v5_88): al tocar esas
  zonas, reconstruir la prueba equivalente sobre `entorno_tori.js` de tori-engineering.
