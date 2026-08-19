const db = require('../../config/database');

// Inmutable de verdad (ver ADR 0018): este archivo define crear() y
// listar() y nada más. No hay actualizar() ni borrar() -- no "existen
// pero no se exponen", directamente no están escritos. Si en algún
// momento alguien necesita "corregir" un registro de auditoría, la
// respuesta correcta es un nuevo registro que lo explique, nunca editar
// o borrar el original.

function mapearFila(fila) {
  if (!fila) return undefined;

  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    accion: fila.accion,
    entidadTipo: fila.entidad_tipo,
    entidadId: fila.entidad_id,
    detalle: JSON.parse(fila.detalle),
    creadoEn: fila.creado_en,
  };
}

function crear({ usuarioId, accion, entidadTipo, entidadId, detalle }) {
  const resultado = db
    .prepare(
      `INSERT INTO auditoria (usuario_id, accion, entidad_tipo, entidad_id, detalle)
       VALUES (@usuarioId, @accion, @entidadTipo, @entidadId, @detalle)`
    )
    .run({
      usuarioId: usuarioId ?? null,
      accion,
      entidadTipo,
      entidadId: entidadId ?? null,
      detalle: JSON.stringify(detalle ?? {}),
    });

  return resultado.lastInsertRowid;
}

function obtenerPorId(id) {
  const fila = db.prepare('SELECT * FROM auditoria WHERE id = ?').get(id);
  return mapearFila(fila);
}

// Se enriquece con nombre/usuario de quien actuó (join a usuarios) para
// que la UI no tenga que resolver un mapa aparte -- a diferencia de
// movimientos_inventario/lotes_vencimiento, acá el "quién" es el dato
// principal de la pantalla, no un detalle secundario.
function listar({ accion, usuarioId, desde, hasta } = {}) {
  const condiciones = [];
  const parametros = {};

  if (accion !== undefined) {
    condiciones.push('a.accion = @accion');
    parametros.accion = accion;
  }
  if (usuarioId !== undefined) {
    condiciones.push('a.usuario_id = @usuarioId');
    parametros.usuarioId = usuarioId;
  }
  if (desde !== undefined) {
    condiciones.push('a.creado_en >= @desde');
    parametros.desde = desde;
  }
  if (hasta !== undefined) {
    condiciones.push('a.creado_en <= @hasta');
    parametros.hasta = `${hasta} 23:59:59`;
  }

  const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = db
    .prepare(
      `SELECT a.*, u.nombre AS usuario_nombre, u.usuario AS usuario_usuario
       FROM auditoria a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       ${clausulaWhere}
       ORDER BY a.creado_en DESC, a.id DESC`
    )
    .all(parametros);

  return filas.map((fila) => ({
    ...mapearFila(fila),
    usuarioNombre: fila.usuario_nombre ?? null,
    usuarioUsuario: fila.usuario_usuario ?? null,
  }));
}

module.exports = { crear, obtenerPorId, listar };
