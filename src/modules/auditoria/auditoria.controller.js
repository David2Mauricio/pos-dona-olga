const auditoriaService = require('./auditoria.service');

// Solo listar() -- ver ADR 0018. Ninguna otra función existe en este
// archivo (ni crear, ni actualizar, ni borrar).
function listar(req, res) {
  res.json(auditoriaService.listar(req.query));
}

module.exports = { listar };
