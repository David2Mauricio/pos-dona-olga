// Repository compartido entre el módulo de auth (login, cambio de
// password) y el módulo de negocio de usuarios (gestión, solo
// administrador) — es la misma tabla, no hay razón para duplicar el
// acceso a datos en dos archivos.

const db = require('../config/database');

// Incluye password_hash a propósito: el service de auth lo necesita para
// comparar con bcryptjs. Nunca debe salir de la capa de service hacia el
// controller/HTTP — eso es responsabilidad de quien llama, no de este
// mapeo (mismo criterio que el resto del proyecto: el repository mapea
// datos completos y fieles, el service decide qué exponer).
function mapearFila(fila) {
  if (!fila) return undefined;

  return {
    id: fila.id,
    nombre: fila.nombre,
    usuario: fila.usuario,
    passwordHash: fila.password_hash,
    rol: fila.rol,
    debeCambiarPassword: fila.debe_cambiar_password === 1,
    activo: fila.activo === 1,
    creadoEn: fila.creado_en,
  };
}

function crear({ nombre, usuario, passwordHash, rol, debeCambiarPassword }) {
  const resultado = db
    .prepare(
      `INSERT INTO usuarios (nombre, usuario, password_hash, rol, debe_cambiar_password)
       VALUES (@nombre, @usuario, @passwordHash, @rol, @debeCambiarPassword)`
    )
    .run({
      nombre,
      usuario,
      passwordHash,
      rol,
      debeCambiarPassword: debeCambiarPassword ? 1 : 0,
    });

  return obtenerPorId(resultado.lastInsertRowid);
}

function obtenerPorId(id) {
  const fila = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  return mapearFila(fila);
}

function obtenerPorUsuario(usuario) {
  const fila = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(usuario);
  return mapearFila(fila);
}

function listar() {
  const filas = db.prepare('SELECT * FROM usuarios ORDER BY nombre').all();
  return filas.map(mapearFila);
}

function contarAdministradoresActivos() {
  return db
    .prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'administrador' AND activo = 1")
    .get().n;
}

const COLUMNA_POR_CAMPO = {
  rol: 'rol',
  activo: 'activo',
};

// Uso acotado a propósito: solo rol/activo, desde el módulo de gestión
// de usuarios. Cambiar la contraseña es un flujo separado
// (actualizarPassword) porque trae su propia regla de negocio
// (debe_cambiar_password se apaga junto con el hash, siempre juntos).
function actualizar(id, cambios) {
  const asignaciones = [];
  const parametros = { id };

  for (const [campo, valor] of Object.entries(cambios)) {
    const columna = COLUMNA_POR_CAMPO[campo];
    if (!columna) continue;

    asignaciones.push(`${columna} = @${campo}`);
    parametros[campo] = campo === 'activo' ? (valor ? 1 : 0) : valor;
  }

  if (asignaciones.length === 0) return obtenerPorId(id);

  db.prepare(`UPDATE usuarios SET ${asignaciones.join(', ')} WHERE id = @id`).run(parametros);
  return obtenerPorId(id);
}

function actualizarPassword(id, passwordHash) {
  db.prepare(
    `UPDATE usuarios SET password_hash = @passwordHash, debe_cambiar_password = 0 WHERE id = @id`
  ).run({ id, passwordHash });
  return obtenerPorId(id);
}

module.exports = {
  crear,
  obtenerPorId,
  obtenerPorUsuario,
  listar,
  contarAdministradoresActivos,
  actualizar,
  actualizarPassword,
};
