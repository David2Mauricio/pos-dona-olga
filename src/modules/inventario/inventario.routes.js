const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./inventario.controller');
const { requiereRol } = require('../../auth/auth.middleware');
const { crearMovimientoSchema, listarMovimientosQuerySchema } = require('./inventario.schema');

const router = Router();

// Ver la matriz de permisos (ADR 0010, ampliada en Fase 4/ADR 0013): un
// ajuste manual de stock sin venta real detrás es una vía para tapar una
// merma o un faltante, mismo criterio de riesgo que anular una venta —
// queda solo-administrador. Listar y ver alertas sigue siendo de ambos
// roles, un cajero necesita poder consultarlo.
router.post('/movimientos', requiereRol('administrador'), validar(crearMovimientoSchema, 'body'), controller.crear);
router.get('/movimientos', validar(listarMovimientosQuerySchema, 'query'), controller.listar);
router.get('/alertas', controller.alertas);

module.exports = router;
