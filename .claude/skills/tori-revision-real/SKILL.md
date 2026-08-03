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
