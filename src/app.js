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

// A partir de aquí se irán montando los módulos de negocio, por ejemplo:
//   app.use('/api/productos', require('./modules/productos/productos.routes'))

// Cualquier ruta que no coincida con nada anterior cae acá.
app.use((req, res, next) => {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
});

// El manejador de errores SIEMPRE va al final, después de todas las rutas.
app.use(manejadorDeErrores);

module.exports = app;
