# ADR 0014: Cierre previo a instalación real

## Estado

Aceptado. Cierra la última ronda de trabajo antes de instalar el sistema en
la máquina real del negocio. No repite decisiones ya documentadas — cada
sección referencia el ADR que corresponde en vez de reexplicarlo.

## Contexto

Con las 8 secciones de la interfaz y los 13 módulos de backend cerrados
(ver ADR 0013 y los ADRs de módulo 0001–0012), quedaban seis puntos sueltos
antes de que el sistema pudiera instalarse de verdad: dos ajustes menores
de producto (recibo, presencia de marca), limpieza de datos de prueba,
un mecanismo para que el servidor sobreviva un reinicio de la máquina o
un crash sin depender de que alguien lo note, y una vía de recuperación de
contraseña que no dependiera de tener Postman a mano. Se registran acá
juntos porque se cerraron en la misma tanda de trabajo, no porque compartan
una sola decisión de diseño.

## Recibo: menos campos, más identidad del negocio

Sobre el protocolo ya establecido en ADR 0007 (ESC/POS, CP850, ancho de 32
caracteres, impresora térmica de 58mm) — sin cambios ahí. Se quitaron dos
líneas (`Venta #`, `Precio: Mayorista/Público`) y se agregaron dos
(dirección, teléfono) bajo el nombre del negocio ya existente. Verificado
simulando `construirRecibo()` sin necesitar la impresora física (el cambio
es de contenido, no de protocolo): ambas líneas nuevas caben dentro del
ancho de 32 caracteres, las dos líneas viejas confirmadas ausentes por
búsqueda directa en el código fuente.

## Navy con presencia real en la sidebar

Sobre la paleta navy/blanco/gris ya establecida en ADR 0013 — `.nav-lateral`
pasa de `--color-superficie` a `--color-acento` sólido como fondo. Contraste
verificado con la fórmula WCAG real antes de aplicar texto/íconos claros
encima (12.91:1 en tema claro, 5.83:1 en oscuro, ambos ≥4.5:1), no a ojo.
Encontrados y corregidos en el camino: el estado deshabilitado de los ítems
de nav usaba `opacity` sobre el nuevo fondo sólido — mismo bug de contraste
ya documentado en ADR 0013 (Vencimientos) reapareciendo en un lugar nuevo,
mismo fix (quitar la dependencia de opacity); y el outline de foco de
teclado (`:focus-visible`) usaba el mismo color que el nuevo fondo,
volviéndose invisible — override acotado a la sidebar.

## Logo: ruta lista, sin bloquear en el archivo

`public/img/logo.png` — carpeta creada, HTML/CSS ya apuntan ahí
(`.nav-lateral__marca`), con `onerror` que lo saca del documento si el
archivo no existe todavía (verificado con `curl`: 404 hoy, cae al nombre en
texto sin ícono roto). El día que el cliente suba el archivo real, aparece
solo. Formato pedido: PNG con transparencia para la interfaz; para el
recibo térmico, 384px de ancho monocromo puro (1-bit) es el estándar de
58mm — no verificado todavía contra la impresora física porque no existe
código de impresión de imágenes construido (solo texto hasta ahora); se
verifica cuando el archivo real exista y se implemente esa impresión,
mismo criterio de "no asumir el hardware" que ya rigió ADR 0007.

## Limpieza de datos de prueba

Auditoría completa de las 9 tablas de `data/pos.sqlite` (la única base que
existe) antes de instalar. Hallazgo real: 29 filas de `caja_sesiones` y 1
lote de vencimiento huérfano, residuos de ciclos de prueba de fases
anteriores nunca limpiados — borrados. Catálogo de ejemplo (6 productos, 2
categorías) confirmado por el cliente como datos de desarrollo, vaciado a
propósito: el primer catálogo real se carga por la sección Productos, no
por seed ni por Postman (documentado en `docs/primer-arranque.md`).

## Recuperación de contraseña sin depender de Postman

Contrato de `usuarios` (tabla y schema) auditado antes de tocar código: no
existía ningún campo para esto, se agregó desde cero.

**Reseteo de emergencia por acceso directo** (`src/auth/
emergencia-resetear-password.js`): script de un solo comando que resetea la
contraseña de un usuario existente sin pasar por HTTP, para el caso que la
sección Usuarios no cubre (el único administrador bloqueado sin poder
loguearse). A diferencia de `seed-admin.js` (que se niega a correr si ya
existe un administrador activo, y no toca contraseñas existentes), este
reutiliza el mismo `resetearPassword` del repository que ya usa la sección
Usuarios — no crea ni borra nada. Usado una vez en producción real durante
este mismo cierre para recuperar un acceso bloqueado.

