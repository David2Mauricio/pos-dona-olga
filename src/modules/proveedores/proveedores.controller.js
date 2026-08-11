const proveedoresService = require('./proveedores.service');

function crear(req, res) {
  const proveedor = proveedoresService.crear(req.body);
  res.status(201).json(proveedor);
}

function listar(req, res) {
  const proveedores = proveedoresService.listar(req.query);
  res.json(proveedores);
}

function obtenerPorId(req, res) {
  const proveedor = proveedoresService.obtenerPorId(req.params.id);
  res.json(proveedor);
}

function actualizar(req, res) {
  const proveedor = proveedoresService.actualizar(req.params.id, req.body);
  res.json(proveedor);
}

module.exports = { crear, listar, obtenerPorId, actualizar };
