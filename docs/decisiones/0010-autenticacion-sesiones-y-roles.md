# ADR 0010: Autenticación con sesiones de servidor y dos roles fijos

## Estado

Aceptado.

## Contexto

Hasta ahora el sistema no distinguía quién hacía una operación — cualquiera
con acceso al equipo podía crear productos, ver reportes o anular
operaciones. Con más de una persona operando el punto de venta (dueña +
cajeros), hace falta saber quién hizo qué, y limitar qué puede hacer cada
quien.

## Decisión

### Sesiones de servidor, no JWT

`express-session`, con la sesión guardada en memoria del proceso
(`MemoryStore`, el store por defecto). Se consideró JWT y se descartó: JWT
resuelve un problema real de sistemas *distribuidos* — varios servidores
sin estado compartido que necesitan verificar un token sin consultarse
entre sí. Este sistema es exactamente lo opuesto por diseño (ADR 0001): un
solo proceso, un solo equipo, sin servidores distribuidos que sincronizar.
Usar JWT acá sería resolver un problema que este sistema no tiene, a
cambio de complejidad real (invalidar sesiones, rotar claves, manejar
expiración) que las sesiones de servidor no tienen — `req.session.destroy()`
basta para cerrar sesión de verdad, sin necesidad de una lista de tokens
revocados.

**Consecuencia aceptada**: las sesiones activas se pierden si el proceso
se reinicia (todos vuelven a loguearse). Para un POS de un solo punto de
venta que ya se reinicia rara vez (y que además hace backup automático,
ADR 0008), es un costo bajo comparado con la complejidad de un JWT
persistente.

### `bcryptjs`, no `bcrypt`

Mismo criterio ya aplicado con `better-sqlite3` (ADR 0001) y con la
impresión térmica (ADR 0007): nada que necesite compilar contra
herramientas de C++ en el equipo de instalación, sin garantía de que
quien lo reinstale en el futuro tenga esas herramientas configuradas.
`bcryptjs` es una reimplementación en JavaScript puro del mismo algoritmo,
sin ese riesgo. El costo es algo de velocidad de hashing — irrelevante
acá: son unos pocos logins por día, no un sistema con miles de
autenticaciones por segundo.

### Dos roles fijos (`administrador`, `cajero`), no permisos granulares

Se consideró un sistema de permisos por persona (marcar individualmente
qué puede hacer cada usuario) y se descartó por sobre-ingeniería para el
tamaño real de este negocio: dos roles cubren la distinción real que
existe hoy (quien administra el negocio vs. quien solo vende). Un sistema
de permisos granulares agrega una tabla de permisos, una UI para
gestionarlos, y una capa de indirección que nadie va a usar con la
plantilla de personal de una salsamentaria. Si en el futuro aparece una
necesidad real de un tercer rol (ej. "supervisor" con permisos
intermedios), se agrega con una migración pequeña sobre esa necesidad
concreta — no antes, como con cualquier otra funcionalidad fuera del
alcance original (ver condiciones acordadas con la dueña).

### Matriz de permisos

**Solo administrador**: crear/editar productos y categorías; proveedores
(módulo completo); reportes completos (`GET /api/reportes/*`); gestión de
usuarios; anular ventas (Fase 3).

**Ambos roles**: crear ventas, listar/buscar productos y categorías, abrir
y cerrar caja, movimientos de inventario, alertas de stock e inventario,
lotes de vencimiento.

Dos ajustes sobre lo discutido, confirmados antes de implementar:
- **Proveedores** no estaba en ninguna de las dos listas originales — se
  resolvió como solo-administrador (mismo criterio que productos/categorías:
  datos maestros, no operación diaria de mostrador).
- **`GET /api/reportes/inventario`** alimentaba el indicador de alertas
  del mostrador (pensado para ambos roles), pero "reportes completos" es
  solo-administrador. Se resolvió separando los dos usos: los reportes
  completos (con valor estimado de inventario y totales) quedan
  solo-administrador; el indicador de alertas de la interfaz (Fase 4) va
  a consultar `GET /api/inventario/alertas` y `GET /api/vencimientos/alertas`
  directamente — ya existían por separado, no hizo falta un endpoint nuevo.

