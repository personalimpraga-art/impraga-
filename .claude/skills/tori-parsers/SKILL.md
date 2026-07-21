---
name: tori-parsers
description: >-
  Probador de los parsers de archivos de TORI (Torre Integración · Praga) con Excels REALES de proveedores, antes de que lleguen a producción. Usar SIEMPRE que Andrés suba un archivo de un proveedor de China (YUGIN u otros), un archivo de Producción China, o reporte que TORI leyó mal un Excel (refs en 0, descripciones perdidas, precios pisados, archivo rechazado). También al modificar cualquier parser de TORI_Praga_v5_XX.html: parseProdChinaFile, Datos China, macro, San Benito. Pasa el archivo por el parser REAL del bloque vigente y muestra campo por campo qué leyó.
---

# TORI Parsers

Los proveedores en China devuelven archivos imperfectos: parciales (YUGIN manda solo descripciones chinas y tiendas, sin precios), con filas de encabezado chino intercaladas (货号…), columnas corridas, refs numéricas. Los parsers de TORI tienen reglas defensivas para todo eso — esta skill las verifica con el archivo real ANTES de que un archivo malo dañe la base de proveedores China (dato CRÍTICO para Andrés).

## Uso principal: Andrés sube un Excel

```bash
# 1. Extraer los bloques de la versión vigente (skill tori-engineering)
python3 .../tori-engineering/scripts/extraer_bloques.py TORI_Praga_v5_XX.html

# 2. Pasarlo por el parser real
node scripts/probar_parser.js prodchina /mnt/user-data/uploads/ARCHIVO.xlsx
node scripts/probar_parser.js china     /mnt/user-data/uploads/ARCHIVO.xlsx
```

`prodchina` llama `parseProdChinaFile` (bloque 0) directo y muestra refs y unidades leídas, o el motivo exacto del rechazo. `china` arranca los bloques 0+1 y dispara el **cableado real** (evento change de `chinaFileInput` tras DOMContentLoaded) — así se prueba el parser Y su wiring — y muestra el ANTES/DESPUÉS de la base por ref.

Para verificar que un archivo parcial NO pisa datos existentes, siembra la base previa:
```bash
TORI_CHINA_PREVIO='{"pg0001":{"codigo":"PG0001","descripcionChina":"...","precioRMB":9.9,"proveedor":"...","historial":[...]}}' \
  node scripts/probar_parser.js china archivo.xlsx
```

## Qué DEBE pasar (reglas verificadas contra v5.68)

- **Producción China** (invariante 6): columnas detectadas POR ENCABEZADO (Referencia/货号/CODIGO/ITEM ARTICULO; Unidades/数量/CANTIDAD TOTAL/QTY), no por posición — una columna extra no corre las cantidades. Filas cuyo ref tiene caracteres chinos se saltan (guard CJK). Si lee n>0 refs pero TODAS con 0 unidades, RECHAZA con mensaje claro — ese rechazo es comportamiento correcto, no un bug.
- **Datos China** (invariante 7, caso YUGIN): una fila vale con AL MENOS UN dato útil (precio O descripción china O proveedor). El precio existente NO se pisa si el archivo no trae precio (solo se añade al historial cuando viene). Refs y proveedores numéricos quedan como texto. El encabezado usable puede convivir con una fila de encabezado chino intercalada.
- **Esquema REAL de `praga_china_db_v1`** (el mapa antiguo decía `descCn` — el código manda): claves = ref normalizada en minúscula; valor = `{codigo, descripcionChina, precioRMB, proveedor, historial:[{precioRMB, fecha, fuente}], fecha, fuente}`.

## Fixtures de regresión

`node scripts/generar_fixtures.js` crea en `fixtures/` tres archivos que imitan los casos frágiles: `prodchina_ok.xlsx` (columna extra + fila china intercalada — debe leer 3 refs/380 unds), `prodchina_sin_unids.xlsx` (debe ser RECHAZADO), `yugin_parcial.xlsx` (parcial sin precios — debe añadir/actualizar sin pisar precios). Correr los tres tras cualquier cambio a un parser; si un archivo real de Andrés revela un caso nuevo, **añádelo como fixture** para que quede protegido para siempre.

## Cómo interpretar los resultados

- `[NUEVA]` / `[CAMBIÓ]` / `[igual]` por ref, con descripcionChina, precioRMB, proveedor, historial y fuente.
- La línea `✘ ALERTA: la ref X PERDIÓ su precio` significa violación de la regla de parciales — bug real, no continuar.
- Si el parser rechaza, el script muestra el mensaje exacto que vería Andrés en la UI. Decide si el rechazo es correcto (archivo realmente malo) o un bug (archivo válido rechazado) leyendo el código del parser antes de tocar nada.
- Refs con 0 unidades en prodchina salen con `⚠ OJO` — en producción `_pcSelfHeal` solo puede reconstruirlas si el doc trae rows[].

El entorno (`scripts/entorno_tori.js`) es la copia mejorada del de tori-engineering: elementos con listeners reales y `_disparar()` para simular eventos, IndexedDB fiel (request.result disponible durante onupgradeneeded). Para parsers nuevos, sigue el patrón de `probar_parser.js`: bootear los bloques necesarios, FileReader que lee del disco con fs, y XLSX real inyectado en el sandbox.
