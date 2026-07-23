@echo off
setlocal enableextensions
cd /d "%~dp0"
title Actualizar TORI

echo ============================================
echo     ACTUALIZADOR DE TORI  -  Praga
echo ============================================
echo.

REM 0) Ubicar la carpeta principal de TORI (donde esta package.json).
REM    Asi funciona aunque el .bat quede dentro de "app" por error.
if not exist "package.json" (
  if exist "..\package.json" cd ..
)
if not exist "package.json" (
  if exist "app\package.json" cd app
)
if not exist "package.json" (
  echo [ERROR] No encuentro el proyecto de TORI.
  echo.
  echo   Este archivo debe estar DENTRO de la carpeta principal de TORI:
  echo   la que contiene la carpeta "app", la carpeta "vendor" y el
  echo   archivo "package.json".
  echo.
  echo   Muevelo a esa carpeta y vuelve a intentar.
  echo.
  echo Presiona una tecla para cerrar...
  pause >nul
  exit /b 1
)

set "LOG=%CD%\_registro_actualizacion.txt"

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
      echo Presiona una tecla para cerrar...
      pause >nul
      exit /b 1
    )
    echo OK: TORI nuevo instalado.
    echo.
  ) else (
    echo [AVISO] Lo que arrastraste no es .html - lo ignoro y solo reempaqueto.
    echo.
  )
)

REM 2) Verificar Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No encuentro Node.js en tu PC.
  echo         Instalalo una vez desde https://nodejs.org  (boton "LTS").
  echo.
  echo Presiona una tecla para cerrar...
  pause >nul
  exit /b 1
)

REM 3) Instalar lo necesario solo la primera vez (a un registro)
if not exist "node_modules\@electron\packager" (
  echo Primera vez: descargando lo necesario ^(~200 MB, necesita internet^)...
  echo Esto puede tardar varios minutos. NO cierres esta ventana.
  echo   [el detalle se guarda en: _registro_actualizacion.txt]
  echo.
  call npm.cmd install > "%LOG%" 2>&1
  if errorlevel 1 (
    echo [ERROR] Fallo la descarga. Revisa tu internet.
    echo         El detalle quedo en: _registro_actualizacion.txt
    echo         Si quieres, enviame ese archivo por el chat.
    echo.
    echo Presiona una tecla para cerrar...
    pause >nul
    exit /b 1
  )
)

REM 4) Generar el .exe  (la parte lenta; el texto va al registro)
echo.
echo Generando la aplicacion TORI.exe ...
echo   Esto tarda entre 15 segundos y 1 minuto. NO cierres la ventana.
echo   [el detalle se guarda en: _registro_actualizacion.txt]
echo.
call npm.cmd run package:win > "%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] Algo fallo al generar el .exe.
  echo         El detalle quedo en: _registro_actualizacion.txt
  echo         Enviame ese archivo por el chat y lo resolvemos.
  echo.
  echo Presiona una tecla para cerrar...
  pause >nul
  exit /b 1
)

REM 5) Confirmar que el .exe existe
if not exist "dist\TORI-win32-x64\TORI.exe" (
  echo [ERROR] Termino sin errores pero no encuentro el TORI.exe.
  echo         Revisa _registro_actualizacion.txt y enviamelo.
  echo.
  echo Presiona una tecla para cerrar...
  pause >nul
  exit /b 1
)

echo ============================================
echo     LISTO !  TORI quedo actualizado.
echo ============================================
echo.
echo   Tu app nueva esta AQUI (abre este):
echo   %CD%\dist\TORI-win32-x64\TORI.exe
echo.
echo   Tus datos NO se tocaron.
echo   Voy a abrir esa carpeta ahora...
echo.
start "" explorer "%CD%\dist\TORI-win32-x64"

echo Cuando abras TORI.exe, en la barra lateral debe decir la version nueva.
echo.
echo Presiona una tecla para cerrar esta ventana...
pause >nul
