---
name: tori-engineering
description: Ingeniería sobre TORI (Torre Integración · Praga), la herramienta HTML de un solo archivo de Andrés — sistema CRÍTICO en producción de su importadora. Usar SIEMPRE que la tarea toque un archivo TORI_Praga_v5_XX.html o mencione TORI, el Liquidador, el Motor Praga Reorden, el Distribuidor, PI2, Bodega San Benito, Producción China, En Camino, el backup TORI_PRAGA_backup.json, o cualquier cambio/bug/export de esa herramienta. Incluye los scripts de regresión obligatorios (validación de los 5 bloques, prueba maestra del backup, flujos vivos) que DEBEN correr y pasar antes de entregar cualquier versión.
---

# TORI Engineering

Eres el ingeniero de TORI, la herramienta de Andrés (dueño de Praga: importadora colombiana, compra en China, vende a crédito en Colombia). TORI está **caliente en producción** con datos valiosos: facturas con fotos, base de proveedores China, macro de inventario, costos. Trátala como un sistema crítico: el costo de un bug es real.

## Flujo de trabajo obligatorio (cada sesión)

1. **Identificar la versión de partida.** La del chat manda sobre la del proyecto. Copiarla a `/home/claude/work/`.
2. **Crear la versión nueva** — nunca editar el original:
   ```bash
   python3 scripts/nueva_version.py /home/claude/work/TORI_Praga_v5_68.html
   ```
   Copia a v5_69 y actualiza las ~51 apariciones internas de `v5.68` → `v5.69`, verificando que quedan 0 residuos. Trabaja SOLO sobre el archivo nuevo.
3. **Cambios quirúrgicos.** En Python, reemplaza bloques EXACTOS con `assert old in c` antes de reemplazar — si el assert falla, lee el archivo real y ajusta; nunca "a ojo". No toques lógica numérica, clasificaciones ni respuestas existentes salvo pedido explícito. Antes de tocar cualquier zona, lee `references/mapa_tecnico.md` (§2 para ubicar el bloque, §5 para los invariantes que NO se rompen).
4. **Regresión completa** — un solo comando, correr SIEMPRE antes de entregar:
   ```bash
   bash scripts/validar_todo.sh /home/claude/work/TORI_Praga_v5_69.html
   ```
   Corre en orden: (a) extracción de los 5 bloques + `node --check` de cada uno, (b) prueba maestra del backup (round-trip de las 8 secciones con fotos), (c) flujos vivos (acciones reales → autosave → disco). **Si algo falla: corregir y re-correr TODO desde el principio.** Nunca entregar con la regresión en rojo, y nunca entregar sin haberla corrido en esta misma sesión sobre esta misma versión.
5. **Pruebas del cambio específico.** Además de la regresión, demuestra que TU cambio funciona con datos reales (los archivos que suba Andrés si los hay). Si el cambio toca un export de Excel: generar con la librería real, RELEER el archivo y verificar encabezados, valores, colores e imágenes (`ws.getImages().length`).
6. **Entregar**: copiar a `/mnt/user-data/outputs/`, presentar el archivo, y dar un resumen en español: directo, breve, qué se cambió, qué se probó y qué dio cada prueba. Recordarle a Andrés: (a) **arrastrar el HTML nuevo encima de `ACTUALIZAR_FACIL.bat`** en la carpeta TORI de su PC (TORI corre como app .exe; ese .bat copia el HTML a `app/` y a la copia interna del `.exe` sin npm ni internet), (b) cerrar y reabrir TORI.exe y verificar el pill de versión en la barra lateral, y (c) reemplazar la versión en el conocimiento del proyecto. `RECONSTRUIR_COMPLETO.bat` solo aplica si el cambio tocó la cáscara (`desktop/main.js`, `vendor/`) — avisarlo explícitamente. Detalle completo en §1 del CLAUDE.md del repo.

## Ante un reporte de "no funciona X"

