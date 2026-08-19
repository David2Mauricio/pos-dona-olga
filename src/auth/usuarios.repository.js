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
    // Igual que passwordHash: uso interno del módulo auth para comparar
    // con bcryptjs, nunca sale de la capa de service hacia HTTP.
    preguntaSeguridad: fila.pregunta_seguridad,
    respuestaSeguridadHash: fila.respuesta_seguridad_hash,
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

// Fase 4 (ver ADR 0013): distinta de actualizarPassword a propósito, no un
// parámetro extra en esa — son dos flujos con reglas opuestas sobre
// debe_cambiar_password (autoservicio la apaga porque la persona ya la
// escribió ella misma; un reseteo por administrador la prende porque la
// contraseña nueva es temporal y ajena, igual que en el alta).
function resetearPassword(id, passwordHash) {
  db.prepare(
    `UPDATE usuarios SET password_hash = @passwordHash, debe_cambiar_password = 1 WHERE id = @id`
  ).run({ id, passwordHash });
  return obtenerPorId(id);
}

// Pregunta de seguridad (ver ADR de cierre del proyecto): siempre se
// guarda junto con el hash de la respuesta, nunca una sin la otra.
function establecerPreguntaSeguridad(id, pregunta, respuestaHash) {
  db.prepare(
    `UPDATE usuarios SET pregunta_seguridad = @pregunta, respuesta_seguridad_hash = @respuestaHash WHERE id = @id`
  ).run({ id, pregunta, respuestaHash });
  return obtenerPorId(id);
}

// Borrado real de usuarios (ver extensión al ADR 0010): "sin actividad"
// se verifica contra las CUATRO tablas que hoy tienen una FK
// usuario_id -> usuarios(id) ON DELETE RESTRICT -- ventas y caja_sesiones
// (migración 016), auditoria (ADR 0018) y gastos (migración 015). No es
// una lista arbitraria: es exactamente lo que el motor rechazaría igual
// si este chequeo no existiera, así que nunca puede quedar desalineada
// con el esquema real. Cubre de más los cuatro criterios originales
// pedidos (venta creada, movimiento manual, caja abierta/cerrada, venta
// anulada -- estos tres últimos solo viven en auditoria) más cualquier
// otra acción sensible que el usuario haya hecho (reseteo de otra
// contraseña, alta de otro usuario, registro de un gasto), que también
// bloquearía el borrado a nivel de esquema si se lo dejara pasar.
function tieneActividad(id) {
  const enVentas = db.prepare('SELECT 1 FROM ventas WHERE usuario_id = ? LIMIT 1').get(id);
  if (enVentas) return true;

  const enCaja = db.prepare('SELECT 1 FROM caja_sesiones WHERE usuario_id = ? LIMIT 1').get(id);
  if (enCaja) return true;

  const enAuditoria = db.prepare('SELECT 1 FROM auditoria WHERE usuario_id = ? LIMIT 1').get(id);
  if (enAuditoria) return true;

  const enGastos = db.prepare('SELECT 1 FROM gastos WHERE usuario_id = ? LIMIT 1').get(id);
  if (enGastos) return true;

  return false;
}

function borrar(id) {
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
}

module.exports = {
  crear,
  obtenerPorId,
  obtenerPorUsuario,
  listar,
  contarAdministradoresActivos,
  actualizar,
  actualizarPassword,
  resetearPassword,
  establecerPreguntaSeguridad,
  tieneActividad,
  borrar,
};
