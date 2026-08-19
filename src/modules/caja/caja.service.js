const db = require('../../config/database');
const repository = require('./caja.repository');
const { registrarAuditoria } = require('../auditoria/auditoria.service');
const AppError = require('../../utils/app-error');

function obtenerPorId(id) {
  const sesion = repository.obtenerPorId(id);
  if (!sesion) {
    throw new AppError(`No existe una sesión de caja con id ${id}`, 404);
  }
  return sesion;
}

// ADR 0004: monto_apertura + lo vendido en efectivo (comparación tolerante
// a mayúsculas/espacios, sin catálogo de medios de pago todavía). Nunca se
// persiste — se calcula cada vez que se pide.
function calcularMontoTeoricoEfectivo(sesion) {
  return sesion.montoApertura + repository.obtenerTotalEfectivo(sesion.id);
}

function abrir(montoApertura, usuarioId) {
  // Regla de negocio: solo una sesión abierta a la vez. Sin esto, dos
  // aperturas por error repartirían las ventas del día entre dos cajas
  // sin ningún sentido.
  const sesionAbierta = repository.obtenerSesionAbierta();
  if (sesionAbierta) {
    throw new AppError(`Ya existe una sesión de caja abierta (id ${sesionAbierta.id})`, 409);
  }

  return repository.crear(montoApertura, usuarioId);
}

// usuarioId: quién cierra la caja (ver ADR 0018) -- cerrar.repository()
// y el registro de auditoría corren en la misma transacción, para que
// "la caja cerró pero no quedó auditada" no sea un estado posible.
function cerrar(id, montoCierre, usuarioId) {
  const sesion = obtenerPorId(id); // 404 si no existe

  if (sesion.estado === 'cerrada') {
    throw new AppError(`La sesión de caja ${id} ya está cerrada`, 400);
  }

  const montoTeoricoEfectivo = calcularMontoTeoricoEfectivo(sesion);
  const diferencia = montoCierre - montoTeoricoEfectivo;
  const ajustePorRedondeo = repository.obtenerAjustePorRedondeo(id);

  const cerrarTransaccional = db.transaction(() => {
    const sesionCerrada = repository.cerrar(id, montoCierre);
    registrarAuditoria({
      usuarioId,
      accion: 'cierre_caja',
      entidadTipo: 'caja_sesion',
      entidadId: id,
      detalle: { montoApertura: sesion.montoApertura, montoCierre, montoTeoricoEfectivo, diferencia, ajustePorRedondeo },
    });
    return sesionCerrada;
  });

  const sesionCerrada = cerrarTransaccional();

  return {
    ...sesionCerrada,
    montoTeoricoEfectivo,
    diferencia,
    ajustePorRedondeo,
  };
}

function obtenerReporte(id) {
  const sesion = obtenerPorId(id); // 404 si no existe

  const montoTeoricoEfectivo = calcularMontoTeoricoEfectivo(sesion);

  return {
    ...sesion,
    totalVentas: repository.obtenerTotalVentas(id),
    desglosePorMedioPago: repository.obtenerDesglosePorMedioPago(id),
    montoTeoricoEfectivo,
    // La diferencia solo tiene sentido si ya se declaró un monto de cierre.
    diferencia: sesion.estado === 'cerrada' ? sesion.montoCierre - montoTeoricoEfectivo : null,
    ajustePorRedondeo: repository.obtenerAjustePorRedondeo(id),
  };
}

function obtenerActual() {
  const sesion = repository.obtenerSesionAbierta();
  if (!sesion) {
    throw new AppError('No hay ninguna sesión de caja abierta', 404);
  }
  return sesion;
}

module.exports = { abrir, cerrar, obtenerReporte, obtenerActual };
