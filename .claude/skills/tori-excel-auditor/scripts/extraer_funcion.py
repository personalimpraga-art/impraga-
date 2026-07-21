#!/usr/bin/env python3
"""
extraer_funcion.py — Saca una función (o const/var) de un bloque de TORI por balance
de llaves, para evaluarla en el REALM HOST con ExcelJS real (pitfall de realms:
vm.runInContext crea un realm separado y ExcelJS falla con Arrays cross-realm —
filas vacías silenciosas).

Uso:
    python3 extraer_funcion.py bloque_4.js addChinaSheet CHINA_COLS CHINA_HES CHINA_HCN > /tmp/extraido.js

Cada nombre puede ser una función (function NOMBRE / async function NOMBRE) o una
declaración (const/var/let NOMBRE = ...;). Imprime el código extraído por stdout,
en el orden pedido, listo para envolver en el arnés host.
Sale con código 1 si algún nombre no se encuentra.
"""
import re, sys

def _fin_balanceado(c, i, abre='{', cierra='}'):
    """Desde c[i]==abre, devuelve el índice DESPUÉS del cierre balanceado.
    Ignora llaves dentro de strings, template literals y comentarios."""
    prof = 0
    en_str = None  # "'", '"', '`'
    en_lc = en_bc = False  # line comment / block comment
    while i < len(c):
        ch = c[i]; sig = c[i+1] if i + 1 < len(c) else ''
        if en_lc:
            if ch == '\n': en_lc = False
        elif en_bc:
            if ch == '*' and sig == '/': en_bc = False; i += 1
        elif en_str:
            if ch == '\\': i += 1
            elif ch == en_str: en_str = None
        else:
            if ch == '/' and sig == '/': en_lc = True; i += 1
            elif ch == '/' and sig == '*': en_bc = True; i += 1
            elif ch in ('"', "'", '`'): en_str = ch
            elif ch == abre: prof += 1
            elif ch == cierra:
                prof -= 1
                if prof == 0: return i + 1
        i += 1
    return -1

def extraer(c, nombre):
    # 1) función (con o sin async, con indentación de IIFE)
    m = re.search(rf'^[ \t]*(async[ \t]+)?function[ \t]+{re.escape(nombre)}[ \t]*\(', c, re.M)
    if m:
        i = c.index('{', m.end() - 1)
        fin = _fin_balanceado(c, i)
        if fin < 0: return None
        return c[m.start():fin].strip() + '\n'
    # 2) const/var/let NOMBRE = ...;   (balancear (), [], {} hasta ; en profundidad 0)
    m = re.search(rf'^[ \t]*(const|var|let)[ \t]+{re.escape(nombre)}[ \t]*=', c, re.M)
    if m:
        i = m.end(); prof = 0; en_str = None
        while i < len(c):
            ch = c[i]
            if en_str:
                if ch == '\\': i += 1
                elif ch == en_str: en_str = None
            elif ch in ('"', "'", '`'): en_str = ch
            elif ch in '([{': prof += 1
            elif ch in ')]}': prof -= 1
            elif ch == ';' and prof == 0:
                return c[m.start():i + 1].strip() + '\n'
            i += 1
    return None

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr); sys.exit(1)
    with open(sys.argv[1], encoding='utf-8') as f:
        c = f.read()
    faltan = []
    for nombre in sys.argv[2:]:
        pieza = extraer(c, nombre)
        if pieza is None:
            faltan.append(nombre)
        else:
            print(f'/* ── extraído: {nombre} ── */')
            print(pieza)
    if faltan:
        print(f'✘ No se encontraron: {", ".join(faltan)}', file=sys.stderr)
        sys.exit(1)
