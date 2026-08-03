# Archivos de muestra reales (para probar contra la realidad)

Datos REALES de la operación de Praga. Usarlos en pruebas de parsers, imports
y flujos — nunca inventar estructuras cuando estos existen.

| Archivo | Qué es | Datos clave |
|---|---|---|
| `FACTURA_20260715_PRAGA145.xlsx` | Factura de contenedor (Liquidador) | 1 hoja, 141 filas, 142 fotos incrustadas. Sirvió para cazar los bugs del flete (v5_74/v5_75). |
| `MACRO_INVENTARIO_03082026.xlsx` | Macro de inventario (Motor Reorden) | Hoja1: Código de Artículo, Nombre, Grupo, Saldo en inventario, Cubicaje, Núm. Contenedor, Unidad de empaque, Días de inventario… |

Cómo usarlos: importarlos por el flujo REAL (setInputFiles en `#fileFacturas` /
`#fileMacro` con Chromium, o los arneses de tori-parsers). Ver la skill
tori-app-escritorio §6 para el montaje sin Electron.
