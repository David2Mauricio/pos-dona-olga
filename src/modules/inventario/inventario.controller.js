const inventarioService = require('./inventario.service');

function crear(req, res) {
  const movimiento = inventarioService.crear(req.body);
  res.status(201).json(movimiento);
}

function listar(req, res) {
  const movimientos = inventarioService.listar(req.query);
  res.json(movimientos);
}

function alertas(req, res) {
  const productos = inventarioService.obtenerAlertas();
  res.json(productos);
}

module.exports = { crear, listar, alertas };
