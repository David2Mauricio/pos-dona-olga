@echo off
setlocal

rem Envoltorio para la Tarea Programada de Windows (ver ADR de cierre y
rem docs/primer-arranque.md). %~dp0 es la carpeta donde vive ESTE .bat,
rem con barra final incluida -- así el script se ubica solo sin depender
rem de que el campo "Iniciar en" de la tarea quede bien configurado.
set "PROYECTO_DIR=%~dp0"
cd /d "%PROYECTO_DIR%"

if not exist "logs" mkdir "logs"

rem Reintento propio, NO el de la pestaña Configuración de la Tarea
rem Programada -- probado con evidencia real (ver ADR de cierre):
rem Windows Task Scheduler no mira el código de salida del proceso
rem lanzado para decidir si reintentar. Un crash real (código -1,
rem 0xFFFFFFFF) quedó registrado como "completó correctamente" en el
rem Programador de tareas (Get-WinEvent, evento 201) -- su reintento
rem configurado nunca se dispara para esto, solo si la tarea en sí
rem no llega a arrancar. Este loop es el único mecanismo real: mientras
rem la tarea entera siga "corriendo" (este .bat nunca termina en uso
rem normal), el servidor se relanza solo apenas node se cae, sin
rem depender de que Task Scheduler se entere de nada.
:reintentar

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

rem Pausa antes de reintentar: sin esto, un crash inmediato en cada
rem arranque (ej. falta node_modules) generaría un loop apretado
rem escribiendo el log sin parar. 5 segundos alcanza para no saturar,
rem sin demorar de más un reinicio real.
timeout /t 5 /nobreak > nul
goto reintentar
