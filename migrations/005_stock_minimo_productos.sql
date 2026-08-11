-- Umbral de alerta de stock bajo, específico de cada producto. NULL por
-- defecto: mientras no se defina, ese producto nunca genera alerta (ver
-- ADR 0005) — la dueña todavía no ha confirmado estos umbrales.
ALTER TABLE productos ADD COLUMN stock_minimo INTEGER CHECK (stock_minimo IS NULL OR stock_minimo >= 0);
