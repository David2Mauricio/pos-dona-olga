const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./vencimientos.controller');
const { crearLoteSchema, actualizarLoteSchema, listarLotesQuerySchema } = require('./vencimientos.schema');
const { idParamsSchema } = require('../../utils/schemas-comunes');

const router = Router();

router.post('/lotes', validar(crearLoteSchema, 'body'), controller.crear);
router.get('/lotes', validar(listarLotesQuerySchema, 'query'), controller.listar);
router.patch(
  '/lotes/:id',
  validar(idParamsSchema, 'params'),
  validar(actualizarLoteSchema, 'body'),
  controller.actualizar
);
router.get('/alertas', controller.alertas);

module.exports = router;
