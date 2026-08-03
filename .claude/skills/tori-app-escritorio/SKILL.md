---
name: tori-app-escritorio
description: >-
  El envoltorio de escritorio de TORI (TORI.exe, Electron, carpeta desktop/ del repo).
  Usar SIEMPRE que la conversación toque: TORI.exe, la app de escritorio, instalar o
  actualizar una versión de TORI en el PC de Andrés, ACTUALIZAR_FACIL.bat,
  RECONSTRUIR_COMPLETO.bat, desktop/main.js, vendor/ (xlsx/exceljs offline),
  descargas que no aparecen, notificaciones de descarga, "Generar app para cliente",
  respaldos automáticos en Documentos/Backups TORI, registro_actualizar.txt,
  registro_reconstruir.txt, o cualquier error del .exe. También antes de entregar
  cualquier versión nueva de TORI_Praga_v5_XX.html (el ritual de instalación vive aquí).
---

# TORI · App de escritorio (TORI.exe)

TORI corre como **aplicación de escritorio Windows** (Electron) desde 2026-07-23.
Ya NO corre en Chrome. Andrés NO es programador: todo lo que se le pida hacer debe
ser doble clic o arrastrar archivos.

## 1. Mapa del sistema

**En el PC de Andrés** — carpeta `TORI\` (antes se llamó `desktop`):
```
TORI\
  app\tori.html            ← el HTML de TORI (copia byte-idéntica del entregado)
  app\tori_anterior.html   ← versión anterior (marcha atrás automática)
  vendor\xlsx.full.min.js  ← 0.18.5, de npm (cdnjs está en el HTML pero puede no haber internet)
  vendor\exceljs.min.js    ← 4.4.0
  build\icon.ico|png       ← ícono TORI (pill morado, estética iOS)
  main.js                  ← la cáscara Electron (ver §4)
  package.json             ← version = la de TORI (5.XX.0); script package:win
  node_modules\            ← ya instalado (electron + @electron/packager)
  dist\TORI-win32-x64\TORI.exe            ← la app que Andrés abre
  dist\TORI-win32-x64\resources\app\...   ← copia interna del proyecto (¡ver §2!)
  ACTUALIZAR_FACIL.bat · RECONSTRUIR_COMPLETO.bat  (pueden estar en app\; se auto-ubican)
  registro_actualizar.txt · registro_reconstruir.txt  ← logs de los .bat
```
**En este repo:** todo vive en `desktop/` (mismo contenido salvo node_modules/dist).
Los .bat son ASCII puro + CRLF, estilo goto (ver §5).

**Datos de Andrés:** en la bóveda `%AppData%\TORI\` (sesión por defecto de Electron)
+ respaldo automático rotado (últimas 5 copias) en `Documentos\Backups TORI\`.
Actualizar la app NUNCA toca los datos.

## 2. EL DATO CLAVE (origen de un bug ya pagado)

El paquete se genera **sin asar** → el `.exe` lee su **copia interna** en
`dist\TORI-win32-x64\resources\app\app\tori.html`. Reemplazar `app\tori.html`
NO cambia lo que muestra el .exe. Por eso:
- **Actualizar el HTML = copiar el archivo a ambos lados** (eso hace ACTUALIZAR_FACIL.bat,
  1 segundo, sin npm ni internet). NUNCA hace falta reconstruir por un cambio de HTML.
- Reconstruir con npm solo aplica si cambió la cáscara (main.js, vendor, ícono, package.json).

## 3. Ritual de entrega (recordárselo a Andrés en CADA versión)

**Caso normal (solo cambió TORI_Praga_v5_XX.html):**
1. Entregar el HTML nuevo. 2. Andrés lo **arrastra encima de ACTUALIZAR_FACIL.bat**.
3. Cierra y reabre TORI.exe → el pill morado de la barra lateral muestra la versión nueva.

**Caso cáscara (cambió desktop/main.js, vendor/, ícono):** avisar EXPLÍCITAMENTE:
1. (Si también hay HTML nuevo) arrastrarlo a ACTUALIZAR_FACIL.bat.
2. Reemplazar `main.js` (o lo que cambió) en la carpeta TORI.
3. Doble clic en **RECONSTRUIR_COMPLETO.bat** (~1 min; internet solo si no hay node_modules).

**Si algo falla:** pedirle el `registro_actualizar.txt` o `registro_reconstruir.txt`
(los .bat vuelcan ahí todo el detalle) y/o foto de la ventana. No adivinar.

## 4. Arquitectura de main.js (la cáscara)

- Esquema propio **`tori://localhost`** con privilegios (standard+secure+fetch):
  contexto seguro para la File System Access API de TORI y origen estable para que
  localStorage/IndexedDB persistan siempre en la misma bóveda.
