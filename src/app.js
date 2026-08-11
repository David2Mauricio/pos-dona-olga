const express = require('express');
const AppError = require('./utils/app-error');
const manejadorDeErrores = require('./middlewares/error-handler');

const app = express();

app.use(express.json());

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

// A partir de aquí se irán montando el resto de módulos de negocio.

// Cualquier ruta que no coincida con nada anterior cae acá.
app.use((req, res, next) => {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
});

// El manejador de errores SIEMPRE va al final, después de todas las rutas.
app.use(manejadorDeErrores);

module.exports = app;
