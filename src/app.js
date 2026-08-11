const path = require('node:path');
const express = require('express');
const compression = require('compression');
const AppError = require('./utils/app-error');
const manejadorDeErrores = require('./middlewares/error-handler');

const app = express();

// Comprime respuestas de texto (HTML/CSS/JS/JSON) — sin esto, Lighthouse
// marca ~32KiB de ahorro perdido en la interfaz de mostrador. No aplica a
// los .woff2 de public/fonts/ (ya vienen comprimidos, compression los
// detecta y no los toca dos veces).
app.use(compression());

app.use(express.json());

// Interfaz de mostrador (SPA estática) y fotos de producto. Van antes de
// las rutas /api: si el archivo no existe, express.static simplemente
// sigue a la siguiente ruta (no interfiere con la API).
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Endpoint simple para confirmar que el servidor está vivo y respondiendo.
// Útil para pruebas manuales ahora y para un futuro chequeo de salud local.
app.get('/api/health', (req, res) => {
  res.json({ estado: 'ok' });
});

app.use('/api/categorias', require('./modules/categorias/categorias.routes'));
app.use('/api/productos', require('./modules/productos/productos.routes'));
app.use('/api/ventas', require('./modules/ventas/ventas.routes'));
app.use('/api/caja', require('./modules/caja/caja.routes'));
app.use('/api/inventario', require('./modules/inventario/inventario.routes'));
app.use('/api/proveedores', require('./modules/proveedores/proveedores.routes'));
app.use('/api/vencimientos', require('./modules/vencimientos/vencimientos.routes'));
app.use('/api/reportes', require('./modules/reportes/reportes.routes'));

// A partir de aquí se irán montando el resto de módulos de negocio.

// Cualquier ruta que no coincida con nada anterior cae acá.
app.use((req, res, next) => {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
});

// El manejador de errores SIEMPRE va al final, después de todas las rutas.
app.use(manejadorDeErrores);

module.exports = app;
