-- Usuarios del sistema, con roles fijos (ver ADR 0010: 2 roles, no un
-- sistema de permisos granulares — sobre-ingeniería para el tamaño real
-- de este negocio).

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,

  -- Identificador de login, no el nombre para mostrar.
  usuario TEXT NOT NULL UNIQUE,

  -- bcryptjs (ver ADR 0010): nunca se guarda la contraseña en texto plano.
  password_hash TEXT NOT NULL,

  rol TEXT NOT NULL CHECK (rol IN ('administrador', 'cajero')),

  -- Fuerza cambiar la contraseña temporal en el primer ingreso (tanto la
  -- del administrador inicial como la de cualquier cajero nuevo).
  debe_cambiar_password INTEGER NOT NULL DEFAULT 1 CHECK (debe_cambiar_password IN (0, 1)),

  -- Se desactiva, no se borra (mismo criterio que productos/proveedores):
  -- un usuario desactivado no puede loguearse, pero su historial de
  -- ventas/movimientos sigue intacto.
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),

  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
