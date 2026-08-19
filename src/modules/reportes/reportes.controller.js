const reportesService = require('./reportes.service');

function reporteVentas(req, res) {
  const reporte = reportesService.reporteVentas(req.query);
  res.json(reporte);
}

function reporteInventario(req, res) {
  const reporte = reportesService.reporteInventario();
  res.json(reporte);
}

function exportarVentasCsv(req, res) {
  const { desde, hasta } = req.query;
  const csv = reportesService.exportarVentasCsv(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ventas-${desde}-a-${hasta}.csv"`);
  res.send(csv);
}

module.exports = { reporteVentas, reporteInventario, exportarVentasCsv };
