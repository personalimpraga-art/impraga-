#!/usr/bin/env python3
"""
extraer_bloques.py — Extrae los 5 bloques <script> inline de TORI y los valida con node --check.

Uso:
    python3 extraer_bloques.py TORI_Praga_v5_XX.html [--outdir /tmp/tori_bloques]

Salida: bloque_0.js ... bloque_4.js en el outdir, y el resultado de node --check de cada uno.
Código de salida 0 solo si los 5 bloques existen Y los 5 validan.
"""
import re, sys, os, subprocess, argparse

def extraer(html_path, outdir):
    with open(html_path, 'r', encoding='utf-8') as f:
        c = f.read()
    # Bloques inline: <script> sin src, al inicio de línea (los <script> dentro de
    # strings del código van precedidos de comillas/concatenación, nunca a inicio de línea).
    patron = re.compile(r'^<script>\n(.*?)^</script>', re.S | re.M)
    bloques = patron.findall(c)
    os.makedirs(outdir, exist_ok=True)
    rutas = []
    for i, b in enumerate(bloques):
        p = os.path.join(outdir, f'bloque_{i}.js')
        with open(p, 'w', encoding='utf-8') as f:
            f.write(b)
        rutas.append(p)
    return rutas

def validar(rutas):
    ok = True
    for p in rutas:
        r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
        kb = os.path.getsize(p) // 1024
        if r.returncode == 0:
            print(f'  ✔ {os.path.basename(p)} ({kb}KB) — sintaxis OK')
        else:
            ok = False
            print(f'  ✘ {os.path.basename(p)} ({kb}KB) — FALLA:\n{r.stderr}')
    return ok

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('--outdir', default='/tmp/tori_bloques')
    a = ap.parse_args()
    rutas = extraer(a.html, a.outdir)
    print(f'Bloques extraídos: {len(rutas)} → {a.outdir}')
    if len(rutas) != 5:
        print(f'✘ ERROR: se esperaban 5 bloques inline, se encontraron {len(rutas)}.')
        sys.exit(1)
    sys.exit(0 if validar(rutas) else 1)
