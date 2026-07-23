@echo off
setlocal enableextensions
title ACTUALIZAR TORI - facil
cd /d "%~dp0"

echo.
echo  ============================================
echo    ACTUALIZADOR FACIL DE TORI  -  Praga
echo  ============================================
echo.

rem -- Ubicar la carpeta principal, la que tiene package.json --
if exist "package.json" goto raiz_ok
if exist "..\package.json" goto subir
goto no_raiz

:subir
cd ..

:raiz_ok
set "LOG=%CD%\registro_actualizar.txt"
echo REGISTRO DE ACTUALIZACION DE TORI > "%LOG%"
echo Carpeta: %CD% >> "%LOG%"

rem -- Paso 1: si arrastraste un html nuevo, instalarlo en app\ --
if "%~1"=="" goto sin_arrastre
if /I not "%~x1"==".html" goto no_es_html

echo Detecte un TORI nuevo: %~nx1
echo Detecte: %~1 >> "%LOG%"
if exist "app\tori.html" copy /Y "app\tori.html" "app\tori_anterior.html" >nul
copy /Y "%~1" "app\tori.html" >nul
if errorlevel 1 goto err_copia_app
echo OK: instalado como app\tori.html
echo OK copia a app\tori.html >> "%LOG%"
echo.
goto al_exe

:sin_arrastre
echo No arrastraste ningun archivo nuevo.
echo Voy a usar el TORI que ya esta en app\tori.html
echo.
goto al_exe

:no_es_html
echo Lo que arrastraste no es un archivo .html - lo ignoro.
echo Voy a usar el TORI que ya esta en app\tori.html
echo.
goto al_exe

rem -- Paso 2: copiar el HTML DENTRO de la aplicacion ya construida --
:al_exe
set "DEST=dist\TORI-win32-x64\resources\app\app"
if not exist "%DEST%\" goto sin_app
copy /Y "app\tori.html" "%DEST%\tori.html" >nul
if errorlevel 1 goto err_copia_exe
echo OK dentro del exe >> "%LOG%"

echo  ============================================
echo    LISTO. TORI quedo actualizado.
echo  ============================================
echo.
echo  1. Si TORI esta abierto, CIERRALO.
echo  2. Abrelo de nuevo desde:
echo     %CD%\dist\TORI-win32-x64\TORI.exe
echo  3. En la barra lateral veras la version nueva.
echo.
echo  Tus datos NO se tocaron.
echo.
goto fin

:no_raiz
echo [ERROR] No encuentro la carpeta principal de TORI.
echo Este archivo debe estar en la carpeta que contiene
echo la carpeta app, la carpeta dist y el archivo package.json
echo.
goto fin

:err_copia_app
echo [ERROR] No pude copiar el archivo a app\tori.html
echo Cierra TORI y todos los Exploradores y reintenta.
echo ERROR copia a app >> "%LOG%"
goto fin

:sin_app
echo [ERROR] No encuentro la aplicacion construida en:
echo   %CD%\dist\TORI-win32-x64
echo Hay que construirla una vez con RECONSTRUIR_COMPLETO.bat
echo ERROR no existe dist >> "%LOG%"
goto fin

:err_copia_exe
echo [ERROR] No pude copiar dentro de la aplicacion.
echo Cierra TORI.exe y vuelve a intentar.
echo ERROR copia al exe >> "%LOG%"
goto fin

:fin
echo Presiona cualquier tecla para cerrar esta ventana . . .
pause >nul
endlocal
