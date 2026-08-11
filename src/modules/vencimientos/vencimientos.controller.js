const vencimientosService = require('./vencimientos.service');

function crear(req, res) {
  const lote = vencimientosService.crear(req.body);
  res.status(201).json(lote);
}

function listar(req, res) {
  const lotes = vencimientosService.listar(req.query);
  res.json(lotes);
}

function actualizar(req, res) {
  const lote = vencimientosService.actualizar(req.params.id, req.body);
  res.json(lote);
}

function alertas(req, res) {
  const resultado = vencimientosService.obtenerAlertas();
  res.json(resultado);
}

module.exports = { crear, listar, actualizar, alertas };
