const db = require('../../config/database');

function mapearVenta(fila) {
  if (!fila) return undefined;

  return {
    id: fila.id,
    cajaSesionId: fila.caja_sesion_id,
    tipoPrecio: fila.tipo_precio,
    total: fila.total,
    medioPago: fila.medio_pago,
    // Fase 3 (ver ADR 0012): vuelto no se guarda como columna propia — es
    // monto_recibido - total, y ambos ya están disponibles acá. Guardar un
    // tercer valor derivado abriría la puerta a que quede inconsistente si
    // alguno de los otros dos cambiara (no deberían, pero es la misma razón
    // por la que ADR 0011 no duplica el precio ajustado).
    montoRecibido: fila.monto_recibido,
    vuelto: fila.monto_recibido !== null ? fila.monto_recibido - fila.total : null,
    estado: fila.estado,
    motivoAnulacion: fila.motivo_anulacion,
    anuladaEn: fila.anulada_en,
    creadaEn: fila.creada_en,
  };
}

function mapearItem(fila) {
  return {
    id: fila.id,
    ventaId: fila.venta_id,
    productoId: fila.producto_id,
    cantidad: fila.cantidad,
    precioUnitarioAplicado: fila.precio_unitario_aplicado,
    subtotal: fila.subtotal,
    precioModificado: fila.precio_modificado === 1,
    motivoAjuste: fila.motivo_ajuste,
  };
}

// Lectura mínima hacia caja_sesiones: el módulo de caja todavía no existe
// (ver ADR 0003), pero ventas necesita saber si la sesión existe y si
// está abierta. Mismo criterio que `existeCategoria` en
// productos.repository.js: una lectura puntual a otra tabla, no un
// repository ajeno completo.
function obtenerCajaSesionPorId(id) {
  return db.prepare('SELECT id, estado FROM caja_sesiones WHERE id = ?').get(id);
}

function crear({ cajaSesionId, tipoPrecio, medioPago, total, montoRecibido }) {
  const resultado = db
    .prepare(
      `INSERT INTO ventas (caja_sesion_id, tipo_precio, medio_pago, total, monto_recibido)
       VALUES (@cajaSesionId, @tipoPrecio, @medioPago, @total, @montoRecibido)`
    )
    .run({ cajaSesionId, tipoPrecio, medioPago, total, montoRecibido: montoRecibido ?? null });

  return resultado.lastInsertRowid;
}

// Fase 3 (ver ADR 0012): estado='activa' es el default de la columna, así
// que no hace falta un `crear` con estado explícito. anular() es la única
// transición de estado que existe hoy — no hay "reactivar".
function anular(id, motivoAnulacion) {
  db.prepare(
    `UPDATE ventas
     SET estado = 'anulada', motivo_anulacion = @motivoAnulacion, anulada_en = datetime('now')
     WHERE id = @id`
  ).run({ id, motivoAnulacion });
}

function crearItem({
  ventaId,
  productoId,
  cantidad,
  precioUnitarioAplicado,
  subtotal,
  precioModificado,
  motivoAjuste,
}) {
  db.prepare(
    `INSERT INTO ventas_items
       (venta_id, producto_id, cantidad, precio_unitario_aplicado, subtotal, precio_modificado, motivo_ajuste)
     VALUES (@ventaId, @productoId, @cantidad, @precioUnitarioAplicado, @subtotal, @precioModificado, @motivoAjuste)`
  ).run({
    ventaId,
    productoId,
    cantidad,
    precioUnitarioAplicado,
    subtotal,
    precioModificado: precioModificado ? 1 : 0,
    motivoAjuste: motivoAjuste ?? null,
  });
}

function obtenerPorId(id) {
  const fila = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
  if (!fila) return undefined;

  const items = db
    .prepare('SELECT * FROM ventas_items WHERE venta_id = ? ORDER BY id')
    .all(id)
    .map(mapearItem);

  return { ...mapearVenta(fila), items };
}

function listar({ cajaSesionId, desde, hasta } = {}) {
  const condiciones = [];
  const parametros = {};

  if (cajaSesionId !== undefined) {
    condiciones.push('caja_sesion_id = @cajaSesionId');
    parametros.cajaSesionId = cajaSesionId;
  }

  // creada_en es 'YYYY-MM-DD HH:MM:SS' (datetime('now') de SQLite), así
  // que comparar como texto contra 'YYYY-MM-DD' funciona directo por
  // orden lexicográfico. `hasta` se extiende al final del día para que
  // sea inclusivo.
  if (desde !== undefined) {
    condiciones.push('creada_en >= @desde');
    parametros.desde = desde;
  }

  if (hasta !== undefined) {
    condiciones.push('creada_en <= @hasta');
    parametros.hasta = `${hasta} 23:59:59`;
  }

  const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = db
    .prepare(`SELECT * FROM ventas ${clausulaWhere} ORDER BY creada_en DESC`)
    .all(parametros);

  return filas.map(mapearVenta);
}

module.exports = {
  obtenerCajaSesionPorId,
  crear,
  crearItem,
  anular,
  obtenerPorId,
  listar,
};
