const db = require('../../config/database');
const repository = require('./gastos.repository');
const AppError = require('../../utils/app-error');
const { registrarAuditoria } = require('../auditoria/auditoria.service');

// usuarioId: quién registra/desactiva el gasto (ver ADR de auditoría,
// 0018, y el de exportación CSV/gastos/redondeo/gráficos que suma estas
// dos acciones nuevas). registro_gasto y baja_gasto quedan en la misma
// transacción que la escritura real, mismo criterio que el resto de las
// acciones sensibles ya instrumentadas -- "se registró pero no quedó
// auditado" no puede pasar por una falla parcial.
function crear({ concepto, monto, fecha, categoria }, usuarioId) {
  const crearTransaccional = db.transaction(() => {
    const id = repository.crear({ concepto, monto, fecha, categoria, usuarioId });
    registrarAuditoria({
      usuarioId,
      accion: 'registro_gasto',
      entidadTipo: 'gasto',
      entidadId: id,
      detalle: { concepto, monto, fecha, categoria: categoria ?? null },
    });
    return id;
  });

  const id = crearTransaccional();
  return repository.obtenerPorId(id);
}

function obtenerPorId(id) {
  const gasto = repository.obtenerPorId(id);
  if (!gasto) {
    throw new AppError(`No existe un gasto con id ${id}`, 404);
  }
  return gasto;
}

function actualizar(id, cambios, usuarioId) {
  const actual = obtenerPorId(id); // 404 si no existe

  const actualizarTransaccional = db.transaction(() => {
    const actualizado = repository.actualizar(id, cambios);

    if (cambios.activo === false && actual.activo !== false) {
      registrarAuditoria({
        usuarioId,
        accion: 'baja_gasto',
        entidadTipo: 'gasto',
        entidadId: id,
        detalle: { concepto: actual.concepto, monto: actual.monto, fecha: actual.fecha },
      });
    }

    return actualizado;
  });

  return actualizarTransaccional();
}

function listar(filtros) {
  return repository.listar(filtros);
}

function obtenerTotalPorRango(rango) {
  return repository.obtenerTotalPorRango(rango);
}

module.exports = { crear, obtenerPorId, actualizar, listar, obtenerTotalPorRango };
