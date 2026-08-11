const ventasService = require('./ventas.service');

function crear(req, res) {
  const venta = ventasService.crear(req.body);
  res.status(201).json(venta);
}

function obtenerPorId(req, res) {
  const venta = ventasService.obtenerPorId(req.params.id);
  res.json(venta);
}

function listar(req, res) {
  const ventas = ventasService.listar(req.query);
  res.json(ventas);
}

module.exports = { crear, obtenerPorId, listar };
