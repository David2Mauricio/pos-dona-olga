const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./caja.controller');
const { aperturaSchema, cierreSchema, idParamsSchema } = require('./caja.schema');

const router = Router();

router.post('/apertura', validar(aperturaSchema, 'body'), controller.abrir);

// Va antes de "/:id": si no, Express intentaría interpretar "actual" como
// el valor del parámetro :id (mismo criterio que /codigo-barras en productos).
router.get('/actual', controller.actual);

router.get('/:id', validar(idParamsSchema, 'params'), controller.reporte);
router.patch(
  '/:id/cierre',
  validar(idParamsSchema, 'params'),
  validar(cierreSchema, 'body'),
  controller.cerrar
);

module.exports = router;
