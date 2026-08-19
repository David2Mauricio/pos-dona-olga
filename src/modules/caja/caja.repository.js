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
    // NULL en sesiones anteriores a la migración 016 -- mismo criterio que
    // usuario_id en ventas (ver ADR 0010, extensión de borrado de usuarios).
    usuarioId: fila.usuario_id,
  };
}

function crear(montoApertura, usuarioId) {
  const resultado = db
    .prepare("INSERT INTO caja_sesiones (monto_apertura, estado, usuario_id) VALUES (?, 'abierta', ?)")
    .run(montoApertura, usuarioId ?? null);

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
// Redondeo de vuelto (ver ADR de exportación CSV/gastos/redondeo/gráficos):
// el efectivo que realmente queda en la caja es total - redondeo_vuelto
// (si se dio de MENOS vuelto por redondear hacia abajo, queda MÁS efectivo
// del que `total` solo sugeriría, y viceversa). redondeo_vuelto es 0 en
// toda venta creada con el redondeo apagado o que no sea en efectivo, así
// que esta resta no cambia nada para quien nunca activó la función.
function obtenerTotalEfectivo(cajaSesionId) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(total - redondeo_vuelto), 0) AS total
       FROM ventas
       WHERE caja_sesion_id = ? AND estado = 'activa' AND TRIM(LOWER(medio_pago)) = 'efectivo'`
    )
    .get(cajaSesionId).total;
}

// Ajuste agregado por redondeo del período: se expone como su PROPIO
// renglón en el reporte de cierre (ver cierre-caja.js), separado de
// "Sobra/Falta" -- para que el redondeo nunca se confunda con una
// diferencia real sin explicación conocida (pedido explícito del cliente).
function obtenerAjustePorRedondeo(cajaSesionId) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(redondeo_vuelto), 0) AS ajuste
       FROM ventas
       WHERE caja_sesion_id = ? AND estado = 'activa' AND TRIM(LOWER(medio_pago)) = 'efectivo'`
    )
    .get(cajaSesionId).ajuste;
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
  obtenerAjustePorRedondeo,
  obtenerDesglosePorMedioPago,
};
