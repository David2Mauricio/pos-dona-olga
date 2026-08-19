const repository = require('./proveedores.repository');
const inventarioRepository = require('../inventario/inventario.repository');
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

// Borrado real, no un PATCH activo:false -- caso confirmado con el
// cliente: limpiar proveedores creados por error o duplicados. Regla no
// negociable: si el proveedor ya tiene algún movimiento de inventario
// asociado, se rechaza con 409 y un mensaje que dice explícitamente qué
// hacer en su lugar (desactivar), en vez de dejar que el DELETE
// simplemente falle. El FK ON DELETE RESTRICT (migración 012) es la
// segunda capa de la misma regla, por si algo se le escapara a esta
// validación explícita.
function borrar(id) {
  obtenerPorId(id); // 404 si no existe

  const cantidadMovimientos = inventarioRepository.contarPorProveedor(id);
  if (cantidadMovimientos > 0) {
    throw new AppError(
      'Este proveedor ya tiene entradas registradas — desactivalo en vez de borrarlo, para no perder el historial.',
      409
    );
  }

  repository.borrar(id);
}

module.exports = { crear, listar, obtenerPorId, actualizar, borrar };
