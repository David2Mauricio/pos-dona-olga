const productosService = require('./productos.service');

// Cada función recibe req/res ya validados por el middleware de zod
// correspondiente (ver productos.routes.js). No hay lógica de negocio acá:
// solo traducir HTTP <-> dominio.

function crear(req, res) {
  const producto = productosService.crear(req.body);
  res.status(201).json(producto);
}

function listar(req, res) {
  const productos = productosService.listar(req.query);
  res.json(productos);
}

function obtenerPorId(req, res) {
  const producto = productosService.obtenerPorId(req.params.id);
  res.json(producto);
}

function obtenerPorCodigoBarras(req, res) {
  const producto = productosService.obtenerPorCodigoBarras(req.params.codigo);
  res.json(producto);
}

function actualizar(req, res) {
  const producto = productosService.actualizar(req.params.id, req.body);
  res.json(producto);
}

module.exports = {
  crear,
  listar,
  obtenerPorId,
  obtenerPorCodigoBarras,
  actualizar,
};