REPRODUCIR primero (idealmente demostrando que la versión anterior falla), causa raíz, corrección quirúrgica, y demostrar el antes/después. Los scripts de esta skill sirven para reproducir: `entorno_tori.js` arranca TORI de verdad en Node.

## Regla de persistencia (la más traicionada históricamente)

**Todo cambio de persistencia viaja en el backup.** Si creas una clave nueva de localStorage o un dato nuevo en memoria:
1. Añádela a `_buildSnapshotData` (bloque 3).
2. Verifica que la restauración genérica la cubre.
3. Dispara `triggerAutosave('razon-nueva')` en el punto del cambio.
4. **Añade el dato nuevo a `poblarTodo()` en `scripts/prueba_backup.js`** y corre el round-trip — la prueba solo protege lo que puebla.

El archivo TORI_PRAGA_backup.json debe seguir siendo la copia COMPLETA de TORI.

## Los scripts (en `scripts/`)

| Script | Qué hace | Cuándo |
|---|---|---|
| `nueva_version.py HTML [--outdir D] [--a N]` | Copia a la versión siguiente + actualiza versión interna + verifica 0 residuos | Inicio de cada sesión de cambios |
| `extraer_bloques.py HTML [--outdir D]` | Extrae los 5 bloques inline a `bloque_0..4.js` y los valida con `node --check` | Lo llama validar_todo; útil suelto para leer/buscar en un bloque |
| `entorno_tori.js` (módulo) | Entorno Node que arranca TORI: IndexedDB en memoria, DOM permisivo, localStorage, FSA. `crearEntorno()`, `env.cargarBloque(ruta)`, `env.idb.sembrar(db,store,clave,valor)`, `env.esperar(ms)` | Base para cualquier prueba nueva de lógica interna |
| `prueba_backup.js [dirBloques]` | PRUEBA MAESTRA: puebla todo → escribe archivo 1 → TORI vacío → restaura → escribe archivo 2 → compara las 8 secciones + fotos | Cada versión, vía validar_todo |
| `prueba_flujos.js [dirBloques]` | Flujos vivos: `saveToriParams` y `deleteLiqFactura` reales → verifican memoria, localStorage, razón de autosave y archivo de disco | Cada versión, vía validar_todo |
| `validar_todo.sh HTML` | Orquestador de los tres anteriores; código 0 solo si TODO pasa | SIEMPRE antes de entregar |

Para probar zonas no cubiertas (Motor bloque 1, Distribuidor bloque 4, renders, parsers con archivos del usuario), construye sobre `crearEntorno()` siguiendo los patrones de `prueba_flujos.js` y las notas del §6 de `references/mapa_tecnico.md` — en especial el **pitfall de realms**: para exports con ExcelJS, extrae la función al realm host; no uses el entorno vm.

## Preferencias de construcción (siempre, sin preguntar)

- UI y mensajes en español; números formato Colombia (`toLocaleString('es-CO')`, ej. $16.885).
- Estética Apple/iOS actual (cards blancas, segmented controls, focus ring morado, botones btn-brand/btn-green/btn-rust).
- Medidor de almacenamiento (`navigator.storage.estimate`) y guardado failsafe (`try/catch` de `QuotaExceededError`).
- Panel de diagnóstico flotante: `window.onerror` + `unhandledrejection`, botón rojo con conteo, `window.diag(msg, err)`.
- Si la conversación se pone pesada, entrega la versión probada y sugiere continuar en un chat nuevo del proyecto.

## Referencia

`references/mapa_tecnico.md` — mapa completo del archivo: los 5 bloques y sus piezas (§2), TODA la persistencia y las secciones del backup (§3), reglas de negocio (§4), **los 10 invariantes que nunca se rompen** (§5, bugs históricos ya pagados), y notas para escribir arneses nuevos (§6). Léelo antes de tocar código; consulta §5 antes de entregar.
