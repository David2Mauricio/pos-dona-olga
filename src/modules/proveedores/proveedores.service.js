const repository = require('./proveedores.repository');
const AppError = require('../../utils/app-error');

// Mismo criterio que productos (codigo_barras) y categorías (nombre): el
// código real de better-sqlite3 para la UNIQUE de `nit` se traduce a un
// 409 con mensaje de negocio.
function traducirErrorSqlite(error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new AppError('Ya existe un proveedor con ese NIT', 409);
  }
  return error;
}

function crear(datosProveedor) {
  try {
    return repository.crear(datosProveedor);
  } catch (error) {
    throw traducirErrorSqlite(error);
  }
}

function listar(filtros) {
  return repository.listar(filtros);
}

function obtenerPorId(id) {
  const proveedor = repository.obtenerPorId(id);
  if (!proveedor) {
    throw new AppError(`No existe un proveedor con id ${id}`, 404);
  }
  return proveedor;
}

function actualizar(id, cambios) {
  obtenerPorId(id); // ya lanza 404 si no existe

  try {
    return repository.actualizar(id, cambios);
  } catch (error) {
    throw traducirErrorSqlite(error);
  }
}

module.exports = { crear, listar, obtenerPorId, actualizar };
