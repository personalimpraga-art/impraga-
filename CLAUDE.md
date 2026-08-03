# CLAUDE.md — Wiki maestra del proyecto TORI · Praga

> **Qué es este archivo:** la fuente única de verdad del proyecto. Claude lo lee al
> empezar cualquier sesión; Andrés lo actualiza cuando cambia una regla de negocio
> o se entrega una versión. Si algo aquí contradice el código de TORI, el código
> manda — y este archivo se corrige.
>
> **Última actualización:** 2026-08-03 · **Versión vigente de TORI: v5_88**

---

## 1. Qué es TORI y para quién trabaja

TORI (Torre Integración · Praga) es la herramienta de gestión de **Praga**, importadora
colombiana de Andrés: 12 años de operación, compra en China, vende a crédito en
Colombia, capital propio sin deuda.

Es **un solo archivo HTML** (~750KB). No tiene servidor ni conexión con Claude:
Claude trabaja sobre copias del archivo y devuelve versiones nuevas.

### TORI corre como app de escritorio (.exe) — desde 2026-07-23

TORI ya **no corre en Chrome**: corre como aplicación de escritorio (**TORI.exe**,
Electron) construida desde la carpeta `desktop/` de este repo. Los datos viven en
la bóveda del PC (`AppData\TORI`), aparte del navegador y sin límites; hay respaldo
automático en `Documentos\Backups TORI`. El HTML de TORI va DENTRO del paquete como
copia byte-idéntica (`desktop/app/tori.html`) — el envoltorio no toca ni una función.

**Cómo instala Andrés cada versión nueva (recordárselo en CADA entrega):**
1. Claude entrega el `TORI_Praga_v5_XX.html` nuevo.
2. Andrés lo **arrastra encima de `ACTUALIZAR_FACIL.bat`** (carpeta TORI de su PC).
   Ese .bat copia el HTML a `app/` y a la copia interna del `.exe`
   (`dist/TORI-win32-x64/resources/app/app/tori.html`) — sin npm, sin internet, 1 segundo.
3. Cierra y reabre TORI.exe → el pill morado de la barra lateral muestra la versión nueva.
4. Sus datos nunca se tocan; la versión anterior queda como `app/tori_anterior.html`.

**`RECONSTRUIR_COMPLETO.bat`** (npm install + empaquetar, necesita internet) solo se
usa la primera vez o cuando Claude cambie la cáscara (`desktop/main.js`, `vendor/`,
ícono) — en ese caso Claude debe avisarlo EXPLÍCITAMENTE en la entrega. Ambos .bat
dejan registro (`registro_actualizar.txt` / `registro_reconstruir.txt`): si algo
falla, Andrés manda ese archivo al chat.

**Está CALIENTE EN PRODUCCIÓN** con datos valiosos: facturas con fotos, base de
proveedores China, macro de inventario, costos. Todo cambio se trata como cirugía
en un sistema crítico.

### La cadena de suministro (el modelo mental de todo)

```
Fábrica China  →  🚢 En camino  →  🏬 Bodega San Benito  →  Tienda
(Producción      (contenedor       (bodega                 (stock del
 China)           navegando)        intermedia)             macro)
```

Las facturas del Liquidador SON los contenedores: un Excel con fotos por contenedor.

### Módulos

Hub Unificado · **Liquidador** (facturas/contenedores, costos, precios) ·
**Motor Praga Reorden** (Dashboard, Orden de Compra, Stock y Liquidación,
Tendencias, Costos, China, Distribuidor, Faltantes, Parámetros) ·
**PI2 Catálogo** · Verificar Igualdad · Importar Archivos.

---

## 2. Reglas de oro (innegociables — resumen)

1. **Nueva versión en cada cambio.** Nunca se edita el original: v5_68 → v5_69,
   actualizando el número interno. El script `nueva_version.py` lo hace y verifica.
2. **No dañar a TORI.** Cambios quirúrgicos con verificación exacta; no se toca
   lógica numérica ni clasificaciones sin pedido explícito.
3. **Revisar antes de entregar.** Se prueba con datos reales y se demuestra.
   Si una prueba falla: corregir y volver a correr TODO.
4. **Regresión obligatoria**: los 5 bloques validan + prueba maestra del backup +
   flujos vivos (`validar_todo.sh`). Todo verde o no se entrega.
5. **Todo cambio de persistencia viaja en el backup.** TORI_PRAGA_backup.json
   debe seguir siendo la copia COMPLETA de TORI.
