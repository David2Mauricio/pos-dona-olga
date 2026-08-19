const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./usuarios.controller');
const { crearUsuarioSchema, actualizarUsuarioSchema } = require('./usuarios.schema');
const { idParamsSchema } = require('../../utils/schemas-comunes');

const router = Router();

// Módulo entero solo-administrador (ver matriz de permisos, ADR 0010).
// La restricción se aplica al montar la ruta en app.js (igual que
// proveedores y reportes) para que TODA la matriz de permisos quede
// visible en un solo lugar, en vez de repartida entre archivos.

router.post('/', validar(crearUsuarioSchema, 'body'), controller.crear);
router.get('/', controller.listar);
router.patch('/:id', validar(idParamsSchema, 'params'), validar(actualizarUsuarioSchema, 'body'), controller.actualizar);
router.patch('/:id/resetear-password', validar(idParamsSchema, 'params'), controller.resetearPassword);
router.delete('/:id', validar(idParamsSchema, 'params'), controller.borrar);

module.exports = router;
