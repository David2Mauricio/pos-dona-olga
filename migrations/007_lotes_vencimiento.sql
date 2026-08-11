-- Lotes de vencimiento: registro informativo y de alerta, desacoplado del
-- stock general de productos. No gobierna descuento de inventario (sin
-- FIFO automático). Ver ADR 0006.

CREATE TABLE lotes_vencimiento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,

  -- Snapshot de cuánto llegó en esa compra; no se resincroniza con
  -- productos.stock_unidades/stock_gramos (ver ADR 0006).
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),

  -- Texto 'YYYY-MM-DD' (mismo criterio que las demás fechas del
  -- proyecto): ordena lexicográficamente igual que cronológicamente.
  fecha_vencimiento TEXT NOT NULL,

  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_lotes_vencimiento_producto_id ON lotes_vencimiento(producto_id);
CREATE INDEX idx_lotes_vencimiento_fecha_vencimiento ON lotes_vencimiento(fecha_vencimiento);
