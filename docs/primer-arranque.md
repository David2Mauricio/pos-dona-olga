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

## 1. Iniciar el servidor

Desde la carpeta del proyecto:

```bash
npm start
```

Esto levanta el servidor en el puerto configurado en `.env` (por defecto
`3000`). Al arrancar, automáticamente:

- Aplica cualquier migración de base de datos pendiente.
- Hace un backup de la base de datos.
- Empieza a hacer un backup nuevo cada 6 horas mientras el proceso siga corriendo.

> Si ya se configuró un mecanismo de arranque automático (pm2, Tarea
> Programada de Windows, systemd — ver el punto pendiente de persistencia
> del proceso), seguí las instrucciones propias de ese mecanismo en vez de
> `npm start` a mano. Esta sección asume arranque manual.

**No cerrés la ventana de la terminal** mientras el sistema esté en uso — si
se cierra, el servidor se detiene y el mostrador deja de funcionar hasta que
se vuelva a levantar.

## 2. Verificar que está corriendo

Opción rápida desde la misma máquina:

```bash
curl http://localhost:3000/api/health
```

Debería responder `{"estado":"ok"}`. Si da un error de conexión, el
servidor no está corriendo — repetí el paso 1.

También podés simplemente abrir `http://localhost:3000` en el navegador:
si aparece la pantalla de inicio de sesión, el servidor está funcionando.

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
