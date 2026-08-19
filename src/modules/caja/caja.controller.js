const cajaService = require('./caja.service');

function abrir(req, res) {
  const sesion = cajaService.abrir(req.body.montoApertura, req.session.usuario.id);
  res.status(201).json(sesion);
}

function cerrar(req, res) {
  const sesion = cajaService.cerrar(req.params.id, req.body.montoCierre, req.session.usuario.id);
  res.json(sesion);
}

function reporte(req, res) {
  const sesion = cajaService.obtenerReporte(req.params.id);
  res.json(sesion);
}

function actual(req, res) {
  const sesion = cajaService.obtenerActual();
  res.json(sesion);
}

module.exports = { abrir, cerrar, reporte, actual };
