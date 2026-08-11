const logger = require('../utils/logger');
const env = require('../config/env');

// Middleware central de errores: TODO error de la aplicación (validación,
// reglas de negocio, o uno inesperado) termina acá. Express lo reconoce
// como manejador de errores porque declara los 4 parámetros (error primero).
//
// Con Express 5, además, cualquier error lanzado dentro de un controller
// async (incluso sin try/catch) llega solo hasta aquí vía next(). Por eso
// los controllers no necesitan envolver cada función en un try/catch propio.
function manejadorDeErrores(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const esOperacional = error.esOperacional === true;

  logger.error(
    `${req.method} ${req.originalUrl} -> ${statusCode}: ${error.message}` +
      (error.stack ? `\n${error.stack}` : '')
  );

  res.status(statusCode).json({
    error: esOperacional ? error.message : 'Error interno del servidor',
    // Código estable opcional (ver AppError) para que el frontend decida
    // qué UI mostrar sin tener que parsear el mensaje.
    ...(error.codigo ? { codigo: error.codigo } : {}),
    // El detalle técnico (stack trace) solo se expone en desarrollo.
    ...(env.isProduction ? {} : { detalle: error.stack }),
  });
}

module.exports = manejadorDeErrores;
