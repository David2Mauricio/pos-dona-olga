const { Router } = require('express');
const validar = require('../middlewares/validate');
const controller = require('./auth.controller');
const { requiereSesion } = require('./auth.middleware');
const { loginSchema, cambiarPasswordSchema } = require('./auth.schema');

const router = Router();

// login/logout NO requieren sesión (obvio: son para conseguir o
// terminar una). /sesion y /cambiar-password sí, aunque vivan bajo
// /api/auth — por eso llevan requiereSesion explícito acá, ya que el
// middleware global de app.js excluye TODO /api/auth/* (ver ADR 0010).
router.post('/login', validar(loginSchema, 'body'), controller.login);
router.post('/logout', controller.logout);
router.get('/sesion', requiereSesion, controller.sesion);
router.post('/cambiar-password', requiereSesion, validar(cambiarPasswordSchema, 'body'), controller.cambiarPassword);

module.exports = router;
