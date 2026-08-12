const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./ventas.controller');
const { requiereRol } = require('../../auth/auth.middleware');
const {
  crearVentaSchema,
  listarVentasQuerySchema,
  anularVentaSchema,
  idParamsSchema,
} = require('./ventas.schema');

const router = Router();

router.post('/', validar(crearVentaSchema, 'body'), controller.crear);
router.get('/', validar(listarVentasQuerySchema, 'query'), controller.listar);
router.get('/:id', validar(idParamsSchema, 'params'), controller.obtenerPorId);
router.post('/:id/reimprimir', validar(idParamsSchema, 'params'), controller.reimprimir);

// Ver la matriz de permisos (ADR 0010, ampliada en ADR 0012): anular es
// solo-administrador — a diferencia del override de precios (Fase 2), acá
// sí hay una razón de negocio para restringir: revertir una venta ya
// impresa y ya cobrada es una operación de mayor impacto que ajustar un
// precio antes de cerrarla.
router.patch(
  '/:id/anular',
  requiereRol('administrador'),
  validar(idParamsSchema, 'params'),
  validar(anularVentaSchema, 'body'),
  controller.anular
);

module.exports = router;
