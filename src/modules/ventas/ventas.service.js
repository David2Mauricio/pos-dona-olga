const db = require('../../config/database');
const env = require('../../config/env');
const repository = require('./ventas.repository');
const productosService = require('../productos/productos.service');
const productosRepository = require('../productos/productos.repository');
const AppError = require('../../utils/app-error');

// ADR 0002: el redondeo se aplica una sola vez, al calcular el subtotal de
// cada línea. `divisor` es 1000 porque el precio de un producto por peso
// es por kilo, pero `cantidad` viene en gramos; para 'unidad' el precio ya
// es por pieza, así que no hay conversión.
function calcularSubtotal({ tipoVenta, precioUnitarioAplicado, cantidad }) {
  const divisor = tipoVenta === 'peso' ? 1000 : 1;
  return Math.round((precioUnitarioAplicado * cantidad) / divisor);
}

// ADR 0003: si el producto no tiene precio mayorista definido (NULL),
// vender a mayorista cae al precio público — NULL ya significa "no maneja
// precio diferenciado", no "no se puede vender a mayorista".
function resolverPrecioAplicado(producto, tipoPrecio) {
  if (tipoPrecio === 'mayorista') {
    return producto.precioMayorista ?? producto.precioPublico;
  }
  return producto.precioPublico;
}

// Aislada a propósito (ver ADR 0003): es la única función que toca stock,
// y es la que se apaga con DESCONTAR_STOCK_AUTOMATICO el día que la dueña
// confirme si quiere manejo manual. No calcula precios ni valida nada más.
function descontarStockPorVenta(productoId, cantidad, nombreProducto) {
  const filasAfectadas = productosRepository.descontarStock(productoId, cantidad);
  if (filasAfectadas === 0) {
    throw new AppError(`Stock insuficiente para "${nombreProducto}"`, 409);
  }
}

function crear({ cajaSesionId, tipoPrecio, medioPago, items }) {
  const cajaSesion = repository.obtenerCajaSesionPorId(cajaSesionId);
  if (!cajaSesion) {
    throw new AppError(`No existe una sesión de caja con id ${cajaSesionId}`, 400);
  }
  if (cajaSesion.estado !== 'abierta') {
    throw new AppError(`La sesión de caja ${cajaSesionId} no está abierta`, 400);
  }

  // Resolver cada item ANTES de abrir la transacción: obtenerPorId ya
  // lanza 404 si el producto no existe, y acá se calculan precio y
  // subtotal. Nada de esto escribe todavía en la base de datos, así que
  // si algo falla acá no hay nada que revertir.
  const itemsCalculados = items.map((item) => {
    const producto = productosService.obtenerPorId(item.productoId);

    if (!producto.activo) {
      throw new AppError(`El producto "${producto.nombre}" está inactivo y no se puede vender`, 400);
    }

    const precioUnitarioAplicado = resolverPrecioAplicado(producto, tipoPrecio);
    const subtotal = calcularSubtotal({
      tipoVenta: producto.tipoVenta,
      precioUnitarioAplicado,
      cantidad: item.cantidad,
    });

    return { producto, cantidad: item.cantidad, precioUnitarioAplicado, subtotal };
  });

  // Suma de subtotales YA redondeados, no "sumar y redondear al final"
  // (ADR 0002).
  const total = itemsCalculados.reduce((acumulado, item) => acumulado + item.subtotal, 0);

  // La transacción vive acá porque el service es quien orquesta más de un
  // repository (ventas y productos) — ver ADR 0003 y ARCHITECTURE.md.
  // Si algo falla en cualquier punto (incluido el descuento de stock),
  // better-sqlite3 revierte todo: no queda venta, ni items, ni stock
  // descontado a medias.
  const crearVentaTransaccional = db.transaction(() => {
    const ventaId = repository.crear({ cajaSesionId, tipoPrecio, medioPago, total });

    for (const item of itemsCalculados) {
      repository.crearItem({
        ventaId,
        productoId: item.producto.id,
        cantidad: item.cantidad,
        precioUnitarioAplicado: item.precioUnitarioAplicado,
        subtotal: item.subtotal,
      });

      if (env.descontarStockAutomatico) {
        descontarStockPorVenta(item.producto.id, item.cantidad, item.producto.nombre);
      }
    }

    return ventaId;
  });

  const ventaId = crearVentaTransaccional();
  return repository.obtenerPorId(ventaId);
}

function obtenerPorId(id) {
  const venta = repository.obtenerPorId(id);
  if (!venta) {
    throw new AppError(`No existe una venta con id ${id}`, 404);
  }
  return venta;
}

function listar(filtros) {
  return repository.listar(filtros);
}

module.exports = { crear, obtenerPorId, listar };
