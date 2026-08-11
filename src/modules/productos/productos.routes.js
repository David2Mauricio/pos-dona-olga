const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./productos.controller');
const { requiereRol } = require('../../auth/auth.middleware');
const {
  crearProductoSchema,
  actualizarProductoSchema,
  listarProductosQuerySchema,
  idParamsSchema,
  codigoBarrasParamsSchema,
} = require('./productos.schema');

const router = Router();

// Ver la matriz de permisos (ADR 0010): crear/editar es solo
// administrador; listar/buscar es de ambos roles (un cajero necesita
// poder ver el catálogo para vender).
router.post('/', requiereRol('administrador'), validar(crearProductoSchema, 'body'), controller.crear);
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
  requiereRol('administrador'),
  validar(idParamsSchema, 'params'),
  validar(actualizarProductoSchema, 'body'),
  controller.actualizar
);

module.exports = router;
