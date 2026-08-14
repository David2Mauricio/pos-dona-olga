# Primer arranque — guía de instalación en la máquina real

Para quien instale el sistema en la máquina del mostrador. No requiere saber
programar, pero sí tener acceso a una terminal en esa máquina.

## 0. Antes de abrir por primera vez

La base de datos se entrega **sin catálogo** — el que se usó para construir
y probar el sistema (productos y categorías de ejemplo) se vació a
propósito antes de la instalación real. Dos cosas para hacer antes de dejar
que el negocio empiece a vender:

1. **Cargar el catálogo real.** Iniciar sesión como administrador, entrar a
   **Productos** en la barra lateral, y dar de alta ahí las categorías y
   productos reales de Doña Olga (nombre, tipo de venta, precios, stock
   inicial). No hay una forma de importar en lote todavía — se carga
   producto por producto desde esa sección. Es la única vía pensada para
   esto: no se carga por script ni por Postman.
2. **Confirmar el usuario administrador.** El sistema ya trae un
   administrador (`admin`) creado durante el desarrollo. Antes de dejarlo
   en producción, decidir si esa es la cuenta real que va a usar el
   negocio (y en ese caso, resetearle la contraseña — ver el paso 4 más
   abajo, la cuenta actual tiene una contraseña de desarrollo que no debe
   quedar en uso) o si conviene crear una cuenta nueva con el nombre real
   de quien administra el sistema y desactivar la de desarrollo. Al
   cambiar esa contraseña, el sistema va a pedir definir también una
   pregunta de seguridad — completarla ahí mismo (ver 4.2): es lo que
   permite recuperar el acceso más adelante sin depender de nadie más.

## 1. Cómo arranca el servidor

**El sistema arranca solo — no hace falta abrir una terminal cada mañana.**
Una Tarea Programada de Windows ("POS Doña Olga - Servidor") lo levanta
automáticamente al iniciar la máquina, corriendo como `SYSTEM`, sin
necesitar que nadie inicie sesión gráfica. Si el proceso se cae por
cualquier motivo, se reinicia solo en unos segundos — probado en vivo
matando el proceso a mano y confirmando el reinicio por log y por reloj,
no asumido.

Al arrancar (a mano o por la tarea), automáticamente:

- Aplica cualquier migración de base de datos pendiente.
- Hace un backup de la base de datos.
- Empieza a hacer un backup nuevo cada 6 horas mientras el proceso siga corriendo.

### Verificar que la tarea está instalada y activa

```powershell
Get-ScheduledTask -TaskName "POS Dona Olga - Servidor" | Select-Object TaskName, State
```

`State` debería decir `Ready` (esperando el próximo inicio de Windows) o
`Running` (el servidor está corriendo ahora). Si el comando no encuentra
la tarea, hay que instalarla — ver "Instalar la tarea" más abajo.

### Reinstalar la tarea (máquina nueva, o si se borró por error)

Desde una PowerShell abierta **como Administrador** (clic derecho →
"Ejecutar como administrador" — sin esto falla con "Acceso denegado"):

```powershell
& "C:\ruta\al\proyecto\crear-tarea-programada.ps1"
```

