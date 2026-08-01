# MAPA TÉCNICO DE TORI (verificado contra el código de v5.68)

> Este archivo es la Parte 2 del proyecto. Si el código real contradice este mapa,
> **el código manda** — lee el archivo y actualiza este mapa en la siguiente versión de la skill.

## §1. Qué es TORI

Un solo archivo HTML (~750KB) con **5 bloques `<script>` inline** (en v5.68: líneas ~2323, ~5227, ~8888, ~9673, ~12558). Sin servidor: corre en Chrome desde `file://` o disco local (`C:/Users/Usuario/Desktop/PRAGAOS/`). Librerías por CDN: SheetJS (XLSX global) y ExcelJS (bajo demanda con `_loadExcelJS()` para exports con fotos). El número de versión aparece ~51 veces como `v5.XX` dentro del archivo.

**Módulos** (barra lateral): Hub Unificado · Liquidador · Motor Praga Reorden (pestañas: Dashboard, Orden de Compra, Stock y Liquidación, Tendencias, Costos, China, Distribuidor, Faltantes, Parámetros) · PI2 Catálogo · Verificar Igualdad · Importar Archivos.

**Cadena de suministro de Praga:** Fábrica China (Producción China) → 🚢 En camino (contenedor navegando) → 🏬 Bodega San Benito (bodega intermedia) → Tienda (stock del macro). Las facturas del Liquidador SON los contenedores (un Excel con fotos por contenedor).

## §2. Los 5 bloques

| # | Contenido | Piezas clave |
|---|-----------|--------------|
| 0 | Liquidador + núcleo TORI (~152KB) | objeto global `TORI` {facturas, macroRows, classified, enCamino, sanBenito, prodChina, params}, `triggerAutosave(r)` = wrapper que llama `window._triggerAutosaveFn` (definida en bloque 3), `saveToriParams` (actualiza TORI.params EN MEMORIA además de localStorage), `getParams`, `classifyMotorRow`, parsers de macro/facturas/San Benito, `parseProdChinaFile` (columnas POR ENCABEZADO) + `_pcSelfHeal`, `getSanBenitoMap`/`getEnCaminoMap`/`getProdChinaMap` — en window, fotos: `getFotoByCodigo`, `_fotoThumbForExport(foto, 480, 0.78)`, `exportTrasladoSanBenito`, `deleteLiqFactura` |
| 1 | Motor Reorden (IIFE, ~200KB) | STATE privado + puente `window.STATE`; `renderStatusPills`, `renderOrdenTable` (ids `ordenTableHead/ordenTableBody/searchInput/grupoFilter/statusPills`), `STATUS_META`, vista REPETIDOS (`computeRepetidosCadena`, `renderRepetidosTable`, `exportRepetidosFotos`, chips `window.__repSetCombo`), `renderLiquidacionTable` (columna Costo unitario), `exportLiquidacion`, `handleChinaFile`/`saveChinaDB` (clave `praga_china_db_v1`, dispara 'china-db'), banner `sbTrasladoBar` en vista BODEGA_SB |
| 2 | (~36KB) auxiliares | |
| 3 | Backup + autosave + PI2 (~145KB) | `_buildSnapshotData`, `_fsaWriteNow` (escribe TORI_PRAGA_backup.json, reinyecta fotos, `{...f}` sin perder campos, tipo `tori_backup_disco_v1`), `restaurarBackupMaestro` (GENÉRICA; acepta tipos `tori_backup_maestro_v2`/`tori_backup_disco_v1`/`praga_motor_reorden_backup`), `exportarBackupConFotos`, `_restaurarPI2IndexedDB`, `_leerPI2IndexedDB`, FSA: DB `praga_fsa_v1` store `data` clave `fileHandle`, `_fsaInit` (requiere https/localhost/file:), debounce 3s, `window._triggerAutosaveFn`, PI2 app completa |
| 4 | Distribuidor (window.DIST, ~71KB) | claves `tori_dist_overrides/seeded/nuevos`, `lsSet` dispara `triggerAutosave('distribuidor')`, `DIST.reloadStored()` tras restaurar, `isSent()` vivo contra TORI.prodChina, `sendToProdChina` (docs origen 'DISTRIBUIDOR' con rows[] completas), `addChinaSheet` (headers ES/CN 16 cols, anclaje EMU `_aOff=18000 _aImg=609600`, row height 52) |

**Forma real de un doc de Producción China** (verificada en `handleProdChina`):
`{ id, fileName, fecha, origen?, items: {refNormalizada: unidades}, nRefs, nUnids, rows?: [{ref, descripcion, unidades}] }`.
OJO: `items` es un MAPA ref→unidades, NO un contador. Si `items` suma 0 y hay `rows[]`, `_pcSelfHeal` lo reconstruye (invariante 6) — al armar datos de prueba usa la forma correcta o el self-heal "reparará" tus datos y el diff fallará.