**Pregunta de seguridad** (autoservicio, solo administradores): nueva
migración (011) agrega `pregunta_seguridad`/`respuesta_seguridad_hash`
(nullable, hasheada con bcrypt igual que la contraseña — ver ADR 0010 para
el modelo de auth/roles). Se pide en el primer cambio de contraseña
obligatorio, nunca la ve quien creó la cuenta. `GET
/api/auth/pregunta-seguridad/:usuario` + `POST /api/auth/recuperar-password`
sin sesión, mismo criterio que login. Decisión verificada explícitamente:
comparte el mismo contador de rate-limit que login (5 intentos/15min
combinados, no un balde aparte) — probado con evidencia real que 3
intentos de login + 3 de respuesta incorrecta contra la misma cuenta
terminan en 429. Sin auto-login tras recuperar. axe-core: 0 violaciones en
las 3 superficies nuevas × 2 temas.

## Persistencia del proceso: Tarea Programada de Windows

Sistema operativo del negocio confirmado: Windows. Se evaluaron dos
opciones (pm2 con registro de arranque, vs. Tarea Programada nativa) —
elegida Tarea Programada por menos piezas de terceros que mantener y una
interfaz gráfica ya familiar para personal sin conocimientos técnicos.

**Diseño**: `iniciar-servidor.bat` (se autolocaliza con `%~dp0`, no depende
de que "Iniciar en" quede bien configurado en la tarea) + `crear-tarea-
programada.ps1` (registra la tarea, trigger "al iniciar el sistema", como
`SYSTEM`, sin necesitar sesión gráfica).

**Bug real encontrado con evidencia, no asumido**: la primera versión
configuraba el reintento en la propia Tarea Programada
(`RestartCount`/`RestartInterval`). Verificado en vivo que **no funciona**:
un crash real del proceso (código de salida `-1` / `0xFFFFFFFF`) quedó
registrado por Windows Task Scheduler como *"completó correctamente"*
(`Get-WinEvent` sobre el canal `Microsoft-Windows-TaskScheduler/
Operational`, evento 201) — Task Scheduler solo reintenta si la tarea en
sí no llega a lanzarse, no si el proceso que lanzó terminó con error.
Confirmado dos veces esperando varios minutos sin que el servidor
volviera. Fix: el reintento se movió a un loop propio dentro del `.bat`
(relanza `npm start` a los 5 segundos de cualquier salida, sin importar la
causa) — es lo único que efectivamente prueba una diferencia entre "el
proceso sigue vivo" y "el proceso murió". `ExecutionTimeLimit` se mantiene
sin límite (antes ya estaba así, ahora es más importante: la instancia de
la tarea corre indefinidamente en uso normal, no vuelve a "terminar" en
cada arranque).

**Bug de encoding encontrado en el camino** (diagnosticado por el
cliente, no por mí): la ruta del proyecto contiene una "ñ" (Doña); el
script de registro la tenía hardcodeada como texto literal, y PowerShell
5.1 (el que trae Windows por defecto) la leyó mal al ejecutar el script,
registrando la tarea con una ruta que no existía. Fix estructural, no un
parche de encoding: `$PSScriptRoot` en vez del texto literal — lo arma el
runtime de PowerShell a partir de dónde está el archivo en disco, inmune a
cómo se guardó el archivo. El `.ps1` además se resguardó con BOM UTF-8
para que los comentarios (que sí tienen tildes) se lean bien, aunque ya no
dependa de eso para funcionar.

**Verificación**: probado en la máquina real dos veces con evidencia
directa, no en teoría — (1) arranque sin sesión gráfica: tras
`schtasks /run`, dos procesos `node.exe` aparecieron bajo la sesión
`Services` (SYSTEM), `curl /api/health` respondió, y el log propio de la
tarea mostró el arranque real de la aplicación (migraciones, backup,
"Servidor escuchando"); (2) reinicio tras crash: proceso matado a mano dos
veces (la primera con el bug de Task Scheduler todavía presente, sin
recuperación tras varios minutos de espera; la segunda ya con el fix,
recuperado en ~5 segundos, confirmado por timestamps exactos en el log:
caída a la 1:18:30.56, arranque nuevo a la 1:18:35.72, sirviendo de nuevo
a la 1:18:37.9).

## Documentación

`docs/primer-arranque.md`: guía operativa para quien instale el sistema,
sin asumir conocimientos de programación. Cubre arranque (automático vía
la tarea, y manual como vía de desarrollo), verificación, ubicación de
backups y del log de la tarea, checklist de antes de abrir por primera vez
(cargar catálogo real, confirmar el usuario administrador), y los tres
caminos de recuperación de contraseña en orden de preferencia (reseteo por
otro administrador → pregunta de seguridad → script de emergencia).

## Pendiente, fuera de este cierre

Una auditoría de umbral de alerta de stock quedó referenciada en una
conversación pero nunca llegó a este chat con el detalle real — no se
inventó ni se documentó acá una justificación de negocio para eso ni para
el backlog de fiado (confirmado explícitamente por el cliente: fiado no
tiene ninguna urgencia real detrás, simplemente no priorizado). Queda para
cuando el cliente reenvíe ese pedido con el detalle real.
