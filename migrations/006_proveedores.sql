-- Directorio de proveedores. Sin vínculo a productos ni a
-- movimientos_inventario todavía: agregar proveedor_id a
-- movimientos_inventario es una extensión futura cuando haya una razón
-- real de negocio, no un problema que el cliente haya planteado.

CREATE TABLE proveedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Sin UNIQUE: dos proveedores distintos podrían compartir nombre comercial.
  nombre TEXT NOT NULL,

  -- El identificador real cuando existe; no todo proveedor lo tiene registrado.
  nit TEXT UNIQUE,

  telefono TEXT,
  direccion TEXT,

  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),

  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
