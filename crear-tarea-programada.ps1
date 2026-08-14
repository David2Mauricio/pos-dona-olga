# Crea la Tarea Programada de Windows que arranca el servidor del POS.
# Correr UNA VEZ, desde una PowerShell abierta como Administrador
# (clic derecho -> "Ejecutar como administrador").
#
# Qué hace: registra iniciar-servidor.bat para correr al iniciar Windows
# (sin necesitar que nadie inicie sesión gráfica), como SYSTEM, con
# reintento automático si el proceso muere.

$rutaProyecto = "C:\Users\dmhl2\OneDrive\Documentos\Empresa\Proyectos\POS - AVICOLA Y SALSAMENTARIA DOÑA OLGA"
$rutaBat = Join-Path $rutaProyecto "iniciar-servidor.bat"
$nombreTarea = "POS Dona Olga - Servidor"

$accion = New-ScheduledTaskAction -Execute $rutaBat
$disparador = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$config = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)  # sin límite de tiempo de ejecución (el servidor corre indefinidamente)

Register-ScheduledTask -TaskName $nombreTarea -Action $accion -Trigger $disparador -Principal $principal -Settings $config -Force

Write-Host ""
Write-Host "Tarea '$nombreTarea' creada. Verificar con:"
Write-Host "  Get-ScheduledTask -TaskName '$nombreTarea' | Format-List"