## §3. Persistencia (TODO lo que existe)

**localStorage:** `tori_params`, `praga_cost_db_v1` (costos COP + liquidador.precioSugerido), `praga_china_db_v1` (descCn/precioRMB+historial/proveedor), `praga_cubicaje_db_v1`, `praga_reorden_history_v1`, `praga_reorden_params`, `praga_ext_files_log_v1`, `praga_cloud_url_v1`, `tori_dist_overrides`, `tori_dist_seeded`, `tori_dist_nuevos`, `tori_encamino`, `tori_macro_live` (+ `tori_macro_emergency`, copia parcial transitoria — excluida del backup a propósito).

**IndexedDB:** `ToriPragaDB` (stores: facturas, macro, fotos; las fotos se guardan como `{_key: 'nombreFactura::índiceFila', foto}`) · `praga_autosave_v1` (snapshot navegador, SIN fotos) · `praga_fsa_v1` (handle del archivo de disco) · `praga_motor_cfg` (solo maestroHandle — FileSystemHandle NO serializable, excluido del backup con razón) · `PragaPI2` (catalogo keyPath 'ref' + meta con claves dinámicas).

**El backup — secciones de `_buildSnapshotData` (v5.68, lista lsKeys verificada):**
`liquidador {facturas CON meta, params, enCamino}` · `sanBenito` · `prodChina` · `motor` = las 11 claves `tori_params, praga_cost_db_v1, praga_china_db_v1, praga_cubicaje_db_v1, praga_reorden_history_v1, praga_reorden_params, praga_ext_files_log_v1, praga_cloud_url_v1, tori_dist_overrides, tori_dist_seeded, tori_dist_nuevos` + `tori_macro_live` (desde TORI.macroRows si hay) · `pi2 {catalogo, meta leída con getAllKeys excluyendo solo maestroHandle}`.
`_fsaWriteNow` = ese snapshot + fotos reinyectadas + tipo `tori_backup_disco_v1`. El autosave del navegador va SIN fotos (tamaño); el archivo de disco y el botón "Backup con fotos" van CON fotos.
**Al restaurar:** facturas hacen MERGE por nombre (backup gana, las que solo están en la app se conservan) y se ordenan por fecha; params hacen merge `{...TORI.params, ...backup}`; la sección motor se restaura GENÉRICAMENTE (loop sobre todas las claves, saltando `tori_macro_live`/`tori_macro` que van a TORI.macroRows + classifyMotorRow).

**Disparos de autosave existentes** (razones): liq-params, facturas-importadas, factura-eliminada, china-db, clear-china, cost-db, cubicaje-db, history, san-benito, prod-china, en-camino, pi2-cat, pi2-del, pi2-meta, distribuidor, motor-params.

## §4. Reglas de negocio

- Referencias formato `210-102`, `PG0001`. Categorías por palabras clave del nombre (Bolsos, Hogar, Belleza, Cocina...).
- **Repetidos en la cadena:** una referencia NO debe estar en 2+ eslabones a la vez (Stock / San Benito / En camino / Fábrica). La pastilla 🔁 Repetidos es la vista oficial: foto, buscador, chips por combinación, orden de columnas Stock → San Benito → En camino → Fábrica, nombres de doc/factura VISIBLES en las celdas, Excel con fotos de lo filtrado. (La pastilla "Orden de compra abierta" solo aparece si count>0; el recuadro rojo resumido se eliminó a pedido.)
- **Traslados San Benito:** semáforo TRAER (sin stock, verde) / EVALUAR (stock ≤10, amarillo) / NO TRAER (hay stock, rojo), ordenado por prioridad; columnas con foto, unds SB, unid. por caja, cajas en SB (unds÷unidEmpaque, 1 decimal), stock tienda, precio sugerido (costDB.liquidador.precioSugerido), contenedor (del macro), días venta. Refs solo-en-SB salen como TRAER "(no está en el macro)". Botones: tarjeta de Importar Archivos Y banner en la pastilla Bodega San Benito.
- **Datos para China:** los proveedores devuelven archivos PARCIALES (ej. YUGIN: solo descripciones chinas y tiendas, sin precios). El parser acepta filas con AL MENOS UN dato (precio O desc china O proveedor); el precio solo pisa/añade historial si viene; guard CJK contra la fila de encabezado chino (货号); refs y proveedores numéricos se guardan como texto.
- **Distribuidor:** reparte la orden China en contenedores (~67-80 m³) con límites inteligentes por descripción; overrides de la junta directiva (BOLSO/BILLETERA/CORREA/RIÑONERA = 12/contenedor, CORTINA DE BAÑO = 20); Tier A/B/C por velocidad; mercancía nueva dosificada; enviar a Producción China crea docs con rows[] completas; Excel de proveedores por contenedor con fotos.
- Backup que Andrés usa: el archivo automático **TORI_PRAGA_backup.json** (no el botón manual). La base de proveedores China es CRÍTICA para él.

