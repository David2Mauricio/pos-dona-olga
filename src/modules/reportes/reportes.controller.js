const reportesService = require('./reportes.service');

function reporteVentas(req, res) {
  const reporte = reportesService.reporteVentas(req.query);
  res.json(reporte);
}

function reporteInventario(req, res) {
  const reporte = reportesService.reporteInventario();
  res.json(reporte);
}

module.exports = { reporteVentas, reporteInventario };
