# Cómo generar TORI.exe

Esto convierte TORI en una aplicación de escritorio para Windows. Solo hay que
hacerlo **una vez** (o cada vez que llegue una versión nueva de TORI).

## Requisitos (una sola vez)

1. **Node.js** instalado en el PC → https://nodejs.org (botón "LTS").
2. **Internet** disponible durante la construcción (se baja el motor de Electron,
   ~200 MB, la primera vez). Después la app funciona 100% offline.

## Pasos

Abre una terminal (PowerShell) dentro de la carpeta `desktop/` y ejecuta:

```powershell
npm install
npm run package:win
```

Cuando termine, tendrás la app aquí:

```
desktop/dist/TORI-win32-x64/
    TORI.exe        <-  doble clic para abrir TORI
    ... (archivos de soporte)
```

Para llevarla a otro PC: copia **toda** la carpeta `TORI-win32-x64` (por ejemplo a
un USB o al Escritorio). No necesita instalación ni permisos de administrador:
se abre con doble clic en `TORI.exe`.

## Actualizar a una versión nueva de TORI

### El dato clave

El `.exe` lleva su **propia copia interna** del HTML en
`dist/TORI-win32-x64/resources/app/app/tori.html`. Cambiar `app/tori.html` NO
actualiza el `.exe` por sí solo. Pero como el paquete es carpeta plana (sin
asar), actualizar = **copiar el HTML nuevo a esa ruta interna**. Sin npm, sin
internet, sin reconstruir.

### Día a día: `ACTUALIZAR_FACIL.bat`

- Arrastra el `tori.html` nuevo **encima** de `ACTUALIZAR_FACIL.bat` (o doble
  clic para re-sincronizar el que ya está en `app/`). Copia el HTML a `app/` y
  a la copia interna del `.exe`. Un segundo, sin dependencias.
- Deja registro en `registro_actualizar.txt`.

### Primera vez o cambios a la cáscara (main.js/vendor): `RECONSTRUIR_COMPLETO.bat`

- Doble clic. Hace `npm install` (si hace falta) + `npm run package:win`.
- Deja registro en `registro_reconstruir.txt`. Si TORI.exe está abierto,
  cerrarlo antes (el --overwrite falla con el exe en uso).

### Forma manual

Los datos NO se pierden al actualizar: viven en la bóveda del PC, aparte del .exe
(ver `GUIA_TORI_APP.md`).

## Notas técnicas

- El HTML de TORI (`app/tori.html`) es una **copia byte-idéntica** del original.
  No se modifica ninguna función ni el aspecto.
- Las librerías `xlsx` y `exceljs` van **incluidas localmente** (`vendor/`), en la
  misma versión que usa TORI, para que los Excel funcionen sin internet.
- El motor es **Electron** (el mismo Chromium de Chrome) → TORI se ve y se comporta
  idéntico.
