-- Trazabilidad de precios (Fase 2, ver ADR 0011): permite que un item de
-- venta se cobre a un precio distinto del catálogo (precio_unitario_aplicado
-- ya guardaba ese valor, override o no) dejando registro de que fue una
-- excepción y por qué. precio_modificado es una bandera, no el precio en sí
-- — el precio real ya vive en precio_unitario_aplicado, sin importar su
-- origen.
--
-- La consistencia cruzada (motivo_ajuste obligatorio si y solo si
-- precio_modificado=1) se valida en la capa de aplicación (zod +
-- ventas.service.js), no acá: igual que en la migración 005, un CHECK de
-- ALTER TABLE ADD COLUMN en SQLite solo puede referenciar la columna nueva,
-- no otras columnas de la tabla.
ALTER TABLE ventas_items ADD COLUMN precio_modificado INTEGER NOT NULL DEFAULT 0 CHECK (precio_modificado IN (0, 1));
ALTER TABLE ventas_items ADD COLUMN motivo_ajuste TEXT;
