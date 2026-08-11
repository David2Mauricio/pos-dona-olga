const repository = require('./vencimientos.repository');
const productosService = require('../productos/productos.service');
const env = require('../../config/env');
const AppError = require('../../utils/app-error');

function formatearFecha(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function crear(datos) {
  productosService.obtenerPorId(datos.productoId); // 404 si no existe
  return repository.crear(datos);
}

function listar(filtros) {
  return repository.listar(filtros);
}

function obtenerPorId(id) {
  const lote = repository.obtenerPorId(id);
  if (!lote) {
    throw new AppError(`No existe un lote con id ${id}`, 404);
  }
  return lote;
}

function actualizar(id, cambios) {
  obtenerPorId(id); // 404 si no existe
  return repository.actualizar(id, cambios);
}

// "Próximo a vencer" se calcula al vuelo contra la fecha de hoy y el
// umbral configurable DIAS_ALERTA_VENCIMIENTO (ver ADR 0006) — no hay
// nada que guardar, la respuesta cambia sola día a día.
function obtenerAlertas() {
  const ahora = new Date();
  const hoy = formatearFecha(ahora);

  const fechaLimite = new Date(ahora);
  fechaLimite.setDate(fechaLimite.getDate() + env.diasAlertaVencimiento);
  const limite = formatearFecha(fechaLimite);

  return repository.obtenerAlertas({ hoy, limite });
}

module.exports = { crear, listar, obtenerPorId, actualizar, obtenerAlertas };