6. **Entrega**: archivo en outputs + resumen en español (qué se cambió, qué se
   probó, qué dio cada prueba) + recordar reemplazar la versión en el proyecto.

---

## 3. Reglas de negocio vigentes (LA SECCIÓN QUE ANDRÉS EDITA)

> Cuando la junta o la operación cambie una regla, se edita AQUÍ y se avisa a
> Claude en la siguiente sesión para actualizar TORI si aplica.

### Decisiones de la junta directiva
- **Límites por contenedor**: BOLSO / BILLETERA / CORREA / RIÑONERA = **12** por
  contenedor · CORTINA DE BAÑO = **20** por contenedor.
- Contenedores de ~**67–80 m³** efectivos.
- Mercancía **nueva dosificada** (no concentrada en un solo contenedor).
- Tier **A/B/C por velocidad de venta**: lo rápido tiene prioridad.

### Reglas de la cadena
- Una referencia **NO debe estar en 2+ eslabones a la vez** (Stock / San Benito /
  En camino / Fábrica). La vista 🔁 Repetidos es la oficial para detectarlo, con
  nombres de doc/factura visibles y orden de columnas Stock → SB → En camino → Fábrica.
- **Traslados San Benito** (semáforo): TRAER (sin stock en tienda, verde) ·
  EVALUAR (stock ≤10, amarillo) · NO TRAER (hay stock, rojo). Refs que solo están
  en SB salen como TRAER "(no está en el macro)".

### Reglas de datos de proveedores
- Referencias formato `210-102` o `PG0001`. Categorías por palabras clave del nombre.
- Los proveedores mandan archivos **imperfectos**: el caso YUGIN (solo descripciones
  chinas y tiendas, sin precios) es normal. Regla: una fila vale con AL MENOS UN
  dato útil, y **un archivo sin precios JAMÁS borra precios ya guardados**.
- La base de proveedores China es dato CRÍTICO para Andrés.
- El backup que Andrés usa es el **automático a disco** (TORI_PRAGA_backup.json),
  no el botón manual.

### Preferencias de construcción
- **Número de versión SIEMPRE visible** en la barra lateral (pill morado junto a
  "TORI"), en formato `v5.XX` para que `nueva_version.py` lo suba solo. Así Andrés
  distingue qué versión corre sin miedo a equivocarse al actualizar.
- UI y mensajes en español · números formato Colombia ($16.885).
- Estética Apple/iOS: cards blancas, segmented controls, focus morado,
  botones btn-brand / btn-green / btn-rust.
- Medidor de almacenamiento + guardado failsafe + panel de diagnóstico flotante.

---

## 4. El equipo de skills (quién hace qué)

| Skill | En cristiano | Cuándo actúa |
|---|---|---|
| **tori-engineering** | El jefe de taller: reglas de la casa, mapa técnico, y la regresión que protege el backup completo | SIEMPRE que se toque TORI |
| **tori-excel-auditor** | Inspector de calidad de los Excel: relee cada archivo generado y verifica títulos ES/CN, números, fotos y formato | Cambios a exports de Excel |
| **tori-parsers** | Probador de archivos de proveedores: muestra qué leerá TORI de un Excel ANTES de que entre a la base | Archivos de proveedores / cambios a parsers |
| **tori-motor-distribuidor** | Auditor de reglas con plata: repetidos en la cadena, límites de la junta, tiers | Cambios a bloques 1 o 4 |
| **tori-entrega** | El acta de entrega: changelog automático, checklist final, resumen en el formato de Andrés | Cierre de cada sesión |
| **tori-app-escritorio** | El mecánico del .exe: cómo se instala cada versión (los 2 .bat), la cáscara Electron, sus invariantes y cómo probarla sin Electron | TORI.exe, .bat, main.js, descargas, o CUALQUIER entrega |
| **tori-revision-real** | El inspector final: revisión en Chromium REAL con clics + panel de diagnóstico en 0, el diccionario de las formas REALES de los datos (diasRaw, QTY_CTN…) y la regla de cascada de fuentes | ANTES de entregar cualquier versión, al escribir pruebas nuevas, y al cruzar datos entre módulos |

El mapa técnico detallado (bloques, persistencia, los 10 invariantes) vive en
`references/mapa_tecnico.md` dentro de tori-engineering.

---

## 5. Cómo se trabaja una sesión (para Andrés)

