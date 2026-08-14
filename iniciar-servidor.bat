@echo off
setlocal

rem Envoltorio para la Tarea Programada de Windows (ver ADR de cierre y
rem docs/primer-arranque.md). %~dp0 es la carpeta donde vive ESTE .bat,
rem con barra final incluida -- así el script se ubica solo sin depender
rem de que el campo "Iniciar en" de la tarea quede bien configurado.
set "PROYECTO_DIR=%~dp0"
cd /d "%PROYECTO_DIR%"

if not exist "logs" mkdir "logs"

rem Fecha en formato AAAA-MM-DD vía PowerShell: el formato de %DATE% de
rem cmd depende de la configuración regional de Windows y no es
rem confiable para nombrar archivos de forma consistente.
for /f %%F in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "FECHA=%%F"
set "LOGFILE=logs\tarea-programada-%FECHA%.log"

echo. >> "%LOGFILE%"
echo ==== Arranque %DATE% %TIME% ==== >> "%LOGFILE%"

rem "call" para que el control vuelva a este script (y $ERRORLEVEL quede
rem el real de npm) en vez de terminar acá directamente.
call npm start >> "%LOGFILE%" 2>&1
set "CODIGO_SALIDA=%ERRORLEVEL%"

echo ==== Proceso terminado, codigo de salida %CODIGO_SALIDA% -- %DATE% %TIME% ==== >> "%LOGFILE%"

rem Un archivo nuevo por día es la rotación: nunca crece sin límite, y
rem "revisar qué pasó ayer" es simplemente abrir el archivo de esa fecha.
exit /b %CODIGO_SALIDA%
