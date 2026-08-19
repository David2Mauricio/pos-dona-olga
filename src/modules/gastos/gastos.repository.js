const db = require('../../config/database');

function mapearFila(fila) {
  if (!fila) return undefined;
  return {
    id: fila.id,
    concepto: fila.concepto,
    monto: fila.monto,
    fecha: fila.fecha,
    categoria: fila.categoria,
    usuarioId: fila.usuario_id,
    activo: fila.activo === 1,
    creadoEn: fila.creado_en,
  };
}

function crear({ concepto, monto, fecha, categoria, usuarioId }) {
  const resultado = db
    .prepare(
      `INSERT INTO gastos (concepto, monto, fecha, categoria, usuario_id)
       VALUES (@concepto, @monto, @fecha, @categoria, @usuarioId)`
    )
    .run({ concepto, monto, fecha, categoria: categoria ?? null, usuarioId });

  return resultado.lastInsertRowid;
}

function obtenerPorId(id) {
  return mapearFila(db.prepare('SELECT * FROM gastos WHERE id = ?').get(id));
}

function actualizar(id, cambios) {
  db.prepare('UPDATE gastos SET activo = @activo WHERE id = @id').run({ id, activo: cambios.activo ? 1 : 0 });
  return obtenerPorId(id);
}

function listar({ desde, hasta, categoria } = {}) {
  const condiciones = [];
  const parametros = {};

  // fecha es 'YYYY-MM-DD' simple (no datetime), a diferencia de creada_en
  // en ventas -- comparación directa, sin la extensión "+23:59:59" que
  // usan los rangos sobre columnas *_en con hora.
  if (desde !== undefined) {
    condiciones.push('fecha >= @desde');
    parametros.desde = desde;
  }
  if (hasta !== undefined) {
    condiciones.push('fecha <= @hasta');
    parametros.hasta = hasta;
  }
  if (categoria !== undefined) {
    condiciones.push('categoria = @categoria');
    parametros.categoria = categoria;
  }

  const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = db.prepare(`SELECT * FROM gastos ${clausulaWhere} ORDER BY fecha DESC, id DESC`).all(parametros);
  return filas.map(mapearFila);
}

// Total de gastos ACTIVOS en un rango -- usado por reportes.service.js
// para "Gastos del período" y "Ganancia real" en Indicadores. Un gasto
// desactivado (mal registrado) no debe seguir restando de la ganancia
// mostrada.
function obtenerTotalPorRango({ desde, hasta }) {
  const fila = db
    .prepare('SELECT COALESCE(SUM(monto), 0) AS total FROM gastos WHERE activo = 1 AND fecha >= @desde AND fecha <= @hasta')
    .get({ desde, hasta });
  return fila.total;
}

module.exports = { crear, obtenerPorId, actualizar, listar, obtenerTotalPorRango };
