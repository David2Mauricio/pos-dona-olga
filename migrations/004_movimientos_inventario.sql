-- Ledger único de todo cambio de stock (entradas, salidas, ajustes y las
-- salidas que genera una venta). Ver ADR 0005.

CREATE TABLE movimientos_inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),

  -- Delta firmado que efectivamente se aplicó al stock (positivo=subió,
  -- negativo=bajó), para los tres tipos. Nunca 0: un movimiento sin efecto
  -- no es un movimiento.
  cantidad INTEGER NOT NULL CHECK (cantidad != 0),

  -- Solo poblado en 'ajuste': el valor absoluto de stock que el operador
  -- declaró (conteo físico real). NULL para entrada/salida, donde el
  -- efecto ya queda expresado completo en `cantidad`.
  stock_resultante INTEGER CHECK (stock_resultante IS NULL OR stock_resultante >= 0),

  -- Texto libre a propósito (igual que ventas.medio_pago, ver ADR 0004):
  -- no hay todavía un catálogo cerrado de motivos.
  motivo TEXT NOT NULL,

  -- Obligatorio cuando motivo='venta' (poblado por ventas.service.js
  -- dentro de la misma transacción que crea la venta), NULL en cualquier
  -- otro caso.
  referencia_venta_id INTEGER REFERENCES ventas(id) ON DELETE RESTRICT,

  creado_en TEXT NOT NULL DEFAULT (datetime('now')),

  -- El signo de `cantidad` debe ser coherente con `tipo`, y
  -- `stock_resultante` solo existe donde corresponde.
  CHECK (
    (tipo = 'entrada' AND cantidad > 0 AND stock_resultante IS NULL)
    OR
    (tipo = 'salida' AND cantidad < 0 AND stock_resultante IS NULL)
    OR
    (tipo = 'ajuste' AND stock_resultante IS NOT NULL)
  ),

  CHECK (
    (motivo = 'venta' AND referencia_venta_id IS NOT NULL)
    OR
    (motivo != 'venta' AND referencia_venta_id IS NULL)
  )
);

CREATE INDEX idx_movimientos_inventario_producto_id ON movimientos_inventario(producto_id);
CREATE INDEX idx_movimientos_inventario_creado_en ON movimientos_inventario(creado_en);
CREATE INDEX idx_movimientos_inventario_referencia_venta_id ON movimientos_inventario(referencia_venta_id);
