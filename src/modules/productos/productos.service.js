const repository = require('./productos.repository');
const AppError = require('../../utils/app-error');

// La migración ya tiene un CHECK que exige que stock_unidades/stock_gramos
// sean mutuamente excluyentes según tipo_venta, pero dejar que ese CHECK
// sea la única línea de defensa significa que el error que ve el usuario
// es un "CHECK constraint failed" de SQLite, sin contexto de negocio. Esta
// función valida lo mismo antes de tocar la base de datos, con un mensaje
// que sí explica qué está mal.
function validarCoherenciaStock({ tipoVenta, stockUnidades, stockGramos }) {
  if (tipoVenta === 'unidad') {
    if (stockUnidades === undefined || stockUnidades === null) {
      throw new AppError('Un producto con tipoVenta "unidad" requiere stockUnidades', 400);
    }
    if (stockGramos !== undefined && stockGramos !== null) {
      throw new AppError('Un producto con tipoVenta "unidad" no debe traer stockGramos', 400);
    }
  }

  if (tipoVenta === 'peso') {
    if (stockGramos === undefined || stockGramos === null) {
      throw new AppError('Un producto con tipoVenta "peso" requiere stockGramos', 400);
    }
    if (stockUnidades !== undefined && stockUnidades !== null) {
      throw new AppError('Un producto con tipoVenta "peso" no debe traer stockUnidades', 400);
    }
  }
}

// Traduce los códigos de error de better-sqlite3 a AppError con mensaje de
// negocio. Cualquier código que no reconozcamos se deja pasar tal cual,
// para que el middleware central lo trate como un error inesperado (500)
// en vez de disfrazarlo de un 400 que no le corresponde.
function traducirErrorSqlite(error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new AppError('Ya existe un producto con ese código de barras', 409);
  }
  if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return new AppError('La categoría indicada no existe', 400);
  }
  if (error.code === 'SQLITE_CONSTRAINT_CHECK') {
    return new AppError('Los datos del producto no cumplen las reglas de negocio (precio o stock inválido)', 400);
  }
  return error;
}

function crear(datosProducto) {
  validarCoherenciaStock(datosProducto);

  if (!repository.existeCategoria(datosProducto.categoriaId)) {
    throw new AppError(`No existe la categoría con id ${datosProducto.categoriaId}`, 400);
  }

  try {
    return repository.crear(datosProducto);
  } catch (error) {
    throw traducirErrorSqlite(error);
  }
}

function listar(filtros) {
  return repository.listar(filtros);
}

function obtenerPorId(id) {
  const producto = repository.obtenerPorId(id);
  if (!producto) {
    throw new AppError(`No existe un producto con id ${id}`, 404);
  }
  return producto;
}

function obtenerPorCodigoBarras(codigoBarras) {
  const producto = repository.obtenerPorCodigoBarras(codigoBarras);
  if (!producto) {
    throw new AppError(`No existe un producto con código de barras ${codigoBarras}`, 404);
  }
  return producto;
}

function actualizar(id, cambiosOriginales) {
  const productoActual = obtenerPorId(id); // ya lanza 404 si no existe
  const cambios = { ...cambiosOriginales };

  // tipoVenta ahora sí se puede cambiar (ver ADR 0017) -- pero gramos y
  // unidades no son convertibles entre sí, así que cambiar el tipo exige
  // declarar de nuevo el stock actual, en el formato nuevo, nunca lo deja
  // en blanco/0 sin que la persona lo note. El campo del tipo anterior se
  // limpia a NULL explícito (no alcanza con "no mandarlo": si quedara el
  // valor viejo puesto, violaría el CHECK de exclusión mutua de la
  // migración 002 apenas se intente guardar el tipo nuevo).
  const tipoVentaCambia = cambios.tipoVenta !== undefined && cambios.tipoVenta !== productoActual.tipoVenta;

  if (tipoVentaCambia) {
    if (cambios.tipoVenta === 'unidad') {
      if (cambios.stockUnidades === undefined || cambios.stockUnidades === null) {
        throw new AppError('Al cambiar el tipo de venta a "unidad" hay que indicar el stock actual, en unidades', 400);
      }
      cambios.stockGramos = null;
    } else {
      if (cambios.stockGramos === undefined || cambios.stockGramos === null) {
        throw new AppError('Al cambiar el tipo de venta a "peso" hay que indicar el stock actual, en gramos', 400);
      }
      cambios.stockUnidades = null;
    }

    // stockMinimo también está en la unidad del tipo de venta (ver
    // catalogo.js) -- dejarlo con el valor viejo sería un umbral de alerta
    // silenciosamente equivocado (ej. "500" pensado como gramos,
    // reinterpretado como 500 unidades). Se limpia igual que el stock: si
    // se quiere un umbral en el formato nuevo, se vuelve a definir aparte.
    if (cambios.stockMinimo === undefined) {
      cambios.stockMinimo = null;
    }
  }

  if ('stockUnidades' in cambios || 'stockGramos' in cambios) {
    validarCoherenciaStock({
      tipoVenta: cambios.tipoVenta ?? productoActual.tipoVenta,
      stockUnidades: 'stockUnidades' in cambios ? cambios.stockUnidades : productoActual.stockUnidades,
      stockGramos: 'stockGramos' in cambios ? cambios.stockGramos : productoActual.stockGramos,
    });
  }

  if (cambios.categoriaId !== undefined && !repository.existeCategoria(cambios.categoriaId)) {
    throw new AppError(`No existe la categoría con id ${cambios.categoriaId}`, 400);
  }

  let productoActualizado;
  try {
    productoActualizado = repository.actualizar(id, cambios);
  } catch (error) {
    throw traducirErrorSqlite(error);
  }

  return productoActualizado;
}

module.exports = {
  crear,
  listar,
  obtenerPorId,
  obtenerPorCodigoBarras,
  actualizar,
};
