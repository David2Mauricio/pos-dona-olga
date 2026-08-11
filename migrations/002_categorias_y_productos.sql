-- Categorías y productos.
-- Precios en pesos COP enteros, peso en gramos enteros: ver ADR 0002.

CREATE TABLE categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  nombre TEXT NOT NULL,

  -- 'unidad': se vende por pieza (ej. una bandeja empacada).
  -- 'peso': se pesa en mostrador (ej. pechuga, presas).
  tipo_venta TEXT NOT NULL CHECK (tipo_venta IN ('unidad', 'peso')),

  -- NULL para los productos que se pesan en mostrador y no traen empaque
  -- con código de barras. UNIQUE ya permite múltiples NULL en SQLite
  -- (NULL nunca es igual a NULL), así que no bloquea tener varios productos
  -- sin código.
  codigo_barras TEXT UNIQUE,

  -- Pesos COP enteros, sin centavos (no circulan fracciones de peso).
  precio_publico INTEGER NOT NULL CHECK (precio_publico >= 0),
  precio_mayorista INTEGER CHECK (precio_mayorista IS NULL OR precio_mayorista >= 0),

  -- Solo una de las dos columnas de stock aplica según tipo_venta; la otra
  -- debe quedar en NULL. Se valida con el CHECK de abajo, no solo por
  -- convención en el código.
  stock_unidades INTEGER CHECK (stock_unidades IS NULL OR stock_unidades >= 0),
  stock_gramos INTEGER CHECK (stock_gramos IS NULL OR stock_gramos >= 0),

  -- Solo el nombre del archivo: el binario vive en /uploads, nunca en la BD.
  foto_nombre_archivo TEXT,

  -- SQLite no tiene tipo BOOLEAN nativo; se modela como 0/1.
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),

  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),

  CHECK (
    (tipo_venta = 'unidad' AND stock_unidades IS NOT NULL AND stock_gramos IS NULL)
    OR
    (tipo_venta = 'peso' AND stock_gramos IS NOT NULL AND stock_unidades IS NULL)
  )
);

-- SQLite no indexa automáticamente las columnas de llave foránea (a
-- diferencia de las columnas UNIQUE, que sí generan índice implícito).
-- Sin este índice, cada búsqueda de "productos de esta categoría" sería
-- un recorrido completo de la tabla.
CREATE INDEX idx_productos_categoria_id ON productos(categoria_id);

-- No se crea un índice aparte para codigo_barras: la restricción UNIQUE
-- de arriba ya genera uno implícito, y duplicarlo solo gastaría espacio
-- y tiempo de escritura sin ninguna ganancia de lectura.
