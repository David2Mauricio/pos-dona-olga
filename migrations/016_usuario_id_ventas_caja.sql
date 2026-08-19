-- Trazabilidad de quién crea cada venta y quién abre cada sesión de caja
-- (ver extensión al ADR 0010: borrado real de usuarios). Nullable, SIN
-- backfill a propósito: las filas anteriores a esta migración quedan con
-- usuario_id NULL -- no hay forma de reconstruir retroactivamente quién
-- las creó, y no vale la pena inventar un valor falso. Es una limitación
-- conocida y aceptada, documentada en el ADR, no un descuido.
--
-- ON DELETE RESTRICT, mismo criterio que proveedor_id en
-- movimientos_inventario (012_proveedor_id_movimientos.sql): un usuario
-- con ventas o cajas ligadas después de esta migración no puede
-- desaparecer de la base. Segunda capa de protección además del chequeo
-- explícito en usuarios.service.js antes de borrar.
ALTER TABLE ventas ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE caja_sesiones ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT;

CREATE INDEX idx_ventas_usuario_id ON ventas(usuario_id);
CREATE INDEX idx_caja_sesiones_usuario_id ON caja_sesiones(usuario_id);
