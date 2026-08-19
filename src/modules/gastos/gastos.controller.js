const gastosService = require('./gastos.service');

function crear(req, res) {
  const gasto = gastosService.crear(req.body, req.session.usuario.id);
  res.status(201).json(gasto);
}

function listar(req, res) {
  res.json(gastosService.listar(req.query));
}

function actualizar(req, res) {
  const gasto = gastosService.actualizar(req.params.id, req.body, req.session.usuario.id);
  res.json(gasto);
}

module.exports = { crear, listar, actualizar };
