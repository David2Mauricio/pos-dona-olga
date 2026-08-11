-- Sesiones de caja y ventas.
-- Ver ADR 0003: caja_sesiones se crea completa aunque el módulo de caja
-- (endpoints) todavía no existe, porque ventas.caja_sesion_id es FK
-- obligatoria. tipo_precio y el snapshot de precio también se explican ahí.

CREATE TABLE caja_sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monto_apertura INTEGER NOT NULL CHECK (monto_apertura >= 0),
  monto_cierre INTEGER CHECK (monto_cierre IS NULL OR monto_cierre >= 0),
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  abierta_en TEXT NOT NULL DEFAULT (datetime('now')),
  cerrada_en TEXT,

  -- Una sesión abierta no puede tener cierre; una cerrada debe tenerlo.
  -- Igual que en productos, esto se valida a nivel de motor, no solo en
  -- el código.
  CHECK (
    (estado = 'abierta' AND cerrada_en IS NULL AND monto_cierre IS NULL)
    OR
    (estado = 'cerrada' AND cerrada_en IS NOT NULL AND monto_cierre IS NOT NULL)
  )
);

CREATE TABLE ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caja_sesion_id INTEGER NOT NULL REFERENCES caja_sesiones(id) ON DELETE RESTRICT,

  -- Provisional hasta que exista el módulo de clientes (ver ADR 0003).
  tipo_precio TEXT NOT NULL CHECK (tipo_precio IN ('publico', 'mayorista')),

  -- Suma de los subtotales de línea, YA redondeados cada uno (ADR 0002).
  -- Se calcula en el service, nunca se recibe del cliente.
  total INTEGER NOT NULL CHECK (total >= 0),

  -- Texto libre a propósito: el cliente aún no define qué medios de pago
  -- acepta, así que no hay un enum que modelar todavía.
  medio_pago TEXT NOT NULL,

  creada_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ventas_caja_sesion_id ON ventas(caja_sesion_id);
-- Soporta el filtro por rango de fechas en el listado de ventas.
CREATE INDEX idx_ventas_creada_en ON ventas(creada_en);

CREATE TABLE ventas_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- CASCADE: un item de venta no tiene sentido sin su venta (relación de
  -- composición, no de referencia simple).
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,

  -- RESTRICT: un producto con historial de ventas no se puede borrar
  -- (igual criterio que categorias -> productos).
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,

  -- Gramos o unidades según el tipo_venta del producto en el momento de
  -- la venta (no se guarda tipo_venta acá porque ya está implícito en
  -- qué stock se descontó; no es un dato que pueda cambiar retroactivamente).
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),

  -- Snapshot: copia del precio de productos en el momento de la venta.
  -- Nunca se relee de productos para reportes (ver ADR 0003).
  precio_unitario_aplicado INTEGER NOT NULL CHECK (precio_unitario_aplicado >= 0),

  -- cantidad * precio_unitario_aplicado, ya redondeado (ADR 0002).
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX idx_ventas_items_venta_id ON ventas_items(venta_id);
CREATE INDEX idx_ventas_items_producto_id ON ventas_items(producto_id);
