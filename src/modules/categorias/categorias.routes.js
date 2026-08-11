const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./categorias.controller');
const { requiereRol } = require('../../auth/auth.middleware');
const { crearCategoriaSchema, actualizarCategoriaSchema, idParamsSchema } = require('./categorias.schema');

const router = Router();

// Ver la matriz de permisos (ADR 0010): crear/editar es solo
// administrador; listar es de ambos roles.
router.post('/', requiereRol('administrador'), validar(crearCategoriaSchema, 'body'), controller.crear);
router.get('/', controller.listar);
router.patch(
  '/:id',
  requiereRol('administrador'),
  validar(idParamsSchema, 'params'),
  validar(actualizarCategoriaSchema, 'body'),
  controller.actualizar
);

module.exports = router;
