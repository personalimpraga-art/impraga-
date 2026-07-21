---
name: tori-excel-auditor
description: >-
  Auditoría automática de los exports de Excel de TORI (Torre Integración · Praga). Usar SIEMPRE que un cambio en TORI_Praga_v5_XX.html toque un export de Excel o sus fotos — Repetidos con fotos, Liquidación, Traslados San Benito, Excel de proveedores por contenedor del Distribuidor (addChinaSheet), backup con fotos — o cuando Andrés reporte un Excel que sale mal (filas vacías, sin fotos, encabezados corridos, colores perdidos). Empaqueta el patrón del pitfall de realms: extraer la función del bloque, generarla con ExcelJS real en el realm host, RELEER el archivo y verificar encabezados, valores, colores e imágenes. Nunca declarar un export como probado sin haberlo releído con estos scripts.
---

# TORI Excel Auditor

Los exports de Excel son de lo más delicado de TORI: llevan fotos de la mercancía, encabezados bilingües español/chino y formatos que los proveedores en China usan tal cual. Un export roto que "parece que funcionó" (archivo generado, pero con filas vacías o sin fotos) es el peor tipo de bug. Esta skill hace imposible entregarlo sin darse cuenta.

## La regla central

**Un export NO está probado hasta que el archivo generado fue RELEÍDO y verificado.** Generar sin releer no cuenta. La verificación mínima: encabezados por posición, valores de filas de negocio, fills (`fgColor.argb`), `ws.getImages().length`, anclaje y alto de fila 52 en filas con foto (invariante 10 de TORI).

## El pitfall de realms (por qué existe esta skill)

`vm.runInContext` (el entorno de la skill tori-engineering) crea un realm de JavaScript separado. ExcelJS falla con Arrays cross-realm y el síntoma es traicionero: **filas vacías silenciosas, sin error**. Por eso los exports NUNCA se prueban dentro del entorno vm. El patrón correcto:

1. **Extraer** la función y sus constantes del bloque real:
   ```bash
   python3 scripts/extraer_funcion.py /tmp/tori_bloques/bloque_4.js \
       CHINA_COLS CHINA_HES CHINA_HCN addChinaSheet > /tmp/extraido.js
   ```
   Maneja `async function`, funciones dentro de IIFEs, y declaraciones `const/var` (balance de llaves consciente de strings, template literals y comentarios). Extraer SIEMPRE del bloque de la versión que se está probando — así la prueba audita el código vigente, no una copia vieja.
2. **Evaluar en el realm host** con `const fn = eval(codigo + '\nnombreFn;');` (el eval en modo estricto tiene ámbito propio: sacar la función por el valor de retorno, no por asignación).
3. **Mockear solo las dependencias externas** de la función (ej. `fotoOf`, `window._fotoThumbForExport` como passthrough del base64). Los datos de prueba deben ser de negocio realistas: refs formato `210-102`/`PG0001`, descripciones chinas reales, mercancía nueva con `isNew`.
4. **Generar → escribir a /tmp → RELEER → verificar.**

## Scripts

| Script | Qué hace |
|---|---|
| `extraer_funcion.py BLOQUE.js NOMBRE...` | Extrae funciones y constantes por balance de llaves; stdout listo para eval. Código 1 si falta alguna. |
| `leer_excel.js ARCHIVO.xlsx [filas]` | Auditor genérico: hojas, encabezados, valores por posición, fills ⟨ARGB⟩, negritas ᴮ, imágenes con sus filas, altos de fila. Úsalo sobre CUALQUIER Excel generado para comparar contra lo esperado. |
| `probar_addChinaSheet.js [dirBloques]` | Prueba completa del export del Distribuidor (13 verificaciones: encabezados ES/CN celda a celda contra las constantes reales, valores, NUEVO para mercancía nueva, 1 foto anclada en col A, alto 52). **Correr siempre que se toque el bloque 4 o las fotos.** Es también la PLANTILLA para auditar otros exports. |

Las librerías reales viven en `/home/claude/lib/node_modules` (instalar con `npm install exceljs@4.4.0 xlsx` si no están); los scripts las toman de ahí o de `TORI_LIB`.

## Cómo auditar un export nuevo o modificado

Copia el patrón de `probar_addChinaSheet.js`:
1. Identifica en el mapa técnico (skill tori-engineering, `references/mapa_tecnico.md` §2) en qué bloque vive la función y qué constantes usa (`grep -n 'function nombreExport' bloque_X.js`).
2. Extrae función + constantes; identifica sus dependencias externas leyendo el cuerpo extraído; móckealas mínimamente.
3. Arma datos con los casos que importan: fila normal con foto, fila sin foto, mercancía nueva, valores con decimales (redondeos), textos chinos.
4. Genera, escribe a /tmp, relee con `leer_excel.js` y con aserciones propias. Verifica también lo NEGATIVO (la fila sin foto no debe tener alto 52; la ref nueva no debe llevar foto).
5. Si una aserción falla, primero decide si el bug está en TORI o en tu expectativa — lee el código real antes de "corregir" a TORI.

Los exports con foto de TORI usan `_fotoThumbForExport(foto, 480, 0.78)` y anclaje EMU (`_aOff=18000`, `_aImg=609600`, `editAs:'twoCell'`, alto 52). Cualquier export nuevo debe respetar eso (invariante 10) y esta skill es quien lo comprueba.