1. **Un chat por tarea.** Pedidos concretos rinden más que chats eternos.
2. **Reportar bugs con el escenario completo**: qué archivo subiste (adjúntalo),
   qué botón tocaste, qué esperabas, qué salió.
3. Claude parte SIEMPRE de la última versión (la del chat manda sobre la del proyecto).
4. Al recibir la versión nueva: descargarla, **arrastrarla encima de
   `ACTUALIZAR_FACIL.bat`**, cerrar y reabrir TORI.exe (verificar el pill de
   versión), y **reemplazarla en el conocimiento del proyecto** (una sola
   versión, la última).
5. Si la conversación se pone pesada, Claude entrega lo probado y se sigue en
   chat nuevo.

### Qué mantener actualizado en el proyecto
- [ ] La última versión de TORI (reemplazar, no acumular)
- [ ] Este CLAUDE.md (regla nueva de la junta → editar §3; entrega → añadir a §6)
- [x] Carpeta `muestras/` con archivos reales: factura de contenedor (PRAGA145,
      con fotos) y macro de inventario (03/08/2026). Pendiente: un Excel YUGIN
      real y un backup viejo.

---

## 6. Historial de versiones (bitácora)

> Formato: versión · fecha · qué cambió (1 línea) · estado.
> Claude añade una línea en cada entrega; Andrés confirma cuando la pone en producción.

