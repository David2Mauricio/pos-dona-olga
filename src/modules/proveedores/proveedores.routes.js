const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./proveedores.controller');
const {
  crearProveedorSchema,
  actualizarProveedorSchema,
  listarProveedoresQuerySchema,
  idParamsSchema,
} = require('./proveedores.schema');

const router = Router();

router.post('/', validar(crearProveedorSchema, 'body'), controller.crear);
router.get('/', validar(listarProveedoresQuerySchema, 'query'), controller.listar);
router.get('/:id', validar(idParamsSchema, 'params'), controller.obtenerPorId);
router.patch(
  '/:id',
  validar(idParamsSchema, 'params'),
  validar(actualizarProveedorSchema, 'body'),
  controller.actualizar
);

module.exports = router;
