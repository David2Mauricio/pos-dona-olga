# Crea la Tarea Programada de Windows que arranca el servidor del POS.
# Correr UNA VEZ, desde una PowerShell abierta como Administrador
# (clic derecho -> "Ejecutar como administrador").
#
# Qué hace: registra iniciar-servidor.bat para correr al iniciar Windows
# (sin necesitar que nadie inicie sesión gráfica). El reintento si el
# proceso muere NO se configura acá -- probado con evidencia real que la
# opción "reiniciar cada X" de Task Scheduler no sirve para esto (mira si
# la TAREA pudo lanzarse, no el código de salida del proceso que lanzó; un
# crash real quedó registrado como "completó correctamente", Get-WinEvent
# evento 201, código 0xFFFFFFFF). El reintento real vive adentro de
# iniciar-servidor.bat, en un loop propio.
#
# $PSScriptRoot en vez de una ruta hardcodeada a propósito: la carpeta del
# proyecto tiene una "ñ" (DOÑA), y una ruta escrita como texto literal acá
# depende de que ESTE archivo se guarde y se lea con la codificación
# correcta -- ya pasó una vez (PowerShell 5.1, el que trae Windows por
# defecto, la leyó mal y la tarea quedó registrada apuntando a un archivo
# que no existía). $PSScriptRoot lo arma el runtime de PowerShell a partir
# de dónde está el script en disco, no releyendo texto de acá adentro, así
# que no depende de la codificación del archivo.
$rutaBat = Join-Path $PSScriptRoot "iniciar-servidor.bat"
$nombreTarea = "POS Dona Olga - Servidor"

$accion = New-ScheduledTaskAction -Execute $rutaBat
$disparador = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
# ExecutionTimeLimit en 0 importa más ahora que el reintento vive en un
# loop dentro del .bat: la instancia de la tarea no vuelve a "terminar"
# en uso normal, corre indefinidamente mientras el servidor esté sano.
# Sin este ajuste, el límite por defecto (72 horas) la mataría igual.
$config = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask -TaskName $nombreTarea -Action $accion -Trigger $disparador -Principal $principal -Settings $config -Force

Write-Host ""
Write-Host "Tarea '$nombreTarea' creada. Verificar con:"
Write-Host "  Get-ScheduledTask -TaskName '$nombreTarea' | Format-List"
