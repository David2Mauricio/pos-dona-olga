-- Vínculo opcional entre un movimiento de inventario y el proveedor que
-- entregó esa mercadería. Ya anticipado en 006_proveedores.sql como
-- extensión futura "cuando haya una razón real de negocio" -- confirmado
-- con el cliente. Nullable: la mayoría de motivos (salida por venta,
-- ajuste de conteo) no tienen proveedor; solo tiene sentido en 'entrada'.
--
-- ON DELETE RESTRICT: mismo criterio que producto_id y referencia_venta_id
-- en esta misma tabla (004_movimientos_inventario.sql) -- un proveedor con
-- movimientos asociados no puede desaparecer de la base. Es la misma regla
-- que el borrado real de proveedores necesita, así que queda reforzada en
-- dos capas: el service la valida explícito antes de borrar (para dar un
-- mensaje de negocio claro, 409), y el motor la garantiza igual si algo se
-- le escapara al service.
ALTER TABLE movimientos_inventario
  ADD COLUMN proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE RESTRICT;

CREATE INDEX idx_movimientos_inventario_proveedor_id ON movimientos_inventario(proveedor_id);
