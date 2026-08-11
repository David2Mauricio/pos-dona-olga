const repository = require('./caja.repository');
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

function abrir(montoApertura) {
  // Regla de negocio: solo una sesión abierta a la vez. Sin esto, dos
  // aperturas por error repartirían las ventas del día entre dos cajas
  // sin ningún sentido.
  const sesionAbierta = repository.obtenerSesionAbierta();
  if (sesionAbierta) {
    throw new AppError(`Ya existe una sesión de caja abierta (id ${sesionAbierta.id})`, 409);
  }

  return repository.crear(montoApertura);
}

function cerrar(id, montoCierre) {
  const sesion = obtenerPorId(id); // 404 si no existe

  if (sesion.estado === 'cerrada') {
    throw new AppError(`La sesión de caja ${id} ya está cerrada`, 400);
  }

  const montoTeoricoEfectivo = calcularMontoTeoricoEfectivo(sesion);
  const sesionCerrada = repository.cerrar(id, montoCierre);

  return {
    ...sesionCerrada,
    montoTeoricoEfectivo,
    diferencia: montoCierre - montoTeoricoEfectivo,
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