| Versión | Fecha | Qué cambió | Estado |
|---|---|---|---|
| v5_68 | (previa a esta wiki) | Versión vigente al crear la wiki. Proveedor real en supplierMix del Distribuidor. | ✅ En producción |
| — | 2026-07-18 | Se creó el equipo de 5 skills (sin cambios al HTML de TORI) | Herramientas de taller |
| v5_69 | (sin documentar) | ⚠️ Cambio no documentado en esta wiki — pendiente que Andrés complete el detalle. | ✅ En producción |
| v5_70 | 2026-07-21 | ⚠️ Cambio no documentado en esta wiki — pendiente que Andrés complete el detalle. Versión vigente al montar el repositorio PRAGAOS. | ✅ En producción |
| — | 2026-07-21 | Envoltorio de escritorio (`desktop/`, Electron → TORI.exe): datos permanentes en el PC, offline, HTML de TORI sin tocar. Falta generar el .exe (requiere red a github). | Herramienta de taller |
| v5_71 | 2026-07-23 | Número de versión visible en la barra lateral (pill morado junto a "TORI"); se auto-actualiza en cada versión. Cambio cosmético, regresión completa en verde. | ✅ En producción |
| v5_72 | 2026-07-23 | "Generar app para cliente" (PI2): el archivo generado abre DIRECTO en el catálogo del cliente, ocultando la cáscara TORI (bloque 3, +7 líneas). Regresión completa en verde. | ✅ En producción |
| — | 2026-07-23 | Cáscara del .exe: manejador de descargas (guarda en Descargas + notificación) y librerías xlsx/exceljs precargadas offline sin tocar el HTML. Requiere RECONSTRUIR_COMPLETO.bat. | Herramienta de taller |
| v5_73 | 2026-08-01 | 🚨 Corrección crítica de pérdida de datos: guardado de facturas/macro ATÓMICO (una sola transacción) + guard del escrito FSA al arrancar. Kill-test: v5_72 perdía 39/40 facturas, v5_73 conserva todo. Regresión completa en verde. | ✅ En producción |
| v5_74 | 2026-08-01 | Flete/TRM ya no "se comen los ceros": puntos y comas se tratan como miles al teclear (incidente PRAGA-139, flete $154). Verificado tecleando en es-CO + ciclo completo con factura real. Regresión en verde. | ✅ En producción |
| v5_75 | 2026-08-01 | El guardado de parámetros espera a que termines de teclear (no confirma valores a medias) + aviso ROJO si el flete/TRM queda absurdo. Escenarios de tecleo interrumpido verificados. Regresión en verde. | 🆕 Entregada (Andrés confirma cuando esté en producción) |
| v5_76 | 2026-08-03 | Editor de pedidos de Producción China: los pedidos dejan de ser estáticos — ✏️ renombrar (cuando asignan contenedor), cambiar unidades, ↩ devolver refs a la Orden Sugerida, 🚫 vetarlas (NO TRAER), ➕ agregar refs con buscador, 📗 Excel chino con fotos para pedidos subidos como archivo, y botón 🏭 en la Orden de Compra para mandar refs a un pedido específico o crear uno nuevo. Regresión completa + 23 pruebas del editor + auditoría del Excel en verde. | ✅ En producción (Andrés confirmó el pill v5.76) |
| v5_77 | 2026-08-03 | Pestaña 🏭 Producción China en el Motor (al lado de Parámetros), vista tipo Liquidador: lista de pedidos como tarjetas → detalle con tabla completa (foto, desc ES/CN, und/caja, cajas, unidades editables, ¥, proveedor), buscador ➕, renombrar, Excel FOTOS y despachar. Coherencia probada con el Motor real: agregar → sale de la Orden Sugerida (PROD_CHINA); quitar → vuelve sola (ORDENAR); vetar → NO_TRAER con motivo; quitar veto → vuelve. Regresión completa + 29 pruebas de coherencia/pestaña + 23 del editor + auditoría Excel en verde. | ✅ En producción (Andrés confirmó el pill v5.77) |
| v5_78 | 2026-08-03 | Columna Foto en la Orden de Compra del Motor (todas las vistas): placeholder de cero peso, la imagen solo carga cuando la fila entra en pantalla (mecanismo de la pestaña China) y clic = ampliar en el lightbox. El pintado inicial no lleva ni un base64 — no se tilda ni tecleando en el buscador. Regresión completa + 12 pruebas de la columna + todas las baterías anteriores (29+23+17+7+Excel+Motor/Dist) re-corridas en verde. | ✅ En producción (Andrés mostró el pill v5.78) |
| v5_79 | 2026-08-03 | 🚨 Corrección: TORI.exe (Electron) no soporta `prompt()` — vetar desde la Orden de Compra reventaba con "prompt() is not supported". Ventana propia `toriPrompt` (Enter/Escape, Aceptar/Cancelar, estilo TORI) y reemplazo de LOS 9 usos: veto de la Orden, renombrar/vetar/agregar/crear de Producción China, renombrar contenedor del Distribuidor y 3 de PI2. Probado simulando el .exe (prompt roto) + cerrar y reabrir TORI: pedidos, vetos y devoluciones quedan guardados y el Motor recalcula igual (19 verificaciones). Regresión + todas las baterías (29+23+17+12+7+Excel+Motor/Dist) en verde. | ✅ En producción (Andrés mostró el pill v5.79) |
| v5_80 | 2026-08-03 | 🚨 Corrección: el visor de foto grande (lightbox) vivía DENTRO de la pantalla PI2 y era invisible desde el resto de TORI — clic en una foto de la Orden de Compra/Repetidos/China "no hacía nada". Ahora es un overlay global con CSS propio (#lightbox, z-index 9990, clic = cerrar). Cero cambios en los bloques JS (solo HTML/CSS). Bug REPRODUCIDO en v5_79 y verificado el arreglo en Chromium real (visor visible en el Motor, clic cierra, PI2 intacto). Regresión completa en verde. | ✅ En producción (Andrés trabajando sobre ella) |
| v5_81 | 2026-08-03 | Información de compra en el detalle del pedido (pestaña 🏭): columnas Tier y Días FRESCAS del macro vigente, chips de días promedio ponderado y mezcla de Tiers, y desglose "qué trae este pedido por descripción" agrupado por palabra clave de la junta (BOLSO DAMA + BOLSO PLAYA cuentan juntos) con ⚠ cuando pasa el límite (overrides de tori_dist_overrides respetados). Regresión completa + 13 pruebas de la vista + todas las baterías (29+23+17+12+7+19+Excel+Motor/Dist) en verde. | ✅ En producción (Andrés mostró la vista v5.81 funcionando) |
| v5_82 | 2026-08-03 | Filtros en el detalle del pedido (pestaña 🏭): buscador por referencia/descripción/desc china/proveedor (solo re-pinta el cuerpo — el input no pierde el foco al teclear), chips de Tier clicables, clic en una fila del desglose = filtrar por ese grupo, todos combinables, contador "Mostrando X de Y", ✕ Limpiar, y filtro limpio al cambiar de pedido. Regresión completa + 16 pruebas de filtros + todas las baterías (29+23+17+13+12+7+19+Excel+Motor/Dist) en verde. | 🆕 Entregada |
| v5_83 | 2026-08-03 | En la Orden de Compra, la línea "Mostrando X de Y" ahora suma el CUBICAJE de lo mostrado: al buscar "bolso" (o filtrar por categoría) se ve al instante cuántos m³ y cajas suma eso, y si hay filtro, también el total de toda la Orden Sugerida. Regresión completa + 8 pruebas del contador + todas las baterías re-corridas en verde. | ✅ En producción (Andrés trabajando sobre ella) |
| v5_84 | 2026-08-03 | Detalle del pedido 🏭: (1) ORDENAR con clic en los encabezados (Referencia, Descripción, Precio, Tier, Días, Proveedor… y el desglose también), flecha ▲▼, sin-datos de últimos; (2) 🚨 corrección del "—" en Días: el macro real trae `diasRaw` y el lookup solo miraba `dias` — ahora Días/⌀ promedio/desglose salen con datos reales; (3) el 📗 Excel refresca Tier/Días del macro vigente y rellena huecos (desc china, precio, proveedor) antes de generar, sin pisar datos. Regla nueva de entrega: REVISIÓN EN NAVEGADOR REAL con clics (prueba_browser) + panel de diagnóstico en 0 antes de entregar. 12 pruebas browser + 12 orden + 10 días reales + todas las baterías + regresión en verde. | ✅ En producción (Andrés mostró el pill v5.84 y confirmó el contador de cubicaje) |
| v5_85 | 2026-08-03 | Mover pedidos ▲▼ en la lista de la pestaña 🏭: Andrés acomoda las órdenes de fabricación en el orden que quiera; el orden queda guardado (bóveda al instante + backup de disco) y se respeta también en la tarjeta de Importar Archivos. Flechas con tope en el primero/último y sin abrir el pedido por accidente. Revisión en navegador real con clics (8/8, diagnóstico en 0) + 9 pruebas de lógica/persistencia + todas las baterías + regresión en verde. | ✅ En producción (Andrés mostró el pill v5.85 con las flechas) |
| v5_86 | 2026-08-03 | Chip "⌀ X días venta" en CADA tarjeta de la lista de pedidos (pestaña 🏭): días de venta promedio del pedido ponderado por unidades, con el macro vigente (mismo número que el detalle); pedidos sin datos muestran "⌀ — días". Revisión en navegador real (10/10, diagnóstico en 0) + 5 pruebas del promedio calculado a mano + las 13 baterías + regresión en verde. | ✅ En producción (Andrés mostró el pill v5.86) |
| v5_87 | 2026-08-03 | 🚨 Corrección (caso 313-147): el cubicaje/und-caja de Producción China vivía AISLADO — solo miraba el macro, y refs con el dato completo en el Liquidador salían "—" y quedaban fuera de los m³ del pedido y del Excel. Cascada de fuentes: fila guardada → macro vigente → base de cubicaje del Motor → FACTURAS del Liquidador (QTY_CTN, TOTAL_CBM/CTNS). Aplica a la vista, totales, desglose, orden por columnas y al 📗 Excel (refresco sin pisar datos del proveedor). 12 pruebas del caso real (Excel releído: 72 und/caja, 4 cajas, 0,46 m³) + revisión browser 13/13 + las 14 baterías + regresión en verde. | ✅ En producción (Andrés mostró el pill v5.87 con cajas/m³ completos) |
| v5_88 | 2026-08-03 | El 📗 Excel de Producción China lleva el CONTENEDOR DE ORIGEN por referencia en "Numero de contenedor" (igual que el Excel de la pestaña China): macro → factura del Liquidador; sin dato queda el rótulo del pedido; el Distribuidor no cambia (sus contenedores nuevos siguen con su número). Filas ya guardadas se rellenan en el refresco del Excel. 8 pruebas del caso (Excel releído: 0165 / PRAGA-132 / rótulo) + auditoría addChinaSheet + browser 13/13 + las 15 baterías + regresión en verde. | 🆕 Entregada |

---

## 7. Incidentes y lecciones (no repetir)

Los 10 invariantes del mapa técnico nacieron de bugs reales ya pagados. Los más
importantes en cristiano:
- El arranque llegó a **borrar los contenedores "En camino"** por depurar antes de
  tiempo → hoy hay un guard que lo impide.
- El backup llegó a **perder el campo meta** de las facturas y claves del
  Distribuidor por usar listas fijas de campos → hoy todo se copia genéricamente
  y la prueba maestra verifica completitud.
- Un archivo parcial de proveedor llegó a **pisar precios existentes** → hoy la
  regla de parciales lo prohíbe y tori-parsers lo verifica.
- Excel generados "bien" que salían **sin fotos o con filas vacías** (problema
  invisible hasta que el proveedor los abría) → hoy todo export se relee y audita.

- **2026-08-01 — Se perdieron TODAS las facturas del Liquidador** al cerrar TORI
  justo después de subir un contenedor y cambiar dólar/cubicaje. Causa: el guardado
  hacía "borrar todo" y "volver a meter" en transacciones SEPARADAS — un cierre a
  mitad dejaba el cajón vacío. Desde v5_73 el guardado es ATÓMICO (todo-o-nada,
  invariante 11) y el arranque no pisa el backup de disco si no hay facturas.
  Prueba permanente: `prueba_cierre_fatal.js` (tori-engineering).

- **2026-08-01 (2ª parte) — El flete quedaba a medias sin aviso**: teclear "154…",
  cambiar de factura o pausar sin terminar, y el guardado (700ms tras cada tecla)
  confirmaba el valor parcial EN SILENCIO. Desde v5_75: no se guarda mientras el
  campo tiene el foco, y un flete/TRM absurdo dispara aviso ROJO con el nombre de
  la factura. Verificado con tecleo humano interrumpido en Chromium.
- **2026-08-01 — El flete "se comía los ceros"** (PRAGA-139 quedó con flete $154 en
  vez de $1.540.000). Causa: al teclear con puntos de miles a la colombiana
  ("1.540.000"), el input numérico lo pasaba como decimal (parseFloat → 1,54) y los
  costos quedaban absurdos. Desde v5_74, en TRM y flete todo punto/coma es separador
  de miles (`_liqParseEntero`) — verificado tecleando en Chromium es-CO.

- **2026-08-03 — "prompt() is not supported": vetar productos reventaba en TORI.exe.**
  Andrés intentó mandar productos a NO TRAER desde la Orden de Compra y salió el
  error en el panel de diagnóstico. Causa: `window.prompt()` NO existe en Electron
  (en Chrome sí funcionaba — por eso ninguna prueba lo atrapó). Desde v5_79 TODA
  ventana de "escribe un valor" usa `toriPrompt` (ventana propia de TORI, Enter =
  aceptar, Escape = cancelar) y quedó PROHIBIDO usar `prompt()` nativo — el parche
  de cada versión lo verifica (0 usos en toda la app). Regla nueva de pruebas:
  los flujos interactivos se prueban también con `prompt()` LANZANDO el error de
  Electron (`prueba_electron_reabrir.js`), no solo con un prompt que funciona.

- **2026-08-03 — El visor de foto grande era invisible fuera de PI2** (clic "no hacía
  nada"): el #lightbox vivía DENTRO de la pantalla PI2, oculta desde el Motor. La
  lógica corría perfecta — pero nadie la VEÍA. Desde v5_80 es un overlay global.
  Regla: verificar VISIBILIDAD real en Chromium, no solo que la función se ejecute.

- **2026-08-03 — Los Días salían "—" en Producción China y sus Excel**: el macro real
  guarda los días como `diasRaw`, y el código (y las PRUEBAS) usaban `dias` — por eso
  todas las pruebas pasaban y producción fallaba. Desde v5_84 se leen ambos. Regla:
  sembrar pruebas con la FORMA REAL de los datos (diccionario en tori-revision-real §3),
  idealmente con los archivos de `muestras/`.

- **2026-08-03 — El cubicaje "no lo tomaba" aunque estaba en el Liquidador** (caso
  313-147): el lookup miraba UNA sola fuente (el macro). Desde v5_87 todo dato de una
  referencia se resuelve en CASCADA: fila guardada → macro → bases del Motor →
  facturas del Liquidador. Regla: si Andrés ve un dato en una pantalla y no en otra,
  es integración faltante — nunca decirle que el dato no existe sin revisar las 4 fuentes.

- **2026-08-03 — Regla de entrega nueva (pedida por Andrés): REVISAR EN EL ENTORNO
  REAL antes de entregar.** Además de la regresión: Chromium real servido como el
  .exe, clics de usuario sobre lo nuevo, panel de diagnóstico en 0, modo .exe
  (prompt() lanzando error) y cerrar/reabrir para persistencia. El ritual y los
  arneses viven en la skill **tori-revision-real**.

Cuando aparezca un incidente nuevo: se documenta aquí, se convierte en invariante
en el mapa técnico, y se le crea prueba que lo atrape para siempre.
