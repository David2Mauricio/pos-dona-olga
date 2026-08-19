const usuariosService = require('./usuarios.service');

function crear(req, res) {
  const usuario = usuariosService.crear(req.body, req.session.usuario.id);
  res.status(201).json(usuario);
}

function listar(req, res) {
  res.json(usuariosService.listar());
}

function actualizar(req, res) {
  const usuario = usuariosService.actualizar(req.params.id, req.body, req.session.usuario.id);
  res.json(usuario);
}

function resetearPassword(req, res) {
  const usuario = usuariosService.resetearPassword(req.params.id, req.session.usuario.id);
  res.json(usuario);
}

function borrar(req, res) {
  usuariosService.borrar(req.params.id, req.session.usuario.id);
  res.status(204).end();
}

module.exports = { crear, listar, actualizar, resetearPassword, borrar };