Es seguro correrlo de nuevo aunque la tarea ya exista: la reemplaza sin
duplicarla. Registra la tarea para arrancar al iniciar Windows, sin login
gráfico. **El reintento ante una caída no lo configura esta tarea** — vive
adentro de `iniciar-servidor.bat` (ver más abajo, "Si el servidor se cae
solo"), porque Windows Task Scheduler no reconoce un crash de la
aplicación como una falla de la tarea (probado con evidencia real: un
proceso muerto con código de salida `-1` quedó registrado por Task
Scheduler como "completó correctamente" — su propio reintento configurable
nunca se dispara para esto).

### Si el servidor se cae solo (crash, corte de luz, reinicio de Windows)

No hace falta hacer nada. `iniciar-servidor.bat` (lo que ejecuta la tarea)
tiene su propio ciclo: si `node` termina por el motivo que sea, lo vuelve a
lanzar a los 5 segundos, indefinidamente. Y si la máquina se reinicia
entera, la tarea vuelve a arrancar sola al iniciar Windows — sin login.

Para confirmar que un reinicio reciente fue detectado y manejado, revisar
el log del día (ver más abajo): cada arranque y cada caída queda anotado
con hora exacta.

### Arranque manual (para desarrollo, o para probar algo puntual)

Desde la carpeta del proyecto:

```bash
npm start
```

**No cerrés la ventana de la terminal** mientras uses esta vía — a
diferencia de la tarea programada, acá si se cierra la terminal el
servidor se detiene, sin nada que lo vuelva a levantar solo. Para uso
real del negocio, dejar que la tarea programada se encargue (punto
anterior), no levantarlo a mano.

## 2. Verificar que está corriendo

Opción rápida desde la misma máquina:

```bash
curl http://localhost:3000/api/health
```

Debería responder `{"estado":"ok"}`. Si da un error de conexión, el
servidor no está corriendo — repetí el paso 1.

También podés simplemente abrir `http://localhost:3000` en el navegador:
si aparece la pantalla de inicio de sesión, el servidor está funcionando.

### El log de arranque de la tarea programada

Distinto del log propio de la aplicación (`logs/app.log`): este es el
registro de cada vez que la tarea programada arrancó o reinició el
servidor, con hora exacta y el código de salida si terminó por una
caída. Un archivo por día:

```
logs/tarea-programada-2026-08-14.log
```

Útil para responder "¿el sistema estuvo caído anoche?" sin adivinar —
cada arranque queda anotado ahí, se haya notado o no en el momento.

## 3. Dónde están los backups

Carpeta `backups/`, dentro de la carpeta del proyecto. Un archivo por
backup, con fecha y hora en el nombre:

```
backups/pos-backup-2026-08-13-1751.sqlite
```

Se generan solos (al iniciar el servidor y cada 6 horas mientras esté
corriendo) — no hace falta hacerlo a mano. Se conservan los **14 backups
más recientes**; los más viejos se borran solos para no llenar el disco.

Para restaurar uno (situación de emergencia, con el servidor **detenido**):
copiá el archivo de backup elegido a `data/pos.sqlite`, reemplazando el que
esté ahí, y volvé a iniciar el servidor.

## 4. Recuperar el acceso si se olvida una contraseña

Hay tres caminos, de más a menos preferible. Los dos primeros son
autoservicio, sin depender de nadie más; el tercero es la salida de
emergencia si los otros dos no alcanzan.

### 4.1. Caso normal — otro administrador puede resetearte la contraseña

Cualquier administrador logueado puede resetear la contraseña de cualquier
otro usuario (cajero o administrador) desde la interfaz, sin tocar la base
de datos ni usar Postman:

1. Iniciar sesión como administrador.
2. En la barra lateral, entrar a **Usuarios**.
3. Buscar en la lista al usuario cuya contraseña hay que resetear.
4. Hacer clic en **"Resetear contraseña"** en su fila.
5. El sistema muestra una contraseña temporal **una sola vez** — anotarla
   ahí mismo, no se puede volver a ver.
6. Entregarle esa contraseña temporal a la persona. En su próximo ingreso,
   el sistema le va a pedir que la cambie por una propia antes de dejarla
   usar el resto del sistema.

### 4.2. Pregunta de seguridad — un administrador se recupera solo, sin nadie más

**Solo para administradores.** La primera vez que un administrador cambia
su contraseña temporal (al crearse la cuenta, o después de un reseteo),
el sistema le pide definir una pregunta de seguridad propia y su
respuesta — algo que ella elija, nunca una lista de preguntas genéricas.
Ni quien la creó ni ningún otro administrador ve esa respuesta: queda
guardada igual que una contraseña (hasheada, no en texto plano).

Para recuperar el acceso más adelante, sin depender de otro administrador:

1. En la pantalla de inicio de sesión, escribir el usuario y hacer clic
   fuera del campo (o presionar Tab). Si esa cuenta tiene una pregunta
   configurada, aparece el enlace **"¿Olvidaste tu contraseña?"** debajo
   del botón de ingresar.
2. Hacer clic en el enlace. Aparece la pregunta guardada.
3. Responderla y definir una contraseña nueva ahí mismo.
4. Si la respuesta es correcta, vuelve a la pantalla de login — ya se
   puede entrar con la contraseña nueva. Si no coincide, el sistema no
   dice cuál de los dos datos falló (usuario o respuesta), mismo criterio
   que el login normal.

Los intentos fallidos (de contraseña *o* de respuesta, cuentan juntos
contra la misma cuenta) están limitados: después de 5 intentos fallidos
en 15 minutos, el sistema bloquea nuevos intentos por ese rato — no se
puede probar contraseñas o respuestas sin límite.

**Un administrador que todavía no configuró su pregunta** (por ejemplo,
si nunca completó ese primer cambio de contraseña) no tiene este camino
disponible — el enlace simplemente no aparece para esa cuenta. Cajeros
nunca ven este enlace: la pregunta de seguridad es solo para
administradores.

### 4.3. Script de emergencia — cuando ni 4.1 ni 4.2 alcanzan

Para cuando el único administrador está bloqueado, no configuró todavía
una pregunta de seguridad, y no hay nadie más con acceso. Requiere acceso
directo a la máquina donde corre el servidor (terminal, no un navegador,
nunca Postman) — el gate de seguridad acá es "quién puede ejecutar código
en este servidor", no una contraseña más.

```bash
node src/auth/emergencia-resetear-password.js <usuario>
```

Resetea la contraseña de ese usuario (cualquiera, no solo administradores)
y muestra una contraseña temporal **una sola vez** — no se vuelve a
mostrar. No borra ni recrea al usuario: mismo criterio que el reseteo
desde Usuarios (4.1), solo que sin necesitar una sesión ya iniciada. En
el próximo ingreso, el sistema va a pedir que la cambie por una propia
(y, si es administrador y todavía no tiene una, que defina su pregunta de
seguridad ahí mismo — ver 4.2).

> `npm run seed:admin` **no sirve para esto** — se niega a correr si ya
> existe un administrador activo, y no toca contraseñas de cuentas
> existentes. Solo crea el administrador inicial la primera vez que se
> instala el sistema, cuando todavía no hay ninguno.

Para no depender de este camino: mantené **más de un administrador
activo** (así siempre hay alguien para el camino 4.1), y asegurate de que
cada administrador complete su pregunta de seguridad (4.2) apenas entra
por primera vez.
