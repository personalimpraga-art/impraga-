# CLAUDE.md — Wiki maestra del proyecto TORI · Praga

> **Qué es este archivo:** la fuente única de verdad del proyecto. Claude lo lee al
> empezar cualquier sesión; Andrés lo actualiza cuando cambia una regla de negocio
> o se entrega una versión. Si algo aquí contradice el código de TORI, el código
> manda — y este archivo se corrige.
>
> **Última actualización:** 2026-07-23 · **Versión vigente de TORI: v5_72**

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
- [ ] Idealmente: carpeta de archivos de muestra reales (Excel YUGIN real, factura
      de contenedor, macro, un backup viejo) para que Claude pruebe contra la realidad

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

Cuando aparezca un incidente nuevo: se documenta aquí, se convierte en invariante
en el mapa técnico, y se le crea prueba que lo atrape para siempre.
