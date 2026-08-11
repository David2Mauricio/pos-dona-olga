const path = require('node:path');
const express = require('express');
const session = require('express-session');
const compression = require('compression');
const AppError = require('./utils/app-error');
const manejadorDeErrores = require('./middlewares/error-handler');
const { opcionesSession } = require('./auth/session-config');
const { requiereSesion, requiereRol } = require('./auth/auth.middleware');

const app = express();

// Comprime respuestas de texto (HTML/CSS/JS/JSON) — sin esto, Lighthouse
// marca ~32KiB de ahorro perdido en la interfaz de mostrador. No aplica a
// los .woff2 de public/fonts/ (ya vienen comprimidos, compression los
// detecta y no los toca dos veces).
app.use(compression());

app.use(express.json());

// Interfaz de mostrador (SPA estática) y fotos de producto. Van antes de
// cualquier chequeo de sesión: la pantalla de login (HTML/CSS/JS/fuentes)
// tiene que poder cargar sin estar logueado.
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use(session(opcionesSession));

// Endpoint simple para confirmar que el servidor está vivo y respondiendo.
// Sin sesión a propósito: es un chequeo de infraestructura, no de negocio.
app.get('/api/health', (req, res) => {
  res.json({ estado: 'ok' });
});

// login/logout no requieren sesión (la crean o la terminan); /sesion y
// /cambiar-password sí, pero la llevan puesta ellos mismos (ver
// auth.routes.js) porque este módulo entero queda ANTES del gate global
// de acá abajo.
app.use('/api/auth', require('./auth/auth.routes'));

// A partir de acá, TODA ruta /api/* requiere una sesión activa (ver
// ADR 0010) — login/logout/health ya quedaron resueltos arriba, antes de
// este punto, así que nunca llegan a este middleware.
app.use('/api', requiereSesion);

// Matriz de permisos (ADR 0010): los módulos donde TODAS las rutas son
// solo-administrador lo declaran acá, en el punto de montaje, para que
// quede visible de un vistazo. Los módulos con permisos mixtos
// (crear/editar admin, listar ambos roles) lo declaran ruta por ruta
// dentro de su propio *.routes.js — ver productos y categorías.
app.use('/api/categorias', require('./modules/categorias/categorias.routes'));
app.use('/api/productos', require('./modules/productos/productos.routes'));
app.use('/api/ventas', require('./modules/ventas/ventas.routes'));
app.use('/api/caja', require('./modules/caja/caja.routes'));
app.use('/api/inventario', require('./modules/inventario/inventario.routes'));
app.use('/api/proveedores', requiereRol('administrador'), require('./modules/proveedores/proveedores.routes'));
app.use('/api/vencimientos', require('./modules/vencimientos/vencimientos.routes'));
app.use('/api/reportes', requiereRol('administrador'), require('./modules/reportes/reportes.routes'));
app.use('/api/usuarios', requiereRol('administrador'), require('./modules/usuarios/usuarios.routes'));

// Cualquier ruta que no coincida con nada anterior cae acá.
app.use((req, res, next) => {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
});

// El manejador de errores SIEMPRE va al final, después de todas las rutas.
app.use(manejadorDeErrores);

module.exports = app;
