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
