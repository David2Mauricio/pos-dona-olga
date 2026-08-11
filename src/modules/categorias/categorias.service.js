const repository = require('./categorias.repository');
const AppError = require('../../utils/app-error');

// Mismo criterio que en productos: el código de error real de
// better-sqlite3 para la UNIQUE de `nombre` (verificado antes en el
// módulo de productos) se traduce a un 409 con mensaje de negocio, en vez
// de dejar pasar el "UNIQUE constraint failed" crudo.
function traducirErrorSqlite(error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new AppError('Ya existe una categoría con ese nombre', 409);
  }
  return error;
}

function crear(nombre) {
  try {
    return repository.crear(nombre);
  } catch (error) {
    throw traducirErrorSqlite(error);
  }
}

function listar() {
  return repository.listar();
}

function obtenerPorId(id) {
  const categoria = repository.obtenerPorId(id);
  if (!categoria) {
    throw new AppError(`No existe una categoría con id ${id}`, 404);
  }
  return categoria;
}

function actualizar(id, nombre) {
  obtenerPorId(id); // ya lanza 404 si no existe

  try {
    return repository.actualizar(id, nombre);
  } catch (error) {
    throw traducirErrorSqlite(error);
  }
}

module.exports = { crear, listar, obtenerPorId, actualizar };
