const AppError = require('../utils/app-error');

// Rutas que siguen funcionando aunque el usuario todavía deba cambiar su
// contraseña temporal — sin esto, no habría forma de completar ese
// cambio (ver ADR 0010: el cambio obligatorio bloquea el resto del
// sistema, no puede bloquearse a sí mismo).
const RUTAS_PERMITIDAS_CON_CAMBIO_PENDIENTE = new Set([
  '/api/auth/cambiar-password',
  '/api/auth/logout',
  '/api/auth/sesion',
]);

// Se usa en dos puntos: como middleware global para todas las rutas de
// negocio (montado en app.js después de /api/health y /api/auth), y
// puntualmente dentro de auth.routes.js para /sesion y /cambiar-password
// (que si necesitan sesión, a diferencia de /login y /logout).
function requiereSesion(req, res, next) {
  if (!req.session?.usuario) {
    return next(new AppError('No hay una sesión activa', 401, 'SIN_SESION'));
  }

  if (req.session.usuario.debeCambiarPassword) {
    const ruta = req.originalUrl.split('?')[0];
    if (!RUTAS_PERMITIDAS_CON_CAMBIO_PENDIENTE.has(ruta)) {
      return next(
        new AppError('Debés cambiar tu contraseña temporal antes de continuar', 403, 'DEBE_CAMBIAR_PASSWORD')
      );
    }
  }

  next();
}

function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.session.usuario.rol)) {
      return next(new AppError('No tenés permiso para realizar esta acción', 403, 'ROL_INSUFICIENTE'));
    }
    next();
  };
}

module.exports = { requiereSesion, requiereRol };
