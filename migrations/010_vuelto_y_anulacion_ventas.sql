-- Vuelto y anulación de ventas (Fase 3, ver ADR 0012).
--
-- Consistencia cruzada (monto_recibido obligatorio si y solo si el medio de
-- pago es efectivo; motivo_anulacion/anulada_en obligatorios si y solo si
-- estado='anulada') se valida en la aplicación, no acá — mismo límite de
-- ALTER TABLE ADD COLUMN ya documentado en las migraciones 005 y 009.
ALTER TABLE ventas ADD COLUMN monto_recibido INTEGER CHECK (monto_recibido IS NULL OR monto_recibido >= 0);
ALTER TABLE ventas ADD COLUMN estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'anulada'));
ALTER TABLE ventas ADD COLUMN motivo_anulacion TEXT;
ALTER TABLE ventas ADD COLUMN anulada_en TEXT;