### Cambio de contraseña obligatorio bloquea el resto del sistema

Tanto el administrador inicial (`seed-admin.js`) como cualquier cajero
nuevo (`POST /api/usuarios`) arrancan con `debe_cambiar_password=1` y una
contraseña temporal generada al azar por el sistema — nunca elegida por
quien crea la cuenta, para que "temporal" sea una garantía real y no un
nombre que alguien le pone a una contraseña débil y nunca cambia. Mientras
ese flag siga en `1`, `requiereSesion` bloquea (403,
`codigo: 'DEBE_CAMBIAR_PASSWORD'`) cualquier ruta que no sea
`/api/auth/cambiar-password`, `/api/auth/logout` o `/api/auth/sesion` —
el resto del sistema queda inaccesible hasta completar el cambio.

### Rate limiting con un `Map`, sin librería externa

Máximo 5 intentos fallidos por usuario en una ventana de 15 minutos,
contados en un `Map` en memoria del proceso (usuario → lista de marcas de
tiempo de intentos fallidos recientes). Mismo criterio que el resto del
proyecto: es un solo proceso sin exposición a internet, una librería de
rate limiting (pensada para proteger un servidor público de fuerza bruta
distribuida) resolvería un problema de amenaza que este sistema no
enfrenta. El límite existe para frenar un error de tipeo repetido o un
intento casual, no un ataque real.

## Consecuencias

- `AppError` ganó un tercer parámetro opcional, `codigo` (ver
  `src/utils/app-error.js`): un identificador estable para que el
  frontend distinga programáticamente entre errores con el mismo
  `statusCode` pero que requieren una UI distinta (`SIN_SESION` vs
  `DEBE_CAMBIAR_PASSWORD` vs `ROL_INSUFICIENTE`, todos con status
  401/403). El mensaje sigue siendo para mostrar; el código es para
  decidir.
- La interfaz de mostrador ya construida (ADR 0009) deja de funcionar tal
  cual apenas este cambio se despliega: no tiene pantalla de login ni
  maneja sesiones. Es el comportamiento esperado — la Fase 4 la
  reemplaza por completo, con login como punto de entrada obligatorio.
  No se parchea la interfaz vieja para sobrevivir mientras tanto.
- `SESSION_SECRET` es obligatorio (sin valor por defecto): el proceso no
  arranca sin él, a propósito — un secreto con un default adivinable es
  peor que un arranque que falla con un mensaje claro.

## Extensión: borrado real de usuarios sin actividad

El resto del proyecto sostiene consistentemente "nunca borrar lo que
tiene historia, solo lo que no la tiene" (ventas se anulan, movimientos de
inventario nunca se editan, proveedores con movimientos rechazan el
`DELETE`). Un usuario sin ninguna actividad real (uno creado por error, un
cajero que nunca llegó a trabajar) es el caso simétrico: no tiene historia
que perder, así que sí puede borrarse limpio en vez de quedar desactivado
para siempre como ruido en el listado.

### El hueco que había que cerrar primero: nada registraba quién actuaba

Antes de esta extensión, ni `ventas` ni `caja_sesiones` tenían columna
`usuario_id` — nunca se guardó quién creaba una venta común ni quién
abría una caja. Lo único que sabía "quién hizo qué" era `auditoria`
(ver ADR 0018), y solo para las acciones ya marcadas como sensibles
(anulación, override de precio, cierre de caja, ajuste manual de
inventario) — una venta común sin override, o la apertura de una caja,
no quedaban ligadas a nadie en ningún lado.

Sin resolver esto primero, el chequeo de "¿este usuario tuvo actividad?"
para el borrado hubiera sido necesariamente incompleto: un cajero que
solo hizo ventas comunes habría pasado como "sin actividad" aunque
hubiera trabajado. Se decidió cerrar el hueco de raíz en vez de construir
el borrado sobre una base incompleta:

- Migración 016: `usuario_id INTEGER REFERENCES usuarios(id) ON DELETE
  RESTRICT`, agregada a `ventas` y `caja_sesiones`.
- `ventas.service.js:crear()` y `caja.service.js:abrir()` ahora reciben
  el actor de la sesión (`req.session.usuario.id`, ya disponible desde el
  middleware de auth) y lo guardan en la fila nueva — un cambio de pocas
  líneas en cada service, no un rediseño del flujo de venta ni de caja.
