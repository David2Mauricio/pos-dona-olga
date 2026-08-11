const usuariosService = require('./usuarios.service');

function crear(req, res) {
  const usuario = usuariosService.crear(req.body);
  res.status(201).json(usuario);
}

function listar(req, res) {
  res.json(usuariosService.listar());
}

function actualizar(req, res) {
  const usuario = usuariosService.actualizar(req.params.id, req.body);
  res.json(usuario);
}

module.exports = { crear, listar, actualizar };
