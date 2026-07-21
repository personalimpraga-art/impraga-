#!/usr/bin/env python3
"""
changelog.py — Compara dos versiones de TORI y reporta QUÉ cambió, bloque a
bloque: líneas añadidas/quitadas, funciones tocadas, y diferencias fuera de los
bloques (HTML/CSS). Es la base del resumen de entrega.

Uso:
    python3 changelog.py TORI_Praga_v5_68.html TORI_Praga_v5_69.html
"""
import re, sys, difflib

def bloques(ruta):
    with open(ruta, encoding='utf-8') as f:
        c = f.read()
    # Normalizar el número de versión (v5.68 → v5.XX) para que el bump de versión
    # no contamine el diff con ~51 líneas de ruido — solo cambios REALES.
    c = re.sub(r'v5\.\d+\b', 'v5.XX', c)
    return c, re.findall(r'^<script>\n(.*?)^</script>', c, re.S | re.M)

def funciones_tocadas(viejo, nuevo):
    """Nombres de función cuyas líneas aparecen en el diff."""
    difs = list(difflib.unified_diff(viejo.splitlines(), nuevo.splitlines(), lineterm='', n=0))
    tocadas, alcance = set(), None
    # mapa línea→función del archivo nuevo (y del viejo para borrados)
    def mapa(texto):
        m, actual = {}, None
        for i, ln in enumerate(texto.splitlines()):
            f = re.match(r'\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', ln)
            if f: actual = f.group(1)
            m[i] = actual
        return m
    mv, mn = mapa(viejo), mapa(nuevo)
    ln_v = ln_n = 0
    for d in difs:
        m = re.match(r'@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@', d)
        if m:
            ln_v, ln_n = int(m.group(1)) - 1, int(m.group(2)) - 1
        elif d.startswith('-') and not d.startswith('---'):
            if mv.get(ln_v): tocadas.add(mv[ln_v])
            ln_v += 1
        elif d.startswith('+') and not d.startswith('+++'):
            if mn.get(ln_n): tocadas.add(mn[ln_n])
            ln_n += 1
    return tocadas

def main():
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(1)
    ra, rb = sys.argv[1], sys.argv[2]
    ca, ba = bloques(ra)
    cb, bb = bloques(rb)
    if len(ba) != 5 or len(bb) != 5:
        print(f'⚠ Bloques inline: {len(ba)} en la vieja, {len(bb)} en la nueva (se esperaban 5).')

    print(f'CHANGELOG · {ra.split("/")[-1]} → {rb.split("/")[-1]}')
    hubo = False
    for i in range(min(len(ba), len(bb))):
        if ba[i] == bb[i]:
            continue
        hubo = True
        va, vb = ba[i].splitlines(), bb[i].splitlines()
        mas = sum(1 for d in difflib.unified_diff(va, vb, lineterm='', n=0) if d.startswith('+') and not d.startswith('+++'))
        menos = sum(1 for d in difflib.unified_diff(va, vb, lineterm='', n=0) if d.startswith('-') and not d.startswith('---'))
        fns = funciones_tocadas(ba[i], bb[i])
        print(f'\n■ BLOQUE {i}: +{mas} / −{menos} líneas ({len(va)} → {len(vb)})')
        if fns:
            print(f'  Funciones tocadas ({len(fns)}): ' + ', '.join(sorted(fns)[:20]) + (' …' if len(fns) > 20 else ''))

    # Fuera de los bloques (HTML/CSS): comparar quitando los bloques
    fa = re.sub(r'^<script>\n.*?^</script>', '<script>…</script>', ca, flags=re.S | re.M)
    fb = re.sub(r'^<script>\n.*?^</script>', '<script>…</script>', cb, flags=re.S | re.M)
    if fa != fb:
        hubo = True
        mas = sum(1 for d in difflib.unified_diff(fa.splitlines(), fb.splitlines(), lineterm='', n=0) if d.startswith('+') and not d.startswith('+++'))
        menos = sum(1 for d in difflib.unified_diff(fa.splitlines(), fb.splitlines(), lineterm='', n=0) if d.startswith('-') and not d.startswith('---'))
        print(f'\n■ HTML/CSS (fuera de bloques): +{mas} / −{menos} líneas')

    if not hubo:
        print('\n(Sin diferencias — los archivos son idénticos salvo quizá el número de versión.)')

if __name__ == '__main__':
    main()
