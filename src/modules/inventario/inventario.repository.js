const db = require('../../config/database');

function mapearFila(fila) {
  if (!fila) return undefined;

  return {
    id: fila.id,
    productoId: fila.producto_id,
    tipo: fila.tipo,
    cantidad: fila.cantidad,
    stockResultante: fila.stock_resultante,
    motivo: fila.motivo,
    referenciaVentaId: fila.referencia_venta_id,
    proveedorId: fila.proveedor_id,
    creadoEn: fila.creado_en,
  };
}

function crearMovimiento({ productoId, tipo, cantidad, stockResultante, motivo, referenciaVentaId, proveedorId }) {
  const resultado = db
    .prepare(
      `INSERT INTO movimientos_inventario
         (producto_id, tipo, cantidad, stock_resultante, motivo, referencia_venta_id, proveedor_id)
       VALUES
         (@productoId, @tipo, @cantidad, @stockResultante, @motivo, @referenciaVentaId, @proveedorId)`
    )
    .run({
      productoId,
      tipo,
      cantidad,
      stockResultante: stockResultante ?? null,
      motivo,
      referenciaVentaId: referenciaVentaId ?? null,
      proveedorId: proveedorId ?? null,
    });

  return resultado.lastInsertRowid;
}

// Usado por proveedores.service.js para decidir si un borrado real es
// seguro (ver ADR de este cierre): un proveedor con al menos un movimiento
// asociado no puede borrarse, solo desactivarse.
function contarPorProveedor(proveedorId) {
  const fila = db.prepare('SELECT COUNT(*) AS total FROM movimientos_inventario WHERE proveedor_id = ?').get(proveedorId);
  return fila.total;
}

function obtenerPorId(id) {
  const fila = db.prepare('SELECT * FROM movimientos_inventario WHERE id = ?').get(id);
  return mapearFila(fila);
}

// Fase 3 (ver ADR 0012): usado al anular una venta, para saber exactamente
// qué se descontó y por cuánto — nunca se asume a partir del flag
// DESCONTAR_STOCK_AUTOMATICO *actual*, que pudo cambiar entre la venta y su
// anulación. El motivo='venta' ya está garantizado por el CHECK de la
// migración 004 (referencia_venta_id solo existe junto con motivo='venta').
function listarPorReferenciaVenta(ventaId) {
  return db
    .prepare('SELECT * FROM movimientos_inventario WHERE referencia_venta_id = ?')
    .all(ventaId)
    .map(mapearFila);
}

function listar({ productoId, desde, hasta } = {}) {
  const condiciones = [];
  const parametros = {};

  if (productoId !== undefined) {
    condiciones.push('producto_id = @productoId');
    parametros.productoId = productoId;
  }

  // Mismo criterio que en ventas.repository.js: creado_en es texto
  // 'YYYY-MM-DD HH:MM:SS', así que compara directo contra 'YYYY-MM-DD'.
  if (desde !== undefined) {
    condiciones.push('creado_en >= @desde');
    parametros.desde = desde;
  }

  if (hasta !== undefined) {
    condiciones.push('creado_en <= @hasta');
    parametros.hasta = `${hasta} 23:59:59`;
  }

  const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = db
    .prepare(`SELECT * FROM movimientos_inventario ${clausulaWhere} ORDER BY creado_en DESC`)
    .all(parametros);

  return filas.map(mapearFila);
}

// Lectura directa a productos (mismo criterio que existeCategoria en
// productos.repository.js y obtenerCajaSesionPorId en
// ventas.repository.js: una consulta puntual a otra tabla, no un
// repository ajeno completo). stock_minimo es NULL por defecto, así que
// un producto sin umbral definido nunca aparece acá (ADR 0005).
function obtenerAlertas() {
  const filas = db
    .prepare(
      `SELECT id, nombre, tipo_venta, stock_unidades, stock_gramos, stock_minimo
       FROM productos
       WHERE stock_minimo IS NOT NULL
         AND (
           (tipo_venta = 'unidad' AND stock_unidades < stock_minimo)
           OR
           (tipo_venta = 'peso' AND stock_gramos < stock_minimo)
         )
       ORDER BY nombre`
    )
    .all();

  return filas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    tipoVenta: fila.tipo_venta,
    stockActual: fila.tipo_venta === 'peso' ? fila.stock_gramos : fila.stock_unidades,
    stockMinimo: fila.stock_minimo,
  }));
}

module.exports = {
  crearMovimiento,
  obtenerPorId,
  listarPorReferenciaVenta,
  listar,
  obtenerAlertas,
  contarPorProveedor,
};
