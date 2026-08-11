const env = require('../config/env');

// Nombre propio de cookie (no el "connect.sid" genérico de
// express-session) — exportado para que auth.controller.js pueda usar
// exactamente el mismo valor al limpiar la cookie en logout. Definirlo
// en dos lugares sería la forma más fácil de que un día queden
// desincronizados y logout deje de funcionar.
const NOMBRE_COOKIE_SESION = 'pos.sid';

const opcionesSession = {
  name: NOMBRE_COOKIE_SESION,
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // Sin HTTPS a propósito: todo corre en localhost/LAN sin TLS (ver
    // ADR 0001 y ADR 0010) — secure:true rompería la cookie por completo.
    secure: false,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000, // 12 horas: dura una jornada de trabajo
  },
};

module.exports = { NOMBRE_COOKIE_SESION, opcionesSession };
