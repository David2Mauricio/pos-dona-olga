const { Router } = require('express');
const validar = require('../../middlewares/validate');
const controller = require('./auditoria.controller');
const { listarAuditoriaQuerySchema } = require('./auditoria.schema');

const router = Router();

// Un solo verbo, a propósito (ver ADR 0018): GET, nada más. No hay
// router.post/patch/delete acá, ni siquiera uno que responda 405 -- la
// ruta directamente no existe. admin-only se aplica al montar el router
// completo en app.js (mismo patrón que /api/usuarios y /api/proveedores),
// no repetido por ruta.
router.get('/', validar(listarAuditoriaQuerySchema, 'query'), controller.listar);

module.exports = router;
