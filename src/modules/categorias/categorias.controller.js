const categoriasService = require('./categorias.service');

function crear(req, res) {
  const categoria = categoriasService.crear(req.body.nombre);
  res.status(201).json(categoria);
}

function listar(req, res) {
  const categorias = categoriasService.listar();
  res.json(categorias);
}

function actualizar(req, res) {
  const categoria = categoriasService.actualizar(req.params.id, req.body.nombre);
  res.json(categoria);
}

module.exports = { crear, listar, actualizar };
