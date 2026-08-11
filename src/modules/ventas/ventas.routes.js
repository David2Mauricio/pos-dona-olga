const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./ventas.controller');
const { crearVentaSchema, listarVentasQuerySchema, idParamsSchema } = require('./ventas.schema');

const router = Router();

router.post('/', validar(crearVentaSchema, 'body'), controller.crear);
router.get('/', validar(listarVentasQuerySchema, 'query'), controller.listar);
router.get('/:id', validar(idParamsSchema, 'params'), controller.obtenerPorId);
router.post('/:id/reimprimir', validar(idParamsSchema, 'params'), controller.reimprimir);

module.exports = router;