- **Nullable, sin backfill, a propósito**: toda fila anterior a esta
  migración queda con `usuario_id = NULL`. No hay forma de reconstruir
  retroactivamente quién creó una venta o abrió una caja de antes de este
  cambio, y no vale la pena inventar un valor falso solo para llenar la
  columna. Es una limitación conocida y aceptada, no un descuido: el
  chequeo de actividad para borrado de usuarios (ver abajo) simplemente
  no puede detectar actividad anterior a esta migración.

### El chequeo de "sin actividad", y por qué es más amplio que los cuatro criterios originales

El pedido original enumeraba cuatro tipos de actividad (creó una venta,
registró un movimiento de inventario, abrió/cerró una sesión de caja,
anuló una venta). La implementación final (`usuarios.repository.js:
tieneActividad`) consulta las **cuatro tablas que hoy tienen una FK
`usuario_id -> usuarios(id) ON DELETE RESTRICT`**: `ventas`,
`caja_sesiones` (ambas nuevas en esta extensión), `auditoria` (ADR 0018,
sin filtrar por tipo de acción) y `gastos` (migración 015). No es una
lista arbitraria más amplia que lo pedido por gusto — es exactamente lo
que el motor rechazaría igual si este chequeo no existiera, así que
nunca puede quedar desalineada del esquema real:

- `ventas`/`caja_sesiones` cubren directo "creó una venta" y "abrió una
  caja".
- `auditoria` sin filtrar cubre "anuló una venta", "cerró una caja",
  "hizo un ajuste manual de inventario" (los tres únicos criterios
  originales que solo viven ahí) — y de paso cualquier otra acción
  sensible que el usuario haya hecho como actor (resetear la contraseña
  de otro, dar de alta a otro usuario, registrar un gasto), que igual
  bloquearía el `DELETE` a nivel de esquema si se la dejara afuera del
  chequeo explícito.
- `gastos` queda cubierto también por `auditoria` (`registro_gasto` fija
  el mismo `usuario_id`), pero se consulta directo además, para que el
  chequeo nunca dependa de que ninguna fila de auditoría se haya
  preservado intacta — coincide 1 a 1 con la FK real de la tabla.

Si tiene actividad en cualquiera de las cuatro, `DELETE /api/usuarios/:id`
responde `409` con un mensaje explícito sugiriendo desactivar
(`PATCH .../:id` con `activo:false`, que ya existía). El `ON DELETE
RESTRICT` en las cuatro tablas queda como segunda capa de protección a
nivel de motor — nunca la única: el 409 con mensaje de negocio siempre
dispara primero desde el service.

### Otras dos salvaguardas, mismo criterio que `actualizar()`

- **Auto-eliminación bloqueada** (`400`): un administrador no puede
  borrar su propio usuario mientras tiene la sesión activa — mismo
  espíritu que no poder desactivarse a sí mismo por accidente.
- **Último administrador activo protegido** (`400`): mismo chequeo que ya
  existía en `actualizar()` para desactivar/cambiar de rol, reutilizado
  acá — borrar al único administrador activo dejaría el sistema sin
  nadie que pueda volver a gestionar usuarios.

### Auditoría

Acción nueva, `eliminacion_usuario`, en el mismo punto único de escritura
que el resto de las acciones sobre usuarios (ver ADR 0018) — dentro de la
misma transacción que el `DELETE` real. Aunque el usuario borrado nunca
tuvo actividad de negocio, el hecho de que un administrador lo haya
eliminado sigue siendo una acción sensible que vale la pena dejar
registrada.

### Verificación

Contra una copia aislada de la base real: `usuario_id` queda poblado al
crear una venta nueva y al abrir una caja nueva (confirmado que una
sesión de caja *anterior* a la migración sigue con `usuario_id NULL`, tal
como se espera); borrado real de un usuario sin actividad (204,
confirmado ausente del listado después); intento de auto-eliminación
(400); intento de borrar un usuario con actividad real de venta/caja
(409, mensaje sugiriendo desactivar); `eliminacion_usuario` presente en
Auditoría para cada borrado. 18/18 verificaciones.