- `serveHtml()`: sirve `app/tori.html` con UN solo cambio — inyecta
  `<script src="tori://localhost/vendor/xlsx...">` y `<script ...exceljs...>` ANTES
  del tag CDN de xlsx. Así la app es 100% offline (ExcelJS ya definido hace que
  `_loadExcelJS` de TORI ni intente el CDN) y los tags CDN originales quedan intactos.
- `will-download`: TODA descarga se guarda sola en **Descargas** (nombre único) y
  lanza una notificación de Windows clicable. Sin esto, el diálogo por defecto de
  Electron bajo esquema propio era frágil → "el botón no hace nada".
- Respaldo de la bóveda a `Documentos\Backups TORI` al cerrar + cada 30 min (rota 5).
- Instancia única; ventanas externas → navegador del sistema.

## 5. INVARIANTES de la cáscara (bugs ya pagados — no repetir)

1. **`app/tori.html` es SAGRADO: copia byte-idéntica del HTML entregado.** La cáscara
   no lo modifica en disco jamás; cualquier ajuste se hace al SERVIRLO (serveHtml).
2. **NUNCA incrustar vendor inline en el HTML servido.** El código de xlsx contiene
   el texto `'</head>'` y `generarHTMLCliente` de TORI (PI2) inserta su catálogo en el
   PRIMER `</head>` del documento serializado → un inline corrompe los archivos
   generados (se vio como "código regado en pantalla").
3. **Nada de `String.replace()` con contenido de librerías como reemplazo** (las
   secuencias `$&`, `` $` ``… lo corrompen). Usar `split().join()`.
4. **No reescribir URLs del HTML a `tori://`**: TORI genera archivos copiando el DOM
   vivo (`outerHTML`) y esas URLs quedan muertas en el PC de un cliente.
5. **Los .bat**: solo ASCII (sin tildes), CRLF, estilo `goto` (sin bloques `if (...)`
   con paréntesis — el intérprete de cmd los rompe con texto que traiga paréntesis),
   `pause` garantizado en TODA salida, y log a archivo (npm vuela la ventana).
6. El manejador de descargas cubre TODOS los exports de TORI (Excel, backups, apps
   de cliente). Si se toca, probar al menos uno de cada tipo.
7. **`window.prompt()` NO existe en Electron** — lanza "Uncaught Error: prompt() is
   not supported" (incidente 2026-08-03: vetar productos reventaba en el .exe pero
   funcionaba en Chrome). TODA ventana de "escribe un valor" usa `toriPrompt`
   (bloque 0, devuelve Promise; Enter = aceptar, Escape/Cancelar = null). Prohibido
   `prompt()` nativo; los flujos interactivos se prueban con prompt() LANZANDO el
   error de Electron, no solo con un prompt que funciona (`alert`/`confirm` sí
   existen en Electron).

## 6. Probar sin Electron (github está bloqueado en el entorno de Claude)

El binario de Electron no se puede descargar aquí (403). Se prueba así:
- Chromium real: `playwright-core` + ejecutable en `/opt/pw-browsers/chromium-*/chrome-linux/chrome`.
- Servir por http (`python3 -m http.server`) una copia de `app/tori.html` con los
  tags vendor inyectados con la MISMA lógica de `serveHtml` (vendor por ruta http).
- Simular "sin internet": `page.route('**cdnjs.cloudflare.com/**', r => r.abort())`.
- Para "Generar app para cliente": sembrar `state.catalogo` a escala real (5000+ refs
  con foto canvas), esperar `page.waitForEvent('download')`, y ABRIR el archivo
  generado (con todo lo externo bloqueado) verificando que arranca la pantalla pi2.
- `node --check main.js` siempre; y verificar la lógica de serveHtml con un script
  Node aparte antes de entregar.

## 7. División de responsabilidades

- Cambios al HTML de TORI → skill **tori-engineering** (regresión obligatoria) y las
  demás skills TORI. La entrega SIEMPRE termina con el ritual del §3.
- Cambios a la cáscara → esta skill + avisar RECONSTRUIR en la entrega + probar §6.
- La wiki maestra (`CLAUDE.md` §1) tiene el resumen para Andrés; si algo cambia aquí,
  actualizar también la wiki y viceversa.
