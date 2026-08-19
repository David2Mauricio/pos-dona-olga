-- Registro de auditoría centralizado e inmutable (ver ADR 0018): quién
-- hizo qué y cuándo, para las acciones sensibles del sistema. Sin
-- editado_en ni activo a propósito -- esta tabla nunca se actualiza ni se
-- desactiva, solo se inserta. Ningún repository/service/route de este
-- proyecto expone un UPDATE o DELETE sobre ella (ver auditoria.repository.js:
-- solo existen crear() y listar()).

CREATE TABLE auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Nullable a propósito: el script de emergencia
  -- (emergencia-resetear-password.js) corre sin sesión HTTP posible por
  -- diseño -- el gate de seguridad ahí es el acceso directo a la máquina,
  -- no una cuenta. Es el único caso sin actor identificable (ver ADR 0018).
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,

  -- Texto libre a propósito, mismo criterio que ventas.medio_pago (ADR
  -- 0004) y movimientos_inventario.motivo -- no hay todavía un catálogo
  -- cerrado de tipos de acción.
  accion TEXT NOT NULL,

  entidad_tipo TEXT NOT NULL,
  entidad_id INTEGER,

  -- JSON con el contexto humano de la acción (motivo, montos, valores
  -- antes/después) -- el detalle real vive acá, no en columnas separadas
  -- por tipo de acción.
  detalle TEXT NOT NULL DEFAULT '{}',

  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_auditoria_creado_en ON auditoria(creado_en);
CREATE INDEX idx_auditoria_usuario_id ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_accion ON auditoria(accion);
