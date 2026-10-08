#!/usr/bin/env bash
# preparar_entorno.sh — deja listo un CONTENEDOR NUEVO para correr TODAS las pruebas de TORI.
#
# Cada chat nuevo arranca en un contenedor limpio: sin playwright, sin exceljs/xlsx,
# sin openpyxl. Y los arneses buscan rutas FIJAS que cambiaron entre entornos:
#   /opt/node22/lib/node_modules/playwright   (15 arneses viejos)
#   ./lib/node_modules/exceljs                (6 arneses, relativo a esta carpeta)
#   /home/claude/lib/node_modules/…           (los arneses nuevos)
#   /home/claude/work/                        (carpeta de trabajo de la skill)
# Este script instala UNA vez y crea esas rutas como enlaces — así ningún arnés
# hay que editarlo. Es idempotente: correrlo dos veces no daña nada.
#
# Uso (lo PRIMERO en un chat nuevo, antes de cualquier prueba):
#   bash .claude/skills/tori-revision-real/scripts/preparar_entorno.sh
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
W=/home/claude/work
mkdir -p "$W" /home/claude/lib /opt/node22/lib/node_modules
cd "$W"
if [ ! -d node_modules/playwright-core ] || [ ! -d node_modules/exceljs ] || [ ! -d node_modules/xlsx ]; then
  echo "· instalando playwright-core, xlsx y exceljs (una sola vez)…"
  npm install --silent --no-audit --no-fund playwright-core xlsx exceljs >/dev/null
fi
ln -sfn "$W/node_modules" /home/claude/lib/node_modules
ln -sfn "$W/node_modules/playwright-core" /opt/node22/lib/node_modules/playwright
mkdir -p "$AQUI/lib"
ln -sfn "$W/node_modules" "$AQUI/lib/node_modules"
python3 -I -c "import openpyxl" 2>/dev/null || pip install -q openpyxl >/dev/null 2>&1 || true

FALTA=0
CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
if [ -x "$CHROME" ]; then echo "✔ Chromium en $CHROME"; else
  echo "✘ No está $CHROME — los arneses usan esa ruta. Versiones disponibles:"; ls /opt/pw-browsers/ 2>/dev/null; FALTA=1; fi
for m in playwright-core xlsx exceljs; do
  if node -e "require('/home/claude/lib/node_modules/$m')" 2>/dev/null; then echo "✔ $m"; else echo "✘ $m"; FALTA=1; fi
done
node -e "require('/opt/node22/lib/node_modules/playwright')" 2>/dev/null && echo "✔ ruta vieja /opt/node22/…/playwright" || { echo "✘ ruta vieja de playwright"; FALTA=1; }
node -e "require('$AQUI/lib/node_modules/exceljs')" 2>/dev/null && echo "✔ ruta vieja ./lib/node_modules/exceljs" || { echo "✘ ruta vieja de exceljs"; FALTA=1; }
python3 -I -c "import openpyxl" 2>/dev/null && echo "✔ openpyxl (Python)" || echo "· openpyxl no disponible (solo hace falta para analizar Excels con Python)"
[ $FALTA -eq 0 ] && echo "★ ENTORNO LISTO: todos los arneses de TORI pueden correr." || { echo "✘ Falta algo arriba — revisar antes de probar."; exit 1; }
