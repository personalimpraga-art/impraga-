@echo off
setlocal enableextensions
title RECONSTRUIR TORI - completo
cd /d "%~dp0"

echo.
echo  ============================================
echo    RECONSTRUCCION COMPLETA DE TORI  -  Praga
echo  ============================================
echo  Solo se usa la primera vez, o cuando Claude
echo  te lo pida. Para el dia a dia usa
echo  ACTUALIZAR_FACIL.bat
echo  ============================================
echo.

if exist "package.json" goto raiz_ok
if exist "..\package.json" goto subir
goto no_raiz

:subir
cd ..

:raiz_ok
set "LOG=%CD%\registro_reconstruir.txt"
echo REGISTRO DE RECONSTRUCCION > "%LOG%"
echo Carpeta: %CD% >> "%LOG%"

where node >nul 2>nul
if errorlevel 1 goto sin_node

if exist "node_modules\@electron\packager\" goto empaquetar

echo Descargando lo necesario, unos 200 MB. Necesita internet.
echo Puede tardar varios minutos. NO cierres esta ventana.
echo El detalle queda en registro_reconstruir.txt
echo.
call npm.cmd install >> "%LOG%" 2>&1
if errorlevel 1 goto err_npm

:empaquetar
echo Generando la aplicacion TORI.exe ...
echo Tarda entre 15 segundos y 1 minuto. NO cierres la ventana.
echo.
call npm.cmd run package:win >> "%LOG%" 2>&1
if errorlevel 1 goto err_paquete
if not exist "dist\TORI-win32-x64\TORI.exe" goto err_sin_exe

echo  ============================================
echo    LISTO. La aplicacion quedo construida.
echo  ============================================
echo.
echo  Abre TORI aqui:
echo  %CD%\dist\TORI-win32-x64\TORI.exe
echo.
echo  Tus datos NO se tocaron.
echo.
start "" explorer "%CD%\dist\TORI-win32-x64"
goto fin

:no_raiz
echo [ERROR] No encuentro la carpeta principal de TORI.
echo Este archivo va en la carpeta que contiene app, vendor
echo y package.json
goto fin

:sin_node
echo [ERROR] No encuentro Node.js en este PC.
echo Instalalo una vez desde https://nodejs.org boton LTS
echo y vuelve a intentar.
goto fin

:err_npm
echo [ERROR] Fallo la descarga. Revisa tu internet.
echo El detalle esta en registro_reconstruir.txt
echo Enviame ese archivo por el chat y lo reviso.
goto fin

:err_paquete
echo [ERROR] Fallo la construccion del exe.
echo IMPORTANTE: si TORI.exe esta ABIERTO, cierralo y reintenta.
echo El detalle esta en registro_reconstruir.txt
echo Enviame ese archivo por el chat y lo reviso.
goto fin

:err_sin_exe
echo [ERROR] Termino pero no aparecio TORI.exe
echo Enviame registro_reconstruir.txt por el chat.
goto fin

:fin
echo.
echo Presiona cualquier tecla para cerrar esta ventana . . .
pause >nul
endlocal
