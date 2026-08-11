const db = require('../../config/database');

function mapearFila(fila) {
  if (!fila) return undefined;

  return {
    id: fila.id,
    nombre: fila.nombre,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

function crear(nombre) {
  const resultado = db.prepare('INSERT INTO categorias (nombre) VALUES (?)').run(nombre);
  return obtenerPorId(resultado.lastInsertRowid);
}

function obtenerPorId(id) {
  const fila = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
  return mapearFila(fila);
}

function listar() {
  const filas = db.prepare('SELECT * FROM categorias ORDER BY nombre').all();
  return filas.map(mapearFila);
}

function actualizar(id, nombre) {
  db.prepare(
    `UPDATE categorias
     SET nombre = ?, actualizado_en = datetime('now')
     WHERE id = ?`
  ).run(nombre, id);

  return obtenerPorId(id);
}

module.exports = { crear, obtenerPorId, listar, actualizar };
