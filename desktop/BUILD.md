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

### Forma fácil (recomendada, sin terminal): `actualizar.bat`

- **Tienes un TORI nuevo:** arrastra el `tori.html` nuevo y suéltalo **encima** de
  `actualizar.bat`. Él solo lo instala y regenera el `.exe`.
- **Solo reempaquetar:** doble clic en `actualizar.bat`.

### Forma manual

1. Reemplaza `desktop/app/tori.html` por el HTML nuevo de TORI (mismo nombre).
2. Vuelve a correr `npm run package:win`.

Los datos NO se pierden al actualizar: viven en la bóveda del PC, aparte del .exe
(ver `GUIA_TORI_APP.md`).

## Notas técnicas

- El HTML de TORI (`app/tori.html`) es una **copia byte-idéntica** del original.
  No se modifica ninguna función ni el aspecto.
- Las librerías `xlsx` y `exceljs` van **incluidas localmente** (`vendor/`), en la
  misma versión que usa TORI, para que los Excel funcionen sin internet.
- El motor es **Electron** (el mismo Chromium de Chrome) → TORI se ve y se comporta
  idéntico.
