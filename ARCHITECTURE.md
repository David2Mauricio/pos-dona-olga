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

## Archivos (fotos de producto)

Se guardan como archivo en `/uploads`; la base de datos solo guarda el nombre
del archivo, nunca el binario.

## Nomenclatura

- `camelCase` → variables y funciones
- `PascalCase` → clases
- `UPPER_SNAKE_CASE` → constantes
- `kebab-case` → archivos y rutas API
- `snake_case` → tablas y columnas SQL
- Conventional Commits en git
