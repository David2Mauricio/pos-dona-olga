const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./productos.controller');
const {
  crearProductoSchema,
  actualizarProductoSchema,
  listarProductosQuerySchema,
  idParamsSchema,
  codigoBarrasParamsSchema,
} = require('./productos.schema');

const router = Router();

router.post('/', validar(crearProductoSchema, 'body'), controller.crear);
router.get('/', validar(listarProductosQuerySchema, 'query'), controller.listar);

// Va antes de "/:id": si no, Express intentaría interpretar "codigo-barras"
// como el valor del parámetro :id.
router.get(
  '/codigo-barras/:codigo',
  validar(codigoBarrasParamsSchema, 'params'),
  controller.obtenerPorCodigoBarras
);

router.get('/:id', validar(idParamsSchema, 'params'), controller.obtenerPorId);

router.patch(
  '/:id',
  validar(idParamsSchema, 'params'),
  validar(actualizarProductoSchema, 'body'),
  controller.actualizar
);

module.exports = router;
