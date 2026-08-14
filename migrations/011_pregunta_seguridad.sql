-- Pregunta de seguridad para recuperación de contraseña sin depender de
-- otro administrador logueado ni de acceso directo al servidor (ver ADR
-- de cierre del proyecto). Solo para administradores por decisión del
-- cliente -- la restricción vive en la capa de aplicación (auth.service.js),
-- no acá, mismo criterio que el resto de reglas de negocio del proyecto.
--
-- Ambas nullable: NULL significa "todavía no configurada". Se completan
-- recién en el primer cambio de contraseña obligatorio del administrador
-- (autoservicio, nunca las ve quien lo creó).
ALTER TABLE usuarios ADD COLUMN pregunta_seguridad TEXT;
ALTER TABLE usuarios ADD COLUMN respuesta_seguridad_hash TEXT;
