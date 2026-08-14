const { Router } = require('express');
const validar = require('../middlewares/validate');
const controller = require('./auth.controller');
const { requiereSesion } = require('./auth.middleware');
const {
  loginSchema,
  cambiarPasswordSchema,
  usuarioParamsSchema,
  recuperarPasswordSchema,
} = require('./auth.schema');

const router = Router();

// login/logout NO requieren sesión (obvio: son para conseguir o
// terminar una). /sesion y /cambiar-password sí, aunque vivan bajo
// /api/auth — por eso llevan requiereSesion explícito acá, ya que el
// middleware global de app.js excluye TODO /api/auth/* (ver ADR 0010).
// pregunta-seguridad/recuperar-password tampoco requieren sesión, por la
// misma razón que login: son el camino para conseguir acceso cuando no
// se tiene, no algo que dependa de ya tenerlo (ver ADR de cierre).
router.post('/login', validar(loginSchema, 'body'), controller.login);
router.post('/logout', controller.logout);
router.get('/sesion', requiereSesion, controller.sesion);
router.post('/cambiar-password', requiereSesion, validar(cambiarPasswordSchema, 'body'), controller.cambiarPassword);
router.get(
  '/pregunta-seguridad/:usuario',
  validar(usuarioParamsSchema, 'params'),
  controller.preguntaSeguridad
);
router.post('/recuperar-password', validar(recuperarPasswordSchema, 'body'), controller.recuperarPassword);

module.exports = router;
