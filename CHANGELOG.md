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
- Módulo de **categorías** (misma plantilla de 4 capas que productos, alcance
  mínimo): `POST /api/categorias`, `GET /api/categorias`,
  `PATCH /api/categorias/:id` (renombrar). Nombre único, duplicados
  traducidos a 409. Sin `DELETE` por ahora: la FK `ON DELETE RESTRICT` desde
  `productos` ya impide borrar una categoría en uso, y no hay necesidad de
  negocio confirmada para borrar una que no lo esté.
- `src/utils/schemas-comunes.js`: `idParamsSchema` extraído de
  `productos.schema.js` para reutilizarse también en categorías (y en los
  módulos que siguen).
- Migración `003_caja_y_ventas.sql`: tablas `caja_sesiones` (con CHECK
  cruzado estado↔cerrada_en↔monto_cierre), `ventas` y `ventas_items`.
  `caja_sesiones` completa aunque el módulo de caja todavía no existe (ver
  ADR 0003).
- ADR 0003 sobre las decisiones provisionales de ventas: dependencia a
  `caja_sesiones` sin módulo de caja, `tipo_precio` sin módulo de clientes,
  snapshot de `precio_unitario_aplicado`, y descuento de stock reversible
  por variable de entorno.
- Módulo de **ventas**: `POST /api/ventas`, `GET /api/ventas` (filtros
  `cajaSesionId`, `desde`/`hasta`), `GET /api/ventas/:id` (con items).
  - El service resuelve cada item (precio según `tipoPrecio`, con fallback
    a `precio_publico` si el producto no tiene `precio_mayorista`), calcula
    subtotales con redondeo único por línea (ADR 0002) y rechaza productos
    inexistentes o inactivos, todo antes de escribir en la base de datos.
  - Crear venta + items + descuento de stock es una transacción atómica
    (`db.transaction`) definida en `ventas.service.js`, que orquesta el
    repository de ventas y el de productos — sin romper la separación de
    capas (ver ARCHITECTURE.md y ADR 0003).
  - El descuento de stock vive aislado en `descontarStockPorVenta` y se
    activa/desactiva con la variable de entorno
    `DESCONTAR_STOCK_AUTOMATICO` (pendiente de confirmación de la dueña).
- `productos.repository.js`: `descontarStock(id, cantidad)`, UPDATE
  condicionado a stock suficiente (0 filas afectadas = sin stock o producto
  inexistente).

### Corregido

- `src/middlewares/validate.js`: en Express 5, `req.query` es un getter sin
  setter (se recalcula desde la URL cruda en cada acceso), así que
  `req.query = datosValidados` fallaba en silencio y el cuerpo validado por
  zod nunca llegaba al controller. Se corrigió usando
  `Object.defineProperty` para los tres orígenes (`body`/`params`/`query`).
