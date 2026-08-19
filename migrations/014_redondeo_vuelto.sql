-- Redondeo de vuelto configurable (ver ADR de exportación CSV/gastos/
-- redondeo/gráficos). redondeo_vuelto = vuelto redondeado - vuelto exacto
-- (con signo). 0 por defecto y siempre que el redondeo esté apagado o el
-- medio de pago no sea efectivo -- así caja.repository.js puede restarlo
-- sin necesitar un CASE aparte para distinguir esos casos.
ALTER TABLE ventas ADD COLUMN redondeo_vuelto INTEGER NOT NULL DEFAULT 0;
