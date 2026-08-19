const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./reportes.controller');
const { reporteVentasQuerySchema, exportarVentasQuerySchema } = require('./reportes.schema');

const router = Router();

router.get('/ventas', validar(reporteVentasQuerySchema, 'query'), controller.reporteVentas);
router.get('/ventas/exportar', validar(exportarVentasQuerySchema, 'query'), controller.exportarVentasCsv);
router.get('/inventario', controller.reporteInventario);

module.exports = router;
