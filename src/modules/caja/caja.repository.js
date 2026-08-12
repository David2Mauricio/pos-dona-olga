const db = require('../../config/database');

function mapearFila(fila) {
  if (!fila) return undefined;

  return {
    id: fila.id,
    montoApertura: fila.monto_apertura,
    montoCierre: fila.monto_cierre,
    estado: fila.estado,
    abiertaEn: fila.abierta_en,
    cerradaEn: fila.cerrada_en,
  };
}

function crear(montoApertura) {
  const resultado = db
    .prepare("INSERT INTO caja_sesiones (monto_apertura, estado) VALUES (?, 'abierta')")
    .run(montoApertura);

  return obtenerPorId(resultado.lastInsertRowid);
}

function obtenerPorId(id) {
  const fila = db.prepare('SELECT * FROM caja_sesiones WHERE id = ?').get(id);
  return mapearFila(fila);
}

// Por regla de negocio solo puede haber una sesión abierta a la vez (se
// hace cumplir en el service), así que a lo sumo hay una fila que
// devolver acá.
function obtenerSesionAbierta() {
  const fila = db.prepare("SELECT * FROM caja_sesiones WHERE estado = 'abierta' LIMIT 1").get();
  return mapearFila(fila);
}

function cerrar(id, montoCierre) {
  db.prepare(
    `UPDATE caja_sesiones
     SET monto_cierre = @montoCierre, estado = 'cerrada', cerrada_en = datetime('now')
     WHERE id = @id`
  ).run({ id, montoCierre });

  return obtenerPorId(id);
}

// Fase 3 (ver ADR 0012): una venta anulada nunca formó parte real del
// dinero en caja (o se revirtió), así que las tres consultas de acá abajo
// excluyen estado='anulada'. La venta sigue existiendo y visible en
// GET /api/ventas — solo deja de sumar en los agregados.
function obtenerTotalVentas(cajaSesionId) {
  return db
    .prepare("SELECT COALESCE(SUM(total), 0) AS total FROM ventas WHERE caja_sesion_id = ? AND estado = 'activa'")
    .get(cajaSesionId).total;
}

// ADR 0004: sin catálogo de medios de pago todavía, así que "efectivo" se
// reconoce por comparación de texto tolerante (mayúsculas/espacios), no
// por un enum. Ambas consultas de acá usan el mismo criterio.
function obtenerTotalEfectivo(cajaSesionId) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM ventas
       WHERE caja_sesion_id = ? AND estado = 'activa' AND TRIM(LOWER(medio_pago)) = 'efectivo'`
    )
    .get(cajaSesionId).total;
}

function obtenerDesglosePorMedioPago(cajaSesionId) {
  return db
    .prepare(
      `SELECT TRIM(LOWER(medio_pago)) AS medioPago, SUM(total) AS total, COUNT(*) AS cantidadVentas
       FROM ventas
       WHERE caja_sesion_id = ? AND estado = 'activa'
       GROUP BY TRIM(LOWER(medio_pago))
       ORDER BY total DESC`
    )
    .all(cajaSesionId);
}

module.exports = {
  crear,
  obtenerPorId,
  obtenerSesionAbierta,
  cerrar,
  obtenerTotalVentas,
  obtenerTotalEfectivo,
  obtenerDesglosePorMedioPago,
};
