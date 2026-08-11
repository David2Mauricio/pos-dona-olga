# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Agregado

- Estructura base del proyecto (Node.js + Express 5).
- Conexión a SQLite vía `better-sqlite3`, con `journal_mode = WAL` y
  `foreign_keys = ON`.
- Runner de migraciones propio (`src/db/migrate.js`) con tabla de control
  `schema_migrations`.
- Middleware central de manejo de errores y clase `AppError`.
- Middleware de validación genérico con `zod`.
- Logger propio a archivo (`logs/app.log`).
- Endpoint `GET /api/health` para verificar que el servidor está vivo.
- Documentación base: README, ARCHITECTURE, y primer ADR sobre la arquitectura
  general del proyecto.
- Migración `002_categorias_y_productos.sql`: tablas `categorias` y
  `productos`, con peso en gramos y precios en pesos COP (ambos enteros),
  CHECK constraints para que `stock_unidades`/`stock_gramos` sean exclusivos
  según `tipo_venta`, `codigo_barras` único y opcional, e índice en
  `categoria_id`.
- ADR sobre precisión numérica: peso en gramos, dinero en pesos COP, y regla
  de redondeo único por línea de venta.
- Módulo de **productos** (route/controller/service/repository), plantilla
  para los demás módulos de negocio:
  - `POST /api/productos`, `GET /api/productos` (filtros `categoriaId` y
    `activo`), `GET /api/productos/:id`,
    `GET /api/productos/codigo-barras/:codigo`, `PATCH /api/productos/:id`.
  - Validación con `zod`: esquemas separados para creación/actualización;
    `tipoVenta` no se puede modificar después de creado.
  - El service valida `stock_unidades`/`stock_gramos` contra `tipo_venta` y
    la existencia de `categoria_id` antes de tocar la base de datos, y
    traduce los códigos de error de `better-sqlite3`
    (`SQLITE_CONSTRAINT_UNIQUE`/`FOREIGNKEY`/`CHECK`) a errores de negocio
    con mensaje claro.

### Corregido

- `src/middlewares/validate.js`: en Express 5, `req.query` es un getter sin
  setter (se recalcula desde la URL cruda en cada acceso), así que
  `req.query = datosValidados` fallaba en silencio y el cuerpo validado por
  zod nunca llegaba al controller. Se corrigió usando
  `Object.defineProperty` para los tres orígenes (`body`/`params`/`query`).
