const db = require('../../config/database');

function mapearFila(fila) {
  if (!fila) return undefined;

  return {
    id: fila.id,
    productoId: fila.producto_id,
    cantidad: fila.cantidad,
    fechaVencimiento: fila.fecha_vencimiento,
    activo: fila.activo === 1,
    creadoEn: fila.creado_en,
  };
}

function crear({ productoId, cantidad, fechaVencimiento }) {
  const resultado = db
    .prepare(
      `INSERT INTO lotes_vencimiento (producto_id, cantidad, fecha_vencimiento)
       VALUES (@productoId, @cantidad, @fechaVencimiento)`
    )
    .run({ productoId, cantidad, fechaVencimiento });

  return obtenerPorId(resultado.lastInsertRowid);
}

function obtenerPorId(id) {
  const fila = db.prepare('SELECT * FROM lotes_vencimiento WHERE id = ?').get(id);
  return mapearFila(fila);
}

function listar({ productoId, activo } = {}) {
  const condiciones = [];
  const parametros = {};

  if (productoId !== undefined) {
    condiciones.push('producto_id = @productoId');
    parametros.productoId = productoId;
  }

  if (activo !== undefined) {
    condiciones.push('activo = @activo');
    parametros.activo = activo ? 1 : 0;
  }

  const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = db
    .prepare(`SELECT * FROM lotes_vencimiento ${clausulaWhere} ORDER BY fecha_vencimiento ASC`)
    .all(parametros);

  return filas.map(mapearFila);
}

const COLUMNA_POR_CAMPO = {
  cantidad: 'cantidad',
  fechaVencimiento: 'fecha_vencimiento',
  activo: 'activo',
};

function actualizar(id, cambios) {
  const asignaciones = [];
  const parametros = { id };

  for (const [campo, valor] of Object.entries(cambios)) {
    const columna = COLUMNA_POR_CAMPO[campo];
    if (!columna) continue;

    asignaciones.push(`${columna} = @${campo}`);
    parametros[campo] = campo === 'activo' ? (valor ? 1 : 0) : valor;
  }

  if (asignaciones.length === 0) return obtenerPorId(id);

  db.prepare(`UPDATE lotes_vencimiento SET ${asignaciones.join(', ')} WHERE id = @id`).run(parametros);

  return obtenerPorId(id);
}

// `hoy` y `limite` llegan ya calculados desde el service (que es quien
// conoce DIAS_ALERTA_VENCIMIENTO); acá solo se consulta.
function obtenerAlertas({ hoy, limite }) {
  const vencidos = db
    .prepare(
      `SELECT * FROM lotes_vencimiento
       WHERE activo = 1 AND fecha_vencimiento < @hoy
       ORDER BY fecha_vencimiento ASC`
    )
    .all({ hoy })
    .map(mapearFila);

  const porVencer = db
    .prepare(
      `SELECT * FROM lotes_vencimiento
       WHERE activo = 1 AND fecha_vencimiento >= @hoy AND fecha_vencimiento <= @limite
       ORDER BY fecha_vencimiento ASC`
    )
    .all({ hoy, limite })
    .map(mapearFila);

  return { vencidos, porVencer };
}

module.exports = { crear, obtenerPorId, listar, actualizar, obtenerAlertas };
