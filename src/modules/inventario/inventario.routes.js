const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./inventario.controller');
const { crearMovimientoSchema, listarMovimientosQuerySchema } = require('./inventario.schema');

const router = Router();

router.post('/movimientos', validar(crearMovimientoSchema, 'body'), controller.crear);
router.get('/movimientos', validar(listarMovimientosQuerySchema, 'query'), controller.listar);
router.get('/alertas', controller.alertas);

module.exports = router;
