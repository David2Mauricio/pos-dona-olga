-- Módulo de gastos (ver ADR de exportación CSV/gastos/redondeo/gráficos).
-- Mismo patrón "no borrar, desactivar" que usuarios/proveedores/productos:
-- activo, sin DELETE. `fecha` es la fecha del gasto en sí (la elige quien
-- lo registra -- un gasto suele cargarse días después de ocurrido), separada
-- de creado_en (cuándo quedó registrado en el sistema).
CREATE TABLE gastos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concepto TEXT NOT NULL,
  monto INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  categoria TEXT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_gastos_activo ON gastos(activo);