## §5. INVARIANTES — nunca romper (bugs históricos ya pagados)

1. `renderEnCaminoPanel` solo depura EN CAMINO si `window._toriDatosListos && TORI.facturas.length > 0` (sin el guard, el arranque borraba los contenedores marcados y guardaba vacío).
2. `saveToriParams` hace `TORI.params = p` (sin eso, el backup llevaba parámetros viejos en una sección y nuevos en otra).
3. `_fsaWriteNow` y `exportarBackupConFotos` construyen facturas con `{...f}` (una lista fija de campos perdía `meta`).
4. La restauración de la sección motor es GENÉRICA (loop sobre todas las claves; una lista blanca dejaba fuera el Distribuidor).
5. La lectura de PI2 meta usa `getAllKeys` (una lista fija perdía 'facturas' y 'params' de PI2); excluye solo `maestroHandle`.
6. `parseProdChinaFile` detecta Referencia y Unidades POR ENCABEZADO (Referencia/货号/CODIGO/ITEM ARTICULO; Unidades/数量/CANTIDAD TOTAL/QTY); rechaza con mensaje claro si lee n>0 refs con 0 unidades; guard CJK. `_pcSelfHeal` reconstruye docs con items en 0 desde sus rows[].
7. El parser de Datos China acepta filas con al menos un dato útil (§4).
8. `DIST.lsSet` dispara `triggerAutosave('distribuidor')`; `DIST.reloadStored()` existe y se llama tras restaurar.
9. Toda clave nueva de persistencia entra al snapshot Y a la prueba de round-trip antes de entregar.
10. Los exports con foto usan `_fotoThumbForExport(foto, 480, 0.78)` y anclaje EMU (`_aOff=18000`, `_aImg=609600`, `editAs:'twoCell'`, row height 52).
11. **Los guardados de IndexedDB son ATÓMICOS**: `saveFacturasToStorage` y `saveMacroToStorage` hacen clear+puts dentro de UNA sola transacción. NUNCA volver al patrón clear-en-una-tx / puts-en-otras: un cierre a mitad del guardado dejaba el store vacío (incidente 2026-08-01: se perdieron todas las facturas al cerrar tras cambiar params). El escrito FSA del arranque solo corre si `TORI.facturas.length > 0` (no pisar el backup de disco con un estado vacío). Prueba que lo atrapa: `scripts/prueba_cierre_fatal.js` (Chromium real: mata la página a 300ms del guardado; v5_72 perdía 39/40 facturas, v5_73 conserva 40/40).

## §6. Notas para los arneses de prueba (los scripts ya implementan esto)

- Los scripts de la skill (`entorno_tori.js`, `prueba_backup.js`, `prueba_flujos.js`) implementan el entorno completo: IndexedDB en memoria (requests via queueMicrotask, tx.oncomplete diferido), DOM permisivo con caché, localStorage en objeto, `location.hostname='localhost'` (el FSA lo exige), `showSaveFilePicker` presente.
- Cargar bloques con `vm.runInContext`: backup → bloques 0 y 3; Distribuidor → añadir 4; Motor → añadir 1.
- **PITFALL de realms:** `vm.runInContext` crea un realm separado — ExcelJS falla con Arrays cross-realm (filas vacías silenciosas). Para probar exports: EXTRAER la función del bloque (por balance de llaves; ojo con el prefijo `async function`) y evaluarla en el realm host con mocks. Para backup, renders y flujos, el entorno vm completo funciona.
- **Espía de autosave:** envolver `window._triggerAutosaveFn` DESPUÉS de cargar el bloque 3 (el wrapper `triggerAutosave` del bloque 0 la llama por referencia viva).
- **Exports Excel:** generar con la librería real, escribir a /tmp, RELEER con ExcelJS y verificar encabezados por posición, valores de filas, fills (`fgColor.argb`), y `ws.getImages().length`.
- **Renders:** extraer la función, mocks de elementos (recordar `grupoFilter.value='TODOS'`, classList), verificar el HTML resultante (columnas del head = celdas por fila).
- **Con archivos reales del usuario:** si sube Excels, pasarlos por el parser real (FileReader mockeado leyendo desde /mnt/user-data/uploads con fs).
