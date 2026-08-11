const db = require('../../config/database');

function mapearFila(fila) {
  if (!fila) return undefined;

  return {
    id: fila.id,
    nombre: fila.nombre,
    nit: fila.nit,
    telefono: fila.telefono,
    direccion: fila.direccion,
    activo: fila.activo === 1,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

const COLUMNA_POR_CAMPO = {
  nombre: 'nombre',
  nit: 'nit',
  telefono: 'telefono',
  direccion: 'direccion',
  activo: 'activo',
};

function crear(proveedor) {
  const resultado = db
    .prepare(
      `INSERT INTO proveedores (nombre, nit, telefono, direccion, activo)
       VALUES (@nombre, @nit, @telefono, @direccion, @activo)`
    )
    .run({
      nombre: proveedor.nombre,
      nit: proveedor.nit ?? null,
      telefono: proveedor.telefono ?? null,
      direccion: proveedor.direccion ?? null,
      activo: proveedor.activo ? 1 : 0,
    });

  return obtenerPorId(resultado.lastInsertRowid);
}

function obtenerPorId(id) {
  const fila = db.prepare('SELECT * FROM proveedores WHERE id = ?').get(id);
  return mapearFila(fila);
}

function listar({ activo } = {}) {
  const condiciones = [];
  const parametros = {};

  if (activo !== undefined) {
    condiciones.push('activo = @activo');
    parametros.activo = activo ? 1 : 0;
  }

  const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = db.prepare(`SELECT * FROM proveedores ${clausulaWhere} ORDER BY nombre`).all(parametros);

  return filas.map(mapearFila);
}

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

  db.prepare(
    `UPDATE proveedores
     SET ${asignaciones.join(', ')}, actualizado_en = datetime('now')
     WHERE id = @id`
  ).run(parametros);

  return obtenerPorId(id);
}

module.exports = { crear, obtenerPorId, listar, actualizar };
