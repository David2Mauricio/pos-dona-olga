# Arquitectura

## Visión general

Monolito modular. Un solo proceso Express, una sola base de datos SQLite en disco.
No hay microservicios, no hay dependencia de internet para operar: el negocio necesita
vender aunque se caiga la conexión.

## Capas

Cada módulo de negocio (productos, ventas, caja, inventario, ...) sigue el mismo
recorrido estricto de una petición HTTP:

```
route → middleware de validación (zod) → controller → service → repository → SQLite
```

- **route**: define el endpoint HTTP y encadena los middlewares. No contiene lógica.
- **validación (zod)**: valida y transforma `req.body`/`req.params`/`req.query` antes
  de que el controller vea los datos. Si falla, responde 400 sin llegar al controller.
- **controller**: traduce HTTP ↔ dominio. Lee `req`, llama al service, arma la respuesta.
  No sabe nada de SQL.
- **service**: contiene las reglas de negocio (ej. "una venta descuenta inventario",
  "un cliente mayorista paga precio distinto"). No sabe nada de HTTP ni de SQL crudo.
- **repository**: única capa que habla SQL contra `better-sqlite3`. El service nunca
  arma una consulta directamente.

Una ruta **nunca** toca la base de datos directamente, y un repository **nunca**
conoce `req`/`res`. Esto es lo que permite, por ejemplo, probar un service sin
levantar un servidor HTTP.

Un service puede orquestar **más de un repository** cuando una operación de
negocio lo requiere (ej. crear una venta implica escribir en el repository de
ventas y descontar stock a través del repository de productos, todo dentro de
una misma transacción definida en `ventas.service.js`). Sigue siendo el
service quien decide y coordina; el repository de productos no sabe que
existe el módulo de ventas. Ver [ADR 0003](./docs/decisiones/0003-ventas-dependencias-provisionales.md).

## Base de datos

- SQLite vía `better-sqlite3` (API síncrona, sin ORM pesado).
- Un solo archivo `data/pos.sqlite`, no versionado.
- `journal_mode = WAL`: el equipo del negocio no tiene UPS, así que priorizamos
  resistencia a cortes de luz sobre cualquier otra consideración.
- `foreign_keys = ON`: las relaciones (venta → producto, venta → cliente, etc.)
  se validan a nivel de motor, no solo en el código.
- Migraciones propias en `/migrations`, archivos `.sql` numerados (`001_...`,
  `002_...`), aplicadas por `src/db/migrate.js` y registradas en la tabla
  `schema_migrations`. Ver [ADR 0001](./docs/decisiones/0001-monolito-modular-y-sqlite.md).

## Precisión numérica

- Peso: **entero en gramos** (nunca `REAL`/kilos con decimales).
- Dinero: **entero en pesos COP** (sin centavos).
- El cálculo de una línea de venta por peso (`precio_por_kg * gramos / 1000`)
  puede dar un resultado con decimales aunque los dos operandos sean enteros.
  El redondeo (`Math.round`) se aplica **una única vez, al final**, dentro del
  service de ventas — nunca en pasos intermedios ni en el repository.
  Ver [ADR 0002](./docs/decisiones/0002-precision-numerica-peso-y-dinero.md).

## Validación

`zod` en middleware, antes del controller (`src/middlewares/validate.js`). El
controller siempre recibe datos ya validados y con los tipos correctos.

## Manejo de errores

Middleware central único (`src/middlewares/error-handler.js`), montado al final
de `app.js`. Los errores de negocio esperados se lanzan como `AppError`
(`src/utils/app-error.js`), con su propio `statusCode` y un mensaje seguro de
mostrar al usuario. Cualquier otro error se trata como inesperado y se responde
con un mensaje genérico (el detalle técnico solo se expone en `development`).

Con Express 5, un error lanzado dentro de un controller `async` llega solo al
middleware de errores sin necesidad de `try/catch` manual en cada controller.

## Logging

Logger propio a archivo de texto (`src/utils/logger.js`, escribe en `logs/app.log`),
sin dependencias externas. En desarrollo también imprime en consola.

## Archivos (fotos de producto — removido)

Existió (`/uploads`, `multer`, `foto_nombre_archivo` en `productos`) y llegó
a funcionar en tres pantallas (Mostrador, Productos, Inventario), pero se
retiró por completo: decisión de negocio, la complejidad operativa de
fotografiar todo el catálogo no se justificaba frente al valor que
aportaba. Ver ADR 0020.

## Hardware

Confirmado con pruebas físicas reales sobre el equipo del negocio:

- **Lector de código de barras**: HID (funciona como teclado), sin driver
  ni integración de backend propia. El único requisito ya existe:
  `GET /api/productos/codigo-barras/:codigo`. La captura del input vive en
  la interfaz de mostrador (paso 12 del plan, todavía sin construir).
- **Impresora térmica**: `src/hardware/` (no sigue el patrón de capas de
  los módulos de negocio — son funciones puras + un comando de sistema,
  sin base de datos de por medio). Ver
  [ADR 0007](./docs/decisiones/0007-impresion-termica-impresora-compartida.md)
  para el método (impresora compartida de Windows, sin librería nativa) y
  la regla de que imprimir nunca bloquea ni revierte una venta.
- **Cajón monedero**: conectado al puerto DK de la impresora térmica, se
  abre con el pulso ESC/POS estándar (`abrirCajon()` en
  `comandos-escpos.js`, pin confirmado con prueba física aislada — ver
  ADR 0007). Solo se activa cuando el medio de pago de la venta es
  efectivo; con Nequi, Daviplata o tarjeta no hay billete que guardar, así
  que no tiene sentido interrumpir al cajero abriéndolo.

## Nomenclatura

- `camelCase` → variables y funciones
- `PascalCase` → clases
- `UPPER_SNAKE_CASE` → constantes
- `kebab-case` → archivos y rutas API
- `snake_case` → tablas y columnas SQL
- Conventional Commits en git
