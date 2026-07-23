@echo off
setlocal enableextensions
cd /d "%~dp0"
title Actualizar TORI

echo ============================================
echo     ACTUALIZADOR DE TORI  -  Praga
echo ============================================
echo.

REM ---------------------------------------------------------------
REM  FORMA DE USO (dos maneras, la que prefieras):
REM
REM  A) Tienes un TORI nuevo:  arrastra el archivo tori.html NUEVO
REM     y sueltalo ENCIMA de este actualizar.bat. El solo lo instala
REM     y reempaqueta.
REM
REM  B) Solo reempaquetar:     haz doble clic normal en este archivo.
REM ---------------------------------------------------------------

REM 1) Si arrastraste un archivo .html, lo instala como el nuevo TORI
if not "%~1"=="" (
  if /I "%~x1"==".html" (
    echo Detecte un TORI nuevo: %~nx1
    echo Reemplazando el TORI actual por el nuevo...
    if exist "app\tori.html" copy /Y "app\tori.html" "app\tori_anterior.html" >nul
    copy /Y "%~1" "app\tori.html" >nul
    if errorlevel 1 (
      echo.
      echo [ERROR] No pude reemplazar el archivo.
      echo         Cierra TORI si esta abierto y vuelve a intentar.
      echo.
      pause
      exit /b 1
    )
    echo OK: TORI nuevo instalado.
    echo     (Por si acaso, el anterior quedo guardado como app\tori_anterior.html)
    echo.
  ) else (
    echo [AVISO] Lo que arrastraste no es un archivo .html - lo ignoro.
    echo         Voy a reempaquetar el TORI que ya esta instalado.
    echo.
  )
)

REM 2) Verificar que Node.js este instalado
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No encuentro Node.js en tu PC.
  echo.
  echo         Instalalo UNA sola vez desde:  https://nodejs.org
  echo         (el boton grande que dice "LTS"), y vuelve a intentar.
  echo.
  pause
  exit /b 1
)

REM 3) Instalar lo necesario solo la PRIMERA vez
if not exist "node_modules\@electron\packager" (
  echo Primera vez en esta carpeta: descargando lo necesario...
  echo Necesita internet, son unos ~200 MB, puede tardar unos minutos.
  echo Ten paciencia y no cierres esta ventana.
  echo.
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo la descarga. Revisa tu conexion a internet y reintenta.
    echo.
    pause
    exit /b 1
  )
  echo.
)

REM 4) Generar el .exe
echo Generando la aplicacion TORI.exe ... un momento por favor.
echo.
call npm.cmd run package:win
if errorlevel 1 (
  echo.
  echo [ERROR] Algo fallo al generar el .exe.
  echo         Copia el texto de arriba y enviamelo al chat para ayudarte.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo     LISTO !  TORI quedo actualizado.
echo ============================================
echo.
echo Tu app esta en:   dist\TORI-win32-x64\TORI.exe
echo Tus datos NO se tocaron (siguen guardados en tu PC).
echo.
echo Voy a abrir la carpeta de la app...
if exist "dist\TORI-win32-x64" start "" explorer "dist\TORI-win32-x64"
echo.
echo Ya puedes cerrar esta ventana.
pause
