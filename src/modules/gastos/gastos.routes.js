const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./gastos.controller');
const { idParamsSchema } = require('../../utils/schemas-comunes');
const { crearGastoSchema, actualizarGastoSchema, listarGastosQuerySchema } = require('./gastos.schema');

const router = Router();

router.get('/', validar(listarGastosQuerySchema, 'query'), controller.listar);
router.post('/', validar(crearGastoSchema), controller.crear);
router.patch('/:id', validar(idParamsSchema, 'params'), validar(actualizarGastoSchema), controller.actualizar);

module.exports = router;
