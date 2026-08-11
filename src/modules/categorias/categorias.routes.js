const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./categorias.controller');
const { crearCategoriaSchema, actualizarCategoriaSchema, idParamsSchema } = require('./categorias.schema');

const router = Router();

router.post('/', validar(crearCategoriaSchema, 'body'), controller.crear);
router.get('/', controller.listar);
router.patch(
  '/:id',
  validar(idParamsSchema, 'params'),
  validar(actualizarCategoriaSchema, 'body'),
  controller.actualizar
);

module.exports = router;
