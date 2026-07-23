---
name: tori-entrega
description: >-
  Cierre de sesión de trabajo sobre TORI (Torre Integración · Praga). Usar SIEMPRE justo antes de entregar una versión nueva de TORI_Praga_v5_XX.html a Andrés — después de que la regresión pasó — para generar el changelog automático entre la versión vieja y la nueva, correr el checklist final de entrega, y armar el resumen en el formato de Andrés (directo, breve, en español: qué se cambió, qué se probó, qué dio cada prueba). También al preguntar "qué cambió entre estas dos versiones de TORI".
---

# TORI Entrega

El último paso de cada sesión. Nada de esto reemplaza las pruebas (skills tori-engineering, tori-excel-auditor, tori-parsers, tori-motor-distribuidor) — esto es el cierre ordenado DESPUÉS de que todo pasó.

## 1. Changelog automático

```bash
python3 scripts/changelog.py TORI_Praga_v5_68.html TORI_Praga_v5_69.html
```

Compara bloque a bloque: líneas +/−, **funciones tocadas por nombre**, y cambios en HTML/CSS fuera de los bloques. Normaliza el número de versión antes de comparar, así el bump (~51 menciones) no mete ruido — lo que reporta es cambio REAL. Úsalo para dos cosas:
- **Autoauditoría**: si el changelog muestra funciones que NO tenías intención de tocar, algo salió mal en el cambio quirúrgico — investigar antes de entregar.
- **Materia prima del resumen**: las funciones tocadas son la lista honesta de "qué se cambió".

## 2. Checklist final (verificar TODO antes de presentar)

1. La regresión completa (`validar_todo.sh` de tori-engineering) corrió **en esta sesión, sobre esta versión exacta**, y TODO pasó.
2. Si el cambio tocó exports de Excel → corrió la auditoría (tori-excel-auditor). Si tocó parsers → corrieron los fixtures (tori-parsers). Si tocó bloques 1/4 → corrió probar_motor_dist (tori-motor-distribuidor).
3. Si el cambio creó una clave de persistencia nueva → está en `_buildSnapshotData`, en `poblarTodo()` de la prueba del backup, y el round-trip pasó.
4. El changelog no muestra funciones tocadas inesperadas.
5. El archivo se copió a `/mnt/user-data/outputs/` y se presentó con present_files.
6. El resumen le recuerda a Andrés el ritual de instalación: **arrastrar el HTML
   nuevo encima de `ACTUALIZAR_FACIL.bat`**, cerrar y reabrir TORI.exe, y verificar
   el pill de versión (TORI corre como app de escritorio; ver §1 del CLAUDE.md).
   Si el cambio tocó la cáscara (`desktop/main.js`, `vendor/`), avisar EXPLÍCITAMENTE
   que esta vez toca `RECONSTRUIR_COMPLETO.bat`.

## 3. Resumen para Andrés (formato exacto)

Directo, breve, en español, sin adornos:

```
## TORI v5.69 lista

**Qué se cambió** (bloque N): [1-3 frases por cambio, con el nombre de la función si aplica]

**Qué se probó y qué dio:**
- Sintaxis 5 bloques: ✔ los 5 validan
- Backup round-trip: ✔ 8 secciones idénticas, fotos intactas
- Flujos vivos: ✔ [n/n]
- [Pruebas específicas del cambio]: ✔ [resultado concreto con números]

**Recuerda**: reemplaza TORI_Praga_v5_68.html por v5_69 en el conocimiento del proyecto.
```

Reglas del resumen: cada prueba se reporta con su RESULTADO (números, no "se probó"), nunca prometer algo no demostrado, y si algo quedó pendiente o con limitación conocida, decirlo explícito. Si la conversación quedó pesada, sugerir continuar en un chat nuevo del proyecto.
