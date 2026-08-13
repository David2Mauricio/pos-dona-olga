# Primer arranque — guía de instalación en la máquina real

Para quien instale el sistema en la máquina del mostrador. No requiere saber
programar, pero sí tener acceso a una terminal en esa máquina.

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

## 4. Resetear la contraseña de un administrador

**Caso normal — hay al menos un administrador que puede iniciar sesión:**

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

**Caso de emergencia — el único administrador olvidó su contraseña y no
puede iniciar sesión:**

Esto **no** está cubierto por el paso anterior (hace falta estar logueado
como administrador para resetear la contraseña de alguien más — incluida
la de otro administrador). Si solo existe un administrador y pierde el
acceso, hoy no hay ninguna vía desde la interfaz para recuperarlo; haría
falta una intervención directa sobre la base de datos, algo que **no está
documentado ni construido todavía** como procedimiento seguro.

Dos formas de evitar quedar en esa situación:
- Mantener **más de un administrador activo** en todo momento (recomendado,
  bajo costo, y ya funciona con lo construido).
- Pedir que se construya un mecanismo de recuperación de emergencia
  aparte (por ejemplo, un script de un solo uso que solo se pueda correr
  con acceso directo a la máquina) — no se armó todavía porque no fue
  pedido; avisar si se quiere agregar.
