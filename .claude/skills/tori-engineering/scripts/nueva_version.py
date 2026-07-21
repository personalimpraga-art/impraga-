#!/usr/bin/env python3
"""
nueva_version.py — Regla de oro 1: NUNCA editar el original.
Copia TORI_Praga_v5_XX.html → TORI_Praga_v5_YY.html (YY = XX+1, o el que se pida)
y actualiza TODAS las apariciones internas de v5.XX → v5.YY.

Uso:
    python3 nueva_version.py TORI_Praga_v5_68.html                  # → v5_69 en el mismo dir
    python3 nueva_version.py TORI_Praga_v5_68.html --outdir /home/claude/work
    python3 nueva_version.py TORI_Praga_v5_68.html --a 70           # forzar número destino

Verifica al final que en el archivo nuevo: 0 apariciones de la versión vieja,
n>0 de la nueva. Sale con código 1 si algo no cuadra.
"""
import re, sys, os, argparse, shutil

ap = argparse.ArgumentParser()
ap.add_argument('html')
ap.add_argument('--outdir', default=None)
ap.add_argument('--a', type=int, default=None, help='número de versión destino (default: actual+1)')
a = ap.parse_args()

m = re.search(r'v5[._](\d+)\.html$', os.path.basename(a.html))
if not m:
    print('✘ El nombre no sigue el patrón TORI_Praga_v5_XX.html'); sys.exit(1)
viejo = int(m.group(1))
nuevo = a.a if a.a is not None else viejo + 1
outdir = a.outdir or os.path.dirname(os.path.abspath(a.html))
os.makedirs(outdir, exist_ok=True)
destino = os.path.join(outdir, f'TORI_Praga_v5_{nuevo}.html')

if os.path.exists(destino):
    print(f'✘ {destino} ya existe — no se sobreescribe una versión.'); sys.exit(1)

with open(a.html, 'r', encoding='utf-8') as f:
    c = f.read()
n_viejo = len(re.findall(rf'v5\.{viejo}\b', c))
c2 = re.sub(rf'v5\.{viejo}\b', f'v5.{nuevo}', c)
with open(destino, 'w', encoding='utf-8') as f:
    f.write(c2)

# Verificación (regla 3: no suponer que quedó bien)
with open(destino, 'r', encoding='utf-8') as f:
    v = f.read()
quedan_viejo = len(re.findall(rf'v5\.{viejo}\b', v))
hay_nuevo = len(re.findall(rf'v5\.{nuevo}\b', v))
print(f'Copiado: {os.path.basename(a.html)} → {os.path.basename(destino)}')
print(f'Reemplazos v5.{viejo} → v5.{nuevo}: {n_viejo} · quedan viejos: {quedan_viejo} · nuevos presentes: {hay_nuevo}')
if quedan_viejo == 0 and hay_nuevo >= n_viejo and n_viejo > 0:
    print(f'✔ Versión interna actualizada. Trabaja SOLO sobre {destino}')
    sys.exit(0)
print('✘ La actualización de versión no cuadra — revisar a mano.')
sys.exit(1)
