---
name: tori-motor-distribuidor
description: >-
  Pruebas vivas de las reglas de negocio del Motor Praga Reorden (bloque 1) y el Distribuidor de Contenedores (bloque 4) de TORI. Usar SIEMPRE que un cambio en TORI_Praga_v5_XX.html toque la vista Repetidos, la cadena de suministro (Stock / San Benito / En camino / Fábrica), el reparto en contenedores, los overrides de la junta directiva (bolsos=12, cortinas=20), los Tier A/B/C, la mercancía nueva dosificada, o cuando Andrés reporte refs repetidas mal detectadas, contenedores sobrecargados o límites ignorados. Son reglas con plata de por medio: un contenedor mal repartido cuesta dinero real.
---

# TORI Motor + Distribuidor

La regresión base (skill tori-engineering) cubre el backup (bloques 0 y 3). Esta skill cubre las reglas de negocio de los bloques 1 y 4, donde un bug no rompe datos — rompe decisiones de compra.

## Correr la prueba

```bash
# Requiere los bloques extraídos (extraer_bloques.py de tori-engineering)
node scripts/probar_motor_dist.js [/tmp/tori_bloques]
```

**Parte 1 — Repetidos en la cadena** (bloque 1): extrae `computeRepetidosCadena` + `norm` al realm host (es cómputo puro sobre `window`) y verifica con un mundo de 4 refs: detección de repetidas en Stock+SB y en EnCamino+Fábrica, cero falsos positivos (una ref en un solo eslabón NO sale), saldo 0 no cuenta como STOCK, y que las unidades y los nombres de doc/factura por eslabón salen correctos (van VISIBLES en las celdas de la vista).

**Parte 2 — Distribuidor** (bloques 0+4 arrancados de verdad): usa la API real `window.DIST` (`_distributeGroup`, `_computeIntelligence`, `_state`):
- Límite duro de la junta (`D.overrides`, ej. BOLSO DAMA CUERO = 12): ningún contenedor puede pasarse.
- Techo de capacidad respetado (capacidad efectiva × 1.25 + tolerancia).
- Inteligencia: descripción Tier A y rápida puntúa mejor que Tier C y lenta.

## Formas reales (verificadas en el código — el mapa antiguo era impreciso en esto)

- **Repetido**: `{codigo, nombre, categoria, combo: 'STOCK + SAN BENITO', nLugares, stock, enCamino, enCaminoFacturas, sanBenito, prodChina, prodChinaDocs}` — el campo es `combo` (string), no una lista.
- **`TORI.sanBenito.items`**: mapa `refNormalizada → NÚMERO de unidades` (no objetos).
- **`distributeGroup(products, groupLabel, startNum, effectiveCapacity)`**: EMPUJA los contenedores a `D.containers` y devuelve el siguiente número — vaciar `D.containers = []` antes de llamar y leerlo después. Cada contenedor: `{id, supplierId, products[], totalCbm, totalValue, descCounts, newCbm, newDescCounts, supplierMix, descLimits}`.
- Productos para el Distribuidor: `{ref, desc, tipo, cubTotal, valor, dias, tier, isNew, proveedor}`.
- Los parámetros del panel (`dpNewPct`, `dpDiasRef`, `dpMinLimit`…) se leen con `num(id, default)` — con el DOM mock vacío rigen los defaults (30% nuevos, diasRef 120, límites [2,25]).

## Al interpretar resultados

Si se colocan MENOS productos de los esperados no es necesariamente un bug: los **límites inteligentes por descripción** dosifican a propósito (pocas descripciones distintas ⇒ topes dominan; el sobrante va a rezagos en el flujo real). Verifica contra las reglas antes de "corregir". Si cambias reglas del Distribuidor a pedido de Andrés, actualiza las aserciones Y este archivo.

Al modificar la vista Repetidos, además de esta prueba corre el export con fotos por la skill **tori-excel-auditor** (patrón `probar_addChinaSheet.js`). El orden de columnas oficial de la vista es Stock → San Benito → En camino → Fábrica.

`scripts/entorno_tori.js` y `scripts/extraer_funcion.py` son copias compartidas con las otras skills de TORI (entorno con listeners reales; extractor por balance de llaves).
