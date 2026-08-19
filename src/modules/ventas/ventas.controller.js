const ventasService = require('./ventas.service');

function crear(req, res) {
  const venta = ventasService.crear(req.body, req.session.usuario.id);
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

function reimprimir(req, res) {
  const venta = ventasService.reimprimir(req.params.id);
  res.json(venta);
}

function anular(req, res) {
  const venta = ventasService.anular(req.params.id, req.body.motivoAnulacion, req.session.usuario.id);
  res.json(venta);
}

module.exports = { crear, obtenerPorId, listar, reimprimir, anular };
