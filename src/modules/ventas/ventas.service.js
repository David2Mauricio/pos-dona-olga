const db = require('../../config/database');
const env = require('../../config/env');
const repository = require('./ventas.repository');
const productosService = require('../productos/productos.service');
const productosRepository = require('../productos/productos.repository');
const inventarioRepository = require('../inventario/inventario.repository');
const impresionService = require('../../hardware/impresion.service');
const logger = require('../../utils/logger');
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
//
// ADR 0005: además de descontar, registra el movimiento de inventario
// correspondiente (tipo='salida', motivo='venta') dentro de la misma
// transacción — todo cambio de stock pasa por el ledger, sin excepción,
// y las ventas no son la excepción solo porque llegaron primero.
function descontarStockPorVenta(productoId, cantidad, nombreProducto, ventaId) {
  const filasAfectadas = productosRepository.descontarStock(productoId, cantidad);
  if (filasAfectadas === 0) {
    throw new AppError(`Stock insuficiente para "${nombreProducto}"`, 409);
  }

  inventarioRepository.crearMovimiento({
    productoId,
    tipo: 'salida',
    cantidad: -cantidad,
    stockResultante: null,
    motivo: 'venta',
    referenciaVentaId: ventaId,
  });
}

// ventas_items solo guarda productoId (el nombre no es parte del snapshot
// de venta, ver ADR 0003), pero el recibo sí necesita mostrar nombre y
// saber si el producto es por peso o por unidad para formatear la
// cantidad. Se usa el repository directo (no el service) porque acá no
// hace falta ninguna validación de negocio, solo leer datos para mostrar
// — y porque no queremos que un producto inexistente lance un 404 que
// tumbe la impresión (ver más abajo).
function enriquecerConDatosDeProducto(venta) {
  return {
    ...venta,
    items: venta.items.map((item) => {
      const producto = productosRepository.obtenerPorId(item.productoId);
      return {
        ...item,
        nombreProducto: producto ? producto.nombre : `Producto #${item.productoId}`,
        tipoVentaProducto: producto ? producto.tipoVenta : 'unidad',
      };
    }),
  };
}

// ADR 0007: imprimir es una acción POSTERIOR a la venta, nunca parte de
// ella. Fire-and-forget a propósito (no se hace `await` de esta función
// donde se llama): la venta ya se guardó, así que el cliente HTTP no debe
// esperar a que la impresora termine (o falle) para recibir su respuesta.
// El try/catch de acá es una segunda red de seguridad — impresionService
// ya está escrito para no rechazar nunca — por si un error inesperado
// ocurriera antes de ese punto (ej. armando el recibo).
function imprimirReciboDeVenta(venta) {
  try {
    const ventaParaImprimir = enriquecerConDatosDeProducto(venta);
    impresionService.imprimirRecibo(ventaParaImprimir).catch((error) => {
      logger.error(`Error inesperado imprimiendo el recibo de la venta ${venta.id}: ${error.message}`);
    });
  } catch (error) {
    logger.error(`No se pudo preparar el recibo de la venta ${venta.id} para imprimir: ${error.message}`);
  }
}

// ADR 0007: el cajón solo se abre cuando el pago es en efectivo — con
// Nequi, Daviplata o tarjeta no hay billete que guardar, así que abrirlo
// interrumpiría al cajero sin necesidad. Mismo criterio de comparación
// tolerante a mayúsculas/espacios que ya usa caja.service.js/reportes
// (TRIM(LOWER(medioPago))). Mismo try/catch defensivo que
// imprimirReciboDeVenta: esto corre después del commit, así que un error
// acá no puede llegar a tumbar la respuesta de una venta ya guardada.
function abrirCajonSiEsEfectivo(venta) {
  try {
    if (venta.medioPago.trim().toLowerCase() !== 'efectivo') {
      return;
    }

    impresionService.abrirCajonMonedero().catch((error) => {
      logger.error(`Error inesperado abriendo el cajón para la venta ${venta.id}: ${error.message}`);
    });
  } catch (error) {
    logger.error(`No se pudo evaluar si abrir el cajón para la venta ${venta.id}: ${error.message}`);
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
        descontarStockPorVenta(item.producto.id, item.cantidad, item.producto.nombre, ventaId);
      }
    }

    return ventaId;
  });

  const ventaId = crearVentaTransaccional();
  const venta = repository.obtenerPorId(ventaId);

  // La transacción ya hizo commit acá arriba: lo que pase con la
  // impresión o el cajón de ahora en adelante no puede afectar la venta.
  imprimirReciboDeVenta(venta);
  abrirCajonSiEsEfectivo(venta);

  return venta;
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

function reimprimir(id) {
  const venta = obtenerPorId(id); // 404 si no existe
  imprimirReciboDeVenta(venta);
  return venta;
}

module.exports = { crear, obtenerPorId, listar, reimprimir };
