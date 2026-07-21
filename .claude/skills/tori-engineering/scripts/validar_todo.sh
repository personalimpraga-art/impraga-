#!/usr/bin/env bash
# validar_todo.sh — REGRESIÓN COMPLETA de TORI en un solo comando.
# Correr SIEMPRE antes de entregar cualquier versión (reglas de oro 3 y 4).
#
# Uso:  bash validar_todo.sh /ruta/a/TORI_Praga_v5_XX.html
#
# Pasos:
#   1. Extraer los 5 bloques <script> y validarlos con node --check.
#   2. Prueba maestra del backup (round-trip de las 8 secciones + fotos).
#   3. Prueba de flujos vivos (saveToriParams, deleteLiqFactura → autosave → disco).
# Sale con código 0 solo si TODO pasa. Si algo falla: corregir y volver a correr TODO.
set -u
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HTML="${1:?Uso: bash validar_todo.sh /ruta/a/TORI_Praga_v5_XX.html}"
BLOQUES="${2:-/tmp/tori_bloques}"
FALLOS=0

echo "══════════════════════════════════════════════════"
echo " REGRESIÓN TORI · $(basename "$HTML")"
echo "══════════════════════════════════════════════════"

echo ""
echo "── [1/3] Sintaxis de los 5 bloques (node --check) ──"
python3 "$AQUI/extraer_bloques.py" "$HTML" --outdir "$BLOQUES" || FALLOS=$((FALLOS+1))

echo ""
echo "── [2/3] Prueba maestra del backup (round-trip) ──"
node "$AQUI/prueba_backup.js" "$BLOQUES" || FALLOS=$((FALLOS+1))

echo ""
echo "── [3/3] Flujos vivos (acciones reales → autosave → disco) ──"
node "$AQUI/prueba_flujos.js" "$BLOQUES" || FALLOS=$((FALLOS+1))

echo ""
echo "══════════════════════════════════════════════════"
if [ "$FALLOS" -eq 0 ]; then
  echo " ★ REGRESIÓN COMPLETA: TODO PASÓ — se puede entregar."
  exit 0
else
  echo " ★ REGRESIÓN: $FALLOS etapa(s) FALLARON — NO entregar. Corregir y re-correr TODO."
  exit 1
fi
