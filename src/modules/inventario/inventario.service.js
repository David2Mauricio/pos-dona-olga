const db = require('../../config/database');
const repository = require('./inventario.repository');
const productosService = require('../productos/productos.service');
const productosRepository = require('../productos/productos.repository');
const AppError = require('../../utils/app-error');

function crear(datos) {
  // 'venta' es un motivo reservado: solo lo genera ventas.service.js al
  // confirmar una venta real, con su propio referencia_venta_id. Permitir
  // que alguien lo escriba a mano acá crearía un movimiento que aparenta
  // venir de una venta que nunca existió.
  if (datos.motivo.trim().toLowerCase() === 'venta') {
    throw new AppError(
      "El motivo 'venta' se genera automáticamente al confirmar una venta; no se puede crear manualmente",
      400
    );
  }

  // Existencia del producto (404 si no existe) y su nombre para mensajes
  // de error: esto no necesita ser atómico con la escritura, ni nombre ni
  // tipoVenta cambian a mitad de la operación.
  const producto = productosService.obtenerPorId(datos.productoId);

  const crearMovimientoTransaccional = db.transaction(() => {
    let cantidadDelta;
    let stockResultante = null;

    if (datos.tipo === 'entrada') {
      cantidadDelta = datos.cantidad;
      productosRepository.aumentarStock(producto.id, datos.cantidad);
    } else if (datos.tipo === 'salida') {
      cantidadDelta = -datos.cantidad;
      const filasAfectadas = productosRepository.descontarStock(producto.id, datos.cantidad);
      if (filasAfectadas === 0) {
        throw new AppError(`Stock insuficiente para "${producto.nombre}"`, 409);
      }
    } else {
      // Ajuste: el stock actual se relee ACÁ DENTRO, no antes de abrir la
      // transacción — el delta se calcula y se persiste junto con la
      // escritura como una sola unidad atómica (mismo estándar que el
      // resto del proyecto, ver ADR 0005).
      const productoActual = productosRepository.obtenerPorId(producto.id);
      const stockActual =
        productoActual.tipoVenta === 'peso' ? productoActual.stockGramos : productoActual.stockUnidades;

      cantidadDelta = datos.stockNuevo - stockActual;
      if (cantidadDelta === 0) {
        throw new AppError(
          `El stock de "${producto.nombre}" ya es ${datos.stockNuevo}; no hay ajuste que aplicar`,
          400
        );
      }

      stockResultante = datos.stockNuevo;
      productosRepository.fijarStock(producto.id, datos.stockNuevo);
    }

    return repository.crearMovimiento({
      productoId: producto.id,
      tipo: datos.tipo,
      cantidad: cantidadDelta,
      stockResultante,
      motivo: datos.motivo,
      referenciaVentaId: null,
    });
  });

  const movimientoId = crearMovimientoTransaccional();
  return repository.obtenerPorId(movimientoId);
}

function listar(filtros) {
  return repository.listar(filtros);
}

function obtenerAlertas() {
  return repository.obtenerAlertas();
}

module.exports = { crear, listar, obtenerAlertas };
